import type { FastifyInstance } from 'fastify';

import {
  type CreateRehearsalInput,
  type RehearsalFeedbackInput,
  RehearsalValidationError,
  RehearsalService,
  type UpdateRehearsalInput,
} from '../core/RehearsalService.js';
import type { RehearsalStatus } from '../types/index.js';

const cueSchema = {
  type: 'object' as const,
  properties: {
    people: { type: 'array' as const, items: { type: 'string' as const } },
    projects: { type: 'array' as const, items: { type: 'string' as const } },
    topics: { type: 'array' as const, items: { type: 'string' as const } },
    keywords: { type: 'array' as const, items: { type: 'string' as const } },
    groupIds: { type: 'array' as const, items: { type: 'string' as const } },
    conversationIds: { type: 'array' as const, items: { type: 'string' as const } },
    meetingIds: { type: 'array' as const, items: { type: 'string' as const } },
    calendarEventIds: { type: 'array' as const, items: { type: 'string' as const } },
    issueKeys: { type: 'array' as const, items: { type: 'string' as const } },
    urls: { type: 'array' as const, items: { type: 'string' as const } },
    surfaces: { type: 'array' as const, items: { type: 'string' as const } },
  },
  additionalProperties: false,
};

const statusValues = [
  'candidate',
  'active',
  'paused',
  'used',
  'stale',
  'archived',
  'dismissed',
] as const;

const rehearsalBodySchema = {
  type: 'object' as const,
  required: ['title', 'content'],
  properties: {
    title: { type: 'string' as const, minLength: 1 },
    scenarioType: { type: 'string' as const },
    status: { type: 'string' as const, enum: [...statusValues] },
    summary: { type: 'string' as const },
    content: { type: 'string' as const, minLength: 1 },
    activationCues: cueSchema,
    evidenceRefs: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    sourceKind: { type: 'string' as const },
    sourceRefId: { type: 'string' as const },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
    priority: { type: 'integer' as const, minimum: 1, maximum: 10 },
    validFrom: { type: 'number' as const },
    validUntil: { type: 'number' as const },
  },
  additionalProperties: false,
};

const rehearsalPatchSchema = {
  ...rehearsalBodySchema,
  required: [],
  properties: {
    ...rehearsalBodySchema.properties,
    summary: { anyOf: [{ type: 'null' as const }, { type: 'string' as const }] },
    sourceRefId: { anyOf: [{ type: 'null' as const }, { type: 'string' as const }] },
    validFrom: { anyOf: [{ type: 'null' as const }, { type: 'number' as const }] },
    validUntil: { anyOf: [{ type: 'null' as const }, { type: 'number' as const }] },
    staleReason: { anyOf: [{ type: 'null' as const }, { type: 'string' as const }] },
  },
};

const feedbackSchema = {
  type: 'object' as const,
  required: ['outcome'],
  properties: {
    outcome: {
      type: 'string' as const,
      enum: ['matched', 'shown', 'accepted', 'used', 'ignored', 'dismissed', 'irrelevant'],
    },
    activationId: { type: 'string' as const },
    note: { type: 'string' as const },
  },
  additionalProperties: false,
};

export async function rehearsalRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      status?: RehearsalStatus | 'all';
      limit?: string;
      offset?: string;
      search?: string;
    };
  }>('/rehearsals', async (request, reply) => {
    const service = new RehearsalService(
      request.userContext.db,
      request.userContext.userDataManager,
    );
    return reply.status(200).send(
      service.list({
        status: request.query.status ?? 'active',
        limit: parseInt(request.query.limit ?? '50', 10) || 50,
        offset: parseInt(request.query.offset ?? '0', 10) || 0,
        search: request.query.search,
      }),
    );
  });

  app.post<{ Body: CreateRehearsalInput }>(
    '/rehearsals',
    { schema: { body: rehearsalBodySchema } },
    async (request, reply) => {
      const service = new RehearsalService(
        request.userContext.db,
        request.userContext.userDataManager,
      );
      try {
        const rehearsal = service.create(request.body);
        return reply.status(201).send({ rehearsal });
      } catch (error) {
        if (error instanceof RehearsalValidationError) {
          return reply.status(400).send({
            error: error.message,
            code: error.code,
            requiredCueFields: error.requiredCueFields,
          });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/rehearsals/:id',
    async (request, reply) => {
      const service = new RehearsalService(
        request.userContext.db,
        request.userContext.userDataManager,
      );
      const detail = service.getDetail(request.params.id);
      if (!detail) return reply.status(404).send({ error: 'Rehearsal not found' });
      return reply.status(200).send(detail);
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateRehearsalInput }>(
    '/rehearsals/:id',
    { schema: { body: rehearsalPatchSchema } },
    async (request, reply) => {
      const service = new RehearsalService(
        request.userContext.db,
        request.userContext.userDataManager,
      );
      let rehearsal: ReturnType<RehearsalService['update']>;
      try {
        rehearsal = service.update(request.params.id, request.body);
      } catch (error) {
        if (error instanceof RehearsalValidationError) {
          return reply.status(400).send({
            error: error.message,
            code: error.code,
            requiredCueFields: error.requiredCueFields,
          });
        }
        throw error;
      }
      if (!rehearsal) return reply.status(404).send({ error: 'Rehearsal not found' });
      return reply.status(200).send({ rehearsal });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/rehearsals/:id',
    async (request, reply) => {
      const service = new RehearsalService(
        request.userContext.db,
        request.userContext.userDataManager,
      );
      const rehearsal = service.softDelete(request.params.id);
      if (!rehearsal) return reply.status(404).send({ error: 'Rehearsal not found' });
      return reply.status(200).send({ rehearsal });
    },
  );

  app.post<{ Params: { id: string }; Body: RehearsalFeedbackInput }>(
    '/rehearsals/:id/feedback',
    { schema: { body: feedbackSchema } },
    async (request, reply) => {
      const service = new RehearsalService(
        request.userContext.db,
        request.userContext.userDataManager,
      );
      const result = service.recordFeedback(request.params.id, request.body);
      if (!result) return reply.status(404).send({ error: 'Rehearsal not found' });
      return reply.status(200).send(result);
    },
  );
}
