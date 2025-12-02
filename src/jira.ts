import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

// 从 Jira 页面抓取数据
export async function fetchJiraTickets(jql: string): Promise<JiraTicket[]> {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        
        // 监听来自 background script 的消息
        const messageListener = (message: any) => {
            if (message.type === 'JIRA_TICKETS_RESULT' && message.requestId === requestId) {
                chrome.runtime.onMessage.removeListener(messageListener);
                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    resolve(message.tickets);
                }
            }
            return true;
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
