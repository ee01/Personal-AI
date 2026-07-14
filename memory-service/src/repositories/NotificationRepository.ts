import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type { NotificationRecord } from '../types/index.js';
import { formatDate, now } from '../utils/time.js';

interface NotificationRow {
  id: string;
  channel: string;
  type: string | null;
  title: string;
  body: string | null;
  payload_json: string | null;
  evidence_refs_json: string | null;
  weave_json: string | null;
  topic_id: string | null;
  related_entity_id: string | null;
  utility_score: number | null;
  sent_at: number | null;
  clicked_at: number | null;
  dismissed_at: number | null;
  action_taken: string | null;
  created_at: number;
}

interface CountRow {
  count: number;
}

function safeJsonParse<T>(json: string | null): T | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readPositiveNumberField(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export interface NotificationListFilters {
  state?: 'pending' | 'scheduled' | 'clicked' | 'dismissed';
  type?: string;
  limit?: number;
  offset?: number;
  includeFuture?: boolean;
}

export class NotificationRepository {
  constructor(private readonly db: Database.Database) {}

  rowToNotification(row: NotificationRow): NotificationRecord {
    return {
      id: row.id,
      channel: row.channel,
      type: row.type ?? undefined,
      title: row.title,
      body: row.body ?? undefined,
      payload: safeJsonParse(row.payload_json),
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

  list(filters: NotificationListFilters = {}): NotificationRecord[] {
    const state = filters.state ?? 'pending';
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const currentTime = now();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (state === 'pending') {
      conditions.push('clicked_at IS NULL AND dismissed_at IS NULL');
      if (!filters.includeFuture) {
        conditions.push('(sent_at IS NULL OR sent_at <= ?)');
        params.push(currentTime);
      }
    } else if (state === 'scheduled') {
      conditions.push('clicked_at IS NULL AND dismissed_at IS NULL');
      conditions.push('sent_at IS NOT NULL AND sent_at > ?');
      params.push(currentTime);
    } else if (state === 'clicked') {
      conditions.push('clicked_at IS NOT NULL');
    } else if (state === 'dismissed') {
      conditions.push('dismissed_at IS NOT NULL');
    }

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause =
      state === 'scheduled'
        ? 'ORDER BY sent_at ASC, created_at DESC'
        : 'ORDER BY created_at DESC';
    const rows = this.db
      .prepare(
        `SELECT * FROM notification_records
         ${whereClause}
         ${orderClause}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as NotificationRow[];

    return rows.map((row) => this.rowToNotification(row));
  }

  getById(id: string): NotificationRecord | null {
    const row = this.db
      .prepare('SELECT * FROM notification_records WHERE id = ?')
      .get(id) as NotificationRow | undefined;
    return row ? this.rowToNotification(row) : null;
  }

  acknowledge(id: string, detail?: string): NotificationRecord | null {
    this.db
      .prepare(
        'UPDATE notification_records SET clicked_at = ?, action_taken = ? WHERE id = ?',
      )
      .run(now(), detail ?? 'acknowledged', id);
    return this.getById(id);
  }

  dismiss(id: string, detail?: string): NotificationRecord | null {
    this.db
      .prepare(
        'UPDATE notification_records SET dismissed_at = ?, action_taken = ? WHERE id = ?',
      )
      .run(now(), detail ?? 'dismissed', id);
    return this.getById(id);
  }

  snooze(
    id: string,
    delaySeconds = 24 * 3600,
  ): {
    notification: NotificationRecord | null;
    newNotificationId: string;
    scheduledAt: number;
  } {
    const existing = this.db
      .prepare('SELECT * FROM notification_records WHERE id = ?')
      .get(id) as NotificationRow | undefined;

    if (!existing) {
      throw new Error(`Notification "${id}" not found`);
    }
    if (existing.clicked_at !== null || existing.dismissed_at !== null) {
      throw new Error(`Notification "${id}" is already handled`);
    }

    const currentTime = now();
    const scheduledAt = currentTime + delaySeconds;
    const newId = randomUUID();
    const payload =
      safeJsonParse<Record<string, unknown>>(existing.payload_json) ?? {};
    const previousSnooze =
      payload.snooze && typeof payload.snooze === 'object'
        ? (payload.snooze as Record<string, unknown>)
        : {};
    const rootNotificationId =
      readStringField(previousSnooze, 'rootNotificationId') ??
      readStringField(previousSnooze, 'sourceNotificationId') ??
      existing.id;
    const snoozeCount =
      (readPositiveNumberField(previousSnooze, 'count') ?? 0) + 1;
    const snoozedPayload = JSON.stringify({
      ...payload,
      snooze: {
        sourceNotificationId: existing.id,
        rootNotificationId,
        snoozedAt: currentTime,
        delaySeconds,
        scheduledAt,
        count: snoozeCount,
      },
    });

    this.db
      .prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, evidence_refs_json, weave_json, topic_id, related_entity_id, utility_score, sent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        existing.channel,
        existing.type,
        existing.title,
        existing.body,
        snoozedPayload,
        existing.evidence_refs_json,
        existing.weave_json,
        existing.topic_id,
        existing.related_entity_id,
        existing.utility_score,
        scheduledAt,
        currentTime,
      );

    this.db
      .prepare(
        'UPDATE notification_records SET dismissed_at = ?, action_taken = ? WHERE id = ?',
      )
      .run(currentTime, 'snoozed', id);

    return {
      notification: this.getById(id),
      newNotificationId: newId,
      scheduledAt,
    };
  }

  stats(): {
    pending: number;
    clicked: number;
    dismissed: number;
    scheduled: number;
    dailyCounts: Array<{ date: string; count: number }>;
  } {
    const currentTime = now();
    const pending = (
      this.db
        .prepare(
          'SELECT COUNT(*) AS count FROM notification_records WHERE clicked_at IS NULL AND dismissed_at IS NULL AND (sent_at IS NULL OR sent_at <= ?)',
        )
        .get(currentTime) as CountRow
    ).count;
    const clicked = (
      this.db
        .prepare(
          'SELECT COUNT(*) AS count FROM notification_records WHERE clicked_at IS NOT NULL',
        )
        .get() as CountRow
    ).count;
    const dismissed = (
      this.db
        .prepare(
          'SELECT COUNT(*) AS count FROM notification_records WHERE dismissed_at IS NOT NULL',
        )
        .get() as CountRow
    ).count;
    const scheduled = (
      this.db
        .prepare(
          'SELECT COUNT(*) AS count FROM notification_records WHERE clicked_at IS NULL AND dismissed_at IS NULL AND sent_at IS NOT NULL AND sent_at > ?',
        )
        .get(currentTime) as CountRow
    ).count;

    const dailyCounts: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = currentTime - i * 86400;
      const dayStartMidnight = Math.floor(dayStart / 86400) * 86400;
      const dayEndMidnight = dayStartMidnight + 86400;
      const count = (
        this.db
          .prepare(
            'SELECT COUNT(*) AS count FROM notification_records WHERE created_at >= ? AND created_at < ?',
          )
          .get(dayStartMidnight, dayEndMidnight) as CountRow
      ).count;

      dailyCounts.push({
        date: formatDate(dayStartMidnight),
        count,
      });
    }

    return { pending, clicked, dismissed, scheduled, dailyCounts };
  }
}
