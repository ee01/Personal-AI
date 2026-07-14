#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(repoRoot, 'desktop-app/package.json'));
const { chromium } = require('playwright');

const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-ar-data-overlay-'),
);

function renderFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Personal AI AR Data fixture</title>
    <style>
      body {
        margin: 0;
        min-height: 900px;
        padding: 42px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        background: #f8fafc;
      }
      main {
        display: grid;
        grid-template-columns: 280px 420px;
        gap: 32px;
        align-items: start;
      }
      .metric-card,
      .visual-card {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #ffffff;
        padding: 18px;
      }
      #metric-value {
        font-size: 32px;
        font-weight: 800;
      }
      #repeat-value {
        margin-top: 18px;
        font-size: 26px;
        font-weight: 800;
        color: #0f766e;
      }
      #chart-target {
        width: 360px;
        height: 180px;
        object-fit: cover;
        display: block;
        border: 1px solid #9ca3af;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="metric-card">
        <h1>Release dashboard</h1>
        <div id="metric-value">42</div>
        <div id="repeat-value">11</div>
      </section>
      <section class="visual-card">
        <h2>Chart export</h2>
        <img
          id="chart-target"
          alt="Fixture chart"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='180'%3E%3Crect width='360' height='180' fill='%23dbeafe'/%3E%3Cpath d='M20 140 L110 90 L200 116 L320 48' stroke='%232563eb' stroke-width='10' fill='none'/%3E%3C/svg%3E"
        />
      </section>
    </main>
  </body>
</html>`;
}

async function startFixtureServer() {
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/ar-data-fixture')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderFixtureHtml());
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'fixture server should listen on a TCP port');
  return {
    server,
    url: `http://127.0.0.1:${address.port}/ar-data-fixture`,
  };
}

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function waitForExtensionWorker(context) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;
  assert.ok(extensionId, 'extension id should be available');
  return { serviceWorker, extensionId };
}

const fixture = await startFixtureServer();
let resolveAgentTaskRequest;
let releaseAgentTaskResponse;
const agentTaskRequestSeen = new Promise((resolve) => {
  resolveAgentTaskRequest = resolve;
});
const agentTaskResponseGate = new Promise((resolve) => {
  releaseAgentTaskResponse = resolve;
});
const sheetHeaders = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Repeat_Every',
  'Repeat_Unit',
  'Push_Method',
  'Target_Type',
  'Category',
  'Agent_Task_ID',
  'Agent_Executor',
  'Agent_Task_Prompt',
  'Agent_Notify_Template',
  'Agent_Trigger_Source',
  'Agent_AR_Binding_ID',
  'Status',
  'Exec_Log',
  'Agent_Last_Status',
  'Agent_Last_Result',
];
const sheetRow = [
  'agent_row_1',
  'AR 数据：Repeat metric',
  'Refresh repeat metric',
  '2026-07-10',
  '',
  '1',
  'Week',
  'AgentTask',
  'private',
  'AR 数据,帮我做',
  'agent_task_ar_repeat_metric',
  'openclaw',
  'Refresh repeat metric',
  '',
  'jira_rule',
  'ar_repeat_metric',
  'Active',
  '待执行',
  '',
  '',
];
let updatedAgentTaskRow = null;
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/agent-tasks/execute')) {
      resolveAgentTaskRequest();
      await agentTaskResponseGate;
      await route.fulfill(jsonResponse({
        queueStatus: 'succeeded',
        result: {
          summary: '99',
          payload: {
            arReplacementText: '99',
          },
          artifacts: [
            {
              type: 'note',
              content: 'Updated fixture metric',
              metadata: {
                sourceSystem: 'fixture',
                verification: 'delayed e2e response',
                observedFields: ['summary'],
              },
            },
          ],
        },
      }));
      return;
    }
    if (pathname.endsWith('/stats')) {
      await route.fulfill(jsonResponse({ entities: { total: 0 }, messages: { today: 0 } }));
      return;
    }
    if (pathname.endsWith('/context-recall') || pathname.endsWith('/recall')) {
      await route.fulfill(jsonResponse({ matches: [], items: [] }));
      return;
    }
    await route.fulfill(jsonResponse({ items: [], total: 0 }));
  });
  await context.route('https://sheets.googleapis.com/v4/spreadsheets/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/values/Messages')) {
      await route.fulfill(jsonResponse({ values: [sheetHeaders, sheetRow] }));
      return;
    }
    if (request.method() === 'PUT' && url.pathname.includes('/values/Messages!A2:')) {
      const body = request.postDataJSON();
      updatedAgentTaskRow = body?.values?.[0] || null;
      await route.fulfill(jsonResponse({ updatedRows: 1, updatedColumns: sheetHeaders.length }));
      return;
    }
    await route.fulfill(jsonResponse({ sheets: [{ properties: { title: 'Messages', sheetId: 0 } }] }));
  });

  const { serviceWorker } = await waitForExtensionWorker(context);
  const now = new Date().toISOString();
  const stale = '2026-01-02T03:04:05.000Z';
  await serviceWorker.evaluate(
    async ({ fixtureUrl, nowIso }) => {
      if (chrome.identity?.getAuthToken) {
        Object.defineProperty(chrome.identity, 'getAuthToken', {
          configurable: true,
          value: (_details, callback) => callback('fake-google-token'),
        });
        Object.defineProperty(chrome.identity, 'removeCachedAuthToken', {
          configurable: true,
          value: (_details, callback) => callback?.(),
        });
      }
      await chrome.storage.local.set({
        envConfig: {
          MEMORY_SERVICE_BASE_URL: 'http://localhost:3210/api/v1',
        },
        scheduledMessagesConfig: {
          sheetId: 'sheet-ar-test',
          sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-ar-test/edit',
          sheet_version: 'test',
          created_by: 'e2e',
          created_at: nowIso,
        },
        userinfo: {
          username: 'esone.qiu',
        },
        personalAiArBindings: [
          {
            id: 'ar_text_metric',
            urlPattern: fixtureUrl,
            selector: '#metric-value',
            tagName: 'div',
            sectionLabel: 'Release dashboard metric',
            nearbyText: 'Release dashboard 42',
            oldValue: '42',
            displayMode: 'dom_text',
            lastResult: {
              text: '84',
              updatedAt: nowIso,
            },
            agentTaskPrompt: '替换为 99',
          },
          {
            id: 'ar_repeat_metric',
            urlPattern: fixtureUrl,
            selector: '#repeat-value',
            tagName: 'div',
            sectionLabel: 'Repeat metric',
            nearbyText: 'Release dashboard 11',
            oldValue: '11',
            displayMode: 'dom_text',
            linkedAgentTaskId: 'agent_row_1',
            lastResult: {
              text: '17',
              updatedAt: nowIso,
            },
          },
          {
            id: 'ar_visual_chart',
            urlPattern: fixtureUrl,
            selector: '#chart-target',
            tagName: 'img',
            sectionLabel: 'Chart export',
            nearbyText: 'Chart export image',
            oldValue: '',
            displayMode: 'visual_overlay',
            lastResult: {
              text: '7 blockers',
              updatedAt: nowIso,
            },
          },
        ],
      });
    },
    { fixtureUrl: fixture.url, nowIso: stale },
  );

  const page = await context.newPage();
  await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });

  await agentTaskRequestSeen;
  await page.locator('#metric-value', { hasText: '84' }).waitFor({
    timeout: 10000,
  });
  await page.locator('#repeat-value', { hasText: '17' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('[data-pai-ar-binding-id="ar_text_metric"] [data-pai-ar-status-chip="true"]', {
      hasText: '刷新中',
    })
    .waitFor({ timeout: 10000 });
  const visualOverlay = page.locator('[data-pai-ar-visual-overlay="true"]');
  await visualOverlay.getByText('7 blockers').waitFor({ timeout: 10000 });
  await visualOverlay
    .getByText('历史结果 · 今日未确认；不是当前页面事实')
    .waitFor({ timeout: 10000 });
  await visualOverlay
    .getByText('视觉叠加，不改写原页面媒体')
    .waitFor({ timeout: 10000 });
  assert.match(
    await visualOverlay.getAttribute('aria-label'),
    /历史结果 · 今日未确认；不是当前页面事实/,
    'visual overlay aria label should expose result basis',
  );
  assert.match(
    await visualOverlay.getAttribute('aria-label'),
    /不改写原页面媒体/,
    'visual overlay aria label should expose media non-write boundary',
  );

  assert.equal(
    await page.locator('#chart-target').getAttribute('alt'),
    'Fixture chart',
    'visual overlay should not rewrite the target media element',
  );
  const overlayBox = await visualOverlay.boundingBox();
  const imageBox = await page.locator('#chart-target').boundingBox();
  assert.ok(overlayBox, 'visual overlay should have a visible box');
  assert.ok(imageBox, 'target image should have a visible box');
  assert.ok(
    overlayBox.x >= imageBox.x - 1 && overlayBox.x <= imageBox.x + imageBox.width,
    'visual overlay should be horizontally anchored to the target element',
  );
  assert.ok(
    overlayBox.y >= imageBox.y - 1 && overlayBox.y <= imageBox.y + imageBox.height,
    'visual overlay should be vertically anchored to the target element',
  );

  releaseAgentTaskResponse();
  await page.locator('#metric-value', { hasText: '99' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('[data-pai-ar-binding-id="ar_text_metric"] [data-pai-ar-status-chip="true"]')
    .waitFor({ state: 'hidden', timeout: 10000 });

  const toggle = page.getByRole('button', { name: /AR ON/ });
  assert.match(
    await toggle.getAttribute('title'),
    /不删除 binding、不暂停重复 AgentTask、不清历史结果/,
    'AR toggle title should explain session-only disable boundary',
  );
  const toggleBox = await toggle.boundingBox();
  assert.ok(toggleBox, 'AR toggle should have a visible box');
  const toggleCenterX = toggleBox.x + toggleBox.width / 2;
  const toggleCenterY = toggleBox.y + toggleBox.height / 2;
  await page.mouse.move(toggleCenterX, toggleCenterY);
  await page.mouse.down();
  await page.mouse.move(toggleCenterX + 3, toggleCenterY);
  await page.mouse.up();
  await page.locator('#metric-value', { hasText: '42' }).waitFor({
    timeout: 10000,
  });
  await visualOverlay.waitFor({ state: 'detached', timeout: 10000 });
  await page.getByRole('button', { name: /AR OFF/ }).waitFor({
    timeout: 10000,
  });

  await page.getByRole('button', { name: /AR OFF/ }).click();
  await page.getByRole('button', { name: /AR ON/ }).waitFor({
    timeout: 10000,
  });
  await page.locator('#repeat-value', { hasText: '17' }).waitFor({
    timeout: 10000,
  });
  const repeatBadge = page.locator('[data-pai-ar-binding-id="ar_repeat_metric"]');
  const repeatEditLabel = await repeatBadge.locator('img[alt="Personal AI"]').getAttribute('aria-label');
  assert.match(
    repeatEditLabel,
    /只有保存编辑器里的取消重复才会暂停它/,
    'repeat edit control should expose AgentTask detach boundary',
  );
  await repeatBadge.hover();
  const hideRepeatButton = page.getByRole('button', { name: /隐藏本页 AR 展示/ });
  assert.match(
    await hideRepeatButton.getAttribute('title'),
    /不会暂停 AgentTask agent_row_1/,
    'hide control should not look like an AgentTask detach action',
  );
  await hideRepeatButton.click();
  await page.locator('#repeat-value', { hasText: '11' }).waitFor({
    timeout: 10000,
  });
  await repeatBadge.waitFor({ state: 'detached', timeout: 10000 });
  assert.equal(
    updatedAgentTaskRow,
    null,
    'session hide should not update or pause the linked AgentTask row',
  );
  const hiddenRepeatBinding = await serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.local.get(['personalAiArBindings']);
    return stored.personalAiArBindings.find((binding) => binding.id === 'ar_repeat_metric');
  });
  assert.equal(
    hiddenRepeatBinding.linkedAgentTaskId,
    'agent_row_1',
    'session hide should preserve the linked AgentTask id in local binding storage',
  );

  await page.evaluate(() => {
    Object.keys(sessionStorage)
      .filter((key) => key.includes('personalAiArHiddenBindingForPage'))
      .forEach((key) => sessionStorage.removeItem(key));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#repeat-value', { hasText: '17' }).waitFor({
    timeout: 10000,
  });
  await page.locator('[data-pai-ar-binding-id="ar_repeat_metric"] img[alt="Personal AI"]').click();
  await page.locator('[data-pai-ar-repeat-receipt="true"]', {
    hasText: '重复执行回执',
  }).waitFor({ timeout: 10000 });
  await page.locator('input[type="checkbox"]').uncheck();
  await page.locator('[data-pai-ar-repeat-receipt="true"]', {
    hasText: '取消重复回执',
  }).waitFor({ timeout: 10000 });
  await page.locator('textarea').first().fill('');
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.locator('[data-pai-ar-repeat-receipt="true"]').waitFor({
    state: 'detached',
    timeout: 10000,
  });
  assert.ok(updatedAgentTaskRow, 'detaching repeat should update the linked AgentTask row');
  const updatedByHeader = Object.fromEntries(
    sheetHeaders.map((header, index) => [header, updatedAgentTaskRow[index] ?? '']),
  );
  assert.equal(updatedByHeader.ID, 'agent_row_1', 'detached update should target the existing AgentTask row');
  assert.equal(updatedByHeader.Status, 'Paused', 'detached AgentTask should be paused');
  assert.equal(updatedByHeader.Agent_AR_Binding_ID, '', 'detached AgentTask should clear the AR binding id');
  assert.equal(updatedByHeader.Agent_Last_Status, 'ar_detached', 'detached AgentTask should record AR detach status');
  assert.match(
    updatedByHeader.Exec_Log,
    /已取消重复执行/,
    'detached AgentTask should preserve an audit log',
  );
  const repeatBinding = await serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.local.get(['personalAiArBindings']);
    return stored.personalAiArBindings.find((binding) => binding.id === 'ar_repeat_metric');
  });
  assert.equal(
    repeatBinding.linkedAgentTaskId,
    undefined,
    'local AR binding should only clear linkedAgentTaskId after the AgentTask row update succeeds',
  );

  console.log('verify-ar-data-overlay-e2e: ok');
} finally {
  await context.close().catch(() => undefined);
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  await new Promise((resolve) => fixture.server.close(resolve));
}
