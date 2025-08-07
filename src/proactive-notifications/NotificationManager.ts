/**
 * 主动通知管理器
 * 负责智能选择通知渠道、格式化消息并发送通知
 */

import { sendBotMessage } from '../bot';

export interface NotificationItem {
  id: string;
  type: string;
  priority: 'urgent' | 'important' | 'info';
  title: string;
  message: string;
  data: any;
  createdAt: number;
  expiresAt?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  data?: any;
}

export interface FormattedMessage {
  title: string;
  body: string;
  priority: string;
  actions?: NotificationAction[];
  defaultAction?: NotificationAction;
  data?: any;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

export interface UserContext {
  isActive: boolean;
  currentActivity: string;
  timeOfDay: 'work' | 'break' | 'off';
  notificationHistory: RecentNotification[];
  preferences: UserPreferences;
}

export interface RecentNotification {
  id: string;
  type: string;
  timestamp: number;
  userResponse?: string;
}

export interface UserPreferences {
  enabledChannels: string[];
  disabledChannels: string[];
  quietHours: { start: string; end: string; };
  workHours: { start: string; end: string; };
  urgentOnly: boolean;
  adaptiveTimings: boolean;
}

export abstract class NotificationChannel {
  abstract send(message: FormattedMessage): Promise<NotificationResult>;
  abstract getName(): string;
}

export class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();
  private strategy: NotificationStrategy;
  private userPreferences: UserPreferences | null = null;
  private recentNotifications: RecentNotification[] = [];
  private notificationQueue: NotificationItem[] = [];

  constructor() {
    this.initializeChannels();
    this.strategy = new SmartNotificationStrategy();
    this.loadUserPreferences();
  }

  /**
   * 发送通知
   */
  async sendNotification(notification: NotificationItem): Promise<void> {
    try {
      console.log('🔔 Processing notification:', notification);

      // 1. 检查是否为重复通知
      if (this.isDuplicateNotification(notification)) {
        console.log('⚠️ Duplicate notification detected, skipping');
        return;
      }

      // 2. 获取用户当前上下文
      const userContext = await this.getUserContext();

      // 3. 检查是否在静音时段
      if (this.isInQuietPeriod(userContext)) {
        console.log('🔇 In quiet period, queuing notification');
        this.queueNotification(notification);
        return;
      }

      // 4. 选择最佳通知渠道
      const selectedChannels = this.strategy.selectChannels(notification, userContext);
      
      if (selectedChannels.length === 0) {
        console.log('❌ No suitable channels found');
        return;
      }

      // 5. 格式化消息
      const formattedMessages = await this.formatForChannels(notification, selectedChannels);

      // 6. 发送通知
      const results = await Promise.allSettled(
        selectedChannels.map(async (channelName, index) => {
          const channel = this.channels.get(channelName);
          if (channel) {
            console.log(`📤 Sending via ${channelName}:`, formattedMessages[index]);
            return await channel.send(formattedMessages[index]);
          }
          return { success: false, error: 'Channel not found' };
        })
      );

      // 7. 记录发送结果
      await this.recordNotificationResult(notification, selectedChannels, results);

      // 8. 更新学习数据
      await this.updateLearningData(notification, userContext, selectedChannels);

      console.log('✅ Notification sent successfully');

    } catch (error) {
      console.error('❌ Notification sending failed:', error);
      throw error;
    }
  }

  /**
   * 批量发送通知
   */
  async sendBatchNotifications(notifications: NotificationItem[]): Promise<void> {
    // 按优先级排序
    const sortedNotifications = notifications.sort((a, b) => {
      const priorityOrder = { urgent: 3, important: 2, info: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // 分组发送，避免通知轰炸
    const groups = this.groupNotificationsByType(sortedNotifications);
    
    for (const [type, groupNotifications] of groups) {
      if (groupNotifications.length > 1) {
        // 合并同类型通知
        const mergedNotification = this.mergeNotifications(groupNotifications);
        await this.sendNotification(mergedNotification);
      } else {
        await this.sendNotification(groupNotifications[0]);
      }
      
      // 添加延迟，避免频繁通知
      await this.delay(2000);
    }
  }

  /**
   * 处理队列中的通知
   */
  async processQueuedNotifications(): Promise<void> {
    if (this.notificationQueue.length === 0) return;

    const userContext = await this.getUserContext();
    
    if (!this.isInQuietPeriod(userContext)) {
      const queuedNotifications = [...this.notificationQueue];
      this.notificationQueue = [];
      
      await this.sendBatchNotifications(queuedNotifications);
    }
  }

  /**
   * 初始化通知渠道
   */
  private initializeChannels(): void {
    this.channels.set('bot', new BotNotificationChannel());
    this.channels.set('chrome', new ChromeNotificationChannel());
    this.channels.set('web_overlay', new WebOverlayChannel());
    this.channels.set('badge', new BadgeNotificationChannel());
    this.channels.set('popup', new PopupNotificationChannel());
    this.channels.set('toast', new ToastNotificationChannel());
  }

  /**
   * 获取用户当前上下文
   */
  private async getUserContext(): Promise<UserContext> {
    try {
      // 检查用户活跃状态
      const isActive = await this.checkUserActivity();
      
      // 获取当前时间段
      const timeOfDay = this.getCurrentTimeOfDay();
      
      // 获取最近通知历史
      const notificationHistory = await this.getRecentNotificationHistory();
      
      // 获取用户偏好
      const preferences = this.userPreferences || await this.loadUserPreferences();

      return {
        isActive,
        currentActivity: await this.detectCurrentActivity(),
        timeOfDay,
        notificationHistory,
        preferences
      };
      
    } catch (error) {
      console.error('Failed to get user context:', error);
      return this.getDefaultUserContext();
    }
  }

  /**
   * 检查用户活跃状态
   */
  private async checkUserActivity(): Promise<boolean> {
    try {
      // 检查是否有活跃的标签页
      const tabs = await chrome.tabs.query({ active: true });
      
      // 检查最近的用户交互
      const lastInteraction = await chrome.storage.local.get('lastUserInteraction');
      const timeSinceLastInteraction = Date.now() - (lastInteraction.lastUserInteraction || 0);
      
      return tabs.length > 0 && timeSinceLastInteraction < 5 * 60 * 1000; // 5分钟内有交互
      
    } catch (error) {
      return false;
    }
  }

  /**
   * 检测当前活动类型
   */
  private async detectCurrentActivity(): Promise<string> {
    try {
      const tabs = await chrome.tabs.query({ active: true });
      
      if (tabs.length === 0) return 'inactive';
      
      const activeTab = tabs[0];
      const url = activeTab.url || '';
      
      // 基于URL判断活动类型
      if (url.includes('calendar') || url.includes('meet') || url.includes('zoom')) {
        return 'meeting';
      } else if (url.includes('jira') || url.includes('github') || url.includes('confluence')) {
        return 'focused_work';
      } else if (url.includes('slack') || url.includes('teams') || activeTab.title?.includes('chat')) {
        return 'communication';
      } else if (url.includes('youtube') || url.includes('news') || url.includes('social')) {
        return 'break';
      }
      
      return 'general_browsing';
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取当前时间段
   */
  private getCurrentTimeOfDay(): 'work' | 'break' | 'off' {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    const preferences = this.userPreferences;
    if (preferences?.workHours) {
      const workStart = parseInt(preferences.workHours.start.split(':')[0]);
      const workEnd = parseInt(preferences.workHours.end.split(':')[0]);
      
      if (dayOfWeek === 0 || dayOfWeek === 6) return 'off'; // 周末
      if (hour >= workStart && hour < workEnd) return 'work';
      if (hour >= workEnd && hour < workEnd + 2) return 'break'; // 下班后2小时内
    }
    
    // 默认判断
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'off';
    if (hour >= 9 && hour < 18) return 'work';
    if (hour >= 18 && hour < 20) return 'break';
    
    return 'off';
  }

  /**
   * 检查是否在静音时段
   */
  private isInQuietPeriod(userContext: UserContext): boolean {
    if (!userContext.preferences.quietHours) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const quietStart = this.parseTime(userContext.preferences.quietHours.start);
    const quietEnd = this.parseTime(userContext.preferences.quietHours.end);
    
    if (quietStart <= quietEnd) {
      return currentTime >= quietStart && currentTime <= quietEnd;
    } else {
      // 跨天的情况
      return currentTime >= quietStart || currentTime <= quietEnd;
    }
  }

  /**
   * 解析时间字符串为分钟数
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 检查重复通知
   */
  private isDuplicateNotification(notification: NotificationItem): boolean {
    const recentWindow = 30 * 60 * 1000; // 30分钟
    const now = Date.now();
    
    return this.recentNotifications.some(recent => 
      recent.type === notification.type &&
      now - recent.timestamp < recentWindow &&
      this.isSimilarContent(recent, notification)
    );
  }

  /**
   * 判断通知内容是否相似
   */
  private isSimilarContent(recent: RecentNotification, current: NotificationItem): boolean {
    // 基于通知类型和关键数据判断
    if (current.data.dependency?.id) {
      return recent.id.includes(current.data.dependency.id);
    }
    if (current.data.project?.id) {
      return recent.id.includes(current.data.project.id);
    }
    return false;
  }

  /**
   * 队列通知
   */
  private queueNotification(notification: NotificationItem): void {
    this.notificationQueue.push(notification);
    
    // 限制队列大小
    if (this.notificationQueue.length > 10) {
      this.notificationQueue = this.notificationQueue.slice(-10);
    }
  }

  /**
   * 为不同渠道格式化消息
   */
  private async formatForChannels(
    notification: NotificationItem, 
    channels: string[]
  ): Promise<FormattedMessage[]> {
    const messages: FormattedMessage[] = [];
    
    for (const channelName of channels) {
      const formatter = this.getFormatterForChannel(channelName);
      const formattedMessage = await formatter.format(notification);
      messages.push(formattedMessage);
    }
    
    return messages;
  }

  /**
   * 获取渠道对应的格式化器
   */
  private getFormatterForChannel(channelName: string): MessageFormatter {
    switch (channelName) {
      case 'bot':
        return new BotMessageFormatter();
      case 'chrome':
        return new ChromeMessageFormatter();
      case 'web_overlay':
        return new WebOverlayMessageFormatter();
      case 'badge':
        return new BadgeMessageFormatter();
      case 'popup':
        return new PopupMessageFormatter();
      case 'toast':
        return new ToastMessageFormatter();
      default:
        return new DefaultMessageFormatter();
    }
  }

  /**
   * 按类型分组通知
   */
  private groupNotificationsByType(notifications: NotificationItem[]): Map<string, NotificationItem[]> {
    const groups = new Map<string, NotificationItem[]>();
    
    for (const notification of notifications) {
      const group = groups.get(notification.type) || [];
      group.push(notification);
      groups.set(notification.type, group);
    }
    
    return groups;
  }

  /**
   * 合并同类型通知
   */
  private mergeNotifications(notifications: NotificationItem[]): NotificationItem {
    const first = notifications[0];
    const count = notifications.length;
    
    return {
      ...first,
      id: `merged-${first.type}-${Date.now()}`,
      title: `${first.title} (+${count - 1}项)`,
      message: `检测到${count}个相关事项需要关注`,
      data: {
        ...first.data,
        mergedNotifications: notifications,
        count
      }
    };
  }

  /**
   * 记录通知发送结果
   */
  private async recordNotificationResult(
    notification: NotificationItem,
    channels: string[],
    results: PromiseSettledResult<NotificationResult>[]
  ): Promise<void> {
    const record = {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      channels,
      results: results.map(result => ({
        success: result.status === 'fulfilled' ? result.value.success : false,
        error: result.status === 'rejected' ? result.reason : 
               (result.status === 'fulfilled' ? result.value.error : undefined)
      })),
      timestamp: Date.now()
    };

    // 记录到本地存储
    const existingRecords = await chrome.storage.local.get('notificationHistory');
    const history = existingRecords.notificationHistory || [];
    history.unshift(record);
    
    // 只保留最近100条记录
    const trimmedHistory = history.slice(0, 100);
    await chrome.storage.local.set({ notificationHistory: trimmedHistory });

    // 更新最近通知列表
    this.recentNotifications.unshift({
      id: notification.id,
      type: notification.type,
      timestamp: Date.now()
    });
    
    // 限制内存中的记录数量
    this.recentNotifications = this.recentNotifications.slice(0, 50);
  }

  /**
   * 更新学习数据
   */
  private async updateLearningData(
    notification: NotificationItem,
    userContext: UserContext,
    channels: string[]
  ): Promise<void> {
    const learningData = {
      notification: {
        type: notification.type,
        priority: notification.priority,
        createdAt: notification.createdAt
      },
      userContext: {
        timeOfDay: userContext.timeOfDay,
        activity: userContext.currentActivity,
        isActive: userContext.isActive
      },
      selectedChannels: channels,
      timestamp: Date.now()
    };

    // 保存学习数据用于优化策略
    const existingData = await chrome.storage.local.get('learningData');
    const history = existingData.learningData || [];
    history.unshift(learningData);
    
    // 只保留最近500条学习数据
    const trimmedData = history.slice(0, 500);
    await chrome.storage.local.set({ learningData: trimmedData });
  }

  /**
   * 加载用户偏好
   */
  private async loadUserPreferences(): Promise<UserPreferences> {
    try {
      const result = await chrome.storage.sync.get('notificationPreferences');
      this.userPreferences = result.notificationPreferences || this.getDefaultPreferences();
      return this.userPreferences;
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      this.userPreferences = this.getDefaultPreferences();
      return this.userPreferences;
    }
  }

  /**
   * 获取默认偏好设置
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      enabledChannels: ['bot', 'chrome', 'web_overlay', 'badge'],
      disabledChannels: [],
      quietHours: { start: '22:00', end: '08:00' },
      workHours: { start: '09:00', end: '18:00' },
      urgentOnly: false,
      adaptiveTimings: true
    };
  }

  /**
   * 获取默认用户上下文
   */
  private getDefaultUserContext(): UserContext {
    return {
      isActive: false,
      currentActivity: 'unknown',
      timeOfDay: 'off',
      notificationHistory: [],
      preferences: this.getDefaultPreferences()
    };
  }

  /**
   * 获取最近通知历史
   */
  private async getRecentNotificationHistory(): Promise<RecentNotification[]> {
    try {
      const result = await chrome.storage.local.get('recentNotifications');
      return result.recentNotifications || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 记录用户交互
   */
  async recordUserInteraction(interaction: {
    notificationId: string;
    action: string;
    buttonIndex?: number;
    timestamp: number;
  }): Promise<void> {
    // 更新最后交互时间
    await chrome.storage.local.set({ lastUserInteraction: interaction.timestamp });

    // 记录具体交互数据
    const existingInteractions = await chrome.storage.local.get('userInteractions');
    const interactions = existingInteractions.userInteractions || [];
    interactions.unshift(interaction);
    
    // 只保留最近200条交互记录
    const trimmedInteractions = interactions.slice(0, 200);
    await chrome.storage.local.set({ userInteractions: trimmedInteractions });

    console.log('📊 User interaction recorded:', interaction);
  }

  /**
   * 获取通知统计
   */
  async getNotificationStats(): Promise<any> {
    try {
      const [history, interactions] = await Promise.all([
        chrome.storage.local.get('notificationHistory'),
        chrome.storage.local.get('userInteractions')
      ]);

      const notificationHistory = history.notificationHistory || [];
      const userInteractions = interactions.userInteractions || [];

      return {
        totalSent: notificationHistory.length,
        totalInteractions: userInteractions.length,
        interactionRate: notificationHistory.length > 0 ? 
          userInteractions.length / notificationHistory.length : 0,
        channelStats: this.calculateChannelStats(notificationHistory),
        priorityStats: this.calculatePriorityStats(notificationHistory),
        timeStats: this.calculateTimeStats(notificationHistory)
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {};
    }
  }

  private calculateChannelStats(history: any[]): any {
    const stats = {};
    for (const record of history) {
      for (const channel of record.channels) {
        stats[channel] = (stats[channel] || 0) + 1;
      }
    }
    return stats;
  }

  private calculatePriorityStats(history: any[]): any {
    const stats = {};
    for (const record of history) {
      stats[record.priority] = (stats[record.priority] || 0) + 1;
    }
    return stats;
  }

  private calculateTimeStats(history: any[]): any {
    const hourStats = {};
    for (const record of history) {
      const hour = new Date(record.timestamp).getHours();
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    }
    return { byHour: hourStats };
  }
}

// 通知策略接口
export interface NotificationStrategy {
  selectChannels(notification: NotificationItem, userContext: UserContext): string[];
}

// 智能通知策略实现
export class SmartNotificationStrategy implements NotificationStrategy {
  selectChannels(notification: NotificationItem, userContext: UserContext): string[] {
    // 基于优先级的基础策略
    const baseChannels = this.getBaseChannelsByPriority(notification.priority);
    
    // 基于用户状态的调整
    const adjustedChannels = this.adjustForUserContext(baseChannels, userContext);
    
    // 基于用户偏好的过滤
    const filteredChannels = this.filterByUserPreferences(adjustedChannels, userContext.preferences);
    
    // 基于通知历史的去重和延迟
    const finalChannels = this.applyHistoryRules(filteredChannels, userContext.notificationHistory);
    
    return finalChannels;
  }

  private getBaseChannelsByPriority(priority: string): string[] {
    const channelMap = {
      'urgent': ['bot', 'chrome', 'popup', 'badge'],
      'important': ['chrome', 'web_overlay', 'badge'],
      'info': ['web_overlay', 'badge']
    };
    return channelMap[priority] || ['badge'];
  }

  private adjustForUserContext(channels: string[], userContext: UserContext): string[] {
    const adjusted = [...channels];
    
    // 如果用户不活跃，移除即时通知渠道
    if (!userContext.isActive) {
      const immediateChannels = ['popup', 'web_overlay'];
      return adjusted.filter(ch => !immediateChannels.includes(ch));
    }
    
    // 如果在非工作时间，减少打扰
    if (userContext.timeOfDay === 'off') {
      return adjusted.filter(ch => ['bot', 'badge'].includes(ch));
    }
    
    // 如果用户正在专注工作，避免弹窗
    if (userContext.currentActivity === 'focused_work') {
      return adjusted.filter(ch => ch !== 'popup');
    }

    // 如果在开会，只使用badge
    if (userContext.currentActivity === 'meeting') {
      return ['badge'];
    }
    
    return adjusted;
  }

  private filterByUserPreferences(channels: string[], preferences: UserPreferences): string[] {
    return channels.filter(channel => {
      return preferences.enabledChannels.includes(channel) &&
             !preferences.disabledChannels.includes(channel);
    });
  }

  private applyHistoryRules(channels: string[], history: RecentNotification[]): string[] {
    // 检查最近是否有相同类型的通知
    const recentSimilar = history.find(n => 
      Date.now() - n.timestamp < 30 * 60 * 1000 // 30分钟内
    );
    
    if (recentSimilar && history.length > 3) {
      // 如果最近有很多通知，只保留最不打扰的渠道
      return channels.filter(ch => ['badge', 'web_overlay'].includes(ch));
    }
    
    return channels;
  }
}

// 消息格式化器基类
export abstract class MessageFormatter {
  abstract format(notification: NotificationItem): Promise<FormattedMessage>;
}

// Bot消息格式化器
export class BotMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    const actions = this.generateActions(notification);
    
    return {
      title: notification.title,
      body: this.formatBotMessage(notification),
      priority: notification.priority,
      actions,
      data: notification.data
    };
  }

  private formatBotMessage(notification: NotificationItem): string {
    let message = `**${notification.title}**\n\n`;
    message += `${notification.message}\n\n`;
    
    if (notification.data.dependency) {
      const dep = notification.data.dependency;
      message += `**依赖详情：**\n`;
      message += `- 项目：${dep.source} → ${dep.target}\n`;
      message += `- 状态：${this.translateStatus(dep.status)}\n`;
      message += `- 预计完成：${new Date(dep.estimatedCompletion).toLocaleDateString()}\n`;
      if (dep.contactPerson) {
        message += `- 联系人：${dep.contactPerson}\n`;
      }
    }

    if (notification.data.analysis?.suggestedActions) {
      message += `\n**建议行动：**\n`;
      for (const action of notification.data.analysis.suggestedActions) {
        message += `- ${action.description}\n`;
      }
    }

    return message;
  }

  private generateActions(notification: NotificationItem): NotificationAction[] {
    const actions: NotificationAction[] = [];

    if (notification.data.dependency) {
      actions.push({
        id: 'contact_team',
        label: '联系团队',
        action: 'contact_dependency_team',
        data: { dependency: notification.data.dependency }
      });
      
      actions.push({
        id: 'update_status',
        label: '更新状态',
        action: 'update_dependency_status',
        data: { dependency: notification.data.dependency }
      });
    }

    actions.push({
      id: 'mark_read',
      label: '已读',
      action: 'mark_notification_read',
      data: { notificationId: notification.id }
    });

    return actions;
  }

  private translateStatus(status: string): string {
    const statusMap = {
      'pending': '待开始',
      'in-progress': '进行中',
      'completed': '已完成',
      'blocked': '已阻塞'
    };
    return statusMap[status] || status;
  }
}

// Chrome通知格式化器
export class ChromeMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: notification.title,
      body: this.truncateMessage(notification.message, 120),
      priority: notification.priority,
      actions: this.generateSimpleActions(notification),
      data: notification.data
    };
  }

  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  private generateSimpleActions(notification: NotificationItem): NotificationAction[] {
    return [
      {
        id: 'view',
        label: '查看详情',
        action: 'view_notification_details',
        data: { notificationId: notification.id }
      },
      {
        id: 'dismiss',
        label: '忽略',
        action: 'dismiss_notification',
        data: { notificationId: notification.id }
      }
    ];
  }
}

// 网页浮层格式化器
export class WebOverlayMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: notification.title,
      body: notification.message,
      priority: notification.priority,
      actions: this.generateWebActions(notification),
      data: notification.data
    };
  }

  private generateWebActions(notification: NotificationItem): NotificationAction[] {
    const actions: NotificationAction[] = [
      {
        id: 'view_dashboard',
        label: '打开仪表盘',
        action: 'open_project_dashboard',
        data: { projectId: notification.data.project?.id }
      }
    ];

    if (notification.data.dependency) {
      actions.unshift({
        id: 'quick_update',
        label: '快速更新',
        action: 'quick_update_dependency',
        data: { dependency: notification.data.dependency }
      });
    }

    return actions;
  }
}

// Badge通知格式化器（主要用于更新数字）
export class BadgeMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: '', // Badge不需要标题
      body: '', // Badge不需要内容
      priority: notification.priority,
      data: { increment: 1, priority: notification.priority }
    };
  }
}

// Popup格式化器
export class PopupMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: `🚨 ${notification.title}`,
      body: notification.message,
      priority: notification.priority,
      actions: [
        {
          id: 'handle_now',
          label: '立即处理',
          action: 'handle_urgent_notification',
          data: notification.data
        },
        {
          id: 'remind_later',
          label: '稍后提醒',
          action: 'snooze_notification',
          data: { notificationId: notification.id, snoozeMinutes: 30 }
        }
      ],
      data: notification.data
    };
  }
}

// Toast通知格式化器
export class ToastMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: notification.title,
      body: this.createShortSummary(notification),
      priority: notification.priority,
      actions: [{
        id: 'quick_action',
        label: '快速操作',
        action: 'show_quick_actions',
        data: notification.data
      }],
      data: notification.data
    };
  }

  private createShortSummary(notification: NotificationItem): string {
    if (notification.data.dependency) {
      const days = Math.ceil((notification.data.dependency.estimatedCompletion - Date.now()) / (1000 * 60 * 60 * 24));
      return `依赖项还有${days}天到期`;
    }
    return notification.message.substring(0, 50) + '...';
  }
}

// 默认格式化器
export class DefaultMessageFormatter extends MessageFormatter {
  async format(notification: NotificationItem): Promise<FormattedMessage> {
    return {
      title: notification.title,
      body: notification.message,
      priority: notification.priority,
      data: notification.data
    };
  }
}

export default NotificationManager;