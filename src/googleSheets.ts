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

// 从 Google Sheets 获取数据
export async function getFieldMapping(sheetName: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'GET_SHEET_CONFIG',
      sheetName: sheetName
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('获取配置失败:', chrome.runtime.lastError);
        resolve(DEFAULT_JIRA_FIELDS);
        return;
      }
      resolve(response?.mapping || DEFAULT_JIRA_FIELDS);
    });
  });
}

// 获取当前工作表的表头
export async function getSheetHeaders(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'GET_SHEET_HEADERS'
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('获取表头失败:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response?.headers || []);
    });
  });
}

// 从 Jira 页面抓取数据
export async function fetchJiraTickets(jql: string): Promise<JiraTicket[]> {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        
        // 监听来自 background script 的消息
        const messageListener = (message: any) => {
            console.log('message111', message);
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
                  // 注入内容脚本
                  chrome.scripting.executeScript({
                      target: { tabId: tab.id! },
                      func: () => {
                          const tickets: any[] = [];
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
                          
                          return tickets;
                      }
                  }, (results) => {
                    results[0].result = results[0].result.map(ticket => ({
                      ...ticket,
                      summary: ticket.summary.split('\n').slice(-1)[0].trim(),
                    }));
                    chrome.tabs.sendMessage(sourceTabId, {
                    // 发送结果回源标签页
                        type: 'JIRA_TICKETS_RESULT',
                        requestId,
                        tickets: results[0].result
                    });
                    
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

// 将 Jira tickets 写入 Google Sheet
export async function writeTicketsToSheet(tickets: JiraTicket[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'WRITE_TICKETS',
      tickets: tickets
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('写入数据失败:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}