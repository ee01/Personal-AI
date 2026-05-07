/**
 * Message Reaction UI - 消息交互工具栏界面
 *
 * UI 结构：
 * - 短暂停留后显示工具栏（功能按钮 + PAI icon）
 * - 点击"稍后处理"按钮默认触发 1 小时后提醒
 * - hover "稍后处理"按钮时显示 Snooze 快速选项菜单
 * - 点击"自动答复"按钮打开自动答复配置
 * - 根据配置开关决定显示哪些按钮
 *
 * 此模块是消息交互功能 (Message Reaction) 的 UI 层实现
 */

// =====================================================
// Personal AI Message Toolbar (PAI Toolbar) 组件命名定义
// =====================================================
//
// 工具栏名称: Personal AI Message Toolbar (PAI Toolbar)
// 主要 CSS 类名:
//   - .message-reaction-toolbar     : 工具栏容器 (PAI Toolbar Container)
//   - .snooze-icon-btn              : "稍后处理" 按钮 (Snooze Button)
//   - .auto-reply-btn               : "自动答复" 按钮 (Auto Reply Button)
//   - .snooze-icon                  : Personal AI 图标 (PAI Icon)
//   - .reaction-settings-btn        : 设置按钮 (Settings Button)
//
// 位置行为:
//   - 默认对齐到消息卡片右下角 (bottom: 8px)
//   - 当存在 reply input (.conversation-reply-inline-input) 时，
//     自动调整到消息文本区域的底部 (.align-to-text)
// =====================================================

import {
  MessageInfo,
  extractMessageInfo,
  getQuickOptions,
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast,
} from './SnoozeManager';
import {
  LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  getMessageReactionActionDefinitions,
} from './messageReactionLayout';
import {
  MESSAGE_REACTION_SETTINGS_DELAY_MS,
  MESSAGE_REACTION_SHOW_DELAY_MS,
} from './messageReactionTiming';
import { computeFloatingPosition } from './floatingPosition';
import { getSnoozeCreateFailureMessage } from './snoozeCreateResult';
import { getToolbarRuntimeActionError } from './toolbarActionResult';
import {
  SNOOZE_CUSTOM_OPTION_LABEL,
  SNOOZE_MANAGE_OPTION_LABEL,
  buildSnoozeQuickMenuOptions,
  escapeSnoozeMenuText,
} from './snoozeQuickMenuPresentation';

// 功能开关配置接口
export interface MessageReactionConfig {
  enableSnooze: boolean;
  enableFollowThread: boolean;
  enableAutoReply: boolean;
  enableLinkedAction: boolean;
}

// 全局功能开关配置（仅用于初始化判断，实际显示时会实时获取）
let globalConfig: MessageReactionConfig = {
  enableSnooze: true,
  enableFollowThread: true,
  enableAutoReply: true,
  enableLinkedAction: true,
};

/**
 * 实时获取消息交互功能配置
 */
async function getRealtimeConfig(): Promise<MessageReactionConfig> {
  try {
    const result = await chrome.storage.local.get(['envConfig']);
    const config = result.envConfig || {};
    return {
      enableSnooze: config.ENABLE_SNOOZE !== false,
      enableFollowThread: config.ENABLE_FOLLOW_THREAD !== false,
      enableAutoReply: config.ENABLE_AUTO_REPLY !== false,
      enableLinkedAction: config.ENABLE_LINKED_ACTION !== false,
    };
  } catch (error) {
    console.log('获取消息交互配置失败，使用默认值');
    return {
      enableSnooze: true,
      enableFollowThread: true,
      enableAutoReply: true,
      enableLinkedAction: true,
    };
  }
}

/**
 * 保存消息交互功能配置
 */
async function saveReactionConfig(
  config: MessageReactionConfig,
): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['envConfig']);
    const envConfig = result.envConfig || {};
    envConfig.ENABLE_SNOOZE = config.enableSnooze;
    envConfig.ENABLE_FOLLOW_THREAD = config.enableFollowThread;
    envConfig.ENABLE_AUTO_REPLY = config.enableAutoReply;
    envConfig.ENABLE_LINKED_ACTION = config.enableLinkedAction;
    await chrome.storage.local.set({ envConfig });
    console.log('💬 消息交互配置已保存:', config);
    return true;
  } catch (error) {
    console.error('保存消息交互配置失败:', error);
    return false;
  }
}

// 全局状态
let currentSnoozeMenu: HTMLElement | null = null; // Snooze 快速选项菜单
let currentSnoozePicker: HTMLElement | null = null; // Snooze 时间选择器
const _hoverTimeout: ReturnType<typeof setTimeout> | null = null; // eslint-disable-line
let snoozeHideTimeout: ReturnType<typeof setTimeout> | null = null;
let snoozePickerDismissBindTimeout: ReturnType<typeof setTimeout> | null = null;
let snoozePickerOutsideClickHandler: ((e: MouseEvent) => void) | null = null;
let snoozePickerKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let isHoveringToolbar = false;
let isHoveringSnoozeMenu = false;
let isFocusWithinSnoozeMenu = false;
let isSnoozePickerOpen = false; // 标记时间选择器是否打开
let currentMessageElement: HTMLElement | null = null;
let activeSnoozeMenuAnchor: HTMLElement | null = null;
let snoozeMenuRequestSeq = 0;

// 处理过的消息元素
const processedMessages = new WeakSet<HTMLElement>();

/**
 * 注入样式
 */
function injectStyles() {
  if (document.getElementById('message-reaction-styles')) return;

  const style = document.createElement('style');
  style.id = 'message-reaction-styles';
  style.textContent = `
    /* ===== Personal AI Message Toolbar (PAI Toolbar) 消息交互工具栏容器 ===== */
    .message-reaction-toolbar {
      position: absolute;
      right: 8px;
      bottom: 8px;
      display: flex;
      align-items: center;
      gap: 0;
      opacity: 0;
      transition: opacity 0.2s ease, bottom 0.15s ease;
      z-index: 100000;
      pointer-events: none;
    }
    
    /* 当有 reply input 时，工具栏对齐到消息文本区域 */
    .message-reaction-toolbar.align-to-text {
      /* bottom 值会通过 JS 动态计算设置 */
    }
    
    .message-reaction-toolbar.visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    /* ===== 消息交互按钮通用样式 ===== */
    .message-reaction-action-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 500;
      border-radius: 4px 0 0 4px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    .message-reaction-action-btn:disabled,
    .reaction-settings-btn:disabled {
      cursor: wait;
      opacity: 0.58;
    }

    .message-reaction-action-btn:focus-visible,
    .reaction-settings-btn:focus-visible,
    .snooze-toast-action:focus-visible {
      outline: 2px solid rgba(33, 150, 243, 0.55);
      outline-offset: 2px;
    }

    .message-reaction-action-btn svg {
      flex-shrink: 0;
    }

    /* ===== 稍后处理 Icon 按钮 ===== */
    .snooze-icon-btn {
      width: 28px;
      min-width: 28px;
      height: 28px;
      padding: 0;
      color: #2196F3;
      background: rgba(33, 150, 243, 0.08);
      border: 1px solid rgba(33, 150, 243, 0.2);
    }
    
    .snooze-icon-btn:hover {
      background: rgba(33, 150, 243, 0.15);
      border-color: rgba(33, 150, 243, 0.4);
    }
    
    .snooze-icon-btn:active {
      background: rgba(33, 150, 243, 0.25);
    }
    
    /* ===== 自动答复按钮 ===== */
    .auto-reply-btn {
      color: #d97706;
      background: rgba(217, 119, 6, 0.1);
      border: 1px solid rgba(217, 119, 6, 0.2);
      border-left: none;
    }
    
    .auto-reply-btn:hover {
      background: rgba(217, 119, 6, 0.16);
      border-color: rgba(217, 119, 6, 0.38);
    }
    
    .auto-reply-btn:active {
      background: rgba(217, 119, 6, 0.24);
    }

    /* ===== 关注后续按钮 ===== */
    .follow-thread-btn {
      color: #9c27b0;
      background: rgba(156, 39, 176, 0.08);
      border: 1px solid rgba(156, 39, 176, 0.2);
      border-left: none;
    }

    .follow-thread-btn:hover {
      background: rgba(156, 39, 176, 0.15);
      border-color: rgba(156, 39, 176, 0.4);
    }

    .follow-thread-btn:active {
      background: rgba(156, 39, 176, 0.25);
    }

    /* ===== 联动操作按钮 ===== */
    .linked-action-btn {
      color: #ee5a5a;
      background: rgba(238, 90, 90, 0.08);
      border: 1px solid rgba(238, 90, 90, 0.2);
      border-left: none;
    }

    .linked-action-btn:hover {
      background: rgba(238, 90, 90, 0.15);
      border-color: rgba(238, 90, 90, 0.4);
    }

    .linked-action-btn:active {
      background: rgba(238, 90, 90, 0.25);
    }

    /* ===== Icon 标识 ===== */
    .snooze-icon {
      width: 24px;
      height: 24px;
      border-radius: 0 4px 4px 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(238, 90, 90, 0.3);
      border-left: none;
    }
    
    .snooze-icon img {
      width: 14px;
      height: 14px;
      filter: brightness(0) invert(1);
    }
    
    /* ===== Snooze 快速菜单（紧凑版） ===== */
    .snooze-menu {
      position: fixed;
      z-index: 999999;
      min-width: 150px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 
                  0 1px 4px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #333;
      overflow: visible;
      animation: snooze-menu-in 0.12s ease-out;
      padding: 4px 0;
    }
    
    /* 透明的连接区域，防止鼠标移动时菜单消失 */
    .snooze-menu::before {
      content: '';
      position: absolute;
      top: -10px;
      left: 0;
      right: 0;
      height: 14px;
      background: transparent;
    }

    .snooze-menu.position-above::before {
      top: auto;
      bottom: -10px;
    }

    .snooze-menu.position-below::before {
      top: -10px;
      bottom: auto;
    }
    
    @keyframes snooze-menu-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* ===== 快速选项（精简版） ===== */
    .snooze-quick-option,
    .snooze-custom-option,
    .snooze-manage-option {
      appearance: none;
      width: 100%;
      border: 0;
      background: transparent;
      font: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      cursor: pointer;
      transition: all 0.1s ease;
      white-space: nowrap;
    }
    
    .snooze-quick-option:hover,
    .snooze-quick-option:focus-visible {
      background: #fff5f5;
      color: #ee5a5a;
      outline: none;
    }
    
    .snooze-quick-option:active {
      background: #ffecec;
    }
    
    .snooze-quick-option-icon {
      font-size: 12px;
      width: 16px;
      text-align: center;
    }
    
    .snooze-quick-option-label {
      font-size: 12px;
      color: inherit;
    }

    .snooze-quick-option-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .snooze-quick-option-time {
      font-size: 10px;
      line-height: 1.2;
      color: #888;
    }

    .snooze-quick-option:hover .snooze-quick-option-time {
      color: #c2410c;
    }
    
    /* 分隔线 */
    .snooze-divider {
      height: 1px;
      background: #f0f0f0;
      margin: 4px 8px;
    }
    
    /* 自定义选项 */
    .snooze-custom-option,
    .snooze-manage-option {
      color: #888;
      font-size: 12px;
    }
    
    .snooze-custom-option:hover,
    .snooze-custom-option:focus-visible,
    .snooze-manage-option:hover,
    .snooze-manage-option:focus-visible {
      background: #f8f8f8;
      color: #666;
      outline: none;
    }

    .snooze-manage-option {
      color: #5f6368;
    }
    
    /* ===== 自定义时间选择器 ===== */
    .snooze-picker {
      position: fixed;
      z-index: 9999999;
      width: 280px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: snooze-menu-in 0.15s ease-out;
    }
    
    .snooze-picker-header {
      padding: 12px 14px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .snooze-picker-back {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      opacity: 0.9;
      transition: opacity 0.15s;
      font-size: 12px;
    }
    
    .snooze-picker-back:hover {
      opacity: 1;
    }
    
    .snooze-picker-title {
      font-weight: 600;
      font-size: 13px;
    }
    
    .snooze-picker-body {
      padding: 14px;
    }
    
    .snooze-input-group {
      margin-bottom: 12px;
    }
    
    .snooze-input-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #666;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .snooze-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      color: #333;
      background: #fafafa;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }
    
    .snooze-input:focus {
      outline: none;
      border-color: #ee5a5a;
      background: #fff;
      box-shadow: 0 0 0 2px rgba(238, 90, 90, 0.1);
    }
    
    .snooze-preview {
      padding: 10px;
      background: #f8f8f8;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    
    .snooze-preview-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 2px;
    }
    
    .snooze-preview-time {
      font-size: 14px;
      font-weight: 500;
      color: #ee5a5a;
    }

    .snooze-preview-time.invalid {
      color: #cf1322;
    }
    
    .snooze-picker-footer {
      display: flex;
      gap: 8px;
      padding: 0 14px 14px;
    }
    
    .snooze-btn {
      flex: 1;
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .snooze-btn-cancel {
      background: #f0f0f0;
      color: #666;
    }
    
    .snooze-btn-cancel:hover {
      background: #e5e5e5;
    }
    
    .snooze-btn-confirm {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      color: white;
    }
    
    .snooze-btn-confirm:hover {
      box-shadow: 0 2px 8px rgba(238, 90, 90, 0.4);
    }
    
    .snooze-btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* ===== Toast 提示 ===== */
    .snooze-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 10px 16px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 99999999;
      opacity: 0;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    
    .snooze-toast-success {
      background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      color: white;
    }
    
    .snooze-toast-error {
      background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);
      color: white;
    }
    
    .snooze-toast-icon {
      font-size: 14px;
      font-weight: 600;
    }

    .snooze-toast-action {
      margin-left: 4px;
      padding: 3px 8px;
      border: 1px solid rgba(255, 255, 255, 0.65);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .snooze-toast-action:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    
    /* ===== 设置按钮（x 按钮） ===== */
    .reaction-settings-btn {
      appearance: none;
      padding: 0;
      width: 20px;
      height: 20px;
      border-radius: 4px 0 0 4px;
      background: rgba(102, 102, 102, 0.08);
      border: 1px solid rgba(102, 102, 102, 0.2);
      border-right: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      color: #888;
      transition: all 0.15s ease;
      opacity: 0;
      pointer-events: none;
    }
    
    .reaction-settings-btn.visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    .reaction-settings-btn:hover {
      background: rgba(102, 102, 102, 0.15);
      color: #666;
    }
    
    /* ===== 设置弹出框 ===== */
    .reaction-settings-popup {
      position: fixed;
      z-index: 9999999;
      width: 240px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: snooze-menu-in 0.15s ease-out;
    }
    
    .reaction-settings-header {
      padding: 12px 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      font-size: 13px;
    }
    
    .reaction-settings-body {
      padding: 12px 14px;
    }
    
    .reaction-settings-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      cursor: pointer;
    }
    
    .reaction-settings-option:hover {
      color: #764ba2;
    }
    
    .reaction-settings-checkbox {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .reaction-settings-label {
      font-size: 13px;
      color: #333;
      flex: 1;
    }
    
    .reaction-settings-footer {
      padding: 10px 14px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    
    .reaction-settings-hint {
      font-size: 11px;
      color: #888;
      padding: 0 14px 10px;
    }
  `;

  document.head.appendChild(style);
}

function getSnoozeClockIconSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8"></circle>
      <path d="M12 9v4l2.5 2.5"></path>
      <path d="M9 2h6"></path>
      <path d="M15.5 4.5 17 6"></path>
      <path d="M8.5 4.5 7 6"></path>
    </svg>
  `;
}

function getSettingsIconSvg(): string {
  return `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.07A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3a2 2 0 1 1 0-4h.07A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.07V3a2 2 0 1 1 4 0v.07A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.37 9c.27.61.88 1 1.56 1H21a2 2 0 1 1 0 4h-.07A1.7 1.7 0 0 0 19.4 15Z"></path>
    </svg>
  `;
}

async function openScheduledMessagesManager() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'OPEN_SCHEDULED_MESSAGES',
      data: {
        category: 'Snooze',
      },
    });
    if (!response?.success) {
      throw new Error(response?.error || '打开定时消息管理失败');
    }
  } catch (error) {
    console.warn('打开定时消息管理失败，回退到直接打开页面:', error);
    window.open(
      chrome.runtime.getURL('scheduled-messages.html?category=Snooze'),
      '_blank',
    );
  }
}

function showSnoozeCreatedToast(remindAt: Date, updated = false) {
  const prefix = updated ? '已更新提醒' : '已设置提醒';
  showSuccessToast(`${prefix}：${formatRemindTime(remindAt)}`, {
    label: '管理',
    onClick: openScheduledMessagesManager,
  });
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

function setToolbarButtonPending(button: HTMLElement, pending: boolean) {
  button.dataset.pending = pending ? 'true' : 'false';
  if (button instanceof HTMLButtonElement) {
    button.disabled = pending;
  }
  button.style.pointerEvents = pending ? 'none' : '';
  button.style.opacity = pending ? '0.6' : '';
}

async function runToolbarButtonAction(
  button: HTMLElement,
  action: () => Promise<void>,
) {
  if (button.dataset.pending === 'true') {
    return;
  }

  setToolbarButtonPending(button, true);
  try {
    await action();
  } finally {
    setToolbarButtonPending(button, false);
  }
}

async function sendToolbarRuntimeAction(
  request: unknown,
  fallbackMessage: string,
) {
  const response = await chrome.runtime.sendMessage(request);
  const errorMessage = getToolbarRuntimeActionError(response, fallbackMessage);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

/**
 * 隐藏 Snooze 快速选项菜单
 */
function hideSnoozeMenu() {
  if (currentSnoozeMenu) {
    currentSnoozeMenu.remove();
    currentSnoozeMenu = null;
  }
  isHoveringSnoozeMenu = false;
  isFocusWithinSnoozeMenu = false;
}

function clearSnoozePickerDismissHandlers() {
  if (snoozePickerDismissBindTimeout) {
    clearTimeout(snoozePickerDismissBindTimeout);
    snoozePickerDismissBindTimeout = null;
  }

  if (snoozePickerOutsideClickHandler) {
    document.removeEventListener(
      'mousedown',
      snoozePickerOutsideClickHandler,
      true,
    );
    snoozePickerOutsideClickHandler = null;
  }

  if (snoozePickerKeydownHandler) {
    document.removeEventListener('keydown', snoozePickerKeydownHandler);
    snoozePickerKeydownHandler = null;
  }
}

function bindSnoozePickerDismissHandlers() {
  clearSnoozePickerDismissHandlers();

  snoozePickerOutsideClickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.snooze-picker') ||
      target?.closest('.snooze-menu') ||
      target?.closest('.message-reaction-toolbar')
    ) {
      return;
    }

    hideAllSnoozeUI();
    hideToolbar();
  };

  snoozePickerKeydownHandler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;

    e.preventDefault();
    hideAllSnoozeUI();
    hideToolbar();
  };

  snoozePickerDismissBindTimeout = setTimeout(() => {
    if (snoozePickerOutsideClickHandler) {
      document.addEventListener(
        'mousedown',
        snoozePickerOutsideClickHandler,
        true,
      );
    }
    if (snoozePickerKeydownHandler) {
      document.addEventListener('keydown', snoozePickerKeydownHandler);
    }
    snoozePickerDismissBindTimeout = null;
  }, 0);
}

/**
 * 隐藏 Snooze 时间选择器
 */
function hideSnoozePicker() {
  clearSnoozePickerDismissHandlers();
  if (currentSnoozePicker) {
    currentSnoozePicker.remove();
    currentSnoozePicker = null;
  }
  isSnoozePickerOpen = false;
}

/**
 * 隐藏所有 Snooze UI（菜单和选择器）
 */
function hideAllSnoozeUI() {
  hideSnoozeMenu();
  hideSnoozePicker();
}

/**
 * 隐藏工具栏
 */
function hideToolbar() {
  if (currentMessageElement) {
    const toolbar = currentMessageElement.querySelector(
      '.message-reaction-toolbar',
    );
    if (toolbar) {
      toolbar.classList.remove('visible');
    }
  }
}

/**
 * 延迟隐藏 Snooze 菜单和工具栏
 */
function scheduleSnoozeHide() {
  // 如果时间选择器打开，不隐藏任何东西
  if (isSnoozePickerOpen) return;

  if (snoozeHideTimeout) {
    clearTimeout(snoozeHideTimeout);
  }
  snoozeHideTimeout = setTimeout(() => {
    if (
      !isHoveringToolbar &&
      !isHoveringSnoozeMenu &&
      !isFocusWithinSnoozeMenu &&
      !isSnoozePickerOpen
    ) {
      hideSnoozeMenu();
      hideToolbar();
    }
  }, 200);
}

/**
 * 取消隐藏 Snooze UI
 */
function cancelSnoozeHide() {
  if (snoozeHideTimeout) {
    clearTimeout(snoozeHideTimeout);
    snoozeHideTimeout = null;
  }
}

/**
 * 显示时间选择器
 */
async function showSnoozePicker(messageInfo: MessageInfo, anchorRect: DOMRect) {
  // 标记选择器打开
  isSnoozePickerOpen = true;

  // 移除当前菜单但不隐藏工具栏
  hideSnoozeMenu();

  const picker = document.createElement('div');
  picker.className = 'snooze-picker';

  const now = new Date();
  const tomorrow9am = new Date();
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  // 格式化为 input datetime-local 需要的格式
  const formatForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  let selectedDate = tomorrow9am;
  const minDateValue = formatForInput(now);

  picker.innerHTML = `
    <div class="snooze-picker-header">
      <div class="snooze-picker-back">
        <span>← 返回</span>
      </div>
      <span class="snooze-picker-title">自定义时间</span>
    </div>
    <div class="snooze-picker-body">
      <div class="snooze-input-group">
        <label class="snooze-input-label">选择日期和时间</label>
        <input type="datetime-local" class="snooze-input snooze-datetime-input" value="${formatForInput(
          selectedDate,
        )}" min="${minDateValue}">
      </div>
      <div class="snooze-preview">
        <div class="snooze-preview-label">将在以下时间提醒您：</div>
        <div class="snooze-preview-time">${formatRemindTime(selectedDate)}</div>
      </div>
    </div>
    <div class="snooze-picker-footer">
      <button class="snooze-btn snooze-btn-cancel">取消</button>
      <button class="snooze-btn snooze-btn-confirm">确认</button>
    </div>
  `;

  document.body.appendChild(picker);
  currentSnoozePicker = picker;

  // 定位
  const pickerRect = picker.getBoundingClientRect();
  const pickerPosition = computeFloatingPosition(
    anchorRect,
    { width: pickerRect.width, height: pickerRect.height },
    { width: window.innerWidth, height: window.innerHeight },
    { align: 'right' },
  );

  picker.style.left = `${pickerPosition.left}px`;
  picker.style.top = `${pickerPosition.top}px`;
  picker.classList.toggle(
    'position-above',
    pickerPosition.placement === 'above',
  );
  picker.classList.toggle(
    'position-below',
    pickerPosition.placement === 'below',
  );
  bindSnoozePickerDismissHandlers();

  // 绑定事件
  const datetimeInput = picker.querySelector(
    '.snooze-datetime-input',
  ) as HTMLInputElement;
  const previewTime = picker.querySelector('.snooze-preview-time')!;
  const confirmBtn = picker.querySelector(
    '.snooze-btn-confirm',
  ) as HTMLButtonElement;

  const updateSelectedDate = () => {
    const candidate = new Date(datetimeInput.value);
    const isValidFutureDate = Boolean(
      datetimeInput.value &&
        !Number.isNaN(candidate.getTime()) &&
        candidate.getTime() > Date.now(),
    );

    confirmBtn.disabled = !isValidFutureDate;
    previewTime.classList.toggle('invalid', !isValidFutureDate);

    if (!isValidFutureDate) {
      previewTime.textContent = '请选择未来时间';
      return;
    }

    selectedDate = candidate;
    previewTime.textContent = formatRemindTime(selectedDate);
  };

  datetimeInput.addEventListener('input', updateSelectedDate);
  datetimeInput.addEventListener('change', updateSelectedDate);

  // 阻止 datetime-local 的点击事件冒泡
  datetimeInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  picker.querySelector('.snooze-picker-back')!.addEventListener('click', () => {
    hideSnoozePicker();
    // 返回时重新显示菜单
    if (currentMessageElement) {
      const toolbar = currentMessageElement.querySelector(
        '.message-reaction-toolbar',
      );
      const snoozeButton = toolbar?.querySelector('.snooze-icon-btn');
      const anchor = snoozeButton || toolbar;
      if (anchor) {
        showSnoozeQuickMenu(messageInfo, anchor as HTMLElement);
      }
    }
  });

  picker.querySelector('.snooze-btn-cancel')!.addEventListener('click', () => {
    hideAllSnoozeUI();
    hideToolbar();
  });

  confirmBtn.addEventListener('click', async () => {
    updateSelectedDate();
    if (confirmBtn.disabled) {
      showErrorToast('请选择未来时间');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '创建中...';

    const result = await createSnoozeReminder({
      messageInfo,
      remindAt: selectedDate,
    });

    // 如果成功，隐藏 UI；如果失败，恢复按钮状态
    if (result.success) {
      hideAllSnoozeUI();
      hideToolbar();
      showSnoozeCreatedToast(selectedDate, result.updated === true);
    } else {
      // 恢复按钮状态
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认';
      const failureMessage = getSnoozeCreateFailureMessage(result);
      if (failureMessage) {
        showErrorToast(failureMessage);
      }
    }
  });

  // 点击选择器外部不自动关闭（只能通过按钮关闭）
  picker.addEventListener('mouseenter', () => {
    cancelSnoozeHide();
  });

  picker.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// 当前显示的设置弹出框
let currentSettingsPopup: HTMLElement | null = null;

/**
 * 隐藏设置弹出框
 */
function hideSettingsPopup() {
  if (currentSettingsPopup) {
    currentSettingsPopup.remove();
    currentSettingsPopup = null;
  }
}

/**
 * 显示设置弹出框
 */
async function showSettingsPopup(anchorElement: HTMLElement) {
  hideSettingsPopup();
  hideSnoozeMenu();

  const config = await getRealtimeConfig();

  const popup = document.createElement('div');
  popup.className = 'reaction-settings-popup';

  popup.innerHTML = `
    <div class="reaction-settings-header">消息交互功能设置</div>
    <div class="reaction-settings-body">
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="snooze" ${
          config.enableSnooze ? 'checked' : ''
        }>
        <span class="reaction-settings-label">稍后处理</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="followThread" ${
          config.enableFollowThread ? 'checked' : ''
        }>
        <span class="reaction-settings-label">关注后续</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="autoReply" ${
          config.enableAutoReply ? 'checked' : ''
        }>
        <span class="reaction-settings-label">自动答复</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="linkedAction" ${
          config.enableLinkedAction ? 'checked' : ''
        }>
        <span class="reaction-settings-label">联动操作</span>
      </label>
    </div>
    <div class="reaction-settings-hint">关闭后，对应按钮将不再显示</div>
    <div class="reaction-settings-footer">
      <button class="snooze-btn snooze-btn-confirm" style="flex: none; padding: 6px 12px; font-size: 12px;">保存</button>
    </div>
  `;

  document.body.appendChild(popup);
  currentSettingsPopup = popup;

  // 定位
  const anchorRect = anchorElement.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  let left = anchorRect.left;
  let top = anchorRect.bottom + 4;

  // 边界检测
  if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10;
  }
  if (top + popupRect.height > window.innerHeight - 10) {
    top = anchorRect.top - popupRect.height - 4;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  // 绑定保存事件
  const saveButton = popup.querySelector(
    '.snooze-btn-confirm',
  ) as HTMLButtonElement;
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    saveButton.textContent = '保存中...';

    const snoozeCheckbox = popup.querySelector(
      '[data-feature="snooze"]',
    ) as HTMLInputElement;
    const followThreadCheckbox = popup.querySelector(
      '[data-feature="followThread"]',
    ) as HTMLInputElement;
    const autoReplyCheckbox = popup.querySelector(
      '[data-feature="autoReply"]',
    ) as HTMLInputElement;
    const linkedActionCheckbox = popup.querySelector(
      '[data-feature="linkedAction"]',
    ) as HTMLInputElement;

    const newConfig: MessageReactionConfig = {
      enableSnooze: snoozeCheckbox.checked,
      enableFollowThread: followThreadCheckbox.checked,
      enableAutoReply: autoReplyCheckbox.checked,
      enableLinkedAction: linkedActionCheckbox.checked,
    };

    const saved = await saveReactionConfig(newConfig);
    if (!saved) {
      saveButton.disabled = false;
      saveButton.textContent = '保存';
      showErrorToast('设置保存失败，请稍后重试');
      return;
    }

    hideSettingsPopup();
    hideToolbar();

    // 如果全部关闭，显示提示
    if (
      !newConfig.enableSnooze &&
      !newConfig.enableFollowThread &&
      !newConfig.enableAutoReply &&
      !newConfig.enableLinkedAction
    ) {
      showSuccessToast('已关闭所有消息交互功能');
    } else {
      showSuccessToast('设置已保存');
    }
  });

  // 点击外部关闭
  const closeOnOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest('.reaction-settings-popup') &&
      !target.closest('.reaction-settings-btn')
    ) {
      hideSettingsPopup();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeOnOutsideClick);
  }, 100);
}

/**
 * 显示 Snooze 快速选项菜单
 */
function shouldShowSnoozeQuickMenu(
  anchorElement: HTMLElement,
  requestSeq: number,
  allowWithoutHover = false,
): boolean {
  return (
    requestSeq === snoozeMenuRequestSeq &&
    activeSnoozeMenuAnchor === anchorElement &&
    document.contains(anchorElement) &&
    (allowWithoutHover || anchorElement.matches(':hover')) &&
    !isSnoozePickerOpen
  );
}

async function showSnoozeQuickMenu(
  messageInfo: MessageInfo,
  anchorElement: HTMLElement,
) {
  hideSnoozeMenu();

  const menu = document.createElement('div');
  menu.className = 'snooze-menu';

  const quickOptions = getQuickOptions();
  const quickOptionViews = buildSnoozeQuickMenuOptions(
    quickOptions,
    formatRemindTime,
  );

  // 精简的菜单，不包含消息预览
  menu.innerHTML = `
    ${quickOptionViews
      .map((opt) => {
        return `
        <button type="button" class="snooze-quick-option" data-option-index="${
          opt.index
        }" aria-label="${escapeSnoozeMenuText(opt.ariaLabel)}">
          <span class="snooze-quick-option-icon" aria-hidden="true">${escapeSnoozeMenuText(
            opt.icon,
          )}</span>
          <span class="snooze-quick-option-text">
            <span class="snooze-quick-option-label">${escapeSnoozeMenuText(
              opt.label,
            )}</span>
            <span class="snooze-quick-option-time">${escapeSnoozeMenuText(
              opt.timeLabel,
            )}</span>
          </span>
        </button>
      `;
      })
      .join('')}
    <div class="snooze-divider"></div>
    <button type="button" class="snooze-custom-option" aria-label="${SNOOZE_CUSTOM_OPTION_LABEL}">
      <span class="snooze-quick-option-icon" aria-hidden="true">📅</span>
      <span>自定义...</span>
    </button>
    <button type="button" class="snooze-manage-option" aria-label="${SNOOZE_MANAGE_OPTION_LABEL}">
      <span class="snooze-quick-option-icon" aria-hidden="true">↗</span>
      <span>${SNOOZE_MANAGE_OPTION_LABEL}</span>
    </button>
  `;

  document.body.appendChild(menu);
  currentSnoozeMenu = menu;

  // 定位菜单（在按钮下方，左对齐）
  const anchorRect = anchorElement.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const menuPosition = computeFloatingPosition(
    anchorRect,
    { width: menuRect.width, height: menuRect.height },
    { width: window.innerWidth, height: window.innerHeight },
    { align: 'left' },
  );

  menu.style.left = `${menuPosition.left}px`;
  menu.style.top = `${menuPosition.top}px`;
  menu.classList.toggle('position-above', menuPosition.placement === 'above');
  menu.classList.toggle('position-below', menuPosition.placement === 'below');

  // 绑定快速选项点击
  menu.querySelectorAll('.snooze-quick-option').forEach((opt) => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const optionIndex = Number((opt as HTMLElement).dataset.optionIndex);
      const quickOption = quickOptions[optionIndex];
      if (!quickOption) {
        showErrorToast('无法识别提醒时间');
        return;
      }
      const remindAt = quickOption.getTime();

      // 禁用菜单
      menu.style.pointerEvents = 'none';
      menu.style.opacity = '0.7';

      const result = await createSnoozeReminder({
        messageInfo,
        remindAt,
      });

      // 如果成功，隐藏 UI；如果失败，恢复菜单状态
      if (result.success) {
        hideAllSnoozeUI();
        hideToolbar();
        showSnoozeCreatedToast(remindAt, result.updated === true);
      } else {
        // 恢复菜单状态
        menu.style.pointerEvents = '';
        menu.style.opacity = '';
        const failureMessage = getSnoozeCreateFailureMessage(result);
        if (failureMessage) {
          showErrorToast(failureMessage);
        }
      }
    });
  });

  // 绑定自定义选项点击
  menu
    .querySelector('.snooze-custom-option')!
    .addEventListener('click', (e) => {
      e.stopPropagation();
      showSnoozePicker(messageInfo, anchorRect);
    });

  menu
    .querySelector('.snooze-manage-option')!
    .addEventListener('click', async (e) => {
      e.stopPropagation();
      await openScheduledMessagesManager();
      hideAllSnoozeUI();
      hideToolbar();
    });

  // 鼠标事件
  menu.addEventListener('mouseenter', () => {
    isHoveringSnoozeMenu = true;
    cancelSnoozeHide();
  });

  menu.addEventListener('mouseleave', () => {
    isHoveringSnoozeMenu = false;
    scheduleSnoozeHide();
  });

  menu.addEventListener('focusin', () => {
    isFocusWithinSnoozeMenu = true;
    cancelSnoozeHide();
  });

  menu.addEventListener('focusout', (e: FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest('.snooze-menu')) {
      return;
    }
    isFocusWithinSnoozeMenu = false;
    scheduleSnoozeHide();
  });

  menu.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    hideAllSnoozeUI();
    hideToolbar();
    anchorElement.focus();
  });
}

/**
 * 处理消息元素
 */
function processMessageElement(messageElement: HTMLElement) {
  if (processedMessages.has(messageElement)) return;

  // 排除 reply 输入框 - 检查自身或父级是否包含 .conversation-reply-inline-input
  if (
    messageElement.classList.contains('conversation-reply-inline-input') ||
    messageElement.querySelector('.conversation-reply-inline-input') ||
    messageElement.closest('.conversation-reply-inline-input')
  ) {
    return;
  }

  // 找到实际的消息卡片容器
  const cardWrapper = messageElement.classList.contains(
    'conversation-card-wrapper',
  )
    ? messageElement
    : (messageElement.querySelector(
        '.conversation-card-wrapper',
      ) as HTMLElement);

  if (!cardWrapper) {
    // 如果找不到 wrapper，可能是 conversation-card 本身
    const conversationCard = messageElement.closest('.conversation-card');
    if (!conversationCard) return;
  }

  const targetElement = cardWrapper || messageElement;

  // 检查是否已处理
  if (processedMessages.has(targetElement)) return;
  processedMessages.add(targetElement);

  // 确保目标元素有定位上下文
  const computedStyle = window.getComputedStyle(targetElement);
  if (computedStyle.position === 'static') {
    targetElement.style.position = 'relative';
  }

  // 创建工具栏容器（按钮内容会在显示时动态更新）
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');
  const toolbar = document.createElement('div');
  toolbar.className = 'message-reaction-toolbar';

  // 初始化空内容，显示时会动态填充
  toolbar.innerHTML = '';

  /**
   * 根据实时配置更新工具栏内容
   */
  async function updateToolbarContent(): Promise<MessageReactionConfig> {
    const config = await getRealtimeConfig();

    // 如果所有功能都禁用，隐藏工具栏
    if (
      !config.enableSnooze &&
      !config.enableFollowThread &&
      !config.enableAutoReply &&
      !config.enableLinkedAction
    ) {
      toolbar.classList.remove('visible');
      return config;
    }

    // 根据配置决定显示哪些按钮
    let buttonsHtml = '';

    // 设置按钮在最左边，初始隐藏
    buttonsHtml += `<button type="button" class="reaction-settings-btn" title="消息交互设置" aria-label="消息交互设置">${getSettingsIconSvg()}</button>`;

    const enabledButtons = getMessageReactionActionDefinitions(config);
    const buttonCount = enabledButtons.length;

    enabledButtons.forEach((action, index) => {
      const isFirst = index === 0;
      const isLast = index === buttonCount - 1;
      const borderRadius =
        isFirst && isLast
          ? 'border-radius: 4px 0 0 4px;'
          : isFirst
          ? 'border-radius: 4px 0 0 4px;'
          : '';
      const borderLeft = !isFirst ? 'border-left: none;' : '';

      if (action.usesClockIcon) {
        buttonsHtml += `
          <button
            type="button"
            class="${action.className}"
            style="${borderRadius}${borderLeft}"
            title="${action.label}"
            aria-label="${action.label}"
          >
            ${getSnoozeClockIconSvg()}
          </button>
        `;
        return;
      }

      buttonsHtml += `
        <button
          type="button"
          class="${action.className}"
          style="${borderRadius}${borderLeft}"
          title="${action.label}"
          aria-label="${action.label}"
        >
          ${action.label}
        </button>
      `;
    });

    // 图标根据按钮情况调整样式
    const hasAnyButton = buttonCount > 0;
    const iconBorderStyle = hasAnyButton ? '' : 'border-radius: 4px;';
    buttonsHtml += `
      <div class="snooze-icon" style="${iconBorderStyle}">
        <img src="${iconUrl}" alt="Personal AI" />
      </div>
    `;

    toolbar.innerHTML = buttonsHtml;
    return config;
  }

  // 将工具栏添加到消息卡片
  targetElement.appendChild(toolbar);

  /**
   * 调整工具栏位置：当有 reply input 时，对齐到消息文本区域底部
   * PAI Toolbar Position Adjustment
   */
  function adjustToolbarPosition() {
    // 检查是否有 reply input（在同一个父容器中查找）
    const parentContainer =
      targetElement.closest('.conversation-card') ||
      targetElement.parentElement;
    const replyInput = parentContainer?.querySelector(
      '.conversation-reply-inline-input',
    );

    if (replyInput) {
      // 有 reply input，需要调整位置到消息文本区域底部
      const textBody =
        targetElement.querySelector('[data-name="body"]') ||
        targetElement.querySelector('[data-name="text"]') ||
        targetElement.querySelector('.sc-cnQiCv'); // 消息文本容器的备用选择器

      if (textBody) {
        const targetRect = targetElement.getBoundingClientRect();
        const textRect = textBody.getBoundingClientRect();

        // 计算文本区域底部相对于目标元素底部的距离
        const textBottom = textRect.bottom;
        const targetBottom = targetRect.bottom;
        const relativeBottom = targetBottom - textBottom;

        // 设置工具栏位置
        toolbar.style.bottom = `${Math.max(8, relativeBottom)}px`;
        toolbar.classList.add('align-to-text');
      }
    } else {
      // 没有 reply input，恢复默认位置
      toolbar.style.bottom = '8px';
      toolbar.classList.remove('align-to-text');
    }
  }

  let showTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
  let showSettingsBtnTimeout: ReturnType<typeof setTimeout> | null = null;
  let messageInfo: MessageInfo | null = null;

  // 监听消息卡片的悬浮事件
  const conversationCard =
    targetElement.closest('.conversation-card') || targetElement;

  conversationCard.addEventListener('mouseenter', async () => {
    currentMessageElement = targetElement;

    // 取消之前的隐藏计划
    cancelSnoozeHide();

    // 短暂停留后显示工具栏（实时获取配置）
    if (showTriggerTimeout) {
      clearTimeout(showTriggerTimeout);
    }
    showTriggerTimeout = setTimeout(async () => {
      // 实时获取配置并更新工具栏内容
      const config = await updateToolbarContent();

      // 如果所有功能都禁用，不显示
      if (
        !config.enableSnooze &&
        !config.enableFollowThread &&
        !config.enableAutoReply &&
        !config.enableLinkedAction
      ) {
        return;
      }

      // 调整工具栏位置（PAI Toolbar Position Adjustment）
      adjustToolbarPosition();

      toolbar.classList.add('visible');

      // 绑定按钮事件（每次更新内容后需要重新绑定）
      bindToolbarEvents(
        toolbar,
        targetElement,
        () => messageInfo,
        (info) => {
          messageInfo = info;
        },
      );
    }, MESSAGE_REACTION_SHOW_DELAY_MS);
  });

  conversationCard.addEventListener('mouseleave', (e: MouseEvent) => {
    if (showTriggerTimeout) {
      clearTimeout(showTriggerTimeout);
      showTriggerTimeout = null;
    }

    // 检查鼠标是否移动到了工具栏或菜单上
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToToolbar = relatedTarget?.closest(
      '.message-reaction-toolbar',
    );
    const isMovingToMenu = relatedTarget?.closest('.snooze-menu');
    const isMovingToPicker = relatedTarget?.closest('.snooze-picker');

    if (isMovingToToolbar || isMovingToMenu || isMovingToPicker) {
      // 移动到工具栏或菜单，不隐藏
      return;
    }

    // 立即隐藏工具栏（除非时间选择器打开）
    if (!isSnoozePickerOpen) {
      toolbar.classList.remove('visible');
      hideSnoozeMenu();
    }
  });

  // 工具栏悬浮事件
  toolbar.addEventListener('mouseenter', () => {
    isHoveringToolbar = true;
    cancelSnoozeHide();

    // 重新调整位置（以防 reply input 动态变化）
    adjustToolbarPosition();

    toolbar.classList.add('visible');

    // 长悬停后显示设置按钮
    if (showSettingsBtnTimeout) {
      clearTimeout(showSettingsBtnTimeout);
    }
    showSettingsBtnTimeout = setTimeout(() => {
      const settingsBtn = toolbar.querySelector('.reaction-settings-btn');
      if (settingsBtn) {
        settingsBtn.classList.add('visible');
      }
    }, MESSAGE_REACTION_SETTINGS_DELAY_MS);
  });

  toolbar.addEventListener('mouseleave', () => {
    isHoveringToolbar = false;

    // 取消显示设置按钮的计时
    if (showSettingsBtnTimeout) {
      clearTimeout(showSettingsBtnTimeout);
      showSettingsBtnTimeout = null;
    }

    // 隐藏设置按钮
    const settingsBtn = toolbar.querySelector('.reaction-settings-btn');
    if (settingsBtn) {
      settingsBtn.classList.remove('visible');
    }

    scheduleSnoozeHide();
  });

  console.log(
    '💬 MessageReaction: 已为消息添加工具栏',
    targetElement.getAttribute('data-id'),
  );
}

/**
 * 绑定工具栏按钮事件
 * 每次更新工具栏内容后需要重新调用
 */
function bindToolbarEvents(
  toolbar: HTMLElement,
  targetElement: HTMLElement,
  getMessageInfo: () => MessageInfo | null,
  setMessageInfo: (info: MessageInfo) => void,
) {
  // 设置按钮（x 按钮）事件
  const settingsBtn = toolbar.querySelector(
    '.reaction-settings-btn',
  ) as HTMLElement | null;
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSettingsPopup(settingsBtn);
    });
  }

  // 稍后处理按钮事件绑定
  const textBtn = toolbar.querySelector(
    '.snooze-icon-btn',
  ) as HTMLElement | null;

  if (textBtn) {
    const openSnoozeMenuFromButton = async (focusFirstOption = false) => {
      const requestSeq = ++snoozeMenuRequestSeq;
      activeSnoozeMenuAnchor = textBtn;

      // 取消隐藏
      cancelSnoozeHide();

      // 获取消息信息
      let messageInfo = getMessageInfo();
      if (!messageInfo) {
        messageInfo = await extractMessageInfo(targetElement);
        if (messageInfo) setMessageInfo(messageInfo);
      }

      if (
        messageInfo &&
        shouldShowSnoozeQuickMenu(textBtn, requestSeq, focusFirstOption)
      ) {
        showSnoozeQuickMenu(messageInfo, textBtn);
        if (focusFirstOption) {
          requestAnimationFrame(() => {
            currentSnoozeMenu
              ?.querySelector<HTMLElement>('button.snooze-quick-option')
              ?.focus();
          });
        }
      }
    };

    // 点击：默认 1 小时后提醒
    textBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      await runToolbarButtonAction(textBtn, async () => {
        console.log('💬 MessageReaction: 点击稍后处理按钮（1小时后提醒）');

        // 获取消息信息
        let messageInfo = getMessageInfo();
        if (!messageInfo) {
          messageInfo = await extractMessageInfo(targetElement);
          if (messageInfo) setMessageInfo(messageInfo);
        }

        if (!messageInfo) {
          showErrorToast('无法获取消息信息');
          return;
        }

        // 1 小时后提醒
        const remindAt = new Date();
        remindAt.setHours(remindAt.getHours() + 1);

        const result = await createSnoozeReminder({
          messageInfo,
          remindAt,
        });

        if (result.success) {
          hideAllSnoozeUI();
          hideToolbar();
          showSnoozeCreatedToast(remindAt, result.updated === true);
        } else {
          const failureMessage = getSnoozeCreateFailureMessage(result);
          if (failureMessage) {
            showErrorToast(failureMessage);
          }
        }
      });
    });

    // 悬浮：显示 Snooze 快速选项菜单
    textBtn.addEventListener('mouseenter', () => {
      void openSnoozeMenuFromButton(false);
    });

    textBtn.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      e.stopPropagation();
      void openSnoozeMenuFromButton(true);
    });

    // 移出：检查是否移动到 Snooze 菜单，如果不是则隐藏菜单
    textBtn.addEventListener('mouseleave', (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      const isMovingToSnoozeMenu = relatedTarget?.closest('.snooze-menu');

      if (!isMovingToSnoozeMenu && activeSnoozeMenuAnchor === textBtn) {
        activeSnoozeMenuAnchor = null;
        snoozeMenuRequestSeq += 1;
      }

      if (!isMovingToSnoozeMenu) {
        scheduleSnoozeHide();
      }
    });
  }

  // 自动答复按钮事件绑定
  const autoReplyBtn = toolbar.querySelector(
    '.auto-reply-btn',
  ) as HTMLElement | null;

  if (autoReplyBtn) {
    // 悬浮：隐藏 Snooze 快速菜单
    autoReplyBtn.addEventListener('mouseenter', () => {
      hideSnoozeMenu();
    });

    // 点击：打开自动答复配置
    autoReplyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      await runToolbarButtonAction(autoReplyBtn, async () => {
        // 获取消息信息
        let messageInfo = getMessageInfo();
        if (!messageInfo) {
          messageInfo = await extractMessageInfo(targetElement);
          if (messageInfo) setMessageInfo(messageInfo);
        }

        if (!messageInfo) {
          showErrorToast('无法获取消息信息');
          return;
        }

        // 发送消息给 background 打开自动答复配置窗口
        try {
          await sendToolbarRuntimeAction(
            {
              type: 'OPEN_AUTO_REPLY_CONFIG',
              data: {
                sender: messageInfo.senderName,
                groupId: messageInfo.groupId,
                groupName: messageInfo.groupName,
                content: messageInfo.content,
                messageId: messageInfo.id,
              },
            },
            '打开配置失败，请稍后重试',
          );

          hideAllSnoozeUI();
          hideToolbar();
          showSuccessToast('正在打开自动答复配置...');
        } catch (error) {
          console.error('打开自动答复配置失败:', error);
          showErrorToast(getErrorMessage(error, '打开配置失败，请稍后重试'));
        }
      });
    });
  }

  // 关注后续按钮事件绑定
  const followThreadBtn = toolbar.querySelector(
    '.follow-thread-btn',
  ) as HTMLElement | null;

  if (followThreadBtn) {
    // 悬浮：隐藏 Snooze 快速菜单
    followThreadBtn.addEventListener('mouseenter', () => {
      hideSnoozeMenu();
    });

    // 点击：打开关注后续配置
    followThreadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      await runToolbarButtonAction(followThreadBtn, async () => {
        // 获取消息信息
        let messageInfo = getMessageInfo();
        if (!messageInfo) {
          messageInfo = await extractMessageInfo(targetElement);
          if (messageInfo) setMessageInfo(messageInfo);
        }

        if (!messageInfo) {
          showErrorToast('无法获取消息信息');
          return;
        }

        // 发送消息给 background 打开关注后续配置窗口
        try {
          await sendToolbarRuntimeAction(
            {
              type: 'OPEN_FOLLOW_THREAD_CONFIG',
              data: {
                postId: messageInfo.id,
                sender: messageInfo.senderName,
                groupId: messageInfo.groupId,
                groupName: messageInfo.groupName,
                content: messageInfo.content,
                timestamp: messageInfo.timestamp,
                messageLink: messageInfo.messageLink,
              },
            },
            '打开配置失败，请稍后重试',
          );

          hideAllSnoozeUI();
          hideToolbar();
          showSuccessToast('正在打开关注后续配置...');
        } catch (error) {
          console.error('打开关注后续配置失败:', error);
          showErrorToast(getErrorMessage(error, '打开配置失败，请稍后重试'));
        }
      });
    });
  }

  // 联动操作按钮事件绑定
  const linkedActionBtn = toolbar.querySelector(
    '.linked-action-btn',
  ) as HTMLElement | null;

  if (linkedActionBtn) {
    linkedActionBtn.addEventListener('mouseenter', () => {
      hideSnoozeMenu();
    });

    linkedActionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      await runToolbarButtonAction(linkedActionBtn, async () => {
        let messageInfo = getMessageInfo();
        if (!messageInfo) {
          messageInfo = await extractMessageInfo(targetElement);
          if (messageInfo) setMessageInfo(messageInfo);
        }

        if (!messageInfo) {
          showErrorToast('无法获取消息信息');
          return;
        }

        try {
          await sendToolbarRuntimeAction(
            {
              type: LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
              data: {
                sender: messageInfo.senderName,
                groupId: messageInfo.groupId,
                groupName: messageInfo.groupName,
                content: messageInfo.content,
                messageId: messageInfo.id,
                timestamp: messageInfo.timestamp,
                messageLink: messageInfo.messageLink,
              },
            },
            '打开配置失败，请稍后重试',
          );

          hideAllSnoozeUI();
          hideToolbar();
          showSuccessToast('正在打开联动操作配置...');
        } catch (error) {
          console.error('打开联动操作配置失败:', error);
          showErrorToast(getErrorMessage(error, '打开配置失败，请稍后重试'));
        }
      });
    });
  }
}

/**
 * 扫描并处理页面中的消息
 */
function scanAndProcessMessages(container?: Element) {
  const root = container || document.body;

  // 跳过 Snooze 相关元素
  if (
    root instanceof HTMLElement &&
    (root.classList.contains('snooze-menu') ||
      root.classList.contains('snooze-picker') ||
      root.classList.contains('message-reaction-toolbar') ||
      root.classList.contains('snooze-toast'))
  ) {
    return;
  }

  // 根据实际 RingCentral DOM 结构，主要选择器：
  const selectors = [
    '.conversation-card-wrapper[data-id]',
    '.conversation-card',
    '[data-name="conversation-card"]',
  ];

  const processedInThisRound = new Set<HTMLElement>();

  for (const selector of selectors) {
    try {
      const messages = root.querySelectorAll(selector);
      messages.forEach((msg) => {
        if (msg instanceof HTMLElement && !processedInThisRound.has(msg)) {
          const parentProcessed = Array.from(processedInThisRound).some(
            (processed) => processed.contains(msg) || msg.contains(processed),
          );
          if (!parentProcessed) {
            processedInThisRound.add(msg);
            processMessageElement(msg);
          }
        }
      });
    } catch (e) {
      console.log('MessageReaction: selector error', e);
    }
  }
}

/**
 * 初始化消息交互功能（稍后处理 + 关注后续 + 自动答复 + 联动操作）
 * @param config 可选配置，用于控制功能开关
 */
export function initMessageReaction(config?: MessageReactionConfig) {
  console.log('💬 MessageReaction: 开始初始化...', config);

  // 应用配置
  if (config) {
    globalConfig = config;
  }

  // 如果所有功能都禁用，跳过初始化
  if (
    !globalConfig.enableSnooze &&
    !globalConfig.enableFollowThread &&
    !globalConfig.enableAutoReply &&
    !globalConfig.enableLinkedAction
  ) {
    console.log('💬 MessageReaction: 消息交互功能都已禁用，跳过初始化');
    return;
  }

  // 检查是否在 RingCentral 页面
  if (!window.location.href.includes('app.ringcentral.com')) {
    console.log('💬 MessageReaction: 不是 RingCentral 页面，跳过初始化');
    return;
  }

  // 注入样式
  injectStyles();
  console.log('💬 MessageReaction: 样式已注入');

  // 初始扫描（延迟更长时间等待页面加载）
  setTimeout(() => {
    console.log('💬 MessageReaction: 开始初始扫描...');
    scanAndProcessMessages();

    const messages = document.querySelectorAll(
      '.conversation-card-wrapper[data-id]',
    );
    console.log(`💬 MessageReaction: 找到 ${messages.length} 条消息`);
  }, 2000);

  // 再次扫描
  setTimeout(() => {
    console.log('💬 MessageReaction: 第二次扫描...');
    scanAndProcessMessages();
  }, 5000);

  // 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          hasNewNodes = true;
          scanAndProcessMessages(node);
        }
      });
    });
    if (hasNewNodes) {
      scanAndProcessMessages();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 点击页面其他区域时，如果不是在选择器打开状态，隐藏 Snooze 菜单
  document.addEventListener('click', (e) => {
    if (isSnoozePickerOpen) return; // 选择器打开时不处理

    const target = e.target as HTMLElement;
    if (
      !target.closest('.snooze-menu') &&
      !target.closest('.message-reaction-toolbar') &&
      !target.closest('.snooze-picker')
    ) {
      hideSnoozeMenu();
    }
  });

  console.log('✅ MessageReaction: 初始化完成');
}
