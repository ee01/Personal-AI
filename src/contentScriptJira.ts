/**
 * Jira内容脚本 - 设计链接显示功能
 * 在Jira ticket页面上显示设计链接
 */

import { createJiraHeaders } from './jira';
import { getEnvConfig } from './utils';

type UXTicketReference = {
  key: string;
  summary: string;
  source: string;
};

type FigmaDesignItem = {
  type: 'figma';
  url: string;
  source: 'description';
};

type UXDesignItem = {
  type: 'ux_ticket';
  url?: string;
  summary?: string;
  uxTicketKey: string;
  source: string;
  linkProvided: boolean;
  uxEpicKey?: string;
  uxEpicStatus?: string;
  uxEta?: string;
  uxEtaSource?: 'duedate' | 'fixVersion';
};

type DesignDisplayItem = FigmaDesignItem | UXDesignItem;

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

type UXEpicStatusTone = 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';

function getUXEpicStatusTone(status?: string): UXEpicStatusTone {
  const normalizedStatus = status?.trim().toLowerCase() || '';

  if (!normalizedStatus) return 'todo';

  const matchesAny = (keywords: string[]) => keywords.some(keyword => normalizedStatus.includes(keyword));

  if (matchesAny(['cancelled', 'canceled', "won't do", 'wont do', 'rejected', 'duplicate'])) {
    return 'cancelled';
  }

  if (matchesAny(['blocked', 'on hold', 'hold', 'pending'])) {
    return 'blocked';
  }

  if (matchesAny(['done', 'closed', 'complete', 'completed', 'resolved', 'released', 'shipped'])) {
    return 'done';
  }

  if (matchesAny(['in progress', 'progress', 'review', 'design review', 'testing', 'qa', 'verify', 'implement'])) {
    return 'in-progress';
  }

  return 'todo';
}

// 匹配项目Key的工具函数
// pattern 格式: "UX*" 表示前缀匹配, "RCV" 表示完全匹配项目部分
function matchesProjectPattern(ticketKey: string, pattern: string): boolean {
  if (!ticketKey || !pattern) return false;
  
  // 提取 ticket 的项目部分 (如 "RCV-123" -> "RCV", "UXDES-456" -> "UXDES")
  const projectPart = ticketKey.split('-')[0];
  if (!projectPart) return false;
  
  if (pattern.endsWith('*')) {
    // 前缀匹配: "UX*" 匹配 "UX", "UXDES", "UX123" 等
    const prefix = pattern.slice(0, -1);
    return projectPart.startsWith(prefix);
  } else {
    // 完全匹配: "RCV" 只匹配 "RCV"
    return projectPart === pattern;
  }
}

// 检测页面是否是Jira ticket详情页
function isJiraTicketPage(): boolean {
  return window.location.pathname.includes('/browse/');
}

// 从DOM获取当前ticket ID
function getTicketIdFromUrl(): string {
  const pathParts = window.location.pathname.split('/');
  return pathParts[pathParts.length - 1];
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

// 从DOM description中查找figma链接
function getFigmaLinksFromDescription(): { type: 'figma'; url: string; source: 'description' }[] {
  const figmaLinks: { type: 'figma'; url: string; source: 'description' }[] = [];
  
  // 查找description字段
  const descriptionElement = document.querySelector('#description-val') as HTMLElement;
  if (descriptionElement) {
    const text = descriptionElement.innerText || descriptionElement.textContent || '';
    const links = descriptionElement.querySelectorAll('a');
    
    // 从链接元素中查找figma链接
    links.forEach(link => {
      const href = link.href;
      if (href && (href.includes('figma.com') || href.includes('www.figma.com'))) {
        figmaLinks.push({
          type: 'figma',
          url: href,
          source: 'description'
        });
      }
    });
    
    // 从文本中使用正则查找figma链接
    const figmaRegex = /https?:\/\/(?:www\.)?figma\.com\/[^\s]+/g;
    const matches = text.match(figmaRegex);
    if (matches) {
      matches.forEach((url: string) => {
        // 避免重复添加
        if (!figmaLinks.some(link => link.url === url)) {
          figmaLinks.push({
            type: 'figma',
            url: url,
            source: 'description'
          });
        }
      });
    }
  }
  
  return figmaLinks;
}

// 从DOM中查找linked issues中的UX tickets
function getUXTicketsFromLinkedIssues(projectPrefix = 'UX'): { key: string; url: string; summary: string; source: 'linked_issues' }[] {
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
// 支持 token 和 cookie fallback 模式
async function fetchTicketData(ticketKey: string): Promise<any> {
  try {
    const headers = await createJiraHeaders();
    // 使用 expand=names 获取更多字段信息
    const response = await fetch(`/rest/api/2/issue/${ticketKey}?fields=issuelinks,subtasks&expand=names`, {
      method: 'GET',
      headers,
      credentials: 'include'  // 使用 cookie 认证（当没有 token 时作为 fallback）
    });
    if (!response.ok) throw new Error(`Failed to fetch ticket data: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching ticket data:', error);
    throw error;
  }
}

// 通过 JQL 查询 parent 字段获取所有 child issues
// 支持 token 和 cookie fallback 模式
async function fetchChildIssues(parentKey: string): Promise<any[]> {
  try {
    const headers = await createJiraHeaders();
    const jql = `issueFunction in portfolioChildrenOf("key=${parentKey}")`;
    const url = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,issuetype,status`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include'  // 使用 cookie 认证
    });
    if (!response.ok) throw new Error('Failed to fetch child issues');
    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.error('Error fetching child issues:', error);
    return [];
  }
}

// 查找UX类型的ticket
async function findUXTickets(parentData: any, currentTicketKey: string, projectPrefix = 'UX'): Promise<UXTicketReference[]> {
  try {
    const uxTickets: UXTicketReference[] = [];
    
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
      const headers = await createJiraHeaders();
      const response = await fetch(
        `/rest/api/2/issue/${issueKey}?fields=summary,status,issuetype,customfield_21233,customfield_11450,duedate,fixVersions&expand=names`,
        {
          method: 'GET',
          headers,
          credentials: 'include'
        }
      );
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

// 获取 UX ticket 的 design link 和对应 UX Epic 状态
async function fetchUXDesignContext(uxTicketKey: string): Promise<UXDesignContext | null> {
  const cachedContext = uxDesignContextCache.get(uxTicketKey);
  if (cachedContext) return cachedContext;

  const request = (async (): Promise<UXDesignContext | null> => {
    const uxIssue = await fetchJiraIssueContext(uxTicketKey);
    if (!uxIssue) return null;

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
      epicKey: uxIssue.epicKey,
      dueDate: uxIssue.dueDate,
      fixVersion: uxIssue.fixVersion,
      uxEpicKey,
      uxEpicStatus,
      uxEta: uxIssue.dueDate || uxIssue.fixVersion || undefined,
      uxEtaSource: uxIssue.dueDate ? 'duedate' : (uxIssue.fixVersion ? 'fixVersion' : undefined)
    };
  })();

  uxDesignContextCache.set(uxTicketKey, request);
  return request;
}

// 获取Epic ticket的Parent Link
// 支持 token 和 cookie fallback 模式
async function getEpicParentLink(epicKey: string): Promise<{ key: string; url: string } | null> {
  try {
    const headers = await createJiraHeaders();
    const response = await fetch(`/rest/api/2/issue/${epicKey}?fields=customfield_15751&expand=names`, {
      method: 'GET',
      headers,
      credentials: 'include'  // 使用 cookie 认证
    });
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
async function getUXTicketsFromEpic(epicKey: string, projectPrefix = 'UX'): Promise<UXTicketReference[]> {
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
  sourcePrefix?: string
): Promise<void> {
  for (const uxTicket of uxTickets) {
    const designContext = await fetchUXDesignContext(uxTicket.key);
    if (!designContext) continue;

    designData.push({
      type: 'ux_ticket',
      url: designContext.designLink || undefined,
      summary: uxTicket.summary || designContext.summary,
      uxTicketKey: uxTicket.key,
      source: sourcePrefix ? `${sourcePrefix}_${uxTicket.source}` : uxTicket.source,
      linkProvided: Boolean(designContext.designLink),
      uxEpicKey: designContext.uxEpicKey,
      uxEpicStatus: designContext.uxEpicStatus,
      uxEta: designContext.uxEta,
      uxEtaSource: designContext.uxEtaSource
    });
  }
}

function dedupeDesignData(designData: DesignDisplayItem[]): DesignDisplayItem[] {
  const seenFigmaUrls = new Set<string>();
  const seenUXKeys = new Set<string>();
  const uxUrls = new Set(
    designData
      .filter((item): item is UXDesignItem => item.type === 'ux_ticket' && Boolean(item.url))
      .map(item => item.url as string)
  );

  const uniqueDesignData: DesignDisplayItem[] = [];

  for (const item of designData) {
    if (item.type === 'ux_ticket') {
      const uxKey = `${item.uxTicketKey}:${item.url || '__missing__'}`;
      if (seenUXKeys.has(uxKey)) continue;
      seenUXKeys.add(uxKey);
      uniqueDesignData.push(item);
      continue;
    }

    if (uxUrls.has(item.url) || seenFigmaUrls.has(item.url)) continue;
    seenFigmaUrls.add(item.url);
    uniqueDesignData.push(item);
  }

  return uniqueDesignData;
}

// 显示设计链接
function displayDesignLinks(designData: DesignDisplayItem[]): void {
  const summaryElement = document.querySelector('.issue-header-content');
  if (!summaryElement) return;
  
  // 检查是否已经存在设计链接元素
  const existingLink = document.querySelector('.design-links-container');
  if (existingLink) existingLink.remove();
  
  if (designData.length === 0) return;
  
  const designLinksContainer = document.createElement('div');
  
  // 获取扩展内的 icon 路径
  const iconUrl = chrome.runtime.getURL('icons/icon48.png');

  designLinksContainer.className = 'design-links-container';
  
  let linksHtml = '';
  designData.forEach((design, _index) => {
    if (design.type === 'figma') {
      linksHtml += `
        <div class="design-link-item">
          <img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" />
          Design Link: <a href="${design.url}" target="_blank" class="design-link">
            Figma Design <span class="external-link-icon">↗️</span>
          </a>
          <span class="source-tag">${design.source}</span>
        </div>
      `;
    } else if (design.type === 'ux_ticket') {
      const uxTicketUrl = `/browse/${design.uxTicketKey}`;
      const uxEpicDisplayKey = design.uxEpicKey || design.uxTicketKey;
      const uxEpicUrl = `/browse/${uxEpicDisplayKey}`;
      const shouldShowMissingUxKey = !design.uxEpicStatus || uxEpicDisplayKey !== design.uxTicketKey;
      const uxEpicStatusTone = design.uxEpicStatus ? getUXEpicStatusTone(design.uxEpicStatus) : null;
      const prefixHtml = design.linkProvided ? '<span class="design-link-prefix">Design Link:</span>' : '';
      const designContent = design.linkProvided && design.url
        ? `
          <a href="${design.url}" target="_blank" class="design-link">
            ${design.summary || design.uxTicketKey} <span class="external-link-icon">↗️</span>
          </a>
          <a href="${uxTicketUrl}" target="_blank" class="ux-ticket-link">${design.uxTicketKey}</a>
        `
        : `
          <span class="design-link-missing">Design Link not provided</span>
          ${shouldShowMissingUxKey ? `<span class="ux-ticket-link-wrapper">(<a href="${uxTicketUrl}" target="_blank" class="ux-ticket-link">${design.uxTicketKey}</a>)</span>` : ''}
        `;
      const statusTag = design.uxEpicStatus
        ? `
          <span class="ux-epic-status-tag" title="${uxEpicDisplayKey}">
            <a href="${uxEpicUrl}" target="_blank" class="ux-epic-link">
              ${uxEpicDisplayKey} <span class="external-link-icon">↗️</span>
            </a>
            <span class="ux-epic-status-pill ux-epic-status-pill--${uxEpicStatusTone}">${design.uxEpicStatus}</span>
          </span>
        `
        : '';
      const etaTag = design.uxEta
        ? `<span class="ux-eta-tag" title="${design.uxEtaSource === 'duedate' ? 'Due date' : 'Fix Version'}">ETA: ${design.uxEta}</span>`
        : '';

      linksHtml += `
        <div class="design-link-item">
          <img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" />
          ${prefixHtml}
          ${designContent}
          ${statusTag}
          ${etaTag}
          <span class="source-tag">${design.source}</span>
        </div>
      `;
    }
  });
  
  designLinksContainer.innerHTML = `
    <div class="design-links-content">
      ${linksHtml}
    </div>
    <div class="design-links-footer">
      <span class="footer-text">Personal AI provided</span>
      <span class="author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank">Esone</a></span>
    </div>
  `;
  
  // 插入到Summary下方
  summaryElement.insertAdjacentElement('afterend', designLinksContainer);
  
  // 添加样式
  let style = document.getElementById('personal-ai-design-links-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'personal-ai-design-links-style';
    document.head.appendChild(style);
  }
  style.textContent = `
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
      max-height: ${40 + (designData.length - 1) * 30}px;
      z-index: 1;
    }
    .design-links-container:hover {
      max-height: ${80 + (designData.length - 1) * 30}px;
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
    .design-link-item {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      position: relative;
    }
    .design-link-item:last-child {
      margin-bottom: 0;
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
      margin-right: 6px;
    }
    .design-link {
      color: #0052cc;
      font-weight: 500;
      text-decoration: none;
    }
    .design-link:hover {
      text-decoration: underline;
    }
    .design-link-prefix {
      white-space: nowrap;
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
      letter-spacing: 0.01em;
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
    .source-tag {
      font-size: 10px;
      color: #666;
      background-color: #e6e6e6;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
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
    const headers = await createJiraHeaders();
    const response = await fetch(
      `/rest/api/2/issue/${ticketKey}?fields=customfield_18351,customfield_14354,fixVersions`,
      { method: 'GET', headers, credentials: 'include' }
    );
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
    const headers = await createJiraHeaders();
    const response = await fetch(
      `/rest/api/2/issue/${ticketKey}?fields=customfield_11450`,
      { method: 'GET', headers, credentials: 'include' }
    );
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
  const existing = document.querySelector('.backend-progress-container');
  if (existing) existing.remove();
  
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
async function collectAndDisplayBackendProgress(ticketId: string, depProject: string): Promise<void> {
  try {
    const allProgressData: BackendProgressData[] = [];
    
    const isSubtask = isSubtaskTicket();
    const isEpic = await isEpicTicket();
    
    if (isEpic) {
      // 当前是Epic，查找Epic自身的linked issues中的依赖ticket
      const epicData = await fetchTicketData(ticketId);
      const depTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
      for (const dep of depTickets) {
        const details = await fetchDependencyDetails(dep.key);
        let rolloutDate: string | null = null;
        if (details.fixVersion) {
          rolloutDate = await fetchRolloutDate(details.fixVersion);
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
        const depTickets = findDependencyTicketsFromData(parentData, depProject, ticketId);
        for (const dep of depTickets) {
          const details = await fetchDependencyDetails(dep.key);
          let rolloutDate: string | null = null;
          if (details.fixVersion) {
            rolloutDate = await fetchRolloutDate(details.fixVersion);
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
        if (epicKey) {
          const epicData = await fetchTicketData(epicKey);
          const epicDepTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
          for (const dep of epicDepTickets) {
            const details = await fetchDependencyDetails(dep.key);
            let rolloutDate: string | null = null;
            if (details.fixVersion) {
              rolloutDate = await fetchRolloutDate(details.fixVersion);
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
        let rolloutDate: string | null = null;
        if (details.fixVersion) {
          rolloutDate = await fetchRolloutDate(details.fixVersion);
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
        const epicDepTickets = findDependencyTicketsFromData(epicData, depProject, ticketId);
        for (const dep of epicDepTickets) {
          const details = await fetchDependencyDetails(dep.key);
          let rolloutDate: string | null = null;
          if (details.fixVersion) {
            rolloutDate = await fetchRolloutDate(details.fixVersion);
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
  if (!isJiraTicketPage()) return;
  
  try {
    // 获取当前ticket ID
    const ticketId = getTicketIdFromUrl();
    console.log('Current Jira ticket:', ticketId);
    
    // 加载配置
    const config = await getEnvConfig();
    const designProject = config.DESIGN_JIRA_PROJECT || 'UX';
    
    // 等待DOM加载完成
    await waitForElement('#customfield_15751-val, #customfield_11450-val, #type-val', 5000);
    
    const allDesignData: DesignDisplayItem[] = [];
    
    // 1. 从description中查找figma链接
    const figmaLinks = getFigmaLinksFromDescription();
    figmaLinks.forEach(link => {
      allDesignData.push({
        type: 'figma',
        url: link.url,
        source: link.source
      });
    });
    
    // 2. 从当前页面的linked issues中查找UX tickets
    const linkedUXTickets = getUXTicketsFromLinkedIssues(designProject);
    await appendUXDesignItems(allDesignData, linkedUXTickets);
    
    // 判断是否为Epic ticket
    if (await isEpicTicket()) {
      // 如果是Epic，直接从Epic中查找UX linked issues
      const epicUXTickets = await getUXTicketsFromEpic(ticketId, designProject);
      await appendUXDesignItems(allDesignData, epicUXTickets, 'epic');
      
      // 还需要检查Epic的Parent Link
      const parentLink = getParentLinkFromDOM();
      if (parentLink) {
        console.log('Parent ticket:', parentLink.key);
        const parentData = await fetchTicketData(parentLink.key);
        const parentUXTickets = await findUXTickets(parentData, ticketId, designProject);
        await appendUXDesignItems(allDesignData, parentUXTickets, 'parent');
      }
    } else {
      // 如果不是Epic，先获取Epic Link
      const epicLink = getParentEpicFromDOM();
      if (epicLink) {
        console.log('Epic ticket:', epicLink.key);
        
        // 从Epic中查找UX linked issues
        const epicUXTickets = await getUXTicketsFromEpic(epicLink.key, designProject);
        await appendUXDesignItems(allDesignData, epicUXTickets, 'epic');
        
        // 通过API获取Epic的Parent Link
        const parentLink = await getEpicParentLink(epicLink.key);
        if (parentLink) {
          console.log('Parent ticket:', parentLink.key);
          const parentData = await fetchTicketData(parentLink.key);
          const parentUXTickets = await findUXTickets(parentData, ticketId, designProject);
          await appendUXDesignItems(allDesignData, parentUXTickets, 'parent');
        }
      }
    }
    
    // 去重处理
    const uniqueDesignData = dedupeDesignData(allDesignData);
    
    if (uniqueDesignData.length > 0) {
      console.log('Design links found:', uniqueDesignData);
      displayDesignLinks(uniqueDesignData);
    } else {
      console.log('No design links found');
    }
    
    // === Backend Progress (外部依赖进展) ===
    const depProject = config.DEPENDENCIES_JIRA_PROJECT;
    if (depProject) {
      await collectAndDisplayBackendProgress(ticketId, depProject);
    }
    
  } catch (error) {
    console.error('Error fetching design links:', error);
  }
}

// 等待元素出现
function waitForElement(selector: string, timeoutMs: number): Promise<Element> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeoutMs);
  });
}

// 处理页面变化（SPA导航）
function handlePageChanges(): void {
  let currentUrl = location.href;
  
  const observer = new MutationObserver(() => {
    if (currentUrl !== location.href) {
      currentUrl = location.href;
      if (isJiraTicketPage()) {
        setTimeout(main, 1000); // 延迟执行，等待页面加载
      }
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(main, 1000); // 延迟执行，确保页面完全加载
  handlePageChanges();
});

// 在页面重新渲染时也执行
window.addEventListener('load', () => {
  setTimeout(main, 2000); // 延迟更长时间执行
});

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
// 支持 token 和 cookie fallback 模式
async function getUserInfoFromJiraAPI(): Promise<any> {
  try {
    console.log('Getting user info from JIRA API...');
    const headers = await createJiraHeaders();
    const response = await fetch(window.location.origin + '/rest/api/2/myself', {
      method: 'GET',
      headers,
      credentials: 'include'  // 使用 cookie 认证
    });
    
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
