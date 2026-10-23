import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibleRuntime, inspectUpgradeRows, quarantineImportedRows, replaceRuleUrl, ruleContainsUrl, jiraRuleContentMatches } from '../upgradeContracts';
const headers = ['ID', 'Topic', 'Content', 'Status', 'Last_Exec', 'Exec_Count', 'Exec_Log', 'Push_Method', 'Schedule_Date', 'Schedule_Time'];
const row = ['A', 'Test', '=not-a-formula()', 'Active', '2026-10-23 09:00', '3', '✅ 推送成功', 'Bot', '2026-10-23', '09:00'];
test('Jira readback accepts regenerated structural IDs and object key order', () => {
  const expected = [{ id: 'old', type: 'branch', children: [{ id: 'child', parentId: 'old', type: 'web', value: { url: 'new', id: 'business' } }], conditions: [{ id: 'condition', conditionParentId: 'old', value: { jql: 'status = Open' } }] }];
  const actual = [{ conditions: [{ value: { jql: 'status = Open' }, conditionParentId: 'new-id', id: 'new-condition' }], children: [{ value: { id: 'business', url: 'new' }, type: 'web', parentId: 'new-id', id: 'new-child' }], type: 'branch', id: 'new-id' }];
  assert.equal(jiraRuleContentMatches(expected, actual), true);
  assert.equal(jiraRuleContentMatches({ id: 'old', type: 'scheduled', value: { cron: '* * * * *' } }, { value: { cron: '* * * * *' }, type: 'scheduled', id: 'new' }), true);
});
test('Jira readback rejects URL, business ID, condition, custom field, type and action-order changes', () => {
  const expected = [{ id: 'old', type: 'web', value: { url: 'new', id: 'business', parentId: 'business-parent', conditionParentId: 'business-condition' }, conditions: [{ id: 1, value: { jql: 'status = Open' } }], custom: { id: 'keep' } }, { type: 'log', value: 'end' }];
  const changed = (mutate: (copy: any) => void) => { const copy = JSON.parse(JSON.stringify(expected)); mutate(copy); assert.equal(jiraRuleContentMatches(expected, copy), false); };
  changed(copy => { copy[0].value.url = 'old'; });
  for (const key of ['id', 'parentId', 'conditionParentId']) changed(copy => { copy[0].value[key] = 'changed'; });
  changed(copy => { copy[0].conditions[0].value.jql = 'status = Closed'; });
  changed(copy => { copy[0].custom.id = 'changed'; });
  changed(copy => { copy[0].type = 'log'; });
  changed(copy => { copy.reverse(); });
  changed(copy => { copy[0].children = []; });
});
test('compatibility requires correct book, protocol and active ledger, not just a version', () => {
  assert.equal(compatibleRuntime({ success: true, scriptVersion: '3.1.0' }, 'A'), false);
  const health = { success: true, spreadsheetId: 'A', ready: true, mode: 'sheet_primary', executionStoreSchemaVersion: 1 };
  assert.equal(compatibleRuntime(health, 'A'), true);
  assert.equal(compatibleRuntime(health, 'B'), false);
  assert.equal(compatibleRuntime({ ...health, mode: 'paused' }, 'A'), false);
});
test('whole-row import preserves successful execution fields, counts, IDs and literal text', () => {
  const result = quarantineImportedRows([headers, row]);
  assert.deepEqual(result, [headers, row]);
  assert.deepEqual(inspectUpgradeRows(result).sent, ['A']);
});
test('copied orphan pending stays paused beyond 2h; counts and receipt remain intact', () => {
  const pending = [...row]; pending[6] = '⏳ API 已领取待确认';
  const result = quarantineImportedRows([headers, pending]);
  assert.equal(result[1][3], 'Paused');
  assert.equal(result[1][5], '3');
  assert.equal(result[1][6], pending[6]);
});
test('invalid headers, duplicate IDs, negative counts and invalid status are rejected', () => {
  assert.ok(inspectUpgradeRows([headers, row, row]).errors.some(e => e.includes('重复')));
  assert.throws(() => quarantineImportedRows([headers.slice(1), row]), /缺少/);
  const invalid = [...row]; invalid[5] = '-1'; invalid[3] = 'Ready';
  assert.equal(inspectUpgradeRows([headers, invalid]).errors.length, 2);
});
test('no-time tasks warn about day-wide repeats; completed tasks remain completed', () => {
  const untimed = [...row]; untimed[9] = '';
  assert.equal(inspectUpgradeRows([headers, untimed]).warnings.length, 1);
  const done = [...row]; done[3] = 'Done';
  assert.deepEqual(quarantineImportedRows([headers, done])[1], done);
});
test('Jira replacement covers nested confirm/poll/cache and encoded URLs without rebuilding custom rules', () => {
  const old = 'https://script.google.com/macros/s/old/exec';
  const next = 'https://script.google.com/macros/s/new/exec';
  const rule = { name: 'Custom rule', state: 'ENABLED', trigger: { url: old + '?action=getBotMessageCurrentTime' },
    components: [{ url: old + '?action=confirm' }, { body: `send(${encodeURIComponent(old)})` }, { url: old + '?action=cacheReleaseInfo' }], custom: { value: 42 } };
  const result = replaceRuleUrl(rule, old, next);
  assert.equal(ruleContainsUrl(result, old), false);
  assert.equal(ruleContainsUrl(result, next), true);
  assert.equal(result.name, rule.name); assert.deepEqual(result.custom, rule.custom);
  assert.equal(rule.trigger.url, old + '?action=getBotMessageCurrentTime');
});
