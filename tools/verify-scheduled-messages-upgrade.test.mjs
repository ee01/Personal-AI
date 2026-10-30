import test from 'node:test';
import assert from 'node:assert/strict';
import { executionHarness } from './helpers/appscript-execution-harness.mjs';
function candidate() {
  const h = executionHarness();
  h.context.FRESH_SETUP_TOKEN = 'private-capability';
  const triggers = [];
  h.context.ScriptApp = { ...h.context.ScriptApp, getProjectTriggers: () => triggers,
    newTrigger: name => ({ timeBased() { return this; }, everyMinutes() { return this; }, create() { triggers.push({ getHandlerFunction: () => name }); } }) };
  return { ...h, triggers, setup: operation => h.context.handleFreshSetup({ token: 'private-capability', operation }) };
}
test('fresh preparation fences all sends, creates no trigger, and never needs legacy properties writes', () => {
  const h = candidate();
  assert.throws(() => h.context.handleFreshSetup({ token: 'wrong', operation: 'prepare' }), /unauthorized/);
  assert.equal(h.setup('prepare').mode, 'paused');
  assert.equal(h.triggers.length, 0); assert.equal(h.properties.size, 0);
  assert.equal(h.context.executeScheduledMessages(), undefined);
  assert.match(h.claim().error, /paused/);
  assert.equal(h.setup('prepare').mode, 'paused');
});
test('activate and response-loss retries preserve claims and create only one trigger; pause is recoverable', () => {
  const h = candidate(); h.setup('prepare');
  assert.equal(h.setup('activate').ready, true);
  assert.equal(h.triggers.length, 1);
  assert.equal(h.claim().success, true);
  assert.equal(h.setup('activate').ready, true);
  assert.equal(h.triggers.length, 1); assert.equal(h.records().length, 1);
  assert.equal(h.setup('pause').mode, 'paused');
  assert.match(h.claim('other').error, /paused/);
  assert.equal(h.setup('activate').ready, true);
  assert.equal(h.records().length, 1); assert.equal(h.confirm().success, true);
});
test('fresh endpoint rejects legacy projects and does not reset an existing migrated ledger', () => {
  const h = candidate(); h.initialize(); h.activate();
  assert.throws(() => h.setup('prepare'), /not_a_fresh_project/);
  const legacy = candidate(); legacy.properties.set('BOT_CLAIM_MARK_x', '{}');
  assert.throws(() => legacy.setup('prepare'), /legacy_marks/);
});
test('an imported orphan pending row remains blocked after 2h without poisoning other messages', () => {
  const h = candidate(); h.setup('prepare'); h.setup('activate');
  h.setCell('Exec_Log', '⏳ API 已领取待确认'); h.setCell('Last_Exec', '2026-10-23 06:00');
  const row = () => h.context.parseRow(h.table('Messages').rows[1], h.headers);
  assert.equal(h.context.isClaimPendingBlockingReclaim(row(), '2026-10-23', new h.context.Date(), 2), true);
  assert.equal(h.records().length, 0); assert.equal(h.cell('Exec_Count'), '0');
  assert.match(h.cell('Exec_Log'), /trigger_delivery_failed/);
  assert.ok(h.table('Logs').rows.some(row => row[6] === 'Expired'), 'orphan quarantine closes the trail in Logs');
  // The quarantine marker clears the pending condition: later scans must not
  // re-enter the lock or pay another UrlFetch snapshot for this row.
  const reads = h.apiReads();
  assert.equal(h.context.isClaimPendingBlockingReclaim(row(), '2026-10-23', new h.context.Date(), 2), false);
  assert.equal(h.apiReads(), reads, 'a quarantined orphan row costs no further REST reads');
  assert.equal(h.context.isPushedFailedToday(row(), '2026-10-23'), true, 'the row stays excluded from same-day reclaim');
  assert.equal(h.context.getRuntimeHealth().ready, true);
});

test('expiring a real stale claim rewrites the sheet marker in the same commit', () => {
  const h = candidate(); h.setup('prepare'); h.setup('activate');
  h.claim('k1');
  h.setCell('Last_Exec', '2026-10-23 06:00');
  h.advance(3 * 60 * 60 * 1000);
  const row = () => h.context.parseRow(h.table('Messages').rows[1], h.headers);
  assert.equal(h.context.isClaimPendingBlockingReclaim(row(), '2026-10-23', new h.context.Date(), 2), true);
  assert.equal(h.records()[0].state, 'UNKNOWN');
  assert.match(h.cell('Exec_Log'), /trigger_delivery_failed/);
  assert.ok(h.table('Logs').rows.some(row => row[6] === 'Expired'), 'expiry closes the trail in Logs');
  assert.equal(h.context.isClaimPendingLog(h.cell('Exec_Log')), false);
  const reads = h.apiReads();
  assert.equal(h.context.isClaimPendingBlockingReclaim(row(), '2026-10-23', new h.context.Date(), 2), false);
  assert.equal(h.apiReads(), reads, 'after expiry the row no longer triggers per-poll REST reads');
});

test('the purge throttle reads one control cell and skips the REST snapshot', () => {
  const h = candidate(); h.setup('prepare'); h.setup('activate');
  assert.equal(h.context.maybePurgeExpiredExecutionMarks(new h.context.Date()).success, true);
  let reads = h.apiReads();
  // Throttled (last purge just ran) stores answer without any REST read.
  const throttled = h.context.maybePurgeExpiredExecutionMarks(new h.context.Date());
  assert.equal(throttled.skipped, true); assert.equal(throttled.reason, 'throttled');
  assert.equal(h.apiReads(), reads, 'throttle check uses the built-in control cell, not UrlFetch');
  h.setup('pause');
  reads = h.apiReads();
  const paused = h.context.maybePurgeExpiredExecutionMarks(new h.context.Date());
  assert.equal(paused.skipped, true); assert.equal(paused.reason, 'paused');
  assert.equal(h.apiReads(), reads, 'mode check uses the built-in control cell, not UrlFetch');
});
test('health is read-only and does not manufacture a first-poll or delivery receipt', () => {
  const h = candidate(); assert.equal(h.context.getRuntimeHealth().success, false);
  h.setup('prepare'); h.setup('activate'); const before = h.events.length;
  assert.equal(h.context.getRuntimeHealth().firstPollAt, ''); assert.equal(h.events.length, before);
  h.claim(); assert.ok(h.context.getRuntimeHealth().firstPollAt);
  // The claim itself now owes a visible audit row; the health probe adds none.
  const logs = h.table('Logs').rows;
  assert.equal(logs.length, 2, 'header plus exactly one claim audit row');
  assert.equal(logs[0][6], 'Status');
  assert.equal(logs[1][6], 'Claimed');
  assert.equal(logs[1][1], 'M1');
  assert.equal(h.context.getRuntimeHealth().firstPollAt, h.context.getRuntimeHealth().firstPollAt);
});

test('claims leave a Claimed audit row and confirms close the trail', () => {
  const h = candidate(); h.setup('prepare'); h.setup('activate');
  h.claim('k1');
  let rows = h.table('Logs').rows;
  assert.equal(rows.length, 2, 'header plus the claim audit row');
  assert.equal(rows[1][6], 'Claimed');
  assert.equal(rows[1][1], 'M1');
  h.confirm('k1');
  rows = h.table('Logs').rows;
  assert.equal(rows.length, 3, 'confirm adds the final outcome row on top');
  assert.equal(rows[1][6], 'Success');
  assert.equal(rows[2][6], 'Claimed');
});

test('retirement wrapper removes only known send handlers and writes a public receipt without sending', async () => {
  const { default: ts } = await import('typescript');
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync('src/scheduled-messages/ScheduledMessagesUpgrade.ts','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({}) });
  let sends = 0, receipt;
  const triggers = ['minuteTrigger','dailyTrigger','customMaintenance'].map(name => ({ getHandlerFunction: () => name }));
  const context = vm.createContext({
    send: () => { sends++; }, Date,
    ScriptApp: { getProjectTriggers: () => [...triggers], deleteTrigger: trigger => triggers.splice(triggers.indexOf(trigger),1) },
    SpreadsheetApp: { openById: id => { assert.equal(id,'source-book'); return {
      getSheetByName: () => ({ getRange: () => ({ setValues: values => { receipt = values; } }) }),
    }; } },
  });
  vm.runInContext(module.exports.retirementSource('function minuteTrigger(){send();} function executeScheduledMessages(){send();}', 'source-book','public-cutover-id'),context);
  context.minuteTrigger(); context.executeScheduledMessages();
  assert.equal(sends,0);
  assert.equal(triggers.length,1); assert.equal(triggers[0].getHandlerFunction(),'customMaintenance');
  assert.equal(receipt[1][0],'public-cutover-id'); assert.ok(Date.parse(receipt[1][1]));
});

async function transpileService(path, requireMap, globals = {}) {
  const { default: ts } = await import('typescript');
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports,
    require: spec => (requireMap[spec] || (() => ({})))(),
    console: { log: () => {}, error: () => {} }, Date,
    AbortSignal: { timeout: () => undefined },
    ...globals }, {});
  return module.exports;
}

test('ensureVersionedWebAppDeployment publishes a release when only the HEAD entry exists', async () => {
  const contracts = await transpileService('src/scheduled-messages/upgradeContracts.ts', {});
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/deployments') && !init.method) {
      return { ok: true, json: async () => ({ deployments: [
        { deploymentId: 'head', deploymentConfig: {}, entryPoints: [{ webApp: { url: 'https://head/exec' } }] },
      ] }) };
    }
    if (url.endsWith('/versions')) return { ok: true, json: async () => ({ versionNumber: 9 }) };
    if (url.endsWith('/deployments')) return { ok: true, json: async () => ({ deploymentId: 'dep9',
      entryPoints: [{ webApp: { url: 'https://real/exec' } }] }) };
    throw new Error('unexpected ' + url);
  };
  const { SheetInitializer } = await transpileService('src/scheduled-messages/SheetInitializer.ts', {
    './AppScriptUpdater': () => ({ AppScriptUpdater: class {} }),
    './upgradeContracts': () => contracts,
    './scheduleDateTime': () => ({ formatLocalScheduleDate: () => '', formatLocalScheduleTime: () => '', getLocalScheduleTimeZone: () => 'Asia/Shanghai' }),
  }, { fetch });
  const initializer = new SheetInitializer('tok');
  const result = await initializer.ensureVersionedWebAppDeployment('script-1', 'https://head/exec');
  assert.equal(result.webAppUrl, 'https://real/exec');
  assert.equal(result.deploymentId, 'dep9');
  assert.deepEqual(calls.map(c => c.method), ['GET', 'POST', 'POST']);
});

test('ensureVersionedWebAppDeployment adopts an existing versioned release without republishing', async () => {
  const contracts = await transpileService('src/scheduled-messages/upgradeContracts.ts', {});
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    return { ok: true, json: async () => ({ deployments: [
      { deploymentId: 'head', deploymentConfig: {}, entryPoints: [{ webApp: { url: 'https://head/exec' } }] },
      { deploymentId: 'dep7', deploymentConfig: { versionNumber: 7 }, entryPoints: [{ webApp: { url: 'https://real/exec' } }] },
    ] }) };
  };
  const { SheetInitializer } = await transpileService('src/scheduled-messages/SheetInitializer.ts', {
    './AppScriptUpdater': () => ({ AppScriptUpdater: class {} }),
    './upgradeContracts': () => contracts,
    './scheduleDateTime': () => ({ formatLocalScheduleDate: () => '', formatLocalScheduleTime: () => '', getLocalScheduleTimeZone: () => 'Asia/Shanghai' }),
  }, { fetch });
  const initializer = new SheetInitializer('tok');
  const result = await initializer.ensureVersionedWebAppDeployment('script-1', 'https://head/exec');
  assert.equal(result.webAppUrl, 'https://real/exec');
  assert.equal(result.deploymentId, 'dep7');
  assert.deepEqual(calls.map(c => c.method), ['GET']);
});

test('cutover repairs a HEAD deployment URL before any Jira mutation and rewrites Config', async () => {
  const contracts = await transpileService('src/scheduled-messages/upgradeContracts.ts', {});
  const OLD_URL = 'https://old/exec';
  const HEAD_URL = 'https://head/exec';
  const NEW_URL = 'https://real/exec';
  const order = [];
  const deployedArgs = [];
  const configWrites = [];
  const jiraStore = new Map();
  const originalRules = [
    { config: { ruleId: 'rule-1' }, original: { state: 'ENABLED', trigger: { url: `${OLD_URL}?action=getBotMessageCurrentTime` }, components: [{ config: { url: `${OLD_URL}?action=markBotMessageExecuted` } }] } },
    { config: { ruleId: 'rule-2' }, original: { state: 'ENABLED', trigger: { url: `${OLD_URL}?action=cacheReleaseInfo` }, components: [] } },
  ];
  // Seed Jira with the state a failed first attempt leaves behind: HEAD URL, paused.
  originalRules.forEach(({ config, original }) => jiraStore.set(config.ruleId,
    { ...contracts.replaceRuleUrl(JSON.parse(JSON.stringify(original)), OLD_URL, HEAD_URL), state: 'DISABLED' }));
  const jiraStub = () => ({ JiraAutomationService: class {
    constructor() { this.rules = jiraStore; }
    async updateRule(config, ruleId, partial) {
      order.push(`jira-update:${ruleId}`);
      const current = this.rules.get(ruleId);
      this.rules.set(ruleId, partial.trigger || partial.components ? { ...partial } : { ...current, state: partial.state });
    }
    async getRuleById(config, ruleId) { return this.rules.get(ruleId); }
  } });
  const fetchCalls = [];
  const fetch = async (url) => {
    fetchCalls.push(url);
    if (url.startsWith('https://sheets.googleapis.com/')) {
      return { ok: true, json: async () => ({ values: [
        ['ID', 'Topic', 'Content', 'Status', 'Last_Exec', 'Exec_Count', 'Exec_Log', 'Push_Method', 'Schedule_Date', 'Schedule_Time'],
        ['m1', 'T', 'C', 'Active', '2026-10-23 08:00', '0', '✅ 成功', 'Bot', '2026-10-24', '09:00'],
      ] }) };
    }
    if (url === NEW_URL) {
      return { ok: true, json: async () => ({ success: true, spreadsheetId: 'cand-sheet', executionStoreSchemaVersion: 1, ready: true, mode: 'sheet_primary' }) };
    }
    throw new Error('unexpected fetch ' + url);
  };
  const { ScheduledMessagesUpgrade } = await transpileService('src/scheduled-messages/ScheduledMessagesUpgrade.ts', {
    './AppScriptUpdater': () => ({ AppScriptUpdater: class { static async getLatestVersionInfo() { return { version: '3.1.0', lastUpdated: 'x' }; } } }),
    './SheetInitializer': () => ({ SheetInitializer: class {
      constructor(token) { this.token = token; }
      async ensureVersionedWebAppDeployment(scriptId, savedUrl) {
        deployedArgs.push({ scriptId, savedUrl });
        order.push('deploy-check');
        return { webAppUrl: NEW_URL, deploymentId: 'dep9' };
      }
    } }),
    './ConfigSyncService': () => ({ ConfigSyncService: class {
      async readConfigFromSheet() { return { last_sync_time: '2026-10-23T14:00:00Z' }; }
      async saveConfigToSheet(config) { configWrites.push(config); }
      async saveConfigToStorage() {}
    } }),
    './JiraAutomationService': jiraStub,
    './botAutomationConfig': () => ({ normalizeSheetConfig: config => config }),
    './upgradeContracts': () => contracts,
    './scheduleDateTime': () => ({ formatLocalScheduleDate: () => '2026-10-23', formatLocalScheduleTime: () => '14:00' }),
  }, {
    fetch,
    navigator: { locks: { request: async (name, opts, cb) => cb({}) } },
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
  });
  const draft = {
    id: 'cutover-id', token: 'tok',
    source: { sheetId: 'source-sheet', webAppUrl: OLD_URL, sheetUrl: 'https://old', scriptId: 'old-script',
      botAutomation: { executorRule: { ruleId: 'rule-1' }, timelineSyncRule: { ruleId: 'rule-2' } } },
    candidate: { sheetId: 'cand-sheet', sheetUrl: 'https://cand', scriptId: 'cand-script', webAppUrl: HEAD_URL, deploymentId: 'head', messagesSheetId: 1, logsSheetId: 2 },
    stage: 'switch', retired: true, imported: true, autoImported: true, cutoverAt: '2026-10-23T14:00:00Z',
    rules: originalRules.map(entry => ({ config: { ...entry.config }, original: JSON.parse(JSON.stringify(entry.original)) })),
  };
  const service = new ScheduledMessagesUpgrade('tok', JSON.parse(JSON.stringify(draft)));
  await service.cutover();
  assert.equal(order[0], 'deploy-check');
  assert.equal(deployedArgs[0].savedUrl, HEAD_URL);
  assert.equal(service.draft.candidate.webAppUrl, NEW_URL);
  assert.equal(service.draft.candidate.deploymentId, 'dep9');
  assert.equal(service.draft.stage, 'complete');
  // Config was rewritten even though cutoverAt was already stamped by the failed attempt.
  assert.equal(configWrites.length, 1);
  assert.equal(configWrites[0].webAppUrl, NEW_URL);
  assert.equal(configWrites[0].deploymentId, 'dep9');
  // A retry can already hold the repaired URL while Config still has stale data.
  // Reconcile Config again even though neither URL nor cutoverAt changes now.
  await service.cutover();
  assert.equal(configWrites.length, 2);
  assert.equal(configWrites[1].webAppUrl, NEW_URL);
  // Activation went to the repaired URL; the HEAD URL was never contacted.
  assert.ok(fetchCalls.includes(NEW_URL));
  assert.ok(!fetchCalls.includes(HEAD_URL));
  // Jira rules ended enabled with the repaired URL and no stale addresses.
  for (const ruleId of ['rule-1', 'rule-2']) {
    const rule = jiraStore.get(ruleId);
    assert.equal(rule.state, 'ENABLED');
    const serialized = JSON.stringify(rule);
    assert.ok(serialized.includes(NEW_URL));
    assert.ok(!serialized.includes(HEAD_URL));
    assert.ok(!serialized.includes(OLD_URL));
  }
});
