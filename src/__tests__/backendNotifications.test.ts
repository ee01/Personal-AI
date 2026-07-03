import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBackendNotificationButtons,
  buildBackendNotificationContextMessage,
  buildBackendNotificationId,
  buildBackendNotificationMessage,
  buildBackendNotificationSnoozeActionHint,
  DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS,
  getBackendNotificationClosedDeliveryStatus,
  getBackendNotificationMetaStorageKey,
  getBackendNotificationSecondaryActionDeliveryStatus,
  getBackendNotificationSnoozeSeconds,
  getBackendTargetHash,
  inferLegacyLane,
  normalizeBackendNotificationMeta,
  performBackendNotificationSecondaryAction,
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
    getBackendTargetHash('weekly_report', 'notification', 'notif-1', {
      reportPath: 'reports/weekly-2026-05-27.md',
    }),
    '/reports?file=weekly-2026-05-27.md',
  );
  assert.equal(
    getBackendTargetHash('weekly_report', 'notification', 'notif-1', {
      reportPath: '../weekly-2026-05-27.md',
    }),
    '/reports',
  );
  assert.equal(
    getBackendTargetHash('dream_digest', 'notification', 'notif-dream', {
      latestDreamPath: 'dreams/project-orbit-2026-05-20.md',
    }),
    '/dreams?file=project-orbit-2026-05-20.md',
  );
  assert.equal(
    getBackendTargetHash('dream_digest', 'notification', 'notif-dream', {
      dreamPaths: [
        'dreams/current-launch-2026-05-25.md',
        'dreams/sunday-risk-2026-05-24.md',
      ],
    }),
    '/dreams?file=current-launch-2026-05-25.md',
  );
  assert.equal(
    getBackendTargetHash('dream_digest', 'notification', 'notif-dream', {
      latestDreamPath: '../project-orbit-2026-05-20.md',
    }),
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
  assert.equal(
    getBackendTargetHash('truth_conflict', 'notification', 'notif-1', {
      confirmRequestId: 'confirm request 123',
    }),
    '/decisions?confirmRequestId=confirm%20request%20123',
  );
  assert.equal(
    getBackendTargetHash('truth_conflict', 'notification', 'notif-1', {
      confirmRequestId: '   ',
    }),
    '/decisions',
  );
});

test('labels notification actions by lane', () => {
  assert.deepEqual(buildBackendNotificationButtons('todo'), [
    { title: '查看待办' },
    { title: '忽略' },
  ]);
  assert.deepEqual(buildBackendNotificationButtons('todo', 'notification'), [
    { title: '查看待办' },
    { title: '稍后提醒' },
  ]);
  assert.deepEqual(buildBackendNotificationButtons('todo', 'proposed_action'), [
    { title: '查看待办' },
    { title: '暂不提醒' },
  ]);
  assert.deepEqual(buildBackendNotificationButtons('notice'), [
    { title: '查看通知' },
    { title: '忽略' },
  ]);
  assert.deepEqual(buildBackendNotificationButtons('notice', 'notification'), [
    { title: '查看通知' },
    { title: '不再提示' },
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
  assert.equal(
    buildBackendNotificationContextMessage('todo', 'high', undefined, {
      reason: 'retry_after_cooldown',
      lastStatus: 'delivered',
    }),
    '待处理 · 高优先级 · 再次提醒',
  );
  assert.equal(
    buildBackendNotificationContextMessage('notice', 'normal', undefined, {
      reason: 'previous_delivery_failed',
      lastStatus: 'failed',
    }),
    '通知 · 普通 · 上次发送失败',
  );
  assert.equal(
    buildBackendNotificationContextMessage('todo', 'high', undefined, {
      reason: 'already_delivered_unfinished',
      lastStatus: 'delivered',
    }),
    '待处理 · 高优先级 · 仍待处理',
  );
  assert.equal(
    buildBackendNotificationContextMessage(
      'notice',
      'high',
      undefined,
      { channel: 'chrome', reason: 'new', lastStatus: undefined },
      undefined,
      undefined,
      {
        evidenceCount: 3,
        label: '依据 3 条记忆',
      },
    ),
    '通知 · 高优先级 · 依据 3 条记忆',
  );
  assert.equal(
    buildBackendNotificationContextMessage(
      'notice',
      'high',
      undefined,
      { channel: 'chrome', reason: 'new', lastStatus: undefined },
      undefined,
      [
        {
          channel: 'chrome',
          state: 'not_attempted',
          label: '未尝试',
          hasSuccessfulDelivery: false,
        },
        {
          channel: 'doubao',
          state: 'delivered',
          label: '已送达',
          hasSuccessfulDelivery: true,
        },
        {
          channel: 'glip',
          state: 'failed',
          label: '发送失败',
          status: 'failed',
          hasSuccessfulDelivery: false,
          lastError: 'bot_not_configured',
        },
      ],
    ),
    '通知 · 高优先级 · 其他渠道 豆包已送达，Glip发送失败（bot_not_configured，未送达）',
  );
  assert.equal(
    buildBackendNotificationContextMessage(
      'notice',
      'high',
      undefined,
      { channel: 'chrome', reason: 'new', lastStatus: undefined },
      undefined,
      [
        {
          channel: 'chrome',
          state: 'not_attempted',
          label: '未尝试',
          hasSuccessfulDelivery: false,
        },
        {
          channel: 'doubao',
          state: 'clicked',
          label: '已查看，最近失败',
          status: 'failed',
          effectiveStatus: 'clicked',
          hasSuccessfulDelivery: true,
          lastError: 'provider_retry_failed',
        },
      ],
    ),
    '通知 · 高优先级 · 其他渠道 豆包已查看，最近失败（provider_retry_failed，已查看不回滚）',
  );
  assert.equal(
    buildBackendNotificationContextMessage(
      'notice',
      'high',
      undefined,
      {
        channel: 'chrome',
        reason: 'previous_delivery_failed',
        lastStatus: 'failed',
        effectiveStatus: 'delivered',
        hasSuccessfulDelivery: true,
        lastError: 'chrome_api_unavailable',
      },
    ),
    '通知 · 高优先级 · 上次发送失败（chrome_api_unavailable，曾已送达）',
  );
});

test('labels snoozed backend notification reminders', () => {
  assert.match(
    buildBackendNotificationContextMessage(
      'todo',
      'high',
      undefined,
      undefined,
      {
        snooze: {
          sourceNotificationId: 'notif-1',
          rootNotificationId: 'notif-1',
          snoozedAt: 1_778_400_000,
          scheduledAt: 1_778_403_600,
          delaySeconds: 3_600,
          count: 1,
        },
      },
    ),
    /^待处理 · 高优先级 · 稍后提醒 · 原定 \d+\/\d+ \d\d:\d\d · 延后1小时$/,
  );
  assert.match(
    buildBackendNotificationContextMessage(
      'todo',
      'high',
      undefined,
      {
        reason: 'retry_after_cooldown',
        lastStatus: 'delivered',
      },
      {
        snooze: {
          sourceNotificationId: 'notif-2',
          rootNotificationId: 'notif-1',
          snoozedAt: 1_778_410_000,
          scheduledAt: 1_778_413_600,
          delaySeconds: 3_600,
          count: 2,
        },
      },
    ),
    /^待处理 · 高优先级 · 第2次稍后提醒 · 原定 \d+\/\d+ \d\d:\d\d · 延后1小时 · 再次提醒$/,
  );
  assert.match(
    buildBackendNotificationContextMessage(
      'todo',
      'high',
      undefined,
      {
        reason: 'retry_after_cooldown',
        lastStatus: 'delivered',
      },
      undefined,
      undefined,
      undefined,
      {
        label: '第3次稍后提醒',
        detail: '来源通知 notif-3',
        boundary:
          '这是稍后提醒到点的上下文；不会确认事项、发送消息、同步外部平台、执行动作或修改原始证据。',
        sourceNotificationId: 'notif-3',
        rootNotificationId: 'notif-1',
        snoozedAt: 1_778_410_000,
        scheduledAt: 1_778_413_600,
        delaySeconds: 3_600,
        count: 3,
      },
    ),
    /^待处理 · 高优先级 · 第3次稍后提醒 · 原定 \d+\/\d+ \d\d:\d\d · 延后1小时 · 再次提醒$/,
  );
});

test('keeps todo snooze reminders before their due time', () => {
  const now = 1_778_400_000;

  assert.equal(
    getBackendNotificationSnoozeSeconds({ lane: 'notice' }, now),
    DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS,
  );
  assert.equal(
    getBackendNotificationSnoozeSeconds(
      { lane: 'todo', dueAt: now + 60 * 60 },
      now,
    ),
    45 * 60,
  );
  assert.equal(
    getBackendNotificationSnoozeSeconds(
      { lane: 'todo', dueAt: now + 10 * 60 },
      now,
    ),
    5 * 60,
  );
  assert.equal(
    getBackendNotificationSnoozeSeconds({ lane: 'todo', dueAt: now - 60 }, now),
    15 * 60,
  );
});

test('previews backend notification snooze timing before the button is clicked', () => {
  const now = 1_778_400_000;
  const dueSoon = now + 60 * 60;

  assert.match(
    buildBackendNotificationSnoozeActionHint(
      { lane: 'todo', sourceType: 'notification', dueAt: dueSoon },
      now,
    ) || '',
    /^稍后按钮：\d+\/\d+ \d\d:\d\d 再提醒（延后45分钟）；不确认、不发送、不执行，也不修改原始证据。$/,
  );
  assert.match(
    buildBackendNotificationContextMessage(
      'todo',
      'high',
      dueSoon,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'notification',
      now,
    ),
    /^待处理 · 高优先级 · 截止 \d+\/\d+ \d\d:\d\d · 稍后按钮：\d+\/\d+ \d\d:\d\d 再提醒（延后45分钟）；不确认、不发送、不执行，也不修改原始证据。$/,
  );
  assert.match(
    buildBackendNotificationSnoozeActionHint(
      { lane: 'todo', sourceType: 'notification', dueAt: now - 60 },
      now,
    ) || '',
    /延后15分钟/,
  );
  assert.equal(
    buildBackendNotificationSnoozeActionHint(
      { lane: 'todo', sourceType: 'proposed_action', dueAt: dueSoon },
      now,
    ),
    undefined,
  );
});

test('keeps temporary todo hides retryable in notification center', () => {
  assert.equal(
    getBackendNotificationSecondaryActionDeliveryStatus({
      lane: 'todo',
      sourceType: 'proposed_action',
    }),
    'delivered',
  );
  assert.equal(
    getBackendNotificationSecondaryActionDeliveryStatus({
      lane: 'todo',
      sourceType: 'notification',
    }),
    'dismissed',
  );
  assert.equal(
    getBackendNotificationSecondaryActionDeliveryStatus({
      lane: 'notice',
      sourceType: 'notification',
    }),
    'dismissed',
  );
  assert.equal(
    getBackendNotificationClosedDeliveryStatus({ lane: 'todo' }),
    'delivered',
  );
  assert.equal(
    getBackendNotificationClosedDeliveryStatus({ lane: 'notice' }),
    'dismissed',
  );
});

test('commits backend notification snooze before terminal delivery receipt', async () => {
  const calls: string[] = [];

  const result = await performBackendNotificationSecondaryAction(
    {
      sourceRef: 'notification:notif-1',
      sourceType: 'notification',
      lane: 'todo',
      targetHash: '/decisions',
    },
    'backend-notif-1',
    {
      reportDelivery: async (events) => {
        calls.push(
          `delivery:${events[0].sourceRef}:${events[0].status}:${events[0].externalRef}`,
        );
      },
      snoozeNotification: async (id, delaySeconds) => {
        calls.push(`snooze:${id}:${delaySeconds}`);
      },
      dismissNotification: async (id) => {
        calls.push(`dismiss:${id}`);
      },
    },
  );

  assert.deepEqual(calls, [
    `snooze:notif-1:${DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS}`,
    'delivery:notification:notif-1:dismissed:backend-notif-1',
  ]);
  assert.deepEqual(result, {
    action: 'snoozed',
    notificationId: 'notif-1',
    delaySeconds: DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS,
    deliveryStatus: 'dismissed',
  });
});

test('does not write terminal delivery receipt when backend snooze fails', async () => {
  const calls: string[] = [];

  await assert.rejects(
    performBackendNotificationSecondaryAction(
      {
        sourceRef: 'notification:notif-2',
        sourceType: 'notification',
        lane: 'todo',
        targetHash: '/decisions',
      },
      'backend-notif-2',
      {
        reportDelivery: async (events) => {
          calls.push(`delivery:${events[0].status}`);
        },
        snoozeNotification: async (id) => {
          calls.push(`snooze:${id}`);
          throw new Error('backend_snooze_failed');
        },
        dismissNotification: async (id) => {
          calls.push(`dismiss:${id}`);
        },
      },
    ),
    /backend_snooze_failed/,
  );

  assert.deepEqual(calls, ['snooze:notif-2']);
});

test('dismisses backend notice before writing terminal delivery receipt', async () => {
  const calls: string[] = [];

  const result = await performBackendNotificationSecondaryAction(
    {
      sourceRef: 'notification:notif-weekly',
      sourceType: 'notification',
      lane: 'notice',
      targetHash: '/reports',
    },
    'backend-weekly',
    {
      reportDelivery: async (events) => {
        calls.push(`delivery:${events[0].status}`);
      },
      snoozeNotification: async (id) => {
        calls.push(`snooze:${id}`);
      },
      dismissNotification: async (id, detail) => {
        calls.push(`dismiss:${id}:${detail}`);
      },
    },
  );

  assert.deepEqual(calls, [
    'dismiss:notif-weekly:chrome_notification_dismiss_button',
    'delivery:dismissed',
  ]);
  assert.deepEqual(result, {
    action: 'dismissed',
    notificationId: 'notif-weekly',
    deliveryStatus: 'dismissed',
  });
});

test('keeps proposed action secondary button as channel-only cooldown', async () => {
  const calls: string[] = [];

  const result = await performBackendNotificationSecondaryAction(
    {
      sourceRef: 'proposed_action:action-1',
      sourceType: 'proposed_action',
      lane: 'todo',
      targetHash: '/actions?actionId=action-1',
    },
    'backend-action-1',
    {
      reportDelivery: async (events) => {
        calls.push(`delivery:${events[0].status}`);
      },
      snoozeNotification: async (id) => {
        calls.push(`snooze:${id}`);
      },
      dismissNotification: async (id) => {
        calls.push(`dismiss:${id}`);
      },
    },
  );

  assert.deepEqual(calls, ['delivery:delivered']);
  assert.deepEqual(result, {
    action: 'channel_hidden',
    deliveryStatus: 'delivered',
  });
});

test('uses dream digest payload details for notification previews', () => {
  const message = buildBackendNotificationMessage({
    body: '2 dream(s) generated this period',
    type: 'dream_digest',
    payload: {
      dreamDigestScopeReceipt:
        '覆盖周期：2026-05-18 至 2026-05-25\n本次纳入：2 个梦境文件',
      digestBody:
        '**Rooms rollout alignment**\nFollow up on the RingCentral rollout decision.',
    },
  });

  assert.match(message, /覆盖周期/);
  assert.match(message, /本次纳入：2 个梦境文件/);
  assert.match(message, /2 dream\(s\) generated/);
});

test('uses weekly report payload details for notification previews', () => {
  const message = buildBackendNotificationMessage({
    body: 'Your weekly report is ready',
    type: 'weekly_report',
    payload: {
      reportSummary:
        'Launch weekly summary: rollout is on track and deployment notes need review.',
      reportPath: 'reports/weekly-2026-05-27.md',
    },
  });

  assert.match(message, /Launch weekly summary/);
  assert.match(message, /Your weekly report is ready/);
  assert.doesNotMatch(message, /weekly-2026-05-27\.md/);
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
      sourceType: 'notification',
      lane: 'todo',
      type: 'deadline',
      targetHash: '/decisions',
      notificationId: 'abc',
      dueAt: 1_778_408_100,
      ignored: true,
    }),
    {
      sourceRef: 'notification:abc',
      sourceType: 'notification',
      lane: 'todo',
      type: 'deadline',
      targetHash: '/decisions',
      notificationId: 'abc',
      dueAt: 1_778_408_100,
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
