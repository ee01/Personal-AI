import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

import { now } from '../../utils/time.js';

export interface StoredRcSubscription {
  id: string;
  subscriptionId: string;
  deliveryAddress: string;
  status: string;
  eventFiltersJson: string;
  expiresAt?: number;
  lastRenewedAt?: number;
  lastError?: string;
}

export class RingCentralWebhookRepository {
  constructor(private readonly db: Database.Database) {}

  rememberDelivery(deliveryKey: string, eventType: string, postId: string | null): boolean {
    const ts = now();
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO rc_tm_webhook_deliveries
           (delivery_key, event_type, post_id, payload_hash, processed_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        deliveryKey,
        eventType,
        postId,
        createHash('sha256').update(deliveryKey).digest('hex').slice(0, 16),
        ts,
      );
    return result.changes > 0;
  }

  upsertSubscription(input: {
    id: string;
    subscriptionId: string;
    deliveryAddress: string;
    status: string;
    eventFilters: string[];
    expiresAt?: number;
    lastError?: string | null;
  }): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO rc_tm_webhook_subscriptions
           (id, subscription_id, delivery_address, status, event_filters_json,
            expires_at, last_renewed_at, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(subscription_id) DO UPDATE SET
           delivery_address = excluded.delivery_address,
           status = excluded.status,
           event_filters_json = excluded.event_filters_json,
           expires_at = excluded.expires_at,
           last_renewed_at = excluded.last_renewed_at,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
      )
      .run(
        input.id,
        input.subscriptionId,
        input.deliveryAddress,
        input.status,
        JSON.stringify(input.eventFilters),
        input.expiresAt ?? null,
        ts,
        input.lastError ?? null,
        ts,
        ts,
      );
  }

  listSubscriptions(): StoredRcSubscription[] {
    return this.db
      .prepare(
        `SELECT id, subscription_id AS subscriptionId, delivery_address AS deliveryAddress,
                status, event_filters_json AS eventFiltersJson, expires_at AS expiresAt,
                last_renewed_at AS lastRenewedAt, last_error AS lastError
         FROM rc_tm_webhook_subscriptions
         ORDER BY updated_at DESC`,
      )
      .all() as StoredRcSubscription[];
  }

  getBackfillWatermark(chatId: string): {
    lastPostId: string | null;
    lastCreationTime: string | null;
  } | null {
    const row = this.db
      .prepare(
        `SELECT last_post_id AS lastPostId, last_creation_time AS lastCreationTime
         FROM rc_tm_backfill_watermarks WHERE chat_id = ?`,
      )
      .get(chatId) as
      | { lastPostId: string | null; lastCreationTime: string | null }
      | undefined;
    return row ?? null;
  }

  setBackfillWatermark(
    chatId: string,
    input: { lastPostId?: string; lastCreationTime?: string; postsIngested: number },
  ): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO rc_tm_backfill_watermarks
           (chat_id, last_post_id, last_creation_time, last_run_at, posts_ingested)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           last_post_id = COALESCE(excluded.last_post_id, rc_tm_backfill_watermarks.last_post_id),
           last_creation_time = COALESCE(excluded.last_creation_time, rc_tm_backfill_watermarks.last_creation_time),
           last_run_at = excluded.last_run_at,
           posts_ingested = rc_tm_backfill_watermarks.posts_ingested + excluded.posts_ingested`,
      )
      .run(
        chatId,
        input.lastPostId ?? null,
        input.lastCreationTime ?? null,
        ts,
        input.postsIngested,
      );
  }
}
