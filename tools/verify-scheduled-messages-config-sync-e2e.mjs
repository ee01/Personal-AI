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
const sheetId = '1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp';
const oldSheetId = '1ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKk';

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-config-sync-e2e-browser-'),
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

async function openSetupPage(launched) {
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/values/Config!A2:B')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            ['sheet_version', '2.7'],
            ['created_by', 'Personal AI Extension'],
            ['created_at', '2026-05-12T06:00:00.000Z'],
            ['last_sync_time', '2026-05-12T07:00:00.000Z'],
            ['messages_sheet_id', '101'],
            ['logs_sheet_id', '102'],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '开始使用定时消息管理' }).waitFor({
    timeout: 15000,
  });

  await page.evaluate(() => {
    chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
    chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
  });

  return { page, assertNoPageErrors };
}

async function withLaunchedExtension(testBody) {
  let launched;
  try {
    launched = await launchExtensionContext();
    await testBody(launched);
  } finally {
    if (launched) {
      await launched.context.close();
      await fs.rm(launched.userDataDir, { recursive: true, force: true });
    }
  }
}

await withLaunchedExtension(async (launched) => {
  const { serviceWorker } = launched;
  const { page, assertNoPageErrors } = await openSetupPage(launched);

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T08:00:00.000Z',
      },
    });
  }, { targetSheetId: sheetId });

  await page.locator('input[placeholder="粘贴 Sheet URL 或 Sheet ID..."]').fill(sheetId);
  await page.locator('button', { hasText: '绑定已有表' }).click();

  await page.locator('text=本机配置比 Sheet 更新').waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '保留本机并同步到 Sheet' }).waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '仍用 Sheet 恢复本机' }).waitFor({
    timeout: 15000,
  });

  assertNoPageErrors();
});

await withLaunchedExtension(async (launched) => {
  const { serviceWorker } = launched;
  const { page, assertNoPageErrors } = await openSetupPage(launched);

  await serviceWorker.evaluate(async ({ currentSheetId }) => {
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: currentSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${currentSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T08:00:00.000Z',
      },
    });
  }, { currentSheetId: oldSheetId });

  await page.locator('input[placeholder="粘贴 Sheet URL 或 Sheet ID..."]').fill(sheetId);
  await page.locator('button', { hasText: '绑定已有表' }).click();

  await page.locator('text=将切换维护表').waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '继续绑定新表' }).waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '取消，保留本机' }).waitFor({
    timeout: 15000,
  });

  const beforeContinue = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(beforeContinue.scheduledMessagesConfig.sheetId, oldSheetId);

  await page.locator('button', { hasText: '继续绑定新表' }).click();
  await page.locator('text=配置绑定成功').waitFor({
    timeout: 15000,
  });

  const afterContinue = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(afterContinue.scheduledMessagesConfig.sheetId, sheetId);
  assert.equal(afterContinue.scheduledMessagesConfig.messagesSheetId, 101);
  assert.equal(afterContinue.scheduledMessagesConfig.logsSheetId, 102);

  assertNoPageErrors();
});

console.log('Scheduled messages config sync E2E passed');
