import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBackendNotificationButtons,
  buildBackendNotificationContextMessage,
  buildBackendNotificationId,
  buildBackendNotificationMessage,
  getBackendNotificationMetaStorageKey,
  getBackendTargetHash,
  inferLegacyLane,
  normalizeBackendNotificationMeta,
} from '../backendNotifications.js';

test('builds stable backend notification ids and storage keys', () => {
  const notificationId = buildBackendNotificationId(
    'proposed_action:action-123',
  );

  assert.equal(notificationId, 'backend-proposed_action_action-123');
  assert.equal(
    getBackendNotificationMetaStorageKey(notificationId),
    'backend_notification_meta_backend-proposed_action_action-123',
  );
});

test('routes backend notification clicks to the right memory surface', () => {
  assert.equal(
    getBackendTargetHash('weekly_report', 'notification'),
    '/dreams',
  );
  assert.equal(getBackendTargetHash('dream_digest', 'notification'), '/dreams');
  assert.equal(
    getBackendTargetHash('project_update', 'notification'),
    '/timeline',
  );
  assert.equal(
    getBackendTargetHash('notify_user', 'notification'),
    '/decisions',
  );
  assert.equal(
    getBackendTargetHash('notify_user', 'proposed_action', 'action 123'),
    '/actions?actionId=action%20123',
  );
});

test('labels notification actions by lane', () => {
  assert.deepEqual(buildBackendNotificationButtons('todo'), [
    { title: '查看待办' },
    { title: '忽略' },
  ]);
  assert.deepEqual(buildBackendNotificationButtons('notice'), [
    { title: '查看通知' },
    { title: '忽略' },
  ]);
});

test('builds concise context labels with todo due time', () => {
  const contextMessage = buildBackendNotificationContextMessage(
    'todo',
    'high',
    1_778_408_100,
  );

  assert.match(contextMessage, /^待处理 · 高优先级 · 截止 /);
  assert.equal(
    buildBackendNotificationContextMessage('notice', 'normal', 1_778_408_100),
    '通知 · 普通',
  );
});

test('uses dream digest payload details for notification previews', () => {
  const message = buildBackendNotificationMessage({
    body: '2 dream(s) generated this period',
    type: 'dream_digest',
    payload: {
      digestBody:
        '**Rooms rollout alignment**\nFollow up on the RingCentral rollout decision.',
    },
  });

  assert.match(message, /Rooms rollout alignment/);
  assert.match(message, /2 dream\(s\) generated/);
});

test('keeps legacy pending notification lanes compatible', () => {
  assert.equal(inferLegacyLane('weekly_report'), 'notice');
  assert.equal(inferLegacyLane('dream_digest'), 'notice');
  assert.equal(inferLegacyLane('truth_conflict'), 'todo');
});

test('normalizes persisted backend notification metadata defensively', () => {
  assert.deepEqual(
    normalizeBackendNotificationMeta({
      sourceRef: 'notification:abc',
      lane: 'todo',
      type: 'deadline',
      targetHash: '/decisions',
      notificationId: 'abc',
      ignored: true,
    }),
    {
      sourceRef: 'notification:abc',
      lane: 'todo',
      type: 'deadline',
      targetHash: '/decisions',
      notificationId: 'abc',
    },
  );

  assert.equal(
    normalizeBackendNotificationMeta({
      sourceRef: 'notification:abc',
      lane: 'other',
      targetHash: '/decisions',
    }),
    null,
  );
  assert.equal(
    normalizeBackendNotificationMeta({
      sourceRef: 'notification:abc',
      lane: 'todo',
      targetHash: 'https://example.com',
    }),
    null,
  );
});
