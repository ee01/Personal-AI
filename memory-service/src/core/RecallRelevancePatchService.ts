import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type {
  ContextRecallMatch,
  ContextRecallRequest,
} from '../types/index.js';
import { now } from '../utils/time.js';

export type RecallRelevanceFeedbackTargetType =
  | 'message'
  | 'chunk'
  | 'entity'
  | 'source_memory'
  | 'rehearsal';

export type RecallRelevanceFeedbackAction =
  | 'positive'
  | 'negative'
  | 'clear';

export interface RecallRelevanceFeedbackInput {
  userId?: string;
  source?: string;
  targetType: RecallRelevanceFeedbackTargetType;
  targetId: string;
  action: RecallRelevanceFeedbackAction;
  detail?: string | Record<string, unknown>;
  reason?: string;
  surface?: string;
  scope?: string;
  scene?: Record<string, unknown>;
  autoApplied?: boolean;
  userNote?: string;
}

export interface RecallRelevancePatchRecord {
  id: string;
  userId: string;
  status: 'active' | 'pending_confirm' | 'paused' | 'deleted';
  source: string;
  sceneSignature: string;
  scene: RecallRelevanceScene;
  targetType: RecallRelevanceFeedbackTargetType;
  targetId: string;
  reason: string;
  action: 'hide_for_scene' | 'demote_for_scene';
  scope: 'scene_only' | 'same_group' | 'same_project';
  autoApplied: boolean;
  userNote?: string;
  evidence: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface RecallPatchReplay {
  id: string;
  patchId: string;
  before: Array<Record<string, unknown>>;
  after: Array<Record<string, unknown>>;
  changed: boolean;
  warnings: string[];
  createdAt: number;
}

export interface RecallRelevanceRecordResult {
  status: 'patched' | 'cleared' | 'ignored';
  patch?: RecallRelevancePatchRecord;
  replay?: RecallPatchReplay;
  trainingCaseId?: string;
  clearedPatchIds?: string[];
}

interface RecallRelevanceScene {
  surface?: string;
  contextType?: string;
  host?: string;
  url?: string;
  urlPath?: string;
  title?: string;
  sceneAnchorSignature?: string;
  groupId?: string;
  conversationId?: string;
  issueKey?: string;
  meetingId?: string;
  query?: string;
  sourceLabel?: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

interface RecallRelevancePatchRow {
  id: string;
  user_id: string;
  status: string;
  source: string;
  scene_signature: string;
  scene_json: string;
  target_type: RecallRelevanceFeedbackTargetType;
  target_id: string;
  reason: string;
  action: 'hide_for_scene' | 'demote_for_scene';
  scope: 'scene_only' | 'same_group' | 'same_project';
  auto_applied: number;
  user_note?: string | null;
  evidence_json: string;
  created_at: number;
  updated_at: number;
  expires_at?: number | null;
}

const DEFAULT_USER_ID = 'default';
const DEFAULT_REASON = 'generic_topic_overlap';
const MAX_ACTIVE_PATCHES = 200;

export class RecallRelevancePatchService {
  constructor(
    private db: Database.Database,
    private userId: string = DEFAULT_USER_ID,
  ) {}

  recordFeedback(
    input: RecallRelevanceFeedbackInput,
  ): RecallRelevanceRecordResult {
    const userId = normalizeText(input.userId) || this.userId || DEFAULT_USER_ID;
    const targetId = normalizeTargetId(input.targetType, input.targetId);
    if (!targetId) return { status: 'ignored' };

    const detail = normalizeDetail(input.detail);
    const scene = buildSceneFromFeedback(input, detail);
    const sceneSignature = buildSceneSignature(scene);

    if (input.action !== 'negative') {
      const clearedPatchIds = this.clearTargetPatches({
        userId,
        targetType: input.targetType,
        targetId,
        sceneSignature,
      });
      return {
        status: clearedPatchIds.length ? 'cleared' : 'ignored',
        clearedPatchIds,
      };
    }

    const createdAt = now();
    const reason =
      normalizeText(input.reason) ||
      normalizeText(detail.feedback_reason) ||
      DEFAULT_REASON;
    const scope = choosePatchScope(scene);
    const patchAction = choosePatchAction(reason);
    const autoApplied =
      typeof input.autoApplied === 'boolean'
        ? input.autoApplied
        : parseBoolean(detail.auto_applied, true);
    const patchStatus = autoApplied ? 'active' : 'pending_confirm';
    const userNote =
      normalizeText(input.userNote) || normalizeText(detail.feedback_note);
    const evidence = buildEvidenceSnapshot(input, detail);

    const existing = this.db
      .prepare(
        `SELECT *
         FROM recall_relevance_patches
         WHERE user_id = ?
           AND target_type = ?
           AND target_id = ?
           AND scene_signature = ?
           AND status IN ('active', 'pending_confirm', 'paused')
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(
        userId,
        input.targetType,
        targetId,
        sceneSignature,
      ) as RecallRelevancePatchRow | undefined;

    const patchId = existing?.id ?? randomUUID();
    if (existing) {
      this.db
        .prepare(
          `UPDATE recall_relevance_patches
           SET status = ?,
               source = ?,
               scene_json = ?,
               reason = ?,
               action = ?,
               scope = ?,
               auto_applied = ?,
               user_note = ?,
               evidence_json = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(
          patchStatus,
          normalizeText(input.source) || 'feedback_api',
          JSON.stringify(scene),
          reason,
          patchAction,
          scope,
          autoApplied ? 1 : 0,
          userNote || null,
          JSON.stringify(evidence),
          createdAt,
          patchId,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO recall_relevance_patches
             (id, user_id, status, source, scene_signature, scene_json,
              target_type, target_id, reason, action, scope, auto_applied,
              user_note, evidence_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          patchId,
          userId,
          patchStatus,
          normalizeText(input.source) || 'feedback_api',
          sceneSignature,
          JSON.stringify(scene),
          input.targetType,
          targetId,
          reason,
          patchAction,
          scope,
          autoApplied ? 1 : 0,
          userNote || null,
          JSON.stringify(evidence),
          createdAt,
          createdAt,
        );
    }

    const replay = this.createReplay({
      patchId,
      targetType: input.targetType,
      targetId,
      action: patchAction,
      detail,
    });
    const trainingCaseId = this.createTrainingCase({
      patchId,
      scene,
      targetType: input.targetType,
      targetId,
      reason,
      userNote,
    });
    const patch = this.getPatchById(patchId);

    return {
      status: 'patched',
      patch,
      replay,
      trainingCaseId,
    };
  }

  listPatches(status?: string): RecallRelevancePatchRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM recall_relevance_patches
         WHERE user_id = ?
           AND (? IS NULL OR status = ?)
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(this.userId, status ?? null, status ?? null, MAX_ACTIVE_PATCHES) as
      RecallRelevancePatchRow[];
    return rows.map(mapPatchRow);
  }

  updatePatchStatus(
    patchId: string,
    status: 'active' | 'paused' | 'deleted',
  ): RecallRelevancePatchRecord | undefined {
    const updatedAt = now();
    const result = this.db
      .prepare(
        `UPDATE recall_relevance_patches
         SET status = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(status, updatedAt, patchId, this.userId);
    if (result.changes === 0) return undefined;
    return this.getPatchById(patchId);
  }

  getPatchById(patchId: string): RecallRelevancePatchRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT *
         FROM recall_relevance_patches
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
      )
      .get(patchId, this.userId) as RecallRelevancePatchRow | undefined;
    return row ? mapPatchRow(row) : undefined;
  }

  applyPatchesToMatches(
    request: ContextRecallRequest,
    matches: ContextRecallMatch[],
  ): ContextRecallMatch[] {
    if (matches.length === 0) return matches;

    const requestScene = buildSceneFromRequest(request);
    const requestSceneSignature = buildSceneSignature(requestScene);
    const patches = this.getActivePatches();
    if (patches.length === 0) return matches;

    return matches.map((match) => {
      const patch = patches.find(
        (candidate) =>
          patchTargetsMatch(candidate, match) &&
          patchSceneMatches(candidate, requestScene, requestSceneSignature),
      );
      if (!patch) return match;

      const score = Number.isFinite(match.score)
        ? Math.max(0, Math.min(0.99, match.score - 0.35))
        : match.score;
      const metadata = {
        ...(match.metadata ?? {}),
        relevancePatch: {
          id: patch.id,
          reason: patch.reason,
          sceneSignature: patch.sceneSignature,
          action: patch.action,
          appliedAt: now(),
        },
      };

      if (patch.action === 'demote_for_scene') {
        return {
          ...match,
          score,
          displayPriority:
            match.displayPriority === 'hidden' ? 'hidden' : 'p2',
          metadata,
        };
      }

      return {
        ...match,
        score,
        displayPriority: 'hidden',
        suppressionReason: 'user_relevance_patch',
        metadata,
      };
    });
  }

  private getActivePatches(): RecallRelevancePatchRecord[] {
    const currentTime = now();
    const rows = this.db
      .prepare(
        `SELECT *
         FROM recall_relevance_patches
         WHERE user_id = ?
           AND status = 'active'
           AND auto_applied = 1
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(this.userId, currentTime, MAX_ACTIVE_PATCHES) as
      RecallRelevancePatchRow[];
    return rows.map(mapPatchRow);
  }

  private clearTargetPatches(input: {
    userId: string;
    targetType: RecallRelevanceFeedbackTargetType;
    targetId: string;
    sceneSignature?: string;
  }): string[] {
    const conditions = [
      'user_id = ?',
      'target_type = ?',
      'target_id = ?',
      "status IN ('active', 'pending_confirm', 'paused')",
    ];
    const params: unknown[] = [
      input.userId,
      input.targetType,
      input.targetId,
    ];
    if (input.sceneSignature) {
      conditions.push('scene_signature = ?');
      params.push(input.sceneSignature);
    }
    const rows = this.db
      .prepare(
        `SELECT id
         FROM recall_relevance_patches
         WHERE ${conditions.join(' AND ')}`,
      )
      .all(...params) as Array<{ id: string }>;
    if (rows.length === 0) return [];

    this.db
      .prepare(
        `UPDATE recall_relevance_patches
         SET status = 'deleted', updated_at = ?
         WHERE id IN (${rows.map(() => '?').join(',')})`,
      )
      .run(now(), ...rows.map((row) => row.id));
    return rows.map((row) => row.id);
  }

  private createReplay(input: {
    patchId: string;
    targetType: RecallRelevanceFeedbackTargetType;
    targetId: string;
    action: RecallRelevancePatchRecord['action'];
    detail: Record<string, unknown>;
  }): RecallPatchReplay {
    const replayId = randomUUID();
    const createdAt = now();
    const previousPriority =
      normalizeText(input.detail.display_priority) || 'shown';
    const before = [
      {
        targetType: input.targetType,
        targetId: input.targetId,
        displayPriority: previousPriority,
      },
    ];
    const afterPriority =
      input.action === 'hide_for_scene' ? 'hidden' : 'p2';
    const after = [
      {
        targetType: input.targetType,
        targetId: input.targetId,
        displayPriority: afterPriority,
        suppressionReason:
          input.action === 'hide_for_scene'
            ? 'user_relevance_patch'
            : undefined,
      },
    ];
    this.db
      .prepare(
        `INSERT INTO recall_patch_runs
          (id, patch_id, before_json, after_json, changed, warnings_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        replayId,
        input.patchId,
        JSON.stringify(before),
        JSON.stringify(after),
        1,
        '[]',
        createdAt,
      );
    return {
      id: replayId,
      patchId: input.patchId,
      before,
      after,
      changed: true,
      warnings: [],
      createdAt,
    };
  }

  private createTrainingCase(input: {
    patchId: string;
    scene: RecallRelevanceScene;
    targetType: RecallRelevanceFeedbackTargetType;
    targetId: string;
    reason: string;
    userNote?: string;
  }): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO recall_training_cases
          (id, patch_id, suite, scene_input_json, rejected_target_refs_json,
           expected_behavior, human_label_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.patchId,
        'memory-relevance-trainer',
        JSON.stringify(input.scene),
        JSON.stringify([
          { targetType: input.targetType, targetId: input.targetId },
        ]),
        'Do not show this rejected target in the same scene unless stronger anchors appear.',
        JSON.stringify({
          reason: input.reason,
          userNote: input.userNote,
        }),
        now(),
      );
    return id;
  }
}

function buildEvidenceSnapshot(
  input: RecallRelevanceFeedbackInput,
  detail: Record<string, unknown>,
): Record<string, unknown> {
  return removeEmptyValues({
    detailVersion: detail.version,
    interaction: detail.interaction,
    action: input.action,
    sourceLabel: detail.source_label,
    sourceTitle: detail.source_title,
    sourceUrl: detail.source_url,
    reasonType: detail.reason_type,
    evidenceRole: detail.evidence_role,
    displayPriority: detail.display_priority,
  });
}

function buildSceneFromFeedback(
  input: RecallRelevanceFeedbackInput,
  detail: Record<string, unknown>,
): RecallRelevanceScene {
  const merged = {
    ...detail,
    ...(input.scene ?? {}),
  };
  const url =
    normalizeText(merged.current_url) ||
    normalizeText(merged.url) ||
    normalizeText(merged.source_url);
  const sourceUrl = normalizeText(merged.source_url);
  return removeEmptyValues({
    surface: normalizeText(input.surface) || normalizeText(merged.surface),
    contextType: normalizeText(merged.context_type) || normalizeText(merged.contextType),
    host: normalizeText(merged.host) || extractHost(url || sourceUrl),
    url,
    urlPath: extractUrlPath(url),
    title:
      normalizeText(merged.current_title) ||
      normalizeText(merged.title),
    sceneAnchorSignature:
      normalizeText(merged.scene_anchor_signature) ||
      normalizeText(merged.sceneAnchorSignature),
    groupId: normalizeText(merged.group_id) || normalizeText(merged.groupId),
    conversationId:
      normalizeText(merged.conversation_id) ||
      normalizeText(merged.conversationId),
    issueKey: normalizeText(merged.issue_key) || normalizeText(merged.issueKey),
    meetingId:
      normalizeText(merged.meeting_id) || normalizeText(merged.meetingId),
    query: normalizeText(merged.query),
    sourceLabel: normalizeText(merged.source_label),
    sourceTitle: normalizeText(merged.source_title),
    sourceUrl,
  }) as RecallRelevanceScene;
}

function buildSceneFromRequest(
  request: ContextRecallRequest,
): RecallRelevanceScene {
  const url =
    normalizeText(request.currentContext?.url) ||
    normalizeText(request.url) ||
    normalizeText(request.sourceContext?.url);
  return removeEmptyValues({
    surface: request.surface,
    contextType: request.contextType,
    host: normalizeText(request.sourceContext?.host) || extractHost(url),
    url,
    urlPath: extractUrlPath(url),
    title:
      normalizeText(request.currentContext?.title) ||
      normalizeText(request.title) ||
      normalizeText(request.sourceContext?.title),
    groupId:
      normalizeText(request.currentContext?.groupId) ||
      normalizeText(request.sourceContext?.groupId),
    conversationId:
      normalizeText(request.currentContext?.conversationId) ||
      normalizeText(request.sourceContext?.conversationId),
    issueKey:
      normalizeText(request.currentContext?.issueKey) ||
      normalizeText(request.sourceContext?.issueKey),
    meetingId:
      normalizeText(request.currentContext?.meetingId) ||
      normalizeText(request.sourceContext?.meetingId),
    query: normalizeText(request.primaryText || request.title),
  }) as RecallRelevanceScene;
}

function buildSceneSignature(scene: RecallRelevanceScene): string {
  const explicit = normalizeText(scene.sceneAnchorSignature);
  if (explicit) return explicit.slice(0, 220);

  const parts = [
    scene.surface ? `surface:${scene.surface}` : '',
    scene.contextType ? `context:${scene.contextType}` : '',
    scene.groupId ? `group:${scene.groupId}` : '',
    scene.conversationId ? `conversation:${scene.conversationId}` : '',
    scene.issueKey ? `issue:${scene.issueKey}` : '',
    scene.meetingId ? `meeting:${scene.meetingId}` : '',
    scene.host ? `host:${scene.host}` : '',
    scene.urlPath ? `path:${scene.urlPath}` : '',
    scene.title ? `title:${scene.title.slice(0, 80)}` : '',
    scene.query ? `query:${scene.query.slice(0, 80)}` : '',
  ].filter(Boolean);

  return parts.length ? parts.join('|').slice(0, 260) : 'scene:unknown';
}

function choosePatchScope(
  scene: RecallRelevanceScene,
): RecallRelevancePatchRecord['scope'] {
  if (scene.groupId || scene.conversationId) return 'same_group';
  if (scene.issueKey) return 'same_project';
  return 'scene_only';
}

function choosePatchAction(
  reason: string,
): RecallRelevancePatchRecord['action'] {
  if (reason === 'generic_topic_overlap') return 'hide_for_scene';
  if (reason === 'search_context_mismatch') return 'hide_for_scene';
  if (reason === 'should_not_use_for_reply') return 'hide_for_scene';
  return 'hide_for_scene';
}

function patchTargetsMatch(
  patch: RecallRelevancePatchRecord,
  match: ContextRecallMatch,
): boolean {
  if (patch.targetType !== match.type) return false;
  const ids = new Set<string>();
  ids.add(normalizeTargetId(match.type, match.id));
  for (const mergedId of match.mergedIds ?? []) {
    ids.add(normalizeTargetId(match.type, mergedId));
  }
  const sourceMemoryId = normalizeTargetId(
    'source_memory',
    match.metadata?.sourceMemoryCapsuleId,
  );
  if (sourceMemoryId) ids.add(sourceMemoryId);
  return ids.has(patch.targetId);
}

function patchSceneMatches(
  patch: RecallRelevancePatchRecord,
  requestScene: RecallRelevanceScene,
  requestSceneSignature: string,
): boolean {
  if (
    patch.sceneSignature &&
    patch.sceneSignature !== 'scene:unknown' &&
    patch.sceneSignature === requestSceneSignature
  ) {
    return true;
  }

  if (patch.scope === 'same_group') {
    return Boolean(
      sameText(patch.scene.groupId, requestScene.groupId) ||
        sameText(patch.scene.conversationId, requestScene.conversationId),
    );
  }

  if (patch.scope === 'same_project') {
    return sameText(patch.scene.issueKey, requestScene.issueKey);
  }

  if (sameText(patch.scene.meetingId, requestScene.meetingId)) return true;
  if (sameText(patch.scene.issueKey, requestScene.issueKey)) return true;
  if (sameText(patch.scene.conversationId, requestScene.conversationId)) {
    return true;
  }
  if (sameText(patch.scene.groupId, requestScene.groupId)) return true;
  if (
    sameText(patch.scene.host, requestScene.host) &&
    sameText(patch.scene.urlPath, requestScene.urlPath)
  ) {
    return true;
  }

  return false;
}

function mapPatchRow(row: RecallRelevancePatchRow): RecallRelevancePatchRecord {
  return {
    id: row.id,
    userId: row.user_id,
    status: normalizePatchStatus(row.status),
    source: row.source,
    sceneSignature: row.scene_signature,
    scene: parseJsonObject(row.scene_json) as RecallRelevanceScene,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    action: row.action,
    scope: row.scope,
    autoApplied: row.auto_applied === 1,
    userNote: row.user_note ?? undefined,
    evidence: parseJsonObject(row.evidence_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

function normalizePatchStatus(
  status: string,
): RecallRelevancePatchRecord['status'] {
  if (
    status === 'active' ||
    status === 'pending_confirm' ||
    status === 'paused' ||
    status === 'deleted'
  ) {
    return status;
  }
  return 'active';
}

function normalizeDetail(
  detail?: string | Record<string, unknown>,
): Record<string, unknown> {
  if (!detail) return {};
  if (typeof detail === 'object' && !Array.isArray(detail)) return detail;
  if (typeof detail !== 'string') return {};
  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { note: detail.slice(0, 500) };
  }
  return {};
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeTargetId(
  targetType: RecallRelevanceFeedbackTargetType,
  targetId: unknown,
): string {
  const cleaned = normalizeText(targetId);
  if (targetType === 'source_memory') {
    return cleaned.replace(/^source-memory:/, '');
  }
  return cleaned;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function extractHost(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function extractUrlPath(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search ? parsed.search : ''}`.slice(
      0,
      180,
    );
  } catch {
    return '';
  }
}

function sameText(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function removeEmptyValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (typeof entry === 'string' && !entry.trim()) return false;
      return true;
    }),
  ) as T;
}
