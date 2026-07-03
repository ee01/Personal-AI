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

function installAuthStub(page) {
  return page.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) => callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) => callback();
    }
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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
      ['last_sync_action', 'manual_bind_use_sheet'],
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
        last_sync_action: 'bot_config_update',
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
  await page.locator('text=最近同步动作').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Bot / Timeline 配置更新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=手动绑定：使用 Sheet').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Web App URL').waitFor({
    timeout: 15000,
  });
  await page.locator('button', { hasText: '查看全部 10 项差异' }).click();
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

await withLaunchedExtension(async (launched) => {
  const { context, extensionId, serviceWorker } = launched;
  const remoteConfigRows = [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-12T06:00:00.000Z'],
    ['last_sync_time', '2026-05-12T09:30:00.000Z'],
    ['last_sync_action', 'app_script_metadata_update'],
    ['web_app_url', 'https://script.google.com/macros/s/remote/exec'],
    ['script_id', 'remote-script'],
    ['deployment_id', 'remote-deployment'],
    ['app_script_version', '2.8.5'],
    ['messages_sheet_id', '101'],
    ['logs_sheet_id', '102'],
  ];
  let configReadCount = 0;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T08:00:00.000Z',
        last_sync_action: 'bot_config_update',
        webAppUrl: 'https://script.google.com/macros/s/local/exec',
        scriptId: 'local-script',
        deploymentId: 'local-deployment',
        appScriptVersion: '2.7.0',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);

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

    if (request.method() === 'GET' && url.includes('/values/Config!A2:B')) {
      configReadCount += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: remoteConfigRows }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            headers,
            [
              'sync-row-1',
              'Config refresh proof',
              'Uses refreshed Config before loading messages',
              '2026-05-12',
              '09:45',
              'AsMe',
              'private',
              'Esone Qiu',
              '',
              'Active',
              '0',
              '',
              '',
              '2026-05-12 09:45',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected initialized page Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('span[title="Config refresh proof"]').waitFor({
    timeout: 15000,
  });

  await page.locator('button', { hasText: '同步' }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.locator('text=同步完成：Messages 已刷新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=当前列表读取到 1 条消息').waitFor({
    timeout: 15000,
  });
  await page.locator('text=采用配置: Sheet Config').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Config 阶段: 已从 Sheet Config 刷新本机配置').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: Config 阶段：先写入本机缓存，再读取 Messages / Logs；Messages / Logs 已读取；本次同步不发送消息、不执行队列、不改 Logs').waitFor({
    timeout: 15000,
  });
  await page.locator('text=下一步: Messages / Logs 已刷新；Config 阶段后续：检查列表是否已使用新的 Web App、Bot / Timeline 与子表定位').waitFor({
    timeout: 15000,
  });
  await page.locator('text=最近动作: App Script 元数据更新').waitFor({
    timeout: 15000,
  });

  const storageAfterSync = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(configReadCount, 1);
  assert.equal(storageAfterSync.scheduledMessagesConfig.webAppUrl, 'https://script.google.com/macros/s/remote/exec');
  assert.equal(storageAfterSync.scheduledMessagesConfig.scriptId, 'remote-script');
  assert.equal(storageAfterSync.scheduledMessagesConfig.deploymentId, 'remote-deployment');
  assert.equal(storageAfterSync.scheduledMessagesConfig.appScriptVersion, '2.8.5');
  assert.equal(storageAfterSync.scheduledMessagesConfig.messagesSheetId, 101);
  assert.equal(storageAfterSync.scheduledMessagesConfig.logsSheetId, 102);
  assert.equal(storageAfterSync.scheduledMessagesConfig.last_sync_time, '2026-05-12T09:30:00.000Z');

  assertNoPageErrors();
});

await withLaunchedExtension(async (launched) => {
  const { context, extensionId, serviceWorker } = launched;
  const delayedConfigRows = [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-12T06:00:00.000Z'],
    ['last_sync_time', '2026-05-12T09:30:00.000Z'],
    ['last_sync_action', 'app_script_metadata_update'],
    ['web_app_url', 'https://script.google.com/macros/s/delayed-remote/exec'],
    ['script_id', 'delayed-remote-script'],
    ['deployment_id', 'delayed-remote-deployment'],
    ['app_script_version', '2.8.5'],
    ['messages_sheet_id', '101'],
    ['logs_sheet_id', '102'],
  ];
  const configReadGate = createDeferred();
  let configReadCount = 0;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T08:00:00.000Z',
        last_sync_action: 'bot_config_update',
        webAppUrl: 'https://script.google.com/macros/s/local-delayed/exec',
        scriptId: 'local-delayed-script',
        deploymentId: 'local-delayed-deployment',
        appScriptVersion: '2.7.0',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);

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

    if (request.method() === 'GET' && url.includes('/values/Config!A2:B')) {
      configReadCount += 1;
      await configReadGate.promise;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: delayedConfigRows }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            headers,
            [
              'sync-row-delayed',
              'Delayed config sync proof',
              'Shows running boundary before Config adoption',
              '2026-05-12',
              '12:30',
              'AsMe',
              'private',
              'Esone Qiu',
              '',
              'Active',
              '0',
              '',
              '',
              '2026-05-12 12:30',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected delayed sync Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('span[title="Delayed config sync proof"]').waitFor({
    timeout: 15000,
  });

  const syncButton = page.locator('button', { hasText: '同步' });
  await syncButton.click();
  await page.locator('text=正在读取 Sheet Config；只有确认 Sheet 更新时才写本机缓存').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: 尚未确认采用 Sheet；进行中不发送消息、不改 Messages / Logs、不执行队列').waitFor({
    timeout: 15000,
  });
  await page.locator('text=下一步: 等待读取完成后查看采用配置、写入边界和恢复建议').waitFor({
    timeout: 15000,
  });
  assert.equal(await syncButton.isDisabled(), true, 'sync button should stay disabled during Config read');

  configReadGate.resolve();

  await page.locator('text=同步完成：Messages 已刷新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=采用配置: Sheet Config').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Config 阶段: 已从 Sheet Config 刷新本机配置').waitFor({
    timeout: 15000,
  });

  const storageAfterSync = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(configReadCount, 1);
  assert.equal(storageAfterSync.scheduledMessagesConfig.webAppUrl, 'https://script.google.com/macros/s/delayed-remote/exec');
  assert.equal(storageAfterSync.scheduledMessagesConfig.scriptId, 'delayed-remote-script');
  assert.equal(storageAfterSync.scheduledMessagesConfig.deploymentId, 'delayed-remote-deployment');

  assertNoPageErrors();
});

await withLaunchedExtension(async (launched) => {
  const { context, extensionId, serviceWorker } = launched;
  const conflictConfigRows = [
    ['sheet_version', '2.7'],
    ['created_by', 'Personal AI Extension'],
    ['created_at', '2026-05-12T06:00:00.000Z'],
    ['last_sync_time', '2026-05-12T09:30:00.000Z'],
    ['last_sync_action', 'app_script_metadata_update'],
    ['web_app_url', 'https://script.google.com/macros/s/sheet-conflict/exec'],
    ['script_id', 'sheet-conflict-script'],
    ['deployment_id', 'sheet-conflict-deployment'],
    ['app_script_version', '2.8.5'],
    ['messages_sheet_id', '101'],
    ['logs_sheet_id', '102'],
  ];
  let configReadCount = 0;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T09:30:00.000Z',
        last_sync_action: 'bot_config_update',
        webAppUrl: 'https://script.google.com/macros/s/local-conflict/exec',
        scriptId: 'local-conflict-script',
        deploymentId: 'local-conflict-deployment',
        appScriptVersion: '2.8.4',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);

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

    if (request.method() === 'GET' && url.includes('/values/Config!A2:B')) {
      configReadCount += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: conflictConfigRows }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            headers,
            [
              'sync-row-conflict',
              'Config conflict proof',
              'Keeps local Config when freshness ties but fields differ',
              '2026-05-12',
              '11:30',
              'AsMe',
              'private',
              'Esone Qiu',
              '',
              'Active',
              '0',
              '',
              '',
              '2026-05-12 11:30',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected conflict page Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('span[title="Config conflict proof"]').waitFor({
    timeout: 15000,
  });

  await page.locator('button', { hasText: '同步' }).click();
  await page.locator('text=同步完成：Messages 已刷新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=采用配置: 本机缓存').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Config 阶段: Config 有差异，未自动覆盖').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: Config 阶段：同步时间相同或不可判断，未覆盖本机缓存；Messages / Logs 已读取；本次同步不发送消息、不执行队列、不改 Logs').waitFor({
    timeout: 15000,
  });
  await page.locator('text=差异: 最近同步动作 | 本机: Bot / Timeline 配置更新 | Sheet: App Script 元数据更新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=差异: Web App URL | 本机: https://script.google.com/macros/s/local-conflict/exec | Sheet: https://script.google.com/macros/s/sheet-conflict/exec').waitFor({
    timeout: 15000,
  });
  await page.locator('text=更多差异: 另有 4 项，重新绑定可查看全部并选择采用哪一侧').waitFor({
    timeout: 15000,
  });

  const storageAfterSync = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(configReadCount, 1);
  assert.equal(storageAfterSync.scheduledMessagesConfig.webAppUrl, 'https://script.google.com/macros/s/local-conflict/exec');
  assert.equal(storageAfterSync.scheduledMessagesConfig.scriptId, 'local-conflict-script');
  assert.equal(storageAfterSync.scheduledMessagesConfig.deploymentId, 'local-conflict-deployment');
  assert.equal(storageAfterSync.scheduledMessagesConfig.appScriptVersion, '2.8.4');
  assert.equal(storageAfterSync.scheduledMessagesConfig.last_sync_action, 'bot_config_update');

  assertNoPageErrors();
});

await withLaunchedExtension(async (launched) => {
  const { context, extensionId, serviceWorker } = launched;
  let configReadCount = 0;
  let messagesReadCount = 0;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T09:30:00.000Z',
        last_sync_action: 'bot_config_update',
        webAppUrl: 'https://script.google.com/macros/s/local-message-fail/exec',
        scriptId: 'local-message-fail-script',
        deploymentId: 'local-message-fail-deployment',
        appScriptVersion: '2.8.4',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);

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

    if (request.method() === 'GET' && url.includes('/values/Config!A2:B')) {
      configReadCount += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            ['sheet_version', '2.7'],
            ['created_by', 'Personal AI Extension'],
            ['created_at', '2026-05-12T06:00:00.000Z'],
            ['last_sync_time', '2026-05-12T09:30:00.000Z'],
            ['last_sync_action', 'bot_config_update'],
            ['web_app_url', 'https://script.google.com/macros/s/local-message-fail/exec'],
            ['script_id', 'local-message-fail-script'],
            ['deployment_id', 'local-message-fail-deployment'],
            ['app_script_version', '2.8.4'],
          ],
        }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      messagesReadCount += 1;
      if (messagesReadCount > 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Messages read unavailable' } }),
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            headers,
            [
              'sync-row-message-fail',
              'Messages refresh failure proof',
              'Config can succeed while Messages refresh fails',
              '2026-05-12',
              '13:30',
              'AsMe',
              'private',
              'Esone Qiu',
              '',
              'Active',
              '0',
              '',
              '',
              '2026-05-12 13:30',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected message-failure Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('span[title="Messages refresh failure proof"]').waitFor({
    timeout: 15000,
  });

  await page.locator('button', { hasText: '同步' }).click();
  await page.locator('text=Messages 刷新失败').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Messages read unavailable').waitFor({
    timeout: 15000,
  });
  await page.locator('text=采用配置: 本机缓存').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Config 阶段: Config 已是最新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=未确认当前列表为最新；未发送消息、未执行队列、未改 Logs').waitFor({
    timeout: 15000,
  });

  assert.equal(configReadCount, 1);
  assert.equal(messagesReadCount, 2);
  assertNoPageErrors();
});

await withLaunchedExtension(async (launched) => {
  const { context, extensionId, serviceWorker } = launched;
  let configReadCount = 0;

  await serviceWorker.evaluate(async ({ targetSheetId }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      scheduledMessagesConfig: {
        sheetId: targetSheetId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        sheet_version: '2.7',
        created_by: 'Personal AI Extension',
        created_at: '2026-05-12T06:00:00.000Z',
        last_sync_time: '2026-05-12T08:00:00.000Z',
        last_sync_action: 'bot_config_update',
        webAppUrl: 'https://script.google.com/macros/s/local/exec',
        scriptId: 'local-script',
        deploymentId: 'local-deployment',
        appScriptVersion: '2.7.0',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installAuthStub(page);

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

    if (request.method() === 'GET' && url.includes('/values/Config!A2:B')) {
      configReadCount += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Config read unavailable' } }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            headers,
            [
              'sync-row-local-cache',
              'Local cache fallback proof',
              'Keeps local Config when Sheet Config read fails',
              '2026-05-12',
              '10:30',
              'AsMe',
              'private',
              'Esone Qiu',
              '',
              'Active',
              '0',
              '',
              '',
              '2026-05-12 10:30',
            ],
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unexpected fallback page Sheets API call: ${url}` } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('span[title="Local cache fallback proof"]').waitFor({
    timeout: 15000,
  });

  await page.locator('button', { hasText: '同步' }).click();
  await page.locator('text=同步完成：Messages 已刷新').waitFor({
    timeout: 15000,
  });
  await page.locator('text=采用配置: 本机缓存').waitFor({
    timeout: 15000,
  });
  await page.locator('text=Config 阶段: Config 刷新失败').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: Config 阶段：Sheet Config 读取失败，未更新本机缓存；Messages / Logs 已读取；本次同步不发送消息、不执行队列、不改 Logs').waitFor({
    timeout: 15000,
  });
  await page.locator('text=下一步: Messages / Logs 已刷新；Config 阶段后续：确认 Google 授权、网络或 Config 表后重试同步').waitFor({
    timeout: 15000,
  });

  const storageAfterSync = await serviceWorker.evaluate(async () => {
    return chrome.storage.local.get(['scheduledMessagesConfig']);
  });
  assert.equal(configReadCount, 1);
  assert.equal(storageAfterSync.scheduledMessagesConfig.webAppUrl, 'https://script.google.com/macros/s/local/exec');
  assert.equal(storageAfterSync.scheduledMessagesConfig.scriptId, 'local-script');
  assert.equal(storageAfterSync.scheduledMessagesConfig.deploymentId, 'local-deployment');
  assert.equal(storageAfterSync.scheduledMessagesConfig.appScriptVersion, '2.7.0');
  assert.equal(storageAfterSync.scheduledMessagesConfig.last_sync_time, '2026-05-12T08:00:00.000Z');

  assertNoPageErrors();
});

console.log('Scheduled messages config sync E2E passed');
