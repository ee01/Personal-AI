import type { FastifyInstance } from 'fastify';

import { MemoryOutcomeLoopService } from '../core/MemoryOutcomeLoopService.js';

const summaryQuerySchema = {
  type: 'object' as const,
  properties: {
    window: { type: 'string' as const },
  },
  additionalProperties: false,
};

const policyQuerySchema = {
  type: 'object' as const,
  properties: {
    limit: { type: 'string' as const },
  },
  additionalProperties: false,
};

const revokeParamsSchema = {
  type: 'object' as const,
  required: ['id'],
  properties: {
    id: { type: 'string' as const, minLength: 1, maxLength: 256 },
  },
  additionalProperties: false,
};

export async function outcomeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { window?: string } }>(
    '/outcomes/summary',
    { schema: { querystring: summaryQuerySchema } },
    async (request) => {
      const windowDays = parseWindowDays(request.query.window);
      const service = new MemoryOutcomeLoopService(
        request.userContext.db,
        request.userId,
      );
      return service.getSummary(windowDays);
    },
  );

  app.get<{ Querystring: { limit?: string } }>(
    '/outcomes/policy-patches',
    { schema: { querystring: policyQuerySchema } },
    async (request) => {
      const service = new MemoryOutcomeLoopService(
        request.userContext.db,
        request.userId,
      );
      return {
        patches: service.listPolicyPatches(parseLimit(request.query.limit)),
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/outcomes/policy-patches/:id/revoke',
    { schema: { params: revokeParamsSchema } },
    async (request, reply) => {
      const service = new MemoryOutcomeLoopService(
        request.userContext.db,
        request.userId,
      );
      const patch = service.revokePolicyPatch(request.params.id);
      if (!patch) {
        return reply.status(404).send({ error: 'policy patch not found' });
      }
      return { status: 'ok', patch };
    },
  );
}

function parseWindowDays(value: unknown): number {
  const text = typeof value === 'string' ? value : '';
  const numeric = Number(text.replace(/d$/i, ''));
  if (!Number.isFinite(numeric)) return 7;
  return Math.max(1, Math.min(90, Math.floor(numeric)));
}

function parseLimit(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
}
