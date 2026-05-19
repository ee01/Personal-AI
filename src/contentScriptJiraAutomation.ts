/**
 * Jira Automation 导入功能 Content Script
 * 在Jira automation管理页面添加导入功能
 */

import { getLocalStorageItem, setLocalStorageItem } from "./storage";
import {
  JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES,
  buildJiraAutomationImportedRuleName,
  buildJiraAutomationImportRule,
  buildJiraAutomationImportReviewFindings,
  buildJiraAutomationImportReviewChecklist,
  buildJiraAutomationImportWarnings,
  buildJiraAutomationUniqueImportedRuleName,
  collectJiraAutomationImportReviewSignals,
  isJiraAutomationImportFileSizeAllowed,
  parseJiraAutomationExport,
  summarizeJiraAutomationImportRule,
  type ExportedData,
  type ImportRule,
  type JiraAutomationImportReviewFinding,
  type JiraAutomationImportReviewChecklistItem,
} from './jira-automation-import/transform';
import { 
  parseCronExpression, 
  getNextScheduleDate,
  parseFixedRateConfig,
  formatDaysOfWeekDisplay,
  jiraDaysToJsDays
} from './scheduled-messages/scheduleUtils';
import { jiraFetch } from './jira';

// 检测是否在Jira automation管理页面
function isJiraAutomationPage(): boolean {
  // 检查主页面URL
  if (window.location.pathname.includes('/secure/AutomationProjectAdminAction')) {
    return true;
  }
  
  // 检查iframe内的URL
  if (window.location.pathname.includes('/secure/AutomationProjectAdminAction!iframe.jspa')) {
    return true;
  }
  
  return false;
}

// 从localStorage获取当前ownerId
async function getCurrentOwnerId(): Promise<string> {
  // 首先尝试从localStorage获取
  const ownerId = getLocalStorageItem('ownerId', '');
  if (ownerId && ownerId !== 'radar-poc') {
    console.log('Found ownerId from localStorage:', ownerId);
    return ownerId;
  }
  
  // 如果localStorage中没有，尝试从页面获取（仅在主页面）
  if (window === window.top) {
    const userProfileElement = document.querySelector('#header-details-user-fullname');
    if (userProfileElement) {
      // 从img标签的src属性中获取ownerId
      const imgElement = userProfileElement.querySelector('img');
      if (imgElement) {
        const src = imgElement.getAttribute('src');
        if (src) {
          const ownerIdMatch = src.match(/ownerId=([^&]+)/);
          if (ownerIdMatch && ownerIdMatch[1]) {
            const ownerId = ownerIdMatch[1];
            console.log('Found ownerId from profile image src:', ownerId);
            // 保存到localStorage
            setLocalStorageItem('ownerId', ownerId);
            return ownerId;
          }
        }
      }
    }
  }

  // 如果页面元素中也获取不到，尝试通过API获取（使用统一的认证方法）
  try {
    console.log('Trying to get ownerId from JIRA API...');
    const response = await jiraFetch(window.location.origin + '/rest/api/2/myself', {
      authMode: 'cookie-always',
      requestLabel: 'fetch Jira current user for automation import',
    });
    
    if (response.ok) {
      const userInfo = await response.json();
      const resolvedOwnerId = userInfo.key || userInfo.name || userInfo.accountId;
      if (resolvedOwnerId) {
        console.log('Found ownerId from JIRA API:', resolvedOwnerId);
        // 保存到localStorage
        setLocalStorageItem('ownerId', resolvedOwnerId);
        return resolvedOwnerId;
      }
    } else {
      console.warn('Failed to fetch user info from JIRA API:', response.status, response.statusText);
    }
  } catch (error) {
    console.warn('Error fetching user info from JIRA API:', error);
  }
  
  console.warn('Could not find ownerId');
  return '';
}

// 全局变量存储当前项目ID
interface JiraAutomationProjectContext {
  projectId: string;
  projectKey: string;
  projectTypeKey?: string;
}

declare global {
  interface Window {
    __PERSONAL_AI_PROJECT_ID__?: string;
    __PERSONAL_AI_PROJECT_CONTEXT__?: JiraAutomationProjectContext;
    __PERSONAL_AI_PENDING_NAVIGATION__?: string | null;
  }
}

// 从页面动态获取项目ID
function getProjectId(): string {
  // 如果是iframe，尝试从父页面获取全局变量
  if (window !== window.top) {
    try {
      const parentProjectId = (window.top as any)?.__PERSONAL_AI_PROJECT_ID__;
      if (parentProjectId) {
        console.log('Found project ID from parent window global variable:', parentProjectId);
        return parentProjectId;
      }
    } catch (error) {
      console.log('Cannot access parent window, trying local detection...');
    }
  }
  
  // 动态从页面获取项目ID
  let projectId = '';
  
  // 方案1：从页面全局变量获取
  if (typeof (window as any).WRM !== 'undefined' && (window as any).WRM._unparsedData && (window as any).WRM._unparsedData["project-id"]) {
    projectId = (window as any).WRM._unparsedData["project-id"];
    console.log('Found project ID from WRM._unparsedData:', projectId);
  }
  
  // 方案2：从项目编辑链接中获取projectId
  if (!projectId) {
    const editProjectLink = document.querySelector('#edit_project');
    if (editProjectLink) {
      const href = editProjectLink.getAttribute('href');
      if (href) {
        const pidMatch = href.match(/pid=(\d+)/);
        if (pidMatch && pidMatch[1]) {
          projectId = pidMatch[1];
          console.log('Found project ID from edit project link:', projectId);
        }
      }
    }
  }
  
  // 方案3：尝试其他可能包含projectId的链接
  if (!projectId) {
    const projectLinks = document.querySelectorAll('a[href*="pid="]');
    for (const link of Array.from(projectLinks)) {
      const href = link.getAttribute('href');
      if (href) {
        const pidMatch = href.match(/pid=(\d+)/);
        if (pidMatch && pidMatch[1]) {
          projectId = pidMatch[1];
          console.log('Found project ID from project link:', projectId);
          break;
        }
      }
    }
  }
  
  // 如果在主页面且找到了项目ID，存储到全局变量供iframe使用
  if (projectId && window === window.top) {
    (window as any).__PERSONAL_AI_PROJECT_ID__ = projectId;
    console.log('Stored project ID in global variable:', projectId);
  }
  
  // 如果都找不到，返回空字符串
  if (!projectId) {
    console.warn('Could not find project ID');
  }
  
  return projectId;
}

// 获取项目Key (用于URL构建)
function getProjectKey(): string {
  if (window !== window.top) {
    try {
      const parentProjectKey = window.top?.__PERSONAL_AI_PROJECT_CONTEXT__?.projectKey;
      if (parentProjectKey) {
        console.log('Found projectKey from parent window context:', parentProjectKey);
        return parentProjectKey;
      }
    } catch (error) {
      console.log('Cannot access parent projectKey, trying local detection...');
    }
  }

  // 首先尝试从URL参数获取projectKey
  const urlParams = new URLSearchParams(window.location.search);
  const projectKey = urlParams.get('projectKey');
  if (projectKey) {
    console.log('Found projectKey from URL params:', projectKey);
    return projectKey;
  }
  
  if (typeof (window as any).WRM !== 'undefined' && (window as any).WRM._unparsedData) {
    const wrmProjectKey = (window as any).WRM._unparsedData['project-key'];
    if (wrmProjectKey) {
      console.log('Found projectKey from WRM._unparsedData:', wrmProjectKey);
      return wrmProjectKey;
    }
  }

  try {
    if (window.top && window.top !== window) {
      const parentUrl = new URL(window.top.location.href);
      const parentProjectKey = parentUrl.searchParams.get('projectKey');
      if (parentProjectKey) {
        console.log('Found projectKey from parent URL:', parentProjectKey);
        return parentProjectKey;
      }
    }
  } catch (error) {
    console.log('Cannot access parent URL for projectKey detection');
  }

  console.warn('Could not find projectKey');
  return '';
}

async function resolveCurrentProjectContext(): Promise<JiraAutomationProjectContext | null> {
  if (window !== window.top) {
    try {
      const parentContext = window.top?.__PERSONAL_AI_PROJECT_CONTEXT__;
      if (parentContext?.projectId && parentContext.projectKey) {
        return parentContext;
      }
    } catch (error) {
      console.log('Cannot access parent project context, resolving locally...');
    }
  }

  let projectId = getProjectId();
  let projectKey = getProjectKey();
  let projectTypeKey: string | undefined;

  if (!projectKey && projectId && !/^\d+$/.test(projectId)) {
    projectKey = projectId;
  }

  if (projectKey) {
    try {
      const response = await jiraFetch(`${window.location.origin}/rest/api/2/project/${encodeURIComponent(projectKey)}`, {
        authMode: 'cookie-when-safe',
        requestLabel: `resolve Jira project ${projectKey}`,
      });

      if (!response.ok) {
        console.warn('Failed to resolve project by key:', response.status, response.statusText);
        if (!/^\d+$/.test(projectId)) {
          return null;
        }
      } else {
        const projectInfo = await response.json();
        projectId = String(projectInfo.id || projectId);
        projectKey = String(projectInfo.key || projectKey);
        projectTypeKey = projectInfo.projectTypeKey;
      }
    } catch (error) {
      console.warn('Error resolving project by key:', error);
      if (!/^\d+$/.test(projectId)) {
        return null;
      }
    }
  } else if (!/^\d+$/.test(projectId)) {
    console.warn('Cannot resolve Jira project context without projectKey');
    return null;
  }

  if (!projectId || !/^\d+$/.test(projectId) || !projectKey) {
    console.warn('Resolved Jira project context is incomplete:', { projectId, projectKey });
    return null;
  }

  const context: JiraAutomationProjectContext = { projectId, projectKey, projectTypeKey };
  try {
    window.__PERSONAL_AI_PROJECT_ID__ = projectId;
    window.__PERSONAL_AI_PROJECT_CONTEXT__ = context;
  } catch (error) {
    console.log('Could not store project context on current window:', error);
  }

  return context;
}

// 等待元素出现（预留功能）
function _waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

// 等待iframe加载完成
function waitForIframe(): Promise<Document> {
  return new Promise((resolve, reject) => {
    const iframe = document.querySelector('iframe.automation-page-container') as HTMLIFrameElement;
    if (!iframe) {
      reject(new Error('Iframe not found'));
      return;
    }

    const checkIframeContent = () => {
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc && iframeDoc.readyState === 'complete') {
          resolve(iframeDoc);
        } else {
          setTimeout(checkIframeContent, 100);
        }
      } catch (error) {
        setTimeout(checkIframeContent, 100);
      }
    };

    iframe.addEventListener('load', () => {
      // 检查是否有待跳转的URL
      try {
        if (window.top) {
          const pendingUrl = (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__;
          if (pendingUrl) {
            console.log('Found pending navigation URL on iframe load:', pendingUrl);
            
            // 清除存储的URL
            (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__ = null;
            
            console.log('Executing navigation from iframe load event to:', pendingUrl);
            window.top.location.href = pendingUrl;
            
            return; // 有待跳转URL时，不需要继续执行其他逻辑
          }
        }
      } catch (error) {
        console.error('Error checking pending navigation on iframe load:', error);
      }
      
      checkIframeContent();
    });

    // 如果iframe已经加载，直接检查
    checkIframeContent();
  });
}

// 创建automation rule的API调用（使用统一的认证方法）
async function createAutomationRule(ruleData: ImportRule, projectId: string): Promise<any> {
  try {
    const response = await jiraFetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
      method: 'POST',
      body: ruleData,
      authMode: 'cookie-when-safe',
      requestLabel: 'create Jira automation rule',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating automation rule:', error);
    throw error;
  }
}

// 显示成功消息
function showSuccessMessage(message: string): void {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    document.body.removeChild(successDiv);
  }, 5000);
}

function showInfoMessage(message: string): void {
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #0747A6;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
  `;
  infoDiv.textContent = message;
  document.body.appendChild(infoDiv);

  setTimeout(() => {
    if (document.body.contains(infoDiv)) {
      document.body.removeChild(infoDiv);
    }
  }, 5000);
}

// 显示错误消息
function showErrorMessage(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #f44336;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    word-wrap: break-word;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (document.body.contains(errorDiv)) {
      document.body.removeChild(errorDiv);
    }
  }, 10000);
}

function createDialogButton(doc: Document, text: string, variant: 'primary' | 'secondary'): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText =
    variant === 'primary'
      ? `
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        background: #0052cc;
        color: white;
        cursor: pointer;
        font-weight: 500;
      `
      : `
        padding: 8px 16px;
        border: 1px solid #DFE1E6;
        border-radius: 4px;
        background: white;
        color: #172B4D;
        cursor: pointer;
        font-weight: 500;
      `;
  return button;
}

function getFocusableDialogElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  return Array.from(elements).filter((element) => (
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    element.getClientRects().length > 0
  ));
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement, doc: Document): void {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableDialogElements(dialog);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = doc.activeElement;

  if (!dialog.contains(activeElement)) {
    event.preventDefault();
    firstElement.focus();
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function appendInfoRow(doc: Document, container: HTMLElement, label: string, value: string): void {
  const row = doc.createElement('div');
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px;';

  const labelEl = doc.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = 'flex: 0 0 110px; color: #6B778C; font-size: 13px;';

  const valueEl = doc.createElement('span');
  valueEl.textContent = value || '未提供';
  valueEl.style.cssText = 'flex: 1; color: #172B4D; font-size: 13px; word-break: break-word;';

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  container.appendChild(row);
}

async function getExistingAutomationRuleNames(projectId: string): Promise<string[]> {
  const rules = await getAllProjectRules(projectId);
  return rules
    .map((rule) => (typeof rule?.name === 'string' ? rule.name.trim() : ''))
    .filter(Boolean);
}

function formatReviewSignalValue(count: number, samples: string[]): string {
  if (count === 0) {
    return 'None detected';
  }

  const visibleSamples = samples.slice(0, 2);
  const sampleText = visibleSamples.join(' | ');
  const moreText = count > visibleSamples.length ? `, ${count - visibleSamples.length} more` : '';
  return sampleText ? `${count} to review: ${sampleText}${moreText}` : `${count} to review`;
}

function getChecklistSeverityStyle(severity: JiraAutomationImportReviewChecklistItem['severity']): string {
  if (severity === 'high') {
    return 'background: #FFEBE6; color: #AE2E24; border-color: #FFD2CC;';
  }

  if (severity === 'medium') {
    return 'background: #FFF7D6; color: #7F5F01; border-color: #F5CD47;';
  }

  return 'background: #E9F2FF; color: #0C66E4; border-color: #CCE0FF;';
}

function renderReviewChecklist(
  doc: Document,
  container: HTMLElement,
  items: JiraAutomationImportReviewChecklistItem[],
): void {
  container.textContent = '';

  const title = doc.createElement('div');
  title.textContent = 'Review before enabling';
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = 'The import stays disabled. Use this checklist before enabling the copy in Jira.';
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  items.forEach((item) => {
    const row = doc.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid #EBECF0;
    `;

    const severity = doc.createElement('span');
    severity.textContent = item.severity.toUpperCase();
    severity.style.cssText = `
      align-self: start;
      justify-self: start;
      min-width: 54px;
      text-align: center;
      padding: 2px 6px;
      border: 1px solid;
      border-radius: 3px;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      ${getChecklistSeverityStyle(item.severity)}
    `;

    const content = doc.createElement('div');
    content.style.cssText = 'min-width: 0;';

    const label = doc.createElement('div');
    label.textContent = item.label;
    label.style.cssText = 'font-size: 13px; line-height: 1.35; font-weight: 600; color: #172B4D;';

    const detail = doc.createElement('div');
    detail.textContent = item.detail;
    detail.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-top: 2px; word-break: break-word;';

    content.appendChild(label);
    content.appendChild(detail);
    row.appendChild(severity);
    row.appendChild(content);
    container.appendChild(row);
  });
}

function renderImportOutcomeSummary(
  doc: Document,
  container: HTMLElement,
  importedRuleName: string,
  projectContext: JiraAutomationProjectContext,
  checklist: JiraAutomationImportReviewChecklistItem[],
  sourceAllowsChainedTrigger: boolean,
  preventChainedTrigger: boolean,
): void {
  container.textContent = '';

  const highCount = checklist.filter((item) => item.severity === 'high').length;
  const chainingState = sourceAllowsChainedTrigger
    ? (preventChainedTrigger ? 'chained triggers blocked' : 'chained triggers preserved')
    : 'chained triggers disabled';

  const title = doc.createElement('div');
  title.textContent = 'Disabled import preview';
  title.style.cssText = 'font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #172B4D;';

  const body = doc.createElement('div');
  body.textContent = `${importedRuleName} will be created disabled in ${projectContext.projectKey}. ${formatChecklistSeverityCounts(checklist)}; ${highCount} high-risk item(s); ${chainingState}.`;
  body.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; word-break: break-word;';

  container.appendChild(title);
  container.appendChild(body);
}

function renderReviewFindings(
  doc: Document,
  container: HTMLElement,
  findings: JiraAutomationImportReviewFinding[],
): void {
  container.textContent = '';

  const title = doc.createElement('div');
  title.textContent = 'Detected environment bindings';
  title.style.cssText = 'font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #172B4D;';
  container.appendChild(title);

  const help = doc.createElement('div');
  help.textContent = 'These values are copied into the disabled rule description so they are still visible after import.';
  help.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-bottom: 10px;';
  container.appendChild(help);

  if (findings.length === 0) {
    const empty = doc.createElement('div');
    empty.textContent = 'No JQL, URL, account, sensitive value, custom field, saved filter, connection, smart value, or source-project binding was detected.';
    empty.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F;';
    container.appendChild(empty);
    return;
  }

  findings.forEach((finding) => {
    const row = doc.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid #EBECF0;
    `;

    const severity = doc.createElement('span');
    severity.textContent = finding.severity.toUpperCase();
    severity.style.cssText = `
      align-self: start;
      justify-self: start;
      min-width: 54px;
      text-align: center;
      padding: 2px 6px;
      border: 1px solid;
      border-radius: 3px;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      ${getChecklistSeverityStyle(finding.severity)}
    `;

    const content = doc.createElement('div');
    content.style.cssText = 'min-width: 0;';

    const label = doc.createElement('div');
    label.textContent = `${finding.label} (${finding.count})`;
    label.style.cssText = 'font-size: 13px; line-height: 1.35; font-weight: 600; color: #172B4D;';
    content.appendChild(label);

    const samples = finding.samples.length > 0
      ? finding.samples.join(' | ')
      : 'Review the rule component that owns this binding.';
    const detail = doc.createElement('div');
    detail.textContent = samples;
    detail.style.cssText = 'font-size: 12px; line-height: 1.45; color: #44546F; margin-top: 2px; word-break: break-word;';
    content.appendChild(detail);

    row.appendChild(severity);
    row.appendChild(content);
    container.appendChild(row);
  });
}

function formatChecklistSeverityCounts(items: JiraAutomationImportReviewChecklistItem[]): string {
  const counts = items.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  return [
    counts.high > 0 ? `${counts.high} high` : '',
    counts.medium > 0 ? `${counts.medium} medium` : '',
    counts.low > 0 ? `${counts.low} low` : '',
  ].filter(Boolean).join(', ') || 'No blocking checks detected';
}

function showImportPreviewDialog(
  exportedData: ExportedData,
  file: File,
  projectContext: JiraAutomationProjectContext,
  doc: Document,
  existingRuleNames: string[],
): Promise<{ confirmed: boolean; selectedRuleIndex: number; allowOtherRuleTrigger: boolean }> {
  return new Promise((resolve) => {
    const previousActiveElement = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const overlay = doc.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(9, 30, 66, 0.54);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    `;

    const dialog = doc.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'personal-ai-jira-import-title');
    dialog.tabIndex = -1;
    dialog.style.cssText = `
      width: min(640px, 100%);
      max-height: min(720px, 92vh);
      overflow: auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 28px rgba(9, 30, 66, 0.28);
      color: #172B4D;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      box-sizing: border-box;
    `;

    const title = doc.createElement('h3');
    title.id = 'personal-ai-jira-import-title';
    title.textContent = 'Import Jira Automation Rule';
    title.style.cssText = 'margin: 0 0 12px; font-size: 18px; line-height: 1.3;';
    dialog.appendChild(title);

    const intro = doc.createElement('p');
    intro.textContent = `Found ${exportedData.rules.length} rule(s) in ${file.name}. Select one rule to import into ${projectContext.projectKey}.`;
    intro.style.cssText = 'margin: 0 0 16px; color: #44546F; font-size: 13px; line-height: 1.5;';
    dialog.appendChild(intro);

    const outcomeBox = doc.createElement('div');
    outcomeBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #CCE0FF;
      border-radius: 6px;
      background: #E9F2FF;
    `;
    dialog.appendChild(outcomeBox);

    let selectedRuleIndex = 0;
    let select: HTMLSelectElement | null = null;
    let preventChainedTrigger = Boolean(exportedData.rules[0]?.canOtherRuleTrigger);

    if (exportedData.rules.length > 1) {
      const selectLabel = doc.createElement('label');
      selectLabel.textContent = 'Rule to import';
      selectLabel.style.cssText = 'display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;';
      dialog.appendChild(selectLabel);

      select = doc.createElement('select');
      select.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 16px;
        padding: 8px 10px;
        border: 1px solid #DFE1E6;
        border-radius: 4px;
        background: white;
        color: #172B4D;
        font-size: 14px;
      `;

      exportedData.rules.forEach((rule, index) => {
        const option = doc.createElement('option');
        option.value = String(index);
        option.textContent = `${index + 1}. ${rule.name}`;
        select?.appendChild(option);
      });

      dialog.appendChild(select);
    }

    const details = doc.createElement('div');
    details.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: #F7F8F9;
    `;
    dialog.appendChild(details);

    const findingsBox = doc.createElement('div');
    findingsBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(findingsBox);

    const checklistBox = doc.createElement('div');
    checklistBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;
    dialog.appendChild(checklistBox);

    const safeguardBox = doc.createElement('div');
    safeguardBox.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      background: white;
    `;

    const chainedTriggerLabel = doc.createElement('label');
    chainedTriggerLabel.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; color: #172B4D; font-size: 13px; line-height: 1.45;';

    const chainedTriggerCheckbox = doc.createElement('input');
    chainedTriggerCheckbox.type = 'checkbox';
    chainedTriggerCheckbox.checked = preventChainedTrigger;
    chainedTriggerCheckbox.style.cssText = 'margin-top: 2px;';

    const chainedTriggerText = doc.createElement('span');
    chainedTriggerText.textContent = 'Prevent other automation rules from triggering this imported copy until it has been reviewed.';

    chainedTriggerLabel.appendChild(chainedTriggerCheckbox);
    chainedTriggerLabel.appendChild(chainedTriggerText);
    safeguardBox.appendChild(chainedTriggerLabel);
    dialog.appendChild(safeguardBox);

    const warningBox = doc.createElement('div');
    warningBox.style.cssText = `
      margin-bottom: 18px;
      padding: 12px;
      border-radius: 6px;
      background: #FFFAE6;
      border-left: 3px solid #FFAB00;
    `;
    dialog.appendChild(warningBox);

    const renderRuleDetails = () => {
      const rule = exportedData.rules[selectedRuleIndex];
      const summary = summarizeJiraAutomationImportRule(rule);
      const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
      const reviewChecklist = buildJiraAutomationImportReviewChecklist(rule);
      const reviewFindings = buildJiraAutomationImportReviewFindings(rule);
      const defaultImportedRuleName = buildJiraAutomationImportedRuleName(rule.name);
      const importedRuleName = buildJiraAutomationUniqueImportedRuleName(rule.name, existingRuleNames);
      const importNameWasNumbered = importedRuleName !== defaultImportedRuleName;
      const accountReferenceSamples = [
        ...reviewSignals.emailReferences,
        ...reviewSignals.accountReferences,
      ];
      const accountReferenceCount = summary.emailReferenceCount + summary.accountReferenceCount;
      const sourceAllowsChainedTrigger = Boolean(rule.canOtherRuleTrigger);
      chainedTriggerCheckbox.disabled = !sourceAllowsChainedTrigger;
      chainedTriggerCheckbox.checked = sourceAllowsChainedTrigger && preventChainedTrigger;
      chainedTriggerText.textContent = sourceAllowsChainedTrigger
        ? 'Prevent other automation rules from triggering this imported copy until it has been reviewed.'
        : 'The source rule does not allow other automation rules to trigger it.';
      renderImportOutcomeSummary(
        doc,
        outcomeBox,
        importedRuleName,
        projectContext,
        reviewChecklist,
        sourceAllowsChainedTrigger,
        preventChainedTrigger,
      );

      details.textContent = '';
      appendInfoRow(doc, details, 'Rule name', rule.name);
      appendInfoRow(doc, details, 'Imported name', importedRuleName);
      appendInfoRow(
        doc,
        details,
        'Name collision',
        importNameWasNumbered ? 'Existing import name found; Personal AI will create a numbered copy.' : 'None detected',
      );
      appendInfoRow(doc, details, 'Source state', rule.state || 'UNKNOWN');
      appendInfoRow(doc, details, 'Trigger', rule.trigger?.type || 'UNKNOWN');
      appendInfoRow(doc, details, 'Components', `${summary.componentCount} total`);
      appendInfoRow(doc, details, 'Enablement checks', formatChecklistSeverityCounts(reviewChecklist));
      appendInfoRow(doc, details, 'Review note', 'Added to imported rule description');
      appendInfoRow(doc, details, 'Actions', String(summary.actionCount));
      appendInfoRow(doc, details, 'Conditions', String(summary.conditionCount));
      appendInfoRow(doc, details, 'Web requests', summary.webRequestCount > 0 ? `${summary.webRequestCount} to review` : 'None detected');
      appendInfoRow(doc, details, 'External actions', summary.externalIntegrationCount > 0 ? `${summary.externalIntegrationCount} to review` : 'None detected');
      appendInfoRow(doc, details, 'Secrets', formatReviewSignalValue(summary.secretReferenceCount, reviewSignals.secretReferences));
      appendInfoRow(doc, details, 'JQL / filters', formatReviewSignalValue(summary.jqlReferenceCount, reviewSignals.jqlReferences));
      appendInfoRow(doc, details, 'Hard-coded URLs', formatReviewSignalValue(summary.hardcodedUrlCount, reviewSignals.hardcodedUrls));
      appendInfoRow(doc, details, 'Custom fields', formatReviewSignalValue(summary.customFieldReferenceCount, reviewSignals.customFieldReferences));
      appendInfoRow(doc, details, 'Saved filters', formatReviewSignalValue(summary.savedFilterReferenceCount, reviewSignals.savedFilterReferences));
      appendInfoRow(doc, details, 'Connections', formatReviewSignalValue(summary.connectionReferenceCount, reviewSignals.connectionReferences));
      appendInfoRow(doc, details, 'Sensitive values', formatReviewSignalValue(summary.sensitiveReferenceCount, reviewSignals.sensitiveReferences));
      appendInfoRow(doc, details, 'Smart values', formatReviewSignalValue(summary.smartValueReferenceCount, reviewSignals.smartValueReferences));
      appendInfoRow(doc, details, 'Accounts', formatReviewSignalValue(accountReferenceCount, accountReferenceSamples));
      appendInfoRow(doc, details, 'Source project refs', formatReviewSignalValue(summary.sourceProjectReferenceCount, reviewSignals.sourceProjectReferences));
      appendInfoRow(doc, details, 'Schedule', summary.scheduledTrigger ? 'Scheduled trigger' : 'No scheduled trigger');
      appendInfoRow(
        doc,
        details,
        'Rule chaining',
        sourceAllowsChainedTrigger
          ? (preventChainedTrigger ? 'Blocked in imported copy' : 'Preserved from source')
          : 'Disabled in source',
      );
      appendInfoRow(doc, details, 'Target project', `${projectContext.projectKey} (${projectContext.projectId})`);
      appendInfoRow(doc, details, 'Imported state', 'DISABLED');
      renderReviewFindings(doc, findingsBox, reviewFindings);
      renderReviewChecklist(doc, checklistBox, reviewChecklist);

      warningBox.textContent = '';
      const warnings = buildJiraAutomationImportWarnings(rule);
      if (importNameWasNumbered) {
        warnings.unshift('An existing rule already uses the default imported name. The new copy will be numbered so it stays easy to find.');
      }
      warnings.forEach((warning) => {
        const item = doc.createElement('p');
        item.textContent = warning;
        item.style.cssText = 'margin: 0 0 6px; font-size: 13px; line-height: 1.45;';
        warningBox.appendChild(item);
      });
    };

    select?.addEventListener('change', () => {
      selectedRuleIndex = Number(select?.value || '0');
      preventChainedTrigger = Boolean(exportedData.rules[selectedRuleIndex]?.canOtherRuleTrigger);
      renderRuleDetails();
    });

    chainedTriggerCheckbox.addEventListener('change', () => {
      preventChainedTrigger = chainedTriggerCheckbox.checked;
      renderRuleDetails();
    });
    renderRuleDetails();

    const footer = doc.createElement('div');
    footer.style.cssText = `
      position: sticky;
      bottom: 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin: 12px -24px -24px;
      padding: 12px 24px 24px;
      background: white;
      border-top: 1px solid #EBECF0;
    `;

    const cancelButton = createDialogButton(doc, 'Cancel', 'secondary');
    const confirmButton = createDialogButton(doc, 'Import disabled copy', 'primary');
    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);
    dialog.appendChild(footer);

    const close = (result: { confirmed: boolean; selectedRuleIndex: number; allowOtherRuleTrigger: boolean }) => {
      doc.removeEventListener('keydown', onKeyDown);
      if (doc.body.contains(overlay)) {
        doc.body.removeChild(overlay);
      }
      try {
        previousActiveElement?.focus();
      } catch (error) {
        console.debug('Could not restore Jira import dialog focus:', error);
      }
      resolve(result);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false });
        return;
      }
      trapDialogFocus(event, dialog, doc);
    };

    doc.addEventListener('keydown', onKeyDown);
    cancelButton.addEventListener('click', () => close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false }));
    confirmButton.addEventListener('click', () => {
      const selectedRule = exportedData.rules[selectedRuleIndex];
      close({
        confirmed: true,
        selectedRuleIndex,
        allowOtherRuleTrigger: Boolean(selectedRule.canOtherRuleTrigger) && !preventChainedTrigger,
      });
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close({ confirmed: false, selectedRuleIndex, allowOtherRuleTrigger: false });
      }
    });

    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    (select || cancelButton).focus();
  });
}

// 处理文件导入
function handleFileImport(file: File, projectContext: JiraAutomationProjectContext, doc: Document): void {
  if (!isJiraAutomationImportFileSizeAllowed(file.size)) {
    showErrorMessage(`Import failed: JSON file must be ${JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES / 1024 / 1024}MB or smaller`);
    return;
  }

  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const exportedData = parseJiraAutomationExport(JSON.parse(content));
      const existingRuleNames = await getExistingAutomationRuleNames(projectContext.projectId);
      const previewResult = await showImportPreviewDialog(exportedData, file, projectContext, doc, existingRuleNames);

      if (!previewResult.confirmed) {
        return;
      }

      const ownerId = await getCurrentOwnerId();
      const ruleToImport = exportedData.rules[previewResult.selectedRuleIndex];
      const convertedRule = buildJiraAutomationImportRule(ruleToImport, {
        projectId: projectContext.projectId,
        projectKey: projectContext.projectKey,
        projectTypeKey: projectContext.projectTypeKey,
        ownerId,
        allowOtherRuleTrigger: previewResult.allowOtherRuleTrigger,
        existingRuleNames,
      });

      console.log('Importing rule:', convertedRule);
      showInfoMessage('Creating disabled Jira Automation copy...');

      // 调用API创建rule
      const result = await createAutomationRule(convertedRule, projectContext.projectId);
      console.log('Rule created successfully:', result);
      
      showSuccessMessage(`Automation rule "${ruleToImport.name}" imported as a disabled copy.`);
      
      // 跳转到导入后的automation脚本页面
      if (result && result.id) {
        const ruleUrl = `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${encodeURIComponent(projectContext.projectKey)}#/rule/${encodeURIComponent(String(result.id))}`;
        console.log('Navigating to rule page:', ruleUrl);
        
        setTimeout(() => {
          console.log('Storing navigation URL and refreshing iframe:', ruleUrl);
          
          // 将跳转URL存储到父窗口的属性中
          if (window.top) {
            try {
              (window.top as any).__PERSONAL_AI_PENDING_NAVIGATION__ = ruleUrl;
              console.log('Stored navigation URL in parent window:', ruleUrl);
            } catch (error) {
              console.error('Failed to store navigation URL in parent window:', error);
            }
          }
          
          // 刷新当前iframe页面
          window.location.reload();
        }, 2000);
      } else {
        console.warn('Rule ID not found in response, falling back to page refresh');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error importing rule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorMessage(`Import failed: ${errorMessage}`);
    }
  };
  
  reader.onerror = () => {
    showErrorMessage('Error reading file');
  };
  
  reader.readAsText(file);
}

// 创建Import按钮
const importButtonObservers = new WeakSet<Document>();

function findCreateRuleButton(doc: Document): HTMLElement | null {
  const selectorMatch = doc.querySelector(
    'button[data-testid*="create"][data-testid*="rule"], button[aria-label*="Create rule"], button[title*="Create rule"]',
  );
  if (selectorMatch instanceof HTMLElement) {
    return selectorMatch;
  }

  const buttons = doc.querySelectorAll('button');
  for (const button of Array.from(buttons)) {
    const text = button.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.toLowerCase().includes('create rule')) {
      return button;
    }
  }

  return null;
}

function waitForCreateRuleButton(
  doc: Document,
  projectContext: JiraAutomationProjectContext,
  attempt = 0,
): void {
  if (importButtonObservers.has(doc) || doc.getElementById('import-rule-button') || !doc.body) {
    return;
  }

  importButtonObservers.add(doc);
  const observer = new MutationObserver(() => {
    if (doc.getElementById('import-rule-button')) {
      stopObserving();
      return;
    }

    const button = findCreateRuleButton(doc);
    if (button) {
      stopObserving();
      appendImportButtonNearElement(button, projectContext, doc);
    }
  });

  function stopObserving(): void {
    observer.disconnect();
    importButtonObservers.delete(doc);
  }

  observer.observe(doc.body, { childList: true, subtree: true });
  setTimeout(() => {
    stopObserving();

    if (doc.getElementById('import-rule-button') || !doc.body) {
      return;
    }

    const button = findCreateRuleButton(doc);
    if (button) {
      appendImportButtonNearElement(button, projectContext, doc);
      return;
    }

    if (attempt < 3) {
      waitForCreateRuleButton(doc, projectContext, attempt + 1);
    }
  }, 15000);
}

function createImportButton(iframeDoc: Document, projectContext: JiraAutomationProjectContext): void {
  if (iframeDoc.getElementById('import-rule-button')) {
    console.log('Import rule button already exists');
    return;
  }

  console.log('Looking for Create rule button...');
  const foundButton = findCreateRuleButton(iframeDoc);

  if (!foundButton) {
    console.warn('Create rule button not found yet; waiting for Jira Automation toolbar to render');
    waitForCreateRuleButton(iframeDoc, projectContext);
    return;
  }
  
  appendImportButtonNearElement(foundButton, projectContext, iframeDoc);
}

function appendImportButtonNearElement(referenceElement: HTMLElement, projectContext: JiraAutomationProjectContext, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectContext, iframeDoc);
  
  // 尝试在Create button旁边插入
  if (referenceElement.parentNode) {
    referenceElement.parentNode.insertBefore(importButton, referenceElement.nextSibling);
  }
}

function _appendImportButton(container: HTMLElement, projectContext: JiraAutomationProjectContext, iframeDoc: Document): void {
  const importButton = createImportButtonElement(projectContext, iframeDoc);
  container.appendChild(importButton);
}

function createImportButtonElement(projectContext: JiraAutomationProjectContext, iframeDoc: Document): HTMLElement {
  // 创建隐藏的文件输入元素
  const fileInput = iframeDoc.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.style.display = 'none';
  
  // 创建Import按钮
  const importButton = iframeDoc.createElement('button');
  importButton.textContent = 'Import rule';
  importButton.id = 'import-rule-button';
  importButton.setAttribute('aria-label', `Import a disabled Jira Automation rule into ${projectContext.projectKey}`);
  importButton.style.cssText = `
    margin-left: 8px;
    padding: 8px 16px;
    background-color: #0052cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // 悬停效果
  importButton.addEventListener('mouseenter', () => {
    importButton.style.backgroundColor = '#0065ff';
  });
  
  importButton.addEventListener('mouseleave', () => {
    importButton.style.backgroundColor = '#0052cc';
  });
  
  // 点击事件
  importButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  // 文件选择事件
  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handleFileImport(file, projectContext, iframeDoc);
    }
    fileInput.value = '';
  });
  
  // 创建容器
  const container = iframeDoc.createElement('div');
  container.style.display = 'inline-block';
  container.appendChild(fileInput);
  container.appendChild(importButton);
  
  return container;
}



// 主函数
async function main(): Promise<void> {
  if (!isJiraAutomationPage()) {
    return;
  }
  
  try {
    console.log('Jira Automation Import: Initializing...');
    console.log('Current URL:', window.location.href);
    console.log('Is in iframe:', window !== window.top);
    
    // 如果在iframe内，直接在当前文档中执行
    if (window !== window.top) {
      console.log('Running inside iframe, executing directly...');
      
      const projectContext = await resolveCurrentProjectContext();
      if (!projectContext) {
        console.warn('Project context not found');
        return;
      }
      
      console.log('Project context:', projectContext);
      
      // 等待页面内容加载
      setTimeout(async () => {
        createImportButton(document, projectContext);
        console.log('Import button created in iframe');
        
        // 同时初始化 Schedule 按钮（异步）
        await initScheduleButtons(document, projectContext.projectId);
        console.log('Schedule buttons initialization completed in iframe');
      }, 2000);
      
    } else {
      // 如果在主页面，等待iframe加载
      console.log('Running in main page, waiting for iframe...');

      const ownerId = await getCurrentOwnerId();
      console.log('OwnerId:', ownerId);
      
      const projectContext = await resolveCurrentProjectContext();
      if (!projectContext) {
        console.warn('Project context not found');
        return;
      }
      console.log('Project context:', projectContext);
      
      // 等待iframe加载完成
      const iframeDoc = await waitForIframe();
      console.log('Iframe loaded successfully');
      
      // 等待页面内容加载
      setTimeout(async () => {
        createImportButton(iframeDoc, projectContext);
        console.log('Import button created in main page');
        
        // 同时初始化 Schedule 按钮（异步）
        await initScheduleButtons(iframeDoc, projectContext.projectId);
        console.log('Schedule buttons initialization completed in main page');
      }, 2000);
    }
    
  } catch (error) {
    console.error('Error initializing Jira Automation Import:', error);
  }
}

// 页面加载时执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// 处理SPA导航
let currentUrl = location.href;
const observer = new MutationObserver(() => {
  if (currentUrl !== location.href) {
    currentUrl = location.href;
    if (isJiraAutomationPage()) {
      setTimeout(main, 1000);
    }
  }
});

observer.observe(document, { subtree: true, childList: true });

// =====================================================
// Add to Scheduled Messages 功能
// =====================================================

// 存储已添加按钮的规则 ID，避免重复添加
const addedScheduleButtons = new Set<string>();

// 存储已被 Personal AI 管理的规则 ID（预加载）
const managedRuleIds = new Set<string>();

// 规则信息缓存
interface RuleInfo {
  id: string;
  name: string;
  trigger: any;
  state: string;
}

/**
 * 获取项目的所有规则（直接调用 Jira API）
 */
async function getAllProjectRules(projectId: string): Promise<any[]> {
  try {
    // 使用统一的认证方法
    const response = await jiraFetch(`/rest/cb-automation/latest/project/${projectId}/rule`, {
      authMode: 'cookie-when-safe',
      requestLabel: 'fetch Jira automation rules',
    });
    
    if (!response.ok) {
      console.error('获取规则列表失败:', response.status);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取规则列表失败:', error);
    return [];
  }
}

/**
 * 预加载已被 Personal AI 管理的规则 ID
 * 通过 Jira API 获取所有规则，然后批量检查哪些已在 Scheduled Messages 中
 */
async function preloadManagedRules(projectId: string, projectKey: string): Promise<void> {
  console.log('[Personal AI] 预加载已被管理的规则...');
  
  // 1. 获取项目的所有规则
  const rules = await getAllProjectRules(projectId);
  console.log(`[Personal AI] 获取到 ${rules.length} 个规则`);
  
  if (rules.length === 0) {
    return;
  }
  
  // 2. 为每个规则构建 Automation_Link URL
  const automationLinks = rules.map(rule => {
    const ruleId = String(rule.id);
    return `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${projectKey}#/rule/${ruleId}`;
  });
  
  // 3. 批量检查哪些规则已被管理
  const existsMap = await batchCheckAutomationLinksExist(automationLinks);
  
  // 4. 存储已被管理的规则 ID
  managedRuleIds.clear();
  rules.forEach((rule, index) => {
    const ruleUrl = automationLinks[index];
    if (existsMap.get(ruleUrl)) {
      managedRuleIds.add(String(rule.id));
    }
  });
  
  console.log(`[Personal AI] 已被管理的规则 ID: [${Array.from(managedRuleIds).join(', ')}]`);
}

/**
 * 获取规则详情（通过 background script）
 */
async function getRuleDetails(ruleId: string, projectId: string): Promise<RuleInfo | null> {
  try {
    const rules = await getAllProjectRules(projectId);
    const rule = rules.find((r: any) => String(r.id) === String(ruleId));
    
    if (rule) {
      return {
        id: String(rule.id),
        name: rule.name,
        trigger: rule.trigger,
        state: rule.state
      };
    }
    
    return null;
  } catch (error) {
    console.error('获取规则详情失败:', error);
    return null;
  }
}

/**
 * 获取规则的 Audit Log
 */
async function getRuleAuditLog(ruleId: string, projectId: string): Promise<any[]> {
  try {
    // 使用正确的 API 路径：/rest/cb-automation/latest/audit/{projectId}?limit=50&ruleId={ruleId}&offset=0
    // 使用统一的认证方法
    const response = await jiraFetch(`/rest/cb-automation/latest/audit/${projectId}?limit=50&ruleId=${ruleId}&offset=0`, {
      authMode: 'cookie-when-safe',
      requestLabel: `fetch Jira automation audit log for rule ${ruleId}`,
    });
    
    if (!response.ok) {
      console.warn('获取 Audit Log 失败:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error('获取 Audit Log 失败:', error);
    return [];
  }
}

// 以下函数已移至 scheduleUtils.ts：
// - parseCronExpression
// - parseDaysOfWeek
// - getNextScheduleDate

/**
 * 创建 "Add to Scheduled Messages" 按钮
 * @param isManaged - 是否已被 Personal AI 管理（true = 红色常亮，false = 灰色悬停显示）
 */
function createScheduleButton(ruleId: string, projectId: string, doc: Document, isManaged = false): HTMLElement {
  const button = doc.createElement('button');
  button.className = 'personal-ai-schedule-btn';
  button.setAttribute('data-rule-id', ruleId);
  
  // 使用同一个 icon，通过 CSS filter 实现灰色效果
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  
  // 根据管理状态设置不同的样式和提示
  if (isManaged) {
    // 已管理：红色常亮
    button.title = 'Already managed by Personal AI';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      background-image: url('${iconUrl}');
      background-size: 16px 16px;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      opacity: 1;
      filter: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      vertical-align: middle;
    `;
    
    // 红色常亮 icon 悬停时放大
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    // 点击红色常亮 icon 时提示已存在
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showErrorMessage('此规则已在 Scheduled Messages 中管理');
    });
  } else {
    // 未管理：灰色悬停显示
    button.title = 'Add to Scheduled Messages';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      background-image: url('${iconUrl}');
      background-size: 16px 16px;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      opacity: 0;
      filter: grayscale(100%) brightness(1.2);
      transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
      vertical-align: middle;
    `;
    
    // 灰色 icon 悬停时显示并变为红色+放大
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.filter = 'none';
      button.style.transform = 'scale(1.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '0';
      button.style.filter = 'grayscale(100%) brightness(1.2)';
      button.style.transform = 'scale(1)';
    });
    
    // 点击灰色 icon 时执行添加操作
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleAddToScheduledMessages(ruleId, projectId, doc);
    });
  }
  
  return button;
}

/**
 * 更新按钮状态为已管理状态（红色常亮）
 */
function updateButtonToManagedState(button: HTMLElement, _doc: Document): void {
  button.title = 'Already managed by Personal AI';
  button.style.opacity = '1';
  button.style.transform = 'scale(1)';
  button.style.filter = 'none';
  button.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  
  // 移除所有旧的事件监听器（通过克隆节点）
  const newButton = button.cloneNode(true) as HTMLElement;
  button.parentNode?.replaceChild(newButton, button);
  
  // 添加新的事件监听器
  newButton.addEventListener('mouseenter', () => {
    newButton.style.transform = 'scale(1.2)';
  });
  
  newButton.addEventListener('mouseleave', () => {
    newButton.style.transform = 'scale(1)';
  });
  
  newButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showErrorMessage('此规则已在 Scheduled Messages 中管理');
  });
}

/**
 * 格式化星期显示（用于弹窗展示）
 * @param daysOfWeek Jira格式的星期数组 (1=周日, 2=周一...7=周六)
 */
// formatDaysOfWeekDisplay 已移至 scheduleUtils.ts

/**
 * 显示导入对话框（带 AI 总结）
 */
function showImportDialog(
  ruleInfo: RuleInfo,
  scheduleConfig: any,
  projectId: string,
  doc: Document
): Promise<{ confirmed: boolean; scheduleDate?: string; ruleSummary: string }> {
  return new Promise((resolve) => {
    // 创建遮罩
    const overlay = doc.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 创建对话框
    const dialog = doc.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const projectKey = getProjectKey();
    // ruleUrl 用于可能的未来功能扩展
    const _ruleUrl = `${window.location.origin}/jira/software/c/projects/${projectKey}/automation#/rule/${ruleInfo.id}`;
    
    // 根据配置显示不同内容
    let scheduleInfo = '';
    const showDateInput = false;
    let warningMessage = '';
    
    if (scheduleConfig) {
      // 格式化重复周期显示
      const formatRepeatCycle = () => {
        const daysDisplay = formatDaysOfWeekDisplay(scheduleConfig.daysOfWeek);
        if (daysDisplay) {
          return `${daysDisplay} ${scheduleConfig.scheduleTime || ''}`;
        }
        const unitText = scheduleConfig.repeatUnit === 'Day' ? '天' : scheduleConfig.repeatUnit === 'Week' ? '周' : '月';
        return `每 ${scheduleConfig.repeatEvery} ${unitText} ${scheduleConfig.scheduleTime || ''}`;
      };
      
      // 情况一: scheduled + nosearch - 完整导入，需要转换为 webhook
      if (scheduleConfig.needsWebhookConversion && scheduleConfig.scheduleDate) {
        // FIXED 模式没有 scheduleTime，显示开始日期
        const hasScheduleTime = !!scheduleConfig.scheduleTime;
        scheduleInfo = hasScheduleTime ? `
          <p><strong>执行时间:</strong> ${scheduleConfig.scheduleTime}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
        ` : `
          <p><strong>开始日期:</strong> ${scheduleConfig.scheduleDate}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
        `;
        warningMessage = '✅ 此规则可以在[定时消息管理]中管理 schedule';
      }
      // 情况三: scheduled + jql - 仅展示，不可编辑
      else if (scheduleConfig.executionMode === 'jql' && scheduleConfig.scheduleDate) {
        scheduleInfo = `
          <p><strong>执行时间:</strong> ${scheduleConfig.scheduleTime || '未指定'}</p>
          <p><strong>重复周期:</strong> ${formatRepeatCycle()}</p>
          <p><strong>执行模式:</strong> JQL 查询模式（仅作为引用记录）</p>
        `;
        warningMessage = 'ℹ️ 该规则将以 JQL 模式执行，添加到 Scheduled Messages 后仅可查看和跳转';
      }
      // 其他情况: 仅添加引用
      else {
        scheduleInfo = `
          <p><strong>规则类型:</strong> ${scheduleConfig.executionMode || '其他'} 模式</p>
          <p>此规则将仅作为引用添加，不会导入调度配置</p>
        `;
        warningMessage = 'ℹ️ 仅添加规则链接作为引用，不会修改原规则';
      }
    }
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px; font-size: 18px; color: #172B4D;">Add to Scheduled Messages</h3>
      <div style="margin-bottom: 16px; padding: 12px; background: #F4F5F7; border-radius: 4px;">
        <p style="margin: 0 0 8px;"><strong>规则名称:</strong> ${ruleInfo.name}</p>
        ${scheduleInfo}
      </div>
      <div id="ai-summary-container" style="margin-bottom: 16px; padding: 12px; background: #E3F2FD; border-radius: 4px; border-left: 3px solid #2196F3;">
        <p style="margin: 0 0 4px; font-weight: 500; color: #1976D2;">🤖 AI 规则总结:</p>
        <p id="ai-summary-text" style="margin: 0; font-size: 13px; color: #424242; font-style: italic;">
          正在分析规则内容...
        </p>
      </div>
      ${showDateInput ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">开始日期:</label>
          <input type="date" id="schedule-date-input" 
            value="${scheduleConfig.scheduleDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}"
            style="width: 100%; padding: 8px; border: 1px solid #DFE1E6; border-radius: 4px; box-sizing: border-box;">
        </div>
      ` : ''}
      <div style="margin-bottom: 16px; padding: 12px; background: #FFFAE6; border-radius: 4px; border-left: 3px solid #FFAB00;">
        <p style="margin: 0; font-size: 13px; color: #172B4D;">
          ${warningMessage}
        </p>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #DFE1E6; border-radius: 4px; background: white; cursor: pointer;">取消</button>
        <button id="confirm-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #0052cc; color: white; cursor: pointer;">确认添加</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    
    // 异步获取 AI 总结
    let ruleSummary = `关联的 Jira Automation 规则: ${ruleInfo.name}`;
    const summaryElement = dialog.querySelector('#ai-summary-text') as HTMLParagraphElement;
    
    (async () => {
      try {
        ruleSummary = await summarizeRuleWithLLM(ruleInfo);
        if (summaryElement) {
          summaryElement.textContent = ruleSummary;
          summaryElement.style.fontStyle = 'normal';
        }
      } catch (error) {
        console.error('AI 总结失败:', error);
        if (summaryElement) {
          summaryElement.textContent = `关联的 Jira Automation 规则: ${ruleInfo.name}`;
          summaryElement.style.fontStyle = 'normal';
        }
      }
    })();
    
    // 事件处理
    const cancelBtn = dialog.querySelector('#cancel-btn') as HTMLButtonElement;
    const confirmBtn = dialog.querySelector('#confirm-btn') as HTMLButtonElement;
    const dateInput = dialog.querySelector('#schedule-date-input') as HTMLInputElement;
    
    cancelBtn.addEventListener('click', () => {
      doc.body.removeChild(overlay);
      resolve({ confirmed: false, scheduleDate: undefined, ruleSummary });
    });
    
    confirmBtn.addEventListener('click', () => {
      const scheduleDate = dateInput ? dateInput.value : scheduleConfig?.scheduleDate;
      doc.body.removeChild(overlay);
      resolve({ confirmed: true, scheduleDate, ruleSummary });
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        doc.body.removeChild(overlay);
        resolve({ confirmed: false, scheduleDate: undefined, ruleSummary });
      }
    });
  });
}

/**
 * 检查 Automation_Link 是否已存在于 Scheduled Messages 中
 */
async function checkAutomationLinkExists(automationLink: string): Promise<boolean> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CHECK_AUTOMATION_LINK_EXISTS',
      data: { automationLink }
    });
    return result?.exists || false;
  } catch (error) {
    console.error('检查 Automation_Link 是否存在失败:', error);
    return false;
  }
}

/**
 * 批量检查多个 Automation_Link 是否已存在于 Scheduled Messages 中
 */
async function batchCheckAutomationLinksExist(automationLinks: string[]): Promise<Map<string, boolean>> {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'BATCH_CHECK_AUTOMATION_LINKS_EXIST',
      data: { automationLinks }
    });
    
    // 将结果转换为 Map
    const resultMap = new Map<string, boolean>();
    if (result?.results) {
      Object.entries(result.results).forEach(([link, exists]) => {
        resultMap.set(link, exists as boolean);
      });
    }
    return resultMap;
  } catch (error) {
    console.error('批量检查 Automation_Link 失败:', error);
    return new Map();
  }
}

/**
 * 使用 LLM 总结 Jira Rule 的功能
 * 通过 background script 调用 LLM（content script 无法直接导入模块）
 */
async function summarizeRuleWithLLM(ruleInfo: RuleInfo): Promise<string> {
  try {
    // 构建规则描述
    const triggerType = ruleInfo.trigger?.type || '未知';
    const triggerValue = JSON.stringify(ruleInfo.trigger?.value || {}, null, 2);
    
    const prompt = `请用一句简洁的中文描述以下 Jira Automation 规则的功能：

规则名称：${ruleInfo.name}
触发器类型：${triggerType}
触发器配置：${triggerValue}

要求：用 20-50 字描述这个规则的主要功能，不要包含技术细节。`;
    
    // 通过 background script 调用 LLM
    const result = await chrome.runtime.sendMessage({
      type: 'CALL_LLM_SUMMARIZE',
      data: { prompt }
    });
    
    if (result?.success && result.summary) {
      return result.summary.trim();
    }
    
    // 如果 LLM 调用失败，返回默认描述
    return `关联的 Jira Automation 规则: ${ruleInfo.name}`;
  } catch (error) {
    console.error('LLM 总结规则失败:', error);
    return `关联的 Jira Automation 规则: ${ruleInfo.name}`;
  }
}

/**
 * 处理添加到 Scheduled Messages
 */
async function handleAddToScheduledMessages(ruleId: string, projectId: string, doc: Document): Promise<void> {
  try {
    showLoadingMessage('正在读取规则信息...', doc);
    
    // 获取规则详情
    const ruleInfo = await getRuleDetails(ruleId, projectId);
    if (!ruleInfo) {
      showErrorMessage('无法获取规则信息');
      return;
    }
    
    // 构建 Automation_Link
    const projectKey = getProjectKey();
    const ruleUrl = `${window.location.origin}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${projectKey}#/rule/${ruleId}`;
    
    // 检查是否已存在
    showLoadingMessage('正在检查是否已添加...', doc);
    const alreadyExists = await checkAutomationLinkExists(ruleUrl);
    if (alreadyExists) {
      hideLoadingMessage(doc);
      showErrorMessage('已经添加过了，你可以在定时消息管理界面查看！');
      return;
    }
    
    hideLoadingMessage(doc);
    
    // 分析 trigger 类型
    const trigger = ruleInfo.trigger;
    const isScheduledTrigger = trigger?.type === 'jira.jql.scheduled';
    const executionMode = trigger?.value?.executionMode;
    const schedule = trigger?.value?.schedule;
    
    let scheduleConfig: any = null;
    
    if (isScheduledTrigger && executionMode === 'nosearch') {
      // 情况一：scheduled + nosearch - 完整导入，需要转换为 webhook
      if (schedule?.method === 'CRON') {
        // Cron 模式 - 可以完整解析
        const cronConfig = parseCronExpression(schedule.cronExpression);
        if (cronConfig) {
          const [hours, minutes] = cronConfig.time.split(':').map(Number);
          scheduleConfig = {
            scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
            scheduleTime: cronConfig.time,
            repeatEvery: cronConfig.repeatEvery,
            repeatUnit: cronConfig.repeatUnit,
            daysOfWeek: cronConfig.daysOfWeek, // 传递解析的星期配置
            executionMode: 'nosearch',
            needsWebhookConversion: true
          };
        }
      } else if (schedule?.method === 'FIXED') {
        // FIXED 模式 - 需要从 audit log 获取日期或让用户输入
        showLoadingMessage('正在获取执行历史...', doc);
        const auditLogs = await getRuleAuditLog(ruleId, projectId);
        hideLoadingMessage(doc);
        
        const successLog = auditLogs.find((log: any) => log.category === 'SUCCESS');
        let scheduleDate: string | undefined;
        
        if (successLog && successLog.created) {
          const date = new Date(successLog.created);
          scheduleDate = date.toISOString().split('T')[0];
        }
        
        // 使用共享的 FIXED 配置解析函数
        const fixedConfig = parseFixedRateConfig(schedule);
        
        // 如果 audit log 没有日期，使用今天作为默认值
        const defaultScheduleDate = scheduleDate || new Date().toISOString().split('T')[0];
        
        scheduleConfig = {
          scheduleDate: defaultScheduleDate,
          repeatEvery: fixedConfig.repeatEvery,
          repeatUnit: fixedConfig.repeatUnit,
          executionMode: 'nosearch',
          needsWebhookConversion: true
        };
      }
    } else if (isScheduledTrigger && executionMode === 'jql') {
      // 情况二：scheduled + jql - 仅展示，读取日期和周期到 sheet
      if (schedule?.method === 'CRON') {
        const cronConfig = parseCronExpression(schedule.cronExpression);
        if (cronConfig) {
          const [hours, minutes] = cronConfig.time.split(':').map(Number);
          scheduleConfig = {
            scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
            scheduleTime: cronConfig.time,
            repeatEvery: cronConfig.repeatEvery,
            repeatUnit: cronConfig.repeatUnit,
            daysOfWeek: cronConfig.daysOfWeek, // 传递解析的星期配置
            executionMode: 'jql',
            needsWebhookConversion: false
          };
        }
      } else if (schedule?.method === 'FIXED') {
        // FIXED 模式
        showLoadingMessage('正在获取执行历史...', doc);
        const auditLogs = await getRuleAuditLog(ruleId, projectId);
        hideLoadingMessage(doc);
        
        const successLog = auditLogs.find((log: any) => log.state === 'COMPLETED' || log.state === 'SUCCESS');
        let scheduleDate: string | undefined;
        
        if (successLog && successLog.created) {
          const date = new Date(successLog.created);
          scheduleDate = date.toISOString().split('T')[0];
        }
        
        // 使用共享的 FIXED 配置解析函数
        const fixedConfig = parseFixedRateConfig(schedule);
        
        // 如果 audit log 没有日期，使用今天作为默认值
        const defaultScheduleDate = scheduleDate || new Date().toISOString().split('T')[0];
        
        scheduleConfig = {
          scheduleDate: defaultScheduleDate,
          repeatEvery: fixedConfig.repeatEvery,
          repeatUnit: fixedConfig.repeatUnit,
          executionMode: 'jql',
          needsWebhookConversion: false
        };
      }
    } else {
      // 情况三：其他类型 - 仅添加引用
      scheduleConfig = {
        executionMode: executionMode || 'other',
        needsWebhookConversion: false
      };
    }
    
    // 显示确认对话框（已包含 AI 总结）
    const dialogResult = await showImportDialog(ruleInfo, scheduleConfig, projectId, doc);
    
    if (!dialogResult.confirmed) {
      return;
    }
    
    // 使用弹窗中已生成的 AI 总结
    const ruleSummary = dialogResult.ruleSummary;
    
    showLoadingMessage('正在添加到 Scheduled Messages...', doc);
    
    // 准备消息数据 - 注意 ruleUrl 已在前面定义
    const messageData: any = {
      Topic: `${ruleInfo.name}`,
      Content: ruleSummary,
      Push_Method: 'JiraAutomation',
      Target_Type: 'api',
      // 根据 Jira Rule 的状态设置 Status：ENABLED -> Active, DISABLED -> Paused
      Status: ruleInfo.state === 'ENABLED' ? 'Active' : 'Paused',
      Automation_Link: ruleUrl,
      // 添加 Category，使用项目 key
      Category: projectKey
    };
    scheduleConfig.scheduleDate = dialogResult.scheduleDate || scheduleConfig.scheduleDate;
    
    if (scheduleConfig?.needsWebhookConversion && scheduleConfig.scheduleDate) {
      // 情况一：scheduled + nosearch - 完整导入调度信息，但不立即转换为 webhook
      // webhook 转换延迟到用户在 ScheduledMessagesManager 中确认托管时再执行
      messageData.Schedule_Date = scheduleConfig.scheduleDate;
      messageData.Schedule_Time = scheduleConfig.scheduleTime;
      messageData.Repeat_Every = scheduleConfig.repeatEvery;
      messageData.Repeat_Unit = scheduleConfig.repeatUnit;
      // 如果有多星期配置，转换 Jira 格式 (1-7) 到 JS 格式 (0-6) 并保存
      if (scheduleConfig.daysOfWeek && scheduleConfig.daysOfWeek.length > 0) {
        const jsDays = jiraDaysToJsDays(scheduleConfig.daysOfWeek);
        messageData.Repeat_Days = jsDays.join(',');
        console.log('[Personal AI] 保存多星期配置:', { jiraDays: scheduleConfig.daysOfWeek, jsDays, Repeat_Days: messageData.Repeat_Days });
      }
      // 不设置 AI_Endpoint，留待用户在管理界面确认后再转换
      // 用户可以在 ScheduledMessagesManager 中点击编辑按钮来激活 Personal AI 托管
    } else if (scheduleConfig?.executionMode === 'jql') {
      // 情况二：scheduled + jql - 读取日期和周期到 sheet，作为展示使用
      messageData.Schedule_Date = scheduleConfig.scheduleDate;
      messageData.Schedule_Time = scheduleConfig.scheduleTime;
      messageData.Repeat_Every = scheduleConfig.repeatEvery;
      messageData.Repeat_Unit = scheduleConfig.repeatUnit;
      // 如果有多星期配置，转换并保存
      if (scheduleConfig.daysOfWeek && scheduleConfig.daysOfWeek.length > 0) {
        const jsDays = jiraDaysToJsDays(scheduleConfig.daysOfWeek);
        messageData.Repeat_Days = jsDays.join(',');
      }
      // 不设置 AI_Endpoint，表示仅作为引用
      messageData.Content = `Linked to Jira Automation Rule (JQL Mode, View Only): ${ruleInfo.name}`;
    }
    // 情况三：其他类型 - 仅添加引用，不设置调度信息
    
    // 发送到 background script 添加消息
    console.log('[Personal AI] 发送 ADD_SCHEDULED_MESSAGE 消息:', messageData);
    
    let result: any;
    try {
      result = await chrome.runtime.sendMessage({
        type: 'ADD_SCHEDULED_MESSAGE',
        data: messageData
      });
      console.log('[Personal AI] ADD_SCHEDULED_MESSAGE 响应:', result);
    } catch (sendError) {
      console.error('[Personal AI] 发送消息失败:', sendError);
      hideLoadingMessage(doc);
      showErrorMessage(`发送消息失败: ${sendError instanceof Error ? sendError.message : '未知错误'}`);
      return;
    }
    
    hideLoadingMessage(doc);
    
    if (result && result.success) {
      showSuccessMessage(`已添加到 Scheduled Messages: ${ruleInfo.name}`);
      
      // 将规则 ID 加入已管理列表
      managedRuleIds.add(ruleId);
      console.log(`[Personal AI] 规则 ${ruleId} 已加入 managedRuleIds`);
      
      // 立即更新当前按钮为已管理状态（红色常亮）
      const currentButton = doc.querySelector(`.personal-ai-schedule-btn[data-rule-id="${ruleId}"]`) as HTMLElement;
      if (currentButton) {
        console.log('[Personal AI] 更新按钮为已管理状态（红色常亮）');
        updateButtonToManagedState(currentButton, doc);
      }
    } else {
      const errorMsg = result?.error || (result === undefined ? '未收到响应（可能 background script 未正确处理）' : '未知错误');
      console.error('[Personal AI] 添加失败:', errorMsg, result);
      showErrorMessage(`添加失败: ${errorMsg}`);
    }
    
  } catch (error) {
    hideLoadingMessage(doc);
    console.error('添加到 Scheduled Messages 失败:', error);
    showErrorMessage(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 显示加载消息
 */
function showLoadingMessage(message: string, doc: Document): void {
  hideLoadingMessage(doc);
  
  const loadingDiv = doc.createElement('div');
  loadingDiv.id = 'personal-ai-loading';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #0052cc;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  loadingDiv.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" style="animation: spin 1s linear infinite;">
      <circle cx="8" cy="8" r="6" fill="none" stroke="white" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="8"/>
    </svg>
    <span>${message}</span>
  `;
  
  // 添加旋转动画
  const style = doc.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  doc.head.appendChild(style);
  
  doc.body.appendChild(loadingDiv);
}

/**
 * 隐藏加载消息
 */
function hideLoadingMessage(doc: Document): void {
  const loadingDiv = doc.getElementById('personal-ai-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

/**
 * 为规则列表添加悬停按钮
 * 
 * DOM 结构参考:
 * <tr class="css-1wodie7">
 *   <td class="css-1edgzzu">
 *     <div>
 *       <div draggable="true">
 *         <div class="sc-hzNEM cMGECf">
 *           <div class="sc-LKuAh dxEdMv">...</div>
 *           <span role="presentation">
 *             <span style="display: inline-flex; ...">
 *               <a href="...#/rule/1685">[Esone] AI notify...</a>
 *               <span style="margin-left: 5px;"></span>  <!-- 插入点 -->
 *             </span>
 *           </span>
 *         </div>
 *       </div>
 *     </div>
 *   </td>
 *   ...
 * </tr>
 */
function addScheduleButtonsToRules(doc: Document, projectId: string): void {
  // 查找所有规则链接
  const allLinks = doc.querySelectorAll('a[href*="#/rule/"]');
  
  allLinks.forEach((link) => {
    const href = link.getAttribute('href');
    const match = href?.match(/#\/rule\/(\d+)/);
    
    if (!match) return;
    
    const ruleId = match[1];
    
    // 检查该链接是否已经有按钮了（通过查找父元素中是否已有按钮）
    const linkParent = link.parentElement;
    if (linkParent) {
      const existingButton = linkParent.querySelector('.personal-ai-schedule-btn') as HTMLElement;
      if (existingButton) {
        // 检查按钮的 data-rule-id 是否与当前链接的规则 ID 匹配
        // 如果不匹配，说明 Jira SPA 翻页时复用了 DOM 元素，需要移除旧按钮重新创建
        const buttonRuleId = existingButton.getAttribute('data-rule-id');
        if (buttonRuleId === ruleId) {
          // ID 匹配，保持现有按钮
          return;
        } else {
          // ID 不匹配，移除旧按钮（包括其容器 div）
          const buttonContainer = existingButton.parentElement;
          if (buttonContainer && buttonContainer.style.display === 'inline-block') {
            buttonContainer.remove();
          } else {
            existingButton.remove();
          }
        }
      }
    }
    
    // 找到规则行 <tr>
    const ruleRow = link.closest('tr');
    if (!ruleRow) {
      return;
    }
    
    // 根据预加载的 managedRuleIds 判断是否已被管理
    const isManaged = managedRuleIds.has(ruleId);
    
    // 创建按钮（根据管理状态决定样式）
    const button = createScheduleButton(ruleId, projectId, doc, isManaged);
    
    // 在链接后面的 span 中插入按钮
    if (linkParent) {
      const spacerSpan = linkParent.querySelector('span[style*="margin-left"]');
      if (spacerSpan) {
        spacerSpan.appendChild(button);
      } else {
        link.insertAdjacentElement('afterend', button);
      }
    }
    
    // 添加悬停效果 - 监听整个表格行（仅对灰色未管理按钮）
    if (!isManaged) {
      ruleRow.addEventListener('mouseenter', () => {
        if (button.style.opacity === '0') {
          button.style.opacity = '1';
        }
      });
      
      ruleRow.addEventListener('mouseleave', () => {
        if (button.title === 'Add to Scheduled Messages') {
          button.style.opacity = '0';
        }
      });
    }
    
    addedScheduleButtons.add(ruleId);
  });
}

/**
 * 检查是否已初始化 Scheduled Messages 配置
 */
async function checkScheduledMessagesInitialized(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    const config = result.scheduledMessagesConfig;
    
    if (config && config.sheetId) {
      console.log('[Personal AI] Scheduled Messages 已初始化，sheetId:', config.sheetId);
      return true;
    }
    
    console.log('[Personal AI] Scheduled Messages 未初始化，跳过注入添加按钮');
    return false;
  } catch (error) {
    console.error('[Personal AI] 检查 Scheduled Messages 配置失败:', error);
    return false;
  }
}

/**
 * 初始化 Schedule 按钮功能
 */
async function initScheduleButtons(doc: Document, projectId: string): Promise<void> {
  // 先检查是否已初始化 Scheduled Messages
  const isInitialized = await checkScheduledMessagesInitialized();
  if (!isInitialized) {
    console.log('[Personal AI] 跳过 Schedule 按钮注入（未初始化 Scheduled Messages）');
    return;
  }
  
  // 预加载已被管理的规则 ID（通过 Jira API 获取所有规则，批量检查）
  const projectKey = getProjectKey();
  await preloadManagedRules(projectId, projectKey);
  
  // 初始添加按钮
  addScheduleButtonsToRules(doc, projectId);
  
  // 监听 DOM 变化，为新加载的规则添加按钮
  const scheduleObserver = new MutationObserver(() => {
    addScheduleButtonsToRules(doc, projectId);
  });
  
  scheduleObserver.observe(doc.body, {
    childList: true,
    subtree: true
  });
}

// Schedule 按钮初始化已集成到 main() 函数中
// 与 Import button 共享同一个初始化时机，无需额外的独立入口
