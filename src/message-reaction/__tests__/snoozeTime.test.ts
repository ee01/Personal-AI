import test from 'node:test';
import assert from 'node:assert/strict';

import { formatRemindTime, isValidFutureSnoozeTime } from '../snoozeTime.js';

test('snooze time validation accepts future dates', () => {
  assert.equal(isValidFutureSnoozeTime(new Date(2_000), 1_000), true);
});

test('snooze time validation rejects past, equal, and invalid dates', () => {
  assert.equal(isValidFutureSnoozeTime(new Date(999), 1_000), false);
  assert.equal(isValidFutureSnoozeTime(new Date(1_000), 1_000), false);
  assert.equal(isValidFutureSnoozeTime(new Date('invalid'), 1_000), false);
});

test('formatRemindTime uses calendar labels for tomorrow even within 24 hours', () => {
  assert.equal(
    formatRemindTime(
      new Date('2026-05-05T09:00:00+08:00'),
      new Date('2026-05-04T17:30:00+08:00'),
    ),
    '明天 09:00',
  );
});

test('formatRemindTime rounds short same-day reminders up to avoid stale labels', () => {
  assert.equal(
    formatRemindTime(
      new Date('2026-05-04T10:00:00.000+08:00'),
      new Date('2026-05-04T09:00:00.500+08:00'),
    ),
    '1 小时后 (10:00)',
  );
  assert.equal(
    formatRemindTime(
      new Date('2026-05-04T09:30:00.000+08:00'),
      new Date('2026-05-04T09:00:00.500+08:00'),
    ),
    '30 分钟后 (09:30)',
  );
  assert.equal(
    formatRemindTime(
      new Date('2026-05-04T10:45:00.000+08:00'),
      new Date('2026-05-04T09:00:00.000+08:00'),
    ),
    '1 小时 45 分钟后 (10:45)',
  );
});

test('formatRemindTime localizes English relative and calendar labels', () => {
  assert.equal(
    formatRemindTime(
      new Date('2026-05-04T09:30:00.000+08:00'),
      new Date('2026-05-04T09:00:00.500+08:00'),
      'en-US',
    ),
    'In 30 minutes (9:30 AM)',
  );
  assert.equal(
    formatRemindTime(
      new Date('2026-05-05T09:00:00+08:00'),
      new Date('2026-05-04T17:30:00+08:00'),
      'en-US',
    ),
    'Tomorrow 9:00 AM',
  );
});
