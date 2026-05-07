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
