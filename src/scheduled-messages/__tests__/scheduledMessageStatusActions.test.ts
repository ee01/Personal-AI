import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertScheduledMessageStatusCanToggle,
  getScheduledMessageStatusToggleAction,
} from '../scheduledMessageStatusActions.js';

test('scheduled message status action pauses active messages', () => {
  assert.deepEqual(getScheduledMessageStatusToggleAction('Active'), {
    canToggle: true,
    nextStatus: 'Paused',
    buttonLabel: '暂停',
    buttonIcon: '⏸️',
    title: '暂停后执行器会跳过此消息',
  });
});

test('scheduled message status action resumes paused messages', () => {
  assert.deepEqual(getScheduledMessageStatusToggleAction('Paused'), {
    canToggle: true,
    nextStatus: 'Active',
    buttonLabel: '恢复',
    buttonIcon: '▶️',
    title: '恢复后消息会按当前排程继续执行',
  });
});

test('scheduled message status action blocks pending review bypass', () => {
  const action = getScheduledMessageStatusToggleAction('PendingReview');

  assert.equal(action.canToggle, false);
  assert.match(action.title, /批准或拒绝/);
  assert.throws(
    () => assertScheduledMessageStatusCanToggle('PendingReview'),
    /批准或拒绝/,
  );
});

test('scheduled message status action blocks completed direct reactivation', () => {
  for (const status of ['Done', 'Completed'] as const) {
    const action = getScheduledMessageStatusToggleAction(status);

    assert.equal(action.canToggle, false);
    assert.match(action.title, /未来执行时间/);
    assert.throws(
      () => assertScheduledMessageStatusCanToggle(status),
      /未来执行时间/,
    );
  }
});
