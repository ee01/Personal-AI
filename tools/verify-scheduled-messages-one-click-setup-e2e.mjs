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
const setupReceiptStorageKey = 'scheduledMessagesSetupReceipt';
const initializedSheetId = 'receipt-sheet-123';
const initializedHeaders = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'Status',
  'Exec_Count',
  'Exec_Log',
  'Last_Exec',
  'Next_Exec',
];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-one-click-setup-browser-'),
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
    assert.deepEqual(errors, [], `Scheduled setup page errors: ${errors.join('; ')}`);
  };
}

async function installInitializedRoutes(page) {
  await page.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
    }
  });

  await page.route('http://localhost:3210/api/v1/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        outreachEnabled: false,
        ringCentralServerUrl: '',
        ringCentralClientId: '',
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

    if (
      request.method() === 'GET' &&
      url.includes(`/spreadsheets/${initializedSheetId}/values/Messages?valueRenderOption=FORMATTED_VALUE`)
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            initializedHeaders,
            [
              'receipt-test-message',
              '初始化测试消息',
              '初始化完成后的测试消息',
              '2026-06-04',
              '09:30',
              'AsMe',
              'Active',
              '0',
              '待执行',
              '',
              '2026-06-04 09:30',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ values: [] }),
    });
  });

  await page.route('https://script.google.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        version: '2.8.5',
        lastUpdated: '2026-05-28',
      }),
    });
  });
}

let launched;
try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('h1', { hasText: '开始使用定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '一键生成维护表' }).waitFor({
    timeout: 15000,
  });
  await page.locator('text=维护表默认不会开放为“知道链接的任何人可编辑”').waitFor({
    timeout: 15000,
  });
  await page.locator('text=授权后设置定时触发器').waitFor({
    timeout: 15000,
  });

  assertNoPageErrors();

  await page.close();

  await serviceWorker.evaluate(async ({ sheetId, receiptKey }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId: 'script-receipt-123',
        webAppUrl: 'https://script.google.com/macros/s/deployment-receipt-123/exec',
        deploymentId: 'deployment-receipt-123',
        messagesSheetId: 101,
        logsSheetId: 103,
        minute_trigger_id: 'created-via-webapp',
        daily_trigger_id: 'created-via-webapp',
        sheet_version: '2.8',
        appScriptVersion: '2.8.5',
        appScriptLastUpdated: '2026-05-28',
        created_by: 'Personal AI Extension',
        created_at: '2026-06-04 09:00',
        last_sync_time: '2026-06-04 09:01',
        last_sync_action: 'one_click_setup',
      },
      [receiptKey]: {
        createdAt: '2026-06-04T01:01:00.000Z',
        sheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        scriptId: 'script-receipt-123',
        webAppUrl: 'https://script.google.com/macros/s/deployment-receipt-123/exec',
        deploymentId: 'deployment-receipt-123',
        messagesSheetId: 101,
        logsSheetId: 103,
        setupWarnings: [
          '未能自动设置 example.com 域内编辑权限，维护表已保持仅创建者可编辑；需要协作时请在 Google Sheet 中手动分享给指定成员、群组或目标受众。',
        ],
      },
    });
  }, { sheetId: initializedSheetId, receiptKey: setupReceiptStorageKey });

  const initializedPage = await context.newPage();
  const assertNoInitializedPageErrors = collectPageErrors(initializedPage);
  await installInitializedRoutes(initializedPage);

  await initializedPage.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await initializedPage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=定时消息系统已初始化').waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=Sheet: receipt-sheet-123').waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=Messages 101 / Logs 103').waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=Deployment: deployment...pt-123').waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=分钟 / 每日触发器已写入 Config').waitFor({
    timeout: 15000,
  });
  await initializedPage.locator('text=仅创建者可编辑').waitFor({
    timeout: 15000,
  });

  const storageAfterReceipt = await serviceWorker.evaluate(async ({ receiptKey }) => {
    return chrome.storage.local.get([receiptKey]);
  }, { receiptKey: setupReceiptStorageKey });
  assert.equal(
    Object.prototype.hasOwnProperty.call(storageAfterReceipt, setupReceiptStorageKey),
    false,
    'setup receipt should be consumed after the initialized page shows it',
  );

  assertNoInitializedPageErrors();
  console.log('Scheduled Messages one-click setup E2E verifier passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
