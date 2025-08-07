/**
 * 各种通知渠道的具体实现
 * 包括Bot、Chrome通知、网页浮层、Badge、Popup等
 */

import { NotificationChannel, FormattedMessage, NotificationResult } from './NotificationManager';
import { sendBotMessage } from '../bot';

/**
 * Bot通知渠道
 * 通过现有的bot.ts发送消息
 */
export class BotNotificationChannel extends NotificationChannel {
  getName(): string {
    return 'bot';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      // 准备Bot消息数据
      const messageData = {
        matched_rule: this.extractMatchedRule(message),
        team_name: this.extractTeamName(message),
        team_id: this.extractTeamId(message),
        sender: 'Personal AI System',
        message_content: message.body,
        summary: message.title,
        reply_advice: this.generateReplyAdvice(message),
        datetime: new Date().toLocaleString('zh-CN'),
        mention: this.shouldMention(message)
      };

      await sendBotMessage(messageData);
      
      console.log('✅ Bot message sent successfully');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Bot message failed:', error);
      return { success: false, error: error.message };
    }
  }

  private extractMatchedRule(message: FormattedMessage): string {
    if (message.data?.dependency) {
      return `依赖项监控 - ${message.data.dependency.type}依赖`;
    }
    if (message.data?.project) {
      return `项目监控 - ${message.data.project.name}`;
    }
    return '主动监控系统';
  }

  private extractTeamName(message: FormattedMessage): string {
    return message.data?.team?.name || '项目进度监控';
  }

  private extractTeamId(message: FormattedMessage): string {
    return message.data?.team?.id || 'ai-monitoring';
  }

  private generateReplyAdvice(message: FormattedMessage): string {
    if (message.data?.analysis?.suggestedActions) {
      const actions = message.data.analysis.suggestedActions;
      if (actions.length > 0) {
        return `建议：${actions[0].description}`;
      }
    }
    
    if (message.priority === 'urgent') {
      return '建议立即处理此事项，避免影响项目进度';
    } else if (message.priority === 'important') {
      return '建议在今日内关注此事项';
    }
    
    return '请根据实际情况决定处理时机';
  }

  private shouldMention(message: FormattedMessage): boolean {
    // 紧急消息总是@用户
    if (message.priority === 'urgent') return true;
    
    // 重要消息在工作时间@用户
    if (message.priority === 'important') {
      const hour = new Date().getHours();
      return hour >= 9 && hour <= 18;
    }
    
    // 信息类消息不@用户
    return false;
  }
}

/**
 * Chrome系统通知渠道
 */
export class ChromeNotificationChannel extends NotificationChannel {
  private notificationMap: Map<string, string> = new Map();

  getName(): string {
    return 'chrome';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      const notificationOptions: chrome.notifications.NotificationOptions = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: message.title,
        message: message.body,
        priority: this.mapPriority(message.priority),
        requireInteraction: message.priority === 'urgent',
        silent: false
      };

      // 添加操作按钮
      if (message.actions && message.actions.length > 0) {
        notificationOptions.buttons = message.actions.slice(0, 2).map(action => ({
          title: action.label,
          iconUrl: this.getActionIcon(action.action)
        }));
      }

      const notificationId = await chrome.notifications.create(notificationOptions);
      
      // 保存通知信息用于后续处理
      this.notificationMap.set(notificationId, JSON.stringify(message));
      
      // 设置自动清理
      this.scheduleNotificationCleanup(notificationId, message.priority);
      
      console.log(`✅ Chrome notification created: ${notificationId}`);
      return { success: true, notificationId };
      
    } catch (error) {
      console.error('❌ Chrome notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 初始化事件监听器
   */
  static initializeListeners(): void {
    // 通知点击处理
    chrome.notifications.onClicked.addListener((notificationId) => {
      ChromeNotificationChannel.handleNotificationClick(notificationId);
    });

    // 按钮点击处理
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      ChromeNotificationChannel.handleButtonClick(notificationId, buttonIndex);
    });

    // 通知关闭处理
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      ChromeNotificationChannel.handleNotificationClosed(notificationId, byUser);
    });
  }

  private static async handleNotificationClick(notificationId: string): Promise<void> {
    console.log(`🖱️ Notification clicked: ${notificationId}`);
    
    // 记录用户交互
    await chrome.runtime.sendMessage({
      type: 'NOTIFICATION_INTERACTION',
      data: {
        notificationId,
        action: 'click',
        timestamp: Date.now()
      }
    });

    // 打开扩展页面
    chrome.action.openPopup?.();
    
    // 清除通知
    chrome.notifications.clear(notificationId);
  }

  private static async handleButtonClick(notificationId: string, buttonIndex: number): Promise<void> {
    console.log(`🔘 Notification button clicked: ${notificationId}, button: ${buttonIndex}`);
    
    // 记录用户交互
    await chrome.runtime.sendMessage({
      type: 'NOTIFICATION_INTERACTION',
      data: {
        notificationId,
        action: 'button_click',
        buttonIndex,
        timestamp: Date.now()
      }
    });

    // 执行按钮对应的操作
    await chrome.runtime.sendMessage({
      type: 'EXECUTE_NOTIFICATION_ACTION',
      data: {
        notificationId,
        buttonIndex
      }
    });
    
    // 清除通知
    chrome.notifications.clear(notificationId);
  }

  private static async handleNotificationClosed(notificationId: string, byUser: boolean): Promise<void> {
    if (byUser) {
      console.log(`❌ Notification dismissed by user: ${notificationId}`);
      
      // 记录用户交互
      await chrome.runtime.sendMessage({
        type: 'NOTIFICATION_INTERACTION',
        data: {
          notificationId,
          action: 'dismiss',
          timestamp: Date.now()
        }
      });
    }
  }

  private mapPriority(priority: string): number {
    const priorityMap = {
      'urgent': 2,
      'important': 1,
      'info': 0
    };
    return priorityMap[priority] || 0;
  }

  private getActionIcon(action: string): string | undefined {
    const iconMap = {
      'view_notification_details': 'icons/icon16.png',
      'dismiss_notification': 'icons/icon16.png',
      'contact_dependency_team': 'icons/icon16.png'
    };
    return iconMap[action];
  }

  private scheduleNotificationCleanup(notificationId: string, priority: string): void {
    const timeoutMap = {
      'urgent': 60000,     // 1分钟后自动清理
      'important': 300000, // 5分钟后自动清理
      'info': 600000       // 10分钟后自动清理
    };
    
    const timeout = timeoutMap[priority] || 300000;
    
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
      this.notificationMap.delete(notificationId);
    }, timeout);
  }
}

/**
 * 网页浮层通知渠道
 */
export class WebOverlayChannel extends NotificationChannel {
  getName(): string {
    return 'web_overlay';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      // 获取所有活跃的标签页
      const tabs = await chrome.tabs.query({ active: true });
      
      if (tabs.length === 0) {
        return { success: false, error: 'No active tabs found' };
      }

      const overlayData = {
        id: `overlay-${Date.now()}`,
        title: message.title,
        body: message.body,
        priority: message.priority,
        actions: message.actions || [],
        autoHide: message.priority !== 'urgent',
        hideDelay: this.getHideDelay(message.priority),
        position: 'top-right',
        data: message.data
      };

      let successCount = 0;
      const errors: string[] = [];

      // 向所有活跃标签页发送显示浮层的消息
      for (const tab of tabs) {
        if (tab.id && this.isValidTabForOverlay(tab)) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'SHOW_WEB_OVERLAY',
              data: overlayData
            });
            successCount++;
          } catch (error) {
            errors.push(`Tab ${tab.id}: ${error.message}`);
          }
        }
      }

      if (successCount > 0) {
        console.log(`✅ Web overlay sent to ${successCount} tabs`);
        return { success: true, notificationId: overlayData.id };
      } else {
        return { success: false, error: `Failed to send to any tabs: ${errors.join(', ')}` };
      }
      
    } catch (error) {
      console.error('❌ Web overlay notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  private isValidTabForOverlay(tab: chrome.tabs.Tab): boolean {
    const url = tab.url || '';
    
    // 跳过特殊页面
    const skipPatterns = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'file://'
    ];
    
    return !skipPatterns.some(pattern => url.startsWith(pattern));
  }

  private getHideDelay(priority: string): number {
    const delayMap = {
      'urgent': 0,        // 不自动隐藏
      'important': 15000, // 15秒
      'info': 8000        // 8秒
    };
    return delayMap[priority] || 8000;
  }
}

/**
 * Badge通知渠道
 */
export class BadgeNotificationChannel extends NotificationChannel {
  private static currentCount = 0;
  private static urgentCount = 0;

  getName(): string {
    return 'badge';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      // 增加计数
      BadgeNotificationChannel.currentCount++;
      
      if (message.priority === 'urgent') {
        BadgeNotificationChannel.urgentCount++;
      }

      // 更新badge文本
      await chrome.action.setBadgeText({
        text: BadgeNotificationChannel.currentCount.toString()
      });

      // 设置badge颜色
      const badgeColor = this.getBadgeColor(message.priority);
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });

      // 更新tooltip
      const tooltip = this.generateTooltip();
      await chrome.action.setTitle({ title: tooltip });

      console.log(`✅ Badge updated: ${BadgeNotificationChannel.currentCount} notifications`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Badge notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清除单个通知的badge计数
   */
  static async clearOne(priority?: string): Promise<void> {
    if (BadgeNotificationChannel.currentCount > 0) {
      BadgeNotificationChannel.currentCount--;
      
      if (priority === 'urgent' && BadgeNotificationChannel.urgentCount > 0) {
        BadgeNotificationChannel.urgentCount--;
      }
      
      if (BadgeNotificationChannel.currentCount === 0) {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'Personal AI' });
      } else {
        await chrome.action.setBadgeText({
          text: BadgeNotificationChannel.currentCount.toString()
        });
        
        const tooltip = BadgeNotificationChannel.prototype.generateTooltip();
        await chrome.action.setTitle({ title: tooltip });
      }
    }
  }

  /**
   * 清除所有badge计数
   */
  static async clearAll(): Promise<void> {
    BadgeNotificationChannel.currentCount = 0;
    BadgeNotificationChannel.urgentCount = 0;
    
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Personal AI' });
  }

  /**
   * 获取当前计数
   */
  static getCurrentCounts(): { total: number; urgent: number } {
    return {
      total: BadgeNotificationChannel.currentCount,
      urgent: BadgeNotificationChannel.urgentCount
    };
  }

  private getBadgeColor(priority: string): string {
    // 如果有紧急通知，总是显示红色
    if (BadgeNotificationChannel.urgentCount > 0) {
      return '#FF4444'; // 红色
    }
    
    // 否则根据当前通知的优先级
    const colorMap = {
      'urgent': '#FF4444',    // 红色
      'important': '#FF8800', // 橙色
      'info': '#4488FF'       // 蓝色
    };
    return colorMap[priority] || '#4488FF';
  }

  private generateTooltip(): string {
    const total = BadgeNotificationChannel.currentCount;
    const urgent = BadgeNotificationChannel.urgentCount;
    
    if (total === 0) {
      return 'Personal AI';
    } else if (urgent > 0) {
      return `Personal AI - ${total} 条通知 (${urgent} 条紧急)`;
    } else {
      return `Personal AI - ${total} 条通知`;
    }
  }
}

/**
 * Popup主动弹出通知渠道
 */
export class PopupNotificationChannel extends NotificationChannel {
  getName(): string {
    return 'popup';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      // 检查是否已经有popup打开
      const existingPopup = await this.checkExistingPopup();
      
      if (existingPopup) {
        // 如果已有popup，通过消息传递更新内容
        await chrome.runtime.sendMessage({
          type: 'UPDATE_POPUP_NOTIFICATION',
          data: message
        });
      } else {
        // 打开新的popup
        await chrome.action.openPopup();
        
        // 等待一下确保popup加载
        await this.delay(200);
        
        // 发送通知数据到popup
        await chrome.runtime.sendMessage({
          type: 'SHOW_POPUP_NOTIFICATION',
          data: message
        });
      }

      console.log('✅ Popup notification sent');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Popup notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  private async checkExistingPopup(): Promise<boolean> {
    try {
      // 尝试向popup发送ping消息
      const response = await chrome.runtime.sendMessage({ type: 'PING_POPUP' });
      return response?.pong === true;
    } catch (error) {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 桌面Toast通知渠道
 */
export class ToastNotificationChannel extends NotificationChannel {
  getName(): string {
    return 'toast';
  }

  async send(message: FormattedMessage): Promise<NotificationResult> {
    try {
      // 创建一个短暂的Chrome通知作为Toast
      const notificationOptions: chrome.notifications.NotificationOptions = {
        type: 'basic',
        iconUrl: 'icons/icon32.png',
        title: message.title,
        message: message.body,
        priority: 0, // 低优先级，不打断用户
        silent: true, // 静音
        requireInteraction: false
      };

      const notificationId = await chrome.notifications.create(notificationOptions);
      
      // 短时间后自动清除（模拟Toast效果）
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 4000); // 4秒后消失

      console.log(`✅ Toast notification created: ${notificationId}`);
      return { success: true, notificationId };
      
    } catch (error) {
      console.error('❌ Toast notification failed:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * 通知渠道工厂
 */
export class NotificationChannelFactory {
  private static channels: Map<string, NotificationChannel> = new Map();

  static initialize(): void {
    // 初始化所有渠道
    NotificationChannelFactory.channels.set('bot', new BotNotificationChannel());
    NotificationChannelFactory.channels.set('chrome', new ChromeNotificationChannel());
    NotificationChannelFactory.channels.set('web_overlay', new WebOverlayChannel());
    NotificationChannelFactory.channels.set('badge', new BadgeNotificationChannel());
    NotificationChannelFactory.channels.set('popup', new PopupNotificationChannel());
    NotificationChannelFactory.channels.set('toast', new ToastNotificationChannel());

    // 初始化Chrome通知监听器
    ChromeNotificationChannel.initializeListeners();

    console.log('🔔 Notification channels initialized');
  }

  static getChannel(name: string): NotificationChannel | undefined {
    return NotificationChannelFactory.channels.get(name);
  }

  static getAllChannels(): Map<string, NotificationChannel> {
    return NotificationChannelFactory.channels;
  }

  static getChannelNames(): string[] {
    return Array.from(NotificationChannelFactory.channels.keys());
  }
}

/**
 * 网页浮层内容脚本部分
 * 这部分代码需要注入到网页中
 */
export const WEB_OVERLAY_CONTENT_SCRIPT = `
// 网页浮层通知组件
class WebOverlayNotification {
  constructor() {
    this.overlays = new Map();
    this.setupMessageListener();
    this.injectStyles();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SHOW_WEB_OVERLAY') {
        this.showOverlay(message.data);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  showOverlay(data) {
    // 移除现有的同类型覆盖层
    if (this.overlays.has(data.priority)) {
      this.overlays.get(data.priority).remove();
    }

    const overlay = this.createOverlayElement(data);
    document.body.appendChild(overlay);
    
    this.overlays.set(data.priority, overlay);

    // 自动隐藏
    if (data.autoHide && data.hideDelay > 0) {
      setTimeout(() => {
        this.hideOverlay(overlay, data.priority);
      }, data.hideDelay);
    }

    // 添加动画
    requestAnimationFrame(() => {
      overlay.classList.add('brain-overlay-show');
    });
  }

  createOverlayElement(data) {
    const overlay = document.createElement('div');
    overlay.className = 'brain-system-overlay brain-overlay-' + data.priority;
    overlay.setAttribute('data-priority', data.priority);
    
    const priorityIcon = this.getPriorityIcon(data.priority);
    const actionsHtml = this.generateActionsHtml(data.actions || []);
    
    overlay.innerHTML = \`
      <div class="brain-overlay-content">
        <div class="brain-overlay-header">
          <span class="brain-overlay-icon">\${priorityIcon}</span>
          <span class="brain-overlay-title">\${this.escapeHtml(data.title)}</span>
          <button class="brain-overlay-close" data-action="close">×</button>
        </div>
        <div class="brain-overlay-body">
          <div class="brain-overlay-message">\${this.escapeHtml(data.body)}</div>
          \${actionsHtml}
        </div>
      </div>
    \`;

    // 添加事件监听器
    overlay.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.getAttribute('data-action');
      
      if (action === 'close') {
        this.hideOverlay(overlay, data.priority);
      } else if (action) {
        this.handleAction(action, data);
        this.hideOverlay(overlay, data.priority);
      }
    });

    return overlay;
  }

  generateActionsHtml(actions) {
    if (actions.length === 0) return '';
    
    const actionsHtml = actions.map(action => 
      \`<button class="brain-overlay-action" data-action="\${action.action}">\${this.escapeHtml(action.label)}</button>\`
    ).join('');
    
    return \`<div class="brain-overlay-actions">\${actionsHtml}</div>\`;
  }

  getPriorityIcon(priority) {
    const icons = {
      urgent: '🚨',
      important: '⚠️',
      info: 'ℹ️'
    };
    return icons[priority] || 'ℹ️';
  }

  hideOverlay(overlay, priority) {
    overlay.classList.add('brain-overlay-hide');
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      this.overlays.delete(priority);
    }, 300);
  }

  handleAction(action, data) {
    // 发送消息到background script处理
    chrome.runtime.sendMessage({
      type: 'EXECUTE_OVERLAY_ACTION',
      action: action,
      data: data
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  injectStyles() {
    if (document.getElementById('brain-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'brain-overlay-styles';
    style.textContent = \`
      .brain-system-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        max-width: 400px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        border: 1px solid #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        overflow: hidden;
      }

      .brain-system-overlay.brain-overlay-show {
        transform: translateX(0);
        opacity: 1;
      }

      .brain-system-overlay.brain-overlay-hide {
        transform: translateX(100%);
        opacity: 0;
      }

      .brain-overlay-urgent {
        border-left: 4px solid #ff4444;
      }

      .brain-overlay-important {
        border-left: 4px solid #ff8800;
      }

      .brain-overlay-info {
        border-left: 4px solid #4488ff;
      }

      .brain-overlay-content {
        padding: 0;
      }

      .brain-overlay-header {
        display: flex;
        align-items: center;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .brain-overlay-icon {
        font-size: 20px;
        margin-right: 8px;
      }

      .brain-overlay-title {
        flex: 1;
        font-weight: 600;
        font-size: 16px;
      }

      .brain-overlay-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .brain-overlay-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      .brain-overlay-body {
        padding: 16px;
      }

      .brain-overlay-message {
        margin-bottom: 16px;
        line-height: 1.5;
        color: #333;
      }

      .brain-overlay-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .brain-overlay-action {
        padding: 8px 16px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        color: #333;
      }

      .brain-overlay-action:hover {
        background: #f5f5f5;
        border-color: #bbb;
        transform: translateY(-1px);
      }

      .brain-overlay-action:active {
        transform: translateY(0);
      }
    \`;

    document.head.appendChild(style);
  }
}

// 初始化覆盖层通知
if (typeof window !== 'undefined' && !window.brainOverlayNotification) {
  window.brainOverlayNotification = new WebOverlayNotification();
}
`;

export default {
  BotNotificationChannel,
  ChromeNotificationChannel,
  WebOverlayChannel,
  BadgeNotificationChannel,
  PopupNotificationChannel,
  ToastNotificationChannel,
  NotificationChannelFactory,
  WEB_OVERLAY_CONTENT_SCRIPT
};