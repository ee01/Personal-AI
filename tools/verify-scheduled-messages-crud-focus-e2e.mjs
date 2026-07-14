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
const sheetId = '1ScheduledCrudFocusAaBbCc';
const fixedNowMs = new Date(2026, 4, 4, 8, 0, 0, 0).getTime();
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
  'Category',
];

let messageRows = [
  [
    'existing-1',
    'Existing Topic',
    'Existing content',
    '2026-05-04',
    '09:15',
    'AsMe',
    'group',
    '',
    '123456',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 09:15',
    'General',
  ],
  [
    'pending-review-1',
    'Review Snooze Topic',
    'Review me later',
    '2026-05-04',
    '10:00',
    'Bot',
    'private',
    'john.doe',
    '',
    'PendingReview',
    '0',
    '待审核',
    '',
    '2026-05-04 10:00',
    'Snooze',
  ],
  [
    'pending-self-1',
    'Self Snooze Topic',
    'My own reminder',
    '2026-05-04',
    '10:05',
    'Bot',
    'private',
    'Esone Qiu',
    '',
    'PendingReview',
    '0',
    '待审核',
    '',
    '2026-05-04 10:05',
    'Snooze',
  ],
  [
    'outreach-1',
    'Outreach Topic',
    'Ask Jane for status',
    '2026-05-04',
    '10:10',
    'Outreach',
    'private',
    'jane.doe',
    '',
    'Active',
    '0',
    '等待主动询问',
    '',
    '2026-05-04 10:10',
    'Outreach',
  ],
  [
    'queue-1',
    'Queue First',
    'Queued content',
    '2026-05-04',
    '09:30',
    'Bot',
    'group',
    '',
    '987654',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 09:30',
    'General',
  ],
  [
    'queue-2',
    'Queue Second',
    'Queued content',
    '2026-05-04',
    '09:30',
    'Bot',
    'group',
    '',
    '987654',
    'Active',
    '0',
    '待执行',
    '',
    '2026-05-04 09:30',
    'General',
  ],
];
const appendedRows = [];
const updatedRows = [];
const deletedRows = [];

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scheduled-crud-focus-browser-'),
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

function installFixedClock(page) {
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

function rowToObject(row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
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

  await page.route('http://localhost:3210/api/v1/outreach/templates/runtime-status**', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
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

    if (request.method() === 'POST' && url.includes('/values/Messages:append')) {
      const payload = JSON.parse(request.postData() || '{}');
      const row = payload.values?.[0];
      assert.ok(row, 'append payload should include one row');
      appendedRows.push(rowToObject(row));
      messageRows.push(row);

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          updates: {
            updatedRows: 1,
          },
        }),
      });
      return;
    }

    if (request.method() === 'PUT' && url.includes('/values/Messages!')) {
      const payload = JSON.parse(request.postData() || '{}');
      const row = payload.values?.[0];
      assert.ok(row, 'update payload should include one row');

      const updated = rowToObject(row);
      updatedRows.push(updated);
      const rowIndex = messageRows.findIndex(candidate => candidate[0] === updated.ID);
      assert.notEqual(rowIndex, -1, `updated row should exist: ${updated.ID}`);
      messageRows[rowIndex] = row;

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ updatedRows: 1 }),
      });
      return;
    }

    if (request.method() === 'POST' && url.endsWith(`${sheetId}:batchUpdate`)) {
      const payload = JSON.parse(request.postData() || '{}');
      const deleteRequest = payload.requests?.find(item => item.deleteDimension)?.deleteDimension;
      assert.ok(deleteRequest, 'batchUpdate should include deleteDimension');
      assert.equal(deleteRequest.range.sheetId, 101);
      assert.equal(deleteRequest.range.dimension, 'ROWS');

      const rowIndex = deleteRequest.range.startIndex;
      const [deleted] = messageRows.splice(rowIndex - 1, 1);
      assert.ok(deleted, `deleted row should exist at sheet row index ${rowIndex}`);
      deletedRows.push(rowToObject(deleted));

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ replies: [{}] }),
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
        created_at: '2026-05-21T06:00:00.000Z',
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
  await page.getByText('Existing Topic').waitFor({ timeout: 15000 });
  await page.getByText('执行器队列正在排队').waitFor({ timeout: 15000 });
  await page.getByText('2 条消息正在排队，1 个时间槽有拥挤，最大同槽 2 条，最大预计延后 1 分钟；暂无执行窗口风险').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '查看执行器队列详情' }).click();
  await page.locator('[role="status"]', { hasText: '队列详情展开回执' }).waitFor({ timeout: 15000 });
  await page.getByText('基于已读取 Messages 快照和本机时间 2026-05-04 08:00 计算').waitFor({ timeout: 15000 });
  await page.getByText('当前展示全部 1 个拥挤槽位').waitFor({ timeout: 15000 });
  await page.getByText('展开详情只显示本地队列诊断，不会同步 Sheet、刷新 Jira Automation、改期、发送消息、改 Logs 或跳过前序').waitFor({ timeout: 15000 });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html?category=Snooze&filterPendingReview=true&filterSelfOnly=1`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('[role="status"]', { hasText: '列表筛选回执：后台补齐中' }).waitFor({ timeout: 15000 });
  await page.getByText('当前显示 1/6 条，5 条暂时隐藏。').waitFor({ timeout: 15000 });
  await page.getByText('快照: 当前计数基于已读取的 Messages 行；Jira / Outreach / Done 回填仍在后台补齐，完成后筛选结果会自动刷新').waitFor({ timeout: 15000 });
  await page.getByText('个人提醒条件: 1 条仅发给 esone.qiu 的消息不满足当前筛选').waitFor({ timeout: 15000 });
  await page.getByText('个人提醒识别: 按 esone.qiu / Esone Qiu / 邮箱本地名 归一匹配；多人或群组消息不会被隐藏').waitFor({ timeout: 15000 });
  await page.getByText('边界: 筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet').waitFor({ timeout: 15000 });
  await page.locator('tr[data-message-id="pending-review-1"]').waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('tr[data-message-id="pending-self-1"]').count(),
    0,
    'self-only filter should hide reminders sent only to the current user',
  );

  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.locator('tr[data-message-id="existing-1"]').waitFor({ timeout: 15000 });

  await page.goto(`chrome-extension://${extensionId}/scheduled-messages.html?category=Snooze&filterPendingReview=true&filterSelfOnly=1&messageId=existing-1`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('[role="status"]', { hasText: '消息定位回执' }).waitFor({ timeout: 15000 });
  await page.getByText('正在显示目标消息 existing-1，当前状态 Active。').waitFor({ timeout: 15000 });
  await page.getByText('覆盖筛选: 待审核 / 隐藏仅发给我的消息 / 类别 Snooze').waitFor({ timeout: 15000 });
  await page.getByText('待审核条件: 目标状态是 Active，普通待审核筛选会隐藏它').waitFor({ timeout: 15000 });
  await page.getByText('类别条件: 目标类别 General，普通类别筛选会隐藏它').waitFor({ timeout: 15000 });
  await page.getByText('边界: 只是把目标行显示出来；不会批准、拒绝、暂停、删除、改期、发送或同步 Sheet').waitFor({ timeout: 15000 });
  await page.locator('tr[data-message-id="existing-1"]').waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('tr[data-message-id="pending-review-1"]').count(),
    0,
    'target message focus should keep the list scoped to the target row even when filters are active',
  );

  await page.getByRole('button', { name: '返回完整列表' }).click();
  await page.locator('tr[data-message-id="pending-review-1"]').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: /新增/ }).click();
  await page.getByRole('heading', { name: /新增定时消息/ }).waitFor({ timeout: 15000 });

  await page.getByRole('tab', { name: /AI Report/ }).click();
  const addCustomOutputButton = page.getByRole('button', { name: /添加本地自定义版块草稿/ });
  const addCustomOutputBoundary = await addCustomOutputButton.getAttribute('title');
  assert.match(addCustomOutputBoundary ?? '', /添加本地自定义版块草稿/);
  assert.match(addCustomOutputBoundary ?? '', /不会写 Messages、保存 AI_Body、发送消息、改 Logs 或创建计划/);
  await addCustomOutputButton.click();
  await page.getByRole('heading', { name: /添加自定义版块/ }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('例如：风险分析（可留空）').fill('风险复核');
  await page.getByPlaceholder('例如：分析这些 tickets 中可能存在的风险点，并给出建议').fill('列出排程风险和下一步');
  const addSectionButton = page.getByRole('button', { name: /添加本地自定义版块草稿「风险复核」/ });
  assert.match((await addSectionButton.getAttribute('title')) ?? '', /只更新当前定时消息表单里的草稿/);
  await addSectionButton.click();
  await page.locator('[role="status"]', { hasText: '自定义版块草稿已添加' }).waitFor({ timeout: 15000 });
  await page.getByText('「风险复核」只添加到当前表单草稿。').waitFor({ timeout: 15000 });
  await page.getByText('尚未写入 Messages / AI_Body；不会发送消息、改 Logs 或创建计划。').waitFor({ timeout: 15000 });

  const editCustomOutputButton = page.locator('button[title*="编辑本地自定义版块草稿"][title*="风险复核"]');
  assert.match((await editCustomOutputButton.getAttribute('aria-label')) ?? '', /不会写 Messages、保存 AI_Body、发送消息、改 Logs 或删除已保存计划/);
  await editCustomOutputButton.click();
  await page.getByRole('heading', { name: /编辑自定义版块/ }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('例如：风险分析（可留空）').fill('风险复核更新');
  const saveSectionButton = page.getByRole('button', { name: /保存修改到本地自定义版块草稿「风险复核更新」/ });
  assert.match((await saveSectionButton.getAttribute('title')) ?? '', /尚未写 Messages、保存 AI_Body、发送消息或改 Logs/);
  await saveSectionButton.click();
  await page.locator('[role="status"]', { hasText: '自定义版块草稿已更新' }).waitFor({ timeout: 15000 });
  await page.getByText('「风险复核更新」只更新当前表单草稿。').waitFor({ timeout: 15000 });

  const deleteCustomOutputButton = page.locator('button[title*="删除本地自定义版块草稿"][title*="风险复核更新"]');
  const deleteCustomOutputBoundary = await deleteCustomOutputButton.getAttribute('title');
  assert.match(deleteCustomOutputBoundary ?? '', /只从当前表单草稿移除/);
  assert.match(deleteCustomOutputBoundary ?? '', /不会删除已保存的定时消息、历史发送记录或外部系统内容/);
  await deleteCustomOutputButton.click();
  await page.locator('[role="status"]', { hasText: '自定义版块草稿已移除' }).waitFor({ timeout: 15000 });
  await page.getByText('已从当前表单草稿移除「风险复核更新」。').waitFor({ timeout: 15000 });
  assert.equal(appendedRows.length, 0, 'custom output draft changes should not append a Messages row');
  assert.equal(updatedRows.length, 0, 'custom output draft changes should not update a Messages row');
  assert.equal(deletedRows.length, 0, 'custom output draft changes should not delete a Messages row');

  await page.getByRole('tab', { name: /AsMe/ }).click();
  await page.getByPlaceholder('输入消息内容').fill('Created content');
  await page.getByPlaceholder('输入消息主题').fill('Created Topic');
  await page.locator('input[type="date"]').fill('2026-05-04');
  await page.getByRole('button', { name: /群组消息/ }).click();
  await page.locator('input[placeholder="例如：148192141318"]').last().fill('654321');

  await page.locator('form').evaluate((form) => {
    const htmlForm = form;
    htmlForm.requestSubmit();
    htmlForm.requestSubmit();
  });
  await page.locator('[role="status"]', { hasText: '定时消息创建回执' }).waitFor({ timeout: 15000 });
  await page.getByText('「Created Topic」已写入 Messages 并定位到列表。').waitFor({ timeout: 15000 });
  await page.getByText('下次执行: 2026-05-04 09:00').waitFor({ timeout: 15000 });
  await page.getByText('边界: 已保存计划但没有立即发送；定位只改变当前列表视图').waitFor({ timeout: 15000 });

  assert.equal(appendedRows.length, 1);
  const createdId = appendedRows[0].ID;
  assert.match(createdId, /^msg_/);
  assert.equal(appendedRows[0].Topic, 'Created Topic');
  assert.equal(appendedRows[0].Glip_Team_ID, '654321');

  await page.waitForURL(new RegExp(`messageId=${createdId}`), { timeout: 15000 });
  await page.locator(`tr[data-message-id="${createdId}"]`).waitFor({ timeout: 15000 });
  await page.locator('[role="status"]', { hasText: '消息定位回执' }).waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator(`tr[data-message-id="existing-1"]`).count(),
    0,
    'saved-row focus should hide unrelated rows until the user returns to the full list',
  );

  await page.getByRole('button', { name: '返回完整列表' }).click();
  await page.locator(`tr[data-message-id="existing-1"]`).waitFor({ timeout: 15000 });
  const editExistingButton = page.getByRole('button', { name: /编辑 Existing Topic/ });
  const editBoundary = await editExistingButton.getAttribute('title');
  assert.match(editBoundary ?? '', /点击只打开本地编辑草稿/);
  assert.match(editBoundary ?? '', /不会立刻写 Messages、改期、发送、删除、改 Logs 或同步 Sheet/);
  assert.match(editBoundary ?? '', /保存后才写回 Messages 行 existing-1/);
  assert.match(editBoundary ?? '', /当前: ID existing-1，状态 Active，下次执行 2026-05-04 09:15/);
  await editExistingButton.click();
  await page.getByRole('heading', { name: /编辑定时消息/ }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('输入消息主题').fill('Existing Topic Edited');

  await page.getByRole('button', { name: /保存修改/ }).click();
  await page.locator('[role="status"]', { hasText: '定时消息更新回执' }).waitFor({ timeout: 15000 });
  await page.getByText('「Existing Topic Edited」已写入 Messages 并定位到列表。').waitFor({ timeout: 15000 });
  await page.getByText('下次执行: 2026-05-04 09:15').waitFor({ timeout: 15000 });

  assert.equal(updatedRows.at(-1).ID, 'existing-1');
  assert.equal(updatedRows.at(-1).Topic, 'Existing Topic Edited');
  await page.waitForURL(/messageId=existing-1/, { timeout: 15000 });
  await page.locator(`tr[data-message-id="existing-1"]`).getByText('Existing Topic Edited').waitFor({ timeout: 15000 });

  const deleteEditedButton = page.getByRole('button', { name: /删除 Existing Topic Edited/ });
  const deleteBoundary = await deleteEditedButton.getAttribute('title');
  assert.match(deleteBoundary ?? '', /点击先显示删除确认，确认前不会写 Sheet/);
  assert.match(deleteBoundary ?? '', /确认后只删除 Messages 行 existing-1/);
  assert.match(deleteBoundary ?? '', /不会撤回已发消息或历史 Logs/);
  assert.match(deleteBoundary ?? '', /当前: ID existing-1，状态 Active，下次执行 2026-05-04 09:15/);
  const confirmPromise = page.waitForEvent('dialog', { timeout: 15000 });
  const deleteClickPromise = deleteEditedButton.click();
  const confirmDialog = await confirmPromise;
  assert.match(confirmDialog.message(), /确定要删除消息 "Existing Topic Edited"/);
  assert.match(confirmDialog.message(), /ID: existing-1/);
  assert.match(confirmDialog.message(), /状态: Active/);
  assert.match(confirmDialog.message(), /下次执行: 2026-05-04 09:15/);
  assert.match(confirmDialog.message(), /频率: 推送一次 09:15/);
  assert.match(confirmDialog.message(), /发给: 123456/);
  await confirmDialog.accept();
  await deleteClickPromise;
  await page.locator('[role="status"]', { hasText: '定时消息删除回执' }).waitFor({ timeout: 15000 });
  await page.getByText('「Existing Topic Edited」已从 Messages 表删除。').waitFor({ timeout: 15000 });
  await page.getByText('恢复: 已清除 messageId，页面返回完整列表').waitFor({ timeout: 15000 });

  assert.equal(deletedRows.length, 1);
  assert.equal(deletedRows[0].ID, 'existing-1');
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('messageId'), null, {
    timeout: 15000,
  });
  assert.equal(await page.getByText('消息定位回执').count(), 0);
  assert.equal(await page.locator(`tr[data-message-id="existing-1"]`).count(), 0);
  await page.locator(`tr[data-message-id="${createdId}"]`).waitFor({ timeout: 15000 });

  assertNoPageErrors();
  console.log('Scheduled messages CRUD focus E2E passed');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
