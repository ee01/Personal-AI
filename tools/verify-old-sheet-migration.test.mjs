import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { executionHarness } from './helpers/appscript-execution-harness.mjs';

function fixture(properties = {}, options = {}) {
  const h = executionHarness({ properties, ...options });
  const c = h.context;
  const originalFetch = c.UrlFetchApp.fetch;
  c.UrlFetchApp.fetch = (url, options) => {
    assert.ok(url.startsWith('https://sheets.googleapis.com/'), 'helper must never call a delivery endpoint');
    return originalFetch(url, options);
  };
  c.ScriptApp.getScriptId = () => 'test-script';
  c.ScriptApp.getProjectTriggers = () => [];
  c.Session.getEffectiveUser = () => ({ getEmail: () => 'test@example.invalid' });
  vm.runInContext(readFileSync('tools/scheduled-messages-old-sheet-migration.gs', 'utf8'), c);
  c.OLD_SHEET_MIGRATION.spreadsheetId = 'test-book';
  return h;
}
function review(h) { h.context.OLD_SHEET_MIGRATION.backupsVerified = true; h.context.OLD_SHEET_MIGRATION.oldWritersRetired = true; }
const source = i => JSON.stringify({ executionKey: 'ek_old_' + i, messageId: 'M1', rowIndex: 2, success: true, markedAt: '2026-10-23T08:00:00Z' });

test('read-only diagnosis works before ledger initialization and reveals exact missing tabs', () => {
  const h = fixture(); const result = h.context.oldSheetMigration01Diagnose();
  assert.deepEqual([...result.missingLedgerSheets], ['_ExecutionMarks', '_ExecutionMarkControl']);
  assert.equal(h.events.filter(e => e.phase).length, 0); assert.equal(h.cell('Exec_Count'), '0');
});
test('wrong spreadsheet and unverified prerequisites block before any write', () => {
  const h = fixture(); assert.throws(() => h.context.oldSheetMigration02Copy(), /REVIEW_REQUIRED/);
  h.context.OLD_SHEET_MIGRATION.spreadsheetId = 'another-book';
  assert.throws(() => h.context.oldSheetMigration01Diagnose(), /WRONG_SPREADSHEET/);
  assert.equal(h.events.filter(e => e.phase).length, 0);
});
test('initialization and resumable migration work with quota-full Properties; do not activate or modify Messages', () => {
  const props = Object.fromEntries(Array.from({ length: 105 }, (_, i) => ['BOT_CLAIM_MARK_ek_old_' + i, source(i)]));
  const h = fixture(props); review(h); h.context.OLD_SHEET_MIGRATION.maxBatchesPerRun = 1;
  const before = structuredClone(h.table('Messages').rows);
  assert.equal(h.context.oldSheetMigration02Copy().complete, false);
  const result = h.context.oldSheetMigration02Copy(); assert.equal(result.complete, true);
  assert.equal(result.progress.total, 105); assert.equal(h.records().length, 105);
  assert.equal(result.status.control.mode, 'legacy_drain'); assert.equal(h.properties.size, 105);
  assert.deepEqual(h.table('Messages').rows, before);
  assert.throws(() => h.context.oldSheetMigration03Activate(), /VALIDATION_REQUIRED/);
});
test('activation passes options only after reviewed completion; repeated activation does not change epoch', () => {
  const h = fixture(); review(h); h.context.oldSheetMigration02Copy();
  h.context.OLD_SHEET_MIGRATION.isolatedValidationPassed = true;
  assert.equal(h.context.oldSheetMigration03Activate().mode, 'sheet_primary');
  const epoch = h.context.readExecutionStore().control.epoch;
  assert.equal(h.context.oldSheetMigration03Activate().alreadyActive, true);
  assert.equal(h.context.readExecutionStore().control.epoch, epoch);
  assert.throws(() => h.context.oldSheetMigration02Copy(), /ALREADY_ACTIVE/);
});
test('storage failure logs the failing initialize stage; no automatic recovery or source deletion', () => {
  const h = fixture(); review(h); h.fail({ phase: 'commit', code: 403 });
  assert.throws(() => h.context.oldSheetMigration02Copy(), /403/);
  assert.ok(h.events.some(e => typeof e === 'string' && e.includes('02B_INITIALIZE') && e.includes('STOP')));
  assert.equal(h.table('_ExecutionMarks'), undefined);
});
test('unresolved prepared operations stay frozen and orphan pending cannot activate', () => {
  const h = fixture(); review(h); h.context.oldSheetMigration02Copy();
  h.fail({ phase: 'commit', code: 403 }); assert.throws(() => h.context.maintenanceMigrateExecutionMarks(), /403/);
  assert.match(h.context.oldSheetMigration01Diagnose().storeReadError, /unknown_commit/);
  assert.throws(() => h.context.oldSheetMigration02Copy(), /unknown_commit/);
  const k = fixture(); review(k); k.context.oldSheetMigration02Copy(); k.setCell('Exec_Log', '⏳ API 已领取待确认');
  k.context.OLD_SHEET_MIGRATION.isolatedValidationPassed = true;
  assert.throws(() => k.context.oldSheetMigration03Activate(), /ORPHAN_PENDING/);
});


test('mark backup is explicit, excludes config, and never emits formula-bearing raw values', () => {
  const h = fixture({ BOT_CLAIM_MARK_ek_old_1: source(1), TIMELINE_CACHE_private: 'keep', SECRET: 'do not copy' });
  assert.throws(() => h.context.oldSheetMigration00BackupMarks(), /STOP_OLD_WRITERS/);
  h.context.OLD_SHEET_MIGRATION.oldWritersRetired = true;
  let written;
  h.context.Utilities.base64Encode = value => Buffer.from(value).toString('base64');
  h.context.SpreadsheetApp.flush = () => {};
  h.context.SpreadsheetApp.create = () => ({
    getUrl: () => 'https://docs.google.com/spreadsheets/d/backup-test',
    getSheets: () => [{ getMaxRows: () => 1000, getRange: () => ({ setValues: rows => { written = rows; } }) }],
  });
  const result = h.context.oldSheetMigration00BackupMarks();
  assert.equal(result.records, 1); assert.equal(written.length, 2);
  assert.equal(Buffer.from(written[1][1], 'base64').toString(), source(1));
  assert.equal(h.properties.get('SECRET'), 'do not copy');
  assert.equal(h.properties.size, 3);
});


test('old-sheet Copy initializes and imports 32 properties despite stale SpreadsheetApp metadata', () => {
  const properties = Object.fromEntries(Array.from({ length: 32 }, (_, i) => ['BOT_CLAIM_MARK_ek_old_' + i, source(i)]));
  const h = fixture(properties, { staleSheetMetadata: true }); review(h);
  const result = h.context.oldSheetMigration02Copy();
  assert.equal(result.complete, true); assert.equal(result.progress.copied, 32); assert.equal(result.progress.total, 32);
  assert.equal(result.status.control.mode, 'legacy_drain'); assert.equal(h.properties.size, 32);
  const before = JSON.stringify(h.table('_ExecutionMarks').rows);
  h.context.oldSheetMigration02Copy();
  assert.equal(JSON.stringify(h.table('_ExecutionMarks').rows), before);
  assert.equal(h.context.readExecutionStore().control.cursor, 32);
});
