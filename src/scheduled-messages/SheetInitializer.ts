/**
 * Sheet 初始化器
 * 负责一键生成 Google Sheet、AppScript 项目和触发器
 */

import { InitializationResult, SheetConfig } from './types';
import { AppScriptUpdater } from './AppScriptUpdater';
import { formatLocalScheduleDate, getLocalScheduleTimeZone } from './scheduleDateTime';

interface SharingPermissionResult {
  status: 'domain_writer' | 'owner_only';
  domain?: string;
  warning?: string;
}

type InitializationSetupMetadata = Pick<
  InitializationResult,
  'deploymentId' | 'messagesSheetId' | 'logsSheetId'
>;

/**
 * Messages 表的 Schema 定义
 * 当新增字段时，在 columns 中添加列名，并增加 version
 *
 * 版本历史：
 * - v2.0: 初始版本
 * - v2.1: 添加 Category 列
 * - v2.2: 添加 Automation_Link 列（支持 Jira Automation Rule 引用）
 * - v2.3: 添加 Repeat_Days 列（支持一周多天或月份多日期）
 * - v2.4: 添加 Outreach 模板字段（后续废弃，保留迁移说明）
 * - v2.5: 添加 Outreach_Question 列（已废弃）
 * - v2.6: 改为 Content 保存提问原文，新增 Outreach_Result 保存结果摘要（已废弃）
 * - v2.7: Outreach 模板改为只复用 Content / Glip_User_Name / Glip_Team_ID / Target_Type，运行态和上下文下沉到 memory-service
 * - v2.8: Glip 发送结果元数据下沉到 Logs，Messages 只保存计划定义
 * - v2.9: 添加 AgentTask / 帮我做字段，Sheet 只保存重复任务计划和 Jira Rule 扫描入口
 * - v2.10: 删除 Agent_Task_Prompt（任务描述统一 Content）；新增 Agent_Notify_Success_Receipt（成功回执开关）
 * - v2.11: 新增 Agent_Notify_Via（结果通知身份 bot/asme）
 * - v2.12: 新增 Agent_Mode（只读/外部写入边界；旧任务默认 read）
 * - v2.13: 新增 Agent_Notify_When_Empty（0 匹配是否仍推结果通知；空=按 Agent_Mode 定）
 */
export const MESSAGES_SCHEMA = {
  version: '2.13',
  columns: [
    'ID',
    'Topic',
    'Content',
    'Schedule_Date',
    'Schedule_Time',
    'End_Date',
    'Repeat_Every',
    'Repeat_Unit',
    'Repeat_Count',
    'Repeat_Days',
    'Timeline_Project',
    'Timeline_Milestone',
    'Timeline_Offset',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Attachment',
    'AI_Endpoint',
    'AI_Headers',
    'AI_Body',
    'Category',
    'Automation_Link',
    'Agent_Task_ID',
    'Agent_Mode',
    'Agent_Executor',
    'Agent_Notify_Template',
    'Agent_Notify_Success_Receipt',
    'Agent_Notify_Via',
    'Agent_Notify_When_Empty',
    'Agent_Trigger_Source',
    'Agent_AR_Binding_ID',
    'Agent_Last_Run_At',
    'Agent_Last_Status',
    'Agent_Last_Result',
    'Agent_Last_Error',
    'Status',
    'Last_Exec',
    'Next_Exec',
    'Exec_Count',
    'Exec_Log',
  ],
};

export const LOGS_SCHEMA = {
  version: '1.1',
  columns: [
    'Timestamp',
    'Message_ID',
    'Topic',
    'Content',
    'Push_Method',
    'Target',
    'Status',
    'Error',
    'Exec_Count',
    'Execution_Key',
    'Sent_Chat_ID',
    'Sent_Post_ID',
    'Sent_At',
  ],
};

export class SheetInitializer {
  private token: string;
  private messagesSheetId = 0;
  private configSheetId = 0;
  private logsSheetId = 0;
  private deploymentId = '';

  constructor(token: string) {
    this.token = token;
  }

  /**
   * 一键创建定时消息系统
   */
  async createScheduledMessagesSheet(): Promise<InitializationResult> {
    const setupWarnings: string[] = [];

    try {
      console.log('开始创建定时消息系统...');

      // 1. 创建 Spreadsheet
      console.log('步骤 1/8: 创建 Spreadsheet...');
      const sheet = await this.createSpreadsheet();

      // 2. 设置共享权限（组织内所有人可编辑）
      console.log('步骤 2/8: 设置共享权限...');
      const sharingResult = await this.setPermissions(sheet.spreadsheetId);
      if (sharingResult.warning) {
        setupWarnings.push(sharingResult.warning);
      }

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
        deploymentId: this.deploymentId,
        messagesSheetId: this.messagesSheetId,
        logsSheetId: this.logsSheetId,
        setupWarnings,
        needsAuthorization: true,
        authUrl: `${webAppUrl}?action=authSuccess`, // 用户需要访问这个 URL 来授权
      };
    } catch (error) {
      console.error('创建定时消息系统失败:', error);

      // 检查是否是 AppScript API 未开启的错误
      if (error.message === 'APPSCRIPT_API_NOT_ENABLED') {
        return {
          success: false,
          sheetId: '',
          sheetUrl: '',
          scriptId: '',
          webAppUrl: '',
          setupWarnings,
          needsAppScriptAPI: true,
          appScriptAPIUrl: 'https://script.google.com/home/usersettings',
          error: 'AppScript API 未开启',
        };
      }

      return {
        success: false,
        sheetId: '',
        sheetUrl: '',
        scriptId: '',
        webAppUrl: '',
        setupWarnings,
        error: error.message || '未知错误',
      };
    }
  }

  /**
   * 创建 Spreadsheet
   */
  private async createSpreadsheet(): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  }> {
    const userInfo = await this.getUserInfo();
    const timeZone = getLocalScheduleTimeZone();
    const response = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: `${userInfo.given_name} 的定时消息管理 - Personal AI`,
            timeZone,
          },
          sheets: [
            {
              properties: {
                title: 'Messages',
                gridProperties: {
                  frozenRowCount: 1,
                  // 确保列数足够容纳所有 schema 列，预留 5 列用于未来扩展
                  columnCount: Math.max(MESSAGES_SCHEMA.columns.length + 5, 26),
                },
              },
            },
            {
              properties: {
                title: 'Config',
                gridProperties: { frozenRowCount: 1 },
              },
            },
            {
              properties: {
                title: 'Logs',
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`创建 Spreadsheet 失败: ${error}`);
    }

    const data = await response.json();

    // 保存工作表 ID
    if (data.sheets && data.sheets.length >= 3) {
      this.messagesSheetId = data.sheets[0].properties.sheetId;
      this.configSheetId = data.sheets[1].properties.sheetId;
      this.logsSheetId = data.sheets[2].properties.sheetId;
      console.log(
        `Messages Sheet ID: ${this.messagesSheetId}, Config Sheet ID: ${this.configSheetId}, Logs Sheet ID: ${this.logsSheetId}`,
      );
    }

    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
    };
  }

  /**
   * 设置共享权限：只尝试组织内编辑共享。
   *
   * 维护表可能包含消息目标、内部 endpoint、headers 和正文模板。域共享失败时
   * 保持 owner-only，并把原因返回给 UI，不自动降级为“知道链接的任何人可编辑”。
   */
  private async setPermissions(spreadsheetId: string): Promise<SharingPermissionResult> {
    try {
      // 获取用户的域名信息
      const userInfo = await this.getUserInfo();
      const domain = userInfo.email.split('@')[1]?.trim(); // 例如: ringcentral.com

      if (!domain) {
        return {
          status: 'owner_only',
          warning: (
            '无法从当前 Google 账号识别组织域名，维护表已保持仅创建者可编辑；' +
            '需要协作时请在 Google Sheet 中手动分享给指定成员、群组或目标受众。'
          ),
        };
      }

      // 设置权限：组织内所有人可编辑
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'domain',
            role: 'writer',
            domain: domain,
            allowFileDiscovery: true,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.warn('设置域权限失败，维护表将保持仅创建者可编辑:', error);
        return {
          status: 'owner_only',
          domain,
          warning: `未能自动设置 ${domain} 域内编辑权限，维护表已保持仅创建者可编辑；需要协作时请在 Google Sheet 中手动分享给指定成员、群组或目标受众。`,
        };
      }

      console.log(`✅ 已设置为：${domain} 域内所有人可编辑`);
      return { status: 'domain_writer', domain };
    } catch (error) {
      console.warn('设置权限失败，维护表将保持仅创建者可编辑:', error);
      return {
        status: 'owner_only',
        warning: (
          '未能自动设置组织内编辑权限，维护表已保持仅创建者可编辑；' +
          '需要协作时请在 Google Sheet 中手动分享给指定成员、群组或目标受众。'
        ),
      };
    }
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(): Promise<{
    email: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    hd: string;
  }> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
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
    // Messages 表头（使用 MESSAGES_SCHEMA 中的定义）
    // 注意：用户可以在 Sheet 中随意调整列顺序
    const messagesHeaders = MESSAGES_SCHEMA.columns;

    // Config 表头
    const configHeaders = ['Key', 'Value'];

    // Logs 表头
    const logsHeaders = LOGS_SCHEMA.columns;

    const requests = [
      // 设置 Messages 表头
      {
        updateCells: {
          range: {
            sheetId: this.messagesSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: messagesHeaders.length,
          },
          rows: [
            {
              values: messagesHeaders.map((header) => ({
                userEnteredValue: { stringValue: header },
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              })),
            },
          ],
          fields: 'userEnteredValue,userEnteredFormat',
        },
      },
      // 设置 Logs 表头
      {
        updateCells: {
          range: {
            sheetId: this.logsSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: logsHeaders.length,
          },
          rows: [
            {
              values: logsHeaders.map((header) => ({
                userEnteredValue: { stringValue: header },
              })),
            },
          ],
          fields: 'userEnteredValue,userEnteredFormat',
        },
      },
      // 设置 Config 表头
      {
        updateCells: {
          range: {
            sheetId: this.configSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          rows: [
            {
              values: configHeaders.map((header) => ({
                userEnteredValue: { stringValue: header },
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              })),
            },
          ],
          fields: 'userEnteredValue,userEnteredFormat',
        },
      },
      // 自动调整列宽
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: this.messagesSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: messagesHeaders.length,
          },
        },
      },
      // 自动调整 Logs 列宽
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: this.logsSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: logsHeaders.length,
          },
        },
      },
    ];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      },
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
      `msg_welcome_${Date.now()}`, // ID
      'Personal AI 欢迎消息', // Topic
      '🎉 恭喜！您的定时消息系统已成功初始化！\n\n这是一条测试消息，证明系统运行正常。\n\n您现在可以在管理界面添加更多定时消息。', // Content
      this.formatDate(now), // Schedule_Date
      this.formatTime(oneMinuteLater), // Schedule_Time（填写时间，自动判断为 Hourly 类型）
      '', // End_Date
      '', // Repeat_Every
      '', // Repeat_Unit
      '', // Repeat_Count
      '', // Repeat_Days (v2.3 新增，多选日期)
      '', // Timeline_Project
      '', // Timeline_Milestone
      '', // Timeline_Offset
      'AsMe', // Push_Method
      'sync.service', // Glip_User_Name
      '', // Glip_Team_ID
      '', // Attachment
      '', // AI_Endpoint
      '', // AI_Headers
      '', // AI_Body
      '', // Category
      '', // Automation_Link (v2.2 新增)
      'Active', // Status
      '', // Last_Exec
      this.formatDateTime(oneMinuteLater), // Next_Exec
      0, // Exec_Count
      '待执行', // Exec_Log
    ];

    // 根据数据列数动态计算结束列名
    const endColumn = this.getColumnName(sampleMessage.length);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Messages!A2:${endColumn}2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [sampleMessage],
        }),
      },
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
    const userInfo = await this.getUserInfo();
    // 读取 AppScript 模板代码
    const scriptCode = await this.loadAppScriptTemplate();
    const timeZone = getLocalScheduleTimeZone();

    // 创建 Apps Script 项目
    const createResponse = await fetch(
      'https://script.googleapis.com/v1/projects',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${userInfo.given_name} - Scheduled Messages`,
          parentId: spreadsheetId,
        }),
      },
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();

      // 检查是否是因为 AppScript API 未开启（403 错误）
      if (
        createResponse.status === 403 &&
        error.includes('script.google.com/home/usersettings')
      ) {
        throw new Error('APPSCRIPT_API_NOT_ENABLED');
      }

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
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: scriptCode,
            },
            {
              name: 'appsscript',
              type: 'JSON',
              // executionApi is intentionally absent: this project is only ever
              // reached through the Web App /exec entry point, and declaring
              // `ANYONE` there is rejected outright where a Workspace admin has
              // disabled public Apps Script access.
              source: JSON.stringify({
                timeZone,
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
                webapp: {
                  access: 'ANYONE_ANONYMOUS',
                  executeAs: 'USER_DEPLOYING',
                },
              }),
            },
          ],
        }),
      },
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
    const _templateCode = `
// 注意：这里会被实际的模板代码替换
// 在实际构建时，我们会通过 webpack 或其他方式将 .gs 文件内容注入
function minuteTrigger() {
  executeScheduledMessages();
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
   * 从扩展资源中读取模板文件
   */
  private async getFullAppScriptCode(): Promise<string> {
    try {
      const response = await fetch(
        chrome.runtime.getURL('app-script-template.gs'),
      );
      if (!response.ok) {
        throw new Error(`无法加载模板文件: HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('加载 AppScript 模板文件失败:', error);
      throw new Error(
        `加载 AppScript 模板文件失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 完成初始化（在用户授权后调用）
   * 创建触发器、添加示例数据并保存配置
   */
  async completeInitialization(
    sheetId: string,
    scriptId: string,
    webAppUrl: string,
    setupMetadata: InitializationSetupMetadata = {},
  ): Promise<InitializationResult> {
    const setupWarnings: string[] = [];

    try {
      this.applySetupMetadata(setupMetadata);
      await this.ensureSetupMetadata(sheetId, setupWarnings);

      // 6. 创建触发器（通过 Web App 调用）
      console.log('步骤 6/8: 创建触发器...');
      const triggers = await this.createTriggers(webAppUrl);

      // 7. 添加示例数据（触发器创建后才能推送）
      console.log('步骤 7/8: 添加示例数据...');
      await this.addSampleData(sheetId);

      // 8. 保存配置
      console.log('步骤 8/8: 保存配置...');
      await this.saveConfig(sheetId, scriptId, webAppUrl, triggers);

      // 9. 启用消息交互功能（稍后处理 + 自动答复）
      console.log('步骤 9: 启用消息交互功能...');
      await this.enableMessageReactionFeatures();

      console.log('定时消息系统创建成功！');

      return {
        success: true,
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId,
        webAppUrl,
        deploymentId: this.deploymentId || undefined,
        messagesSheetId: this.messagesSheetId || undefined,
        logsSheetId: this.logsSheetId || undefined,
        setupWarnings,
      };
    } catch (error) {
      console.error('完成初始化失败:', error);
      return {
        success: false,
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId,
        webAppUrl,
        deploymentId: this.deploymentId || setupMetadata.deploymentId,
        messagesSheetId: this.messagesSheetId || setupMetadata.messagesSheetId,
        logsSheetId: this.logsSheetId || setupMetadata.logsSheetId,
        setupWarnings,
        error: error.message || '未知错误',
      };
    }
  }

  private applySetupMetadata(metadata: InitializationSetupMetadata): void {
    if (metadata.messagesSheetId && metadata.messagesSheetId > 0) {
      this.messagesSheetId = metadata.messagesSheetId;
    }

    if (metadata.logsSheetId && metadata.logsSheetId > 0) {
      this.logsSheetId = metadata.logsSheetId;
    }

    if (metadata.deploymentId) {
      this.deploymentId = metadata.deploymentId;
    }
  }

  private async ensureSetupMetadata(
    sheetId: string,
    setupWarnings: string[],
  ): Promise<void> {
    if (this.messagesSheetId > 0 && this.logsSheetId > 0) {
      return;
    }

    try {
      const { ConfigSyncService } = await import('./ConfigSyncService');
      const syncService = new ConfigSyncService(this.token);
      const worksheetIds = await syncService.getScheduledMessagesWorksheetIds(sheetId);

      if (!this.messagesSheetId && worksheetIds.messagesSheetId !== undefined) {
        this.messagesSheetId = worksheetIds.messagesSheetId;
      }

      if (!this.logsSheetId && worksheetIds.logsSheetId !== undefined) {
        this.logsSheetId = worksheetIds.logsSheetId;
      }
    } catch (error) {
      console.warn('读取维护表子表 ID 失败，将继续保存基础配置:', error);
      setupWarnings.push(
        '未能自动记录 Messages / Logs 子表 ID；初始化仍会继续，之后打开维护表或同步时会再次尝试恢复子表定位。',
      );
    }
  }

  /**
   * 启用消息交互功能（稍后处理 + 关注后续 + 自动答复 + 联动操作）
   * 在定时消息系统初始化完成后自动启用这些功能
   */
  private async enableMessageReactionFeatures(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['envConfig']);
      const envConfig = result.envConfig || {};

      // 启用完整消息交互工具栏能力
      envConfig.ENABLE_SNOOZE = true;
      envConfig.ENABLE_FOLLOW_THREAD = true;
      envConfig.ENABLE_AUTO_REPLY = true;
      envConfig.ENABLE_LINKED_ACTION = true;

      await chrome.storage.local.set({ envConfig });
      console.log(
        '✅ 已启用消息交互功能：稍后处理、关注后续、自动答复、联动操作',
      );
    } catch (error) {
      console.warn('启用消息交互功能失败:', error);
      // 不抛出错误，允许继续执行
    }
  }

  /**
   * 创建触发器
   * 注意：Google Apps Script REST API 不支持直接创建触发器
   * 我们通过调用 Web App 的 setupTriggers 端点来创建触发器
   * 因为 ScriptApp.newTrigger 只能在 Apps Script 环境内部执行
   */
  private async createTriggers(
    webAppUrl: string,
  ): Promise<{ minuteTriggerId: string; dailyTriggerId: string }> {
    // 通过 Web App 调用 setupTriggers
    const response = await fetch(`${webAppUrl}?action=setupTriggers`, {
      method: 'GET',
      // Web App 部署为 "Anyone" 访问时不需要 Authorization header
      // 但我们仍然可以带上 token 以防万一
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

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
      dailyTriggerId: 'created-via-webapp',
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
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Initial version for Personal AI Scheduled Messages',
        }),
      },
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
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          versionNumber: versionNumber,
          manifestFileName: 'appsscript',
          description: 'Personal AI Scheduled Messages Web App',
        }),
      },
    );

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.text();
      throw new Error(`部署 Web App 失败: ${error}`);
    }

    const deployment = await deploymentResponse.json();
    console.log('部署创建成功:', deployment);

    // 获取 Web App URL 和 Deployment ID
    const webAppUrl = deployment.entryPoints?.[0]?.webApp?.url || '';
    if (!webAppUrl) {
      throw new Error('无法获取 Web App URL，请检查部署配置');
    }

    // 保存 deploymentId（用于后续更新）
    this.deploymentId = deployment.deploymentId;
    console.log(`Deployment ID: ${this.deploymentId}`);

    return webAppUrl;
  }

  /**
   * 保存配置到 Config 工作表和 Chrome Storage
   */
  private async saveConfig(
    spreadsheetId: string,
    scriptId: string,
    webAppUrl: string,
    triggers: { minuteTriggerId: string; dailyTriggerId: string },
  ): Promise<void> {
    const now = new Date();
    const appScriptVersionInfo = await AppScriptUpdater.getLatestVersionInfo();

    // 构建配置对象
    const config: SheetConfig = {
      sheetId: spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      scriptId,
      webAppUrl,
      minute_trigger_id: triggers.minuteTriggerId,
      daily_trigger_id: triggers.dailyTriggerId,
      sheet_version: MESSAGES_SCHEMA.version,
      appScriptVersion: appScriptVersionInfo.version,
      appScriptLastUpdated: appScriptVersionInfo.lastUpdated,
      created_by: 'Personal AI Extension',
      created_at: this.formatDateTime(now),
      last_sync_time: this.formatDateTime(now),
    };

    if (this.messagesSheetId > 0) {
      config.messagesSheetId = this.messagesSheetId;
    }

    if (this.logsSheetId > 0) {
      config.logsSheetId = this.logsSheetId;
    }

    if (this.deploymentId) {
      config.deploymentId = this.deploymentId;
    }

    // 使用 ConfigSyncService 同步配置到 Sheet 和 Chrome Storage
    const { ConfigSyncService } = await import('./ConfigSyncService');
    const syncService = new ConfigSyncService(this.token);
    await syncService.syncConfig(config, { syncAction: 'one_click_setup' });
  }

  // 辅助方法

  private formatDate(date: Date): string {
    return formatLocalScheduleDate(date);
  }

  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private formatDateTime(date: Date): string {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  /**
   * 将列索引转换为列名（1→A, 26→Z, 27→AA, 28→AB, ...）
   */
  private getColumnName(columnIndex: number): string {
    let result = '';
    let index = columnIndex;

    while (index > 0) {
      const remainder = (index - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      index = Math.floor((index - 1) / 26);
    }

    return result;
  }
}
