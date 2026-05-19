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

async function expectDisabledButton(page, text) {
  const button = page.locator('button', { hasText: text });
  await button.waitFor({
    timeout: 15000,
  });
  assert.equal(await button.isDisabled(), true, `${text} button should be disabled`);
}

async function openSetupPage(launched, options = {}) {
  const { context, extensionId, serviceWorker } = launched;
  const configRows = options.configRows || [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-12T06:00:00.000Z'],
    ['last_sync_time', '2026-05-12T07:00:00.000Z'],
    ['messages_sheet_id', '101'],
    ['logs_sheet_id', '102'],
  ];

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
          values: configRows,
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
  const { page, assertNoPageErrors } = await openSetupPage(launched);

  await page.locator('input[placeholder="粘贴 Sheet URL 或 Sheet ID..."]').fill(`https://example.com/open?id=${sheetId}`);
  await page.locator('[role="alert"]', { hasText: '无法识别 Sheet 链接或 ID' }).waitFor({
    timeout: 15000,
  });
  await expectDisabledButton(page, '等待有效链接');

  assertNoPageErrors();
});

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
  const { page, assertNoPageErrors } = await openSetupPage(launched, {
    configRows: [
      ['sheet_version', '2.7'],
      ['created_by', 'Personal AI Extension'],
      ['created_at', '2026-05-12T06:00:00.000Z'],
      ['web_app_url', 'https://script.google.com/macros/s/sheet/exec'],
      ['script_id', 'sheet-script'],
      ['deployment_id', 'sheet-deployment'],
      ['app_script_version', '2.7.1'],
      ['minute_trigger_id', 'sheet-minute-trigger'],
      ['daily_trigger_id', 'sheet-daily-trigger'],
      ['messages_sheet_id', '101'],
      ['logs_sheet_id', '102'],
      ['bot_automation_executor_rule_id', 'executor-rule'],
      ['bot_automation_executor_rule_name', 'Executor'],
      ['bot_automation_executor_webhook_url', 'https://jira.example.com/rest/cb-automation/latest/hooks/sheet-webhook-secret'],
      ['bot_automation_executor_project_key', 'MTR'],
      ['bot_automation_executor_jira_url', 'https://jira.example.com'],
    ],
  });

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        webAppUrl: 'https://script.google.com/macros/s/local/exec',
        scriptId: 'local-script',
        deploymentId: 'local-deployment',
        appScriptVersion: '2.7.0',
        minute_trigger_id: 'local-minute-trigger',
        daily_trigger_id: 'local-daily-trigger',
        messagesSheetId: 202,
        logsSheetId: 203,
        botAutomation: {
          executorRule: {
            ruleId: 'executor-rule',
            ruleName: 'Executor',
            webhookUrl: 'https://jira.example.com/rest/cb-automation/latest/hooks/local-webhook-secret',
            projectKey: 'MTR',
            jiraUrl: 'https://jira.example.com',
            createdAt: '2026-05-12T06:00:00.000Z',
          },
        },
      },
    });
  }, { targetSheetId: sheetId });

  await page.locator('input[placeholder="粘贴 Sheet URL 或 Sheet ID..."]').fill(sheetId);
  await page.locator('button', { hasText: '绑定已有表' }).click();

  await page.locator('text=本机和 Sheet 配置不一致').waitFor({
    timeout: 15000,
  });
  await page.locator('text=同步时间相同或缺失，但关键配置不同').waitFor({
    timeout: 15000,
  });
  await page.locator('text=配置差异').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Web App URL').waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '查看全部 9 项差异' }).click();
  await page.locator('text=Messages 子表 ID').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Logs 子表 ID').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Bot 执行 Webhook').waitFor({
    timeout: 15000,
  });
  assert.equal(await page.locator('text=local-webhook-secret').count(), 0);
  assert.equal(await page.locator('text=sheet-webhook-secret').count(), 0);
  await page.locator('button', { hasText: '收起差异' }).waitFor({
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
