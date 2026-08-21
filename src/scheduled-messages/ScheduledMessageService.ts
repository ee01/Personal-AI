/**
 * 定时消息数据服务层
 * 封装 Google Sheets API 的 CRUD 操作
 * 
 * 核心特性：动态列映射
 * ========================
 * 本服务支持动态识别 Google Sheet 的列位置，用户可以随意调整列的顺序：
 * 
 * 1. 读取机制：
 *    - 首先读取 header 行（第一行）获取列名
 *    - 根据 header 的列名和索引创建映射关系
 *    - 解析数据行时，通过列名从对应位置读取值
 * 
 * 2. 写入机制：
 *    - 获取当前的 header 顺序
 *    - 根据 header 顺序动态生成行数据数组
 *    - 自动适配不同的列顺序，确保数据写入正确的列
 * 
 * 3. 缓存优化：
 *    - header 结构会被缓存，避免重复读取
 *    - 同步数据时会清除缓存，确保获取最新的列结构
 * 
 * 4. 向后兼容：
 *    - 支持旧版本的固定列顺序
 *    - 支持用户自定义的列顺序
 *    - 列名保持不变，只是位置可以调整
 * 
 * 使用示例：
 * ```typescript
 * const service = new ScheduledMessageService(token);
 * 
 * // 读取数据 - 自动适配任何列顺序
 * const messages = await service.getAllMessages();
 * 
 * // 创建消息 - 自动根据当前列顺序写入
 * await service.createMessage({
 *   Topic: '测试消息',
 *   Content: '内容',
 *   ...
 * });
 * ```
 */

import { Sheet } from '../sheet';
import { ScheduledMessage, CreateMessageFormData, SheetConfig, Statistics, MessageType, PushLog } from './types';
import {
  GOOGLE_AUTH_SCOPE_SETS,
  formatGoogleAuthFailure,
  getGoogleAuthTokenSilentlyResult,
} from '../utils/googleAuth';
import { normalizeSheetConfig } from './botAutomationConfig';
import { formatTimelineNextExecutionText } from './timelineFormatting';
import {
  getTodayLocalScheduleDate,
  hasLocalScheduleTime,
} from './scheduleDateTime';
import {
  calculateScheduledMessageNextExecution,
  hasConfiguredAiEndpoint,
} from './scheduleNextExecution';
import { shouldReactivateDoneOneTimeMessageAfterScheduleChange } from './scheduleStatusReactivation';
import { getScheduledMessageStatusToggleAction } from './scheduledMessageStatusActions';
import { mergeScheduledMessageUpdate } from './jiraAutomationLink';
import { isGoogleSheetsInvalidCredentialError } from './googleSheetsAuthErrors.js';

const NON_PERSISTED_OUTREACH_FIELDS = new Set([
  'Outreach_Target_Type',
  'Outreach_Target_Ref',
  'Outreach_Result',
  'Outreach_Context',
  'Outreach_Max_Followup',
  'Outreach_Followup_Interval_Hours',
  'Outreach_Sync_State',
  'Outreach_Runtime_Status',
  'Outreach_Last_Session_ID',
  'Outreach_Last_Result',
  'Outreach_Last_Updated',
  'Outreach_Question',
]);

function normalizePushMethodAlias(value: unknown): unknown {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return value;
  }

  const compactValue = rawValue.toLowerCase().replace(/[\s_-]+/g, '');
  if (compactValue === 'agenttask') {
    return 'AgentTask';
  }

  return rawValue;
}

function normalizeExecutorTargetType(message: Partial<ScheduledMessage>): void {
  if (
    message.Push_Method === 'AI' ||
    (message.Push_Method === 'JiraAutomation' && hasConfiguredAiEndpoint(message.AI_Endpoint))
  ) {
    message.Target_Type = 'api';
  }
}

export class ScheduledMessageService {
  private token: string;
  private config: SheetConfig | null = null;
  private headerCache: string[] | null = null;  // 缓存 header 顺序
  
  constructor(token: string) {
    this.token = token;
  }
  
  /**
   * 刷新 token
   * 🔧 关键修复：不再弹出授权窗口，只尝试使用缓存的 token
   * 如果 token 真的过期了，调用方需要处理这个错误，让用户手动重新授权
   */
  private async refreshToken(): Promise<string> {
    // 使用静默方法 + forceRefresh：清除旧 token，尝试获取新的（不弹窗）
    const authResult = await getGoogleAuthTokenSilentlyResult({
      caller: 'ScheduledMessageService.refreshToken',
      forceRefresh: true,
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    const newToken = authResult.token;
    
    if (!newToken) {
      throw new Error(
        `Google Sheets 授权不可用：${formatGoogleAuthFailure(authResult)}`,
      );
    }
    
    this.token = newToken;
    return newToken;
  }
  
  /**
   * 执行带自动重试的操作
   * 如果遇到 401 错误，自动刷新 token 并重试一次
   */
  private async withTokenRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const is401Error = isGoogleSheetsInvalidCredentialError(error);
      const isScopeError =
        error.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        error.message?.includes('insufficient authentication scopes') ||
        error.message?.includes('insufficientPermissions');

      if (isScopeError) {
        throw new Error('Google Sheets 授权不完整，请重新授予 Google Sheets 权限');
      }
      
      if (is401Error) {
        console.log('🔄 检测到 401 错误，尝试刷新 token...');
        await this.refreshToken();
        console.log('✅ Token 刷新成功，重试请求...');
        return await operation();
      }
      
      throw error;
    }
  }
  
  /**
   * 加载配置
   */
  async loadConfig(): Promise<SheetConfig | null> {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    this.config = result.scheduledMessagesConfig ? normalizeSheetConfig(result.scheduledMessagesConfig) : null;
    return this.config;
  }
  
  /**
   * 获取所有消息
   */
  async getAllMessages(): Promise<ScheduledMessage[]> {
    if (!this.config) {
      await this.loadConfig();
    }
    
    if (!this.config) {
      throw new Error('未找到配置，请先初始化系统');
    }
    
    return await this.withTokenRetry(async () => {
      const sheet = new Sheet(this.token, this.config.sheetId, 'Messages');
      const data = await sheet.readSheet();
      
      if (!data || data.length === 0) {
        return [];
      }
      
      const headers = data[0];
      const messages: ScheduledMessage[] = [];
      let hasUpdates = false;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let rowNeedsUpdate = false;
        const pushMethodColumnIndex = headers.indexOf('Push_Method');
        const rawPushMethod = pushMethodColumnIndex >= 0 ? row[pushMethodColumnIndex] || '' : '';
        const message = this.parseRowToMessage(row, headers);
        
          if (message) {
            // 如果没有 ID，自动生成一个
            if (!message.ID) {
              message.ID = `msg_${Date.now()}_${i}`;
              hasUpdates = true;
              rowNeedsUpdate = true;
              console.log(`自动生成 ID: ${message.ID} (行 ${i + 1})`);
            }

            if (
              rawPushMethod &&
              message.Push_Method &&
              String(rawPushMethod).trim() !== String(message.Push_Method).trim()
            ) {
              hasUpdates = true;
              rowNeedsUpdate = true;
              console.log(`规范化 Push_Method: ${rawPushMethod} -> ${message.Push_Method} (行 ${i + 1})`);
            }
            
            // 自动判断消息类型（如果没有 Type 字段）
            if (!message.Type) {
              message.Type = this.determineMessageType(message);
            }
            
            // 如果有更新，写回 Sheet
            if (rowNeedsUpdate) {
              const row = await this.messageToRow(message, headers);
              await this.updateRow(i + 1, row, headers);
            }
            
            messages.push(message);
          }
      }
      
      if (hasUpdates) {
        console.log('✅ 已自动为缺失 ID 的消息生成 ID');
      }
      
      return messages;
    });
  }

  async getRecentPushLogs(limit = 500): Promise<PushLog[]> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('未找到配置，请先初始化系统');
    }

    return await this.withTokenRetry(async () => {
      const sheet = new Sheet(this.token, this.config.sheetId, 'Logs');
      // Apps Script always inserts new log rows at row 2, so the first N data
      // rows are the newest N records. Read that bounded head range directly.
      const safeLimit = Math.max(0, Math.min(5000, Math.floor(Number(limit) || 0)));
      const data = await sheet.readRange(`1:${safeLimit + 1}`);

      if (!data || data.length <= 1) {
        return [];
      }

      const headers = data[0];
      return data
        .slice(1, safeLimit + 1)
        .map((row) => this.parseRowToPushLog(row, headers))
        .filter((log): log is PushLog => Boolean(log));
    });
  }
  
  /**
   * 根据 ID 获取消息
   */
  async getMessageById(id: string): Promise<ScheduledMessage | null> {
    const messages = await this.getAllMessages();
    return messages.find(msg => msg.ID === id) || null;
  }
  
  /**
   * 自动判断消息类型
   */
  private determineMessageType(message: Partial<ScheduledMessage>): MessageType {
    // 如果填写了 Repeat_Every 和 Repeat_Unit，判断为 Periodic
    if (message.Repeat_Every && message.Repeat_Unit) {
      return 'Periodic';
    }
    
    // 如果填写了 Schedule_Time，判断为 Hourly
    if (hasLocalScheduleTime(message.Schedule_Time)) {
      return 'Hourly';
    }
    
    // 否则为 Daily（每日早上9点执行）
    return 'Daily';
  }
  
  /**
   * 创建新消息
   */
  async createMessage(formData: CreateMessageFormData): Promise<ScheduledMessage> {
    if (!this.config) {
      await this.loadConfig();
    }
    
    if (!this.config) {
      throw new Error('未找到配置，请先初始化系统');
    }
    
    const message: ScheduledMessage = {
      ID: `msg_${Date.now()}`,
      ...formData,
      Schedule_Time: formData.Schedule_Time || '',  // 留空表示每日9点
      Status: 'Active',
      Exec_Count: 0,
      Exec_Log: '待执行'
    };
    message.Push_Method = normalizePushMethodAlias(message.Push_Method) as ScheduledMessage['Push_Method'];
    normalizeExecutorTargetType(message);
    
    // 自动判断类型
    message.Type = this.determineMessageType(message);
    
    // 计算下次执行时间
    message.Next_Exec = this.calculateNextExecution(message);
    
    // 添加到 Sheet
    const liveHeaders = await this.getHeaders({ forceRefresh: true });
    const row = await this.messageToRow(message, liveHeaders);
    await this.appendRow(row);
    
    return message;
  }
  
  /**
   * 更新消息
   */
  async updateMessage(id: string, updates: Partial<ScheduledMessage>): Promise<ScheduledMessage> {
    const messages = await this.getAllMessages();
    const index = messages.findIndex(msg => msg.ID === id);
    
    if (index === -1) {
      throw new Error(`未找到消息: ${id}`);
    }
    
    const previousMessage = messages[index];
    const updatedMessage = mergeScheduledMessageUpdate(previousMessage, updates);
    updatedMessage.Push_Method = normalizePushMethodAlias(updatedMessage.Push_Method) as ScheduledMessage['Push_Method'];
    normalizeExecutorTargetType(updatedMessage);

    if (
      shouldReactivateDoneOneTimeMessageAfterScheduleChange(
        previousMessage,
        updatedMessage,
        updates,
      )
    ) {
      updatedMessage.Status = 'Active';
      updatedMessage.Last_Exec = '';
      updatedMessage.Exec_Log = '待执行';
      console.log(`✅ 消息 ${id} 已从 Done 自动恢复为 Active，等待新的未来执行时间`);
    }
    
    // 重新计算下次执行时间
    if (
      updates.Schedule_Date !== undefined ||
      updates.Schedule_Time !== undefined ||
      updates.End_Date !== undefined ||
      updates.Type !== undefined ||
      updates.Repeat_Every !== undefined ||
      updates.Repeat_Unit !== undefined ||
      updates.Repeat_Count !== undefined ||
      updates.Repeat_Days !== undefined ||
      updates.Exec_Count !== undefined ||
      updates.Push_Method !== undefined ||
      updates.AI_Endpoint !== undefined
    ) {
      updatedMessage.Next_Exec = this.calculateNextExecution(updatedMessage);
    }
    
    // 更新到 Sheet（行号 = 索引 + 2，因为有表头且从1开始）
    const liveHeaders = await this.getHeaders({ forceRefresh: true });
    const row = await this.messageToRow(updatedMessage, liveHeaders);
    await this.updateRow(index + 2, row, liveHeaders);
    
    return updatedMessage;
  }
  
  /**
   * 删除消息
   */
  async deleteMessage(id: string): Promise<void> {
    const messages = await this.getAllMessages();
    const index = messages.findIndex(msg => msg.ID === id);
    
    if (index === -1) {
      throw new Error(`未找到消息: ${id}`);
    }
    
    // 删除行（行号 = 索引 + 2）
    await this.deleteRow(index + 2);
  }
  
  /**
   * 删除所有已完成的消息（Status = 'Done'）
   * @returns {Promise<number>} 删除的消息数量
   */
  async deleteCompletedMessages(): Promise<number> {
    const messages = await this.getAllMessages();
    const completedMessages = messages.filter(msg => msg.Status === 'Done');
    
    if (completedMessages.length === 0) {
      return 0;
    }
    
    // 从后往前删除，避免索引变化影响
    const sortedIndices = completedMessages
      .map(msg => messages.findIndex(m => m.ID === msg.ID))
      .sort((a, b) => b - a);
    
    for (const index of sortedIndices) {
      await this.deleteRow(index + 2);
    }
    
    return completedMessages.length;
  }
  
  /**
   * 暂停/恢复消息
   */
  async toggleMessageStatus(id: string): Promise<ScheduledMessage> {
    const message = await this.getMessageById(id);
    if (!message) {
      throw new Error(`未找到消息: ${id}`);
    }

    const action = getScheduledMessageStatusToggleAction(message.Status);
    if (!action.canToggle || !action.nextStatus) {
      throw new Error(action.title);
    }
    
    return await this.updateMessage(id, { Status: action.nextStatus });
  }
  
  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<Statistics> {
    const messages = await this.getAllMessages();
    const today = getTodayLocalScheduleDate();
    
    return {
      total: messages.length,
      active: messages.filter(m => m.Status === 'Active').length,
      paused: messages.filter(m => m.Status === 'Paused').length,
      completed: messages.filter(m => m.Status === 'Completed').length,
      done: messages.filter(m => m.Status === 'Done').length,
      pendingReview: messages.filter(m => m.Status === 'PendingReview').length,
      executedToday: messages.filter(m => 
        m.Last_Exec && m.Last_Exec.startsWith(today)
      ).length
    };
  }
  
  /**
   * 同步数据（从 Sheet 刷新）
   */
  async syncFromSheet(): Promise<ScheduledMessage[]> {
    // 清除 header 缓存，确保获取最新的列结构
    this.clearHeaderCache();
    // 直接返回最新数据即可
    return await this.getAllMessages();
  }
  
  // ========== 私有方法 ==========
  
  /**
   * 获取 Sheet 的 Header（带缓存）
   */
  private async getHeaders(options: { forceRefresh?: boolean } = {}): Promise<string[]> {
    if (!options.forceRefresh && this.headerCache) {
      return this.headerCache;
    }
    
    if (!this.config) {
      await this.loadConfig();
    }
    
    if (!this.config) {
      throw new Error('未找到配置，请先初始化系统');
    }
    
    return await this.withTokenRetry(async () => {
      const sheet = new Sheet(this.token, this.config.sheetId, 'Messages');
      const data = await sheet.readSheet();
      
      if (!data || data.length === 0) {
        throw new Error('无法读取 Sheet 数据');
      }
      
      this.headerCache = data[0];
      return this.headerCache;
    });
  }
  
  /**
   * 清除 header 缓存（在 Sheet 结构可能改变时调用）
   */
  private clearHeaderCache(): void {
    this.headerCache = null;
  }
  
  /**
   * 解析行数据为消息对象
   */
  private parseRowToMessage(row: any[], headers: string[]): ScheduledMessage | null {
    if (!row || row.length === 0) return null;
    
    const message: any = {};
    headers.forEach((header, index) => {
      message[header] = row[index] || '';
    });
    message.Push_Method = normalizePushMethodAlias(message.Push_Method);

    const numericFields = [
      'Repeat_Every',
      'Repeat_Count',
      'Timeline_Offset',
      'Exec_Count',
    ];

    numericFields.forEach((field) => {
      const value = message[field];
      if (value === '' || value === undefined || value === null) {
        return;
      }

      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(parsed)) {
        message[field] = parsed;
      }
    });

    if (!message.Target_Type && message.Outreach_Target_Type) {
      message.Target_Type = message.Outreach_Target_Type;
    }
    normalizeExecutorTargetType(message);

    if (!message.Outreach_Result && message.Outreach_Last_Result) {
      message.Outreach_Result = message.Outreach_Last_Result;
    }
    
    return message as ScheduledMessage;
  }

  private parseRowToPushLog(row: any[], headers: string[]): PushLog | null {
    if (!row || row.length === 0) return null;

    const log: any = {};
    headers.forEach((header, index) => {
      log[header] = row[index] || '';
    });

    if (!log.Message_ID && !log.Timestamp && !log.Content) {
      return null;
    }

    const execCount = log.Exec_Count === '' || log.Exec_Count === undefined || log.Exec_Count === null
      ? 0
      : Number(log.Exec_Count);
    log.Exec_Count = Number.isNaN(execCount) ? 0 : execCount;

    return log as PushLog;
  }
  
  /**
   * 将消息对象转换为行数据（根据 header 顺序动态生成）
   */
  private async messageToRow(message: ScheduledMessage, headers?: string[]): Promise<any[]> {
    const resolvedHeaders = headers || await this.getHeaders();
    const normalizedMessage = {
      ...message,
      Push_Method: normalizePushMethodAlias(message.Push_Method),
    };
    const row: any[] = [];
    
    // 根据 header 顺序构建行数据
    for (const header of resolvedHeaders) {
      if (NON_PERSISTED_OUTREACH_FIELDS.has(header)) {
        row.push('');
        continue;
      }

      const value = (normalizedMessage as any)[header];
      
      // 处理不同类型的字段
      if (value === undefined || value === null) {
        row.push('');
      } else if (typeof value === 'number') {
        row.push(value);
      } else {
        row.push(String(value));
      }
    }
    
    return row;
  }
  
  /**
   * 追加行
   */
  private async appendRow(row: any[]): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    await this.withTokenRetry(async () => {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}/values/Messages:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`添加行失败 (${response.status}): ${error}`);
      }
    });
  }
  
  /**
   * 更新行（根据 header 数量动态确定列范围）
   */
  private async updateRow(rowIndex: number, row: any[], headers?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    await this.withTokenRetry(async () => {
      // 获取 header 以确定列数
      const resolvedHeaders = headers || await this.getHeaders({ forceRefresh: true });
      const columnCount = resolvedHeaders.length;
      
      // 将列数转换为字母（A, B, C, ... Z, AA, AB, ...）
      const endColumn = this.numberToColumn(columnCount);
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}/values/Messages!A${rowIndex}:${endColumn}${rowIndex}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`更新行失败 (${response.status}): ${error}`);
      }
    });
  }
  
  /**
   * 将数字转换为 Excel 列字母（1 -> A, 2 -> B, 26 -> Z, 27 -> AA）
   */
  private numberToColumn(num: number): string {
    let column = '';
    while (num > 0) {
      const remainder = (num - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      num = Math.floor((num - 1) / 26);
    }
    return column;
  }
  
  /**
   * 获取 Messages Sheet 的 sheetId
   */
  private async getMessagesSheetId(forceRefresh = false): Promise<number> {
    // 如果配置中有 messagesSheetId 且不强制刷新，直接使用
    // 注意：sheetId 可以是 0，这是有效值，所以只检查 undefined
    if (!forceRefresh && this.config?.messagesSheetId !== undefined && this.config.messagesSheetId !== null) {
      return this.config.messagesSheetId;
    }
    
    // 否则动态获取
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    return await this.withTokenRetry(async () => {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取 Sheet 信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      const messagesSheet = data.sheets.find((s: any) => s.properties.title === 'Messages');
      
      if (!messagesSheet) {
        throw new Error('未找到 Messages 工作表');
      }
      
      const sheetId = messagesSheet.properties.sheetId;
      
      // 缓存到配置中
      this.config.messagesSheetId = sheetId;
      await chrome.storage.local.set({ scheduledMessagesConfig: normalizeSheetConfig(this.config) });
      
      return sheetId;
    });
  }
  
  /**
   * 删除行
   */
  private async deleteRow(rowIndex: number): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    // 尝试删除行的内部函数
    const tryDelete = async (forceRefreshSheetId: boolean): Promise<{ success: boolean; needsRetry: boolean; error?: string }> => {
      try {
        const messagesSheetId = await this.getMessagesSheetId(forceRefreshSheetId);
        
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.config!.sheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: messagesSheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1,
                    endIndex: rowIndex
                  }
                }
              }]
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // 检查是否是 sheetId 无效的错误
          if (errorText.includes('No grid with id')) {
            // 清除缓存的 sheetId
            if (this.config) {
              console.log(`🔄 检测到 sheetId 无效 (当前值: ${messagesSheetId})，将强制刷新...`);
              this.config.messagesSheetId = undefined;
              await chrome.storage.local.set({ scheduledMessagesConfig: normalizeSheetConfig(this.config) });
            }
            return { success: false, needsRetry: true, error: errorText };
          }
          
          return { success: false, needsRetry: false, error: `删除行失败 (${response.status}): ${errorText}` };
        }
        
        return { success: true, needsRetry: false };
      } catch (error: any) {
        // 处理 401 错误
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          throw error; // 让外层的 withTokenRetry 处理
        }
        return { success: false, needsRetry: false, error: error.message };
      }
    };
    
    // 第一次尝试（使用缓存的 sheetId）
    let result = await this.withTokenRetry(() => tryDelete(false));
    
    // 如果需要重试（sheetId 无效）
    if (!result.success && result.needsRetry) {
      console.log('🔄 重试删除操作（强制刷新 sheetId）...');
      result = await this.withTokenRetry(() => tryDelete(true));
    }
    
    // 如果仍然失败
    if (!result.success) {
      throw new Error(result.error || '删除行失败');
    }
  }
  
  /**
   * 计算下次执行时间
   */
  private calculateNextExecution(message: ScheduledMessage): string {
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      // Timeline 触发：返回描述性文本，不计算具体日期
      return formatTimelineNextExecutionText(message);
    }
    
    return calculateScheduledMessageNextExecution(message);
  }
}
