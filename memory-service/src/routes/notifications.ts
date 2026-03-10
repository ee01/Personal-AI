/**
 * Notification management routes.
 *
 * GET  /notifications          - List notifications (filterable)
 * POST /notifications/:id/action - Process notification action
 * GET  /notifications/stats    - Return notification statistics
 */

import type { FastifyInstance } from 'fastify';

import type { NotificationRecord } from '../types/index.js';
import { now, daysAgo, formatDate } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface NotificationRow {
  id: string;
  channel: string;
  type: string | null;
  title: string;
  body: string | null;
  payload_json: string | null;
  topic_id: string | null;
  related_entity_id: string | null;
  utility_score: number | null;
  sent_at: number | null;
  clicked_at: number | null;
  dismissed_at: number | null;
  action_taken: string | null;
  created_at: number;
}

interface NotificationActionBody {
  action: 'acknowledge' | 'dismiss' | 'snooze';
  detail?: string;
}

interface CountRow {
  count: number;
}

interface DayCountRow {
  day: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    channel: row.channel,
    type: row.type ?? undefined,
    title: row.title,
    body: row.body ?? undefined,
    payload: row.payload_json ? safeJsonParse(row.payload_json) : undefined,
    topicId: row.topic_id ?? undefined,
    relatedEntityId: row.related_entity_id ?? undefined,
    utilityScore: row.utility_score ?? undefined,
    sentAt: row.sent_at ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
    actionTaken: row.action_taken ?? undefined,
    createdAt: row.created_at,
  };
}

function safeJsonParse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const notificationActionBodySchema = {
  type: 'object' as const,
  required: ['action'],
  properties: {
    action: {
      type: 'string' as const,
      enum: ['acknowledge', 'dismiss', 'snooze'],
    },
    detail: { type: 'string' as const },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function notificationRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET /notifications — List notifications with optional filters
  app.get<{
    Querystring: {
      state?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };
  }>('/notifications', async (request, reply) => {
    const { db } = request.userContext;
    const { state, type } = request.query;
    const limit = parseInt(request.query.limit || '20', 10);
    const offset = parseInt(request.query.offset || '0', 10);

    const conditions: string[] = [];
    const params: unknown[] = [];

    // Filter by state
    if (state === 'pending') {
      // Unsent or sent but not clicked/dismissed
      conditions.push('clicked_at IS NULL AND dismissed_at IS NULL');
    } else if (state === 'clicked') {
      conditions.push('clicked_at IS NOT NULL');
    } else if (state === 'dismissed') {
      conditions.push('dismissed_at IS NOT NULL');
    } else {
      // Default: return pending notifications (unsent or sent but not acted upon)
      conditions.push('clicked_at IS NULL AND dismissed_at IS NULL');
    }

    // Filter by type
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT * FROM notifications ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as NotificationRow[];

    const notifications = rows.map(rowToNotification);

    return reply.status(200).send(notifications);
  });

  // GET /notifications/stats — Return notification statistics
  // NOTE: This route MUST be registered before /notifications/:id/action
  // so that "stats" is not captured as a :id param.
  app.get('/notifications/stats', async (request, reply) => {
    const { db } = request.userContext;
    const currentTime = now();
    const sevenDaysAgo = daysAgo(7);

    // Total counts by state
    const pendingCount = (
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM notifications WHERE clicked_at IS NULL AND dismissed_at IS NULL',
        )
        .get() as CountRow
    ).count;

    const clickedCount = (
      db
        .prepare('SELECT COUNT(*) AS count FROM notifications WHERE clicked_at IS NOT NULL')
        .get() as CountRow
    ).count;

    const dismissedCount = (
      db
        .prepare('SELECT COUNT(*) AS count FROM notifications WHERE dismissed_at IS NOT NULL')
        .get() as CountRow
    ).count;

    // Notifications per day for last 7 days
    // Generate the last 7 days as a reference, then count per day
    const dailyCounts: Array<{ date: string; count: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = currentTime - i * 86400;
      const dayStartMidnight = Math.floor(dayStart / 86400) * 86400;
      const dayEndMidnight = dayStartMidnight + 86400;
      const dateStr = formatDate(dayStartMidnight);

      const row = db
        .prepare(
          'SELECT COUNT(*) AS count FROM notifications WHERE created_at >= ? AND created_at < ?',
        )
        .get(dayStartMidnight, dayEndMidnight) as CountRow;

      dailyCounts.push({ date: dateStr, count: row.count });
    }

    return reply.status(200).send({
      pending: pendingCount,
      clicked: clickedCount,
      dismissed: dismissedCount,
      dailyCounts,
    });
  });

  // POST /notifications/:id/action — Process notification action
  app.post<{ Params: { id: string }; Body: NotificationActionBody }>(
    '/notifications/:id/action',
    { schema: { body: notificationActionBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;
      const { action, detail } = request.body;

      const existing = db
        .prepare('SELECT * FROM notifications WHERE id = ?')
        .get(id) as NotificationRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Notification "${id}" not found` });
      }

      const currentTime = now();

      switch (action) {
        case 'acknowledge': {
          db.prepare(
            'UPDATE notifications SET clicked_at = ?, action_taken = ? WHERE id = ?',
          ).run(currentTime, detail ?? 'acknowledged', id);
          break;
        }
        case 'dismiss': {
          db.prepare(
            'UPDATE notifications SET dismissed_at = ?, action_taken = ? WHERE id = ?',
          ).run(currentTime, detail ?? 'dismissed', id);
          break;
        }
        case 'snooze': {
          // Create a new notification scheduled 24 hours from now
          const snoozeTime = currentTime + 24 * 3600; // +24h
          const newId = generateId();

          db.prepare(
            `INSERT INTO notifications (id, channel, type, title, body, payload_json, topic_id, related_entity_id, utility_score, sent_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            newId,
            existing.channel,
            existing.type,
            existing.title,
            existing.body,
            existing.payload_json,
            existing.topic_id,
            existing.related_entity_id,
            existing.utility_score,
            snoozeTime,
            currentTime,
          );

          // Mark the original as dismissed with snooze note
          db.prepare(
            'UPDATE notifications SET dismissed_at = ?, action_taken = ? WHERE id = ?',
          ).run(currentTime, 'snoozed', id);

          return reply.status(200).send({
            id,
            action: 'snooze',
            newNotificationId: newId,
            scheduledAt: snoozeTime,
          });
        }
      }

      // Re-fetch the updated notification
      const updated = db
        .prepare('SELECT * FROM notifications WHERE id = ?')
        .get(id) as NotificationRow;

      return reply.status(200).send(rowToNotification(updated));
    },
  );
}
