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
    ).run('notif-weekly', 'Weekly Report Ready', 'Your weekly report is ready', now, now);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'new_conflict', ?, ?, ?, ?)`,
    ).run('notif-conflict', 'Need a decision', 'There is a new conflict to confirm', now, now);

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, state, created_at, action_type, queue_status, priority)
       VALUES (?, 'notify_user', ?, ?, 'pending', ?, 'notify_user', 'queued', 9)`,
    ).run('action-1', 'Review the rollout notes', 'Check the notes before tomorrow morning', now);

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

    expect(feed.map((item) => item.sourceRef)).toContain('notification:notif-conflict');
    expect(feed.map((item) => item.sourceRef)).toContain('proposed_action:action-1');
    expect(feed.map((item) => item.sourceRef)).not.toContain('notification:notif-weekly');
  });

  it('exposes feed and delivery routes', async () => {
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?)`,
    ).run('notif-weekly-route', 'Weekly Report Ready', 'Your weekly report is ready', now, now);

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
});
