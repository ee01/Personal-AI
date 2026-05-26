/**
 * Auto Reply Handler - 自动答复处理逻辑
 *
 * 功能：
 * 1. 处理自动答复规则匹配
 * 2. 生成自动答复内容（固定文本或 AI 生成）
 * 3. 创建自动答复定时消息
 *
 * 此模块属于消息交互功能 (Message Reaction) 的一部分
 */

import { generateAutoReply } from '../llm';
import { getGoogleAuthTokenSilently } from '../utils/googleAuth';
import { ScheduledMessageService } from '../scheduled-messages/ScheduledMessageService';
import { isScheduledMessagesInitialized } from '../scheduled-messages/ScheduledMessagesUtils';
import { formatLocalScheduleDateTime } from '../scheduled-messages/scheduleDateTime';
import type { DigestConfig } from '../types/digestQueue';
import {
  buildManualWatchRules,
  getManualItemsFromMatchedRules,
  resolveMatchedWatchRules,
} from '../watchRules';
import {
  buildAutoReplyTopic,
  normalizeAutoReplyDelayHours,
} from './autoReplyPresentation';

// 自动答复配置接口（与 topic-modal.tsx 中定义保持一致）
export interface AutoReplyConfig {
  enabled: boolean;
  replyContent: string;
  useAIGenerate: boolean;
  reviewMode: 'immediate' | 'delayed' | 'manual'; // immediate: 直接发送, delayed: 延迟可拦截, manual: 审核
  delayHours?: number;
}

export interface TopicItemWithAutoReply {
  id: string;
  text: string;
  expiredAt: number;
  /** @deprecated 使用 notifyMethod 替代 */
  pushToGlip?: boolean;
  mentionMe?: boolean;
  // 通用匹配条件
  filterSender?: string;
  filterGroup?: string;
  // 🆕 通用通知配置（适用于所有类型）
  // notifyMethod 使用逗号分隔格式，如 'bot,chrome'
  notifyMethod?: string;
  notifyFrequency?: 'immediate' | 'merged';
  // 🆕 每日/每周摘要配置
  digestConfig?: DigestConfig;
  // 自动答复相关
  autoReply?: boolean;
  autoReplyConfig?: AutoReplyConfig;
  // 关注后续相关
  followThread?: boolean;
  followConfig?: {
    originalMessage: {
      postId: string;
      threadId?: string;
      teamId: string;
      teamName: string;
      sender: string;
      content: string;
      datetime: string | number;
      messageUrl: string;
    };
    createdAt: string;
    // 🆕 移除 duration、expiresAt、notifyMethod、notifyFrequency，使用外层字段
    keywordFilter?: string[];
    relatedMessages: any[];
    lastCheckedAt?: string;
    lastNotifiedAt?: string;
  };
  // 自动化动作审批配置
  automationPrompt?: string;
  automationRequiresApproval?: boolean;
}

// 自动答复上下文接口
export interface AutoReplyContext {
  matchedRule: string;
  matchedRuleRefs?: string[];
  matchedRuleIds?: number[]; // 规则 ID 数组，用于精确匹配
  messageContext: {
    sender: string;
    groupId: string;
    groupName: string;
    messageContent: string;
    summary?: string;
    datetime: string;
    postId?: string;
  };
}

export function getMatchedAutoReplyItem(
  context: AutoReplyContext,
  concernedItems: TopicItemWithAutoReply[],
): TopicItemWithAutoReply | undefined {
  const allMatchedItems = getManualItemsFromMatchedRules(
    resolveMatchedWatchRules({
      watchRules: buildManualWatchRules(concernedItems),
      matchedRule: context.matchedRule,
      matchedRuleRefs: context.matchedRuleRefs,
      matchedRuleIds: context.matchedRuleIds,
      messageContext: {
        sender: context.messageContext.sender,
        groupId: context.messageContext.groupId,
        groupName: context.messageContext.groupName,
      },
    }).watchRules,
  );

  return allMatchedItems.find(
    (item) => item.autoReply && item.autoReplyConfig?.enabled,
  );
}

/**
 * 统一的自动答复规则处理函数
 * 同时支持 agentThinking 模式和 filter 模式
 */
export async function handleAutoReplyRules(
  context: AutoReplyContext,
  concernedItems: TopicItemWithAutoReply[],
): Promise<{
  handled: boolean;
  replyInfo?: {
    content: string;
    scheduleTime: Date;
    status: string;
    messageId?: string;
  };
}> {
  try {
    const matchedItem = getMatchedAutoReplyItem(context, concernedItems);
    if (!matchedItem || !matchedItem.autoReplyConfig) {
      return { handled: false };
    }

    const initialized = await isScheduledMessagesInitialized();
    if (!initialized) {
      console.log('🤖 自动答复: 定时消息未初始化，跳过自动答复处理');
      // 注意：在后台任务中不显示对话框，只记录日志并跳过
      return { handled: false };
    }

    const config = matchedItem.autoReplyConfig;
    const msgContext = context.messageContext;

    console.log('🤖 检测到自动答复规则匹配:', {
      rule: matchedItem.text,
      sender: msgContext.sender,
      groupName: msgContext.groupName,
      filterSender: matchedItem.filterSender,
      filterGroup: matchedItem.filterGroup,
      config,
    });

    // 1. 检查是否已经对这条消息创建过自动答复
    if (msgContext.postId) {
      const existingReplies = await checkExistingAutoReply(msgContext.postId);
      if (existingReplies) {
        console.log('🤖 已存在对此消息的自动答复，跳过');
        return { handled: false };
      }
    }

    // 2. 生成答复内容
    let replyContent = config.replyContent;
    if (config.useAIGenerate) {
      console.log('🤖 使用 AI 生成答复内容...');
      try {
        replyContent = await generateAutoReply({
          messageContent: msgContext.messageContent,
          sender: msgContext.sender,
          groupName: msgContext.groupName,
          summary: msgContext.summary,
          replyTemplate: config.replyContent,
        });
        console.log('🤖 AI 生成的答复:', replyContent);
      } catch (error) {
        console.error('🤖 AI 生成回复失败，使用固定模板:', error);
        if (!replyContent) {
          replyContent = '嗯。好';
        }
      }
    }

    // 3. 创建定时消息并获取调度信息
    const scheduleInfo = await createAutoReplyScheduledMessage({
      matchedItem,
      msgContext,
      replyContent,
      config,
    });

    console.log('🤖 自动答复消息已创建');

    return {
      handled: true,
      replyInfo: {
        content: replyContent,
        scheduleTime: scheduleInfo.scheduleTime,
        status: scheduleInfo.status,
        messageId: scheduleInfo.messageId,
      },
    };
  } catch (error) {
    console.error('🤖 处理自动答复规则失败:', error);
    return { handled: false };
  }
}

/**
 * 检查是否已存在对某条消息的自动答复
 */
async function checkExistingAutoReply(postId: string): Promise<boolean> {
  try {
    const { autoReplyHistory } =
      await chrome.storage.local.get('autoReplyHistory');
    if (autoReplyHistory && Array.isArray(autoReplyHistory)) {
      return autoReplyHistory.includes(postId);
    }
    return false;
  } catch (error) {
    console.warn('检查自动答复历史失败:', error);
    return false;
  }
}

/**
 * 记录自动答复历史
 */
async function recordAutoReplyHistory(postId: string): Promise<void> {
  try {
    const { autoReplyHistory = [] } =
      await chrome.storage.local.get('autoReplyHistory');
    // 保留最近 1000 条记录，避免存储过大
    const newHistory = [...autoReplyHistory, postId].slice(-1000);
    await chrome.storage.local.set({ autoReplyHistory: newHistory });
  } catch (error) {
    console.warn('记录自动答复历史失败:', error);
  }
}

/**
 * 创建自动答复的定时消息
 */
async function createAutoReplyScheduledMessage(params: {
  matchedItem: TopicItemWithAutoReply;
  msgContext: AutoReplyContext['messageContext'];
  replyContent: string;
  config: AutoReplyConfig;
}): Promise<{ scheduleTime: Date; status: string; messageId?: string }> {
  const { matchedItem, msgContext, replyContent, config } = params;

  try {
    // 🔧 关键修复：再次检查定时消息是否已初始化
    // 这是第二道防线，防止在 handleAutoReplyRules 检查后、创建消息前，配置被清空
    const initialized = await isScheduledMessagesInitialized();
    if (!initialized) {
      console.warn('⚠️ 定时消息未初始化，无法创建自动答复消息');
      throw new Error('定时消息未初始化');
    }

    // 🔧 优先使用静默方法，避免在后台任务中弹出授权窗口
    const token = await getGoogleAuthTokenSilently({
      caller: 'AutoReplyHandler.createMessage',
    });
    if (!token) {
      console.warn(
        '⚠️ 无缓存的 Google 认证 token，跳过创建自动答复消息（避免弹出授权窗口）',
      );
      // 🔥 关键修复：在后台任务中，如果没有缓存 token，直接抛出错误，不要尝试交互式获取
      throw new Error('无缓存的 Google 认证 token');
    }

    const service = new ScheduledMessageService(token);

    // 根据 reviewMode 计算执行时间和状态
    const now = new Date();
    let scheduleTime: Date;
    let status: 'Active' | 'PendingReview';

    switch (config.reviewMode) {
      case 'immediate': {
        scheduleTime = new Date(now.getTime() + 60 * 1000);
        status = 'Active';
        break;
      }
      case 'delayed': {
        const delayMs =
          normalizeAutoReplyDelayHours(config.delayHours) * 60 * 60 * 1000;
        scheduleTime = new Date(now.getTime() + delayMs);
        status = 'Active';
        break;
      }
      case 'manual':
      default: {
        scheduleTime = new Date(now.getTime() + 60 * 1000);
        status = 'PendingReview';
        break;
      }
    }

    // 格式化日期和时间
    const { dateStr: scheduleDate, timeStr: scheduleTimeStr } =
      formatLocalScheduleDateTime(scheduleTime);

    // 创建消息
    const createResult = await service.createMessage({
      Topic: buildAutoReplyTopic(msgContext),
      Content: replyContent,
      Schedule_Date: scheduleDate,
      Schedule_Time: scheduleTimeStr,
      Push_Method: 'AsMe',
      Target_Type: msgContext.groupId ? 'group' : 'private',
      Glip_Team_ID: msgContext.groupId || undefined,
      Category: '自动答复',
    });

    // 如果创建成功，更新状态
    if (createResult && status === 'PendingReview') {
      await service.updateMessage(createResult.ID, { Status: 'PendingReview' });
    }

    // 记录自动答复历史
    if (msgContext.postId) {
      await recordAutoReplyHistory(msgContext.postId);
    }

    console.log('✅ 自动答复消息创建成功:', {
      topic: matchedItem.text,
      scheduleTime: `${scheduleDate} ${scheduleTimeStr}`,
      status,
      messageId: createResult?.ID,
      replyContent: replyContent.substring(0, 50) + '...',
    });

    return {
      scheduleTime,
      status,
      messageId: createResult?.ID, // 返回创建的消息 ID
    };
  } catch (error) {
    console.error('❌ 创建自动答复消息失败:', error);
    throw error;
  }
}

/**
 * 格式化自动答复时间显示
 */
export function formatAutoReplyTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffMins < 60) {
    return `${diffMins} 分钟后 (${timeStr})`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时后 (${timeStr})`;
  } else {
    const dateStr = date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
    return `${dateStr} ${timeStr}`;
  }
}
