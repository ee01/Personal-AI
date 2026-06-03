import type { FastifyInstance } from 'fastify';

import {
  RecallRelevancePatchService,
  type RecallRelevanceFeedbackAction,
  type RecallRelevanceFeedbackTargetType,
} from '../core/RecallRelevancePatchService.js';

interface RecallRelevanceFeedbackBody {
  targetType: RecallRelevanceFeedbackTargetType;
  targetId: string;
  action?: RecallRelevanceFeedbackAction;
  reason?: string;
  surface?: string;
  scope?: string;
  detail?: string | Record<string, unknown>;
  scene?: Record<string, unknown>;
  autoApplied?: boolean;
  userNote?: string;
}

interface RecallRelevancePatchStatusBody {
  status: 'active' | 'paused' | 'deleted';
}

const anyObjectSchema = {
  type: 'object' as const,
  additionalProperties: true,
};

const recallRelevanceFeedbackBodySchema = {
  type: 'object' as const,
  required: ['targetType', 'targetId'],
  properties: {
    targetType: {
      type: 'string' as const,
      enum: ['message', 'chunk', 'entity', 'source_memory', 'rehearsal'],
    },
    targetId: { type: 'string' as const, minLength: 1, maxLength: 256 },
    action: {
      type: 'string' as const,
      enum: ['positive', 'negative', 'clear'],
    },
    reason: { type: 'string' as const, maxLength: 120 },
    surface: { type: 'string' as const, maxLength: 120 },
    scope: { type: 'string' as const, maxLength: 120 },
    detail: {
      anyOf: [{ type: 'string' as const }, anyObjectSchema],
    },
    scene: anyObjectSchema,
    autoApplied: { type: 'boolean' as const },
    userNote: { type: 'string' as const, maxLength: 500 },
  },
  additionalProperties: false,
};

const recallRelevancePatchStatusBodySchema = {
  type: 'object' as const,
  required: ['status'],
  properties: {
    status: {
      type: 'string' as const,
      enum: ['active', 'paused', 'deleted'],
    },
  },
  additionalProperties: false,
};

export async function recallRelevanceRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: RecallRelevanceFeedbackBody }>(
    '/recall/relevance-feedback',
    { schema: { body: recallRelevanceFeedbackBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new RecallRelevancePatchService(db, request.userId);
      const result = service.recordFeedback({
        userId: request.userId,
        source: 'recall_relevance_api',
        targetType: request.body.targetType,
        targetId: request.body.targetId,
        action: request.body.action ?? 'negative',
        reason: request.body.reason,
        surface: request.body.surface,
        scope: request.body.scope,
        detail: request.body.detail,
        scene: request.body.scene,
        autoApplied: request.body.autoApplied,
        userNote: request.body.userNote,
      });

      return reply.send({ ok: true, result });
    },
  );

  app.get<{
    Querystring: { status?: string };
  }>('/recall/relevance-patches', async (request, reply) => {
    const { db } = request.userContext;
    const service = new RecallRelevancePatchService(db, request.userId);
    const status =
      request.query.status === 'active' ||
      request.query.status === 'paused' ||
      request.query.status === 'pending_confirm' ||
      request.query.status === 'deleted'
        ? request.query.status
        : undefined;
    return reply.send({ items: service.listPatches(status) });
  });

  app.patch<{
    Params: { id: string };
    Body: RecallRelevancePatchStatusBody;
  }>(
    '/recall/relevance-patches/:id',
    { schema: { body: recallRelevancePatchStatusBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new RecallRelevancePatchService(db, request.userId);
      const patch = service.updatePatchStatus(
        request.params.id,
        request.body.status,
      );
      if (!patch) {
        return reply.status(404).send({ error: 'patch_not_found' });
      }
      return reply.send({ status: 'ok', patch });
    },
  );
}
