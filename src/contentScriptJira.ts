/**
 * Jira内容脚本 - 设计链接显示功能
 * 在Jira ticket页面上显示设计链接
 */

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
function getUXTicketsFromLinkedIssues(): { key: string; url: string; summary: string; source: 'linked_issues' }[] {
  const uxTickets: { key: string; url: string; summary: string; source: 'linked_issues' }[] = [];
  
  // 查找Issue Links部分
  const issueLinkSections = document.querySelectorAll('.links-list .links-section');
  
  issueLinkSections.forEach(section => {
    const links = section.querySelectorAll('.issue-link-key');
    links.forEach(linkElement => {
      const key = linkElement.textContent?.trim();
      const href = (linkElement as HTMLAnchorElement).href;
      
      if (key && key.startsWith('UX') && href) {
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
async function fetchTicketData(ticketKey: string): Promise<any> {
  try {
    const response = await fetch(`/rest/api/2/issue/${ticketKey}?fields=issuelinks,subtasks`);
    if (!response.ok) throw new Error(`Failed to fetch ticket data: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching ticket data:', error);
    throw error;
  }
}

// 通过 JQL 查询 parent 字段获取所有 child issues
async function fetchChildIssues(parentKey: string): Promise<any[]> {
  try {
    const jql = `issueFunction in portfolioChildrenOf("key=${parentKey}")`;
    const url = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,issuetype,status`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch child issues');
    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.error('Error fetching child issues:', error);
    return [];
  }
}

// 查找UX类型的ticket
async function findUXTickets(parentData: any, currentTicketKey: string): Promise<{ key: string; summary: string; source: string }[]> {
  try {
    const uxTickets: { key: string; summary: string; source: string }[] = [];
    
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
    
    // 筛选UX开头且不是当前ticket的issue
    allRelatedIssues.forEach((issue: any) => {
      if (issue.key && issue.key.startsWith('UX') && issue.key !== currentTicketKey) {
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

// 获取设计链接
async function getDesignLink(uxTicketKey: string): Promise<string | null> {
  try {
    const response = await fetch(`/rest/api/2/issue/${uxTicketKey}?fields=customfield_21233`);
    if (!response.ok) throw new Error(`Failed to fetch UX ticket: ${response.statusText}`);
    const data = await response.json();
    return data.fields.customfield_21233 || null;
  } catch (error) {
    console.error('Error fetching design link:', error);
    return null;
  }
}

// 获取Epic ticket的Parent Link
async function getEpicParentLink(epicKey: string): Promise<{ key: string; url: string } | null> {
  try {
    const response = await fetch(`/rest/api/2/issue/${epicKey}?fields=customfield_15751`);
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
async function getUXTicketsFromEpic(epicKey: string): Promise<{ key: string; summary: string; source: string }[]> {
  try {
    const epicData = await fetchTicketData(epicKey);
    return await findUXTickets(epicData, ''); // 传空字符串作为currentTicketKey
  } catch (error) {
    console.error('Error fetching UX tickets from Epic:', error);
    return [];
  }
}

// 显示设计链接
function displayDesignLinks(designData: { 
  type: 'figma' | 'ux_ticket'; 
  url: string; 
  summary?: string; 
  uxTicketKey?: string;
  source: string;
}[]): void {
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
      linksHtml += `
        <div class="design-link-item">
          <img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" />
          Design Link: <a href="${design.url}" target="_blank" class="design-link">
            ${design.summary || design.uxTicketKey} <span class="external-link-icon">↗️</span>
          </a>
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
  const style = document.createElement('style');
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
      margin-left: 4px;
    }
    .design-link:hover {
      text-decoration: underline;
    }
    .external-link-icon {
      font-size: 12px;
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
  document.head.appendChild(style);
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

// 主函数
async function main(): Promise<void> {
  if (!isJiraTicketPage()) return;
  
  try {
    // 获取当前ticket ID
    const ticketId = getTicketIdFromUrl();
    console.log('Current Jira ticket:', ticketId);
    
    // 等待DOM加载完成
    await waitForElement('#customfield_15751-val, #customfield_11450-val, #type-val', 5000);
    
    const allDesignData: { 
      type: 'figma' | 'ux_ticket'; 
      url: string; 
      summary?: string; 
      uxTicketKey?: string;
      source: string;
    }[] = [];
    
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
    const linkedUXTickets = getUXTicketsFromLinkedIssues();
    for (const uxTicket of linkedUXTickets) {
      const designLink = await getDesignLink(uxTicket.key);
      if (designLink) {
        allDesignData.push({
          type: 'ux_ticket',
          url: designLink,
          summary: uxTicket.summary,
          uxTicketKey: uxTicket.key,
          source: uxTicket.source
        });
      }
    }
    
    // 判断是否为Epic ticket
    if (await isEpicTicket()) {
      // 如果是Epic，直接从Epic中查找UX linked issues
      const epicUXTickets = await getUXTicketsFromEpic(ticketId);
      for (const uxTicket of epicUXTickets) {
        const designLink = await getDesignLink(uxTicket.key);
        if (designLink) {
          allDesignData.push({
            type: 'ux_ticket',
            url: designLink,
            summary: uxTicket.summary,
            uxTicketKey: uxTicket.key,
            source: `epic_${uxTicket.source}`
          });
        }
      }
      
      // 还需要检查Epic的Parent Link
      const parentLink = getParentLinkFromDOM();
      if (parentLink) {
        console.log('Parent ticket:', parentLink.key);
        const parentData = await fetchTicketData(parentLink.key);
        const parentUXTickets = await findUXTickets(parentData, ticketId);
        for (const uxTicket of parentUXTickets) {
          const designLink = await getDesignLink(uxTicket.key);
          if (designLink) {
            allDesignData.push({
              type: 'ux_ticket',
              url: designLink,
              summary: uxTicket.summary,
              uxTicketKey: uxTicket.key,
              source: `parent_${uxTicket.source}`
            });
          }
        }
      }
    } else {
      // 如果不是Epic，先获取Epic Link
      const epicLink = getParentEpicFromDOM();
      if (epicLink) {
        console.log('Epic ticket:', epicLink.key);
        
        // 从Epic中查找UX linked issues
        const epicUXTickets = await getUXTicketsFromEpic(epicLink.key);
        for (const uxTicket of epicUXTickets) {
          const designLink = await getDesignLink(uxTicket.key);
          if (designLink) {
            allDesignData.push({
              type: 'ux_ticket',
              url: designLink,
              summary: uxTicket.summary,
              uxTicketKey: uxTicket.key,
              source: `epic_${uxTicket.source}`
            });
          }
        }
        
        // 通过API获取Epic的Parent Link
        const parentLink = await getEpicParentLink(epicLink.key);
        if (parentLink) {
          console.log('Parent ticket:', parentLink.key);
          const parentData = await fetchTicketData(parentLink.key);
          const parentUXTickets = await findUXTickets(parentData, ticketId);
          for (const uxTicket of parentUXTickets) {
            const designLink = await getDesignLink(uxTicket.key);
            if (designLink) {
              allDesignData.push({
                type: 'ux_ticket',
                url: designLink,
                summary: uxTicket.summary,
                uxTicketKey: uxTicket.key,
                source: `parent_${uxTicket.source}`
              });
            }
          }
        }
      }
    }
    
    // 去重处理
    const uniqueDesignData = allDesignData.filter((item, index, self) => 
      index === self.findIndex(t => t.url === item.url)
    );
    
    if (uniqueDesignData.length > 0) {
      console.log('Design links found:', uniqueDesignData);
      displayDesignLinks(uniqueDesignData);
    } else {
      console.log('No design links found');
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
async function getUserInfoFromJiraAPI(): Promise<any> {
  try {
    console.log('Getting user info from JIRA API...');
    const response = await fetch(window.location.origin + '/rest/api/2/myself', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
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