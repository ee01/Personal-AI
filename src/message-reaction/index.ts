/**
 * 消息交互模块 (Message Reaction)
 * 
 * 提供 RingCentral 消息交互功能：
 * - 稍后处理 (Snooze)：悬停消息显示工具栏，设置提醒时间
 * - 关注后续 (Follow Thread)：围绕当前消息追踪后续讨论
 * - 自动答复 (Auto Reply)：配置自动答复规则，自动生成回复
 * - 联动操作 (Linked Action)：从消息创建带关联操作的记忆入口规则
 */

// 消息交互功能（稍后处理 + 关注后续 + 自动答复 + 联动操作）
export { initMessageReaction } from './MessageReactionUI';
export type { MessageReactionConfig } from './MessageReactionUI';
export type {
  MessageInfo,
  SnoozeConfig,
  QuickOption,
} from './SnoozeManager';
export type {
  SnoozeReminderResult,
  SnoozeCreateFailureReason,
} from './snoozeCreateResult';
export { 
  extractMessageInfo,
  getQuickOptions,
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast
} from './SnoozeManager';
export { getSnoozeCreateFailureMessage } from './snoozeCreateResult';

// Auto Reply 自动答复功能
export type { 
  AutoReplyConfig, 
  TopicItemWithAutoReply, 
  AutoReplyContext 
} from './AutoReplyHandler';
export { 
  handleAutoReplyRules,
  formatAutoReplyTime
} from './AutoReplyHandler';
