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
const sheetId = '1ScheduledQueueSuggestionAaBbCc';
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
let messageRows = Array.from({ length: 32 }, (_, index) => [
  `msg-${index + 1}`,
  `Risk ${index + 1}`,
  'content',
  '2026-05-04',
  '09:30',
  'Bot',
  'group',
  'Active',
  '0',
  '待执行',
  '',
  '2026-05-04 09:30',
]);
messageRows.push(
  [
    'safe-1',
    'Safe 10:30 A',
    'content',
    '2026-05-04',
    '10:30',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:30',
  ],
  [
    'safe-2',
    'Safe 10:30 B',
    'content',
    '2026-05-04',
    '10:30',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:30',
  ],
  [
    'safe-3',
    'Safe 10:45 A',
    'content',
    '2026-05-04',
    '10:45',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:45',
  ],
  [
    'safe-4',
    'Safe 10:45 B',
    'content',
    '2026-05-04',
    '10:45',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:45',
  ],
  [
    'safe-5',
    'Safe 11:00 A',
    'content',
    '2026-05-04',
    '11:00',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 11:00',
  ],
  [
    'safe-6',
    'Safe 11:00 B',
    'content',
    '2026-05-04',
    '11:00',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 11:00',
  ],
);
let appliedUpdate = null;

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-queue-suggestion-browser-'),
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

function installFixedClock(page) {
  return page.addInitScript(() => {
    const OriginalDate = Date;
    const fixedNow = new OriginalDate(2026, 4, 4, 8, 0, 0, 0).getTime();

    class FixedDate extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedNow);
        } else {
          super(...args);
        }
      }

      static now() {
        return fixedNow;
      }

      static parse(value) {
        return OriginalDate.parse(value);
      }

      static UTC(...args) {
        return OriginalDate.UTC(...args);
      }
    }

    globalThis.Date = FixedDate;
  });
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
      const date = row[headers.indexOf('Schedule_Date')];
      const time = row[headers.indexOf('Schedule_Time')];
      appliedUpdate = { id, date, time };
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
        created_at: '2026-05-14T06:00:00.000Z',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installFixedClock(page);
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
  await page.locator('text=执行器队列可能延迟').waitFor({
    timeout: 15000,
  });
  await page.locator('text=建议处理：Risk 32（第 32/32 个）').waitFor({
    timeout: 15000,
  });
  await page.locator('text=建议改到 2026-05-04 10:01').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', {
    name: '显示全部 4 个时间槽',
  }).click();
  await page.locator('[aria-label*="2026-05-04 11:00"]').getByText('Safe 11:00 A', { exact: true }).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', {
    name: '收起队列槽位',
  }).click();

  const dialogPromise = page.waitForEvent('dialog', { timeout: 15000 });
  await page.getByRole('button', {
    name: '将Risk 32改到建议时间2026-05-04 10:01',
  }).click();
  const dialog = await dialogPromise;
  assert.match(dialog.message(), /已将「Risk 32」改到 2026-05-04 10:01/);
  await dialog.accept();

  assert.deepEqual(appliedUpdate, {
    id: 'msg-32',
    date: '2026-05-04',
    time: '10:01',
  });
  await page.waitForURL(/messageId=msg-32/, { timeout: 15000 });

  assertNoPageErrors();
  console.log('Scheduled messages queue suggestion E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
