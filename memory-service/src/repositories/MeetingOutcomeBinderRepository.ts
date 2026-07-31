import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type {
  MeetingOutcomeBinder,
  MeetingOutcomeBinderStatus,
  MeetingOutcomeEvidence,
  MeetingOutcomeSlot,
} from '../types/index.js';
import { now } from '../utils/time.js';

interface MeetingOutcomeBinderRow {
  id: string;
  user_id: string;
  prep_id: string;
  event_external_id: string;
  event_series_key: string | null;
  event_title: string;
  event_start_at: number;
  meeting_id: string | null;
  status: MeetingOutcomeBinderStatus;
  slots_json: string;
  source_evidence_json: string;
  source_hash: string;
  binding_mode: 'llm' | 'deterministic_fallback' | null;
  binding_error: string | null;
  generated_at: number;
  bound_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface UpsertMeetingOutcomePreviewInput {
  id?: string;
  userId: string;
  prepId: string;
  eventExternalId: string;
  eventSeriesKey?: string;
  eventTitle: string;
  eventStartAt: number;
  slots: MeetingOutcomeSlot[];
  sourceEvidence: MeetingOutcomeEvidence[];
  sourceHash: string;
  generatedAt?: number;
}

export interface SaveMeetingOutcomeBindingInput {
  binderId: string;
  userId: string;
  meetingId: string;
  status: MeetingOutcomeBinderStatus;
  slots: MeetingOutcomeSlot[];
  bindingMode: 'llm' | 'deterministic_fallback';
  bindingError?: string;
  boundAt?: number;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class MeetingOutcomeBinderRepository {
  constructor(private readonly db: Database.Database) {}

  findById(userId: string, id: string): MeetingOutcomeBinder | null {
    const row = this.db
      .prepare(
        `SELECT * FROM meeting_outcome_binders
         WHERE user_id = ? AND id = ?
         LIMIT 1`,
      )
      .get(userId, id) as MeetingOutcomeBinderRow | undefined;
    return row ? this.toRecord(row) : null;
  }

  findByPrepId(userId: string, prepId: string): MeetingOutcomeBinder | null {
    const row = this.db
      .prepare(
        `SELECT * FROM meeting_outcome_binders
         WHERE user_id = ? AND prep_id = ?
         LIMIT 1`,
      )
      .get(userId, prepId) as MeetingOutcomeBinderRow | undefined;
    return row ? this.toRecord(row) : null;
  }

  findByMeetingId(
    userId: string,
    meetingId: string,
  ): MeetingOutcomeBinder | null {
    const row = this.db
      .prepare(
        `SELECT * FROM meeting_outcome_binders
         WHERE user_id = ? AND meeting_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(userId, meetingId) as MeetingOutcomeBinderRow | undefined;
    return row ? this.toRecord(row) : null;
  }

  findLatestForEvent(
    userId: string,
    eventExternalId: string,
  ): MeetingOutcomeBinder | null {
    const row = this.db
      .prepare(
        `SELECT * FROM meeting_outcome_binders
         WHERE user_id = ? AND event_external_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(userId, eventExternalId) as MeetingOutcomeBinderRow | undefined;
    return row ? this.toRecord(row) : null;
  }

  listRecent(
    userId: string,
    limit = 50,
  ): MeetingOutcomeBinder[] {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = this.db
      .prepare(
        `SELECT * FROM meeting_outcome_binders
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(userId, safeLimit) as MeetingOutcomeBinderRow[];
    return rows.map((row) => this.toRecord(row));
  }

  upsertPreview(input: UpsertMeetingOutcomePreviewInput): MeetingOutcomeBinder {
    const existing = this.findByPrepId(input.userId, input.prepId);
    if (existing?.meetingId && existing.status !== 'planned') {
      return existing;
    }

    const currentTime = input.generatedAt ?? now();
    const id = existing?.id ?? input.id ?? randomUUID();
    this.db
      .prepare(
        `INSERT INTO meeting_outcome_binders (
           id, user_id, prep_id, event_external_id, event_series_key,
           event_title, event_start_at, meeting_id, status, slots_json,
           source_evidence_json, source_hash, binding_mode, binding_error,
           generated_at, bound_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'planned', ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)
         ON CONFLICT(user_id, prep_id) DO UPDATE SET
           event_external_id = excluded.event_external_id,
           event_series_key = excluded.event_series_key,
           event_title = excluded.event_title,
           event_start_at = excluded.event_start_at,
           status = 'planned',
           slots_json = excluded.slots_json,
           source_evidence_json = excluded.source_evidence_json,
           source_hash = excluded.source_hash,
           binding_mode = NULL,
           binding_error = NULL,
           generated_at = excluded.generated_at,
           bound_at = NULL,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.userId,
        input.prepId,
        input.eventExternalId,
        input.eventSeriesKey ?? null,
        input.eventTitle,
        input.eventStartAt,
        JSON.stringify(input.slots),
        JSON.stringify(input.sourceEvidence),
        input.sourceHash,
        currentTime,
        existing?.createdAt ?? currentTime,
        currentTime,
      );
    const stored = this.findByPrepId(input.userId, input.prepId);
    if (!stored) throw new Error('Meeting outcome preview was not stored');
    return stored;
  }

  saveBinding(input: SaveMeetingOutcomeBindingInput): MeetingOutcomeBinder {
    const boundAt = input.boundAt ?? now();
    this.db
      .prepare(
        `UPDATE meeting_outcome_binders
         SET meeting_id = ?, status = ?, slots_json = ?, binding_mode = ?,
             binding_error = ?, bound_at = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        input.meetingId,
        input.status,
        JSON.stringify(input.slots),
        input.bindingMode,
        input.bindingError ?? null,
        boundAt,
        boundAt,
        input.userId,
        input.binderId,
      );
    const stored = this.findById(input.userId, input.binderId);
    if (!stored) throw new Error('Meeting outcome binder not found');
    return stored;
  }

  private toRecord(row: MeetingOutcomeBinderRow): MeetingOutcomeBinder {
    const slots = parseJson<MeetingOutcomeSlot[]>(row.slots_json, []);
    const sourceEvidence = parseJson<MeetingOutcomeEvidence[]>(
      row.source_evidence_json,
      [],
    );
    const resolvedCount = slots.filter(
      (slot) => slot.status === 'resolved',
    ).length;
    const continuingCount = slots.filter(
      (slot) =>
        slot.status === 'partially_resolved' ||
        slot.status === 'unresolved' ||
        slot.status === 'carried_over' ||
        slot.status === 'blocked_by_missing_evidence',
    ).length;
    return {
      id: row.id,
      userId: row.user_id,
      prepId: row.prep_id,
      eventExternalId: row.event_external_id,
      eventSeriesKey: row.event_series_key ?? undefined,
      eventTitle: row.event_title,
      eventStartAt: row.event_start_at,
      meetingId: row.meeting_id ?? undefined,
      status: row.status,
      slots,
      sourceEvidence,
      sourceHash: row.source_hash,
      bindingMode: row.binding_mode ?? undefined,
      bindingError: row.binding_error ?? undefined,
      generatedAt: row.generated_at,
      boundAt: row.bound_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      receipt: {
        source:
          row.status === 'planned'
            ? 'Today Pilot 会前准备：日历议程、建议问题和相关记忆。'
            : 'Meeting Pilot：会前目标与本场 transcript、决议、行动项的证据装订。',
        coverage:
          row.status === 'planned'
            ? `本场要闭环 ${slots.length} 项。`
            : `${resolvedCount} 项已闭环，${continuingCount} 项仍需继续。`,
        freshness: `更新于 ${new Date(row.updated_at * 1000).toISOString()}`,
        boundary:
          '当前为 Personal AI 只读派生结果；不会写回 Calendar、Jira、RingCentral、消息或外部任务。',
      },
    };
  }
}
