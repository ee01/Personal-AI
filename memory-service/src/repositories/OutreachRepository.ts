import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type OutreachTemplateSyncState = 'synced' | 'sync_error' | 'paused' | 'cancelled';
export type OutreachApprovalPolicy = 'manual_direct' | 'reflection_review' | 'always_review';
export type OutreachOriginKind = 'scheduled_template' | 'reflection_action' | 'manual_action';
export type OutreachTargetResolutionStatus = 'unresolved' | 'ambiguous' | 'resolved';
export type OutreachSessionStatus =
  | 'pending_approval'
  | 'scheduled'
  | 'waiting_reply'
  | 'deferred'
  | 'resolved'
  | 'no_reply'
  | 'escalated'
  | 'cancelled'
  | 'failed';
export type OutreachEventType =
  | 'created'
  | 'edited'
  | 'approved'
  | 'dispatched'
  | 'reply_received'
  | 'reply_classified'
  | 'deferred_by_reply'
  | 'followup_sent'
  | 'resolved'
  | 'no_reply'
  | 'escalated'
  | 'cancelled'
  | 'failed';

export interface OutreachTemplateRecord {
  id: string;
  sourceKind: string;
  sourceRefId?: string;
  sheetMessageId?: string;
  title: string;
  questionTemplate: string;
  contextTemplate?: string;
  targetType: string;
  targetRef: string;
  scheduleSpec: Record<string, unknown>;
  enabled: boolean;
  approvalPolicy: OutreachApprovalPolicy;
  maxFollowup: number;
  followupIntervalSeconds: number;
  syncState: OutreachTemplateSyncState;
  lastSyncError?: string;
  lastSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutreachSessionRecord {
  id: string;
  templateId?: string;
  originKind: OutreachOriginKind;
  threadId?: string;
  runId?: string;
  actionId?: string;
  channel: string;
  targetType: string;
  targetRef: string;
  targetResolutionStatus: OutreachTargetResolutionStatus;
  targetResolvedType?: string;
  targetResolvedId?: string;
  targetResolvedLabel?: string;
  targetResolvedChatId?: string;
  targetCandidates?: Array<Record<string, unknown>>;
  renderedQuestion: string;
  renderedContext?: string;
  status: OutreachSessionStatus;
  requiresApproval: boolean;
  followupCount: number;
  maxFollowup: number;
  followupIntervalSeconds: number;
  waitUntil?: number;
  nextCheckAt?: number;
  sentChatId?: string;
  sentPostId?: string;
  lastPollAt?: number;
  replyPostId?: string;
  replySender?: string;
  replyRawText?: string;
  replyClassification?: string;
  replyConfidence?: number;
  outcome?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  terminalSyncedAt?: number;
  actionResultId?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface OutreachEventRecord {
  id: string;
  sessionId: string;
  eventType: OutreachEventType;
  payload?: Record<string, unknown>;
  createdAt: number;
}

interface OutreachTemplateRow {
  id: string;
  source_kind: string;
  source_ref_id: string | null;
  sheet_message_id: string | null;
  title: string;
  question_template: string;
  context_template: string | null;
  target_type: string;
  target_ref: string;
  schedule_spec_json: string;
  enabled: number;
  approval_policy: OutreachApprovalPolicy;
  max_followup: number;
  followup_interval_seconds: number;
  sync_state: OutreachTemplateSyncState;
  last_sync_error: string | null;
  created_at: number;
  updated_at: number;
  last_session_id?: string | null;
}

interface OutreachSessionRow {
  id: string;
  template_id: string | null;
  origin_kind: OutreachOriginKind;
  thread_id: string | null;
  run_id: string | null;
  action_id: string | null;
  channel: string;
  target_type: string;
  target_ref: string;
  target_resolution_status: OutreachTargetResolutionStatus;
  target_resolved_type: string | null;
  target_resolved_id: string | null;
  target_resolved_label: string | null;
  target_resolved_chat_id: string | null;
  target_candidates_json: string | null;
  rendered_question: string;
  rendered_context: string | null;
  status: OutreachSessionStatus;
  requires_approval: number;
  followup_count: number;
  max_followup: number;
  followup_interval_seconds: number;
  wait_until: number | null;
  next_check_at: number | null;
  sent_chat_id: string | null;
  sent_post_id: string | null;
  last_poll_at: number | null;
  reply_post_id: string | null;
  reply_sender: string | null;
  reply_raw_text: string | null;
  reply_classification: string | null;
  reply_confidence: number | null;
  outcome_json: string | null;
  error_code: string | null;
  error_message: string | null;
  terminal_synced_at: number | null;
  action_result_id: string | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
}

interface OutreachEventRow {
  id: string;
  session_id: string;
  event_type: OutreachEventType;
  payload_json: string | null;
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

function clampNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value!));
}

export interface UpsertOutreachTemplateInput {
  id?: string;
  sourceKind: string;
  sourceRefId?: string;
  sheetMessageId?: string;
  title: string;
  questionTemplate: string;
  contextTemplate?: string;
  targetType: string;
  targetRef: string;
  scheduleSpec?: Record<string, unknown>;
  enabled?: boolean;
  approvalPolicy?: OutreachApprovalPolicy;
  maxFollowup?: number;
  followupIntervalSeconds?: number;
  syncState?: OutreachTemplateSyncState;
  lastSyncError?: string;
}

export interface CreateOutreachSessionInput {
  id?: string;
  templateId?: string;
  originKind: OutreachOriginKind;
  threadId?: string;
  runId?: string;
  actionId?: string;
  channel?: string;
  targetType: string;
  targetRef: string;
  targetResolutionStatus?: OutreachTargetResolutionStatus;
  targetResolvedType?: string | null;
  targetResolvedId?: string | null;
  targetResolvedLabel?: string | null;
  targetResolvedChatId?: string | null;
  targetCandidates?: Array<Record<string, unknown>> | null;
  renderedQuestion: string;
  renderedContext?: string;
  status: OutreachSessionStatus;
  requiresApproval?: boolean;
  followupCount?: number;
  maxFollowup?: number;
  followupIntervalSeconds?: number;
  waitUntil?: number | null;
  nextCheckAt?: number | null;
  sentChatId?: string | null;
  sentPostId?: string | null;
  lastPollAt?: number | null;
  replyPostId?: string | null;
  replySender?: string | null;
  replyRawText?: string | null;
  replyClassification?: string | null;
  replyConfidence?: number | null;
  outcome?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  terminalSyncedAt?: number | null;
  actionResultId?: string | null;
  createdAt?: number;
  resolvedAt?: number | null;
}

export interface OutreachSessionListFilters {
  status?: OutreachSessionStatus | 'all';
  statuses?: OutreachSessionStatus[];
  originKind?: string;
  templateId?: string;
  threadId?: string;
  actionId?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateOutreachSessionInput {
  targetType?: string;
  targetRef?: string;
  targetResolutionStatus?: OutreachTargetResolutionStatus;
  targetResolvedType?: string | null;
  targetResolvedId?: string | null;
  targetResolvedLabel?: string | null;
  targetResolvedChatId?: string | null;
  targetCandidates?: Array<Record<string, unknown>> | null;
  renderedQuestion?: string;
  renderedContext?: string | null;
  status?: OutreachSessionStatus;
  requiresApproval?: boolean;
  followupCount?: number;
  maxFollowup?: number;
  followupIntervalSeconds?: number;
  waitUntil?: number | null;
  nextCheckAt?: number | null;
  sentChatId?: string | null;
  sentPostId?: string | null;
  lastPollAt?: number | null;
  replyPostId?: string | null;
  replySender?: string | null;
  replyRawText?: string | null;
  replyClassification?: string | null;
  replyConfidence?: number | null;
  outcome?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  terminalSyncedAt?: number | null;
  actionResultId?: string | null;
  resolvedAt?: number | null;
}

export interface OutreachSummary {
  upcomingCount: number;
  waitingReplyCount: number;
  escalatedCount: number;
  pendingApprovalCount: number;
}

export class OutreachRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToTemplate(row: OutreachTemplateRow): OutreachTemplateRecord {
    return {
      id: row.id,
      sourceKind: row.source_kind,
      sourceRefId: row.source_ref_id ?? undefined,
      sheetMessageId: row.sheet_message_id ?? undefined,
      title: row.title,
      questionTemplate: row.question_template,
      contextTemplate: row.context_template ?? undefined,
      targetType: row.target_type,
      targetRef: row.target_ref,
      scheduleSpec: safeJsonParse<Record<string, unknown>>(row.schedule_spec_json, {}),
      enabled: row.enabled === 1,
      approvalPolicy: row.approval_policy,
      maxFollowup: row.max_followup,
      followupIntervalSeconds: row.followup_interval_seconds,
      syncState: row.sync_state,
      lastSyncError: row.last_sync_error ?? undefined,
      lastSessionId: row.last_session_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToSession(row: OutreachSessionRow): OutreachSessionRecord {
    return {
      id: row.id,
      templateId: row.template_id ?? undefined,
      originKind: row.origin_kind,
      threadId: row.thread_id ?? undefined,
      runId: row.run_id ?? undefined,
      actionId: row.action_id ?? undefined,
      channel: row.channel,
      targetType: row.target_type,
      targetRef: row.target_ref,
      targetResolutionStatus: row.target_resolution_status,
      targetResolvedType: row.target_resolved_type ?? undefined,
      targetResolvedId: row.target_resolved_id ?? undefined,
      targetResolvedLabel: row.target_resolved_label ?? undefined,
      targetResolvedChatId: row.target_resolved_chat_id ?? undefined,
      targetCandidates: safeJsonParse<Array<Record<string, unknown>> | undefined>(
        row.target_candidates_json,
        undefined,
      ),
      renderedQuestion: row.rendered_question,
      renderedContext: row.rendered_context ?? undefined,
      status: row.status,
      requiresApproval: row.requires_approval === 1,
      followupCount: row.followup_count,
      maxFollowup: row.max_followup,
      followupIntervalSeconds: row.followup_interval_seconds,
      waitUntil: row.wait_until ?? undefined,
      nextCheckAt: row.next_check_at ?? undefined,
      sentChatId: row.sent_chat_id ?? undefined,
      sentPostId: row.sent_post_id ?? undefined,
      lastPollAt: row.last_poll_at ?? undefined,
      replyPostId: row.reply_post_id ?? undefined,
      replySender: row.reply_sender ?? undefined,
      replyRawText: row.reply_raw_text ?? undefined,
      replyClassification: row.reply_classification ?? undefined,
      replyConfidence: row.reply_confidence ?? undefined,
      outcome: safeJsonParse<Record<string, unknown> | undefined>(row.outcome_json, undefined),
      errorCode: row.error_code ?? undefined,
      errorMessage: row.error_message ?? undefined,
      terminalSyncedAt: row.terminal_synced_at ?? undefined,
      actionResultId: row.action_result_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at ?? undefined,
    };
  }

  private rowToEvent(row: OutreachEventRow): OutreachEventRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      eventType: row.event_type,
      payload: safeJsonParse<Record<string, unknown> | undefined>(row.payload_json, undefined),
      createdAt: row.created_at,
    };
  }

  upsertTemplate(input: UpsertOutreachTemplateInput): OutreachTemplateRecord {
    const currentTime = now();
    const existing = input.id ? this.getTemplateById(input.id) : null;
    const id = input.id ?? randomUUID();

    this.db
      .prepare(
        `INSERT INTO outreach_templates
          (id, source_kind, source_ref_id, sheet_message_id, title, question_template, context_template,
           target_type, target_ref, schedule_spec_json, enabled, approval_policy, max_followup,
           followup_interval_seconds, sync_state, last_sync_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           source_kind = excluded.source_kind,
           source_ref_id = excluded.source_ref_id,
           sheet_message_id = excluded.sheet_message_id,
           title = excluded.title,
           question_template = excluded.question_template,
           context_template = excluded.context_template,
           target_type = excluded.target_type,
           target_ref = excluded.target_ref,
           schedule_spec_json = excluded.schedule_spec_json,
           enabled = excluded.enabled,
           approval_policy = excluded.approval_policy,
           max_followup = excluded.max_followup,
           followup_interval_seconds = excluded.followup_interval_seconds,
           sync_state = excluded.sync_state,
           last_sync_error = excluded.last_sync_error,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.sourceKind,
        input.sourceRefId ?? null,
        input.sheetMessageId ?? null,
        input.title,
        input.questionTemplate,
        input.contextTemplate ?? null,
        input.targetType,
        input.targetRef,
        JSON.stringify(input.scheduleSpec ?? {}),
        input.enabled === false ? 0 : 1,
        input.approvalPolicy ?? 'manual_direct',
        clampNonNegativeInteger(input.maxFollowup, 1),
        Math.max(1, clampNonNegativeInteger(input.followupIntervalSeconds, 86400)),
        input.syncState ?? 'synced',
        input.lastSyncError ?? null,
        existing?.createdAt ?? currentTime,
        currentTime,
      );

    return this.getTemplateById(id)!;
  }

  getTemplateById(id: string): OutreachTemplateRecord | null {
    const row = this.db
      .prepare(
        `SELECT t.*,
                (
                  SELECT s.id
                  FROM outreach_sessions s
                  WHERE s.template_id = t.id
                  ORDER BY s.created_at DESC
                  LIMIT 1
                ) AS last_session_id
         FROM outreach_templates t
         WHERE t.id = ?`,
      )
      .get(id) as OutreachTemplateRow | undefined;
    return row ? this.rowToTemplate(row) : null;
  }

  getTemplateBySheetMessageId(sheetMessageId: string): OutreachTemplateRecord | null {
    const row = this.db
      .prepare(
        `SELECT t.*,
                (
                  SELECT s.id
                  FROM outreach_sessions s
                  WHERE s.template_id = t.id
                  ORDER BY s.created_at DESC
                  LIMIT 1
                ) AS last_session_id
         FROM outreach_templates t
         WHERE t.sheet_message_id = ?`,
      )
      .get(sheetMessageId) as OutreachTemplateRow | undefined;
    return row ? this.rowToTemplate(row) : null;
  }

  pauseTemplate(id: string): OutreachTemplateRecord | null {
    this.db
      .prepare(
        `UPDATE outreach_templates
         SET enabled = 0, sync_state = 'paused', last_sync_error = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(now(), id);
    return this.getTemplateById(id);
  }

  cancelTemplate(id: string): OutreachTemplateRecord | null {
    this.db
      .prepare(
        `UPDATE outreach_templates
         SET enabled = 0, sync_state = 'cancelled', updated_at = ?
         WHERE id = ?`,
      )
      .run(now(), id);
    return this.getTemplateById(id);
  }

  listTemplates(limit = 100): OutreachTemplateRecord[] {
    const rows = this.db
      .prepare(
        `SELECT t.*,
                (
                  SELECT s.id
                  FROM outreach_sessions s
                  WHERE s.template_id = t.id
                  ORDER BY s.created_at DESC
                  LIMIT 1
                ) AS last_session_id
         FROM outreach_templates t
         ORDER BY t.updated_at DESC, t.created_at DESC
         LIMIT ?`,
      )
      .all(Math.max(1, Math.min(limit, 500))) as OutreachTemplateRow[];
    return rows.map((row) => this.rowToTemplate(row));
  }

  listTemplateRuntimeStatus(ids: string[]): OutreachTemplateRecord[] {
    const sanitized = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
    if (sanitized.length === 0) return [];
    const placeholders = sanitized.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT t.*,
                (
                  SELECT s.id
                  FROM outreach_sessions s
                  WHERE s.template_id = t.id
                  ORDER BY s.created_at DESC
                  LIMIT 1
                ) AS last_session_id
         FROM outreach_templates t
         WHERE t.id IN (${placeholders})`,
      )
      .all(...sanitized) as OutreachTemplateRow[];
    return rows.map((row) => this.rowToTemplate(row));
  }

  listDueTemplates(referenceTs: number, limit = 100): OutreachTemplateRecord[] {
    return this.listTemplates(limit)
      .filter((template) => template.enabled && template.syncState === 'synced')
      .filter((template) => {
        const nextDispatchAt = Number(template.scheduleSpec.nextDispatchAt ?? 0);
        return Number.isFinite(nextDispatchAt) && nextDispatchAt > 0 && nextDispatchAt <= referenceTs;
      });
  }

  markTemplateDispatch(id: string, nextDispatchAt: number | null, lastSessionId: string): OutreachTemplateRecord | null {
    const template = this.getTemplateById(id);
    if (!template) return null;
    const scheduleSpec = { ...template.scheduleSpec };
    if (nextDispatchAt && Number.isFinite(nextDispatchAt) && nextDispatchAt > 0) {
      scheduleSpec.nextDispatchAt = Math.floor(nextDispatchAt);
    } else {
      delete scheduleSpec.nextDispatchAt;
    }
    this.db
      .prepare(
        `UPDATE outreach_templates
         SET schedule_spec_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(JSON.stringify(scheduleSpec), now(), id);
    const updated = this.getTemplateById(id);
    return updated ? { ...updated, lastSessionId } : null;
  }

  createSession(input: CreateOutreachSessionInput): OutreachSessionRecord {
    const id = input.id ?? randomUUID();
    const currentTime = input.createdAt ?? now();

    this.db
      .prepare(
        `INSERT INTO outreach_sessions
          (id, template_id, origin_kind, thread_id, run_id, action_id, channel, target_type, target_ref,
           target_resolution_status, target_resolved_type, target_resolved_id, target_resolved_label,
           target_resolved_chat_id, target_candidates_json, rendered_question, rendered_context,
           status, requires_approval, followup_count, max_followup,
           followup_interval_seconds, wait_until, next_check_at, sent_chat_id, sent_post_id, last_poll_at,
           reply_post_id, reply_sender, reply_raw_text, reply_classification, reply_confidence,
           outcome_json, error_code, error_message, terminal_synced_at, action_result_id,
           created_at, updated_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.templateId ?? null,
        input.originKind,
        input.threadId ?? null,
        input.runId ?? null,
        input.actionId ?? null,
        input.channel ?? 'ringcentral',
        input.targetType,
        input.targetRef,
        input.targetResolutionStatus ?? 'unresolved',
        input.targetResolvedType ?? null,
        input.targetResolvedId ?? null,
        input.targetResolvedLabel ?? null,
        input.targetResolvedChatId ?? null,
        input.targetCandidates ? JSON.stringify(input.targetCandidates) : null,
        input.renderedQuestion,
        input.renderedContext ?? null,
        input.status,
        input.requiresApproval ? 1 : 0,
        clampNonNegativeInteger(input.followupCount, 0),
        clampNonNegativeInteger(input.maxFollowup, 1),
        Math.max(1, clampNonNegativeInteger(input.followupIntervalSeconds, 86400)),
        input.waitUntil ?? null,
        input.nextCheckAt ?? null,
        input.sentChatId ?? null,
        input.sentPostId ?? null,
        input.lastPollAt ?? null,
        input.replyPostId ?? null,
        input.replySender ?? null,
        input.replyRawText ?? null,
        input.replyClassification ?? null,
        input.replyConfidence ?? null,
        input.outcome ? JSON.stringify(input.outcome) : null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.terminalSyncedAt ?? null,
        input.actionResultId ?? null,
        currentTime,
        currentTime,
        input.resolvedAt ?? null,
      );

    return this.getSessionById(id)!;
  }

  getSessionById(id: string): OutreachSessionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM outreach_sessions WHERE id = ?')
      .get(id) as OutreachSessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  getSessionByActionId(actionId: string): OutreachSessionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM outreach_sessions WHERE action_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(actionId) as OutreachSessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  listSessions(filters: OutreachSessionListFilters = {}): {
    items: OutreachSessionRecord[];
    total: number;
    limit: number;
    offset: number;
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);

    const requestedStatuses =
      filters.statuses && filters.statuses.length > 0
        ? filters.statuses
        : filters.status && filters.status !== 'all'
          ? [filters.status]
          : [];
    if (requestedStatuses.length > 0) {
      const placeholders = requestedStatuses.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...requestedStatuses);
    }

    if (filters.originKind) {
      if (filters.originKind === 'manual') {
        conditions.push(`origin_kind IN ('scheduled_template', 'manual_action')`);
      } else if (filters.originKind === 'reflection') {
        conditions.push(`origin_kind = 'reflection_action'`);
      } else {
        conditions.push('origin_kind = ?');
        params.push(filters.originKind);
      }
    }

    if (filters.templateId) {
      conditions.push('template_id = ?');
      params.push(filters.templateId);
    }
    if (filters.threadId) {
      conditions.push('thread_id = ?');
      params.push(filters.threadId);
    }
    if (filters.actionId) {
      conditions.push('action_id = ?');
      params.push(filters.actionId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT *
         FROM outreach_sessions
         ${whereClause}
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as OutreachSessionRow[];
    const total = (this.db
      .prepare(`SELECT COUNT(*) AS count FROM outreach_sessions ${whereClause}`)
      .get(...params) as CountRow).count;

    return {
      items: rows.map((row) => this.rowToSession(row)),
      total,
      limit,
      offset,
    };
  }

  listPendingSessions(referenceTs: number, limit = 200): OutreachSessionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM outreach_sessions
         WHERE status IN ('scheduled', 'waiting_reply', 'deferred')
           AND next_check_at IS NOT NULL
           AND next_check_at <= ?
         ORDER BY next_check_at ASC, created_at ASC
         LIMIT ?`,
      )
      .all(referenceTs, Math.max(1, Math.min(limit, 500))) as OutreachSessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  listTerminalUnsyncedReflectionSessions(limit = 200): OutreachSessionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM outreach_sessions
         WHERE origin_kind = 'reflection_action'
           AND status IN ('resolved', 'no_reply', 'escalated', 'failed', 'cancelled')
           AND terminal_synced_at IS NULL
         ORDER BY resolved_at ASC, updated_at ASC
         LIMIT ?`,
      )
      .all(Math.max(1, Math.min(limit, 500))) as OutreachSessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  updateSession(id: string, input: UpdateOutreachSessionInput): OutreachSessionRecord | null {
    const existing = this.getSessionById(id);
    if (!existing) return null;

    this.db
      .prepare(
        `UPDATE outreach_sessions
         SET target_type = ?,
             target_ref = ?,
             target_resolution_status = ?,
             target_resolved_type = ?,
             target_resolved_id = ?,
             target_resolved_label = ?,
             target_resolved_chat_id = ?,
             target_candidates_json = ?,
             rendered_question = ?,
             rendered_context = ?,
             status = ?,
             requires_approval = ?,
             followup_count = ?,
             max_followup = ?,
             followup_interval_seconds = ?,
             wait_until = ?,
             next_check_at = ?,
             sent_chat_id = ?,
             sent_post_id = ?,
             last_poll_at = ?,
             reply_post_id = ?,
             reply_sender = ?,
             reply_raw_text = ?,
             reply_classification = ?,
             reply_confidence = ?,
             outcome_json = ?,
             error_code = ?,
             error_message = ?,
             terminal_synced_at = ?,
             action_result_id = ?,
             resolved_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.targetType ?? existing.targetType,
        input.targetRef ?? existing.targetRef,
        input.targetResolutionStatus ?? existing.targetResolutionStatus,
        input.targetResolvedType === undefined ? existing.targetResolvedType ?? null : input.targetResolvedType,
        input.targetResolvedId === undefined ? existing.targetResolvedId ?? null : input.targetResolvedId,
        input.targetResolvedLabel === undefined
          ? existing.targetResolvedLabel ?? null
          : input.targetResolvedLabel,
        input.targetResolvedChatId === undefined
          ? existing.targetResolvedChatId ?? null
          : input.targetResolvedChatId,
        input.targetCandidates === undefined
          ? existing.targetCandidates
            ? JSON.stringify(existing.targetCandidates)
            : null
          : input.targetCandidates
            ? JSON.stringify(input.targetCandidates)
            : null,
        input.renderedQuestion ?? existing.renderedQuestion,
        input.renderedContext === undefined
          ? existing.renderedContext ?? null
          : input.renderedContext,
        input.status ?? existing.status,
        (input.requiresApproval ?? existing.requiresApproval) ? 1 : 0,
        input.followupCount ?? existing.followupCount,
        input.maxFollowup ?? existing.maxFollowup,
        input.followupIntervalSeconds ?? existing.followupIntervalSeconds,
        input.waitUntil === undefined ? existing.waitUntil ?? null : input.waitUntil,
        input.nextCheckAt === undefined ? existing.nextCheckAt ?? null : input.nextCheckAt,
        input.sentChatId === undefined ? existing.sentChatId ?? null : input.sentChatId,
        input.sentPostId === undefined ? existing.sentPostId ?? null : input.sentPostId,
        input.lastPollAt === undefined ? existing.lastPollAt ?? null : input.lastPollAt,
        input.replyPostId === undefined ? existing.replyPostId ?? null : input.replyPostId,
        input.replySender === undefined ? existing.replySender ?? null : input.replySender,
        input.replyRawText === undefined ? existing.replyRawText ?? null : input.replyRawText,
        input.replyClassification === undefined
          ? existing.replyClassification ?? null
          : input.replyClassification,
        input.replyConfidence === undefined ? existing.replyConfidence ?? null : input.replyConfidence,
        input.outcome === undefined
          ? existing.outcome
            ? JSON.stringify(existing.outcome)
            : null
          : input.outcome
            ? JSON.stringify(input.outcome)
            : null,
        input.errorCode === undefined ? existing.errorCode ?? null : input.errorCode,
        input.errorMessage === undefined ? existing.errorMessage ?? null : input.errorMessage,
        input.terminalSyncedAt === undefined
          ? existing.terminalSyncedAt ?? null
          : input.terminalSyncedAt,
        input.actionResultId === undefined ? existing.actionResultId ?? null : input.actionResultId,
        input.resolvedAt === undefined ? existing.resolvedAt ?? null : input.resolvedAt,
        now(),
        id,
      );

    return this.getSessionById(id);
  }

  createEvent(
    sessionId: string,
    eventType: OutreachEventType,
    payload?: Record<string, unknown>,
    _message?: string,
  ): OutreachEventRecord {
    const id = randomUUID();
    const createdAt = now();
    this.db
      .prepare(
        `INSERT INTO outreach_events
          (id, session_id, event_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, sessionId, eventType, payload ? JSON.stringify(payload) : null, createdAt);
    return {
      id,
      sessionId,
      eventType,
      payload,
      createdAt,
    };
  }

  listEventsBySession(sessionId: string, limit = 200): OutreachEventRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM outreach_events
         WHERE session_id = ?
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(sessionId, Math.max(1, Math.min(limit, 1000))) as OutreachEventRow[];
    return rows.map((row) => this.rowToEvent(row));
  }

  getSummary(): OutreachSummary {
    const countByStatus = (statuses: OutreachSessionStatus[]) => {
      const placeholders = statuses.map(() => '?').join(', ');
      return (this.db
        .prepare(`SELECT COUNT(*) AS count FROM outreach_sessions WHERE status IN (${placeholders})`)
        .get(...statuses) as CountRow).count;
    };

    return {
      upcomingCount: countByStatus(['pending_approval', 'scheduled']),
      waitingReplyCount: countByStatus(['waiting_reply', 'deferred']),
      escalatedCount: countByStatus(['escalated']),
      pendingApprovalCount: countByStatus(['pending_approval']),
    };
  }
}
