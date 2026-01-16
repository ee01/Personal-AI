/**
 * 消息交互模块 (Message Reaction)
 * 
 * 提供 RingCentral 消息交互功能：
 * - 稍后处理 (Snooze)：悬停消息显示工具栏，设置提醒时间
 * - 自动答复 (Auto Reply)：配置自动答复规则，自动生成回复
 */

// 消息交互功能（稍后处理 + 自动答复）
export { initMessageReaction } from './MessageReactionUI';
export type { MessageReactionConfig } from './MessageReactionUI';
export type { MessageInfo, SnoozeConfig, QuickOption } from './SnoozeManager';
export { 
  extractMessageInfo,
  getQuickOptions,
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast
} from './SnoozeManager';

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

