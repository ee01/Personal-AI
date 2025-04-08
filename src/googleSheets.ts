/// <reference types="@types/google-apps-script" />
import { JiraTicket } from './types';

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

// 从配置表中读取字段映射
export async function getFieldMapping(sheetName: string): Promise<Record<string, string>> {
  const configSheetName = `${sheetName}_config`;
  const spreadsheet = (window as any).google?.sheets?.spreadsheets?.getActiveSpreadsheet();
  const configSheet = spreadsheet?.getSheetByName(configSheetName);
  
  if (!configSheet) {
    return DEFAULT_JIRA_FIELDS;
  }

  const range = configSheet.getDataRange();
  const values = range.getValues();
  
  const mapping: Record<string, string> = {};
  for (const [header, field] of values) {
    if (header && field) {
      mapping[header] = field;
    }
  }
  
  return mapping;
}

// 获取当前工作表的表头
export function getSheetHeaders(sheet: any): string[] {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  return range.getValues()[0];
}

// 从 Jira 页面抓取数据
export async function fetchJiraTickets(jql: string): Promise<JiraTicket[]> {
    return new Promise((resolve, reject) => {
        // 创建一个唯一的 ID 用于标识这次请求
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

// 将 Jira tickets 写入 Google Sheet
export async function writeTicketsToSheet(tickets: JiraTicket[]) {
  // 获取当前工作表
  const sheet = (window as any).google?.sheets?.spreadsheets?.getActiveSheet();
  if (!sheet) {
    throw new Error('无法获取当前工作表');
  }

  // 获取工作表名称
  const sheetName = sheet.getName();
  
  // 获取字段映射
  const fieldMapping = await getFieldMapping(sheetName);
  
  // 获取表头
  const headers = getSheetHeaders(sheet);
  
  // 如果表头为空，使用默认字段
  if (headers.length === 0 || headers[0] === '') {
    const headerValues = [Object.keys(fieldMapping)];
    sheet.getRange(1, 1, 1, headerValues[0].length).setValues(headerValues);
  }
  
  // 准备数据
  const data = tickets.map(ticket => {
    return headers.map(header => {
      const field = fieldMapping[header];
      return ticket[field as keyof JiraTicket] || '';
    });
  });
  
  // 写入数据
  const startRow = sheet.getLastRow() + 1;
  if (data.length > 0) {
    sheet.getRange(startRow, 1, data.length, headers.length).setValues(data);
  }
}

// 创建 JQL 查询对话框
function createJqlDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="padding: 20px;">
      <h3>输入 JQL 查询</h3>
      <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;"></textarea>
      <button onclick="submitJql()">查询</button>
    </div>
    <script>
      function submitJql() {
        const jql = document.getElementById('jql').value;
        google.script.run
          .withSuccessHandler(() => google.script.host.close())
          .withFailureHandler((error) => alert('Error: ' + error))
          .processJqlQuery(jql);
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(200);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Jira 查询');
}

// 处理 JQL 查询
async function processJqlQuery(jql: string) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const tickets = await fetchJiraTickets(jql);
  await writeTicketsToSheet(tickets);
}

// 添加菜单项
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Jira 工具')
    .addItem('查询 Jira Tickets', 'createJqlDialog')
    .addToUi();
} 