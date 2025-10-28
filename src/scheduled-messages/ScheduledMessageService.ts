/**
 * 定时消息数据服务层
 * 封装 Google Sheets API 的 CRUD 操作
 */

import { Sheet } from '../sheet';
import { ScheduledMessage, CreateMessageFormData, SheetConfig, Statistics } from './types';

export class ScheduledMessageService {
  private token: string;
  private config: SheetConfig | null = null;
  
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
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const message = this.parseRowToMessage(row, headers);
        if (message && message.ID) {
          messages.push(message);
        }
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
      Owner: 'User', // TODO: 获取当前用户
      Status: 'Active',
      Exec_Count: 0,
      Exec_Log: '待执行'
    };
    
    // 计算下次执行时间
    message.Next_Exec = this.calculateNextExecution(message);
    
    // 添加到 Sheet
    const row = this.messageToRow(message);
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
    const row = this.messageToRow(updatedMessage);
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
   * 暂停/恢复消息
   */
  async toggleMessageStatus(id: string): Promise<ScheduledMessage> {
    const message = await this.getMessageById(id);
    if (!message) {
      throw new Error(`未找到消息: ${id}`);
    }
    
    const newStatus = message.Status === 'Active' ? 'Paused' : 'Active';
    return await this.updateMessage(id, { Status: newStatus });
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
      executedToday: messages.filter(m => 
        m.Last_Exec && m.Last_Exec.startsWith(today)
      ).length
    };
  }
  
  /**
   * 同步数据（从 Sheet 刷新）
   */
  async syncFromSheet(): Promise<ScheduledMessage[]> {
    // 直接返回最新数据即可
    return await this.getAllMessages();
  }
  
  // ========== 私有方法 ==========
  
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
   * 将消息对象转换为行数据
   */
  private messageToRow(message: ScheduledMessage): any[] {
    return [
      message.ID,
      message.Type,
      message.Topic,
      message.Content,
      message.Schedule_Date,
      message.Schedule_Time,
      message.End_Date || '',
      message.Repeat_Every || '',
      message.Repeat_Unit || '',
      message.Repeat_Count || '',
      message.Push_Method,
      message.Glip_User_Name || '',
      message.Glip_Team_ID || '',
      message.Bot_Endpoint || '',
      message.Attachment || '',
      message.Owner,
      message.Status,
      message.Last_Exec || '',
      message.Next_Exec || '',
      message.Exec_Count || 0,
      message.Exec_Log || ''
    ];
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
   * 更新行
   */
  private async updateRow(rowIndex: number, row: any[]): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    await this.withTokenRetry(async () => {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}/values/Messages!A${rowIndex}:U${rowIndex}?valueInputOption=USER_ENTERED`,
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
   * 删除行
   */
  private async deleteRow(rowIndex: number): Promise<void> {
    if (!this.config) {
      throw new Error('未找到配置');
    }
    
    await this.withTokenRetry(async () => {
      // 使用 batchUpdate 删除行
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}:batchUpdate`,
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
                  sheetId: 0, // Messages 工作表
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
        const error = await response.text();
        throw new Error(`删除行失败 (${response.status}): ${error}`);
      }
    });
  }
  
  /**
   * 计算下次执行时间
   */
  private calculateNextExecution(message: ScheduledMessage): string {
    if (message.Type === 'Daily') {
      // Daily 类型只执行一次
      return message.Schedule_Date;
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


