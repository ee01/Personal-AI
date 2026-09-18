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
    params: {
      notifyVia: 'bot',
      notifyTarget: { type: 'private', glipUserName: 'esone.qiu', targetUserId: 'esone.qiu' },
    },
  },
  {
    id: 'task-timeline-1',
    title: 'FF 当天提醒扫 bug',
    taskKind: 'push',
    lane: 'jira_sheet',
    queueStatus: 'queued',
    priority: 5,
    dependsOn: [],
    retryCount: 0,
    createdAt: Math.floor(Date.now() / 1000),
    recurrenceSpec: {
      trigger: 'timeline',
      timelineProject: 'mThor',
      timelineMilestone: 'FF',
      timelineOffset: 0,
      scheduleTime: '09:00',
    },
    params: {
      notifyVia: 'bot',
      notifyTarget: { type: 'private', glipUserName: 'esone.qiu', targetUserId: 'esone.qiu' },
    },
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
  {
    id: 'task-done-1',
    title: '已经做完的日报',
    taskKind: 'push',
    lane: 'memory_cron',
    queueStatus: 'succeeded',
    scheduledAt: Math.floor(Date.now() / 1000) - 86400,
    priority: 5,
    dependsOn: [],
    retryCount: 0,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
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
  const patchedPayloads = [];
  const controlPayloads = [];
  const deletedIds = [];
  const liveTasks = TASKS.map((task) => ({ ...task }));
  let cleanedCompleted = false;

  try {
    await context.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
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
      if (url.includes('/task-center/cleanup-completed') && method === 'POST') {
        cleanedCompleted = true;
        const removed = liveTasks.filter((task) => ['succeeded', 'cancelled'].includes(task.queueStatus));
        for (const task of removed) {
          const index = liveTasks.findIndex((item) => item.id === task.id);
          if (index >= 0) liveTasks.splice(index, 1);
        }
        return json({ deleted: removed.length, ids: removed.map((task) => task.id) });
      }
      if (url.includes('/task-center/tasks/') && url.includes('/control') && method === 'POST') {
        const id = url.match(/\/task-center\/tasks\/([^/]+)\/control/)?.[1];
        const action = JSON.parse(route.request().postData() || '{}').action;
        controlPayloads.push({ id, action });
        const task = liveTasks.find((item) => item.id === id);
        if (task && action === 'pause') task.queueStatus = 'paused';
        if (task && action === 'resume') task.queueStatus = 'queued';
        if (task && action === 'complete') task.queueStatus = 'succeeded';
        return json({ task: task || liveTasks[0] });
      }
      if (url.includes('/task-center/tasks/') && method === 'DELETE') {
        const id = url.match(/\/task-center\/tasks\/([^/?]+)/)?.[1];
        deletedIds.push(id);
        const index = liveTasks.findIndex((item) => item.id === id);
        if (index >= 0) liveTasks.splice(index, 1);
        return json({ ok: true, id });
      }
      if (url.includes('/task-center/tasks') && method === 'POST') {
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
      if (url.includes('/task-center/tasks/') && method === 'PATCH') {
        const patched = JSON.parse(route.request().postData() || '{}');
        patchedPayloads.push(patched);
        const id = url.match(/\/task-center\/tasks\/([^/?]+)/)?.[1];
        const task = liveTasks.find((item) => item.id === id) || liveTasks[0];
        Object.assign(task, patched, { id: task.id, title: patched.title || task.title });
        return json({
          task,
          lane: { lane: 'memory_cron', reason: 'memory-service 到期队列调度', honoredRequest: true },
          mirrorRequired: false,
        });
      }
      if (url.includes('/task-center/tasks')) {
        return json({ items: liveTasks, total: liveTasks.length });
      }
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
    assert.ok(bodyText.includes('需要处理'), '失败 / 等人的任务应有收件箱 chip');
    assert.ok(bodyText.includes('每个版本'), 'Timeline 任务应显示按版本重复而不是日历时间');
    console.log('✓ 两条 lane 在列表中可区分');

    // 3. Capability bar is compact, and opens a guided setup with a real way in.
    assert.ok(bodyText.includes('L0 账本'), 'L0 分层应显示在能力条');
    assert.ok(bodyText.includes('L2 云端'), 'L2 分层应显示在能力条');
    await page.click('.level-bar');
    await page.waitForSelector('.setup-step', { timeout: 5000 });
    const setupText = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(setupText.includes('在此配置 Bot'), 'L1 未启用时应在此页配置 Bot');
    assert.ok(setupText.includes('在此配置 AsMe'), 'L1 应在此页配置 AsMe');
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

    // 4b. Edit reuses the create dialog and PATCHes the same task.
    await page.click('button.chip:has-text("全部")');
    await page.click('.tc-row:has-text("每天检查")');
    await page.click('.tc-detail-actions .tc-btn.primary:has-text("编辑")');
    await page.waitForSelector('.tc-dialog', { timeout: 5000 });
    const editTitle = await page.evaluate(
      () => document.querySelector('.tc-dialog-head strong')?.textContent ?? '',
    );
    assert.equal(editTitle, '编辑任务', '应复用新建弹窗作为编辑');
    const titleValue = await page.inputValue('.tc-dialog input[type=text]');
    assert.ok(titleValue.length > 0, '编辑弹窗应回填标题');
    await page.fill('.tc-dialog input[type=text]', '每天检查无 Assignee 的新 bug（已改）');
    await page.click('.tc-dialog-foot .tc-btn.primary');
    await page.waitForFunction(() => document.body.innerText.includes('已保存'), { timeout: 8000 });
    assert.equal(patchedPayloads.length, 1, '编辑应走 PATCH 而不是再 POST 一条');
    assert.equal(patchedPayloads[0].title, '每天检查无 Assignee 的新 bug（已改）');
    console.log('✓ 编辑复用新建弹窗并 PATCH 原任务');

    // 4c. Lifecycle actions match Scheduled Messages: pause, delete, cleanup done.
    await page.click('.tc-detail-actions .tc-btn:has-text("暂停")');
    await page.waitForFunction(
      () => document.querySelector('.tc-detail-head .tc-status')?.textContent === '已暂停',
      { timeout: 8000 },
    );
    assert.equal(controlPayloads.some((item) => item.action === 'pause'), true, '暂停应走 /control');
    await page.click('.tc-detail-actions .tc-btn:has-text("恢复")');
    await page.waitForFunction(
      () => document.querySelector('.tc-detail-head .tc-status')?.textContent === '待执行',
      { timeout: 8000 },
    );
    await page.click('.tc-detail-actions .tc-btn.danger:has-text("删除")');
    await page.click('.tc-confirm .tc-btn.danger:has-text("确认删除")');
    await page.waitForFunction(
      () => document.body.innerText.includes('已删除'),
      { timeout: 8000 },
    );
    assert.equal(deletedIds.includes('task-push-1'), true, '删除应走 DELETE /task-center/tasks/:id');
    await page.click('button.tc-btn:has-text("清理已完成")');
    await page.click('.tc-confirm-page .tc-btn.danger:has-text("确认清理")');
    await page.waitForFunction(
      () => document.body.innerText.includes('已清理'),
      { timeout: 8000 },
    );
    assert.equal(cleanedCompleted, true, '清理已完成应走 /cleanup-completed');
    console.log('✓ 暂停 / 恢复 / 删除 / 清理已完成');

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
    assert.ok(dialogText.includes('执行时间'), '应有执行日期/时间，与定时消息页对齐');
    assert.ok(dialogText.includes('是否重复推送'), '应有重复开关');
    assert.ok(dialogText.includes('Timeline 触发'), '应露出 Timeline 触发入口');
    const timelineDisabled = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.tc-dialog .tc-opt'));
      const timeline = opts.find((el) => el.textContent?.includes('Timeline 触发'));
      return timeline ? timeline.hasAttribute('disabled') || timeline.classList.contains('off') : null;
    });
    assert.equal(timelineDisabled, true, '未启用 Timeline Sync 时 Timeline 触发必须置灰');
    await page.click('.tc-dialog label.ck:has-text("是否重复推送")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('每周几'),
      { timeout: 3000 },
    );
    const repeatingText = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(repeatingText.includes('每周几'), '按周循环应能选星期');
    await page.click('.tc-dialog .tc-repeat .tc-opt:has-text("月")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('每月几号'),
      { timeout: 3000 },
    );
    console.log('✓ 未启用 L2 时 ☁️ 调度器置灰；重复规则可配每周几 / 每月几号');

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
            timelineSyncRule: {
              ruleId: '2160',
              ruleName: 'timeline-sync',
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
    assert.ok(existingL2Text.includes('Timeline Sync'), 'L2 抽屉应列出 Timeline Sync');
    assert.ok(
      /Timeline Sync[\s\S]{0,40}已探测/.test(existingL2Text),
      `有 timelineSyncRule 时 Timeline Sync 应为已探测：${existingL2Text}`,
    );
    console.log('✓ 本机已有 L2 缓存时抽屉探测为已启用，不再走初始化');

    await page.click('.tc-dialog-foot .tc-btn:has-text("关闭")');
    await page.waitForSelector('.setup-step', { state: 'detached', timeout: 5000 });
    await page.click('button.tc-btn.primary:has-text("新建任务")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('触发方式'),
      { timeout: 5000 },
    );
    const timelineReady = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.tc-dialog .tc-opt'));
      const timeline = opts.find((el) => el.textContent?.includes('Timeline 触发'));
      return {
        text: document.querySelector('.tc-dialog')?.textContent ?? '',
        found: Boolean(timeline),
        disabled: timeline ? timeline.hasAttribute('disabled') : null,
        off: timeline ? timeline.classList.contains('off') : null,
      };
    });
    assert.equal(timelineReady.found, true, `新建弹窗应有 Timeline 触发：${timelineReady.text}`);
    assert.equal(timelineReady.disabled, false, `L2+Sync 后 Timeline 应可点：${timelineReady.text}`);
    await page.click('.tc-dialog .tc-opt:has-text("jira_sheet")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('不能走 Chrome'),
      { timeout: 3000 },
    );
    const pluginOnCloud = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.tc-dialog .tc-opt'));
      const plugin = opts.find((el) => el.textContent?.includes('插件通知'));
      return {
        disabled: plugin ? plugin.hasAttribute('disabled') : null,
        on: plugin ? plugin.classList.contains('on') : null,
        text: document.querySelector('.tc-dialog')?.textContent ?? '',
      };
    });
    assert.equal(pluginOnCloud.disabled, true, '选 ☁️ 后插件通知必须置灰');
    assert.equal(pluginOnCloud.on, false, '选 ☁️ 后不能继续选中插件通知');
    assert.ok(pluginOnCloud.text.includes('不能走 Chrome'), '应说明 ☁️ 不能走插件通知');
    await page.click('.tc-dialog .tc-opt:has-text("Timeline 触发")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('Milestone'),
      { timeout: 3000 },
    );
    const timelineDialog = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(timelineDialog.includes('项目'), 'Timeline 模式应选择项目');
    assert.ok(timelineDialog.includes('偏移天数'), 'Timeline 模式应能填偏移');
    assert.equal(timelineDialog.includes('是否重复推送'), false, 'Timeline 本身就是按版本重复，不再显示日历重复开关');
    await page.fill('.tc-dialog input[type=text]', 'FF 当天扫 Nova bug');
    await page.waitForSelector('.tc-dialog .tc-tags input', { timeout: 3000 });
    await page.fill('.tc-dialog .tc-tags input', 'Esone Qiu');
    await page.locator('.tc-dialog .tc-tags input').press('Enter');
    const createdBefore = createdPayloads.length;
    await page.click('.tc-dialog-foot .tc-btn.primary');
    const started = Date.now();
    while (createdPayloads.length === createdBefore && Date.now() - started < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const timelinePayload = createdPayloads.at(-1);
    assert.equal(timelinePayload?.taskKind, 'push');
    assert.equal(timelinePayload?.lane, 'jira_sheet', 'Timeline 必须走云端 lane');
    assert.equal(timelinePayload?.recurrenceSpec?.trigger, 'timeline');
    assert.equal(timelinePayload?.recurrenceSpec?.timelineProject, 'mThor');
    assert.equal(timelinePayload?.recurrenceSpec?.timelineMilestone, 'FF');
    assert.equal(timelinePayload?.recurrenceSpec?.repeatEvery, undefined);
    assert.notEqual(timelinePayload?.payload?.notifyVia, 'plugin', '☁️ 不得写出插件通知');
    assert.equal(timelinePayload?.payload?.notifyVia, 'bot', '☁️ 默认落到 Jira Bot');
    console.log('✓ Timeline 触发写入 recurrenceSpec 并强制 ☁️；插件通知在 ☁️ 上置灰');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => document.body.innerText.includes('任务中心'),
      { timeout: 15000 },
    );
    await page.click('button.tc-btn.primary:has-text("新建任务")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('触发方式'),
      { timeout: 5000 },
    );
    await page.click('.tc-dialog .tc-opt:has-text("Timeline 触发")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('Milestone'),
      { timeout: 3000 },
    );
    await page.click('.tc-dialog .tc-opt:has-text("Agent 任务")');
    await page.waitForFunction(
      () => document.querySelector('.tc-dialog')?.textContent?.includes('任务描述'),
      { timeout: 3000 },
    );
    const agentTimelineDialog = await page.evaluate(
      () => document.querySelector('.tc-dialog')?.textContent ?? '',
    );
    assert.ok(agentTimelineDialog.includes('Timeline 触发'), 'Agent 任务应保留 Timeline 触发入口');
    assert.ok(agentTimelineDialog.includes('Milestone'), '从定时推送切到 Agent 应保留 Timeline 配置');
    assert.equal(agentTimelineDialog.includes('重复执行'), false, 'Agent Timeline 不再显示日历重复开关');
    await page.fill('.tc-dialog input[type=text]', 'FF 当天扫 Nova');
    await page.fill('.tc-dialog textarea', '查无 assignee 的 Nova bug');
    await page.waitForSelector('.tc-dialog .tc-tags input', { timeout: 3000 });
    await page.fill('.tc-dialog .tc-tags input', 'Esone Qiu');
    await page.locator('.tc-dialog .tc-tags input').press('Enter');
    const agentCreatedBefore = createdPayloads.length;
    await page.click('.tc-dialog-foot .tc-btn.primary');
    const agentStarted = Date.now();
    while (createdPayloads.length === agentCreatedBefore && Date.now() - agentStarted < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const agentTimelinePayload = createdPayloads.at(-1);
    assert.equal(agentTimelinePayload?.taskKind, 'agent');
    assert.equal(agentTimelinePayload?.lane, 'jira_sheet', 'Agent Timeline 必须走云端 lane');
    assert.equal(agentTimelinePayload?.recurrenceSpec?.trigger, 'timeline');
    assert.equal(agentTimelinePayload?.recurrenceSpec?.timelineProject, 'mThor');
    assert.equal(agentTimelinePayload?.recurrenceSpec?.timelineMilestone, 'FF');
    assert.equal(agentTimelinePayload?.recurrenceSpec?.repeatEvery, undefined);
    assert.notEqual(agentTimelinePayload?.payload?.notifyVia, 'plugin', 'Agent ☁️ 不得写出插件通知');
    console.log('✓ Agent / 帮我做 Timeline 触发写入 recurrenceSpec 并强制 ☁️');

    console.log('\n全部通过：任务中心 UI 端到端可用');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('任务中心 UI 验证失败:', error);
  process.exit(1);
});
