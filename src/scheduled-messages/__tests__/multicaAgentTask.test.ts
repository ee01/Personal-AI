import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as contractModule from '../multica/multicaContract.js';
import * as connectionModule from '../multica/multicaConnection.js';
import * as provisionModule from '../multica/multicaProvision.js';
import { MulticaApiError, MulticaClient } from '../multica/multicaClient.js';
import {
  handleMulticaExtensionMessage,
  toPublicConnection,
  type KeyValueStorage,
  type StoredMulticaConnection,
} from '../multica/multicaConnection.js';
import {
  buildAutopilotViewUrl,
  buildMulticaIdempotencyKey,
  parseMulticaWebhookReceipt,
  pauseCopiedMulticaMessageRows,
  multicaScheduleOnlyEdit,
  publicMulticaFields,
  redactMulticaSecrets,
  resolveWebhookUrl,
} from '../multica/multicaContract.js';
import { provisionMulticaScheduledTask, type ProvisionProgress } from '../multica/multicaProvision.js';

const API = 'https://api.multica.ai';
const BINDING = '11111111-1111-4111-8111-111111111111';
const WEBHOOK = `${API}/api/webhooks/autopilots/goodtoken`;

function memoryStore(): KeyValueStorage & { dump: Record<string, unknown> } {
  const dump: Record<string, unknown> = {};
  return {
    dump,
    async get(keys) {
      return Object.fromEntries(keys.filter((key) => key in dump).map((key) => [key, dump[key]]));
    },
    async set(items) {
      Object.assign(dump, items);
    },
    async remove(keys) {
      keys.forEach((key) => { delete dump[key]; });
    },
  };
}

test('webhook URL must match the selected API origin and stay free of query secrets', () => {
  const resolved = resolveWebhookUrl({ apiOrigin: API, webhookUrl: WEBHOOK });
  assert.equal(resolved.host, 'api.multica.ai');
  assert.equal(resolved.path, 'api/webhooks/autopilots/goodtoken');
  assert.equal(resolveWebhookUrl({
    apiOrigin: 'http://task.xmnup.com',
    webhookUrl: 'http://task.xmnup.com/api/webhooks/autopilots/goodtoken',
  }).host, 'task.xmnup.com');
  assert.throws(() => resolveWebhookUrl({ apiOrigin: API, webhookUrl: 'https://evil.example/api/webhooks/autopilots/goodtoken' }), /不一致/);
  assert.throws(() => resolveWebhookUrl({ apiOrigin: API, webhookUrl: `${WEBHOOK}?x=1` }), /查询/);
});

test('public sheet fields and view links do not carry the webhook', () => {
  const fields = publicMulticaFields({
    bindingUuid: BINDING,
    workspaceId: 'ws_12345678',
    workspaceSlug: 'personal',
    agentId: 'ag_12345678',
    webOrigin: 'https://multica.ai',
    apiOrigin: API,
    userId: 'user_12345678',
    state: 'ready',
    contentRevision: 'abc',
  });
  assert.equal(JSON.stringify(fields).includes('goodtoken'), false);
  assert.equal(JSON.stringify(fields).includes('webhookUrl'), false);
  assert.equal(buildAutopilotViewUrl('https://multica.ai', 'personal', 'ap_12345678'), 'https://multica.ai/personal/autopilots/ap_12345678');
});

test('copying a sheet pauses Multica rows and receipts do not treat HTTP 200 as completion', () => {
  const rows = pauseCopiedMulticaMessageRows([
    ['Agent_Provider', 'Status', 'Agent_Provision_State', 'Exec_Log'],
    ['multica', 'Active', 'ready', '已安排'],
    ['legacy_memory', 'Active', '', '待执行'],
  ]);
  assert.equal(rows[1][1], 'Paused');
  assert.equal(rows[1][2], 'needs_reconnect');
  assert.equal(rows[2][1], 'Active');
  assert.equal(parseMulticaWebhookReceipt(200, { status: 'accepted', run_id: 'run_1' }).deliveryConfirmed, true);
  assert.equal(parseMulticaWebhookReceipt(200, { status: 'duplicate', run_id: 'run_1' }).deliveryConfirmed, true);
  assert.equal(parseMulticaWebhookReceipt(200, { status: 'duplicate' }).deliveryConfirmed, false);
  assert.equal(parseMulticaWebhookReceipt(200, { status: 'skipped' }).dispatchState, 'skipped');
  assert.equal(parseMulticaWebhookReceipt(200, { status: 'ignored' }).deliveryConfirmed, false);
  assert.equal(parseMulticaWebhookReceipt(504, {}).dispatchState, 'unknown');
});

test('idempotency key stays short and hashes only past 128 characters', async () => {
  assert.equal(await buildMulticaIdempotencyKey(BINDING, 'exec-1'), `pai:${BINDING}:exec-1`);
  const longKey = await buildMulticaIdempotencyKey(BINDING, 'x'.repeat(140));
  assert.match(longKey, /^pai:[a-f0-9]{64}$/);
  assert.equal(redactMulticaSecrets(`capability=secret ${WEBHOOK}`).includes('goodtoken'), false);
});

test('schedule-only edits keep an already ready Multica task on its saved agent', () => {
  assert.equal(multicaScheduleOnlyEdit({
    Agent_Provider: 'multica',
    Agent_Provision_State: 'ready',
    Agent_Binding_ID: BINDING,
    Agent_Multica_Autopilot_ID: 'ap_12345678',
    Agent_Multica_Trigger_ID: 'tg_12345678',
    Agent_Multica_Agent_ID: 'ag_12345678',
    Agent_Multica_Workspace_ID: 'ws_12345678',
    Content: 'same',
  }, { Content: 'same' }), true);
});

test('project, binding and connection changes require a managed save', () => {
  const editing = {
    Agent_Provider: 'multica', Agent_Provision_State: 'ready', Agent_Binding_ID: BINDING,
    Agent_Multica_Autopilot_ID: 'ap_12345678', Agent_Multica_Trigger_ID: 'tg_12345678',
    Agent_Multica_Project_ID: 'project_old', Agent_Multica_Workspace_ID: 'ws_12345678', Content: 'same',
  };
  for (const change of [
    { Agent_Multica_Project_ID: '' }, { Agent_Multica_Project_ID: 'project_new' },
    { Agent_Binding_ID: 'replacement' }, { Agent_Multica_Workspace_ID: '' },
    { Agent_Multica_Api_Origin: 'http://other.test' },
  ]) assert.equal(multicaScheduleOnlyEdit(editing, { Content: 'same', ...change }), false);
});

test('default transport preserves the global fetch receiver for HTTP and HTTPS', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async function (input, init) {
    assert.equal(this, globalThis);
    calls.push(String(input));
    assert.equal(init?.redirect, 'error');
    return new Response(JSON.stringify({ id: 'user_12345678' }));
  };
  try {
    for (const apiOrigin of ['http://multica.test', 'https://multica.test']) {
      const client = new MulticaClient({ apiOrigin, pat: 'test_pat' });
      assert.equal((await client.getMe()).id, 'user_12345678');
    }
    assert.deepEqual(calls, ['http://multica.test/api/me', 'https://multica.test/api/me']);
  } finally {
    globalThis.fetch = original;
  }
});

test('client rejects paths outside the allowlist and does not follow redirects or echo PAT', async () => {
  const calls: Array<{ url: string; redirect?: RequestRedirect }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, redirect: init.redirect });
    return new Response(JSON.stringify({ error: 'pat_secret_value leaked' }), { status: 500 });
  };
  const client = new MulticaClient({ apiOrigin: API, pat: 'pat_secret_value', workspaceId: 'ws_12345678', fetchImpl });
  await assert.rejects(client.getMe(), (error: unknown) => {
    assert.ok(error instanceof MulticaApiError);
    assert.equal(String(error.message).includes('pat_secret_value'), false);
    return true;
  });
  assert.equal(calls[0].redirect, 'error');
  await assert.rejects(
    (client as unknown as { request: (path: string) => Promise<unknown> }).request('/api/secrets'),
    (error: unknown) => error instanceof MulticaApiError && error.code === 'path_rejected',
  );
  assert.equal(calls.length, 1);
  const offline = new MulticaClient({
    apiOrigin: API,
    pat: 'pat_secret_value',
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  await assert.rejects(offline.getMe(), (error: unknown) => {
    assert.ok(error instanceof MulticaApiError);
    assert.match(error.message, /Failed to fetch/);
    assert.equal(error.message.includes('pat_secret_value'), false);
    return true;
  });
});

test('extension status never returns PAT and rejects untrusted pages or foreign workspaces', async () => {
  const session = memoryStore();
  const local = memoryStore();
  const sender = { id: 'ext', url: 'chrome-extension://ext/scheduled-messages.html' };
  const stored: StoredMulticaConnection = {
    apiOrigin: API,
    webOrigin: 'https://multica.ai',
    pat: 'pat_secret_value',
    userId: 'user_12345678',
    accountLabel: 'E',
    workspaceId: '',
    workspaceSlug: '',
    allowedWorkspaceIds: ['ws_12345678'],
    remember: false,
  };
  assert.equal(JSON.stringify(toPublicConnection(stored)).includes('pat_secret_value'), false);
  const fresh = toPublicConnection(null);
  assert.equal(fresh.connected, false);
  assert.equal(fresh.apiOrigin, 'http://task.xmnup.com');
  assert.equal(fresh.webOrigin, 'http://task.xmnup.com');
  const omitted = await handleMulticaExtensionMessage({
    type: 'MULTICA_VERIFY',
    data: { pat: 'pat_secret_value' },
  }, sender, {
    extensionId: 'ext',
    session: memoryStore(),
    local: memoryStore(),
    clientFactory: (connection) => {
      assert.equal(connection.apiOrigin, 'http://task.xmnup.com');
      assert.equal(connection.webOrigin, 'http://task.xmnup.com');
      return {
        async getMe() { return { id: 'user_12345678', label: 'E' }; },
        async listWorkspaces() { return []; },
      } as never;
    },
  });
  assert.equal(omitted.success, true);
  assert.equal(omitted.connection?.apiOrigin, 'http://task.xmnup.com');
  assert.equal(omitted.connection?.webOrigin, 'http://task.xmnup.com');
  await session.set({ multicaConnectionSession: stored });
  const status = await handleMulticaExtensionMessage({ type: 'MULTICA_STATUS' }, sender, {
    extensionId: 'ext', session, local,
  });
  assert.equal(JSON.stringify(status).includes('pat_secret_value'), false);
  assert.equal(status.connection?.connected, true);
  const rejected = await handleMulticaExtensionMessage({ type: 'MULTICA_STATUS' }, {
    id: 'ext', url: 'chrome-extension://ext/content.js',
  }, { extensionId: 'ext', session, local });
  assert.equal(rejected.code, 'sender_rejected');
  const foreign = await handleMulticaExtensionMessage({
    type: 'MULTICA_SELECT_WORKSPACE',
    data: { workspaceId: 'ws_other_1' },
  }, sender, { extensionId: 'ext', session, local });
  assert.equal(foreign.code, 'workspace_rejected');
});

test('self-hosted http verify calls the API instead of failing before the request', async () => {
  const calls: string[] = [];
  const session = memoryStore();
  const local = memoryStore();
  const result = await handleMulticaExtensionMessage({
    type: 'MULTICA_VERIFY',
    data: {
      apiOrigin: 'http://task.xmnup.com/',
      webOrigin: 'http://task.xmnup.com/',
      pat: 'pat_secret_value',
      remember: false,
    },
  }, { id: 'ext', url: 'chrome-extension://ext/scheduled-messages.html' }, {
    extensionId: 'ext',
    session,
    local,
    clientFactory: () => ({
      async getMe() {
        calls.push('me');
        return { id: 'user_12345678', label: 'E' };
      },
      async listWorkspaces() {
        calls.push('workspaces');
        return [{ id: 'ws_12345678', slug: 'personal', name: 'Personal' }];
      },
    }) as never,
  });
  assert.deepEqual(calls, ['me', 'workspaces']);
  assert.equal(result.success, true);
  assert.equal(result.connection?.apiOrigin, 'http://task.xmnup.com');
  assert.equal(JSON.stringify(result).includes('pat_secret_value'), false);
});

test('http verify stays on http and does not follow a redirect off that host', async () => {
  const calls: string[] = [];
  const session = memoryStore();
  const local = memoryStore();
  const sender = { id: 'ext', url: 'chrome-extension://ext/scheduled-messages.html' };
  const blocked = await handleMulticaExtensionMessage({
    type: 'MULTICA_VERIFY',
    data: {
      apiOrigin: 'http://task.xmnup.com/',
      webOrigin: 'http://task.xmnup.com/',
      pat: 'pat_secret_value',
    },
  }, sender, {
    extensionId: 'ext',
    session,
    local,
    clientFactory: (connection) => {
      calls.push(connection.apiOrigin);
      throw new MulticaApiError('无法连接 Multica API：Failed to fetch', 0, 'network');
    },
  });
  assert.deepEqual(calls, ['http://task.xmnup.com']);
  assert.equal(blocked.success, false);
  assert.match(blocked.error || '', /Failed to fetch/);
  assert.equal(blocked.error?.includes('https://'), false);
  const dirty = await handleMulticaExtensionMessage({
    type: 'MULTICA_VERIFY',
    data: { apiOrigin: 'https://api.multica.ai', webOrigin: 'https://multica.ai', pat: 'pat_secret\u0001value' },
  }, sender, {
    extensionId: 'ext',
    session: memoryStore(),
    local: memoryStore(),
    clientFactory: () => { throw new Error('should not send'); },
  });
  assert.equal(dirty.success, false);
  assert.match(dirty.error || '', /换行或特殊字符/);
});

function provisionHarness(options?: { failCreate?: Error; webhookUrl?: string }) {
  const calls = { create: 0, webhook: 0, enable: 0 };
  const autopilots: Array<{ id: string; description: string; triggers: any[] }> = [];
  const progress = new Map<string, ProvisionProgress>();
  const sheets: unknown[] = [];
  const bindings: Array<{ webhookUrl: string }> = [];
  const remote = {
    async listAutopilots() {
      return autopilots.slice();
    },
    async getAutopilot(id: string) {
      const found = autopilots.find((item) => item.id === id);
      if (!found) throw new Error('missing');
      return found;
    },
    async createAutopilot(input: { description: string }) {
      calls.create += 1;
      if (options?.failCreate) throw options.failCreate;
      const created = { id: 'ap_12345678', description: input.description, triggers: [] as any[] };
      autopilots.push(created);
      return created;
    },
    async patchAutopilot() { return undefined; },
    async createWebhook(input: { autopilotId: string; label: string }) {
      calls.webhook += 1;
      const trigger = {
        id: 'tg_12345678',
        kind: 'webhook',
        label: input.label,
        webhookUrl: options?.webhookUrl || WEBHOOK,
      };
      autopilots.find((item) => item.id === input.autopilotId)?.triggers.push(trigger);
      return { id: trigger.id, webhookUrl: trigger.webhookUrl };
    },
    async patchTrigger(input: { enabled: boolean }) {
      if (input.enabled) calls.enable += 1;
    },
  };
  const input = {
    bindingUuid: BINDING,
    messageId: 'msg-1',
    topic: '周报',
    task: '整理本周异常',
    agentId: 'ag_12345678',
    workspaceId: 'ws_12345678',
    workspaceSlug: 'personal',
    apiOrigin: API,
    webOrigin: 'https://multica.ai',
    multicaUserId: 'user_12345678',
    connectionKey: 'conn',
    spreadsheetId: 'sheet-1',
    contentRevision: 'rev-1',
    jiraReady: true,
    scheduleOnly: false,
  };
  const deps = {
    remote,
    loadProgress: async (id: string) => progress.get(id) || null,
    saveProgress: async (value: ProvisionProgress) => { progress.set(value.bindingUuid, value); },
    updateSheet: async (_id: string, fields: unknown) => { sheets.push(fields); },
    writeBinding: async (record: { webhookUrl: string }) => { bindings.push(record); },
  };
  return { calls, autopilots, progress, sheets, bindings, input, deps };
}

test('provision creates one autopilot and does not create another on the next save', async () => {
  const harness = provisionHarness();
  const first = await provisionMulticaScheduledTask(harness.input, harness.deps);
  assert.equal(first.activated, true);
  assert.match(first.receipt, /已安排，时间由 Jira 触发/);
  assert.equal(harness.calls.create, 1);
  assert.equal(harness.calls.webhook, 1);
  assert.equal(JSON.stringify(harness.sheets).includes('goodtoken'), false);
  const second = await provisionMulticaScheduledTask(harness.input, harness.deps);
  assert.equal(second.activated, true);
  assert.equal(harness.calls.create, 1);
  assert.equal(harness.calls.webhook, 1);
});

test('an uncertain create is not repeated until the same binding is found', async () => {
  const harness = provisionHarness({ failCreate: new MulticaApiError('timeout', 0, 'network') });
  await assert.rejects(provisionMulticaScheduledTask(harness.input, harness.deps));
  assert.equal(harness.calls.create, 1);
  assert.equal(harness.progress.get(BINDING)?.pendingConfirmation, true);
  await assert.rejects(provisionMulticaScheduledTask(harness.input, harness.deps), /还未确认/);
  assert.equal(harness.calls.create, 1);
  assert.equal(harness.bindings.length, 0);
});

test('host mismatch and duplicate markers do not write a binding', async () => {
  const mismatch = provisionHarness({ webhookUrl: 'https://evil.example/api/webhooks/autopilots/goodtoken' });
  await assert.rejects(provisionMulticaScheduledTask(mismatch.input, mismatch.deps), /不一致/);
  assert.equal(mismatch.bindings.length, 0);
  const conflict = provisionHarness();
  conflict.autopilots.push({ id: 'ap_aaaaaaaa', description: `PAI_BINDING:${BINDING}`, triggers: [] });
  conflict.autopilots.push({ id: 'ap_bbbbbbbb', description: `PAI_BINDING:${BINDING}`, triggers: [] });
  await assert.rejects(provisionMulticaScheduledTask(conflict.input, conflict.deps), /多个/);
  assert.equal(conflict.calls.create, 0);
});

test('Jira not ready leaves the row paused and schedule-only does not create again', async () => {
  const paused = provisionHarness();
  const result = await provisionMulticaScheduledTask({ ...paused.input, jiraReady: false }, paused.deps);
  assert.equal(result.activated, false);
  assert.match(result.receipt, /计划尚未启用/);
  assert.equal((paused.sheets.at(-1) as { Status: string }).Status, 'Paused');
  assert.equal(paused.calls.enable, 0);

  const later = provisionHarness();
  await later.deps.saveProgress({
    bindingUuid: BINDING,
    messageId: 'msg-1',
    contentRevision: 'rev-1',
    state: 'ready',
    autopilotId: 'ap_12345678',
    triggerId: 'tg_12345678',
    pendingConfirmation: false,
    updatedAt: '2026-10-29T00:00:00.000Z',
  });
  later.autopilots.push({ id: 'ap_12345678', description: `PAI_BINDING:${BINDING}`, triggers: [] });
  const done = await provisionMulticaScheduledTask({ ...later.input, scheduleOnly: true }, later.deps);
  assert.equal(done.activated, true);
  assert.equal(later.calls.create, 0);
  assert.equal(later.calls.webhook, 0);
});

test('Apps Script reads row-owned webhook, refuses a copied spreadsheet and returns split delivery fields', () => {
  const appScript = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../app-script-template.gs'), 'utf8');
  const cells = { webhook: WEBHOOK, state: 'ready' };
  const sheet = {
    getDataRange() {
      return { getDisplayValues: () => [[
        'ID', 'Agent_Binding_ID', 'Agent_Multica_Webhook_URL', 'Agent_Multica_Spreadsheet_ID', 'Agent_Provision_State', 'Agent_Multica_Api_Origin', 'Agent_Content_Revision',
      ], [
        'msg-1', BINDING, cells.webhook, 'sheet-a', cells.state, API, 'rev-1',
      ]] };
    },
    getLastColumn: () => 6,
    getRange(_row: number, col: number) {
      return {
        getDisplayValues: () => [['ID', 'Agent_Binding_ID', 'Agent_Multica_Webhook_URL', 'Agent_Multica_Spreadsheet_ID', 'Agent_Provision_State', 'Agent_Multica_Api_Origin', 'Agent_Content_Revision']],
        setValue(value: string) {
          if (col === 3) cells.webhook = value;
          if (col === 5) cells.state = value;
        },
      };
    },
  };
  const context: Record<string, unknown> = {
    result: null,
    cells,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => 'sheet-b', getSheetByName: () => sheet }),
    },
    Logger: { log() {} },
    Utilities: {},
    MULTICA_CLAIM_CONTEXT: null,
    MULTICA_DELIVERY_NOTE: null,
  };
  vm.createContext(context);
  vm.runInContext(`${appScript}
    MULTICA_CLAIM_CONTEXT = { capability: '${'a'.repeat(64)}', expectedCapability: '${'a'.repeat(64)}', spreadsheetId: 'sheet-b' };
    result = evaluateMulticaClaim({ Push_Method: 'AgentTask', Agent_Provider: 'multica', ID: 'msg-1', Agent_Binding_ID: '${BINDING}', Agent_Multica_Webhook_URL: '${WEBHOOK}', Agent_Multica_Spreadsheet_ID: 'sheet-a', Agent_Multica_Api_Origin: '${API}' });
  `, context);
  const evaluation = context.result as { deliverable: boolean; reason: string };
  assert.equal(evaluation.deliverable, false);
  assert.equal(evaluation.reason, 'spreadsheet');
  assert.equal(cells.webhook, '');
  assert.equal(cells.state, 'needs_reconnect');

  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({ getId: () => 'sheet-a', getSheetByName: () => sheet }),
  };
  cells.webhook = WEBHOOK;
  cells.state = 'ready';
  vm.runInContext(`
    MULTICA_CLAIM_CONTEXT = { capability: '${'ab'.repeat(32)}', expectedCapability: '${'ab'.repeat(32)}', spreadsheetId: 'sheet-a' };
    var row = { Push_Method: 'AgentTask', Agent_Provider: 'multica', Agent_Binding_ID: '${BINDING}', ID: 'msg-1', Agent_Multica_Webhook_URL: '${WEBHOOK}', Agent_Multica_Spreadsheet_ID: 'sheet-a', Agent_Multica_Api_Origin: '${API}', Content: '整理', Schedule_Date: '2026-10-30', Schedule_Time: '09:00' };
    result = buildMulticaAgentTaskClaim(row, 'msg-1', 'exec-1', evaluateMulticaClaim(row));
  `, context);
  const claim = context.result as Record<string, string>;
  assert.equal(claim.agentProvider, 'multica');
  assert.equal(claim.multicaWebhookScheme, 'https');
  assert.equal(claim.multicaWebhookHost, 'api.multica.ai');
  assert.equal(claim.multicaWebhookPath, 'api/webhooks/autopilots/goodtoken');
  assert.equal(Object.prototype.hasOwnProperty.call(claim, 'webhookUrl'), false);
  assert.equal(String(claim.multicaIdempotencyKey).startsWith('pai:'), true);
  vm.runInContext(`
    applyMulticaDeliveryNote({ dispatchState: 'skipped', runId: 'https://evil' }, false);
    result = MULTICA_DELIVERY_NOTE;
  `, context);
  const note = context.result as { logMessage: string };
  assert.match(note.logMessage, /拒绝触发/);
  assert.equal(note.logMessage.includes('evil'), false);
});


test('saved PAT restores workspace resources and remembers account-scoped defaults without exposing PAT', async () => {
  const session = memoryStore();
  const local = memoryStore();
  const sender = { id: 'ext', url: 'chrome-extension://ext/scheduled-messages.html' };
  const called: string[] = [];
  const deps = {
    extensionId: 'ext', session, local,
    clientFactory: (connection: StoredMulticaConnection) => ({
      getMe: async () => ({ id: 'user_fixture', label: 'Fixture' }),
      listWorkspaces: async () => [{ id: 'ws_fixture', slug: 'fixture', name: 'Fixture' }],
      listAgents: async () => { called.push(connection.workspaceId); return [{ id: 'agent_fixture', name: 'Agent' }]; },
      listProjects: async () => [{ id: 'project_fixture', name: 'Project' }],
      listRuntimes: async () => [],
    }) as never,
  };
  const send = (type: string, data?: Record<string, unknown>) => handleMulticaExtensionMessage({ type, data }, sender, deps);
  assert.equal((await send('MULTICA_VERIFY', { apiOrigin: API, webOrigin: 'https://multica.ai', pat: 'private_fixture', remember: true })).success, true);
  assert.equal((await send('MULTICA_SELECT_WORKSPACE', { workspaceId: 'ws_fixture', workspaceSlug: 'fixture' })).success, true);
  assert.equal((await send('MULTICA_SAVE_DEFAULTS', { agentId: 'agent_fixture', projectId: 'project_fixture' })).success, true);
  const restored = await send('MULTICA_RESTORE');
  assert.equal(restored.success, true);
  assert.equal(restored.connection?.workspaceId, 'ws_fixture');
  assert.equal(restored.defaults?.projectId, 'project_fixture');
  assert.equal(restored.agents?.[0].id, 'agent_fixture');
  assert.equal(JSON.stringify(restored).includes('private_fixture'), false);
  assert.ok(called.every(id => id === 'ws_fixture'));
  assert.equal((await send('MULTICA_RESTORE', { apiOrigin: 'http://other.test' })).code, 'connection_mismatch');
  assert.equal((await send('MULTICA_RESTORE', { userId: 'other_user' })).code, 'connection_mismatch');
  assert.equal((await send('MULTICA_RESTORE', { workspaceId: 'other_ws' })).success, false);
  assert.equal((await send('MULTICA_SAVE_DEFAULTS', { projectId: 'not_in_workspace' })).success, false);
  // Empty PAT can revalidate the same saved service, but never a new service.
  assert.equal((await send('MULTICA_VERIFY', { apiOrigin: API, webOrigin: 'https://multica.ai', pat: '', remember: true })).success, true);
  assert.equal((await send('MULTICA_VERIFY', { apiOrigin: 'https://other.test', webOrigin: 'https://other.test', pat: '' })).success, false);
});


function loadSaveModule() {
  // Isolate the Jira JSON-template dependency; use the real save/provision code.
  const source = readFileSync(new URL('../multica/multicaSave.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as Record<string, any> };
  const dependencies: Record<string, unknown> = {
    '../JiraRuleUpdater.js': { JiraRuleUpdater: { getLatestVersion: () => 'fixture' } },
    './multicaContract.js': contractModule,
    './multicaConnection.js': connectionModule,
    './multicaProvision.js': provisionModule,
  };
  const run = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { crypto, console });
  run((name: string) => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

test('replacement pauses and disables the old trigger before creating a fresh binding; retries reuse it', async () => {
  const { saveMulticaScheduledAgentTask } = loadSaveModule();
  const harness = provisionHarness();
  const events: string[] = [];
  const editing = {
    ID: 'msg-1', Agent_Provider: 'multica', Agent_Provision_State: 'ready', Agent_Binding_ID: BINDING,
    Agent_Multica_Autopilot_ID: 'ap_oldfixture', Agent_Multica_Trigger_ID: 'tg_oldfixture',
    Agent_Multica_Api_Origin: API, Agent_Multica_Web_Origin: 'https://multica.ai',
    Agent_Multica_Workspace_ID: 'ws_12345678', Agent_Multica_Workspace_Slug: 'personal',
    Agent_Multica_User_ID: 'user_12345678', Agent_Multica_Agent_ID: 'ag_12345678', Content: 'old',
  };
  let current = { ...editing };
  const service = {
    updateMessage: async (_id: string, fields: any) => { events.push(fields.Exec_Log || 'update'); current = { ...current, ...fields }; return current; },
    upsertConfigValue: async () => undefined,
    upsertMulticaBinding: async (record: any) => harness.bindings.push(record),
  };
  const patch = harness.deps.remote.patchTrigger;
  harness.deps.remote.patchTrigger = async input => { events.push(`trigger:${input.autopilotId}:${input.enabled}`); await patch(input); };
  const form = {
    ...editing, Content: 'new task', Agent_Binding_ID: '22222222-2222-4222-8222-222222222222',
    Multica_Connection_Ready: true, Agent_Multica_Project_ID: '',
  };
  const input = { service, editing, form, spreadsheetId: 'sheet-1', local: memoryStore(), remote: harness.deps.remote, updateJiraRule: async () => true };
  await saveMulticaScheduledAgentTask(input);
  assert.match(events[0], /计划已暂停/);
  assert.equal(events[1], 'trigger:ap_oldfixture:false');
  assert.equal(harness.calls.create, 1);
  assert.equal(harness.bindings[0].bindingUuid, form.Agent_Binding_ID);
  assert.notEqual(current.Agent_Multica_Autopilot_ID, editing.Agent_Multica_Autopilot_ID);
  await saveMulticaScheduledAgentTask(input);
  assert.equal(harness.calls.create, 1, 'retry must reuse the replacement progress');
});

test('failed trigger retirement leaves Sheet paused and prevents any new provisioning', async () => {
  const { retireMulticaScheduledBinding } = loadSaveModule();
  const events: string[] = [];
  await assert.rejects(retireMulticaScheduledBinding({
    updateMessage: async (_id: string, fields: any) => events.push(fields.Status),
  }, { ID: 'msg-1', Agent_Multica_Autopilot_ID: 'ap_oldfixture', Agent_Multica_Trigger_ID: 'tg_oldfixture' }, {
    patchTrigger: async () => { events.push('disable'); throw new Error('offline'); },
  }), /offline/);
  assert.deepEqual(events, ['Paused', 'disable']);
});


test('uncertain replacement clears old public IDs and retains its new binding for recovery', async () => {
  const { saveMulticaScheduledAgentTask } = loadSaveModule();
  const harness = provisionHarness({ failCreate: new MulticaApiError('timeout', 0, 'network') });
  const editing = {
    ID: 'msg-1', Agent_Provider: 'multica', Agent_Provision_State: 'ready', Agent_Binding_ID: BINDING,
    Agent_Multica_Autopilot_ID: 'ap_oldfixture', Agent_Multica_Trigger_ID: 'tg_oldfixture',
    Agent_Multica_Api_Origin: API, Agent_Multica_Web_Origin: 'https://multica.ai',
    Agent_Multica_Workspace_ID: 'ws_12345678', Agent_Multica_Workspace_Slug: 'personal',
    Agent_Multica_User_ID: 'user_12345678', Agent_Multica_Agent_ID: 'ag_12345678', Content: 'old',
  };
  let current: any = editing;
  const input = {
    service: {
      updateMessage: async (_id: string, fields: any) => { current = { ...current, ...fields }; return current; },
      upsertConfigValue: async () => undefined,
    }, editing,
    form: { ...editing, Agent_Binding_ID: '22222222-2222-4222-8222-222222222222', Multica_Connection_Ready: true },
    spreadsheetId: 'sheet-1', local: memoryStore(), remote: harness.deps.remote,
  };
  await assert.rejects(saveMulticaScheduledAgentTask(input), /timeout/);
  assert.equal(current.Status, 'Paused');
  assert.equal(current.Agent_Multica_Autopilot_ID, '');
  assert.equal(current.Agent_Multica_Trigger_ID, '');
  assert.equal(current.Agent_Binding_ID, input.form.Agent_Binding_ID);
  await assert.rejects(saveMulticaScheduledAgentTask({ ...input, editing: current }), /还未确认/);
  assert.equal(harness.calls.create, 1);
});
