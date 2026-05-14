import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  formatScheduleHealthIssue,
  formatScheduleHealthSummary,
  getScheduleHealthIssue,
  getScheduleHealthIssues,
} from '../scheduleHealth.js';

function makeMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    ID: 'msg-1',
    Topic: 'topic',
    Content: 'content',
    Schedule_Date: '2026-05-04',
    Schedule_Time: '09:30',
    Push_Method: 'Bot',
    Status: 'Active',
    Exec_Count: 0,
    Exec_Log: '待执行',
    ...overrides,
  };
}

test('flags explicit executor messages after the compensation window expires', () => {
  const issue = getScheduleHealthIssue(
    makeMessage(),
    new Date('2026-05-04T10:01:00'),
  );

  assert.deepEqual(issue, {
    code: 'missed_execution',
    messageId: 'msg-1',
    topic: 'topic',
    nextExecution: '2026-05-04 09:30',
    isExecutorDriven: true,
    summary: '已超过 30 分钟补偿窗口',
    action: '改成未来明确时间，或清空时间进入 08:00 后队列。',
  });
  assert.equal(
    formatScheduleHealthIssue(issue!),
    '2026-05-04 09:30 · 已超过 30 分钟补偿窗口，改成未来明确时间，或清空时间进入 08:00 后队列。',
  );
});

test('keeps explicit executor messages healthy inside the compensation window', () => {
  assert.equal(
    getScheduleHealthIssue(makeMessage(), new Date('2026-05-04T09:59:00')),
    null,
  );
});

test('flags invalid schedule times before calculating queue health', () => {
  const issue = getScheduleHealthIssue(makeMessage({
    Schedule_Time: '25:00',
  }));

  assert.deepEqual(issue, {
    code: 'invalid_time',
    messageId: 'msg-1',
    topic: 'topic',
    nextExecution: '',
    isExecutorDriven: true,
    summary: '执行时间格式异常',
    action: '编辑为 00:00-23:59 的本地时间。',
  });
});

test('does not flag same-day no-time executor messages because the queue can still run', () => {
  assert.equal(
    getScheduleHealthIssue(
      makeMessage({ Schedule_Time: '' }),
      new Date('2026-05-04T18:00:00'),
    ),
    null,
  );
});

test('does not flag blank-like schedule times as invalid', () => {
  assert.equal(
    getScheduleHealthIssue(
      makeMessage({ Schedule_Time: '\u200B' }),
      new Date('2026-05-04T18:00:00'),
    ),
    null,
  );
});

test('flags no-time executor messages after their execution date passed', () => {
  const issue = getScheduleHealthIssue(
    makeMessage({ Schedule_Time: '' }),
    new Date('2026-05-05T08:30:00'),
  );

  assert.equal(issue?.summary, '未设时间的执行日期已过');
  assert.equal(issue?.action, '改成今天或未来日期，或填写明确时间。');
});

test('uses the shorter Apps Script grace window for AsMe messages', () => {
  const issue = getScheduleHealthIssue(
    makeMessage({
      Push_Method: 'AsMe',
      Schedule_Time: '',
    }),
    new Date('2026-05-04T09:02:00'),
  );

  assert.deepEqual(issue, {
    code: 'missed_execution',
    messageId: 'msg-1',
    topic: 'topic',
    nextExecution: '2026-05-04 09:00',
    isExecutorDriven: false,
    summary: '执行时间已过',
    action: '改成未来时间后才会发送。',
  });
});

test('ignores rows that already have a terminal execution result for the date', () => {
  assert.equal(
    getScheduleHealthIssue(
      makeMessage({
        Last_Exec: '2026-05-04 09:31',
        Exec_Log: '❌ 推送失败: timeout',
      }),
      new Date('2026-05-04T10:01:00'),
    ),
    null,
  );
});

test('ignores repeating messages when the scheduler has a future occurrence', () => {
  assert.equal(
    getScheduleHealthIssue(
      makeMessage({
        Repeat_Every: 1,
        Repeat_Unit: 'Day',
      }),
      new Date('2026-05-04T10:01:00'),
    ),
    null,
  );
});

test('summarizes multiple health issues for the top banner', () => {
  const issues = getScheduleHealthIssues([
    makeMessage({ ID: 'missed' }),
    makeMessage({ ID: 'invalid', Schedule_Time: '99:00' }),
  ], new Date('2026-05-04T10:01:00'));

  assert.equal(
    formatScheduleHealthSummary(issues),
    '2 条 Active 定时消息需要处理；1 条已错过执行窗口；1 条时间格式异常',
  );
});
