import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import { formatScheduledMessageFrequency } from '../scheduleFrequencyDisplay.js';

function makeMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    ID: 'msg-1',
    Topic: 'topic',
    Content: 'content',
    Schedule_Date: '2026-05-04',
    Schedule_Time: '09:30',
    Push_Method: 'AsMe',
    Status: 'Active',
    ...overrides,
  };
}

test('formats one-time messages with normalized explicit time', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({ Schedule_Time: '7:05' })),
    '推送一次 07:05',
  );
});

test('formats day repeats as weekday-only because the scheduler skips weekends', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 1,
      Repeat_Unit: 'Day',
      Schedule_Time: '',
    })),
    '每个工作日 09:00',
  );

  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 2,
      Repeat_Unit: 'Day',
    })),
    '每 2 天（仅工作日） 09:30',
  );
});

test('keeps every-N-weeks visible when weekly repeat days are selected', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 2,
      Repeat_Unit: 'Week',
      Repeat_Days: '1,3,5',
    })),
    '每 2 周的周一、三、五 09:30',
  );
});

test('keeps every-N-weeks visible for workday and weekend shortcuts', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 2,
      Repeat_Unit: 'Week',
      Repeat_Days: '1,2,3,4,5',
    })),
    '每 2 周的工作日 09:30',
  );

  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 3,
      Repeat_Unit: 'Week',
      Repeat_Days: '0,6',
    })),
    '每 3 周的周末 09:30',
  );
});

test('derives weekly weekday from schedule date when repeat days are absent', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Repeat_Every: 2,
      Repeat_Unit: 'Week',
      Repeat_Days: '',
    })),
    '每 2 周的周一 09:30',
  );
});

test('uses default morning time when schedule time is blank-like', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Schedule_Time: '\u200B',
      Repeat_Every: 1,
      Repeat_Unit: 'Week',
    })),
    '每周一 09:00',
  );
});

test('accepts sheet-formatted schedule times with seconds', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Schedule_Time: '9:30:00 AM',
      Repeat_Every: 1,
      Repeat_Unit: 'Week',
    })),
    '每周一 09:30',
  );
});

test('shows executor default as an after-08:00 queue when time is empty', () => {
  assert.equal(
    formatScheduledMessageFrequency(makeMessage({
      Push_Method: 'Bot',
      Schedule_Time: '',
      Repeat_Every: 1,
      Repeat_Unit: 'Week',
      Repeat_Days: '1,3,5',
    })),
    '每周一、三、五 08:00 后',
  );
});
