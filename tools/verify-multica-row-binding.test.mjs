import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { executionHarness } from './helpers/appscript-execution-harness.mjs';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/scheduled-messages/multica/multicaBindingSheet.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, fetch: () => { throw Error('unexpected live request'); } });

function fixture({ version = '3.5.0', corrupt = false, owner = 'book', changeLegacyOnVersion = false } = {}) {
  const headers = ['Agent_Multica_Spreadsheet_ID', 'ID', 'Agent_Binding_ID', 'Agent_Multica_Webhook_URL', 'Agent_Provider'];
  const rows = [headers, ['', 'm1', 'b1', '', 'multica'], ['', 'memory', '', '', 'legacy_memory']];
  const old = [['messageId', 'spreadsheetId', 'webhookUrl', 'bindingUuid'], ['m1', owner, 'https://api.multica.ai/api/webhooks/autopilots/fixture', 'b1'], ['orphan', 'book', 'orphan_hook', 'old']];
  let exists = true;
  let deleted = 0;
  const fetchImpl = async (url, init = {}) => {
    const range = decodeURIComponent(url.split('/values/')[1] || '');
    if (url.includes('/values:batchUpdate')) {
      for (const item of JSON.parse(init.body).data) {
        const m = item.range.match(/!([A-Z]+)(\d+)/);
        const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        rows[Number(m[2]) - 1][col] = corrupt ? 'wrong' : item.values[0][0];
      }
    } else if (url.endsWith(':batchUpdate')) {
      const req = JSON.parse(init.body).requests;
      assert.equal(req.length, 1);
      assert.equal(req[0].deleteSheet.sheetId, 99);
      exists = false; deleted++;
    } else if (url.includes('action=getVersion')) {
      if (changeLegacyOnVersion) old[1][2] = 'changed_during_migration';
      return Response.json({ version });
    }
    else if (range === 'Messages') return Response.json({ values: rows });
    else if (range.startsWith('Messages!')) return Response.json({ values: [rows[Number(range.match(/!(\d+)/)[1]) - 1]] });
    else if (range.startsWith('_AgentBindings!')) return Response.json({ values: old });
    else if (url.includes('?fields=')) return Response.json({ sheets: exists ? [{ properties: { title: '_AgentBindings', sheetId: 99 } }] : [] });
    else assert.fail('unexpected Sheets request');
    return Response.json({});
  };
  const options = { fetchImpl, token: 'fixture_oauth', spreadsheetId: 'book', webAppUrl: 'https://script.example.test/exec' };
  return { options, rows, old, deleted: () => deleted };
}

test('migration copies only the referenced webhook, verifies reordered columns and deletes legacy history once', async () => {
  const f = fixture();
  assert.equal((await exports.migrateMulticaBindingsToMessages(f.options)).deleted, true);
  assert.match(f.rows[1][3], /fixture$/);
  assert.equal(f.rows[1][0], 'book');
  assert.equal(f.rows[2][3], '');
  assert.equal(f.deleted(), 1);
  assert.equal((await exports.migrateMulticaBindingsToMessages(f.options)).deleted, false);
});

test('failed verification, missing/duplicate bindings and old deployed script never delete the old table', async () => {
  for (const change of ['corrupt', 'missing', 'duplicate', 'old_script', 'concurrent_update']) {
    const f = fixture({ corrupt: change === 'corrupt', version: change === 'old_script' ? '3.4.0' : '3.5.0', changeLegacyOnVersion: change === 'concurrent_update' });
    if (change === 'missing') f.old.splice(1);
    if (change === 'duplicate') f.old.push(f.old[1]);
    if (change === 'old_script') assert.equal((await exports.migrateMulticaBindingsToMessages(f.options)).deleted, false);
    else await assert.rejects(exports.migrateMulticaBindingsToMessages(f.options));
    assert.equal(f.deleted(), 0);
  }
});

test('a copied Sheet never inherits a trigger credential', async () => {
  const f = fixture({ owner: 'source_book' });
  await exports.migrateMulticaBindingsToMessages(f.options);
  assert.equal(f.rows[1][3], '');
  assert.equal(f.rows[1][0], 'source_book');
});

test('provisioning updates the same Messages row, retains an existing one-time webhook and rejects rebound rows', async () => {
  const f = fixture();
  const record = { messageId: 'm1', bindingUuid: 'b1', spreadsheetId: 'book', webhookUrl: 'https://api.multica.ai/api/webhooks/autopilots/fixture' };
  await exports.upsertMulticaBinding({ ...f.options, record });
  await exports.upsertMulticaBinding({ ...f.options, record: { ...record, webhookUrl: '' } });
  assert.equal(f.rows.length, 3);
  assert.equal(f.rows[1][3], record.webhookUrl);
  assert.equal(f.deleted(), 0);
  f.rows[1][2] = 'replacement';
  await assert.rejects(exports.upsertMulticaBinding({ ...f.options, record }));
});

test('live-style diagnostic never claims, clears a copied webhook or exposes credentials', () => {
  const capability = 'b'.repeat(64);
  for (const owner of ['test-book', 'source-book']) {
    const h = executionHarness({ configRows: [['Key', 'Value'], ['multica_scheduler_capability', capability]], data: [
      ['ID', 'Push_Method', 'Agent_Provider', 'Agent_Binding_ID', 'Agent_Multica_Webhook_URL', 'Agent_Multica_Spreadsheet_ID', 'Agent_Multica_Api_Origin', 'Status'],
      ['M1', 'AgentTask', 'multica', 'fixture-binding', 'https://api.multica.ai/api/webhooks/autopilots/private_fixture', owner, 'https://api.multica.ai', 'Active'],
    ] });
    const before = JSON.stringify(h.table('Messages'));
    const result = h.context.inspectMulticaAgentTask({ capability, messageId: 'M1' });
    assert.equal(result.deliverable, owner === 'test-book');
    assert.equal(result.readOnly, true);
    assert.doesNotMatch(JSON.stringify(result), /private_fixture|api\/webhooks|bbbbbbbb/);
    assert.equal(JSON.stringify(h.table('Messages')), before);
    assert.equal(h.table('_ExecutionMarks'), undefined);
    assert.equal(h.context.inspectMulticaAgentTask({ capability: 'wrong', messageId: 'M1' }).success, false);
  }
});
