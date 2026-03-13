/**
 * User feedback route.
 *
 * POST /feedback — Submit feedback to adjust memory salience, notification
 *                  usefulness, or entity property corrections.
 */

import type { FastifyInstance } from 'fastify';

import { TruthMaintainer } from '../core/TruthMaintainer.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackBody {
  type: 'recall_quality' | 'notification_useful' | 'entity_correction';
  targetId: string;
  action: 'positive' | 'negative';
  detail?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALIENCE_BOOST = 0.1;
const SALIENCE_PENALTY = -0.15;

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
    action: {
      type: 'string' as const,
      enum: ['positive', 'negative'],
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
      const { type, targetId, action, detail } = request.body;
      const currentTime = now();

      switch (type) {
        // -----------------------------------------------------------------
        // recall_quality: boost or reduce salience of a memory item
        // -----------------------------------------------------------------
        case 'recall_quality': {
          const delta = action === 'positive' ? SALIENCE_BOOST : SALIENCE_PENALTY;

          // Upsert into memory_metadata: adjust salience_score
          const existing = db
            .prepare(
              `SELECT id, salience_score FROM memory_metadata
               WHERE target_id = ?
               LIMIT 1`,
            )
            .get(targetId) as { id: number; salience_score: number } | undefined;

          if (existing) {
            const newScore = Math.max(0, Math.min(1, existing.salience_score + delta));
            db.prepare(
              `UPDATE memory_metadata
               SET salience_score = ?, updated_at = ?
               WHERE id = ?`,
            ).run(newScore, currentTime, existing.id);
          } else {
            // Create a new metadata entry with the adjusted score
            const baseScore = 0.5 + delta;
            db.prepare(
              `INSERT INTO memory_metadata (target_type, target_id, salience_score, created_at, updated_at)
               VALUES ('message', ?, ?, ?, ?)`,
            ).run(targetId, Math.max(0, Math.min(1, baseScore)), currentTime, currentTime);
          }

          return reply.status(200).send({ status: 'ok' });
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
