import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const updaterSource = readFileSync('src/scheduled-messages/JiraRuleUpdater.ts', 'utf8');
const managerSource = readFileSync('src/scheduled-messages/ScheduledMessagesManager.tsx', 'utf8');
const configSyncSource = readFileSync('src/scheduled-messages/ConfigSyncService.ts', 'utf8');
const featureDoc = readFileSync('docs/features/scheduled_messages_manager.md', 'utf8');

assert.ok(
  updaterSource.includes('export interface JiraRuleUpdateOptions'),
  'JiraRuleUpdater should expose update persistence options',
);
assert.ok(
  updaterSource.includes('saveConfigToStorage?: boolean'),
  'JiraRuleUpdater should allow callers to suppress intermediate storage writes',
);
assert.ok(
  updaterSource.includes('syncConfigToSheet?: boolean'),
  'JiraRuleUpdater should allow callers to suppress intermediate Sheet writes',
);
assert.ok(
  updaterSource.includes('updatedConfig?: SheetConfig'),
  'JiraRuleUpdater should return the updated config metadata to callers',
);
assert.ok(
  updaterSource.includes('async updateJiraRule(options: JiraRuleUpdateOptions = {})'),
  'updateJiraRule should accept persistence options',
);
assert.ok(
  updaterSource.includes('const shouldSaveConfigToStorage = options.saveConfigToStorage ?? true'),
  'JiraRuleUpdater should keep storage persistence enabled by default',
);
assert.ok(
  updaterSource.includes('const shouldSyncConfigToSheet = options.syncConfigToSheet ?? true'),
  'JiraRuleUpdater should keep Sheet persistence enabled by default',
);
assert.ok(
  updaterSource.includes('updatedConfig: this.config ? normalizeSheetConfig(this.config) : undefined'),
  'JiraRuleUpdater should return normalized updated config on success',
);

const botConfigUpdateCall = managerSource.indexOf('new JiraRuleUpdater(updatedConfig).updateJiraRule({');
assert.ok(botConfigUpdateCall >= 0, 'Bot config flow should call JiraRuleUpdater with explicit options');
const disabledStorageIndex = managerSource.indexOf('saveConfigToStorage: false', botConfigUpdateCall);
const disabledSheetIndex = managerSource.indexOf('syncConfigToSheet: false', botConfigUpdateCall);
assert.ok(disabledStorageIndex > botConfigUpdateCall, 'Bot config flow should suppress intermediate storage writes');
assert.ok(disabledSheetIndex > botConfigUpdateCall, 'Bot config flow should suppress intermediate Sheet writes');
assert.ok(
  managerSource.includes('if (updateResult.updatedConfig)'),
  'Bot config flow should consume updater-returned config metadata',
);
assert.ok(
  managerSource.includes('updatedConfig = updateResult.updatedConfig;'),
  'Bot config flow should replace its final sync input with updater-returned metadata',
);
assert.ok(
  managerSource.includes('const syncedConfig = await syncService.syncConfig(updatedConfig, { syncAction: \'bot_config_update\' });'),
  'Bot config flow should perform one final Sheet-first bot_config_update sync',
);
assert.ok(
  managerSource.includes('onSuccess(syncedConfig);'),
  'Bot config UI should use the config returned by final sync',
);
assert.ok(
  featureDoc.includes('中途不会提前写 Sheet 或本机缓存'),
  'Feature doc should document the no-intermediate-write Bot/Jira rule config boundary',
);
assert.ok(
  configSyncSource.includes('BOT_RULE_WRITE_PREFIXES'),
  'ConfigSyncService should separate write prefixes from managed cleanup prefixes',
);
assert.ok(
  configSyncSource.includes('BOT_RULE_MANAGED_PREFIXES'),
  'ConfigSyncService should keep legacy bot_executor keys managed for cleanup',
);
assert.equal(
  configSyncSource.includes("pushRuleConfig('bot_executor'"),
  false,
  'ConfigSyncService should not write legacy bot_executor_* rows',
);
assert.ok(
  featureDoc.includes('旧版 `bot_executor_*` 配置键不再写入 Sheet 或本机缓存'),
  'Feature doc should document removal of legacy bot_executor persistence',
);

console.log('✅ Scheduled Messages Jira rule sync regression checks passed');
