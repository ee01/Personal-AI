/******/ (() => { // webpackBootstrap
/*!**********************************!*\
  !*** ./src/contentScriptJira.ts ***!
  \**********************************/
/**
 * Jira内容脚本 - 设计链接显示功能
 * 在Jira ticket页面上显示设计链接
 */

// 检测页面是否是Jira ticket详情页
function isJiraTicketPage() {
  return window.location.pathname.includes('/browse/');
}

// 从DOM获取当前ticket ID
function getTicketIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

// 从DOM中查找Parent Link
function getParentLinkFromDOM() {
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
function getParentEpicFromDOM() {
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
async function fetchTicketData(ticketKey) {
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
async function fetchChildIssues(parentKey) {
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
async function findUXTicket(parentData, currentTicketKey) {
  try {
    // 获取所有关联的issues
    const issueLinks = parentData.fields.issuelinks || [];
    const subtasks = parentData.fields.subtasks || [];
    // 通过 JQL 查找 child issues
    const parentKey = parentData.key || parentData.id;
    let childIssues = [];
    if (parentKey) {
      childIssues = await fetchChildIssues(parentKey);
    }
    // 提取所有相关issue
    const allRelatedIssues = [...subtasks.map(subtask => subtask), ...issueLinks.map(link => link.outwardIssue || link.inwardIssue).filter(issue => issue), ...childIssues];
    // 筛选UX开头且不是当前ticket的issue
    const uxTicket = allRelatedIssues.find(issue => issue.key && issue.key.startsWith('UX') && issue.key !== currentTicketKey);
    return uxTicket ? uxTicket.key : null;
  } catch (error) {
    console.error('Error finding UX ticket:', error);
    return null;
  }
}

// 获取设计链接
async function getDesignLink(uxTicketKey) {
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
async function getEpicParentLink(epicKey) {
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
function displayDesignLink(designLink) {
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
async function isEpicTicket() {
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
async function main() {
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
function waitForElement(selector, timeoutMs) {
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
function handlePageChanges() {
  let currentUrl = location.href;
  const observer = new MutationObserver(() => {
    if (currentUrl !== location.href) {
      currentUrl = location.href;
      if (isJiraTicketPage()) {
        setTimeout(main, 1000); // 延迟执行，等待页面加载
      }
    }
  });
  observer.observe(document, {
    subtree: true,
    childList: true
  });
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
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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b3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEppcmHlhoXlrrnohJrmnKwgLSDorr7orqHpk77mjqXmmL7npLrlip/og71cbiAqIOWcqEppcmEgdGlja2V06aG16Z2i5LiK5pi+56S66K6+6K6h6ZO+5o6lXG4gKi9cblxuLy8g5qOA5rWL6aG16Z2i5piv5ZCm5pivSmlyYSB0aWNrZXTor6bmg4XpobVcbmZ1bmN0aW9uIGlzSmlyYVRpY2tldFBhZ2UoKTogYm9vbGVhbiB7XG4gIHJldHVybiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuaW5jbHVkZXMoJy9icm93c2UvJyk7XG59XG5cbi8vIOS7jkRPTeiOt+WPluW9k+WJjXRpY2tldCBJRFxuZnVuY3Rpb24gZ2V0VGlja2V0SWRGcm9tVXJsKCk6IHN0cmluZyB7XG4gIGNvbnN0IHBhdGhQYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zcGxpdCgnLycpO1xuICByZXR1cm4gcGF0aFBhcnRzW3BhdGhQYXJ0cy5sZW5ndGggLSAxXTtcbn1cblxuLy8g5LuORE9N5Lit5p+l5om+UGFyZW50IExpbmtcbmZ1bmN0aW9uIGdldFBhcmVudExpbmtGcm9tRE9NKCk6IHsga2V5OiBzdHJpbmc7IHVybDogc3RyaW5nIH0gfCBudWxsIHtcbiAgLy8g5p+l5om+Y3VzdG9tZmllbGRfMTU3NTHlrZfmrrVcbiAgY29uc3QgcGFyZW50TGlua0VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3VzdG9tZmllbGRfMTU3NTEtdmFsJyk7XG4gIGlmIChwYXJlbnRMaW5rRWxlbWVudCkge1xuICAgIGNvbnN0IGxpbmtFbGVtZW50ID0gcGFyZW50TGlua0VsZW1lbnQucXVlcnlTZWxlY3RvcignYScpO1xuICAgIGlmIChsaW5rRWxlbWVudCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBsaW5rRWxlbWVudC50ZXh0Q29udGVudC50cmltKCksXG4gICAgICAgIHVybDogbGlua0VsZW1lbnQuaHJlZlxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIOS7jkRPTeS4reafpeaJvuS4iue6p0VwaWMgdGlja2V0XG5mdW5jdGlvbiBnZXRQYXJlbnRFcGljRnJvbURPTSgpOiB7IGtleTogc3RyaW5nOyB1cmw6IHN0cmluZywgbmFtZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgLy8g5p+l5om+RXBpYyBMaW5r5a2X5q61XG4gIGNvbnN0IGVwaWNMaW5rRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjdXN0b21maWVsZF8xMTQ1MC12YWwnKTtcbiAgaWYgKGVwaWNMaW5rRWxlbWVudCkge1xuICAgIGNvbnN0IGxpbmtFbGVtZW50ID0gZXBpY0xpbmtFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EnKTtcbiAgICBpZiAobGlua0VsZW1lbnQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGxpbmtFbGVtZW50LnRleHRDb250ZW50LnRyaW0oKSxcbiAgICAgICAga2V5OiBsaW5rRWxlbWVudC5ocmVmLnNwbGl0KCcvJykucG9wKCkgfHwgJycsXG4gICAgICAgIHVybDogbGlua0VsZW1lbnQuaHJlZlxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIOiwg+eUqEppcmEgQVBJ6I635Y+W56Wo5o2u5L+h5oGvXG5hc3luYyBmdW5jdGlvbiBmZXRjaFRpY2tldERhdGEodGlja2V0S2V5OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYC9yZXN0L2FwaS8yL2lzc3VlLyR7dGlja2V0S2V5fT9maWVsZHM9aXNzdWVsaW5rcyxzdWJ0YXNrc2ApO1xuICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIHRpY2tldCBkYXRhOiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyB0aWNrZXQgZGF0YTonLCBlcnJvcik7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLy8g6YCa6L+HIEpRTCDmn6Xor6IgcGFyZW50IOWtl+auteiOt+WPluaJgOaciSBjaGlsZCBpc3N1ZXNcbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ2hpbGRJc3N1ZXMocGFyZW50S2V5OiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XG4gIHRyeSB7XG4gICAgY29uc3QganFsID0gYGlzc3VlRnVuY3Rpb24gaW4gcG9ydGZvbGlvQ2hpbGRyZW5PZihcImtleT0ke3BhcmVudEtleX1cIilgO1xuICAgIGNvbnN0IHVybCA9IGAvcmVzdC9hcGkvMi9zZWFyY2g/anFsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGpxbCl9JmZpZWxkcz1rZXksc3VtbWFyeSxpc3N1ZXR5cGUsc3RhdHVzYDtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggY2hpbGQgaXNzdWVzJyk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXR1cm4gZGF0YS5pc3N1ZXMgfHwgW107XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgY2hpbGQgaXNzdWVzOicsIGVycm9yKTtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLy8g5p+l5om+VVjnsbvlnovnmoR0aWNrZXRcbmFzeW5jIGZ1bmN0aW9uIGZpbmRVWFRpY2tldChwYXJlbnREYXRhOiBhbnksIGN1cnJlbnRUaWNrZXRLZXk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIC8vIOiOt+WPluaJgOacieWFs+iBlOeahGlzc3Vlc1xuICAgIGNvbnN0IGlzc3VlTGlua3MgPSBwYXJlbnREYXRhLmZpZWxkcy5pc3N1ZWxpbmtzIHx8IFtdO1xuICAgIGNvbnN0IHN1YnRhc2tzID0gcGFyZW50RGF0YS5maWVsZHMuc3VidGFza3MgfHwgW107XG4gICAgLy8g6YCa6L+HIEpRTCDmn6Xmib4gY2hpbGQgaXNzdWVzXG4gICAgY29uc3QgcGFyZW50S2V5ID0gcGFyZW50RGF0YS5rZXkgfHwgcGFyZW50RGF0YS5pZDtcbiAgICBsZXQgY2hpbGRJc3N1ZXM6IGFueVtdID0gW107XG4gICAgaWYgKHBhcmVudEtleSkge1xuICAgICAgY2hpbGRJc3N1ZXMgPSBhd2FpdCBmZXRjaENoaWxkSXNzdWVzKHBhcmVudEtleSk7XG4gICAgfVxuICAgIC8vIOaPkOWPluaJgOacieebuOWFs2lzc3VlXG4gICAgY29uc3QgYWxsUmVsYXRlZElzc3VlcyA9IFtcbiAgICAgIC4uLnN1YnRhc2tzLm1hcCgoc3VidGFzazogYW55KSA9PiBzdWJ0YXNrKSxcbiAgICAgIC4uLmlzc3VlTGlua3MubWFwKChsaW5rOiBhbnkpID0+IGxpbmsub3V0d2FyZElzc3VlIHx8IGxpbmsuaW53YXJkSXNzdWUpLmZpbHRlcigoaXNzdWU6IGFueSkgPT4gaXNzdWUpLFxuICAgICAgLi4uY2hpbGRJc3N1ZXNcbiAgICBdO1xuICAgIC8vIOetm+mAiVVY5byA5aS05LiU5LiN5piv5b2T5YmNdGlja2V055qEaXNzdWVcbiAgICBjb25zdCB1eFRpY2tldCA9IGFsbFJlbGF0ZWRJc3N1ZXMuZmluZCgoaXNzdWU6IGFueSkgPT4gXG4gICAgICBpc3N1ZS5rZXkgJiYgaXNzdWUua2V5LnN0YXJ0c1dpdGgoJ1VYJykgJiYgaXNzdWUua2V5ICE9PSBjdXJyZW50VGlja2V0S2V5XG4gICAgKTtcbiAgICByZXR1cm4gdXhUaWNrZXQgPyB1eFRpY2tldC5rZXkgOiBudWxsO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZpbmRpbmcgVVggdGlja2V0OicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyDojrflj5borr7orqHpk77mjqVcbmFzeW5jIGZ1bmN0aW9uIGdldERlc2lnbkxpbmsodXhUaWNrZXRLZXk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYC9yZXN0L2FwaS8yL2lzc3VlLyR7dXhUaWNrZXRLZXl9P2ZpZWxkcz1jdXN0b21maWVsZF8yMTIzM2ApO1xuICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIFVYIHRpY2tldDogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWApO1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgcmV0dXJuIGRhdGEuZmllbGRzLmN1c3RvbWZpZWxkXzIxMjMzIHx8IG51bGw7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgZGVzaWduIGxpbms6JywgZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8vIOiOt+WPlkVwaWMgdGlja2V055qEUGFyZW50IExpbmtcbmFzeW5jIGZ1bmN0aW9uIGdldEVwaWNQYXJlbnRMaW5rKGVwaWNLZXk6IHN0cmluZyk6IFByb21pc2U8eyBrZXk6IHN0cmluZzsgdXJsOiBzdHJpbmcgfSB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAvcmVzdC9hcGkvMi9pc3N1ZS8ke2VwaWNLZXl9P2ZpZWxkcz1jdXN0b21maWVsZF8xNTc1MWApO1xuICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIEVwaWMgdGlja2V0OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICBcbiAgICBjb25zdCBwYXJlbnRLZXkgPSBkYXRhLmZpZWxkcy5jdXN0b21maWVsZF8xNTc1MTtcbiAgICBpZiAoIXBhcmVudEtleSkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogcGFyZW50S2V5LFxuICAgICAgdXJsOiBgL2Jyb3dzZS8ke3BhcmVudEtleX1gXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBFcGljIHBhcmVudCBsaW5rOicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyDmmL7npLrorr7orqHpk77mjqVcbmZ1bmN0aW9uIGRpc3BsYXlEZXNpZ25MaW5rKGRlc2lnbkxpbms6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBzdW1tYXJ5RWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5pc3N1ZS1oZWFkZXItY29udGVudCcpO1xuICBpZiAoIXN1bW1hcnlFbGVtZW50KSByZXR1cm47XG4gIFxuICAvLyDmo4Dmn6XmmK/lkKblt7Lnu4/lrZjlnKjorr7orqHpk77mjqXlhYPntKBcbiAgY29uc3QgZXhpc3RpbmdMaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRlc2lnbi1saW5rLWNvbnRhaW5lcicpO1xuICBpZiAoZXhpc3RpbmdMaW5rKSByZXR1cm47XG4gIFxuICBjb25zdCBkZXNpZ25MaW5rQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIFxuICAvLyDojrflj5bmianlsZXlhoXnmoQgaWNvbiDot6/lvoRcbiAgY29uc3QgaWNvblVybCA9IGNocm9tZS5ydW50aW1lLmdldFVSTCgnaWNvbnMvaWNvbjE2LnBuZycpO1xuXG4gIGRlc2lnbkxpbmtDb250YWluZXIuY2xhc3NOYW1lID0gJ2Rlc2lnbi1saW5rLWNvbnRhaW5lcic7XG4gIGRlc2lnbkxpbmtDb250YWluZXIuaW5uZXJIVE1MID0gYFxuICAgIDxkaXYgY2xhc3M9XCJkZXNpZ24tbGluay1jb250ZW50XCI+XG4gICAgICA8aW1nIHNyYz1cIiR7aWNvblVybH1cIiB0aXRsZT1cIlBlcnNvbmFsIEFJIHByb3ZpZGVkXCIgY2xhc3M9XCJkZXNpZ24taWNvblwiIHN0eWxlPVwid2lkdGg6MTZweDtoZWlnaHQ6MTZweDt2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7XCIgLz5cbiAgICAgIERlc2lnbiBMaW5rOiA8YSBocmVmPVwiJHtkZXNpZ25MaW5rfVwiIHRhcmdldD1cIl9ibGFua1wiIGNsYXNzPVwiZGVzaWduLWxpbmtcIj5cbiAgICAgICAgJHtkZXNpZ25MaW5rfSA8c3BhbiBjbGFzcz1cImV4dGVybmFsLWxpbmstaWNvblwiPuKGl++4jzwvc3Bhbj5cbiAgICAgIDwvYT5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiZGVzaWduLWxpbmstZm9vdGVyXCI+XG4gICAgICA8c3BhbiBjbGFzcz1cImZvb3Rlci10ZXh0XCI+UGVyc29uYWwgQUkgcHJvdmlkZWQ8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cImF1dGhvci10ZXh0XCI+YnkgPGEgaHJlZj1cImh0dHBzOi8vYXBwLnJpbmdjZW50cmFsLmNvbS9tZXNzYWdlcy80OTA0NjAxMTkwNlwiIHRhcmdldD1cIl9ibGFua1wiPkVzb25lPC9hPjwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgYDtcbiAgXG4gIC8vIOaPkuWFpeWIsFN1bW1hcnnkuIvmlrlcbiAgc3VtbWFyeUVsZW1lbnQuaW5zZXJ0QWRqYWNlbnRFbGVtZW50KCdhZnRlcmVuZCcsIGRlc2lnbkxpbmtDb250YWluZXIpO1xuICBcbiAgLy8g5re75Yqg5qC35byPXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgLmRlc2lnbi1saW5rLWNvbnRhaW5lciB7XG4gICAgICBtYXJnaW46IDEwcHggMDtcbiAgICAgIHBhZGRpbmc6IDhweCAxMnB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2YwZjVmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDNweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4zcyBlYXNlO1xuICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgb3ZlcmZsb3c6IHZpc2libGU7XG4gICAgICBtYXgtaGVpZ2h0OiA0MHB4O1xuICAgICAgei1pbmRleDogMTtcbiAgICB9XG4gICAgLmRlc2lnbi1saW5rLWNvbnRhaW5lcjpob3ZlciB7XG4gICAgICBtYXgtaGVpZ2h0OiA4MHB4O1xuICAgICAgYm94LXNoYWRvdzogMCA0cHggOHB4IHJnYmEoMCwwLDAsMC4xNSk7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHotaW5kZXg6IDEwMDA7XG4gICAgfVxuICAgIC5kZXNpZ24tbGluay1jb250ZW50IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2YwZjVmZjtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgfVxuICAgIC5kZXNpZ24tbGluay1mb290ZXIge1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgY29sb3I6ICM2NjY7XG4gICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgcGFkZGluZy10b3A6IDhweDtcbiAgICAgIGJvcmRlci10b3A6IDFweCBkYXNoZWQgI2NjYztcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwcHgpO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIDAuM3MgZWFzZTtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMTAwJTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmMGY1ZmY7XG4gICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDAgMCA0cHggNHB4O1xuICAgICAgYm94LXNoYWRvdzogMCA0cHggOHB4IHJnYmEoMCwwLDAsMC4xNSk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICB9XG4gICAgLmRlc2lnbi1saW5rLWNvbnRhaW5lcjpob3ZlciAuZGVzaWduLWxpbmstZm9vdGVyIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuICAgIC5mb290ZXItdGV4dCB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBjb2xvcjogIzY2NjtcbiAgICB9XG4gICAgLmF1dGhvci10ZXh0IHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGNvbG9yOiAjNjY2O1xuICAgIH1cbiAgICAuYXV0aG9yLXRleHQgYSB7XG4gICAgICBjb2xvcjogaW5oZXJpdDtcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICB9XG4gICAgLmF1dGhvci10ZXh0IGE6aG92ZXIge1xuICAgICAgdGV4dC1kZWNvcmF0aW9uOiB1bmRlcmxpbmU7XG4gICAgfVxuICAgIC5kZXNpZ24taWNvbiB7XG4gICAgICBtYXJnaW4tcmlnaHQ6IDZweDtcbiAgICB9XG4gICAgLmRlc2lnbi1saW5rIHtcbiAgICAgIGNvbG9yOiAjMDA1MmNjO1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuICAgIC5kZXNpZ24tbGluazpob3ZlciB7XG4gICAgICB0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcbiAgICB9XG4gICAgLmV4dGVybmFsLWxpbmstaWNvbiB7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBtYXJnaW4tbGVmdDogNHB4O1xuICAgIH1cbiAgYDtcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG5cbi8vIOWIpOaWreaYr+WQpuS4ukVwaWMgdGlja2V0XG5hc3luYyBmdW5jdGlvbiBpc0VwaWNUaWNrZXQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgaXNzdWVUeXBlRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0eXBlLXZhbCcpO1xuICAgIGlmICghaXNzdWVUeXBlRWxlbWVudCkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGNvbnN0IGlzc3VlVHlwZSA9IGlzc3VlVHlwZUVsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICByZXR1cm4gaXNzdWVUeXBlID09PSAnRXBpYyc7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgY2hlY2tpbmcgRXBpYyB0eXBlOicsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8g5Li75Ye95pWwXG5hc3luYyBmdW5jdGlvbiBtYWluKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIWlzSmlyYVRpY2tldFBhZ2UoKSkgcmV0dXJuO1xuICBcbiAgdHJ5IHtcbiAgICAvLyDojrflj5blvZPliY10aWNrZXQgSURcbiAgICBjb25zdCB0aWNrZXRJZCA9IGdldFRpY2tldElkRnJvbVVybCgpO1xuICAgIGNvbnNvbGUubG9nKCdDdXJyZW50IEppcmEgdGlja2V0OicsIHRpY2tldElkKTtcbiAgICBcbiAgICAvLyDnrYnlvoVET03liqDovb3lrozmiJBcbiAgICBhd2FpdCB3YWl0Rm9yRWxlbWVudCgnI2N1c3RvbWZpZWxkXzE1NzUxLXZhbCwgI2N1c3RvbWZpZWxkXzExNDUwLXZhbCwgI3R5cGUtdmFsJywgNTAwMCk7XG4gICAgXG4gICAgbGV0IHBhcmVudExpbms7XG4gICAgXG4gICAgLy8g5Yik5pat5piv5ZCm5Li6RXBpYyB0aWNrZXRcbiAgICBpZiAoYXdhaXQgaXNFcGljVGlja2V0KCkpIHtcbiAgICAgIC8vIOWmguaenOaYr0VwaWPvvIznm7TmjqXojrflj5ZJTklUIExpbmtcbiAgICAgIHBhcmVudExpbmsgPSBnZXRQYXJlbnRMaW5rRnJvbURPTSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDlpoLmnpzkuI3mmK9FcGlj77yM5YWI6I635Y+WRXBpYyBMaW5rXG4gICAgICBjb25zdCBlcGljTGluayA9IGdldFBhcmVudEVwaWNGcm9tRE9NKCk7XG4gICAgICBpZiAoIWVwaWNMaW5rKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdObyBFcGljIGxpbmsgZm91bmQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc29sZS5sb2coJ0VwaWMgdGlja2V0OicsIGVwaWNMaW5rLmtleSk7XG4gICAgICBcbiAgICAgIC8vIOmAmui/h0FQSeiOt+WPlkVwaWPnmoRQYXJlbnQgTGlua1xuICAgICAgcGFyZW50TGluayA9IGF3YWl0IGdldEVwaWNQYXJlbnRMaW5rKGVwaWNMaW5rLmtleSk7XG4gICAgfVxuICAgIFxuICAgIGlmICghcGFyZW50TGluaykge1xuICAgICAgY29uc29sZS5sb2coJ05vIHBhcmVudCBsaW5rIGZvdW5kJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKCdQYXJlbnQgdGlja2V0OicsIHBhcmVudExpbmsua2V5KTtcbiAgICBcbiAgICAvLyDojrflj5ZQYXJlbnQgdGlja2V05pWw5o2uXG4gICAgY29uc3QgcGFyZW50RGF0YSA9IGF3YWl0IGZldGNoVGlja2V0RGF0YShwYXJlbnRMaW5rLmtleSk7XG4gICAgXG4gICAgLy8g5p+l5om+VVggdGlja2V0XG4gICAgY29uc3QgdXhUaWNrZXRLZXkgPSBhd2FpdCBmaW5kVVhUaWNrZXQocGFyZW50RGF0YSwgdGlja2V0SWQpO1xuICAgIGlmICghdXhUaWNrZXRLZXkpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdObyBVWCB0aWNrZXQgZm91bmQnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coJ1VYIHRpY2tldDonLCB1eFRpY2tldEtleSk7XG4gICAgXG4gICAgLy8g6I635Y+W6K6+6K6h6ZO+5o6lXG4gICAgY29uc3QgZGVzaWduTGluayA9IGF3YWl0IGdldERlc2lnbkxpbmsodXhUaWNrZXRLZXkpO1xuICAgIGlmICghZGVzaWduTGluaykge1xuICAgICAgY29uc29sZS5sb2coJ05vIGRlc2lnbiBsaW5rIGZvdW5kJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKCdEZXNpZ24gbGluayBmb3VuZDonLCBkZXNpZ25MaW5rKTtcbiAgICBcbiAgICAvLyDmmL7npLrorr7orqHpk77mjqVcbiAgICBkaXNwbGF5RGVzaWduTGluayhkZXNpZ25MaW5rKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBkZXNpZ24gbGluazonLCBlcnJvcik7XG4gIH1cbn1cblxuLy8g562J5b6F5YWD57Sg5Ye6546wXG5mdW5jdGlvbiB3YWl0Rm9yRWxlbWVudChzZWxlY3Rvcjogc3RyaW5nLCB0aW1lb3V0TXM6IG51bWJlcik6IFByb21pc2U8RWxlbWVudD4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGlmIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcikpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGlmIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSkge1xuICAgICAgICBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICAgIHJlc29sdmUoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcikpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZVxuICAgIH0pO1xuICAgIFxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcihgVGltZW91dCB3YWl0aW5nIGZvciBlbGVtZW50OiAke3NlbGVjdG9yfWApKTtcbiAgICB9LCB0aW1lb3V0TXMpO1xuICB9KTtcbn1cblxuLy8g5aSE55CG6aG16Z2i5Y+Y5YyW77yIU1BB5a+86Iiq77yJXG5mdW5jdGlvbiBoYW5kbGVQYWdlQ2hhbmdlcygpOiB2b2lkIHtcbiAgbGV0IGN1cnJlbnRVcmwgPSBsb2NhdGlvbi5ocmVmO1xuICBcbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRVcmwgIT09IGxvY2F0aW9uLmhyZWYpIHtcbiAgICAgIGN1cnJlbnRVcmwgPSBsb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKGlzSmlyYVRpY2tldFBhZ2UoKSkge1xuICAgICAgICBzZXRUaW1lb3V0KG1haW4sIDEwMDApOyAvLyDlu7bov5/miafooYzvvIznrYnlvoXpobXpnaLliqDovb1cbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSk7XG59XG5cbi8vIOmhtemdouWKoOi9veaXtuaJp+ihjFxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcbiAgc2V0VGltZW91dChtYWluLCAxMDAwKTsgLy8g5bu26L+f5omn6KGM77yM56Gu5L+d6aG16Z2i5a6M5YWo5Yqg6L29XG4gIGhhbmRsZVBhZ2VDaGFuZ2VzKCk7XG59KTtcblxuLy8g5Zyo6aG16Z2i6YeN5paw5riy5p+T5pe25Lmf5omn6KGMXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgc2V0VGltZW91dChtYWluLCAyMDAwKTsgLy8g5bu26L+f5pu06ZW/5pe26Ze05omn6KGMXG59KTsgIl0sIm5hbWVzIjpbImlzSmlyYVRpY2tldFBhZ2UiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiaW5jbHVkZXMiLCJnZXRUaWNrZXRJZEZyb21VcmwiLCJwYXRoUGFydHMiLCJzcGxpdCIsImxlbmd0aCIsImdldFBhcmVudExpbmtGcm9tRE9NIiwicGFyZW50TGlua0VsZW1lbnQiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJsaW5rRWxlbWVudCIsImtleSIsInRleHRDb250ZW50IiwidHJpbSIsInVybCIsImhyZWYiLCJnZXRQYXJlbnRFcGljRnJvbURPTSIsImVwaWNMaW5rRWxlbWVudCIsIm5hbWUiLCJwb3AiLCJmZXRjaFRpY2tldERhdGEiLCJ0aWNrZXRLZXkiLCJyZXNwb25zZSIsImZldGNoIiwib2siLCJFcnJvciIsInN0YXR1c1RleHQiLCJqc29uIiwiZXJyb3IiLCJjb25zb2xlIiwiZmV0Y2hDaGlsZElzc3VlcyIsInBhcmVudEtleSIsImpxbCIsImVuY29kZVVSSUNvbXBvbmVudCIsImRhdGEiLCJpc3N1ZXMiLCJmaW5kVVhUaWNrZXQiLCJwYXJlbnREYXRhIiwiY3VycmVudFRpY2tldEtleSIsImlzc3VlTGlua3MiLCJmaWVsZHMiLCJpc3N1ZWxpbmtzIiwic3VidGFza3MiLCJpZCIsImNoaWxkSXNzdWVzIiwiYWxsUmVsYXRlZElzc3VlcyIsIm1hcCIsInN1YnRhc2siLCJsaW5rIiwib3V0d2FyZElzc3VlIiwiaW53YXJkSXNzdWUiLCJmaWx0ZXIiLCJpc3N1ZSIsInV4VGlja2V0IiwiZmluZCIsInN0YXJ0c1dpdGgiLCJnZXREZXNpZ25MaW5rIiwidXhUaWNrZXRLZXkiLCJjdXN0b21maWVsZF8yMTIzMyIsImdldEVwaWNQYXJlbnRMaW5rIiwiZXBpY0tleSIsImN1c3RvbWZpZWxkXzE1NzUxIiwiZGlzcGxheURlc2lnbkxpbmsiLCJkZXNpZ25MaW5rIiwic3VtbWFyeUVsZW1lbnQiLCJleGlzdGluZ0xpbmsiLCJkZXNpZ25MaW5rQ29udGFpbmVyIiwiY3JlYXRlRWxlbWVudCIsImljb25VcmwiLCJjaHJvbWUiLCJydW50aW1lIiwiZ2V0VVJMIiwiY2xhc3NOYW1lIiwiaW5uZXJIVE1MIiwiaW5zZXJ0QWRqYWNlbnRFbGVtZW50Iiwic3R5bGUiLCJoZWFkIiwiYXBwZW5kQ2hpbGQiLCJpc0VwaWNUaWNrZXQiLCJpc3N1ZVR5cGVFbGVtZW50IiwiaXNzdWVUeXBlIiwibWFpbiIsInRpY2tldElkIiwibG9nIiwid2FpdEZvckVsZW1lbnQiLCJwYXJlbnRMaW5rIiwiZXBpY0xpbmsiLCJzZWxlY3RvciIsInRpbWVvdXRNcyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwib2JzZXJ2ZXIiLCJNdXRhdGlvbk9ic2VydmVyIiwiZGlzY29ubmVjdCIsIm9ic2VydmUiLCJib2R5IiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsInNldFRpbWVvdXQiLCJoYW5kbGVQYWdlQ2hhbmdlcyIsImN1cnJlbnRVcmwiLCJhZGRFdmVudExpc3RlbmVyIl0sInNvdXJjZVJvb3QiOiIifQ==