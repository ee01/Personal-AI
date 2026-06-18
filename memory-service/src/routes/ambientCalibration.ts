import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import { MemoryOutcomeLoopService } from '../core/MemoryOutcomeLoopService.js';
import { UserWritingStyleMemoryService } from '../core/UserWritingStyleMemoryService.js';
import type { UserContext } from '../core/UserContextManager.js';
import { now } from '../utils/time.js';

type AmbientCalibrationSurface =
  | 'compose_assist'
  | 'memory_lens'
  | 'today_pilot'
  | 'meeting_pilot'
  | 'ask'
  | 'search'
  | 'relationship_radar'
  | 'user_profile'
  | 'memory_capture';

type AmbientCalibrationAction =
  | 'shown'
  | 'hovered'
  | 'expanded'
  | 'inserted'
  | 'sent_after_insert'
  | 'sent_without_insert'
  | 'edited_before_send'
  | 'deleted_before_send'
  | 'opened_source'
  | 'copied_context'
  | 'done'
  | 'later'
  | 'mute'
  | 'wrong'
  | 'confirmed'
  | 'edited'
  | 'ignored'
  | 'manual_added'
  | 'downstream_reaction';

type AmbientCalibrationStrength = 'weak' | 'medium' | 'strong';
type AmbientCalibrationPolarity =
  | 'positive'
  | 'negative'
  | 'correction'
  | 'neutral';
type AmbientCalibrationPrivacyClass =
  | 'normal'
  | 'sensitive_redacted'
  | 'local_only';

interface AmbientCalibrationReceipt {
  stored: boolean;
  duplicate: boolean;
  privacyClass: AmbientCalibrationPrivacyClass;
  rawTextStored: false;
  evidenceRefCount: number;
  cueRefCount: number;
  styleSignalCount: number;
  redactedDiffKeys: string[];
  writingStyleProcessed: boolean;
  outcomeCueEventCount: number;
  boundary: 'hashes_lengths_tags_and_evidence_refs_only';
}

interface AmbientCalibrationEvidenceRef {
  id: string;
  type?: string;
  title?: string;
  sourceLabel?: string;
  role?: string;
  score?: number;
  cueId?: string;
  cueKey?: string;
  cue?: {
    id?: string;
    cueKey?: string;
    actionType?: string;
    compileStatus?: string;
    confidence?: number;
    whyNow?: string;
  };
}

interface AmbientCalibrationTraceBody {
  id?: string;
  surface: AmbientCalibrationSurface;
  sceneKey: string;
  sourceRequestId?: string;
  action: AmbientCalibrationAction;
  strength: AmbientCalibrationStrength;
  polarity: AmbientCalibrationPolarity;
  evidenceRefs?: AmbientCalibrationEvidenceRef[];
  redactedDiff?: Record<string, unknown>;
  privacyClass?: AmbientCalibrationPrivacyClass;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

const evidenceRefSchema = {
  type: 'object' as const,
  required: ['id'],
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 256 },
    type: { type: 'string' as const, maxLength: 64 },
    title: { type: 'string' as const, maxLength: 240 },
    sourceLabel: { type: 'string' as const, maxLength: 120 },
    role: { type: 'string' as const, maxLength: 64 },
    score: { type: 'number' as const, minimum: 0, maximum: 1 },
    cueId: { type: 'string' as const, maxLength: 160 },
    cueKey: { type: 'string' as const, maxLength: 240 },
    cue: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const, maxLength: 160 },
        cueKey: { type: 'string' as const, maxLength: 240 },
        actionType: { type: 'string' as const, maxLength: 64 },
        compileStatus: { type: 'string' as const, maxLength: 64 },
        confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
        whyNow: { type: 'string' as const, maxLength: 320 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const ambientCalibrationTraceBodySchema = {
  type: 'object' as const,
  required: ['surface', 'sceneKey', 'action', 'strength', 'polarity'],
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 128 },
    surface: {
      type: 'string' as const,
      enum: [
        'compose_assist',
        'memory_lens',
        'today_pilot',
        'meeting_pilot',
        'ask',
        'search',
        'relationship_radar',
        'user_profile',
        'memory_capture',
      ],
    },
    sceneKey: { type: 'string' as const, minLength: 1, maxLength: 512 },
    sourceRequestId: { type: 'string' as const, maxLength: 256 },
    action: {
      type: 'string' as const,
      enum: [
        'shown',
        'hovered',
        'expanded',
        'inserted',
        'sent_after_insert',
        'sent_without_insert',
        'edited_before_send',
        'deleted_before_send',
        'opened_source',
        'copied_context',
        'done',
        'later',
        'mute',
        'wrong',
        'confirmed',
        'edited',
        'ignored',
        'manual_added',
        'downstream_reaction',
      ],
    },
    strength: {
      type: 'string' as const,
      enum: ['weak', 'medium', 'strong'],
    },
    polarity: {
      type: 'string' as const,
      enum: ['positive', 'negative', 'correction', 'neutral'],
    },
    evidenceRefs: {
      type: 'array' as const,
      items: evidenceRefSchema,
      maxItems: 50,
    },
    redactedDiff: {
      type: 'object' as const,
      additionalProperties: true,
    },
    privacyClass: {
      type: 'string' as const,
      enum: ['normal', 'sensitive_redacted', 'local_only'],
    },
    metadata: {
      type: 'object' as const,
      additionalProperties: true,
    },
    createdAt: { type: 'number' as const },
    rawText: { type: 'null' as const },
    rawFinalText: { type: 'null' as const },
    finalText: { type: 'null' as const },
    suggestionText: { type: 'null' as const },
    composerText: { type: 'null' as const },
  },
  additionalProperties: false,
};

const forbiddenRawTextKeys = new Set([
  'rawtext',
  'rawfinaltext',
  'finaltext',
  'suggestiontext',
  'composertext',
  'rawsuggestiontext',
  'rawcomposertext',
  'senttext',
  'fulltext',
  'messagetext',
]);

const redactedDiffStyleSignalKeys = new Set([
  'styleFeatureTags',
  'toneShiftTags',
  'formatShiftTags',
  'recipientReactionTags',
]);

function nowMs(): number {
  return Date.now();
}

function normalizePayloadKey(key: string): string {
  return key.replace(/[\s_-]+/g, '').toLowerCase();
}

function findForbiddenRawTextField(
  value: unknown,
  path = 'payload',
): string | null {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenRawTextField(
        value[index],
        `${path}[${index}]`,
      );
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalizedKey = normalizePayloadKey(key);
    if (
      normalizedKey !== 'rawtextstored' &&
      forbiddenRawTextKeys.has(normalizedKey)
    ) {
      return `${path}.${key}`;
    }

    const nested = findForbiddenRawTextField(nestedValue, `${path}.${key}`);
    if (nested) return nested;
  }

  return null;
}

function looksLikeHashOrEnumValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[a-f0-9]{32,}$/i.test(trimmed)) return true;
  if (/^[a-z0-9_.:-]{1,96}$/i.test(trimmed)) return true;
  return false;
}

function looksLikeUnredactedTextValue(value: string): boolean {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || looksLikeHashOrEnumValue(trimmed)) return false;
  if (/https?:\/\//i.test(trimmed)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(trimmed)) return true;
  if (trimmed.length > 180) return true;

  const englishWordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (englishWordCount >= 9 && trimmed.length >= 50) return true;

  const cjkCount = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
  if (cjkCount >= 48) return true;
  if (cjkCount >= 16 && trimmed.length >= 24 && /[，。！？；：、,.!?;:]/.test(trimmed)) {
    return true;
  }
  if (cjkCount >= 28 && /[，。！？；：、,.!?;:]/.test(trimmed)) return true;

  return false;
}

function findLikelyUnredactedDiffValue(
  value: unknown,
  path = 'redactedDiff',
): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    return looksLikeUnredactedTextValue(value) ? path : null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findLikelyUnredactedDiffValue(
        value[index],
        `${path}[${index}]`,
      );
      if (nested) return nested;
    }
    return null;
  }

  if (typeof value !== 'object') return null;

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const nested = findLikelyUnredactedDiffValue(
      nestedValue,
      `${path}.${key}`,
    );
    if (nested) return nested;
  }

  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function countCueRefs(trace: AmbientCalibrationTraceBody): number {
  const cues = new Set<string>();
  for (const ref of trace.evidenceRefs || []) {
    for (const value of [
      ref.cueId,
      ref.cueKey,
      ref.cue?.id,
      ref.cue?.cueKey,
    ]) {
      if (value) cues.add(value);
    }
  }

  const metadata = trace.metadata || {};
  for (const key of ['cueIds', 'cueKeys']) {
    for (const value of readStringArray(metadata[key])) {
      cues.add(value);
    }
  }

  return cues.size;
}

function countStyleSignals(trace: AmbientCalibrationTraceBody): number {
  const signals = new Set<string>();
  for (const container of [trace.redactedDiff || {}, trace.metadata || {}]) {
    for (const [key, value] of Object.entries(container)) {
      if (!redactedDiffStyleSignalKeys.has(key)) continue;
      for (const signal of readStringArray(value)) {
        signals.add(signal);
      }
    }
  }
  return signals.size;
}

function buildCalibrationReceipt(
  trace: AmbientCalibrationTraceBody,
  stored: boolean,
  writingStyleMemory:
    | {
        processed: boolean;
        memoryIds: string[];
        promotedProfileItemIds: string[];
      }
    | undefined,
  outcomeLoop:
    | {
        cueEventCount: number;
        patches: unknown[];
        skillSuggestionIds: string[];
      }
    | undefined,
): AmbientCalibrationReceipt {
  return {
    stored,
    duplicate: !stored,
    privacyClass: trace.privacyClass || 'normal',
    rawTextStored: false,
    evidenceRefCount: trace.evidenceRefs?.length || 0,
    cueRefCount: countCueRefs(trace),
    styleSignalCount: countStyleSignals(trace),
    redactedDiffKeys: Object.keys(trace.redactedDiff || {})
      .sort()
      .slice(0, 24),
    writingStyleProcessed: writingStyleMemory?.processed || false,
    outcomeCueEventCount: outcomeLoop?.cueEventCount || 0,
    boundary: 'hashes_lengths_tags_and_evidence_refs_only',
  };
}

export async function ambientCalibrationRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: AmbientCalibrationTraceBody }>(
    '/ambient-calibration/traces',
    {
      schema: {
        body: ambientCalibrationTraceBodySchema,
      },
    },
    async (request, reply) => {
      const trace = request.body;
      const rawBody = trace as AmbientCalibrationTraceBody &
        Record<string, unknown>;
      for (const key of [
        'rawText',
        'rawFinalText',
        'finalText',
        'suggestionText',
        'composerText',
      ]) {
        if (key in rawBody) {
          return reply.code(400).send({
            error: `${key} is not allowed in ambient calibration traces`,
          });
        }
      }
      const forbiddenNestedField = findForbiddenRawTextField({
        redactedDiff: trace.redactedDiff,
        metadata: trace.metadata,
      });
      if (forbiddenNestedField) {
        return reply.code(400).send({
          error: `${forbiddenNestedField} is not allowed in ambient calibration traces`,
        });
      }
      const unredactedDiffValue = findLikelyUnredactedDiffValue(
        trace.redactedDiff,
      );
      if (unredactedDiffValue) {
        return reply.code(400).send({
          error: `${unredactedDiffValue} appears to contain unredacted text; use hashes, lengths, bands, or compact tags instead`,
        });
      }
      const id = trace.id || randomUUID();
      const createdAt =
        Number.isFinite(trace.createdAt) && trace.createdAt
          ? Math.floor(trace.createdAt)
          : nowMs();

      const result = request.userContext.db
        .prepare(
          `INSERT OR IGNORE INTO ambient_calibration_traces
            (
              id,
              surface,
              scene_key,
              source_request_id,
              action,
              strength,
              polarity,
              evidence_refs_json,
              redacted_diff_json,
              privacy_class,
              metadata_json,
              created_at
            )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          trace.surface,
          trace.sceneKey,
          trace.sourceRequestId || null,
          trace.action,
          trace.strength,
          trace.polarity,
          JSON.stringify(trace.evidenceRefs || []),
          trace.redactedDiff ? JSON.stringify(trace.redactedDiff) : null,
          trace.privacyClass || 'normal',
          trace.metadata ? JSON.stringify(trace.metadata) : null,
          createdAt,
        );

      let writingStyleMemory:
        | {
            processed: boolean;
            memoryIds: string[];
            promotedProfileItemIds: string[];
          }
        | undefined;
      let outcomeLoop:
        | {
            cueEventCount: number;
            patches: unknown[];
            skillSuggestionIds: string[];
          }
        | undefined;
      if (result.changes > 0) {
        const service = new MemoryOutcomeLoopService(
          request.userContext.db,
          request.userId,
        );
        outcomeLoop = service.processAmbientTrace({
          id,
          surface: trace.surface,
          sceneKey: trace.sceneKey,
          sourceRequestId: trace.sourceRequestId,
          action: trace.action,
          strength: trace.strength,
          polarity: trace.polarity,
          evidenceRefs: trace.evidenceRefs,
          metadata: trace.metadata,
          createdAt,
        });
      }
      if (result.changes > 0 && trace.surface === 'compose_assist') {
        const service = new UserWritingStyleMemoryService(
          request.userContext.db,
          request.userId,
        );
        writingStyleMemory = service.processAmbientTrace({
          id,
          userId: request.userId,
          surface: trace.surface,
          sceneKey: trace.sceneKey,
          action: trace.action,
          strength: trace.strength,
          polarity: trace.polarity,
          evidenceRefs: trace.evidenceRefs,
          redactedDiff: trace.redactedDiff,
          metadata: trace.metadata,
          createdAt,
        });
        request.userContext.db
          .prepare(
            `UPDATE ambient_calibration_traces
                SET processed_at = ?
              WHERE id = ?`,
          )
          .run(now(), id);
        if (writingStyleMemory.promotedProfileItemIds.length) {
          await refreshUserCoreSnapshot(request.userContext);
        }
      }

      return reply.send({
        status: 'ok',
        traceId: id,
        stored: result.changes > 0,
        writingStyleMemory,
        outcomeLoop,
        calibrationReceipt: buildCalibrationReceipt(
          trace,
          result.changes > 0,
          writingStyleMemory,
          outcomeLoop,
        ),
      });
    },
  );
}

async function refreshUserCoreSnapshot(
  userContext: UserContext,
): Promise<void> {
  try {
    const currentTime = now();
    const content = userContext.profileManager.renderUserCore(50);

    if (userContext.userDataManager?.isInitialized) {
      userContext.userDataManager.writeFile('USER_CORE.md', content);
      const { MarkdownManager } = await import('../core/MarkdownManager.js');
      const markdownManager = new MarkdownManager(
        userContext.db,
        userContext.userDataManager.rootDir,
      );
      await markdownManager.reindexFile('USER_CORE.md');
    }

    userContext.db
      .prepare(
        `UPDATE profile_sync_state
           SET profile_dirty = 0, last_snapshot_at = ?
         WHERE id = 'singleton'`,
      )
      .run(currentTime);
  } catch (error) {
    console.warn(
      '[ambientCalibrationRoutes] Failed to refresh USER_CORE snapshot:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
