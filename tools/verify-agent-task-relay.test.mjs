import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { executionHarness } from './helpers/appscript-execution-harness.mjs';

const workflow = yaml.load(fs.readFileSync('src/scheduled-messages/dify/http-relay.yml', 'utf8'));
const nodes = workflow.workflow.graph.nodes;
const node = id => nodes.find(item => item.id === id).data;
const capability = 'a'.repeat(64);
const request = (extra = {}) => ({ version: 1, requestId: 'ek_fixture', method: 'POST',
  url: 'http://task.xmnup.com/api/webhooks/autopilots/secret_hook',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'pai:fixture' },
  body: JSON.stringify({ task: 'Quotes " and Unicode 中文\nnext line' }), ...extra });
const routes = workflow.workflow.environment_variables[0].value;
function python(id, input) {
  const code = node(id).code + '\nimport sys\nprint(json.dumps(main(**json.load(sys.stdin))))\n';
  const result = spawnSync('python3', ['-c', code], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const validate = r => python('validate', { request_json: JSON.stringify(r), allowed_routes_json: routes });
const receipt = (body, status = 202, r = request()) => python('post_receipt', {
  request_id: r.requestId, request_json: JSON.stringify(r), status_code: status, body: JSON.stringify(body),
});

function ready(provider = 'multica') {
  const h = executionHarness({ configRows: [['Key', 'Value'], ['multica_scheduler_capability', capability]], properties: {
    AGENT_TASK_MEMORY_URL: 'http://10.32.56.212:3210/api/v1/agent-tasks/execute',
    AGENT_TASK_MEMORY_API_KEY: 'memory_secret', AGENT_TASK_MEMORY_USER_ID: 'fixture_user',
  } });
  h.initialize(); h.activate(); h.setCell('Push_Method', 'AgentTask');
  const claim = h.claim();
  assert.equal(claim.success, true);
  const key = claim.executionKey;
  h.context.rememberAgentTaskRelayClaim('M1', key, provider);
  const confirm = (extra = {}) => h.context.confirmAgentTaskRelay({ capability, executionKey: key, requestId: key,
    messageId: 'M1', rowIndex: 2, transportOk: 'true', statusCode: '202',
    responseBody: JSON.stringify(provider === 'multica' ? { status: 'accepted', run_id: 'run_fixture' } : { accepted: true, actionId: 'action_fixture' }), ...extra });
  return { h, key, confirm };
}

test('generated YAML embeds tested code, branches before HTTP, disables retry and verifies TLS', () => {
  assert.equal(node('validate').code, fs.readFileSync('src/scheduled-messages/dify/http-relay/validate.py', 'utf8'));
  assert.equal(node('post_receipt').code, fs.readFileSync('src/scheduled-messages/dify/http-relay/response.py', 'utf8'));
  assert.equal(nodes.filter(n => n.data.type === 'http-request').length, 2);
  for (const id of ['get', 'post']) {
    assert.equal(node(id).ssl_verify, true);
    assert.equal(node(id).retry_config.retry_enabled, false);
    assert.equal(node(id).retry_config.max_retries, 0);
    assert.equal(node(id).error_strategy, undefined, 'keep actual HTTP rejection status instead of replacing it with defaults');
  }
  assert.equal(nodes.some(n => /llm|agent/.test(n.data.type)), false);
  assert.equal(workflow.workflow.graph.edges.some(e => e.source === 'valid' && e.sourceHandle === 'false' && e.target === 'rejected_receipt'), true);
});

test('relay accepts only route-bound targets, headers and supported methods', () => {
  assert.equal(validate(request()).ok, 'true');
  const memory = request({ url: 'http://10.32.56.212:3210/api/v1/agent-tasks/execute', headers: { Authorization: 'Bearer memory_secret', 'X-User-Id': 'fixture' } });
  assert.equal(validate(memory).ok, 'true');
  for (const change of [
    { url: 'http://evil.example/api/webhooks/autopilots/secret_hook' },
    { url: 'http://task.xmnup.com.evil.example/api/webhooks/autopilots/secret_hook' },
    { url: 'http://task.xmnup.com/api/webhooks/autopilots/../admin' },
    { url: 'http://task.xmnup.com/api/webhooks/autopilots/%2e%2e/admin' },
    { url: 'http://user@task.xmnup.com/api/webhooks/autopilots/secret_hook' },
    { headers: { Authorization: 'Bearer memory_secret' } },
    { headers: { Host: 'evil.example' } },
    { headers: { 'Content-Type': 'application/json\r\nHost: evil.example' } },
    { method: 'DELETE' }, { method: 'GET' }, { version: 2 }, { body: {} },
  ]) {
    const result = validate(request(change));
    assert.equal(result.ok, 'false', JSON.stringify(change));
    assert.equal(result.url, '');
    assert.equal(result.headers, '');
  }
});

test('transport receipt preserves business fields, redacts secrets and bounds callback size', () => {
  const r = request({ headers: { Authorization: 'Bearer private_pat' } });
  const result = receipt({ accepted: true, actionId: 'action_fixture', echoed: 'Bearer private_pat', webhook: r.url }, 202, r);
  assert.equal(result.transportOk, 'true');
  assert.equal(JSON.parse(result.responseBody).actionId, 'action_fixture');
  assert.doesNotMatch(JSON.stringify(result), /private_pat|secret_hook/);
  assert.equal(receipt({ result: 'x'.repeat(3000) }).errorCode, 'response_too_large');
  assert.equal(receipt({}, 0).transportOk, 'false');
});

test('both provider receipts settle atomically and duplicate confirmations count once', () => {
  for (const provider of ['multica', 'legacy_memory']) {
    const { h, confirm } = ready(provider);
    assert.equal(confirm().success, true);
    assert.equal(confirm().duplicate, true);
    assert.equal(h.cell('Exec_Count'), '1');
    assert.equal(h.records()[0].state, 'CONFIRMED');
    assert.doesNotMatch(JSON.stringify(h.records()), /memory_secret|secret_hook|Authorization/);
  }
});

test('capability, occurrence and message correlation are checked before accounting', () => {
  const { h, confirm } = ready();
  for (const change of [{ capability: '' }, { requestId: 'other' }, { executionKey: 'other' }, { messageId: 'OTHER' }]) {
    assert.equal(confirm(change).success, false);
    assert.equal(h.cell('Exec_Count'), '0');
  }
  h.setCell('Push_Method', 'AI'); // Receipt uses frozen provider, not today's edited row.
  assert.equal(confirm().success, true);
});

test('rejections fail but timeouts, invalid JSON and missing run IDs remain unresolved without replay', () => {
  for (const response of [
    { statusCode: '401', responseBody: 'secret must not be logged' },
    { responseBody: '{"status":"skipped"}' }, { responseBody: '{"status":"ignored"}' },
    { transportOk: 'false', errorCode: 'validation_rejected' },
  ]) {
    const { h, confirm } = ready();
    assert.equal(confirm(response).success, true);
    assert.equal(h.records()[0].state, 'FAILED');
    assert.doesNotMatch(String(h.cell('Exec_Log')), /secret must/);
  }
  for (const response of [
    { transportOk: 'false', statusCode: '0' }, { statusCode: '500' }, { responseBody: '<html>oops</html>' },
    { responseBody: '{"status":"duplicate"}' }, { responseBody: 'x'.repeat(2049) },
  ]) {
    const { h, confirm } = ready();
    assert.equal(confirm(response).unconfirmed, true);
    assert.equal(h.cell('Exec_Count'), '0');
    assert.equal(h.records()[0].state, 'CLAIMED');
    assert.equal(h.claim('another_key').duplicate, true);
  }
});

test('Memory envelope uses Script Properties and ignores row URL/header attempts to move the key', () => {
  const { h } = ready('legacy_memory');
  const message = { ID: 'M1', Push_Method: 'AgentTask', Topic: 'hello', Content: 'quoted "task" 中文\nline',
    AI_Endpoint: 'http://evil.example/execute', AI_Headers: 'Authorization: Bearer evil', Agent_Mode: 'read' };
  assert.throws(() => h.context.buildAgentTaskRelayRequest(message, 'M1', 'ek_fixture', {}), /capability/);
  const built = h.context.buildAgentTaskRelayRequest(message, 'M1', 'ek_fixture', { capability });
  const envelope = JSON.parse(built.relayRequestJson);
  assert.equal(envelope.url, 'http://10.32.56.212:3210/api/v1/agent-tasks/execute');
  assert.equal(envelope.headers.Authorization, 'Bearer memory_secret');
  assert.equal(envelope.headers['X-User-Id'], 'fixture_user');
  assert.equal(JSON.parse(envelope.body).task, message.Content);
  assert.equal(envelope.requestId, 'ek_fixture');
});

test('GET/POST workflow fixtures forward exact payload and idempotency through a real local HTTP server', async () => {
  const received = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({ method: req.method, body, key: req.headers['idempotency-key'] });
    res.writeHead(202, { 'Content-Type': 'application/json' }).end('{"status":"accepted","run_id":"run_fixture"}');
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const allowed = JSON.stringify([{ origin, path: '/fixture', methods: ['GET', 'POST'], allowedHeaders: ['content-type', 'idempotency-key'] }]);
    for (const method of ['GET', 'POST']) {
      const r = request({ url: `${origin}/fixture`, method, body: method === 'GET' ? '' : request().body });
      const valid = python('validate', { request_json: JSON.stringify(r), allowed_routes_json: allowed });
      assert.equal(valid.ok, 'true');
      const response = await fetch(valid.url, { method: valid.method, headers: r.headers, body: valid.method === 'GET' ? undefined : valid.body, redirect: 'error' });
      const output = python(`${method.toLowerCase()}_receipt`, { request_id: valid.request_id, status_code: response.status,
        body: await response.text(), request_json: JSON.stringify(r) });
      const { h, confirm } = ready();
      assert.equal(confirm({ ...output, requestId: h.records()[0].executionKey }).success, true);
    }
    assert.deepEqual(received.map(r => r.method), ['GET', 'POST']);
    assert.equal(received[1].body, request().body);
    assert.ok(received.every(r => r.key === 'pai:fixture'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('real polling returns one protected envelope, persists its provider and old callback cannot bypass authorization', () => {
  for (const provider of ['legacy_memory', 'multica']) {
    const h = executionHarness({ configRows: [['Key', 'Value'], ['multica_scheduler_capability', capability]], properties: {
      AGENT_TASK_MEMORY_URL: 'http://10.32.56.212:3210/api/v1/agent-tasks/execute',
      AGENT_TASK_MEMORY_API_KEY: 'memory_secret', AGENT_TASK_MEMORY_USER_ID: 'fixture_user',
    } });
    h.initialize(); h.activate(); h.setCell('Push_Method', 'AgentTask');
    if (provider === 'multica') {
      h.headers.push('Agent_Provider', 'Agent_Binding_ID');
      h.table('Messages').rows[0].push('Agent_Provider', 'Agent_Binding_ID');
      h.setCell('Agent_Provider', 'multica'); h.setCell('Agent_Binding_ID', 'fixture_binding');
      h.context.readMulticaBindingById = () => ({ bindingUuid: 'fixture_binding', spreadsheetId: 'test-book',
        apiOrigin: 'http://task.xmnup.com', webhookUrl: 'http://task.xmnup.com/api/webhooks/autopilots/secret_hook', provisionState: 'ready' });
    }
    const poll = params => h.context.getMessageCurrentTimeWithReleaseInfo({ currentTime: '2026-10-23 09:00', autoMarkOnFetch: 'api', agentTaskRelay: '1', ...params });
    const denied = poll({ capability: '' });
    assert.notEqual(denied.executed, true);
    assert.equal(h.records().length, 0);
    const first = poll({ capability });
    assert.equal(first.executed, true, JSON.stringify(first));
    assert.equal(first.agentProvider, provider);
    const envelope = JSON.parse(first.relayRequestJson);
    assert.equal(envelope.requestId, first.executionKey);
    assert.equal(envelope.method, 'POST');
    assert.equal(h.records()[0].agentTaskRelay.provider, provider);
    assert.equal(h.cell('Exec_Count'), '0');
    assert.equal(h.confirm(first.executionKey).success, false, 'old mark endpoint cannot settle a relay occurrence');
    assert.notEqual(poll({ capability }).executed, true, 'same poll cannot authorize another send');
    const raw = provider === 'multica' ? { status: 'duplicate', run_id: 'run_fixture' } : { accepted: true, actionId: 'action_fixture' };
    assert.equal(h.context.confirmAgentTaskRelay({ capability, messageId: first.messageId, executionKey: first.executionKey,
      requestId: first.executionKey, statusCode: '202', transportOk: 'true', responseBody: JSON.stringify(raw) }).success, true);
    assert.equal(h.cell('Exec_Count'), '1');
  }
});

test('rule capability setup preserves the Sheet authority across devices and fails on unauthorized writes', async () => {
  const source = ts.transpileModule(fs.readFileSync('src/scheduled-messages/agentTaskRelayConfig.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const writes = [];
  const cache = {};
  let values = [['Key', 'Value'], ['multica_scheduler_capability', capability]];
  let failWrite = false;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
    crypto: webcrypto, chrome: { storage: { local: { set: async data => Object.assign(cache, data) } } },
    fetch: async (url, init) => {
      if (!init.method) return { ok: true, json: async () => ({ values }) };
      writes.push({ url, init });
      return { ok: !failWrite, status: 403 };
    },
  })(() => ({ GOOGLE_AUTH_SCOPE_SETS: { SHEETS: [] }, getGoogleAuthTokenSilently: async () => 'fixture_oauth' }), module, module.exports);
  const setup = module.exports.ensureAgentTaskRelayCapability;
  assert.equal(await setup('test-book'), capability);
  assert.equal(writes.length, 0, 'valid Sheet capability must never be rotated');
  assert.equal(cache.multicaSchedulerCapability, capability);
  values = [['Key', 'Value']];
  const created = await setup('test-book');
  assert.match(created, /^[a-f0-9]{64}$/);
  assert.match(writes[0].url, /append/);
  assert.equal(JSON.parse(writes[0].init.body).values[0][1], created);
  failWrite = true;
  await assert.rejects(setup('test-book'), /403/);
});
