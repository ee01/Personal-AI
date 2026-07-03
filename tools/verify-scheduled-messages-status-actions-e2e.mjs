import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');
const sheetId = '1ScheduledStatusActionsAaBbCc';
const headers = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'Target_Type',
  'Status',
  'Exec_Count',
  'Exec_Log',
  'Last_Exec',
  'Next_Exec',
  'Category',
  'Glip_User_Name',
];

let messageRows = [
  [
    'active-1',
    'Active message',
    'content',
    '2026-05-20',
    '09:30',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-20 09:30',
    '',
    '',
  ],
  [
    'active-outreach',
    'Active outreach',
    'ask Jamie',
    '2026-05-20',
    '09:35',
    'Outreach',
    'private',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-20 09:35',
    '',
    'jamie.yao',
  ],
  [
    'paused-1',
    'Paused message',
    'content',
    '2026-05-20',
    '10:30',
    'Bot',
    'group',
    'Paused',
    '0',
    '暂停中',
    '',
    '2026-05-20 10:30',
    '',
    '',
  ],
  [
    'pending-1',
    'Pending review message',
    'content',
    '2026-05-20',
    '11:30',
    'Bot',
    'group',
    'PendingReview',
    '0',
    '待审核',
    '',
    '2026-05-20 11:30',
    'AutoReply',
    '',
  ],
  [
    'pending-reject-1',
    'Pending review reject message',
    'reject content',
    '2026-05-20',
    '11:45',
    'AsMe',
    'group',
    'PendingReview',
    '0',
    '待审核',
    '',
    '2026-05-20 11:45',
    '自动答复',
    '',
  ],
  [
    'done-1',
    'Done message',
    'content',
    '2026-05-18',
    '12:30',
    'Bot',
    'group',
    'Done',
    '1',
    '已完成',
    '2026-05-18 12:30',
    '',
    '',
    '',
  ],
  [
    'done-outreach',
    'Done outreach',
    'done ask',
    '2026-05-18',
    '13:30',
    'Outreach',
    'private',
    'Done',
    '1',
    '已完成',
    '2026-05-18 13:30',
    '',
    '',
    'jamie.yao',
  ],
];
const appliedUpdates = [];
const outreachMirrorCalls = [];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-status-actions-browser-'),
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

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Scheduled messages page errors: ${errors.join('; ')}`);
  };
}

async function waitForAppliedUpdateCount(expectedCount) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (appliedUpdates.length >= expectedCount) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`expected at least ${expectedCount} Sheet updates, got ${appliedUpdates.length}`);
}

async function waitForOutreachMirrorCall(type, id) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const call = outreachMirrorCalls.find(
      (candidate) => candidate.type === type && candidate.id === id,
    );
    if (call) {
      return call;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(
    `expected Outreach mirror ${type} for ${id}, got ${JSON.stringify(outreachMirrorCalls)}`,
  );
}

async function installRoutes(context, page) {
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/config')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          outreachEnabled: false,
          ringCentralClientSecretConfigured: false,
          ringCentralJwtConfigured: false,
        }),
      });
      return;
    }

    if (pathname.endsWith('/outreach/templates/runtime-status')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0 }),
      });
      return;
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith('/outreach/templates/upsert')
    ) {
      const payload = JSON.parse(request.postData() || '{}');
      outreachMirrorCalls.push({
        type: 'upsert',
        id: payload.id,
        syncState: payload.syncState,
        enabled: payload.enabled,
      });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ template: payload }),
      });
      return;
    }

    const pauseMatch = pathname.match(/\/outreach\/templates\/([^/]+)\/pause$/);
    if (request.method() === 'POST' && pauseMatch) {
      const id = decodeURIComponent(pauseMatch[1]);
      outreachMirrorCalls.push({ type: 'pause', id });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          template: { id, enabled: false, syncState: 'paused' },
        }),
      });
      return;
    }

    const cancelMatch = pathname.match(/\/outreach\/templates\/([^/]+)\/cancel$/);
    if (request.method() === 'POST' && cancelMatch) {
      const id = decodeURIComponent(cancelMatch[1]);
      outreachMirrorCalls.push({ type: 'cancel', id });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          template: { id, enabled: false, syncState: 'cancelled' },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ email: 'esone.qiu@example.com' }),
    });
  });

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = request.url();

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: [headers, ...messageRows] }),
      });
      return;
    }

    if (request.method() === 'POST' && url.includes(`${sheetId}:batchUpdate`)) {
      const payload = JSON.parse(request.postData() || '{}');
      const deleteRange = payload.requests?.[0]?.deleteDimension?.range;
      assert.equal(deleteRange?.dimension, 'ROWS');
      const rowIndex = Number(deleteRange.startIndex) - 1;
      assert.ok(rowIndex >= 0, `deleted row index should be data row: ${rowIndex}`);
      messageRows.splice(rowIndex, 1);
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ replies: [{}] }),
      });
      return;
    }

    if (request.method() === 'PUT' && url.includes('/values/Messages!')) {
      const payload = JSON.parse(request.postData() || '{}');
      const row = payload.values?.[0];
      assert.ok(row, 'update payload should include one row');

      const id = row[headers.indexOf('ID')];
      const status = row[headers.indexOf('Status')];
      appliedUpdates.push({ id, status });

      const rowIndex = messageRows.findIndex(candidate => candidate[0] === id);
      assert.notEqual(rowIndex, -1, `updated row should exist: ${id}`);
      messageRows[rowIndex] = row;

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ updatedRows: 1 }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        messagesSheetId: 101,
        logsSheetId: 102,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-19T06:00:00.000Z',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installRoutes(context, page);

  await page.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
    }
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.getByText('Active message', { exact: true }).waitFor({ timeout: 15000 });

  const activeRow = page.locator('tr', { hasText: 'Active message' });
  const activeOutreachRow = page.locator('tr', { hasText: 'Active outreach' });
  const pausedRow = page.locator('tr', { hasText: 'Paused message' });
  const pendingRow = page.locator('tr', { hasText: 'Pending review message' });
  const pendingRejectRow = page.locator('tr', { hasText: 'Pending review reject message' });
  const doneRow = page.locator('tr', { hasText: 'Done message' });
  const doneOutreachRow = page.locator('tr', { hasText: 'Done outreach' });

  await activeRow.locator('td').nth(7).click();
  await page.waitForTimeout(100);
  assert.deepEqual(appliedUpdates, [], 'clicking the status label should not update the Sheet');

  await activeRow.getByRole('button', { name: '暂停' }).click();
  await waitForAppliedUpdateCount(1);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'active-1',
    status: 'Paused',
  });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('写入: Messages 行 active-1 Active -> Paused')
    .waitFor({ timeout: 5000 });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('只切换排程状态；不会立即发送、不会改 Logs')
    .waitFor({ timeout: 5000 });

  await activeOutreachRow.getByRole('button', { name: '暂停' }).click();
  await waitForAppliedUpdateCount(2);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'active-outreach',
    status: 'Paused',
  });
  assert.deepEqual(outreachMirrorCalls.at(-1), {
    type: 'pause',
    id: 'active-outreach',
  });
  assert.equal(
    outreachMirrorCalls.some(
      (call) => call.type === 'cancel' && call.id === 'active-outreach',
    ),
    false,
    'pausing an Outreach scheduled message should not cancel its template',
  );
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('写入: Messages 行 active-outreach Active -> Paused')
    .waitFor({ timeout: 5000 });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('Outreach: 已暂停对应主动询问模板；未取消历史会话')
    .waitFor({ timeout: 5000 });

  await pausedRow.getByRole('button', { name: '恢复' }).click();
  await waitForAppliedUpdateCount(3);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'paused-1',
    status: 'Active',
  });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('写入: Messages 行 paused-1 Paused -> Active')
    .waitFor({ timeout: 5000 });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息状态回执' })
    .getByText('如不想继续执行，发送前仍可暂停、编辑或删除这行')
    .waitFor({ timeout: 5000 });

  assert.equal(
    await pendingRow.getByRole('button', { name: /暂停|恢复/ }).count(),
    0,
    'PendingReview rows should not expose direct status toggles',
  );
  assert.equal(
    await pendingRow.getByRole('button', { name: /批准/ }).count(),
    1,
    'PendingReview rows should keep the approve action',
  );
  assert.equal(
    await pendingRow.getByRole('button', { name: /拒绝/ }).count(),
    1,
    'PendingReview rows should keep the reject action',
  );
  await pendingRow
    .locator('small', {
      hasText: '批准会把这行改为 Active，并排到下一分钟按 Bot 发送当前正文',
    })
    .waitFor({ timeout: 5000 });
  await pendingRejectRow
    .locator('small', {
      hasText: '自动答复审核',
    })
    .waitFor({ timeout: 5000 });
  assert.equal(
    await doneRow.getByRole('button', { name: /暂停|恢复/ }).count(),
    0,
    'Done rows should not expose direct status reactivation',
  );
  assert.equal(
    await doneOutreachRow.getByRole('button', { name: /暂停|恢复/ }).count(),
    0,
    'Done Outreach rows should not expose direct status reactivation',
  );

  page.once('dialog', async (dialog) => {
    assert.match(dialog.message(), /确定要删除消息/);
    await dialog.accept();
  });
  await doneOutreachRow.getByRole('button', { name: '删除 Done outreach' }).click();
  await page.locator('tr', { hasText: 'Done outreach' }).waitFor({
    state: 'detached',
    timeout: 5000,
  });
  assert.deepEqual(await waitForOutreachMirrorCall('cancel', 'done-outreach'), {
    type: 'cancel',
    id: 'done-outreach',
  });
  await page
    .getByRole('status')
    .filter({ hasText: '定时消息删除回执' })
    .getByText('Outreach: 已取消对应主动询问模板')
    .waitFor({ timeout: 5000 });

  await pendingRow.getByRole('button', { name: /批准/ }).click();
  await waitForAppliedUpdateCount(4);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'pending-1',
    status: 'Active',
  });
  await page
    .getByRole('status')
    .filter({ hasText: '已批准自动答复' })
    .getByText('只批准当前待审核行')
    .waitFor({ timeout: 5000 });

  page.once('dialog', async (dialog) => {
    assert.match(dialog.message(), /确定要拒绝此自动答复/);
    await dialog.accept();
  });
  await pendingRejectRow.getByRole('button', { name: /拒绝/ }).click();
  await waitForAppliedUpdateCount(5);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'pending-reject-1',
    status: 'Done',
  });
  await page
    .getByRole('status')
    .filter({ hasText: '已拒绝自动答复' })
    .getByText('不删除触发规则')
    .waitFor({ timeout: 5000 });

  assertNoPageErrors();
  console.log('Scheduled messages status actions E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
