import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type ReflectionThreadStatus = 'active' | 'paused' | 'closed';

export interface ReflectionThreadRecord {
  id: string;
  topicKey: string;
  title: string;
  status: ReflectionThreadStatus;
  priority: number;
  salience: number;
  sourceType?: string;
  sourceRefId?: string;
  currentHypothesis?: string;
  openQuestions: string[];
  latestSummary?: string;
  latestMarkdownPath?: string;
  nextReflectionAt?: number;
  lastReflectedAt?: number;
  reflectionCount: number;
  continueReason?: string;
  closureReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReflectionRunRecord {
  id: string;
  threadId: string;
  runType: string;
  triggerType?: string;
  inputRefs: string[];
  previousRunId?: string;
  summary: string;
  hypothesisBefore?: string;
  hypothesisAfter?: string;
  discoveries: string[];
  openQuestions: string[];
  actions: Array<Record<string, unknown>>;
  markdownSnapshotPath?: string;
  createdAt: number;
}

export type ReflectionResearchAttemptStatus = 'hit' | 'empty' | 'failed';

export interface ReflectionResearchAttemptRecord {
  id: string;
  threadId: string;
  runId?: string;
  query: string;
  purpose: string;
  status: ReflectionResearchAttemptStatus;
  resultCount: number;
  sourceTypes: string[];
  projectFilter?: string;
  senderFilter: string[];
  groupFilter: string[];
  errorMessage?: string;
  evidenceRefs: string[];
  createdAt: number;
}

export interface DreamRunRecord {
  id: string;
  sourceType: string;
  sourceRefId?: string;
  threadIds: string[];
  summary?: string;
  insights: string[];
  risks: string[];
  relationships: Array<Record<string, unknown>>;
  markdownPath?: string;
  createdAt: number;
}

export interface TopicMemoryLinkRecord {
  id: string;
  threadId: string;
  sourceKind: string;
  sourceId: string;
  weight: number;
  role: string;
  createdAt: number;
}

interface ReflectionThreadRow {
  id: string;
  topic_key: string;
  title: string;
  status: ReflectionThreadStatus;
  priority: number;
  salience: number;
  source_type: string | null;
  source_ref_id: string | null;
  current_hypothesis: string | null;
  open_questions_json: string | null;
  latest_summary: string | null;
  latest_markdown_path: string | null;
  next_reflection_at: number | null;
  last_reflected_at: number | null;
  reflection_count: number;
  continue_reason: string | null;
  closure_reason: string | null;
  created_at: number;
  updated_at: number;
}

interface ReflectionRunRow {
  id: string;
  thread_id: string;
  run_type: string;
  trigger_type: string | null;
  input_refs_json: string | null;
  previous_run_id: string | null;
  summary: string;
  hypothesis_before: string | null;
  hypothesis_after: string | null;
  discoveries_json: string | null;
  open_questions_json: string | null;
  actions_json: string | null;
  markdown_snapshot_path: string | null;
  created_at: number;
}

interface ReflectionResearchAttemptRow {
  id: string;
  thread_id: string;
  run_id: string | null;
  query: string;
  purpose: string;
  status: ReflectionResearchAttemptStatus;
  result_count: number;
  source_types_json: string | null;
  project_filter: string | null;
  sender_filter_json: string | null;
  group_filter_json: string | null;
  error_message: string | null;
  evidence_refs_json: string | null;
  created_at: number;
}

interface DreamRunRow {
  id: string;
  source_type: string;
  source_ref_id: string | null;
  thread_ids_json: string | null;
  summary: string | null;
  insights_json: string | null;
  risks_json: string | null;
  relationships_json: string | null;
  markdown_path: string | null;
  created_at: number;
}

interface TopicMemoryLinkRow {
  id: string;
  thread_id: string;
  source_kind: string;
  source_id: string;
  weight: number;
  role: string;
  created_at: number;
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

function clampSalience(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(value!, 1));
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

export interface ReflectionThreadListFilters {
  status?: ReflectionThreadStatus | 'all';
  limit?: number;
  offset?: number;
  search?: string;
}

export interface UpsertReflectionThreadInput {
  topicKey: string;
  title: string;
  status?: ReflectionThreadStatus;
  priority?: number;
  salience?: number;
  sourceType?: string;
  sourceRefId?: string;
  currentHypothesis?: string;
  openQuestions?: string[];
  latestSummary?: string;
  latestMarkdownPath?: string;
  nextReflectionAt?: number | null;
  lastReflectedAt?: number | null;
  continueReason?: string;
  closureReason?: string;
}

export interface CreateReflectionRunInput {
  id?: string;
  threadId: string;
  runType: string;
  triggerType?: string;
  inputRefs?: string[];
  previousRunId?: string;
  summary: string;
  hypothesisBefore?: string;
  hypothesisAfter?: string;
  discoveries?: string[];
  openQuestions?: string[];
  actions?: Array<Record<string, unknown>>;
  markdownSnapshotPath?: string;
  createdAt?: number;
}

export interface CreateReflectionResearchAttemptInput {
  id?: string;
  threadId: string;
  runId?: string;
  query: string;
  purpose: string;
  status: ReflectionResearchAttemptStatus;
  resultCount?: number;
  sourceTypes?: string[];
  projectFilter?: string;
  senderFilter?: string[];
  groupFilter?: string[];
  errorMessage?: string;
  evidenceRefs?: string[];
  createdAt?: number;
}

export interface CreateDreamRunInput {
  id?: string;
  sourceType: string;
  sourceRefId?: string;
  threadIds?: string[];
  summary?: string;
  insights?: string[];
  risks?: string[];
  relationships?: Array<Record<string, unknown>>;
  markdownPath?: string;
  createdAt?: number;
}

export interface UpdateThreadAfterRunInput {
  latestSummary?: string;
  latestMarkdownPath?: string;
  currentHypothesis?: string;
  openQuestions?: string[];
  nextReflectionAt?: number | null;
  lastReflectedAt?: number;
  continueReason?: string;
  status?: ReflectionThreadStatus;
}

export class ReflectionThreadRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToThread(row: ReflectionThreadRow): ReflectionThreadRecord {
    return {
      id: row.id,
      topicKey: row.topic_key,
      title: row.title,
      status: row.status,
      priority: row.priority,
      salience: row.salience,
      sourceType: row.source_type ?? undefined,
      sourceRefId: row.source_ref_id ?? undefined,
      currentHypothesis: row.current_hypothesis ?? undefined,
      openQuestions: safeJsonParse<string[]>(row.open_questions_json, []),
      latestSummary: row.latest_summary ?? undefined,
      latestMarkdownPath: row.latest_markdown_path ?? undefined,
      nextReflectionAt: row.next_reflection_at ?? undefined,
      lastReflectedAt: row.last_reflected_at ?? undefined,
      reflectionCount: row.reflection_count,
      continueReason: row.continue_reason ?? undefined,
      closureReason: row.closure_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToRun(row: ReflectionRunRow): ReflectionRunRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      runType: row.run_type,
      triggerType: row.trigger_type ?? undefined,
      inputRefs: safeJsonParse<string[]>(row.input_refs_json, []),
      previousRunId: row.previous_run_id ?? undefined,
      summary: row.summary,
      hypothesisBefore: row.hypothesis_before ?? undefined,
      hypothesisAfter: row.hypothesis_after ?? undefined,
      discoveries: safeJsonParse<string[]>(row.discoveries_json, []),
      openQuestions: safeJsonParse<string[]>(row.open_questions_json, []),
      actions: safeJsonParse<Array<Record<string, unknown>>>(row.actions_json, []),
      markdownSnapshotPath: row.markdown_snapshot_path ?? undefined,
      createdAt: row.created_at,
    };
  }

  private rowToResearchAttempt(
    row: ReflectionResearchAttemptRow,
  ): ReflectionResearchAttemptRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      runId: row.run_id ?? undefined,
      query: row.query,
      purpose: row.purpose,
      status: row.status,
      resultCount: row.result_count,
      sourceTypes: safeJsonParse<string[]>(row.source_types_json, []),
      projectFilter: row.project_filter ?? undefined,
      senderFilter: safeJsonParse<string[]>(row.sender_filter_json, []),
      groupFilter: safeJsonParse<string[]>(row.group_filter_json, []),
      errorMessage: row.error_message ?? undefined,
      evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
      createdAt: row.created_at,
    };
  }

  private rowToDreamRun(row: DreamRunRow): DreamRunRecord {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceRefId: row.source_ref_id ?? undefined,
      threadIds: safeJsonParse<string[]>(row.thread_ids_json, []),
      summary: row.summary ?? undefined,
      insights: safeJsonParse<string[]>(row.insights_json, []),
      risks: safeJsonParse<string[]>(row.risks_json, []),
      relationships: safeJsonParse<Array<Record<string, unknown>>>(row.relationships_json, []),
      markdownPath: row.markdown_path ?? undefined,
      createdAt: row.created_at,
    };
  }

  private rowToLink(row: TopicMemoryLinkRow): TopicMemoryLinkRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      sourceKind: row.source_kind,
      sourceId: row.source_id,
      weight: row.weight,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  listThreads(filters: ReflectionThreadListFilters = {}): {
    items: ReflectionThreadRecord[];
    total: number;
    limit: number;
    offset: number;
  } {
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status && filters.status !== 'all') {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.search?.trim()) {
      conditions.push('(title LIKE ? OR topic_key LIKE ? OR latest_summary LIKE ?)');
      const pattern = `%${filters.search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT *
         FROM reflection_threads
         ${whereClause}
         ORDER BY
           CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END ASC,
           priority DESC,
           updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as ReflectionThreadRow[];

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM reflection_threads ${whereClause}`)
        .get(...params) as CountRow
    ).count;

    return {
      items: rows.map((row) => this.rowToThread(row)),
      total,
      limit,
      offset,
    };
  }

  listDueThreads(limit: number, currentTime = now()): ReflectionThreadRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM reflection_threads
         WHERE status = 'active'
           AND (next_reflection_at IS NULL OR next_reflection_at <= ?)
         ORDER BY priority DESC, COALESCE(next_reflection_at, 0) ASC, salience DESC, updated_at DESC
         LIMIT ?`,
      )
      .all(currentTime, Math.max(1, limit)) as ReflectionThreadRow[];

    return rows.map((row) => this.rowToThread(row));
  }

  getThreadById(id: string): ReflectionThreadRecord | null {
    const row = this.db
      .prepare('SELECT * FROM reflection_threads WHERE id = ?')
      .get(id) as ReflectionThreadRow | undefined;
    return row ? this.rowToThread(row) : null;
  }

  getThreadByTopicKey(topicKey: string): ReflectionThreadRecord | null {
    const row = this.db
      .prepare('SELECT * FROM reflection_threads WHERE topic_key = ?')
      .get(topicKey) as ReflectionThreadRow | undefined;
    return row ? this.rowToThread(row) : null;
  }

  upsertThread(input: UpsertReflectionThreadInput): ReflectionThreadRecord {
    const currentTime = now();
    const existing = this.getThreadByTopicKey(input.topicKey);

    if (!existing) {
      const id = randomUUID();
      this.db
        .prepare(
          `INSERT INTO reflection_threads
            (id, topic_key, title, status, priority, salience, source_type, source_ref_id,
             current_hypothesis, open_questions_json, latest_summary, latest_markdown_path,
             next_reflection_at, last_reflected_at, reflection_count, continue_reason,
             closure_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.topicKey,
          input.title,
          input.status ?? 'active',
          clampPriority(input.priority),
          clampSalience(input.salience),
          input.sourceType ?? null,
          input.sourceRefId ?? null,
          input.currentHypothesis ?? null,
          JSON.stringify(uniqStrings(input.openQuestions ?? [])),
          input.latestSummary ?? null,
          input.latestMarkdownPath ?? null,
          input.nextReflectionAt ?? null,
          input.lastReflectedAt ?? null,
          input.continueReason ?? null,
          input.closureReason ?? null,
          currentTime,
          currentTime,
        );
      return this.getThreadById(id)!;
    }

    const mergedOpenQuestions = uniqStrings([
      ...existing.openQuestions,
      ...(input.openQuestions ?? []),
    ]).slice(0, 12);

    this.db
      .prepare(
        `UPDATE reflection_threads
         SET title = ?,
             status = ?,
             priority = ?,
             salience = ?,
             source_type = ?,
             source_ref_id = ?,
             current_hypothesis = ?,
             open_questions_json = ?,
             latest_summary = ?,
             latest_markdown_path = ?,
             next_reflection_at = ?,
             last_reflected_at = ?,
             continue_reason = ?,
             closure_reason = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.title || existing.title,
        input.status ?? existing.status,
        Math.max(existing.priority, clampPriority(input.priority)),
        Math.max(existing.salience, clampSalience(input.salience)),
        input.sourceType ?? existing.sourceType ?? null,
        input.sourceRefId ?? existing.sourceRefId ?? null,
        input.currentHypothesis ?? existing.currentHypothesis ?? null,
        JSON.stringify(mergedOpenQuestions),
        input.latestSummary ?? existing.latestSummary ?? null,
        input.latestMarkdownPath ?? existing.latestMarkdownPath ?? null,
        input.nextReflectionAt ?? existing.nextReflectionAt ?? null,
        input.lastReflectedAt ?? existing.lastReflectedAt ?? null,
        input.continueReason ?? existing.continueReason ?? null,
        input.closureReason ?? existing.closureReason ?? null,
        currentTime,
        existing.id,
      );

    return this.getThreadById(existing.id)!;
  }

  updateThreadAfterRun(threadId: string, input: UpdateThreadAfterRunInput): ReflectionThreadRecord | null {
    const thread = this.getThreadById(threadId);
    if (!thread) return null;

    const mergedOpenQuestions = uniqStrings([
      ...thread.openQuestions,
      ...(input.openQuestions ?? []),
    ]).slice(0, 12);
    const currentTime = now();

    this.db
      .prepare(
        `UPDATE reflection_threads
         SET latest_summary = ?,
             latest_markdown_path = ?,
             current_hypothesis = ?,
             open_questions_json = ?,
             next_reflection_at = ?,
             last_reflected_at = ?,
             continue_reason = ?,
             status = ?,
             reflection_count = reflection_count + 1,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.latestSummary ?? thread.latestSummary ?? null,
        input.latestMarkdownPath ?? thread.latestMarkdownPath ?? null,
        input.currentHypothesis ?? thread.currentHypothesis ?? null,
        JSON.stringify(mergedOpenQuestions),
        input.nextReflectionAt ?? thread.nextReflectionAt ?? null,
        input.lastReflectedAt ?? currentTime,
        input.continueReason ?? thread.continueReason ?? null,
        input.status ?? thread.status,
        currentTime,
        threadId,
      );

    return this.getThreadById(threadId);
  }

  setThreadStatus(
    threadId: string,
    status: ReflectionThreadStatus,
    reason?: string,
    nextReflectionAt?: number | null,
  ): ReflectionThreadRecord | null {
    const thread = this.getThreadById(threadId);
    if (!thread) return null;

    const currentTime = now();
    this.db
      .prepare(
        `UPDATE reflection_threads
         SET status = ?,
             closure_reason = ?,
             next_reflection_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        status,
        status === 'closed' ? reason ?? thread.closureReason ?? null : thread.closureReason ?? null,
        nextReflectionAt ?? (status === 'active' ? thread.nextReflectionAt ?? currentTime : null),
        currentTime,
        threadId,
      );

    return this.getThreadById(threadId);
  }

  createRun(input: CreateReflectionRunInput): ReflectionRunRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO reflection_runs
          (id, thread_id, run_type, trigger_type, input_refs_json, previous_run_id, summary,
           hypothesis_before, hypothesis_after, discoveries_json, open_questions_json,
           actions_json, markdown_snapshot_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.threadId,
        input.runType,
        input.triggerType ?? null,
        JSON.stringify(input.inputRefs ?? []),
        input.previousRunId ?? null,
        input.summary,
        input.hypothesisBefore ?? null,
        input.hypothesisAfter ?? null,
        JSON.stringify(uniqStrings(input.discoveries ?? [])),
        JSON.stringify(uniqStrings(input.openQuestions ?? [])),
        JSON.stringify(input.actions ?? []),
        input.markdownSnapshotPath ?? null,
        createdAt,
      );
    return this.getRunById(id)!;
  }

  updateRunActions(runId: string, actions: Array<Record<string, unknown>>): ReflectionRunRecord | null {
    this.db
      .prepare('UPDATE reflection_runs SET actions_json = ? WHERE id = ?')
      .run(JSON.stringify(actions), runId);
    return this.getRunById(runId);
  }

  getRunById(id: string): ReflectionRunRecord | null {
    const row = this.db
      .prepare('SELECT * FROM reflection_runs WHERE id = ?')
      .get(id) as ReflectionRunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  getLatestRun(threadId: string): ReflectionRunRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM reflection_runs
         WHERE thread_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(threadId) as ReflectionRunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  listRuns(threadId: string, limit = 20): ReflectionRunRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM reflection_runs
         WHERE thread_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(threadId, Math.max(1, Math.min(limit, 100))) as ReflectionRunRow[];
    return rows.map((row) => this.rowToRun(row));
  }

  recordResearchAttempt(
    input: CreateReflectionResearchAttemptInput,
  ): ReflectionResearchAttemptRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO reflection_research_attempts
          (id, thread_id, run_id, query, purpose, status, result_count,
           source_types_json, project_filter, sender_filter_json,
           group_filter_json, error_message, evidence_refs_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.threadId,
        input.runId ?? null,
        input.query,
        input.purpose,
        input.status,
        Math.max(0, Math.floor(input.resultCount ?? 0)),
        JSON.stringify(uniqStrings(input.sourceTypes ?? [])),
        input.projectFilter ?? null,
        JSON.stringify(uniqStrings(input.senderFilter ?? [])),
        JSON.stringify(uniqStrings(input.groupFilter ?? [])),
        input.errorMessage ?? null,
        JSON.stringify(uniqStrings(input.evidenceRefs ?? [])),
        createdAt,
      );

    return this.getResearchAttemptById(id)!;
  }

  getResearchAttemptById(
    id: string,
  ): ReflectionResearchAttemptRecord | null {
    const row = this.db
      .prepare('SELECT * FROM reflection_research_attempts WHERE id = ?')
      .get(id) as ReflectionResearchAttemptRow | undefined;
    return row ? this.rowToResearchAttempt(row) : null;
  }

  listResearchAttempts(
    threadId: string,
    limit = 30,
  ): ReflectionResearchAttemptRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM reflection_research_attempts
         WHERE thread_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(threadId, Math.max(1, Math.min(limit, 100))) as
      ReflectionResearchAttemptRow[];
    return rows.map((row) => this.rowToResearchAttempt(row));
  }

  countRuns(threadId: string): number {
    return (
      this.db
        .prepare('SELECT COUNT(*) AS count FROM reflection_runs WHERE thread_id = ?')
        .get(threadId) as CountRow
    ).count;
  }

  createDreamRun(input: CreateDreamRunInput): DreamRunRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO dream_runs
          (id, source_type, source_ref_id, thread_ids_json, summary, insights_json, risks_json,
           relationships_json, markdown_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sourceType,
        input.sourceRefId ?? null,
        JSON.stringify(input.threadIds ?? []),
        input.summary ?? null,
        JSON.stringify(uniqStrings(input.insights ?? [])),
        JSON.stringify(uniqStrings(input.risks ?? [])),
        JSON.stringify(input.relationships ?? []),
        input.markdownPath ?? null,
        createdAt,
      );
    return this.getDreamRunById(id)!;
  }

  getDreamRunById(id: string): DreamRunRecord | null {
    const row = this.db
      .prepare('SELECT * FROM dream_runs WHERE id = ?')
      .get(id) as DreamRunRow | undefined;
    return row ? this.rowToDreamRun(row) : null;
  }

  listDreamRuns(filters: { threadId?: string; limit?: number } = {}): DreamRunRecord[] {
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    if (filters.threadId) {
      const rows = this.db
        .prepare(
          `SELECT *
           FROM dream_runs
           WHERE thread_ids_json LIKE ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(`%${filters.threadId}%`, limit) as DreamRunRow[];
      return rows.map((row) => this.rowToDreamRun(row));
    }

    const rows = this.db
      .prepare(
        `SELECT *
         FROM dream_runs
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as DreamRunRow[];
    return rows.map((row) => this.rowToDreamRun(row));
  }

  addLink(threadId: string, sourceKind: string, sourceId: string, weight = 1, role = 'evidence'): TopicMemoryLinkRecord {
    const currentTime = now();
    const existing = this.db
      .prepare(
        `SELECT *
         FROM topic_memory_links
         WHERE thread_id = ? AND source_kind = ? AND source_id = ? AND role = ?`,
      )
      .get(threadId, sourceKind, sourceId, role) as TopicMemoryLinkRow | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE topic_memory_links
           SET weight = MAX(weight, ?)
           WHERE id = ?`,
        )
        .run(weight, existing.id);
      return this.listLinks(threadId, 1000).find((link) => link.id === existing.id)!;
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO topic_memory_links
          (id, thread_id, source_kind, source_id, weight, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, threadId, sourceKind, sourceId, weight, role, currentTime);

    const row = this.db
      .prepare('SELECT * FROM topic_memory_links WHERE id = ?')
      .get(id) as TopicMemoryLinkRow | undefined;
    return this.rowToLink(row!);
  }

  listLinks(threadId: string, limit = 50): TopicMemoryLinkRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM topic_memory_links
         WHERE thread_id = ?
         ORDER BY
           CASE role WHEN 'trigger' THEN 0 WHEN 'dream' THEN 1 ELSE 2 END ASC,
           weight DESC,
           created_at DESC
         LIMIT ?`,
      )
      .all(threadId, Math.max(1, Math.min(limit, 200))) as TopicMemoryLinkRow[];
    return rows.map((row) => this.rowToLink(row));
  }
}
