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
const sheetId = '1ScheduledExecutionRouteAaBbCc';
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
  'AI_Endpoint',
  'Automation_Link',
  'Status',
  'Exec_Count',
  'Exec_Log',
  'Last_Exec',
  'Next_Exec',
];
const messageRows = [
  [
    'asme-1',
    'AsMe fallback',
    'content',
    '2026-05-26',
    '',
    'AsMe',
    'private',
    'esone.qiu',
    '',
    '',
    '',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-26 09:00',
  ],
  [
    'bot-1',
    'Bot route',
    'content',
    '2026-05-26',
    '09:30',
    'Bot',
    'group',
    '',
    '123456',
    '',
    '',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-26 09:30',
  ],
  [
    'ai-1',
    'AI route',
    'project = MTR',
    '2026-05-26',
    '09:45',
    'AI',
    'api',
    '',
    '123456',
    'POST https://example.com/report',
    '',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-26 09:45',
  ],
  [
    'jira-ext-1',
    'External Jira rule',
    'external',
    '2026-05-26',
    '10:00',
    'JiraAutomation',
    'api',
    '',
    '',
    '',
    'https://jira.example.com/rule/42',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-26 10:00',
  ],
  [
    'outreach-1',
    'Ask Alex about ETA',
    'Can you confirm the ship ETA?',
    '2026-05-26',
    '',
    'Outreach',
    'private',
    'alex.chen',
    '',
    '',
    '',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-26 09:00',
  ],
];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-execution-route-browser-'),
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

function installAuthStub(page) {
  return page.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
    }
  });
}

async function installRoutes(page) {
  await page.route('http://localhost:3210/api/v1/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        outreachEnabled: true,
        ringCentralServerUrl: 'https://platform.ringcentral.com',
        ringCentralClientId: 'client-id',
        ringCentralClientSecretConfigured: true,
        ringCentralJwtConfigured: true,
      }),
    });
  });

  await page.route('http://localhost:3210/api/v1/outreach/templates/runtime-status**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            template: {
              id: 'outreach-1',
              targetType: 'private',
              targetRef: 'alex.chen',
              contextTemplate: 'confirm ETA',
              syncState: 'synced',
              enabled: true,
              updatedAt: Date.UTC(2026, 4, 26, 8, 0),
            },
            latestSession: {
              id: 'session-1',
              status: 'waiting_reply',
              updatedAt: Date.UTC(2026, 4, 26, 8, 0),
            },
          },
        ],
        total: 1,
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

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('https://jira.example.com/rest/api/2/project/MTR', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: '10001' }),
    });
  });

  await page.route('https://jira.example.com/rest/cb-automation/latest/project/10001/rule', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1646 }, { id: 1647 }]),
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
        created_at: '2026-05-26T06:00:00.000Z',
        botAutomation: {
          executorRule: {
            ruleId: '1646',
            ruleName: '[Esone] Scheduled Messages v1.4.0',
            webhookUrl: 'https://jira.example.com/hooks/executor',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-26T06:00:00.000Z',
            ruleVersion: '1.4.0',
          },
          timelineSyncRule: {
            ruleId: '1647',
            ruleName: '[Esone] Scheduled Messages Timeline Sync v1.4.0',
            webhookUrl: 'https://jira.example.com/hooks/timeline',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-26T06:00:00.000Z',
            ruleVersion: '1.4.0',
          },
        },
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);
  await installRoutes(page);

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });

  for (const routeText of [
    'AppScript · Mail fallback',
    'Jira Automation · Bot API',
    'Jira Automation · AI/API',
    '外部 Jira Automation',
    'memory-service · Outreach Runtime',
  ]) {
    await page.locator('text=' + routeText).first().waitFor({ timeout: 15000 });
  }

  await page.getByRole('button', { name: /新增/ }).click();
  await page.getByRole('heading', { name: /新增定时消息/ }).waitFor({ timeout: 15000 });
  await page.locator('text=执行引擎').first().waitFor({ timeout: 15000 });
  await page.locator('text=AppScript · Mail fallback').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Bot/ }).click();
  await page.locator('text=Jira Automation · Bot API').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /AI Report/ }).click();
  await page.locator('text=Jira Automation · AI/API').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: /帮我问/ }).click();
  await page.getByRole('heading', { name: /新增主动询问/ }).waitFor({ timeout: 15000 });
  await page.locator('text=memory-service · Outreach Runtime').first().waitFor({ timeout: 15000 });

  assertNoPageErrors();
  console.log('Scheduled messages execution route E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
