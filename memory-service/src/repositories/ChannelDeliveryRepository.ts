import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type DeliveryChannel = 'chrome' | 'doubao' | 'glip';
export type DeliveryLane = 'todo' | 'notice';
export type DeliveryStatus = 'delivered' | 'failed' | 'clicked' | 'dismissed';

export interface ChannelDeliveryRecord {
  sourceRef: string;
  channel: DeliveryChannel;
  lane: DeliveryLane;
  status: DeliveryStatus;
  effectiveStatus: DeliveryStatus;
  externalRef?: string;
  lastError?: string;
  hasSuccessfulDelivery: boolean;
  firstDeliveredAt?: number;
  lastDeliveredAt?: number;
  seenAt?: number;
  dismissedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertDeliveryEventInput {
  sourceRef: string;
  channel: DeliveryChannel;
  lane: DeliveryLane;
  status: DeliveryStatus;
  externalRef?: string;
  error?: string;
  recordedAt?: number;
}

interface ChannelDeliveryRow {
  source_ref: string;
  channel: DeliveryChannel;
  lane: DeliveryLane;
  status: DeliveryStatus;
  external_ref: string | null;
  last_error: string | null;
  first_delivered_at: number | null;
  last_delivered_at: number | null;
  seen_at: number | null;
  dismissed_at: number | null;
  created_at: number;
  updated_at: number;
}

export class ChannelDeliveryRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToRecord(row: ChannelDeliveryRow): ChannelDeliveryRecord {
    const firstDeliveredAt = row.first_delivered_at ?? undefined;
    const lastDeliveredAt = row.last_delivered_at ?? undefined;
    const seenAt = row.seen_at ?? undefined;
    const dismissedAt = row.dismissed_at ?? undefined;
    const hasSuccessfulDelivery =
      firstDeliveredAt !== undefined ||
      lastDeliveredAt !== undefined ||
      seenAt !== undefined ||
      dismissedAt !== undefined;
    const effectiveStatus: DeliveryStatus =
      dismissedAt !== undefined
        ? 'dismissed'
        : seenAt !== undefined
          ? 'clicked'
          : firstDeliveredAt !== undefined || lastDeliveredAt !== undefined
            ? 'delivered'
            : row.status;

    return {
      sourceRef: row.source_ref,
      channel: row.channel,
      lane: row.lane,
      status: row.status,
      effectiveStatus,
      externalRef: row.external_ref ?? undefined,
      lastError: row.last_error ?? undefined,
      hasSuccessfulDelivery,
      firstDeliveredAt,
      lastDeliveredAt,
      seenAt,
      dismissedAt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertEvents(events: UpsertDeliveryEventInput[]): ChannelDeliveryRecord[] {
    if (events.length === 0) return [];

    const upsert = this.db.prepare(
      `INSERT INTO channel_delivery_records
        (source_ref, channel, lane, status, external_ref, last_error,
         first_delivered_at, last_delivered_at, seen_at, dismissed_at,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_ref, channel, lane) DO UPDATE SET
         status = excluded.status,
         external_ref = COALESCE(excluded.external_ref, channel_delivery_records.external_ref),
         last_error = excluded.last_error,
         first_delivered_at = COALESCE(channel_delivery_records.first_delivered_at, excluded.first_delivered_at),
         last_delivered_at = COALESCE(excluded.last_delivered_at, channel_delivery_records.last_delivered_at),
         seen_at = COALESCE(excluded.seen_at, channel_delivery_records.seen_at),
         dismissed_at = COALESCE(excluded.dismissed_at, channel_delivery_records.dismissed_at),
         updated_at = excluded.updated_at`,
    );

    const select = this.db.prepare(
      `SELECT source_ref, channel, lane, status, external_ref, last_error,
              first_delivered_at, last_delivered_at, seen_at, dismissed_at,
              created_at, updated_at
         FROM channel_delivery_records
        WHERE source_ref = ? AND channel = ? AND lane = ?`,
    );

    const results: ChannelDeliveryRecord[] = [];
    const run = this.db.transaction((inputs: UpsertDeliveryEventInput[]) => {
      for (const event of inputs) {
        const recordedAt = event.recordedAt ?? now();
        const isDelivered = event.status === 'delivered';
        const isClicked = event.status === 'clicked';
        const isDismissed = event.status === 'dismissed';

        upsert.run(
          event.sourceRef,
          event.channel,
          event.lane,
          event.status,
          event.externalRef ?? null,
          event.status === 'failed' ? event.error ?? 'delivery_failed' : null,
          isDelivered ? recordedAt : null,
          isDelivered ? recordedAt : null,
          isClicked ? recordedAt : null,
          isDismissed ? recordedAt : null,
          recordedAt,
          recordedAt,
        );

        const row = select.get(event.sourceRef, event.channel, event.lane) as ChannelDeliveryRow | undefined;
        if (row) {
          results.push(this.rowToRecord(row));
        }
      }
    });

    run(events);
    return results;
  }

  getRecord(
    sourceRef: string,
    channel: DeliveryChannel,
    lane: DeliveryLane,
  ): ChannelDeliveryRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT source_ref, channel, lane, status, external_ref, last_error,
                first_delivered_at, last_delivered_at, seen_at, dismissed_at,
                created_at, updated_at
           FROM channel_delivery_records
          WHERE source_ref = ? AND channel = ? AND lane = ?`,
      )
      .get(sourceRef, channel, lane) as ChannelDeliveryRow | undefined;

    return row ? this.rowToRecord(row) : undefined;
  }

  getSuccessfulSourceRefs(
    sourceRefs: string[],
    channel: DeliveryChannel,
    lanes: DeliveryLane[],
  ): Set<string> {
    if (sourceRefs.length === 0 || lanes.length === 0) return new Set();

    const sourcePlaceholders = sourceRefs.map(() => '?').join(', ');
    const lanePlaceholders = lanes.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT DISTINCT source_ref
           FROM channel_delivery_records
          WHERE channel = ?
            AND lane IN (${lanePlaceholders})
            AND (
              status IN ('delivered', 'clicked', 'dismissed')
              OR first_delivered_at IS NOT NULL
              OR seen_at IS NOT NULL
              OR dismissed_at IS NOT NULL
            )
            AND source_ref IN (${sourcePlaceholders})`,
      )
      .all(channel, ...lanes, ...sourceRefs) as Array<{ source_ref: string }>;

    return new Set(rows.map((row) => row.source_ref));
  }
}
