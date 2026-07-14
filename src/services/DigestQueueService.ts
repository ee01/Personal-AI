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
  DigestConfig,
  DigestFrequency,
  DigestQueueItem,
  DigestQueuesStorage,
  DigestProcessor,
  DigestTaskRegistration,
  DigestProcessResult,
  DigestQueueStatusSummary,
  DigestQueueTaskSnapshot,
  DigestQueueSourceBreakdownItem,
  DigestQueueScheduleBreakdownItem,
} from '../types/digestQueue';
import {
  normalizeConcernedItemsDigestDayOfWeek,
  normalizeConcernedItemsDigestHour,
} from '../utils';
import { formatMatchedRuleForDisplay } from '../utils/matchedRuleDisplay';
import { notificationService, NotificationData } from './NotificationService';
import { Logger } from '../utils/logger';
import { DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES } from './digestQueueConfig';

const STORAGE_KEY = 'digestQueues';
const DIGEST_QUEUE_BREAKDOWN_LIMIT = 3;

export { DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES } from './digestQueueConfig';

export const DEFAULT_WEEKLY_DIGEST_DAY_OF_WEEK = 1; // 周一
const CONCERNED_ITEM_WEEKDAY_LABELS = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
] as const;

export class DigestQueueService {
  private static instance: DigestQueueService | null = null;
  private tasks: Map<string, DigestTaskRegistration> = new Map();
  private initialized = false;
  private storageMutationQueue: Promise<unknown> = Promise.resolve();

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
    console.log(
      `📋 DigestQueue: 注册任务 "${task.name}" (${
        task.id
      }), 频率: ${this.describeFrequency(task.frequency)}`,
    );
  }

  /**
   * 更新已注册任务
   */
  public updateTask(
    taskId: string,
    patch: Partial<DigestTaskRegistration>,
  ): boolean {
    const current = this.tasks.get(taskId);
    if (!current) {
      return false;
    }

    const nextTask: DigestTaskRegistration = {
      ...current,
      ...patch,
      id: current.id,
      lastExecutedAt: patch.lastExecutedAt ?? current.lastExecutedAt,
    };

    this.tasks.set(taskId, nextTask);
    console.log(
      `🔄 DigestQueue: 更新任务 "${
        nextTask.name
      }" (${taskId}), 频率: ${this.describeFrequency(nextTask.frequency)}`,
    );
    return true;
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
      await this.withStorageMutation(async () => {
        const storage = await this.loadStorage();
        const bucket = this.ensureBucket(storage, taskId);
        const addedCount = this.appendUniqueItems(bucket, [item]);

        if (addedCount > 0) {
          await this.saveStorage(storage);
        }

        console.log(
          addedCount > 0
            ? `📥 DigestQueue: 条目已入队 [${taskId}], 当前队列长度: ${bucket.items.length}`
            : `📭 DigestQueue: 跳过重复条目 [${taskId}/${item.id}], 当前队列长度: ${bucket.items.length}`,
        );
      });
    } catch (error) {
      console.error(`❌ DigestQueue: 入队失败 [${taskId}]:`, error);
    }
  }

  /**
   * 批量入队
   */
  public async enqueueBatch(
    taskId: string,
    items: DigestQueueItem[],
  ): Promise<void> {
    try {
      await this.withStorageMutation(async () => {
        const storage = await this.loadStorage();
        const bucket = this.ensureBucket(storage, taskId);
        const addedCount = this.appendUniqueItems(bucket, items);

        if (addedCount > 0) {
          await this.saveStorage(storage);
        }

        const skippedCount = items.length - addedCount;
        console.log(
          skippedCount > 0
            ? `📥 DigestQueue: ${addedCount}/${items.length} 条已入队 [${taskId}], 跳过重复 ${skippedCount} 条, 当前队列长度: ${bucket.items.length}`
            : `📥 DigestQueue: ${items.length} 条已入队 [${taskId}], 当前队列长度: ${bucket.items.length}`,
        );
      });
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

  public async getQueueStatusSummary(
    now = new Date(),
  ): Promise<DigestQueueStatusSummary> {
    const storage = await this.loadStorage();
    const tasks = Object.entries(storage)
      .map(([taskId, bucket]) =>
        this.buildQueueSnapshot(taskId, bucket.items, now),
      )
      .filter((snapshot) => snapshot.totalItems > 0);
    const nextReleaseAt = this.getEarliestReleaseAt(tasks);

    return {
      totalItems: tasks.reduce((sum, task) => sum + task.totalItems, 0),
      dueItems: tasks.reduce((sum, task) => sum + task.dueItems, 0),
      nextReleaseAt,
      checkedAt: now.toISOString(),
      tasks,
    };
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

    for (const [taskId, task] of Array.from(this.tasks.entries())) {
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
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    console.log(
      `✅ DigestQueue: 处理完成, ${successCount}/${results.length} 个任务成功, 共处理 ${totalItems} 条`,
    );

    return results;
  }

  /**
   * 处理指定任务（可手动触发）
   */
  public async processTask(taskId: string): Promise<DigestProcessResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        success: false,
        itemsProcessed: 0,
        error: `任务 ${taskId} 未注册`,
      };
    }

    return this.withStorageMutation(async () => {
      const storage = await this.loadStorage();
      const bucket = storage[taskId];

      if (!bucket || bucket.items.length === 0) {
        // 更新 lastExecutedAt，即使没有条目
        task.lastExecutedAt = new Date().toISOString();
        await this.saveTaskStates();
        return {
          taskId,
          success: true,
          itemsProcessed: 0,
          itemsPending: 0,
          itemsDue: 0,
        };
      }

      try {
        const processor = task.processor;

        // 1. 收集/过滤数据
        const collectedItems = await processor.collect(bucket.items);

        if (collectedItems.length === 0) {
          task.lastExecutedAt = new Date().toISOString();
          await this.saveTaskStates();
          return {
            taskId,
            success: true,
            itemsProcessed: 0,
            ...this.buildProcessQueueState(taskId, bucket.items),
          };
        }

        // 2. 格式化消息
        const formattedMessage = await processor.format(collectedItems);

        // 3. 获取通知配置并发送
        const notifyConfig = processor.getNotifyConfig();
        const notifyMethod = notifyConfig.notifyMethod?.trim();

        if (notifyMethod) {
          if (!formattedMessage.trim()) {
            throw new Error('摘要内容为空，已保留队列等待下次处理');
          }

          const notificationData: NotificationData = {
            teamId: '',
            teamName: '',
            sender: 'Personal AI',
            messageContent: formattedMessage,
            summary: `[${task.name}] ${collectedItems.length} 条汇总`,
            datetime: new Date().toLocaleString('zh-CN'),
            matchedRule: task.name,
            mention: notifyConfig.mention,
            pushScenario: notifyConfig.pushScenario,
          };

          const notificationResult = await notificationService.sendNotification(
            notificationData,
            { notifyMethod },
          );

          if (!notificationResult.success) {
            const errorSummary = notificationResult.results
              .map((result) => result.error || `${result.method} 推送失败`)
              .join('; ');
            throw new Error(errorSummary || '通知发送失败，已保留队列等待重试');
          }
        }

        // 4. 清理已处理的条目
        const processedIds = new Set(collectedItems.map((item) => item.id));
        bucket.items = bucket.items.filter(
          (item) => !processedIds.has(item.id),
        );
        bucket.lastProcessedAt = new Date().toISOString();
        await this.saveStorage(storage);

        // 5. 更新任务状态
        task.lastExecutedAt = new Date().toISOString();
        await this.saveTaskStates();

        Logger.task(`digest_${taskId}`, true, `${task.name} 推送完成`, {
          itemsProcessed: collectedItems.length,
          remainingItems: bucket.items.length,
        });

        return {
          taskId,
          success: true,
          itemsProcessed: collectedItems.length,
          ...this.buildProcessQueueState(taskId, bucket.items),
        };
      } catch (error: any) {
        console.error(`❌ DigestQueue: 处理任务 ${taskId} 失败:`, error);

        Logger.task(
          `digest_${taskId}`,
          false,
          `${task.name} 推送失败: ${error.message}`,
        );

        return {
          taskId,
          success: false,
          itemsProcessed: 0,
          ...this.buildProcessQueueState(taskId, bucket.items),
          error: error.message,
        };
      }
    });
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
        const hoursSinceLastRun =
          (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastRun >= 1;
      }

      case 'daily': {
        if (!lastRun) return now.getHours() >= freq.hour;
        // 检查是否是新的一天且到达指定小时
        const isNewDay = now.toDateString() !== lastRun.toDateString();
        return isNewDay && now.getHours() >= freq.hour;
      }

      case 'weekly': {
        if (!lastRun)
          return now.getDay() === freq.dayOfWeek && now.getHours() >= freq.hour;
        const daysSinceLastRun =
          (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24);
        const isTargetDay = now.getDay() === freq.dayOfWeek;
        return (
          daysSinceLastRun >= 6 && isTargetDay && now.getHours() >= freq.hour
        );
      }

      case 'custom': {
        if (!lastRun) return true;
        const minutesSinceLastRun =
          (now.getTime() - lastRun.getTime()) / (1000 * 60);
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

      for (const [taskId, task] of Array.from(this.tasks.entries())) {
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
    for (const [taskId, task] of Array.from(this.tasks.entries())) {
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

  private ensureBucket(storage: DigestQueuesStorage, taskId: string) {
    if (!storage[taskId]) {
      storage[taskId] = {
        taskId,
        items: [],
        lastProcessedAt: undefined,
      };
    }
    return storage[taskId];
  }

  private appendUniqueItems(
    bucket: DigestQueuesStorage[string],
    items: DigestQueueItem[],
  ): number {
    const existingIds = new Set(bucket.items.map((item) => item.id));
    let addedCount = 0;

    for (const item of items) {
      if (existingIds.has(item.id)) {
        continue;
      }
      bucket.items.push(item);
      existingIds.add(item.id);
      addedCount += 1;
    }

    return addedCount;
  }

  private buildProcessQueueState(
    taskId: string,
    items: DigestQueueItem[],
  ): Pick<
    DigestProcessResult,
    'itemsPending' | 'itemsDue' | 'nextReleaseAt' | 'queueSnapshot'
  > {
    const snapshot = this.buildQueueSnapshot(taskId, items);
    return {
      itemsPending: snapshot.totalItems,
      itemsDue: snapshot.dueItems,
      nextReleaseAt: snapshot.nextReleaseAt,
      queueSnapshot: snapshot.totalItems > 0 ? snapshot : undefined,
    };
  }

  private buildQueueSnapshot(
    taskId: string,
    items: DigestQueueItem[],
    now = new Date(),
  ): DigestQueueTaskSnapshot {
    const taskName = this.tasks.get(taskId)?.name;

    if (taskId === CONCERNED_ITEMS_DIGEST_TASK_ID) {
      let dueItems = 0;
      let nextReleaseAt: string | undefined;

      for (const item of items) {
        if (isConcernedItemDigestDue(item, now)) {
          dueItems += 1;
          continue;
        }

        const releaseAt = getConcernedItemDigestReleaseAt(item);
        if (
          Number.isFinite(releaseAt.getTime()) &&
          (!nextReleaseAt ||
            releaseAt.getTime() < new Date(nextReleaseAt).getTime())
        ) {
          nextReleaseAt = releaseAt.toISOString();
        }
      }

      return {
        taskId,
        taskName,
        totalItems: items.length,
        dueItems,
        nextReleaseAt,
        ...this.buildConcernedItemsQueueBreakdown(items),
      };
    }

    return {
      taskId,
      taskName,
      totalItems: items.length,
      dueItems: items.length,
    };
  }

  private buildConcernedItemsQueueBreakdown(
    items: DigestQueueItem[],
  ): Pick<
    DigestQueueTaskSnapshot,
    | 'sourceBreakdown'
    | 'sourceOverflowCount'
    | 'scheduleBreakdown'
    | 'scheduleOverflowCount'
  > {
    const sourceCounts = new Map<string, number>();
    const scheduleCounts = new Map<
      string,
      DigestQueueScheduleBreakdownItem
    >();

    for (const item of items) {
      const sourceLabel = normalizeDigestQueueLabel(
        item.data?.matchedRule || item.sourceId || '未命名关注项',
      );
      sourceCounts.set(sourceLabel, (sourceCounts.get(sourceLabel) || 0) + 1);

      const digestConfig = normalizeDigestConfig(
        item.data?.digestConfig as Partial<DigestConfig> | undefined,
        8,
      );
      const scheduleKey = [
        digestConfig.frequency,
        digestConfig.preferredHour ?? 8,
        digestConfig.preferredDayOfWeek ?? DEFAULT_WEEKLY_DIGEST_DAY_OF_WEEK,
      ].join(':');
      const current = scheduleCounts.get(scheduleKey);
      if (current) {
        current.count += 1;
      } else {
        scheduleCounts.set(scheduleKey, {
          frequency: digestConfig.frequency,
          preferredHour: digestConfig.preferredHour ?? 8,
          preferredDayOfWeek:
            digestConfig.frequency === 'weekly'
              ? digestConfig.preferredDayOfWeek
              : undefined,
          count: 1,
        });
      }
    }

    const sourceEntries = Array.from(sourceCounts.entries())
      .map<DigestQueueSourceBreakdownItem>(([label, count]) => ({
        label,
        count,
      }))
      .sort(compareDigestBreakdownItems)
      .slice(0, DIGEST_QUEUE_BREAKDOWN_LIMIT);
    const scheduleEntries = Array.from(scheduleCounts.values())
      .sort(compareDigestScheduleBreakdownItems)
      .slice(0, DIGEST_QUEUE_BREAKDOWN_LIMIT);

    return {
      sourceBreakdown: sourceEntries,
      sourceOverflowCount: Math.max(0, sourceCounts.size - sourceEntries.length),
      scheduleBreakdown: scheduleEntries,
      scheduleOverflowCount: Math.max(
        0,
        scheduleCounts.size - scheduleEntries.length,
      ),
    };
  }

  private getEarliestReleaseAt(
    tasks: DigestQueueTaskSnapshot[],
  ): string | undefined {
    return tasks.reduce<string | undefined>((earliest, task) => {
      if (!task.nextReleaseAt) return earliest;
      if (!earliest) return task.nextReleaseAt;
      return new Date(task.nextReleaseAt).getTime() <
        new Date(earliest).getTime()
        ? task.nextReleaseAt
        : earliest;
    }, undefined);
  }

  private async withStorageMutation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const run = this.storageMutationQueue.then(operation, operation);
    this.storageMutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  // ==================== 工具方法 ====================

  /**
   * 描述频率配置为人类可读文本
   */
  private describeFrequency(freq: DigestFrequency): string {
    switch (freq.type) {
      case 'hourly':
        return '每小时';
      case 'daily':
        return `每天 ${freq.hour}:00`;
      case 'weekly': {
        const dayNames = [
          '周日',
          '周一',
          '周二',
          '周三',
          '周四',
          '周五',
          '周六',
        ];
        return `每${dayNames[freq.dayOfWeek]} ${freq.hour}:00`;
      }
      case 'custom':
        return `每 ${freq.intervalMinutes} 分钟`;
      default:
        return '未知';
    }
  }

  /**
   * 获取调试信息
   */
  public async getDebugInfo(): Promise<{
    registeredTasks: Array<{
      id: string;
      name: string;
      frequency: string;
      enabled: boolean;
      lastExecutedAt?: string;
    }>;
    queueSizes: Record<string, number>;
  }> {
    const storage = await this.loadStorage();
    const queueSizes: Record<string, number> = {};

    for (const [taskId, bucket] of Object.entries(storage)) {
      queueSizes[taskId] = bucket.items.length;
    }

    return {
      registeredTasks: Array.from(this.tasks.values()).map((t) => ({
        id: t.id,
        name: t.name,
        frequency: this.describeFrequency(t.frequency),
        enabled: t.enabled,
        lastExecutedAt: t.lastExecutedAt,
      })),
      queueSizes,
    };
  }
}

// 导出单例
export const digestQueueService = DigestQueueService.getInstance();

// ==================== 内置处理器 ====================

/** ConcernedItems 每日摘要的任务 ID */
export const CONCERNED_ITEMS_DIGEST_TASK_ID = 'concerned_items_daily';

export function getConcernedItemDigestReleaseAt(
  item: DigestQueueItem,
  fallbackHour = 8,
): Date {
  const digestConfig = normalizeDigestConfig(
    item.data?.digestConfig as Partial<DigestConfig> | undefined,
    fallbackHour,
  );
  const createdAt = new Date(item.createdAt);
  const startAt = Number.isFinite(createdAt.getTime()) ? createdAt : new Date();

  if (digestConfig.frequency === 'weekly') {
    const releaseAt = new Date(startAt);
    releaseAt.setHours(digestConfig.preferredHour ?? fallbackHour, 0, 0, 0);
    const targetDay = normalizeConcernedItemsDigestDayOfWeek(
      digestConfig.preferredDayOfWeek,
      DEFAULT_WEEKLY_DIGEST_DAY_OF_WEEK,
    );
    const daysUntilTarget = (targetDay - releaseAt.getDay() + 7) % 7;
    releaseAt.setDate(releaseAt.getDate() + daysUntilTarget);

    if (startAt.getTime() >= releaseAt.getTime()) {
      releaseAt.setDate(releaseAt.getDate() + 7);
    }

    return releaseAt;
  }

  const releaseAt = new Date(startAt);
  releaseAt.setHours(digestConfig.preferredHour ?? fallbackHour, 0, 0, 0);
  if (startAt.getTime() >= releaseAt.getTime()) {
    releaseAt.setDate(releaseAt.getDate() + 1);
  }
  return releaseAt;
}

export function isConcernedItemDigestDue(
  item: DigestQueueItem,
  now = new Date(),
  fallbackHour = 8,
): boolean {
  const digestConfig = item.data?.digestConfig as
    | Partial<DigestConfig>
    | undefined;
  if (digestConfig?.enabled === false) {
    return false;
  }

  return (
    now.getTime() >=
    getConcernedItemDigestReleaseAt(item, fallbackHour).getTime()
  );
}

function normalizeDigestConfig(
  digestConfig: Partial<DigestConfig> | undefined,
  fallbackHour: number,
): DigestConfig {
  return {
    enabled: digestConfig?.enabled !== false,
    frequency: digestConfig?.frequency === 'weekly' ? 'weekly' : 'daily',
    preferredHour: normalizeConcernedItemsDigestHour(
      digestConfig?.preferredHour,
      fallbackHour,
    ),
    preferredDayOfWeek: normalizeConcernedItemsDigestDayOfWeek(
      digestConfig?.preferredDayOfWeek,
      DEFAULT_WEEKLY_DIGEST_DAY_OF_WEEK,
    ),
  };
}

function normalizeDigestQueueLabel(value: unknown): string {
  const normalized = formatMatchedRuleForDisplay(value, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '未命名关注项';
  return normalized.length > 28
    ? `${normalized.slice(0, 27)}…`
    : normalized;
}

function compareDigestBreakdownItems(
  a: DigestQueueSourceBreakdownItem,
  b: DigestQueueSourceBreakdownItem,
): number {
  if (b.count !== a.count) return b.count - a.count;
  return a.label.localeCompare(b.label, 'zh-CN');
}

function compareDigestScheduleBreakdownItems(
  a: DigestQueueScheduleBreakdownItem,
  b: DigestQueueScheduleBreakdownItem,
): number {
  if (b.count !== a.count) return b.count - a.count;
  if (a.frequency !== b.frequency) {
    return a.frequency.localeCompare(b.frequency);
  }
  if (a.preferredHour !== b.preferredHour) {
    return a.preferredHour - b.preferredHour;
  }
  return (a.preferredDayOfWeek ?? -1) - (b.preferredDayOfWeek ?? -1);
}

function formatConcernedItemDigestSchedule(
  item: DigestQueueItem,
  fallbackHour: number,
): string {
  const digestConfig = normalizeDigestConfig(
    item.data?.digestConfig as Partial<DigestConfig> | undefined,
    fallbackHour,
  );
  const hour = digestConfig.preferredHour ?? fallbackHour;

  if (digestConfig.frequency === 'weekly') {
    return `每周${
      CONCERNED_ITEM_WEEKDAY_LABELS[digestConfig.preferredDayOfWeek ?? 1] ||
      '周一'
    } ${hour}:00`;
  }

  return `每日 ${hour}:00`;
}

function buildConcernedItemsDigestReceipt(
  items: DigestQueueItem[],
  fallbackHour: number,
): string {
  const scheduleLabels = Array.from(
    new Set(
      items.map((item) =>
        formatConcernedItemDigestSchedule(item, fallbackHour),
      ),
    ),
  ).sort();
  const scheduleText =
    scheduleLabels.length > 0
      ? scheduleLabels.join('、')
      : `每日 ${fallbackHour}:00`;

  return [
    `**摘要回执**: 本次释放 ${items.length} 条已到时间的本地摘要`,
    `**释放节奏**: ${scheduleText}`,
    '**处理边界**: 未到期条目继续留在本地队列；Bot 推送失败时不会清除本次条目，可等下次后台任务重试。',
    '**调整入口**: 在关注规则里修改摘要时间、频率或关闭摘要。',
  ].join('\n');
}

/**
 * ConcernedItems 每日消息摘要处理器
 * 收集启用了 digestConfig 的关注项匹配到的消息，每日汇总推送
 */
class ConcernedItemsDigestProcessor implements DigestProcessor {
  constructor(private readonly fallbackHour = 8) {}

  async collect(items: DigestQueueItem[]): Promise<DigestQueueItem[]> {
    const now = new Date();
    return items.filter((item) =>
      isConcernedItemDigestDue(item, now, this.fallbackHour),
    );
  }

  async format(items: DigestQueueItem[]): Promise<string> {
    if (items.length === 0) return '';

    // 按关注项分组
    const grouped: Record<
      string,
      Array<{
        matchedRule: string;
        sender: string;
        teamName: string;
        summary: string;
        datetime: string;
        messageContent: string;
      }>
    > = {};

    for (const item of items) {
      const {
        ruleId,
        matchedRule,
        sender,
        teamName,
        summary,
        datetime,
        messageContent,
      } = item.data;
      const key = String(ruleId || item.sourceId || matchedRule || 'unknown');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        matchedRule: matchedRule || key,
        sender,
        teamName,
        summary,
        datetime,
        messageContent,
      });
    }

    const sections: string[] = [];

    for (const messages of Object.values(grouped)) {
      const ruleLabel = formatMatchedRuleForDisplay(
        messages[0]?.matchedRule,
        'unknown',
      );
      let section = `**关注项**: ${ruleLabel}\n`;
      section += `**匹配消息 ${messages.length} 条**:\n`;

      // 最多展示最近 5 条
      const recent = messages.slice(-5);
      for (const msg of recent) {
        section += `  - [${msg.teamName}] ${msg.sender}: ${(
          msg.summary ||
          msg.messageContent ||
          ''
        ).substring(0, 80)}${
          (msg.summary || msg.messageContent || '').length > 80 ? '...' : ''
        }\n`;
      }

      if (messages.length > 5) {
        section += `  - ...及其他 ${messages.length - 5} 条`;
      }

      sections.push(section);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const receipt = buildConcernedItemsDigestReceipt(items, this.fallbackHour);

    return `📊 **定时消息摘要** (${dateStr})\n${receipt}\n共 ${
      items.length
    } 条匹配消息\n\n${sections.join('\n\n---\n\n')}`;
  }

  getNotifyConfig(): import('../types/digestQueue').DigestNotifyConfig {
    return {
      notifyMethod: 'bot',
      mention: false,
      pushScenario: 'message_analysis',
    };
  }
}

/**
 * 注册 ConcernedItems 每日摘要任务到 DigestQueueService
 * 应在扩展启动时调用
 */
export function registerConcernedItemsDigestTask(): void {
  registerConcernedItemsDigestTaskWithHour(8);
}

export function registerConcernedItemsDigestTaskWithHour(
  preferredHour: number,
): void {
  const normalizedHour = normalizeConcernedItemsDigestHour(preferredHour, 8);
  digestQueueService.register({
    id: CONCERNED_ITEMS_DIGEST_TASK_ID,
    name: 'ConcernedItems 定时消息摘要',
    frequency: {
      type: 'custom',
      intervalMinutes: DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES,
    },
    processor: new ConcernedItemsDigestProcessor(normalizedHour),
    enabled: true,
  });
}

export function updateConcernedItemsDigestTaskSchedule(
  preferredHour: number,
): void {
  const normalizedHour = normalizeConcernedItemsDigestHour(preferredHour, 8);
  const updated = digestQueueService.updateTask(
    CONCERNED_ITEMS_DIGEST_TASK_ID,
    {
      name: 'ConcernedItems 定时消息摘要',
      frequency: {
        type: 'custom',
        intervalMinutes: DIGEST_QUEUE_RELEASE_CHECK_INTERVAL_MINUTES,
      },
      processor: new ConcernedItemsDigestProcessor(normalizedHour),
      enabled: true,
    },
  );

  if (!updated) {
    registerConcernedItemsDigestTaskWithHour(normalizedHour);
  }
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
  ruleId?: string;
  digestConfig?: DigestConfig;
}): Promise<void> {
  const stableId =
    data.ruleId && data.postId
      ? `concerned_${data.ruleId}_${data.postId}`
      : `concerned_${data.postId || Date.now()}_${Date.now()}`;
  await digestQueueService.enqueue(CONCERNED_ITEMS_DIGEST_TASK_ID, {
    id: stableId,
    data,
    createdAt: new Date().toISOString(),
    sourceId: data.ruleId || data.matchedRule,
  });
}
