import type { FastifyInstance } from 'fastify';
import { AttentionService, attentionMode } from '../core/AttentionService.js';
export async function attentionRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { postIds?: string } }>(
    '/attention',
    async (request) => ({
      mode: attentionMode(),
      items: new AttentionService(
        request.userContext.db,
        request.userId,
      ).listForPosts(
        (request.query.postIds ?? '').split(',').filter(Boolean).slice(0, 50),
      ),
    }),
  );
  app.get('/attention/open-loops', async (request) => ({
    items: new AttentionService(
      request.userContext.db,
      request.userId,
    ).openLoops(),
  }));
  app.post<{
    Params: { id: string };
    Body: {
      verdict:
        | 'accepted'
        | 'remind'
        | 'completed'
        | 'not_relevant'
        | 'dismissed'
        | 'cancelled';
    };
  }>(
    '/attention/:id/decision',
    {
      schema: {
        body: {
          type: 'object',
          required: ['verdict'],
          additionalProperties: false,
          properties: {
            verdict: {
              type: 'string',
              enum: [
                'accepted',
                'remind',
                'completed',
                'not_relevant',
                'dismissed',
                'cancelled',
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const service = new AttentionService(
        request.userContext.db,
        request.userId,
      );
      if (!service.get(request.params.id))
        return reply.code(404).send({ error: 'attention_not_found' });
      return { item: service.decide(request.params.id, request.body.verdict) };
    },
  );
  app.post<{
    Params: { id: string };
    Body: { key: 'manager' | 'role'; value: string };
  }>(
    '/attention/:id/identity',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'value'],
          additionalProperties: false,
          properties: {
            key: { enum: ['manager', 'role'], type: 'string' },
            value: { type: 'string', minLength: 1, maxLength: 160 },
          },
        },
      },
    },
    async (request, reply) => {
      if (process.env.ATTENTION_MANAGER_CHIP_ENABLED !== 'true')
        return reply.code(403).send({ error: 'identity_chip_disabled' });
      const service = new AttentionService(
        request.userContext.db,
        request.userId,
      );
      if (!service.get(request.params.id))
        return reply.code(404).send({ error: 'attention_not_found' });
      return {
        item: service.confirmIdentity(
          request.params.id,
          request.body.key,
          request.body.value,
        ),
      };
    },
  );
}
