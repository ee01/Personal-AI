/**
 * End-to-end check for the Task Center page.
 *
 * Loads the built extension in Chromium, stubs the memory-service API, and
 * drives the real UI: list rendering, kind filtering, and the lane picker's
 * Level-2 gating (the piece most likely to regress silently, since it depends
 * on extension-side config the backend cannot see).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const TASKS = [
  {
    id: 'task-push-1',
    title: '每天检查无 Assignee 的新 bug',
    taskKind: 'push',
    lane: 'jira_sheet',
    queueStatus: 'queued',
    scheduledAt: Math.floor(Date.now() / 1000) + 3600,
    priority: 5,
    dependsOn: [],
    retryCount: 0,
    createdAt: Math.floor(Date.now() / 1000),
    mirrorRef: { sheetMessageId: 'msg_123', syncState: 'synced' },
    recurrenceSpec: { repeatEvery: 1, repeatUnit: 'Day' },
  },
  {
    id: 'task-remind-1',
    title: '回复 Kenny 的 API review 请求',
    taskKind: 'remind',
    lane: 'memory_cron',
    queueStatus: 'queued',
    scheduledAt: Math.floor(Date.now() / 1000) + 7200,
    priority: 5,
    dependsOn: [],
    retryCount: 0,
    createdAt: Math.floor(Date.now() / 1000),
  },
  {
    id: 'task-dev-1',
    title: 'worker lease 心跳续租',
    taskKind: 'dev',
    lane: 'memory_cron',
    queueStatus: 'input_required',
    priority: 7,
    dependsOn: [],
    retryCount: 0,
    createdAt: Math.floor(Date.now() / 1000),
  },
];

async function launch() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-center-ext-'));
  const extensionPath = path.join(repoRoot, 'dist');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
  return { context, extensionId: new URL(worker.url()).host, worker };
}

async function main() {
  const { context, extensionId, worker } = await launch();
  const createdPayloads = [];

  try {
    await context.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      const json = (body) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (url.includes('/task-center/capabilities')) {
        return json({
          lanes: ['memory_cron', 'jira_sheet'],
          taskKinds: ['push', 'agent', 'remind', 'dev', 'reflection', 'outreach'],
          laneSelectableKinds: ['push', 'agent'],
          cloudLaneDetection: 'client_reported',
        });
      }
      if (url.includes('/task-center/tasks') && route.request().method() === 'POST') {
        createdPayloads.push(JSON.parse(route.request().postData() || '{}'));
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            task: { ...TASKS[0], id: 'task-new', title: '新建的任务' },
            lane: { lane: 'memory_cron', reason: 'memory-service 到期队列调度', honoredRequest: true },
            mirrorRequired: false,
          }),
        });
      }
      if (url.includes('/task-center/tasks')) return json({ items: TASKS, total: TASKS.length });
      if (url.includes('/config')) {
        return json({ ringCentralJwtConfigured: false, ringCentralClientId: '' });
      }
      return json({ items: [], total: 0 });
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/task-center`, {
      waitUntil: 'load',
      timeout: 20000,
    });

    // 1. The page renders with tasks from the ledger.
    await page.waitForFunction(
      () => document.body.innerText.includes('任务中心'),
      { timeout: 15000 },
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('每天检查无 Assignee 的新 bug'),
      { timeout: 15000 },
    );
    console.log('✓ 任务中心页面渲染，列表读到账本任务');

    // 2. Lane icons distinguish the two schedulers.
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(bodyText.includes('☁️'), '云端 lane 图标应出现');
    assert.ok(bodyText.includes('🏠'), '本地 lane 图标应出现');
    console.log('✓ 两条 lane 在列表中可区分');

    // 3. Capability bar is compact, and opens a guided setup with a real way in.
    assert.ok(bodyText.includes('L0 账本'), 'L0 分层应显示在能力条');
    assert.ok(bodyText.includes('L2 云端'), 'L2 分层应显示在能力条');
    await page.click('.level-bar');
    await page.waitForSelector('.setup-step', { timeout: 5000 });
    const setupText = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(setupText.includes('去配置 Bot'), 'L1 未启用时应给出配置入口');
    assert.ok(setupText.includes('去配置 AsMe'), 'L1 应同时列出 AsMe 配置入口');
    assert.ok(setupText.includes('去一键初始化'), 'L2 未启用时应给出初始化入口');
    assert.ok(setupText.includes('解锁'), '每层应说明解锁什么');
    await page.click('.tc-dialog-foot .tc-btn');
    console.log('✓ 能力条压缩为一行，点击展开引导式初始化并给出真实配置入口');

    // 4. Kind filtering narrows the list.
    await page.click('button.chip:has-text("提醒我")');
    await page.waitForFunction(
      () => document.querySelectorAll('.tc-row').length === 1,
      { timeout: 5000 },
    );
    const filteredRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.tc-row')).map((el) => el.textContent ?? ''),
    );
    assert.equal(filteredRows.length, 1, '只应剩下提醒任务');
    assert.ok(filteredRows[0].includes('回复 Kenny'), '保留的应是提醒任务');
    console.log('✓ 类型筛选生效');

    // 5. The lane picker greys the cloud lane when Level 2 is absent — this is
    //    the layered-activation contract the whole design rests on.
    await page.click('button.chip:has-text("全部")');
    await page.click('button.tc-btn.primary:has-text("新建任务")');
    await page.waitForSelector('.tc-dialog', { timeout: 5000 });
    const cloudDisabled = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.tc-dialog .tc-opt'));
      const cloud = opts.find((el) => el.textContent?.includes('jira_sheet'));
      return cloud ? cloud.hasAttribute('disabled') || cloud.classList.contains('off') : null;
    });
    assert.equal(cloudDisabled, true, '未启用 L2 时 ☁️ 调度器必须置灰');
    const dialogText = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(dialogText.includes('Level 2'), '应说明缺什么才能用 ☁️');
    console.log('✓ 未启用 L2 时 ☁️ 调度器置灰并说明原因');

    // 6. Dev delegation requires acceptance criteria before it can be saved.
    await page.click('.tc-dialog .tc-opt:has-text("开发委派")');
    await page.fill('.tc-dialog input[type=text]', '测试开发任务');
    const blocked = await page.evaluate(() => {
      const save = Array.from(document.querySelectorAll('.tc-dialog-foot .tc-btn'))
        .find((el) => el.textContent?.includes('保存'));
      return save?.hasAttribute('disabled');
    });
    assert.equal(blocked, true, '缺验收标准时开发委派不可保存');
    console.log('✓ 开发委派强制验收标准');

    // 7. Saving goes through the unified Task Center write path.
    await page.fill('.tc-dialog textarea:below(:text("验收标准"))', '测试通过即完成');
    await page.click('.tc-dialog-foot .tc-btn.primary');
    await page.waitForFunction(() => document.body.innerText.includes('已保存'), { timeout: 8000 });
    assert.ok(createdPayloads.length > 0, '应调用 POST /task-center/tasks');
    assert.equal(createdPayloads[0].taskKind, 'dev');
    assert.equal(createdPayloads[0].lane, 'memory_cron', '开发委派固定本地 lane');
    console.log('✓ 保存走统一入口，lane 由服务端裁决');

    // 8. An already-initialized L2 cache (sheetId, not spreadsheetId) must light
    //    up the drawer instead of sending the user through one-click setup.
    await worker.evaluate(() =>
      chrome.storage.local.set({
        scheduledMessagesConfig: {
          sheetId: '1ExistingL2SheetIdXXXX',
          webAppUrl: 'https://script.google.com/macros/s/existing/exec',
          botAutomation: {
            executorRule: {
              ruleId: '2154',
              ruleName: 'executor',
              webhookUrl: 'https://script.example/exec',
              projectKey: 'MTR',
              jiraUrl: 'https://jira.example.com',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          },
        },
      }),
    );
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => document.body.innerText.includes('任务中心'),
      { timeout: 15000 },
    );
    await page.click('.level-bar');
    await page.waitForSelector('.setup-step', { timeout: 5000 });
    const existingL2Text = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(existingL2Text.includes('已从本机缓存探测'), '存量 L2 应显示探测结果');
    assert.ok(existingL2Text.includes('打开定时消息页'), '存量 L2 应打开已有配置页，而不是初始化');
    assert.equal(existingL2Text.includes('去一键初始化'), false, '存量 L2 不应再引导一键初始化');
    console.log('✓ 本机已有 L2 缓存时抽屉探测为已启用，不再走初始化');

    console.log('\n全部通过：任务中心 UI 端到端可用');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('任务中心 UI 验证失败:', error);
  process.exit(1);
});
