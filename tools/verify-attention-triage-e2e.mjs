import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../desktop-app/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const diagnostics = [];
const seen = [];
const decisions = [];
const identity = [];
let failNext = true;
const items = Array.from({ length: 5 }, (_, i) => ({
  id: `item-${i}`,
  postId: `post-${i}`,
  title: `提交第 ${i + 1} 项季度目标`,
  due_at: Math.floor(Date.now() / 1000) + 4 * 86400,
  addressed_to: 'team_including_me',
  reasons_json: '["matched_rule","explicit_deadline"]',
  managerChip: i === 4,
  sender_entity_id: 'manager',
}));
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  diagnostics.push(`HTTP ${req.method} ${url.pathname}`);
  if (url.pathname === '/api/v1/attention') {
    seen.push(url.searchParams.get('postIds'));
    const ids = (url.searchParams.get('postIds') ?? '').split(',');
    res.end(
      JSON.stringify({
        mode: 'remind',
        items: items.filter((i) => ids.includes(i.postId)),
      }),
    );
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  let data = {};
  try {
    data = JSON.parse(body || '{}');
  } catch {}
  if (url.pathname.endsWith('/decision')) {
    if (failNext) {
      failNext = false;
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'offline_fixture' }));
      return;
    }
    decisions.push(data.verdict);
    res.end(
      JSON.stringify({
        item: {
          status: ['accepted', 'remind'].includes(data.verdict)
            ? 'armed'
            : data.verdict === 'not_relevant'
            ? 'dismissed'
            : data.verdict,
        },
      }),
    );
    return;
  }
  if (url.pathname.endsWith('/identity')) {
    identity.push(data);
    res.end(JSON.stringify({ item: data }));
    return;
  }
  res.end(JSON.stringify({ items: [], status: 'ok' }));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-attention-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${path.resolve('dist')}`,
      `--load-extension=${path.resolve('dist')}`,
    ],
    viewport: { width: 1100, height: 1100 },
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (base) => {
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: base,
        MEMORY_SERVICE_API_KEY: 'fixture-key',
        MEMORY_SERVICE_BOOTSTRAP_KEY: '',
      },
      userinfo: { username: 'attention-fixture' },
      memoryServiceDeviceKey: {
        userId: 'attention-fixture',
        token: 'fixture-key',
        id: 'fixture',
        deviceId: 'fixture',
        keyPrefix: 'fixture',
        label: 'fixture',
        createdAt: Date.now(),
      },
      RADAR_POC_CONFIG: { CONTEXT_LENS_ENABLED: true },
    });
  }, `http://127.0.0.1:${port}/api/v1`);
  const configPage = await context.newPage();
  await configPage.goto(new URL('popup.html', worker.url()).href);
  await configPage.evaluate(
    async (base) =>
      new Promise((resolve) =>
        chrome.runtime.sendMessage(
          {
            type: 'UPDATE_ENV_CONFIG',
            config: {
              MEMORY_SERVICE_BASE_URL: base,
              MEMORY_SERVICE_API_KEY: 'fixture-key',
              MEMORY_SERVICE_BOOTSTRAP_KEY: '',
            },
          },
          resolve,
        ),
      ),
    `http://127.0.0.1:${port}/api/v1`,
  );
  await configPage.close();
  await context.route('https://app.ringcentral.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><main>${items
        .map(
          (i) =>
            `<article class="conversation-card-wrapper" data-id="${i.postId}" style="min-height:140px;border-bottom:1px solid #ccc">Team: Please submit quarterly goals by Friday.</article>`,
        )
        .join(
          '',
        )}</main><script>window.hostClicks=0;window.sentReplies=0;document.addEventListener('click',()=>window.hostClicks++);</script></body></html>`,
    }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.exceptionThrown', (e) =>
    diagnostics.push(JSON.stringify(e.exceptionDetails).slice(0, 1200)),
  );
  cdp.on('Log.entryAdded', (e) => diagnostics.push(e.entry.text));
  page.on('pageerror', (e) => diagnostics.push(`ERROR ${e.message}`));
  page.on('console', (m) => {
    diagnostics.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  await page.goto('https://app.ringcentral.com/messages/fixture');
  diagnostics.push(
    await page.evaluate(() =>
      JSON.stringify({
        url: location.href,
        cards: document.querySelectorAll('.conversation-card-wrapper').length,
        visibility: document.visibilityState,
      }),
    ),
  );
  await page.locator('.pai-attention-card').first().waitFor({ timeout: 25000 });
  assert.equal(await page.locator('.pai-attention-card').count(), 5);
  const card = (index) => page.locator(`[data-attention-id="item-${index}"]`);
  for (const label of ['创建待办', '只创建提醒', '已完成', '不相关'])
    assert.equal(
      await card(0).getByRole('button', { name: label, exact: true }).count(),
      1,
    );
  await card(0).getByRole('button', { name: '创建待办', exact: true }).click();
  await card(0)
    .getByRole('status')
    .filter({ hasText: 'offline_fixture' })
    .waitFor();
  await card(0).getByRole('button', { name: '创建待办', exact: true }).click();
  await card(0).getByRole('button', { name: '取消提醒' }).waitFor();
  await card(0).getByRole('button', { name: '取消提醒' }).click();
  await card(1).getByRole('button', { name: '只创建提醒' }).click();
  await card(1).getByRole('button', { name: '取消提醒' }).waitFor();
  await card(2).getByRole('button', { name: '已完成', exact: true }).click();
  await card(2).getByRole('status').filter({ hasText: '已标记完成' }).waitFor();
  await card(3).getByRole('button', { name: '不相关', exact: true }).click();
  await card(3)
    .getByRole('status')
    .filter({ hasText: '同一事项不再出卡' })
    .waitFor();
  await card(4).getByRole('button', { name: '确认发送者是我的上级' }).click();
  await card(4).getByRole('status').filter({ hasText: '上级关系' }).waitFor();
  page.once('dialog', (dialog) => dialog.accept('敏捷教练'));
  await card(4).getByRole('button', { name: '确认我的角色…' }).click();
  await card(4).getByRole('status').filter({ hasText: '确认的角色' }).waitFor();
  assert.equal(
    await card(4).getByRole('button', { name: '确认发送者是我的上级' }).count(),
    0,
  );
  assert.equal(
    await card(4).getByRole('button', { name: '确认我的角色…' }).count(),
    0,
  );
  assert.deepEqual(decisions, [
    'accepted',
    'cancelled',
    'remind',
    'completed',
    'not_relevant',
  ]);
  assert.deepEqual(
    identity.map((x) => x.key),
    ['manager', 'role'],
  );
  assert.ok(seen.length);
  assert.equal(await page.evaluate(() => window.hostClicks), 0);
  assert.equal(await page.evaluate(() => window.sentReplies), 0);
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({
    path: 'test-results/attention-triage.png',
    fullPage: true,
  });
  await worker.evaluate(async () =>
    chrome.storage.local.set({
      RADAR_POC_CONFIG: { CONTEXT_LENS_ENABLED: false },
    }),
  );
  await page.waitForFunction(
    () => document.querySelectorAll('.pai-attention-card').length === 0,
    {},
    { timeout: 12000 },
  );
  console.log(
    'PASS: fresh dist Glip cards; four decisions, retry, cancellation, identity chips, Lens switch; host clicks/replies 0.',
  );
} catch (error) {
  await fs.writeFile(
    '.planning/2026-10-15-e77-attention/browser-errors.json',
    JSON.stringify(diagnostics, null, 2),
  );
  console.error(
    diagnostics
      .filter(
        (x) => x.includes('HTTP') || x.includes('ERROR') || x.includes('url'),
      )
      .slice(-20),
  );
  throw error;
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(profile, { recursive: true, force: true });
}
