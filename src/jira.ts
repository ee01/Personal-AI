import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

// JIRA 基础配置
const JIRA_BASE_URL = 'https://jira.ringcentral.com';
const JIRA_ISSUE_URL_PATTERNS = [
  '*://*.jira.com/browse/*',
  '*://*.atlassian.net/browse/*',
  '*://jira.ringcentral.com/browse/*',
];
export const JIRA_COOKIE_AUTH_GUARD_MESSAGE = 'PERSONAL_AI_JIRA_COOKIE_AUTH_GUARD';
export const JIRA_PROXY_FETCH_MESSAGE = 'PERSONAL_AI_JIRA_PROXY_FETCH';
export const JIRA_ISSUE_EDIT_STATE_MESSAGE = 'PERSONAL_AI_JIRA_ISSUE_EDIT_STATE';
export const JIRA_SYNC_XSRF_TOKEN_MESSAGE = 'PERSONAL_AI_JIRA_SYNC_XSRF_TOKEN';
export const JIRA_SYNC_XSRF_TOKEN_ALL_MESSAGE = 'PERSONAL_AI_JIRA_SYNC_XSRF_TOKEN_ALL';

export type JiraAuthMode = 'token-only' | 'cookie-when-safe' | 'cookie-always';

export interface JiraFetchAuthOptions {
  authMode?: JiraAuthMode;
  requestLabel?: string;
  syncIssueTokens?: boolean;
}

export interface JiraMemoryFreshnessField {
  propertyKey: 'estimate.dev' | 'estimate.qa' | 'estimate.story_points';
  name: string;
  value: string | null;
  source: 'jira_rest';
  checkedAt: number;
}

const JIRA_MEMORY_FRESHNESS_FIELDS = [
  { id: 'customfield_25757', propertyKey: 'estimate.dev' as const, fallbackName: 'DEV Estimate' },
  { id: 'customfield_25958', propertyKey: 'estimate.qa' as const, fallbackName: 'QA Estimate' },
  { id: 'customfield_10422', propertyKey: 'estimate.story_points' as const, fallbackName: 'Story Points' },
];

// =====================================================
// JIRA 认证工具函数（统一管理 Token 和受控 Cookie 认证）
// =====================================================

// 缓存 Jira token
let cachedJiraToken: string | null = null;

/**
 * 获取 JIRA Token（优先使用配置的 token）
 * @returns token 字符串，如果未配置则返回 null
 */
export async function getJiraToken(): Promise<string | null> {
  if (cachedJiraToken !== null) {
    return cachedJiraToken || null;
  }
  try {
    const envConfig = await getEnvConfig();
    cachedJiraToken = envConfig.JIRA_API_TOKEN || '';
    return cachedJiraToken || null;
  } catch (error) {
    console.log('未配置 Jira Token，将在安全场景下使用 Jira cookie fallback');
    cachedJiraToken = '';
    return null;
  }
}

/**
 * 清除 token 缓存（当用户更新配置时调用）
 */
export function clearJiraTokenCache(): void {
  cachedJiraToken = null;
}

/**
 * 创建 JIRA 请求头。只有显式 token 时才添加 Authorization。
 * @param additionalHeaders 额外的请求头
 * @param overrideToken 可选的覆盖 token（用于调用方明确指定 token 的情况）
 * @returns 请求头对象
 */
export async function createJiraHeaders(
  additionalHeaders: Record<string, string> = {},
  overrideToken?: string
): Promise<Record<string, string>> {
  const token = overrideToken ?? await getJiraToken();
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...additionalHeaders
  };
  
  // 如果有 token，添加 Authorization 头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

function getChromeApi(): typeof chrome | null {
  return typeof chrome !== 'undefined' ? chrome : null;
}

async function queryJiraIssueTabs(): Promise<chrome.tabs.Tab[]> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) return [];

  const tabs = new Map<number, chrome.tabs.Tab>();
  for (const url of JIRA_ISSUE_URL_PATTERNS) {
    try {
      const matchedTabs = await chromeApi.tabs.query({ url });
      matchedTabs.forEach((tab) => {
        if (typeof tab.id === 'number') {
          tabs.set(tab.id, tab);
        }
      });
    } catch (error) {
      console.warn('Failed to query Jira issue tabs:', error);
    }
  }
  return Array.from(tabs.values());
}

async function sendMessageToTab<T>(tabId: number, message: any, timeoutMs = 700): Promise<T | null> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.sendMessage) return null;

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      chromeApi.tabs.sendMessage(tabId, message, (response: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (chromeApi.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export async function notifyJiraIssuePagesToSyncXsrf(): Promise<void> {
  const chromeApi = getChromeApi();

  if (chromeApi?.tabs?.query && chromeApi?.tabs?.sendMessage) {
    const tabs = await queryJiraIssueTabs();
    await Promise.all(
      tabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) => sendMessageToTab(tab.id as number, { type: JIRA_SYNC_XSRF_TOKEN_MESSAGE })),
    );
    return;
  }

  if (chromeApi?.runtime?.sendMessage) {
    try {
      await chromeApi.runtime.sendMessage({ type: JIRA_SYNC_XSRF_TOKEN_ALL_MESSAGE });
    } catch {
      // Best effort only. The issue content script also syncs on user actions.
    }
  }
}

export async function assertJiraCookieAuthAllowed(requestLabel = 'Jira API request'): Promise<void> {
  const chromeApi = getChromeApi();

  if (chromeApi?.tabs?.query && chromeApi?.tabs?.sendMessage) {
    const tabs = await queryJiraIssueTabs();
    const editStates = await Promise.all(
      tabs.map(async (tab) => {
        if (typeof tab.id !== 'number') return null;
        const response = await sendMessageToTab<{
          isEditing?: boolean;
          reason?: string;
          url?: string;
          title?: string;
        }>(tab.id, { type: JIRA_ISSUE_EDIT_STATE_MESSAGE });
        if (!response) {
          return {
            isEditing: true,
            reason: 'open Jira issue page could not be inspected',
            url: tab.url || '',
            title: tab.title || '',
          };
        }
        return response;
      }),
    );

    const blockingState = editStates.find((state) => state?.isEditing);
    if (blockingState) {
      throw new Error(
        `${requestLabel} was paused because a Jira issue page is being edited or cannot be inspected. Save or cancel the Jira edit first, then retry.`,
      );
    }
    return;
  }

  if (chromeApi?.runtime?.sendMessage) {
    const response = await chromeApi.runtime.sendMessage({
      type: JIRA_COOKIE_AUTH_GUARD_MESSAGE,
      requestLabel,
    });
    if (!response?.allowed) {
      throw new Error(response?.reason || `${requestLabel} was paused because Jira cookie auth is not safe right now.`);
    }
  }
}

/**
 * 创建 JIRA 请求配置。默认 token 优先；无 token 时只在安全场景下使用 cookie fallback。
 * @param method HTTP 方法
 * @param additionalHeaders 额外的请求头
 * @param body 请求体（会被 JSON.stringify）
 * @param overrideToken 可选的覆盖 token
 * @returns fetch 请求的 init 配置对象
 */
export async function createJiraFetchInit(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  additionalHeaders: Record<string, string> = {},
  body?: any,
  overrideToken?: string,
  authOptions: JiraFetchAuthOptions = {}
): Promise<RequestInit> {
  const authMode = authOptions.authMode || 'cookie-when-safe';
  const token = overrideToken ?? await getJiraToken();

  if (!token) {
    if (authMode === 'token-only') {
      throw new Error('Jira API token is not configured and cookie fallback is disabled for this request.');
    }
    if (authMode === 'cookie-when-safe') {
      await assertJiraCookieAuthAllowed(authOptions.requestLabel);
    }
  }

  const headers = await createJiraHeaders(additionalHeaders, token || '');
  
  const init: RequestInit = {
    method,
    headers,
    credentials: token ? 'omit' : 'include'
  };
  
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  
  return init;
}

/**
 * 统一的 JIRA API 请求方法
 * token 优先；无 token 时按 authMode 控制 cookie fallback。
 * 
 * @param url 完整的 API URL 或相对路径
 * @param options 请求配置
 * @returns fetch Response
 */
export async function jiraFetch(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    token?: string;  // 可选的覆盖 token
    authMode?: JiraAuthMode;
    requestLabel?: string;
    syncIssueTokens?: boolean;
  } = {}
): Promise<Response> {
  const init = await createJiraFetchInit(
    options.method || 'GET',
    options.headers || {},
    options.body,
    options.token,
    {
      authMode: options.authMode,
      requestLabel: options.requestLabel,
      syncIssueTokens: options.syncIssueTokens,
    },
  );

  const response = await fetch(url, init);
  if (init.credentials === 'include' && options.syncIssueTokens !== false) {
    void notifyJiraIssuePagesToSyncXsrf();
  }
  return response;
}

export interface JiraProxyFetchPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  authMode?: JiraAuthMode;
  requestLabel?: string;
}

export interface JiraProxyFetchResult {
  success: boolean;
  status: number;
  bodyText: string;
  error?: string;
}

/** fetch-like 子集，让代理调用点保持和 `jiraFetch` 一样的写法。 */
export interface JiraProxyResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}

const JIRA_PROXY_FETCH_TIMEOUT_MS = 60_000;

function isSameOriginAsJira(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * MV3 里内容脚本的 fetch 仍受宿主页面的 CORS 约束，所以只有跑在 Jira 站点上的
 * 内容脚本能直接调 Jira REST。其他站点（例如 roadmap-service 页面）必须让
 * service worker 代发请求，否则请求会在发出前就被拦掉。
 */
export async function jiraFetchViaBackground(
  url: string,
  options: Omit<JiraProxyFetchPayload, 'url'> = {},
): Promise<JiraProxyResponse> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.runtime?.sendMessage) {
    throw new Error('扩展消息通道不可用，无法访问 Jira');
  }

  let result: JiraProxyFetchResult | undefined;
  try {
    result = await Promise.race([
      chromeApi.runtime.sendMessage({
        type: JIRA_PROXY_FETCH_MESSAGE,
        ...options,
        url,
      }) as Promise<JiraProxyFetchResult | undefined>,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), JIRA_PROXY_FETCH_TIMEOUT_MS),
      ),
    ]);
  } catch (error: any) {
    throw new Error(
      `扩展后台请求失败：${error?.message || String(error)}（请在 chrome://extensions 重新加载扩展后刷新页面）`,
    );
  }
  if (!result) {
    throw new Error('扩展后台未响应 Jira 请求（请重新加载扩展后刷新页面重试）');
  }
  if (!result.success) {
    throw new Error(result.error || 'Jira 请求失败');
  }

  const bodyText = result.bodyText || '';
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  };
}

/** service worker 侧的代理入口。只允许打到当前配置的 Jira origin。 */
export async function handleJiraProxyFetch(
  payload: JiraProxyFetchPayload,
): Promise<JiraProxyFetchResult> {
  const url = String(payload?.url || '');
  try {
    const baseUrl = await getJiraBaseUrl();
    if (!isSameOriginAsJira(url, baseUrl)) {
      return {
        success: false,
        status: 0,
        bodyText: '',
        error: `代理仅允许访问 ${baseUrl}，已拒绝：${url || '(empty url)'}`,
      };
    }
    const response = await jiraFetch(url, {
      method: payload.method,
      headers: payload.headers,
      body: payload.body,
      authMode: payload.authMode,
      requestLabel: payload.requestLabel,
    });
    return {
      success: true,
      status: response.status,
      bodyText: await response.text(),
    };
  } catch (error: any) {
    return {
      success: false,
      status: 0,
      bodyText: '',
      error: error?.message || String(error),
    };
  }
}

/**
 * 获取 JIRA Base URL
 * 优先从环境配置读取，否则使用默认值
 */
export async function getJiraBaseUrl(): Promise<string> {
  try {
    const envConfig = await getEnvConfig();
    return envConfig.JIRA_BASE_URL || JIRA_BASE_URL;
  } catch {
    return JIRA_BASE_URL;
  }
}

// =====================================================
// 通用 JIRA API 工具函数
// =====================================================

/**
 * 获取当前 JIRA 用户信息
 */
export async function getCurrentUser(): Promise<{ success: boolean; ownerId?: string; accountId?: string; name?: string; error?: string }> {
  try {
    const baseUrl = await getJiraBaseUrl();
    const response = await jiraFetch(`${baseUrl}/rest/api/2/myself`, {
      authMode: 'cookie-always',
      requestLabel: 'fetch Jira current user',
    });
    
    if (!response.ok) {
      return { success: false, error: `获取用户信息失败 (${response.status})` };
    }
    
    const userInfo = await response.json();
    const ownerId = userInfo.key || userInfo.name || userInfo.accountId;
    
    if (!ownerId) {
      return { success: false, error: '无法从用户信息中获取用户标识' };
    }
    
    return { 
      success: true, 
      ownerId,
      accountId: userInfo.accountId,
      name: userInfo.name
    };
  } catch (error: any) {
    return { success: false, error: error.message || '获取用户信息失败' };
  }
}

/**
 * 通过项目 Key 获取项目信息（ID、名称等）
 */
export async function getProjectByKey(projectKey: string): Promise<{ 
  success: boolean; 
  projectId?: string; 
  projectName?: string; 
  project?: any;
  error?: string 
}> {
  try {
    const baseUrl = await getJiraBaseUrl();
    const response = await jiraFetch(`${baseUrl}/rest/api/2/project/${projectKey}`, {
      requestLabel: `fetch Jira project ${projectKey}`,
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: `项目 ${projectKey} 不存在` };
      }
      return { success: false, error: `获取项目信息失败 (${response.status})` };
    }
    
    const projectInfo = await response.json();
    return { 
      success: true, 
      projectId: projectInfo.id, 
      projectName: projectInfo.name,
      project: projectInfo
    };
  } catch (error: any) {
    return { success: false, error: error.message || '获取项目信息失败' };
  }
}

/**
 * 获取单个 JIRA Ticket 的详细信息
 * @param ticketKey Ticket 的 key，如 INIT-23647
 * @returns Ticket 详细信息
 */
export async function getTicketDetail(ticketKey: string): Promise<{
  success: boolean;
  data?: {
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
  };
  error?: string;
}> {
  try {
    const baseUrl = await getJiraBaseUrl();
    const fields = [
      'summary', 'status', 'issuetype', 'priority', 'assignee', 'reporter',
      'created', 'updated', 'duedate', 'resolution', 'labels', 'components',
      'fixVersions', 'customfield_11450', 'customfield_11451', 'customfield_10106',
      'description'
    ].join(',');
    
    const response = await jiraFetch(`${baseUrl}/rest/api/2/issue/${ticketKey}?fields=${fields}`, {
      requestLabel: `fetch Jira ticket ${ticketKey}`,
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: `Ticket ${ticketKey} 不存在` };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: '未授权访问，请先登录 JIRA' };
      }
      return { success: false, error: `获取 Ticket 信息失败 (${response.status})` };
    }
    
    const issue = await response.json();
    const fields_data = issue.fields;
    
    // 处理 Sprint 字段 (customfield_10106)
    let sprintName: string | undefined;
    if (fields_data.customfield_10106 && Array.isArray(fields_data.customfield_10106)) {
      const activeSprint = fields_data.customfield_10106.find((s: any) => s.state === 'active');
      const latestSprint = activeSprint || fields_data.customfield_10106[fields_data.customfield_10106.length - 1];
      if (latestSprint) {
        sprintName = typeof latestSprint === 'string' 
          ? latestSprint.match(/name=([^,]+)/)?.[1] 
          : latestSprint.name;
      }
    }
    
    return {
      success: true,
      data: {
        key: issue.key,
        summary: fields_data.summary || '',
        status: fields_data.status?.name || '',
        statusCategory: fields_data.status?.statusCategory?.key || '',
        issuetype: fields_data.issuetype?.name || '',
        priority: fields_data.priority?.name || '',
        assignee: fields_data.assignee?.displayName || '未分配',
        assigneeAvatar: fields_data.assignee?.avatarUrls?.['24x24'],
        reporter: fields_data.reporter?.displayName || '',
        reporterAvatar: fields_data.reporter?.avatarUrls?.['24x24'],
        created: fields_data.created || '',
        updated: fields_data.updated || '',
        duedate: fields_data.duedate,
        resolution: fields_data.resolution?.name,
        labels: fields_data.labels || [],
        components: (fields_data.components || []).map((c: any) => c.name),
        fixVersions: (fields_data.fixVersions || []).map((v: any) => v.name),
        epicLink: fields_data.customfield_11450,
        epicName: fields_data.customfield_11451,
        storyPoints: fields_data.customfield_10106,
        sprint: sprintName,
        description: fields_data.description?.substring(0, 500),
        url: `${baseUrl}/browse/${issue.key}`
      }
    };
  } catch (error: any) {
    console.error('Error fetching ticket detail:', error);
    return { success: false, error: error.message || '获取 Ticket 信息失败' };
  }
}

/**
 * Reads the Jira fields needed to reconcile ledger estimates. Explicit null is
 * preserved so an omitted page field is never mistaken for an empty Jira value.
 */
export async function getJiraMemoryFreshnessFields(
  ticketKey: string,
): Promise<{ success: boolean; fields?: JiraMemoryFreshnessField[]; error?: string }> {
  try {
    const baseUrl = await getJiraBaseUrl();
    const fieldIds = JIRA_MEMORY_FRESHNESS_FIELDS.map((field) => field.id).join(',');
    const response = await jiraFetch(
      `${baseUrl}/rest/api/2/issue/${encodeURIComponent(ticketKey)}?fields=${fieldIds}&expand=names`,
      { requestLabel: `verify Jira memory fields for ${ticketKey}` },
    );
    if (!response.ok) {
      return { success: false, error: `读取 Jira 当前字段失败 (${response.status})` };
    }
    const issue = await response.json();
    const checkedAt = Math.floor(Date.now() / 1000);
    const names = issue.names || {};
    return {
      success: true,
      fields: JIRA_MEMORY_FRESHNESS_FIELDS.map((field) => {
        const rawValue = issue.fields?.[field.id];
        return {
          propertyKey: field.propertyKey,
          name: typeof names[field.id] === 'string' ? names[field.id] : field.fallbackName,
          value: rawValue === null || rawValue === undefined ? null : String(rawValue),
          source: 'jira_rest' as const,
          checkedAt,
        };
      }),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || '读取 Jira 当前字段失败' };
  }
}

// =====================================================
// JIRA Issues 抓取功能
// =====================================================

// 从 Jira 页面抓取数据
export async function fetchJiraTickets(jql: string): Promise<JiraTicket[]> {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        
        // 监听来自 background script 的消息
        const messageListener = (message: any) => {
            // 只处理匹配的消息类型和请求ID
            if (message.type === 'JIRA_TICKETS_RESULT' && message.requestId === requestId) {
                chrome.runtime.onMessage.removeListener(messageListener);
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    resolve(message.tickets);
                }
                return true; // 只对匹配的消息返回 true
            }
            // 不处理的消息类型，返回 false 或不返回，让其他监听器处理
            return false;
        };
        
        chrome.runtime.onMessage.addListener(messageListener);
        
        // 发送消息给 background script 来创建新标签页
        chrome.runtime.sendMessage({
            type: 'FETCH_JIRA_TICKETS',
            jql,
            requestId
        });
    });
}

// 然后在 FETCH_JIRA_TICKETS 函数中使用 sourceTabId
export async function FETCH_JIRA_TICKETS(jql: string, requestId: string, sourceTabId: number) {
  const envConfig = await getEnvConfig();
  const url = `${envConfig.JIRA_BASE_URL}/issues/?jql=${encodeURIComponent(jql)}&wildcardFlag=true`;
        
  // 创建新标签页
  chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab.id) {
          chrome.tabs.sendMessage(sourceTabId, {
              type: 'JIRA_TICKETS_RESULT',
              requestId,
              error: '无法创建标签页'
          });
          return;
      }

      // 等待页面加载完成
      const checkPageLoad = () => {
          chrome.tabs.get(tab.id!, (updatedTab) => {
              if (updatedTab.status === 'complete') {
                if (updatedTab.url.includes('login') || updatedTab.url.includes('okta')) {
                    chrome.tabs.sendMessage(sourceTabId, {
                        type: 'JIRA_TICKETS_RESULT',
                        requestId,
                        error: 'jira 需要登录，请登录后重新尝试'
                    });
                    setTimeout(() => chrome.tabs.update(tab.id!, { active: true }), 3000);
                    return;
                }
                  // 注入内容脚本
                  chrome.scripting.executeScript({
                      target: { tabId: tab.id! },
                      func: async () => {
                          const allTickets: any[] = [];
                          
                          // 判断是否是Jira Cloud版本，通过检查特定的DOM元素判断
                          const isJiraCloud = !!document.querySelector('table[data-vc="issue-table"]') ||
                                             !!document.querySelector('table[aria-label="Work"]');
                          
                          // 抓取当前页面的tickets
                          function extractTicketsFromCurrentPage(): any[] {
                              const tickets: any[] = [];
                              
                              if (isJiraCloud) {
                                  // Jira Cloud 版本的选择器
                                  const rows = document.querySelectorAll('tr[data-testid="native-issue-table.ui.issue-row"]');
                                  
                                  if (rows && rows.length > 0) {
                                      rows.forEach(row => {
                                          // 获取key - a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]
                                          const keyElement = row.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]');
                                          
                                          // 获取summary - a[data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell"]
                                          const summaryElement = row.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell"]');
                                          
                                          // 获取status - 状态位于有特定class的span中
                                          const statusContainer = row.querySelector('div[data-testid^="issue.fields.status.common.ui.status-lozenge"]');
                                          const statusElement = statusContainer ? statusContainer.querySelector('div._4cvr1h6o') : null;
                                          
                                          // 经办人、报告人和优先级通常位于相应的单元格中
                                          const cells = row.querySelectorAll('td');
                                          let assignee = '', reporter = '', priority = '', created = '', updated = '', duedate = '';
                                          
                                          // 通过位置判断各个字段
                                          if (cells.length >= 11) {
                                              // 假设第5个单元格是assignee
                                              const assigneeText = cells[4].textContent?.trim();
                                              assignee = assigneeText.match(/^(.+?)\1+$/)[1] || assigneeText;
                                              assignee = assignee !== 'Unassigned' ? assignee || '' : '';
                                              
                                              // 假设第6个单元格是reporter
                                              reporter = cells[5].textContent?.trim() || '';
                                              reporter = reporter.match(/^(.+?)\1+$/)[1] || reporter;
                                              
                                              // 假设第7个单元格是priority
                                              priority = cells[6].textContent?.trim() || '';
                                              
                                              // 假设第9个单元格是created
                                              created = cells[8].textContent?.trim() || '';
                                              
                                              // 假设第10个单元格是updated
                                              updated = cells[9].textContent?.trim() || '';
                                              
                                              // 假设第11个单元格是duedate
                                              const dueDateText = cells[10].textContent?.trim();
                                              duedate = dueDateText !== 'None' ? dueDateText || '' : '';
                                          }
                                          
                                          const ticket = {
                                              key: keyElement ? keyElement.textContent?.trim() || '' : '',
                                              summary: summaryElement ? summaryElement.textContent?.trim() || '' : '',
                                              status: statusElement ? statusElement.textContent?.trim() || '' : '',
                                              assignee,
                                              reporter,
                                              priority,
                                              created,
                                              updated,
                                              duedate,
                                              description: '' // Cloud视图中通常不显示描述
                                          };
                                          
                                          tickets.push(ticket);
                                      });
                                  }
                              } else {
                                // 原有的 Jira On-Premise 版本的选择器
                                const rows = document.querySelectorAll('tr.issuerow');
                                  
                                rows.forEach(row => {
                                    const ticket: any = {};
                                    const cells = row.querySelectorAll('td');

                                    cells.forEach(cell => {
                                        if (cell.classList && cell.classList.length > 0) {
                                            let propertyName = cell.classList[0]; // Get the first class name
                                            const img = cell.querySelector('img[alt]');
                                            const value = cell.textContent?.trim() || (img ? img.getAttribute('alt') || '' : '');

                                            // If the class name is 'issuekey', the property in our object should be 'key'
                                            if (propertyName === 'issuekey') propertyName = 'key';
                                            
                                            if (propertyName) { // Ensure propertyName is not empty
                                               ticket[propertyName] = value;
                                            }
                                        }
                                    });

                                    // Ensure essential non-optional fields from JiraTicket are present, even if empty
                                    ticket.key = ticket.key || '';
                                    ticket.summary = ticket.summary || '';
                                    ticket.status = ticket.status || '';
                                    
                                    tickets.push(ticket);
                                });
                              }
                              
                              return tickets;
                          }
                          
                          // 查找下一页按钮
                          function getNextPageButton(): HTMLElement | null {
                              // Jira Cloud 的下一页按钮选择器
                              const cloudNextButton = document.querySelector('button[aria-label="Next"]') as HTMLElement;
                              if (cloudNextButton && !cloudNextButton.hasAttribute('disabled')) {
                                  return cloudNextButton;
                              }
                              
                              // Jira On-Premise 的下一页按钮选择器
                              const onPremiseNextButton = document.querySelector('a.nav-next') as HTMLElement;
                              if (onPremiseNextButton && !onPremiseNextButton.classList.contains('nav-disabled')) {
                                  return onPremiseNextButton;
                              }
                              
                              return null;
                          }
                          
                          // 等待页面加载完成，并确保页面真正切换了
                          function waitForPageLoad(previousFirstKey: string): Promise<void> {
                              return new Promise((resolve) => {
                                  const checkLoading = () => {
                                      // 检查 Jira Cloud 加载指示器
                                      const cloudLoader = document.querySelector('[data-testid="native-issue-table.ui.issue-table-container"] [role="progressbar"]');
                                      
                                      // 检查 Jira On-Premise 加载指示器
                                      const onPremiseLoader = document.querySelector('.loading, .aui-restfultable-loading');
                                      
                                      if (!cloudLoader && !onPremiseLoader) {
                                          // 额外检查：确保页面真正切换了（第一条数据的key不同）
                                          const checkPageChanged = () => {
                                              let currentFirstKey = '';
                                              
                                              if (isJiraCloud) {
                                                  const firstRow = document.querySelector('tr[data-testid="native-issue-table.ui.issue-row"]');
                                                  const keyElement = firstRow?.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]');
                                                  currentFirstKey = keyElement?.textContent?.trim() || '';
                                              } else {
                                                  const firstRow = document.querySelector('tr.issuerow');
                                                  const keyCell = firstRow?.querySelector('td.issuekey');
                                                  currentFirstKey = keyCell?.textContent?.trim() || '';
                                              }
                                              
                                              if (currentFirstKey && currentFirstKey !== previousFirstKey) {
                                                  // 页面已经切换，额外等待一点时间确保DOM更新完成
                                                  setTimeout(resolve, 300);
                                              } else if (!previousFirstKey) {
                                                  // 第一次加载，没有previousFirstKey，直接继续
                                                  setTimeout(resolve, 300);
                                              } else {
                                                  // 页面还没切换，继续等待
                                                  setTimeout(checkPageChanged, 200);
                                              }
                                          };
                                          checkPageChanged();
                                      } else {
                                          setTimeout(checkLoading, 200);
                                      }
                                  };
                                  checkLoading();
                              });
                          }
                          
                          // 主循环：抓取所有页面
                          let currentPage = 1;
                          const maxPages = 100; // 设置最大页数限制，防止无限循环
                          const ticketKeySet = new Set<string>(); // 用于去重
                          
                          while (currentPage <= maxPages) {
                              console.log(`正在抓取第 ${currentPage} 页...`);
                              
                              // 获取当前页第一条数据的key，用于后续验证页面是否切换
                              let currentFirstKey = '';
                              if (isJiraCloud) {
                                  const firstRow = document.querySelector('tr[data-testid="native-issue-table.ui.issue-row"]');
                                  const keyElement = firstRow?.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]');
                                  currentFirstKey = keyElement?.textContent?.trim() || '';
                              } else {
                                  const firstRow = document.querySelector('tr.issuerow');
                                  const keyCell = firstRow?.querySelector('td.issuekey');
                                  currentFirstKey = keyCell?.textContent?.trim() || '';
                              }
                              
                              // 抓取当前页
                              const currentPageTickets = extractTicketsFromCurrentPage();
                              
                              // 去重并添加
                              let addedCount = 0;
                              currentPageTickets.forEach(ticket => {
                                  if (ticket.key && !ticketKeySet.has(ticket.key)) {
                                      ticketKeySet.add(ticket.key);
                                      allTickets.push(ticket);
                                      addedCount++;
                                  }
                              });
                              
                              console.log(`第 ${currentPage} 页抓取到 ${currentPageTickets.length} 条数据，去重后新增 ${addedCount} 条，累计 ${allTickets.length} 条`);
                              
                              // 查找下一页按钮
                              const nextButton = getNextPageButton();
                              
                              if (!nextButton) {
                                  console.log('没有下一页，抓取完成');
                                  break;
                              }
                              
                              // 点击下一页
                              nextButton.click();
                              currentPage++;
                              
                              // 等待新页面加载完成，并确保页面真正切换了
                              await waitForPageLoad(currentFirstKey);
                          }
                          
                          if (currentPage > maxPages) {
                              console.warn(`已达到最大页数限制 (${maxPages})，停止抓取`);
                          }
                          
                          console.log(`所有页面抓取完成，共 ${currentPage - 1} 页，总计 ${allTickets.length} 条唯一数据`);
                          
                          return allTickets;
                      }
                  }, (results) => {
                    // 处理结果
                    if (results && results[0] && results[0].result) {
                      // 对summary字段进行额外处理，确保干净的文本
                      results[0].result = results[0].result.map(ticket => ({
                        ...ticket,
                        summary: ticket.summary.split('\n').map((s: string) => s.trim()).filter(Boolean).pop() || ticket.summary,
                      }));
                      
                      chrome.tabs.sendMessage(sourceTabId, {
                        type: 'JIRA_TICKETS_RESULT',
                        requestId,
                        tickets: results[0].result
                      });
                    } else {
                      // 如果没有结果
                      chrome.tabs.sendMessage(sourceTabId, {
                        type: 'JIRA_TICKETS_RESULT',
                        requestId,
                        tickets: []
                      });
                    }
                    
                    // 关闭 Jira 标签页
                    chrome.tabs.remove(tab.id!);
                  });
              } else {
                  setTimeout(checkPageLoad, 100);
              }
          });
      };
      
      checkPageLoad();
  });
}
