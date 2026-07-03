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

  await page.route('https://script.google.com/macros/s/scheduled-route-e2e/exec**', async (route) => {
    const url = route.request().url();

    if (url.includes('dryRun=true')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          dryRun: true,
          wouldCache: true,
          requestId: 'tl_mThor_dry_e2e',
          project: 'mThor',
          paramKey: 'mThor',
          payloadBytes: 384,
          maxBytes: 9216,
          milestoneCount: 1,
          milestoneKeys: ['FF'],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        generatedAt: '2026-05-26T08:00:00.000Z',
        maxAgeMs: 36 * 60 * 60 * 1000,
        totalProjects: 1,
        readyProjects: 1,
        missingProjects: 0,
        staleProjects: 0,
        allProjectsReady: true,
        projects: [{
          project: 'mThor',
          paramKey: 'mThor',
          cached: true,
          valid: true,
          expired: false,
          status: 'ready',
          updatedAt: '2026-05-26T07:45:00.000Z',
          ageMs: 15 * 60 * 1000,
          milestoneKeys: ['FF', 'Release'],
          lastAttempt: {
            success: false,
            requestId: 'tl_mThor_failed_e2e',
            ageMs: 10 * 60 * 1000,
            errorCode: 'INVALID_POST_JSON',
            parseError: 'POST JSON 解析失败',
          },
        }],
      }),
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
        webAppUrl: 'https://script.google.com/macros/s/scheduled-route-e2e/exec',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.addInitScript(() => {
    window.__timelineDiagnosticClipboard = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__timelineDiagnosticClipboard = text;
        },
      },
    });
  });
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
  for (const laneText of [
    '领取口径：AppScript 09:00 默认 · 非 executor 队列',
    '领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回',
    '领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 领取时先写回',
    '领取口径：外部规则 · Personal AI 不领取',
    '领取口径：Outreach Runtime · 模板触发/追问',
  ]) {
    await page.locator('text=' + laneText).first().waitFor({ timeout: 15000 });
  }

  await page.getByRole('button', { name: /新增/ }).click();
  await page.getByRole('heading', { name: /新增定时消息/ }).waitFor({ timeout: 15000 });
  await page.locator('text=预计下次执行').first().waitFor({ timeout: 15000 });
  await page.getByRole('tab', { name: '🤖 Bot（机器人）' }).click();
  await page.locator('text=预计下次执行').first().waitFor({ timeout: 15000 });
  await page.getByRole('tab', { name: '🤖 AI Report' }).click();
  await page.locator('text=预计下次执行').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '📅 Timeline 触发' }).click();
  await page.locator('text=Timeline 缓存状态').first().waitFor({ timeout: 15000 });
  await page.locator('text=mThor：可用').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '查看 Timeline 缓存原因' }).click();
  await page.locator('text=诊断范围：项目 mThor / Milestone FF。当前只读取 App Script 已缓存状态').first().waitFor({ timeout: 15000 });
  await page.locator('text=不会写 Timeline 缓存、不会保存或发送消息').first().waitFor({ timeout: 15000 });
  await page.locator('text=真实 Jira Sync Rule 需要在 Jira 执行后再刷新确认').first().waitFor({ timeout: 15000 });
  await page.locator('text=mThor: 当前使用已有缓存，最近同步失败').first().waitFor({ timeout: 15000 });
  await page.locator('text=当前已有缓存仍可触发；最近同步失败可能让后续发布节奏停留在旧缓存。').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '复制诊断' }).click();
  await page.locator('text=已复制 Timeline 缓存诊断到本机剪贴板').first().waitFor({ timeout: 15000 });
  await page.locator('text=没有刷新缓存、没有写 Timeline 缓存，也没有保存或发送消息').first().waitFor({ timeout: 15000 });
  const copiedTimelineDiagnostic = await page.evaluate(() => window.__timelineDiagnosticClipboard || '');
  assert.match(copiedTimelineDiagnostic, /Timeline 缓存诊断/);
  assert.match(copiedTimelineDiagnostic, /项目: mThor/);
  assert.match(copiedTimelineDiagnostic, /最近同步失败（10 分钟前）：INVALID_POST_JSON - POST JSON 解析失败/);
  assert.match(copiedTimelineDiagnostic, /请求 ID tl_mThor_failed_e2e/);
  assert.match(copiedTimelineDiagnostic, /Jira Send web request 修复模板/);
  assert.match(copiedTimelineDiagnostic, /Method: GET/);
  assert.match(copiedTimelineDiagnostic, /Apps Script dry-run 测试 curl/);
  assert.match(copiedTimelineDiagnostic, /Timeline Sync Rule: https:\/\/jira\.example\.com\/secure\/AutomationProjectAdminAction!default\.jspa\?projectKey=MTR#\/rule\/1647/);
  await page.getByRole('button', { name: '样例测试' }).click();
  await page.locator('text=验证范围：项目 mThor，样例 Milestone FF。').first().waitFor({ timeout: 15000 });
  await page.locator('text=不代表真实 Jira Rule 已同步').first().waitFor({ timeout: 15000 });
  await page.locator('text=手动运行 Timeline Sync Rule 后刷新状态').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: /帮我问/ }).click();
  await page.getByRole('heading', { name: /新增主动询问/ }).waitFor({ timeout: 15000 });
  await page.locator('text=memory-service · Outreach Runtime').first().waitFor({ timeout: 15000 });

  assertNoPageErrors();

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
      },
    });
  }, { targetSheetId: sheetId });

  const unconfiguredPage = await context.newPage();
  const assertNoUnconfiguredPageErrors = collectPageErrors(unconfiguredPage);
  await installAuthStub(unconfiguredPage);
  await installRoutes(unconfiguredPage);

  await unconfiguredPage.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await unconfiguredPage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });

  await unconfiguredPage.getByRole('button', { name: /新增/ }).click();
  await unconfiguredPage.getByRole('heading', { name: /新增定时消息/ }).waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=预计下次执行').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=可预览 · 待配置').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=发送配置待完成').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=不会写入 Messages、不会发送，也不会创建 Jira Rule').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.getByRole('button', { name: /配置 @ 人发送能力/ }).click();
  await unconfiguredPage.getByRole('heading', { name: /配置 Bot 推送/ }).waitFor({ timeout: 15000 });
  assert.equal(
    await unconfiguredPage.getByLabel('RingCentral AsMe sender').isChecked(),
    true,
    'RingCentral sender config should open with sender enabled from the AsMe setup CTA',
  );
  for (const permissionText of [
    'RingCentral app 权限要求',
    'ReadAccounts',
    'ReadMessages',
    'EditMessages',
    '403 InsufficientPermissions',
    'Cannot resolve target personName',
  ]) {
    await unconfiguredPage.locator('text=' + permissionText).first().waitFor({ timeout: 15000 });
  }
  await unconfiguredPage.getByRole('button', { name: '✕' }).last().click();
  await unconfiguredPage.getByRole('heading', { name: /配置 Bot 推送/ }).waitFor({
    state: 'hidden',
    timeout: 15000,
  });

  const unconfiguredBotButton = unconfiguredPage.getByRole('tab', { name: /Bot（机器人）/ });
  assert.equal(
    await unconfiguredBotButton.isDisabled(),
    false,
    'Bot option should remain selectable so users can fill the draft before completing setup',
  );
  await unconfiguredBotButton.click();
  await unconfiguredPage.locator('text=发送配置').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=需要先完成配置').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=当前发送方式还缺少必要配置').first().waitFor({ timeout: 15000 });
  await unconfiguredPage.locator('text=请先完成配置后再保存').first().waitFor({ timeout: 15000 });
  const blockedSubmit = unconfiguredPage.getByRole('button', { name: '先完成配置' });
  assert.equal(await blockedSubmit.isDisabled(), true, 'missing Bot executor should block saving');
  await unconfiguredPage.getByRole('button', { name: '配置 Bot 执行规则' }).click();
  await unconfiguredPage.getByRole('heading', { name: /配置 Bot 推送/ }).waitFor({ timeout: 15000 });

  assertNoUnconfiguredPageErrors();
  console.log('Scheduled messages execution route E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
