/**
 * DigestQueueService - 通用定时汇总推送队列服务
 * 
 * 功能：
 * 1. 提供统一的队列管理（入队、消费、清理）
 * 2. 支持注册多种 Digest 任务，各有独立频率和处理器
 * 3. 由 TaskScheduler 定时触发 processAll()，检查并推送到期任务
 * 4. 通过 NotificationService 发送通知
 * 
 * 使用方式：
 *   // 注册任务
 *   digestQueueService.register({ id: 'my_task', ... });
 *   // 入队
 *   digestQueueService.enqueue('my_task', { id: '...', data: {...}, createdAt: '...' });
 *   // processAll() 由 TaskScheduler 自动调用
 */

import {
  DigestFrequency,
  DigestQueueItem,
  DigestQueuesStorage,
  DigestProcessor,
  DigestTaskRegistration,
  DigestProcessResult
} from '../types/digestQueue';
import { notificationService, NotificationData } from './NotificationService';
import { Logger } from '../utils/logger';

const STORAGE_KEY = 'digestQueues';

export class DigestQueueService {
  private static instance: DigestQueueService | null = null;
  private tasks: Map<string, DigestTaskRegistration> = new Map();
  private initialized = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): DigestQueueService {
    if (!DigestQueueService.instance) {
      DigestQueueService.instance = new DigestQueueService();
    }
    return DigestQueueService.instance;
  }

  // ==================== 任务注册 ====================

  /**
   * 注册一个 Digest 任务
   */
  public register(task: DigestTaskRegistration): void {
    this.tasks.set(task.id, task);
    console.log(`📋 DigestQueue: 注册任务 "${task.name}" (${task.id}), 频率: ${this.describeFrequency(task.frequency)}`);
  }

  /**
   * 取消注册某个任务
   */
  public unregister(taskId: string): void {
    this.tasks.delete(taskId);
    console.log(`🗑️ DigestQueue: 取消注册任务 ${taskId}`);
  }

  /**
   * 获取所有注册的任务
   */
  public getRegisteredTasks(): DigestTaskRegistration[] {
    return Array.from(this.tasks.values());
  }

  // ==================== 队列操作 ====================

  /**
   * 将条目加入指定任务的队列
   */
  public async enqueue(taskId: string, item: DigestQueueItem): Promise<void> {
    try {
      const storage = await this.loadStorage();
      
      if (!storage[taskId]) {
        storage[taskId] = {
          taskId,
          items: [],
          lastProcessedAt: undefined
        };
      }

      storage[taskId].items.push(item);
      await this.saveStorage(storage);
      
      console.log(`📥 DigestQueue: 条目已入队 [${taskId}], 当前队列长度: ${storage[taskId].items.length}`);
    } catch (error) {
      console.error(`❌ DigestQueue: 入队失败 [${taskId}]:`, error);
    }
  }

  /**
   * 批量入队
   */
  public async enqueueBatch(taskId: string, items: DigestQueueItem[]): Promise<void> {
    try {
      const storage = await this.loadStorage();
      
      if (!storage[taskId]) {
        storage[taskId] = {
          taskId,
          items: [],
          lastProcessedAt: undefined
        };
      }

      storage[taskId].items.push(...items);
      await this.saveStorage(storage);
      
      console.log(`📥 DigestQueue: ${items.length} 条已入队 [${taskId}], 当前队列长度: ${storage[taskId].items.length}`);
    } catch (error) {
      console.error(`❌ DigestQueue: 批量入队失败 [${taskId}]:`, error);
    }
  }

  /**
   * 获取指定任务的队列长度
   */
  public async getQueueLength(taskId: string): Promise<number> {
    const storage = await this.loadStorage();
    return storage[taskId]?.items.length || 0;
  }

  /**
   * 查看队列内容（不消费）
   */
  public async peekQueue(taskId: string): Promise<DigestQueueItem[]> {
    const storage = await this.loadStorage();
    return storage[taskId]?.items || [];
  }

  // ==================== 核心处理 ====================

  /**
   * 处理所有到期的 Digest 任务
   * 由 TaskScheduler 定时调用
   */
  public async processAll(): Promise<DigestProcessResult[]> {
    const results: DigestProcessResult[] = [];
    const now = new Date();
    
    console.log(`🔄 DigestQueue: 开始检查 ${this.tasks.size} 个注册任务...`);

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) {
        continue;
      }

      try {
        const shouldRun = this.shouldRunTask(task, now);
        
        if (shouldRun) {
          console.log(`⚡ DigestQueue: 执行任务 "${task.name}" (${taskId})`);
          const result = await this.processTask(taskId);
          results.push(result);
        }
      } catch (error: any) {
        console.error(`❌ DigestQueue: 任务 "${task.name}" 处理失败:`, error);
        results.push({
          taskId,
          success: false,
          itemsProcessed: 0,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    console.log(`✅ DigestQueue: 处理完成, ${successCount}/${results.length} 个任务成功, 共处理 ${totalItems} 条`);

    return results;
  }

  /**
   * 处理指定任务（可手动触发）
   */
  public async processTask(taskId: string): Promise<DigestProcessResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { taskId, success: false, itemsProcessed: 0, error: `任务 ${taskId} 未注册` };
    }

    const storage = await this.loadStorage();
    const bucket = storage[taskId];
    
    if (!bucket || bucket.items.length === 0) {
      // 更新 lastExecutedAt，即使没有条目
      task.lastExecutedAt = new Date().toISOString();
      return { taskId, success: true, itemsProcessed: 0 };
    }

    try {
      const processor = task.processor;
      
      // 1. 收集/过滤数据
      const collectedItems = await processor.collect(bucket.items);
      
      if (collectedItems.length === 0) {
        task.lastExecutedAt = new Date().toISOString();
        return { taskId, success: true, itemsProcessed: 0 };
      }

      // 2. 格式化消息
      const formattedMessage = await processor.format(collectedItems);
      
      // 3. 获取通知配置并发送
      const notifyConfig = processor.getNotifyConfig();
      
      if (notifyConfig.notifyMethod && formattedMessage) {
        const notificationData: NotificationData = {
          teamId: '',
          teamName: '',
          sender: 'Personal AI',
          messageContent: formattedMessage,
          summary: `[${task.name}] ${collectedItems.length} 条汇总`,
          datetime: new Date().toLocaleString('zh-CN'),
          matchedRule: task.name,
          mention: notifyConfig.mention
        };

        await notificationService.sendNotification(
          notificationData,
          { notifyMethod: notifyConfig.notifyMethod }
        );
      }

      // 4. 清理已处理的条目
      const processedIds = new Set(collectedItems.map(item => item.id));
      bucket.items = bucket.items.filter(item => !processedIds.has(item.id));
      bucket.lastProcessedAt = new Date().toISOString();
      await this.saveStorage(storage);

      // 5. 更新任务状态
      task.lastExecutedAt = new Date().toISOString();

      Logger.task(`digest_${taskId}`, true, `${task.name} 推送完成`, {
        itemsProcessed: collectedItems.length,
        remainingItems: bucket.items.length
      });

      return { taskId, success: true, itemsProcessed: collectedItems.length };
    } catch (error: any) {
      console.error(`❌ DigestQueue: 处理任务 ${taskId} 失败:`, error);
      
      Logger.task(`digest_${taskId}`, false, `${task.name} 推送失败: ${error.message}`);

      return { taskId, success: false, itemsProcessed: 0, error: error.message };
    }
  }

  // ==================== 频率判断 ====================

  /**
   * 判断任务是否应该执行
   */
  private shouldRunTask(task: DigestTaskRegistration, now: Date): boolean {
    const freq = task.frequency;
    const lastRun = task.lastExecutedAt ? new Date(task.lastExecutedAt) : null;

    switch (freq.type) {
      case 'hourly': {
        if (!lastRun) return true;
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastRun >= 1;
      }

      case 'daily': {
        if (!lastRun) return now.getHours() >= freq.hour;
        // 检查是否是新的一天且到达指定小时
        const isNewDay = now.toDateString() !== lastRun.toDateString();
        return isNewDay && now.getHours() >= freq.hour;
      }

      case 'weekly': {
        if (!lastRun) return now.getDay() === freq.dayOfWeek && now.getHours() >= freq.hour;
        const daysSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24);
        const isTargetDay = now.getDay() === freq.dayOfWeek;
        return daysSinceLastRun >= 6 && isTargetDay && now.getHours() >= freq.hour;
      }

      case 'custom': {
        if (!lastRun) return true;
        const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60);
        return minutesSinceLastRun >= freq.intervalMinutes;
      }

      default:
        return false;
    }
  }

  // ==================== 初始化 ====================

  /**
   * 初始化服务：恢复 lastExecutedAt 状态
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await chrome.storage.local.get('digestTaskStates');
      const savedStates = result.digestTaskStates || {};

      for (const [taskId, task] of this.tasks.entries()) {
        if (savedStates[taskId]?.lastExecutedAt) {
          task.lastExecutedAt = savedStates[taskId].lastExecutedAt;
        }
      }

      this.initialized = true;
      console.log('✅ DigestQueueService 初始化完成');
    } catch (error) {
      console.error('❌ DigestQueueService 初始化失败:', error);
    }
  }

  /**
   * 保存任务执行状态（lastExecutedAt）
   */
  public async saveTaskStates(): Promise<void> {
    const states: Record<string, { lastExecutedAt?: string }> = {};
    for (const [taskId, task] of this.tasks.entries()) {
      states[taskId] = { lastExecutedAt: task.lastExecutedAt };
    }
    await chrome.storage.local.set({ digestTaskStates: states });
  }

  // ==================== Storage 操作 ====================

  private async loadStorage(): Promise<DigestQueuesStorage> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  }

  private async saveStorage(storage: DigestQueuesStorage): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: storage });
  }

  // ==================== 工具方法 ====================

  /**
   * 描述频率配置为人类可读文本
   */
  private describeFrequency(freq: DigestFrequency): string {
    switch (freq.type) {
      case 'hourly': return '每小时';
      case 'daily': return `每天 ${freq.hour}:00`;
      case 'weekly': {
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `每${dayNames[freq.dayOfWeek]} ${freq.hour}:00`;
      }
      case 'custom': return `每 ${freq.intervalMinutes} 分钟`;
      default: return '未知';
    }
  }

  /**
   * 获取调试信息
   */
  public async getDebugInfo(): Promise<{
    registeredTasks: Array<{ id: string; name: string; frequency: string; enabled: boolean; lastExecutedAt?: string }>;
    queueSizes: Record<string, number>;
  }> {
    const storage = await this.loadStorage();
    const queueSizes: Record<string, number> = {};
    
    for (const [taskId, bucket] of Object.entries(storage)) {
      queueSizes[taskId] = bucket.items.length;
    }

    return {
      registeredTasks: Array.from(this.tasks.values()).map(t => ({
        id: t.id,
        name: t.name,
        frequency: this.describeFrequency(t.frequency),
        enabled: t.enabled,
        lastExecutedAt: t.lastExecutedAt
      })),
      queueSizes
    };
  }
}

// 导出单例
export const digestQueueService = DigestQueueService.getInstance();

// ==================== 内置处理器 ====================

/** ConcernedItems 每日摘要的任务 ID */
export const CONCERNED_ITEMS_DIGEST_TASK_ID = 'concerned_items_daily';

/**
 * ConcernedItems 每日消息摘要处理器
 * 收集启用了 digestConfig 的关注项匹配到的消息，每日汇总推送
 */
class ConcernedItemsDigestProcessor implements DigestProcessor {
  async collect(items: DigestQueueItem[]): Promise<DigestQueueItem[]> {
    // 返回所有待处理条目
    return items;
  }

  async format(items: DigestQueueItem[]): Promise<string> {
    if (items.length === 0) return '';

    // 按关注项分组
    const grouped: Record<string, Array<{
      sender: string;
      teamName: string;
      summary: string;
      datetime: string;
      messageContent: string;
    }>> = {};

    for (const item of items) {
      const { matchedRule, sender, teamName, summary, datetime, messageContent } = item.data;
      const key = matchedRule || 'unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({ sender, teamName, summary, datetime, messageContent });
    }

    const sections: string[] = [];

    for (const [rule, messages] of Object.entries(grouped)) {
      let section = `**关注项**: ${rule}\n`;
      section += `**匹配消息 ${messages.length} 条**:\n`;
      
      // 最多展示最近 5 条
      const recent = messages.slice(-5);
      for (const msg of recent) {
        section += `  - [${msg.teamName}] ${msg.sender}: ${(msg.summary || msg.messageContent || '').substring(0, 80)}${(msg.summary || msg.messageContent || '').length > 80 ? '...' : ''}\n`;
      }
      
      if (messages.length > 5) {
        section += `  - ...及其他 ${messages.length - 5} 条`;
      }

      sections.push(section);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    
    return `📊 **每日消息摘要** (${dateStr})\n共 ${items.length} 条匹配消息\n\n${sections.join('\n\n---\n\n')}`;
  }

  getNotifyConfig(): import('../types/digestQueue').DigestNotifyConfig {
    return {
      notifyMethod: 'bot',
      mention: false
    };
  }
}

/**
 * 注册 ConcernedItems 每日摘要任务到 DigestQueueService
 * 应在扩展启动时调用
 */
export function registerConcernedItemsDigestTask(): void {
  digestQueueService.register({
    id: CONCERNED_ITEMS_DIGEST_TASK_ID,
    name: 'ConcernedItems 每日消息摘要',
    frequency: { type: 'daily', hour: 18 },
    processor: new ConcernedItemsDigestProcessor(),
    enabled: true
  });
}

/**
 * 将匹配消息加入 ConcernedItems 摘要队列
 * 由 messageDealing.ts 中的分析流程调用
 */
export async function enqueueConcernedItemDigest(data: {
  matchedRule: string;
  sender: string;
  teamName: string;
  teamId: string;
  messageContent: string;
  summary: string;
  datetime: string;
  postId?: string;
}): Promise<void> {
  await digestQueueService.enqueue(CONCERNED_ITEMS_DIGEST_TASK_ID, {
    id: `concerned_${data.postId || Date.now()}_${Date.now()}`,
    data,
    createdAt: new Date().toISOString(),
    sourceId: data.matchedRule
  });
}
