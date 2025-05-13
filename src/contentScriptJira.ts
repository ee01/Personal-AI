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
async function findUXTicket(parentData: any, currentTicketKey: string): Promise<string | null> {
  try {
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
      ...subtasks.map((subtask: any) => subtask),
      ...issueLinks.map((link: any) => link.outwardIssue || link.inwardIssue).filter((issue: any) => issue),
      ...childIssues
    ];
    // 筛选UX开头且不是当前ticket的issue
    const uxTicket = allRelatedIssues.find((issue: any) => 
      issue.key && issue.key.startsWith('UX') && issue.key !== currentTicketKey
    );
    return uxTicket ? uxTicket.key : null;
  } catch (error) {
    console.error('Error finding UX ticket:', error);
    return null;
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

// 显示设计链接
function displayDesignLink(designLink: string): void {
  const summaryElement = document.querySelector('.issue-header-content');
  if (!summaryElement) return;
  
  // 检查是否已经存在设计链接元素
  const existingLink = document.querySelector('.design-link-container');
  if (existingLink) return;
  
  const designLinkContainer = document.createElement('div');
  
  // 获取扩展内的 icon 路径
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');

  designLinkContainer.className = 'design-link-container';
  designLinkContainer.innerHTML = `
    <div class="design-link-content">
      <img src="${iconUrl}" title="Personal AI provided" class="design-icon" style="width:16px;height:16px;vertical-align:middle;" />
      Design Link: <a href="${designLink}" target="_blank" class="design-link">
        ${designLink} <span class="external-link-icon">↗️</span>
      </a>
    </div>
    <div class="design-link-footer">
      <span class="footer-text">Personal AI provided</span>
      <span class="author-text">by <a href="https://app.ringcentral.com/messages/49046011906" target="_blank">Esone</a></span>
    </div>
  `;
  
  // 插入到Summary下方
  summaryElement.insertAdjacentElement('afterend', designLinkContainer);
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .design-link-container {
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
      max-height: 40px;
      z-index: 1;
    }
    .design-link-container:hover {
      max-height: 80px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      transform: translateY(4px);
      z-index: 1000;
    }
    .design-link-content {
      display: flex;
      align-items: center;
      background-color: #f0f5ff;
      position: relative;
      z-index: 2;
    }
    .design-link-footer {
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
    .design-link-container:hover .design-link-footer {
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
    
    let parentLink;
    
    // 判断是否为Epic ticket
    if (await isEpicTicket()) {
      // 如果是Epic，直接获取INIT Link
      parentLink = getParentLinkFromDOM();
    } else {
      // 如果不是Epic，先获取Epic Link
      const epicLink = getParentEpicFromDOM();
      if (!epicLink) {
        console.log('No Epic link found');
        return;
      }
      console.log('Epic ticket:', epicLink.key);
      
      // 通过API获取Epic的Parent Link
      parentLink = await getEpicParentLink(epicLink.key);
    }
    
    if (!parentLink) {
      console.log('No parent link found');
      return;
    }
    
    console.log('Parent ticket:', parentLink.key);
    
    // 获取Parent ticket数据
    const parentData = await fetchTicketData(parentLink.key);
    
    // 查找UX ticket
    const uxTicketKey = await findUXTicket(parentData, ticketId);
    if (!uxTicketKey) {
      console.log('No UX ticket found');
      return;
    }
    
    console.log('UX ticket:', uxTicketKey);
    
    // 获取设计链接
    const designLink = await getDesignLink(uxTicketKey);
    if (!designLink) {
      console.log('No design link found');
      return;
    }
    
    console.log('Design link found:', designLink);
    
    // 显示设计链接
    displayDesignLink(designLink);
    
  } catch (error) {
    console.error('Error fetching design link:', error);
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