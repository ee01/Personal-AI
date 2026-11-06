import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

// Real built extension + real Schedule auth, with controlled Resend and a
// TEST-ONLY ticket protocol shim. This is not deployed protocol/mail evidence.
const source = path.resolve(process.env.SCHEDULE_SOURCE || '../personal-schedule/service');
const { openDb } = await import(pathToFileURL(path.join(source, 'src/db.js')));
const { buildApp } = await import(pathToFileURL(path.join(source, 'src/server.js')));
const { config } = await import(pathToFileURL(path.join(source, 'src/config.js')));
const { sha256Hex } = await import(pathToFileURL(path.join(source, 'src/util.js')));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'schedule-auth-browser-'));
const db = openDb(':memory:');
const { app, services } = buildApp(db);
const contexts = [];
const codes = new Map(), tickets = new Map(), observed = [];
let enableProtocol = false, lastRedeemed, ticketCount = 0, server, base;
const originalFetch = globalThis.fetch;
config.authResendApiKey = 'fixture-only-key'; config.authResendFrom = 'fixture@example.test';
config.authResendIntervalSec = 0; config.authDevFallback = false;
globalThis.fetch = async (url, init) => {
  if (url === 'https://api.resend.com/emails') {
    const data = JSON.parse(init.body); codes.set(data.to[0], data.text.match(/\d{6}/)[0]);
    return new Response('{}', { status: 200 });
  }
  return originalFetch(url, init);
};
const meta = app.routes.find(r => r.method === 'GET' && r.pattern.test('/api/v1/auth/meta'));
const metaHandler = meta.handler;
meta.handler = req => ({ ...metaHandler(req), extensionLogin: { schemaVersion: 1, enabled: enableProtocol } });
app.post('/api/v1/auth/extension/ticket', req => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const user = services.auth.userByBearer(token);
  if (!user || req.body.origin !== new URL(base).origin) throw new Error('fixture unauthorized');
  const ticket = randomBytes(32).toString('base64url'); ticketCount++;
  const record = { token, user, requestId: req.body.requestId, expiresAt: Date.now() + 30000 };
  tickets.set(ticket, record);
  return { ticket, requestId: record.requestId, expiresAt: record.expiresAt };
});
app.post('/api/v1/auth/extension/redeem', (req, res) => {
  const record = tickets.get(req.body.ticket);
  if (!record || record.expiresAt <= Date.now() || record.requestId !== req.body.requestId ||
      req.headers.origin !== new URL(base).origin || !services.auth.userByBearer(record.token)) {
    res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{}'); return;
  }
  tickets.delete(req.body.ticket); lastRedeemed = req.body;
  const session = services.auth.createSession(record.user.id, services.auth.tokenIdByBearer(record.token));
  res.setHeader('Set-Cookie', `ps_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return { user: { id: record.user.id, email: record.user.email } };
});
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(temp, 'key.pem'),
    '-out', path.join(temp, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  const cert = await fs.readFile(path.join(temp, 'cert.pem'));
  const pub = execFileSync('openssl', ['x509', '-pubkey', '-noout'], { input: cert });
  const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'DER'], { input: pub });
  const pin = createHash('sha256').update(der).digest('base64');
  server = https.createServer({ cert, key: await fs.readFile(path.join(temp, 'key.pem')) }, (req, res) => app.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `https://localhost:${server.address().port}`;
  async function browser(name) {
    const ctx = await playwright.chromium.launchPersistentContext(path.join(temp, name), { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`,
        `--ignore-certificate-errors-spki-list=${pin}`] }); // trust ONLY this ephemeral fixture key
    contexts.push(ctx);
    let [worker] = ctx.serviceWorkers(); if (!worker) worker = await ctx.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const options = await ctx.newPage(); await options.goto(`chrome-extension://${id}/options.html`);
    return { ctx, worker, options };
  }
  const email = 'fixture@ringcentral.com';
  async function bind(b) {
    const panel = b.options.locator('#personal-schedule-config');
    await panel.getByLabel('Schedule 服务地址', {exact:true}).fill(base);
    await panel.getByLabel('Schedule 登录邮箱', {exact:true}).fill(email);
    await panel.getByRole('button', {name:'发送邮箱验证码',exact:true}).click();
    await panel.getByRole('status').filter({hasText:'验证码已发送'}).waitFor();
    await panel.getByLabel('Schedule 邮箱验证码', {exact:true}).fill(codes.get(email));
    await panel.getByRole('button', {name:'验证邮箱并绑定此设备',exact:true}).click();
    await panel.getByRole('status').filter({hasText:`已绑定 ${email}`}).waitFor();
    assert.equal(await panel.getByLabel('Schedule 邮箱验证码', {exact:true}).inputValue(), '');
    assert(!(await panel.innerText()).includes('pst_'));
  }
  const first = await browser('first');
  const unbound = await first.options.evaluate(({base, email}) => chrome.runtime.sendMessage({ type: 'SCHEDULE_ACCOUNT_AUTH',
    action: 'verify-code', baseUrl: base, email, code: '123456' }), {base, email});
  assert.equal(unbound.success, false); assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 0);
  await bind(first);
  const accountId = db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
  assert.equal(db.prepare('SELECT count(*) n FROM tokens').get().n, 1);
  const page = await first.ctx.newPage();
  // Use a quiet document, but load the REAL compiled content script via its
  // registered custom origin. This avoids guest execution in the current web.
  await first.ctx.route(`${base}/app`, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Schedule auth fixture<script>window.authMessages=[];addEventListener("message",e=>authMessages.push(e.data));</script></body></html>' }));
  await first.ctx.clearCookies(); await page.goto(`${base}/app`);
  await page.waitForTimeout(400);
  assert.equal(ticketCount, 0, 'missing protocol must not issue tickets');
  enableProtocol = true;
  const redemption = page.waitForResponse(r => r.url().endsWith('/auth/extension/redeem') && r.status() === 200);
  await page.reload();
  await redemption;
  await page.waitForEvent('load');
  await page.waitForFunction(async () => (await fetch('/api/v1/me')).ok);
  assert.equal(ticketCount, 1);
  assert.equal((await page.evaluate(async () => (await fetch('/api/v1/me')).json())).id, accountId);
  const cookie = (await first.ctx.cookies()).find(c => c.name === 'ps_session'); assert(cookie.httpOnly && cookie.secure);
  assert(!(await page.evaluate(() => document.cookie)).includes('ps_session'));
  const replay = await page.evaluate(async body => (await fetch('/api/v1/auth/extension/redeem', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, lastRedeemed);
  assert.equal(replay, 400);
  observed.push(...await page.evaluate(() => window.authMessages));
  // New profile has no local connection; repeating verified email binds a
  // separate credential to the SAME real user, independently of Chrome Sync.
  const second = await browser('second');
  assert.equal(await second.worker.evaluate(async () => Boolean((await chrome.storage.local.get('personalScheduleConnection')).personalScheduleConnection)), false);
  await bind(second);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM tokens').get().n, 2);
  // Revoke first device using its exact token hash; fresh bridge fails closed.
  const firstToken = await first.worker.evaluate(async () => (await chrome.storage.local.get('personalScheduleConnection')).personalScheduleConnection.token);
  const tokenId = db.prepare('SELECT id FROM tokens WHERE token_hash=?').get(sha256Hex(firstToken)).id;
  db.prepare('DELETE FROM tokens WHERE id=?').run(tokenId); services.auth.destroySessionsForToken(tokenId);
  assert.equal(await page.evaluate(async () => (await fetch('/api/v1/me')).status), 401);
  await page.reload(); await page.waitForTimeout(300); assert.equal(ticketCount, 1);
  assert(!JSON.stringify(observed).includes('pst_')); assert(!JSON.stringify(observed).includes(lastRedeemed.ticket));
  // An HTTP deployment cannot turn on the auto bridge even with a saved
  // credential and capability. Import-only legacy connections remain separate.
  const httpBase = 'http://schedule-insecure.fixture.test';
  await first.ctx.route(`${httpBase}/**`, route => route.fulfill({ contentType: 'text/html', body: '<html><body>HTTP fixture<script>window.authMessages=[];addEventListener("message",e=>authMessages.push(e.data));</script></body></html>' }));
  await first.worker.evaluate(async baseUrl => {
    const stored = await chrome.storage.local.get('personalScheduleConnection');
    await chrome.storage.local.set({ personalScheduleConnection: { ...stored.personalScheduleConnection, baseUrl } });
  }, httpBase);
  const httpPage = await first.ctx.newPage(); await httpPage.goto(`${httpBase}/app`);
  await first.options.evaluate(() => chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' }));
  await httpPage.evaluate(() => window.postMessage({ channel: 'personal-schedule-extension-v1', type: 'login-request' }, location.origin));
  await httpPage.waitForTimeout(100);
  assert.equal(ticketCount, 1); assert.equal((await httpPage.evaluate(() => window.authMessages)).some(m => m.type === 'ready'), false);
  const shots = path.resolve('test-results/schedule-auth'); await fs.mkdir(shots, { recursive: true });
  await first.options.locator('#personal-schedule-config').scrollIntoViewIfNeeded();
  await first.options.locator('#personal-schedule-config').screenshot({ path: path.join(shots, 'email-device-binding.png') });
  console.log('Actual extension + actual local Schedule email/PAT/session APIs: first verified binding, independent second profile same account, cookie isolation and revoke passed. TEST-ONLY single-use shim: missing capability, automatic ticket redemption and replay rejection passed. Resend is controlled; HTTPS fixture certificate is explicitly pinned; no deployed login claim.');
} finally {
  for (const context of contexts) await context.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = originalFetch; db.close(); await fs.rm(temp, { recursive: true, force: true });
}
