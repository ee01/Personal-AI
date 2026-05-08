import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  formatScheduleQueueSlotSummary,
  formatScheduleQueueSummary,
  formatScheduleQueueBlockReason,
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
  assert.equal(
    formatScheduleQueueSlotSummary(summary!.topSlots[0]),
    '2026-05-04 09:30: 12 条，最大预计延后 11 分钟，可能超过 30 分钟补偿窗口，示例：Risk 1、Risk 2、Risk 3',
  );
  assert.equal(
    formatScheduleQueueSummary(summary!),
    '2 个时间槽同时排队；14 条 Bot/AI 消息受影响；最大同槽 12 条；最大预计延后 11 分钟；1 个时间槽可能超过 30 分钟补偿窗口',
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
  });
  assert.equal(
    formatScheduleQueueSuggestion(suggestion!),
    '建议改到 2026-05-04 10:01，避开当前拥挤时间槽。',
  );
});
