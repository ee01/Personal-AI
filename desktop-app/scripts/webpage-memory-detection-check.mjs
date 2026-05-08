import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const extensionPath = path.join(repoRoot, 'dist');
const siteMuteStorageKey = 'pai-context-muted-sites-v1';

function log(message) {
  console.log(`[webpage-memory-detection] ${message}`);
}

function attachPageDiagnostics(page, label) {
  const entries = [];
  page.on('console', (message) => {
    entries.push(`${label} console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    entries.push(
      `${label} pageerror: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  return entries;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestCount(server, expectedCount, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.contextRecallRequests.length >= expectedCount) {
      return;
    }
    await delay(50);
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} context-recall request(s); got ${server.contextRecallRequests.length}`,
  );
}

async function startHarnessServer() {
  const contextRecallRequests = [];

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/api/v1/context-recall') {
        const rawBody = await readRequestBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};
        contextRecallRequests.push(body);
        if (typeof body.url === 'string' && body.url.includes('/dynamic-sensitive')) {
          await delay(900);
        }
        const unsafeRouteCase =
          typeof body.url === 'string' && body.url.includes('/unsafe-route');
        const match = {
          id: 'web-memory-1',
          type: 'message',
          score: 0.92,
          title: unsafeRouteCase
            ? 'Falcon "unsafe" launch <review>'
            : 'Falcon launch readiness',
          snippet: 'Previously saved notes mention the Falcon launch checklist and owner handoff.',
          sourceLabel: 'Web memory',
          sourceUrl: 'https://source.example.com/falcon',
          sourceTitle: 'Falcon notes',
          exploreLink: unsafeRouteCase
            ? '#/timeline?focus=web-memory-1" onclick="window.__paiInjected=1'
            : '#/timeline?focus=web-memory-1',
          links: [
            { label: 'Open source', url: 'https://source.example.com/falcon' },
            {
              label: 'Quoted "label"',
              url: 'https://source.example.com/falcon?quote=%22',
            },
            { label: 'Unsafe source', url: 'javascript:alert(1)' },
          ],
          whyMatched: '关键词命中网页上下文',
          timestamp: Math.floor(Date.now() / 1000),
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            matches: [match],
            topMatch: match,
            queryTimeMs: 4,
          }),
        );
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/normal')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon readiness notes</title></head>
            <body>
              <section>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </section>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/browse/PAI-123')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>PAI-123 Falcon Jira issue</title></head>
            <body>
              <main>
                <h1 id="summary-val">Falcon launch readiness follow-up</h1>
                <span id="key-val">PAI-123</span>
                <span id="status-val">In Review</span>
                <section id="description-val">
                  Jira issue description covers Falcon owner handoff, launch
                  dependencies, release confidence, customer communication,
                  QA verification, and follow-up review material.
                </section>
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/unsafe-route')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon unsafe route notes</title></head>
            <body>
              <main>
                Falcon launch readiness notes exercise unsafe memory route handling,
                quoted source labels, link sanitization, launch checklist ownership,
                migration checkpoints, customer communication, and follow-up review
                material for the team.
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/post-bubble-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon sensitive after bubble</title></head>
            <body>
              <main>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </main>
              <label>
                Search project notes
                <input id="sensitive-after-bubble" type="text" name="project-search" />
              </label>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/dynamic-sensitive')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Falcon sensitive transition</title></head>
            <body>
              <main>
                Falcon launch readiness notes cover alpha rollout dates, owner handoff,
                migration checkpoints, release confidence, dependency status, customer
                communication, and follow-up review material for the team.
              </main>
            </body>
          </html>`);
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/login')) {
        if (req.url?.startsWith('/login-delayed')) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html>
            <html>
              <head><title>Account login loading</title></head>
              <body>
                <section>
                  Account login is preparing a secure session before rendering the
                  password form. This page intentionally has enough visible text to
                  look like normal content until the sign in controls load.
                </section>
              </body>
            </html>`);
          return;
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
          <html>
            <head><title>Account login</title></head>
            <body>
              <form>
                <label>Password <input type="password" autocomplete="current-password" /></label>
                <button>Sign in</button>
              </form>
            </body>
          </html>`);
        return;
      }

      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    apiBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    contextRecallRequests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function launchExtensionContext(apiBaseUrl) {
  await fs.access(path.join(extensionPath, 'manifest.json'));
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'webpage-memory-extension-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;

  const config = {
    MEMORY_SERVICE_BASE_URL: apiBaseUrl,
    MEMORY_SERVICE_API_KEY: '',
    MEMORY_SERVICE_TIMEOUT: 5000,
  };

  await serviceWorker.evaluate(
    async ({ envConfig, storageKey }) => {
      await chrome.storage.local.set({
        envConfig,
        userinfo: { username: 'webpage-memory-e2e' },
        [storageKey]: {},
      });
    },
    { envConfig: config, storageKey: siteMuteStorageKey },
  );

  const configPage = await context.newPage();
  await configPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  const updateResponse = await configPage.evaluate(
    async (envConfig) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'UPDATE_ENV_CONFIG', config: envConfig },
          (response) => resolve(response),
        );
      }),
    config,
  );
  log(`UPDATE_ENV_CONFIG response: ${JSON.stringify(updateResponse)}`);
  await configPage.close();

  return { context, extensionId, serviceWorker };
}

async function verifyNormalPage(server, context, serviceWorker, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 340, height: 720 });
  const diagnostics = attachPageDiagnostics(page, 'normal');
  const startCount = server.contextRecallRequests.length;
  await page.goto(
    `${server.origin}/normal?utm_source=newsletter&b=2&a=1&fbclid=tracker#private-anchor`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    },
  );

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `normal bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '普通网页应触发一次被动召回',
  );
  assert.equal(
    server.contextRecallRequests[startCount].surface,
    'web_passive',
    '召回 surface 不正确',
  );
  assert.equal(
    server.contextRecallRequests[startCount].contextType,
    'webpage',
    '普通网页应以 webpage contextType 召回',
  );
  assert.ok(
    server.contextRecallRequests[startCount].sourceTypes?.includes('web'),
    '普通网页应透传 sourceTypes 以约束召回来源',
  );
  assert.equal(
    server.contextRecallRequests[startCount].url,
    `${server.origin}/normal?a=1&b=2`,
    '被动召回请求应剔除追踪参数和 hash，并稳定排序保留参数',
  );

  const bubble = page.locator('.pai-context-bubble');
  await bubble.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const cardBox = await page.locator('.pai-context-card').boundingBox();
  assert.ok(cardBox, '记忆卡片应该有可见布局盒');
  assert.ok(cardBox.x >= 0, '窄屏下记忆卡片不应超出左边界');
  assert.ok(
    cardBox.x + cardBox.width <= 340,
    '窄屏下记忆卡片不应超出右边界',
  );
  const controlledCardId = await bubble.getAttribute('aria-controls');
  assert.ok(controlledCardId, 'bubble 应声明 aria-controls');
  assert.equal(
    await page.locator(`#${controlledCardId}`).count(),
    1,
    'aria-controls 应指向记忆卡片',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('.pai-context-card')),
    ),
    true,
    '打开记忆卡片后 Tab 应进入卡片操作区',
  );
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pai-context-card', {
    state: 'hidden',
    timeout: 5000,
  });

  await bubble.click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });

  const cardText = await page.locator('.pai-context-card').innerText();
  assert.match(cardText, /相关记忆/);
  assert.match(cardText, /此网站今天不提示/);

  const hrefs = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => anchor.href),
  );
  assert.ok(
    hrefs.some((href) => href.includes('memory-exploring.html#/timeline')),
    '缺少记忆探索跳转',
  );
  assert.ok(
    hrefs.includes('https://source.example.com/falcon'),
    '缺少安全来源链接',
  );
  assert.equal(
    hrefs.some((href) => href.startsWith('javascript:')),
    false,
    '不应渲染 javascript: 来源链接',
  );

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1200);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Personal AI 浮层不应污染 body-only 网页的下一次上下文 key',
  );

  await page.locator('.pai-context-site-mute').click();
  await page.waitForSelector('.pai-context-toast', {
    state: 'visible',
    timeout: 5000,
  });
  const toastText = await page.locator('.pai-context-toast').innerText();
  assert.match(toastText, /已暂停此网站记忆提示 24 小时/);
  await page.waitForFunction(
    () => !document.querySelector('.pai-context-bubble'),
    { timeout: 5000 },
  );
  const storedMutes = await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.local.get(storageKey),
    siteMuteStorageKey,
  );
  assert.equal(
    typeof storedMutes[siteMuteStorageKey]?.['127.0.0.1'],
    'number',
    '站点静默状态未写入 extension storage',
  );

  const mutedPage = await context.newPage();
  const mutedDiagnostics = attachPageDiagnostics(mutedPage, 'muted');
  const mutedStartCount = server.contextRecallRequests.length;
  await mutedPage.goto(`${server.origin}/normal?muted=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await mutedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    mutedStartCount,
    '已静默站点重载后不应在 storage 加载前触发被动召回',
  );
  assert.equal(
    await mutedPage.locator('.pai-context-bubble').count(),
    0,
    '已静默站点重载后不应显示记忆提示',
  );
  if (mutedDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of mutedDiagnostics) {
      log(entry);
    }
    throw new Error('已静默站点页面出现脚本异常');
  }

  await mutedPage.close();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await optionsPage.waitForSelector('text=网页记忆提示静默站点', {
    timeout: 5000,
  });
  await optionsPage.waitForSelector('text=127.0.0.1', { timeout: 5000 });
  await optionsPage.getByRole('button', { name: '恢复', exact: true }).click();
  await optionsPage.waitForSelector('text=当前没有被临时静默的网站', {
    timeout: 5000,
  });
  await optionsPage.close();

  const unmutedPage = await context.newPage();
  const unmutedStartCount = server.contextRecallRequests.length;
  await unmutedPage.goto(`${server.origin}/normal?unmuted=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, unmutedStartCount + 1, 12000);
  assert.equal(
    server.contextRecallRequests.length,
    unmutedStartCount + 1,
    '从设置页恢复站点后应重新触发被动召回',
  );
  await unmutedPage.close();
  await page.close();
}

async function verifySensitiveQueryPage(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive-query');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/normal?access_token=secret-token`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    startCount,
    '包含敏感查询参数的页面不应触发被动召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '包含敏感查询参数的页面不应显示记忆提示',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感查询参数页面出现脚本异常');
  }
  await page.close();
}

async function verifyJiraIssueContext(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'jira-issue');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/browse/PAI-123?utm_source=tracker`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `jira issue bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    'Jira issue 页面应触发一次被动召回',
  );
  const request = server.contextRecallRequests[startCount];
  assert.equal(request.surface, 'web_passive');
  assert.equal(
    request.contextType,
    'jira_issue',
    'Jira issue 页面应透传 jira_issue contextType',
  );
  assert.ok(
    request.sourceTypes?.includes('jira'),
    'Jira issue 页面应透传 Jira sourceTypes',
  );
  assert.ok(
    request.entityHints?.some(
      (hint) => hint.kind === 'jira_issue_key' && hint.value === 'PAI-123',
    ),
    'Jira issue 页面应透传 issue key entity hint',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('Jira issue 页面出现脚本异常');
  }
  await page.close();
}

async function verifyUnsafeExploreRoute(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'unsafe-route');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/unsafe-route`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `unsafe route bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '带不安全 exploreLink 的网页仍应完成一次被动召回',
  );

  await page.locator('.pai-context-bubble').click();
  await page.waitForSelector('.pai-context-card', {
    state: 'visible',
    timeout: 5000,
  });
  const hrefs = await page.$$eval('.pai-context-card a', (anchors) =>
    anchors.map((anchor) => anchor.href),
  );
  assert.equal(
    hrefs.some((href) => href.includes('memory-exploring.html')),
    false,
    '不安全的 exploreLink 不应渲染为记忆探索链接',
  );
  assert.equal(
    await page.locator('.pai-context-card [onclick]').count(),
    0,
    '提示卡片不应被带引号的链接或路由注入 onclick 属性',
  );
  assert.ok(
    hrefs.includes('https://source.example.com/falcon?quote=%22'),
    '带引号查询值的安全来源链接应保留为 URL 编码形式',
  );
  assert.equal(
    await page.evaluate(() => window.__paiInjected),
    undefined,
    '不安全 exploreLink 不应执行注入脚本',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('不安全 exploreLink 页面出现脚本异常');
  }
  await page.close();
}

async function verifyDisplayedBubbleClearsOnSensitiveAttributeChange(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'post-bubble-sensitive');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/post-bubble-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 12000 });
  } catch (error) {
    log(
      `post-bubble-sensitive bubble wait failed; context-recall requests=${server.contextRecallRequests.length - startCount}`,
    );
    for (const entry of diagnostics.slice(-20)) {
      log(entry);
    }
    throw error;
  }

  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '敏感化前应先显示一次正常的被动召回提示',
  );

  await page.evaluate(() => {
    const input = document.querySelector('#sensitive-after-bubble');
    input?.setAttribute('type', 'password');
    input?.setAttribute('autocomplete', 'current-password');
  });

  await page.waitForFunction(
    () =>
      !document.querySelector('.pai-context-bubble') &&
      !document.querySelector('.pai-context-card'),
    { timeout: 5000 },
  );
  await page.waitForTimeout(800);
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '已显示提示的页面变成敏感表单后不应再追加被动召回',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('提示后敏感化页面出现脚本异常');
  }
  await page.close();
}

async function verifySensitiveTransitionRace(server, context) {
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive-transition');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin}/dynamic-sensitive`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await waitForRequestCount(server, startCount + 1);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'current-password';
    input.value = 'secret';
    document.body.appendChild(input);
  });

  let bubbleAppeared = false;
  try {
    await page.waitForSelector('.pai-context-bubble', { timeout: 1800 });
    bubbleAppeared = true;
  } catch (_error) {
    // Expected: the pending recall response is ignored after the page becomes sensitive.
  }
  assert.equal(
    bubbleAppeared,
    false,
    '页面在召回响应前变成敏感表单时不应显示记忆提示',
  );
  assert.equal(
    server.contextRecallRequests.length,
    startCount + 1,
    '敏感切换用例应先发出一次召回请求再被响应期隐私检查拦截',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感切换页面出现脚本异常');
  }
  await page.close();
}

async function verifySensitivePage(server, context) {
  const delayedPage = await context.newPage();
  const delayedDiagnostics = attachPageDiagnostics(delayedPage, 'sensitive-delayed');
  const delayedStartCount = server.contextRecallRequests.length;
  await delayedPage.goto(`${server.origin.replace('127.0.0.1', 'localhost')}/login-delayed`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await delayedPage.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    delayedStartCount,
    '敏感 URL 即使尚未渲染密码输入，也不应触发被动召回',
  );
  assert.equal(
    await delayedPage.locator('.pai-context-bubble').count(),
    0,
    '敏感 URL 尚未渲染表单时也不应显示记忆提示',
  );
  if (delayedDiagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of delayedDiagnostics) {
      log(entry);
    }
    throw new Error('延迟渲染敏感页面出现脚本异常');
  }
  await delayedPage.close();

  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, 'sensitive');
  const startCount = server.contextRecallRequests.length;
  await page.goto(`${server.origin.replace('127.0.0.1', 'localhost')}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(3500);
  assert.equal(
    server.contextRecallRequests.length,
    startCount,
    '含密码输入的页面不应触发被动召回',
  );
  assert.equal(
    await page.locator('.pai-context-bubble').count(),
    0,
    '敏感页面不应显示记忆提示',
  );
  if (diagnostics.some((entry) => entry.includes('pageerror'))) {
    for (const entry of diagnostics) {
      log(entry);
    }
    throw new Error('敏感页面出现脚本异常');
  }
  await page.close();
}

let server;
let context;

try {
  server = await startHarnessServer();
  log(`本地假 memory-service: ${server.apiBaseUrl}`);
  const launch = await launchExtensionContext(server.apiBaseUrl);
  context = launch.context;

  await verifySensitiveTransitionRace(server, context);
  await verifySensitiveQueryPage(server, context);
  await verifyJiraIssueContext(server, context);
  await verifyUnsafeExploreRoute(server, context);
  await verifyDisplayedBubbleClearsOnSensitiveAttributeChange(server, context);
  await verifyNormalPage(server, context, launch.serviceWorker, launch.extensionId);
  await verifySensitivePage(server, context);
  log('browser checks passed');
} finally {
  if (context) {
    await context.close();
  }
  if (server) {
    await server.close();
  }
}
