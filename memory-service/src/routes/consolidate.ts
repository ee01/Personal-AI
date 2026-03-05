/**
 * Manual consolidation trigger route.
 *
 * POST /consolidate — Trigger daily consolidation or weekly dreaming on demand.
 */

import type { FastifyInstance } from 'fastify';

import { ConsolidationEngine } from '../core/ConsolidationEngine.js';
import { GenerativeReplay } from '../core/GenerativeReplay.js';

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface ConsolidateBody {
  scope: 'daily' | 'weekly';
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const consolidateBodySchema = {
  type: 'object' as const,
  required: ['scope'],
  properties: {
    scope: {
      type: 'string' as const,
      enum: ['daily', 'weekly'],
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function consolidateRoutes(
  app: FastifyInstance,
): Promise<void> {
  // POST /consolidate — Trigger consolidation manually
  app.post<{ Body: ConsolidateBody }>(
    '/consolidate',
    { schema: { body: consolidateBodySchema } },
    async (request, reply) => {
      const { db, userDataManager } = request.userContext;
      const { scope } = request.body;

      if (scope === 'daily') {
        const engine = new ConsolidationEngine(db, userDataManager);
        const result = await engine.runDailyConsolidation();
        return reply.status(200).send({ scope, result });
      }

      if (scope === 'weekly') {
        const replay = new GenerativeReplay(db, userDataManager);
        const result = await replay.runWeeklyDreaming();
        return reply.status(200).send({ scope, result });
      }

      return reply.status(400).send({ error: `Unknown scope: ${scope}` });
    },
  );
}
