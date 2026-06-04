import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import type {
  ComposerAssistEvidence,
  ContextAssistCueCard,
  StorylineOpportunity,
} from '../types/index.js';
import { normalizeStorylineOpportunity } from '../utils/storyline.js';

export type TodayPilotMeetingPrepStatus =
  | 'ready'
  | 'fallback'
  | 'failed'
  | 'stale';

export type TodayPilotMeetingPrepGeneratedMode =
  | 'nightly_llm'
  | 'on_demand_llm'
  | 'deterministic_fallback';

export interface TodayPilotMeetingPrepRecord {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  briefId?: string;
  missionId?: string;
  eventExternalId: string;
  eventSeriesKey?: string;
  eventTitle: string;
  startAt: number;
  goalHash: string;
  status: TodayPilotMeetingPrepStatus;
  generatedMode: TodayPilotMeetingPrepGeneratedMode;
  summaryMd: string;
  cueCards: ContextAssistCueCard[];
  questions: string[];
  evidenceRefs: ComposerAssistEvidence[];
  contextPackMd: string;
  redaction: Record<string, unknown>;
  llmUsage: Record<string, unknown>;
  storylineOpportunity?: StorylineOpportunity;
  sourceHash: string;
  generatedAt: number;
  expiresAt: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertTodayPilotMeetingPrepInput {
  id?: string;
  userId: string;
  localDate: string;
  timezone: string;
  briefId?: string;
  missionId?: string;
  eventExternalId: string;
  eventSeriesKey?: string;
  eventTitle: string;
  startAt: number;
  goalHash?: string;
  status: TodayPilotMeetingPrepStatus;
  generatedMode: TodayPilotMeetingPrepGeneratedMode;
  summaryMd: string;
  cueCards: ContextAssistCueCard[];
  questions: string[];
  evidenceRefs: ComposerAssistEvidence[];
  contextPackMd: string;
  redaction?: Record<string, unknown>;
  llmUsage?: Record<string, unknown>;
  sourceHash: string;
  generatedAt?: number;
  expiresAt: number;
  error?: string;
}

interface TodayMeetingPrepRow {
  id: string;
  user_id: string;
  local_date: string;
  timezone: string;
  brief_id: string | null;
  mission_id: string | null;
  event_external_id: string;
  event_series_key: string | null;
  event_title: string;
  start_at: number;
  goal_hash: string;
  status: TodayPilotMeetingPrepStatus;
  generated_mode: TodayPilotMeetingPrepGeneratedMode;
  summary_md: string;
  cue_cards_json: string;
  questions_json: string;
  evidence_refs_json: string;
  context_pack_md: string;
  redaction_json: string;
  llm_usage_json: string;
  source_hash: string;
  generated_at: number;
  expires_at: number;
  error: string | null;
  created_at: number;
  updated_at: number;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class TodayPilotMeetingPrepRepository {
  constructor(private readonly db: Database.Database) {}

  findById(
    id: string,
    currentTime = now(),
  ): TodayPilotMeetingPrepRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM today_meeting_preps WHERE id = ? LIMIT 1`)
      .get(id) as TodayMeetingPrepRow | undefined;
    if (!row || row.expires_at <= currentTime || row.status === 'stale') {
      return null;
    }
    return this.toRecord(row);
  }

  findDefaultForEvent(
    userId: string,
    localDate: string,
    eventExternalId: string,
    currentTime = now(),
  ): TodayPilotMeetingPrepRecord | null {
    return this.findBestForEvent(
      userId,
      localDate,
      eventExternalId,
      undefined,
      undefined,
      '',
      currentTime,
    );
  }

  findBestForEvent(
    userId: string,
    localDate: string,
    eventExternalId: string,
    eventSeriesKey?: string,
    eventTitle?: string,
    goalHash = '',
    currentTime = now(),
  ): TodayPilotMeetingPrepRecord | null {
    const exact = this.db
      .prepare(
        `SELECT *
         FROM today_meeting_preps
         WHERE user_id = ?
           AND local_date = ?
           AND event_external_id = ?
           AND goal_hash = ?
           AND expires_at > ?
           AND status IN ('ready', 'fallback')
         ORDER BY generated_at DESC
         LIMIT 1`,
      )
      .get(userId, localDate, eventExternalId, goalHash || '', currentTime) as
      | TodayMeetingPrepRow
      | undefined;
    if (exact) return this.toRecord(exact);

    if (goalHash) {
      const defaultRecord = this.findBestForEvent(
        userId,
        localDate,
        eventExternalId,
        eventSeriesKey,
        eventTitle,
        '',
        currentTime,
      );
      if (defaultRecord) return defaultRecord;
    }

    if (eventSeriesKey) {
      const series = this.db
        .prepare(
          `SELECT *
           FROM today_meeting_preps
           WHERE user_id = ?
             AND local_date = ?
             AND event_series_key = ?
             AND goal_hash = ?
             AND expires_at > ?
             AND status IN ('ready', 'fallback')
           ORDER BY generated_at DESC
           LIMIT 1`,
        )
        .get(userId, localDate, eventSeriesKey, goalHash || '', currentTime) as
        | TodayMeetingPrepRow
        | undefined;
      if (series) return this.toRecord(series);
    }

    const trimmedTitle = String(eventTitle || '').trim();
    if (trimmedTitle) {
      const title = this.db
        .prepare(
          `SELECT *
           FROM today_meeting_preps
           WHERE user_id = ?
             AND local_date = ?
             AND event_title = ?
             AND goal_hash = ?
             AND expires_at > ?
             AND status IN ('ready', 'fallback')
           ORDER BY generated_at DESC
           LIMIT 1`,
        )
        .get(userId, localDate, trimmedTitle, goalHash || '', currentTime) as
        | TodayMeetingPrepRow
        | undefined;
      if (title) return this.toRecord(title);
    }

    return null;
  }

  upsert(input: UpsertTodayPilotMeetingPrepInput): TodayPilotMeetingPrepRecord {
    const currentTime = input.generatedAt ?? now();
    const id = input.id ?? randomUUID();
    const goalHash = input.goalHash ?? '';
    this.db
      .prepare(
        `INSERT INTO today_meeting_preps (
           id, user_id, local_date, timezone, brief_id, mission_id,
           event_external_id, event_series_key, event_title, start_at,
           goal_hash, status, generated_mode, summary_md, cue_cards_json,
           questions_json, evidence_refs_json, context_pack_md, redaction_json,
           llm_usage_json, source_hash, generated_at, expires_at, error,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, local_date, event_external_id, goal_hash)
         DO UPDATE SET
           timezone = excluded.timezone,
           brief_id = excluded.brief_id,
           mission_id = excluded.mission_id,
           event_series_key = excluded.event_series_key,
           event_title = excluded.event_title,
           start_at = excluded.start_at,
           status = excluded.status,
           generated_mode = excluded.generated_mode,
           summary_md = excluded.summary_md,
           cue_cards_json = excluded.cue_cards_json,
           questions_json = excluded.questions_json,
           evidence_refs_json = excluded.evidence_refs_json,
           context_pack_md = excluded.context_pack_md,
           redaction_json = excluded.redaction_json,
           llm_usage_json = excluded.llm_usage_json,
           source_hash = excluded.source_hash,
           generated_at = excluded.generated_at,
           expires_at = excluded.expires_at,
           error = excluded.error,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.userId,
        input.localDate,
        input.timezone,
        input.briefId ?? null,
        input.missionId ?? null,
        input.eventExternalId,
        input.eventSeriesKey ?? null,
        input.eventTitle,
        input.startAt,
        goalHash,
        input.status,
        input.generatedMode,
        input.summaryMd,
        JSON.stringify(input.cueCards),
        JSON.stringify(input.questions),
        JSON.stringify(input.evidenceRefs),
        input.contextPackMd,
        JSON.stringify(input.redaction ?? {}),
        JSON.stringify(input.llmUsage ?? {}),
        input.sourceHash,
        currentTime,
        input.expiresAt,
        input.error ?? null,
        currentTime,
        currentTime,
      );

    const stored = this.db
      .prepare(
        `SELECT *
         FROM today_meeting_preps
         WHERE user_id = ? AND local_date = ? AND event_external_id = ? AND goal_hash = ?
         LIMIT 1`,
      )
      .get(input.userId, input.localDate, input.eventExternalId, goalHash) as
      | TodayMeetingPrepRow
      | undefined;
    if (!stored) {
      throw new Error('Today Pilot meeting prep was not stored');
    }
    return this.toRecord(stored);
  }

  listByDate(
    userId: string,
    localDate: string,
    currentTime = now(),
  ): TodayPilotMeetingPrepRecord[] {
    return (
      this.db
        .prepare(
          `SELECT *
           FROM today_meeting_preps
           WHERE user_id = ?
             AND local_date = ?
             AND expires_at > ?
             AND status IN ('ready', 'fallback')
           ORDER BY start_at ASC`,
        )
        .all(userId, localDate, currentTime) as TodayMeetingPrepRow[]
    ).map((row) => this.toRecord(row));
  }

  private toRecord(row: TodayMeetingPrepRow): TodayPilotMeetingPrepRecord {
    const llmUsage = safeJsonParse<Record<string, unknown>>(
      row.llm_usage_json,
      {},
    );
    const evidenceRefs = safeJsonParse<ComposerAssistEvidence[]>(
      row.evidence_refs_json,
      [],
    );
    return {
      id: row.id,
      userId: row.user_id,
      localDate: row.local_date,
      timezone: row.timezone,
      briefId: row.brief_id ?? undefined,
      missionId: row.mission_id ?? undefined,
      eventExternalId: row.event_external_id,
      eventSeriesKey: row.event_series_key ?? undefined,
      eventTitle: row.event_title,
      startAt: row.start_at,
      goalHash: row.goal_hash,
      status: row.status,
      generatedMode: row.generated_mode,
      summaryMd: row.summary_md,
      cueCards: safeJsonParse<ContextAssistCueCard[]>(row.cue_cards_json, []),
      questions: safeJsonParse<string[]>(row.questions_json, []),
      evidenceRefs,
      contextPackMd: row.context_pack_md,
      redaction: safeJsonParse<Record<string, unknown>>(row.redaction_json, {}),
      llmUsage,
      storylineOpportunity: normalizeStorylineOpportunity(
        llmUsage.storylineOpportunity,
        { evidenceRefs },
      ),
      sourceHash: row.source_hash,
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
