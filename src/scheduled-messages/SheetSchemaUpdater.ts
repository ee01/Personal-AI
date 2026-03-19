/**
 * Sheet Schema Updater
 * 负责自动检测并更新 Google Sheet 的表结构
 * 
 * 当扩展升级新增字段时，自动为老用户的 Sheet 添加缺失的列
 */

import { SheetConfig } from './types';
import { MESSAGES_SCHEMA } from './SheetInitializer';
import { normalizeSheetConfig } from './botAutomationConfig';

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
    this.config = normalizeSheetConfig(config);
  }
  
  /**
   * 检查并自动更新表结构
   */
  async checkAndUpdate(): Promise<SchemaUpdateResult> {
    try {
      console.log('🔍 检查 Sheet 表结构...');
      
      // 0. 主动验证并刷新 messagesSheetId（修复老用户的配置）
      await this.refreshSheetIds();
      
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
   * 主动验证并刷新 Sheet IDs（messagesSheetId, logsSheetId）
   * 通过工作表名称获取真实的 sheetId，修复老用户可能存在的配置问题
   */
  private async refreshSheetIds(): Promise<void> {
    try {
      console.log('🔄 验证 Sheet IDs...');
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      if (!response.ok) {
        console.warn('无法获取 Sheet 元数据，跳过 ID 验证');
        return;
      }
      
      const data = await response.json();
      const sheets = data.sheets || [];
      
      // 通过工作表名称找到真实的 sheetId
      const messagesSheet = sheets.find((s: any) => s.properties?.title === 'Messages');
      const logsSheet = sheets.find((s: any) => s.properties?.title === 'Logs');
      
      let needsUpdate = false;
      
      if (messagesSheet) {
        const realMessagesSheetId = messagesSheet.properties.sheetId;
        if (this.config.messagesSheetId !== realMessagesSheetId) {
          console.log(`📝 修复 messagesSheetId: ${this.config.messagesSheetId} -> ${realMessagesSheetId}`);
          this.config.messagesSheetId = realMessagesSheetId;
          needsUpdate = true;
        }
      }
      
      if (logsSheet) {
        const realLogsSheetId = logsSheet.properties.sheetId;
        if (this.config.logsSheetId !== realLogsSheetId) {
          console.log(`📝 修复 logsSheetId: ${this.config.logsSheetId} -> ${realLogsSheetId}`);
          this.config.logsSheetId = realLogsSheetId;
          needsUpdate = true;
        }
      }
      
      // 如果有变更，同步保存到 Chrome Storage 和 Config Sheet
      if (needsUpdate) {
        // 保存到 Chrome Storage
        await chrome.storage.local.set({ scheduledMessagesConfig: normalizeSheetConfig(this.config) });
        
        // 保存到 Config Sheet
        const { ConfigSyncService } = await import('./ConfigSyncService');
        const syncService = new ConfigSyncService(this.token);
        await syncService.saveConfigToSheet(this.config);
        
        console.log('✅ Sheet IDs 已修复并同步');
      } else {
        console.log('✅ Sheet IDs 验证通过');
      }
      
    } catch (error) {
      console.warn('验证 Sheet IDs 失败，继续执行:', error);
      // 不抛出错误，允许继续执行后续逻辑
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
    
    // 先扩展表格列数（如果需要）
    const requiredColumns = currentHeaders.length + missingColumns.length;
    await this.ensureColumnCount(requiredColumns);
    
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
   * 确保表格有足够的列数
   */
  private async ensureColumnCount(requiredColumns: number): Promise<void> {
    const messagesSheetId = this.config.messagesSheetId || 0;
    
    // 获取当前表格的列数
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.sheetId}?fields=sheets(properties)`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    if (!metaResponse.ok) {
      console.warn('无法获取表格元数据，尝试直接扩展列');
      // 直接尝试扩展列
      await this.appendColumns(messagesSheetId, requiredColumns);
      return;
    }
    
    const metaData = await metaResponse.json();
    const messagesSheet = metaData.sheets?.find(
      (s: { properties: { sheetId: number } }) => s.properties.sheetId === messagesSheetId
    );
    
    const currentColumnCount = messagesSheet?.properties?.gridProperties?.columnCount || 26;
    
    if (currentColumnCount >= requiredColumns) {
      console.log(`表格列数足够: ${currentColumnCount} >= ${requiredColumns}`);
      return;
    }
    
    // 需要增加列
    const columnsToAdd = requiredColumns - currentColumnCount + 5; // 多预留 5 列
    console.log(`扩展表格列数: ${currentColumnCount} + ${columnsToAdd} = ${currentColumnCount + columnsToAdd}`);
    
    await this.appendColumns(messagesSheetId, columnsToAdd);
  }
  
  /**
   * 向表格追加列
   */
  private async appendColumns(sheetId: number, count: number): Promise<void> {
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
              appendDimension: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                length: count
              }
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.warn(`扩展列失败: ${error}，但会尝试继续`);
    } else {
      console.log(`✅ 已扩展 ${count} 列`);
    }
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
      const config = normalizeSheetConfig(result.scheduledMessagesConfig as SheetConfig);
      
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
