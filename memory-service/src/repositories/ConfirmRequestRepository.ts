import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export interface ConfirmRequestOption {
  label: string;
  value: string;
}

export interface ConfirmRequestRecord {
  id: string;
  question: string;
  context?: string;
  options: ConfirmRequestOption[];
  evidenceRefs: string[];
  category?: string;
  relatedEntityId?: string;
  relatedPropertyId?: number;
  priority: 'low' | 'normal' | 'high';
  state: string;
  routing?: 'decision' | 'watch';
  reasonCode?: string;
  sourceAnchor?: string;
  gapType?: string;
  userAnswer?: string;
  answeredAt?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt?: number;
  dedupeKey?: string;
}

interface ConfirmRequestRow {
  id: string;
  question: string;
  context: string | null;
  options_json: string | null;
  evidence_refs_json: string | null;
  category: string | null;
  related_entity_id: string | null;
  related_property_id: number | null;
  priority: string | null;
  state: string;
  routing: string | null;
  reason_code: string | null;
  source_anchor: string | null;
  gap_type: string | null;
  user_answer: string | null;
  answered_at: number | null;
  snooze_until: number | null;
  snooze_count: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number | null;
  dedupe_key: string | null;
}

export interface CreateConfirmRequestInput {
  id?: string;
  question: string;
  context?: string | null;
  options?: ConfirmRequestOption[];
  evidenceRefs?: string[];
  category?: string | null;
  relatedEntityId?: string | null;
  relatedPropertyId?: number | null;
  priority?: string;
  state?: string;
  routing?: 'decision' | 'watch';
  reasonCode?: string | null;
  sourceAnchor?: string | null;
  gapType?: string | null;
  userAnswer?: string | null;
  answeredAt?: number | null;
  snoozeUntil?: number | null;
  snoozeCount?: number;
  expiresAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
  dedupeKey?: string;
}

export interface CreateOrReusePendingConfirmRequestResult {
  record: ConfirmRequestRecord;
  created: boolean;
  dedupeKey: string;
}

export interface ConfirmRequestDedupeSummary {
  scannedPending: number;
  duplicateGroups: number;
  mergedRequests: number;
  canonicalIds: string[];
}

interface ConfirmRequestSemanticShape {
  question: string;
  context?: string | null;
  options?: ConfirmRequestOption[];
  category?: string | null;
  relatedEntityId?: string | null;
  relatedPropertyId?: number | null;
  sourceAnchor?: string | null;
  gapType?: string | null;
}

const PRIORITY_RANK: Record<'low' | 'normal' | 'high', number> = {
  low: 0,
  normal: 1,
  high: 2,
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

function normalizePriorityLabel(
  priority?: string | null,
): 'low' | 'normal' | 'high' {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'normal';
}

function strongerPriority(
  left?: string | null,
  right?: string | null,
): 'low' | 'normal' | 'high' {
  const normalizedLeft = normalizePriorityLabel(left);
  const normalizedRight = normalizePriorityLabel(right);
  return PRIORITY_RANK[normalizedLeft] >= PRIORITY_RANK[normalizedRight]
    ? normalizedLeft
    : normalizedRight;
}

function mergeOptions(
  left: ConfirmRequestOption[],
  right: ConfirmRequestOption[],
): ConfirmRequestOption[] {
  const seen = new Set<string>();
  const merged: ConfirmRequestOption[] = [];
  for (const option of [...left, ...right]) {
    const label = typeof option?.label === 'string' ? option.label.trim() : '';
    const value = typeof option?.value === 'string' ? option.value.trim() : '';
    if (!label && !value) continue;
    const key = `${value}::${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      label: label || value,
      value: value || label,
    });
  }
  return merged;
}

function chooseRicherText(
  left?: string | null,
  right?: string | null,
): string | undefined {
  const normalizedLeft = typeof left === 'string' ? left.trim() : '';
  const normalizedRight = typeof right === 'string' ? right.trim() : '';
  if (!normalizedLeft && !normalizedRight) return undefined;
  if (!normalizedLeft) return normalizedRight;
  if (!normalizedRight) return normalizedLeft;
  return normalizedLeft.length >= normalizedRight.length
    ? normalizedLeft
    : normalizedRight;
}

function normalizeIntentText(value?: string | null): string {
  if (!value) return '';
  let normalized = value.normalize('NFKC').toLowerCase().trim();
  if (!normalized) return '';

  const prefixPatterns = [
    /^request user confirmation(?: on| of| for)?\s+/i,
    /^request confirmation(?: on| of| for)?\s+/i,
    /^request user approval(?: on| of| for| to)?\s+/i,
    /^request approval(?: on| of| for| to)?\s+/i,
    /^prompt user(?: to| for| about)?\s+/i,
    /^ask user(?: to| whether| if| about)?\s+/i,
    /^please confirm(?: whether| if)?\s+/i,
    /^confirm(?: whether| if)?\s+/i,
    /^请求用户确认/u,
    /^请求确认/u,
    /^请确认/u,
    /^确认是否/u,
    /^确认/u,
    /^是否/u,
    /^需要确认/u,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of prefixPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '').trim();
        changed = true;
      }
    }
  }

  normalized = normalized
    .replace(/\bread[\s-]?only\b/gu, 'readonly')
    .replace(/\bjira issue\b/gu, 'jira ticket')
    .replace(/[^\p{L}\p{N}\s:_-]+/gu, ' ')
    .replace(/\b(the|a|an|please|would|you|like|to|for|of|on)\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!normalized) return '';
  return normalized.replace(/\b已收到通知\b/gu, '收到通知');
}

function normalizeOptionsForKey(options: ConfirmRequestOption[]): string {
  return mergeOptions([], options)
    .map(
      (option) =>
        `${normalizeIntentText(option.value)}:${normalizeIntentText(
          option.label,
        )}`,
    )
    .filter((value) => value !== ':')
    .sort()
    .join('|');
}

function normalizeAnchorPart(value?: string | null): string {
  return normalizeIntentText(value ?? '');
}

export function buildConfirmRequestDedupeKey(
  input: ConfirmRequestSemanticShape,
): string {
  const sourceAnchor = normalizeAnchorPart(input.sourceAnchor);
  const gapType = normalizeAnchorPart(input.gapType);
  if (sourceAnchor && gapType) {
    return createHash('sha1')
      .update(`anchor:${sourceAnchor}|gap:${gapType}`)
      .digest('hex');
  }
  return createHash('sha1')
    .update(buildConfirmRequestSemanticRaw(input, true))
    .digest('hex');
}

export function buildConfirmRequestQuestionKey(
  input: ConfirmRequestSemanticShape,
): string {
  return createHash('sha1')
    .update(
      JSON.stringify({
        category: normalizeIntentText(input.category ?? 'reflection'),
        relatedEntityId: normalizeIntentText(input.relatedEntityId ?? ''),
        relatedPropertyId: input.relatedPropertyId ?? null,
        question: normalizeIntentText(input.question),
        options: normalizeOptionsForKey(input.options ?? []),
      }),
    )
    .digest('hex');
}

function buildConfirmRequestSemanticRaw(
  input: ConfirmRequestSemanticShape,
  includeContext: boolean,
): string {
  const raw = JSON.stringify({
    category: normalizeIntentText(input.category ?? 'reflection'),
    relatedEntityId: normalizeIntentText(input.relatedEntityId ?? ''),
    relatedPropertyId: input.relatedPropertyId ?? null,
    sourceAnchor: normalizeAnchorPart(input.sourceAnchor ?? ''),
    gapType: normalizeAnchorPart(input.gapType ?? ''),
    question: normalizeIntentText(input.question),
    ...(includeContext
      ? { context: normalizeIntentText(input.context ?? '') }
      : {}),
    options: normalizeOptionsForKey(input.options ?? []),
  });
  return raw;
}

export class ConfirmRequestRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToRecord(row: ConfirmRequestRow): ConfirmRequestRecord {
    return {
      id: row.id,
      question: row.question,
      context: row.context ?? undefined,
      options: safeJsonParse<ConfirmRequestOption[]>(row.options_json, []),
      evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
      category: row.category ?? undefined,
      relatedEntityId: row.related_entity_id ?? undefined,
      relatedPropertyId: row.related_property_id ?? undefined,
      priority: normalizePriorityLabel(row.priority),
      state: row.state,
      routing:
        row.routing === 'decision' || row.routing === 'watch'
          ? row.routing
          : undefined,
      reasonCode: row.reason_code ?? undefined,
      sourceAnchor: row.source_anchor ?? undefined,
      gapType: row.gap_type ?? undefined,
      userAnswer: row.user_answer ?? undefined,
      answeredAt: row.answered_at ?? undefined,
      snoozeUntil: row.snooze_until ?? undefined,
      snoozeCount: row.snooze_count ?? 0,
      expiresAt: row.expires_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
      dedupeKey: row.dedupe_key ?? undefined,
    };
  }

  getById(id: string): ConfirmRequestRecord | null {
    const row = this.db
      .prepare('SELECT * FROM confirm_requests WHERE id = ?')
      .get(id) as ConfirmRequestRow | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  listByState(state: string): ConfirmRequestRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM confirm_requests WHERE state = ? ORDER BY created_at ASC',
      )
      .all(state) as ConfirmRequestRow[];
    return rows.map((row) => this.rowToRecord(row));
  }

  listByRouting(
    routing: 'decision' | 'watch',
    state?: string,
  ): ConfirmRequestRecord[] {
    const rows = state
      ? (this.db
          .prepare(
            routing === 'decision'
              ? "SELECT * FROM confirm_requests WHERE COALESCE(routing, 'decision') = 'decision' AND state = ? ORDER BY created_at ASC"
              : 'SELECT * FROM confirm_requests WHERE routing = ? AND state = ? ORDER BY created_at ASC',
          )
          .all(
            ...(routing === 'decision' ? [state] : [routing, state]),
          ) as ConfirmRequestRow[])
      : (this.db
          .prepare(
            routing === 'decision'
              ? "SELECT * FROM confirm_requests WHERE COALESCE(routing, 'decision') = 'decision' ORDER BY created_at ASC"
              : 'SELECT * FROM confirm_requests WHERE routing = ? ORDER BY created_at ASC',
          )
          .all(
            ...(routing === 'decision' ? [] : [routing]),
          ) as ConfirmRequestRow[]);
    return rows.map((row) => this.rowToRecord(row));
  }

  countByRoutingAndState(routing: 'decision' | 'watch', state: string): number {
    const row = this.db
      .prepare(
        routing === 'decision'
          ? "SELECT COUNT(*) AS count FROM confirm_requests WHERE COALESCE(routing, 'decision') = 'decision' AND state = ?"
          : 'SELECT COUNT(*) AS count FROM confirm_requests WHERE routing = ? AND state = ?',
      )
      .get(...(routing === 'decision' ? [state] : [routing, state])) as {
      count: number;
    };
    return row.count;
  }

  transitionState(
    id: string,
    fromState: string,
    toState: 'pending' | 'snoozed' | 'expired',
    overrides: {
      snoozeUntil?: number | null;
      expiresAt?: number | null;
      updatedAt?: number;
      snoozeCount?: number;
    } = {},
  ): ConfirmRequestRecord | null {
    const updatedAt = overrides.updatedAt ?? now();
    const result = this.db
      .prepare(
        `UPDATE confirm_requests
         SET state = ?,
             snooze_until = ?,
             expires_at = ?,
             snooze_count = COALESCE(?, snooze_count),
             updated_at = ?
         WHERE id = ? AND state = ?`,
      )
      .run(
        toState,
        overrides.snoozeUntil ?? null,
        overrides.expiresAt ?? null,
        overrides.snoozeCount ?? null,
        updatedAt,
        id,
        fromState,
      );
    if (result.changes === 0) return null;
    return this.getById(id);
  }

  processDecisionSnoozeLifecycle(currentTime = now()): {
    resumed: number;
    expired: number;
  } {
    const expireResult = this.db
      .prepare(
        `UPDATE confirm_requests
         SET state = 'expired',
             snooze_until = NULL,
             updated_at = ?
         WHERE COALESCE(routing, 'decision') = 'decision'
           AND state = 'snoozed'
           AND expires_at IS NOT NULL
           AND expires_at <= ?`,
      )
      .run(currentTime, currentTime);

    const resumeResult = this.db
      .prepare(
        `UPDATE confirm_requests
         SET state = 'pending',
             snooze_until = NULL,
             updated_at = ?
         WHERE COALESCE(routing, 'decision') = 'decision'
           AND state = 'snoozed'
           AND snooze_until IS NOT NULL
           AND snooze_until <= ?
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .run(currentTime, currentTime, currentTime);

    return {
      resumed: resumeResult.changes,
      expired: expireResult.changes,
    };
  }

  processWatchLifecycle(currentTime = now()): {
    resnoozed: number;
    expired: number;
  } {
    const expireResult = this.db
      .prepare(
        `UPDATE confirm_requests
         SET state = 'expired',
             snooze_until = NULL,
             updated_at = ?
         WHERE routing = 'watch'
           AND state = 'snoozed'
           AND priority != 'high'
           AND expires_at IS NOT NULL
           AND expires_at <= ?`,
      )
      .run(currentTime, currentTime);

    const dueRows = this.db
      .prepare(
        `SELECT id, snooze_count
         FROM confirm_requests
         WHERE routing = 'watch'
           AND state = 'snoozed'
           AND priority != 'high'
           AND snooze_until IS NOT NULL
           AND snooze_until <= ?
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .all(currentTime, currentTime) as Array<{
      id: string;
      snooze_count: number | null;
    }>;

    const bump = this.db.transaction(() => {
      for (const row of dueRows) {
        this.db
          .prepare(
            `UPDATE confirm_requests
             SET snooze_until = ?,
                 snooze_count = ?,
                 updated_at = ?
             WHERE id = ?`,
          )
          .run(
            currentTime + 72 * 3600,
            (row.snooze_count ?? 0) + 1,
            currentTime,
            row.id,
          );
      }
    });
    bump();

    return {
      resnoozed: dueRows.length,
      expired: expireResult.changes,
    };
  }

  createOrReusePending(
    input: CreateConfirmRequestInput,
  ): CreateOrReusePendingConfirmRequestResult {
    const normalizedInput = this.normalizeCreateInput(input);
    const dedupeKey = normalizedInput.dedupeKey;
    const existing =
      this.findPendingByDedupeKey(dedupeKey) ??
      this.findPendingBySemantic(normalizedInput);
    if (existing) {
      const merged = this.mergePendingRequest(
        existing.id,
        normalizedInput,
        dedupeKey,
      );
      return {
        record: merged,
        created: false,
        dedupeKey,
      };
    }

    const id = normalizedInput.id ?? randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO confirm_requests
            (id, question, context, options_json, evidence_refs_json, category, related_entity_id,
             related_property_id, priority, state, routing, reason_code, source_anchor, gap_type,
             user_answer, answered_at, snooze_until, snooze_count, expires_at, created_at, updated_at, dedupe_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          normalizedInput.question,
          normalizedInput.context ?? null,
          JSON.stringify(normalizedInput.options),
          JSON.stringify(normalizedInput.evidenceRefs),
          normalizedInput.category ?? null,
          normalizedInput.relatedEntityId ?? null,
          normalizedInput.relatedPropertyId ?? null,
          normalizedInput.priority,
          normalizedInput.state,
          normalizedInput.routing,
          normalizedInput.reasonCode ?? null,
          normalizedInput.sourceAnchor ?? null,
          normalizedInput.gapType ?? null,
          normalizedInput.userAnswer ?? null,
          normalizedInput.answeredAt ?? null,
          normalizedInput.snoozeUntil ?? null,
          normalizedInput.snoozeCount,
          normalizedInput.expiresAt ?? null,
          normalizedInput.createdAt,
          normalizedInput.updatedAt,
          dedupeKey,
        );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        (!error.message.includes('idx_cr_pending_dedupe') &&
          !error.message.includes('confirm_requests.dedupe_key'))
      ) {
        throw error;
      }
      const collided = this.findPendingByDedupeKey(dedupeKey);
      if (!collided) throw error;
      const merged = this.mergePendingRequest(
        collided.id,
        normalizedInput,
        dedupeKey,
      );
      return {
        record: merged,
        created: false,
        dedupeKey,
      };
    }

    return {
      record: this.getById(id)!,
      created: true,
      dedupeKey,
    };
  }

  reusePendingForOriginThread(
    threadId: string,
    input: CreateConfirmRequestInput,
  ): ConfirmRequestRecord | null {
    const normalizedInput = this.normalizeCreateInput(input);
    const existing = this.findPendingByOriginThread(threadId, normalizedInput);
    if (!existing) return null;
    return this.mergePendingRequest(
      existing.id,
      normalizedInput,
      existing.dedupeKey ?? normalizedInput.dedupeKey,
    );
  }

  dedupePendingRequests(): ConfirmRequestDedupeSummary {
    const pending = this.db
      .prepare(
        `SELECT * FROM confirm_requests
         WHERE state IN ('pending', 'snoozed')
         ORDER BY created_at ASC`,
      )
      .all() as ConfirmRequestRow[];
    const groups = new Map<string, ConfirmRequestRecord[]>();
    for (const record of pending.map((row) => this.rowToRecord(row))) {
      const dedupeKey =
        record.dedupeKey ?? buildConfirmRequestDedupeKey(record);
      const list = groups.get(dedupeKey) ?? [];
      list.push(record);
      groups.set(dedupeKey, list);
    }

    const summary: ConfirmRequestDedupeSummary = {
      scannedPending: pending.length,
      duplicateGroups: 0,
      mergedRequests: 0,
      canonicalIds: [],
    };

    const apply = this.db.transaction(() => {
      for (const [dedupeKey, items] of groups) {
        this.mergePendingGroup(dedupeKey, items, summary);
      }

      const remainingPending = this.db
        .prepare(
          `SELECT * FROM confirm_requests
           WHERE state IN ('pending', 'snoozed')
           ORDER BY created_at ASC`,
        )
        .all() as ConfirmRequestRow[];
      const threadGroups = new Map<string, ConfirmRequestRecord[]>();
      const threadLinks = this.db
        .prepare(
          `SELECT DISTINCT cr.id AS confirm_request_id, a.thread_id
           FROM confirm_requests cr
           JOIN proposed_actions a
             ON cr.id = json_extract(a.result_json, '$.confirmRequestId')
            WHERE cr.state IN ('pending', 'snoozed')
              AND a.action_type = 'create_confirm_request'
              AND a.queue_status = 'succeeded'
              AND a.thread_id IS NOT NULL
           ORDER BY cr.created_at ASC`,
        )
        .all() as Array<{ confirm_request_id: string; thread_id: string }>;
      const pendingById = new Map(
        remainingPending.map((row) => {
          const item = this.rowToRecord(row);
          return [item.id, item] as const;
        }),
      );
      for (const link of threadLinks) {
        const record = pendingById.get(link.confirm_request_id);
        if (!record) continue;
        const key = `${link.thread_id}:${buildConfirmRequestQuestionKey(
          record,
        )}`;
        const list = threadGroups.get(key) ?? [];
        if (!list.some((item) => item.id === record.id)) {
          list.push(record);
        }
        threadGroups.set(key, list);
      }

      for (const [groupKey, items] of threadGroups) {
        if (items.length < 2) continue;
        this.mergePendingGroup(groupKey, items, summary);
      }
    });

    apply();
    return summary;
  }

  backfillDedupeKeys(): number {
    const rows = this.db
      .prepare('SELECT * FROM confirm_requests ORDER BY created_at ASC')
      .all() as ConfirmRequestRow[];
    const update = this.db.transaction(() => {
      let changed = 0;
      for (const row of rows) {
        const record = this.rowToRecord(row);
        const dedupeKey = buildConfirmRequestDedupeKey(record);
        if (row.dedupe_key === dedupeKey) continue;
        this.db
          .prepare(
            'UPDATE confirm_requests SET dedupe_key = ?, updated_at = COALESCE(updated_at, created_at) WHERE id = ?',
          )
          .run(dedupeKey, row.id);
        changed += 1;
      }
      return changed;
    });
    return update();
  }

  private normalizeCreateInput(input: CreateConfirmRequestInput) {
    const createdAt = input.createdAt ?? now();
    const routing = input.routing === 'watch' ? 'watch' : 'decision';
    const defaultState = routing === 'watch' ? 'snoozed' : 'pending';
    return {
      id: input.id,
      question: input.question.trim(),
      context:
        typeof input.context === 'string' && input.context.trim().length > 0
          ? input.context.trim()
          : undefined,
      options: mergeOptions([], input.options ?? []),
      evidenceRefs: uniqStrings(input.evidenceRefs ?? []),
      category:
        typeof input.category === 'string' && input.category.trim().length > 0
          ? input.category.trim()
          : undefined,
      relatedEntityId:
        typeof input.relatedEntityId === 'string' &&
        input.relatedEntityId.trim().length > 0
          ? input.relatedEntityId.trim()
          : undefined,
      relatedPropertyId:
        typeof input.relatedPropertyId === 'number'
          ? input.relatedPropertyId
          : undefined,
      priority: normalizePriorityLabel(input.priority),
      state: input.state ?? defaultState,
      routing,
      reasonCode:
        typeof input.reasonCode === 'string' &&
        input.reasonCode.trim().length > 0
          ? input.reasonCode.trim()
          : undefined,
      sourceAnchor:
        typeof input.sourceAnchor === 'string' &&
        input.sourceAnchor.trim().length > 0
          ? input.sourceAnchor.trim()
          : undefined,
      gapType:
        typeof input.gapType === 'string' && input.gapType.trim().length > 0
          ? input.gapType.trim()
          : undefined,
      userAnswer:
        typeof input.userAnswer === 'string' &&
        input.userAnswer.trim().length > 0
          ? input.userAnswer.trim()
          : undefined,
      answeredAt:
        typeof input.answeredAt === 'number' ? input.answeredAt : undefined,
      snoozeUntil:
        typeof input.snoozeUntil === 'number'
          ? input.snoozeUntil
          : routing === 'watch'
          ? createdAt + 72 * 3600
          : undefined,
      snoozeCount:
        typeof input.snoozeCount === 'number' ? input.snoozeCount : 0,
      expiresAt:
        typeof input.expiresAt === 'number'
          ? input.expiresAt
          : routing === 'watch'
          ? createdAt + 14 * 24 * 3600
          : undefined,
      createdAt,
      updatedAt:
        typeof input.updatedAt === 'number' ? input.updatedAt : createdAt,
      dedupeKey:
        input.dedupeKey && input.dedupeKey.trim().length > 0
          ? input.dedupeKey.trim()
          : buildConfirmRequestDedupeKey({
              question: input.question,
              context: input.context,
              options: input.options ?? [],
              category: input.category,
              relatedEntityId: input.relatedEntityId,
              relatedPropertyId: input.relatedPropertyId,
              sourceAnchor: input.sourceAnchor,
              gapType: input.gapType,
            }),
    };
  }

  private mergePendingRequest(
    existingId: string,
    input: ReturnType<ConfirmRequestRepository['normalizeCreateInput']>,
    dedupeKey: string,
  ): ConfirmRequestRecord {
    const existing = this.getById(existingId);
    if (!existing) {
      throw new Error(`Confirm request ${existingId} not found`);
    }

    const mergedContext = chooseRicherText(existing.context, input.context);
    const mergedQuestion =
      chooseRicherText(existing.question, input.question) ?? existing.question;
    const mergedOptions = mergeOptions(existing.options, input.options);
    const mergedEvidenceRefs = uniqStrings([
      ...existing.evidenceRefs,
      ...input.evidenceRefs,
    ]);
    const mergedPriority = strongerPriority(existing.priority, input.priority);
    const mergedUpdatedAt = Math.max(
      existing.updatedAt ?? existing.createdAt,
      input.updatedAt ?? input.createdAt,
    );

    this.db
      .prepare(
        `UPDATE confirm_requests
         SET question = ?,
             context = ?,
              options_json = ?,
              evidence_refs_json = ?,
              priority = ?,
              reason_code = COALESCE(reason_code, ?),
              source_anchor = COALESCE(source_anchor, ?),
              gap_type = COALESCE(gap_type, ?),
              routing = COALESCE(routing, ?),
              updated_at = ?,
              dedupe_key = ?
          WHERE id = ?`,
      )
      .run(
        mergedQuestion,
        mergedContext ?? null,
        JSON.stringify(mergedOptions),
        JSON.stringify(mergedEvidenceRefs),
        mergedPriority,
        input.reasonCode ?? null,
        input.sourceAnchor ?? null,
        input.gapType ?? null,
        input.routing,
        mergedUpdatedAt,
        dedupeKey,
        existingId,
      );

    return this.getById(existingId)!;
  }

  private findPendingByDedupeKey(
    dedupeKey: string,
  ): ConfirmRequestRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM confirm_requests
         WHERE state IN ('pending', 'snoozed')
           AND dedupe_key = ?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get(dedupeKey) as ConfirmRequestRow | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  private findPendingBySemantic(
    input: ReturnType<ConfirmRequestRepository['normalizeCreateInput']>,
  ): ConfirmRequestRecord | null {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM confirm_requests
         WHERE state IN ('pending', 'snoozed')
         ORDER BY created_at ASC`,
      )
      .all() as ConfirmRequestRow[];

    for (const row of rows) {
      const candidate = this.rowToRecord(row);
      const candidateKey =
        candidate.dedupeKey ?? buildConfirmRequestDedupeKey(candidate);
      if (candidateKey === input.dedupeKey) {
        return candidate;
      }
    }
    return null;
  }

  private findPendingByOriginThread(
    threadId: string,
    input: ReturnType<ConfirmRequestRepository['normalizeCreateInput']>,
  ): ConfirmRequestRecord | null {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT cr.*
         FROM confirm_requests cr
         JOIN proposed_actions a
           ON cr.id = json_extract(a.result_json, '$.confirmRequestId')
         WHERE cr.state IN ('pending', 'snoozed')
           AND a.action_type = 'create_confirm_request'
           AND a.queue_status = 'succeeded'
           AND a.thread_id = ?
         ORDER BY cr.created_at ASC`,
      )
      .all(threadId) as ConfirmRequestRow[];
    const questionKey = buildConfirmRequestQuestionKey(input);
    for (const row of rows) {
      const candidate = this.rowToRecord(row);
      if (buildConfirmRequestQuestionKey(candidate) === questionKey) {
        return candidate;
      }
    }
    return null;
  }

  private mergePendingGroup(
    dedupeKey: string,
    items: ConfirmRequestRecord[],
    summary: ConfirmRequestDedupeSummary,
  ): void {
    const sorted = [...items].sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt - right.createdAt,
    );
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    const mergedPriority = duplicates.reduce(
      (priority, item) => strongerPriority(priority, item.priority),
      canonical.priority,
    );
    const mergedQuestion = duplicates.reduce(
      (question, item) => chooseRicherText(question, item.question) ?? question,
      canonical.question,
    );
    const mergedContext = duplicates.reduce(
      (context, item) => chooseRicherText(context, item.context),
      canonical.context,
    );
    const mergedOptions = duplicates.reduce(
      (options, item) => mergeOptions(options, item.options),
      canonical.options,
    );
    const mergedEvidence = duplicates.reduce(
      (evidenceRefs, item) =>
        uniqStrings([...evidenceRefs, ...item.evidenceRefs]),
      canonical.evidenceRefs,
    );
    const mergedUpdatedAt = Math.max(
      canonical.updatedAt ?? canonical.createdAt,
      ...duplicates.map((item) => item.updatedAt ?? item.createdAt),
    );

    this.db
      .prepare(
        `UPDATE confirm_requests
         SET question = ?,
             context = ?,
             options_json = ?,
             evidence_refs_json = ?,
             priority = ?,
               updated_at = ?,
               dedupe_key = ?
          WHERE id = ?`,
      )
      .run(
        mergedQuestion ?? canonical.question,
        mergedContext ?? null,
        JSON.stringify(mergedOptions),
        JSON.stringify(mergedEvidence),
        mergedPriority,
        mergedUpdatedAt,
        dedupeKey,
        canonical.id,
      );

    if (duplicates.length === 0) {
      return;
    }

    summary.duplicateGroups += 1;
    summary.mergedRequests += duplicates.length;
    if (!summary.canonicalIds.includes(canonical.id)) {
      summary.canonicalIds.push(canonical.id);
    }

    for (const duplicate of duplicates) {
      this.remapActionResults(duplicate.id, canonical.id);
      this.closeDuplicateConfirmThreads(duplicate.id, canonical.id);
      this.db
        .prepare(
          `UPDATE confirm_requests
           SET state = 'deduplicated',
               user_answer = ?,
               answered_at = ?,
               updated_at = ?,
                dedupe_key = ?
            WHERE id = ?`,
        )
        .run(
          `Merged into confirm request ${canonical.id}`,
          now(),
          now(),
          dedupeKey,
          duplicate.id,
        );
    }
  }

  private remapActionResults(
    fromConfirmRequestId: string,
    toConfirmRequestId: string,
  ): void {
    const actions = this.db
      .prepare(
        `SELECT id, result_json
         FROM proposed_actions
         WHERE action_type = 'create_confirm_request'
           AND json_extract(result_json, '$.confirmRequestId') = ?`,
      )
      .all(fromConfirmRequestId) as Array<{
      id: string;
      result_json: string | null;
    }>;

    for (const action of actions) {
      const result = safeJsonParse<Record<string, unknown>>(
        action.result_json,
        {},
      );
      result.confirmRequestId = toConfirmRequestId;
      this.db
        .prepare('UPDATE proposed_actions SET result_json = ? WHERE id = ?')
        .run(JSON.stringify(result), action.id);
    }
  }

  private closeDuplicateConfirmThreads(
    duplicateConfirmRequestId: string,
    canonicalConfirmRequestId: string,
  ): void {
    this.db
      .prepare(
        `UPDATE reflection_threads
         SET status = 'closed',
             next_reflection_at = NULL,
             continue_reason = ?,
             closure_reason = ?,
             updated_at = ?
         WHERE source_type = 'confirm_request'
           AND source_ref_id = ?
           AND status != 'closed'`,
      )
      .run(
        `Merged into confirm request ${canonicalConfirmRequestId}`,
        'duplicate confirm request merged',
        now(),
        duplicateConfirmRequestId,
      );
  }
}
