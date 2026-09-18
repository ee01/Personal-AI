import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const managerSource = readFileSync('src/scheduled-messages/ScheduledMessagesManager.tsx', 'utf8');
const featureDoc = readFileSync('docs/features/scheduled_messages_manager.md', 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = managerSource.indexOf(startMarker);
  assert.ok(start >= 0, `Scheduled Messages manager should contain ${startMarker}`);
  const end = managerSource.indexOf(endMarker, start);
  assert.ok(end > start, `Scheduled Messages manager should contain ${endMarker} after ${startMarker}`);
  return managerSource.slice(start, end);
}

const headerSource = sliceBetween('<div style={styles.headerActions}>', '</header>');
const statusBarSource = sliceBetween('<div style={styles.statusBar}>', '<div style={styles.content}>');

// The page header keeps primary user actions only; maintenance actions must not
// re-occupy the top-right position that was reported as too prominent.
assert.ok(
  headerSource.includes('⏰ 提醒我') &&
    headerSource.includes('➕ 新增') &&
    headerSource.includes('📊 推送记录'),
  'Header should keep the primary add / reminder / logs actions',
);
assert.equal(
  headerSource.includes('🔄 同步'),
  false,
  'Manual Config sync should not sit in the page header primary actions',
);
assert.equal(
  headerSource.includes('🔎 检查脚本'),
  false,
  'Manual App Script check should not sit in the page header primary actions',
);

// Both maintenance actions stay reachable, grouped in the list utility bar.
assert.ok(
  statusBarSource.includes('statusMaintenanceLabel') && statusBarSource.includes('维护'),
  'List utility bar should group maintenance actions under an explicit 维护 label',
);
assert.ok(
  statusBarSource.includes('onClick={handleSync}') &&
    statusBarSource.includes('title={manualConfigSyncActionBoundary}') &&
    statusBarSource.includes('aria-label={manualConfigSyncActionBoundary}') &&
    statusBarSource.includes('disabled={isSyncingConfig}'),
  'Manual Config sync should keep its handler, boundary label and single-flight disabled state in the utility bar',
);
assert.ok(
  statusBarSource.includes('checkForUpdates({ interactive: true, showCurrentAlert: true })') &&
    statusBarSource.includes('title={appScriptCheckActionBoundary}') &&
    statusBarSource.includes('disabled={isCheckingUpdates || isUpdating}') &&
    statusBarSource.includes('!updateAvailable'),
  'Manual App Script check should keep its interactive handler, boundary label and disabled state in the utility bar',
);

// The reason the buttons are demoted: page load already runs both read-only paths.
assert.ok(
  managerSource.includes('checkForUpdates({ interactive: false })'),
  'Page load should still auto-check the App Script version non-interactively',
);
assert.ok(
  managerSource.includes('页面打开时已自动从 Sheet 刷新 Messages 列表，但不会读取 Sheet Config'),
  'Manual sync boundary should tell users the list already refreshes on page load but Sheet Config does not',
);
assert.ok(
  managerSource.includes('页面打开时已自动静默检查一次'),
  'Manual App Script check boundary should tell users the page load already performed a silent check',
);

assert.ok(
  featureDoc.includes('“同步”和“检查脚本”不再占用管理页头部主操作位'),
  'Feature doc should document why the two maintenance actions moved out of the header',
);
assert.ok(
  featureDoc.includes('页面打开本来就会从 Sheet 刷新 Messages 列表并静默检查一次 App Script 版本，但不会读取 Sheet Config'),
  'Feature doc should document the automatic page-load behavior behind the demoted buttons',
);

console.log('✅ Scheduled Messages maintenance action placement checks passed');
