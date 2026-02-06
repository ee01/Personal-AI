/**
 * 统一任务调度管理器
 * 集中管理所有定时任务，避免重复执行和遗漏
 * 
 * 特性：
 * - message_analysis 任务的间隔时间从 envConfig.MESSAGE_ANALYSIS_INTERVAL 动态读取
 * - 消息上下文获取窗口从 envConfig.MESSAGE_CONTEXT_WINDOW 动态读取
 * - 自动监听配置变化，当配置更新时自动重新加载任务间隔
 * - 无需手动干预，配置更改后立即生效
 */

import { memorySystem } from '../memory';
import { findRingCentralTab, createRingCentralTab, waitForTabLoad } from '../utils/tabHelpers';
import { analyzeMessages } from '../messageDealing';
import { getEnvConfig } from '../utils';
import { CloudStorage } from '../storage/CloudStorage';
import { Logger } from '../utils/logger';

// 任务类型定义
export interface ScheduledTask {
  id: string;
  name: string;
  category: 'message_analysis' | 'data_sync' | 'system_maintenance' | 'user_profile';
  intervalMinutes: number;
  description: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

// 预定义的任务配置
const TASK_DEFINITIONS: ScheduledTask[] = [
  {
    id: 'message_analysis',
    name: '静默消息分析',
    category: 'message_analysis',
    intervalMinutes: 30, // 默认30分钟间隔（实际值从 envConfig.MESSAGE_ANALYSIS_INTERVAL 读取）
    description: '自动分析RingCentral消息，提取关键信息',
    enabled: false
  },
  {
    id: 'memory_sync',
    name: '记忆系统同步',
    category: 'data_sync',
    intervalMinutes: 5, // 5分钟间隔
    description: '同步本地和云端记忆数据',
    enabled: true
  },
  {
    id: 'system_monitoring',
    name: '系统健康监控',
    category: 'system_maintenance',
    intervalMinutes: 60, // 1小时间隔
    description: '执行系统健康检查和自动维护',
    enabled: true
  },
  {
    id: 'user_profile_decay',
    name: '用户画像权重衰变',
    category: 'user_profile',
    intervalMinutes: 1440, // 24小时间隔
    description: '执行用户画像权重的自然衰变',
    enabled: true
  },
  {
    id: 'vectorized_data_maintenance',
    name: '向量化数据维护',
    category: 'user_profile',
    intervalMinutes: 720, // 12小时间隔
    description: '清理过期向量记录，更新嵌入向量，生成用户概要',
    enabled: true
  },
  {
    id: 'user_summary_generation',
    name: '用户概要生成',
    category: 'user_profile',
    intervalMinutes: 10080, // 7天间隔
    description: '定期生成和更新用户行为概要记录',
    enabled: true
  },
  {
    id: 'vector_quality_check',
    name: '向量质量检查',
    category: 'system_maintenance',
    intervalMinutes: 4320, // 3天间隔
    description: '检查向量数据质量，修复异常记录',
    enabled: true
  }
];

export class TaskScheduler {
  private static instance: TaskScheduler | null = null;
  private tasks: Map<string, ScheduledTask> = new Map();
  private alarmListeners: Set<string> = new Set();
  public isInitialized = false; // 改为 public，方便 background.ts 检查状态
  private cloudStorage: CloudStorage | null = null;
  private storageChangeListener: ((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => void) | null = null;

  private constructor() {
    // initializeTasks 现在是异步的，将在 startAllTasks 中调用
    this.cloudStorage = new CloudStorage();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  /**
   * 初始化任务定义
   */
  private async initializeTasks(): Promise<void> {
    // 获取环境配置
    const config = await getEnvConfig();
    
    // 初始化所有任务
    TASK_DEFINITIONS.forEach(task => {
      const taskCopy = { ...task };
      
      // message_analysis 任务的间隔时间使用用户配置
      if (task.id === 'message_analysis') {
        // 优先使用新配置，如果不存在则使用旧配置作为回退
        taskCopy.intervalMinutes = Number(config.MESSAGE_ANALYSIS_INTERVAL) || Number(config.SCHEDULED_INTERVAL) || 30;
        console.log(`⚙️ message_analysis 任务间隔已设置为: ${taskCopy.intervalMinutes} 分钟`);
        console.log(`⚙️ 消息上下文窗口已设置为: ${config.MESSAGE_CONTEXT_WINDOW || 125} 分钟`);
      }
      
      this.tasks.set(taskCopy.id, taskCopy);
    });
    
    console.log('📋 任务调度器初始化完成，注册任务:', Array.from(this.tasks.keys()));
  }

  /**
   * 启动所有定时任务
   */
  public async startAllTasks(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ 任务调度器已启动，跳过重复启动');
      return;
    }

    console.log('🚀 启动任务调度器...');

    // 初始化任务定义（包括从配置中读取 message_analysis 的间隔）
    await this.initializeTasks();

    // 从 storage 恢复任务状态
    await this.restoreTaskStates();

    // 检查是否是首次启动（没有保存的状态）
    const { taskSchedulerStates } = await chrome.storage.local.get('taskSchedulerStates');
    const isFirstRun = !taskSchedulerStates;

    // 确保所有启用的任务都有对应的 alarm
    // Chrome 官方推荐：不依赖 alarms 持久化，而是基于 Storage 状态重建
    await this.ensureAlarmsCreated();

    // 设置 alarm 监听器（每次都需要重新设置，因为监听器不会持久化）
    this.setupAlarmListeners();

    // 设置配置变化监听器
    this.setupConfigChangeListener();

    // 只在首次安装时执行首次运行
    if (isFirstRun) {
      console.log('🎯 首次安装，将执行首次任务运行');
      this.performInitialRun();
    } else {
      console.log('🔄 恢复已有配置，跳过首次运行');
    }

    this.isInitialized = true;
    
    // 保存初始化状态
    await this.saveTaskStates();
    
    console.log('✅ 任务调度器启动完成');
  }

  /**
   * 停止所有定时任务
   */
  public async stopAllTasks(): Promise<void> {
    console.log('🛑 停止任务调度器...');
    
    // 只清除我们创建的 alarms，不影响其他扩展功能的 alarms
    const existingAlarms = await this.getExistingAlarms();
    for (const alarm of existingAlarms) {
      await new Promise(resolve => chrome.alarms.clear(alarm.name, resolve));
    }
    console.log(`🧹 已清除 ${existingAlarms.length} 个任务定时器`);
    
    this.alarmListeners.clear();
    
    // 移除配置变化监听器
    if (this.storageChangeListener) {
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
      this.storageChangeListener = null;
      console.log('🗑️ 已移除配置变化监听器');
    }
    
    this.isInitialized = false;
    
    // 禁用所有任务
    for (const [_taskId, task] of Array.from(this.tasks.entries())) {
      task.enabled = false;
    }
    
    // 保存停止状态
    await this.saveTaskStates();
    
    console.log('✅ 任务调度器已停止');
  }

  /**
   * 从 Chrome Storage 恢复任务状态
   */
  private async restoreTaskStates(): Promise<void> {
    try {
      const { taskSchedulerStates } = await chrome.storage.local.get('taskSchedulerStates');
      
      if (taskSchedulerStates) {
        console.log('🔄 恢复任务状态:', taskSchedulerStates);
        
        // 恢复每个任务的状态
        for (const [taskId, savedState] of Object.entries(taskSchedulerStates)) {
          const task = this.tasks.get(taskId);
          if (task && savedState) {
            const state = savedState as Partial<ScheduledTask>;
            task.enabled = state.enabled ?? task.enabled;
            task.lastRun = state.lastRun;
            task.nextRun = state.nextRun;
          }
        }
        
        console.log('✅ 任务状态恢复完成');
      } else {
        console.log('📝 未找到已保存的任务状态，使用默认配置');
      }
    } catch (error) {
      console.error('❌ 恢复任务状态失败:', error);
    }
  }

  /**
   * 保存任务状态到 Chrome Storage
   */
  private async saveTaskStates(): Promise<void> {
    try {
      const taskStates: Record<string, Partial<ScheduledTask>> = {};
      
      for (const [taskId, task] of Array.from(this.tasks.entries())) {
        taskStates[taskId] = {
          enabled: task.enabled,
          lastRun: task.lastRun,
          nextRun: task.nextRun
        };
      }
      
      await chrome.storage.local.set({ taskSchedulerStates: taskStates });
      console.log('💾 任务状态已保存');
    } catch (error) {
      console.error('❌ 保存任务状态失败:', error);
    }
  }

  /**
   * 创建单个任务的 alarm
   */
  private async createTaskAlarm(task: ScheduledTask): Promise<void> {
    const alarmName = `scheduled_task_${task.id}`;
    
    return new Promise((resolve) => {
      chrome.alarms.create(alarmName, {
        periodInMinutes: task.intervalMinutes
      });
      
      console.log(`⏰ 创建定时任务: ${task.name} (${task.intervalMinutes}分钟间隔)`);
      resolve();
    });
  }

  /**
   * 确保所有启用的任务都有对应的 alarm
   * 采用 Chrome 官方推荐的方式：基于 Storage 状态检查并创建 alarms
   */
  private async ensureAlarmsCreated(): Promise<void> {
    console.log('🔍 检查并确保所有任务的定时器已创建...');
    
    for (const [taskId, task] of Array.from(this.tasks.entries())) {
      const alarmName = `scheduled_task_${taskId}`;
      
      if (task.enabled) {
        // 检查 alarm 是否存在
        const existingAlarm = await this.getAlarm(alarmName);
        
        if (!existingAlarm) {
          // alarm 不存在，创建新的
          await this.createTaskAlarm(task);
        } else if (existingAlarm.periodInMinutes !== task.intervalMinutes) {
          // alarm 存在但配置不一致，重新创建
          console.log(`🔄 更新定时器配置: ${task.name} (${existingAlarm.periodInMinutes}min -> ${task.intervalMinutes}min)`);
          await this.clearAlarm(alarmName);
          await this.createTaskAlarm(task);
        } else {
          // alarm 存在且配置正确
          console.log(`✅ 定时器已存在: ${task.name}`);
        }
      } else {
        // 任务已禁用，确保 alarm 被清除
        const existingAlarm = await this.getAlarm(alarmName);
        if (existingAlarm) {
          console.log(`🗑️ 清除已禁用任务的定时器: ${task.name}`);
          await this.clearAlarm(alarmName);
        }
      }
    }
    
    console.log('✅ 定时器检查完成');
  }

  /**
   * 获取单个 alarm
   */
  private async getAlarm(name: string): Promise<chrome.alarms.Alarm | undefined> {
    return new Promise((resolve) => {
      chrome.alarms.get(name, (alarm) => {
        resolve(alarm);
      });
    });
  }

  /**
   * 清除单个 alarm
   */
  private async clearAlarm(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.alarms.clear(name, (wasCleared) => {
        resolve(wasCleared);
      });
    });
  }

  /**
   * 获取所有现有的任务相关 alarms（用于调试和监控）
   */
  private async getExistingAlarms(): Promise<chrome.alarms.Alarm[]> {
    return new Promise((resolve) => {
      chrome.alarms.getAll((alarms) => {
        // 只返回我们的任务调度器创建的 alarms
        const taskAlarms = alarms.filter(alarm => 
          alarm.name.startsWith('scheduled_task_')
        );
        resolve(taskAlarms);
      });
    });
  }

  /**
   * 清理所有 alarms
   */
  private async clearAllAlarms(): Promise<void> {
    return new Promise((resolve) => {
      chrome.alarms.clearAll(() => {
        console.log('🧹 清理所有定时任务');
        resolve();
      });
    });
  }

  /**
   * 设置 alarm 监听器
   * 注意：在 Manifest V3 中，监听器应该在顶层设置，而不是在这里
   * 这个方法保留用于兼容性，但实际监听器已经在 background.ts 顶层设置
   */
  private setupAlarmListeners(): void {
    if (this.alarmListeners.has('main')) {
      return;
    }

    // 🔥 不再在这里设置监听器，改为在 background.ts 顶层设置
    // 原因：Service Worker 重启时，如果监听器设置延迟，alarm 事件会丢失

    this.alarmListeners.add('main');
    console.log('✅ TaskScheduler 监听器标记已设置（实际监听器在 background.ts 顶层）');
  }

  /**
   * 处理 alarm 事件
   * 由 background.ts 的顶层监听器调用
   */
  public async handleAlarmEvent(alarm: chrome.alarms.Alarm): Promise<void> {
    const taskId = alarm.name.replace('scheduled_task_', '');
    const task = this.tasks.get(taskId);

    if (task) {
      console.log(`⚡ 执行定时任务: ${task.name}`);
      await this.executeTask(task);
    } else {
      console.warn(`⚠️ 未找到任务: ${taskId}`);
    }
  }

  /**
   * 静态方法：尝试处理 alarm 事件
   * 返回 true 表示已处理，false 表示不是 TaskScheduler 的 alarm
   */
  public static async tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
    if (!alarm.name.startsWith('scheduled_task_')) {
      return false;
    }

    const instance = TaskScheduler.getInstance();
    
    // 确保已初始化
    if (!instance.isInitialized) {
      console.log('⚠️ TaskScheduler 未初始化，开始初始化...');
      await instance.startAllTasks();
    }
    
    const taskId = alarm.name.replace('scheduled_task_', '');
    console.log(`⚡ 执行定时任务: ${taskId}`);
    await instance.handleAlarmEvent(alarm);
    
    return true;
  }

  /**
   * 设置配置变化监听器
   * 自动监听 envConfig.MESSAGE_ANALYSIS_INTERVAL 的变化并更新 message_analysis 任务
   */
  private setupConfigChangeListener(): void {
    if (this.storageChangeListener) {
      // 已存在监听器，先移除
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
    }

    this.storageChangeListener = async (changes, namespace) => {
      // 只处理 local storage 的变化
      if (namespace !== 'local') {
        return;
      }

      // 检查是否是 envConfig 的变化
      if (changes.envConfig) {
        const oldConfig = changes.envConfig.oldValue;
        const newConfig = changes.envConfig.newValue;

        // 检查 MESSAGE_ANALYSIS_INTERVAL 是否变化
        const oldInterval = oldConfig?.MESSAGE_ANALYSIS_INTERVAL || oldConfig?.SCHEDULED_INTERVAL;
        const newInterval = newConfig?.MESSAGE_ANALYSIS_INTERVAL || newConfig?.SCHEDULED_INTERVAL;
        const oldContextWindow = oldConfig?.MESSAGE_CONTEXT_WINDOW;
        const newContextWindow = newConfig?.MESSAGE_CONTEXT_WINDOW;
        
        if (oldInterval !== newInterval) {
          console.log(`🔄 检测到 MESSAGE_ANALYSIS_INTERVAL 配置变化: ${oldInterval} -> ${newInterval} 分钟`);
          
          // 自动重新加载 message_analysis 任务的间隔配置
          const updated = await this.reloadMessageAnalysisInterval();
          
          if (updated) {
            console.log('✅ message_analysis 任务间隔已自动更新');
          }
        }
        
        if (oldContextWindow !== newContextWindow) {
          console.log(`🔄 检测到 MESSAGE_CONTEXT_WINDOW 配置变化: ${oldContextWindow} -> ${newContextWindow} 分钟`);
        }
      }
    };

    chrome.storage.onChanged.addListener(this.storageChangeListener);
    console.log('👂 配置变化监听器已设置（自动监听 MESSAGE_ANALYSIS_INTERVAL 和 MESSAGE_CONTEXT_WINDOW）');
  }

  /**
   * 执行首次运行
   */
  private performInitialRun(): void {
    // 延迟执行首次运行，避免启动时资源竞争
    setTimeout(async () => {
      console.log('🎯 执行首次定时任务运行...');
      
      for (const [_taskId, task] of Array.from(this.tasks.entries())) {
        if (task.enabled) {
          try {
            await this.executeTask(task);
          } catch (error) {
            console.error(`❌ 首次运行任务 ${task.name} 失败:`, error);
          }
        }
      }
    }, 10000); // 10秒后开始首次运行
  }

  /**
   * 执行具体任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const startTime = Date.now();
    task.lastRun = startTime;
    task.nextRun = startTime + (task.intervalMinutes * 60 * 1000);

    try {
      switch (task.id) {
        case 'message_analysis':
          await this.executeMessageAnalysis();
          break;
        case 'memory_sync':
          await this.executeMemorySync();
          break;
        case 'system_monitoring':
          await this.executeSystemMonitoring();
          break;
        case 'user_profile_decay':
          await this.executeUserProfileDecay();
          break;
        case 'vectorized_data_maintenance':
          await this.executeVectorizedDataMaintenance();
          break;
        case 'user_summary_generation':
          await this.executeUserSummaryGeneration();
          break;
        case 'vector_quality_check':
          await this.executeVectorQualityCheck();
          break;
        default:
          console.warn(`⚠️ 未知任务类型: ${task.id}`);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ 任务 ${task.name} 执行完成，耗时: ${duration}ms`);
      
      // 记录任务执行日志
      Logger.task(task.id, true, `${task.name} 执行完成`, {
        duration: `${duration}ms`,
        category: task.category,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ 任务 ${task.name} 执行失败:`, error);
      
      // 记录任务执行失败日志
      Logger.task(task.id, false, `${task.name} 执行失败: ${error.message}`, {
        duration: `${duration}ms`,
        category: task.category,
        error: error.message,
      });
    }
  }

  /**
   * 执行消息分析任务
   */
  private async executeMessageAnalysis(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 获取配置
      const config = await getEnvConfig();
      
      // 该任务已经通过 enabled 状态控制，无需额外检查

      // 查找或创建 RingCentral 标签页
      let rcTab = await findRingCentralTab();
      if (!rcTab) {
        rcTab = await createRingCentralTab();
        await waitForTabLoad(rcTab.id);
      }

      // 获取用户信息
      const { userinfo } = await chrome.storage.local.get(['userinfo']);
      if (!userinfo || userinfo.fullName === '') {
        // 如果没有用户信息，跳过此次分析
        console.log('📝 用户信息不完整，跳过消息分析');
        Logger.analysis('message_analysis', {
          result: '跳过 - 用户信息不完整',
          duration: Date.now() - startTime,
        });
        return;
      }

      // 计算分析时间范围
      // MESSAGE_CONTEXT_WINDOW 是从此刻往前推的绝对时间窗口
      const contextWindow = Number(config.MESSAGE_CONTEXT_WINDOW) || 125;
      const messageStartTime = new Date(Date.now() - contextWindow * 60 * 1000);
      
      console.log(`📝 开始消息分析，时间范围: 距离此刻 ${contextWindow} 分钟内的消息`);

      // 发送消息获取请求
      const response = await this.sendMessageWithRetry(rcTab.id, {
        type: 'FETCH_USER_MESSAGES',
        startTime: messageStartTime,
      });

      const messagesCount = response.data?.length || 0;

      // 分析消息
      await analyzeMessages(response.data, userinfo.fullName, true);
      
      const duration = Date.now() - startTime;
      console.log('📝 消息分析任务执行完成');
      
      // 记录消息分析日志
      Logger.analysis('message_analysis', {
        messagesCount,
        duration,
        result: `分析了 ${messagesCount} 条消息`,
      });
    } catch (error: any) {
      console.error('❌ 消息分析任务失败:', error);
      
      // 记录消息分析错误日志
      Logger.analysis('message_analysis', {
        duration: Date.now() - startTime,
        error: error.message,
      });
      
      throw error; // 重新抛出以便 executeTask 记录
    }
  }

  /**
   * 执行记忆系统同步任务
   */
  private async executeMemorySync(): Promise<void> {
    try {
      // 确保记忆系统已初始化
      if (!memorySystem.initialize()) {
        console.log('🧠 记忆系统未初始化，跳过同步');
        return;
      }

      // 执行数据同步
      await memorySystem.syncCache();
      console.log('🔄 记忆系统同步任务执行完成');
    } catch (error) {
      console.error('❌ 记忆系统同步任务失败:', error);
    }
  }

  /**
   * 执行系统监控任务
   */
  private async executeSystemMonitoring(): Promise<void> {
    try {
      // 执行健康检查
      const healthStatus = await memorySystem.performHealthCheck();
      console.log('🔍 系统健康检查完成:', healthStatus);

      // 执行自动维护
      const maintenanceResult = await memorySystem.performSystemMaintenance();
      console.log('🔧 系统维护任务完成:', maintenanceResult);
    } catch (error) {
      console.error('❌ 系统监控任务失败:', error);
    }
  }

  /**
   * 执行用户画像权重衰变任务
   */
  private async executeUserProfileDecay(): Promise<void> {
    try {
      // 执行权重衰变
      await memorySystem.applyUserProfileDecay();
      console.log('🧠 用户画像权重衰变任务执行完成');
    } catch (error) {
      console.error('❌ 用户画像权重衰变任务失败:', error);
    }
  }

  /**
   * 执行向量化数据维护任务
   */
  private async executeVectorizedDataMaintenance(): Promise<void> {
    try {
      if (!this.cloudStorage) {
        console.log('⚠️ CloudStorage 未初始化，跳过向量化数据维护');
        return;
      }

      // 确保CloudStorage已连接
      const isConnected = await this.cloudStorage.isConnected();
      if (!isConnected) {
        console.log('⚠️ CloudStorage 未连接，跳过向量化数据维护');
        return;
      }

      console.log('🔧 开始向量化数据维护...');
      
      // 执行维护操作
      const result = await this.cloudStorage.performUserprofilesMaintenance();
      
      console.log('✅ 向量化数据维护完成:', {
        cleaned_records: result.cleaned_records,
        updated_records: result.updated_records,
        created_summaries: result.created_summaries,
        errors: result.errors.length
      });

      if (result.errors.length > 0) {
        console.warn('⚠️ 维护过程中出现错误:', result.errors);
      }
    } catch (error) {
      console.error('❌ 向量化数据维护任务失败:', error);
    }
  }

  /**
   * 执行用户概要生成任务
   */
  private async executeUserSummaryGeneration(): Promise<void> {
    try {
      if (!this.cloudStorage) {
        console.log('⚠️ CloudStorage 未初始化，跳过用户概要生成');
        return;
      }

      const isConnected = await this.cloudStorage.isConnected();
      if (!isConnected) {
        console.log('⚠️ CloudStorage 未连接，跳过用户概要生成');
        return;
      }

      console.log('📊 开始用户概要生成...');
      
      // 获取存储统计信息
      const stats = await this.cloudStorage.getUserprofilesStorageStats();
      
      console.log('📈 当前向量存储统计:', {
        total_records: stats.total_records,
        users: Object.keys(stats.records_by_user).length,
        types: Object.keys(stats.records_by_type).length,
        health_score: stats.health_score
      });

      // 检查是否需要进行概要更新（这里通过维护任务触发）
      if (stats.total_records > 0) {
        const maintenanceResult = await this.cloudStorage.performUserprofilesMaintenance();
        console.log(`📊 概要生成完成，创建了 ${maintenanceResult.created_summaries} 个新概要`);
      }
    } catch (error) {
      console.error('❌ 用户概要生成任务失败:', error);
    }
  }

  /**
   * 执行向量质量检查任务
   */
  private async executeVectorQualityCheck(): Promise<void> {
    try {
      if (!this.cloudStorage) {
        console.log('⚠️ CloudStorage 未初始化，跳过向量质量检查');
        return;
      }

      const isConnected = await this.cloudStorage.isConnected();
      if (!isConnected) {
        console.log('⚠️ CloudStorage 未连接，跳过向量质量检查');
        return;
      }

      console.log('🔍 开始向量质量检查...');
      
      // 获取存储统计信息
      const stats = await this.cloudStorage.getUserprofilesStorageStats();
      
      // 质量检查指标
      const qualityChecks = {
        total_records: stats.total_records,
        health_score: stats.health_score,
        type_distribution: stats.records_by_type,
        user_distribution: stats.records_by_user,
        storage_size: stats.storage_size_mb,
        issues: [] as string[]
      };

      // 检查1: 记录数量是否合理
      if (stats.total_records === 0) {
        qualityChecks.issues.push('向量存储中无记录');
      } else if (stats.total_records > 100000) {
        qualityChecks.issues.push('向量存储记录数量过多，可能需要清理');
      }

      // 检查2: 健康度评估
      if (stats.health_score < 0.5) {
        qualityChecks.issues.push(`存储健康度较低: ${stats.health_score.toFixed(2)}`);
      }

      // 检查3: 用户数据分布
      const userCounts = Object.values(stats.records_by_user);
      const maxUserRecords = Math.max(...userCounts);
      const minUserRecords = Math.min(...userCounts);
      
      if (maxUserRecords > 1000) {
        qualityChecks.issues.push(`某些用户记录数量过多: ${maxUserRecords}`);
      }
      
      if (minUserRecords === 0) {
        qualityChecks.issues.push('存在无记录的用户');
      }

      // 检查4: 记录类型分布
      const expectedTypes = ['interest_item', 'behavior_pattern', 'social_relationship', 'expertise_area'];
      const missingTypes = expectedTypes.filter(type => !stats.records_by_type[type]);
      
      if (missingTypes.length > 0) {
        qualityChecks.issues.push(`缺少记录类型: ${missingTypes.join(', ')}`);
      }

      // 输出检查结果
      console.log('📊 向量质量检查结果:', qualityChecks);

      // 如果发现问题，可以触发自动修复
      if (qualityChecks.issues.length > 0) {
        console.warn('⚠️ 发现质量问题，建议执行维护操作:', qualityChecks.issues);
        
        // 可选：自动触发维护
        if (qualityChecks.issues.some(issue => issue.includes('记录数量过多') || issue.includes('健康度较低'))) {
          console.log('🔧 自动触发维护操作...');
          await this.cloudStorage.performUserprofilesMaintenance();
        }
      } else {
        console.log('✅ 向量数据质量良好');
      }
    } catch (error) {
      console.error('❌ 向量质量检查任务失败:', error);
    }
  }

  /**
   * 带重试机制的消息发送函数
   */
  private sendMessageWithRetry(tabId: number, message: any, maxRetries = 3, retryInterval = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const trySendMessage = () => {
        attempts++;
        chrome.tabs.sendMessage(tabId, message, async response => {
          if (chrome.runtime.lastError) {
            console.log(`Attempt ${attempts} failed:`, chrome.runtime.lastError);
            if (attempts < maxRetries) {
              if (chrome.runtime.lastError.message?.includes('Could not establish connection')) {
                await chrome.tabs.reload(tabId);
              }
              setTimeout(trySendMessage, retryInterval);
            } else {
              reject(new Error('Failed to send message after multiple attempts'));
            }
          } else {
            if (response && !response.error) {
              resolve(response);
            } else {
              setTimeout(trySendMessage, retryInterval * 3);
            }
          }
        });
      };

      trySendMessage();
    });
  }

  /**
   * 获取任务状态
   */
  public getTaskStatus(): Array<ScheduledTask & { status: 'running' | 'stopped' }> {
    return Array.from(this.tasks.values()).map(task => ({
      ...task,
      status: this.isInitialized && task.enabled ? 'running' : 'stopped'
    }));
  }

  /**
   * 启用/禁用特定任务
   */
  public async toggleTask(taskId: string, enabled: boolean): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`❌ 任务不存在: ${taskId}`);
      return false;
    }
    if (!this.isInitialized) {
      console.error(`❌ 任务调度器未初始化，跳过启用/禁用任务: ${taskId}`);
      return false;
    }

    task.enabled = enabled;
    if (enabled) {
      await this.createTaskAlarm(task);
      this.runTaskManually(taskId);
    } else {
      const alarmName = `scheduled_task_${taskId}`;
      chrome.alarms.clear(alarmName);
    }

    // 保存任务状态变更
    await this.saveTaskStates();

    console.log(`${enabled ? '✅' : '❌'} 任务 ${task.name} ${enabled ? '已启用' : '已禁用'}`);
    return true;
  }

  /**
   * 手动执行指定任务
   */
  public async runTaskManually(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`❌ 任务不存在: ${taskId}`);
      return false;
    }

    console.log(`🔧 手动执行任务: ${task.name}`);
    await this.executeTask(task);
    return true;
  }

  /**
   * 重新加载 message_analysis 任务的间隔配置
   * 注意：通常不需要手动调用此方法，因为任务调度器会自动监听配置变化
   * 此方法主要用于测试或特殊场景下的手动触发
   */
  public async reloadMessageAnalysisInterval(): Promise<boolean> {
    const task = this.tasks.get('message_analysis');
    if (!task) {
      console.error('❌ message_analysis 任务不存在');
      return false;
    }

    // 读取最新配置
    const config = await getEnvConfig();
    const newInterval = Number(config.MESSAGE_ANALYSIS_INTERVAL) || Number(config.SCHEDULED_INTERVAL) || 30;

    // 如果间隔没有变化，不需要更新
    if (task.intervalMinutes === newInterval) {
      console.log(`⚙️ message_analysis 任务间隔未变化: ${newInterval} 分钟`);
      return false;
    }

    // 更新间隔时间
    const oldInterval = task.intervalMinutes;
    task.intervalMinutes = newInterval;
    console.log(`⚙️ message_analysis 任务间隔已更新: ${oldInterval} -> ${newInterval} 分钟`);

    // 如果任务已启用，需要重新创建 alarm
    if (task.enabled && this.isInitialized) {
      const alarmName = `scheduled_task_message_analysis`;
      await this.clearAlarm(alarmName);
      await this.createTaskAlarm(task);
      console.log('✅ 定时器已更新');
    }

    // 保存状态
    await this.saveTaskStates();

    return true;
  }
}

// 导出单例实例
export const taskScheduler = TaskScheduler.getInstance();

/**
 * 辅助函数: 获取指定任务的启用状态
 * 用于替代旧的 scheduleActive 存储
 */
export async function getTaskEnabled(taskId: string): Promise<boolean> {
  try {
    const { taskSchedulerStates } = await chrome.storage.local.get('taskSchedulerStates');
    if (taskSchedulerStates && taskSchedulerStates[taskId]) {
      return taskSchedulerStates[taskId].enabled ?? false;
    }
    // 如果没有保存的状态,返回默认值(根据任务定义)
    const defaultTask = TASK_DEFINITIONS.find(t => t.id === taskId);
    return defaultTask?.enabled ?? false;
  } catch (error) {
    console.error(`获取任务 ${taskId} 状态失败:`, error);
    return false;
  }
}

/**
 * 辅助函数: 监听指定任务的启用状态变化
 */
export function onTaskEnabledChanged(
  taskId: string, 
  callback: (enabled: boolean) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    if (namespace === 'local' && changes.taskSchedulerStates) {
      const newStates = changes.taskSchedulerStates.newValue;
      if (newStates && newStates[taskId]) {
        callback(newStates[taskId].enabled ?? false);
      }
    }
  };
  
  chrome.storage.onChanged.addListener(listener);
  
  // 返回清理函数
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
