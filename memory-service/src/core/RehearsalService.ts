import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type { UserDataManager } from '../storage/UserDataManager.js';
import type {
  Rehearsal,
  RehearsalActivation,
  RehearsalActivationCues,
  RehearsalActivationOutcome,
  RehearsalStatus,
} from '../types/index.js';

const ACTIVE_STATUSES: RehearsalStatus[] = ['candidate', 'active', 'stale'];
const AUTO_ACTIVE_CONFIDENCE = 0.82;
const AGING_SECONDS = 30 * 86400;
const STALE_SECONDS = 90 * 86400;

interface RehearsalRow {
  id: string;
  title: string;
  scenario_type: string;
  status: RehearsalStatus;
  summary: string | null;
  content: string;
  activation_cues_json: string | null;
  evidence_refs_json: string | null;
  source_kind: string;
  source_ref_id: string | null;
  confidence: number;
  priority: number;
  valid_from: number | null;
  valid_until: number | null;
  last_activated_at: number | null;
  last_used_at: number | null;
  activation_count: number;
  used_count: number;
  dismissed_count: number;
  stale_reason: string | null;
  markdown_path: string | null;
  created_at: number;
  updated_at: number;
}

interface ActivationRow {
  id: string;
  rehearsal_id: string;
  surface: string;
  context_type: string | null;
  scene_key: string | null;
  score: number;
  display_priority: 'p1' | 'p2' | 'hidden';
  matched_cues_json: string | null;
  outcome: RehearsalActivationOutcome;
  feedback_note: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateRehearsalInput {
  title: string;
  scenarioType?: string;
  status?: RehearsalStatus;
  summary?: string;
  content: string;
  activationCues?: RehearsalActivationCues;
  evidenceRefs?: string[];
  sourceKind?: string;
  sourceRefId?: string;
  confidence?: number;
  priority?: number;
  validFrom?: number;
  validUntil?: number;
}

export interface UpdateRehearsalInput {
  title?: string;
  scenarioType?: string;
  status?: RehearsalStatus;
  summary?: string | null;
  content?: string;
  activationCues?: RehearsalActivationCues;
  evidenceRefs?: string[];
  sourceKind?: string;
  sourceRefId?: string | null;
  confidence?: number;
  priority?: number;
  validFrom?: number | null;
  validUntil?: number | null;
  staleReason?: string | null;
}

export interface RehearsalFeedbackInput {
  outcome: RehearsalActivationOutcome;
  activationId?: string;
  note?: string;
}

export class RehearsalService {
  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager | null,
  ) {}

  list(options: {
    status?: RehearsalStatus | 'all';
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): { items: Rehearsal[]; total: number; limit: number; offset: number } {
    this.applyLifecycle();
    const limit = clampInt(options.limit ?? 50, 1, 200);
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (options.status && options.status !== 'all') {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options.search?.trim()) {
      conditions.push('(title LIKE ? OR content LIKE ? OR summary LIKE ?)');
      const q = `%${options.search.trim()}%`;
      params.push(q, q, q);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM rehearsals ${whereClause}`)
        .get(...params) as { count: number }
    ).count;
    const rows = this.db
      .prepare(
        `SELECT *
         FROM rehearsals
         ${whereClause}
         ORDER BY
           CASE status
             WHEN 'active' THEN 0
             WHEN 'candidate' THEN 1
             WHEN 'stale' THEN 2
             WHEN 'used' THEN 3
             ELSE 4
           END,
           priority DESC,
           updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as RehearsalRow[];
    return {
      items: rows.map(mapRehearsalRow),
      total,
      limit,
      offset,
    };
  }

  listActivatable(): Rehearsal[] {
    this.applyLifecycle();
    const rows = this.db
      .prepare(
        `SELECT *
         FROM rehearsals
         WHERE status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
         ORDER BY priority DESC, confidence DESC, updated_at DESC
         LIMIT 200`,
      )
      .all(...ACTIVE_STATUSES) as RehearsalRow[];
    return rows.map(mapRehearsalRow);
  }

  get(id: string): Rehearsal | null {
    this.applyLifecycle();
    const row = this.db
      .prepare('SELECT * FROM rehearsals WHERE id = ?')
      .get(id) as RehearsalRow | undefined;
    return row ? mapRehearsalRow(row) : null;
  }

  findBySource(sourceKind: string, sourceRefId: string): Rehearsal | null {
    this.applyLifecycle();
    const row = this.db
      .prepare(
        `SELECT *
         FROM rehearsals
         WHERE source_kind = ?
           AND source_ref_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(sourceKind, sourceRefId) as RehearsalRow | undefined;
    return row ? mapRehearsalRow(row) : null;
  }

  getDetail(id: string): { rehearsal: Rehearsal; activations: RehearsalActivation[] } | null {
    const rehearsal = this.get(id);
    if (!rehearsal) return null;
    const rows = this.db
      .prepare(
        `SELECT *
         FROM rehearsal_activations
         WHERE rehearsal_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(id) as ActivationRow[];
    return {
      rehearsal,
      activations: rows.map(mapActivationRow),
    };
  }

  create(input: CreateRehearsalInput): Rehearsal {
    const now = unixNow();
    const id = randomUUID();
    const cues = normalizeCues(input.activationCues);
    const confidence = clamp01(input.confidence ?? 0.5);
    const status =
      input.status ?? (confidence >= AUTO_ACTIVE_CONFIDENCE && hasStableCue(cues) ? 'active' : 'candidate');
    const markdownPath = this.writeMarkdownSnapshot({
      id,
      title: input.title,
      scenarioType: input.scenarioType ?? 'general',
      status,
      summary: input.summary,
      content: input.content,
      activationCues: cues,
      evidenceRefs: input.evidenceRefs ?? [],
      sourceKind: input.sourceKind ?? 'manual',
      sourceRefId: input.sourceRefId,
      confidence,
      priority: clampInt(input.priority ?? 5, 1, 10),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      activationCount: 0,
      usedCount: 0,
      dismissedCount: 0,
      createdAt: now,
      updatedAt: now,
    } as Rehearsal);

    this.db
      .prepare(
        `INSERT INTO rehearsals
          (id, title, scenario_type, status, summary, content,
           activation_cues_json, evidence_refs_json, source_kind, source_ref_id,
           confidence, priority, valid_from, valid_until, markdown_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title.trim(),
        input.scenarioType ?? 'general',
        status,
        nullableText(input.summary),
        input.content.trim(),
        JSON.stringify(cues),
        JSON.stringify(input.evidenceRefs ?? []),
        input.sourceKind ?? 'manual',
        nullableText(input.sourceRefId),
        confidence,
        clampInt(input.priority ?? 5, 1, 10),
        nullableNumber(input.validFrom),
        nullableNumber(input.validUntil),
        markdownPath,
        now,
        now,
      );
    return this.get(id)!;
  }

  update(id: string, input: UpdateRehearsalInput): Rehearsal | null {
    const current = this.get(id);
    if (!current) return null;
    const now = unixNow();
    const refreshActivationClock =
      input.status === 'active' && current.status !== 'active';
    const next: Rehearsal = {
      ...current,
      title: input.title !== undefined ? input.title.trim() : current.title,
      scenarioType: input.scenarioType ?? current.scenarioType,
      status: input.status ?? current.status,
      summary:
        input.summary !== undefined
          ? input.summary === null
            ? undefined
            : input.summary
          : current.summary,
      content: input.content !== undefined ? input.content.trim() : current.content,
      activationCues:
        input.activationCues !== undefined
          ? normalizeCues(input.activationCues)
          : current.activationCues,
      evidenceRefs: input.evidenceRefs ?? current.evidenceRefs,
      sourceKind: input.sourceKind ?? current.sourceKind,
      sourceRefId:
        input.sourceRefId !== undefined
          ? input.sourceRefId === null
            ? undefined
            : input.sourceRefId
          : current.sourceRefId,
      confidence:
        input.confidence !== undefined ? clamp01(input.confidence) : current.confidence,
      priority:
        input.priority !== undefined
          ? clampInt(input.priority, 1, 10)
          : current.priority,
      validFrom:
        input.validFrom !== undefined
          ? input.validFrom === null
            ? undefined
            : input.validFrom
          : current.validFrom,
      validUntil:
        input.validUntil !== undefined
          ? input.validUntil === null
            ? undefined
            : input.validUntil
          : current.validUntil,
      staleReason:
        input.staleReason !== undefined
          ? input.staleReason === null
            ? undefined
            : input.staleReason
          : current.staleReason,
      lastActivatedAt: refreshActivationClock ? now : current.lastActivatedAt,
      updatedAt: now,
    };
    if (next.status === 'candidate' && next.confidence >= AUTO_ACTIVE_CONFIDENCE && hasStableCue(next.activationCues)) {
      next.status = 'active';
      next.staleReason = undefined;
    }
    next.markdownPath = this.writeMarkdownSnapshot(next) ?? current.markdownPath;

    this.db
      .prepare(
        `UPDATE rehearsals
         SET title = ?, scenario_type = ?, status = ?, summary = ?, content = ?,
             activation_cues_json = ?, evidence_refs_json = ?, source_kind = ?,
             source_ref_id = ?, confidence = ?, priority = ?, valid_from = ?,
             valid_until = ?, stale_reason = ?, markdown_path = ?,
             last_activated_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.scenarioType,
        next.status,
        nullableText(next.summary),
        next.content,
        JSON.stringify(next.activationCues),
        JSON.stringify(next.evidenceRefs),
        next.sourceKind,
        nullableText(next.sourceRefId),
        next.confidence,
        next.priority,
        nullableNumber(next.validFrom),
        nullableNumber(next.validUntil),
        nullableText(next.staleReason),
        nullableText(next.markdownPath),
        nullableNumber(next.lastActivatedAt),
        now,
        id,
      );
    return this.get(id);
  }

  softDelete(id: string): Rehearsal | null {
    return this.update(id, {
      status: 'archived',
      staleReason: 'user_deleted',
    });
  }

  recordMatchedActivation(input: {
    rehearsalId: string;
    surface: string;
    contextType?: string;
    sceneKey?: string;
    score: number;
    displayPriority: 'p1' | 'p2' | 'hidden';
    matchedCues: RehearsalActivationCues;
  }): RehearsalActivation {
    const timestamp = unixNow();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO rehearsal_activations
          (id, rehearsal_id, surface, context_type, scene_key, score,
           display_priority, matched_cues_json, outcome, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'matched', ?, ?)`,
      )
      .run(
        id,
        input.rehearsalId,
        input.surface,
        input.contextType ?? null,
        input.sceneKey ?? null,
        clamp01(input.score),
        input.displayPriority,
        JSON.stringify(normalizeCues(input.matchedCues)),
        timestamp,
        timestamp,
      );
    this.db
      .prepare(
        `UPDATE rehearsals
         SET activation_count = activation_count + 1,
             last_activated_at = ?,
             status = CASE WHEN status = 'candidate' AND confidence >= ? THEN 'active' ELSE status END,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(timestamp, AUTO_ACTIVE_CONFIDENCE, timestamp, input.rehearsalId);
    const row = this.db
      .prepare('SELECT * FROM rehearsal_activations WHERE id = ?')
      .get(id) as ActivationRow;
    return mapActivationRow(row);
  }

  recordFeedback(id: string, input: RehearsalFeedbackInput): {
    rehearsal: Rehearsal;
    activation?: RehearsalActivation;
  } | null {
    const current = this.get(id);
    if (!current) return null;
    const timestamp = unixNow();
    if (input.activationId) {
      this.db
        .prepare(
          `UPDATE rehearsal_activations
           SET outcome = ?, feedback_note = ?, updated_at = ?
           WHERE id = ? AND rehearsal_id = ?`,
        )
        .run(input.outcome, nullableText(input.note), timestamp, input.activationId, id);
    }

    const statusPatch: Partial<Pick<Rehearsal, 'status' | 'staleReason'>> = {};
    if (input.outcome === 'used') {
      statusPatch.status = 'used';
    } else if (input.outcome === 'dismissed' || input.outcome === 'irrelevant') {
      statusPatch.status = 'dismissed';
      statusPatch.staleReason = input.outcome;
    } else if (input.outcome === 'accepted' && current.status === 'candidate') {
      statusPatch.status = 'active';
    }

    this.db
      .prepare(
        `UPDATE rehearsals
         SET used_count = used_count + ?,
             dismissed_count = dismissed_count + ?,
             last_used_at = CASE WHEN ? = 1 THEN ? ELSE last_used_at END,
             status = COALESCE(?, status),
             stale_reason = COALESCE(?, stale_reason),
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.outcome === 'accepted' || input.outcome === 'used' ? 1 : 0,
        input.outcome === 'dismissed' || input.outcome === 'irrelevant' ? 1 : 0,
        input.outcome === 'accepted' || input.outcome === 'used' ? 1 : 0,
        timestamp,
        statusPatch.status ?? null,
        statusPatch.staleReason ?? null,
        timestamp,
        id,
      );
    const activation = input.activationId
      ? ((this.db
          .prepare('SELECT * FROM rehearsal_activations WHERE id = ?')
          .get(input.activationId) as ActivationRow | undefined) ?? undefined)
      : undefined;
    return {
      rehearsal: this.get(id)!,
      activation: activation ? mapActivationRow(activation) : undefined,
    };
  }

  applyLifecycle(currentTime = unixNow()): void {
    this.db
      .prepare(
        `UPDATE rehearsals
         SET status = 'stale',
             stale_reason = COALESCE(stale_reason, 'validity_expired'),
             updated_at = ?
         WHERE status = 'active'
           AND valid_until IS NOT NULL
           AND valid_until < ?`,
      )
      .run(currentTime, currentTime);
    this.db
      .prepare(
        `UPDATE rehearsals
         SET status = 'stale',
             stale_reason = COALESCE(stale_reason, 'no_activation_90d'),
             updated_at = ?
         WHERE status = 'active'
           AND COALESCE(last_activated_at, created_at) < ?`,
      )
      .run(currentTime, currentTime - STALE_SECONDS);
    this.db
      .prepare(
        `UPDATE rehearsals
         SET stale_reason = COALESCE(stale_reason, 'aging_no_activation_30d'),
             updated_at = ?
         WHERE status = 'active'
           AND stale_reason IS NULL
           AND COALESCE(last_activated_at, created_at) < ?`,
      )
      .run(currentTime, currentTime - AGING_SECONDS);
  }

  private writeMarkdownSnapshot(rehearsal: Rehearsal): string | undefined {
    if (!this.userDataManager?.isInitialized) return undefined;
    const filename = `${rehearsal.id}.md`;
    const relativePath = `rehearsals/${filename}`;
    const lines = [
      `# ${rehearsal.title}`,
      '',
      `- Status: ${rehearsal.status}`,
      `- Scenario: ${rehearsal.scenarioType}`,
      `- Confidence: ${rehearsal.confidence.toFixed(2)}`,
      `- Priority: ${rehearsal.priority}`,
      rehearsal.validUntil ? `- Valid until: ${new Date(rehearsal.validUntil * 1000).toISOString()}` : '',
      rehearsal.staleReason ? `- Stale reason: ${rehearsal.staleReason}` : '',
      '',
      '## Activation Cues',
      '',
      '```json',
      JSON.stringify(rehearsal.activationCues, null, 2),
      '```',
      '',
      '## Rehearsed Response',
      '',
      rehearsal.content,
      '',
      rehearsal.evidenceRefs.length ? '## Evidence Refs' : '',
      ...rehearsal.evidenceRefs.map((ref) => `- ${ref}`),
      '',
    ].filter((line, index, arr) => line !== '' || arr[index - 1] !== '');
    this.userDataManager.writeFile(relativePath, `${lines.join('\n')}\n`);
    return relativePath;
  }
}

export function mapRehearsalRow(row: RehearsalRow): Rehearsal {
  return {
    id: row.id,
    title: row.title,
    scenarioType: row.scenario_type,
    status: row.status,
    summary: row.summary ?? undefined,
    content: row.content,
    activationCues: safeJsonParse<RehearsalActivationCues>(
      row.activation_cues_json,
      {},
    ),
    evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
    sourceKind: row.source_kind,
    sourceRefId: row.source_ref_id ?? undefined,
    confidence: row.confidence,
    priority: row.priority,
    validFrom: row.valid_from ?? undefined,
    validUntil: row.valid_until ?? undefined,
    lastActivatedAt: row.last_activated_at ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    activationCount: row.activation_count,
    usedCount: row.used_count,
    dismissedCount: row.dismissed_count,
    staleReason: row.stale_reason ?? undefined,
    markdownPath: row.markdown_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivationRow(row: ActivationRow): RehearsalActivation {
  return {
    id: row.id,
    rehearsalId: row.rehearsal_id,
    surface: row.surface,
    contextType: row.context_type ?? undefined,
    sceneKey: row.scene_key ?? undefined,
    score: row.score,
    displayPriority: row.display_priority,
    matchedCues: safeJsonParse<RehearsalActivationCues>(
      row.matched_cues_json,
      {},
    ),
    outcome: row.outcome,
    feedbackNote: row.feedback_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeCues(
  cues: RehearsalActivationCues | undefined,
): RehearsalActivationCues {
  if (!cues) return {};
  const normalized: RehearsalActivationCues = {};
  for (const key of [
    'people',
    'projects',
    'topics',
    'keywords',
    'groupIds',
    'conversationIds',
    'meetingIds',
    'calendarEventIds',
    'issueKeys',
    'urls',
    'surfaces',
  ] as const) {
    const values = Array.isArray(cues[key])
      ? cues[key]!
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : [];
    const unique = Array.from(new Set(values)).slice(0, 24);
    if (unique.length) normalized[key] = unique;
  }
  return normalized;
}

export function hasStableCue(cues: RehearsalActivationCues): boolean {
  return Boolean(
    cues.people?.length ||
      cues.projects?.length ||
      cues.groupIds?.length ||
      cues.conversationIds?.length ||
      cues.meetingIds?.length ||
      cues.calendarEventIds?.length ||
      cues.issueKeys?.length ||
      cues.urls?.length,
  );
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function nullableText(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function nullableNumber(value?: number | null): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}
