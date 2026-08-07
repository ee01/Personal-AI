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
const spreadsheetsScope = 'https://www.googleapis.com/auth/spreadsheets';
const presentationsScope = 'https://www.googleapis.com/auth/presentations';

const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'google-auth-scopes-e2e-'),
);
let context;

try {
  context = await chromium.launchPersistentContext(userDataDir, {
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

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: '1GoogleAuthScopesE2eSheet',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/1GoogleAuthScopesE2eSheet/edit',
        messagesSheetId: 101,
        logsSheetId: 102,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
      },
    });
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(({ slidesScope }) => {
    globalThis.__googleAuthScopeRequests = [];
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (details, callback) => {
        globalThis.__googleAuthScopeRequests.push({
          interactive: Boolean(details.interactive),
          scopes: [...(details.scopes || [])],
        });
        callback('partial-slides-token', [slidesScope]);
      };
      chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
    }
  }, { slidesScope: presentationsScope });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('text=需要 Google Sheets 授权').waitFor({ timeout: 15000 });
  await page.locator('text=尚未授予 Google Sheets 权限').waitFor({ timeout: 15000 });
  await page.locator('text=本次不会请求 Google Slides 权限').waitFor({ timeout: 15000 });

  await page.locator('button', { hasText: '重新授权' }).click();
  await page.locator('text=尚未授予 Google Sheets 权限').waitFor({ timeout: 15000 });

  const requests = await page.evaluate(() => globalThis.__googleAuthScopeRequests);
  const sheetsRequests = requests.filter((request) =>
    request.scopes.includes('https://www.googleapis.com/auth/spreadsheets'),
  );
  assert.ok(sheetsRequests.length >= 2, 'Scheduled Messages should retry its Sheets scope');
  assert.ok(
    sheetsRequests.some((request) => request.interactive),
    'Explicit reauthorization should include an interactive Sheets request',
  );
  assert.ok(
    requests.every((request) => !request.scopes.includes(presentationsScope)),
    'Scheduled Messages page must never request the Slides scope',
  );
  assert.ok(
    sheetsRequests.every((request) => request.scopes.length === 1 && request.scopes[0] === spreadsheetsScope),
    'Scheduled Messages Sheets requests should contain only the Sheets scope',
  );
  assert.deepEqual(pageErrors, []);

  console.log('✅ Google auth scopes E2E passed');
} finally {
  await context?.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
