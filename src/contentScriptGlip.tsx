import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './container/App';
import { CONTENT_STYLE } from './contentStyle';
import { MARKDOWN_STYLE } from './markdownStyle';
import { ViewModel } from './viewModel';
import { fetchUserData } from './metadata';
import { CONFIG_LOCAL_STORAGE_KEY } from './constants';
import { getLocalStorageItem, getCurrentUserInfo } from './storage';
import { initMessageReaction, MessageReactionConfig } from './message-reaction';
import { isManualConcernedItem } from './watchRules';

// =====================================================
// Jira Ticket 悬浮卡片功能
// =====================================================

// Jira Ticket 详情接口
interface JiraTicketDetail {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  issuetype: string;
  priority: string;
  assignee: string;
  assigneeAvatar?: string;
  reporter: string;
  reporterAvatar?: string;
  created: string;
  updated: string;
  duedate?: string;
  resolution?: string;
  labels: string[];
  components: string[];
  fixVersions: string[];
  epicLink?: string;
  epicName?: string;
  storyPoints?: number;
  sprint?: string;
  description?: string;
  url: string;
}

// 缓存已处理过的链接和 ticket 数据
const processedLinks = new WeakSet<HTMLElement>();
const ticketCache = new Map<
  string,
  { data: JiraTicketDetail | null; timestamp: number; loading?: boolean }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 当前显示的卡片和悬浮状态
let currentCard: HTMLElement | null = null;
let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
let isHoveringCard = false;
let isHoveringTrigger = false;
const copyButtonResetTimers = new WeakMap<HTMLButtonElement, number>();

// JIRA Base URL (从环境配置获取)
let JIRA_BASE_URL = 'https://jira.ringcentral.com';
const GLIP_POPUP_DEFAULT_WIDTH = 1100;
const GLIP_POPUP_DEFAULT_HEIGHT = 900;
const GLIP_MESSAGE_POPUP_WIDTH = 759;
const GLIP_NATIVE_POPOUT_BRIDGE_SOURCE =
  'personal-ai-glip-native-popout-bridge';
const GLIP_NATIVE_POPOUT_PAGE_SCRIPT_ID = 'pai-glip-native-popout-page-script';
const GLIP_NATIVE_POPOUT_BRIDGE_ATTR = 'data-pai-glip-native-popout-bridge';
const GLIP_NATIVE_POPOUT_REQUEST = 'PAI_GLIP_NATIVE_POPOUT_REQUEST';
const GLIP_NATIVE_POPOUT_RESPONSE = 'PAI_GLIP_NATIVE_POPOUT_RESPONSE';
const GLIP_NATIVE_POPOUT_READY = 'PAI_GLIP_NATIVE_POPOUT_READY';
const GLIP_MESSAGE_TARGET_REQUEST = 'PAI_GLIP_MESSAGE_TARGET_REQUEST';
const GLIP_MESSAGE_TARGET_RESPONSE = 'PAI_GLIP_MESSAGE_TARGET_RESPONSE';
const GLIP_MESSAGE_TARGET_ELEMENT_ATTR = 'data-pai-glip-message-target-id';
const GLIP_NATIVE_POPOUT_REQUEST_TIMEOUT_MS = 10000;
const GLIP_MESSAGE_TARGET_REQUEST_TIMEOUT_MS = 3000;

interface GlipLinkTarget {
  kind: 'group' | 'message';
  groupId: string;
  postId?: string;
  url?: string;
  label: string;
  resolutionStrategy?: 'forwarded-message-view-message';
}

interface GlipNativePopoutRequestMessage {
  source: string;
  target: 'page';
  type: typeof GLIP_NATIVE_POPOUT_REQUEST;
  requestId: string;
  payload: {
    groupId: string;
    popOutConversationFirstLevel?: boolean;
  };
}

interface GlipNativePopoutResponseMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_NATIVE_POPOUT_RESPONSE;
  requestId: string;
  success: boolean;
  error?: string;
}

interface GlipNativePopoutReadyMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_NATIVE_POPOUT_READY;
}

interface GlipMessageTargetRequestMessage {
  source: string;
  target: 'page';
  type: typeof GLIP_MESSAGE_TARGET_REQUEST;
  requestId: string;
  payload: {
    elementId: string;
  };
}

interface GlipMessageTargetResponseMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_MESSAGE_TARGET_RESPONSE;
  requestId: string;
  success: boolean;
  payload?: {
    groupId: string;
    postId: string;
    url: string;
  };
  error?: string;
}

const processedGlipLinks = new WeakSet<HTMLElement>();
const pendingGlipNativePopoutRequests = new Map<
  string,
  {
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();
const pendingGlipMessageTargetRequests = new Map<
  string,
  {
    resolve: (payload: {
      groupId: string;
      postId: string;
      url: string;
    }) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }
>();
let glipNativePopoutBridgeListenerAttached = false;

// 初始化时获取 JIRA Base URL
async function initJiraBaseUrl() {
  try {
    const result = await chrome.storage.local.get(['envConfig']);
    if (result.envConfig?.JIRA_BASE_URL) {
      JIRA_BASE_URL = result.envConfig.JIRA_BASE_URL;
    }
  } catch (error) {
    console.log('使用默认 JIRA Base URL');
  }
}

// 从 background script 获取 Jira ticket 详情
async function fetchJiraTicketDetail(
  ticketKey: string,
): Promise<JiraTicketDetail | null> {
  // 检查缓存
  const cached = ticketCache.get(ticketKey);
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    // 缓存过期，删除
    ticketCache.delete(ticketKey);
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_JIRA_TICKET_DETAIL',
      ticketKey,
    });

    if (response?.success && response.data) {
      ticketCache.set(ticketKey, {
        data: response.data,
        timestamp: Date.now(),
      });
      return response.data;
    }

    // 缓存失败结果（避免重复请求）
    ticketCache.set(ticketKey, { data: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error('获取 Jira ticket 详情失败:', error);
    return null;
  }
}

// 格式化日期
function formatJiraDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

// 获取状态颜色
function getStatusColor(statusCategory: string): { bg: string; text: string } {
  switch (statusCategory) {
    case 'done':
      return { bg: '#e3fcef', text: '#006644' };
    case 'indeterminate':
      return { bg: '#deebff', text: '#0747a6' };
    case 'new':
    default:
      return { bg: '#dfe1e6', text: '#42526e' };
  }
}

// 获取优先级颜色
function getPriorityColor(priority: string): string {
  const lowerPriority = priority?.toLowerCase() || '';
  if (lowerPriority.includes('highest') || lowerPriority.includes('blocker'))
    return '#d73a49';
  if (lowerPriority.includes('high') || lowerPriority.includes('critical'))
    return '#ff5630';
  if (lowerPriority.includes('medium')) return '#ffab00';
  if (lowerPriority.includes('low')) return '#36b37e';
  if (lowerPriority.includes('lowest')) return '#6b778c';
  return '#6b778c';
}

function buildJiraTicketLinkHtml(ticket: JiraTicketDetail): string {
  return `<a href="${escapeHtml(ticket.url)}">${escapeHtml(ticket.key)}</a>`;
}

function buildJiraTicketSummaryHtml(ticket: JiraTicketDetail): string {
  return `${buildJiraTicketLinkHtml(ticket)} ${escapeHtml(ticket.summary)}`;
}

function buildJiraTicketLinkText(ticket: JiraTicketDetail): string {
  return `${ticket.key} (${ticket.url})`;
}

function buildJiraTicketSummaryText(ticket: JiraTicketDetail): string {
  return `${ticket.key} ${ticket.summary} (${ticket.url})`;
}

function getCopyIconSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
}

function getSuccessIconSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"></path>
    </svg>
  `;
}

function getErrorIconSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="m15 9-6 6"></path>
      <path d="m9 9 6 6"></path>
    </svg>
  `;
}

async function copyRichTextToClipboard(
  html: string,
  text: string,
): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }

  await navigator.clipboard.writeText(text);
}

function setCopyButtonVisualState(
  button: HTMLButtonElement,
  status: 'idle' | 'success' | 'error',
) {
  const defaultLabel =
    button.dataset.defaultLabel || button.getAttribute('aria-label') || '';
  button.dataset.defaultLabel = defaultLabel;

  button.classList.remove('is-success', 'is-error');

  if (status === 'success') {
    button.classList.add('is-success');
    button.innerHTML = getSuccessIconSvg();
    button.setAttribute('aria-label', `${defaultLabel} 已复制`);
    button.title = `${defaultLabel} 已复制`;
    return;
  }

  if (status === 'error') {
    button.classList.add('is-error');
    button.innerHTML = getErrorIconSvg();
    button.setAttribute('aria-label', `${defaultLabel} 失败`);
    button.title = `${defaultLabel} 失败`;
    return;
  }

  button.innerHTML = getCopyIconSvg();
  button.setAttribute('aria-label', defaultLabel);
  button.title = defaultLabel;
}

function flashCopyButtonState(
  button: HTMLButtonElement,
  status: 'success' | 'error',
) {
  setCopyButtonVisualState(button, status);

  const existingTimer = copyButtonResetTimers.get(button);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    setCopyButtonVisualState(button, 'idle');
    copyButtonResetTimers.delete(button);
  }, 1500);

  copyButtonResetTimers.set(button, timer);
}

function bindJiraCardCopyActions(card: HTMLElement, ticket: JiraTicketDetail) {
  const copyActions: Record<string, { html: string; text: string }> = {
    link: {
      html: buildJiraTicketLinkHtml(ticket),
      text: buildJiraTicketLinkText(ticket),
    },
    summary: {
      html: buildJiraTicketSummaryHtml(ticket),
      text: buildJiraTicketSummaryText(ticket),
    },
  };

  card
    .querySelectorAll<HTMLButtonElement>('.jira-card-copy-icon-btn')
    .forEach((button) => {
      setCopyButtonVisualState(button, 'idle');

      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = button.dataset.copyAction;
        if (!action || !copyActions[action]) return;

        try {
          const payload = copyActions[action];
          await copyRichTextToClipboard(payload.html, payload.text);
          flashCopyButtonState(button, 'success');
        } catch (error) {
          console.error('复制 Jira ticket 内容失败:', error);
          flashCopyButtonState(button, 'error');
        }
      });
    });
}

// 创建悬浮卡片
function createJiraCard(
  ticket: JiraTicketDetail,
  triggerElement: HTMLElement,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'jira-ticket-hover-card';
  card.setAttribute('data-jira-card', 'true'); // 标记为 jira 卡片，用于避免重复处理

  const statusColors = getStatusColor(ticket.statusCategory);
  const priorityColor = getPriorityColor(ticket.priority);
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');

  card.innerHTML = `
    <div class="jira-card-header">
      <div class="jira-card-key-row">
        <span class="jira-card-type" title="${ticket.issuetype}">${getIssueTypeIcon(ticket.issuetype)}</span>
        <span class="jira-card-key-text">${ticket.key}</span>
        <button type="button" class="jira-card-copy-icon-btn" data-copy-action="link" aria-label="复制带链接 ID" title="复制带链接 ID">
          ${getCopyIconSvg()}
        </button>
        <span class="jira-card-status" style="background: ${statusColors.bg}; color: ${statusColors.text};">${ticket.status}</span>
        <a href="${ticket.url}" target="_blank" class="jira-card-open-icon" title="在 JIRA 中打开">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
      <div class="jira-card-summary-row">
        <div class="jira-card-summary" title="${escapeHtml(ticket.summary)}">${escapeHtml(ticket.summary)}</div>
        <button type="button" class="jira-card-copy-icon-btn jira-card-copy-icon-btn-summary" data-copy-action="summary" aria-label="复制 Ticket Summary" title="复制 Ticket Summary">
          ${getCopyIconSvg()}
        </button>
      </div>
    </div>
    
    <div class="jira-card-body">
      <div class="jira-card-meta-grid">
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">优先级</span>
          <span class="jira-card-meta-value" style="color: ${priorityColor};">● ${ticket.priority || '未设置'}</span>
        </div>
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">经办人</span>
          <span class="jira-card-meta-value">
            ${ticket.assigneeAvatar ? `<img src="${ticket.assigneeAvatar}" class="jira-card-avatar" alt="" />` : ''}
            ${escapeHtml(ticket.assignee)}
          </span>
        </div>
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">报告人</span>
          <span class="jira-card-meta-value">
            ${ticket.reporterAvatar ? `<img src="${ticket.reporterAvatar}" class="jira-card-avatar" alt="" />` : ''}
            ${escapeHtml(ticket.reporter)}
          </span>
        </div>
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">更新时间</span>
          <span class="jira-card-meta-value">${formatJiraDate(ticket.updated)}</span>
        </div>
        ${
          ticket.duedate
            ? `
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">截止日期</span>
          <span class="jira-card-meta-value ${isOverdue(ticket.duedate) ? 'overdue' : ''}">${new Date(ticket.duedate).toLocaleDateString('zh-CN')}</span>
        </div>
        `
            : ''
        }
        ${
          ticket.sprint
            ? `
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">Sprint</span>
          <span class="jira-card-meta-value">${escapeHtml(ticket.sprint)}</span>
        </div>
        `
            : ''
        }
      </div>
      
      ${
        ticket.labels.length > 0
          ? `
      <div class="jira-card-labels">
        ${ticket.labels
          .slice(0, 3)
          .map(
            (label) =>
              `<span class="jira-card-label">${escapeHtml(label)}</span>`,
          )
          .join('')}
        ${ticket.labels.length > 3 ? `<span class="jira-card-label-more">+${ticket.labels.length - 3}</span>` : ''}
      </div>
      `
          : ''
      }
      
      ${
        ticket.components.length > 0
          ? `
      <div class="jira-card-components">
        <span class="jira-card-meta-label">组件:</span>
        ${ticket.components
          .slice(0, 2)
          .map(
            (comp) =>
              `<span class="jira-card-component">${escapeHtml(comp)}</span>`,
          )
          .join('')}
        ${ticket.components.length > 2 ? `<span class="jira-card-label-more">+${ticket.components.length - 2}</span>` : ''}
      </div>
      `
          : ''
      }
    </div>
    
    <div class="jira-card-footer">
      <span class="jira-card-footer-text"><img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" /> Personal AI provided</span>
      <span class="jira-card-author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank">Esone</a></span>
    </div>
  `;

  // 定位卡片（先添加到 DOM 再定位）
  document.body.appendChild(card);
  bindJiraCardCopyActions(card, ticket);
  positionCardFixed(card, triggerElement);

  // 添加鼠标事件
  card.addEventListener('mouseenter', () => {
    isHoveringCard = true;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  });

  card.addEventListener('mouseleave', () => {
    isHoveringCard = false;
    scheduleHideCard();
  });

  return card;
}

// 定位卡片（修复版本，避免漂移）
function positionCardFixed(card: HTMLElement, trigger: HTMLElement) {
  const triggerRect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 先设置为不可见来获取尺寸
  card.style.visibility = 'hidden';
  card.style.position = 'fixed';

  // 获取卡片尺寸
  const cardRect = card.getBoundingClientRect();

  let left = triggerRect.left;
  let top = triggerRect.bottom + 8;

  // 水平方向调整
  if (left + cardRect.width > viewportWidth - 20) {
    left = viewportWidth - cardRect.width - 20;
  }
  if (left < 20) left = 20;

  // 垂直方向调整
  if (top + cardRect.height > viewportHeight - 20) {
    top = triggerRect.top - cardRect.height - 8;
  }

  // 设置固定位置
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.visibility = 'visible';
}

// 创建加载中卡片
function createLoadingCard(
  ticketKey: string,
  triggerElement: HTMLElement,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'jira-ticket-hover-card jira-card-loading';
  card.setAttribute('data-jira-card', 'true');

  card.innerHTML = `
    <div class="jira-card-header">
      <div class="jira-card-key-row">
        <span class="jira-card-loading-spinner"></span>
        <span class="jira-card-key-text">${ticketKey}</span>
      </div>
      <div class="jira-card-loading-text">正在获取 Ticket 信息...</div>
    </div>
  `;

  document.body.appendChild(card);
  positionCardFixed(card, triggerElement);

  card.addEventListener('mouseenter', () => {
    isHoveringCard = true;
  });

  card.addEventListener('mouseleave', () => {
    isHoveringCard = false;
    scheduleHideCard();
  });

  return card;
}

// 创建错误卡片
function createErrorCard(
  ticketKey: string,
  triggerElement: HTMLElement,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'jira-ticket-hover-card jira-card-error';
  card.setAttribute('data-jira-card', 'true');

  card.innerHTML = `
    <div class="jira-card-header">
      <div class="jira-card-key-row">
        <span class="jira-card-key-text">${ticketKey}</span>
      </div>
      <div class="jira-card-error-text">⚠️ 无法获取 Ticket 信息</div>
      <div class="jira-card-error-hint">请检查网络连接或登录 JIRA</div>
    </div>
  `;

  document.body.appendChild(card);
  positionCardFixed(card, triggerElement);

  card.addEventListener('mouseleave', () => {
    hideCard();
  });

  return card;
}

// 显示卡片
async function showJiraCard(ticketKey: string, triggerElement: HTMLElement) {
  // 隐藏现有卡片
  hideCard();

  // 检查缓存
  const cached = ticketCache.get(ticketKey);
  if (
    cached &&
    Date.now() - cached.timestamp < CACHE_DURATION &&
    !cached.loading
  ) {
    if (cached.data) {
      currentCard = createJiraCard(cached.data, triggerElement);
    } else {
      currentCard = createErrorCard(ticketKey, triggerElement);
    }
    return;
  }

  // 显示加载中状态
  currentCard = createLoadingCard(ticketKey, triggerElement);

  // 获取 ticket 详情
  const ticket = await fetchJiraTicketDetail(ticketKey);

  // 如果卡片已经被隐藏或替换，不再更新
  if (!currentCard || !currentCard.classList.contains('jira-card-loading')) {
    return;
  }

  // 移除加载卡片
  currentCard.remove();

  if (ticket) {
    currentCard = createJiraCard(ticket, triggerElement);
  } else {
    currentCard = createErrorCard(ticketKey, triggerElement);
  }
}

// 隐藏卡片
function hideCard() {
  if (currentCard) {
    currentCard.remove();
    currentCard = null;
  }
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
}

// 延迟隐藏卡片
function scheduleHideCard() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
  }
  hoverTimeout = setTimeout(() => {
    if (!isHoveringCard && !isHoveringTrigger) {
      hideCard();
    }
  }, 200);
}

// 获取 Issue 类型图标
function getIssueTypeIcon(issuetype: string): string {
  const type = issuetype?.toLowerCase() || '';
  if (type.includes('bug')) return '🐛';
  if (type.includes('story')) return '📖';
  if (type.includes('task')) return '✓';
  if (type.includes('epic')) return '⚡';
  if (type.includes('sub-task') || type.includes('subtask')) return '📎';
  if (type.includes('improvement')) return '⬆️';
  if (type.includes('feature')) return '✨';
  return '📋';
}

// HTML 转义
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 检查是否过期
function isOverdue(duedate: string): boolean {
  if (!duedate) return false;
  return new Date(duedate) < new Date();
}

// 注入 Jira 悬浮卡片样式
function injectJiraCardStyles() {
  if (document.getElementById('jira-hover-card-styles')) return;

  const style = document.createElement('style');
  style.id = 'jira-hover-card-styles';
  style.textContent = `
    .jira-link-wrapper {
      display: inline;
      position: relative;
    }
    
    .jira-link-icon {
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-right: 2px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .jira-link-icon:hover {
      opacity: 1;
      transform: scale(1.1);
    }
    
    .jira-ticket-hover-card {
      position: fixed;
      z-index: 999999;
      width: 380px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #172b4d;
      overflow: hidden;
      animation: jira-card-fade-in 0.15s ease-out;
    }
    
    @keyframes jira-card-fade-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .jira-card-header {
      padding: 14px 16px 12px;
      border-bottom: 1px solid #ebecf0;
      background: linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%);
    }
    
    .jira-card-key-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .jira-card-type {
      font-size: 14px;
    }
    
    .jira-card-key-text {
      font-weight: 600;
      color: #0052cc;
      font-size: 14px;
    }
    
    .jira-card-open-icon {
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      color: #6b778c;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .jira-card-open-icon:hover {
      background: #ebecf0;
      color: #0052cc;
    }
    
    .jira-card-open-icon svg {
      width: 16px;
      height: 16px;
    }
    
    .jira-card-status {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .jira-card-summary {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 500;
      color: #172b4d;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .jira-card-summary-row {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    
    .jira-card-body {
      padding: 12px 16px;
    }
    
    .jira-card-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }
    
    .jira-card-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .jira-card-meta-label {
      font-size: 11px;
      color: #6b778c;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .jira-card-meta-value {
      font-size: 13px;
      color: #172b4d;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .jira-card-meta-value.overdue {
      color: #de350b;
      font-weight: 500;
    }
    
    .jira-card-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
    }
    
    .jira-card-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ebecf0;
    }
    
    .jira-card-label {
      padding: 2px 8px;
      background: #ebecf0;
      border-radius: 3px;
      font-size: 11px;
      color: #42526e;
    }
    
    .jira-card-label-more {
      padding: 2px 8px;
      background: #dfe1e6;
      border-radius: 3px;
      font-size: 11px;
      color: #6b778c;
    }
    
    .jira-card-components {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }
    
    .jira-card-component {
      padding: 2px 6px;
      background: #deebff;
      border-radius: 3px;
      font-size: 11px;
      color: #0747a6;
    }

    
    .jira-card-copy-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #6b778c;
      padding: 0;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .jira-card-copy-icon-btn:hover {
      background: #ebecf0;
      color: #0052cc;
    }

    .jira-card-copy-icon-btn.is-success {
      background: #e3fcef;
      color: #006644;
    }

    .jira-card-copy-icon-btn.is-error {
      background: #ffebe6;
      color: #bf2600;
    }

    .jira-card-copy-icon-btn-summary {
      margin-top: 1px;
    }
    
    .jira-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #fafbfc;
      border-top: 1px solid #ebecf0;
    }
    
    .jira-card-footer-text {
      font-size: 12px;
      color: #666;
    }
    
    .jira-card-author-text {
      font-size: 11px;
      color: #666;
    }
    
    .jira-card-author-text a {
      color: inherit;
      text-decoration: none;
    }
    
    .jira-card-author-text a:hover {
      text-decoration: underline;
    }
    
    /* Loading state */
    .jira-card-loading .jira-card-header {
      min-height: 80px;
    }
    
    .jira-card-loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #ebecf0;
      border-top-color: #0052cc;
      border-radius: 50%;
      animation: jira-spin 0.8s linear infinite;
    }
    
    @keyframes jira-spin {
      to { transform: rotate(360deg); }
    }
    
    .jira-card-loading-text {
      color: #6b778c;
      font-size: 13px;
      margin-top: 8px;
    }
    
    /* Error state */
    .jira-card-error-text {
      color: #de350b;
      font-size: 13px;
      margin-top: 8px;
    }
    
    .jira-card-error-hint {
      color: #6b778c;
      font-size: 12px;
      margin-top: 4px;
    }
  `;

  document.head.appendChild(style);
}

// 处理单个 Jira 链接
function processJiraLink(linkElement: HTMLAnchorElement) {
  if (processedLinks.has(linkElement)) return;

  // 跳过卡片内部的链接（避免重复处理）
  if (
    linkElement.closest('.jira-ticket-hover-card') ||
    linkElement.closest('[data-jira-card="true"]')
  ) {
    return;
  }

  processedLinks.add(linkElement);

  const href = linkElement.href;

  // 提取 ticket key
  const match = href.match(/\/browse\/([A-Z]+-\d+)/i);
  if (!match) return;

  const ticketKey = match[1].toUpperCase();

  // 创建图标
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  const icon = document.createElement('img');
  icon.src = iconUrl;
  icon.className = 'jira-link-icon';
  icon.title = `查看 ${ticketKey} 详情`;
  icon.alt = `JIRA: `;

  // 创建一个包装器来统一处理 hover 事件
  const wrapper = document.createElement('span');
  wrapper.className = 'jira-link-wrapper';
  linkElement.parentNode?.insertBefore(wrapper, linkElement);

  // 在链接前面插入图标
  wrapper.appendChild(icon);
  wrapper.appendChild(linkElement);

  // 添加悬浮事件
  const handleMouseEnter = () => {
    isHoveringTrigger = true;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    // 延迟显示卡片，避免快速滑过时触发
    hoverTimeout = setTimeout(() => {
      if (isHoveringTrigger) {
        showJiraCard(ticketKey, wrapper);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    isHoveringTrigger = false;
    scheduleHideCard();
  };

  wrapper.addEventListener('mouseenter', handleMouseEnter);
  wrapper.addEventListener('mouseleave', handleMouseLeave);
}

// 扫描并处理页面中的 Jira 链接
function scanAndProcessJiraLinks(container?: Element) {
  const root = container || document.body;

  // 跳过卡片容器本身
  if (
    root instanceof HTMLElement &&
    (root.classList.contains('jira-ticket-hover-card') ||
      root.hasAttribute('data-jira-card'))
  ) {
    return;
  }

  // 查找所有指向 JIRA 的链接（排除卡片内的链接）
  const jiraLinks = root.querySelectorAll(
    `a[href*="${JIRA_BASE_URL}/browse/"]:not(.jira-ticket-hover-card a):not([data-jira-card] a)`,
  );

  jiraLinks.forEach((link) => {
    processJiraLink(link as HTMLAnchorElement);
  });
}

// 初始化 Jira 链接处理
function initJiraLinkProcessor() {
  // 注入样式
  injectJiraCardStyles();

  // 初始化 JIRA Base URL
  initJiraBaseUrl().then(() => {
    // 初始扫描
    scanAndProcessJiraLinks();

    // 监听 DOM 变化，处理动态加载的消息
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            scanAndProcessJiraLinks(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// =====================================================
// Glip 群组链接 Popout 功能
// =====================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGlipBadgeIconUrl(): string {
  return chrome.runtime.getURL('icons/icon48.png');
}

function buildGlipGroupUrl(groupId: string): string {
  return new URL(`/messages/${groupId}`, window.location.origin).toString();
}

function buildGlipMessageUrl(groupId: string, postId: string): string {
  return new URL(
    `/messages/${groupId}/${postId}`,
    window.location.origin,
  ).toString();
}

function buildPreferredGlipTargetUrl(
  groupId: string,
  postId?: string,
): string {
  return postId ? buildGlipMessageUrl(groupId, postId) : buildGlipGroupUrl(groupId);
}

function getGlipPopoutIconSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 5h5v5"></path>
      <path d="M10 14L19 5"></path>
      <path d="M19 14v5h-5"></path>
      <path d="M5 10V5h5"></path>
    </svg>
  `;
}

function injectGlipLinkStyles() {
  if (document.getElementById('pai-glip-link-styles')) return;

  const style = document.createElement('style');
  style.id = 'pai-glip-link-styles';
  style.textContent = `
    .pai-glip-link-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      vertical-align: middle;
    }

    .pai-glip-link-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .pai-glip-link-icon {
      width: 14px;
      height: 14px;
      display: block;
      border-radius: 3px;
    }

    .pai-glip-link-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #b42318;
      cursor: pointer;
      opacity: 0.85;
      transition: background 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
      flex-shrink: 0;
    }

    .pai-glip-link-button:hover {
      opacity: 1;
      background: rgba(217, 45, 32, 0.12);
      transform: translateY(-1px);
    }

    .pai-glip-link-button:disabled {
      cursor: wait;
      opacity: 0.55;
      transform: none;
    }

    .pai-glip-link-button svg,
    .pai-glip-link-badge svg {
      display: block;
    }
  `;

  document.head.appendChild(style);
}

function isGlipLinkContext(element: HTMLElement): boolean {
  return Boolean(element.closest('.conversation-card-wrapper[data-id]'));
}

function isExcludedGlipLinkElement(element: HTMLElement): boolean {
  if (!isGlipLinkContext(element)) {
    return true;
  }

  if (element.closest('.pai-glip-link-wrapper')) {
    return true;
  }

  return Boolean(
    element.closest(
      [
        '.jira-ticket-hover-card',
        '[data-jira-card="true"]',
        '#radar-poc-container',
        '[contenteditable="true"]',
        'textarea',
        'input',
        '[role="textbox"]',
        '.message-editor',
      ].join(', '),
    ),
  );
}

function parseGlipMessageUrl(rawUrl: string): GlipLinkTarget | null {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    if (parsed.hostname !== 'app.ringcentral.com') {
      return null;
    }

    const match = parsed.pathname.match(
      /^\/(?:l\/)?messages\/(\d+)(?:\/(\d+))?\/?$/,
    );
    if (!match) {
      return null;
    }

    const [, groupId, postId] = match;
    const label =
      parsed.pathname.includes('/l/messages/') || postId
        ? '查看原消息'
        : groupId;

    return {
      kind: postId ? 'message' : 'group',
      groupId,
      postId,
      // 统一改写到纯 Web 路径，避免 /l/messages 触发 app 启动拦截页。
      url: buildPreferredGlipTargetUrl(groupId, postId),
      label,
    };
  } catch (error) {
    console.warn('解析 Glip 链接失败:', rawUrl, error);
    return null;
  }
}

function parseGlipAnchorTarget(
  anchor: HTMLAnchorElement,
): GlipLinkTarget | null {
  const target = parseGlipMessageUrl(anchor.href);
  if (target) {
    const label = anchor.textContent?.trim();
    if (label) {
      target.label = label;
    }

    return target;
  }

  if (
    anchor.dataset.testAutomationId === 'forwarded-message-view-message'
  ) {
    const paragraph = anchor.closest('p');
    const mentionCandidates = paragraph
      ? Array.from(
          paragraph.querySelectorAll<HTMLSpanElement>(
            'span[role="link"][data-id]',
          ),
        )
      : [];

    for (const mention of mentionCandidates) {
      const mentionTarget = parseGlipMentionTarget(mention);
      if (!mentionTarget) {
        continue;
      }

      const label =
        anchor.textContent?.trim() ||
        anchor.getAttribute('aria-label')?.trim() ||
        mentionTarget.label;

      return {
        kind: 'message',
        groupId: mentionTarget.groupId,
        label,
        resolutionStrategy: 'forwarded-message-view-message',
      };
    }
  }

  return null;
}

function isForwardedMessageGroupContext(mention: HTMLSpanElement): boolean {
  const paragraph = mention.closest('p');
  if (!paragraph) {
    return false;
  }

  return Boolean(
    paragraph.querySelector(
      'a[data-test-automation-id="forwarded-message-view-message"]',
    ),
  );
}

function parseGlipMentionTarget(
  mention: HTMLSpanElement,
): GlipLinkTarget | null {
  const groupId = mention.dataset.id?.trim();
  if (!groupId || !/^\d+$/.test(groupId)) {
    return null;
  }

  const escapedId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(groupId)
      : groupId;
  const personSelectors = [
    `[data-uid="GLIP_PERSON.${escapedId}"]`,
    `[data-cid="GLIP_PERSON.${escapedId}"]`,
    `[data-test-automation-value="GLIP_PERSON.${escapedId}"]`,
  ];

  if (
    personSelectors.some((selector) =>
      Boolean(document.querySelector(selector)),
    )
  ) {
    return null;
  }

  const mentionText = mention.textContent?.trim() || '';
  const hasSidebarConversation = Boolean(
    document.querySelector(`[data-group-id="${escapedId}"]`),
  );
  const groupEmojiSignals = [
    '❤️',
    '💛',
    '💚',
    '💙',
    '💜',
    '🧡',
    '🖤',
    '🤍',
    '🤎',
  ];
  const hasGroupSignal =
    hasSidebarConversation ||
    /^team:/i.test(mentionText) ||
    mentionText.includes(',') ||
    groupEmojiSignals.some((signal) => mentionText.includes(signal)) ||
    isForwardedMessageGroupContext(mention);

  if (!hasGroupSignal) {
    return null;
  }

  return {
    kind: 'group',
    groupId,
    url: buildGlipGroupUrl(groupId),
    label: mentionText || groupId,
  };
}

async function waitForCondition(
  check: () => boolean,
  timeout = 5000,
  interval = 80,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (check()) {
      return;
    }
    await delay(interval);
  }

  throw new Error('glip_native_popout_condition_timeout');
}

function createGlipNativePopoutRequestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `glip-popout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isGlipNativePopoutBridgeReady(): boolean {
  return (
    document.documentElement.getAttribute(GLIP_NATIVE_POPOUT_BRIDGE_ATTR) ===
    'ready'
  );
}

function attachGlipNativePopoutBridgeListener() {
  if (glipNativePopoutBridgeListenerAttached) {
    return;
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data as
      | GlipNativePopoutResponseMessage
      | GlipNativePopoutReadyMessage
      | GlipMessageTargetResponseMessage
      | undefined;
    if (
      !message ||
      message.source !== GLIP_NATIVE_POPOUT_BRIDGE_SOURCE ||
      message.target !== 'content-script'
    ) {
      return;
    }

    if (message.type === GLIP_NATIVE_POPOUT_READY) {
      document.documentElement.setAttribute(
        GLIP_NATIVE_POPOUT_BRIDGE_ATTR,
        'ready',
      );
      return;
    }

    if (message.type !== GLIP_NATIVE_POPOUT_RESPONSE) {
      if (message.type !== GLIP_MESSAGE_TARGET_RESPONSE) {
        return;
      }

      const pendingMessageTargetRequest =
        pendingGlipMessageTargetRequests.get(message.requestId);
      if (!pendingMessageTargetRequest) {
        return;
      }

      pendingGlipMessageTargetRequests.delete(message.requestId);
      window.clearTimeout(pendingMessageTargetRequest.timeoutId);

      if (message.success && message.payload) {
        pendingMessageTargetRequest.resolve(message.payload);
        return;
      }

      pendingMessageTargetRequest.reject(
        new Error(message.error || 'glip_message_target_resolution_failed'),
      );
      return;
    }

    const pendingRequest = pendingGlipNativePopoutRequests.get(
      message.requestId,
    );
    if (!pendingRequest) {
      return;
    }

    pendingGlipNativePopoutRequests.delete(message.requestId);
    window.clearTimeout(pendingRequest.timeoutId);

    if (message.success) {
      pendingRequest.resolve();
      return;
    }

    pendingRequest.reject(
      new Error(message.error || 'glip_native_popout_failed'),
    );
  });

  glipNativePopoutBridgeListenerAttached = true;
}

async function ensureGlipNativePopoutBridge(): Promise<void> {
  attachGlipNativePopoutBridgeListener();

  if (isGlipNativePopoutBridgeReady()) {
    return;
  }

  let script = document.getElementById(
    GLIP_NATIVE_POPOUT_PAGE_SCRIPT_ID,
  ) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = GLIP_NATIVE_POPOUT_PAGE_SCRIPT_ID;
    script.src = chrome.runtime.getURL('glipNativePopoutPage.js');
    script.async = false;

    await new Promise<void>((resolve, reject) => {
      script!.addEventListener('load', () => resolve(), { once: true });
      script!.addEventListener(
        'error',
        () => reject(new Error('glip_native_popout_script_load_failed')),
        {
          once: true,
        },
      );
      (document.head || document.documentElement).appendChild(script!);
    });
  }

  if (isGlipNativePopoutBridgeReady()) {
    return;
  }

  await waitForCondition(() => isGlipNativePopoutBridgeReady(), 5000, 60);
}

async function requestGlipNativeGroupPopout(
  groupId: string,
  popOutConversationFirstLevel = false,
): Promise<void> {
  await ensureGlipNativePopoutBridge();

  const requestId = createGlipNativePopoutRequestId();
  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingGlipNativePopoutRequests.delete(requestId);
      reject(new Error('glip_native_popout_timeout'));
    }, GLIP_NATIVE_POPOUT_REQUEST_TIMEOUT_MS);

    pendingGlipNativePopoutRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    const message: GlipNativePopoutRequestMessage = {
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'page',
      type: GLIP_NATIVE_POPOUT_REQUEST,
      requestId,
      payload: {
        groupId,
        popOutConversationFirstLevel,
      },
    };

    window.postMessage(message, window.location.origin);
  });
}

function markGlipMessageTargetElement(element: HTMLElement): string {
  const existingId = element.getAttribute(GLIP_MESSAGE_TARGET_ELEMENT_ATTR);
  if (existingId) {
    return existingId;
  }

  const nextId = createGlipNativePopoutRequestId();
  element.setAttribute(GLIP_MESSAGE_TARGET_ELEMENT_ATTR, nextId);
  return nextId;
}

async function requestGlipMessageTargetResolution(
  element: HTMLElement,
): Promise<{ groupId: string; postId: string; url: string }> {
  await ensureGlipNativePopoutBridge();

  const requestId = createGlipNativePopoutRequestId();
  const elementId = markGlipMessageTargetElement(element);

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingGlipMessageTargetRequests.delete(requestId);
      reject(new Error('glip_message_target_resolution_timeout'));
    }, GLIP_MESSAGE_TARGET_REQUEST_TIMEOUT_MS);

    pendingGlipMessageTargetRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    const message: GlipMessageTargetRequestMessage = {
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'page',
      type: GLIP_MESSAGE_TARGET_REQUEST,
      requestId,
      payload: {
        elementId,
      },
    };

    window.postMessage(message, window.location.origin);
  });
}

async function openGlipPopupWindow(
  url: string,
  options: { width?: number; height?: number } = {},
): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: 'OPEN_GLIP_POPUP_WINDOW',
    data: {
      url,
      width: options.width ?? GLIP_POPUP_DEFAULT_WIDTH,
      height: options.height ?? GLIP_POPUP_DEFAULT_HEIGHT,
    },
  });

  if (!response?.success) {
    throw new Error(response?.error || 'open_glip_popup_failed');
  }
}

async function resolveGlipMessageTarget(
  target: GlipLinkTarget,
  targetElement?: HTMLElement,
): Promise<GlipLinkTarget> {
  if (target.kind !== 'message') {
    return target;
  }

  if (target.postId) {
    return {
      ...target,
      url: buildGlipMessageUrl(target.groupId, target.postId),
    };
  }

  if (
    target.resolutionStrategy !== 'forwarded-message-view-message' ||
    !(targetElement instanceof HTMLAnchorElement)
  ) {
    return target;
  }

  try {
    const resolvedTarget =
      await requestGlipMessageTargetResolution(targetElement);
    return {
      ...target,
      groupId: resolvedTarget.groupId,
      postId: resolvedTarget.postId,
      url: buildGlipMessageUrl(
        resolvedTarget.groupId,
        resolvedTarget.postId,
      ),
    };
  } catch (error) {
    console.warn('解析 Glip 指定消息跳转失败，降级为群组链接:', error);
    return {
      ...target,
      url: target.url || buildGlipGroupUrl(target.groupId),
    };
  }
}

async function handleGlipPopout(
  target: GlipLinkTarget,
  targetElement?: HTMLElement,
): Promise<void> {
  if (target.kind === 'message') {
    const resolvedTarget = await resolveGlipMessageTarget(target, targetElement);
    await openGlipPopupWindow(
      resolvedTarget.url || buildGlipGroupUrl(resolvedTarget.groupId),
      {
        width: GLIP_MESSAGE_POPUP_WIDTH,
      },
    );
    return;
  }

  await requestGlipNativeGroupPopout(target.groupId);
}

function processGlipLink(targetElement: HTMLElement, target: GlipLinkTarget) {
  if (
    processedGlipLinks.has(targetElement) ||
    isExcludedGlipLinkElement(targetElement)
  ) {
    return;
  }

  processedGlipLinks.add(targetElement);

  const wrapper = document.createElement('span');
  wrapper.className = 'pai-glip-link-wrapper';
  wrapper.setAttribute('data-pai-glip-link', target.kind);

  const badge = document.createElement('span');
  badge.className = 'pai-glip-link-badge';
  badge.title = 'Personal AI';
  const badgeIcon = document.createElement('img');
  badgeIcon.src = getGlipBadgeIconUrl();
  badgeIcon.alt = 'Personal AI';
  badgeIcon.className = 'pai-glip-link-icon';
  badge.appendChild(badgeIcon);

  const popoutButton = document.createElement('button');
  popoutButton.type = 'button';
  popoutButton.className = 'pai-glip-link-button';
  popoutButton.title = `Pop out ${target.label}`;
  popoutButton.setAttribute('aria-label', `Pop out ${target.label}`);
  popoutButton.innerHTML = getGlipPopoutIconSvg();
  popoutButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (popoutButton.disabled) {
      return;
    }

    popoutButton.disabled = true;

    try {
      await handleGlipPopout(target, targetElement);
    } catch (error) {
      console.error('Glip Popout 失败:', target, error);
    } finally {
      window.setTimeout(() => {
        popoutButton.disabled = false;
      }, 300);
    }
  });

  targetElement.parentNode?.insertBefore(wrapper, targetElement);
  wrapper.appendChild(badge);
  wrapper.appendChild(targetElement);
  wrapper.appendChild(popoutButton);
}

function scanAndProcessGlipLinks(container?: Element) {
  const root = container || document.body;
  if (!(root instanceof Element)) {
    return;
  }

  const selector =
    'span[role="link"][data-id], a[href*="/messages/"], a[href*="/l/messages/"], a[data-test-automation-id="forwarded-message-view-message"]';
  const candidates = new Set<HTMLElement>();

  if (root.matches(selector)) {
    candidates.add(root as HTMLElement);
  }

  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    candidates.add(element);
  });

  candidates.forEach((element) => {
    if (element instanceof HTMLAnchorElement) {
      const target = parseGlipAnchorTarget(element);
      if (target) {
        processGlipLink(element, target);
      }
      return;
    }

    if (element instanceof HTMLSpanElement) {
      const target = parseGlipMentionTarget(element);
      if (target) {
        processGlipLink(element, target);
      }
    }
  });
}

function initGlipLinkProcessor() {
  injectGlipLinkStyles();
  void ensureGlipNativePopoutBridge().catch((error) => {
    console.warn('预热 Glip Native Popout Bridge 失败:', error);
  });
  scanAndProcessGlipLinks();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          scanAndProcessGlipLinks(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// 获取消息交互功能配置
async function getMessageReactionConfig(): Promise<MessageReactionConfig> {
  try {
    const result = await chrome.storage.local.get(['envConfig']);
    const config = result.envConfig || {};
    return {
      enableSnooze: config.ENABLE_SNOOZE !== false, // 默认启用
      enableFollowThread: config.ENABLE_FOLLOW_THREAD !== false, // 默认启用
      enableAutoReply: config.ENABLE_AUTO_REPLY !== false, // 默认启用
      enableLinkedAction: config.ENABLE_LINKED_ACTION !== false, // 默认启用
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

// 初始化消息交互功能（包装器）
async function setupMessageReaction() {
  const config = await getMessageReactionConfig();
  console.log('🔔 消息交互功能配置:', config);

  // 如果四个功能都禁用，跳过初始化
  if (
    !config.enableSnooze &&
    !config.enableFollowThread &&
    !config.enableAutoReply &&
    !config.enableLinkedAction
  ) {
    console.log('🔔 消息交互功能都已禁用，不显示工具栏');
    return;
  }

  initMessageReaction(config);
}

// 在页面加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initJiraLinkProcessor, 1000);
    setTimeout(initGlipLinkProcessor, 1200);
    setTimeout(setupMessageReaction, 1500); // 初始化消息交互功能
    setTimeout(initFollowThreadVisuals, 2000); // 初始化关注后续视觉标识
  });
} else {
  setTimeout(initJiraLinkProcessor, 1000);
  setTimeout(initGlipLinkProcessor, 1200);
  setTimeout(setupMessageReaction, 1500); // 初始化消息交互功能
  setTimeout(initFollowThreadVisuals, 2000); // 初始化关注后续视觉标识
}

// Insert the CSS styles into the DOM
function insertRadarPocCss(styles: string, id: string) {
  // 检查是否已存在具有指定 ID 的样式表
  if (document.getElementById(id)) {
    return; // 如果已存在，直接返回
  }

  // 如果不存在，创建并插入新的样式表
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.id = id; // 设置唯一的 ID
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

function bootstrap() {
  insertRadarPocCss(MARKDOWN_STYLE, 'radar-poc-markdown-style');
  insertRadarPocCss(CONTENT_STYLE, 'radar-poc-content-style');

  const appMainSection = document.getElementById('app-main-section');
  const containerDiv = `<div id="radar-poc-container"></div>`;
  appMainSection.insertAdjacentHTML('beforeend', containerDiv);
  const container = appMainSection.querySelector('#radar-poc-container');
  const vm = new ViewModel();

  ReactDOM.render(
    // @ts-ignore
    <App vm={vm} />,
    container,
  );
}

// Main listener
// 注意：只有当 contentScript 实际处理某个消息类型时才返回 true
// 如果不处理，应该返回 false 或 undefined，让其他监听器（如 background.ts）处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '发送者:', sender);

  if (!message || !message.type) {
    console.warn('收到无效消息格式');
    return false; // 不处理，让其他监听器处理
  }

  const { type } = message;

  if (type === 'GET_USER_INFO') {
    console.log('处理 GET_USER_INFO 消息');
    const userInfo = getUserInfoInRCTab();
    console.log('获取到的用户信息:', userInfo);
    sendResponse({
      success: true,
      data: {
        fullName: userInfo.fullName,
        username: userInfo.username,
        userEmail: userInfo.email,
        extensionId: userInfo.extensionId,
      },
    });
    return true;
  }

  if (type === 'RADAR-POC-OPEN-PANEL') {
    console.log('处理 RADAR-POC-OPEN-PANEL 消息');
    bootstrap();
    sendResponse({ status: 'done', type });
    return true; // 添加 return true
  }

  if (type === 'FETCH_USER_MESSAGES') {
    console.log('处理 FETCH_USER_MESSAGES 消息，参数:', message);
    const { startTime } = message;
    const configStr = localStorage.getItem(CONFIG_LOCAL_STORAGE_KEY);
    const config = configStr
      ? JSON.parse(configStr)
      : {
          selectGroupNames: '',
          enableMessage: true,
          enableSms: false,
          enableVoicemail: false,
          enableCallTranscript: false,
          enableCalendar: false,
          enableCandidateQuestions: false,
          selectFolderGroupIds: '',
          username: '',
          extensionId: '',
          apiKey: '',
          model: '4o',
        };

    // 确保必要的参数存在
    if (!startTime) {
      console.error('缺少必要的参数:', { startTime, config });
      sendResponse({ success: false, error: '缺少必要的参数' });
      return true;
    }

    // 执行数据获取
    console.log('执行数据获取', startTime, config);
    fetchUserData(startTime, config)
      .then((data) => {
        console.log('数据获取成功:', data);
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        console.error('数据获取失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启
  }

  // 不处理的消息类型，返回 false 让其他监听器（如 background.ts）处理
  return false;
});

function getUserInfoInRCTab() {
  const accountUD = getLocalStorageItem('global.account.UD', '');
  const accountSessionData = getLocalStorageItem(
    'global.account.ACCOUNT_SESSION_DATA_LIST',
    [],
  );
  const accountInfoList = Array.isArray(accountSessionData)
    ? accountSessionData
    : Object.values(accountSessionData || {});

  const accountInfo = accountUD
    ? Array.isArray(accountSessionData)
      ? accountInfoList.find(
          (item: any) =>
            String(item?.accountId || item?.id || item?.extensionId || '') ===
            String(accountUD),
        )
      : accountSessionData[accountUD]
    : accountInfoList.find((item: any) => item?.displayName != '');
  console.log('accountInfoList', accountInfoList, accountInfo);
  if (accountInfo)
    return {
      extensionId: accountInfo.extensionId,
      email: accountInfo.email,
      fullName: accountInfo.displayName,
      username: accountInfo.email
        ? accountInfo.email.trim().split('@')[0]
        : accountInfo.displayName
            .trim()
            .split(' ')
            .join('.')
            .toLowerCase()
            .replace(/[^a-z0-9_\-.]/g, ''),
    };

  const userInfo = getCurrentUserInfo();
  return {
    extensionId: userInfo.extensionId,
    fullName: userInfo.username,
    username: userInfo.username
      .trim()
      .split(' ')
      .join('.')
      .toLowerCase()
      .replace(/[^a-z0-9_\-.]/g, ''),
    email:
      userInfo.username
        .trim()
        .split(' ')
        .join('.')
        .toLowerCase()
        .replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com',
  };
}

// ==================== 关注后续视觉标识功能 ====================

/**
 * 注入关注后续视觉标识的样式
 */
function injectFollowThreadStyles() {
  if (document.getElementById('follow-thread-styles')) return;

  const style = document.createElement('style');
  style.id = 'follow-thread-styles';
  style.textContent = `
    /* 原消息：👁 图标 + 淡蓝色右边框 */
    .follow-thread-original {
      border-right: 3px solid rgba(96, 165, 250, 0.6) !important;
      position: relative;
    }

    /* 👁 图标容器，放在消息时间左侧 */
    .follow-thread-eye-icon {
      position: absolute;
      top: 8px;
      right: 80px; /* 默认值，会被 JS 动态覆盖 */
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      z-index: 10;
      cursor: help;
      padding: 3px 8px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      white-space: nowrap;
    }

    .follow-thread-eye-icon:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
    }

    .follow-thread-eye-icon .eye-emoji {
      font-size: 14px;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* 原消息浮出层 - 更丰富的内容 */
    .follow-thread-tooltip {
      position: absolute;
      right: 60px;
      background: white;
      color: #333;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 1000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
      min-width: 280px;
      max-width: 360px;
      border: 1px solid #e5e7eb;
    }

    /* 默认显示在下方 */
    .follow-thread-tooltip.position-below {
      top: 30px;
      transform: translateY(-4px);
    }

    /* 空间不足时显示在上方 */
    .follow-thread-tooltip.position-above {
      bottom: 30px;
      transform: translateY(4px);
    }

    /* 下方箭头 */
    .follow-thread-tooltip.position-below::before {
      content: '';
      position: absolute;
      top: -6px;
      right: 20px;
      border: 6px solid transparent;
      border-bottom-color: white;
    }

    .follow-thread-tooltip.position-below::after {
      content: '';
      position: absolute;
      top: -7px;
      right: 20px;
      border: 6px solid transparent;
      border-bottom-color: #e5e7eb;
      z-index: -1;
    }

    /* 上方箭头 */
    .follow-thread-tooltip.position-above::before {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 20px;
      border: 6px solid transparent;
      border-top-color: white;
    }

    .follow-thread-tooltip.position-above::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 20px;
      border: 6px solid transparent;
      border-top-color: #e5e7eb;
      z-index: -1;
    }

    .follow-thread-eye-icon:hover + .follow-thread-tooltip,
    .follow-thread-tooltip:hover {
      opacity: 1;
      pointer-events: auto;
    }

    .follow-thread-tooltip.position-below:hover,
    .follow-thread-eye-icon:hover + .follow-thread-tooltip.position-below {
      transform: translateY(0);
    }

    .follow-thread-tooltip.position-above:hover,
    .follow-thread-eye-icon:hover + .follow-thread-tooltip.position-above {
      transform: translateY(0);
    }

    .tooltip-title {
      font-weight: 600;
      color: #667eea;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tooltip-status-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 500;
    }

    .tooltip-section {
      margin: 10px 0;
    }

    .tooltip-section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #9ca3af;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .tooltip-original-content {
      background: #f9fafb;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: #4b5563;
      line-height: 1.5;
      border-left: 3px solid #667eea;
    }

    .tooltip-related-list {
      margin-top: 10px;
    }

    .tooltip-related-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px dashed #f0f0f0;
    }

    .tooltip-related-item:last-child {
      border-bottom: none;
    }

    .tooltip-related-type {
      font-size: 14px;
      flex-shrink: 0;
    }

    .tooltip-related-info {
      flex: 1;
      min-width: 0;
    }

    .tooltip-related-sender {
      font-weight: 500;
      color: #374151;
      font-size: 11px;
    }

    .tooltip-related-summary {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .tooltip-no-related {
      color: #9ca3af;
      font-size: 11px;
      font-style: italic;
      text-align: center;
      padding: 8px 0;
    }

    /* 关联消息：淡黄色底色 + 关联标识 */
    .follow-thread-related {
      background-color: rgba(255, 254, 240, 0.5) !important;
      position: relative;
    }

    .follow-thread-related-badge {
      position: absolute;
      top: 8px;
      right: 80px; /* 默认值，会被 JS 动态覆盖 */
      background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
      color: white;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      cursor: help;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(156, 39, 176, 0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      white-space: nowrap;
    }

    .follow-thread-related-badge:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 8px rgba(156, 39, 176, 0.4);
    }

    /* 关联类型 Tooltip - 增强版 */
    .follow-thread-related-tooltip {
      position: absolute;
      right: 60px;
      background: white;
      border: 1px solid #e1bee7;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 1000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      min-width: 280px;
      max-width: 360px;
    }

    /* 默认显示在下方 */
    .follow-thread-related-tooltip.position-below {
      top: 30px;
      transform: translateY(-4px);
    }

    /* 空间不足时显示在上方 */
    .follow-thread-related-tooltip.position-above {
      bottom: 30px;
      transform: translateY(4px);
    }

    /* 下方箭头 */
    .follow-thread-related-tooltip.position-below::before {
      content: '';
      position: absolute;
      top: -6px;
      right: 20px;
      border: 6px solid transparent;
      border-bottom-color: white;
    }

    .follow-thread-related-tooltip.position-below::after {
      content: '';
      position: absolute;
      top: -7px;
      right: 20px;
      border: 6px solid transparent;
      border-bottom-color: #e1bee7;
      z-index: -1;
    }

    /* 上方箭头 */
    .follow-thread-related-tooltip.position-above::before {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 20px;
      border: 6px solid transparent;
      border-top-color: white;
    }

    .follow-thread-related-tooltip.position-above::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 20px;
      border: 6px solid transparent;
      border-top-color: #e1bee7;
      z-index: -1;
    }

    .follow-thread-related-badge:hover + .follow-thread-related-tooltip,
    .follow-thread-related-tooltip:hover {
      opacity: 1;
      pointer-events: auto;
    }

    .follow-thread-related-tooltip.position-below:hover,
    .follow-thread-related-badge:hover + .follow-thread-related-tooltip.position-below {
      transform: translateY(0);
    }

    .follow-thread-related-tooltip.position-above:hover,
    .follow-thread-related-badge:hover + .follow-thread-related-tooltip.position-above {
      transform: translateY(0);
    }

    .tooltip-header {
      font-weight: 600;
      color: #9c27b0;
      margin-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tooltip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 6px 0;
      color: #666;
    }

    .tooltip-label {
      font-weight: 500;
      color: #333;
    }

    .tooltip-value {
      color: #9c27b0;
      font-weight: 600;
    }

    .tooltip-original-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }

    .tooltip-original-section .tooltip-section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #9ca3af;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .tooltip-original-preview {
      background: #faf5ff;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11px;
      color: #7c3aed;
      line-height: 1.4;
      border-left: 3px solid #9c27b0;
    }

    .tooltip-original-link {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }

    .tooltip-original-link a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #9c27b0;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 10px;
      background: #faf5ff;
      border-radius: 6px;
      transition: background 0.2s ease;
    }

    .tooltip-original-link a:hover {
      background: #f3e8ff;
      text-decoration: none;
    }

    .tooltip-all-related {
      margin-top: 10px;
    }

    .tooltip-all-related .tooltip-section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #9ca3af;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .tooltip-related-compact {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 6px 0;
      font-size: 11px;
      color: #6b7280;
      border-bottom: 1px dashed #f0f0f0;
    }

    .tooltip-related-compact:last-child {
      border-bottom: none;
    }

    .tooltip-related-compact-icon {
      font-size: 12px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .tooltip-related-compact-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 获取所有关注后续项
 */
async function getFollowThreadItems(): Promise<any[]> {
  try {
    // eslint-disable-next-line no-undef
    const result = await chrome.storage.local.get('concernedItems');
    const items = (result.concernedItems || []).filter(isManualConcernedItem);
    return items.filter((item: any) => item.followThread && item.followConfig);
  } catch (error) {
    console.error('❌ 获取关注后续项失败:', error);
    return [];
  }
}

/**
 * 获取关联类型的文本描述
 */
function getRelationTypeText(type: string): string {
  const map: Record<string, string> = {
    thread_reply: '线程回复',
    mention: '@提及',
    quote: '引用',
    semantic: '语义相关',
  };
  return map[type] || type;
}

/**
 * 获取关联类型的图标
 */
function getRelationTypeIcon(type: string): string {
  const map: Record<string, string> = {
    thread_reply: '💬',
    mention: '@',
    quote: '📝',
    semantic: '🔗',
  };
  return map[type] || '🔗';
}

/**
 * 截断文本，保留指定长度
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 计算消息卡片中时间元素的宽度，返回图标应该的 right 值
 * @param card 消息卡片元素
 * @returns right 值（像素数），如果找不到时间元素则返回默认值
 */
function calculateTimeElementWidth(card: Element): number {
  // 查找时间元素: .conversation-card-head__right 下的 [data-name="time"]
  const timeElement = card.querySelector(
    '.conversation-card-head__right [data-name="time"]',
  );
  if (timeElement) {
    const timeWidth = timeElement.getBoundingClientRect().width;
    // 时间宽度 + 一些间距（8px 右边距 + 8px 与时间的间隔）
    return Math.ceil(timeWidth) + 16;
  }

  // 备选：直接获取 .conversation-card-head__right 的宽度
  const rightSection = card.querySelector('.conversation-card-head__right');
  if (rightSection) {
    const rightWidth = rightSection.getBoundingClientRect().width;
    // 右侧区域宽度 + 间距
    return Math.ceil(rightWidth) + 8;
  }

  // 默认值
  return 120;
}

/**
 * 智能定位 tooltip：检测屏幕空间，决定显示在上方还是下方
 */
function positionTooltip(tooltip: HTMLElement, triggerElement: HTMLElement) {
  // 获取触发元素和视口信息
  const triggerRect = triggerElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // 临时显示 tooltip 以获取其高度
  tooltip.style.visibility = 'hidden';
  tooltip.style.opacity = '1';
  const tooltipRect = tooltip.getBoundingClientRect();
  tooltip.style.visibility = '';
  tooltip.style.opacity = '';

  // 计算下方和上方的可用空间
  const spaceBelow = viewportHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  // 决定显示位置（需要额外 50px 的缓冲空间）
  if (spaceBelow >= tooltipRect.height + 50) {
    // 下方空间足够，显示在下方
    tooltip.classList.add('position-below');
    tooltip.classList.remove('position-above');
  } else if (spaceAbove >= tooltipRect.height + 50) {
    // 下方空间不足但上方空间足够，显示在上方
    tooltip.classList.add('position-above');
    tooltip.classList.remove('position-below');
  } else {
    // 两边空间都不足，选择空间较大的一侧
    if (spaceBelow >= spaceAbove) {
      tooltip.classList.add('position-below');
      tooltip.classList.remove('position-above');
    } else {
      tooltip.classList.add('position-above');
      tooltip.classList.remove('position-below');
    }
  }
}

/**
 * 装饰消息：添加视觉标识
 */
async function decorateFollowThreadMessages() {
  const followItems = await getFollowThreadItems();
  if (followItems.length === 0) return;

  // 获取所有消息卡片
  const messageCards = Array.from(
    document.querySelectorAll('.conversation-card-wrapper[data-id]'),
  );

  for (const card of messageCards) {
    const postId = card.getAttribute('data-id');
    if (!postId) continue;

    // 移除已有的装饰，避免重复
    card.classList.remove('follow-thread-original', 'follow-thread-related');
    const existingTooltip = card.querySelector(
      '.follow-thread-tooltip, .follow-thread-related-tooltip',
    );
    if (existingTooltip) {
      existingTooltip.remove();
    }
    const existingBadge = card.querySelector('.follow-thread-related-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    const existingEyeIcon = card.querySelector('.follow-thread-eye-icon');
    if (existingEyeIcon) {
      existingEyeIcon.remove();
    }

    // 检查是否是原消息
    const originalItem = followItems.find(
      (item: any) => item.followConfig?.originalMessage.postId === postId,
    );

    if (originalItem) {
      // 添加原消息样式
      card.classList.add('follow-thread-original');

      // 计算剩余时间
      const now = Date.now();
      const timeLeft = originalItem.expiredAt - now;
      let timeText = '';
      if (timeLeft <= 0) {
        timeText = '已过期';
      } else {
        const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
        timeText = `${daysLeft}天后过期`;
      }

      // 计算时间元素宽度，动态设置 right 值
      const rightOffset = calculateTimeElementWidth(card);

      // 创建 👁 图标元素（包含过期时间文字）
      const eyeIcon = document.createElement('div');
      eyeIcon.className = 'follow-thread-eye-icon';
      eyeIcon.style.right = `${rightOffset}px`;
      eyeIcon.innerHTML = `<span class="eye-emoji">👁</span> ${timeText}`;
      eyeIcon.title = '正在关注后续';
      card.appendChild(eyeIcon);

      // 获取原消息信息
      const originalMsg = originalItem.followConfig.originalMessage;
      const originalSummary = originalItem.summary || originalMsg.content;
      const relatedMessages = originalItem.followConfig.relatedMessages || [];

      // 创建丰富的浮出层
      const tooltip = document.createElement('div');
      tooltip.className = 'follow-thread-tooltip';

      // 构建关联消息列表
      let relatedListHtml = '';
      if (relatedMessages.length > 0) {
        relatedListHtml = relatedMessages
          .slice(0, 5)
          .map(
            (msg: any) => `
          <div class="tooltip-related-item">
            <span class="tooltip-related-type">${getRelationTypeIcon(msg.relationType)}</span>
            <div class="tooltip-related-info">
              <div class="tooltip-related-sender">${escapeHtml(msg.sender)} · ${getRelationTypeText(msg.relationType)}</div>
              <div class="tooltip-related-summary">${escapeHtml(truncateText(msg.summary || '暂无摘要', 60))}</div>
            </div>
          </div>
        `,
          )
          .join('');

        if (relatedMessages.length > 5) {
          relatedListHtml += `<div class="tooltip-no-related">还有 ${relatedMessages.length - 5} 条关联消息...</div>`;
        }
      } else {
        relatedListHtml = '<div class="tooltip-no-related">暂无关联消息</div>';
      }

      tooltip.innerHTML = `
        <div class="tooltip-title">
          👁 正在关注后续
          <span class="tooltip-status-badge">${timeText}</span>
        </div>
        <div class="tooltip-section">
          <div class="tooltip-section-label">原消息摘要</div>
          <div class="tooltip-original-content">${escapeHtml(truncateText(originalSummary, 100))}</div>
        </div>
        <div class="tooltip-section tooltip-related-list">
          <div class="tooltip-section-label">关联消息 (${relatedMessages.length})</div>
          ${relatedListHtml}
        </div>
      `;
      card.appendChild(tooltip);

      // 智能定位 tooltip
      positionTooltip(tooltip, eyeIcon);

      continue;
    }

    // 检查是否是关联消息
    for (const item of followItems) {
      const relatedMsg = item.followConfig?.relatedMessages.find(
        (msg: any) => msg.postId === postId,
      );

      if (relatedMsg) {
        // 添加关联消息样式
        card.classList.add('follow-thread-related');

        // 计算时间元素宽度，动态设置 right 值
        const rightOffset = calculateTimeElementWidth(card);

        // 添加关联徽章
        const badge = document.createElement('div');
        badge.className = 'follow-thread-related-badge';
        badge.style.right = `${rightOffset}px`;
        badge.textContent = `${getRelationTypeIcon(relatedMsg.relationType)} 关联`;
        card.appendChild(badge);

        // 获取原消息和所有关联消息信息
        const originalMsg = item.followConfig.originalMessage;
        const originalSummary = item.summary || originalMsg.content;
        const allRelatedMessages = item.followConfig.relatedMessages || [];

        // 构建其他关联消息列表（排除当前消息）
        const otherRelated = allRelatedMessages.filter(
          (m: any) => m.postId !== postId,
        );
        let otherRelatedHtml = '';
        if (otherRelated.length > 0) {
          otherRelatedHtml = `
            <div class="tooltip-all-related">
              <div class="tooltip-section-label">其他关联消息 (${otherRelated.length})</div>
              ${otherRelated
                .slice(0, 5)
                .map(
                  (m: any) => `
                <div class="tooltip-related-compact">
                  <span class="tooltip-related-compact-icon">${getRelationTypeIcon(m.relationType)}</span>
                  <span class="tooltip-related-compact-text">${escapeHtml(m.sender)}: ${escapeHtml(truncateText(m.summary || '暂无摘要', 120))}</span>
                </div>
              `,
                )
                .join('')}
              ${otherRelated.length > 5 ? `<div class="tooltip-related-compact" style="color: #9ca3af; padding: 8px 0; text-align: center; font-size: 10px;">还有 ${otherRelated.length - 5} 条...</div>` : ''}
            </div>
          `;
        }

        // 添加详细 Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'follow-thread-related-tooltip';
        tooltip.innerHTML = `
          <div class="tooltip-header">
            ${getRelationTypeIcon(relatedMsg.relationType)} 关注后续的关联消息
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">原消息发送者:</span>
            <span class="tooltip-value">${escapeHtml(originalMsg.sender)}</span>
          </div>
          <div class="tooltip-original-section">
            <div class="tooltip-section-label">原消息摘要</div>
            <div class="tooltip-original-preview">${escapeHtml(truncateText(originalSummary, 80))}</div>
          </div>
          ${otherRelatedHtml}
          <div class="tooltip-original-link">
            <a href="${originalMsg.messageUrl}" target="_blank" onclick="event.stopPropagation();">🔗 查看原消息</a>
          </div>
        `;
        card.appendChild(tooltip);

        // 智能定位 tooltip
        positionTooltip(tooltip, badge);

        break;
      }
    }
  }
}

/**
 * 初始化关注后续视觉标识
 */
export function initFollowThreadVisuals() {
  console.log('🎨 初始化关注后续视觉标识...');

  // 1. 注入样式
  injectFollowThreadStyles();

  // 2. 初次装饰消息
  setTimeout(() => decorateFollowThreadMessages(), 2000);

  // 3. 防抖函数，避免频繁执行
  let decorateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedDecorate = (delay = 500) => {
    if (decorateDebounceTimer) {
      clearTimeout(decorateDebounceTimer);
    }
    decorateDebounceTimer = setTimeout(() => {
      decorateFollowThreadMessages();
      decorateDebounceTimer = null;
    }, delay);
  };

  // 4. 监听 DOM 变化，动态装饰新消息
  const observer = new MutationObserver((mutations) => {
    let shouldRedecorate = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            // 检测新消息卡片
            if (
              node.classList.contains('conversation-card-wrapper') ||
              node.querySelector('.conversation-card-wrapper')
            ) {
              shouldRedecorate = true;
              break;
            }
            // 🆕 检测会话切换：整个消息容器被替换
            if (
              node.classList.contains('conversation-list-content') ||
              node.classList.contains('conversation-list') ||
              node.querySelector('.conversation-list-content') ||
              node.querySelector('.conversation-list')
            ) {
              console.log('🔄 检测到消息容器变化，可能是会话切换');
              shouldRedecorate = true;
              break;
            }
          }
        }
      }
      if (shouldRedecorate) break;
    }

    if (shouldRedecorate) {
      debouncedDecorate(500);
    }
  });

  // 5. 🆕 监听 URL 变化，检测会话切换
  let lastUrl = window.location.href;
  const _urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('🔄 检测到 URL 变化，重新装饰消息...');
      lastUrl = currentUrl;
      // URL 变化后延迟稍长一些，等待消息列表渲染完成
      debouncedDecorate(1000);
    }
  }, 500);

  // 6. 🆕 监听 hashchange 和 popstate 事件（更即时的 URL 变化检测）
  window.addEventListener('hashchange', () => {
    console.log('🔄 hashchange 事件，重新装饰消息...');
    debouncedDecorate(1000);
  });

  window.addEventListener('popstate', () => {
    console.log('🔄 popstate 事件，重新装饰消息...');
    debouncedDecorate(1000);
  });

  // 7. 🆕 监听 body 级别的 DOM 变化，捕获更大范围的变化
  const bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            // 检测主要内容区域被替换
            if (
              node.id === 'app-main-section' ||
              node.classList.contains('conversation-view') ||
              node.querySelector('.conversation-card-wrapper')
            ) {
              console.log('🔄 检测到主内容区域变化，重新装饰消息...');
              debouncedDecorate(800);
              break;
            }
          }
        }
      }
    }
  });

  // 监听 body 的子节点变化
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 8. 监听消息列表容器
  const setupConversationObserver = () => {
    const conversationList = document.querySelector(
      '.conversation-list-content, .conversation-list, [class*="conversation"]',
    );
    if (conversationList) {
      observer.observe(conversationList, {
        childList: true,
        subtree: true,
      });
      console.log('✅ MutationObserver 已启动，监听新消息');
      return true;
    }
    return false;
  };

  if (!setupConversationObserver()) {
    console.warn('⚠️ 未找到消息列表容器，稍后重试...');
    // 5秒后重试
    setTimeout(() => {
      if (setupConversationObserver()) {
        console.log('✅ MutationObserver 已启动（重试成功）');
      }
    }, 5000);
  }

  // 9. 监听 storage 变化，实时更新装饰
  // eslint-disable-next-line no-undef
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.concernedItems) {
      console.log('📦 关注项已更新，重新装饰消息...');
      debouncedDecorate(500);
    }
  });

  // 10. 🆕 监听页面可见性变化，从后台切换回来时重新装饰
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('👁 页面变为可见，重新检查装饰...');
      debouncedDecorate(500);
    }
  });

  console.log('✅ 关注后续视觉标识初始化完成');
}
