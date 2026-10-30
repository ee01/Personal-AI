import test from 'node:test';
import assert from 'node:assert/strict';
import { executionHarness } from './helpers/appscript-execution-harness.mjs';

test('owner skips only old receipts without sends, success accounting, or schedule changes', () => {
  const h = executionHarness(); h.initialize(); h.activate(); h.claim('old');
  const oldLastExec = h.cell('Last_Exec'); const oldSchedule = h.cell('Schedule_Date');
  const oldNext = h.cell('Next_Exec');
  h.advance(3 * 24 * 60 * 60 * 1000);
  const options = { executionKeys: [h.records()[0].executionKey], beforeDate: '2026-10-26', noReplay: true, originalExecutionsStopped: true };
  h.context.FRESH_SETUP_TOKEN = 'owner-capability';
  assert.equal(h.context.handleFreshSetup({ ...options, operation: 'skipHistorical', token: 'owner-capability' }).skipped, 1);
  const record = h.records()[0];
  assert.equal(record.state, 'FAILED'); assert.equal(record.resolution.kind, 'owner_skipped');
  assert.equal(record.resolution.externalOutcome, 'unverified'); assert.equal(record.accountingVersion, 0);
  assert.equal(h.cell('Exec_Count'), '0'); assert.equal(h.cell('Last_Exec'), oldLastExec);
  assert.equal(h.cell('Schedule_Date'), oldSchedule); assert.equal(h.cell('Status'), 'Active');
  assert.equal(h.cell('Next_Exec'), oldNext);
  assert.equal(h.table('Logs').rows[1][h.table('Logs').rows[0].indexOf('Status')], 'Skipped');
  const logCount = h.table('Logs').rows.length;
  assert.equal(h.context.maintenanceSkipHistoricalExecutions(options).duplicates, 1);
  assert.equal(h.table('Logs').rows.length, logCount);
  assert.match(h.confirm('old', true).error, /owner_skipped/);
  assert.match(h.confirm('old', false).error, /owner_skipped/);
  const next = h.claim('next'); assert.equal(next.success, true); assert.equal(next.duplicate, false);
  assert.equal(h.records().length, 2);
});

test('historical skip validates all keys and requires explicit no-replay/stopped attestations', () => {
  const h = executionHarness(); h.initialize(); h.activate(); h.claim('old');
  const key = h.records()[0].executionKey;
  const options = { executionKeys: [key], beforeDate: '2026-10-23', noReplay: true, originalExecutionsStopped: true };
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions(options), /not_historical/);
  h.advance(3 * 24 * 60 * 60 * 1000); options.beforeDate = '2026-10-26';
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions({ ...options, noReplay: false }), /attestation/);
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions({ ...options, executionKeys: [key, 'absent'] }), /unknown_execution_key/);
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions({ ...options, executionKeys: [key, key] }), /invalid_execution_keys/);
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions({ ...options, beforeDate: '2027-01-01' }), /cutoff/);
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions({ ...options, beforeDate: '2026-02-30' }), /cutoff/);
  assert.equal(h.records()[0].state, 'CLAIMED'); assert.equal(h.cell('Exec_Count'), '0');
  assert.throws(() => h.context.handleFreshSetup({ ...options, operation: 'skipHistorical', token: 'invalid' }), /unauthorized/);
});

test('historical skip does not close a successful receipt and commits its audit atomically', () => {
  const h = executionHarness(); h.initialize(); h.activate(); h.claim('old'); h.confirm('old');
  const options = { executionKeys: [h.records()[0].executionKey], beforeDate: '2026-10-26', noReplay: true, originalExecutionsStopped: true };
  h.advance(3 * 24 * 60 * 60 * 1000);
  assert.throws(() => h.context.maintenanceSkipHistoricalExecutions(options), /already_settled/);
  const j = executionHarness(); j.initialize(); j.activate(); j.claim('old'); j.advance(3 * 24 * 60 * 60 * 1000);
  j.table('Logs').rows[0] = ['invalid'];
  assert.throws(() => j.context.maintenanceSkipHistoricalExecutions({ ...options, executionKeys: [j.records()[0].executionKey] }), /logs_schema/);
  assert.equal(j.records()[0].state, 'CLAIMED');
});
const hour = 3600000;
function ready(options) { const h = executionHarness(options); h.initialize(); h.activate(); return h; }
function legacy(key, success = true, markedAt = '2026-10-23T08:00:00Z') { key = key.startsWith('ek_') ? key : 'ek_' + key; return JSON.stringify({ executionKey: key, messageId: 'M1', rowIndex: 2, success, markedAt }); }

test('uninitialized claims fail closed, full Properties never need a write, no cache dependency', () => {
  const h = executionHarness(); assert.match(h.claim().error, /not_initialized/);
  h.initialize(); assert.match(h.claim().error, /paused/); h.activate();
  assert.equal(h.claim().success, true); assert.equal(h.confirm().success, true);
  assert.equal(h.cell('Exec_Count'), '1'); assert.equal(h.properties.size, 0);
});
test('ten serialized contenders and cross-minute/row movement get only one permission', () => {
  const h = ready(); let permissions = 0;
  for (let i = 0; i < 10; i++) { const result = h.claim('k' + i); if (result.success && !result.duplicate) permissions++; }
  assert.equal(permissions, 1); h.advance(60000);
  h.table('Messages').rows.splice(1, 0, ['OTHER', 'Active']);
  assert.equal(h.claim('new-minute', 'M1', 2).executionKey, h.context.normalizeExecutionKey('k0'));
  assert.equal(h.confirm('k0', true, 'M1', 2).rowIndex, 3);
  assert.equal(h.records().length, 1);
});
test('locked invocation does not bypass ownership', () => {
  const h = ready(); h.lock(true); assert.match(h.claim().error, /lock_timeout/);
  assert.match(h.claim().error, /lock_timeout/); h.lock(false); assert.equal(h.claim().success, true);
});
test('claim batch rejection leaves Messages untouched and durable prepared record blocks retries', () => {
  const h = ready(); h.fail({ phase: 'commit', code: 403 });
  assert.equal(h.claim().success, false); assert.equal(h.cell('Last_Exec'), '');
  assert.equal(h.table('_ExecutionMarks').rows.length, 1);
  assert.match(h.claim().error, /unknown_commit/);
  const control = JSON.parse(h.table('_ExecutionMarkControl').rows[1][0]);
  assert.throws(() => h.context.maintenanceResolveExecutionCommit({ operationId: control.pending.operationId }), /evidence_required/);
  h.context.maintenanceResolveExecutionCommit({ operationId: control.pending.operationId, originalExecutionStopped: true, remoteRequestSettled: true });
  assert.equal(h.context.readExecutionStore().control.mode, 'paused');
});
test('lost response after applied claim never redelivers, lost confirm never double counts', () => {
  const h = ready(); h.fail({ phase: 'commit', apply: true, throw: true });
  assert.equal(h.claim().success, false); assert.equal(h.claim('other').duplicate, true);
  h.fail({ phase: 'commit', apply: true, throw: true }); assert.equal(h.confirm().success, false);
  assert.equal(h.confirm().duplicate, true); assert.equal(h.cell('Exec_Count'), '1');
  assert.equal(h.table('Logs').rows.length, 3); // header + claim + one confirmation
});
test('preparation failure cannot authorize a send or advance the migration cursor', () => {
  const h = executionHarness({ properties: { BOT_CLAIM_MARK_ek_k1: legacy('k1') } }); h.initialize();
  h.fail({ phase: 'commit', code: 403 }); assert.throws(() => h.context.maintenanceMigrateExecutionMarks(), /403/);
  const c = JSON.parse(h.table('_ExecutionMarkControl').rows[1][0]); assert.equal(c.cursor, 0); assert.equal(c.migrated, false);
  const h2 = ready(); h2.fail({ phase: 'prepare', apply: true, throw: true });
  assert.equal(h2.claim().success, false); assert.equal(h2.cell('Last_Exec'), ''); assert.match(h2.claim().error, /unknown_commit/);
});
test('unknown keys/no-key/wrong IDs are rejected, repeated and conflicting confirmations are explicit', () => {
  const h = ready(); assert.match(h.confirm().error, /late_unknown/); assert.match(h.confirm('').error, /key_required/);
  h.claim(); assert.match(h.confirm('k1', true, 'OTHER').error, /mismatch/);
  assert.equal(h.confirm('k1', false).success, true); assert.equal(h.confirm('k1', false).duplicate, true);
  assert.match(h.confirm('k1', true).error, /outcome_conflict/); assert.equal(h.cell('Exec_Count'), '1');
});
test('accounting and Logs failure is atomic, not swallowed', () => {
  const h = ready(); h.claim(); h.table('Logs').rows[0] = ['bad'];
  assert.match(h.confirm().error, /logs_schema/); assert.equal(h.cell('Exec_Count'), '0'); assert.equal(h.records()[0].state, 'CLAIMED');
  const j = ready(); j.claim(); j.fail({ phase: 'commit', code: 403 }); assert.equal(j.confirm().success, false);
  assert.equal(j.cell('Exec_Count'), '0'); assert.equal(j.table('Logs').rows.length, 2); // claim survives rejected confirmation
});
test('2h expiry is UNKNOWN without count; late confirm within 48h works; beyond window refuses', () => {
  const h = ready(); h.claim(); h.advance(3 * hour);
  h.context.expireStaleClaimAsDeliveryFailed({ ID: 'M1' }, 2);
  assert.equal(h.records()[0].state, 'UNKNOWN'); assert.equal(h.cell('Exec_Count'), '0'); assert.equal(h.confirm().success, true);
  const j = ready(); j.claim(); j.advance(49 * hour); assert.match(j.confirm().error, /late_unknown/);
  j.context.purgeExpiredExecutionMarks({ maxAgeMs: hour }); assert.equal(j.records().length, 1);
});
test('purge never shortens 48h, preserves unresolved and serializes with confirm', () => {
  const h = ready(); h.claim(); h.confirm(); h.advance(13 * hour);
  assert.equal(h.context.purgeExpiredExecutionMarks({ maxAgeMs: hour }).deleted, 0);
  assert.equal(h.confirm().duplicate, true); h.advance(36 * hour);
  assert.equal(h.context.purgeExpiredExecutionMarks().deleted, 1); assert.match(h.confirm().error, /late_unknown/);
});
test('migration merges claim/terminal records, checkpoints and preserves newer Sheet confirmation', () => {
  const h = executionHarness({ properties: { BOT_CLAIM_MARK_ek_k1: legacy('k1'), BOT_EXECUTION_MARK_ek_k1: legacy('k1', false), BOT_EXECUTION_MARK_PURGE_LAST_RUN: 'nonnumeric', TIMELINE_CACHE_x: 'keep' } });
  h.initialize(); assert.equal(h.context.maintenanceMigrateExecutionMarks().complete, true);
  assert.equal(h.records().length, 1); assert.equal(h.records()[0].state, 'FAILED');
  assert.equal(Object.keys(h.records()[0].legacySources).length, 2);
  h.activate(); assert.equal(h.properties.get('TIMELINE_CACHE_x'), 'keep'); assert.equal(h.confirm('ek_k1', false).duplicate, true);
  assert.equal(h.cell('Exec_Count'), '0');
  const j = executionHarness({ properties: { BOT_CLAIM_MARK_ek_k1: legacy('k1') } }); j.initialize();
  assert.equal(j.confirm('ek_k1').success, true); j.context.maintenanceMigrateExecutionMarks(); assert.equal(j.records()[0].state, 'CONFIRMED');
});
test('more than 100 sources restart at batch boundary and source changes prevent cutover', () => {
  const properties = Object.fromEntries(Array.from({ length: 105 }, (_, i) => ['BOT_CLAIM_MARK_ek_k' + i, legacy('k' + i)]));
  const h = executionHarness({ properties }); h.initialize();
  assert.equal(h.context.maintenanceMigrateExecutionMarks().copied, 100);
  assert.equal(h.context.maintenanceMigrateExecutionMarks().complete, true); assert.equal(h.records().length, 105);
  h.properties.set('BOT_CLAIM_MARK_ek_k1', legacy('k1', false));
  assert.throws(() => h.context.maintenanceActivateExecutionStore({ oldWritersRetired: true, isolatedValidationPassed: true }), /migration_not_verified/);
});
test('duplicate IDs/ledger rows, corrupt metadata and orphan pending are blocked', () => {
  const h = ready(); h.table('Messages').rows.push([...h.table('Messages').rows[1]]); assert.match(h.claim().error, /duplicate_message_id/);
  const j = ready(); j.claim(); j.table('_ExecutionMarks').rows.push([...j.table('_ExecutionMarks').rows[1]]); assert.match(j.confirm().error, /duplicate_execution_record/);
  const k = ready(); k.setCell('Exec_Log', '⏳ API 已领取待确认'); assert.match(k.claim().error, /legacy_unknown/);
  assert.deepEqual([...k.context.maintenanceExecutionStoreStatus().legacyUnknownMessageIds], ['M1']);
});
test('rollback pauses new claims but keeps Sheet confirmations and post-cutover records', () => {
  const h = ready(); h.claim(); h.context.maintenancePauseExecutionClaims();
  assert.match(h.claim('k2').error, /paused/); assert.equal(h.confirm().success, true); assert.equal(h.records()[0].state, 'CONFIRMED');
  assert.throws(() => h.context.maintenanceActivateExecutionStore({}), /attestations/);
});
test('legacy cleanup requires observation, verified copies and keeps unrelated properties', () => {
  const h = ready({ properties: { BOT_EXECUTION_MARK_ek_old: legacy('old'), TIMELINE_CACHE_x: 'keep' } });
  const options = { snapshotVerified: true, rollbackVerified: true, oldWritersRetired: true, inflightReconciled: true };
  assert.throws(() => h.context.maintenanceDeleteMigratedExecutionProperties(options), /observation_window/);
  h.advance(49 * hour); assert.equal(h.context.maintenanceDeleteMigratedExecutionProperties(options).complete, true);
  assert.equal(h.properties.get('TIMELINE_CACHE_x'), 'keep'); assert.equal(h.properties.has('BOT_EXECUTION_MARK_ek_old'), false);
});

test('historical confirmation does not overwrite a newer occurrence display', () => {
  const h = ready(); h.claim();
  // A later instance can come from a previously deployed compatible writer.
  const ledger = h.table('_ExecutionMarks');
  const newer = { ...h.records()[0], executionKey: 'ek_newer', claimAt: '2026-10-23T10:00:00Z', updatedAt: '2026-10-23T10:00:00Z', state: 'CONFIRMED' };
  ledger.rows.push([newer.executionKey, JSON.stringify(newer)]);
  h.setCell('Last_Exec', '2026-10-23 10:00'); h.setCell('Exec_Log', 'newer result');
  assert.equal(h.confirm().success, true); assert.equal(h.cell('Last_Exec'), '2026-10-23 10:00');
  assert.equal(h.cell('Exec_Log'), 'newer result'); assert.equal(h.cell('Exec_Count'), '1');
});
test('candidate snapshot changed after selection cannot authorize delivery', () => {
  const h = ready();
  const message = h.context.parseRow(h.table('Messages').rows[1], h.table('Messages').rows[0]);
  const candidate = { ...message, _executionSnapshot: h.context.executionMessageFingerprint(message) };
  h.setCell('Content', 'edited since selection');
  const r = h.context.claimMessagePending('M1', 2, candidate, 'key');
  assert.equal(r.success, false); assert.match(r.error, /stale_message/); assert.equal(h.cell('Last_Exec'), '');
});
test('1k and 10k record local model exercises full lookup and atomic grid expansion', () => {
  for (const size of [1000, 10000]) {
    const h = ready(); const ledger = h.table('_ExecutionMarks');
    const record = { schemaVersion: 1, messageId: 'historical', state: 'CONFIRMED', updatedAt: '2026-10-23T08:00:00Z', retainUntil: '2026-10-25T08:00:00Z' };
    ledger.rows.push(...Array.from({ length: size }, (_, i) => {
      const r = { ...record, executionKey: 'ek_historical_' + i }; return [r.executionKey, JSON.stringify(r)];
    }));
    ledger.maxRows = size + 1;
    assert.equal(h.claim().success, true); assert.equal(h.records().length, size + 1);
    assert.equal(h.table('_ExecutionMarks').maxRows, size + 2);
    assert.equal(h.confirm().success, true);
  }
});
test('100 rounds of duplicate callback contention retain a single accounting effect', () => {
  for (let round = 0; round < 100; round++) {
    const h = ready(); h.claim();
    for (let retry = 0; retry < 10; retry++) assert.equal(h.confirm().success, true);
    assert.equal(h.cell('Exec_Count'), '1'); assert.equal(h.table('Logs').rows.length, 3); // exactly one claim and confirmation
  }
});

test('REST read failures do not mutate Messages, unavailable snapshot cannot authorize claim', () => {
  const h = ready(); h.fail({ phase: 'read', code: 429 });
  assert.match(h.claim().error, /http_429/); assert.equal(h.cell('Last_Exec'), '');
  assert.equal(h.claim().success, true);
});
test('trailing empty cells from REST compare equal to the selected SpreadsheetApp snapshot', () => {
  const h = ready();
  const message = h.context.parseRow(h.table('Messages').rows[1], h.table('Messages').rows[0]);
  const candidate = { _executionSnapshot: h.context.executionMessageFingerprint(message) };
  h.table('Messages').rows[1] = h.table('Messages').rows[1].slice(0, 11);
  assert.equal(h.context.claimMessagePending('M1', 2, candidate, 'empty-tail').success, true);
});


test('initialize and copy do not depend on SpreadsheetApp seeing REST-created hidden tabs', () => {
  const h = executionHarness({ staleSheetMetadata: true });
  const book = h.context.SpreadsheetApp.getActiveSpreadsheet();
  h.initialize();
  assert.equal(book.getSheetByName('_ExecutionMarks'), null, 'the service metadata deliberately remains stale');
  assert.equal(h.context.maintenanceMigrateExecutionMarks().complete, true);
  h.context.maintenanceActivateExecutionStore({ oldWritersRetired: true, isolatedValidationPassed: true });
  assert.equal(h.claim().success, true); assert.equal(h.confirm().success, true);
  const before = JSON.stringify(h.table('_ExecutionMarkControl').rows);
  h.initialize();
  assert.equal(JSON.stringify(h.table('_ExecutionMarkControl').rows), before, 'reinitialization must not reset mode, epoch or cursor');
});
test('retry initialization after lost REST create response reuses existing ledger without resetting data', () => {
  const h = executionHarness({ staleSheetMetadata: true });
  h.fail({ phase: 'commit', apply: true, throw: true });
  assert.throws(() => h.initialize(), /network_timeout/);
  h.initialize(); h.activate(); h.claim();
  const before = JSON.stringify(h.table('_ExecutionMarks').rows);
  h.initialize();
  assert.equal(JSON.stringify(h.table('_ExecutionMarks').rows), before);
  assert.equal(h.records().length, 1);
});


test('explicit prepared-operation recovery uses REST even while SpreadsheetApp metadata remains stale', () => {
  const h = executionHarness({ staleSheetMetadata: true }); h.initialize(); h.activate();
  h.fail({ phase: 'commit', code: 403 }); assert.equal(h.claim().success, false);
  const control = JSON.parse(h.table('_ExecutionMarkControl').rows[1][0]);
  const result = h.context.maintenanceResolveExecutionCommit({ operationId: control.pending.operationId, originalExecutionStopped: true, remoteRequestSettled: true });
  assert.equal(result.mode, 'paused'); assert.equal(h.context.readExecutionStore().control.pending, null);
  assert.equal(h.records().length, 0);
});
