/**
 * Captures screenshots of the Scheduled Messages manager header / utility bar so the
 * placement of the 「同步」 and 「检查脚本」 maintenance actions can be reviewed visually.
 *
 * Usage: node tools/capture-scheduled-messages-maintenance-actions.mjs [outputDir]
 * Requires a fresh extension build in dist/ (npm start or npx webpack --config webpack.dev.cjs).
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');
const outputDir = path.resolve(process.argv[2] || path.join(repoRoot, 'artifacts', 'scheduled-messages-maintenance'));

const sheetId = '1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp';
const appScriptVersion = '2.13.0';

const headers = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'Target_Type',
  'Glip_User_Name',
  'Glip_Team_ID',
  'Status',
  'Exec_Count',
  'Exec_Log',
  'Last_Exec',
  'Next_Exec',
];

const messageRows = [
  headers,
  [
    'msg-1',
    'Release reminder',
    'Remind the team about the release checklist',
    '2026-09-20',
    '09:00',
    'AsMe',
    'private',
    'Esone Qiu',
    '',
    'Active',
    '0',
    '',
    '',
    '2026-09-20 09:00',
  ],
  [
    'msg-2',
    'Weekly report',
    'Send the weekly status report',
    '2026-09-21',
    '08:00',
    'Bot',
    'group',
    '',
    '1234567890',
    'Active',
    '0',
    '',
    '',
    '2026-09-21 08:00',
  ],
];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scheduled-maintenance-capture-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
    userDataDir,
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const { context, extensionId, serviceWorker, userDataDir } = await launchExtensionContext();

  try {
    await serviceWorker.evaluate(
      async ({ targetSheetId }) => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({
          scheduledMessagesConfig: {
            sheetId: targetSheetId,
            sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
            messagesSheetId: 101,
            logsSheetId: 102,
            configSheetId: 100,
            scriptId: 'script-123',
            webAppUrl: 'https://script.google.com/macros/s/test/exec',
            deploymentId: 'deployment-123',
            sheet_version: '2.8',
            created_by: 'Personal AI Extension',
            created_at: '2026-05-30T02:30:00.000Z',
            last_sync_time: '2026-09-14T02:30:00.000Z',
            appScriptVersion: '2.13.0',
            appScriptLastUpdated: '2026-09-03',
          },
        });
      },
      { targetSheetId: sheetId },
    );

    const page = await context.newPage();

    await page.addInitScript(() => {
      if (globalThis.chrome?.identity) {
        chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
        chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
      }
    });

    await page.route('https://sheets.googleapis.com/**', async (route) => {
      const request = route.request();
      const url = request.url();

      if (request.method() === 'GET' && url.includes('fields=sheets.properties')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            sheets: [
              { properties: { sheetId: 101, title: 'Messages', index: 0 } },
              { properties: { sheetId: 102, title: 'Logs', index: 1 } },
              { properties: { sheetId: 100, title: 'Config', index: 2 } },
            ],
          }),
        });
        return;
      }

      if (request.method() === 'GET' && url.includes('/values/Messages')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ values: messageRows }),
        });
        return;
      }

      if (request.method() === 'GET' && url.includes('/values/Logs')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ values: [['Message_ID', 'Executed_At', 'Status', 'Detail']] }),
        });
        return;
      }

      if (request.method() === 'GET' && url.includes('/values/Config')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            values: [
              ['sheet_version', '2.8'],
              ['created_by', 'Personal AI Extension'],
              ['created_at', '2026-05-30T02:30:00.000Z'],
              ['last_sync_time', '2026-09-14T02:30:00.000Z'],
              ['messages_sheet_id', '101'],
              ['logs_sheet_id', '102'],
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.route('https://script.google.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ version: '2.13.0', lastUpdated: '2026-09-03' }),
      });
    });

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

    await page.route('https://script.googleapis.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
      waitUntil: 'load',
      timeout: 15000,
    });
    await page.locator('h1', { hasText: '定时消息管理' }).waitFor({ timeout: 15000 });
    await page.locator('span[title="Release reminder"]').waitFor({ timeout: 15000 });
    // Let the background App Script check settle so the utility bar shows its final state.
    await page.waitForTimeout(1500);

    const headerPath = path.join(outputDir, 'header.png');
    const utilityBarPath = path.join(outputDir, 'utility-bar.png');
    const fullPagePath = path.join(outputDir, 'full-page.png');

    await page.screenshot({ path: fullPagePath, fullPage: true });

    const headerBox = await page.locator('header').first().boundingBox();
    if (headerBox) {
      await page.screenshot({
        path: headerPath,
        clip: { x: 0, y: 0, width: 1440, height: Math.ceil(headerBox.height) },
      });
    }

    const syncButtonBox = await page.locator('button', { hasText: '同步' }).first().boundingBox();
    if (syncButtonBox) {
      const clipX = Math.max(0, Math.floor(syncButtonBox.x - 420));
      const clipY = Math.max(0, Math.floor(syncButtonBox.y - 18));
      await page.screenshot({
        path: utilityBarPath,
        clip: {
          x: clipX,
          y: clipY,
          width: Math.min(1440 - clipX, 900),
          height: Math.ceil(syncButtonBox.height + 36),
        },
      });
    }

    console.log(`header: ${headerPath}`);
    console.log(`utility bar: ${utilityBarPath}`);
    console.log(`full page: ${fullPagePath}`);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

await main();
