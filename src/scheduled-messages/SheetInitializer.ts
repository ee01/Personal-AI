/**
 * Sheet 初始化器
 * 负责一键生成 Google Sheet、AppScript 项目和触发器
 */

import { InitializationResult, SheetConfig } from './types';

export class SheetInitializer {
  private token: string;
  private messagesSheetId = 0;
  private configSheetId = 0;
  
  constructor(token: string) {
    this.token = token;
  }
  
  /**
   * 一键创建定时消息系统
   */
  async createScheduledMessagesSheet(): Promise<InitializationResult> {
    try {
      console.log('开始创建定时消息系统...');
      
      // 1. 创建 Spreadsheet
      console.log('步骤 1/8: 创建 Spreadsheet...');
      const sheet = await this.createSpreadsheet();
      
      // 2. 设置共享权限（组织内所有人可编辑）
      console.log('步骤 2/8: 设置共享权限...');
      await this.setPermissions(sheet.spreadsheetId);
      
      // 3. 设置工作表结构
      console.log('步骤 3/8: 设置工作表结构...');
      await this.setupWorksheets(sheet.spreadsheetId);
      
      // 4. 创建 AppScript 项目
      console.log('步骤 4/8: 创建 AppScript 项目...');
      const scriptId = await this.createAppScriptProject(sheet.spreadsheetId);
      
      // 5. 部署为 Web App（必须先部署才能调用 Web App）
      console.log('步骤 5/8: 部署 Web App...');
      const webAppUrl = await this.deployWebApp(scriptId);
      
      console.log('部署完成，需要用户授权...');
      
      // 返回需要授权的状态
      // 用户需要在浏览器中打开 Web App URL 并授权
      // 添加 action=authSuccess 参数，授权完成后显示成功页面
      return {
        success: true,
        sheetId: sheet.spreadsheetId,
        sheetUrl: sheet.spreadsheetUrl,
        scriptId,
        webAppUrl,
        needsAuthorization: true,
        authUrl: `${webAppUrl}?action=authSuccess`  // 用户需要访问这个 URL 来授权
      };
      
    } catch (error) {
      console.error('创建定时消息系统失败:', error);
      return {
        success: false,
        sheetId: '',
        sheetUrl: '',
        scriptId: '',
        webAppUrl: '',
        error: error.message || '未知错误'
      };
    }
  }
  
  /**
   * 创建 Spreadsheet
   */
  private async createSpreadsheet(): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const response = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: `Personal AI - 定时消息管理`
          },
          sheets: [
            { properties: { title: 'Messages', gridProperties: { frozenRowCount: 1 } } },
            { properties: { title: 'Config', gridProperties: { frozenRowCount: 1 } } }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`创建 Spreadsheet 失败: ${error}`);
    }
    
    const data = await response.json();
    
    // 保存工作表 ID
    if (data.sheets && data.sheets.length >= 2) {
      this.messagesSheetId = data.sheets[0].properties.sheetId;
      this.configSheetId = data.sheets[1].properties.sheetId;
      console.log(`Messages Sheet ID: ${this.messagesSheetId}, Config Sheet ID: ${this.configSheetId}`);
    }
    
    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl
    };
  }
  
  /**
   * 设置共享权限：组织内所有人可编辑
   */
  private async setPermissions(spreadsheetId: string): Promise<void> {
    try {
      // 获取用户的域名信息
      const userInfo = await this.getUserInfo();
      const domain = userInfo.email.split('@')[1]; // 例如: ringcentral.com
      
      // 设置权限：组织内所有人可编辑
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'domain',
            role: 'writer',
            domain: domain,
            allowFileDiscovery: true
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        console.warn('设置域权限失败，尝试设置为任何人可编辑:', error);
        
        // 如果域权限设置失败，尝试设置为"知道链接的任何人可编辑"
        const fallbackResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'anyone',
              role: 'writer'
            })
          }
        );
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          console.warn('设置共享权限失败:', fallbackError);
          // 不抛出错误，允许继续执行
        } else {
          console.log('✅ 已设置为：知道链接的任何人可编辑');
        }
      } else {
        console.log(`✅ 已设置为：${domain} 域内所有人可编辑`);
      }
      
    } catch (error) {
      console.warn('设置权限失败:', error);
      // 不抛出错误，允许继续执行
    }
  }
  
  /**
   * 获取用户信息
   */
  private async getUserInfo(): Promise<{ email: string }> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('无法获取用户信息');
    }
    
    return await response.json();
  }
  
  /**
   * 设置工作表结构（表头和格式）
   * 
   * 重要说明：
   * - header 的列名必须与 ScheduledMessage 接口的字段名完全一致
   * - 用户可以在 Google Sheet 中自由调整列的顺序，系统会自动适配
   * - ScheduledMessageService 使用动态列映射机制：
   *   1. 读取时：通过 header 解析每列数据到对应字段
   *   2. 写入时：根据 header 顺序动态生成行数据
   * - 不要修改 header 的列名，但可以随意调整顺序、隐藏列、插入新列
   */
  private async setupWorksheets(spreadsheetId: string): Promise<void> {
    // Messages 表头（移除 Type，由程序自动判断）
    // 注意：这里定义的是初始顺序，用户可以在 Sheet 中随意调整
    const messagesHeaders = [
      'ID', 'Topic', 'Content', 'Schedule_Date', 'Schedule_Time',
      'End_Date', 'Repeat_Every', 'Repeat_Unit', 'Repeat_Count',
      'Push_Method', 'Glip_User_Name', 'Glip_Team_ID',
      'Attachment', 'Status', 'Last_Exec', 'Next_Exec',
      'Exec_Count', 'Exec_Log', 'Target_Type'
    ];
    
    // Config 表头
    const configHeaders = ['Key', 'Value'];
    
    const requests = [
      // 设置 Messages 表头
      {
        updateCells: {
          range: {
            sheetId: this.messagesSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: messagesHeaders.length
          },
          rows: [{
            values: messagesHeaders.map(header => ({
              userEnteredValue: { stringValue: header },
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat'
        }
      },
      // 设置 Config 表头
      {
        updateCells: {
          range: {
            sheetId: this.configSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 2
          },
          rows: [{
            values: configHeaders.map(header => ({
              userEnteredValue: { stringValue: header },
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat'
        }
      },
      // 自动调整列宽
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: this.messagesSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: messagesHeaders.length
          }
        }
      }
    ];
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`设置工作表结构失败: ${error}`);
    }
  }
  
  /**
   * 添加示例数据
   */
  private async addSampleData(spreadsheetId: string): Promise<void> {
    const now = new Date();
    const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
    
    const sampleMessage = [
      `msg_welcome_${Date.now()}`,  // ID
      'Personal AI 欢迎消息',        // Topic
      '🎉 恭喜！您的定时消息系统已成功初始化！\n\n这是一条测试消息，证明系统运行正常。\n\n您现在可以在管理界面添加更多定时消息。', // Content
      this.formatDate(now),           // Schedule_Date
      this.formatTime(oneMinuteLater), // Schedule_Time（填写时间，自动判断为 Hourly 类型）
      '',                             // End_Date
      '',                             // Repeat_Every
      '',                             // Repeat_Unit
      '',                             // Repeat_Count
      'AsMe',                         // Push_Method
      'sync.service',                 // Glip_User_Name
      '',                             // Glip_Team_ID
      '',                             // Attachment
      'Active',                       // Status
      '',                             // Last_Exec
      this.formatDateTime(oneMinuteLater), // Next_Exec
      0,                              // Exec_Count
      '待执行',                       // Exec_Log
      'private'                       // Target_Type
    ];
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Messages!A2:S2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [sampleMessage]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`添加示例数据失败: ${error}`);
    }
  }
  
  /**
   * 创建 AppScript 项目
   */
  private async createAppScriptProject(spreadsheetId: string): Promise<string> {
    // 读取 AppScript 模板代码
    const scriptCode = await this.loadAppScriptTemplate();
    
    // 创建 Apps Script 项目
    const createResponse = await fetch(
      'https://script.googleapis.com/v1/projects',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Personal AI - Scheduled Messages',
          parentId: spreadsheetId
        })
      }
    );
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`创建 AppScript 项目失败: ${error}`);
    }
    
    const project = await createResponse.json();
    const scriptId = project.scriptId;
    
    // 上传代码
    const updateResponse = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: scriptCode
            },
            {
              name: 'appsscript',
              type: 'JSON',
              source: JSON.stringify({
                timeZone: 'Asia/Shanghai',
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
                webapp: {
                  access: 'ANYONE_ANONYMOUS',
                  executeAs: 'USER_DEPLOYING'
                },
                executionApi: {
                  access: 'ANYONE'
                }
              })
            }
          ]
        })
      }
    );
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`上传 AppScript 代码失败: ${error}`);
    }
    
    return scriptId;
  }
  
  /**
   * 加载 AppScript 模板代码
   */
  private async loadAppScriptTemplate(): Promise<string> {
    // 从 src/scheduled-messages/app-script-template.gs 读取
    // 注意：在 Chrome Extension 中，我们需要将这个文件打包进来
    // 这里我们直接返回代码字符串
    const templateCode = `
// 注意：这里会被实际的模板代码替换
// 在实际构建时，我们会通过 webpack 或其他方式将 .gs 文件内容注入
function minuteTrigger() {
  executeScheduledMessages(['Hourly']);
}

function dailyTrigger() {
  executeScheduledMessages(['Daily', 'Periodic']);
}

// ... 其他函数
`;
    
    // TODO: 在实际实现中，需要通过 webpack 将 .gs 文件内容作为字符串导入
    // 或者直接在这里内联完整代码
    
    // 暂时返回一个简化版本（实际应该读取完整模板）
    return await this.getFullAppScriptCode();
  }
  
  /**
   * 获取完整的 AppScript 代码
   * TODO: 实际应该从模板文件读取
   */
  private async getFullAppScriptCode(): Promise<string> {
    // 这里应该返回完整的 AppScript 代码
    // 暂时使用 fetch 从扩展资源中读取
    try {
      const response = await fetch(chrome.runtime.getURL('app-script-template.gs'));
      return await response.text();
    } catch (error) {
      console.warn('无法加载模板文件，使用内联代码');
      // 如果无法加载，返回基本代码
      return this.getInlineAppScriptCode();
    }
  }
  
  /**
   * 获取内联的 AppScript 代码（备用）
   */
  private getInlineAppScriptCode(): string {
    // 返回一个基本版本的代码
    // 在实际使用中，这应该是完整的模板代码
    return `
function minuteTrigger() {
  Logger.log('Minute trigger executed');
}

function dailyTrigger() {
  Logger.log('Daily trigger executed');
}

function doGet(e) {
  const action = e.parameter.action;
  
  // 授权成功页面
  if (action === 'authSuccess') {
    return HtmlService.createHtmlOutput(\`
      <!DOCTYPE html>
      <html>
        <head>
          <title>授权成功</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              background: white;
              padding: 50px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            .success-icon {
              font-size: 80px;
              margin-bottom: 20px;
            }
            h1 {
              color: #28a745;
              font-size: 32px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 15px;
            }
            .highlight {
              color: #667eea;
              font-weight: bold;
            }
            .btn {
              display: inline-block;
              padding: 12px 30px;
              background: #28a745;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin-top: 20px;
              transition: background 0.3s;
            }
            .btn:hover {
              background: #218838;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">🎉</div>
            <h1>授权成功！</h1>
            <p>您已成功授权 <span class="highlight">Personal AI - Scheduled Messages</span></p>
            <p>现在可以关闭此页面，返回扩展页面点击 <span class="highlight">"我已完成授权，继续初始化"</span> 按钮完成剩余步骤。</p>
            <p style="font-size: 14px; color: #999; margin-top: 30px;">
              💡 提示：请保持此标签页打开，直到完成所有初始化步骤
            </p>
          </div>
        </body>
      </html>
    \`);
  }
  
  // 创建触发器
  if (action === 'setupTriggers') {
    try {
      const result = setupTriggersInternal();
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: result })
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: error.toString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // 默认返回状态
  return ContentService.createTextOutput(JSON.stringify({ status: 'OK' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupTriggersInternal() {
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    ScriptApp.deleteTrigger(existingTriggers[i]);
  }
  
  ScriptApp.newTrigger('minuteTrigger')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  ScriptApp.newTrigger('dailyTrigger')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  Logger.log('Triggers created successfully');
  return 'Triggers created successfully';
}
`;
  }
  
  /**
   * 完成初始化（在用户授权后调用）
   * 创建触发器、添加示例数据并保存配置
   */
  async completeInitialization(sheetId: string, scriptId: string, webAppUrl: string): Promise<InitializationResult> {
    try {
      // 6. 创建触发器（通过 Web App 调用）
      console.log('步骤 6/8: 创建触发器...');
      const triggers = await this.createTriggers(webAppUrl);
      
      // 7. 添加示例数据（触发器创建后才能推送）
      console.log('步骤 7/8: 添加示例数据...');
      await this.addSampleData(sheetId);
      
      // 8. 保存配置
      console.log('步骤 8/8: 保存配置...');
      await this.saveConfig(sheetId, scriptId, webAppUrl, triggers);
      
      console.log('定时消息系统创建成功！');
      
      return {
        success: true,
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId,
        webAppUrl
      };
    } catch (error) {
      console.error('完成初始化失败:', error);
      return {
        success: false,
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId,
        webAppUrl,
        error: error.message || '未知错误'
      };
    }
  }
  
  /**
   * 创建触发器
   * 注意：Google Apps Script REST API 不支持直接创建触发器
   * 我们通过调用 Web App 的 setupTriggers 端点来创建触发器
   * 因为 ScriptApp.newTrigger 只能在 Apps Script 环境内部执行
   */
  private async createTriggers(webAppUrl: string): Promise<{ minuteTriggerId: string; dailyTriggerId: string }> {
    // 通过 Web App 调用 setupTriggers
    const response = await fetch(
      `${webAppUrl}?action=setupTriggers`,
      {
        method: 'GET',
        // Web App 部署为 "Anyone" 访问时不需要 Authorization header
        // 但我们仍然可以带上 token 以防万一
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    // 检查 Content-Type：如果是 HTML，说明需要授权
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      console.warn('Web App 返回 HTML，需要用户授权');
      throw new Error('AUTHORIZATION_REQUIRED');
    }
    
    if (!response.ok) {
      const error = await response.text();
      console.error('创建触发器失败，响应详情:', error);
      throw new Error(`创建触发器失败: HTTP ${response.status} - ${error}`);
    }
    
    // 尝试解析 JSON
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error('无法解析响应为 JSON:', jsonError);
      throw new Error('AUTHORIZATION_REQUIRED');
    }
    
    if (!result.success) {
      throw new Error(`创建触发器失败: ${result.error || '未知错误'}`);
    }
    
    console.log('触发器创建成功:', result.message);
    
    // 返回占位符 ID，因为我们无法从 Web App 获取实际的触发器 ID
    // 但触发器已经在 Apps Script 中成功创建
    return {
      minuteTriggerId: 'created-via-webapp',
      dailyTriggerId: 'created-via-webapp'
    };
  }
  
  /**
   * 部署为 Web App
   */
  private async deployWebApp(scriptId: string): Promise<string> {
    // 第一步：创建版本
    console.log('创建 AppScript 版本...');
    const versionResponse = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/versions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Initial version for Personal AI Scheduled Messages'
        })
      }
    );
    
    if (!versionResponse.ok) {
      const error = await versionResponse.text();
      throw new Error(`创建版本失败: ${error}`);
    }
    
    const version = await versionResponse.json();
    const versionNumber = version.versionNumber;
    console.log(`版本创建成功: ${versionNumber}`);
    
    // 第二步：基于版本创建部署
    console.log(`基于版本 ${versionNumber} 创建部署...`);
    const deploymentResponse = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          versionNumber: versionNumber,
          manifestFileName: 'appsscript',
          description: 'Personal AI Scheduled Messages Web App'
        })
      }
    );
    
    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.text();
      throw new Error(`部署 Web App 失败: ${error}`);
    }
    
    const deployment = await deploymentResponse.json();
    console.log('部署创建成功:', deployment);
    
    // 获取 Web App URL
    const webAppUrl = deployment.entryPoints?.[0]?.webApp?.url || '';
    if (!webAppUrl) {
      throw new Error('无法获取 Web App URL，请检查部署配置');
    }
    
    return webAppUrl;
  }
  
  /**
   * 保存配置到 Config 工作表和 Chrome Storage
   */
  private async saveConfig(
    spreadsheetId: string,
    scriptId: string,
    webAppUrl: string,
    triggers: { minuteTriggerId: string; dailyTriggerId: string }
  ): Promise<void> {
    const now = new Date();
    const configData = [
      ['minute_trigger_id', triggers.minuteTriggerId],
      ['daily_trigger_id', triggers.dailyTriggerId],
      ['web_app_url', webAppUrl],
      ['sheet_version', '2.0'],
      ['created_by', 'Personal AI Extension'],
      ['created_at', this.formatDateTime(now)],
      ['last_sync_time', this.formatDateTime(now)]
    ];
    
    // 保存到 Config 工作表
    const sheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Config!A2:B8?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: configData
        })
      }
    );
    
    if (!sheetResponse.ok) {
      console.warn('保存配置到 Sheet 失败');
    }
    
    // 保存到 Chrome Storage
    const config: SheetConfig = {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      scriptId,
      webAppUrl,
      minute_trigger_id: triggers.minuteTriggerId,
      daily_trigger_id: triggers.dailyTriggerId,
      sheet_version: '2.0',
      created_by: 'Personal AI Extension',
      created_at: this.formatDateTime(now),
      last_sync_time: this.formatDateTime(now)
    };
    
    await chrome.storage.local.set({ scheduledMessagesConfig: config });
  }
  
  // 辅助方法
  
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  private formatDateTime(date: Date): string {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }
}


