/**
 * Sheet Schema Updater
 * 负责自动检测并更新 Google Sheet 的表结构
 * 
 * 当扩展升级新增字段时，自动为老用户的 Sheet 添加缺失的列
 */

import { SheetConfig } from './types';
import { MESSAGES_SCHEMA } from './SheetInitializer';

export interface SchemaUpdateResult {
  success: boolean;
  updated: boolean;
  addedColumns: string[];
  error?: string;
}

export class SheetSchemaUpdater {
  private token: string;
  private config: SheetConfig;
  
  constructor(token: string, config: SheetConfig) {
    this.token = token;
    this.config = config;
  }
  
  /**
   * 检查并自动更新表结构
   */
  async checkAndUpdate(): Promise<SchemaUpdateResult> {
    try {
      console.log('🔍 检查 Sheet 表结构...');
      
      // 1. 获取当前 Messages 表的表头
      const currentHeaders = await this.getMessagesHeaders();
      console.log('当前表头:', currentHeaders);
      
      // 2. 比对找出缺失的列
      const missingColumns = MESSAGES_SCHEMA.columns.filter(
        col => !currentHeaders.includes(col)
      );
      
      if (missingColumns.length === 0) {
        console.log('✅ Sheet 表结构已是最新');
        return {
          success: true,
          updated: false,
          addedColumns: []
        };
      }
      
      console.log('📝 发现缺失的列:', missingColumns);
      
      // 3. 为缺失的列添加到表末尾
      await this.addMissingColumns(currentHeaders, missingColumns);
      
      // 4. 更新配置中的 sheet_version
      await this.updateSchemaVersion();
      
      console.log('✅ Sheet 表结构更新完成');
      
      return {
        success: true,
        updated: true,
        addedColumns: missingColumns
      };
      
    } catch (error) {
      console.error('❌ Sheet 表结构更新失败:', error);
      return {
        success: false,
        updated: false,
        addedColumns: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 获取 Messages 表的当前表头
   */
  private async getMessagesHeaders(): Promise<string[]> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}/values/Messages!1:1`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`获取表头失败: ${error}`);
    }
    
    const data = await response.json();
    return data.values?.[0] || [];
  }
  
  /**
   * 添加缺失的列
   */
  private async addMissingColumns(currentHeaders: string[], missingColumns: string[]): Promise<void> {
    // 计算新列应该添加的位置（追加到末尾）
    const startColumn = this.columnIndexToLetter(currentHeaders.length);
    const endColumn = this.columnIndexToLetter(currentHeaders.length + missingColumns.length - 1);
    
    // 添加表头
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}/values/Messages!${startColumn}1:${endColumn}1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [missingColumns]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`添加列失败: ${error}`);
    }
    
    // 设置新列表头的格式（蓝色背景白色加粗字）
    await this.formatNewHeaders(currentHeaders.length, missingColumns.length);
    
    console.log(`✅ 已添加 ${missingColumns.length} 个新列: ${missingColumns.join(', ')}`);
  }
  
  /**
   * 设置新表头的格式
   */
  private async formatNewHeaders(startIndex: number, count: number): Promise<void> {
    const messagesSheetId = this.config.messagesSheetId || 0;
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: messagesSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: startIndex,
                  endColumnIndex: startIndex + count
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      console.warn('设置表头格式失败，但不影响功能');
    }
  }
  
  /**
   * 更新配置中的 schema version
   */
  private async updateSchemaVersion(): Promise<void> {
    const updatedConfig = {
      ...this.config,
      sheet_version: MESSAGES_SCHEMA.version
    };
    
    // 使用 ConfigSyncService 同步配置
    const { ConfigSyncService } = await import('./ConfigSyncService');
    const syncService = new ConfigSyncService(this.token);
    await syncService.syncConfig(updatedConfig);
  }
  
  /**
   * 将列索引转换为字母（0 -> A, 1 -> B, 26 -> AA）
   */
  private columnIndexToLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
  
  /**
   * 静态方法：检查并自动更新（类似 AppScriptUpdater 的接口）
   */
  static async checkAndAutoUpdate(
    getAuthToken: () => Promise<string>,
    options?: { showNotification?: boolean }
  ): Promise<SchemaUpdateResult> {
    try {
      // 获取配置
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const config = result.scheduledMessagesConfig as SheetConfig;
      
      if (!config || !config.sheetId) {
        console.log('未找到定时消息配置，跳过 Sheet Schema 检查');
        return { success: true, updated: false, addedColumns: [] };
      }
      
      // 检查是否需要更新
      if (config.sheet_version === MESSAGES_SCHEMA.version) {
        console.log(`Sheet Schema 版本已是最新: ${MESSAGES_SCHEMA.version}`);
        return { success: true, updated: false, addedColumns: [] };
      }
      
      console.log(`Sheet Schema 需要更新: ${config.sheet_version || 'unknown'} -> ${MESSAGES_SCHEMA.version}`);
      
      // 获取 token
      const token = await getAuthToken();
      
      // 执行更新
      const updater = new SheetSchemaUpdater(token, config);
      const updateResult = await updater.checkAndUpdate();
      
      // 显示通知
      if (options?.showNotification && updateResult.updated) {
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Sheet 表结构已更新',
          message: `已添加新列: ${updateResult.addedColumns.join(', ')}`
        });
      }
      
      return updateResult;
      
    } catch (error) {
      console.error('Sheet Schema 自动更新失败:', error);
      return {
        success: false,
        updated: false,
        addedColumns: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

