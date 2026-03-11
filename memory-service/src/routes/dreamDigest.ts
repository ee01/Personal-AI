/**
 * Dream Digest control routes.
 *
 * POST /dream-digest/push-now — Manually trigger a dream digest push.
 */

import type { FastifyInstance } from 'fastify';
import { HeartbeatLoop } from '../core/HeartbeatLoop.js';

interface PushNowBody {
  force?: boolean;
}

const pushNowBodySchema = {
  type: 'object' as const,
  properties: {
    force: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function dreamDigestRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PushNowBody }>(
    '/dream-digest/push-now',
    { schema: { body: pushNowBodySchema } },
    async (request, reply) => {
      const { db, userDataManager } = request.userContext;
      const loop = new HeartbeatLoop(db, userDataManager);
      const result = await loop.triggerDreamDigestNow();
      return reply.status(200).send(result);
    },
  );
}
