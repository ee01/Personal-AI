/**
 * NotificationService - 统一通知推送服务
 * 
 * 功能：
 * 1. 统一管理所有通知推送（Bot/Chrome）
 * 2. 支持多种通知方式组合（notifyMethod = 'bot,chrome'）
 * 3. 集成 LLM_REVIEW_BEFORE_SEND 审核逻辑
 * 4. 替代原有的 sendBotMessage 和分散的通知逻辑
 */

import { getEnvConfig } from '../utils';
import { handleLLMRequest } from '../llm';
import { CAPABILITIES } from '../analytics/capabilities';
import { TopicItemWithAutoReply } from '../message-reaction/AutoReplyHandler';
import { buildLLMReviewPrompt } from '../prompts';
import { sendPlainBotMessage } from '../bot';
import { buildScheduledMessagesReviewUrl } from '../scheduled-messages/scheduledMessagesFilters';
import {
  formatMatchedRuleForDisplay,
  mergeMatchedRuleDisplay,
} from '../utils/matchedRuleDisplay';

// ==================== 类型定义 ====================

/**
 * 通知方法类型
 * 使用逗号分隔的字符串格式，如 'bot,chrome'
 */
export type NotifyMethod = string;

/**
 * 解析后的通知方法数组
 */
export type NotifyMethodArray = ('bot' | 'chrome')[];

/**
 * 原始消息信息（用于关注后续功能）
 */
export interface OriginalMessageInfo {
  sender: string;
  content: string;
  datetime: string | number;
  messageUrl: string;
}

/**
 * 自动答复信息
 */
export interface AutoReplyInfo {
  hasAutoReply: boolean;
  replyContent?: string;
  scheduleTime?: string;
  messageId?: string;
}

/**
 * 通知数据接口
 */
export interface NotificationData {
  // 基础信息
  teamId: string;
  teamName: string;
  sender: string;
  messageContent: string;
  summary: string;
  datetime: string;
  postId?: string;
  
  // 匹配规则信息
  matchedRule?: string;
  replyAdvice?: string;
  
  // 提及控制
  mention?: boolean;

  // 推送场景，用于选择独立的 Bot 目标
  pushScenario?: import('../utils').BotPushScenario;
  
  // 自动答复信息
  autoReplyInfo?: AutoReplyInfo;
  
  // 关注后续原消息信息
  originalMessageInfo?: OriginalMessageInfo;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  notifyMethod: NotifyMethod;  // 如 'bot,chrome' 或 'bot' 或 'chrome'
}

/**
 * LLM 审核配置
 */
export interface LLMReviewConfig {
  enabled: boolean;
  userName: string;
  concernedItems: TopicItemWithAutoReply[];
}

/**
 * 通知结果
 */
export interface NotificationResult {
  success: boolean;
  results: {
    method: 'bot' | 'chrome';
    success: boolean;
    error?: string;
  }[];
  reviewPassed?: boolean;
  reviewReason?: string;
}

export function buildBotNotificationMessage(data: NotificationData): string {
  const messageLink = data.teamId
    ? data.postId
      ? `https://app.ringcentral.com/messages/${data.teamId}/${data.postId}`
      : `https://app.ringcentral.com/messages/${data.teamId}`
    : '';

  let originalMessageSection = '';
  if (data.originalMessageInfo) {
    originalMessageSection = `__原消息__（来自 ${data.originalMessageInfo.sender}）：
> ${data.originalMessageInfo.content.substring(0, 150)}${data.originalMessageInfo.content.length > 150 ? '...' : ''}
🔗 [查看原消息](${data.originalMessageInfo.messageUrl})

__后续回复__：
`;
  }

  let replySection: string;
  if (data.autoReplyInfo?.hasAutoReply) {
    const scheduledMessagesUrl = buildScheduledMessagesReviewUrl(
      data.autoReplyInfo.messageId,
    );
    replySection = `__自动答复__：✅ 已配置自动答复，将于 ${data.autoReplyInfo.scheduleTime} 自动发送 [🔗点击审核或取消](${scheduledMessagesUrl})
> ${data.autoReplyInfo.replyContent?.substring(0, 100)}${(data.autoReplyInfo.replyContent?.length || 0) > 100 ? '...' : ''}`;
  } else if (data.replyAdvice) {
    replySection = `__回复建议__：${data.replyAdvice}`;
  } else {
    replySection = '';
  }

  const groupSection =
    data.teamId && data.teamName
      ? `__在群__：<a class='at_mention_compose' rel='{"id":${data.teamId}}'>@${data.teamName}</a>
`
      : data.teamName
      ? `__来源__：${data.teamName}
`
      : '';
  const messageLabel = messageLink ? '__原文__' : '__内容__';
  const linkSection = messageLink ? `🔗 [点击查看原消息](${messageLink})` : '';

  return `\`${data.summary}\`
${originalMessageSection}__关注项__：${formatMatchedRuleForDisplay(data.matchedRule)}
${groupSection}__发送者__：${data.sender}
__时间__：${data.datetime}
${messageLabel}：${data.messageContent}
${replySection}
${linkSection}
*以上是 Personal AI 监测到您可能关注的消息* (AI可能幻觉 仅供参考)
`;
}

// ==================== 工具函数 ====================

/**
 * 解析通知方法字符串为数组
 * @param methods 通知方法字符串，如 'bot,chrome'
 * @returns 解析后的数组
 */
export function parseNotifyMethod(methods: NotifyMethod | undefined): NotifyMethodArray {
  if (!methods) return [];
  
  const parsed = methods.split(',')
    .map(m => m.trim().toLowerCase())
    .filter((m): m is 'bot' | 'chrome' => m === 'bot' || m === 'chrome');
  
  return parsed;
}

/**
 * 检查是否包含特定通知方法
 */
export function hasNotifyMethod(methods: NotifyMethod | undefined, method: 'bot' | 'chrome'): boolean {
  const parsed = parseNotifyMethod(methods);
  return parsed.includes(method);
}

/**
 * 从旧的 pushToGlip 迁移到新的 notifyMethod
 * @param pushToGlip 旧的 pushToGlip 值
 * @returns 新的 notifyMethod 值
 */
export function migrateFromPushToGlip(pushToGlip?: boolean): NotifyMethod {
  return pushToGlip ? 'bot' : '';
}

/**
 * 合并多个通知方法
 */
export function mergeNotifyMethods(...methods: (NotifyMethod | undefined)[]): NotifyMethod {
  const allMethods = new Set<string>();
  methods.forEach(m => {
    if (m) {
      parseNotifyMethod(m).forEach(method => allMethods.add(method));
    }
  });
  return Array.from(allMethods).join(',');
}

// ==================== NotificationService 类 ====================

export class NotificationService {
  private static instance: NotificationService;
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
  
  /**
   * 发送通知（统一入口）
   * 
   * @param data 通知数据
   * @param config 通知配置
   * @param reviewConfig LLM 审核配置（可选）
   */
  public async sendNotification(
    data: NotificationData,
    config: NotificationConfig,
    reviewConfig?: LLMReviewConfig
  ): Promise<NotificationResult> {
    const methods = parseNotifyMethod(config.notifyMethod);
    const results: NotificationResult['results'] = [];
    
    // 如果没有配置任何通知方式，直接返回
    if (methods.length === 0) {
      console.log('📭 未配置通知方式，跳过推送');
      return { success: true, results: [] };
    }
    
    // 如果启用了 LLM 审核且需要发送 bot 通知
    let reviewPassed = true;
    let reviewReason: string | undefined;
    
    if (reviewConfig?.enabled && methods.includes('bot')) {
      const envConfig = await getEnvConfig();
      if (envConfig.LLM_REVIEW_BEFORE_SEND) {
        const review = await this.performLLMReview(data, reviewConfig);
        reviewPassed = review.passed;
        reviewReason = review.reason;
        
        if (!reviewPassed) {
          console.log(`🚫 LLM 审核未通过: ${reviewReason}`);
          results.push({
            method: 'bot',
            success: false,
            error: `LLM 审核未通过: ${reviewReason}`
          });
        } else if (reviewReason && reviewReason !== '通过') {
          const mergedRule = mergeMatchedRuleDisplay(
            data.matchedRule,
            reviewReason,
          );
          if (mergedRule) {
            data.matchedRule = mergedRule;
          }
        }
      }
    }
    
    // 并行发送各渠道通知
    const promises: Promise<void>[] = [];
    
    // Bot 通知
    if (methods.includes('bot') && reviewPassed) {
      promises.push(
        this.sendBotNotification(data)
          .then(() => {
            console.log('✅ Bot 通知发送成功');
            results.push({ method: 'bot', success: true });
          })
          .catch(err => {
            console.error('❌ Bot 通知发送失败:', err);
            results.push({ method: 'bot', success: false, error: err.message });
          })
      );
    }
    
    // Chrome 通知
    if (methods.includes('chrome')) {
      promises.push(
        this.sendChromeNotification(data)
          .then(() => {
            console.log('✅ Chrome 通知发送成功');
            results.push({ method: 'chrome', success: true });
          })
          .catch(err => {
            console.error('❌ Chrome 通知发送失败:', err);
            results.push({ method: 'chrome', success: false, error: err.message });
          })
      );
    }
    
    await Promise.all(promises);
    
    return {
      success: results.some(r => r.success),
      results,
      reviewPassed,
      reviewReason
    };
  }
  
  /**
   * 执行 LLM 审核
   */
  private async performLLMReview(
    data: NotificationData,
    reviewConfig: LLMReviewConfig
  ): Promise<{ passed: boolean; reason?: string }> {
    try {
      // 筛选出需要 bot 通知的项目
      const concernedItemsForPush = reviewConfig.concernedItems.filter(
        item => hasNotifyMethod(item.notifyMethod, 'bot')
      );
      
      if (concernedItemsForPush.length === 0) {
        return { passed: false, reason: '没有需要 bot 推送的规则' };
      }
      
      // 使用统一的 prompt 构建函数
      const reviewPrompt = buildLLMReviewPrompt({
        sender: data.sender,
        teamName: data.teamName,
        messageContent: data.messageContent,
        summary: data.summary,
        userName: reviewConfig.userName,
        concernedItems: concernedItemsForPush
      });

      const reviewResult = await handleLLMRequest({
        prompt: reviewPrompt,
        type: 'review',
        capability: CAPABILITIES.NOTIFICATION_CENTER,
        feature: 'llm_review',
      });

      const reviewContent = reviewResult?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
      
      if (reviewContent === '不通过' || reviewContent.includes('不通过')) {
        return { passed: false, reason: '不符合任何规则' };
      }
      
      return { passed: true, reason: reviewContent };
    } catch (error) {
      console.error('LLM 审核失败:', error);
      // 审核失败时默认通过，避免阻塞通知
      return { passed: true, reason: '审核服务异常，默认通过' };
    }
  }
  
  /**
   * 发送 Bot (Glip) 通知
   */
  private async sendBotNotification(data: NotificationData): Promise<void> {
    const formattedMessage = buildBotNotificationMessage(data);

    const shouldMention = data.mention !== false;

    await sendPlainBotMessage({
      message: formattedMessage,
      mention: shouldMention,
      teamName: data.teamName,
      pushScenario: data.pushScenario
    });
  }
  
  /**
   * 发送 Chrome 浏览器通知
   */
  private async sendChromeNotification(data: NotificationData): Promise<void> {
    // 构建消息链接
    const messageLink = data.postId && data.teamId 
      ? `https://app.ringcentral.com/messages/${data.teamId}/${data.postId}`
      : `https://app.ringcentral.com/messages/${data.teamId}`;
    
    // 构建通知标题
    let title: string;
    if (data.originalMessageInfo) {
      title = `📌 关注后续：${data.sender} 回复了`;
    } else {
      title = `${data.sender} 在 ${data.teamName}`;
    }
    
    // 构建通知内容（Chrome 通知有长度限制，只展示 summary）
    const message = data.summary.substring(0, 200);
    
    // 创建唯一的通知 ID
    const notificationId = `msg_${data.postId || Date.now()}`;
    
    // 存储跳转链接以便点击时使用
    await chrome.storage.local.set({
      [`notification_link_${notificationId}`]: messageLink
    });
    
    // 创建通知
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: title,
      message: message,
      buttons: [
        { title: '查看消息' }
      ],
      requireInteraction: true,
      priority: 2
    });
  }
  
  /**
   * 处理 Chrome 通知点击事件
   * 在 background.ts 中调用
   */
  public static async handleNotificationClick(notificationId: string): Promise<void> {
    const result = await chrome.storage.local.get(`notification_link_${notificationId}`);
    const link = result[`notification_link_${notificationId}`];
    
    if (link) {
      await chrome.tabs.create({ url: link });
      await chrome.storage.local.remove(`notification_link_${notificationId}`);
    }
    
    await chrome.notifications.clear(notificationId);
  }
  
  /**
   * 处理 Chrome 通知按钮点击事件
   * 在 background.ts 中调用
   */
  public static async handleNotificationButtonClick(
    notificationId: string, 
    buttonIndex: number
  ): Promise<void> {
    if (buttonIndex === 0) {
      // 点击"查看消息"按钮
      await NotificationService.handleNotificationClick(notificationId);
    }
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance();
