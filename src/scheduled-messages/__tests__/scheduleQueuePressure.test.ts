import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  formatScheduleQueueSlotDecisionBasis,
  formatScheduleQueueSlotSummary,
  formatScheduleQueueSummary,
  formatScheduleQueueBlockReason,
  formatScheduleQueueCompactSummary,
  formatScheduleQueuePressure,
  formatScheduleQueueSuggestion,
  getScheduleQueuePressure,
  getScheduleQueueSummary,
  getScheduleQueueSuggestion,
} from '../scheduleQueuePressure.js';

const beforeSlot = new Date('2026-05-04T08:00:00');

function makeMessage(
  id: string,
  overrides: Partial<ScheduledMessage> = {},
): ScheduledMessage {
  return {
    ID: id,
    Topic: id,
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

function getPressure(
  messages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  now = beforeSlot,
) {
  return getScheduleQueuePressure(messages, targetMessage, now);
}

test('returns no pressure when an executor slot has a single message', () => {
  const message = makeMessage('msg-1');

  assert.equal(getPressure([message], message), null);
});

test('reports row-order position for messages sharing an explicit execution time', () => {
  const first = makeMessage('msg-1');
  const second = makeMessage('msg-2');
  const third = makeMessage('msg-3');

  const pressure = getPressure([first, second, third], second);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 09:30',
    slotSize: 3,
    position: 2,
    delayMinutes: 1,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 30,
    hasExplicitTime: true,
    exceedsCompensationWindow: false,
  });
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '同执行时间第 2/3 个，预计延后 1 分钟',
  );
});

test('includes managed JiraAutomation API messages in executor queue pressure', () => {
  const bot = makeMessage('msg-1');
  const jiraApi = makeMessage('msg-2', {
    Push_Method: 'JiraAutomation',
    AI_Endpoint: 'POST https://example.com/report',
  });

  const pressure = getPressure([bot, jiraApi], jiraApi);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 09:30',
    slotSize: 2,
    position: 2,
    delayMinutes: 1,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 30,
    hasExplicitTime: true,
    exceedsCompensationWindow: false,
  });
});

test('ignores JiraAutomation rows with blank AI endpoints in executor queue pressure', () => {
  const bot = makeMessage('msg-1');
  const jiraWithoutEndpoint = makeMessage('msg-2', {
    Push_Method: 'JiraAutomation',
    AI_Endpoint: '   ',
  });

  assert.equal(getPressure([bot, jiraWithoutEndpoint], jiraWithoutEndpoint), null);
});

test('flags explicit-time executor backlog that cannot fit the compensation window', () => {
  const messages = Array.from({ length: 32 }, (_, index) => makeMessage(`msg-${index + 1}`));
  const pressure = getPressure(messages, messages[31]);

  assert.equal(pressure?.position, 32);
  assert.equal(pressure?.delayMinutes, 31);
  assert.equal(pressure?.exceedsCompensationWindow, true);
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '同执行时间第 32/32 个，预计延后 31 分钟，可能超过 30 分钟补偿窗口',
  );
  assert.equal(
    formatScheduleQueueBlockReason(pressure!),
    '当前同一执行时间排在第 32/32 个，预计延后 31 分钟，无法在 30 分钟补偿窗口内执行，请改成未来时间，或清空执行时间进入 08:00 后队列。',
  );
});

test('reports no-time executor queue without compensation-window risk', () => {
  const first = makeMessage('msg-1', { Schedule_Time: '' });
  const second = makeMessage('msg-2', { Schedule_Time: '' });
  const pressure = getPressure([first], second);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 08:00',
    slotSize: 2,
    position: 2,
    delayMinutes: 1,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 0,
    hasExplicitTime: false,
    exceedsCompensationWindow: false,
  });
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '08:00 后队列第 2/2 个，预计延后 1 分钟',
  );
});

test('flags no-time executor queues that cannot finish before the execution date ends', () => {
  const messages = Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const now = new Date('2026-05-04T23:50:30');
  const pressure = getPressure(messages, messages[9], now);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 08:00',
    slotSize: 10,
    position: 10,
    delayMinutes: 9,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 0,
    hasExplicitTime: false,
    exceedsCompensationWindow: false,
    remainingSameDaySlots: 9,
    exceedsExecutionWindow: true,
  });
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '08:00 后队列第 10/10 个，预计延后 9 分钟，可能排到执行日期结束后',
  );
  assert.equal(
    formatScheduleQueueBlockReason(pressure!),
    '当前 08:00 后队列排在第 10/10 个，预计延后 9 分钟，当天剩余可执行约 9 条，可能排到执行日期结束后，请改成未来日期，或填写明确时间。',
  );

  const summary = getScheduleQueueSummary(messages, now);
  assert.equal(summary?.riskSlotCount, 1);
  assert.equal(summary?.topSlots[0].exceedsExecutionWindow, true);
  assert.equal(summary?.topSlots[0].remainingSameDaySlots, 9);
  assert.deepEqual(summary?.topSlots[0].suggestion, {
    dateStr: '2026-05-05',
    timeStr: '',
    label: '2026-05-05 08:00 后队列',
    inspectedMinutes: 1,
    reason: '08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
    clearsScheduleTime: true,
  });
  assert.equal(summary?.topSlots[0].blockingCount, 9);
  assert.deepEqual(summary?.topSlots[0].blockingTopics, ['late-1', 'late-2', 'late-3']);
  assert.equal(
    formatScheduleQueueSlotSummary(summary!.topSlots[0]),
    '2026-05-04 08:00 后队列: 10 条，最大预计延后 9 分钟，可能排到执行日期结束后，当天剩余可执行约 9 条，建议处理：late-10（第 10/10 个），前面 9 条待执行：late-1、late-2、late-3，建议改到 2026-05-05 08:00 后队列，建议原因：08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日，示例：late-1、late-2、late-3',
  );
});

test('subtracts explicit executor reservations from no-time same-day capacity', () => {
  const noTimeMessages = Array.from({ length: 9 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const explicitReservation = makeMessage('explicit-23-55', {
    Topic: 'Explicit 23:55',
    Schedule_Time: '23:55',
  });
  const now = new Date('2026-05-04T23:50:30');

  const pressure = getPressure([...noTimeMessages, explicitReservation], noTimeMessages[8], now);

  assert.equal(pressure?.remainingSameDaySlots, 8);
  assert.equal(pressure?.reservedExplicitMinutes, 1);
  assert.equal(pressure?.exceedsExecutionWindow, true);
  assert.equal(
    formatScheduleQueueBlockReason(pressure!),
    '当前 08:00 后队列排在第 9/9 个，预计延后 8 分钟，当天剩余可执行约 8 条，已避开 1 个明确时间分钟，可能排到执行日期结束后，请改成未来日期，或填写明确时间。',
  );

  const summary = getScheduleQueueSummary([...noTimeMessages, explicitReservation], now);
  assert.equal(summary?.riskSlotCount, 1);
  assert.equal(summary?.topSlots[0].remainingSameDaySlots, 8);
  assert.equal(summary?.topSlots[0].reservedExplicitMinutes, 1);
  assert.equal(
    formatScheduleQueueSlotSummary(summary!.topSlots[0]),
    '2026-05-04 08:00 后队列: 9 条，最大预计延后 8 分钟，可能排到执行日期结束后，当天剩余可执行约 8 条，已扣除 1 个明确时间分钟，建议处理：late-9（第 9/9 个），前面 8 条待执行：late-1、late-2、late-3，建议改到 2026-05-05 08:00 后队列，建议原因：08:00 后队列第 9/9 个，前面 8 条会先执行，当天剩余约 8 条，已避开 1 个明确时间分钟，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日，示例：late-1、late-2、late-3',
  );
});

test('uses the caller clock when grouping repeating executor queues', () => {
  const first = makeMessage('repeat-1', {
    Repeat_Every: 1,
    Repeat_Unit: 'Day',
  });
  const second = makeMessage('repeat-2', {
    Repeat_Every: 1,
    Repeat_Unit: 'Day',
  });
  const now = new Date('2026-05-05T10:00:00');

  const pressure = getPressure([first], second, now);

  assert.equal(pressure?.slotKey, '2026-05-06 09:30');
  assert.equal(pressure?.position, 2);

  const summary = getScheduleQueueSummary([first, second], now);
  assert.equal(summary?.topSlots[0].slotKey, '2026-05-06 09:30');
});

test('ignores no-time executor queues after their execution date has passed', () => {
  const yesterdayFirst = makeMessage('yesterday-1', {
    Schedule_Date: '2026-05-04',
    Schedule_Time: '',
  });
  const yesterdaySecond = makeMessage('yesterday-2', {
    Schedule_Date: '2026-05-04',
    Schedule_Time: '',
  });
  const todayFirst = makeMessage('today-1', {
    Schedule_Date: '2026-05-05',
    Schedule_Time: '',
  });
  const todaySecond = makeMessage('today-2', {
    Schedule_Date: '2026-05-05',
    Schedule_Time: '',
  });
  const now = new Date('2026-05-05T09:15:00');

  assert.equal(
    getPressure([yesterdayFirst], yesterdaySecond, now),
    null,
  );

  const summary = getScheduleQueueSummary(
    [yesterdayFirst, yesterdaySecond, todayFirst, todaySecond],
    now,
    4,
  );

  assert.equal(summary?.congestedSlotCount, 1);
  assert.equal(summary?.queuedMessageCount, 2);
  assert.deepEqual(
    summary?.topSlots.map(slot => slot.slotKey),
    ['2026-05-05 08:00'],
  );
});

test('keeps explicit 08:00 slots separate from the no-time 08:00 queue', () => {
  const noTimeFirst = makeMessage('no-time-1', { Schedule_Time: '' });
  const explicitBefore = makeMessage('explicit-1', { Schedule_Time: '08:00' });
  const explicitTarget = makeMessage('explicit-2', { Schedule_Time: '08:00' });

  const pressure = getPressure([noTimeFirst, explicitBefore, explicitTarget], explicitTarget);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 08:00',
    slotSize: 2,
    position: 2,
    delayMinutes: 1,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 30,
    hasExplicitTime: true,
    exceedsCompensationWindow: false,
  });
});

test('summarizes explicit 08:00 slots and no-time 08:00 queue as separate lanes', () => {
  const summary = getScheduleQueueSummary([
    makeMessage('no-time-1', { Schedule_Time: '' }),
    makeMessage('no-time-2', { Schedule_Time: '' }),
    makeMessage('explicit-1', { Schedule_Time: '08:00' }),
    makeMessage('explicit-2', { Schedule_Time: '08:00' }),
  ], beforeSlot, 4);

  assert.equal(summary?.congestedSlotCount, 2);
  assert.ok(summary?.topSlots.some(slot => (
    slot.slotKey === '2026-05-04 08:00' &&
    slot.hasExplicitTime === true &&
    slot.slotSize === 2
  )));
  assert.ok(summary?.topSlots.some(slot => (
    slot.slotKey === '2026-05-04 08:00' &&
    slot.hasExplicitTime === false &&
    slot.slotSize === 2
  )));
});

test('ignores same-day success and failure rows that Apps Script will skip', () => {
  const succeeded = makeMessage('msg-1', {
    Last_Exec: '2026-05-04 09:30',
    Exec_Log: '✅ 推送成功',
  });
  const failed = makeMessage('msg-2', {
    Last_Exec: '2026-05-04 09:31',
    Exec_Log: '❌ 推送失败: timeout',
  });
  const target = makeMessage('msg-3');
  const later = makeMessage('msg-4');

  const pressure = getPressure([succeeded, failed, target, later], target);

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 09:30',
    slotSize: 2,
    position: 1,
    delayMinutes: 0,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 30,
    hasExplicitTime: true,
    exceedsCompensationWindow: false,
  });
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '同执行时间第 1/2 个，优先执行',
  );
  assert.equal(formatScheduleQueueBlockReason(pressure!), '');
});

test('ignores inactive and non-executor messages in the same clock slot', () => {
  const target = makeMessage('msg-1');
  const paused = makeMessage('msg-2', { Status: 'Paused' });
  const asMe = makeMessage('msg-3', { Push_Method: 'AsMe' });

  assert.equal(getPressure([target, paused, asMe], target), null);
});

test('does not spend compensation-window minutes before the slot starts', () => {
  const messages = Array.from({ length: 12 }, (_, index) => makeMessage(`msg-${index + 1}`));
  const pressure = getPressure(messages, messages[11], new Date('2026-05-04T09:20:30'));

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 09:30',
    slotSize: 12,
    position: 12,
    delayMinutes: 11,
    elapsedCompensationMinutes: 0,
    remainingCompensationMinutes: 30,
    hasExplicitTime: true,
    exceedsCompensationWindow: false,
  });
});

test('blocks explicit-time queues that no longer fit remaining compensation window', () => {
  const messages = Array.from({ length: 12 }, (_, index) => makeMessage(`msg-${index + 1}`));
  const pressure = getPressure(messages, messages[11], new Date('2026-05-04T09:50:30'));

  assert.deepEqual(pressure, {
    slotKey: '2026-05-04 09:30',
    slotSize: 12,
    position: 12,
    delayMinutes: 11,
    elapsedCompensationMinutes: 20,
    remainingCompensationMinutes: 10,
    hasExplicitTime: true,
    exceedsCompensationWindow: true,
  });
  assert.equal(
    formatScheduleQueuePressure(pressure!),
    '同执行时间第 12/12 个，预计延后 11 分钟，补偿窗口剩余 10 分钟，可能超过 30 分钟补偿窗口',
  );
  assert.equal(
    formatScheduleQueueBlockReason(pressure!),
    '当前同一执行时间排在第 12/12 个，预计延后 11 分钟，补偿窗口仅剩 10 分钟，无法在 30 分钟补偿窗口内执行，请改成未来时间，或清空执行时间进入 08:00 后队列。',
  );
});

test('summarizes congested executor queue slots and sorts risk first', () => {
  const safeSlot = [
    makeMessage('safe-1', { Topic: 'Safe one', Schedule_Time: '10:30' }),
    makeMessage('safe-2', { Topic: 'Safe two', Schedule_Time: '10:30' }),
  ];
  const riskySlot = Array.from({ length: 12 }, (_, index) => makeMessage(`risk-${index + 1}`, {
    Topic: `Risk ${index + 1}`,
    Schedule_Time: '09:30',
  }));

  const summary = getScheduleQueueSummary(
    [...safeSlot, ...riskySlot],
    new Date('2026-05-04T09:50:30'),
  );

  assert.equal(summary?.congestedSlotCount, 2);
  assert.equal(summary?.queuedMessageCount, 14);
  assert.equal(summary?.riskSlotCount, 1);
  assert.equal(summary?.largestSlotSize, 12);
  assert.equal(summary?.maxDelayMinutes, 11);
  assert.equal(summary?.topSlots[0].slotKey, '2026-05-04 09:30');
  assert.equal(summary?.topSlots[0].exceedsCompensationWindow, true);
  assert.equal(summary?.topSlots[0].remainingCompensationMinutes, 10);
  assert.deepEqual(summary?.topSlots[0].sampleTopics, ['Risk 1', 'Risk 2', 'Risk 3']);
  assert.equal(summary?.topSlots[0].actionMessageId, 'risk-12');
  assert.equal(summary?.topSlots[0].actionTopic, 'Risk 12');
  assert.equal(summary?.topSlots[0].actionPosition, 12);
  assert.equal(summary?.topSlots[0].blockingCount, 11);
  assert.deepEqual(summary?.topSlots[0].blockingTopics, ['Risk 1', 'Risk 2', 'Risk 3']);
  assert.deepEqual(summary?.topSlots[0].suggestion, {
    dateStr: '2026-05-04',
    timeStr: '10:02',
    label: '2026-05-04 10:02',
    inspectedMinutes: 12,
    reason: '同执行时间第 12/12 个，前面 11 条会先执行，可能超过 30 分钟补偿窗口，补偿窗口仅剩 10 分钟，建议改到第一个未被执行器队列占用的分钟',
  });
  assert.equal(
    formatScheduleQueueSlotSummary(summary!.topSlots[0]),
    '2026-05-04 09:30: 12 条，最大预计延后 11 分钟，可能超过 30 分钟补偿窗口，建议处理：Risk 12（第 12/12 个），前面 11 条待执行：Risk 1、Risk 2、Risk 3，建议改到 2026-05-04 10:02，建议原因：同执行时间第 12/12 个，前面 11 条会先执行，可能超过 30 分钟补偿窗口，补偿窗口仅剩 10 分钟，建议改到第一个未被执行器队列占用的分钟，示例：Risk 1、Risk 2、Risk 3',
  );
  assert.equal(
    formatScheduleQueueSlotDecisionBasis(summary!.topSlots[0]),
    '建议依据：明确时间同槽；目标第 12/12 个；前面 11 条会先执行，已展示 3 条前序样例，另 8 条未展开；建议写入 2026-05-04 10:02；不会自动处理前序或发送消息',
  );
  assert.equal(
    formatScheduleQueueSummary(summary!),
    '2 个时间槽同时排队；14 条执行器消息受影响；最大同槽 12 条；最大预计延后 11 分钟；1 个时间槽存在执行窗口风险',
  );
  assert.equal(
    formatScheduleQueueCompactSummary(summary!),
    '14 条消息正在排队，2 个时间槽有拥挤，最大同槽 12 条，最大预计延后 11 分钟；1 个需要调整，展开后可查看建议依据和改期入口',
  );
});

test('reports hidden queue slots when the summary is display-limited', () => {
  const messages = [
    makeMessage('slot-1a', { Schedule_Time: '10:00' }),
    makeMessage('slot-1b', { Schedule_Time: '10:00' }),
    makeMessage('slot-2a', { Schedule_Time: '10:15' }),
    makeMessage('slot-2b', { Schedule_Time: '10:15' }),
    makeMessage('slot-3a', { Schedule_Time: '10:30' }),
    makeMessage('slot-3b', { Schedule_Time: '10:30' }),
    makeMessage('slot-4a', { Schedule_Time: '10:45' }),
    makeMessage('slot-4b', { Schedule_Time: '10:45' }),
  ];

  const compactSummary = getScheduleQueueSummary(messages, beforeSlot, 3);
  assert.equal(compactSummary?.congestedSlotCount, 4);
  assert.equal(compactSummary?.hiddenSlotCount, 1);
  assert.equal(compactSummary?.topSlots.length, 3);

  const expandedSummary = getScheduleQueueSummary(messages, beforeSlot, 10);
  assert.equal(expandedSummary?.hiddenSlotCount, 0);
  assert.equal(expandedSummary?.topSlots.length, 4);
});

test('suggests a clear explicit minute for safe but congested slots', () => {
  const first = makeMessage('safe-1', {
    Topic: 'Safe one',
    Schedule_Time: '10:30',
  });
  const second = makeMessage('safe-2', {
    Topic: 'Safe two',
    Schedule_Time: '10:30',
  });

  const summary = getScheduleQueueSummary([first, second], beforeSlot);

  assert.equal(summary?.riskSlotCount, 0);
  assert.deepEqual(summary?.topSlots[0].suggestion, {
    dateStr: '2026-05-04',
    timeStr: '10:31',
    label: '2026-05-04 10:31',
    inspectedMinutes: 2,
    reason: '同执行时间第 2/2 个，前面 1 条会先执行，建议避开同一分钟排队，建议改到第一个未被执行器队列占用的分钟',
  });
  assert.equal(summary?.topSlots[0].blockingCount, 1);
  assert.deepEqual(summary?.topSlots[0].blockingTopics, ['Safe one']);
  assert.equal(
    formatScheduleQueueSlotSummary(summary!.topSlots[0]),
    '2026-05-04 10:30: 2 条，最大预计延后 1 分钟，建议处理：Safe two（第 2/2 个），前面 1 条待执行：Safe one，建议改到 2026-05-04 10:31，建议原因：同执行时间第 2/2 个，前面 1 条会先执行，建议避开同一分钟排队，建议改到第一个未被执行器队列占用的分钟，示例：Safe one、Safe two',
  );
  assert.equal(
    formatScheduleQueueCompactSummary(summary!),
    '2 条消息正在排队，1 个时间槽有拥挤，最大同槽 2 条，最大预计延后 1 分钟；暂无执行窗口风险，展开后可查看建议时间和前序样例',
  );
  assert.equal(
    formatScheduleQueueSlotDecisionBasis(summary!.topSlots[0]),
    '建议依据：明确时间同槽；目标第 2/2 个；前面 1 条会先执行，已展示 1 条前序样例；建议写入 2026-05-04 10:31；不会自动处理前序或发送消息',
  );
});

test('does not suggest a time when the target slot is not congested', () => {
  const message = makeMessage('solo-1', {
    Schedule_Time: '10:30',
  });

  assert.equal(getScheduleQueueSuggestion([message], message, beforeSlot), null);
});

test('suggests an explicit time for no-time queues that cannot finish on the execution date', () => {
  const messages = Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const now = new Date('2026-05-04T23:50:30');

  assert.deepEqual(
    getScheduleQueueSuggestion(messages, messages[9], now),
    {
      dateStr: '2026-05-05',
      timeStr: '',
      label: '2026-05-05 08:00 后队列',
      inspectedMinutes: 1,
      reason: '08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
      clearsScheduleTime: true,
    },
  );
});

test('preserves no-time queue semantics when explicit default-time rows already exist', () => {
  const messages = Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const explicitAtFirstRemainingMinute = makeMessage('explicit-1', {
    Schedule_Date: '2026-05-05',
    Schedule_Time: '08:00',
  });
  const now = new Date('2026-05-04T23:50:30');

  assert.deepEqual(
    getScheduleQueueSuggestion([...messages, explicitAtFirstRemainingMinute], messages[9], now),
    {
      dateStr: '2026-05-05',
      timeStr: '',
      label: '2026-05-05 08:00 后队列',
      inspectedMinutes: 1,
      reason: '08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
      clearsScheduleTime: true,
    },
  );
});

test('skips a future no-time queue date that would still exceed the execution day', () => {
  const currentDayMessages = Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const saturatedNextDayMessages = Array.from({ length: 961 }, (_, index) => makeMessage(`next-${index + 1}`, {
    Schedule_Date: '2026-05-05',
    Schedule_Time: '',
  }));
  const now = new Date('2026-05-04T23:50:30');

  assert.deepEqual(
    getScheduleQueueSuggestion([...currentDayMessages, ...saturatedNextDayMessages], currentDayMessages[9], now),
    {
      dateStr: '2026-05-06',
      timeStr: '',
      label: '2026-05-06 08:00 后队列',
      inspectedMinutes: 2,
      reason: '08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
      clearsScheduleTime: true,
    },
  );
});

test('skips a future no-time queue date fully reserved by explicit executor messages', () => {
  const currentDayMessages = Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
    Schedule_Time: '',
  }));
  const explicitNextDayMessages = Array.from({ length: 960 }, (_, index) => {
    const hours = 8 + Math.floor(index / 60);
    const minutes = index % 60;
    return makeMessage(`explicit-next-${index + 1}`, {
      Schedule_Date: '2026-05-05',
      Schedule_Time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    });
  });
  const now = new Date('2026-05-04T23:50:30');

  assert.deepEqual(
    getScheduleQueueSuggestion([...currentDayMessages, ...explicitNextDayMessages], currentDayMessages[9], now),
    {
      dateStr: '2026-05-06',
      timeStr: '',
      label: '2026-05-06 08:00 后队列',
      inspectedMinutes: 2,
      reason: '08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
      clearsScheduleTime: true,
    },
  );
});

test('does not suggest candidates outside the repeating end date', () => {
  const messages = [
    makeMessage('ending-1', {
      Schedule_Date: '2026-05-04',
      Schedule_Time: '23:59',
      End_Date: '2026-05-04',
      Repeat_Every: 1,
      Repeat_Unit: 'Day',
    }),
    makeMessage('ending-2', {
      Schedule_Date: '2026-05-04',
      Schedule_Time: '23:59',
      End_Date: '2026-05-04',
      Repeat_Every: 1,
      Repeat_Unit: 'Day',
    }),
  ];

  assert.equal(
    getScheduleQueueSuggestion(messages, messages[1], new Date('2026-05-04T23:58:30'), 5),
    null,
  );
});

test('queue summary ignores completed rows and returns null without congestion', () => {
  const completed = makeMessage('done-1', {
    Last_Exec: '2026-05-04 09:30',
    Exec_Log: '✅ 推送成功',
  });
  const active = makeMessage('active-1');
  const paused = makeMessage('paused-1', { Status: 'Paused' });

  assert.equal(getScheduleQueueSummary([completed, active, paused], beforeSlot), null);
});

test('queue summary ignores expired explicit-time slots that are no longer executable', () => {
  const oldMessages = [
    makeMessage('old-1'),
    makeMessage('old-2'),
  ];

  assert.equal(
    getScheduleQueueSummary(oldMessages, new Date('2026-05-04T10:01:30')),
    null,
  );
});

test('suggests the first unreserved minute after a crowded explicit slot', () => {
  const messages = Array.from({ length: 32 }, (_, index) => makeMessage(`msg-${index + 1}`));
  const suggestion = getScheduleQueueSuggestion(messages, messages[31], beforeSlot);

  assert.deepEqual(suggestion, {
    dateStr: '2026-05-04',
    timeStr: '10:01',
    label: '2026-05-04 10:01',
    inspectedMinutes: 32,
    reason: '同执行时间第 32/32 个，前面 31 条会先执行，可能超过 30 分钟补偿窗口，建议改到第一个未被执行器队列占用的分钟',
  });
  assert.equal(
    formatScheduleQueueSuggestion(suggestion!),
    '建议改到 2026-05-04 10:01，避开当前拥挤时间槽。 原因：同执行时间第 32/32 个，前面 31 条会先执行，可能超过 30 分钟补偿窗口，建议改到第一个未被执行器队列占用的分钟',
  );
});

test('formats no-time queue suggestions as queue-preserving recovery', () => {
  const suggestion = getScheduleQueueSuggestion(
    Array.from({ length: 10 }, (_, index) => makeMessage(`late-${index + 1}`, {
      Schedule_Time: '',
    })),
    makeMessage('late-10', { Schedule_Time: '' }),
    new Date('2026-05-04T23:50:30'),
  );

  assert.equal(
    formatScheduleQueueSuggestion(suggestion!),
    '建议改到 2026-05-05 08:00 后队列，保留未填写执行时间的队列语义。 原因：08:00 后队列第 10/10 个，前面 9 条会先执行，当天剩余约 9 条，可能排到执行日期结束后，建议保留空时间移到有容量的默认队列日',
  );
});
