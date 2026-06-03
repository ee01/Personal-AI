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
const sheetId = '1AppScriptAutoUpdateAaBbCc';
const messagesHeaders = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'Status',
];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'appscript-auto-update-browser-'),
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
    assert.deepEqual(errors, [], `App Script update page errors: ${errors.join('; ')}`);
  };
}

async function installRoutes(page) {
  let versionUsageProbeCount = 0;

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

  await page.route(
    'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ email: 'esone.qiu@example.com' }),
      });
    },
  );

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = request.url();

    if (
      request.method() === 'GET' &&
      url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: [messagesHeaders] }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('https://script.google.com/macros/s/test/exec?action=getVersion', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.0',
        lastUpdated: '2025-01-01',
      }),
    });
  });

  await page.route('https://script.googleapis.com/v1/projects/script-123/versions?**', async (route) => {
    const count = versionUsageProbeCount === 0 ? 200 : 198;
    versionUsageProbeCount += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        versions: Array.from({ length: count }, (_, index) => ({
          versionNumber: index + 1,
        })),
      }),
    });
  });
}

let launched;
try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(
    async ({ targetSheetId }) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        scheduledMessagesConfig: {
          sheetId: targetSheetId,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
          messagesSheetId: 101,
          logsSheetId: 102,
          scriptId: 'script-123',
          webAppUrl: 'https://script.google.com/macros/s/test/exec',
          deploymentId: 'deployment-123',
          sheet_version: '2.8',
          created_by: 'Personal AI Extension',
          created_at: '2026-05-30T02:30:00.000Z',
          appScriptVersion: '1.0.0',
          appScriptLastUpdated: '2025-01-01',
        },
      });
    },
    { targetSheetId: sheetId },
  );

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installRoutes(page);

  await page.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) =>
        callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) =>
        callback();
    }
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('text=App Script 可升级，但版本历史已满').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Project History 200/200').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '重新检查' }).waitFor({
    timeout: 15000,
  });

  const dialogPromise = page.waitForEvent('dialog', { timeout: 15000 });
  await page.getByRole('button', { name: '重新检查' }).click();
  const dialog = await dialogPromise;
  assert.match(dialog.message(), /发现 App Script 新版本: 1\.0\.0 → 2\.8\.5/);
  await dialog.accept();

  await page.locator('text=App Script 可升级，版本历史接近上限').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Project History 198/200').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '升级调度系统', exact: true }).waitFor({
    timeout: 15000,
  });

  assertNoPageErrors();
  console.log('App Script auto-update E2E verifier passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
