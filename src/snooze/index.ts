/**
 * Snooze 模块入口
 * 
 * 提供消息稍后处理功能：
 * - 在消息上悬停 2 秒显示操作按钮
 * - 快速选择或自定义提醒时间
 * - 通过 Bot 私聊提醒
 */

export { initSnooze } from './SnoozeUI';
export type { MessageInfo, SnoozeConfig, QuickOption } from './SnoozeManager';
export { 
  extractMessageInfo,
  getQuickOptions,
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast
} from './SnoozeManager';

