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
const sheetId = '1ScheduledHealthRecoveryAaBbCc';
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
let messageRows = Array.from({ length: 5 }, (_, index) => [
  `missed-${index + 1}`,
  `Missed Bot ${index + 1}`,
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
let appliedUpdate = null;
let failNextUpdate = false;

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-health-recovery-browser-'),
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
    assert.deepEqual(
      errors,
      [],
      `Scheduled messages page errors: ${errors.join('; ')}`,
    );
  };
}

function installFixedClock(
  page,
  fixedNowMs = new Date(2026, 4, 4, 10, 1, 30, 0).getTime(),
) {
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
        body: JSON.stringify({ values: [headers, ...messageRows] }),
      });
      return;
    }

    if (request.method() === 'PUT' && url.includes('/values/Messages!')) {
      if (failNextUpdate) {
        failNextUpdate = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Sheets write unavailable' } }),
        });
        return;
      }

      const payload = JSON.parse(request.postData() || '{}');
      const row = payload.values?.[0];
      assert.ok(row, 'update payload should include one row');

      const id = row[headers.indexOf('ID')];
      const date = row[headers.indexOf('Schedule_Date')];
      const time = row[headers.indexOf('Schedule_Time')];
      appliedUpdate = { id, date, time };
      const rowIndex = messageRows.findIndex(
        (candidate) => candidate[0] === id,
      );
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

  await serviceWorker.evaluate(
    async ({ targetSheetId }) => {
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
    },
    { targetSheetId: sheetId },
  );

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await installFixedClock(page);
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
  await page.locator('text=有定时消息需要改期').waitFor({
    timeout: 15000,
  });
  await page.locator('text=优先处理: Missed Bot 1 -> 2026-05-04 10:02').waitFor({
    timeout: 15000,
  });
  await page.locator('text=诊断: 补偿超窗 5 条').waitFor({
    timeout: 15000,
  });
  await page.locator('text=可一键恢复: 5/5 条').waitFor({
    timeout: 15000,
  });
  await page.locator('text=需手动检查: 0 条').waitFor({
    timeout: 15000,
  });
  await page.locator('text=边界: 只写 Schedule_Date / Schedule_Time，不会立即发送或改 Logs').waitFor({
    timeout: 15000,
  });
  await page
    .locator(
      'text=操作边界：一键改期只写回 Messages 的 Schedule_Date / Schedule_Time，不会立即发送、不会改 Logs',
    )
    .waitFor({
      timeout: 15000,
    });
  await page.locator('text=Missed Bot 1: 2026-05-04 09:30').waitFor({
    timeout: 15000,
  });
  await page
    .locator(
      'text=诊断线索: 补偿超窗 · Jira Automation 执行器队列 · 预期 2026-05-04 09:30',
    )
    .first()
    .waitFor({
      timeout: 15000,
    });
  await page.locator('text=建议改到 2026-05-04 10:02').waitFor({
    timeout: 15000,
  });
  await page
    .locator('text=写入后领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回')
    .first()
    .waitFor({
      timeout: 15000,
    });
  assert.equal(
    await page
      .getByRole('button', {
        name: '将Missed Bot 5改到2026-05-04 10:06',
      })
      .count(),
    0,
    'health banner should collapse issues after the first four by default',
  );
  await page
    .getByRole('button', {
      name: '显示全部 5 条需处理消息',
    })
    .click();
  await page
    .getByRole('button', {
      name: '将Missed Bot 5改到2026-05-04 10:06',
    })
    .waitFor({
      timeout: 15000,
    });

  await page
    .getByRole('button', {
      name: '将Missed Bot 1改到2026-05-04 10:02',
    })
    .click();

  await page.waitForURL(/messageId=missed-1/, { timeout: 15000 });
  const explicitReceipt = page.locator('[role="status"]', {
    hasText: '已应用改期建议',
  }).filter({ hasText: 'Missed Bot 1' });
  await explicitReceipt.getByText('来源: 健康告警').waitFor({
    timeout: 15000,
  });
  assert.deepEqual(appliedUpdate, {
    id: 'missed-1',
    date: '2026-05-04',
    time: '10:02',
  });
  await explicitReceipt.getByText('写入: Messages 行 missed-1').waitFor({
    timeout: 15000,
  });
  await explicitReceipt.getByText('边界: 写入未来本地明确时间').waitFor({
    timeout: 15000,
  });
  await explicitReceipt
    .getByText('写入后: 领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回')
    .waitFor({ timeout: 15000 });

  assertNoPageErrors();
  await page.close();

  messageRows = [
    [
      'live-compensation',
      'Live Compensation',
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
    ],
  ];

  const compensationPage = await context.newPage();
  const assertNoCompensationPageErrors = collectPageErrors(compensationPage);
  await installFixedClock(
    compensationPage,
    new Date(2026, 4, 4, 9, 45, 30, 0).getTime(),
  );
  await installRoutes(compensationPage);

  await compensationPage.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) =>
        callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) =>
        callback();
    }
  });

  await compensationPage.goto(
    `chrome-extension://${extensionId}/scheduled-messages.html`,
    {
      waitUntil: 'load',
      timeout: 15000,
    },
  );

  await compensationPage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await compensationPage.locator('text=Live Compensation').waitFor({
    timeout: 15000,
  });
  await compensationPage
    .locator('small[title*="领取资格，不代表已发送"]', {
      hasText: '补偿窗口回执: 已迟到 15 分钟，补偿窗口剩余 15 分钟',
    })
    .waitFor({
      timeout: 15000,
    });
  assert.equal(
    await compensationPage.locator('text=有定时消息需要改期').count(),
    0,
    'live compensation window should not be reported as a missed-health issue',
  );

  assertNoCompensationPageErrors();
  await compensationPage.close();

  messageRows = [
    [
      'missed-fail',
      'Missed Fail',
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
    ],
  ];
  appliedUpdate = null;
  failNextUpdate = true;

  const failurePage = await context.newPage();
  const failureDialogs = [];
  failurePage.on('dialog', async (dialog) => {
    failureDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  const assertNoFailurePageErrors = collectPageErrors(failurePage);
  await installFixedClock(failurePage);
  await installRoutes(failurePage);

  await failurePage.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) =>
        callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) =>
        callback();
    }
  });

  await failurePage.goto(
    `chrome-extension://${extensionId}/scheduled-messages.html`,
    {
      waitUntil: 'load',
      timeout: 15000,
    },
  );

  await failurePage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await failurePage
    .getByRole('button', {
      name: '将Missed Fail改到2026-05-04 10:02',
    })
    .click();

  const failureReceipt = failurePage.locator('[role="status"]', {
    hasText: '改期建议未应用',
  }).filter({ hasText: 'Missed Fail' });
  await failureReceipt.getByText('来源: 健康告警').waitFor({
    timeout: 15000,
  });
  await failureReceipt
    .getByText('边界: 未写入 Messages，未改动 Schedule_Date / Schedule_Time')
    .waitFor({ timeout: 15000 });
  await failureReceipt.getByText('原因: 更新行失败 (503)').waitFor({
    timeout: 15000,
  });
  assert.equal(appliedUpdate, null);
  assert.deepEqual(
    failureDialogs,
    [],
    `Health recovery failure should not fall back to alert dialogs: ${failureDialogs.join('; ')}`,
  );
  assertNoFailurePageErrors();
  await failurePage.close();

  messageRows = [
    [
      'stale-no-time-1',
      'Stale Queue 1',
      'content',
      '2026-05-03',
      '',
      'Bot',
      'group',
      'Active',
      '0',
      '待执行',
      '',
      '2026-05-03 08:00',
    ],
    [
      'stale-no-time-2',
      'Stale Queue 2',
      'content',
      '2026-05-03',
      '',
      'Bot',
      'group',
      'Active',
      '0',
      '待执行',
      '',
      '2026-05-03 08:00',
    ],
  ];
  appliedUpdate = null;

  const latePage = await context.newPage();
  const assertNoLatePageErrors = collectPageErrors(latePage);
  await installFixedClock(
    latePage,
    new Date(2026, 4, 4, 23, 58, 30, 0).getTime(),
  );
  await installRoutes(latePage);

  await latePage.addInitScript(() => {
    if (globalThis.chrome?.identity) {
      chrome.identity.getAuthToken = (_details, callback) =>
        callback('fake-token');
      chrome.identity.removeCachedAuthToken = (_details, callback) =>
        callback();
    }
  });

  await latePage.goto(
    `chrome-extension://${extensionId}/scheduled-messages.html`,
    {
      waitUntil: 'load',
      timeout: 15000,
    },
  );

  await latePage.locator('h1', { hasText: '定时消息管理' }).waitFor({
    timeout: 15000,
  });
  await latePage.locator('text=Stale Queue 1: 2026-05-03 08:00').waitFor({
    timeout: 15000,
  });
  await latePage
    .locator(
      'text=诊断线索: 默认队列日期过期 · Jira Automation 执行器队列 · 预期 2026-05-03 08:00',
    )
    .first()
    .waitFor({
      timeout: 15000,
    });
  await latePage.locator('text=建议改到 2026-05-04 08:00 后').waitFor({
    timeout: 15000,
  });
  await latePage.locator('text=建议改到 2026-05-05 08:00 后').waitFor({
    timeout: 15000,
  });
  await latePage
    .locator('text=写入后领取口径：08:00 后队列 · 表格顺序每分钟一条 · 发送后回调写回')
    .first()
    .waitFor({
      timeout: 15000,
    });

  await latePage
    .getByRole('button', {
      name: '将Stale Queue 2改到2026-05-05 08:00 后',
    })
    .click();

  await latePage.waitForURL(/messageId=stale-no-time-2/, { timeout: 15000 });
  const noTimeReceipt = latePage.locator('[role="status"]', {
    hasText: '已应用改期建议',
  }).filter({ hasText: 'Stale Queue 2' });
  await noTimeReceipt.getByText('来源: 健康告警').waitFor({
    timeout: 15000,
  });
  assert.deepEqual(appliedUpdate, {
    id: 'stale-no-time-2',
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
    .getByText('原因: 今天默认队列已没有可执行分钟，改到下一个可用执行器默认队列日。')
    .waitFor({ timeout: 15000 });

  assertNoLatePageErrors();
  await latePage.close();
  console.log('Scheduled messages health recovery E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
