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
const appScriptTemplate = await fs.readFile(
  path.join(repoRoot, 'src/scheduled-messages/app-script-template.gs'),
  'utf8',
);
const templateVersion = appScriptTemplate.match(/var APP_SCRIPT_VERSION = '([^']+)';/)?.[1];
const templateLastUpdated = appScriptTemplate.match(/var APP_SCRIPT_LAST_UPDATED = '([^']+)';/)?.[1];

assert.ok(templateVersion, 'App Script template version should be readable');
assert.ok(templateLastUpdated, 'App Script template last-updated date should be readable');

const messagesHeaders = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'End_Date',
  'Repeat_Every',
  'Repeat_Unit',
  'Repeat_Count',
  'Repeat_Days',
  'Timeline_Project',
  'Timeline_Milestone',
  'Timeline_Offset',
  'Push_Method',
  'Glip_User_Name',
  'Glip_Team_ID',
  'Attachment',
  'AI_Endpoint',
  'AI_Headers',
  'AI_Body',
  'Category',
  'Automation_Link',
  'Status',
  'Last_Exec',
  'Next_Exec',
  'Exec_Count',
  'Exec_Log',
];
const logsHeaders = [
  'Timestamp',
  'Message_ID',
  'Topic',
  'Content',
  'Push_Method',
  'Target',
  'Status',
  'Error',
  'Exec_Count',
  'Execution_Key',
  'Sent_Chat_ID',
  'Sent_Post_ID',
  'Sent_At',
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
  let deploymentUpdated = false;

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
      url.includes(`/spreadsheets/${sheetId}?fields=sheets.properties`)
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          sheets: [
            { properties: { title: 'Messages', sheetId: 101, gridProperties: { columnCount: 40 } } },
            { properties: { title: 'Logs', sheetId: 102, gridProperties: { columnCount: 20 } } },
          ],
        }),
      });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.includes('/values/Messages!1:1')
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: [messagesHeaders] }),
      });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.includes('/values/Logs!1:1')
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: [logsHeaders] }),
      });
      return;
    }

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
        version: deploymentUpdated ? templateVersion : '1.0.0',
        lastUpdated: deploymentUpdated ? templateLastUpdated : '2025-01-01',
      }),
    });
  });

  await page.route('https://script.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = request.url();

    if (
      url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          deploymentId: 'deployment-123',
          deploymentConfig: { versionNumber: 7 },
          entryPoints: [{
            entryPointType: 'WEB_APP',
            webApp: { url: 'https://script.google.com/macros/s/test/exec' },
          }],
        }),
      });
      return;
    }

    if (
      url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123' &&
      request.method() === 'PUT'
    ) {
      deploymentUpdated = true;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    if (
      url === 'https://script.googleapis.com/v1/projects/script-123/content' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          files: [{
            name: 'Code',
            type: 'SERVER_JS',
            source: appScriptTemplate,
          }],
        }),
      });
      return;
    }

    if (
      url === 'https://script.googleapis.com/v1/projects/script-123/content' &&
      request.method() === 'PUT'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    if (
      url === 'https://script.googleapis.com/v1/projects/script-123/versions' &&
      request.method() === 'POST'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ versionNumber: 8 }),
      });
      return;
    }

    if (
      url.startsWith('https://script.googleapis.com/v1/projects/script-123/versions?') &&
      request.method() === 'GET'
    ) {
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
      return;
    }

    throw new Error(`Unexpected Apps Script API request: ${request.method()} ${url}`);
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
  assert.match(
    dialog.message(),
    new RegExp(`发现 App Script 新版本: 1\\.0\\.0 → ${templateVersion.replace(/\./g, '\\.')}`),
  );
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

  const confirmPromise = page.waitForEvent('dialog', { timeout: 15000 }).then(async (confirmDialog) => {
    assert.match(confirmDialog.message(), /确定要升级调度系统吗/);
    assert.match(confirmDialog.message(), /提交后确认新版本已生效/);
    await confirmDialog.accept();
  });
  await Promise.all([
    confirmPromise,
    page.getByRole('button', { name: '升级调度系统', exact: true }).click(),
  ]);

  await page.locator('text=App Script 升级请求回执').waitFor({
    timeout: 15000,
  });
  await page.locator('text=升级请求已提交，正在依次检查 Sheet、App Script deployment 和 Jira Automation').waitFor({
    timeout: 15000,
  });
  await page.locator('text=尚未确认: Web App URL 返回新版本、Sheet/Storage 标记最新、Jira rule 更新完成').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: 等待完成前不发送定时消息、不触发 Bot/Chrome/Doubao、不确认通知').waitFor({
    timeout: 15000,
  });

  const resultDialog = await page.waitForEvent('dialog', { timeout: 45000 });
  assert.match(resultDialog.message(), /版本升级完成/);
  assert.match(resultDialog.message(), new RegExp(`App Script 已升级到 ${templateVersion.replace(/\./g, '\\.')}`));
  await resultDialog.accept();

  await page.locator('text=App Script 升级结果回执').waitFor({
    timeout: 15000,
  });
  await page.locator(`text=App Script 已升级到 ${templateVersion}`).waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: 已是最新时跳过脚本写入；失败项保留现有版本').waitFor({
    timeout: 15000,
  });
  await page.locator('text=下一步: 同步刷新确认执行配置').waitFor({
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
