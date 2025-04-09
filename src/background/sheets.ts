import { JiraTicket } from '../types';

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SHEET_CONFIG':
      handleGetSheetConfig(message.sheetName, sendResponse);
      break;
    case 'GET_SHEET_HEADERS':
      handleGetSheetHeaders(sendResponse);
      break;
    case 'WRITE_TICKETS':
      handleWriteTickets(message.tickets, sendResponse);
      break;
  }
  return true; // 保持消息通道开放
});

// 处理获取配置的请求
async function handleGetSheetConfig(sheetName: string, sendResponse: (response: any) => void) {
  try {
    // 这里需要实现与 Google Sheets API 的集成
    // 使用 Google Sheets API 获取配置
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${getSpreadsheetId()}/values/${sheetName}_config`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    
    const data = await response.json();
    const mapping: Record<string, string> = {};
    
    if (data.values) {
      data.values.forEach(([header, field]: string[]) => {
        if (header && field) {
          mapping[header] = field;
        }
      });
    }
    
    sendResponse({ mapping });
  } catch (error) {
    console.error('获取配置失败:', error);
    sendResponse({ mapping: {} });
  }
}

// 处理获取表头的请求
async function handleGetSheetHeaders(sendResponse: (response: any) => void) {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${getSpreadsheetId()}/values/A1:Z1`, {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });
    
    const data = await response.json();
    sendResponse({ headers: data.values?.[0] || [] });
  } catch (error) {
    console.error('获取表头失败:', error);
    sendResponse({ headers: [] });
  }
}

// 处理写入数据的请求
async function handleWriteTickets(tickets: JiraTicket[], sendResponse: (response: any) => void) {
  try {
    const headers = await getSheetHeaders();
    const values = tickets.map(ticket => 
      headers.map(header => ticket[header as keyof JiraTicket] || '')
    );
    console.log('values', values);
    
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${getSpreadsheetId()}/values/A:Z:append`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values,
        valueInputOption: 'RAW'
      })
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('写入数据失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 获取电子表格 ID
async function getSpreadsheetId(): Promise<string> {
  const { spreadsheetId } = await chrome.storage.local.get('spreadsheetId');
  return spreadsheetId || '';
}

// 获取访问令牌
async function getAccessToken(): Promise<string> {
  // 从 Chrome 存储中获取访问令牌
  const { token } = await chrome.storage.local.get('googleToken');
  return token || '';
}

// 获取表头
async function getSheetHeaders(): Promise<string[]> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${getSpreadsheetId()}/values/A1:Z1`, {
    headers: {
      'Authorization': `Bearer ${await getAccessToken()}`
    }
  });
  
  const data = await response.json();
  return data.values?.[0] || [];
} 