import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSnoozeManagerOpenRequestData,
  buildSnoozeManagerPagePath,
  getSnoozeSuccessToastActions,
} from '../snoozeToastActions.js';

test('new Snooze reminders offer undo before management', () => {
  assert.deepEqual(getSnoozeSuccessToastActions(false, 'msg_123'), [
    { kind: 'undo', label: '撤销' },
    { kind: 'manage', label: '管理' },
  ]);
});

test('updated Snooze reminders keep management without destructive undo', () => {
  assert.deepEqual(getSnoozeSuccessToastActions(true, 'msg_123'), [
    { kind: 'manage', label: '管理' },
  ]);
});

test('Snooze toast actions require a concrete message id for undo', () => {
  assert.deepEqual(getSnoozeSuccessToastActions(false, '   '), [
    { kind: 'manage', label: '管理' },
  ]);
});

test('Snooze manager request targets the category and exact reminder row', () => {
  assert.deepEqual(buildSnoozeManagerOpenRequestData(' snooze/new id '), {
    category: 'Snooze',
    messageId: 'snooze/new id',
  });
  assert.deepEqual(buildSnoozeManagerOpenRequestData('  '), {
    category: 'Snooze',
  });
});

test('Snooze manager fallback path preserves the target reminder id', () => {
  assert.equal(
    buildSnoozeManagerPagePath('snooze/new id'),
    'scheduled-messages.html?category=Snooze&messageId=snooze%2Fnew+id',
  );
  assert.equal(
    buildSnoozeManagerPagePath('  '),
    'scheduled-messages.html?category=Snooze',
  );
});
