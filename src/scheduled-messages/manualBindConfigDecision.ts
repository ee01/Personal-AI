import type { SheetConfig } from './types.js';
import { compareConfigSyncFreshness } from './configSyncFreshness.js';
import { getBotAutomationConfig } from './botAutomationConfig.js';

export type ManualBindDecisionKind = 'local-newer' | 'different-sheet';
export type ManualBindWriteMode = 'sync' | 'storage';

export interface ManualBindDecision {
  kind: ManualBindDecisionKind;
  localConfig: SheetConfig;
  sheetConfig: SheetConfig;
  canonicalSheetUrl: string;
  writeMode: ManualBindWriteMode;
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

  if (compareConfigSyncFreshness(localConfig, sheetConfig) === 'local-newer') {
    return {
      kind: 'local-newer',
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
