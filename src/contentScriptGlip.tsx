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
const ticketCache = new Map<string, { data: JiraTicketDetail | null; timestamp: number; loading?: boolean }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 当前显示的卡片和悬浮状态
let currentCard: HTMLElement | null = null;
let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
let isHoveringCard = false;
let isHoveringTrigger = false;

// JIRA Base URL (从环境配置获取)
let JIRA_BASE_URL = 'https://jira.ringcentral.com';

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
async function fetchJiraTicketDetail(ticketKey: string): Promise<JiraTicketDetail | null> {
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
      ticketKey
    });

    if (response?.success && response.data) {
      ticketCache.set(ticketKey, { data: response.data, timestamp: Date.now() });
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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
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
  if (lowerPriority.includes('highest') || lowerPriority.includes('blocker')) return '#d73a49';
  if (lowerPriority.includes('high') || lowerPriority.includes('critical')) return '#ff5630';
  if (lowerPriority.includes('medium')) return '#ffab00';
  if (lowerPriority.includes('low')) return '#36b37e';
  if (lowerPriority.includes('lowest')) return '#6b778c';
  return '#6b778c';
}

// 创建悬浮卡片
function createJiraCard(ticket: JiraTicketDetail, triggerElement: HTMLElement): HTMLElement {
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
        <span class="jira-card-status" style="background: ${statusColors.bg}; color: ${statusColors.text};">${ticket.status}</span>
        <a href="${ticket.url}" target="_blank" class="jira-card-open-icon" title="在 JIRA 中打开">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
      <div class="jira-card-summary" title="${escapeHtml(ticket.summary)}">${escapeHtml(ticket.summary)}</div>
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
        ${ticket.duedate ? `
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">截止日期</span>
          <span class="jira-card-meta-value ${isOverdue(ticket.duedate) ? 'overdue' : ''}">${new Date(ticket.duedate).toLocaleDateString('zh-CN')}</span>
        </div>
        ` : ''}
        ${ticket.sprint ? `
        <div class="jira-card-meta-item">
          <span class="jira-card-meta-label">Sprint</span>
          <span class="jira-card-meta-value">${escapeHtml(ticket.sprint)}</span>
        </div>
        ` : ''}
      </div>
      
      ${ticket.labels.length > 0 ? `
      <div class="jira-card-labels">
        ${ticket.labels.slice(0, 3).map(label => `<span class="jira-card-label">${escapeHtml(label)}</span>`).join('')}
        ${ticket.labels.length > 3 ? `<span class="jira-card-label-more">+${ticket.labels.length - 3}</span>` : ''}
      </div>
      ` : ''}
      
      ${ticket.components.length > 0 ? `
      <div class="jira-card-components">
        <span class="jira-card-meta-label">组件:</span>
        ${ticket.components.slice(0, 2).map(comp => `<span class="jira-card-component">${escapeHtml(comp)}</span>`).join('')}
        ${ticket.components.length > 2 ? `<span class="jira-card-label-more">+${ticket.components.length - 2}</span>` : ''}
      </div>
      ` : ''}
    </div>
    
    <div class="jira-card-footer">
      <span class="jira-card-footer-text"><img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" /> Personal AI provided</span>
      <span class="jira-card-author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank">Esone</a></span>
    </div>
  `;
  
  // 定位卡片（先添加到 DOM 再定位）
  document.body.appendChild(card);
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
function createLoadingCard(ticketKey: string, triggerElement: HTMLElement): HTMLElement {
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
function createErrorCard(ticketKey: string, triggerElement: HTMLElement): HTMLElement {
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
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION && !cached.loading) {
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
  
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  
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
      margin-left: 2px;
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
  if (linkElement.closest('.jira-ticket-hover-card') || linkElement.closest('[data-jira-card="true"]')) {
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
  
  // 在链接后面插入图标
  linkElement.insertAdjacentElement('afterend', icon);
  
  // 创建一个包装器来统一处理 hover 事件
  const wrapper = document.createElement('span');
  wrapper.className = 'jira-link-wrapper';
  linkElement.parentNode?.insertBefore(wrapper, linkElement);
  wrapper.appendChild(linkElement);
  wrapper.appendChild(icon);
  
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
  if (root instanceof HTMLElement && (root.classList.contains('jira-ticket-hover-card') || root.hasAttribute('data-jira-card'))) {
    return;
  }
  
  // 查找所有指向 JIRA 的链接（排除卡片内的链接）
  const jiraLinks = root.querySelectorAll(`a[href*="${JIRA_BASE_URL}/browse/"]:not(.jira-ticket-hover-card a):not([data-jira-card] a)`);
  
  jiraLinks.forEach(link => {
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
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            scanAndProcessJiraLinks(node);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// 获取消息交互功能配置
async function getMessageReactionConfig(): Promise<MessageReactionConfig> {
  try {
    const result = await chrome.storage.local.get(['envConfig']);
    const config = result.envConfig || {};
    return {
      enableSnooze: config.ENABLE_SNOOZE !== false,      // 默认启用
      enableAutoReply: config.ENABLE_AUTO_REPLY !== false  // 默认启用
    };
  } catch (error) {
    console.log('获取消息交互配置失败，使用默认值');
    return {
      enableSnooze: true,
      enableAutoReply: true
    };
  }
}

// 初始化消息交互功能（包装器）
async function setupMessageReaction() {
  const config = await getMessageReactionConfig();
  console.log('🔔 消息交互功能配置:', config);
  
  // 如果两个功能都禁用，跳过初始化
  if (!config.enableSnooze && !config.enableAutoReply) {
    console.log('🔔 稍后处理和自动答复功能都已禁用，不显示工具栏');
    return;
  }
  
  initMessageReaction(config);
}

// 在页面加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initJiraLinkProcessor, 1000);
    setTimeout(setupMessageReaction, 1500);  // 初始化消息交互功能
  });
} else {
  setTimeout(initJiraLinkProcessor, 1000);
  setTimeout(setupMessageReaction, 1500);  // 初始化消息交互功能
}


// Insert the CSS styles into the DOM
function insertRadarPocCss(styles: string, id: string) {
    // 检查是否已存在具有指定 ID 的样式表
    if (document.getElementById(id)) {
      return; // 如果已存在，直接返回
    }
  
    // 如果不存在，创建并插入新的样式表
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
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
        container
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
        sendResponse({ success: true, data: {
            fullName: userInfo.fullName,
            username: userInfo.username,
            userEmail: userInfo.email,
            extensionId: userInfo.extensionId,
        } });
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
        const config = configStr ? JSON.parse(configStr) : {
            selectGroupNames: "",
            enableMessage: true,
            enableSms: false,
            enableVoicemail: false,
            enableCallTranscript: false,
            enableCalendar: false,
            enableCandidateQuestions: false,
            selectFolderGroupIds: "",
            username: "",
            extensionId: "",
            apiKey: "",
            model: "4o"
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
            .then(data => {
                console.log('数据获取成功:', data);
                sendResponse({ success: true, data });
            })
            .catch(error => {
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
    const accountInfoList = getLocalStorageItem('global.account.ACCOUNT_SESSION_DATA_LIST', {});
  
    const accountInfo = accountUD ? accountInfoList[accountUD] : accountInfoList.find((item:any) => item.displayName != '');
    console.log('accountInfoList', accountInfoList, accountInfo);
    if (accountInfo) return {
      extensionId: accountInfo.extensionId,
      email: accountInfo.email,
      fullName: accountInfo.displayName,
      username: accountInfo.email ? accountInfo.email.trim().split('@')[0] : accountInfo.displayName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
    }
  
    const userInfo = getCurrentUserInfo();
    return {
      extensionId: userInfo.extensionId,
      fullName: userInfo.username,
      username: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
      email: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com'
    };
  }
