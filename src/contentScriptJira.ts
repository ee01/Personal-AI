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

// 查找UX类型的ticket
async function findUXTicket(parentData: any, currentTicketKey: string): Promise<string | null> {
  try {
    // 获取所有关联的issues
    const issueLinks = parentData.fields.issuelinks || [];
    const subtasks = parentData.fields.subtasks || [];
    
    // 提取所有相关issue
    const allRelatedIssues = [
      ...subtasks.map((subtask: any) => subtask),
      ...issueLinks.map((link: any) => link.outwardIssue || link.inwardIssue).filter((issue: any) => issue)
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

// 显示设计链接
function displayDesignLink(designLink: string): void {
  const summaryElement = document.querySelector('.issue-header-content');
  if (!summaryElement) return;
  
  // 检查是否已经存在设计链接元素
  const existingLink = document.querySelector('.design-link-container');
  if (existingLink) return;
  
  const designLinkContainer = document.createElement('div');
  designLinkContainer.className = 'design-link-container';
  designLinkContainer.innerHTML = `
    <span class="design-icon">✨</span>
    <a href="${designLink}" target="_blank" class="design-link">
      Design: Figma Link <span class="external-link-icon">↗️</span>
    </a>
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
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
    .external-link-icon {
      font-size: 12px;
      margin-left: 4px;
    }
  `;
  document.head.appendChild(style);
}

// 主函数
async function main(): Promise<void> {
  if (!isJiraTicketPage()) return;
  
  try {
    // 获取当前ticket ID
    const ticketId = getTicketIdFromUrl();
    console.log('Current Jira ticket:', ticketId);
    
    // 等待DOM加载完成
    await waitForElement('#customfield_15751-val', 5000);
    
    // 从DOM获取Parent Link
    const parentLink = getParentLinkFromDOM();
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