/**
 * Lifecycle route (P1-6 slice C): explicit forgetting / compression endpoints.
 *
 * POST /lifecycle/forget   { scope?, source?, sourceType?, olderThanDays?, dryRun }
 *   Range-forget (downgrade, never physical delete). dryRun previews the impact.
 * POST /lifecycle/compress { entityId?, topic?, dryRun }
 *   Compress weak/archived chunks of a subject into one summary chunk.
 *
 * Both are reversible-by-design: originals stay in messages_raw; only retrieval
 * tiers move. These are the missing "forgetting" and "compression" faces of the
 * six-operation memory taxonomy.
 */

import type { FastifyInstance } from 'fastify';

import { LifecycleService } from '../core/LifecycleService.js';

interface ForgetBody {
  scope?: string;
  source?: string;
  sourceType?: string;
  olderThanDays?: number;
  dryRun?: boolean;
}

interface CompressBody {
  entityId?: string;
  topic?: string;
  dryRun?: boolean;
}

const forgetBodySchema = {
  type: 'object' as const,
  properties: {
    scope: { type: 'string' as const },
    source: { type: 'string' as const },
    sourceType: { type: 'string' as const },
    olderThanDays: { type: 'number' as const, minimum: 0 },
    dryRun: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

const compressBodySchema = {
  type: 'object' as const,
  properties: {
    entityId: { type: 'string' as const },
    topic: { type: 'string' as const },
    dryRun: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function lifecycleRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ForgetBody }>(
    '/lifecycle/forget',
    { schema: { body: forgetBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const result = new LifecycleService(db).forget(request.body ?? {});
      return reply.status(200).send(result);
    },
  );

  app.post<{ Body: CompressBody }>(
    '/lifecycle/compress',
    { schema: { body: compressBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const body = request.body ?? {};
      if (!body.entityId && !body.topic) {
        return reply
          .status(400)
          .send({ error: 'compress requires entityId or topic' });
      }
      const result = await new LifecycleService(db).compress(body);
      return reply.status(200).send(result);
    },
  );
}
