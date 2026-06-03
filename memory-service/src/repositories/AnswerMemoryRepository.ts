import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type AnswerMemoryThreadStatus =
  | 'active'
  | 'needs_verification'
  | 'stale'
  | 'archived';

export interface AnswerMemoryEvidenceRef {
  id: string;
  type: string;
  source?: string;
  title?: string;
  timestamp?: number;
  score?: number;
}

export interface AnswerMemoryObservationRecord {
  id: string;
  requestId?: string;
  canonicalKey: string;
  canonicalQuestion: string;
  topicLabel: string;
  topicId?: string;
  intent: string;
  queryHash: string;
  answerHash: string;
  evidenceHash?: string;
  evidenceRefs: AnswerMemoryEvidenceRef[];
  contextMatch: Record<string, unknown>;
  recallDiagnostics: unknown[];
  promotedThreadId?: string;
  createdAt: number;
}

export interface AnswerMemoryThreadRecord {
  id: string;
  canonicalKey: string;
  canonicalQuestion: string;
  aliases: string[];
  topicLabel: string;
  topicId?: string;
  intent: string;
  status: AnswerMemoryThreadStatus;
  askCount: number;
  confidence: number;
  currentVersionId?: string;
  evidenceHash?: string;
  unknowns: string[];
  changeConditions: string[];
  lastAskedAt?: number;
  lastVerifiedAt?: number;
  staleAfter?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnswerMemoryVersionRecord {
  id: string;
  threadId: string;
  answerMd: string;
  stance: string;
  confidence: number;
  evidenceRefs: AnswerMemoryEvidenceRef[];
  missingEvidence: string[];
  recallDiagnostics: unknown[];
  answerHash: string;
  evidenceHash?: string;
  createdAt: number;
}

interface ObservationRow {
  id: string;
  request_id: string | null;
  canonical_key: string;
  canonical_question: string;
  topic_label: string;
  topic_id: string | null;
  intent: string;
  query_hash: string;
  answer_hash: string;
  evidence_hash: string | null;
  evidence_refs_json: string | null;
  context_match_json: string | null;
  recall_diagnostics_json: string | null;
  promoted_thread_id: string | null;
  created_at: number;
}

interface ThreadRow {
  id: string;
  canonical_key: string;
  canonical_question: string;
  aliases_json: string | null;
  topic_label: string;
  topic_id: string | null;
  intent: string;
  status: AnswerMemoryThreadStatus | null;
  ask_count: number | null;
  confidence: number | null;
  current_version_id: string | null;
  evidence_hash: string | null;
  unknowns_json: string | null;
  change_conditions_json: string | null;
  last_asked_at: number | null;
  last_verified_at: number | null;
  stale_after: number | null;
  created_at: number;
  updated_at: number;
}

interface VersionRow {
  id: string;
  thread_id: string;
  answer_md: string;
  stance: string | null;
  confidence: number | null;
  evidence_refs_json: string | null;
  missing_evidence_json: string | null;
  recall_diagnostics_json: string | null;
  answer_hash: string;
  evidence_hash: string | null;
  created_at: number;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  );
}

export class AnswerMemoryRepository {
  constructor(private readonly db: Database.Database) {}

  createObservation(input: {
    id?: string;
    requestId?: string;
    canonicalKey: string;
    canonicalQuestion: string;
    topicLabel: string;
    topicId?: string;
    intent: string;
    queryHash: string;
    answerHash: string;
    evidenceHash?: string;
    evidenceRefs: AnswerMemoryEvidenceRef[];
    contextMatch?: Record<string, unknown>;
    recallDiagnostics?: unknown[];
    createdAt?: number;
  }): AnswerMemoryObservationRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO answer_memory_observations
          (id, request_id, canonical_key, canonical_question, topic_label,
           topic_id, intent, query_hash, answer_hash, evidence_hash,
           evidence_refs_json, context_match_json, recall_diagnostics_json,
           created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.requestId ?? null,
        input.canonicalKey,
        input.canonicalQuestion,
        input.topicLabel,
        input.topicId ?? null,
        input.intent,
        input.queryHash,
        input.answerHash,
        input.evidenceHash ?? null,
        json(input.evidenceRefs),
        json(input.contextMatch ?? {}),
        json(input.recallDiagnostics ?? []),
        createdAt,
      );
    return this.getObservationById(id)!;
  }

  listRecentObservations(
    canonicalKey: string,
    windowStart: number,
  ): AnswerMemoryObservationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM answer_memory_observations
         WHERE canonical_key = ?
           AND created_at >= ?
         ORDER BY created_at DESC`,
      )
      .all(canonicalKey, windowStart) as ObservationRow[];
    return rows.map((row) => this.rowToObservation(row));
  }

  getObservationById(id: string): AnswerMemoryObservationRecord | null {
    const row = this.db
      .prepare('SELECT * FROM answer_memory_observations WHERE id = ?')
      .get(id) as ObservationRow | undefined;
    return row ? this.rowToObservation(row) : null;
  }

  markObservationsPromoted(
    canonicalKey: string,
    threadId: string,
  ): { changed: number } {
    const result = this.db
      .prepare(
        `UPDATE answer_memory_observations
         SET promoted_thread_id = ?
         WHERE canonical_key = ?
           AND promoted_thread_id IS NULL`,
      )
      .run(threadId, canonicalKey);
    return { changed: result.changes };
  }

  getThreadByCanonicalKey(
    canonicalKey: string,
  ): AnswerMemoryThreadRecord | null {
    const row = this.db
      .prepare('SELECT * FROM answer_memory_threads WHERE canonical_key = ?')
      .get(canonicalKey) as ThreadRow | undefined;
    return row ? this.rowToThread(row) : null;
  }

  getThreadById(id: string): AnswerMemoryThreadRecord | null {
    const row = this.db
      .prepare('SELECT * FROM answer_memory_threads WHERE id = ?')
      .get(id) as ThreadRow | undefined;
    return row ? this.rowToThread(row) : null;
  }

  createThread(input: {
    id?: string;
    canonicalKey: string;
    canonicalQuestion: string;
    aliases?: string[];
    topicLabel: string;
    topicId?: string;
    intent: string;
    status?: AnswerMemoryThreadStatus;
    askCount?: number;
    confidence?: number;
    evidenceHash?: string;
    unknowns?: string[];
    changeConditions?: string[];
    lastAskedAt?: number;
    lastVerifiedAt?: number;
    staleAfter?: number;
    createdAt?: number;
    updatedAt?: number;
  }): AnswerMemoryThreadRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    const updatedAt = input.updatedAt ?? createdAt;
    this.db
      .prepare(
        `INSERT INTO answer_memory_threads
          (id, canonical_key, canonical_question, aliases_json, topic_label,
           topic_id, intent, status, ask_count, confidence, evidence_hash,
           unknowns_json, change_conditions_json, last_asked_at,
           last_verified_at, stale_after, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.canonicalKey,
        input.canonicalQuestion,
        json(uniqStrings(input.aliases ?? [])),
        input.topicLabel,
        input.topicId ?? null,
        input.intent,
        input.status ?? 'active',
        input.askCount ?? 0,
        input.confidence ?? 0,
        input.evidenceHash ?? null,
        json(uniqStrings(input.unknowns ?? [])),
        json(uniqStrings(input.changeConditions ?? [])),
        input.lastAskedAt ?? null,
        input.lastVerifiedAt ?? null,
        input.staleAfter ?? null,
        createdAt,
        updatedAt,
      );
    return this.getThreadById(id)!;
  }

  incrementThreadAskCount(threadId: string, askedAt = now()): void {
    this.db
      .prepare(
        `UPDATE answer_memory_threads
         SET ask_count = ask_count + 1,
             last_asked_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(askedAt, askedAt, threadId);
  }

  updateThreadCurrentVersion(input: {
    threadId: string;
    versionId: string;
    status: AnswerMemoryThreadStatus;
    confidence: number;
    evidenceHash?: string;
    unknowns: string[];
    changeConditions: string[];
    lastAskedAt?: number;
    lastVerifiedAt?: number;
    staleAfter?: number;
    updatedAt?: number;
  }): AnswerMemoryThreadRecord | null {
    const updatedAt = input.updatedAt ?? now();
    this.db
      .prepare(
        `UPDATE answer_memory_threads
         SET current_version_id = ?,
             status = ?,
             confidence = ?,
             evidence_hash = ?,
             unknowns_json = ?,
             change_conditions_json = ?,
             last_asked_at = COALESCE(?, last_asked_at),
             last_verified_at = COALESCE(?, last_verified_at),
             stale_after = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.versionId,
        input.status,
        input.confidence,
        input.evidenceHash ?? null,
        json(uniqStrings(input.unknowns)),
        json(uniqStrings(input.changeConditions)),
        input.lastAskedAt ?? null,
        input.lastVerifiedAt ?? null,
        input.staleAfter ?? null,
        updatedAt,
        input.threadId,
      );
    return this.getThreadById(input.threadId);
  }

  createVersion(input: {
    id?: string;
    threadId: string;
    answerMd: string;
    stance: string;
    confidence?: number;
    evidenceRefs: AnswerMemoryEvidenceRef[];
    missingEvidence?: string[];
    recallDiagnostics?: unknown[];
    answerHash: string;
    evidenceHash?: string;
    createdAt?: number;
  }): AnswerMemoryVersionRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO answer_memory_versions
          (id, thread_id, answer_md, stance, confidence, evidence_refs_json,
           missing_evidence_json, recall_diagnostics_json, answer_hash,
           evidence_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.threadId,
        input.answerMd,
        input.stance,
        input.confidence ?? 0,
        json(input.evidenceRefs),
        json(uniqStrings(input.missingEvidence ?? [])),
        json(input.recallDiagnostics ?? []),
        input.answerHash,
        input.evidenceHash ?? null,
        createdAt,
      );
    return this.getVersionById(id)!;
  }

  getVersionById(id: string): AnswerMemoryVersionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM answer_memory_versions WHERE id = ?')
      .get(id) as VersionRow | undefined;
    return row ? this.rowToVersion(row) : null;
  }

  countVersions(threadId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM answer_memory_versions
         WHERE thread_id = ?`,
      )
      .get(threadId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  private rowToObservation(row: ObservationRow): AnswerMemoryObservationRecord {
    return {
      id: row.id,
      requestId: row.request_id ?? undefined,
      canonicalKey: row.canonical_key,
      canonicalQuestion: row.canonical_question,
      topicLabel: row.topic_label,
      topicId: row.topic_id ?? undefined,
      intent: row.intent,
      queryHash: row.query_hash,
      answerHash: row.answer_hash,
      evidenceHash: row.evidence_hash ?? undefined,
      evidenceRefs: safeJsonParse<AnswerMemoryEvidenceRef[]>(
        row.evidence_refs_json,
        [],
      ),
      contextMatch: safeJsonParse<Record<string, unknown>>(
        row.context_match_json,
        {},
      ),
      recallDiagnostics: safeJsonParse<unknown[]>(
        row.recall_diagnostics_json,
        [],
      ),
      promotedThreadId: row.promoted_thread_id ?? undefined,
      createdAt: row.created_at,
    };
  }

  private rowToThread(row: ThreadRow): AnswerMemoryThreadRecord {
    return {
      id: row.id,
      canonicalKey: row.canonical_key,
      canonicalQuestion: row.canonical_question,
      aliases: safeJsonParse<string[]>(row.aliases_json, []),
      topicLabel: row.topic_label,
      topicId: row.topic_id ?? undefined,
      intent: row.intent,
      status: row.status ?? 'active',
      askCount: row.ask_count ?? 0,
      confidence: row.confidence ?? 0,
      currentVersionId: row.current_version_id ?? undefined,
      evidenceHash: row.evidence_hash ?? undefined,
      unknowns: safeJsonParse<string[]>(row.unknowns_json, []),
      changeConditions: safeJsonParse<string[]>(
        row.change_conditions_json,
        [],
      ),
      lastAskedAt: row.last_asked_at ?? undefined,
      lastVerifiedAt: row.last_verified_at ?? undefined,
      staleAfter: row.stale_after ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToVersion(row: VersionRow): AnswerMemoryVersionRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      answerMd: row.answer_md,
      stance: row.stance ?? 'unknown',
      confidence: row.confidence ?? 0,
      evidenceRefs: safeJsonParse<AnswerMemoryEvidenceRef[]>(
        row.evidence_refs_json,
        [],
      ),
      missingEvidence: safeJsonParse<string[]>(
        row.missing_evidence_json,
        [],
      ),
      recallDiagnostics: safeJsonParse<unknown[]>(
        row.recall_diagnostics_json,
        [],
      ),
      answerHash: row.answer_hash,
      evidenceHash: row.evidence_hash ?? undefined,
      createdAt: row.created_at,
    };
  }
}
