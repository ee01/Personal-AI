/**
 * 配置同步服务
 * 负责在 Chrome Storage 和 Sheet Config 表之间同步配置
 */

import { BotAutomationRule, RingCentralSenderConfig, SheetConfig } from './types.js';
import {
  getBotAutomationConfig,
  normalizeRingCentralSenderConfig,
  normalizeSheetConfig,
} from './botAutomationConfig.js';

type ConfigRow = [string, string];
type SheetMetadata = {
  properties?: {
    sheetId?: number;
    title?: string;
    index?: number;
  };
};

const CONFIG_MIN_ROW_COUNT = 56;
const CONFIG_SHEET_TITLE = 'Config';
const CONFIG_READ_RANGE = `${CONFIG_SHEET_TITLE}!A2:B`;
const CONFIG_HEADER_RANGE = `${CONFIG_SHEET_TITLE}!A1:B1`;

const CONFIG_BASE_KEYS = [
  'minute_trigger_id',
  'daily_trigger_id',
  'web_app_url',
  'script_id',
  'deployment_id',
  'sheet_version',
  'app_script_version',
  'app_script_last_updated',
  'created_by',
  'created_at',
  'last_sync_time',
  'messages_sheet_id',
  'logs_sheet_id',
  // 旧代码曾读取这些 camelCase alias；写回时统一清理为 snake_case，避免后续读取被旧值覆盖。
  'deploymentId',
  'appScriptVersion',
  'appScriptLastUpdated',
];

const BOT_RULE_PREFIXES = [
  'bot_executor',
  'bot_automation_executor',
  'bot_automation_timeline_sync',
];

const BOT_RULE_SUFFIXES = [
  'rule_id',
  'rule_name',
  'webhook_url',
  'project_key',
  'jira_url',
  'created_at',
  'rule_version',
  'rule_last_updated',
];

const RINGCENTRAL_SENDER_KEYS = [
  'ringcentral_sender_enabled',
  'ringcentral_sender_client_id',
  'ringcentral_sender_client_secret',
  'ringcentral_sender_jwt',
  'ringcentral_sender_updated_at',
];

const MANAGED_CONFIG_KEYS = new Set<string>(CONFIG_BASE_KEYS);
for (const prefix of BOT_RULE_PREFIXES) {
  for (const suffix of BOT_RULE_SUFFIXES) {
    MANAGED_CONFIG_KEYS.add(`${prefix}_${suffix}`);
  }
}
for (const key of RINGCENTRAL_SENDER_KEYS) {
  MANAGED_CONFIG_KEYS.add(key);
}

function getManagedConfigKeysForWrite(includeRingCentralSenderKeys: boolean): Set<string> {
  if (includeRingCentralSenderKeys) {
    return MANAGED_CONFIG_KEYS;
  }

  const managedKeys = new Set(MANAGED_CONFIG_KEYS);
  for (const key of RINGCENTRAL_SENDER_KEYS) {
    managedKeys.delete(key);
  }
  return managedKeys;
}

function buildConfigRange(rowCount = CONFIG_MIN_ROW_COUNT): string {
  return `${CONFIG_SHEET_TITLE}!A2:B${rowCount + 1}`;
}

function parseSheetGridId(value: string): number | undefined {
  const trimmedValue = value.trim();
  if (!/^\d+$/.test(trimmedValue)) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isSafeInteger(parsedValue) ? parsedValue : undefined;
}

function parseConfigTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isSheetConfigNewer(sheetConfig: Partial<SheetConfig>, localConfig: Partial<SheetConfig>): boolean {
  const sheetTimestamp = parseConfigTimestamp(sheetConfig.last_sync_time);
  const localTimestamp = parseConfigTimestamp(localConfig.last_sync_time);

  if (sheetTimestamp === null) {
    return false;
  }

  return localTimestamp === null || sheetTimestamp > localTimestamp;
}

function hasRule(rule?: Partial<BotAutomationRule>): boolean {
  return Boolean(rule?.ruleId);
}

function mergeRule(
  baseRule?: BotAutomationRule,
  updateRule?: Partial<BotAutomationRule>
): BotAutomationRule | undefined {
  if (!updateRule) {
    return baseRule ? { ...baseRule } : undefined;
  }

  return {
    ...(baseRule || {}),
    ...updateRule,
  } as BotAutomationRule;
}

function parseConfigBoolean(value: string): boolean {
  return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

export class ConfigSyncService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  static isMissingConfigSheetError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes('Unable to parse range') && message.includes(CONFIG_SHEET_TITLE);
  }

  /**
   * 从 Sheet Config 表读取配置
   */
  async readConfigFromSheet(sheetId: string): Promise<Partial<SheetConfig>> {
    try {
      const rows = await this.readRawConfigRows(sheetId);

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

      const ensureRingCentralSender = (): RingCentralSenderConfig => {
        if (!config.ringCentralSender) {
          config.ringCentralSender = { enabled: false };
        }
        return config.ringCentralSender;
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
          case 'deployment_id':
          case 'deploymentId':
            config.deploymentId = value;
            break;
          case 'sheet_version':
            config.sheet_version = value;
            break;
          case 'app_script_version':
          case 'appScriptVersion':
            config.appScriptVersion = value;
            break;
          case 'app_script_last_updated':
          case 'appScriptLastUpdated':
            config.appScriptLastUpdated = value;
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
          case 'messages_sheet_id': {
            const messagesSheetId = parseSheetGridId(value);
            if (messagesSheetId !== undefined) {
              config.messagesSheetId = messagesSheetId;
            } else {
              console.warn(`忽略无效的 messages_sheet_id: ${value}`);
            }
            break;
          }
          case 'logs_sheet_id': {
            const logsSheetId = parseSheetGridId(value);
            if (logsSheetId !== undefined) {
              config.logsSheetId = logsSheetId;
            } else {
              console.warn(`忽略无效的 logs_sheet_id: ${value}`);
            }
            break;
          }
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
          case 'ringcentral_sender_enabled':
            ensureRingCentralSender().enabled = parseConfigBoolean(value);
            break;
          case 'ringcentral_sender_client_id':
            ensureRingCentralSender().clientId = value;
            break;
          case 'ringcentral_sender_client_secret':
            ensureRingCentralSender().clientSecret = value;
            break;
          case 'ringcentral_sender_jwt':
            ensureRingCentralSender().jwt = value;
            break;
          case 'ringcentral_sender_updated_at':
            ensureRingCentralSender().updatedAt = value;
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
  async saveConfigToSheet(
    config: SheetConfig,
    lastSyncTime?: string,
    options?: { includeRingCentralSenderKeys?: boolean }
  ): Promise<void> {
    try {
      const includeRingCentralSenderKeys = options?.includeRingCentralSenderKeys ??
        config.ringCentralSender !== undefined;
      const normalizedConfig = normalizeSheetConfig({
        ...config,
        last_sync_time: lastSyncTime || new Date().toISOString(),
      }) as SheetConfig;
      const configData = this.buildManagedConfigRows(normalizedConfig, {
        includeRingCentralSenderKeys,
      });
      const existingRows = await this.readRawConfigRowsForWrite(normalizedConfig.sheetId);
      const managedKeysForWrite = getManagedConfigKeysForWrite(includeRingCentralSenderKeys);
      const mergedConfigData = this.mergeConfigRows(existingRows, configData, managedKeysForWrite);
      const rowCount = Math.max(CONFIG_MIN_ROW_COUNT, existingRows.length, mergedConfigData.length);
      const paddedConfigData = [...mergedConfigData];
      while (paddedConfigData.length < rowCount) {
        paddedConfigData.push(['', '']);
      }

      // 更新 Sheet Config 表
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${normalizedConfig.sheetId}/values/${buildConfigRange(rowCount)}?valueInputOption=RAW`,
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
    const lastSyncTime = new Date().toISOString();
    const includeRingCentralSenderKeys = config.ringCentralSender !== undefined;
    const normalizedConfig = normalizeSheetConfig({
      ...config,
      last_sync_time: lastSyncTime,
    }) as SheetConfig;

    // Sheet 是跨设备恢复来源，先写入成功后再更新本地，避免失败时留下半同步状态。
    await this.saveConfigToSheet(normalizedConfig, lastSyncTime, {
      includeRingCentralSenderKeys,
    });
    await this.saveConfigToStorage(normalizedConfig);

    console.log('✅ 配置已同步到 Sheet 和 Chrome Storage');
  }

  async ensureConfigSheet(sheetId: string): Promise<void> {
    const sheets = await this.readSpreadsheetSheets(sheetId);
    const hasConfigSheet = sheets.some(sheet => sheet.properties?.title === CONFIG_SHEET_TITLE);

    if (!hasConfigSheet) {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: CONFIG_SHEET_TITLE,
                    gridProperties: {
                      rowCount: CONFIG_MIN_ROW_COUNT + 1,
                      columnCount: 2,
                      frozenRowCount: 1,
                    },
                  },
                },
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`创建 Config 工作表失败: ${response.status} ${errorText}`);
      }
    }

    await this.writeConfigHeader(sheetId);
  }

  async getScheduledMessagesWorksheetIds(sheetId: string): Promise<{
    messagesSheetId?: number;
    logsSheetId?: number;
    configSheetId?: number;
  }> {
    const sheets = await this.readSpreadsheetSheets(sheetId);
    const getSheetIdByTitle = (title: string) =>
      sheets.find(sheet => sheet.properties?.title === title)?.properties?.sheetId;

    return {
      messagesSheetId: getSheetIdByTitle('Messages'),
      logsSheetId: getSheetIdByTitle('Logs'),
      configSheetId: getSheetIdByTitle(CONFIG_SHEET_TITLE),
    };
  }

  async recoverScheduledMessagesWorksheetIds<T extends Partial<SheetConfig>>(
    sheetId: string,
    config: T
  ): Promise<T & Partial<SheetConfig>> {
    const needsMessagesSheetId = config.messagesSheetId === undefined || config.messagesSheetId === null;
    const needsLogsSheetId = config.logsSheetId === undefined || config.logsSheetId === null;

    if (!needsMessagesSheetId && !needsLogsSheetId) {
      return normalizeSheetConfig(config);
    }

    const worksheetIds = await this.getScheduledMessagesWorksheetIds(sheetId);
    const recoveredConfig: Partial<SheetConfig> = { ...config };

    if (needsMessagesSheetId && worksheetIds.messagesSheetId !== undefined) {
      recoveredConfig.messagesSheetId = worksheetIds.messagesSheetId;
    }

    if (needsLogsSheetId && worksheetIds.logsSheetId !== undefined) {
      recoveredConfig.logsSheetId = worksheetIds.logsSheetId;
    }

    return normalizeSheetConfig(recoveredConfig as T);
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

    const baseConfig = await this.readLatestConfigBase(existingConfig);
    const existingBotAutomation = getBotAutomationConfig(baseConfig);
    const updateBotAutomation = getBotAutomationConfig(updates);
    const hasBotAutomationUpdate = Boolean(updates.botAutomation || updates.botExecutor);

    const updatedConfig: SheetConfig = {
      ...baseConfig,
      ...updates,
      ...(hasBotAutomationUpdate ? {
        botAutomation: {
          executorRule: mergeRule(existingBotAutomation.executorRule, updateBotAutomation.executorRule),
          timelineSyncRule: mergeRule(existingBotAutomation.timelineSyncRule, updateBotAutomation.timelineSyncRule),
        },
      } : {}),
      last_sync_time: new Date().toISOString()
    };

    // 同步到两个位置
    const normalizedConfig = normalizeSheetConfig(updatedConfig) as SheetConfig;
    await this.syncConfig(normalizedConfig);

    return normalizedConfig;
  }

  private async readLatestConfigBase(existingConfig: SheetConfig): Promise<SheetConfig> {
    try {
      const sheetConfig = await this.readConfigFromSheet(existingConfig.sheetId);
      if (!sheetConfig.sheet_version || !isSheetConfigNewer(sheetConfig, existingConfig)) {
        return existingConfig;
      }

      const sheetBotAutomation = getBotAutomationConfig(sheetConfig);
      const localBotAutomation = getBotAutomationConfig(existingConfig);

      return normalizeSheetConfig({
        ...existingConfig,
        ...sheetConfig,
        botAutomation: {
          executorRule: hasRule(sheetBotAutomation.executorRule)
            ? sheetBotAutomation.executorRule
            : localBotAutomation.executorRule,
          timelineSyncRule: hasRule(sheetBotAutomation.timelineSyncRule)
            ? sheetBotAutomation.timelineSyncRule
            : localBotAutomation.timelineSyncRule,
        },
      }) as SheetConfig;
    } catch (error) {
      console.warn('读取 Sheet 最新配置失败，使用本地配置继续部分更新:', error);
      return existingConfig;
    }
  }

  private async readRawConfigRows(sheetId: string): Promise<ConfigRow[]> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CONFIG_READ_RANGE}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`读取 Sheet 配置失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    return rows.map((row: unknown[]) => [
      row[0] === undefined || row[0] === null ? '' : String(row[0]),
      row[1] === undefined || row[1] === null ? '' : String(row[1]),
    ]);
  }

  private async readRawConfigRowsForWrite(sheetId: string): Promise<ConfigRow[]> {
    try {
      return await this.readRawConfigRows(sheetId);
    } catch (error) {
      if (!ConfigSyncService.isMissingConfigSheetError(error)) {
        throw error;
      }

      console.warn('Config 工作表不存在，正在自动创建:', error);
      await this.ensureConfigSheet(sheetId);
      return this.readRawConfigRows(sheetId);
    }
  }

  private async readSpreadsheetSheets(sheetId: string): Promise<SheetMetadata[]> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title,index)`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`读取 Sheet 工作表列表失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return Array.isArray(data.sheets) ? data.sheets : [];
  }

  private async writeConfigHeader(sheetId: string): Promise<void> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CONFIG_HEADER_RANGE}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['Key', 'Value']],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`写入 Config 表头失败: ${response.status} ${errorText}`);
    }
  }

  private buildManagedConfigRows(
    normalizedConfig: SheetConfig,
    options: { includeRingCentralSenderKeys: boolean }
  ): ConfigRow[] {
    const configData: ConfigRow[] = [];

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
    if (normalizedConfig.deploymentId) {
      configData.push(['deployment_id', normalizedConfig.deploymentId]);
    }
    if (normalizedConfig.sheet_version) {
      configData.push(['sheet_version', normalizedConfig.sheet_version]);
    }
    if (normalizedConfig.appScriptVersion) {
      configData.push(['app_script_version', normalizedConfig.appScriptVersion]);
    }
    if (normalizedConfig.appScriptLastUpdated) {
      configData.push(['app_script_last_updated', normalizedConfig.appScriptLastUpdated]);
    }
    if (normalizedConfig.created_by) {
      configData.push(['created_by', normalizedConfig.created_by]);
    }
    if (normalizedConfig.created_at) {
      configData.push(['created_at', normalizedConfig.created_at]);
    }
    if (normalizedConfig.last_sync_time) {
      configData.push(['last_sync_time', normalizedConfig.last_sync_time]);
    }

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

      const pushRuleField = (suffix: string, value: unknown) => {
        if (value === undefined || value === null) {
          return;
        }

        const stringValue = String(value).trim();
        if (!stringValue) {
          return;
        }

        configData.push([`${prefix}_${suffix}`, stringValue]);
      }

      pushRuleField('rule_id', rule.ruleId);
      pushRuleField('rule_name', rule.ruleName);
      pushRuleField('webhook_url', rule.webhookUrl);
      pushRuleField('project_key', rule.projectKey);
      pushRuleField('jira_url', rule.jiraUrl);
      pushRuleField('created_at', rule.createdAt);
      pushRuleField('rule_version', rule.ruleVersion);
      pushRuleField('rule_last_updated', rule.ruleLastUpdated);
    };

    // 旧字段镜像 executor rule，保证兼容老版本配置读取
    pushRuleConfig('bot_executor', botAutomation.executorRule);
    pushRuleConfig('bot_automation_executor', botAutomation.executorRule);
    pushRuleConfig('bot_automation_timeline_sync', botAutomation.timelineSyncRule);

    const ringCentralSender = normalizeRingCentralSenderConfig(normalizedConfig.ringCentralSender);
    if (options.includeRingCentralSenderKeys) {
      configData.push(['ringcentral_sender_enabled', ringCentralSender?.enabled ? 'true' : 'false']);
      if (ringCentralSender?.clientId) {
        configData.push(['ringcentral_sender_client_id', ringCentralSender.clientId]);
      }
      if (ringCentralSender?.clientSecret) {
        configData.push(['ringcentral_sender_client_secret', ringCentralSender.clientSecret]);
      }
      if (ringCentralSender?.jwt) {
        configData.push(['ringcentral_sender_jwt', ringCentralSender.jwt]);
      }
      if (ringCentralSender?.updatedAt) {
        configData.push(['ringcentral_sender_updated_at', ringCentralSender.updatedAt]);
      }
    }

    return configData;
  }

  private mergeConfigRows(
    existingRows: ConfigRow[],
    managedRows: ConfigRow[],
    managedKeys: Set<string>
  ): ConfigRow[] {
    const managedByKey = new Map(managedRows);
    const writtenKeys = new Set<string>();
    const mergedRows: ConfigRow[] = [];

    for (const row of existingRows) {
      const key = row[0]?.trim();
      if (!key) {
        continue;
      }

      if (managedKeys.has(key)) {
        if (managedByKey.has(key)) {
          mergedRows.push([key, managedByKey.get(key)!]);
          writtenKeys.add(key);
        }
        continue;
      }

      mergedRows.push(row);
    }

    for (const [key, value] of managedRows) {
      if (!writtenKeys.has(key)) {
        mergedRows.push([key, value]);
      }
    }

    return mergedRows;
  }
}
