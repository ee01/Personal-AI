/**
 * Jira内容脚本 - 设计链接显示功能
 * 在Jira ticket页面上显示设计链接
 */

import {
  JIRA_ISSUE_EDIT_STATE_MESSAGE,
  JIRA_SYNC_XSRF_TOKEN_MESSAGE,
  JiraAuthMode,
  jiraFetch,
} from './jira';
import {
  DesignDisplayItem,
  DesignLinkCandidate,
  UXTicketReference,
  dedupeDesignData,
  escapeAttribute,
  escapeHtml,
  extractDesignLinks,
  formatDesignStatusLabel,
  getDesignDisplayLabel,
  getDesignDisplayStatusTone,
  getDesignReadinessDecision,
  getDesignStatusSummary,
  getDesignStatusTone,
  getDesignSourceLabel,
  getUXEpicStatusTone,
  isMeaningfulDesignTitle,
  mergeDesignSources,
  matchesProjectPattern,
  normalizeDesignUrl,
  parseDesignDomainPatterns,
  sortDesignDisplayItems,
} from './jiraDesignLinks';
import { getEnvConfig } from './utils';

type JiraIssueContext = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  designLink: string | null;
  epicKey: string | null;
  dueDate: string | null;
  fixVersion: string | null;
};

type UXDesignContext = {
  summary: string;
  issueType: string;
  status: string;
  designLink: string | null;
  designLinks: DesignLinkCandidate[];
  epicKey: string | null;
  dueDate: string | null;
  fixVersion: string | null;
  uxEpicKey?: string;
  uxEpicStatus?: string;
  uxEta?: string;
  uxEtaSource?: 'duedate' | 'fixVersion';
};

const jiraIssueContextCache = new Map<string, Promise<JiraIssueContext | null>>();
const uxDesignContextCache = new Map<string, Promise<UXDesignContext | null>>();
const jiraRemoteDesignLinksCache = new Map<string, Promise<DesignLinkCandidate[]>>();
let mainRunSequence = 0;
let jiraCookieFallbackSkipLogged = false;
let jiraXsrfSynchronizerStarted = false;
let lastSyncedJiraXsrfToken = '';
let jiraDesignFetchToken = '';
const JIRA_DESIGN_CONFIG_TIMEOUT_MS = 1200;

function getJiraXsrfCookieToken(): string {
  const rawValue = document.cookie
    .split('; ')
    .find((value) => value.startsWith('atlassian.xsrf.token='))
    ?.split('=')
    .slice(1)
    .join('=') || '';

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function injectJiraXsrfTokenIntoPageContext(token: string): void {
  const script = document.createElement('script');
  script.textContent = `
    (() => {
      const token = ${JSON.stringify(token)};
      try {
        if (window.AJS?.Meta?.set) {
          window.AJS.Meta.set('atl-token', token);
          window.AJS.Meta.set('ajs-atl-token', token);
        }
      } catch (_) {}
      try {
        window.atl_token = () => token;
      } catch (_) {}
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function syncJiraXsrfTokenFromCookie(): { token: string; changed: number } {
  const token = getJiraXsrfCookieToken();
  if (!token) return { token: '', changed: 0 };

  let changed = 0;
  document.querySelectorAll<HTMLInputElement>('input[name="atl_token"]').forEach((input) => {
    if (input.value !== token) {
      input.value = token;
      input.setAttribute('value', token);
      changed += 1;
    }
  });

  document
    .querySelectorAll<HTMLMetaElement>('meta[name="atl-token"], meta[name="ajs-atl-token"]')
    .forEach((meta) => {
      if (meta.content !== token) {
        meta.content = token;
        meta.setAttribute('content', token);
        changed += 1;
      }
    });

  if (changed > 0 || lastSyncedJiraXsrfToken !== token) {
    injectJiraXsrfTokenIntoPageContext(token);
    lastSyncedJiraXsrfToken = token;
  }

  return { token, changed };
}

function isVisibleElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function getJiraIssueEditState(): { isEditing: boolean; reason: string | null; url: string; title: string } {
  const activeElement = document.activeElement as HTMLElement | null;
  const focusedEditable = activeElement?.matches(
    'input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), [contenteditable="true"], .select2-input',
  );
  if (focusedEditable) {
    return { isEditing: true, reason: 'focused editable control', url: location.href, title: document.title };
  }

  const visibleDialog = Array.from(
    document.querySelectorAll(
      '.aui-dialog2[open], .aui-dialog2.aui-layer[aria-hidden="false"], .aui-dialog:not([aria-hidden="true"]), .jira-dialog',
    ),
  ).find(isVisibleElement);
  if (visibleDialog) {
    return { isEditing: true, reason: 'visible Jira dialog', url: location.href, title: document.title };
  }

  const activeInlineEditor = Array.from(
    document.querySelectorAll('.editable-field.active, .editable-field.editing, .field-edit, .issue-field-edit'),
  ).find(isVisibleElement);
  if (activeInlineEditor) {
    return { isEditing: true, reason: 'active inline editor', url: location.href, title: document.title };
  }

  return { isEditing: false, reason: null, url: location.href, title: document.title };
}

function startJiraXsrfTokenSynchronizer(): void {
  if (jiraXsrfSynchronizerStarted) return;
  jiraXsrfSynchronizerStarted = true;

  const sync = () => {
    if (isJiraTicketPage()) {
      syncJiraXsrfTokenFromCookie();
    }
  };

  sync();
  window.setInterval(sync, 1000);
  ['click', 'submit', 'focusin', 'keydown', 'input'].forEach((eventName) => {
    document.addEventListener(eventName, sync, true);
  });

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

async function fetchJiraRead(
  url: string,
  requestLabel: string,
  authMode: JiraAuthMode = 'cookie-always',
): Promise<Response | null> {
  try {
    const response = await jiraFetch(url, {
      method: 'GET',
      authMode,
      token: jiraDesignFetchToken,
      requestLabel,
    });
    syncJiraXsrfTokenFromCookie();
    return response;
  } catch (error) {
    if (!jiraCookieFallbackSkipLogged) {
      console.warn(
        'Personal AI Jira content script skipped Jira REST cookie fallback while Jira issue editing is not safe.',
        error,
      );
      jiraCookieFallbackSkipLogged = true;
    }
    return null;
  }
}

async function getJiraDesignFeatureConfig(): Promise<Awaited<ReturnType<typeof getEnvConfig>> | null> {
  const configPromise = getEnvConfig().catch(error => {
    console.warn('Jira design links falling back after config read failed:', error);
    return null;
  });
  const timeoutPromise = new Promise<null>(resolve => {
    window.setTimeout(() => resolve(null), JIRA_DESIGN_CONFIG_TIMEOUT_MS);
  });
  const config = await Promise.race([configPromise, timeoutPromise]);
  if (!config) {
    console.warn('Jira design links continuing with default config after config read timeout or failure');
  }
  return config;
}

// 检测页面是否是Jira ticket详情页
function isJiraTicketPage(): boolean {
  return parseJiraIssueKeyFromPath(window.location.pathname) !== null;
}

// 从DOM获取当前ticket ID
function getTicketIdFromUrl(): string {
  return parseJiraIssueKeyFromPath(window.location.pathname) || '';
}

function parseJiraIssueKeyFromPath(pathname: string): string | null {
  const match = pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/i);
  return match?.[1]?.toUpperCase() || null;
}

// 从DOM中查找Parent Link
function getParentLinkFromDOM(): { key: string; url: string } | null {
  // 查找customfield_15751字段
  const parentLinkElement = document.querySelector('#customfield_15751-val');
  if (parentLinkElement) {
    const linkElement = parentLinkElement.querySelector('a');
    if (linkElement) {
      return {
        key: linkElement.textContent.trim(),
        url: linkElement.href
      };
    }
  }
  return null;
}

// 从DOM中查找上级Epic ticket
function getParentEpicFromDOM(): { key: string; url: string, name: string } | null {
  // 查找Epic Link字段
  const epicLinkElement = document.querySelector('#customfield_11450-val');
  if (epicLinkElement) {
    const linkElement = epicLinkElement.querySelector('a');
    if (linkElement) {
      return {
        name: linkElement.textContent.trim(),
        key: linkElement.href.split('/').pop() || '',
        url: linkElement.href
      };
    }
  }
  return null;
}

function createDirectDesignItem(candidate: DesignLinkCandidate, source: string): Exclude<DesignDisplayItem, { type: 'ux_ticket' }> {
  if (candidate.tool === 'figma') {
    return {
      type: 'figma',
      url: candidate.url,
      source,
      title: candidate.title,
      label: candidate.label,
      status: candidate.status
    };
  }

  return {
    type: 'design_link',
    url: candidate.url,
    source,
    tool: candidate.tool,
    label: candidate.label,
    title: candidate.title,
    status: candidate.status
  };
}

function getDescriptionLinkTitle(link: HTMLAnchorElement): string | undefined {
  const candidates = [
    link.textContent,
    link.getAttribute('title'),
    link.getAttribute('aria-label'),
  ]
    .map(value => value?.replace(/\s+/g, ' ').trim())
    .filter((value): value is string => Boolean(value));

  return candidates.find(isMeaningfulDesignTitle) || candidates[0] || undefined;
}

function getCandidateDesignLabel(candidate: DesignLinkCandidate): string {
  return isMeaningfulDesignTitle(candidate.title) ? candidate.title!.trim() : candidate.label;
}

// 从DOM description中查找设计链接
function getDesignLinksFromDescription(
  extraDesignDomains: string[] = [],
): Exclude<DesignDisplayItem, { type: 'ux_ticket' }>[] {
  const designLinks: Exclude<DesignDisplayItem, { type: 'ux_ticket' }>[] = [];
  const seenUrls = new Set<string>();

  const addCandidate = (candidate: DesignLinkCandidate | null): void => {
    if (!candidate || seenUrls.has(candidate.url)) return;
    seenUrls.add(candidate.url);
    designLinks.push(createDirectDesignItem(candidate, 'description'));
  };
  
  // 查找description字段
  const descriptionElement = document.querySelector('#description-val') as HTMLElement;
  if (descriptionElement) {
    const text = descriptionElement.innerText || descriptionElement.textContent || '';
    const links = descriptionElement.querySelectorAll('a');
    
    // 从链接元素中查找设计链接
    links.forEach(link => {
      const linkTitle = getDescriptionLinkTitle(link);
      extractDesignLinks(link.href, false, extraDesignDomains)
        .map(candidate => ({ ...candidate, title: linkTitle || candidate.title }))
        .forEach(addCandidate);
    });
    
    extractDesignLinks(text, false, extraDesignDomains).forEach(addCandidate);
  }
  
  return designLinks;
}

function getCompactElementText(element: Element | null): string {
  if (!element) return '';
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function getNativeDesignCard(link: HTMLAnchorElement): HTMLElement {
  const selectors = [
    '[data-testid*="design" i]',
    '[data-test-id*="design" i]',
    '[aria-label*="design" i]',
    '[class*="design" i]',
    'li',
    '[role="listitem"]',
    'article',
    'section',
  ];

  for (const selector of selectors) {
    const closest = link.closest(selector);
    if (!(closest instanceof HTMLElement)) continue;
    if (closest.closest('#description-val, .design-links-container, .backend-progress-container')) continue;
    const text = getCompactElementText(closest);
    if (text.length <= 800) return closest;
  }

  return link;
}

function extractNativeDesignStatus(text: string): string | undefined {
  const normalizedText = text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const statusPatterns: Array<[RegExp, string]> = [
    [/\bnot\s+ready\s+for\s+(?:dev|development|handoff|implementation)\b/i, 'Not ready for dev'],
    [/\bready\s+for\s+(?:dev|development|handoff|implementation)\b/i, 'Ready for dev'],
    [/\bdesign\s+updated\b/i, 'Design updated'],
    [/\bready\s+for\s+review\b/i, 'Ready for review'],
    [/\bneeds\s+review\b/i, 'Needs review'],
    [/\bblocked\b/i, 'Blocked'],
    [/\bdone\b|\bcompleted\b|\bshipped\b/i, 'Done'],
  ];

  for (const [pattern, label] of statusPatterns) {
    if (pattern.test(normalizedText)) return label;
  }

  return undefined;
}

function stripNativeDesignStatusText(text: string): string {
  return text
    .replace(/\bnot\s+ready\s+for\s+(?:dev|development|handoff|implementation)\b/ig, ' ')
    .replace(/\bready\s+for\s+(?:dev|development|handoff|implementation)\b/ig, ' ')
    .replace(/\bdesign\s+updated\b/ig, ' ')
    .replace(/\bready\s+for\s+review\b/ig, ' ')
    .replace(/\bneeds\s+review\b/ig, ' ')
    .replace(/\bblocked\b/ig, ' ')
    .replace(/\bdone\b|\bcompleted\b|\bshipped\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNativeDesignTitle(link: HTMLAnchorElement, candidate: DesignLinkCandidate, card: HTMLElement): string | undefined {
  const values = [
    link.textContent,
    link.getAttribute('title'),
    link.getAttribute('aria-label'),
    card.getAttribute('title'),
    card.getAttribute('aria-label'),
  ];

  const textLines = (card.innerText || card.textContent || '')
    .split(/\n+/)
    .map(line => stripNativeDesignStatusText(line.replace(/https?:\/\/[^\s<>"']+/g, ' ')))
    .map(line => line.replace(/\b(open|view|inspect)\s+(in\s+)?(figma|design)\b/ig, ' '))
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const value of [...values, ...textLines]) {
    const normalized = stripNativeDesignStatusText(value || '')
      .replace(/\b(open|view|inspect)\s+(in\s+)?(figma|design)\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (isMeaningfulDesignTitle(normalized)) return normalized;
  }

  return candidate.title;
}

function getNativeJiraDesignLinks(
  extraDesignDomains: string[] = [],
): Exclude<DesignDisplayItem, { type: 'ux_ticket' }>[] {
  const nativeDesignLinks: Exclude<DesignDisplayItem, { type: 'ux_ticket' }>[] = [];
  const seenUrls = new Set<string>();
  const selector = [
    '[data-testid*="design" i] a[href]',
    '[data-test-id*="design" i] a[href]',
    '[aria-label*="design" i] a[href]',
    '[id*="design" i] a[href]',
    '[class*="design" i] a[href]',
  ].join(',');

  document.querySelectorAll<HTMLAnchorElement>(selector).forEach(link => {
    if (link.closest('#description-val, .design-links-container, .backend-progress-container')) return;

    const candidate = extractDesignLinks(link.href, false, extraDesignDomains)[0];
    if (!candidate || seenUrls.has(candidate.url)) return;

    const card = getNativeDesignCard(link);
    const cardText = getCompactElementText(card);
    const status = extractNativeDesignStatus(cardText);
    const title = getNativeDesignTitle(link, candidate, card);

    seenUrls.add(candidate.url);
    nativeDesignLinks.push(createDirectDesignItem({
      ...candidate,
      title,
      status,
      source: 'jira_designs',
    }, 'jira_designs'));
  });

  return nativeDesignLinks;
}

// 从DOM中查找linked issues中的UX tickets
function getUXTicketsFromLinkedIssues(projectPrefix = 'UX*'): { key: string; url: string; summary: string; source: 'linked_issues' }[] {
  const uxTickets: { key: string; url: string; summary: string; source: 'linked_issues' }[] = [];
  
  // 查找Issue Links部分
  const issueLinkSections = document.querySelectorAll('.links-list .links-section');
  
  issueLinkSections.forEach(section => {
    const links = section.querySelectorAll('.issue-link-key');
    links.forEach(linkElement => {
      const key = linkElement.textContent?.trim();
      const href = (linkElement as HTMLAnchorElement).href;
      
      if (key && matchesProjectPattern(key, projectPrefix) && href) {
        // 尝试获取summary
        const summaryElement = linkElement.closest('.issue-link')?.querySelector('.issue-link-summary');
        const summary = summaryElement?.textContent?.trim() || key;
        
        uxTickets.push({
          key: key,
          url: href,
          summary: summary,
          source: 'linked_issues'
        });
      }
    });
  });
  
  return uxTickets;
}

// 调用Jira API获取票据信息
// token 优先；无 token 时仅在 Jira issue 页没有编辑风险时使用 cookie fallback
async function fetchTicketData(ticketKey: string): Promise<any> {
  try {
    // 使用 expand=names 获取更多字段信息
    const response = await fetchJiraRead(
      `/rest/api/2/issue/${ticketKey}?fields=issuelinks,subtasks&expand=names`,
      `fetch Jira ticket ${ticketKey}`,
    );
    if (!response) return null;
    if (!response.ok) throw new Error(`Failed to fetch ticket data: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching ticket data:', error);
    throw error;
  }
}

// 通过 JQL 查询 parent 字段获取所有 child issues
// token 优先；无 token 时仅在 Jira issue 页没有编辑风险时使用 cookie fallback
async function fetchChildIssues(parentKey: string): Promise<any[]> {
  try {
    const jql = `issueFunction in portfolioChildrenOf("key=${parentKey}")`;
    const url = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,issuetype,status`;
    const response = await fetchJiraRead(url, `fetch Jira child issues for ${parentKey}`);
    if (!response) return [];
    if (!response.ok) throw new Error('Failed to fetch child issues');
    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.error('Error fetching child issues:', error);
    return [];
  }
}

// 查找UX类型的ticket
async function findUXTickets(parentData: any, currentTicketKey: string, projectPrefix = 'UX*'): Promise<UXTicketReference[]> {
  try {
    const uxTickets: UXTicketReference[] = [];
    if (!parentData?.fields) return uxTickets;
    
    // 获取所有关联的issues
    const issueLinks = parentData.fields.issuelinks || [];
    const subtasks = parentData.fields.subtasks || [];
    // 通过 JQL 查找 child issues
    const parentKey = parentData.key || parentData.id;
    let childIssues: any[] = [];
    if (parentKey) {
      childIssues = await fetchChildIssues(parentKey);
    }
    
    // 提取所有相关issue
    const allRelatedIssues = [
      ...subtasks.map((subtask: any) => ({ ...subtask, source: 'subtask' })),
      ...issueLinks.map((link: any) => ({ 
        ...(link.outwardIssue || link.inwardIssue), 
        source: 'issue_link' 
      })).filter((issue: any) => issue.key),
      ...childIssues.map((issue: any) => ({ ...issue, source: 'child_issue' }))
    ];
    
    // 筛选匹配项目前缀且不是当前ticket的issue
    allRelatedIssues.forEach((issue: any) => {
      if (issue.key && matchesProjectPattern(issue.key, projectPrefix) && issue.key !== currentTicketKey) {
        uxTickets.push({
          key: issue.key,
          summary: issue.fields?.summary || issue.summary || issue.key,
          source: issue.source
        });
      }
    });
    
    return uxTickets;
  } catch (error) {
    console.error('Error finding UX tickets:', error);
    return [];
  }
}

// 获取 JIRA issue 的设计相关上下文，复用缓存避免重复请求
async function fetchJiraIssueContext(issueKey: string): Promise<JiraIssueContext | null> {
  const cachedContext = jiraIssueContextCache.get(issueKey);
  if (cachedContext) return cachedContext;

  const request = (async (): Promise<JiraIssueContext | null> => {
    try {
      const response = await fetchJiraRead(
        `/rest/api/2/issue/${issueKey}?fields=summary,status,issuetype,customfield_21233,customfield_11450,duedate,fixVersions&expand=names`,
        `fetch Jira issue context for ${issueKey}`,
      );
      if (!response) return null;
      if (!response.ok) throw new Error(`Failed to fetch issue context: ${response.statusText}`);
      const data = await response.json();
      const fixVersions = data.fields.fixVersions || [];
      const fixVersion = fixVersions.length > 0 ? fixVersions[fixVersions.length - 1].name : null;

      return {
        key: data.key,
        summary: data.fields.summary || issueKey,
        issueType: data.fields.issuetype?.name || '',
        status: data.fields.status?.name || '',
        designLink: data.fields.customfield_21233 || null,
        epicKey: data.fields.customfield_11450 || null,
        dueDate: data.fields.duedate || null,
        fixVersion
      };
    } catch (error) {
      console.error(`Error fetching Jira issue context for ${issueKey}:`, error);
      return null;
    }
  })();

  jiraIssueContextCache.set(issueKey, request);
  return request;
}

async function fetchRemoteDesignLinks(
  issueKey: string,
  extraDesignDomains: string[] = [],
): Promise<DesignLinkCandidate[]> {
  const cacheKey = `${issueKey}|${extraDesignDomains.join('|')}`;
  const cachedLinks = jiraRemoteDesignLinksCache.get(cacheKey);
  if (cachedLinks) return cachedLinks;

  const request = (async (): Promise<DesignLinkCandidate[]> => {
    try {
      const response = await fetchJiraRead(
        `/rest/api/2/issue/${issueKey}/remotelink`,
        `fetch Jira remote design links for ${issueKey}`,
      );
      if (!response) return [];
      if (!response.ok) return [];

      const remoteLinks = await response.json();
      if (!Array.isArray(remoteLinks)) return [];

      const seenUrls = new Set<string>();
      const designLinks: DesignLinkCandidate[] = [];

      for (const remoteLink of remoteLinks) {
        const object = remoteLink?.object || {};
        const url = typeof object.url === 'string' ? object.url : '';
        const candidate = extractDesignLinks(url, false, extraDesignDomains)[0];
        if (!candidate || seenUrls.has(candidate.url)) continue;

        const statusTitle = getRemoteDesignStatus(remoteLink);
        seenUrls.add(candidate.url);
        designLinks.push({
          ...candidate,
          title: object.title || object.summary || candidate.title,
          status: statusTitle,
          source: 'remote_link'
        });
      }

      return designLinks;
    } catch (error) {
      console.error(`Error fetching Jira remote links for ${issueKey}:`, error);
      return [];
    }
  })();

  jiraRemoteDesignLinksCache.set(cacheKey, request);
  return request;
}

function getRemoteDesignStatus(remoteLink: any): string | undefined {
  const status = remoteLink?.object?.status;
  const statusCandidates = [
    typeof status === 'string' ? status : undefined,
    status?.icon?.title,
    status?.title,
    status?.name,
    status?.status,
    status?.value,
    status?.category?.name,
    status?.resolved ? 'Done' : undefined,
  ];

  for (const statusCandidate of statusCandidates) {
    const formattedStatus = formatDesignStatusLabel(statusCandidate);
    if (formattedStatus) return formattedStatus;
  }

  return undefined;
}

// 获取 UX ticket 的 design link 和对应 UX Epic 状态
async function fetchUXDesignContext(
  uxTicketKey: string,
  extraDesignDomains: string[] = [],
): Promise<UXDesignContext | null> {
  const cacheKey = `${uxTicketKey}|${extraDesignDomains.join('|')}`;
  const cachedContext = uxDesignContextCache.get(cacheKey);
  if (cachedContext) return cachedContext;

  const request = (async (): Promise<UXDesignContext | null> => {
    const uxIssue = await fetchJiraIssueContext(uxTicketKey);
    if (!uxIssue) return null;
    const fieldDesignLinks = extractDesignLinks(uxIssue.designLink, true)
      .map(candidate => ({ ...candidate, source: 'design_field' }));
    const remoteDesignLinks = await fetchRemoteDesignLinks(uxTicketKey, extraDesignDomains);

    let uxEpicKey: string | undefined;
    let uxEpicStatus: string | undefined;

    if (uxIssue.issueType === 'Epic') {
      uxEpicKey = uxIssue.key;
      uxEpicStatus = uxIssue.status || undefined;
    } else if (uxIssue.epicKey) {
      const epicIssue = await fetchJiraIssueContext(uxIssue.epicKey);
      if (epicIssue) {
        uxEpicKey = epicIssue.key;
        uxEpicStatus = epicIssue.status || undefined;
      }
    }

    return {
      summary: uxIssue.summary,
      issueType: uxIssue.issueType,
      status: uxIssue.status,
      designLink: uxIssue.designLink,
      designLinks: [...fieldDesignLinks, ...remoteDesignLinks],
      epicKey: uxIssue.epicKey,
      dueDate: uxIssue.dueDate,
      fixVersion: uxIssue.fixVersion,
      uxEpicKey,
      uxEpicStatus,
      uxEta: uxIssue.dueDate || uxIssue.fixVersion || undefined,
      uxEtaSource: uxIssue.dueDate ? 'duedate' : (uxIssue.fixVersion ? 'fixVersion' : undefined)
    };
  })();

  uxDesignContextCache.set(cacheKey, request);
  return request;
}

// 获取Epic ticket的Parent Link
// token 优先；无 token 时仅在 Jira issue 页没有编辑风险时使用 cookie fallback
async function getEpicParentLink(epicKey: string): Promise<{ key: string; url: string } | null> {
  try {
    const response = await fetchJiraRead(
      `/rest/api/2/issue/${epicKey}?fields=customfield_15751&expand=names`,
      `fetch Jira epic parent link for ${epicKey}`,
    );
    if (!response) return null;
    if (!response.ok) throw new Error(`Failed to fetch Epic ticket: ${response.statusText}`);
    const data = await response.json();
    
    const parentKey = data.fields.customfield_15751;
    if (!parentKey) return null;
    
    return {
      key: parentKey,
      url: `/browse/${parentKey}`
    };
  } catch (error) {
    console.error('Error fetching Epic parent link:', error);
    return null;
  }
}

// 从Epic ticket中查找UX linked issues
async function getUXTicketsFromEpic(epicKey: string, projectPrefix = 'UX*'): Promise<UXTicketReference[]> {
  try {
    const epicData = await fetchTicketData(epicKey);
    return await findUXTickets(epicData, '', projectPrefix); // 传空字符串作为currentTicketKey
  } catch (error) {
    console.error('Error fetching UX tickets from Epic:', error);
    return [];
  }
}

async function appendUXDesignItems(
  designData: DesignDisplayItem[],
  uxTickets: UXTicketReference[],
  sourcePrefix?: string,
  extraDesignDomains: string[] = [],
): Promise<void> {
  const ticketContexts = await Promise.all(
    uxTickets.map(async uxTicket => ({
      uxTicket,
      designContext: await fetchUXDesignContext(uxTicket.key, extraDesignDomains)
    }))
  );

  for (const { uxTicket, designContext } of ticketContexts) {
    if (!designContext) continue;
    const baseSource = sourcePrefix ? `${sourcePrefix}_${uxTicket.source}` : uxTicket.source;
    const candidates = designContext.designLinks.length > 0
      ? designContext.designLinks
      : extractDesignLinks(normalizeDesignUrl(designContext.designLink), true).map(candidate => ({
        ...candidate,
        source: 'design_field'
      }));

    if (candidates.length === 0) {
      designData.push({
        type: 'ux_ticket',
        summary: uxTicket.summary || designContext.summary,
        uxTicketKey: uxTicket.key,
        source: baseSource,
        linkProvided: false,
        uxEpicKey: designContext.uxEpicKey,
        uxEpicStatus: designContext.uxEpicStatus,
        uxEta: designContext.uxEta,
        uxEtaSource: designContext.uxEtaSource
      });
      continue;
    }

    for (const candidate of candidates) {
      const candidateDisplayLabel = getCandidateDesignLabel(candidate);
      designData.push({
        type: 'ux_ticket',
        url: candidate.url,
        summary: candidateDisplayLabel || uxTicket.summary || designContext.summary || candidate.label,
        designLabel: candidateDisplayLabel,
        uxTicketKey: uxTicket.key,
        source: mergeDesignSources(baseSource, candidate.source || 'design_field'),
        linkProvided: true,
        designStatus: candidate.status,
        uxEpicKey: designContext.uxEpicKey,
        uxEpicStatus: designContext.uxEpicStatus,
        uxEta: designContext.uxEta,
        uxEtaSource: designContext.uxEtaSource
      });
    }
  }
}

function removeDesignLinks(): void {
  document.querySelectorAll('.design-links-container').forEach(element => element.remove());
}

function removeBackendProgress(): void {
  document.querySelectorAll('.backend-progress-container').forEach(element => element.remove());
}

function refreshDesignLinksContainerHeight(container: HTMLElement): void {
  const content = container.querySelector<HTMLElement>('.design-links-content');
  const footer = container.querySelector<HTMLElement>('.design-links-footer');
  if (!content) return;

  const contentHeight = Math.ceil(content.scrollHeight) + 8;
  const footerHeight = footer ? Math.ceil(footer.scrollHeight) : 0;
  container.style.setProperty('--design-links-collapsed-max-height', `${Math.max(40, contentHeight)}px`);
  container.style.setProperty('--design-links-hover-max-height', `${Math.max(contentHeight + footerHeight + 12, contentHeight)}px`);
}

function bindDesignLinksDynamicHeight(container: HTMLElement): void {
  let frameId = 0;
  const refresh = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      if (document.contains(container)) {
        refreshDesignLinksContainerHeight(container);
      }
    });
  };

  refresh();
  window.addEventListener('resize', refresh);

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(refresh);
    const content = container.querySelector<HTMLElement>('.design-links-content');
    if (content) resizeObserver.observe(content);
  }

  const cleanupObserver = new MutationObserver(() => {
    if (document.contains(container)) return;
    if (frameId) window.cancelAnimationFrame(frameId);
    window.removeEventListener('resize', refresh);
    resizeObserver?.disconnect();
    cleanupObserver.disconnect();
  });
  cleanupObserver.observe(document.body, { childList: true, subtree: true });
}

// 显示设计链接
function displayDesignLinks(designData: DesignDisplayItem[]): void {
  const summaryElement = document.querySelector('.issue-header-content');
  if (!summaryElement) return;
  
  // 检查是否已经存在设计链接元素
  removeDesignLinks();
  
  if (designData.length === 0) return;
  
  const designLinksContainer = document.createElement('div');
  
  // 获取扩展内的 icon 路径
  const iconUrl = chrome.runtime.getURL('icons/icon48.png');

  designLinksContainer.className = 'design-links-container';
  designLinksContainer.setAttribute('role', 'region');
  designLinksContainer.setAttribute('aria-label', 'Design context');

  const readinessDecision = getDesignReadinessDecision(designData);
  const readinessHtml = `
    <button
      type="button"
      class="design-readiness design-readiness--${readinessDecision.tone}"
      ${readinessDecision.targetTone ? `data-design-readiness-tone="${escapeAttribute(readinessDecision.targetTone)}"` : ''}
      title="${escapeAttribute(readinessDecision.detail)}"
      aria-label="${escapeAttribute(`${readinessDecision.label}. ${readinessDecision.detail}`)}"
    >
      <span class="design-readiness-label">${escapeHtml(readinessDecision.label)}</span>
      <span class="design-readiness-detail">${escapeHtml(readinessDecision.detail)}</span>
    </button>
  `;
  const statusSummary = getDesignStatusSummary(designData);
  const statusSummaryHtml = statusSummary.length > 0
    ? `
      <div class="design-status-summary" aria-label="Design status summary">
        ${statusSummary.map(item => `
          <button
            type="button"
            class="design-status-summary-chip design-status-summary-chip--${item.tone}"
            data-design-summary-tone="${escapeAttribute(item.tone)}"
            title="${escapeAttribute(`Show ${item.count} ${item.label} design ${item.count === 1 ? 'item' : 'items'}`)}"
            aria-label="${escapeAttribute(`Show ${item.count} ${item.label} design ${item.count === 1 ? 'item' : 'items'}`)}"
          >
            ${escapeHtml(item.label)}${item.count > 1 ? ` ${item.count}` : ''}
          </button>
        `).join('')}
      </div>
    `
    : '';
  
  let linksHtml = '';
  designData.forEach((design, _index) => {
    const designStatusTone = getDesignDisplayStatusTone(design);
    if (design.type === 'figma' || design.type === 'design_link') {
      const linkLabel = getDesignDisplayLabel(design);
      const safeUrl = escapeAttribute(design.url);
      const designStatusLabel = formatDesignStatusLabel(design.status);
      const statusTag = designStatusLabel
        ? `<span class="design-status-tag design-status-tag--${getDesignStatusTone(design.status)}">${escapeHtml(designStatusLabel)}</span>`
        : '';
      linksHtml += `
        <div class="design-link-item" data-design-status-tone="${escapeAttribute(designStatusTone)}" tabindex="-1">
          <img src="${escapeAttribute(iconUrl)}" title="Personal AI" class="design-icon" />
          <span class="design-link-label">Design</span>
          <a href="${safeUrl}" title="${safeUrl}" target="_blank" rel="noopener noreferrer" class="design-link">
            ${escapeHtml(linkLabel)} <span class="external-link-icon">↗</span>
          </a>
          ${statusTag}
          <span class="source-tag" title="${escapeAttribute(design.source)}">${escapeHtml(getDesignSourceLabel(design.source))}</span>
        </div>
      `;
    } else if (design.type === 'ux_ticket') {
      const uxTicketUrl = `/browse/${design.uxTicketKey}`;
      const uxEpicDisplayKey = design.uxEpicKey || design.uxTicketKey;
      const uxEpicUrl = `/browse/${uxEpicDisplayKey}`;
      const shouldShowUxEpicLink = uxEpicDisplayKey !== design.uxTicketKey;
      const uxEpicStatusTone = design.uxEpicStatus ? getUXEpicStatusTone(design.uxEpicStatus) : null;
      const sourceTag = `<span class="source-tag" title="${escapeAttribute(design.source)}">${escapeHtml(getDesignSourceLabel(design.source))}</span>`;
      const designLabel = design.designLabel || design.summary || design.uxTicketKey;
      const designContent = design.linkProvided && design.url
        ? `
          <a href="${escapeAttribute(design.url)}" title="${escapeAttribute(design.url)}" target="_blank" rel="noopener noreferrer" class="design-link">
            ${escapeHtml(designLabel)} <span class="external-link-icon">↗</span>
          </a>
          <a href="${escapeAttribute(uxTicketUrl)}" target="_blank" rel="noopener noreferrer" class="ux-ticket-link">${escapeHtml(design.uxTicketKey)}</a>
        `
        : `
          <a href="${escapeAttribute(uxTicketUrl)}" title="${escapeAttribute(design.uxTicketKey)}" target="_blank" rel="noopener noreferrer" class="ux-ticket-link">
            ${escapeHtml(design.uxTicketKey)} <span class="external-link-icon">↗</span>
          </a>
        `;
      const designStatusText = design.linkProvided ? formatDesignStatusLabel(design.designStatus) : 'Missing link';
      const designStatusTag = designStatusText
        ? `<span class="design-status-tag design-status-tag--${getDesignStatusTone(designStatusText)}">${escapeHtml(designStatusText)}</span>`
        : '';
      const statusTag = design.uxEpicStatus
        ? `
          <span class="ux-epic-status-tag" title="${escapeAttribute(uxEpicDisplayKey)}">
            ${shouldShowUxEpicLink
              ? `<a href="${escapeAttribute(uxEpicUrl)}" target="_blank" rel="noopener noreferrer" class="ux-epic-link">
                  ${escapeHtml(uxEpicDisplayKey)} <span class="external-link-icon">↗</span>
                </a>`
              : ''}
            <span class="ux-epic-status-pill ux-epic-status-pill--${uxEpicStatusTone}">${escapeHtml(design.uxEpicStatus)}</span>
          </span>
        `
        : '';
      const etaTag = design.uxEta
        ? `<span class="ux-eta-tag" title="${design.uxEtaSource === 'duedate' ? 'Due date' : 'Fix Version'}">ETA: ${escapeHtml(design.uxEta)}</span>`
        : '';

      linksHtml += `
        <div class="design-link-item" data-design-status-tone="${escapeAttribute(designStatusTone)}" tabindex="-1">
          <img src="${escapeAttribute(iconUrl)}" title="Personal AI" class="design-icon" />
          <span class="design-link-label">Design</span>
          ${designContent}
          ${designStatusTag}
          ${statusTag}
          ${etaTag}
          ${sourceTag}
        </div>
      `;
    }
  });
  
  designLinksContainer.innerHTML = `
    <div class="design-links-content">
      ${readinessHtml}
      ${statusSummaryHtml}
      ${linksHtml}
    </div>
    <div class="design-links-footer">
      <span class="footer-text">Personal AI provided</span>
      <span class="author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank" rel="noopener noreferrer">Esone</a></span>
    </div>
  `;
  
  // 插入到Summary下方
  summaryElement.insertAdjacentElement('afterend', designLinksContainer);
  bindDesignLinksDynamicHeight(designLinksContainer);

  const focusFirstItemByTone = (targetTone?: string): void => {
    if (!targetTone) return;

    const targetItem = Array.from(
      designLinksContainer.querySelectorAll<HTMLElement>('.design-link-item')
    ).find(item => item.dataset.designStatusTone === targetTone);
    if (!targetItem) return;

    designLinksContainer
      .querySelectorAll('.design-link-item--highlight')
      .forEach(item => item.classList.remove('design-link-item--highlight'));
    targetItem.classList.add('design-link-item--highlight');
    targetItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    targetItem.focus({ preventScroll: true });
    window.setTimeout(() => {
      targetItem.classList.remove('design-link-item--highlight');
    }, 1800);
  };

  designLinksContainer.querySelector<HTMLButtonElement>('.design-readiness')?.addEventListener('click', event => {
    focusFirstItemByTone((event.currentTarget as HTMLButtonElement).dataset.designReadinessTone);
  });

  designLinksContainer.querySelectorAll<HTMLButtonElement>('.design-status-summary-chip').forEach(button => {
    button.addEventListener('click', () => {
      focusFirstItemByTone(button.dataset.designSummaryTone);
    });
  });
  
  // 添加样式
  const readinessHeight = 28;
  const statusSummaryHeight = statusSummary.length > 0 ? 28 : 0;
  const collapsedMaxHeight = 40 + readinessHeight + statusSummaryHeight + (designData.length - 1) * 30;
  const hoverMaxHeight = 80 + readinessHeight + statusSummaryHeight + (designData.length - 1) * 30;
  let style = document.getElementById('personal-ai-design-links-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'personal-ai-design-links-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    /* Keep this card shell and hover behavior aligned with .backend-progress-container.
       Do not change the overall card style, max-height expansion, shadow, or hover translate effect independently. */
    .design-links-container {
      margin: 10px 0;
      padding: 8px 12px;
      background-color: #f0f5ff;
      border-radius: 4px;
      display: inline-flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      position: relative;
      overflow: visible;
      max-height: var(--design-links-collapsed-max-height, ${collapsedMaxHeight}px);
      z-index: 1;
    }
    .design-links-container:hover {
      max-height: var(--design-links-hover-max-height, ${hoverMaxHeight}px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      transform: translateY(4px);
      z-index: 1000;
    }
    .design-links-content {
      display: flex;
      flex-direction: column;
      background-color: #f0f5ff;
      position: relative;
      z-index: 2;
    }
    .design-readiness {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
      border: 0;
      padding: 0 0 4px;
      margin: 0 0 4px;
      background: transparent;
      color: #172b4d;
      text-align: left;
      font-family: inherit;
      cursor: pointer;
    }
    .design-readiness:hover .design-readiness-label,
    .design-readiness:focus-visible .design-readiness-label {
      box-shadow: 0 0 0 2px rgba(38, 132, 255, 0.22);
    }
    .design-readiness:focus-visible {
      outline: none;
    }
    .design-readiness-label {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.5;
      letter-spacing: 0;
      white-space: nowrap;
      color: #172b4d;
      background-color: #e6fcff;
    }
    .design-readiness-detail {
      min-width: 0;
      color: #42526e;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.45;
    }
    .design-readiness--ready .design-readiness-label {
      color: #006644;
      background-color: #dcfff1;
    }
    .design-readiness--updated .design-readiness-label {
      color: #0747a6;
      background-color: #deebff;
    }
    .design-readiness--missing .design-readiness-label {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-readiness--not-ready .design-readiness-label {
      color: #974f0c;
      background-color: #fffae6;
    }
    .design-readiness--blocked .design-readiness-label {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-readiness--review .design-readiness-label {
      color: #403294;
      background-color: #eae6ff;
    }
    .design-readiness--done .design-readiness-label {
      color: #44546f;
      background-color: #f1f2f4;
    }
    .design-status-summary {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(9, 30, 66, 0.08);
    }
    .design-status-summary-chip {
      display: inline-flex;
      align-items: center;
      border: 0;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.5;
      letter-spacing: 0;
      color: #172b4d;
      background-color: #e6fcff;
      white-space: nowrap;
      text-transform: capitalize;
      cursor: pointer;
      font-family: inherit;
    }
    .design-status-summary-chip:hover,
    .design-status-summary-chip:focus-visible {
      box-shadow: 0 0 0 2px rgba(38, 132, 255, 0.22);
      outline: none;
    }
    .design-status-summary-chip--ready {
      color: #006644;
      background-color: #dcfff1;
    }
    .design-status-summary-chip--updated {
      color: #0747a6;
      background-color: #deebff;
    }
    .design-status-summary-chip--missing {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-status-summary-chip--not-ready {
      color: #974f0c;
      background-color: #fffae6;
    }
    .design-status-summary-chip--blocked {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-status-summary-chip--review {
      color: #403294;
      background-color: #eae6ff;
    }
    .design-status-summary-chip--done {
      color: #44546f;
      background-color: #f1f2f4;
    }
    .design-link-item {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      position: relative;
      flex-wrap: wrap;
      min-width: 0;
      max-width: 100%;
    }
    .design-link-item:last-child {
      margin-bottom: 0;
    }
    .design-link-item:focus {
      outline: none;
    }
    .design-link-item--highlight {
      background: rgba(255, 171, 0, 0.18);
      box-shadow: 0 0 0 2px rgba(255, 171, 0, 0.35);
      border-radius: 4px;
    }
    .design-links-footer {
      font-size: 12px;
      color: #666;
      margin-top: 0;
      padding-top: 8px;
      border-top: 1px dashed #ccc;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background-color: #f0f5ff;
      padding: 8px 12px;
      border-radius: 0 0 4px 4px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .design-links-container:hover .design-links-footer {
      opacity: 1;
      transform: translateY(0);
    }
    .footer-text {
      font-size: 12px;
      color: #666;
    }
    .author-text {
      font-size: 11px;
      color: #666;
    }
    .author-text a {
      color: inherit;
      text-decoration: none;
    }
    .author-text a:hover {
      text-decoration: underline;
    }
    .design-icon {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      margin-right: 6px;
      vertical-align: middle;
    }
    .design-link-label {
      color: #172b4d;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .design-link {
      color: #0052cc;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
      max-width: min(64vw, 540px);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }
    .design-link:hover {
      text-decoration: underline;
    }
    .design-link-missing {
      color: #6b778c;
      font-weight: 500;
      white-space: nowrap;
    }
    .ux-ticket-link {
      color: #0052cc;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .ux-ticket-link:hover {
      text-decoration: underline;
    }
    .ux-ticket-link-wrapper {
      color: #6b778c;
      white-space: nowrap;
    }
    .external-link-icon {
      font-size: 12px;
      margin-left: 4px;
    }
    .ux-epic-status-tag {
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #42526e;
      white-space: nowrap;
      margin-left: 4px;
    }
    .ux-epic-link {
      color: #0052cc;
      font-weight: 600;
      text-decoration: none;
    }
    .ux-epic-link:hover {
      text-decoration: underline;
    }
    .ux-epic-status-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.5;
      white-space: nowrap;
    }
    .ux-epic-status-pill--todo {
      color: #42526e;
      background-color: #dfe1e6;
    }
    .ux-epic-status-pill--in-progress {
      color: #0747a6;
      background-color: #deebff;
    }
    .ux-epic-status-pill--done {
      color: #006644;
      background-color: #e3fcef;
    }
    .ux-epic-status-pill--blocked {
      color: #974f0c;
      background-color: #fffae6;
    }
    .ux-epic-status-pill--cancelled {
      color: #bf2600;
      background-color: #ffebe6;
    }
    .ux-eta-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.5;
      color: #253858;
      background-color: #e9f2ff;
      white-space: nowrap;
      margin-left: 4px;
    }
    .design-status-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.5;
      color: #172b4d;
      background-color: #e6fcff;
      white-space: nowrap;
    }
    .design-status-tag--ready {
      color: #006644;
      background-color: #dcfff1;
    }
    .design-status-tag--updated {
      color: #0747a6;
      background-color: #deebff;
    }
    .design-status-tag--missing {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-status-tag--not-ready {
      color: #974f0c;
      background-color: #fffae6;
    }
    .design-status-tag--blocked {
      color: #7a3e00;
      background-color: #fff0b3;
    }
    .design-status-tag--review {
      color: #403294;
      background-color: #eae6ff;
    }
    .design-status-tag--done {
      color: #44546f;
      background-color: #f1f2f4;
    }
    .design-status-tag--neutral {
      color: #172b4d;
      background-color: #e6fcff;
    }
    .source-tag {
      font-size: 10px;
      color: #666;
      background-color: #e6e6e6;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
      white-space: nowrap;
    }
  `;
}

// 判断是否为Epic ticket
async function isEpicTicket(): Promise<boolean> {
  try {
    const issueTypeElement = document.querySelector('#type-val');
    if (!issueTypeElement) return false;
    
    const issueType = issueTypeElement.textContent?.trim();
    return issueType === 'Epic';
  } catch (error) {
    console.error('Error checking Epic type:', error);
    return false;
  }
}

// ============================================================
// Backend Progress (外部依赖进展) 相关函数
// ============================================================

// 判断是否为Sub-task ticket
function isSubtaskTicket(): boolean {
  try {
    const issueTypeElement = document.querySelector('#type-val');
    if (!issueTypeElement) return false;
    const issueType = issueTypeElement.textContent?.trim();
    return issueType === 'Sub-task' || issueType === '子任务';
  } catch (error) {
    console.error('Error checking Sub-task type:', error);
    return false;
  }
}

// 从API数据中查找外部依赖项目的tickets（仅搜索issue links）
function findDependencyTicketsFromData(data: any, projectPrefix: string, currentTicketKey: string): { key: string; summary: string }[] {
  const tickets: { key: string; summary: string }[] = [];
  const issueLinks = data.fields?.issuelinks || [];
  
  issueLinks.forEach((link: any) => {
    const issue = link.outwardIssue || link.inwardIssue;
    if (issue && issue.key && matchesProjectPattern(issue.key, projectPrefix) && issue.key !== currentTicketKey) {
      tickets.push({
        key: issue.key,
        summary: issue.fields?.summary || issue.key
      });
    }
  });
  
  return tickets;
}

// 从DOM中查找linked issues中的外部依赖项目tickets
function getDependencyTicketsFromLinkedIssues(projectPrefix: string): { key: string; url: string; summary: string }[] {
  const tickets: { key: string; url: string; summary: string }[] = [];
  const issueLinkSections = document.querySelectorAll('.links-list .links-section');
  
  issueLinkSections.forEach(section => {
    const links = section.querySelectorAll('.issue-link-key');
    links.forEach(linkElement => {
      const key = linkElement.textContent?.trim();
      const href = (linkElement as HTMLAnchorElement).href;
      
      if (key && matchesProjectPattern(key, projectPrefix) && href) {
        const summaryElement = linkElement.closest('.issue-link')?.querySelector('.issue-link-summary');
        const summary = summaryElement?.textContent?.trim() || key;
        tickets.push({ key, url: href, summary });
      }
    });
  });
  
  return tickets;
}

// 获取外部依赖ticket的详细信息（target end和fixVersions）
async function fetchDependencyDetails(ticketKey: string): Promise<{
  targetEnd: string | null;
  fixVersion: string | null;
}> {
  try {
    const response = await fetchJiraRead(
      `/rest/api/2/issue/${ticketKey}?fields=customfield_18351,customfield_14354,fixVersions`,
      `fetch Jira dependency details for ${ticketKey}`,
    );
    if (!response) return { targetEnd: null, fixVersion: null };
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const data = await response.json();
    
    // Target End优先取customfield_18351，取不到再取End date customfield_14354
    const targetEnd = data.fields.customfield_18351 || data.fields.customfield_14354 || null;
    const fixVersions = data.fields.fixVersions || [];
    // 取最后一个fixVersion（最新的版本）
    const fixVersion = fixVersions.length > 0 ? fixVersions[fixVersions.length - 1].name : null;
    
    return { targetEnd, fixVersion };
  } catch (error) {
    console.error('Error fetching dependency details:', error);
    return { targetEnd: null, fixVersion: null };
  }
}

// 通过API获取ticket的Epic Link字段
async function fetchTicketEpicLink(ticketKey: string): Promise<string | null> {
  try {
    const response = await fetchJiraRead(
      `/rest/api/2/issue/${ticketKey}?fields=customfield_11450`,
      `fetch Jira epic link for ${ticketKey}`,
    );
    if (!response) return null;
    if (!response.ok) return null;
    const data = await response.json();
    return data.fields.customfield_11450 || null;
  } catch (error) {
    console.error('Error fetching ticket Epic link:', error);
    return null;
  }
}

// 从DORA Metrics API获取Rollout to Production日期（通过background避免CORS）
async function fetchRolloutDate(fixVersion: string): Promise<string | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_ROLLOUT_DATE',
      fixVersion
    });
    if (response?.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching rollout date:', error);
    return null;
  }
}

// 格式化日期为短格式 (M/D/YYYY)
function formatDateShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

// Backend Progress数据接口
interface BackendProgressData {
  dependencyTicketKey: string;
  dependencyTicketUrl: string;
  summary: string;
  earlyBuildDate: string | null;
  rolloutDate: string | null;
  fixVersion: string | null;
  source: string;
}

// 显示Backend Progress信息
function displayBackendProgress(progressData: BackendProgressData[]): void {
  const anchor = document.querySelector('.design-links-container') || document.querySelector('.issue-header-content');
  if (!anchor) return;
  
  // 检查是否已经存在
  removeBackendProgress();
  
  if (progressData.length === 0) return;
  
  const container = document.createElement('div');
  const iconUrl = chrome.runtime.getURL('icons/icon48.png');
  container.className = 'backend-progress-container';
  
  let itemsHtml = '';
  progressData.forEach(item => {
    const earlyBuildDisplay = item.earlyBuildDate
      ? `<a href="${item.dependencyTicketUrl}" target="_blank" class="progress-date-link">${formatDateShort(item.earlyBuildDate)}</a>`
      : '<span class="progress-date-na">N/A</span>';
    
    const doraUrl = item.fixVersion
      ? `https://rcv-dora-metrics.int.rclabenv.com/release-detail?releases=${encodeURIComponent(item.fixVersion)}`
      : null;
    const rolloutDisplay = item.rolloutDate
      ? `<a href="${doraUrl}" target="_blank" class="progress-date-link">${formatDateShort(item.rolloutDate)}</a>`
      : (item.fixVersion
        ? `<a href="${doraUrl}" target="_blank" class="progress-date-pending">pending</a>`
        : '<span class="progress-date-na">N/A</span>');
    
    itemsHtml += `
      <div class="backend-progress-item">
        <img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" />
        Backend: <a href="${item.dependencyTicketUrl}" target="_blank" class="progress-link">
          ${item.dependencyTicketKey} <span class="external-link-icon">↗️</span>
        </a>
        <span class="progress-detail">Early Build: ${earlyBuildDisplay}</span>
        <span class="progress-separator">|</span>
        <span class="progress-detail">Rollout to Prod: ${rolloutDisplay}</span>
        <span class="source-tag">${item.source}</span>
      </div>
    `;
  });
  
  container.innerHTML = `
    <div class="backend-progress-content">
      ${itemsHtml}
    </div>
    <div class="backend-progress-footer">
      <span class="footer-text">Personal AI provided</span>
      <span class="author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank">Esone</a></span>
    </div>
  `;
  
  anchor.insertAdjacentElement('afterend', container);
  
  // 添加样式（仅首次添加）
  if (!document.getElementById('backend-progress-styles')) {
    const style = document.createElement('style');
    style.id = 'backend-progress-styles';
    style.textContent = `
      /* Keep this card shell and hover behavior aligned with .design-links-container.
         Do not change the overall card style, max-height expansion, shadow, or hover translate effect independently. */
      .backend-progress-container {
        margin: 10px 0;
        padding: 8px 12px;
        background-color: #f0fff4;
        border-radius: 4px;
        display: inline-flex;
        flex-direction: column;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        position: relative;
        overflow: visible;
        max-height: ${40 + (progressData.length - 1) * 30}px;
        z-index: 1;
      }
      .backend-progress-container:hover {
        max-height: ${80 + (progressData.length - 1) * 30}px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        transform: translateY(4px);
        z-index: 1000;
      }
      .backend-progress-content {
        display: flex;
        flex-direction: column;
        background-color: #f0fff4;
        position: relative;
        z-index: 2;
      }
      .backend-progress-item {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
        position: relative;
      }
      .backend-progress-item:last-child {
        margin-bottom: 0;
      }
      .backend-progress-footer {
        font-size: 12px;
        color: #666;
        margin-top: 0;
        padding-top: 8px;
        border-top: 1px dashed #ccc;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background-color: #f0fff4;
        padding: 8px 12px;
        border-radius: 0 0 4px 4px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .backend-progress-container:hover .backend-progress-footer {
        opacity: 1;
        transform: translateY(0);
      }
      .progress-link {
        color: #0052cc;
        font-weight: 500;
        text-decoration: none;
        margin-left: 4px;
      }
      .progress-link:hover {
        text-decoration: underline;
      }
      .progress-detail {
        margin-left: 8px;
        font-size: 13px;
        color: #333;
      }
      .progress-separator {
        margin: 0 4px;
        color: #ccc;
      }
      .progress-date-link {
        color: #0052cc;
        text-decoration: none;
        font-weight: 500;
      }
      .progress-date-link:hover {
        text-decoration: underline;
      }
      .progress-date {
        font-weight: 500;
        color: #2e7d32;
      }
      .progress-date-na {
        color: #999;
        font-style: italic;
      }
      .progress-date-pending {
        color: #ff9800;
        font-style: italic;
        text-decoration: none;
      }
      .progress-date-pending:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }
}

// 收集并显示Backend Progress信息
async function collectAndDisplayBackendProgress(
  ticketId: string,
  depProject: string,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  try {
    const allProgressData: BackendProgressData[] = [];
    
    const isSubtask = isSubtaskTicket();
    const isEpic = await isEpicTicket();
    if (!shouldContinue()) return;
    
    if (isEpic) {
      // 当前是Epic，查找Epic自身的linked issues中的依赖ticket
      const epicData = await fetchTicketData(ticketId);
      if (!shouldContinue()) return;
      const depTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
      for (const dep of depTickets) {
        const details = await fetchDependencyDetails(dep.key);
        if (!shouldContinue()) return;
        let rolloutDate: string | null = null;
        if (details.fixVersion) {
          rolloutDate = await fetchRolloutDate(details.fixVersion);
          if (!shouldContinue()) return;
        }
        allProgressData.push({
          dependencyTicketKey: dep.key,
          dependencyTicketUrl: `/browse/${dep.key}`,
          summary: dep.summary,
          earlyBuildDate: details.targetEnd,
          rolloutDate,
          fixVersion: details.fixVersion,
          source: 'epic'
        });
      }
    } else if (isSubtask) {
      // 当前是Sub-task，先找到上级User Story，查找其linked issues
      const parentLink = getParentLinkFromDOM();
      if (parentLink) {
        const parentData = await fetchTicketData(parentLink.key);
        if (!shouldContinue()) return;
        const depTickets = findDependencyTicketsFromData(parentData, depProject, ticketId);
        for (const dep of depTickets) {
          const details = await fetchDependencyDetails(dep.key);
          if (!shouldContinue()) return;
          let rolloutDate: string | null = null;
          if (details.fixVersion) {
            rolloutDate = await fetchRolloutDate(details.fixVersion);
            if (!shouldContinue()) return;
          }
          allProgressData.push({
            dependencyTicketKey: dep.key,
            dependencyTicketUrl: `/browse/${dep.key}`,
            summary: dep.summary,
            earlyBuildDate: details.targetEnd,
            rolloutDate,
            fixVersion: details.fixVersion,
            source: 'user_story'
          });
        }
        
        // Sub-task的Epic可能不在当前DOM中，通过API获取parent的Epic Link
        const epicKey = await fetchTicketEpicLink(parentLink.key);
        if (!shouldContinue()) return;
        if (epicKey) {
          const epicData = await fetchTicketData(epicKey);
          if (!shouldContinue()) return;
          const epicDepTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
          for (const dep of epicDepTickets) {
            const details = await fetchDependencyDetails(dep.key);
            if (!shouldContinue()) return;
            let rolloutDate: string | null = null;
            if (details.fixVersion) {
              rolloutDate = await fetchRolloutDate(details.fixVersion);
              if (!shouldContinue()) return;
            }
            allProgressData.push({
              dependencyTicketKey: dep.key,
              dependencyTicketUrl: `/browse/${dep.key}`,
              summary: dep.summary,
              earlyBuildDate: details.targetEnd,
              rolloutDate,
              fixVersion: details.fixVersion,
              source: 'epic'
            });
          }
        }
      }
    } else {
      // 普通ticket（Story, Task等），查找当前页面的linked issues
      const domDepTickets = getDependencyTicketsFromLinkedIssues(depProject);
      for (const dep of domDepTickets) {
        const details = await fetchDependencyDetails(dep.key);
        if (!shouldContinue()) return;
        let rolloutDate: string | null = null;
        if (details.fixVersion) {
          rolloutDate = await fetchRolloutDate(details.fixVersion);
          if (!shouldContinue()) return;
        }
        allProgressData.push({
          dependencyTicketKey: dep.key,
          dependencyTicketUrl: dep.url,
          summary: dep.summary,
          earlyBuildDate: details.targetEnd,
          rolloutDate,
          fixVersion: details.fixVersion,
          source: 'linked_issues'
        });
      }
      
      // 查找Epic的linked issues
      const epicLink = getParentEpicFromDOM();
      if (epicLink) {
        const epicData = await fetchTicketData(epicLink.key);
        if (!shouldContinue()) return;
        const epicDepTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
        for (const dep of epicDepTickets) {
          const details = await fetchDependencyDetails(dep.key);
          if (!shouldContinue()) return;
          let rolloutDate: string | null = null;
          if (details.fixVersion) {
            rolloutDate = await fetchRolloutDate(details.fixVersion);
            if (!shouldContinue()) return;
          }
          allProgressData.push({
            dependencyTicketKey: dep.key,
            dependencyTicketUrl: `/browse/${dep.key}`,
            summary: dep.summary,
            earlyBuildDate: details.targetEnd,
            rolloutDate,
            fixVersion: details.fixVersion,
            source: 'epic'
          });
        }
      }
    }
    
    // 合并重复的dependency tickets（同一ticket来自不同source时合并source标签）
    const mergedProgressData: BackendProgressData[] = [];
    for (const item of allProgressData) {
      const existing = mergedProgressData.find(p => p.dependencyTicketKey === item.dependencyTicketKey);
      if (existing) {
        if (!existing.source.includes(item.source)) {
          existing.source += `, ${item.source}`;
        }
      } else {
        mergedProgressData.push({ ...item });
      }
    }
    
    if (mergedProgressData.length > 0) {
      if (!shouldContinue()) return;
      console.log('Backend progress found:', mergedProgressData);
      displayBackendProgress(mergedProgressData);
    } else {
      console.log('No backend progress found');
    }
  } catch (error) {
    console.error('Error collecting backend progress:', error);
  }
}

// 主函数
async function main(): Promise<void> {
  if (!isJiraTicketPage()) {
    mainRunSequence += 1;
    removeDesignLinks();
    removeBackendProgress();
    return;
  }
  const runId = ++mainRunSequence;
  
  try {
    // 获取当前ticket ID
    const ticketId = getTicketIdFromUrl();
    const isCurrentRun = () => runId === mainRunSequence && isJiraTicketPage() && getTicketIdFromUrl() === ticketId;
    console.log('Current Jira ticket:', ticketId);

    // 等待DOM加载完成
    await waitForElement('.issue-header-content, #description-val, #customfield_15751-val, #customfield_11450-val, #type-val', 5000)
      .catch(error => {
        console.warn('Jira design links continuing after DOM wait timeout:', error);
      });
    if (!isCurrentRun()) return;

    removeDesignLinks();
    removeBackendProgress();

    // 加载配置
    const config = await getJiraDesignFeatureConfig();
    if (!isCurrentRun()) return;
    jiraDesignFetchToken = config?.JIRA_API_TOKEN || '';
    const designProject = config?.DESIGN_JIRA_PROJECT || 'UX*';
    const extraDesignDomains = parseDesignDomainPatterns(config?.DESIGN_LINK_DOMAINS);
    
    const allDesignData: DesignDisplayItem[] = [];
    
    // 1. 从 description、Jira 原生 Designs 区块和 Jira remote links 中查找设计链接
    allDesignData.push(...getDesignLinksFromDescription(extraDesignDomains));
    allDesignData.push(...getNativeJiraDesignLinks(extraDesignDomains));

    const remoteDesignLinks = await fetchRemoteDesignLinks(ticketId, extraDesignDomains);
    if (!isCurrentRun()) return;
    remoteDesignLinks.forEach(candidate => {
      allDesignData.push(createDirectDesignItem(candidate, candidate.source || 'remote_link'));
    });
    
    // 2. 从当前页面的linked issues中查找UX tickets
    const linkedUXTickets = getUXTicketsFromLinkedIssues(designProject);
    await appendUXDesignItems(allDesignData, linkedUXTickets, undefined, extraDesignDomains);
    if (!isCurrentRun()) return;
    
    // 判断是否为Epic ticket
    if (await isEpicTicket()) {
      if (!isCurrentRun()) return;
      // 如果是Epic，直接从Epic中查找UX linked issues
      const epicUXTickets = await getUXTicketsFromEpic(ticketId, designProject);
      await appendUXDesignItems(allDesignData, epicUXTickets, 'epic', extraDesignDomains);
      if (!isCurrentRun()) return;
      
      // 还需要检查Epic的Parent Link
      const parentLink = getParentLinkFromDOM();
      if (parentLink) {
        console.log('Parent ticket:', parentLink.key);
        const parentData = await fetchTicketData(parentLink.key);
        if (!isCurrentRun()) return;
        const parentUXTickets = await findUXTickets(parentData, ticketId, designProject);
        await appendUXDesignItems(allDesignData, parentUXTickets, 'parent', extraDesignDomains);
        if (!isCurrentRun()) return;
      }
    } else {
      if (!isCurrentRun()) return;
      // 如果不是Epic，先获取Epic Link
      const epicLink = getParentEpicFromDOM();
      if (epicLink) {
        console.log('Epic ticket:', epicLink.key);
        
        // 从Epic中查找UX linked issues
        const epicUXTickets = await getUXTicketsFromEpic(epicLink.key, designProject);
        await appendUXDesignItems(allDesignData, epicUXTickets, 'epic', extraDesignDomains);
        if (!isCurrentRun()) return;
        
        // 通过API获取Epic的Parent Link
        const parentLink = await getEpicParentLink(epicLink.key);
        if (!isCurrentRun()) return;
        if (parentLink) {
          console.log('Parent ticket:', parentLink.key);
          const parentData = await fetchTicketData(parentLink.key);
          if (!isCurrentRun()) return;
          const parentUXTickets = await findUXTickets(parentData, ticketId, designProject);
          await appendUXDesignItems(allDesignData, parentUXTickets, 'parent', extraDesignDomains);
          if (!isCurrentRun()) return;
        }
      }
    }
    
    // 去重处理
    const uniqueDesignData = sortDesignDisplayItems(dedupeDesignData(allDesignData));
    if (!isCurrentRun()) return;
    
    if (uniqueDesignData.length > 0) {
      console.log('Design links found:', uniqueDesignData);
      displayDesignLinks(uniqueDesignData);
    } else {
      console.log('No design links found');
      removeDesignLinks();
    }
    
    // === Backend Progress (外部依赖进展) ===
    const depProject = config?.DEPENDENCIES_JIRA_PROJECT;
    if (depProject) {
      if (!isCurrentRun()) return;
      await collectAndDisplayBackendProgress(ticketId, depProject, isCurrentRun);
      if (!isCurrentRun()) return;
    }
    
  } catch (error) {
    console.error('Error fetching design links:', error);
  }
}

// 等待元素出现
function waitForElement(selector: string, timeoutMs: number): Promise<Element> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | null = null;
    let timeoutId = 0;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      observer?.disconnect();
    };

    const resolveIfPresent = (): boolean => {
      const element = document.querySelector(selector);
      if (!element) return false;
      cleanup();
      resolve(element);
      return true;
    };

    if (resolveIfPresent()) return;

    observer = new MutationObserver(() => {
      resolveIfPresent();
    });

    observer.observe(document.body || document.documentElement || document, {
      childList: true,
      subtree: true
    });

    timeoutId = window.setTimeout(() => {
      cleanup();
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeoutMs);
  });
}

// 处理页面变化（SPA导航）
let pageChangeObserverStarted = false;

function handlePageChanges(): void {
  if (pageChangeObserverStarted) return;
  pageChangeObserverStarted = true;

  let currentUrl = location.href;
  
  const observer = new MutationObserver(() => {
    if (currentUrl !== location.href) {
      currentUrl = location.href;
      if (isJiraTicketPage()) {
        setTimeout(main, 1000); // 延迟执行，等待页面加载
      } else {
        mainRunSequence += 1;
        removeDesignLinks();
        removeBackendProgress();
      }
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });
}

function scheduleInitialJiraScan(delayMs = 1000): void {
  startJiraXsrfTokenSynchronizer();
  setTimeout(main, delayMs);
  handlePageChanges();
}

// 页面加载时执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scheduleInitialJiraScan(1000); // 延迟执行，确保页面完全加载
  }, { once: true });
} else {
  scheduleInitialJiraScan(250);
}

// 在页面重新渲染时也执行
window.addEventListener('load', () => {
  setTimeout(main, 2000); // 延迟更长时间执行
});

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === JIRA_ISSUE_EDIT_STATE_MESSAGE) {
    syncJiraXsrfTokenFromCookie();
    sendResponse(getJiraIssueEditState());
    return true;
  }

  if (request.type === JIRA_SYNC_XSRF_TOKEN_MESSAGE) {
    sendResponse({ success: true, ...syncJiraXsrfTokenFromCookie() });
    return true;
  }

  if (request.type === 'GET_USER_INFO') {
    getUserInfoFromJiraAPI()
      .then(userInfo => {
        sendResponse({ data: userInfo });
      })
      .catch(error => {
        console.error('Failed to get user info from JIRA API:', error);
        sendResponse({ data: null, error: error.message });
      });
    return true; // 保持消息通道开放
  }
});

// 从 JIRA API 获取用户信息
// username/ownerId 是记忆读写的关键初始化信息，允许 cookie fallback 不因编辑态暂停。
async function getUserInfoFromJiraAPI(): Promise<any> {
  try {
    console.log('Getting user info from JIRA API...');
    const response = await fetchJiraRead(
      window.location.origin + '/rest/api/2/myself',
      'fetch Jira current user',
      'cookie-always',
    );
    if (!response) return null;
    
    if (!response.ok) {
      throw new Error(`JIRA API request failed: ${response.status} ${response.statusText}`);
    }
    
    const userInfo = await response.json();
    console.log('Got user info from JIRA API:', userInfo);
    
    // 将 JIRA 用户信息转换为扩展所需的格式
    const formattedUserInfo = {
      fullName: userInfo.displayName || "",
      username: userInfo.name || "",
      ownerId: userInfo.key || "",
      userEmail: userInfo.emailAddress || "",
      extensionId: "", // JIRA API 没有提供 extensionId，保持为空
      jiraKey: userInfo.key || "", // 保存 JIRA 的 key 字段
      jiraTimezone: userInfo.timeZone || "",
      jiraLocale: userInfo.locale || ""
    };
    
    console.log('Formatted user info:', formattedUserInfo);
    return formattedUserInfo;
  } catch (error) {
    console.error('Error getting user info from JIRA API:', error);
    throw error;
  }
} 
