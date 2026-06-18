import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { SkillLibraryService } from './SkillLibraryService.js';
import type { ContextCue, SceneFrame } from '../types/index.js';
import { now } from '../utils/time.js';

export type MemoryOutcomeSurface =
  | 'compose_assist'
  | 'memory_lens'
  | 'today_pilot'
  | 'meeting_pilot'
  | 'ask'
  | 'search'
  | 'relationship_radar'
  | 'user_profile'
  | 'memory_capture';

export type MemoryOutcomePolicyAction =
  | 'boost'
  | 'suppress'
  | 'send_to_skill_foundry';

export interface MemoryOutcomeCueRef {
  id?: string;
  cueId?: string;
  cueKey?: string;
  actionType?: string;
  compileStatus?: string;
  confidence?: number;
  whyNow?: string;
}

export interface MemoryOutcomeEvidenceRef {
  id: string;
  type?: string;
  title?: string;
  sourceLabel?: string;
  role?: string;
  score?: number;
  cueId?: string;
  cueKey?: string;
  cue?: MemoryOutcomeCueRef;
}

export interface MemoryOutcomeTraceInput {
  id?: string;
  sourceTraceId?: string;
  surface: MemoryOutcomeSurface;
  sceneKey: string;
  sourceRequestId?: string;
  action: string;
  strength: string;
  polarity: string;
  evidenceRefs?: MemoryOutcomeEvidenceRef[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface MemoryOutcomeFeedbackInput {
  id?: string;
  surface: 'memory_lens';
  sceneKey?: string;
  targetId: string;
  targetType?: string;
  action: 'positive' | 'negative';
  detail?: string | null;
  createdAt?: number;
}

export interface MemoryOutcomePolicyPatch {
  id: string;
  cueKey: string;
  sceneKey: string;
  surface: MemoryOutcomeSurface | string;
  action: MemoryOutcomePolicyAction;
  reasonCodes: string[];
  strength: number;
  positiveCount: number;
  negativeCount: number;
  signalCount: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
}

export interface ContextCueOutcomePolicy {
  action: MemoryOutcomePolicyAction;
  patchId: string;
  strength: number;
  reasonCodes: string[];
  positiveCount: number;
  negativeCount: number;
  signalCount: number;
  expiresAt?: number;
}

interface CueAggregate {
  positiveScore: number;
  negativeScore: number;
  positiveCount: number;
  negativeCount: number;
  signalCount: number;
  sentAfterInsertCount: number;
  insertedCount: number;
  expandedCount: number;
  wrongCount: number;
  deletedBeforeSendCount: number;
  latestAt: number;
}

interface OutcomeEventRow {
  action: string;
  polarity: string;
  strength: string;
  created_at: number;
}

interface PolicyPatchRow {
  id: string;
  cue_key: string;
  scene_key: string;
  surface: string;
  action: MemoryOutcomePolicyAction;
  reason_codes_json: string;
  strength: number;
  positive_count: number;
  negative_count: number;
  signal_count: number;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
  revoked_at: number | null;
}

const POLICY_TTL_SECONDS = 14 * 24 * 60 * 60;
const SUPPRESS_TTL_SECONDS = 7 * 24 * 60 * 60;

export class MemoryOutcomeLoopService {
  constructor(
    private readonly db: Database.Database,
    private readonly userId = 'default',
  ) {}

  processAmbientTrace(input: MemoryOutcomeTraceInput): {
    cueEventCount: number;
    patches: MemoryOutcomePolicyPatch[];
    skillSuggestionIds: string[];
  } {
    const cueRefs = collectCueRefs(input);
    if (!cueRefs.length) {
      return { cueEventCount: 0, patches: [], skillSuggestionIds: [] };
    }

    const timestamp = normalizeTimestamp(input.createdAt);
    const patches: MemoryOutcomePolicyPatch[] = [];
    const skillSuggestionIds: string[] = [];

    for (const cueRef of cueRefs) {
      const cueKey = cueRef.cueKey || cueRef.cueId;
      if (!cueKey) continue;
      this.insertOutcomeEvent({
        id: input.id ? `${input.id}:${stableHash(cueKey)}` : undefined,
        sourceTraceId: input.id,
        surface: input.surface,
        sceneKey: input.sceneKey,
        cueId: cueRef.cueId,
        cueKey,
        action: input.action,
        polarity: input.polarity,
        strength: input.strength,
        evidenceRefs: input.evidenceRefs,
        metadata: {
          ...(input.metadata ?? {}),
          sourceRequestId: input.sourceRequestId,
          cue: cueRef,
        },
        createdAt: timestamp,
      });

      const update = this.recomputePolicyForCue({
        cueKey,
        sceneKey: input.sceneKey,
        surface: input.surface,
        timestamp,
      });
      patches.push(...update.patches);
      skillSuggestionIds.push(...update.skillSuggestionIds);
    }

    return { cueEventCount: cueRefs.length, patches, skillSuggestionIds };
  }

  processRecallFeedback(input: MemoryOutcomeFeedbackInput): {
    cueEventCount: number;
    patches: MemoryOutcomePolicyPatch[];
  } {
    const detail = parseJsonObject(input.detail);
    const cueId = getString(detail?.cue_id) || getString(detail?.cueId);
    const cueKey =
      getString(detail?.cue_key) ||
      getString(detail?.cueKey) ||
      getString(detail?.cue_id) ||
      getString(detail?.cueId);
    if (!cueKey && !cueId) {
      return { cueEventCount: 0, patches: [] };
    }

    const sceneKey =
      input.sceneKey ||
      getString(detail?.scene_anchor_signature) ||
      getString(detail?.sceneKey) ||
      getString(detail?.current_url) ||
      `memory_lens:${input.targetType || 'memory'}:${input.targetId}`;
    const timestamp = normalizeTimestamp(input.createdAt);
    const polarity = input.action === 'negative' ? 'negative' : 'positive';
    const strength = input.action === 'negative' ? 'strong' : 'medium';

    this.insertOutcomeEvent({
      id: input.id,
      surface: input.surface,
      sceneKey,
      cueId,
      cueKey: cueKey || cueId,
      action:
        input.action === 'negative' ? 'marked_irrelevant' : 'marked_relevant',
      polarity,
      strength,
      evidenceRefs: [
        {
          id: input.targetId,
          type: input.targetType,
          role: input.action === 'negative' ? 'rejected' : 'used',
          cueId,
          cueKey: cueKey || cueId,
        },
      ],
      metadata: {
        feedbackDetail: detail,
      },
      createdAt: timestamp,
    });

    const update = this.recomputePolicyForCue({
      cueKey: cueKey || cueId!,
      sceneKey,
      surface: input.surface,
      timestamp,
    });
    return { cueEventCount: 1, patches: update.patches };
  }

  getCuePolicy(input: {
    cueKey?: string;
    surface: string;
    sceneKey?: string;
    timestamp?: number;
  }): ContextCueOutcomePolicy | undefined {
    const cueKey = normalizePolicyText(input.cueKey);
    if (!cueKey) return undefined;
    const timestamp = input.timestamp ?? now();
    const rows = this.db
      .prepare(
        `SELECT *
           FROM memory_outcome_policy_patches
          WHERE cue_key = ?
            AND surface = ?
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY
            CASE WHEN scene_key = ? THEN 0 ELSE 1 END,
            CASE action WHEN 'suppress' THEN 0 WHEN 'boost' THEN 1 ELSE 2 END,
            strength DESC,
            updated_at DESC
          LIMIT 1`,
      )
      .all(
        cueKey,
        input.surface,
        timestamp,
        normalizePolicyText(input.sceneKey) || '',
      ) as PolicyPatchRow[];
    const row = rows[0];
    if (!row) return undefined;
    return {
      action: row.action,
      patchId: row.id,
      strength: row.strength,
      reasonCodes: parseJsonStringArray(row.reason_codes_json),
      positiveCount: row.positive_count,
      negativeCount: row.negative_count,
      signalCount: row.signal_count,
      expiresAt: row.expires_at ?? undefined,
    };
  }

  listPolicyPatches(limit = 50): MemoryOutcomePolicyPatch[] {
    const rows = this.db
      .prepare(
        `SELECT *
           FROM memory_outcome_policy_patches
          ORDER BY updated_at DESC
          LIMIT ?`,
      )
      .all(Math.max(1, Math.min(200, Math.floor(limit)))) as PolicyPatchRow[];
    return rows.map(mapPatchRow);
  }

  revokePolicyPatch(id: string): MemoryOutcomePolicyPatch | null {
    const timestamp = now();
    this.db
      .prepare(
        `UPDATE memory_outcome_policy_patches
            SET revoked_at = ?, updated_at = ?
          WHERE id = ? AND revoked_at IS NULL`,
      )
      .run(timestamp, timestamp, id);
    const row = this.db
      .prepare(`SELECT * FROM memory_outcome_policy_patches WHERE id = ?`)
      .get(id) as PolicyPatchRow | undefined;
    return row ? mapPatchRow(row) : null;
  }

  getSummary(windowDays = 7): {
    windowDays: number;
    cueEvents: number;
    activePatches: number;
    skillSuggestions: number;
  } {
    const cutoff = now() - Math.max(1, Math.min(90, windowDays)) * 24 * 60 * 60;
    const cueEvents = this.db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM memory_outcome_events
          WHERE cue_key IS NOT NULL AND created_at >= ?`,
      )
      .get(cutoff) as { count: number };
    const activePatches = this.db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM memory_outcome_policy_patches
          WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(now()) as { count: number };
    const skillSuggestions = this.db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM personal_skills
          WHERE status = 'suggestion'
            AND suggested_from = 'memory_outcome_loop'`,
      )
      .get() as { count: number };
    return {
      windowDays,
      cueEvents: cueEvents.count,
      activePatches: activePatches.count,
      skillSuggestions: skillSuggestions.count,
    };
  }

  private insertOutcomeEvent(input: {
    id?: string;
    sourceTraceId?: string;
    surface: string;
    sceneKey: string;
    cueId?: string;
    cueKey?: string;
    action: string;
    polarity: string;
    strength: string;
    evidenceRefs?: unknown;
    metadata?: Record<string, unknown>;
    createdAt: number;
  }): void {
    const cueKey = normalizePolicyText(input.cueKey);
    const sceneKey = normalizePolicyText(input.sceneKey) || 'unknown';
    if (!cueKey) return;
    this.db
      .prepare(
        `INSERT OR IGNORE INTO memory_outcome_events
          (id, source_trace_id, surface, scene_key, cue_id, cue_key, action,
           polarity, strength, evidence_refs_json, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id || randomUUID(),
        input.sourceTraceId || null,
        input.surface,
        sceneKey,
        input.cueId || null,
        cueKey,
        input.action,
        input.polarity,
        input.strength,
        JSON.stringify(input.evidenceRefs || []),
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.createdAt,
      );
  }

  private recomputePolicyForCue(input: {
    cueKey: string;
    sceneKey: string;
    surface: string;
    timestamp: number;
  }): { patches: MemoryOutcomePolicyPatch[]; skillSuggestionIds: string[] } {
    const cueKey = normalizePolicyText(input.cueKey);
    const sceneKey = normalizePolicyText(input.sceneKey) || 'unknown';
    if (!cueKey) return { patches: [], skillSuggestionIds: [] };

    const aggregate = this.loadAggregate(cueKey, sceneKey, input.surface);
    const patches: MemoryOutcomePolicyPatch[] = [];
    const skillSuggestionIds: string[] = [];
    const shouldSuppress =
      aggregate.negativeCount >= 2 ||
      (aggregate.negativeScore >= 1.2 && aggregate.positiveScore < 0.5);
    const shouldBoost =
      !shouldSuppress &&
      (aggregate.sentAfterInsertCount >= 1 ||
        (aggregate.insertedCount >= 1 && aggregate.expandedCount >= 1));
    const shouldSuggestSkill =
      !shouldSuppress &&
      input.surface === 'compose_assist' &&
      aggregate.sentAfterInsertCount >= 2;

    if (shouldSuppress) {
      patches.push(
        this.upsertPolicyPatch({
          cueKey,
          sceneKey,
          surface: input.surface,
          action: 'suppress',
          reasonCodes: buildSuppressReasons(aggregate),
          strength: clamp(0.55 + aggregate.negativeScore * 0.16, 0.55, 0.95),
          positiveCount: aggregate.positiveCount,
          negativeCount: aggregate.negativeCount,
          signalCount: aggregate.signalCount,
          expiresAt: input.timestamp + SUPPRESS_TTL_SECONDS,
          timestamp: input.timestamp,
        }),
      );
      this.revokeOppositePatch(cueKey, sceneKey, input.surface, 'boost', input.timestamp);
    } else if (shouldBoost) {
      patches.push(
        this.upsertPolicyPatch({
          cueKey,
          sceneKey,
          surface: input.surface,
          action: 'boost',
          reasonCodes: buildBoostReasons(aggregate),
          strength: clamp(0.5 + aggregate.positiveScore * 0.12, 0.5, 0.9),
          positiveCount: aggregate.positiveCount,
          negativeCount: aggregate.negativeCount,
          signalCount: aggregate.signalCount,
          expiresAt: input.timestamp + POLICY_TTL_SECONDS,
          timestamp: input.timestamp,
        }),
      );
      this.revokeOppositePatch(cueKey, sceneKey, input.surface, 'suppress', input.timestamp);
    }

    if (shouldSuggestSkill) {
      const skill = this.createEstimateSkillSuggestion({
        cueKey,
        sceneKey,
        aggregate,
      });
      if (skill?.id) {
        skillSuggestionIds.push(skill.id);
        patches.push(
          this.upsertPolicyPatch({
            cueKey,
            sceneKey,
            surface: input.surface,
            action: 'send_to_skill_foundry',
            reasonCodes: ['repeated_sent_after_insert'],
            strength: 0.8,
            positiveCount: aggregate.positiveCount,
            negativeCount: aggregate.negativeCount,
            signalCount: aggregate.signalCount,
            expiresAt: input.timestamp + POLICY_TTL_SECONDS,
            timestamp: input.timestamp,
          }),
        );
      }
    }

    return { patches, skillSuggestionIds };
  }

  private loadAggregate(
    cueKey: string,
    sceneKey: string,
    surface: string,
  ): CueAggregate {
    const rows = this.db
      .prepare(
        `SELECT action, polarity, strength, created_at
           FROM memory_outcome_events
          WHERE cue_key = ?
            AND scene_key = ?
            AND surface = ?
          ORDER BY created_at ASC`,
      )
      .all(cueKey, sceneKey, surface) as OutcomeEventRow[];
    const aggregate: CueAggregate = {
      positiveScore: 0,
      negativeScore: 0,
      positiveCount: 0,
      negativeCount: 0,
      signalCount: rows.length,
      sentAfterInsertCount: 0,
      insertedCount: 0,
      expandedCount: 0,
      wrongCount: 0,
      deletedBeforeSendCount: 0,
      latestAt: 0,
    };

    for (const row of rows) {
      const score = scoreOutcome(row);
      if (score > 0) {
        aggregate.positiveScore += score;
        aggregate.positiveCount += 1;
      } else if (score < 0) {
        aggregate.negativeScore += Math.abs(score);
        aggregate.negativeCount += 1;
      }
      if (row.action === 'sent_after_insert') aggregate.sentAfterInsertCount += 1;
      if (row.action === 'inserted') aggregate.insertedCount += 1;
      if (row.action === 'expanded') aggregate.expandedCount += 1;
      if (row.action === 'wrong' || row.action === 'marked_irrelevant') {
        aggregate.wrongCount += 1;
      }
      if (row.action === 'deleted_before_send') {
        aggregate.deletedBeforeSendCount += 1;
      }
      aggregate.latestAt = Math.max(aggregate.latestAt, row.created_at);
    }
    return aggregate;
  }

  private upsertPolicyPatch(input: {
    cueKey: string;
    sceneKey: string;
    surface: string;
    action: MemoryOutcomePolicyAction;
    reasonCodes: string[];
    strength: number;
    positiveCount: number;
    negativeCount: number;
    signalCount: number;
    expiresAt?: number;
    timestamp: number;
  }): MemoryOutcomePolicyPatch {
    const id = `outcome-policy:${stableHash(
      `${input.cueKey}:${input.sceneKey}:${input.surface}:${input.action}`,
    )}`;
    this.db
      .prepare(
        `INSERT INTO memory_outcome_policy_patches
          (id, cue_key, scene_key, surface, patch_scope, action,
           reason_codes_json, strength, positive_count, negative_count,
           signal_count, expires_at, created_at, updated_at, revoked_at)
         VALUES (?, ?, ?, ?, 'cue', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(cue_key, scene_key, surface, action) DO UPDATE SET
           reason_codes_json = excluded.reason_codes_json,
           strength = excluded.strength,
           positive_count = excluded.positive_count,
           negative_count = excluded.negative_count,
           signal_count = excluded.signal_count,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at,
           revoked_at = NULL`,
      )
      .run(
        id,
        input.cueKey,
        input.sceneKey,
        input.surface,
        input.action,
        JSON.stringify(input.reasonCodes),
        input.strength,
        input.positiveCount,
        input.negativeCount,
        input.signalCount,
        input.expiresAt ?? null,
        input.timestamp,
        input.timestamp,
      );
    const row = this.db
      .prepare(`SELECT * FROM memory_outcome_policy_patches WHERE id = ?`)
      .get(id) as PolicyPatchRow;
    return mapPatchRow(row);
  }

  private revokeOppositePatch(
    cueKey: string,
    sceneKey: string,
    surface: string,
    action: MemoryOutcomePolicyAction,
    timestamp: number,
  ): void {
    this.db
      .prepare(
        `UPDATE memory_outcome_policy_patches
            SET revoked_at = ?, updated_at = ?
          WHERE cue_key = ?
            AND scene_key = ?
            AND surface = ?
            AND action = ?
            AND revoked_at IS NULL`,
      )
      .run(timestamp, timestamp, cueKey, sceneKey, surface, action);
  }

  private createEstimateSkillSuggestion(input: {
    cueKey: string;
    sceneKey: string;
    aggregate: CueAggregate;
  }): { id: string } | null {
    try {
      const service = new SkillLibraryService(this.db, this.userId);
      const issue = extractIssueFromPolicyText(input.cueKey) || 'Jira estimate';
      const skill = service.createSuggestion({
        slug: 'estimate-wording-helper',
        title: 'Estimate wording helper',
        summary:
          '在 Jira estimate 或 original estimate 场景中，自动复用已验证的人天口径说明，避免重复组织措辞。',
        scope: 'work',
        risk: 'medium',
        trigger:
          '当 Jira issue/comment 输入框命中 estimate/original estimate 字段，并且历史 cue 多次插入后发送。',
        notUse:
          '当前页面不是 estimate 字段、来源没有明确单位、或用户已经标记这类 cue 不相关时不要使用。',
        sources: ['memory_outcome_loop', 'compose_assist', 'jira', 'glip'],
        repetition: `${input.aggregate.sentAfterInsertCount} 次 sent_after_insert`,
        riskBrief:
          '只生成草稿提示，不自动提交 Jira 或发送消息；仍需保留来源和用户确认边界。',
        suggestedFrom: 'memory_outcome_loop',
        suggestionClusterKey: `memory-outcome:${input.cueKey}`,
        currentVersion: '0.1.0',
        evidence: [
          {
            title: `${issue} estimate cue outcome`,
            kind: 'memory_outcome',
            desc: input.cueKey,
            evidenceState: 'complete',
          },
        ],
        sourceEpisodes: [
          {
            id: `outcome:${stableHash(input.cueKey)}`,
            title: `${issue} cue repeatedly sent after insert`,
            date: new Date(
              (input.aggregate.latestAt || now()) * 1000,
            ).toISOString(),
          },
        ],
        createdFrom: 'memory_outcome_loop',
        changelog: 'Created from repeated successful estimate cue outcomes',
        notify: false,
      });
      return { id: skill.id };
    } catch (error) {
      console.warn(
        '[MemoryOutcomeLoopService] Failed to create skill suggestion:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }
}

export function buildCueKey(input: {
  sceneFrame: SceneFrame;
  actionType: ContextCue['actionType'];
  unit: string;
  field?: string;
}): string {
  const issue = normalizePolicyText(input.sceneFrame.anchors.issueKey) || 'unknown';
  const field = normalizePolicyText(input.field) || 'estimate';
  const unit = normalizePolicyText(input.unit) || 'unknown';
  return [
    input.sceneFrame.sceneType,
    input.sceneFrame.surface,
    input.actionType,
    issue,
    field,
    unit,
  ].join(':');
}

function collectCueRefs(input: MemoryOutcomeTraceInput): MemoryOutcomeCueRef[] {
  const refs = new Map<string, MemoryOutcomeCueRef>();
  const metadataCueIds = getStringArray(input.metadata?.cueIds);
  const metadataCueKeys = getStringArray(input.metadata?.cueKeys);
  for (let index = 0; index < metadataCueKeys.length; index += 1) {
    const cueKey = metadataCueKeys[index];
    const cueId = metadataCueIds[index];
    refs.set(cueKey, { cueId, cueKey });
  }

  for (const ref of input.evidenceRefs ?? []) {
    const cueId = normalizePolicyText(ref.cueId || ref.cue?.id);
    const cueKey = normalizePolicyText(ref.cueKey || ref.cue?.cueKey);
    if (!cueId && !cueKey) continue;
    const key = cueKey || cueId!;
    refs.set(key, {
      cueId,
      cueKey,
      actionType: ref.cue?.actionType,
      compileStatus: ref.cue?.compileStatus,
      confidence: ref.cue?.confidence,
      whyNow: ref.cue?.whyNow,
    });
  }

  if (refs.size === 0) {
    for (const cueId of metadataCueIds) {
      refs.set(cueId, { cueId });
    }
  }

  return Array.from(refs.values())
    .map((ref) => ({
      ...ref,
      cueId: normalizePolicyText(ref.cueId),
      cueKey: normalizePolicyText(ref.cueKey),
    }))
    .filter((ref) => ref.cueId || ref.cueKey);
}

function scoreOutcome(row: OutcomeEventRow): number {
  const strength = strengthWeight(row.strength);
  if (row.action === 'sent_after_insert') return 1.0 * strength;
  if (row.action === 'inserted') return 0.55 * strength;
  if (row.action === 'expanded') return 0.2 * strength;
  if (row.action === 'opened_source') return 0.25 * strength;
  if (row.action === 'marked_relevant') return 0.6 * strength;
  if (row.action === 'done' || row.action === 'confirmed') return 0.8 * strength;
  if (row.action === 'wrong' || row.action === 'marked_irrelevant') {
    return -1.0 * strength;
  }
  if (row.action === 'deleted_before_send') return -0.8 * strength;
  if (row.action === 'ignored') return -0.3 * strength;
  if (row.polarity === 'negative') return -0.6 * strength;
  if (row.polarity === 'correction') return -0.4 * strength;
  if (row.polarity === 'positive') return 0.25 * strength;
  return 0;
}

function strengthWeight(strength: string): number {
  if (strength === 'strong') return 1;
  if (strength === 'medium') return 0.75;
  return 0.45;
}

function buildSuppressReasons(aggregate: CueAggregate): string[] {
  const reasons = new Set<string>();
  if (aggregate.wrongCount > 0) reasons.add('marked_irrelevant');
  if (aggregate.deletedBeforeSendCount > 0) reasons.add('deleted_before_send');
  if (aggregate.negativeCount >= 2) reasons.add('repeated_negative_outcome');
  return Array.from(reasons.size ? reasons : new Set(['negative_outcome']));
}

function buildBoostReasons(aggregate: CueAggregate): string[] {
  const reasons = new Set<string>();
  if (aggregate.sentAfterInsertCount > 0) reasons.add('sent_after_insert');
  if (aggregate.insertedCount > 0) reasons.add('inserted');
  if (aggregate.expandedCount > 0) reasons.add('expanded');
  return Array.from(reasons.size ? reasons : new Set(['positive_outcome']));
}

function mapPatchRow(row: PolicyPatchRow): MemoryOutcomePolicyPatch {
  return {
    id: row.id,
    cueKey: row.cue_key,
    sceneKey: row.scene_key,
    surface: row.surface,
    action: row.action,
    reasonCodes: parseJsonStringArray(row.reason_codes_json),
    strength: row.strength,
    positiveCount: row.positive_count,
    negativeCount: row.negative_count,
    signalCount: row.signal_count,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at ?? undefined,
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function getString(value: unknown): string | undefined {
  const normalized = normalizePolicyText(value);
  return normalized || undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizePolicyText(item))
    .filter((item): item is string => Boolean(item));
}

function normalizePolicyText(value: unknown): string | undefined {
  const text =
    typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value);
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function normalizeTimestamp(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return now();
  return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function clamp(value: number, min: number, max: number): number {
  return Number(Math.max(min, Math.min(max, value)).toFixed(2));
}

function extractIssueFromPolicyText(value: string): string | undefined {
  return value.match(/\b[A-Z][A-Z0-9]+-\d+\b/)?.[0];
}

function stableHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
