import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import {
  NotificationCenterService,
  TODO_DELIVERY_RETRY_COOLDOWN_SECONDS,
} from '../core/NotificationCenterService.js';
import { cleanupTestDb, getTestDb } from './setup.js';

describe('NotificationCenterService', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    cleanupTestDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM channel_delivery_records').run();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses injected runtime bot config for Glip notices', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ id: 'runtime-bot-post-1' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new NotificationCenterService(db, () => ({
      botApiBaseUrl: 'https://bot.example/v2',
      botToken: 'runtime-token',
      botId: 'runtime-bot-id',
      botType: 'user',
      botTeamId: '',
      botTargetEmail: '',
    }));

    const result = await service.deliverNoticeToGlip({
      sourceRef: 'outreach:test:result',
      title: '主动询问结果',
      body: '结果：ok',
      mention: false,
      targetUserId: 'esone.qiu',
    });

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe('runtime-bot-post-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://bot.example/v2/user/message');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer runtime-token',
      bot: 'runtime-bot-id',
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: 'esone.qiu@ringcentral.com',
      mention: false,
      message: expect.stringContaining('结果：ok'),
    });
  });

  it('classifies and filters channel feed by delivery receipts', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-weekly',
      'Weekly Report Ready',
      'Your weekly report is ready',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'new_conflict', ?, ?, ?, ?)`,
    ).run(
      'notif-conflict',
      'Need a decision',
      'There is a new conflict to confirm',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-1',
      'Review the rollout notes',
      'Check the notes before tomorrow morning',
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'notification:notif-weekly',
        channel: 'chrome',
        lane: 'notice',
        status: 'delivered',
      },
    ]);

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo', 'notice'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).toContain(
      'notification:notif-conflict',
    );
    expect(feed.map((item) => item.sourceRef)).toContain(
      'proposed_action:action-1',
    );
    expect(feed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-weekly',
    );
  });

  it('separates incremental todo pushes from daily unfinished todo digests', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-old',
      'Already delivered unfinished todo',
      'Keep it visible in the daily digest',
      now - 1_800,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 8)`,
    ).run(
      'action-new',
      'Fresh todo',
      'Only this belongs in the 15 minute stream',
      now - 3_600,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 10)`,
    ).run(
      'action-clicked',
      'Channel-clicked todo',
      'A channel-terminal action should stay out of the daily digest',
      now - 43_200,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'deadline', ?, ?, ?, ?)`,
    ).run(
      'notif-clicked-todo',
      'Channel-clicked notification todo',
      'A channel-terminal notification should stay out of the daily digest',
      now - 43_200,
      now - 43_200,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-delivered-notice',
      'Delivered notice',
      'Daily todo digests should not replay delivered notices',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'proposed_action:action-old',
        channel: 'doubao',
        lane: 'todo',
        status: 'delivered',
        recordedAt: now - 3_600,
      },
      {
        sourceRef: 'notification:notif-delivered-notice',
        channel: 'doubao',
        lane: 'notice',
        status: 'delivered',
        recordedAt: now - 3_600,
      },
      {
        sourceRef: 'proposed_action:action-clicked',
        channel: 'doubao',
        lane: 'todo',
        status: 'clicked',
        recordedAt: now - 3_600,
      },
      {
        sourceRef: 'notification:notif-clicked-todo',
        channel: 'doubao',
        lane: 'todo',
        status: 'dismissed',
        recordedAt: now - 3_600,
      },
    ]);

    const mixedDailyFeed = service.listFeed({
      channel: 'doubao',
      lanes: ['todo', 'notice'],
      deliveryMode: 'daily_digest',
    });
    expect(mixedDailyFeed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-delivered-notice',
    );
    expect(mixedDailyFeed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-clicked-todo',
    );

    const incrementalFeed = service.listFeed({
      channel: 'doubao',
      lanes: ['todo'],
      deliveryMode: 'incremental',
    });
    const dailyFeed = service.listFeed({
      channel: 'doubao',
      lanes: ['todo'],
      deliveryMode: 'daily_digest',
    });

    expect(incrementalFeed.map((item) => item.sourceRef)).toEqual([
      'proposed_action:action-new',
    ]);
    expect(dailyFeed.map((item) => item.sourceRef)).toEqual([
      'proposed_action:action-new',
      'proposed_action:action-old',
    ]);
    expect(dailyFeed.map((item) => item.sourceRef)).not.toContain(
      'proposed_action:action-clicked',
    );
    expect(dailyFeed[0].deliveryContext).toMatchObject({
      channel: 'doubao',
      reason: 'new',
      hasSuccessfulDelivery: false,
    });
    expect(dailyFeed[1].deliveryContext).toMatchObject({
      channel: 'doubao',
      reason: 'already_delivered_unfinished',
      lastStatus: 'delivered',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
    });

    const renderedDailyDigest = service.formatTodoDigest('doubao', 500, {
      deliveryMode: 'daily_digest',
    });
    expect(renderedDailyDigest.bodyMd).toContain('# 每日待办摘要');
    expect(renderedDailyDigest.bodyMd).toContain('## 未完成待办');
    expect(renderedDailyDigest.bodyMd).toContain('已提醒过，仍待处理');
  });

  it('keeps successful delivery receipts sticky after a later failure', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-sticky',
      'Weekly Report Ready',
      'Your weekly report is ready',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    const records = service.recordDelivery([
      {
        sourceRef: 'notification:notif-sticky',
        channel: 'chrome',
        lane: 'notice',
        status: 'delivered',
      },
      {
        sourceRef: 'notification:notif-sticky',
        channel: 'chrome',
        lane: 'notice',
        status: 'failed',
        error: 'transient_after_delivery',
      },
    ]);

    expect(records[records.length - 1]).toMatchObject({
      sourceRef: 'notification:notif-sticky',
      status: 'failed',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
      lastError: 'transient_after_delivery',
    });

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-sticky',
    );
  });

  it('preserves receipt event time and ignores older delayed callbacks for latest status', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-late-receipt',
      'Weekly Report Ready',
      'A delayed provider callback should not rewrite latest status',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    const deliveredAt = now - 900;
    const failedAt = now - 60;
    const olderDeliveredAt = now - 1_200;

    service.recordDelivery([
      {
        sourceRef: 'notification:notif-late-receipt',
        channel: 'chrome',
        lane: 'notice',
        status: 'delivered',
        externalRef: 'provider-delivered-current',
        recordedAt: deliveredAt,
      },
    ]);

    const failedRecord = service.recordDelivery([
      {
        sourceRef: 'notification:notif-late-receipt',
        channel: 'chrome',
        lane: 'notice',
        status: 'failed',
        error: 'network_later',
        recordedAt: failedAt,
      },
    ])[0];

    expect(failedRecord).toMatchObject({
      sourceRef: 'notification:notif-late-receipt',
      status: 'failed',
      effectiveStatus: 'delivered',
      lastError: 'network_later',
      firstDeliveredAt: deliveredAt,
      lastDeliveredAt: deliveredAt,
      updatedAt: failedAt,
    });

    const lateRecord = service.recordDelivery([
      {
        sourceRef: 'notification:notif-late-receipt',
        channel: 'chrome',
        lane: 'notice',
        status: 'delivered',
        externalRef: 'provider-delivered-late',
        recordedAt: olderDeliveredAt,
      },
    ])[0];

    expect(lateRecord).toMatchObject({
      sourceRef: 'notification:notif-late-receipt',
      status: 'failed',
      effectiveStatus: 'delivered',
      lastError: 'network_later',
      firstDeliveredAt: olderDeliveredAt,
      lastDeliveredAt: deliveredAt,
      updatedAt: failedAt,
    });

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-late-receipt',
    );
  });

  it('continues past delivered records to find older undelivered feed items', () => {
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < 10; i += 1) {
      db.prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, sent_at, created_at)
         VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
      ).run(
        `notif-window-${i}`,
        `Weekly Report ${i}`,
        `Report body ${i}`,
        now - i,
        now - i,
      );
    }

    const service = new NotificationCenterService(db);
    service.recordDelivery(
      Array.from({ length: 8 }, (_, i) => ({
        sourceRef: `notification:notif-window-${i}`,
        channel: 'chrome' as const,
        lane: 'notice' as const,
        status: 'delivered' as const,
      })),
    );

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 2,
    });

    expect(feed.map((item) => item.sourceRef)).toEqual([
      'notification:notif-window-8',
      'notification:notif-window-9',
    ]);
  });

  it('retries unacted todos after the delivery cooldown but keeps notices sticky', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'deadline', ?, ?, ?, ?)`,
    ).run(
      'notif-deadline-retry',
      'Deadline needs attention',
      'No user action has been recorded yet',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-notice-sticky',
      'Weekly report ready',
      'Informational digest',
      now,
      now,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-retry',
      'Review proposed action',
      'Still waiting for an explicit decision',
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'notification:notif-deadline-retry',
        channel: 'chrome',
        lane: 'todo',
        status: 'delivered',
      },
      {
        sourceRef: 'notification:notif-notice-sticky',
        channel: 'chrome',
        lane: 'notice',
        status: 'delivered',
      },
      {
        sourceRef: 'proposed_action:action-retry',
        channel: 'chrome',
        lane: 'todo',
        status: 'delivered',
      },
    ]);

    const recentFeed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo', 'notice'],
      limit: 10,
    });
    expect(recentFeed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-deadline-retry',
    );
    expect(recentFeed.map((item) => item.sourceRef)).not.toContain(
      'proposed_action:action-retry',
    );
    expect(recentFeed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-notice-sticky',
    );

    const staleDeliveredAt = now - TODO_DELIVERY_RETRY_COOLDOWN_SECONDS - 60;
    db.prepare(
      `UPDATE channel_delivery_records
          SET first_delivered_at = ?,
              last_delivered_at = ?,
              updated_at = ?
        WHERE source_ref IN (?, ?, ?)`,
    ).run(
      staleDeliveredAt,
      staleDeliveredAt,
      staleDeliveredAt,
      'notification:notif-deadline-retry',
      'notification:notif-notice-sticky',
      'proposed_action:action-retry',
    );

    const retryFeed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo', 'notice'],
      limit: 10,
    });
    const retryRefs = retryFeed.map((item) => item.sourceRef);
    expect(retryRefs).toContain('notification:notif-deadline-retry');
    expect(retryRefs).toContain('proposed_action:action-retry');
    expect(retryRefs).not.toContain('notification:notif-notice-sticky');
    expect(
      retryFeed.find(
        (item) => item.sourceRef === 'notification:notif-deadline-retry',
      )?.deliveryContext,
    ).toMatchObject({
      channel: 'chrome',
      reason: 'retry_after_cooldown',
      lastStatus: 'delivered',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
      cooldownSeconds: TODO_DELIVERY_RETRY_COOLDOWN_SECONDS,
    });

    service.recordDelivery([
      {
        sourceRef: 'notification:notif-deadline-retry',
        channel: 'chrome',
        lane: 'todo',
        status: 'clicked',
      },
    ]);

    const clickedFeed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo'],
      limit: 10,
    });
    expect(clickedFeed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-deadline-retry',
    );
  });

  it('exposes previous failed delivery context on feed items', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-failed-context',
      'Weekly Report Ready',
      'The previous push failed before reaching Chrome',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'notification:notif-failed-context',
        channel: 'chrome',
        lane: 'notice',
        status: 'failed',
        error: 'chrome_unavailable',
      },
    ]);

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });

    const item = feed.find(
      (candidate) =>
        candidate.sourceRef === 'notification:notif-failed-context',
    );
    expect(item?.deliveryContext).toMatchObject({
      channel: 'chrome',
      reason: 'previous_delivery_failed',
      lastStatus: 'failed',
      effectiveStatus: 'failed',
      hasSuccessfulDelivery: false,
    });
  });

  it('keeps latest failed todo attempts visible after an older delivery cooled down', () => {
    const now = Math.floor(Date.now() / 1000);
    const staleDeliveredAt = now - TODO_DELIVERY_RETRY_COOLDOWN_SECONDS - 90;

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 8)`,
    ).run(
      'action-failed-after-delivery',
      'Retry the failed channel delivery',
      'The latest send attempt failed after an earlier delivery cooled down',
      now - 1_800,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 8)`,
    ).run(
      'action-fresh-after-failure',
      'Fresh todo after failure',
      'This should sort behind the failed retry',
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'proposed_action:action-failed-after-delivery',
        channel: 'chrome',
        lane: 'todo',
        status: 'delivered',
        recordedAt: staleDeliveredAt,
      },
      {
        sourceRef: 'proposed_action:action-failed-after-delivery',
        channel: 'chrome',
        lane: 'todo',
        status: 'failed',
        error: 'chrome_api_unavailable',
        recordedAt: now - 60,
      },
    ]);

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).toEqual([
      'proposed_action:action-failed-after-delivery',
      'proposed_action:action-fresh-after-failure',
    ]);
    expect(feed[0].deliveryContext).toMatchObject({
      channel: 'chrome',
      reason: 'previous_delivery_failed',
      lastStatus: 'failed',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
      lastAttemptAt: now - 60,
      lastDeliveredAt: staleDeliveredAt,
    });

    const renderedDailyDigest = service.formatTodoDigest('chrome', 500, {
      deliveryMode: 'daily_digest',
    });
    expect(renderedDailyDigest.bodyMd).toContain('上次发送失败');
  });

  it('includes cross-channel delivery receipts on feed and digest items', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-cross-channel',
      'Weekly Report Ready',
      'Chrome has not shown this one yet',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'notification:notif-cross-channel',
        channel: 'doubao',
        lane: 'notice',
        status: 'delivered',
        recordedAt: now - 300,
      },
      {
        sourceRef: 'notification:notif-cross-channel',
        channel: 'glip',
        lane: 'notice',
        status: 'failed',
        error: 'bot_not_configured',
        recordedAt: now - 120,
      },
    ]);

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });

    const item = feed.find(
      (candidate) =>
        candidate.sourceRef === 'notification:notif-cross-channel',
    );
    expect(item?.deliveryContext).toMatchObject({
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    });
    expect(item?.channelReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'chrome',
          state: 'not_attempted',
          hasSuccessfulDelivery: false,
        }),
        expect.objectContaining({
          channel: 'doubao',
          state: 'delivered',
          label: '已送达',
          hasSuccessfulDelivery: true,
        }),
        expect.objectContaining({
          channel: 'glip',
          state: 'failed',
          label: '发送失败',
          lastError: 'bot_not_configured',
        }),
      ]),
    );

    const rendered = service.formatNoticeDigest('chrome', 500);
    expect(rendered.bodyMd).toContain(
      '其他渠道：豆包已送达，Glip发送失败；失败原因：Glip：bot_not_configured',
    );
  });

  it('keeps terminal channel states visible after a later failure receipt', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-terminal-failure',
      'Weekly Report Ready',
      'A later provider failure should not hide the handled state',
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'notification:notif-terminal-failure',
        channel: 'doubao',
        lane: 'notice',
        status: 'clicked',
        recordedAt: now - 300,
      },
      {
        sourceRef: 'notification:notif-terminal-failure',
        channel: 'doubao',
        lane: 'notice',
        status: 'failed',
        error: 'provider_retry_failed',
        recordedAt: now - 120,
      },
    ]);

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });
    const item = feed.find(
      (candidate) =>
        candidate.sourceRef === 'notification:notif-terminal-failure',
    );

    expect(item?.channelReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'doubao',
          state: 'clicked',
          label: '已查看，最近失败',
          detail:
            '用户已从该渠道进入处理入口；最近一次回执失败：provider_retry_failed',
          status: 'failed',
          effectiveStatus: 'clicked',
          hasSuccessfulDelivery: true,
          lastError: 'provider_retry_failed',
        }),
      ]),
    );

    const rendered = service.formatNoticeDigest('chrome', 500);
    expect(rendered.bodyMd).toContain(
      '其他渠道：豆包已查看，最近失败；失败原因：豆包：provider_retry_failed（有效状态仍按已查看）',
    );
  });

  it('bounds todo digest markdown without marking hidden items delivered', () => {
    const now = Math.floor(Date.now() / 1000);
    const longDescription =
      'This todo has enough explanatory text to force the provider digest to choose complete visible items instead of cutting a receipt mid-sentence.';

    for (let i = 0; i < 5; i += 1) {
      db.prepare(
        `INSERT INTO proposed_actions
          (id, type, title, description, state, created_at, action_type, queue_status, priority)
         VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
      ).run(
        `action-truncated-todo-${i}`,
        `Digest truncation todo ${i}`,
        `${longDescription} index=${i}`,
        now - i,
      );
    }

    const service = new NotificationCenterService(db);
    const rendered = service.formatTodoDigest('doubao', 100, {
      deliveryMode: 'incremental',
      limit: 5,
    });

    expect(rendered.bodyMd.length).toBeLessThanOrEqual(400);
    expect(rendered.bodyMd).toContain('已截断');
    expect(rendered.bodyMd).toContain('未显示条目不会写入本次渠道送达回执');
    expect(rendered.itemCount).toBe(rendered.sourceRefs.length);
    expect(rendered.omittedItemCount).toBeGreaterThan(0);
    expect(rendered.sourceRefs).not.toContain(
      'proposed_action:action-truncated-todo-4',
    );
    expect(rendered.bodyMd).not.toContain('Digest truncation todo 4');
  });

  it('leaves notice digest items in feed when they were omitted by budget', () => {
    const now = Math.floor(Date.now() / 1000);
    const longBody =
      'This notice body is intentionally long enough that only a subset of complete notification rows can fit inside the constrained provider digest budget.';

    for (let i = 0; i < 5; i += 1) {
      db.prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, sent_at, created_at)
         VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
      ).run(
        `notif-truncated-notice-${i}`,
        `Digest truncation notice ${i}`,
        `${longBody} index=${i}`,
        now - i,
        now - i,
      );
    }

    const service = new NotificationCenterService(db);
    const allRefs = service
      .listFeed({ channel: 'doubao', lanes: ['notice'], limit: 10 })
      .map((item) => item.sourceRef);
    const rendered = service.formatNoticeDigest('doubao', 100);
    const hiddenRefs = allRefs.filter(
      (sourceRef) => !rendered.sourceRefs.includes(sourceRef),
    );

    expect(rendered.bodyMd.length).toBeLessThanOrEqual(400);
    expect(rendered.bodyMd).toContain('已截断');
    expect(rendered.itemCount).toBe(rendered.sourceRefs.length);
    expect(hiddenRefs.length).toBeGreaterThan(0);

    service.recordDelivery(
      rendered.sourceRefs.map((sourceRef) => ({
        sourceRef,
        channel: 'doubao' as const,
        lane: 'notice' as const,
        status: 'delivered' as const,
      })),
    );

    const remainingRefs = service
      .listFeed({ channel: 'doubao', lanes: ['notice'], limit: 10 })
      .map((item) => item.sourceRef);
    for (const hiddenRef of hiddenRefs) {
      expect(remainingRefs).toContain(hiddenRef);
    }
    for (const visibleRef of rendered.sourceRefs) {
      expect(remainingRefs).not.toContain(visibleRef);
    }
  });

  it('does not surface expired proposed actions as todos', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, expires_at, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-expired',
      'Expired action',
      'This should not be shown',
      now - 60,
      now - 3600,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, expires_at, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, ?, 'notify_user', 'queued', 8)`,
    ).run(
      'action-active',
      'Active action',
      'This should still be shown',
      now + 3600,
      now,
    );

    const service = new NotificationCenterService(db);
    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['todo'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).toContain(
      'proposed_action:action-active',
    );
    expect(feed.map((item) => item.sourceRef)).not.toContain(
      'proposed_action:action-expired',
    );
  });

  it('includes useful payload details in notice digests', () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'dream_digest', ?, ?, ?, ?, ?)`,
    ).run(
      'notif-dream-detail',
      'Weekly Dream Digest',
      '2 dream(s) generated this period',
      JSON.stringify({
        dreamCount: 2,
        dreamDigestScopeReceipt:
          '覆盖周期：2026-05-18 至 2026-05-25\n本次纳入：2 个梦境文件\n未纳入：旧周期 1 个，日期缺失 1 个\n边界：这次推送只汇总当前 Dream Digest 周期；旧梦境和日期缺失文件仍可在梦境重放页查看。',
        digestBody:
          '**Rooms rollout alignment**\nFollow up on the RingCentral rollout decision.\n\n**Doubao bridge fix**\nSync the useful memory highlights, not just the shell notification.',
      }),
      now,
      now,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?, ?)`,
    ).run(
      'notif-weekly-detail',
      'Weekly Report Ready',
      'Your weekly report is ready',
      JSON.stringify({
        reportSummary: 'Launch weekly summary: rollout is on track.',
        reportExcerpt:
          'Highlights\n- Launch weekly summary: rollout is on track.\n\nAction Items\n- Review deployment notes before Friday.',
      }),
      now - 1,
      now - 1,
    );

    const service = new NotificationCenterService(db);
    const rendered = service.formatNoticeDigest('doubao', 500);

    expect(rendered.bodyMd).toContain('# 通知摘要');
    expect(rendered.bodyMd).toContain('## 更新');
    expect(rendered.bodyMd).toContain('2 dream(s) generated this period');
    expect(rendered.bodyMd).toContain('覆盖周期：2026-05-18 至 2026-05-25');
    expect(rendered.bodyMd).toContain('旧梦境和日期缺失文件仍可在梦境重放页查看');
    expect(rendered.bodyMd).toContain('Rooms rollout alignment');
    expect(rendered.bodyMd).toContain('Doubao bridge fix');
    expect(rendered.bodyMd).toContain('Launch weekly summary');
    expect(rendered.bodyMd).toContain('Review deployment notes');
  });

  it('exposes feed and delivery routes', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run(
      'notif-weekly-route',
      'Weekly Report Ready',
      'Your weekly report is ready',
      now,
      now,
    );

    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&lanes=notice',
    });

    expect(feedRes.statusCode).toBe(200);
    const feedBody = feedRes.json();
    expect(feedBody.total).toBe(1);
    expect(feedBody.items[0].sourceRef).toBe('notification:notif-weekly-route');
    expect(feedBody.items[0].deliveryContext).toMatchObject({
      channel: 'chrome',
      reason: 'new',
      hasSuccessfulDelivery: false,
    });

    const deliveredAt = now - 30;
    const deliveryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notification-center/delivery',
      payload: {
        events: [
          {
            sourceRef: 'notification:notif-weekly-route',
            channel: 'chrome',
            lane: 'notice',
            status: 'delivered',
            externalRef: 'backend-notif-weekly-route',
            recordedAt: deliveredAt,
          },
        ],
      },
    });

    expect(deliveryRes.statusCode).toBe(200);
    const deliveryBody = deliveryRes.json();
    expect(deliveryBody.ok).toBe(true);
    expect(deliveryBody.updated).toBe(1);
    expect(deliveryBody.items[0]).toMatchObject({
      sourceRef: 'notification:notif-weekly-route',
      status: 'delivered',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
      firstDeliveredAt: deliveredAt,
      lastDeliveredAt: deliveredAt,
      updatedAt: deliveredAt,
    });

    const feedAfterDelivery = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&lanes=notice',
    });

    expect(feedAfterDelivery.statusCode).toBe(200);
    expect(feedAfterDelivery.json().total).toBe(0);
  });

  it('exposes feed meta when the limited response has more items', async () => {
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < 3; i += 1) {
      db.prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, sent_at, created_at)
         VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
      ).run(
        `notif-feed-meta-${i}`,
        `Weekly Report ${i}`,
        `Report body ${i}`,
        now - i,
        now - i,
      );
    }

    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&lanes=notice&limit=2',
    });

    expect(feedRes.statusCode).toBe(200);
    const feedBody = feedRes.json();
    expect(feedBody.total).toBe(2);
    expect(feedBody.items.map((item: { sourceRef: string }) => item.sourceRef)).toEqual([
      'notification:notif-feed-meta-0',
      'notification:notif-feed-meta-1',
    ]);
    expect(feedBody.meta).toEqual({
      channel: 'chrome',
      lanes: ['notice'],
      deliveryMode: 'retry_after_cooldown',
      limit: 2,
      returned: 2,
      hasMore: true,
    });
  });

  it('exposes deliveryMode on the feed route', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run(
      'action-delivered-route',
      'Already delivered unfinished todo',
      'Keep this in the daily digest only',
      now - 86_400,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 8)`,
    ).run(
      'action-fresh-route',
      'Fresh todo',
      'This should appear in every todo feed mode',
      now,
    );

    const service = new NotificationCenterService(db);
    service.recordDelivery([
      {
        sourceRef: 'proposed_action:action-delivered-route',
        channel: 'doubao',
        lane: 'todo',
        status: 'delivered',
        recordedAt: now - 3_600,
      },
    ]);

    const incrementalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=doubao&lanes=todo&deliveryMode=incremental',
    });
    expect(incrementalRes.statusCode).toBe(200);
    expect(
      incrementalRes
        .json()
        .items.map((item: { sourceRef: string }) => item.sourceRef),
    ).toEqual(['proposed_action:action-fresh-route']);

    const dailyDigestRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=doubao&lanes=todo&deliveryMode=daily_digest',
    });
    expect(dailyDigestRes.statusCode).toBe(200);
    expect(
      dailyDigestRes
        .json()
        .items.map((item: { sourceRef: string }) => item.sourceRef),
    ).toEqual([
      'proposed_action:action-fresh-route',
      'proposed_action:action-delivered-route',
    ]);
    expect(dailyDigestRes.json().items[0].deliveryContext).toMatchObject({
      channel: 'doubao',
      reason: 'new',
      hasSuccessfulDelivery: false,
    });
    expect(dailyDigestRes.json().items[1].deliveryContext).toMatchObject({
      channel: 'doubao',
      reason: 'already_delivered_unfinished',
      lastStatus: 'delivered',
      effectiveStatus: 'delivered',
      hasSuccessfulDelivery: true,
    });
  });

  it('snoozes notifications with a caller-provided delay', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'deadline', ?, ?, ?, ?, ?)`,
    ).run(
      'notif-deadline-snooze',
      'Deadline needs attention',
      'This should come back before the deadline',
      JSON.stringify({ details: 'Original context should be preserved' }),
      now,
      now,
    );

    const before = Math.floor(Date.now() / 1000);
    const snoozeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/notif-deadline-snooze/action',
      payload: {
        action: 'snooze',
        delaySeconds: 45 * 60,
      },
    });
    const after = Math.floor(Date.now() / 1000);

    expect(snoozeRes.statusCode).toBe(200);
    const snoozeBody = snoozeRes.json();
    expect(snoozeBody.delaySeconds).toBe(45 * 60);
    expect(snoozeBody.scheduledAt).toBeGreaterThanOrEqual(before + 45 * 60);
    expect(snoozeBody.scheduledAt).toBeLessThanOrEqual(after + 45 * 60);

    const created = db
      .prepare(
        'SELECT sent_at, payload_json FROM notification_records WHERE id = ?',
      )
      .get(snoozeBody.newNotificationId) as
      | { sent_at: number; payload_json: string }
      | undefined;
    expect(created?.sent_at).toBe(snoozeBody.scheduledAt);
    const createdPayload = JSON.parse(created?.payload_json ?? '{}');
    expect(createdPayload.details).toBe('Original context should be preserved');
    expect(createdPayload.snooze).toMatchObject({
      sourceNotificationId: 'notif-deadline-snooze',
      rootNotificationId: 'notif-deadline-snooze',
      delaySeconds: 45 * 60,
      scheduledAt: snoozeBody.scheduledAt,
      count: 1,
    });
    expect(createdPayload.snooze.snoozedAt).toBeGreaterThanOrEqual(before);
    expect(createdPayload.snooze.snoozedAt).toBeLessThanOrEqual(after);

    const scheduledRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?state=scheduled',
    });

    expect(scheduledRes.statusCode).toBe(200);
    const scheduledItems = scheduledRes.json();
    expect(scheduledItems.map((item: { id: string }) => item.id)).toEqual([
      snoozeBody.newNotificationId,
    ]);
    expect(scheduledItems[0].payload.snooze).toMatchObject({
      sourceNotificationId: 'notif-deadline-snooze',
      scheduledAt: snoozeBody.scheduledAt,
    });

    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/stats',
    });

    expect(statsRes.statusCode).toBe(200);
    expect(statsRes.json().scheduled).toBe(1);

    const duplicateSnoozeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/notif-deadline-snooze/action',
      payload: {
        action: 'snooze',
        delaySeconds: 45 * 60,
      },
    });

    expect(duplicateSnoozeRes.statusCode).toBe(409);
    expect(duplicateSnoozeRes.json().error).toBe(
      'notification_already_handled',
    );

    const scheduledCount = db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM notification_records
          WHERE clicked_at IS NULL
            AND dismissed_at IS NULL
            AND sent_at > ?`,
      )
      .get(now) as { count: number };
    expect(scheduledCount.count).toBe(1);
  });

  it('rejects invalid feed query parameters', async () => {
    const missingChannel = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed',
    });
    expect(missingChannel.statusCode).toBe(400);

    const invalidLane = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&lanes=todo,unknown',
    });
    expect(invalidLane.statusCode).toBe(400);
    expect(invalidLane.json().error).toBe('invalid_lanes');

    const invalidDeliveryMode = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&deliveryMode=quiet_hours',
    });
    expect(invalidDeliveryMode.statusCode).toBe(400);

    const invalidNotificationState = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?state=quiet_hours',
    });
    expect(invalidNotificationState.statusCode).toBe(400);
    expect(invalidNotificationState.json().error).toBe(
      'invalid_notification_state',
    );
  });
});
