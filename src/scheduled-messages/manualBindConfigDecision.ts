import type { SheetConfig } from './types.js';
import { compareConfigSyncFreshness } from './configSyncFreshness.js';
import { getBotAutomationConfig } from './botAutomationConfig.js';

export type ManualBindDecisionKind = 'local-newer' | 'different-sheet' | 'content-different';
export type ManualBindWriteMode = 'sync' | 'storage';

export interface ManualBindConfigDiffItem {
  label: string;
  localValue: string;
  sheetValue: string;
}

export interface ManualBindDecision {
  kind: ManualBindDecisionKind;
  localConfig: SheetConfig;
  sheetConfig: SheetConfig;
  canonicalSheetUrl: string;
  writeMode: ManualBindWriteMode;
}

function normalizeDiffValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value).trim();
}

function formatDiffValue(
  value: unknown,
  otherValue: unknown,
  options: { secret?: boolean; boolean?: boolean } = {},
): string {
  const normalizedValue = normalizeDiffValue(value);
  const normalizedOtherValue = normalizeDiffValue(otherValue);

  if (!normalizedValue) {
    return '未配置';
  }

  if (options.secret) {
    return normalizedOtherValue && normalizedOtherValue !== normalizedValue
      ? '已配置（值不同）'
      : '已配置';
  }

  if (options.boolean) {
    return normalizedValue === 'true' ? '启用' : '未启用';
  }

  if (normalizedValue.length <= 64) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 30)}...${normalizedValue.slice(-18)}`;
}

function addDiffItem(
  items: ManualBindConfigDiffItem[],
  label: string,
  localValue: unknown,
  sheetValue: unknown,
  options: { secret?: boolean; boolean?: boolean } = {},
): void {
  const normalizedLocalValue = normalizeDiffValue(localValue);
  const normalizedSheetValue = normalizeDiffValue(sheetValue);

  if (normalizedLocalValue === normalizedSheetValue) {
    return;
  }

  items.push({
    label,
    localValue: formatDiffValue(localValue, sheetValue, options),
    sheetValue: formatDiffValue(sheetValue, localValue, options),
  });
}

export function getManualBindConfigDiff(
  localConfig?: Partial<SheetConfig> | null,
  sheetConfig?: Partial<SheetConfig> | null,
): ManualBindConfigDiffItem[] {
  if (!localConfig || !sheetConfig) {
    return [];
  }

  const items: ManualBindConfigDiffItem[] = [];
  const localBotAutomation = getBotAutomationConfig(localConfig);
  const sheetBotAutomation = getBotAutomationConfig(sheetConfig);

  addDiffItem(items, 'Schema 版本', localConfig.sheet_version, sheetConfig.sheet_version);
  addDiffItem(items, 'Web App URL', localConfig.webAppUrl, sheetConfig.webAppUrl);
  addDiffItem(items, 'Apps Script ID', localConfig.scriptId, sheetConfig.scriptId);
  addDiffItem(items, 'Deployment ID', localConfig.deploymentId, sheetConfig.deploymentId);
  addDiffItem(items, 'Apps Script 版本', localConfig.appScriptVersion, sheetConfig.appScriptVersion);
  addDiffItem(items, '分钟触发器', localConfig.minute_trigger_id, sheetConfig.minute_trigger_id);
  addDiffItem(items, '每日触发器', localConfig.daily_trigger_id, sheetConfig.daily_trigger_id);
  addDiffItem(items, 'Messages 子表 ID', localConfig.messagesSheetId, sheetConfig.messagesSheetId);
  addDiffItem(items, 'Logs 子表 ID', localConfig.logsSheetId, sheetConfig.logsSheetId);

  addDiffItem(
    items,
    'Bot 执行规则 ID',
    localBotAutomation.executorRule?.ruleId,
    sheetBotAutomation.executorRule?.ruleId,
  );
  addDiffItem(
    items,
    'Bot 执行规则名称',
    localBotAutomation.executorRule?.ruleName,
    sheetBotAutomation.executorRule?.ruleName,
  );
  addDiffItem(
    items,
    'Bot 执行项目',
    localBotAutomation.executorRule?.projectKey,
    sheetBotAutomation.executorRule?.projectKey,
  );
  addDiffItem(
    items,
    'Bot 执行 Webhook',
    localBotAutomation.executorRule?.webhookUrl,
    sheetBotAutomation.executorRule?.webhookUrl,
    { secret: true },
  );
  addDiffItem(
    items,
    'Bot 执行 Jira',
    localBotAutomation.executorRule?.jiraUrl,
    sheetBotAutomation.executorRule?.jiraUrl,
  );
  addDiffItem(
    items,
    'Bot 执行规则版本',
    localBotAutomation.executorRule?.ruleVersion,
    sheetBotAutomation.executorRule?.ruleVersion,
  );
  addDiffItem(
    items,
    'Timeline Sync Rule ID',
    localBotAutomation.timelineSyncRule?.ruleId,
    sheetBotAutomation.timelineSyncRule?.ruleId,
  );
  addDiffItem(
    items,
    'Timeline Sync Rule 名称',
    localBotAutomation.timelineSyncRule?.ruleName,
    sheetBotAutomation.timelineSyncRule?.ruleName,
  );
  addDiffItem(
    items,
    'Timeline Sync 项目',
    localBotAutomation.timelineSyncRule?.projectKey,
    sheetBotAutomation.timelineSyncRule?.projectKey,
  );
  addDiffItem(
    items,
    'Timeline Sync Webhook',
    localBotAutomation.timelineSyncRule?.webhookUrl,
    sheetBotAutomation.timelineSyncRule?.webhookUrl,
    { secret: true },
  );
  addDiffItem(
    items,
    'Timeline Sync Jira',
    localBotAutomation.timelineSyncRule?.jiraUrl,
    sheetBotAutomation.timelineSyncRule?.jiraUrl,
  );
  addDiffItem(
    items,
    'Timeline Sync Rule 版本',
    localBotAutomation.timelineSyncRule?.ruleVersion,
    sheetBotAutomation.timelineSyncRule?.ruleVersion,
  );

  addDiffItem(
    items,
    'RingCentral 发送',
    localConfig.ringCentralSender?.enabled,
    sheetConfig.ringCentralSender?.enabled,
    { boolean: true },
  );
  addDiffItem(
    items,
    'RingCentral Client ID',
    localConfig.ringCentralSender?.clientId,
    sheetConfig.ringCentralSender?.clientId,
  );
  addDiffItem(
    items,
    'RingCentral Client Secret',
    localConfig.ringCentralSender?.clientSecret,
    sheetConfig.ringCentralSender?.clientSecret,
    { secret: true },
  );
  addDiffItem(
    items,
    'RingCentral JWT',
    localConfig.ringCentralSender?.jwt,
    sheetConfig.ringCentralSender?.jwt,
    { secret: true },
  );

  return items;
}

export function getManualBindDecision(params: {
  localConfig?: SheetConfig | null;
  sheetConfig: SheetConfig;
  canonicalSheetUrl: string;
  writeMode: ManualBindWriteMode;
}): ManualBindDecision | null {
  const { localConfig, sheetConfig, canonicalSheetUrl, writeMode } = params;

  if (!localConfig?.sheetId || !sheetConfig.sheetId) {
    return null;
  }

  if (localConfig.sheetId !== sheetConfig.sheetId) {
    return {
      kind: 'different-sheet',
      localConfig,
      sheetConfig,
      canonicalSheetUrl,
      writeMode,
    };
  }

  const freshness = compareConfigSyncFreshness(localConfig, sheetConfig);
  if (freshness === 'local-newer') {
    return {
      kind: 'local-newer',
      localConfig,
      sheetConfig,
      canonicalSheetUrl,
      writeMode,
    };
  }

  if (freshness !== 'sheet-newer' && getManualBindConfigDiff(localConfig, sheetConfig).length > 0) {
    return {
      kind: 'content-different',
      localConfig,
      sheetConfig,
      canonicalSheetUrl,
      writeMode,
    };
  }

  return null;
}

export function getManualBindRestoreScope(config: Partial<SheetConfig>): string[] {
  const scope = ['维护表绑定'];

  if (config.webAppUrl || config.scriptId || config.deploymentId || config.appScriptVersion) {
    scope.push('Apps Script 与 Web App');
  }

  if (config.minute_trigger_id || config.daily_trigger_id) {
    scope.push('定时触发器');
  }

  const botAutomation = getBotAutomationConfig(config);
  if (botAutomation.executorRule?.ruleId || botAutomation.timelineSyncRule?.ruleId) {
    scope.push('Bot Automation 规则');
  }

  if (config.messagesSheetId !== undefined || config.logsSheetId !== undefined) {
    scope.push('Messages / Logs 子表定位');
  }

  if (config.ringCentralSender) {
    scope.push('RingCentral 发送配置');
  }

  return scope;
}
