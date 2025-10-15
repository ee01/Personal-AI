/**
 * 统一任务调度管理器
 * 集中管理所有定时任务，避免重复执行和遗漏
 */

import { memorySystem } from '../memory';
import { findRingCentralTab, createRingCentralTab, waitForTabLoad } from '../background';
import { analyzeMessages } from '../messageDealing';
import { getEnvConfig } from '../utils';
import { CloudStorage } from '../storage/CloudStorage';

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
    intervalMinutes: 30, // 30分钟间隔
    description: '自动分析RingCentral消息，提取关键信息',
    enabled: true
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
  private isInitialized = false;
  private cloudStorage: CloudStorage | null = null;

  private constructor() {
    this.initializeTasks();
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
  private initializeTasks(): void {
    TASK_DEFINITIONS.forEach(task => {
      this.tasks.set(task.id, { ...task });
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

    // 清理可能存在的旧 alarms
    await this.clearAllAlarms();

    // 为每个启用的任务创建 alarm
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        await this.createTaskAlarm(task);
      }
    }

    // 设置 alarm 监听器
    this.setupAlarmListeners();

    // 执行首次运行
    this.performInitialRun();

    this.isInitialized = true;
    console.log('✅ 任务调度器启动完成');
  }

  /**
   * 停止所有定时任务
   */
  public async stopAllTasks(): Promise<void> {
    console.log('🛑 停止任务调度器...');
    
    await this.clearAllAlarms();
    this.alarmListeners.clear();
    this.isInitialized = false;
    
    console.log('✅ 任务调度器已停止');
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
   */
  private setupAlarmListeners(): void {
    if (this.alarmListeners.has('main')) {
      return;
    }

    chrome.alarms.onAlarm.addListener(async (alarm) => {
      const taskId = alarm.name.replace('scheduled_task_', '');
      const task = this.tasks.get(taskId);

      if (task) {
        console.log(`⚡ 执行定时任务: ${task.name}`);
        await this.executeTask(task);
      }
    });

    this.alarmListeners.add('main');
    console.log('👂 定时任务监听器已设置');
  }

  /**
   * 执行首次运行
   */
  private performInitialRun(): void {
    // 延迟执行首次运行，避免启动时资源竞争
    setTimeout(async () => {
      console.log('🎯 执行首次定时任务运行...');
      
      for (const [taskId, task] of this.tasks) {
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
    } catch (error) {
      console.error(`❌ 任务 ${task.name} 执行失败:`, error);
    }
  }

  /**
   * 执行消息分析任务
   */
  private async executeMessageAnalysis(): Promise<void> {
    try {
      // 获取配置
      const config = await getEnvConfig();
      
      // 检查是否启用了定时分析
      const { scheduleActive } = await chrome.storage.local.get(['scheduleActive']);
      if (!scheduleActive) {
        console.log('📝 定时消息分析已禁用，跳过执行');
        return;
      }

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
        return;
      }

      // 计算分析时间范围
      const startTime = new Date(Date.now() - (Number(config.SCHEDULED_INTERVAL) + 5) * 60 * 1000);

      // 发送消息获取请求
      const response = await this.sendMessageWithRetry(rcTab.id, {
        type: 'FETCH_USER_MESSAGES',
        startTime,
      });

      // 分析消息
      await analyzeMessages(response.data, userinfo.fullName, true);
      console.log('📝 消息分析任务执行完成');
    } catch (error) {
      console.error('❌ 消息分析任务失败:', error);
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
    } else {
      const alarmName = `scheduled_task_${taskId}`;
      chrome.alarms.clear(alarmName);
    }

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
}

// 导出单例实例
export const taskScheduler = TaskScheduler.getInstance();
