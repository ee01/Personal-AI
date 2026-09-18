import test from 'node:test';
import assert from 'node:assert/strict';

import {
  foldReflectionTasks,
  formatLocalScheduleParts,
  isInboxTask,
  isSheetMirrorPending,
  jiraSheetLedgerKey,
  ledgerTaskToSheetForm,
  parseSheetScheduleToEpochSeconds,
  pushMethodFromLedgerTask,
  sheetMessageToLedgerBody,
} from '../taskCenterSheetMirror.js';

test('jira_sheet ledger key is stable per Sheet row', () => {
  assert.equal(jiraSheetLedgerKey('msg_1'), 'jira_sheet:msg_1');
});

test('asme group push maps onto the Sheet Bot/AsMe columns Scheduled Messages already uses', () => {
  const form = ledgerTaskToSheetForm({
    id: 'task-1',
    title: '每天 9 点报表',
    description: '无 Assignee 新 bug',
    taskKind: 'push',
    scheduledAt: 1_778_086_800,
    params: {
      notifyVia: 'asme',
      notifyTarget: { type: 'group', targetGroupId: '148192141318' },
      content: '无 Assignee 新 bug',
    },
    recurrenceSpec: { repeatEvery: 1, repeatUnit: 'Day' },
  });
  assert.equal(form.Push_Method, 'AsMe');
  assert.equal(form.Target_Type, 'group');
  assert.equal(form.Glip_Team_ID, '148192141318');
  assert.equal(form.Repeat_Every, 1);
  assert.equal(form.Repeat_Unit, 'Day');
  assert.equal(form.Topic, '每天 9 点报表');
});

test('agent tasks become AgentTask Sheet rows keyed by the ledger id', () => {
  const form = ledgerTaskToSheetForm({
    id: 'task-agent',
    title: '扫未完成 CR',
    taskKind: 'agent',
    params: { mode: 'write', notifyVia: 'bot', successReceipt: false },
  });
  assert.equal(form.Push_Method, 'AgentTask');
  assert.equal(form.Agent_Task_ID, 'task-agent');
  assert.equal(form.Agent_Mode, 'write');
  assert.equal(form.Agent_Notify_Success_Receipt, 'N');
});

test('weekly recurrence copies Repeat_Days through', () => {
  const form = ledgerTaskToSheetForm({
    id: 'task-week',
    title: '周报',
    taskKind: 'push',
    recurrenceSpec: { repeatEvery: 1, repeatUnit: 'Week', repeatDays: '1,3' },
    params: { notifyVia: 'bot' },
  });
  assert.equal(form.Repeat_Days, '1,3');
});

test('Sheet AgentTask rows register back as jira_sheet agent tasks', () => {
  const body = sheetMessageToLedgerBody({
    ID: 'msg_99',
    Topic: '扫未完成 CR',
    Content: 'jql here',
    Push_Method: 'AgentTask',
    Target_Type: 'private',
    Glip_User_Name: 'esone.qiu',
    Schedule_Date: '2026-09-12',
    Schedule_Time: '09:00',
    Repeat_Every: 1,
    Repeat_Unit: 'Week',
    Status: 'Active',
    Exec_Count: 0,
    Exec_Log: '',
    Agent_Mode: 'read',
    Agent_Notify_Via: 'bot',
  });
  assert.equal(body.taskKind, 'agent');
  assert.equal(body.lane, 'jira_sheet');
  assert.equal(body.idempotencyKey, 'jira_sheet:msg_99');
  assert.equal(body.mirrorRef.sheetMessageId, 'msg_99');
  assert.equal(body.scheduledAt, parseSheetScheduleToEpochSeconds('2026-09-12', '09:00'));
});

test('pending mirror is only jira_sheet rows without a Sheet id', () => {
  assert.equal(isSheetMirrorPending({ lane: 'jira_sheet', mirrorRef: {} }), true);
  assert.equal(
    isSheetMirrorPending({
      lane: 'jira_sheet',
      mirrorRef: { sheetMessageId: 'msg_1', syncState: 'synced' },
    }),
    false,
  );
  assert.equal(isSheetMirrorPending({ lane: 'memory_cron' }), false);
});

test('local schedule parts round-trip through the Sheet date columns', () => {
  const parts = formatLocalScheduleParts(1_778_086_800);
  assert.match(parts.dateStr, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(parts.timeStr, /^\d{2}:\d{2}$/);
});

test('pushMethodFromLedgerTask prefers explicit payload over notify via', () => {
  assert.equal(
    pushMethodFromLedgerTask({
      taskKind: 'push',
      params: { pushMethod: 'ai', notifyVia: 'asme' },
    }),
    'AI',
  );
});

test('plugin notify has no Sheet channel and falls back to Bot', () => {
  assert.equal(
    pushMethodFromLedgerTask({
      taskKind: 'push',
      params: { notifyVia: 'plugin' },
    }),
    'Bot',
  );
});

test('inbox is the human-gate / failure bucket, not the quiet backlog', () => {
  assert.equal(isInboxTask({ queueStatus: 'input_required' }), true);
  assert.equal(isInboxTask({ queueStatus: 'failed' }), true);
  assert.equal(isInboxTask({ queueStatus: 'queued' }), false);
});

test('reflection candidates with the same title fold into one row with a dupe count', () => {
  const folded = foldReflectionTasks([
    { taskKind: 'reflection', title: '部署检查不稳定判定标准' },
    { taskKind: 'reflection', title: '部署检查不稳定判定标准' },
    { taskKind: 'push', title: '每天报表' },
  ]);
  assert.equal(folded.length, 2);
  assert.equal(folded[0].reflectionDupes, 2);
  assert.equal(folded[1].title, '每天报表');
});

test('timeline ledger tasks write empty Schedule_Date so GAS classifies them as Timeline', () => {
  const form = ledgerTaskToSheetForm({
    id: 'task-timeline',
    title: 'FF 当天扫 bug',
    description: 'assignee is EMPTY',
    taskKind: 'push',
    scheduledAt: 1_778_086_800,
    params: { notifyVia: 'bot', content: 'assignee is EMPTY' },
    recurrenceSpec: {
      trigger: 'timeline',
      timelineProject: 'mThor',
      timelineMilestone: 'FF',
      timelineOffset: 0,
      scheduleTime: '09:00',
    },
  });
  assert.equal(form.Schedule_Date, '');
  assert.equal(form.Schedule_Time, '09:00');
  assert.equal(form.Timeline_Project, 'mThor');
  assert.equal(form.Timeline_Milestone, 'FF');
  assert.equal(form.Timeline_Offset, 0);
  assert.equal(form.Repeat_Every, undefined);
});

test('agent timeline ledger tasks write AgentTask + empty Schedule_Date', () => {
  const form = ledgerTaskToSheetForm({
    id: 'task-agent-timeline',
    title: 'FF 当天扫 Nova',
    description: '查无 assignee',
    taskKind: 'agent',
    params: { mode: 'read', notifyVia: 'bot', content: '查无 assignee' },
    recurrenceSpec: {
      trigger: 'timeline',
      timelineProject: 'Nova',
      timelineMilestone: 'FF',
      timelineOffset: 0,
      scheduleTime: '09:00',
    },
  });
  assert.equal(form.Push_Method, 'AgentTask');
  assert.equal(form.Agent_Task_ID, 'task-agent-timeline');
  assert.equal(form.Schedule_Date, '');
  assert.equal(form.Schedule_Time, '09:00');
  assert.equal(form.Timeline_Project, 'Nova');
  assert.equal(form.Timeline_Milestone, 'FF');
  assert.equal(form.Timeline_Offset, 0);
  assert.equal(form.Repeat_Every, undefined);
});

test('Sheet Timeline rows register back without calendar Repeat_Every', () => {
  const body = sheetMessageToLedgerBody({
    ID: 'msg_timeline',
    Topic: 'FF 当天扫 bug',
    Content: 'assignee is EMPTY',
    Push_Method: 'Bot',
    Target_Type: 'private',
    Glip_User_Name: 'esone.qiu',
    Schedule_Time: '09:00',
    Timeline_Project: 'mThor',
    Timeline_Milestone: 'FF',
    Timeline_Offset: -1,
    Status: 'Active',
    Exec_Count: 0,
    Exec_Log: '',
  });
  assert.equal(body.taskKind, 'push');
  assert.equal(body.lane, 'jira_sheet');
  assert.equal(body.scheduledAt, undefined);
  assert.deepEqual(body.recurrenceSpec, {
    trigger: 'timeline',
    timelineProject: 'mThor',
    timelineMilestone: 'FF',
    timelineOffset: -1,
    scheduleTime: '09:00',
  });
});

test('Sheet AgentTask Timeline rows register back as agent tasks', () => {
  const body = sheetMessageToLedgerBody({
    ID: 'msg_agent_timeline',
    Topic: 'FF 当天扫 Nova',
    Content: '查无 assignee',
    Push_Method: 'AgentTask',
    Target_Type: 'private',
    Glip_User_Name: 'esone.qiu',
    Schedule_Time: '09:00',
    Timeline_Project: 'Nova',
    Timeline_Milestone: 'FF',
    Timeline_Offset: 0,
    Status: 'Active',
    Exec_Count: 0,
    Exec_Log: '',
  });
  assert.equal(body.taskKind, 'agent');
  assert.equal(body.lane, 'jira_sheet');
  assert.equal(body.scheduledAt, undefined);
  assert.deepEqual(body.recurrenceSpec, {
    trigger: 'timeline',
    timelineProject: 'Nova',
    timelineMilestone: 'FF',
    timelineOffset: 0,
    scheduleTime: '09:00',
  });
});
