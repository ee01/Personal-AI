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
import { ScheduledMessage, CreateMessageFormData, SheetConfig, Statistics, MessageType } from './types';

export class ScheduledMessageService {
  private token: string;
  private config: SheetConfig | null = null;
  private headerCache: string[] | null = null;  // 缓存 header 顺序
  
  constructor(token: string) {
    this.token = token;
  }
  
  /**
   * 刷新 token
   */
  private async refreshToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      // 先移除缓存的 token
      chrome.identity.getAuthToken({ interactive: false }, (cachedToken) => {
        if (cachedToken) {
          chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
            // 获取新 token
            chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (newToken) {
                this.token = newToken;
                resolve(newToken);
              } else {
                reject(new Error('无法获取新 token'));
              }
            });
          });
        } else {
          // 直接获取新 token
          chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (newToken) {
              this.token = newToken;
              resolve(newToken);
            } else {
              reject(new Error('无法获取新 token'));
            }
          });
        }
      });
    });
  }
  
  /**
   * 执行带自动重试的操作
   * 如果遇到 401 错误，自动刷新 token 并重试一次
   */
  private async withTokenRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const is401Error = error.message?.includes('401') || 
                         error.message?.includes('Unauthorized') ||
                         error.message?.includes('Invalid Credentials');
      
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
    this.config = result.scheduledMessagesConfig || null;
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
        const message = this.parseRowToMessage(row, headers);
        
          if (message) {
            // 如果没有 ID，自动生成一个
            if (!message.ID) {
              message.ID = `msg_${Date.now()}_${i}`;
              hasUpdates = true;
              console.log(`自动生成 ID: ${message.ID} (行 ${i + 1})`);
            }
            
            // 自动判断消息类型（如果没有 Type 字段）
            if (!message.Type) {
              message.Type = this.determineMessageType(message);
            }
            
            // 如果有更新，写回 Sheet
            if (hasUpdates) {
              const row = await this.messageToRow(message);
              await this.updateRow(i + 1, row);
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
    if (message.Schedule_Time && message.Schedule_Time.trim()) {
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
    
    // 自动判断类型
    message.Type = this.determineMessageType(message);
    
    // 计算下次执行时间
    message.Next_Exec = this.calculateNextExecution(message);
    
    // 添加到 Sheet
    const row = await this.messageToRow(message);
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
    
    const updatedMessage = { ...messages[index], ...updates };
    
    // 重新计算下次执行时间
    if (updates.Schedule_Date || updates.Schedule_Time || updates.Type || updates.Repeat_Every) {
      updatedMessage.Next_Exec = this.calculateNextExecution(updatedMessage);
    }
    
    // 更新到 Sheet（行号 = 索引 + 2，因为有表头且从1开始）
    const row = await this.messageToRow(updatedMessage);
    await this.updateRow(index + 2, row);
    
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
    
    const newStatus = message.Status === 'Active' ? 'Paused' : 'Active';
    
    // 如果从 Done 状态切换到 Active，清空 Last_Exec（允许重新推送）
    const updates: any = { Status: newStatus };
    if (message.Status === 'Done' && newStatus === 'Active') {
      updates.Last_Exec = '';
      console.log(`✅ 消息 ${id} 从 Done 切换到 Active，已清空 Last_Exec 以允许重新推送`);
    }
    
    return await this.updateMessage(id, updates);
  }
  
  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<Statistics> {
    const messages = await this.getAllMessages();
    const today = new Date().toISOString().split('T')[0];
    
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
  private async getHeaders(): Promise<string[]> {
    if (this.headerCache) {
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
    
    return message as ScheduledMessage;
  }
  
  /**
   * 将消息对象转换为行数据（根据 header 顺序动态生成）
   */
  private async messageToRow(message: ScheduledMessage): Promise<any[]> {
    const headers = await this.getHeaders();
    const row: any[] = [];
    
    // 根据 header 顺序构建行数据
    for (const header of headers) {
      const value = (message as any)[header];
      
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
  private async updateRow(rowIndex: number, row: any[]): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    await this.withTokenRetry(async () => {
      // 获取 header 以确定列数
      const headers = await this.getHeaders();
      const columnCount = headers.length;
      
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
      await chrome.storage.local.set({ scheduledMessagesConfig: this.config });
      
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
              await chrome.storage.local.set({ scheduledMessagesConfig: this.config });
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
      const milestone = message.Timeline_Milestone;
      const offset = message.Timeline_Offset ?? 0;
      let offsetText = '';
      
      if (offset === 0) {
        offsetText = '当天';
      } else if (offset === 1) {
        offsetText = '后一天';
      } else if (offset === -1) {
        offsetText = '前一天';
      } else if (offset > 1) {
        offsetText = `后${offset}天`;
      } else if (offset < -1) {
        offsetText = `前${Math.abs(offset)}天`;
      }
      
      return `${milestone} ${offsetText}`;
    }
    
    if (message.Type === 'Daily') {
      // Daily 类型只执行一次
      return message.Schedule_Date || '';
    } else if (message.Type === 'Hourly') {
      // Hourly 类型只执行一次
      return `${message.Schedule_Date} ${message.Schedule_Time}`;
    } else if (message.Type === 'Periodic') {
      // 周期性任务
      if (!message.Schedule_Date || !message.Repeat_Every || !message.Repeat_Unit) {
        return '';
      }
      
      const startDate = new Date(message.Schedule_Date);
      const now = new Date();
      const nextDate = new Date(startDate);
      
      // 如果开始日期在未来，返回开始日期
      if (startDate > now) {
        return message.Schedule_Date;
      }
      
      // 计算下一次执行时间
      const every = message.Repeat_Every;
      const unit = message.Repeat_Unit;
      
      while (nextDate <= now) {
        if (unit === 'Day') {
          nextDate.setDate(nextDate.getDate() + every);
        } else if (unit === 'Week') {
          nextDate.setDate(nextDate.getDate() + (7 * every));
        } else if (unit === 'Month') {
          nextDate.setMonth(nextDate.getMonth() + every);
        } else if (unit === 'Year') {
          nextDate.setFullYear(nextDate.getFullYear() + every);
        }
      }
      
      return nextDate.toISOString().split('T')[0];
    }
    
    return '';
  }
}


