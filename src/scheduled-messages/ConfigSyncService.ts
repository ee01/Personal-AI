/**
 * 配置同步服务
 * 负责在 Chrome Storage 和 Sheet Config 表之间同步配置
 */

import { BotAutomationRule, SheetConfig } from './types';
import { getBotAutomationConfig, normalizeSheetConfig } from './botAutomationConfig';

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

      const ensureRule = (kind: 'executorRule' | 'timelineSyncRule' | 'legacy'): BotAutomationRule => {
        if (kind === 'legacy') {
          if (!config.botExecutor) {
            config.botExecutor = {} as BotAutomationRule;
          }
          return config.botExecutor;
        }

        if (!config.botAutomation) {
          config.botAutomation = {};
        }
        if (!config.botAutomation[kind]) {
          config.botAutomation[kind] = {} as BotAutomationRule;
        }
        return config.botAutomation[kind] as BotAutomationRule;
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
          case 'logs_sheet_id':
            config.logsSheetId = parseInt(value);
            break;
          // Bot Executor 配置
          case 'bot_executor_rule_id':
            ensureRule('legacy').ruleId = value;
            break;
          case 'bot_executor_rule_name':
            ensureRule('legacy').ruleName = value;
            break;
          case 'bot_executor_webhook_url':
            ensureRule('legacy').webhookUrl = value;
            break;
          case 'bot_executor_project_key':
            ensureRule('legacy').projectKey = value;
            break;
          case 'bot_executor_jira_url':
            ensureRule('legacy').jiraUrl = value;
            break;
          case 'bot_executor_created_at':
            ensureRule('legacy').createdAt = value;
            break;
          case 'bot_executor_rule_version':
            ensureRule('legacy').ruleVersion = value;
            break;
          case 'bot_executor_rule_last_updated':
            ensureRule('legacy').ruleLastUpdated = value;
            break;
          case 'bot_automation_executor_rule_id':
            ensureRule('executorRule').ruleId = value;
            break;
          case 'bot_automation_executor_rule_name':
            ensureRule('executorRule').ruleName = value;
            break;
          case 'bot_automation_executor_webhook_url':
            ensureRule('executorRule').webhookUrl = value;
            break;
          case 'bot_automation_executor_project_key':
            ensureRule('executorRule').projectKey = value;
            break;
          case 'bot_automation_executor_jira_url':
            ensureRule('executorRule').jiraUrl = value;
            break;
          case 'bot_automation_executor_created_at':
            ensureRule('executorRule').createdAt = value;
            break;
          case 'bot_automation_executor_rule_version':
            ensureRule('executorRule').ruleVersion = value;
            break;
          case 'bot_automation_executor_rule_last_updated':
            ensureRule('executorRule').ruleLastUpdated = value;
            break;
          case 'bot_automation_timeline_sync_rule_id':
            ensureRule('timelineSyncRule').ruleId = value;
            break;
          case 'bot_automation_timeline_sync_rule_name':
            ensureRule('timelineSyncRule').ruleName = value;
            break;
          case 'bot_automation_timeline_sync_webhook_url':
            ensureRule('timelineSyncRule').webhookUrl = value;
            break;
          case 'bot_automation_timeline_sync_project_key':
            ensureRule('timelineSyncRule').projectKey = value;
            break;
          case 'bot_automation_timeline_sync_jira_url':
            ensureRule('timelineSyncRule').jiraUrl = value;
            break;
          case 'bot_automation_timeline_sync_created_at':
            ensureRule('timelineSyncRule').createdAt = value;
            break;
          case 'bot_automation_timeline_sync_rule_version':
            ensureRule('timelineSyncRule').ruleVersion = value;
            break;
          case 'bot_automation_timeline_sync_rule_last_updated':
            ensureRule('timelineSyncRule').ruleLastUpdated = value;
            break;
        }
      }
      
      return normalizeSheetConfig(config);
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
      const normalizedConfig = normalizeSheetConfig(config);
      const configData: [string, string][] = [];
      
      // 基础配置
      if (normalizedConfig.minute_trigger_id) {
        configData.push(['minute_trigger_id', normalizedConfig.minute_trigger_id]);
      }
      if (normalizedConfig.daily_trigger_id) {
        configData.push(['daily_trigger_id', normalizedConfig.daily_trigger_id]);
      }
      if (normalizedConfig.webAppUrl) {
        configData.push(['web_app_url', normalizedConfig.webAppUrl]);
      }
      if (normalizedConfig.scriptId) {
        configData.push(['script_id', normalizedConfig.scriptId]);
      }
      if (normalizedConfig.sheet_version) {
        configData.push(['sheet_version', normalizedConfig.sheet_version]);
      }
      if (normalizedConfig.created_by) {
        configData.push(['created_by', normalizedConfig.created_by]);
      }
      if (normalizedConfig.created_at) {
        configData.push(['created_at', normalizedConfig.created_at]);
      }
      configData.push(['last_sync_time', new Date().toISOString()]);
      
      // Messages Sheet ID
      if (normalizedConfig.messagesSheetId !== undefined) {
        configData.push(['messages_sheet_id', normalizedConfig.messagesSheetId.toString()]);
      }
      
      // Logs Sheet ID
      if (normalizedConfig.logsSheetId !== undefined && normalizedConfig.logsSheetId !== null) {
        configData.push(['logs_sheet_id', normalizedConfig.logsSheetId.toString()]);
      }
      
      const botAutomation = getBotAutomationConfig(normalizedConfig);
      const pushRuleConfig = (prefix: string, rule?: BotAutomationRule) => {
        if (!rule?.ruleId) {
          return;
        }

        configData.push([`${prefix}_rule_id`, rule.ruleId]);
        configData.push([`${prefix}_rule_name`, rule.ruleName]);
        configData.push([`${prefix}_webhook_url`, rule.webhookUrl]);
        configData.push([`${prefix}_project_key`, rule.projectKey]);
        configData.push([`${prefix}_jira_url`, rule.jiraUrl]);
        configData.push([`${prefix}_created_at`, rule.createdAt]);

        if (rule.ruleVersion) {
          configData.push([`${prefix}_rule_version`, rule.ruleVersion]);
        }
        if (rule.ruleLastUpdated) {
          configData.push([`${prefix}_rule_last_updated`, rule.ruleLastUpdated]);
        }
      };

      // 旧字段镜像 executor rule，保证兼容老版本配置读取
      pushRuleConfig('bot_executor', botAutomation.executorRule);
      pushRuleConfig('bot_automation_executor', botAutomation.executorRule);
      pushRuleConfig('bot_automation_timeline_sync', botAutomation.timelineSyncRule);
      
      const paddedConfigData = [...configData];
      while (paddedConfigData.length < 49) {
        paddedConfigData.push(['', '']);
      }
      
      // 更新 Sheet Config 表
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${normalizedConfig.sheetId}/values/Config!A2:B50?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: paddedConfigData
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
    await chrome.storage.local.set({ scheduledMessagesConfig: normalizeSheetConfig(config) });
    console.log('✅ 配置已保存到 Chrome Storage');
  }
  
  /**
   * 从 Chrome Storage 读取配置
   */
  async readConfigFromStorage(): Promise<SheetConfig | null> {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    return result.scheduledMessagesConfig ? normalizeSheetConfig(result.scheduledMessagesConfig) : null;
  }
  
  /**
   * 同步配置：同时保存到 Sheet 和 Chrome Storage
   */
  async syncConfig(config: SheetConfig): Promise<void> {
    // 更新 last_sync_time
    const normalizedConfig = normalizeSheetConfig(config);
    normalizedConfig.last_sync_time = new Date().toISOString();
    
    // 同时保存到两个位置
    await Promise.all([
      this.saveConfigToSheet(normalizedConfig),
      this.saveConfigToStorage(normalizedConfig)
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
