import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type ActionQueueStatus =
  | 'queued'
  | 'awaiting_claim'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'dead_letter'
  | 'input_required';

/**
 * Which scheduler owns a task's trigger.
 * - memory_cron: this service's due-scan runs it.
 * - jira_sheet: a mirrored Sheet row is picked up by Jira Automation instead,
 *   so the due-scan must skip it even though the row lives in this ledger.
 */
export const TASK_LANES = ['memory_cron', 'jira_sheet'] as const;
export type TaskLane = (typeof TASK_LANES)[number];

export const TASK_KINDS = ['push', 'agent', 'remind', 'dev', 'reflection', 'outreach'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Rows predating Task Center have no lane; they were always locally scheduled. */
export function normalizeTaskLane(value: unknown): TaskLane | undefined {
  return TASK_LANES.includes(value as TaskLane) ? (value as TaskLane) : undefined;
}

export function normalizeTaskKind(value: unknown): TaskKind | undefined {
  return TASK_KINDS.includes(value as TaskKind) ? (value as TaskKind) : undefined;
}

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
  targetWorkerId?: string;
  /** Task Center: subtask tree parent. */
  parentActionId?: string;
  /** Task Center: scheduleSpec for the next occurrence; absent = one-shot. */
  recurrenceSpec?: Record<string, unknown>;
  /** Task Center: which scheduler owns the trigger. Absent rows behave as memory_cron. */
  lane?: TaskLane;
  /** Task Center: which editor/semantics this row uses. */
  taskKind?: TaskKind;
  /** Task Center: mirrored Sheet row for lane='jira_sheet'. */
  mirrorRef?: Record<string, unknown>;
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
  target_worker_id?: string | null;
  parent_action_id?: string | null;
  recurrence_spec?: string | null;
  lane?: string | null;
  task_kind?: string | null;
  mirror_ref_json?: string | null;
}

interface CountRow {
  count: number;
}

/** Extra slack on top of an action's own `params.timeoutMs` before reclaiming it. */
const STALE_RUNNING_OWN_TIMEOUT_GRACE_SECONDS = 120;

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
  parentActionId?: string;
  recurrenceSpec?: Record<string, unknown>;
  lane?: TaskLane;
  taskKind?: TaskKind;
  mirrorRef?: Record<string, unknown>;
}

export interface ActionListFilters {
  actionId?: string;
  queueStatus?: ActionQueueStatus | 'all';
  executionMode?: 'manual' | 'auto';
  threadId?: string;
  actionType?: string;
  sourceKind?: string;
  sourceRefId?: string;
  lane?: TaskLane;
  taskKind?: TaskKind;
  parentActionId?: string;
  limit?: number;
  offset?: number;
}

export interface RecoverStaleRunningActionsOptions {
  actionType: string;
  staleAfterSeconds: number;
  currentTime?: number;
  errorMessage?: string;
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
      targetWorkerId: row.target_worker_id ?? undefined,
      parentActionId: row.parent_action_id ?? undefined,
      recurrenceSpec: safeJsonParse<Record<string, unknown> | undefined>(
        row.recurrence_spec ?? null,
        undefined,
      ),
      lane: normalizeTaskLane(row.lane),
      taskKind: normalizeTaskKind(row.task_kind),
      mirrorRef: safeJsonParse<Record<string, unknown> | undefined>(
        row.mirror_ref_json ?? null,
        undefined,
      ),
    };
  }

  create(input: CreateQueuedActionInput): QueuedActionRecord {
    if (input.idempotencyKey) {
      const existing = this.findReusableByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();

    try {
      this.db
        .prepare(
          `INSERT INTO proposed_actions
            (id, type, title, description, params_json, risk_level, confidence, evidence_refs_json,
             requires_approval, state, source, expires_at, created_at, thread_id, run_id,
             action_type, execution_mode, priority, idempotency_key, depends_on_json,
             scheduled_at, source_kind, source_ref_id, queue_status, utility_score, urgency_score,
             parent_action_id, recurrence_spec, lane, task_kind, mirror_ref_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          input.parentActionId ?? null,
          input.recurrenceSpec ? JSON.stringify(input.recurrenceSpec) : null,
          input.lane ?? null,
          input.taskKind ?? null,
          input.mirrorRef ? JSON.stringify(input.mirrorRef) : null,
        );
    } catch (error) {
      // UNIQUE idempotency race: another insert won; reuse that row.
      if (input.idempotencyKey) {
        const raced = this.findReusableByIdempotencyKey(input.idempotencyKey);
        if (raced) return raced;
      }
      throw error;
    }

    return this.getById(id)!;
  }

  findReusableByIdempotencyKey(
    idempotencyKey: string,
  ): QueuedActionRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE idempotency_key = ?
           AND queue_status IN ('queued', 'running', 'failed', 'succeeded', 'dead_letter')
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(idempotencyKey) as ActionRow | undefined;
    return row ? this.rowToAction(row) : null;
  }

  linkActionsToThread(
    actionIds: string[],
    threadId: string,
    idempotencyKey?: string,
  ): number {
    const ids = uniqStrings(actionIds);
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const result = this.db
      .prepare(
        `UPDATE proposed_actions
         SET thread_id = COALESCE(thread_id, ?),
             idempotency_key = COALESCE(idempotency_key, ?)
         WHERE id IN (${placeholders})`,
      )
      .run(threadId, idempotencyKey ?? null, ...ids);
    return result.changes;
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

    if (filters.actionId) {
      conditions.push('id = ?');
      params.push(filters.actionId);
    }
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
    if (filters.sourceKind) {
      conditions.push('source_kind = ?');
      params.push(filters.sourceKind);
    }
    if (filters.sourceRefId) {
      conditions.push('source_ref_id = ?');
      params.push(filters.sourceRefId);
    }

    // Task Center filters. These were declared on ActionListFilters when the
    // columns landed but never reached the SQL, so callers got an unfiltered
    // list back and had to re-filter client-side (or silently didn't).
    if (filters.lane) {
      conditions.push('lane = ?');
      params.push(filters.lane);
    }

    if (filters.taskKind) {
      conditions.push('task_kind = ?');
      params.push(filters.taskKind);
    }

    if (filters.parentActionId) {
      conditions.push('parent_action_id = ?');
      params.push(filters.parentActionId);
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

  /**
   * Latest action per source_ref_id for a source_kind (e.g. agent_task ledger overlay).
   * Orders by finished/started/created descending, then keeps the first hit per ref.
   */
  listLatestBySourceRefs(input: {
    sourceKind: string;
    sourceRefIds: string[];
    limitPerRef?: number;
  }): QueuedActionRecord[] {
    const sourceRefIds = Array.from(
      new Set(
        input.sourceRefIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter(Boolean),
      ),
    );
    if (sourceRefIds.length === 0) {
      return [];
    }

    const placeholders = sourceRefIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE source_kind = ?
           AND source_ref_id IN (${placeholders})
         ORDER BY COALESCE(finished_at, started_at, created_at) DESC, created_at DESC`,
      )
      .all(input.sourceKind, ...sourceRefIds) as ActionRow[];

    const limitPerRef = Math.max(1, Math.min(input.limitPerRef ?? 1, 5));
    const counts = new Map<string, number>();
    const selected: QueuedActionRecord[] = [];
    for (const row of rows) {
      const refId = row.source_ref_id || '';
      if (!refId) continue;
      const seen = counts.get(refId) || 0;
      if (seen >= limitPerRef) continue;
      counts.set(refId, seen + 1);
      selected.push(this.rowToAction(row));
    }
    return selected;
  }

  listDueAutoActions(limit: number, currentTime = now()): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE queue_status = 'queued'
           AND execution_mode = 'auto'
           AND requires_approval = 0
           AND (scheduled_at IS NULL OR scheduled_at <= ?)
           -- Task Center: jira_sheet rows are triggered by Jira Automation via a
           -- mirrored Sheet row. They live in this ledger for reporting only, so
           -- the local due-scan must not also run them (double execution).
           AND (lane IS NULL OR lane <> 'jira_sheet')
           -- Task Center: hold a task until every dependency has succeeded.
           -- depends_on_json has been persisted since migration 005 but had no
           -- consumer; a dependency that is cancelled or dead_letter blocks
           -- forever on purpose, so a broken chain surfaces instead of running
           -- downstream work against a missing prerequisite.
           AND NOT EXISTS (
             SELECT 1
             FROM json_each(COALESCE(proposed_actions.depends_on_json, '[]')) AS dep
             LEFT JOIN proposed_actions AS dep_action
               ON dep_action.id = dep.value
             WHERE dep_action.id IS NULL
                OR dep_action.queue_status <> 'succeeded'
           )
           AND NOT EXISTS (
             SELECT 1
             FROM action_readiness_links readiness_links
             JOIN action_readiness_contracts readiness_contracts
               ON readiness_contracts.id = readiness_links.contract_id
             WHERE readiness_links.source_kind = 'proposed_action'
               AND readiness_links.source_ref_id = proposed_actions.id
               AND readiness_links.link_reason = 'blocked_by_readiness'
               AND readiness_contracts.status IN (
                 'blocked_auth',
                 'blocked_capability',
                 'blocked_input',
                 'blocked_proof'
               )
               AND (
                 readiness_contracts.expires_at IS NULL
                 OR readiness_contracts.expires_at > ?
               )
           )
         ORDER BY priority DESC, COALESCE(scheduled_at, created_at) ASC
         LIMIT ?`,
      )
      .all(currentTime, currentTime, Math.max(1, limit)) as ActionRow[];

    return rows.map((row) => this.rowToAction(row));
  }

  /**
   * Recurring tasks whose current occurrence has reached a terminal state and
   * that have not yet produced a successor.
   *
   * Rollover is driven by a scan rather than hooked into markSucceeded, because
   * an occurrence can reach a terminal state through paths that never call it:
   * cancel(), recoverStaleRunningActions(), and the worker report path all end
   * runs on their own. A scan sees every one of them, and re-running it is
   * harmless (see markRecurrenceRolledOver).
   */
  listRecurringActionsPendingRollover(limit = 20): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE recurrence_spec IS NOT NULL
           AND queue_status IN ('succeeded', 'failed', 'dead_letter', 'cancelled')
           AND json_extract(recurrence_spec, '$.rolledOverAt') IS NULL
         ORDER BY COALESCE(finished_at, created_at) ASC
         LIMIT ?`,
      )
      .all(Math.max(1, limit)) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  /**
   * Stamp an occurrence as rolled over so the scan stops returning it.
   * `nextActionId` is null when the series ended (endDate passed or repeatCount
   * reached) — the stamp still goes on, which is what stops the series.
   */
  markRecurrenceRolledOver(
    id: string,
    nextActionId: string | null,
    currentTime = now(),
  ): void {
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET recurrence_spec = json_set(
               json_set(COALESCE(recurrence_spec, '{}'), '$.rolledOverAt', ?),
               '$.nextActionId', ?
             )
         WHERE id = ?`,
      )
      .run(currentTime, nextActionId, id);
  }

  /** Children of a parent task, for aggregation and for the Task Center tree. */
  listChildren(parentActionId: string): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM proposed_actions
         WHERE parent_action_id = ?
         ORDER BY created_at ASC`,
      )
      .all(parentActionId) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  /**
   * Parents that are still open while every child has succeeded.
   *
   * Like rollover this is a scan: children finish through several code paths,
   * and a parent with zero children must never auto-complete (that would
   * complete a task nobody ran), hence the EXISTS guard.
   */
  listParentsReadyToComplete(limit = 20): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT parent.*
         FROM proposed_actions parent
         WHERE parent.queue_status IN ('queued', 'running', 'input_required', 'awaiting_claim')
           AND EXISTS (
             SELECT 1 FROM proposed_actions child
             WHERE child.parent_action_id = parent.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM proposed_actions child
             WHERE child.parent_action_id = parent.id
               AND child.queue_status <> 'succeeded'
           )
         ORDER BY parent.created_at ASC
         LIMIT ?`,
      )
      .all(Math.max(1, limit)) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  /** Complete a parent whose children all succeeded. No attempt row: it never ran itself. */
  markParentCompleted(id: string, result?: Record<string, unknown>): QueuedActionRecord | null {
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
    return this.getById(id);
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

  markApproved(id: string, approvedAt = now()): QueuedActionRecord | null {
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET state = 'approved',
             approved_at = ?
         WHERE id = ?
           AND requires_approval = 1
           AND approved_at IS NULL`,
      )
      .run(approvedAt, id);

    return this.getById(id);
  }

  /**
   * Merge keys into params.metadata without touching the rest of params.
   * Used to persist notifyDeliveryError after a run already reached a terminal
   * queue status — delivery is independent of execution, so it must not go
   * through markFailed / last_error.
   */
  patchParamsMetadata(
    id: string,
    patch: Record<string, unknown>,
  ): QueuedActionRecord | null {
    const current = this.getById(id);
    if (!current) return null;
    const params =
      current.params && typeof current.params === 'object' && !Array.isArray(current.params)
        ? { ...current.params }
        : {};
    const metadata =
      params.metadata && typeof params.metadata === 'object' && !Array.isArray(params.metadata)
        ? { ...(params.metadata as Record<string, unknown>) }
        : {};
    params.metadata = { ...metadata, ...patch };
    this.db
      .prepare(`UPDATE proposed_actions SET params_json = ? WHERE id = ?`)
      .run(JSON.stringify(params), id);
    return this.getById(id);
  }

  patchRunningResult(
    id: string,
    patch: Record<string, unknown>,
  ): QueuedActionRecord | null {
    const current = this.getById(id);
    if (!current) return null;
    const merged = {
      ...(current.result && typeof current.result === 'object'
        ? current.result
        : {}),
      ...patch,
    };
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET result_json = ?
         WHERE id = ?
           AND queue_status = 'running'`,
      )
      .run(JSON.stringify(merged), id);
    return this.getById(id);
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
    result?: Record<string, unknown>,
  ): QueuedActionRecord | null {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = ?,
             state = ?,
             retry_count = retry_count + 1,
             finished_at = ?,
             last_error = ?,
             result_json = ?
         WHERE id = ?`,
      )
      .run(
        deadLetter ? 'dead_letter' : 'failed',
        deadLetter ? 'expired' : 'pending',
        currentTime,
        errorMessage,
        result ? JSON.stringify(result) : null,
        id,
      );

    this.db
      .prepare(
        `UPDATE proposed_action_attempts
         SET status = ?,
             error_message = ?,
             result_json = ?,
             finished_at = ?
         WHERE id = ?`,
      )
      .run(
        deadLetter ? 'dead_letter' : 'failed',
        errorMessage,
        result ? JSON.stringify(result) : null,
        currentTime,
        attemptId,
      );

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
             last_error = NULL,
             result_json = NULL
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

  recoverStaleRunningActions(
    options: RecoverStaleRunningActionsOptions,
  ): QueuedActionRecord[] {
    const currentTime = options.currentTime ?? now();
    const staleAfterSeconds = Math.max(
      1,
      Math.floor(options.staleAfterSeconds),
    );
    const cutoff = currentTime - staleAfterSeconds;
    const errorMessage =
      options.errorMessage ??
      `Action execution exceeded stale running timeout (${staleAfterSeconds}s). External side effects may have completed; review before retrying.`;
    const candidates = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE queue_status = 'running'
           AND (action_type = ? OR type = ?)
           AND started_at IS NOT NULL
           AND started_at <= ?
         ORDER BY started_at ASC`,
      )
      .all(options.actionType, options.actionType, cutoff) as ActionRow[];

    // A caller may ask for a longer wait than the global OpenClaw timeout
    // (e.g. Roadmap batch create passes timeoutMs=30min). Reclaiming such a run
    // at the global cutoff would dead-letter work that is still legitimately
    // in flight, so each action's own timeoutMs raises its personal cutoff.
    const rows = candidates.filter((row) => {
      const params = safeJsonParse<Record<string, unknown>>(row.params_json, {});
      const ownTimeoutMs = Number(params.timeoutMs);
      if (!Number.isFinite(ownTimeoutMs) || ownTimeoutMs <= 0) return true;
      const effective = Math.max(
        staleAfterSeconds,
        Math.ceil(ownTimeoutMs / 1000) + STALE_RUNNING_OWN_TIMEOUT_GRACE_SECONDS,
      );
      return (row.started_at ?? 0) <= currentTime - effective;
    });

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'dead_letter',
             state = 'expired',
             finished_at = ?,
             last_error = ?,
             retry_count = retry_count + 1
         WHERE id IN (${placeholders})
           AND queue_status = 'running'`,
      )
      .run(currentTime, errorMessage, ...ids);

    this.db
      .prepare(
        `UPDATE proposed_action_attempts
         SET status = 'dead_letter',
             error_message = ?,
             finished_at = ?
         WHERE action_id IN (${placeholders})
           AND status = 'running'`,
      )
      .run(errorMessage, currentTime, ...ids);

    return ids
      .map((id) => this.getById(id))
      .filter((action): action is QueuedActionRecord => Boolean(action));
  }

  listAwaitingClaim(workerId: string, limit: number): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE queue_status = 'awaiting_claim'
           AND target_worker_id = ?
         ORDER BY priority DESC, COALESCE(scheduled_at, created_at) ASC
         LIMIT ?`,
      )
      .all(workerId, Math.max(1, limit)) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  /**
   * Unassigned work any capable worker may take.
   *
   * listAwaitingClaim only returns rows pre-bound to one worker via
   * target_worker_id, so a task parked for a worker that is offline sits there
   * while other idle workers have nothing to do. Rows with target_worker_id
   * NULL are the shared pool: whoever asks first and can run it, gets it.
   */
  listPoolAwaitingClaim(limit: number): QueuedActionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM proposed_actions
         WHERE queue_status = 'awaiting_claim'
           AND target_worker_id IS NULL
         ORDER BY priority DESC, COALESCE(scheduled_at, created_at) ASC
         LIMIT ?`,
      )
      .all(Math.max(1, limit)) as ActionRow[];
    return rows.map((row) => this.rowToAction(row));
  }

  markAwaitingClaim(
    id: string,
    workerId: string,
    result?: Record<string, unknown>,
  ): QueuedActionRecord | null {
    const currentTime = now();
    const existing = this.getById(id);
    const merged = {
      ...(existing?.result || {}),
      ...(result || {}),
      awaitingClaim: true,
      targetWorkerId: workerId,
    };
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'awaiting_claim',
             target_worker_id = ?,
             result_json = ?,
             last_error = NULL
         WHERE id = ?`,
      )
      .run(workerId, JSON.stringify(merged), id);
    return this.getById(id);
  }

  /**
   * Keep the action row's copy of leaseUntil in step with a renewed lease, so
   * anything reading run state (runtime-status, the Task Center detail panel)
   * does not show a lease that looks expired while the worker is still on it.
   */
  extendWorkerLease(id: string, leaseUntil: number): void {
    const existing = this.getById(id);
    if (!existing) return;
    this.db
      .prepare('UPDATE proposed_actions SET result_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...(existing.result || {}), leaseUntil }), id);
  }

  /**
   * Move a task's due time and re-open it.
   *
   * Used when the same reminder is snoozed again: the task is reused rather
   * than duplicated, so the user ends up with one reminder at the new time
   * instead of two at different times.
   */
  rescheduleTask(id: string, scheduledAt: number, title?: string): QueuedActionRecord | null {
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET scheduled_at = ?,
             queue_status = 'queued',
             state = 'pending',
             started_at = NULL,
             finished_at = NULL,
             last_error = NULL,
             title = COALESCE(?, title)
         WHERE id = ?`,
      )
      .run(scheduledAt, title ?? null, id);
    return this.getById(id);
  }

  markClaimedByWorker(
    id: string,
    workerId: string,
    fenceToken: number,
    leaseUntil: number,
  ): string {
    const attemptId = randomUUID();
    const currentTime = now();
    const existing = this.getById(id);
    const merged = {
      ...(existing?.result || {}),
      fenceToken,
      leaseUntil,
      claimedByWorkerId: workerId,
    };
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'running',
             started_at = ?,
             target_worker_id = ?,
             result_json = ?
         WHERE id = ?`,
      )
      .run(currentTime, workerId, JSON.stringify(merged), id);
    this.db
      .prepare(
        `INSERT INTO proposed_action_attempts
          (id, action_id, status, started_at)
         VALUES (?, ?, 'running', ?)`,
      )
      .run(attemptId, id, currentTime);
    return attemptId;
  }

  requeueExpiredWorkerLease(id: string): QueuedActionRecord | null {
    const currentTime = now();
    const existing = this.getById(id);
    if (!existing) return null;
    if (
      existing.queueStatus !== 'running' &&
      existing.queueStatus !== 'awaiting_claim'
    ) {
      return existing;
    }
    const merged = {
      ...(existing.result || {}),
      leaseExpiredAt: currentTime,
    };
    this.db
      .prepare(
        `UPDATE proposed_actions
         SET queue_status = 'awaiting_claim',
             last_error = ?,
             result_json = ?
         WHERE id = ?
           AND queue_status IN ('running', 'awaiting_claim')`,
      )
      .run('worker lease expired; requeued for claim', JSON.stringify(merged), id);
    this.db
      .prepare(
        `UPDATE proposed_action_attempts
         SET status = 'expired',
             error_message = ?,
             finished_at = ?
         WHERE action_id = ? AND status = 'running'`,
      )
      .run('worker lease expired', currentTime, id);
    return this.getById(id);
  }
}
