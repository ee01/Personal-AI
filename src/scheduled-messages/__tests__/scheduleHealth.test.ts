import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  buildScheduleHealthTriageSummary,
  formatScheduleCompensationWindowReceipt,
  formatScheduleCompensationWindowReceiptDetail,
  formatScheduleHealthDiagnosticSummary,
  formatScheduleHealthIssue,
  formatScheduleHealthIssueDiagnostic,
  formatScheduleHealthSummary,
  getScheduleCompensationWindowReceipt,
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

test('builds a row receipt while explicit executor messages are inside the compensation window', () => {
  const receipt = getScheduleCompensationWindowReceipt(
    makeMessage(),
    new Date('2026-05-04T09:45:30'),
  );

  assert.deepEqual(receipt, {
    headline: '补偿窗口回执',
    summary: '已迟到 15 分钟，补偿窗口剩余 15 分钟',
    detail:
      '下一轮 Jira Automation 执行器仍会按过去 2-30 分钟补偿窗口查找这条明确时间消息；不会提前发送。',
    boundary:
      '这是领取资格，不代表已发送；最终发送或失败仍以 Last_Exec / Logs、发送回调和 Jira/API 运行记录为准。',
    elapsedMinutes: 15,
    remainingMinutes: 15,
  });
  assert.equal(
    formatScheduleCompensationWindowReceipt(receipt!),
    '补偿窗口回执: 已迟到 15 分钟，补偿窗口剩余 15 分钟',
  );
  assert.match(
    formatScheduleCompensationWindowReceiptDetail(receipt!),
    /领取资格，不代表已发送/,
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

test('does not build a compensation receipt outside the live compensation window', () => {
  assert.equal(
    getScheduleCompensationWindowReceipt(
      makeMessage(),
      new Date('2026-05-04T09:31:30'),
    ),
    null,
  );
  assert.equal(
    getScheduleCompensationWindowReceipt(
      makeMessage(),
      new Date('2026-05-04T10:01:00'),
    ),
    null,
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
  assert.equal(
    getScheduleCompensationWindowReceipt(
      makeMessage({
        Last_Exec: '2026-05-04 09:31',
        Exec_Log: '✅ 推送成功',
      }),
      new Date('2026-05-04T09:45:00'),
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

test('builds a compact triage summary for health issues', () => {
  const now = new Date('2026-05-04T10:01:30');
  const messages = [
    makeMessage({ ID: 'missed-1', Topic: 'Missed one' }),
    makeMessage({ ID: 'invalid-1', Topic: 'Invalid one', Schedule_Time: '99:00' }),
  ];
  const issues = getScheduleHealthIssues(messages, now);
  const suggestions = getScheduleHealthRecoverySuggestions(messages, now);

  assert.deepEqual(buildScheduleHealthTriageSummary(issues, suggestions), {
    priorityLabel: '优先处理: Missed one -> 2026-05-04 10:02',
    diagnosticLabel: '诊断: 补偿超窗 1 条 / 时间异常 1 条',
    recoverableLabel: '可一键恢复: 2/2 条',
    manualReviewLabel: '需手动检查: 0 条',
    boundaryLabel: '边界: 只写 Schedule_Date / Schedule_Time，不会立即发送或改 Logs',
  });
});

test('formats diagnostic route labels for health issue cards', () => {
  const missedExecutor = getScheduleHealthIssue(
    makeMessage(),
    new Date('2026-05-04T10:01:00'),
  )!;
  const invalidTime = getScheduleHealthIssue(
    makeMessage({ Schedule_Time: '99:00' }),
    new Date('2026-05-04T10:01:00'),
  )!;
  const missedDefaultQueue = getScheduleHealthIssue(
    makeMessage({ Schedule_Time: '', Schedule_Date: '2026-05-03' }),
    new Date('2026-05-04T10:01:00'),
  )!;
  const missedAsMe = getScheduleHealthIssue(
    makeMessage({ Push_Method: 'AsMe', Schedule_Time: '' }),
    new Date('2026-05-04T09:02:00'),
  )!;

  assert.equal(
    formatScheduleHealthDiagnosticSummary([
      missedExecutor,
      invalidTime,
      missedDefaultQueue,
      missedAsMe,
    ]),
    '诊断: 补偿超窗 1 条 / 时间异常 1 条 / 默认队列日期过期 1 条 / 默认发送已过 1 条',
  );
  assert.equal(
    formatScheduleHealthIssueDiagnostic(missedExecutor),
    '诊断线索: 补偿超窗 · Jira Automation 执行器队列 · 预期 2026-05-04 09:30',
  );
  assert.equal(
    formatScheduleHealthIssueDiagnostic(invalidTime),
    '诊断线索: 时间异常 · Jira Automation 执行器队列 · 预期 无有效执行时间',
  );
  assert.equal(
    formatScheduleHealthIssueDiagnostic(missedDefaultQueue),
    '诊断线索: 默认队列日期过期 · Jira Automation 执行器队列 · 预期 2026-05-03 08:00',
  );
  assert.equal(
    formatScheduleHealthIssueDiagnostic(missedAsMe),
    '诊断线索: 默认发送已过 · Apps Script / AsMe · 预期 2026-05-04 09:00',
  );
});

test('triage summary reports manual review when no recovery suggestion exists', () => {
  const issue = {
    code: 'missed_execution' as const,
    messageId: 'missing-row',
    topic: 'Missing row',
    nextExecution: '2026-05-04 09:30',
    isExecutorDriven: true,
    summary: '已超过 30 分钟补偿窗口',
    action: '同步刷新 Messages 后再处理健康告警。',
  };

  assert.deepEqual(buildScheduleHealthTriageSummary([issue], new Map()), {
    priorityLabel: '优先处理: Missing row -> 同步刷新 Messages 后再处理健康告警。',
    diagnosticLabel: '诊断: 补偿超窗 1 条',
    recoverableLabel: '可一键恢复: 0/1 条',
    manualReviewLabel: '需手动检查: 1 条',
    boundaryLabel: '边界: 只写 Schedule_Date / Schedule_Time，不会立即发送或改 Logs',
  });
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
