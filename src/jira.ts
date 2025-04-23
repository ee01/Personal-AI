import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

// 默认的 Jira 字段配置
const DEFAULT_JIRA_FIELDS = {
  'Key': 'key',
  'Summary': 'summary',
  'Status': 'status',
  'Assignee': 'assignee',
  'Reporter': 'reporter',
  'Priority': 'priority',
  'Created': 'created',
  'Updated': 'updated',
  'Due Date': 'duedate',
  'Description': 'description'
};

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
  const url = `${envConfig.JIRA_BASE_URL}/issues/?jql=${encodeURIComponent(jql)}`;
        
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
                      func: () => {
                          const tickets: any[] = [];
                          
                          // 判断是否是Jira Cloud版本，通过检查特定的DOM元素判断
                          const isJiraCloud = !!document.querySelector('table[data-vc="issue-table"]') ||
                                             !!document.querySelector('table[aria-label="Work"]');
                          
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
                                        // 优先尝试从特定的span中获取assignee信息，避免获取重复文本
                                        const assigneeSpan = cells[4].querySelector('._1reo15vq._18m915vq._o5721q9c._1bto1l2s > span');
                                        let assigneeText = '';
                                        if (assigneeSpan) {
                                            assigneeText = assigneeSpan.textContent?.trim() || '';
                                        } else {
                                            // 如果找不到特定元素，则获取整个单元格文本并进行处理去重
                                            assigneeText = cells[4].textContent?.trim() || '';
                                            // 处理可能的重复文本，如"EsoneEsone"
                                            if (assigneeText && assigneeText.length > 2) {
                                                // 正则表达式寻找连续重复的相同名称并去重
                                                const match = assigneeText.match(/^(.+?)\1+$/);
                                                if (match) {
                                                    assigneeText = match[1];
                                                } else {
                                                    // 检查文本是否有"Unassigned"字样
                                                    if (assigneeText.includes('Unassigned')) {
                                                        assigneeText = 'Unassigned';
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // 如果是"Unassigned"则设为空
                                        assignee = assigneeText !== 'Unassigned' ? assigneeText : '';
                                        
                                        // 优先尝试从特定的span中获取reporter信息
                                        const reporterSpan = cells[5].querySelector('._1reo15vq._18m915vq._o5721q9c._1bto1l2s > span');
                                        let reporterText = '';
                                        if (reporterSpan) {
                                            reporterText = reporterSpan.textContent?.trim() || '';
                                        } else {
                                            // 如果找不到特定元素，则获取整个单元格文本并进行处理去重
                                            reporterText = cells[5].textContent?.trim() || '';
                                            // 处理可能的重复文本
                                            if (reporterText && reporterText.length > 2) {
                                                const match = reporterText.match(/^(.+?)\1+$/);
                                                if (match) {
                                                    reporterText = match[1];
                                                }
                                            }
                                        }
                                        reporter = reporterText;
                                        
                                        // 优先尝试从特定的span中获取priority信息
                                        const prioritySpan = cells[6].querySelector('._1reo15vq._18m915vq._18u0u2gc._1bto1l2s._o5721q9c');
                                        priority = prioritySpan ? prioritySpan.textContent?.trim() || '' : cells[6].textContent?.trim() || '';
                                        
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
                                const ticket = {
                                    key: row.querySelector('.issuekey')?.textContent?.trim() || '',
                                    summary: row.querySelector('.summary')?.textContent?.trim() || '',
                                    status: row.querySelector('.status')?.textContent?.trim() || '',
                                    assignee: row.querySelector('.assignee')?.textContent?.trim() || '',
                                    reporter: row.querySelector('.reporter')?.textContent?.trim() || '',
                                    priority: row.querySelector('.priority')?.textContent?.trim() || '',
                                    created: row.querySelector('.created')?.textContent?.trim() || '',
                                    updated: row.querySelector('.updated')?.textContent?.trim() || '',
                                    duedate: row.querySelector('.duedate')?.textContent?.trim() || '',
                                    description: row.querySelector('.description')?.textContent?.trim() || ''
                                };
                                tickets.push(ticket);
                            });
                          }
                          
                          return tickets;
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
