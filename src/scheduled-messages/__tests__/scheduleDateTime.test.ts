import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatLocalScheduleDate,
  formatLocalScheduleDateTime,
  getLocalScheduleDayOfWeek,
  isValidLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleDate,
  parseLocalScheduleTime,
} from '../scheduleDateTime.js';

test('formatLocalScheduleDateTime keeps the user-selected local calendar date', () => {
  const selected = new Date(2026, 0, 2, 0, 30);

  assert.deepEqual(formatLocalScheduleDateTime(selected), {
    dateStr: '2026-01-02',
    timeStr: '00:30',
  });
});

test('formatLocalScheduleDateTime rejects invalid dates', () => {
  assert.throws(() => formatLocalScheduleDateTime('not-a-date'), {
    message: 'Invalid schedule date',
  });
});

test('parseLocalScheduleDate treats YYYY-MM-DD as a local calendar date', () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';

  try {
    const parsed = parseLocalScheduleDate('2026-01-02');

    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 0);
    assert.equal(parsed.getDate(), 2);
    assert.equal(formatLocalScheduleDate(parsed), '2026-01-02');
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
});

test('formatLocalScheduleDate keeps date-only strings on the same local day', () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';

  try {
    assert.equal(formatLocalScheduleDate('2026-01-02'), '2026-01-02');
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
});

test('getLocalScheduleDayOfWeek is not shifted by UTC parsing', () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';

  try {
    assert.equal(getLocalScheduleDayOfWeek('2026-01-05'), 1);
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
});

test('normalizeLocalScheduleTime accepts compact local times and pads them', () => {
  assert.equal(normalizeLocalScheduleTime('7:5'), '07:05');
  assert.equal(normalizeLocalScheduleTime('23:59'), '23:59');
  assert.deepEqual(parseLocalScheduleTime('0:03'), {
    hours: 0,
    minutes: 3,
    timeStr: '00:03',
  });
});

test('local schedule time validation rejects rollover times', () => {
  assert.equal(isValidLocalScheduleTime(''), true);
  assert.equal(isValidLocalScheduleTime('24:00'), false);
  assert.equal(isValidLocalScheduleTime('09:60'), false);
  assert.equal(isValidLocalScheduleTime('not-a-time'), false);
  assert.throws(() => parseLocalScheduleTime('25:00'), {
    message: 'Invalid schedule time',
  });
});
