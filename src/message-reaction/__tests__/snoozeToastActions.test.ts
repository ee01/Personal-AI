import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SNOOZE_MARKER_SYNC_NOTICE,
  SNOOZE_PENDING_NO_DUPLICATE_NOTICE,
  SNOOZE_PENDING_RECOVERY_NOTICE,
  SNOOZE_UNDO_BOUNDARY_NOTICE,
  SNOOZE_UNDO_FAILURE_NOTICE,
  buildSnoozePendingToastMessage,
  buildSnoozeSuccessToastMessage,
  buildSnoozeUndoFailureToastMessage,
  buildSnoozeUndoSuccessToastMessage,
  buildSnoozeManagerOpenRequestData,
  buildSnoozeManagerPagePath,
  getSnoozeSuccessToastReceipt,
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

test('Snooze success toast explains undo and exact management target', () => {
  assert.equal(
    getSnoozeSuccessToastReceipt(false, 'msg_123'),
    '可撤销；管理会定位到这条提醒',
  );
  assert.equal(
    buildSnoozeSuccessToastMessage({
      updated: false,
      messageId: 'msg_123',
      timeLabel: '15 分钟后 (09:15)',
    }),
    `已设置提醒：15 分钟后 (09:15) · 可撤销；管理会定位到这条提醒 · ${SNOOZE_MARKER_SYNC_NOTICE}`,
  );
});

test('Snooze success toast falls back to the list when no row id is available', () => {
  assert.equal(
    getSnoozeSuccessToastReceipt(false, ''),
    '管理会打开 Snooze 列表确认',
  );
  assert.equal(
    buildSnoozeSuccessToastMessage({
      updated: false,
      timeLabel: '明天 09:00',
    }),
    `已设置提醒：明天 09:00 · 管理会打开 Snooze 列表确认 · ${SNOOZE_MARKER_SYNC_NOTICE}`,
  );
});

test('updated Snooze success toast explains that the old reminder was rescheduled', () => {
  assert.equal(
    getSnoozeSuccessToastReceipt(true, 'msg_123'),
    '同一条消息的旧提醒已改期；管理会定位到原提醒',
  );
  assert.equal(
    buildSnoozeSuccessToastMessage({
      updated: true,
      messageId: 'msg_123',
      timeLabel: 'Tomorrow 9:00 AM',
      separator: ': ',
      translate: (value) =>
        ({
          '已更新提醒': 'Reminder updated',
          '同一条消息的旧提醒已改期；管理会定位到原提醒':
            'The existing reminder for this message was rescheduled; Manage opens it',
          [SNOOZE_MARKER_SYNC_NOTICE]:
            'Original message marker refreshes with background sync; this page may briefly show the old local snapshot',
        })[value] || value,
    }),
    'Reminder updated: Tomorrow 9:00 AM · The existing reminder for this message was rescheduled; Manage opens it · Original message marker refreshes with background sync; this page may briefly show the old local snapshot',
  );
});

test('Snooze undo success toast explains the limited delete boundary', () => {
  assert.equal(
    buildSnoozeUndoSuccessToastMessage({
      timeLabel: '今天 11:00',
    }),
    `已撤销提醒：今天 11:00 · ${SNOOZE_UNDO_BOUNDARY_NOTICE} · ${SNOOZE_MARKER_SYNC_NOTICE}`,
  );
});

test('Snooze undo failure toast preserves the management recovery path', () => {
  assert.equal(
    buildSnoozeUndoFailureToastMessage({
      errorMessage: '提醒时间已被更新，请到管理稍后处理中确认或删除',
      separator: ': ',
      translate: (value) =>
        ({
          '未撤销提醒': 'Reminder not undone',
          [SNOOZE_UNDO_FAILURE_NOTICE]:
            'It may still be in the Remind queue; use Manage to confirm or delete it',
        })[value] || value,
    }),
    'Reminder not undone: 提醒时间已被更新，请到管理稍后处理中确认或删除 · It may still be in the Remind queue; use Manage to confirm or delete it',
  );
});

test('Snooze pending toast explains duplicate protection without marking failure', () => {
  assert.equal(
    buildSnoozePendingToastMessage(),
    `提醒处理中：同一条消息已有请求 · ${SNOOZE_PENDING_NO_DUPLICATE_NOTICE} · ${SNOOZE_PENDING_RECOVERY_NOTICE}`,
  );

  assert.equal(
    buildSnoozePendingToastMessage({
      separator: ': ',
      translate: (value) =>
        ({
          '提醒处理中': 'Reminder in progress',
          '同一条消息已有请求': 'same-message request already exists',
          [SNOOZE_PENDING_NO_DUPLICATE_NOTICE]:
            'A same-source Remind request is already in progress; this click did not create another reminder, reschedule it, write memory, or send a bot message',
          [SNOOZE_PENDING_RECOVERY_NOTICE]:
            'The first request will show the result; use Manage if the page stays unchanged',
        })[value] || value,
    }),
    'Reminder in progress: same-message request already exists · A same-source Remind request is already in progress; this click did not create another reminder, reschedule it, write memory, or send a bot message · The first request will show the result; use Manage if the page stays unchanged',
  );
});
