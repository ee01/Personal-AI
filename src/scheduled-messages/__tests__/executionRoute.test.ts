import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatExecutionLaneReceipt,
  formatExecutionLaneSummary,
  formatExecutionRouteSummary,
  getScheduledMessageExecutionLaneReceipt,
  getScheduledMessageExecutionRoute,
} from '../executionRoute.js';

test('describes AsMe mail fallback when RingCentral sender is not configured', () => {
  const route = getScheduledMessageExecutionRoute(
    { Push_Method: 'AsMe' },
    { botConfigured: true, ringCentralSenderConfigured: false },
  );

  assert.equal(route.engine, 'AppScript · Mail fallback');
  assert.equal(route.state, 'ready');
  assert.match(route.detail, /Apps Script/);
});

test('describes AsMe RingCentral sender and flags missing executor config', () => {
  const route = getScheduledMessageExecutionRoute(
    { Push_Method: 'AsMe' },
    { botConfigured: false, ringCentralSenderConfigured: true },
  );

  assert.equal(route.engine, 'Jira Automation · RingCentral sender');
  assert.equal(route.state, 'needs_setup');
  assert.match(route.detail, /Bot executor/);
});

test('describes Bot and AI routes through the Jira executor', () => {
  const botRoute = getScheduledMessageExecutionRoute(
    { Push_Method: 'Bot' },
    { botConfigured: true },
  );
  const aiRoute = getScheduledMessageExecutionRoute(
    { Push_Method: 'AI' },
    { botConfigured: true },
  );

  assert.equal(botRoute.engine, 'Jira Automation · Bot API');
  assert.equal(aiRoute.engine, 'Jira Automation · AI/API');
  assert.equal(botRoute.state, 'ready');
  assert.equal(aiRoute.state, 'ready');
});

test('distinguishes managed and external JiraAutomation rows', () => {
  const managedRoute = getScheduledMessageExecutionRoute(
    {
      Push_Method: 'JiraAutomation',
      AI_Endpoint: 'POST https://example.com/report',
      Automation_Link: 'https://jira.example.com/rule/1',
      Schedule_Date: '2026-05-26',
    },
    { botConfigured: true },
  );
  const externalRoute = getScheduledMessageExecutionRoute(
    {
      Push_Method: 'JiraAutomation',
      AI_Endpoint: '   ',
      Automation_Link: 'https://jira.example.com/rule/2',
      Schedule_Date: '2026-05-26',
    },
    { botConfigured: true },
  );

  assert.equal(managedRoute.engine, 'Jira Automation · 托管 API');
  assert.equal(managedRoute.state, 'ready');
  assert.equal(externalRoute.engine, '外部 Jira Automation');
  assert.equal(externalRoute.state, 'external');
});

test('describes Outreach runtime readiness separately from Bot executor readiness', () => {
  const readyRoute = getScheduledMessageExecutionRoute(
    { Push_Method: 'Outreach' },
    { outreachEnabled: true, outreachConfigured: true, botConfigured: false },
  );
  const blockedRoute = getScheduledMessageExecutionRoute(
    { Push_Method: 'Outreach' },
    { outreachEnabled: true, outreachConfigured: false, botConfigured: true },
  );

  assert.equal(readyRoute.engine, 'memory-service · Outreach Runtime');
  assert.equal(readyRoute.state, 'ready');
  assert.match(readyRoute.detail, /触发前先查已有答案/);
  assert.equal(blockedRoute.state, 'needs_setup');
});

test('formats a compact execution route receipt', () => {
  const route = getScheduledMessageExecutionRoute(
    { Push_Method: 'Bot' },
    { botConfigured: true },
  );

  assert.equal(
    formatExecutionRouteSummary(route),
    'Jira Automation · Bot API：按当前分钟 / 30 分钟补偿 / 08:00 后队列领取一条 Bot 消息，发送后通过回调写入 Last_Exec / Logs。',
  );
});

test('makes API claim-on-fetch boundary explicit', () => {
  const aiRoute = getScheduledMessageExecutionRoute(
    { Push_Method: 'AI' },
    { botConfigured: true },
  );
  const managedJiraRoute = getScheduledMessageExecutionRoute(
    {
      Push_Method: 'JiraAutomation',
      AI_Endpoint: 'POST https://example.com/report',
      Schedule_Date: '2026-05-26',
    },
    { botConfigured: true },
  );

  assert.match(
    formatExecutionRouteSummary(aiRoute),
    /领取时即写入 Last_Exec \/ Logs 防重复/,
  );
  assert.match(
    formatExecutionRouteSummary(aiRoute),
    /endpoint 结果需看 Jira\/API 运行记录/,
  );
  assert.match(
    formatExecutionRouteSummary(managedJiraRoute),
    /领取即标记本次已处理/,
  );
});

test('describes explicit executor lane and writeback proof', () => {
  const botReceipt = getScheduledMessageExecutionLaneReceipt(
    { Push_Method: 'Bot', Schedule_Date: '2026-05-26', Schedule_Time: '09:30' },
    { botConfigured: true },
  );
  const aiReceipt = getScheduledMessageExecutionLaneReceipt(
    {
      Push_Method: 'JiraAutomation',
      Schedule_Date: '2026-05-26',
      Schedule_Time: '09:45',
      AI_Endpoint: 'POST https://example.com/report',
    },
    { botConfigured: true },
  );

  assert.equal(
    formatExecutionLaneSummary(botReceipt),
    '领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回',
  );
  assert.match(
    formatExecutionLaneReceipt(botReceipt),
    /错过后再查过去 2-30 分钟补偿窗口/,
  );
  assert.match(
    formatExecutionLaneReceipt(botReceipt),
    /领取本身不等于已发送/,
  );
  assert.equal(
    formatExecutionLaneSummary(aiReceipt),
    '领取口径：明确时间槽 · 当前分钟/30分钟补偿 · 领取时先写回',
  );
  assert.match(
    formatExecutionLaneReceipt(aiReceipt),
    /endpoint 成败需要回到 Jira\/API 运行记录确认/,
  );
});

test('describes no-time executor queue separately from explicit 08:00', () => {
  const receipt = getScheduledMessageExecutionLaneReceipt(
    { Push_Method: 'Bot', Schedule_Date: '2026-05-26', Schedule_Time: '' },
    { botConfigured: true },
  );

  assert.equal(
    formatExecutionLaneSummary(receipt),
    '领取口径：08:00 后队列 · 表格顺序每分钟一条 · 发送后回调写回',
  );
  assert.match(
    formatExecutionLaneReceipt(receipt),
    /这不是明确 08:00 准点消息/,
  );
});

test('describes non-executor lanes without implying Personal AI compensation', () => {
  const asMeReceipt = getScheduledMessageExecutionLaneReceipt(
    { Push_Method: 'AsMe', Schedule_Date: '2026-05-26', Schedule_Time: '' },
    { botConfigured: true, ringCentralSenderConfigured: false },
  );
  const externalJiraReceipt = getScheduledMessageExecutionLaneReceipt(
    {
      Push_Method: 'JiraAutomation',
      Schedule_Date: '2026-05-26',
      Automation_Link: 'https://jira.example.com/rule/42',
      AI_Endpoint: '',
    },
    { botConfigured: true },
  );
  const outreachReceipt = getScheduledMessageExecutionLaneReceipt(
    { Push_Method: 'Outreach', Schedule_Date: '2026-05-26' },
    { outreachEnabled: true, outreachConfigured: true },
  );

  assert.equal(
    formatExecutionLaneSummary(asMeReceipt),
    '领取口径：AppScript 09:00 默认 · 非 executor 队列',
  );
  assert.match(formatExecutionLaneReceipt(asMeReceipt), /不进入 Bot\/AI 的 08:00 后队列/);
  assert.equal(
    formatExecutionLaneSummary(externalJiraReceipt),
    '领取口径：外部规则 · Personal AI 不领取',
  );
  assert.match(formatExecutionLaneReceipt(externalJiraReceipt), /不会由 Personal AI 补偿/);
  assert.equal(
    formatExecutionLaneSummary(outreachReceipt),
    '领取口径：Outreach Runtime · 模板触发\/追问',
  );
  assert.match(formatExecutionLaneReceipt(outreachReceipt), /以 Outreach session 状态为准/);
});
