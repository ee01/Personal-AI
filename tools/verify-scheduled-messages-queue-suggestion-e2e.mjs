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
const sheetId = '1ScheduledQueueSuggestionAaBbCc';
const headers = [
  'ID',
  'Topic',
  'Content',
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'Target_Type',
  'Status',
  'Exec_Count',
  'Exec_Log',
  'Last_Exec',
  'Next_Exec',
];
let messageRows = Array.from({ length: 32 }, (_, index) => [
  `msg-${index + 1}`,
  `Risk ${index + 1}`,
  'content',
  '2026-05-04',
  '09:30',
  'Bot',
  'group',
  'Active',
  '0',
  '待执行',
  '',
  '2026-05-04 09:30',
]);
messageRows.push(
  [
    'safe-1',
    'Safe 10:30 A',
    'content',
    '2026-05-04',
    '10:30',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:30',
  ],
  [
    'safe-2',
    'Safe 10:30 B',
    'content',
    '2026-05-04',
    '10:30',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:30',
  ],
  [
    'safe-3',
    'Safe 10:45 A',
    'content',
    '2026-05-04',
    '10:45',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:45',
  ],
  [
    'safe-4',
    'Safe 10:45 B',
    'content',
    '2026-05-04',
    '10:45',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 10:45',
  ],
  [
    'safe-5',
    'Safe 11:00 A',
    'content',
    '2026-05-04',
    '11:00',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 11:00',
  ],
  [
    'safe-6',
    'Safe 11:00 B',
    'content',
    '2026-05-04',
    '11:00',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 11:00',
  ],
);
let appliedUpdate = null;

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-queue-suggestion-browser-'),
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

function installFixedClock(page, fixedNowMs = new Date(2026, 4, 4, 8, 0, 0, 0).getTime()) {
  return page.addInitScript((fixedNow) => {
    const OriginalDate = Date;

    class FixedDate extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedNow);
        } else {
          super(...args);
        }
      }

      static now() {
        return fixedNow;
      }

      static parse(value) {
        return OriginalDate.parse(value);
      }

      static UTC(...args) {
        return OriginalDate.UTC(...args);
      }
    }

    globalThis.Date = FixedDate;
  }, fixedNowMs);
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

    if (request.method() === 'GET' && url.includes('/values/Messages?valueRenderOption=FORMATTED_VALUE')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ values: [headers, ...messageRows] }),
      });
      return;
    }

    if (request.method() === 'PUT' && url.includes('/values/Messages!')) {
      const payload = JSON.parse(request.postData() || '{}');
      const row = payload.values?.[0];
      assert.ok(row, 'update payload should include one row');

      const id = row[headers.indexOf('ID')];
      const date = row[headers.indexOf('Schedule_Date')];
      const time = row[headers.indexOf('Schedule_Time')];
      appliedUpdate = { id, date, time };
      const rowIndex = messageRows.findIndex(candidate => candidate[0] === id);
      assert.notEqual(rowIndex, -1, `updated row should exist: ${id}`);
      messageRows[rowIndex] = row;

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ updatedRows: 1 }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({}),
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
        created_at: '2026-05-14T06:00:00.000Z',
      },
    });
  }, { targetSheetId: sheetId });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installFixedClock(page);
  await installRoutes(page);
  await installAuthStub(page);

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await page.locator('text=执行器队列可能延迟').waitFor({
    timeout: 15000,
  });
  await page.locator('text=条消息正在排队').first().waitFor({
    timeout: 15000,
  });
  await page.locator(
    'text=38 条消息正在排队，4 个时间槽有拥挤，最大同槽 32 条，最大预计延后 31 分钟；1 个需要调整，展开后可查看建议依据和改期入口',
  ).waitFor({
    timeout: 15000,
  });
  assert.equal(
    await page.locator('text=建议处理：Risk 32（第 32/32 个）').count(),
    0,
    'queue slot details should be collapsed by default',
  );
  await page.getByRole('button', { name: '查看执行器队列详情' }).click();
  await page
    .locator(
      'text=操作边界：改到建议只写回最晚消息的 Schedule_Date / Schedule_Time，不会立即发送、不会跳过前序消息',
    )
    .waitFor({
      timeout: 15000,
    });
  await page.locator('text=建议处理：Risk 32（第 32/32 个）').waitFor({
    timeout: 15000,
  });
  await page.getByText('前面 31 条会先执行', { exact: true }).waitFor({
    timeout: 15000,
  });
  await page.getByText('Risk 1', { exact: true }).first().waitFor({
    timeout: 15000,
  });
  await page.locator('text=建议改到 2026-05-04 10:01').waitFor({
    timeout: 15000,
  });
  await page.locator(
    'text=原因：同执行时间第 32/32 个，前面 31 条会先执行，可能超过 30 分钟补偿窗口',
  ).waitFor({
    timeout: 15000,
  });
  await page
    .locator('text=写入后领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回')
    .first()
    .waitFor({
      timeout: 15000,
    });
  await page.locator(
    'text=建议依据：明确时间同槽；目标第 32/32 个；前面 31 条会先执行，已展示 3 条前序样例，另 28 条未展开；建议写入 2026-05-04 10:01；不会自动处理前序或发送消息',
  ).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', {
    name: '定位最晚：Risk 32，2026-05-04 09:30 第 32/32 个；只定位当前列表行，不写 Sheet、不改期、不发送、不跳过前序消息',
  }).waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', {
    name: '编辑队列建议目标：Risk 32，2026-05-04 09:30 第 32/32 个；只打开编辑草稿，不写 Sheet、不改期、不发送、不跳过前序消息',
  }).waitFor({
    timeout: 15000,
  });

  await page.locator('button[title="新增消息"]').click();
  await page.getByRole('tab', { name: /Bot/ }).click();
  await page.locator('input[type="date"]').fill('2026-05-04');
  await page.locator('input[type="time"]').fill('09:30');
  await page.locator('text=建议改到 2026-05-04 10:02').waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '使用建议时间' }).click();
  const draftSuggestionReceipt = page.locator('[role="status"]', {
    hasText: '建议时间已应用到草稿',
  });
  await draftSuggestionReceipt.getByText('目标: 2026-05-04 10:02').waitFor({
    timeout: 15000,
  });
  await draftSuggestionReceipt
    .getByText('原因: 同执行时间第 33/33 个，前面 32 条会先执行，可能超过 30 分钟补偿窗口')
    .waitFor({ timeout: 15000 });
  await draftSuggestionReceipt
    .getByText('写入后: 领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回')
    .waitFor({ timeout: 15000 });
  await draftSuggestionReceipt
    .getByText(
      '边界: 写入本地明确时间；这里只更新表单草稿，尚未写入 Messages、不会立即发送，也不会跳过前序消息，保存后才会写入 Sheet。',
    )
    .waitFor({ timeout: 15000 });
  assert.equal(appliedUpdate, null, 'draft suggestion should not write the Sheet before save');
  await page.getByRole('button', { name: '✕' }).click();

  await page.getByRole('button', {
    name: '显示全部 4 个时间槽',
  }).click();
  await page.locator('[aria-label*="2026-05-04 11:00"]').getByText('Safe 11:00 A', { exact: true }).first().waitFor({
    timeout: 15000,
  });
  await page.getByRole('button', {
    name: '收起队列槽位',
  }).click();

  await page.getByRole('button', {
    name: '将Risk 32改到建议时间2026-05-04 10:01',
  }).click();

  await page.waitForURL(/messageId=msg-32/, { timeout: 15000 });
  const explicitReceipt = page.locator('[role="status"]', {
    hasText: '已应用改期建议',
  }).filter({ hasText: 'Risk 32' });
  await explicitReceipt.getByText('来源: 队列建议').waitFor({ timeout: 15000 });
  assert.deepEqual(appliedUpdate, {
    id: 'msg-32',
    date: '2026-05-04',
    time: '10:01',
  });
  await explicitReceipt.getByText('写入: Messages 行 msg-32').waitFor({
    timeout: 15000,
  });
  await explicitReceipt.getByText('边界: 写入未来本地明确时间').waitFor({
    timeout: 15000,
  });
  await explicitReceipt
    .getByText('写入后: 领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回')
    .waitFor({ timeout: 15000 });
  await explicitReceipt
    .getByText('确认口径: 本回执只确认新计划已写入；尚未确认执行器已领取/发送，也未确认 Last_Exec / Logs 或 AgentTask run 已更新。')
    .waitFor({ timeout: 15000 });
  await explicitReceipt.getByText(
    '原因: 同执行时间第 32/32 个，前面 31 条会先执行，可能超过 30 分钟补偿窗口',
  ).waitFor({
    timeout: 15000,
  });

  assertNoPageErrors();
  await page.close();

  messageRows = Array.from({ length: 9 }, (_, index) => [
    `late-${index + 1}`,
    `Late ${index + 1}`,
    'content',
    '2026-05-04',
    '',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 08:00',
  ]);
  messageRows.push([
    'explicit-2355',
    'Explicit 23:55',
    'content',
    '2026-05-04',
    '23:55',
    'Bot',
    'group',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 23:55',
  ]);
  appliedUpdate = null;

  const noTimePage = await context.newPage();
  const assertNoTimePageErrors = collectPageErrors(noTimePage);
  await installFixedClock(noTimePage, new Date(2026, 4, 4, 23, 50, 30, 0).getTime());
  await installRoutes(noTimePage);
  await installAuthStub(noTimePage);

  await noTimePage.goto(`chrome-extension://${extensionId}/scheduled-messages.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await noTimePage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await noTimePage.locator('text=执行器队列可能延迟').waitFor({
    timeout: 15000,
  });
  await noTimePage.locator('text=条消息正在排队').first().waitFor({
    timeout: 15000,
  });
  await noTimePage.locator(
    'text=9 条消息正在排队，1 个时间槽有拥挤，最大同槽 9 条，最大预计延后 8 分钟；1 个需要调整，展开后可查看建议依据和改期入口',
  ).waitFor({
    timeout: 15000,
  });
  assert.equal(
    await noTimePage.locator('text=建议处理：Late 9（第 9/9 个）').count(),
    0,
    'no-time queue slot details should be collapsed by default',
  );
  await noTimePage.getByRole('button', { name: '查看执行器队列详情' }).click();
  await noTimePage.locator('text=建议处理：Late 9（第 9/9 个）').waitFor({
    timeout: 15000,
  });
  await noTimePage.getByText('前面 8 条会先执行', { exact: true }).waitFor({
    timeout: 15000,
  });
  await noTimePage
    .getByText('可能排到执行日期结束后 · 当天剩余约 8 条 · 已避开 1 个明确时间分钟', { exact: true })
    .waitFor({
    timeout: 15000,
  });
  await noTimePage.locator('text=建议改到 2026-05-05 08:00 后队列').waitFor({
    timeout: 15000,
  });
  await noTimePage.locator(
    'text=原因：08:00 后队列第 9/9 个，前面 8 条会先执行，当天剩余约 8 条',
  ).waitFor({
    timeout: 15000,
  });
  await noTimePage
    .locator('text=写入后领取口径：08:00 后队列 · 表格顺序每分钟一条 · 发送后回调写回')
    .first()
    .waitFor({
      timeout: 15000,
    });
  await noTimePage.locator(
    'text=建议依据：08:00 后队列；目标第 9/9 个；前面 8 条会先执行，已展示 3 条前序样例，另 5 条未展开；建议写入 2026-05-05 08:00 后队列，保留空时间队列语义；不会自动处理前序或发送消息',
  ).waitFor({
    timeout: 15000,
  });
  await noTimePage.getByRole('button', {
    name: '定位最晚：Late 9，2026-05-04 08:00 后队列 第 9/9 个；只定位当前列表行，不写 Sheet、不改期、不发送、不跳过前序消息',
  }).waitFor({
    timeout: 15000,
  });
  await noTimePage.getByRole('button', {
    name: '编辑队列建议目标：Late 9，2026-05-04 08:00 后队列 第 9/9 个；只打开编辑草稿，不写 Sheet、不改期、不发送、不跳过前序消息',
  }).waitFor({
    timeout: 15000,
  });

  await noTimePage.getByRole('button', {
    name: '将Late 9改到建议时间2026-05-05 08:00 后队列',
  }).click();

  await noTimePage.waitForURL(/messageId=late-9/, { timeout: 15000 });
  const noTimeReceipt = noTimePage.locator('[role="status"]', {
    hasText: '已应用改期建议',
  }).filter({ hasText: 'Late 9' });
  await noTimeReceipt.getByText('来源: 队列建议').waitFor({
    timeout: 15000,
  });
  assert.deepEqual(appliedUpdate, {
    id: 'late-9',
    date: '2026-05-05',
    time: '',
  });
  await noTimeReceipt
    .getByText('边界: 清空 Schedule_Time，保留 08:00 后队列语义')
    .waitFor({ timeout: 15000 });
  await noTimeReceipt
    .getByText('写入后: 领取口径：08:00 后队列 · 表格顺序每分钟一条 · 发送后回调写回')
    .waitFor({ timeout: 15000 });
  await noTimeReceipt
    .getByText('原因: 08:00 后队列第 9/9 个，前面 8 条会先执行，当天剩余约 8 条')
    .waitFor({ timeout: 15000 });

  assertNoTimePageErrors();
  await noTimePage.close();
  console.log('Scheduled messages queue suggestion E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
