/**
 * User feedback route.
 *
 * POST /feedback — Submit feedback to adjust memory salience, notification
 *                  usefulness, or entity property corrections.
 */

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { TruthMaintainer } from '../core/TruthMaintainer.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackBody {
  type: 'recall_quality' | 'notification_useful' | 'entity_correction';
  targetId: string;
  targetType?: 'message' | 'chunk' | 'entity';
  action: 'positive' | 'negative' | 'clear';
  detail?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALIENCE_BOOST = 0.1;
const SALIENCE_PENALTY = -0.15;

type RecallFeedbackTargetType = NonNullable<FeedbackBody['targetType']>;

interface FeedbackEventRow {
  action: FeedbackBody['action'];
}

function feedbackActionDelta(action: FeedbackBody['action'] | undefined): number {
  if (action === 'positive') return SALIENCE_BOOST;
  if (action === 'negative') return SALIENCE_PENALTY;
  return 0;
}

function memoryTargetExists(
  db: BetterSqlite3.Database,
  targetType: RecallFeedbackTargetType,
  targetId: string,
): boolean {
  if (targetType === 'message') {
    const row = db
      .prepare('SELECT 1 FROM messages_raw WHERE id = ? LIMIT 1')
      .get(targetId);
    return Boolean(row);
  }

  if (targetType === 'chunk') {
    const chunkId = Number(targetId);
    if (!Number.isInteger(chunkId)) return false;
    const row = db
      .prepare('SELECT 1 FROM chunks WHERE chunk_id = ? LIMIT 1')
      .get(chunkId);
    return Boolean(row);
  }

  const row = db
    .prepare('SELECT 1 FROM entities WHERE id = ? LIMIT 1')
    .get(targetId);
  return Boolean(row);
}

function resolveRecallFeedbackTargetType(
  db: BetterSqlite3.Database,
  targetId: string,
  requestedType?: RecallFeedbackTargetType,
): { targetType?: RecallFeedbackTargetType; error?: string; statusCode?: number } {
  if (requestedType) {
    if (!memoryTargetExists(db, requestedType, targetId)) {
      return {
        error: `Memory target "${requestedType}:${targetId}" not found`,
        statusCode: 404,
      };
    }
    return { targetType: requestedType };
  }

  const metadataTypes = db
    .prepare(
      `SELECT DISTINCT target_type
       FROM memory_metadata
       WHERE target_id = ?`,
    )
    .all(targetId) as Array<{ target_type: RecallFeedbackTargetType }>;

  const existingTypes = new Set<RecallFeedbackTargetType>();

  for (const row of metadataTypes) {
    if (
      (row.target_type === 'message' ||
        row.target_type === 'chunk' ||
        row.target_type === 'entity') &&
      memoryTargetExists(db, row.target_type, targetId)
    ) {
      existingTypes.add(row.target_type);
    }
  }

  for (const candidate of ['message', 'chunk', 'entity'] as const) {
    if (memoryTargetExists(db, candidate, targetId)) {
      existingTypes.add(candidate);
    }
  }

  if (existingTypes.size > 1) {
    return {
      error: 'targetType is required when multiple memory types share this targetId',
      statusCode: 400,
    };
  }

  const [targetType] = Array.from(existingTypes);
  if (!targetType) {
    return {
      error: `Memory target "${targetId}" not found`,
      statusCode: 404,
    };
  }

  return { targetType };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const feedbackBodySchema = {
  type: 'object' as const,
  required: ['type', 'targetId', 'action'],
  properties: {
    type: {
      type: 'string' as const,
      enum: ['recall_quality', 'notification_useful', 'entity_correction'],
    },
    targetId: { type: 'string' as const },
    targetType: {
      type: 'string' as const,
      enum: ['message', 'chunk', 'entity'],
    },
    action: {
      type: 'string' as const,
      enum: ['positive', 'negative', 'clear'],
    },
    detail: { type: 'string' as const },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function feedbackRoutes(
  app: FastifyInstance,
): Promise<void> {
  // POST /feedback — Process user feedback
  app.post<{ Body: FeedbackBody }>(
    '/feedback',
    { schema: { body: feedbackBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { type, targetId, targetType, action, detail } = request.body;
      const currentTime = now();

      if (action === 'clear' && type !== 'recall_quality') {
        return reply
          .status(400)
          .send({ error: 'clear action is only supported for recall_quality feedback' });
      }

      switch (type) {
        // -----------------------------------------------------------------
        // recall_quality: boost or reduce salience of a memory item
        // -----------------------------------------------------------------
        case 'recall_quality': {
          const resolved = resolveRecallFeedbackTargetType(
            db,
            targetId,
            targetType,
          );
          if (!resolved.targetType) {
            return reply
              .status(resolved.statusCode ?? 400)
              .send({ error: resolved.error ?? 'Invalid feedback target' });
          }
          const resolvedTargetType = resolved.targetType;

          const transaction = db.transaction(() => {
            const existingFeedback = db
              .prepare(
                `SELECT action
                 FROM memory_feedback_events
                 WHERE feedback_type = ? AND target_type = ? AND target_id = ?
                 LIMIT 1`,
              )
              .get(type, resolvedTargetType, targetId) as
              | FeedbackEventRow
              | undefined;

            const nextActionScore = feedbackActionDelta(action);
            const previousActionScore = feedbackActionDelta(
              existingFeedback?.action,
            );
            const appliedDelta = nextActionScore - previousActionScore;

            const existing = db
              .prepare(
                `SELECT id, salience_score FROM memory_metadata
                 WHERE target_type = ? AND target_id = ?
                 LIMIT 1`,
              )
              .get(resolvedTargetType, targetId) as
              | { id: number; salience_score: number }
              | undefined;

            if (existing && appliedDelta !== 0) {
              const newScore = Math.max(
                0,
                Math.min(1, existing.salience_score + appliedDelta),
              );
              db.prepare(
                `UPDATE memory_metadata
                 SET salience_score = ?, updated_at = ?
                 WHERE id = ?`,
              ).run(newScore, currentTime, existing.id);
            } else if (!existing && action !== 'clear') {
              const baseScore = 0.5 + nextActionScore;
              db.prepare(
                `INSERT INTO memory_metadata (target_type, target_id, salience_score, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
              ).run(
                resolvedTargetType,
                targetId,
                Math.max(0, Math.min(1, baseScore)),
                currentTime,
                currentTime,
              );
            }

            if (action === 'clear') {
              db.prepare(
                `DELETE FROM memory_feedback_events
                 WHERE feedback_type = ? AND target_type = ? AND target_id = ?`,
              ).run(type, resolvedTargetType, targetId);
            } else {
              db.prepare(
                `INSERT INTO memory_feedback_events
                   (feedback_type, target_type, target_id, action, detail, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(feedback_type, target_type, target_id) DO UPDATE SET
                   action = excluded.action,
                   detail = excluded.detail,
                   updated_at = excluded.updated_at`,
              ).run(
                type,
                resolvedTargetType,
                targetId,
                action,
                detail ?? null,
                currentTime,
                currentTime,
              );
            }

            return {
              appliedDelta,
              previousAction: existingFeedback?.action,
            };
          });

          const result = transaction();

          return reply.status(200).send({
            status: 'ok',
            targetType: resolvedTargetType,
            previousAction: result.previousAction,
            appliedDelta: result.appliedDelta,
          });
        }

        // -----------------------------------------------------------------
        // notification_useful: update action_taken on notification_records
        // -----------------------------------------------------------------
        case 'notification_useful': {
          const actionValue = action === 'positive'
            ? 'useful'
            : 'not_useful';

          const fullAction = detail
            ? `${actionValue}: ${detail}`
            : actionValue;

          const result = db
            .prepare(
              `UPDATE notification_records
               SET action_taken = ?, clicked_at = COALESCE(clicked_at, ?)
               WHERE id = ?`,
            )
            .run(fullAction, currentTime, targetId);

          if (result.changes === 0) {
            return reply.status(404).send({ error: `Notification "${targetId}" not found` });
          }

          return reply.status(200).send({ status: 'ok' });
        }

        // -----------------------------------------------------------------
        // entity_correction: create a property change via TruthMaintainer
        // -----------------------------------------------------------------
        case 'entity_correction': {
          // detail is expected in the format "key=value" for the correction
          // e.g. "role=Staff Engineer" or just a description for negative
          const truthMaintainer = new TruthMaintainer(db, request.userId);

          if (action === 'positive') {
            // Positive feedback on an entity: confirm its current properties
            // targetId is the entity ID; detail is optional property key to confirm
            if (detail) {
              await truthMaintainer.processPropertyChange({
                entityId: targetId,
                key: detail,
                value: '',
                actionType: 'confirm',
                sourceAuthority: 'self',
                sourceContext: 'User positive feedback',
              });
            }
          } else {
            // Negative feedback: propose a correction
            // Parse "key=value" from detail
            if (detail) {
              const eqIndex = detail.indexOf('=');
              if (eqIndex > 0) {
                const key = detail.slice(0, eqIndex).trim();
                const value = detail.slice(eqIndex + 1).trim();

                await truthMaintainer.processPropertyChange({
                  entityId: targetId,
                  key,
                  value,
                  actionType: 'update',
                  sourceAuthority: 'self',
                  sourceContext: 'User correction via feedback',
                  confidence: 0.9,
                });
              }
            }
          }

          return reply.status(200).send({ status: 'ok' });
        }

        default: {
          return reply.status(400).send({ error: `Unknown feedback type: ${type}` });
        }
      }
    },
  );
}
