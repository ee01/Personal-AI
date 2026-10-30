import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

// Exercise native WorkerGlobalScope.fetch, not an injected fetch mock.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-multica-e2e-'));
const servers = [];
const received = [];
let context;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', path.join(temporary, 'key.pem'), '-out', path.join(temporary, 'cert.pem'),
    '-days', '1', '-subj', '/CN=multica.test'], { stdio: 'ignore' });
  const handler = (req, res) => {
    received.push({ path: req.url, auth: req.headers.authorization, workspace: req.headers['x-workspace-id'] });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/me' && req.headers.authorization === 'Bearer rejected_fixture') {
      res.writeHead(401).end(JSON.stringify({ error: 'invalid token' }));
    } else if (req.url === '/api/me') {
      res.end(JSON.stringify({ id: 'user_fixture', email: 'fixture@example.test' }));
    } else if (req.url === '/api/workspaces') {
      res.end(JSON.stringify([{ id: 'ws_fixture', slug: 'fixture', name: 'Fixture' }]));
    } else if (req.url === '/api/agents') {
      res.end(JSON.stringify([{ id: 'agent_fixture', name: 'Fixture agent' }]));
    } else if (req.url === '/api/projects' || req.url === '/api/runtimes') {
      res.end('[]');
    } else {
      res.writeHead(404).end('{}');
    }
  };
  servers.push(http.createServer(handler), https.createServer({
    key: await fs.readFile(path.join(temporary, 'key.pem')),
    cert: await fs.readFile(path.join(temporary, 'cert.pem')),
  }, handler));
  for (const server of servers) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context = await playwright.chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${path.join(root, 'dist')}`,
      `--load-extension=${path.join(root, 'dist')}`, '--ignore-certificate-errors',
      '--host-resolver-rules=MAP multica.test 127.0.0.1', '--no-proxy-server'],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const send = (type, data) => page.evaluate(({ type, data }) =>
    new Promise(resolve => chrome.runtime.sendMessage({ type, data }, resolve)), { type, data });
  for (const [index, scheme] of ['http', 'https'].entries()) {
    const origin = `${scheme}://multica.test:${servers[index].address().port}`;
    const count = received.length;
    const result = await send('MULTICA_VERIFY', {
      apiOrigin: origin, webOrigin: origin, pat: 'fixture_pat', remember: false,
    });
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(result.connection.apiOrigin, origin);
    assert.equal(result.workspaces[0].id, 'ws_fixture');
    assert.equal(JSON.stringify(result).includes('fixture_pat'), false);
    assert.deepEqual(received.slice(count).map(item => item.path), ['/api/me', '/api/workspaces']);
    assert.ok(received.slice(count).every(item => item.auth === 'Bearer fixture_pat'));
    assert.equal((await send('MULTICA_SELECT_WORKSPACE', {
      workspaceId: 'ws_fixture', workspaceSlug: 'fixture',
    })).success, true);
    const resources = await send('MULTICA_LIST_RESOURCES');
    assert.equal(resources.success, true, JSON.stringify(resources));
    assert.equal(resources.agents[0].id, 'agent_fixture');
    assert.ok(received.slice(-3).every(item => item.workspace === 'ws_fixture'));
    const rejected = await send('MULTICA_VERIFY', {
      apiOrigin: origin, webOrigin: origin, pat: 'rejected_fixture',
    });
    assert.equal(rejected.success, false);
    assert.match(rejected.error, /401/);
    assert.equal(context.pages().length, 2, 'transport must not open origin tabs');
    console.log(`${scheme.toUpperCase()}: verify, workspaces, resources and 401 propagation passed`);
  }
  assert.equal((await send('MULTICA_DISCONNECT')).success, true);
} finally {
  await context?.close();
  for (const server of servers) await new Promise(resolve => server.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true });
}
