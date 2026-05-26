import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatExecutionRouteSummary,
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
    'Jira Automation · Bot API：每分钟领取一条 Bot 消息，发送后通过回调写入执行结果。',
  );
});
