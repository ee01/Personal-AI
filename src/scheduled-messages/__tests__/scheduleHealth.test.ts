import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  formatScheduleHealthIssue,
  formatScheduleHealthSummary,
  getScheduleHealthIssue,
  getScheduleHealthIssues,
  getScheduleHealthRecoverySuggestion,
  getScheduleHealthRecoverySuggestions,
} from '../scheduleHealth.js';

function makeMessage(
  overrides: Partial<ScheduledMessage> = {},
): ScheduledMessage {
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

test('keeps explicit executor messages healthy through the final compensation minute', () => {
  assert.equal(
    getScheduleHealthIssue(makeMessage(), new Date('2026-05-04T10:00:30')),
    null,
  );

  assert.equal(
    getScheduleHealthIssue(makeMessage(), new Date('2026-05-04T10:01:00'))
      ?.summary,
    '已超过 30 分钟补偿窗口',
  );
});

test('flags invalid schedule times before calculating queue health', () => {
  const issue = getScheduleHealthIssue(
    makeMessage({
      Schedule_Time: '25:00',
    }),
  );

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
  const issues = getScheduleHealthIssues(
    [
      makeMessage({ ID: 'missed' }),
      makeMessage({ ID: 'invalid', Schedule_Time: '99:00' }),
    ],
    new Date('2026-05-04T10:01:00'),
  );

  assert.equal(
    formatScheduleHealthSummary(issues),
    '2 条 Active 定时消息需要处理；1 条已错过执行窗口；1 条时间格式异常',
  );
});

test('suggests the next minute for missed explicit executor messages', () => {
  assert.deepEqual(
    getScheduleHealthRecoverySuggestion(
      makeMessage(),
      new Date('2026-05-04T10:01:30'),
    ),
    {
      dateStr: '2026-05-04',
      timeStr: '10:02',
      label: '2026-05-04 10:02',
      clearsScheduleTime: false,
      reason: '把已错过的明确时间改成下一分钟，恢复到可执行窗口内。',
    },
  );
});

test('allocates batch explicit recovery suggestions without reusing the same minute', () => {
  const suggestions = getScheduleHealthRecoverySuggestions(
    [
      makeMessage({ ID: 'missed-1', Topic: 'Missed 1' }),
      makeMessage({ ID: 'missed-2', Topic: 'Missed 2' }),
      makeMessage({ ID: 'healthy-future', Schedule_Time: '10:03' }),
      makeMessage({ ID: 'missed-3', Topic: 'Missed 3' }),
    ],
    new Date('2026-05-04T10:01:30'),
  );

  assert.equal(suggestions.get('missed-1')?.label, '2026-05-04 10:02');
  assert.equal(suggestions.get('missed-2')?.label, '2026-05-04 10:04');
  assert.equal(suggestions.get('missed-3')?.label, '2026-05-04 10:05');
  assert.equal(suggestions.has('healthy-future'), false);
});

test('suggests today executor queue for no-time executor rows whose date passed', () => {
  assert.deepEqual(
    getScheduleHealthRecoverySuggestion(
      makeMessage({ Schedule_Time: '', Schedule_Date: '2026-05-03' }),
      new Date('2026-05-04T10:01:30'),
    ),
    {
      dateStr: '2026-05-04',
      timeStr: '',
      label: '2026-05-04 08:00 后',
      clearsScheduleTime: true,
      reason:
        '改到今天的执行器默认队列，下一轮 Jira Automation 轮询会继续处理。',
    },
  );
});

test('suggests the next default queue day when today has no executor minute left', () => {
  assert.deepEqual(
    getScheduleHealthRecoverySuggestion(
      makeMessage({ Schedule_Time: '', Schedule_Date: '2026-05-03' }),
      new Date('2026-05-04T23:59:30'),
    ),
    {
      dateStr: '2026-05-05',
      timeStr: '',
      label: '2026-05-05 08:00 后',
      clearsScheduleTime: true,
      reason: '今天默认队列已没有可执行分钟，改到下一个可用执行器默认队列日。',
    },
  );
});

test('allocates stale no-time executor recoveries without overfilling the last same-day slot', () => {
  const suggestions = getScheduleHealthRecoverySuggestions(
    [
      makeMessage({
        ID: 'stale-1',
        Topic: 'Stale 1',
        Schedule_Time: '',
        Schedule_Date: '2026-05-03',
      }),
      makeMessage({
        ID: 'stale-2',
        Topic: 'Stale 2',
        Schedule_Time: '',
        Schedule_Date: '2026-05-03',
      }),
    ],
    new Date('2026-05-04T23:58:30'),
  );

  assert.equal(suggestions.get('stale-1')?.label, '2026-05-04 08:00 后');
  assert.equal(suggestions.get('stale-2')?.label, '2026-05-05 08:00 后');
  assert.equal(
    suggestions.get('stale-2')?.reason,
    '今天默认队列已没有可执行分钟，改到下一个可用执行器默认队列日。',
  );
});

test('suggests the next default AsMe date for missed no-time Apps Script rows', () => {
  assert.deepEqual(
    getScheduleHealthRecoverySuggestion(
      makeMessage({
        Push_Method: 'AsMe',
        Schedule_Time: '',
      }),
      new Date('2026-05-04T09:02:00'),
    ),
    {
      dateStr: '2026-05-05',
      timeStr: '',
      label: '2026-05-05 09:00',
      clearsScheduleTime: true,
      reason: '保留默认发送时间，并把执行日期移到下一个仍可发送的日期。',
    },
  );
});

test('suggests the next minute for invalid schedule times', () => {
  assert.deepEqual(
    getScheduleHealthRecoverySuggestion(
      makeMessage({ Schedule_Time: '99:00' }),
      new Date('2026-05-04T08:12:15'),
    ),
    {
      dateStr: '2026-05-04',
      timeStr: '08:13',
      label: '2026-05-04 08:13',
      clearsScheduleTime: false,
      reason: '把异常时间改成下一分钟的明确本地时间。',
    },
  );
});
