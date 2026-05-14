import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
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
    service.recordDelivery([
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

    const feed = service.listFeed({
      channel: 'chrome',
      lanes: ['notice'],
      limit: 10,
    });

    expect(feed.map((item) => item.sourceRef)).not.toContain(
      'notification:notif-sticky',
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
        digestBody:
          '**Rooms rollout alignment**\nFollow up on the RingCentral rollout decision.\n\n**Doubao bridge fix**\nSync the useful memory highlights, not just the shell notification.',
      }),
      now,
      now,
    );

    const service = new NotificationCenterService(db);
    const rendered = service.formatNoticeDigest('doubao', 500);

    expect(rendered.bodyMd).toContain('2 dream(s) generated this period');
    expect(rendered.bodyMd).toContain('Rooms rollout alignment');
    expect(rendered.bodyMd).toContain('Doubao bridge fix');
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
          },
        ],
      },
    });

    expect(deliveryRes.statusCode).toBe(200);
    const deliveryBody = deliveryRes.json();
    expect(deliveryBody.ok).toBe(true);
    expect(deliveryBody.updated).toBe(1);

    const feedAfterDelivery = await app.inject({
      method: 'GET',
      url: '/api/v1/notification-center/feed?channel=chrome&lanes=notice',
    });

    expect(feedAfterDelivery.statusCode).toBe(200);
    expect(feedAfterDelivery.json().total).toBe(0);
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
  });
});
