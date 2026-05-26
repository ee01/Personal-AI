import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

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
  | 'manual_added';

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

interface AmbientCalibrationEvidenceRef {
  id: string;
  type?: string;
  title?: string;
  sourceLabel?: string;
  role?: string;
  score?: number;
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

function nowMs(): number {
  return Date.now();
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
      const id = trace.id || randomUUID();
      const createdAt =
        Number.isFinite(trace.createdAt) && trace.createdAt
          ? Math.floor(trace.createdAt)
          : nowMs();

      request.userContext.db
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

      return reply.send({
        status: 'ok',
        traceId: id,
        stored: true,
      });
    },
  );
}
