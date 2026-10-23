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
  assert.equal(h.context.isClaimPendingBlockingReclaim(h.context.parseRow(h.table('Messages').rows[1], h.headers), '2026-10-23', new h.context.Date(), 2), true);
  assert.equal(h.records().length, 0); assert.equal(h.cell('Exec_Count'), '0');
  assert.equal(h.context.getRuntimeHealth().ready, true);
});
test('health is read-only and does not manufacture a first-poll or delivery receipt', () => {
  const h = candidate(); assert.equal(h.context.getRuntimeHealth().success, false);
  h.setup('prepare'); h.setup('activate'); const before = h.events.length;
  assert.equal(h.context.getRuntimeHealth().firstPollAt, ''); assert.equal(h.events.length, before);
  h.claim(); assert.ok(h.context.getRuntimeHealth().firstPollAt);
  assert.equal(h.table('Logs').rows.length, 1);
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
