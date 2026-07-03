/**
 * Message Reaction UI - 消息交互工具栏界面
 *
 * UI 结构：
 * - 短暂停留后显示工具栏（功能按钮 + PAI icon）
 * - 点击或 hover "稍后处理"按钮时显示 Snooze 快速选项菜单
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
//   - .snooze-icon-btn              : "稍后处理" 文本按钮 (Snooze Button)
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
  getDefaultCustomSnoozeTime,
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from './SnoozeManager';
import type { ToastAction } from './SnoozeManager';
import { formatLocalScheduleDateTime } from '../scheduled-messages/scheduleDateTime.js';
import {
  LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  getMessageReactionActionDefinitions,
} from './messageReactionLayout';
import type { MessageReactionActionDefinition } from './messageReactionLayout';
import {
  MESSAGE_REACTION_SETTINGS_DELAY_MS,
  MESSAGE_REACTION_SHOW_DELAY_MS,
} from './messageReactionTiming';
import { computeFloatingPosition } from './floatingPosition';
import { getSnoozeCreateFailureMessage } from './snoozeCreateResult';
import { getToolbarRuntimeActionError } from './toolbarActionResult';
import {
  getContentScriptUiLanguage,
  uiPhrase as ui,
} from '../i18n/contentScript.js';
import {
  SNOOZE_CUSTOM_OPTION_LABEL,
  SNOOZE_MANAGE_OPTION_LABEL,
  buildSnoozeQuickMenuReceipt,
  buildSnoozeQuickMenuOptionView,
  buildSnoozeQuickMenuOptions,
  escapeSnoozeMenuText,
  formatSnoozeQuickMenuExistingSnoozeLabel,
} from './snoozeQuickMenuPresentation';
import { shouldRenderSnoozeQuickMenuRequest } from './snoozeMenuRequest.js';
import {
  buildSnoozeSuccessToastMessage,
  buildSnoozePendingToastMessage,
  buildSnoozeUndoFailureToastMessage,
  buildSnoozeUndoSuccessToastMessage,
  buildSnoozeManagerOpenRequestData,
  buildSnoozeManagerPagePath,
  getSnoozeSuccessToastActions,
} from './snoozeToastActions';
import { buildAutoReplyConfigLaunchReceipt } from './autoReplyPresentation';
import { buildFollowThreadConfigLaunchReceipt } from './followThreadPresentation';
import {
  buildFollowupAskRunSummary,
  buildFollowupAskSubmittingMessage,
  buildFollowupAskToastMessage,
} from './followupAskPresentation';
import { buildLinkedActionConfigLaunchReceipt } from './linkedActionEntry';

const SNOOZE_QUICK_MENU_ID = 'personal-ai-snooze-quick-menu';
const GLIP_MESSAGE_MARKERS_STORAGE_KEY = 'glipMessageMarkers';
const FOLLOWUP_ASK_DEFAULT_INTERVAL_HOURS = 24;
const FOLLOWUP_ASK_MAX_INTERVAL_HOURS = 720;
const FOLLOWUP_ASK_DEFAULT_MAX_FOLLOWUP = 1;
const FOLLOWUP_ASK_MAX_FOLLOWUP = 10;

interface SnoozeQuickMenuMarkerRecord {
  type?: string;
  label?: string;
}

interface SnoozeQuickMenuMarkerCache {
  markersByChatId?: Record<string, Record<string, SnoozeQuickMenuMarkerRecord[]>>;
}

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

const CJK_LABEL_PATTERN = /[\u3400-\u9fff]/u;

function getActionLabelWidth(value: string, fallbackEm: number): string {
  const length = Array.from(value.trim()).length;
  if (CJK_LABEL_PATTERN.test(value)) {
    return `${Math.max(fallbackEm, Math.min(6, length))}em`;
  }
  return `${Math.max(5, Math.min(10, length + 1))}ch`;
}

function getActionLabelWidthStyle(
  action: MessageReactionActionDefinition,
): string {
  const compactWidth = getActionLabelWidth(action.compactLabel, 2);
  const expandedWidth = getActionLabelWidth(action.label, 4);
  return `--message-reaction-compact-label-width:${compactWidth};--message-reaction-expanded-label-width:${expandedWidth};`;
}

function getActionFixedWidthStyle(
  action: MessageReactionActionDefinition,
): string {
  const compactWidth = getActionLabelWidth(action.compactLabel, 2);
  const expandedWidth = getActionLabelWidth(action.label, 4);
  if (compactWidth !== expandedWidth) return '';
  const buttonWidth = `calc(${compactWidth} + var(--message-reaction-action-padding-x) * 2)`;
  return `width:${buttonWidth};min-width:${buttonWidth};`;
}

function getActionLabelInlineStyle(
  action: MessageReactionActionDefinition,
): string {
  const compactWidth = getActionLabelWidth(action.compactLabel, 2);
  const expandedWidth = getActionLabelWidth(action.label, 4);
  const variableStyle = getActionLabelWidthStyle(action);
  return compactWidth === expandedWidth
    ? `${variableStyle}width:${compactWidth};`
    : variableStyle;
}

function getActionLabelTextInlineStyle(
  action: MessageReactionActionDefinition,
): string {
  const compactWidth = getActionLabelWidth(action.compactLabel, 2);
  const expandedWidth = getActionLabelWidth(action.label, 4);
  return compactWidth === expandedWidth
    ? 'width:auto;'
    : `width:${expandedWidth};`;
}

function formatSnoozeDisplayTime(date: Date, now = new Date()): string {
  return formatRemindTime(date, now, getContentScriptUiLanguage());
}

function getLocalizedSeparator(): string {
  return getContentScriptUiLanguage() === 'en-US' ? ': ' : '：';
}

function getSnoozeMarkerLookupTarget(
  messageInfo: Pick<MessageInfo, 'groupId' | 'id' | 'messageLink'>,
): { chatId: string; postId: string } | null {
  const messageLink = messageInfo.messageLink?.trim();
  if (messageLink) {
    try {
      const url = new URL(messageLink);
      if (url.hostname === 'app.ringcentral.com') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'messages' && pathParts[1] && pathParts[2]) {
          return { chatId: pathParts[1], postId: pathParts[2] };
        }
      }
    } catch {
      // Fall back to DOM ids below.
    }
  }

  const chatId = messageInfo.groupId?.trim();
  const postId = messageInfo.id?.trim();
  if (!chatId || !postId || postId.startsWith('temp_')) {
    return null;
  }
  return { chatId, postId };
}

async function getExistingSnoozeMarkerForQuickMenu(
  messageInfo: MessageInfo,
): Promise<{ label: string } | null> {
  const target = getSnoozeMarkerLookupTarget(messageInfo);
  if (!target) return null;

  try {
    const result = await chrome.storage.local.get(
      GLIP_MESSAGE_MARKERS_STORAGE_KEY,
    );
    const cache = result[
      GLIP_MESSAGE_MARKERS_STORAGE_KEY
    ] as SnoozeQuickMenuMarkerCache | undefined;
    const marker = cache?.markersByChatId?.[target.chatId]?.[
      target.postId
    ]?.find(
      (item) => item?.type === 'snooze_pending' && item.label?.trim(),
    );
    const label = marker?.label?.trim();
    return label ? { label } : null;
  } catch (error) {
    console.warn('💬 MessageReaction: 读取 Snooze marker 快照失败', error);
    return null;
  }
}

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
let messageReactionInitialized = false;
let messageReactionDocumentClickBound = false;

function hasEnabledMessageReactionFeature(config: MessageReactionConfig): boolean {
  return (
    config.enableSnooze ||
    config.enableFollowThread ||
    config.enableAutoReply ||
    config.enableLinkedAction
  );
}

function hideAllMessageReactionToolbars() {
  document
    .querySelectorAll<HTMLElement>('.message-reaction-toolbar')
    .forEach((toolbar) => setToolbarVisible(toolbar, false));
}

function runMessageReactionScan(label: string) {
  console.log(`💬 MessageReaction: ${label}`);
  scanAndProcessMessages();
}

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
      --message-reaction-compact-label-width: 2em;
      --message-reaction-expanded-label-width: 4em;
      --message-reaction-action-padding-x: 8px;
      --message-reaction-compact-width: calc(var(--message-reaction-compact-label-width) + var(--message-reaction-action-padding-x) * 2);
      --message-reaction-expanded-width: calc(var(--message-reaction-expanded-label-width) + var(--message-reaction-action-padding-x) * 2);
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
      position: relative;
      flex: 0 0 auto;
      z-index: 1;
      height: 26px;
      min-height: 26px;
      max-height: 26px;
      width: var(--message-reaction-compact-width);
      min-width: var(--message-reaction-compact-width);
      margin-left: 0;
      margin-right: 0;
      padding: 4px var(--message-reaction-action-padding-x);
      font-size: 11px;
      line-height: 1;
      font-weight: 500;
      border-radius: 0;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      transition: width 0.18s ease, min-width 0.18s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    .message-reaction-action-btn:hover,
    .message-reaction-action-btn:focus-visible,
    .message-reaction-action-btn[aria-expanded="true"] {
      width: var(--message-reaction-expanded-width);
      min-width: var(--message-reaction-expanded-width);
      z-index: 3;
    }

    .message-reaction-action-label {
      display: block;
      width: var(--message-reaction-compact-label-width);
      overflow: hidden;
      white-space: nowrap;
      transition: width 0.18s ease;
    }

    .message-reaction-action-label-text {
      display: block;
      width: var(--message-reaction-expanded-label-width);
      transition: transform 0.18s ease;
    }

    .message-reaction-action-btn[data-compact-align="end"] .message-reaction-action-label-text {
      transform: translateX(calc(var(--message-reaction-compact-label-width) - var(--message-reaction-expanded-label-width)));
    }

    .message-reaction-action-btn:hover .message-reaction-action-label,
    .message-reaction-action-btn:focus-visible .message-reaction-action-label,
    .message-reaction-action-btn[aria-expanded="true"] .message-reaction-action-label {
      width: var(--message-reaction-expanded-label-width);
    }

    .message-reaction-action-btn:hover .message-reaction-action-label-text,
    .message-reaction-action-btn:focus-visible .message-reaction-action-label-text,
    .message-reaction-action-btn[aria-expanded="true"] .message-reaction-action-label-text {
      transform: translateX(0);
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

    /* ===== 稍后处理文本按钮 ===== */
    .snooze-icon-btn {
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

    /* ===== 跟进追问按钮 ===== */
    .followup-ask-btn {
      color: #0f766e;
      background: rgba(15, 118, 110, 0.1);
      border: 1px solid rgba(15, 118, 110, 0.2);
      border-left: none;
    }

    .followup-ask-btn:hover {
      background: rgba(15, 118, 110, 0.16);
      border-color: rgba(15, 118, 110, 0.38);
    }

    .followup-ask-btn:active {
      background: rgba(15, 118, 110, 0.24);
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
      width: 246px;
      max-width: calc(100vw - 24px);
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

    .snooze-menu-receipt {
      margin: 2px 6px 4px;
      padding: 7px 8px;
      border-radius: 6px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      color: #334155;
      white-space: normal;
    }

    .snooze-menu-receipt-title {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .snooze-menu-receipt-line {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 8px;
      font-size: 10.5px;
      line-height: 1.35;
    }

    .snooze-menu-receipt-line + .snooze-menu-receipt-line {
      margin-top: 3px;
    }

    .snooze-menu-receipt-label {
      color: #64748b;
      white-space: nowrap;
    }

    .snooze-menu-receipt-value {
      color: #334155;
      overflow-wrap: anywhere;
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

    .snooze-menu[aria-busy="true"] .snooze-quick-option,
    .snooze-menu[aria-busy="true"] .snooze-custom-option,
    .snooze-menu[aria-busy="true"] .snooze-manage-option {
      cursor: wait;
      opacity: 0.56;
    }

    .snooze-menu[aria-busy="true"] .snooze-quick-option[data-processing="true"] {
      opacity: 1;
      background: #fff5f5;
      color: #ee5a5a;
    }

    .snooze-menu[aria-busy="true"] .snooze-manage-option[data-processing="true"] {
      opacity: 1;
      background: #f8f8f8;
      color: #444;
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
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
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

    .snooze-picker-back:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.72);
      outline-offset: 2px;
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
      max-width: calc(100vw - 32px);
      padding: 10px 16px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.35;
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

    .snooze-toast-info {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
    }
    
    .snooze-toast-icon {
      font-size: 14px;
      font-weight: 600;
    }

    .snooze-toast-message {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .snooze-toast-action {
      flex-shrink: 0;
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

    @media (max-width: 420px) {
      .snooze-toast {
        width: calc(100vw - 32px);
        justify-content: flex-start;
      }
    }
    
    /* ===== 设置按钮（x 按钮） ===== */
    .reaction-settings-btn {
      appearance: none;
      position: absolute;
      left: -24px;
      top: 50%;
      transform: translateY(-50%);
      padding: 0;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background: rgba(102, 102, 102, 0.08);
      border: 1px solid rgba(102, 102, 102, 0.2);
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

    .reaction-settings-scope {
      margin: 10px 12px 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
    }

    .reaction-settings-scope-title {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 5px;
    }

    .reaction-settings-scope-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 7px;
      font-size: 10.5px;
      line-height: 1.35;
    }

    .reaction-settings-scope-row + .reaction-settings-scope-row {
      margin-top: 4px;
    }

    .reaction-settings-scope-label {
      color: #64748b;
    }

    .reaction-settings-scope-value {
      color: #334155;
      overflow-wrap: anywhere;
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
      line-height: 1.4;
    }

    .followup-ask-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000000;
      background: rgba(17, 24, 39, 0.36);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(2px);
    }

    .followup-ask-dialog {
      width: min(440px, calc(100vw - 36px));
      max-height: calc(100vh - 36px);
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28), 0 4px 16px rgba(15, 23, 42, 0.12);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: followup-dialog-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes followup-dialog-in {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .followup-ask-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
      color: white;
    }

    .followup-ask-header-icon {
      font-size: 16px;
      line-height: 1;
      flex-shrink: 0;
    }

    .followup-ask-title {
      font-size: 14px;
      font-weight: 650;
      color: #fff;
      flex: 1;
      line-height: 1.3;
    }

    .followup-ask-close {
      appearance: none;
      width: 26px;
      height: 26px;
      border: 0;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .followup-ask-close:hover {
      background: rgba(255, 255, 255, 0.28);
      color: #fff;
    }

    .followup-ask-close:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .followup-ask-body {
      padding: 16px;
      display: grid;
      gap: 14px;
      overflow: auto;
    }

    .followup-ask-target {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding: 8px 10px;
      border-radius: 7px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 12px;
      line-height: 1.4;
    }

    .followup-ask-target-label {
      flex-shrink: 0;
      font-weight: 600;
      color: #64748b;
    }

    .followup-ask-target-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #0f766e;
      font-weight: 650;
    }

    .followup-ask-run-summary {
      padding: 8px 10px;
      border-radius: 7px;
      background: #ecfeff;
      border: 1px solid #bae6fd;
      color: #0f4c81;
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .followup-ask-boundary {
      padding: 10px 12px;
      border-radius: 7px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #7c2d12;
      font-size: 12px;
      line-height: 1.5;
    }

    .followup-ask-boundary-title {
      font-weight: 700;
      margin-bottom: 5px;
      color: #9a3412;
    }

    .followup-ask-boundary-list {
      margin: 0;
      padding-left: 16px;
      display: grid;
      gap: 3px;
    }

    .followup-ask-boundary-list li {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .followup-ask-preview {
      max-height: 72px;
      overflow: auto;
      padding: 8px 10px;
      border-radius: 6px;
      background: #f0fdf4;
      color: #374151;
      font-size: 12px;
      line-height: 1.5;
      border: 1px solid #d1fae5;
      white-space: pre-wrap;
      margin-top: 8px;
    }

    .followup-ask-row {
      display: grid;
      gap: 6px;
    }

    .followup-ask-inline {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .followup-ask-label {
      color: #4b5563;
      font-size: 12px;
      font-weight: 600;
    }

    .followup-ask-label-primary {
      color: #111827;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .followup-ask-required-mark {
      color: #ef4444;
      font-size: 13px;
    }

    .followup-ask-input,
    .followup-ask-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1.5px solid #d1d5db;
      border-radius: 7px;
      padding: 8px 10px;
      color: #111827;
      font: inherit;
      font-size: 13px;
      outline: none;
      background: #fff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .followup-ask-input:focus,
    .followup-ask-textarea:focus {
      border-color: #0f766e;
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
    }

    .followup-ask-textarea {
      min-height: 84px;
      resize: vertical;
      line-height: 1.55;
    }

    .followup-ask-textarea.input-error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .followup-ask-details {
      border: 0;
      padding: 0;
      margin: 0;
    }

    .followup-ask-details summary {
      cursor: pointer;
      color: #6b7280;
      font-size: 12px;
      font-weight: 500;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 5px;
      user-select: none;
      transition: color 0.12s;
    }

    .followup-ask-details summary::-webkit-details-marker {
      display: none;
    }

    .followup-ask-details summary::before {
      content: '▸';
      font-size: 10px;
      transition: transform 0.15s;
      color: #9ca3af;
    }

    .followup-ask-details[open] summary::before {
      transform: rotate(90deg);
    }

    .followup-ask-details summary:hover {
      color: #374151;
    }

    .followup-ask-details-body {
      margin-top: 10px;
      display: grid;
      gap: 10px;
    }

    .followup-ask-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #f3f4f6;
      background: #fafafa;
    }

    .followup-ask-cancel,
    .followup-ask-submit {
      appearance: none;
      border: 1px solid transparent;
      border-radius: 7px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .followup-ask-cancel {
      background: #fff;
      border-color: #e5e7eb;
      color: #374151;
    }

    .followup-ask-cancel:hover {
      background: #f9fafb;
      border-color: #d1d5db;
    }

    .followup-ask-submit {
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
      color: #fff;
      box-shadow: 0 2px 8px rgba(15, 118, 110, 0.28);
    }

    .followup-ask-submit:hover:not(:disabled) {
      box-shadow: 0 4px 14px rgba(15, 118, 110, 0.38);
      transform: translateY(-1px);
    }

    .followup-ask-submit:disabled {
      cursor: wait;
      opacity: 0.65;
      transform: none;
      box-shadow: none;
    }

    .followup-ask-cancel:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .followup-ask-error {
      min-height: 18px;
      color: #b91c1c;
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .followup-ask-error[hidden] {
      display: none;
    }

    @media (max-width: 420px) {
      .followup-ask-inline {
        grid-template-columns: 1fr;
      }

      .followup-ask-footer {
        flex-direction: column-reverse;
      }

      .followup-ask-cancel,
      .followup-ask-submit {
        width: 100%;
      }
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

function escapeDialogText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeIdentityCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '');
  return normalized.length > 0 ? normalized : undefined;
}

async function isOwnMessage(
  messageInfo: MessageInfo | null,
  targetElement: HTMLElement,
): Promise<boolean> {
  const sender = normalizeIdentityCandidate(messageInfo?.senderName);
  if (!sender) return false;

  if (['me', 'you', '我', '自己'].includes(sender)) {
    return true;
  }

  const avatarUid =
    targetElement
      .querySelector('[data-name="avatar"]')
      ?.getAttribute('data-uid') || '';

  try {
    const result = await chrome.storage.local.get(['userinfo']);
    const userinfo = result.userinfo || {};
    const rawCandidates = [
      userinfo.fullName,
      userinfo.name,
      userinfo.username,
      userinfo.displayName,
      userinfo.userEmail,
      userinfo.email,
      typeof userinfo.userEmail === 'string'
        ? userinfo.userEmail.split('@')[0]
        : undefined,
      typeof userinfo.email === 'string' ? userinfo.email.split('@')[0] : undefined,
    ];
    const candidates = new Set(
      rawCandidates
        .map((value) => normalizeIdentityCandidate(value))
        .filter((value): value is string => Boolean(value)),
    );

    if (candidates.has(sender)) {
      return true;
    }

    const extensionId = String(userinfo.extensionId || '').trim();
    return Boolean(
      extensionId &&
        avatarUid &&
        avatarUid.replace(/^GLIP_PERSON\./, '') === extensionId,
    );
  } catch {
    return false;
  }
}

function inferFollowupTarget(messageInfo: MessageInfo): string {
  const conversationLabel =
    messageInfo.groupName && messageInfo.groupName !== 'Unknown'
      ? messageInfo.groupName
      : messageInfo.groupId
      ? `会话 ${messageInfo.groupId}`
      : '当前会话';
  const mention = messageInfo.content.match(
    /@([^\s@:,，：]{2,40}(?:\s+[^\s@:,，：]{1,40})?)/,
  );
  if (mention?.[1]) {
    return `${conversationLabel}（提及 ${mention[1].trim()}）`;
  }
  return conversationLabel;
}

function parseMessageTimestampSeconds(messageInfo: MessageInfo): number | undefined {
  const parsed = Date.parse(messageInfo.timestamp);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

function buildFollowupRunSummary(
  messageInfo: MessageInfo,
  intervalHours: number,
  maxFollowup: number,
): string {
  return buildFollowupAskRunSummary({
    messageCreatedAt: parseMessageTimestampSeconds(messageInfo),
    intervalHours,
    maxFollowup,
  });
}

function buildFollowupBoundaryReceipt(targetLabel: string): string[] {
  const target = targetLabel.trim() || '当前会话';
  return [
    `范围：只锚定 ${target}和这条原消息，不会改成私聊或跨会话追问。`,
    '执行：先检查原消息线程是否已有满足完成标准的回复；未命中才按间隔追问。',
    '追问次数：最多追问次数设为 0 时，只检查完成标准，不自动发送 AI 追问。',
    '边界：不会立刻发送新消息，不写 Google Sheet，也不创建可复用 Outreach template；同一原消息已有跟进时会复用旧 session。',
  ];
}

function parseBoundedInteger(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

async function openScheduledMessagesManager(messageId?: string) {
  const requestData = buildSnoozeManagerOpenRequestData(messageId);
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'OPEN_SCHEDULED_MESSAGES',
      data: requestData,
    });
    if (!response?.success) {
      throw new Error(response?.error || '打开定时消息管理失败');
    }
  } catch (error) {
    console.warn('打开定时消息管理失败，回退到直接打开页面:', error);
    window.open(
      chrome.runtime.getURL(buildSnoozeManagerPagePath(messageId)),
      '_blank',
    );
  }
}

async function undoSnoozeReminder(messageId: string, remindAt: Date) {
  try {
    const { dateStr, timeStr } = formatLocalScheduleDateTime(remindAt);
    await sendToolbarRuntimeAction(
      {
        type: 'CANCEL_SNOOZE_REMINDER',
        data: {
          messageId,
          expectedScheduleDate: dateStr,
          expectedScheduleTime: timeStr,
        },
      },
      ui('撤销提醒失败，请稍后重试'),
    );
    showSuccessToast(
      buildSnoozeUndoSuccessToastMessage({
        timeLabel: formatSnoozeDisplayTime(remindAt),
        translate: ui,
        separator: getLocalizedSeparator(),
      }),
    );
  } catch (error) {
    console.error('撤销 Snooze 提醒失败:', error);
    showErrorToast(
      buildSnoozeUndoFailureToastMessage({
        errorMessage: getErrorMessage(error, ui('撤销提醒失败，请稍后重试')),
        translate: ui,
        separator: getLocalizedSeparator(),
      }),
      {
        label: ui('管理'),
        onClick: () => openScheduledMessagesManager(messageId),
      },
    );
  }
}

function showSnoozeCreatedToast(
  remindAt: Date,
  updated = false,
  messageId?: string,
) {
  const actions = getSnoozeSuccessToastActions(updated, messageId).map(
    (action) => {
      if (action.kind === 'undo' && messageId) {
        return {
          label: ui(action.label),
          onClick: () => undoSnoozeReminder(messageId, remindAt),
        };
      }

      return {
        label: ui(action.label),
        onClick: () => openScheduledMessagesManager(messageId),
      };
    },
  );
  showSuccessToast(
    buildSnoozeSuccessToastMessage({
      updated,
      messageId,
      timeLabel: formatSnoozeDisplayTime(remindAt),
      translate: ui,
      separator: getLocalizedSeparator(),
    }),
    actions,
  );
}

function showSnoozePendingToast() {
  showInfoToast(
    buildSnoozePendingToastMessage({
      translate: ui,
      separator: getLocalizedSeparator(),
    }),
    {
      label: ui('管理'),
      onClick: () => openScheduledMessagesManager(),
    },
  );
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

function setSettingsButtonVisible(toolbar: HTMLElement, visible: boolean) {
  const settingsBtn = toolbar.querySelector<HTMLElement>(
    '.reaction-settings-btn',
  );
  if (!settingsBtn) return;

  const effectiveVisible = visible && toolbar.classList.contains('visible');
  settingsBtn.classList.toggle('visible', effectiveVisible);
  settingsBtn.tabIndex = effectiveVisible ? 0 : -1;
  settingsBtn.setAttribute('aria-hidden', effectiveVisible ? 'false' : 'true');
}

function setToolbarVisible(toolbar: HTMLElement, visible: boolean) {
  toolbar.classList.toggle('visible', visible);
  toolbar.setAttribute('aria-hidden', visible ? 'false' : 'true');
  toolbar
    .querySelectorAll<HTMLElement>('.message-reaction-action-btn')
    .forEach((button) => {
      button.tabIndex = visible ? 0 : -1;
    });

  if (!visible) {
    setSettingsButtonVisible(toolbar, false);
    return;
  }

  setSettingsButtonVisible(
    toolbar,
    toolbar
      .querySelector<HTMLElement>('.reaction-settings-btn')
      ?.classList.contains('visible') === true,
  );
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
): Promise<any> {
  const response = await chrome.runtime.sendMessage(request);
  const errorMessage = getToolbarRuntimeActionError(response, fallbackMessage);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return response;
}

function showFollowupAskDialog(messageInfo: MessageInfo): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.querySelector('.followup-ask-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'followup-ask-overlay';
    const defaultTarget = inferFollowupTarget(messageInfo);
    const escapedTarget = escapeDialogText(defaultTarget);
    const boundaryReceiptItems = buildFollowupBoundaryReceipt(defaultTarget)
      .map((item) => `<li>${escapeDialogText(item)}</li>`)
      .join('');
    overlay.innerHTML = `
      <form class="followup-ask-dialog" novalidate>
        <div class="followup-ask-header">
          <div class="followup-ask-header-icon">💬</div>
          <div class="followup-ask-title">跟进追问</div>
          <button type="button" class="followup-ask-close" aria-label="关闭">×</button>
        </div>
        <div class="followup-ask-body">
          <details class="followup-ask-details">
            <summary>原消息</summary>
            <div class="followup-ask-preview">${escapeDialogText(messageInfo.content || '(空消息)')}</div>
          </details>
          <div class="followup-ask-target" title="${escapedTarget}">
            <span class="followup-ask-target-label">跟进范围</span>
            <span class="followup-ask-target-value">${escapedTarget}</span>
          </div>
          <div class="followup-ask-run-summary" role="status">${escapeDialogText(
            buildFollowupRunSummary(
              messageInfo,
              FOLLOWUP_ASK_DEFAULT_INTERVAL_HOURS,
              FOLLOWUP_ASK_DEFAULT_MAX_FOLLOWUP,
            ),
          )}</div>
          <section class="followup-ask-boundary" aria-label="创建边界">
            <div class="followup-ask-boundary-title">创建边界</div>
            <ul class="followup-ask-boundary-list">${boundaryReceiptItems}</ul>
          </section>
          <div class="followup-ask-row">
            <label class="followup-ask-label followup-ask-label-primary" for="followup-ask-objective">
              追问的信息目标 / 完成标准
              <span class="followup-ask-required-mark">*</span>
            </label>
            <textarea
              id="followup-ask-objective"
              class="followup-ask-textarea"
              name="informationGoal"
              placeholder="例如：确认项目最终的交付时间，以及是否需要额外资源支持"
              required
              aria-required="true"
            ></textarea>
          </div>
          <details class="followup-ask-details">
            <summary>更多选项</summary>
            <div class="followup-ask-details-body">
              <div class="followup-ask-inline">
                <div class="followup-ask-row">
                  <label class="followup-ask-label" for="followup-ask-interval">追问间隔（小时）</label>
                  <input id="followup-ask-interval" class="followup-ask-input" name="intervalHours" type="number" min="1" max="${FOLLOWUP_ASK_MAX_INTERVAL_HOURS}" value="${FOLLOWUP_ASK_DEFAULT_INTERVAL_HOURS}" />
                </div>
                <div class="followup-ask-row">
                  <label class="followup-ask-label" for="followup-ask-max">最多追问次数</label>
                  <input id="followup-ask-max" class="followup-ask-input" name="maxFollowup" type="number" min="0" max="${FOLLOWUP_ASK_MAX_FOLLOWUP}" value="${FOLLOWUP_ASK_DEFAULT_MAX_FOLLOWUP}" />
                </div>
              </div>
            </div>
          </details>
          <div class="followup-ask-error" role="alert" hidden></div>
        </div>
        <div class="followup-ask-footer">
          <button type="button" class="followup-ask-cancel">取消</button>
          <button type="submit" class="followup-ask-submit">创建跟进</button>
        </div>
      </form>
    `;

    const close = () => {
      document.removeEventListener('keydown', handleKeydown);
      overlay.remove();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (overlay.dataset.submitting === 'true') return;
      if (event.key === 'Escape') {
        close();
        resolve();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('mousedown', (event) => {
      if (overlay.dataset.submitting === 'true') return;
      if (event.target === overlay) {
        close();
        resolve();
      }
    });

    const form = overlay.querySelector('form') as HTMLFormElement;
    const submitBtn = overlay.querySelector(
      '.followup-ask-submit',
    ) as HTMLButtonElement;
    const cancelBtn = overlay.querySelector(
      '.followup-ask-cancel',
    ) as HTMLButtonElement;
    const closeBtn = overlay.querySelector(
      '.followup-ask-close',
    ) as HTMLButtonElement;

    cancelBtn.addEventListener('click', () => {
      close();
      resolve();
    });
    closeBtn.addEventListener('click', () => {
      close();
      resolve();
    });

    const objectiveTextarea = overlay.querySelector(
      '#followup-ask-objective',
    ) as HTMLTextAreaElement | null;
    const intervalInput = overlay.querySelector(
      '#followup-ask-interval',
    ) as HTMLInputElement | null;
    const maxFollowupInput = overlay.querySelector(
      '#followup-ask-max',
    ) as HTMLInputElement | null;
    const errorEl = overlay.querySelector(
      '.followup-ask-error',
    ) as HTMLElement | null;
    const runSummaryEl = overlay.querySelector(
      '.followup-ask-run-summary',
    ) as HTMLElement | null;

    const setError = (message: string | null) => {
      if (!errorEl) return;
      if (!message) {
        errorEl.textContent = '';
        errorEl.hidden = true;
        return;
      }
      errorEl.textContent = message;
      errorEl.hidden = false;
    };

    const getCurrentIntervalHours = () =>
      parseBoundedInteger(
        intervalInput?.value ?? null,
        FOLLOWUP_ASK_DEFAULT_INTERVAL_HOURS,
        1,
        FOLLOWUP_ASK_MAX_INTERVAL_HOURS,
      );
    const getCurrentMaxFollowup = () =>
      parseBoundedInteger(
        maxFollowupInput?.value ?? null,
        FOLLOWUP_ASK_DEFAULT_MAX_FOLLOWUP,
        0,
        FOLLOWUP_ASK_MAX_FOLLOWUP,
      );

    const setSubmitting = (submitting: boolean) => {
      overlay.dataset.submitting = submitting ? 'true' : 'false';
      submitBtn.disabled = submitting;
      cancelBtn.disabled = submitting;
      closeBtn.disabled = submitting;
      submitBtn.textContent = submitting ? '创建中...' : '创建跟进';
      if (runSummaryEl) {
        runSummaryEl.textContent = submitting
          ? buildFollowupAskSubmittingMessage({
              maxFollowup: getCurrentMaxFollowup(),
            })
          : buildFollowupRunSummary(
              messageInfo,
              getCurrentIntervalHours(),
              getCurrentMaxFollowup(),
            );
      }
    };

    const refreshRunSummary = () => {
      if (!runSummaryEl) return;
      runSummaryEl.textContent = buildFollowupRunSummary(
        messageInfo,
        getCurrentIntervalHours(),
        getCurrentMaxFollowup(),
      );
    };

    intervalInput?.addEventListener('input', refreshRunSummary);
    maxFollowupInput?.addEventListener('input', refreshRunSummary);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const informationGoal = String(
        formData.get('informationGoal') || '',
      ).trim();

      if (!informationGoal) {
        objectiveTextarea?.classList.add('input-error');
        setError('请先填写追问要拿到的信息。');
        objectiveTextarea?.focus();
        return;
      }
      objectiveTextarea?.classList.remove('input-error');
      setError(null);

      setSubmitting(true);
      try {
        const intervalHours = parseBoundedInteger(
          formData.get('intervalHours'),
          FOLLOWUP_ASK_DEFAULT_INTERVAL_HOURS,
          1,
          FOLLOWUP_ASK_MAX_INTERVAL_HOURS,
        );
        const maxFollowup = parseBoundedInteger(
          formData.get('maxFollowup'),
          FOLLOWUP_ASK_DEFAULT_MAX_FOLLOWUP,
          0,
          FOLLOWUP_ASK_MAX_FOLLOWUP,
        );
        if (intervalInput) intervalInput.value = String(intervalHours);
        if (maxFollowupInput) maxFollowupInput.value = String(maxFollowup);

        const response = await sendToolbarRuntimeAction(
          {
            type: 'CREATE_OUTREACH_FROM_MESSAGE',
            data: {
              chatId: messageInfo.groupId,
              postId: messageInfo.id,
              messageText: messageInfo.content,
              messageUrl: messageInfo.messageLink,
              messageCreatedAt: parseMessageTimestampSeconds(messageInfo),
              messageTimestampText: messageInfo.timestamp,
              senderName: messageInfo.senderName,
              groupName: messageInfo.groupName,
              targetType: 'group',
              targetRef: messageInfo.groupId,
              targetResolvedChatId: messageInfo.groupId,
              targetResolvedLabel: defaultTarget || messageInfo.groupName,
              followupIntervalSeconds: Math.floor(intervalHours * 3600),
              maxFollowup,
              context: informationGoal,
              informationGoal,
            },
          },
          '创建跟进追问失败，请稍后重试',
        );
        close();
        const sessionId =
          typeof response?.session?.id === 'string'
            ? response.session.id
            : undefined;
        showSuccessToast(
          buildFollowupAskToastMessage(response, { maxFollowup }),
          getFollowupAskToastActions(sessionId),
        );
        resolve();
      } catch (error) {
        console.error('创建跟进追问失败:', error);
        setSubmitting(false);
        setError(getErrorMessage(error, '创建跟进追问失败，请稍后重试'));
      }
    });

    if (objectiveTextarea) {
      objectiveTextarea.addEventListener('input', () => {
        objectiveTextarea.classList.remove('input-error');
        setError(null);
      });
    }

    document.body.appendChild(overlay);
    objectiveTextarea?.focus();
  });
}

function getFollowupAskToastActions(sessionId?: string): ToastAction[] {
  return [
    {
      label: '查看追问',
      onClick: () => openOutreachSessionReview(sessionId),
    },
  ];
}

async function openOutreachSessionReview(sessionId?: string): Promise<void> {
  await sendToolbarRuntimeAction(
    {
      type: 'OPEN_OUTREACH_SESSION_REVIEW',
      data: { sessionId },
    },
    '打开追问详情失败，请稍后重试',
  );
}

function resetSnoozeMenuAnchorState() {
  document
    .querySelectorAll<HTMLElement>('.snooze-icon-btn[aria-expanded="true"]')
    .forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
    });
}

/**
 * 隐藏 Snooze 快速选项菜单
 */
function hideSnoozeMenu() {
  resetSnoozeMenuAnchorState();
  document
    .querySelectorAll<HTMLElement>('.snooze-menu')
    .forEach((menu) => menu.remove());
  currentSnoozeMenu = null;
  isHoveringSnoozeMenu = false;
  isFocusWithinSnoozeMenu = false;
}

function invalidateSnoozeMenuRequests(anchorElement?: HTMLElement) {
  if (anchorElement && activeSnoozeMenuAnchor !== anchorElement) {
    return;
  }

  activeSnoozeMenuAnchor = null;
  snoozeMenuRequestSeq += 1;
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
  invalidateSnoozeMenuRequests();
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
    ) as HTMLElement | null;
    if (toolbar) {
      setToolbarVisible(toolbar, false);
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
  // 格式化为 input datetime-local 需要的格式
  const formatForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  let selectedDate = getDefaultCustomSnoozeTime(now);
  const minDateValue = formatForInput(now);
  const backAriaLabel = escapeSnoozeMenuText(ui('返回稍后处理快捷选项'));
  const backLabel = escapeSnoozeMenuText(ui('← 返回'));
  const customTimeLabel = escapeSnoozeMenuText(ui('自定义时间'));
  const dateTimeLabel = escapeSnoozeMenuText(ui('选择日期和时间'));
  const reminderTimeLabel = escapeSnoozeMenuText(ui('将在以下时间提醒您：'));
  const cancelLabel = escapeSnoozeMenuText(ui('取消'));
  const confirmLabel = escapeSnoozeMenuText(ui('确认'));

  picker.innerHTML = `
    <div class="snooze-picker-header">
      <button type="button" class="snooze-picker-back" aria-label="${backAriaLabel}">
        <span>${backLabel}</span>
      </button>
      <span class="snooze-picker-title">${customTimeLabel}</span>
    </div>
    <div class="snooze-picker-body">
      <div class="snooze-input-group">
        <label class="snooze-input-label" for="personal-ai-snooze-datetime">${dateTimeLabel}</label>
        <input id="personal-ai-snooze-datetime" type="datetime-local" class="snooze-input snooze-datetime-input" value="${formatForInput(
          selectedDate,
        )}" min="${minDateValue}">
      </div>
      <div class="snooze-preview">
        <div class="snooze-preview-label">${reminderTimeLabel}</div>
        <div class="snooze-preview-time">${escapeSnoozeMenuText(
          formatSnoozeDisplayTime(selectedDate, now),
        )}</div>
      </div>
    </div>
    <div class="snooze-picker-footer">
      <button class="snooze-btn snooze-btn-cancel">${cancelLabel}</button>
      <button class="snooze-btn snooze-btn-confirm">${confirmLabel}</button>
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
      previewTime.textContent = ui('请选择未来时间');
      return;
    }

    selectedDate = candidate;
    previewTime.textContent = formatSnoozeDisplayTime(selectedDate);
  };

  datetimeInput.addEventListener('input', updateSelectedDate);
  datetimeInput.addEventListener('change', updateSelectedDate);

  // 阻止 datetime-local 的点击事件冒泡
  datetimeInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  picker
    .querySelector('.snooze-picker-back')!
    .addEventListener('click', async () => {
      hideSnoozePicker();
      // 返回时重新显示菜单
      if (currentMessageElement) {
        const toolbar = currentMessageElement.querySelector(
          '.message-reaction-toolbar',
        );
        const snoozeButton = toolbar?.querySelector('.snooze-icon-btn');
        const anchor = snoozeButton || toolbar;
        if (anchor) {
          activeSnoozeMenuAnchor = anchor as HTMLElement;
          const requestSeq = ++snoozeMenuRequestSeq;
          const shown = await showSnoozeQuickMenu(
            messageInfo,
            anchor as HTMLElement,
            { requestSeq, allowWithoutHover: true },
          );
          if (shown) {
            currentSnoozeMenu
              ?.querySelector<HTMLElement>('button.snooze-quick-option')
              ?.focus();
          }
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
      showErrorToast(ui('请选择未来时间'));
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = ui('创建中...');

    const result = await createSnoozeReminder({
      messageInfo,
      remindAt: selectedDate,
    });

    // 如果成功，隐藏 UI；如果失败，恢复按钮状态
    if (result.success) {
      hideAllSnoozeUI();
      hideToolbar();
      showSnoozeCreatedToast(
        selectedDate,
        result.updated === true,
        result.messageId,
      );
    } else {
      // 恢复按钮状态
      confirmBtn.disabled = false;
      confirmBtn.textContent = ui('确认');
      const failureMessage = getSnoozeCreateFailureMessage(result);
      if (result.reason === 'request_pending') {
        showSnoozePendingToast();
      } else if (failureMessage) {
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

  datetimeInput.focus();
  datetimeInput.select();
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

function renderReactionSettingsScopeReceipt(): string {
  const rows = [
    {
      label: ui('作用'),
      value: ui('只改变此浏览器消息旁工具栏按钮显示'),
    },
    {
      label: ui('不影响'),
      value: ui('不会取消已创建提醒、关注、追问、自动答复规则或联动操作'),
    },
    {
      label: ui('继续处理'),
      value: ui('已排队或已保存的任务仍从各自管理页处理'),
    },
  ];

  const rowsHtml = rows
    .map(
      (row) => `
        <div class="reaction-settings-scope-row">
          <span class="reaction-settings-scope-label">${escapeSnoozeMenuText(row.label)}</span>
          <span class="reaction-settings-scope-value">${escapeSnoozeMenuText(row.value)}</span>
        </div>
      `,
    )
    .join('');

  return `
    <section class="reaction-settings-scope" role="note" aria-label="${escapeSnoozeMenuText(
      ui('本地显示开关'),
    )}">
      <div class="reaction-settings-scope-title">${escapeSnoozeMenuText(
        ui('本地显示开关'),
      )}</div>
      ${rowsHtml}
    </section>
  `;
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
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', ui('消息交互功能设置'));

  popup.innerHTML = `
    <div class="reaction-settings-header">${escapeSnoozeMenuText(
      ui('消息交互功能设置'),
    )}</div>
    ${renderReactionSettingsScopeReceipt()}
    <div class="reaction-settings-body">
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="snooze" ${
          config.enableSnooze ? 'checked' : ''
        }>
        <span class="reaction-settings-label">${escapeSnoozeMenuText(
          ui('稍后处理'),
        )}</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="followThread" ${
          config.enableFollowThread ? 'checked' : ''
        }>
        <span class="reaction-settings-label">${escapeSnoozeMenuText(
          ui('关注后续'),
        )}</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="autoReply" ${
          config.enableAutoReply ? 'checked' : ''
        }>
        <span class="reaction-settings-label">${escapeSnoozeMenuText(
          ui('自动答复 / 跟进追问'),
        )}</span>
      </label>
      <label class="reaction-settings-option">
        <input type="checkbox" class="reaction-settings-checkbox" data-feature="linkedAction" ${
          config.enableLinkedAction ? 'checked' : ''
        }>
        <span class="reaction-settings-label">${escapeSnoozeMenuText(
          ui('联动操作'),
        )}</span>
      </label>
    </div>
    <div class="reaction-settings-hint">${escapeSnoozeMenuText(
      ui('关闭后，对应按钮将不再显示'),
    )}</div>
    <div class="reaction-settings-footer">
      <button class="snooze-btn snooze-btn-confirm" style="flex: none; padding: 6px 12px; font-size: 12px;">${escapeSnoozeMenuText(
        ui('保存'),
      )}</button>
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
    saveButton.textContent = ui('保存中...');

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
      saveButton.textContent = ui('保存');
      showErrorToast(ui('设置保存失败，请稍后重试'));
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
      showSuccessToast(
        ui(
          '已隐藏消息工具栏 · 仅关闭本地入口，不会取消已创建提醒、关注、追问或联动规则',
        ),
      );
    } else {
      showSuccessToast(
        ui('设置已保存 · 仅更新本地工具栏入口，已创建事项不受影响'),
      );
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
  return shouldRenderSnoozeQuickMenuRequest({
    requestSeq,
    currentSeq: snoozeMenuRequestSeq,
    activeAnchorMatches: activeSnoozeMenuAnchor === anchorElement,
    anchorInDocument: document.contains(anchorElement),
    anchorHovered: anchorElement.matches(':hover'),
    allowWithoutHover,
    pickerOpen: isSnoozePickerOpen,
  });
}

interface ShowSnoozeQuickMenuOptions {
  requestSeq?: number;
  allowWithoutHover?: boolean;
}

async function showSnoozeQuickMenu(
  messageInfo: MessageInfo,
  anchorElement: HTMLElement,
  options: ShowSnoozeQuickMenuOptions = {},
): Promise<boolean> {
  const requestSeq = options.requestSeq ?? snoozeMenuRequestSeq;
  const allowWithoutHover = options.allowWithoutHover === true;

  hideSnoozeMenu();
  if (!shouldShowSnoozeQuickMenu(anchorElement, requestSeq, allowWithoutHover)) {
    return false;
  }

  const menu = document.createElement('div');
  menu.className = 'snooze-menu';
  menu.id = SNOOZE_QUICK_MENU_ID;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', ui('稍后处理快捷选项'));
  menu.setAttribute('aria-busy', 'false');

  const language = getContentScriptUiLanguage();
  const quickOptions = getQuickOptions(() => new Date(), language);
  const quickOptionViews = buildSnoozeQuickMenuOptions(
    quickOptions,
    (date) => formatSnoozeDisplayTime(date),
    language,
  );
  const existingSnooze = await getExistingSnoozeMarkerForQuickMenu(messageInfo);
  if (!shouldShowSnoozeQuickMenu(anchorElement, requestSeq, allowWithoutHover)) {
    return false;
  }
  const existingSnoozeForReceipt = existingSnooze
    ? {
        label: formatSnoozeQuickMenuExistingSnoozeLabel(
          existingSnooze.label,
          language,
        ),
      }
    : null;

  const quickMenuReceipt = buildSnoozeQuickMenuReceipt(
    ui,
    getLocalizedSeparator(),
    { existingSnooze: existingSnoozeForReceipt },
  );
  const customOptionLabel = escapeSnoozeMenuText(ui(SNOOZE_CUSTOM_OPTION_LABEL));
  const manageOptionLabel = escapeSnoozeMenuText(ui(SNOOZE_MANAGE_OPTION_LABEL));

  // 精简的菜单，不包含消息预览
  menu.innerHTML = `
    <div class="snooze-menu-receipt" role="note" aria-label="${escapeSnoozeMenuText(
      quickMenuReceipt.ariaLabel,
    )}">
      <div class="snooze-menu-receipt-title">${escapeSnoozeMenuText(
        quickMenuReceipt.title,
      )}</div>
      ${quickMenuReceipt.lines
        .map(
          (line) => `
        <div class="snooze-menu-receipt-line">
          <span class="snooze-menu-receipt-label">${escapeSnoozeMenuText(
            line.label,
          )}</span>
          <span class="snooze-menu-receipt-value">${escapeSnoozeMenuText(
            line.value,
          )}</span>
        </div>
      `,
        )
        .join('')}
    </div>
    ${quickOptionViews
      .map((opt) => {
        return `
        <button type="button" class="snooze-quick-option" role="menuitem" tabindex="-1" data-option-index="${
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
    <button type="button" class="snooze-custom-option" role="menuitem" tabindex="-1" aria-label="${customOptionLabel}">
      <span class="snooze-quick-option-icon" aria-hidden="true">📅</span>
      <span>${escapeSnoozeMenuText(ui('自定义...'))}</span>
    </button>
    <button type="button" class="snooze-manage-option" role="menuitem" tabindex="-1" aria-label="${manageOptionLabel}">
      <span class="snooze-quick-option-icon" aria-hidden="true">↗</span>
      <span class="snooze-manage-option-label">${manageOptionLabel}</span>
    </button>
  `;

  hideSnoozeMenu();
  if (!shouldShowSnoozeQuickMenu(anchorElement, requestSeq, allowWithoutHover)) {
    return false;
  }

  anchorElement.setAttribute('aria-expanded', 'true');
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
  const availableMenuHeight =
    menuPosition.placement === 'above'
      ? anchorRect.top - menuPosition.top - 4
      : window.innerHeight - menuPosition.top - 10;
  if (availableMenuHeight > 0 && menuRect.height > availableMenuHeight) {
    menu.style.maxHeight = `${Math.floor(availableMenuHeight)}px`;
    menu.style.overflowY = 'auto';
    menu.style.overflowX = 'hidden';
  }

  const setMenuBusy = (busy: boolean, activeOption?: HTMLElement) => {
    menu.setAttribute('aria-busy', busy ? 'true' : 'false');
    menu
      .querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
      .forEach((button) => {
        button.disabled = busy;
        button.dataset.processing =
          busy && button === activeOption ? 'true' : 'false';
      });
  };

  const refreshQuickOptionPreviews = (
    activeIndex?: number,
  ): Date | null => {
    if (menu.getAttribute('aria-busy') === 'true') return null;
    let activeRemindAt: Date | null = null;
    quickOptions.forEach((quickOption, index) => {
      const remindAt = quickOption.getTime();
      if (index === activeIndex) {
        activeRemindAt = remindAt;
      }
      const view = buildSnoozeQuickMenuOptionView(
        quickOption,
        index,
        (date) => formatSnoozeDisplayTime(date),
        language,
        remindAt,
      );
      const button = menu.querySelector<HTMLButtonElement>(
        `.snooze-quick-option[data-option-index="${index}"]`,
      );
      const timeLabel = button?.querySelector<HTMLElement>(
        '.snooze-quick-option-time',
      );
      if (!button || !timeLabel) return;
      button.setAttribute('aria-label', view.ariaLabel);
      timeLabel.textContent = view.timeLabel;
    });
    return activeRemindAt;
  };

  // 绑定快速选项点击
  menu.querySelectorAll('.snooze-quick-option').forEach((opt) => {
    opt.addEventListener('mouseenter', () => {
      refreshQuickOptionPreviews();
    });
    opt.addEventListener('focus', () => {
      refreshQuickOptionPreviews();
    });
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (menu.getAttribute('aria-busy') === 'true') {
        return;
      }

      const optionButton = opt as HTMLButtonElement;
      const optionIndex = Number((opt as HTMLElement).dataset.optionIndex);
      const quickOption = quickOptions[optionIndex];
      if (!quickOption) {
        showErrorToast(ui('无法识别提醒时间'));
        return;
      }
      const remindAt =
        refreshQuickOptionPreviews(optionIndex) ?? quickOption.getTime();

      const labelElement = optionButton.querySelector(
        '.snooze-quick-option-time',
      );
      const previousTimeLabel = labelElement?.textContent || '';
      if (labelElement) {
        labelElement.textContent = ui('创建中...');
      }
      setMenuBusy(true, optionButton);

      const result = await createSnoozeReminder({
        messageInfo,
        remindAt,
      });

      // 如果成功，隐藏 UI；如果失败，恢复菜单状态
      if (result.success) {
        hideAllSnoozeUI();
        hideToolbar();
        showSnoozeCreatedToast(
          remindAt,
          result.updated === true,
          result.messageId,
        );
      } else {
        if (labelElement) {
          labelElement.textContent = previousTimeLabel;
        }
        setMenuBusy(false);
        optionButton.focus();
        const failureMessage = getSnoozeCreateFailureMessage(result);
        if (result.reason === 'request_pending') {
          showSnoozePendingToast();
        } else if (failureMessage) {
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

  const manageOptionButton = menu.querySelector<HTMLButtonElement>(
    '.snooze-manage-option',
  )!;
  manageOptionButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (menu.getAttribute('aria-busy') === 'true') {
      return;
    }

    const labelElement = manageOptionButton.querySelector<HTMLElement>(
      '.snooze-manage-option-label',
    );
    const previousLabel = labelElement?.textContent || manageOptionLabel;
    if (labelElement) {
      labelElement.textContent = ui('打开中...');
    }
    setMenuBusy(true, manageOptionButton);

    try {
      await openScheduledMessagesManager();
      hideAllSnoozeUI();
      hideToolbar();
    } catch (error) {
      if (labelElement) {
        labelElement.textContent = previousLabel;
      }
      setMenuBusy(false);
      manageOptionButton.focus();
      showErrorToast(
        getErrorMessage(error, ui('打开定时消息管理失败，请稍后重试')),
      );
    }
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
    if (e.key === 'Escape') {
      e.preventDefault();
      hideAllSnoozeUI();
      hideToolbar();
      anchorElement.focus();
      return;
    }

    const menuItems = Array.from(
      menu.querySelectorAll<HTMLElement>('button[role="menuitem"]'),
    );
    if (menuItems.length === 0) return;

    const currentIndex = menuItems.indexOf(
      document.activeElement as HTMLElement,
    );
    let nextIndex: number | null = null;

    if (e.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
    } else if (e.key === 'ArrowUp') {
      nextIndex =
        currentIndex < 0
          ? menuItems.length - 1
          : (currentIndex - 1 + menuItems.length) % menuItems.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = menuItems.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      menuItems[nextIndex]?.focus();
    }
  });

  return true;
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
  toolbar.setAttribute('aria-hidden', 'true');

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
      setToolbarVisible(toolbar, false);
      return config;
    }

    // 根据配置决定显示哪些按钮
    let buttonsHtml = '';

    // 设置按钮在最左边，初始隐藏
    buttonsHtml += `<button type="button" class="reaction-settings-btn" title="消息交互设置" aria-label="消息交互设置" aria-hidden="true" tabindex="-1">${getSettingsIconSvg()}</button>`;

    if (!messageInfo) {
      messageInfo = await extractMessageInfo(targetElement);
    }
    const ownMessage = await isOwnMessage(messageInfo, targetElement);
    toolbar.dataset.isOwnMessage = ownMessage ? 'true' : 'false';

    const enabledButtons = getMessageReactionActionDefinitions(config, {
      isOwnMessage: ownMessage,
    });
    const buttonCount = enabledButtons.length;
    toolbar.dataset.buttonCount = String(buttonCount);
    if (buttonCount === 0) {
      setToolbarVisible(toolbar, false);
      toolbar.innerHTML = '';
      return config;
    }

    enabledButtons.forEach((action, index) => {
      const actionLabel = escapeSnoozeMenuText(action.label);
      const actionCompactLabel = escapeSnoozeMenuText(action.compactLabel);
      const actionStyle = getActionLabelWidthStyle(action);
      const actionFixedWidthStyle = getActionFixedWidthStyle(action);
      const actionLabelStyle = getActionLabelInlineStyle(action);
      const actionLabelTextStyle = getActionLabelTextInlineStyle(action);
      const isFirst = index === 0;
      const isLast = index === buttonCount - 1;
      const borderRadius =
        isFirst && isLast
          ? 'border-radius: 4px 0 0 4px;'
          : isFirst
          ? 'border-radius: 4px 0 0 4px;'
          : '';
      const borderLeft = !isFirst ? 'border-left: none;' : '';
      const menuAttributes =
        action.key === 'snooze'
          ? `aria-haspopup="menu"
            aria-expanded="false"
            aria-controls="${SNOOZE_QUICK_MENU_ID}"`
          : '';

      if (action.usesClockIcon) {
        buttonsHtml += `
          <button
            type="button"
            class="${action.className}"
            style="${borderRadius}${borderLeft}${actionStyle}${actionFixedWidthStyle}"
            title="${actionLabel}"
            aria-label="${actionLabel}"
            data-compact-label="${actionCompactLabel}"
            ${menuAttributes}
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
          style="${borderRadius}${borderLeft}${actionStyle}${actionFixedWidthStyle}"
          title="${actionLabel}"
          aria-label="${actionLabel}"
          data-compact-label="${actionCompactLabel}"
          data-compact-align="${action.compactAlign || 'start'}"
          ${menuAttributes}
        >
          <span class="message-reaction-action-label" style="${actionLabelStyle}">
            <span class="message-reaction-action-label-text" style="${actionLabelTextStyle}">${actionLabel}</span>
          </span>
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
    setToolbarVisible(toolbar, toolbar.classList.contains('visible'));
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
  let toolbarRevealSeq = 0;
  let messageInfo: MessageInfo | null = null;

  // 监听消息卡片的悬浮事件
  const conversationCard =
    targetElement.closest('.conversation-card') || targetElement;

  const revealToolbar = async (seq: number): Promise<void> => {
    currentMessageElement = targetElement;
    cancelSnoozeHide();

    await updateToolbarContent();

    if (seq !== toolbarRevealSeq) {
      return;
    }

    // 如果当前消息没有可用按钮，不显示
    if (toolbar.dataset.buttonCount === '0') {
      return;
    }

    // 调整工具栏位置（PAI Toolbar Position Adjustment）
    adjustToolbarPosition();

    setToolbarVisible(toolbar, true);

    // 绑定按钮事件（每次更新内容后需要重新绑定）
    bindToolbarEvents(
      toolbar,
      targetElement,
      () => messageInfo,
      (info) => {
        messageInfo = info;
      },
    );
  };

  conversationCard.addEventListener('mouseenter', async () => {
    const revealSeq = ++toolbarRevealSeq;

    // 取消之前的隐藏计划
    cancelSnoozeHide();

    // 短暂停留后显示工具栏（实时获取配置）
    if (showTriggerTimeout) {
      clearTimeout(showTriggerTimeout);
    }
    showTriggerTimeout = setTimeout(() => {
      void revealToolbar(revealSeq);
    }, MESSAGE_REACTION_SHOW_DELAY_MS);
  });

  conversationCard.addEventListener('mouseleave', (e: MouseEvent) => {
    toolbarRevealSeq += 1;
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
      setToolbarVisible(toolbar, false);
      hideSnoozeMenu();
    }
  });

  conversationCard.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !toolbar.classList.contains('visible')) {
      return;
    }

    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.snooze-menu') ||
      target?.closest('.snooze-picker') ||
      target?.closest('.reaction-settings-popup')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    invalidateSnoozeMenuRequests();
    hideSnoozeMenu();
    setSettingsButtonVisible(toolbar, false);
    setToolbarVisible(toolbar, false);
    if (target?.closest('.message-reaction-toolbar')) {
      target.blur();
    }
  });

  // 工具栏悬浮事件
  toolbar.addEventListener('mouseenter', () => {
    isHoveringToolbar = true;
    cancelSnoozeHide();

    // 重新调整位置（以防 reply input 动态变化）
    adjustToolbarPosition();

    setToolbarVisible(toolbar, true);

    // 长悬停后显示设置按钮
    if (showSettingsBtnTimeout) {
      clearTimeout(showSettingsBtnTimeout);
    }
    showSettingsBtnTimeout = setTimeout(() => {
      setSettingsButtonVisible(toolbar, true);
    }, MESSAGE_REACTION_SETTINGS_DELAY_MS);
  });

  toolbar.addEventListener('mouseleave', () => {
    isHoveringToolbar = false;

    // 取消显示设置按钮的计时
    if (showSettingsBtnTimeout) {
      clearTimeout(showSettingsBtnTimeout);
      showSettingsBtnTimeout = null;
    }

    setSettingsButtonVisible(toolbar, false);

    scheduleSnoozeHide();
  });

  toolbar.addEventListener('focusin', () => {
    isHoveringToolbar = true;
    cancelSnoozeHide();
    adjustToolbarPosition();
    setToolbarVisible(toolbar, true);
    setSettingsButtonVisible(toolbar, true);
  });

  toolbar.addEventListener('focusout', (e: FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (
      relatedTarget?.closest('.message-reaction-toolbar') ||
      relatedTarget?.closest('.snooze-menu') ||
      relatedTarget?.closest('.snooze-picker') ||
      relatedTarget?.closest('.reaction-settings-popup')
    ) {
      return;
    }

    isHoveringToolbar = false;
    setSettingsButtonVisible(toolbar, false);
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
      if (currentSnoozeMenu && activeSnoozeMenuAnchor === textBtn) {
        cancelSnoozeHide();
        if (focusFirstOption) {
          currentSnoozeMenu
            .querySelector<HTMLElement>('button.snooze-quick-option')
            ?.focus();
        }
        return;
      }

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
        const shown = await showSnoozeQuickMenu(messageInfo, textBtn, {
          requestSeq,
          allowWithoutHover: focusFirstOption,
        });
        if (shown && focusFirstOption) {
          currentSnoozeMenu
            ?.querySelector<HTMLElement>('button.snooze-quick-option')
            ?.focus();
        }
      }
    };

    // 点击：打开快捷菜单，避免误触时直接创建提醒
    textBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      await runToolbarButtonAction(textBtn, async () => {
        console.log('💬 MessageReaction: 点击稍后处理按钮（打开快捷菜单）');
        await openSnoozeMenuFromButton(true);
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
      const isMovingWithinToolbar = relatedTarget?.closest(
        '.message-reaction-toolbar',
      );

      if (
        !isMovingToSnoozeMenu &&
        !isMovingWithinToolbar &&
        activeSnoozeMenuAnchor === textBtn
      ) {
        invalidateSnoozeMenuRequests(textBtn);
      }

      if (!isMovingToSnoozeMenu && !isMovingWithinToolbar) {
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
          showSuccessToast(buildAutoReplyConfigLaunchReceipt());
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
                messageTimestamp: messageInfo.timestamp,
                messageLink: messageInfo.messageLink,
              },
            },
            '打开配置失败，请稍后重试',
          );

          hideAllSnoozeUI();
          hideToolbar();
          showSuccessToast(buildFollowThreadConfigLaunchReceipt());
        } catch (error) {
          console.error('打开关注后续配置失败:', error);
          showErrorToast(getErrorMessage(error, '打开配置失败，请稍后重试'));
        }
      });
    });
  }

  // 跟进追问按钮事件绑定
  const followupAskBtn = toolbar.querySelector(
    '.followup-ask-btn',
  ) as HTMLElement | null;

  if (followupAskBtn) {
    followupAskBtn.addEventListener('mouseenter', () => {
      hideSnoozeMenu();
    });

    followupAskBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      await runToolbarButtonAction(followupAskBtn, async () => {
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
          await showFollowupAskDialog(messageInfo);
          hideAllSnoozeUI();
          hideToolbar();
        } catch (error) {
          console.error('创建跟进追问失败:', error);
          showErrorToast(
            getErrorMessage(error, '创建跟进追问失败，请稍后重试'),
          );
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
          showSuccessToast(buildLinkedActionConfigLaunchReceipt());
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

  // 检查是否在 RingCentral 页面
  if (!window.location.href.includes('app.ringcentral.com')) {
    console.log('💬 MessageReaction: 不是 RingCentral 页面，跳过初始化');
    return;
  }

  // 如果所有功能都禁用，隐藏现有入口；未初始化过时保持零成本跳过。
  if (!hasEnabledMessageReactionFeature(globalConfig)) {
    hideAllSnoozeUI();
    hideSettingsPopup();
    hideAllMessageReactionToolbars();
    console.log('💬 MessageReaction: 消息交互功能都已禁用，已隐藏工具栏');
    return;
  }

  // 注入样式
  injectStyles();
  console.log('💬 MessageReaction: 样式已注入');

  if (messageReactionInitialized) {
    runMessageReactionScan('配置已更新，重新扫描消息');
    return;
  }
  messageReactionInitialized = true;

  runMessageReactionScan('开始即时扫描');

  // 初始扫描（延迟更长时间等待页面加载）
  setTimeout(() => {
    runMessageReactionScan('开始初始扫描...');

    const messages = document.querySelectorAll(
      '.conversation-card-wrapper[data-id]',
    );
    console.log(`💬 MessageReaction: 找到 ${messages.length} 条消息`);
  }, 2000);

  // 再次扫描
  setTimeout(() => {
    runMessageReactionScan('第二次扫描...');
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
  if (!messageReactionDocumentClickBound) {
    document.addEventListener('click', (e) => {
      if (isSnoozePickerOpen) return; // 选择器打开时不处理

      const target = e.target as HTMLElement;
      if (
        !target.closest('.snooze-menu') &&
        !target.closest('.message-reaction-toolbar') &&
        !target.closest('.snooze-picker')
      ) {
        invalidateSnoozeMenuRequests();
        hideSnoozeMenu();
      }
    });
    messageReactionDocumentClickBound = true;
  }

  console.log('✅ MessageReaction: 初始化完成');
}
