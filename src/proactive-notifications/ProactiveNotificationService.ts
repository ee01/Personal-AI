/**
 * 主动通知服务 - 集成到background.ts的核心服务
 * 负责定时任务调度、通知管理和用户交互处理
 */

import { NotificationManager, NotificationItem, UserContext } from './NotificationManager';
import { NotificationChannelFactory, BadgeNotificationChannel } from './NotificationChannels';
import { TaskProcessorFactory, TaskProcessor } from './TaskProcessors';

interface ScheduledTask {
  id: string;
  name: string;
  frequency: number; // 分钟
  priority: 'high' | 'medium' | 'low';
  lastRun: number;
  nextRun: number;
  enabled: boolean;
  processor: string;
  consecutiveFailures: number;
  maxFailures: number;
}

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  notificationCount: number;
  duration: number;
  error?: string;
  timestamp: number;
}

interface ServiceStats {
  totalTaskRuns: number;
  totalNotificationsSent: number;
  successRate: number;
  averageExecutionTime: number;
  lastRunTime: number;
  activeTaskCount: number;
}

export class ProactiveNotificationService {
  private notificationManager: NotificationManager;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private serviceStats: ServiceStats;
  private isInitialized = false;
  private executionHistory: TaskExecutionResult[] = [];

  constructor() {
    this.notificationManager = new NotificationManager();
    this.serviceStats = {
      totalTaskRuns: 0,
      totalNotificationsSent: 0,
      successRate: 100,
      averageExecutionTime: 0,
      lastRunTime: 0,
      activeTaskCount: 0
    };
  }

  /**
   * 初始化主动通知服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('⚠️ ProactiveNotificationService already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Proactive Notification Service...');

      // 1. 初始化通知渠道
      NotificationChannelFactory.initialize();

      // 2. 初始化任务处理器
      TaskProcessorFactory.initialize();

      // 3. 设置定时任务
      await this.setupScheduledTasks();

      // 4. 恢复之前的状态
      await this.restoreServiceState();

      // 5. 设置Chrome事件监听器
      this.setupChromeListeners();

      // 6. 设置错误处理
      this.setupErrorHandlers();

      // 7. 启动健康检查
      this.startHealthCheck();

      this.isInitialized = true;
      console.log('✅ Proactive Notification Service initialized successfully');

      // 发送初始化完成通知（可选）
      await this.sendInitializationNotification();

    } catch (error) {
      console.error('❌ Failed to initialize Proactive Notification Service:', error);
      throw error;
    }
  }

  /**
   * 设置定时任务
   */
  private async setupScheduledTasks(): Promise<void> {
    const defaultTasks: Omit<ScheduledTask, 'lastRun' | 'nextRun' | 'consecutiveFailures'>[] = [
      {
        id: 'dependency-monitor',
        name: '依赖项监控',
        frequency: 30, // 每30分钟
        priority: 'high',
        enabled: true,
        processor: 'dependency-monitor',
        maxFailures: 3
      },
      {
        id: 'project-health-check',
        name: '项目健康检查',
        frequency: 120, // 每2小时
        priority: 'medium',
        enabled: true,
        processor: 'project-health-check',
        maxFailures: 5
      },
      {
        id: 'team-collaboration-analysis',
        name: '团队协作分析',
        frequency: 240, // 每4小时
        priority: 'low',
        enabled: true,
        processor: 'team-collaboration-analysis',
        maxFailures: 5
      },
      {
        id: 'memory-lifecycle',
        name: '记忆生命周期管理',
        frequency: 360, // 每6小时
        priority: 'medium',
        enabled: true,
        processor: 'memory-lifecycle',
        maxFailures: 3
      },
      {
        id: 'daily-summary',
        name: '每日摘要生成',
        frequency: 1440, // 每24小时
        priority: 'medium',
        enabled: true,
        processor: 'daily-summary',
        maxFailures: 3
      }
    ];

    // 加载用户自定义的任务配置
    const userConfig = await this.loadUserTaskConfig();
    
    for (const taskConfig of defaultTasks) {
      const userOverrides = userConfig[taskConfig.id] || {};
      const task: ScheduledTask = {
        ...taskConfig,
        ...userOverrides,
        lastRun: 0,
        nextRun: Date.now() + taskConfig.frequency * 60 * 1000,
        consecutiveFailures: 0
      };

      this.scheduledTasks.set(task.id, task);
      
      // 创建Chrome alarm
      if (task.enabled) {
        await chrome.alarms.create(task.id, {
          delayInMinutes: task.frequency,
          periodInMinutes: task.frequency
        });
        console.log(`⏰ Scheduled task: ${task.name} (every ${task.frequency} minutes)`);
      }
    }

    this.serviceStats.activeTaskCount = Array.from(this.scheduledTasks.values())
      .filter(task => task.enabled).length;
  }

  /**
   * 设置Chrome事件监听器
   */
  private setupChromeListeners(): void {
    // 监听定时器事件
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));

    // 监听消息事件
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // 监听扩展图标点击
    chrome.action.onClicked.addListener(this.handleExtensionClick.bind(this));

    console.log('👂 Chrome event listeners set up');
  }

  /**
   * 处理定时器事件
   */
  private async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    const task = this.scheduledTasks.get(alarm.name);
    if (!task || !task.enabled) {
      console.warn(`⚠️ Unknown or disabled alarm: ${alarm.name}`);
      return;
    }

    console.log(`⏰ Alarm triggered: ${task.name}`);
    await this.executeTask(task);
  }

  /**
   * 处理消息事件
   */
  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'NOTIFICATION_INTERACTION':
          await this.handleNotificationInteraction(message.data);
          sendResponse({ success: true });
          break;

        case 'EXECUTE_NOTIFICATION_ACTION':
          await this.executeNotificationAction(message.data);
          sendResponse({ success: true });
          break;

        case 'GET_SERVICE_STATS':
          sendResponse(await this.getServiceStats());
          break;

        case 'UPDATE_TASK_CONFIG':
          await this.updateTaskConfig(message.data);
          sendResponse({ success: true });
          break;

        case 'TRIGGER_MANUAL_TASK':
          await this.triggerManualTask(message.data.taskId);
          sendResponse({ success: true });
          break;

        case 'TEST_NOTIFICATION':
          await this.sendTestNotification(message.data);
          sendResponse({ success: true });
          break;

        case 'CLEAR_ALL_NOTIFICATIONS':
          await BadgeNotificationChannel.clearAll();
          sendResponse({ success: true });
          break;

        default:
          // 不处理的消息类型
          break;
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    if (this.runningTasks.has(task.id)) {
      console.warn(`⚠️ Task ${task.id} is already running, skipping...`);
      return;
    }

    this.runningTasks.add(task.id);
    const startTime = Date.now();

    try {
      console.log(`🚀 Executing task: ${task.name}`);

      // 获取任务处理器
      const processor = TaskProcessorFactory.getProcessor(task.processor);
      if (!processor) {
        throw new Error(`Task processor not found: ${task.processor}`);
      }

      // 执行任务
      const notifications = await processor.execute();

      // 发送通知
      for (const notification of notifications) {
        await this.notificationManager.sendNotification(notification);
      }

      // 记录成功执行
      const duration = Date.now() - startTime;
      const result: TaskExecutionResult = {
        taskId: task.id,
        success: true,
        notificationCount: notifications.length,
        duration,
        timestamp: Date.now()
      };

      await this.recordTaskExecution(result);

      // 重置失败计数
      task.consecutiveFailures = 0;
      task.lastRun = Date.now();

      console.log(`✅ Task completed: ${task.name} (${duration}ms, ${notifications.length} notifications)`);

    } catch (error) {
      console.error(`❌ Task failed: ${task.name}`, error);

      // 记录失败执行
      const duration = Date.now() - startTime;
      const result: TaskExecutionResult = {
        taskId: task.id,
        success: false,
        notificationCount: 0,
        duration,
        error: error.message,
        timestamp: Date.now()
      };

      await this.recordTaskExecution(result);

      // 增加失败计数
      task.consecutiveFailures++;

      // 如果连续失败次数过多，禁用任务
      if (task.consecutiveFailures >= task.maxFailures) {
        console.error(`🚫 Disabling task ${task.name} due to consecutive failures`);
        await this.disableTask(task.id, `连续失败${task.consecutiveFailures}次`);
      }

    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 记录任务执行结果
   */
  private async recordTaskExecution(result: TaskExecutionResult): Promise<void> {
    this.executionHistory.unshift(result);
    
    // 只保留最近500条记录
    if (this.executionHistory.length > 500) {
      this.executionHistory = this.executionHistory.slice(0, 500);
    }

    // 更新统计信息
    this.updateServiceStats(result);

    // 保存到本地存储
    try {
      await chrome.storage.local.set({
        taskExecutionHistory: this.executionHistory.slice(0, 100), // 只保存最近100条到存储
        serviceStats: this.serviceStats
      });
    } catch (error) {
      console.error('Failed to save execution history:', error);
    }
  }

  /**
   * 更新服务统计信息
   */
  private updateServiceStats(result: TaskExecutionResult): void {
    this.serviceStats.totalTaskRuns++;
    this.serviceStats.lastRunTime = result.timestamp;

    if (result.success) {
      this.serviceStats.totalNotificationsSent += result.notificationCount;
    }

    // 计算成功率
    const recentResults = this.executionHistory.slice(0, 20); // 最近20次执行
    const successCount = recentResults.filter(r => r.success).length;
    this.serviceStats.successRate = recentResults.length > 0 ? 
      (successCount / recentResults.length) * 100 : 100;

    // 计算平均执行时间
    const recentDurations = recentResults.map(r => r.duration);
    this.serviceStats.averageExecutionTime = recentDurations.length > 0 ?
      recentDurations.reduce((sum, duration) => sum + duration, 0) / recentDurations.length : 0;
  }

  /**
   * 处理通知交互
   */
  private async handleNotificationInteraction(data: any): Promise<void> {
    console.log('📊 Recording notification interaction:', data);

    // 记录到通知管理器
    await this.notificationManager.recordUserInteraction(data);

    // 如果是关闭操作，更新badge计数
    if (data.action === 'dismiss' || data.action === 'click') {
      await BadgeNotificationChannel.clearOne();
    }
  }

  /**
   * 执行通知操作
   */
  private async executeNotificationAction(data: any): Promise<void> {
    console.log('⚡ Executing notification action:', data);

    const { notificationId, buttonIndex } = data;

    // 这里需要根据具体的操作类型执行相应的逻辑
    // 例如：联系团队、更新状态、打开仪表盘等

    // 暂时记录操作日志
    await chrome.storage.local.set({
      [`action_${notificationId}_${buttonIndex}`]: {
        executed: true,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 处理扩展图标点击
   */
  private async handleExtensionClick(tab: chrome.tabs.Tab): Promise<void> {
    console.log('🖱️ Extension icon clicked');

    // 清除badge计数
    await BadgeNotificationChannel.clearAll();

    // 记录用户交互
    await chrome.storage.local.set({ lastUserInteraction: Date.now() });
  }

  /**
   * 手动触发任务
   */
  private async triggerManualTask(taskId: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    console.log(`🔧 Manually triggering task: ${task.name}`);
    await this.executeTask(task);
  }

  /**
   * 更新任务配置
   */
  private async updateTaskConfig(config: { taskId: string; updates: Partial<ScheduledTask> }): Promise<void> {
    const { taskId, updates } = config;
    const task = this.scheduledTasks.get(taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // 应用更新
    Object.assign(task, updates);

    // 如果频率改变，重新设置alarm
    if (updates.frequency && task.enabled) {
      await chrome.alarms.clear(taskId);
      await chrome.alarms.create(taskId, {
        delayInMinutes: task.frequency,
        periodInMinutes: task.frequency
      });
    }

    // 如果启用状态改变
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        await chrome.alarms.create(taskId, {
          delayInMinutes: task.frequency,
          periodInMinutes: task.frequency
        });
      } else {
        await chrome.alarms.clear(taskId);
      }
    }

    // 保存配置
    await this.saveTaskConfig();

    console.log(`🔧 Task config updated: ${task.name}`);
  }

  /**
   * 禁用任务
   */
  private async disableTask(taskId: string, reason: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = false;
      await chrome.alarms.clear(taskId);
      
      // 发送任务禁用通知
      await this.notificationManager.sendNotification({
        id: `task-disabled-${taskId}-${Date.now()}`,
        type: 'system_alert',
        priority: 'important',
        title: '⚠️ 任务已禁用',
        message: `任务"${task.name}"已自动禁用：${reason}`,
        data: { taskId, reason },
        createdAt: Date.now()
      });

      await this.saveTaskConfig();
      console.log(`🚫 Task disabled: ${task.name} - ${reason}`);
    }
  }

  /**
   * 发送测试通知
   */
  private async sendTestNotification(data: { channel: string; priority: string; message: any }): Promise<void> {
    const testNotification: NotificationItem = {
      id: `test-${Date.now()}`,
      type: 'test_notification',
      priority: data.priority as any,
      title: data.message.title,
      message: data.message.body,
      data: { isTest: true, ...data.message.data },
      createdAt: Date.now(),
      actions: data.message.actions
    };

    await this.notificationManager.sendNotification(testNotification);
    console.log(`🧪 Test notification sent via ${data.channel}`);
  }

  /**
   * 获取服务统计信息
   */
  private async getServiceStats(): Promise<any> {
    const taskStats = Array.from(this.scheduledTasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      enabled: task.enabled,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      consecutiveFailures: task.consecutiveFailures,
      frequency: task.frequency
    }));

    const notificationStats = await this.notificationManager.getNotificationStats();

    return {
      service: this.serviceStats,
      tasks: taskStats,
      notifications: notificationStats,
      executionHistory: this.executionHistory.slice(0, 10) // 最近10次执行
    };
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    // 每30分钟检查一次服务健康状态
    setInterval(async () => {
      await this.performHealthCheck();
    }, 30 * 60 * 1000);

    console.log('🏥 Health check started');
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const issues: string[] = [];

      // 检查任务状态
      for (const [taskId, task] of this.scheduledTasks) {
        if (task.enabled && task.consecutiveFailures > 2) {
          issues.push(`任务"${task.name}"连续失败${task.consecutiveFailures}次`);
        }

        const timeSinceLastRun = Date.now() - task.lastRun;
        const expectedInterval = task.frequency * 60 * 1000 * 2; // 允许2倍间隔的延迟
        
        if (task.enabled && task.lastRun > 0 && timeSinceLastRun > expectedInterval) {
          issues.push(`任务"${task.name}"长时间未执行`);
        }
      }

      // 检查成功率
      if (this.serviceStats.successRate < 70) {
        issues.push(`服务成功率过低：${this.serviceStats.successRate.toFixed(1)}%`);
      }

      // 如果有问题，发送健康检查通知
      if (issues.length > 0) {
        await this.notificationManager.sendNotification({
          id: `health-check-${Date.now()}`,
          type: 'system_health',
          priority: 'important',
          title: '⚠️ 系统健康检查警告',
          message: `检测到${issues.length}个问题：${issues.join('；')}`,
          data: { issues },
          createdAt: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * 发送初始化完成通知
   */
  private async sendInitializationNotification(): Promise<void> {
    const enabledTaskCount = Array.from(this.scheduledTasks.values())
      .filter(task => task.enabled).length;

    await this.notificationManager.sendNotification({
      id: `init-${Date.now()}`,
      type: 'system_info',
      priority: 'info',
      title: '🤖 智能监控已启动',
      message: `主动通知系统已启动，正在监控${enabledTaskCount}个任务`,
      data: { 
        isInitialization: true,
        enabledTaskCount,
        taskNames: Array.from(this.scheduledTasks.values())
          .filter(task => task.enabled)
          .map(task => task.name)
      },
      createdAt: Date.now()
    });
  }

  /**
   * 加载用户任务配置
   */
  private async loadUserTaskConfig(): Promise<Record<string, Partial<ScheduledTask>>> {
    try {
      const result = await chrome.storage.sync.get('taskConfig');
      return result.taskConfig || {};
    } catch (error) {
      console.error('Failed to load user task config:', error);
      return {};
    }
  }

  /**
   * 保存任务配置
   */
  private async saveTaskConfig(): Promise<void> {
    try {
      const taskConfig: Record<string, Partial<ScheduledTask>> = {};
      
      for (const [taskId, task] of this.scheduledTasks) {
        taskConfig[taskId] = {
          enabled: task.enabled,
          frequency: task.frequency,
          priority: task.priority
        };
      }

      await chrome.storage.sync.set({ taskConfig });
    } catch (error) {
      console.error('Failed to save task config:', error);
    }
  }

  /**
   * 恢复服务状态
   */
  private async restoreServiceState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['taskExecutionHistory', 'serviceStats']);
      
      if (result.taskExecutionHistory) {
        this.executionHistory = result.taskExecutionHistory;
      }

      if (result.serviceStats) {
        this.serviceStats = { ...this.serviceStats, ...result.serviceStats };
      }

      console.log('🔄 Service state restored');
    } catch (error) {
      console.error('Failed to restore service state:', error);
    }
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandlers(): void {
    // 全局错误处理
    process.on?.('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection:', reason);
    });

    process.on?.('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Proactive Notification Service...');

    // 清除所有定时器
    for (const taskId of this.scheduledTasks.keys()) {
      await chrome.alarms.clear(taskId);
    }

    // 保存当前状态
    await this.saveTaskConfig();

    console.log('✅ Proactive Notification Service shut down');
  }

  /**
   * 获取服务是否已初始化
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取正在运行的任务数量
   */
  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  /**
   * 获取启用的任务数量
   */
  getEnabledTaskCount(): number {
    return Array.from(this.scheduledTasks.values()).filter(task => task.enabled).length;
  }
}

export default ProactiveNotificationService;