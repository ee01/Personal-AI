/**
 * 配置同步服务
 * 负责在 Chrome Storage 和 Sheet Config 表之间同步配置
 */

import { SheetConfig } from './types';

export class ConfigSyncService {
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  /**
   * 从 Sheet Config 表读取配置
   */
  async readConfigFromSheet(sheetId: string): Promise<Partial<SheetConfig>> {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Config!A2:B50`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('读取 Sheet 配置失败');
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      // 将键值对转换为配置对象
      const config: Partial<SheetConfig> = {
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      };
      
      for (const row of rows) {
        const [key, value] = row;
        if (!key || !value) continue;
        
        switch (key) {
          case 'minute_trigger_id':
            config.minute_trigger_id = value;
            break;
          case 'daily_trigger_id':
            config.daily_trigger_id = value;
            break;
          case 'web_app_url':
            config.webAppUrl = value;
            break;
          case 'script_id':
            config.scriptId = value;
            break;
          case 'sheet_version':
            config.sheet_version = value;
            break;
          case 'created_by':
            config.created_by = value;
            break;
          case 'created_at':
            config.created_at = value;
            break;
          case 'last_sync_time':
            config.last_sync_time = value;
            break;
          case 'messages_sheet_id':
            config.messagesSheetId = parseInt(value);
            break;
          // Bot Executor 配置
          case 'bot_executor_rule_id':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.ruleId = value;
            break;
          case 'bot_executor_rule_name':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.ruleName = value;
            break;
          case 'bot_executor_webhook_url':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.webhookUrl = value;
            break;
          case 'bot_executor_project_key':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.projectKey = value;
            break;
          case 'bot_executor_jira_url':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.jiraUrl = value;
            break;
          case 'bot_executor_created_at':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.createdAt = value;
            break;
          case 'bot_executor_rule_version':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.ruleVersion = value;
            break;
          case 'bot_executor_rule_last_updated':
            if (!config.botExecutor) config.botExecutor = {} as any;
            config.botExecutor.ruleLastUpdated = value;
            break;
        }
      }
      
      return config;
    } catch (error) {
      console.error('从 Sheet 读取配置失败:', error);
      throw error;
    }
  }
  
  /**
   * 保存配置到 Sheet Config 表
   */
  async saveConfigToSheet(config: SheetConfig): Promise<void> {
    try {
      const configData: [string, string][] = [];
      
      // 基础配置
      if (config.minute_trigger_id) {
        configData.push(['minute_trigger_id', config.minute_trigger_id]);
      }
      if (config.daily_trigger_id) {
        configData.push(['daily_trigger_id', config.daily_trigger_id]);
      }
      if (config.webAppUrl) {
        configData.push(['web_app_url', config.webAppUrl]);
      }
      if (config.scriptId) {
        configData.push(['script_id', config.scriptId]);
      }
      if (config.sheet_version) {
        configData.push(['sheet_version', config.sheet_version]);
      }
      if (config.created_by) {
        configData.push(['created_by', config.created_by]);
      }
      if (config.created_at) {
        configData.push(['created_at', config.created_at]);
      }
      configData.push(['last_sync_time', new Date().toISOString()]);
      
      // Messages Sheet ID
      if (config.messagesSheetId !== undefined) {
        configData.push(['messages_sheet_id', config.messagesSheetId.toString()]);
      }
      
      // Bot Executor 配置
      if (config.botExecutor) {
        configData.push(['bot_executor_rule_id', config.botExecutor.ruleId]);
        configData.push(['bot_executor_rule_name', config.botExecutor.ruleName]);
        configData.push(['bot_executor_webhook_url', config.botExecutor.webhookUrl]);
        configData.push(['bot_executor_project_key', config.botExecutor.projectKey]);
        configData.push(['bot_executor_jira_url', config.botExecutor.jiraUrl]);
        configData.push(['bot_executor_created_at', config.botExecutor.createdAt]);
        if (config.botExecutor.ruleVersion) {
          configData.push(['bot_executor_rule_version', config.botExecutor.ruleVersion]);
        }
        if (config.botExecutor.ruleLastUpdated) {
          configData.push(['bot_executor_rule_last_updated', config.botExecutor.ruleLastUpdated]);
        }
      }
      
      // 更新 Sheet Config 表
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/Config!A2:B50?valueInputOption=USER_ENTERED`,
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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`保存配置到 Sheet 失败: ${errorText}`);
      }
      
      console.log('✅ 配置已同步到 Sheet Config 表');
    } catch (error) {
      console.error('保存配置到 Sheet 失败:', error);
      throw error;
    }
  }
  
  /**
   * 保存配置到 Chrome Storage
   */
  async saveConfigToStorage(config: SheetConfig): Promise<void> {
    await chrome.storage.local.set({ scheduledMessagesConfig: config });
    console.log('✅ 配置已保存到 Chrome Storage');
  }
  
  /**
   * 从 Chrome Storage 读取配置
   */
  async readConfigFromStorage(): Promise<SheetConfig | null> {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    return result.scheduledMessagesConfig || null;
  }
  
  /**
   * 同步配置：同时保存到 Sheet 和 Chrome Storage
   */
  async syncConfig(config: SheetConfig): Promise<void> {
    // 更新 last_sync_time
    config.last_sync_time = new Date().toISOString();
    
    // 同时保存到两个位置
    await Promise.all([
      this.saveConfigToSheet(config),
      this.saveConfigToStorage(config)
    ]);
    
    console.log('✅ 配置已同步到 Sheet 和 Chrome Storage');
  }
  
  /**
   * 更新部分配置（仅更新指定字段）
   */
  async updatePartialConfig(updates: Partial<SheetConfig>): Promise<SheetConfig> {
    // 读取现有配置
    const existingConfig = await this.readConfigFromStorage();
    if (!existingConfig) {
      throw new Error('未找到现有配置');
    }
    
    // 合并配置
    const updatedConfig: SheetConfig = {
      ...existingConfig,
      ...updates,
      last_sync_time: new Date().toISOString()
    };
    
    // 同步到两个位置
    await this.syncConfig(updatedConfig);
    
    return updatedConfig;
  }
}

