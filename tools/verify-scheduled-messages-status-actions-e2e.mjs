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
  ],
];
const appliedUpdates = [];

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

async function installRoutes(page) {
  await page.route('http://localhost:3210/api/v1/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        outreachEnabled: false,
        ringCentralClientSecretConfigured: false,
        ringCentralJwtConfigured: false,
      }),
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
  await installRoutes(page);

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
  await page.getByText('Active message').waitFor({ timeout: 15000 });

  const activeRow = page.locator('tr', { hasText: 'Active message' });
  const pausedRow = page.locator('tr', { hasText: 'Paused message' });
  const pendingRow = page.locator('tr', { hasText: 'Pending review message' });
  const doneRow = page.locator('tr', { hasText: 'Done message' });

  await activeRow.locator('td').nth(7).click();
  await page.waitForTimeout(100);
  assert.deepEqual(appliedUpdates, [], 'clicking the status label should not update the Sheet');

  await activeRow.getByRole('button', { name: '暂停' }).click();
  await waitForAppliedUpdateCount(1);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'active-1',
    status: 'Paused',
  });

  await pausedRow.getByRole('button', { name: '恢复' }).click();
  await waitForAppliedUpdateCount(2);
  assert.deepEqual(appliedUpdates.at(-1), {
    id: 'paused-1',
    status: 'Active',
  });

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
  assert.equal(
    await doneRow.getByRole('button', { name: /暂停|恢复/ }).count(),
    0,
    'Done rows should not expose direct status reactivation',
  );

  assertNoPageErrors();
  console.log('Scheduled messages status actions E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
