import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type ActionQueueStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

export interface QueuedActionRecord {
  id: string;
  type: string;
  actionType: string;
  title: string;
  description?: string;
  params: Record<string, unknown>;
  riskLevel: string;
  confidence: number;
  evidenceRefs: string[];
  requiresApproval: boolean;
  state: string;
  approvedAt?: number;
  executedAt?: number;
  source?: string;
  expiresAt?: number;
  createdAt: number;
  threadId?: string;
  runId?: string;
  executionMode: 'manual' | 'auto';
  priority: number;
  idempotencyKey?: string;
  dependsOn: string[];
  scheduledAt?: number;
  startedAt?: number;
  finishedAt?: number;
  retryCount: number;
  lastError?: string;
  result?: Record<string, unknown>;
  sourceKind?: string;
  sourceRefId?: string;
  queueStatus: ActionQueueStatus;
  utilityScore?: number;
  urgencyScore?: number;
}

interface ActionRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  params_json: string | null;
  risk_level: string | null;
  confidence: number | null;
  evidence_refs_json: string | null;
  requires_approval: number;
  state: string;
  approved_at: number | null;
  executed_at: number | null;
  source: string | null;
  expires_at: number | null;
  created_at: number;
  thread_id: string | null;
  run_id: string | null;
  action_type: string | null;
  execution_mode: 'manual' | 'auto' | null;
  priority: number | null;
  idempotency_key: string | null;
  depends_on_json: string | null;
  scheduled_at: number | null;
  started_at: number | null;
  finished_at: number | null;
  retry_count: number | null;
  last_error: string | null;
  result_json: string | null;
  source_kind: string | null;
  source_ref_id: string | null;
  queue_status: ActionQueueStatus | null;
  utility_score: number | null;
  urgency_score: number | null;
}

interface CountRow {
  count: number;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clampPriority(priority: number | undefined): number {
  if (!Number.isFinite(priority)) return 5;
  return Math.max(1, Math.min(Math.round(priority!), 10));
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

export interface CreateQueuedActionInput {
  id?: string;
  actionType: string;
  title: string;
  description?: string;
  params?: Record<string, unknown>;
  riskLevel?: string;
  confidence?: number;
  evidenceRefs?: string[];
  requiresApproval?: boolean;
  state?: string;
  source?: string;
  expiresAt?: number;
  createdAt?: number;
  threadId?: string;
  runId?: string;
  executionMode?: 'manual' | 'auto';
  priority?: number;
  idempotencyKey?: string;
  dependsOn?: string[];
  scheduledAt?: number;
  sourceKind?: string;
  sourceRefId?: string;
  queueStatus?: ActionQueueStatus;
  utilityScore?: number;
  urgencyScore?: number;
}

export interface ActionListFilters {
  queueStatus?: ActionQueueStatus | 'all';
  executionMode?: 'manual' | 'auto';
  threadId?: string;
  actionType?: string;
  limit?: number;
  offset?: number;
}

export class ActionRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToAction(row: ActionRow): QueuedActionRecord {
    return {
      id: row.id,
      type: row.type,
      actionType: row.action_type ?? row.type,
      title: row.title,
      description: row.description ?? undefined,
      params: safeJsonParse<Record<string, unknown>>(row.params_json, {}),
      riskLevel: row.risk_level ?? 'low',
      confidence: row.confidence ?? 0.5,
      evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
      requiresApproval: row.requires_approval === 1,
      state: row.state,
      approvedAt: row.approved_at ?? undefined,
      executedAt: row.executed_at ?? undefined,
      source: row.source ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      createdAt: row.created_at,
      threadId: row.thread_id ?? undefined,
      runId: row.run_id ?? undefined,
      executionMode: row.execution_mode ?? 'manual',
      priority: row.priority ?? 5,
      idempotencyKey: row.idempotency_key ?? undefined,
      dependsOn: safeJsonParse<string[]>(row.depends_on_json, []),
      scheduledAt: row.scheduled_at ?? undefined,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      retryCount: row.retry_count ?? 0,
      lastError: row.last_error ?? undefined,
      result: safeJsonParse<Record<string, unknown> | undefined>(row.result_json, undefined),
      sourceKind: row.source_kind ?? undefined,
      sourceRefId: row.source_ref_id ?? undefined,
      queueStatus: row.queue_status ?? 'queued',
      utilityScore: row.utility_score ?? undefined,
      urgencyScore: row.urgency_score ?? undefined,
    };
  }

  create(input: CreateQueuedActionInput): QueuedActionRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();

    this.db
      .prepare(
        `INSERT INTO proposed_actions
          (id, type, title, description, params_json, risk_level, confidence, evidence_refs_json,
           requires_approval, state, source, expires_at, created_at, thread_id, run_id,
           action_type, execution_mode, priority, idempotency_key, depends_on_json,
           scheduled_at, source_kind, source_ref_id, queue_status, utility_score, urgency_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.actionType,
        input.title,
        input.description ?? null,
        JSON.stringify(input.params ?? {}),
        input.riskLevel ?? 'low',
        input.confidence ?? 0.5,
        JSON.stringify(uniqStrings(input.evidenceRefs ?? [])),
        input.requiresApproval ? 1 : 0,
        input.state ?? 'pending',
        input.source ?? null,
        input.expiresAt ?? null,
        createdAt,
        input.threadId ?? null,
        input.runId ?? null,
        input.actionType,
        input.executionMode ?? 'manual',
        clampPriority(input.priority),
        input.idempotencyKey ?? null,
        JSON.stringify(uniqStrings(input.dependsOn ?? [])),
        input.scheduledAt ?? null,
        input.sourceKind ?? null,
        input.sourceRefId ?? null,
        input.queueStatus ?? 'queued',
        input.utilityScore ?? null,
        input.urgencyScore ?? null,
      );

    return this.getById(id)!;
  }

  list(filters: ActionListFilters = {}): {
    items: QueuedActionRecord[];
    total: number;
    limit: number;
    offset: number;
  } {
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.queueStatus && filters.queueStatus !== 'all') {
      conditions.push('queue_status = ?');
      params.push(filters.queueStatus);
    }
    if (filters.executionMode) {
      conditions.push('execution_mode = ?');
      params.push(filters.executionMode);
    }
    if (filters.threadId) {
      conditions.push('thread_id = ?');
      params.push(filters.threadId);
    }
    if (filters.actionType) {
      conditions.push('(action_type = ? OR type = ?)');
      params.push(filters.actionType, filters.actionType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         ${whereClause}
         ORDER BY
           CASE queue_status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END ASC,
           priority DESC,
           created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as ActionRow[];

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM proposed_actions ${whereClause}`)
        .get(...params) as CountRow
    ).count;

    return {
      items: rows.map((row) => this.rowToAction(row)),
      total,
      limit,
      offset,
    };
  }

  listDueAutoActions(limit: number, currentTime = now()): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE queue_status = 'queued'
           AND execution_mode = 'auto'
           AND (scheduled_at IS NULL OR scheduled_at <= ?)
         ORDER BY priority DESC, COALESCE(scheduled_at, created_at) ASC
         LIMIT ?`,
      )
      .all(currentTime, Math.max(1, limit)) as ActionRow[];

    return rows.map((row) => this.rowToAction(row));
  }

  getById(id: string): QueuedActionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM proposed_actions WHERE id = ?')
      .get(id) as ActionRow | undefined;
    return row ? this.rowToAction(row) : null;
  }

  markRunning(id: string): string {
    const attemptId = randomUUID();
    const currentTime = now();

    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'running',
             started_at = ?
         WHERE id = ?`,
      )
      .run(currentTime, id);

    this.db
      .prepare(
        `INSERT INTO proposed_action_attempts
          (id, action_id, status, started_at)
         VALUES (?, ?, 'running', ?)`,
      )
      .run(attemptId, id, currentTime);

    return attemptId;
  }

  markSucceeded(id: string, attemptId: string, result?: Record<string, unknown>): QueuedActionRecord | null {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'succeeded',
             state = 'executed',
             executed_at = ?,
             finished_at = ?,
             result_json = ?,
             last_error = NULL
         WHERE id = ?`,
      )
      .run(currentTime, currentTime, result ? JSON.stringify(result) : null, id);

    this.db
      .prepare(
        `UPDATE proposed_action_attempts
         SET status = 'succeeded',
             result_json = ?,
             finished_at = ?
         WHERE id = ?`,
      )
      .run(result ? JSON.stringify(result) : null, currentTime, attemptId);

    return this.getById(id);
  }

  markFailed(
    id: string,
    attemptId: string,
    errorMessage: string,
    deadLetter = false,
  ): QueuedActionRecord | null {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = ?,
             state = ?,
             retry_count = retry_count + 1,
             finished_at = ?,
             last_error = ?
         WHERE id = ?`,
      )
      .run(deadLetter ? 'dead_letter' : 'failed', deadLetter ? 'expired' : 'pending', currentTime, errorMessage, id);

    this.db
      .prepare(
        `UPDATE proposed_action_attempts
         SET status = ?,
             error_message = ?,
             finished_at = ?
         WHERE id = ?`,
      )
      .run(deadLetter ? 'dead_letter' : 'failed', errorMessage, currentTime, attemptId);

    return this.getById(id);
  }

  retry(id: string, scheduledAt = now()): QueuedActionRecord | null {
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'queued',
             state = 'pending',
             scheduled_at = ?,
             started_at = NULL,
             finished_at = NULL,
             last_error = NULL
         WHERE id = ?`,
      )
      .run(scheduledAt, id);

    return this.getById(id);
  }

  cancel(id: string, reason?: string): QueuedActionRecord | null {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'cancelled',
             state = 'dismissed',
             finished_at = ?,
             last_error = ?
         WHERE id = ?`,
      )
      .run(currentTime, reason ?? null, id);

    return this.getById(id);
  }
}
