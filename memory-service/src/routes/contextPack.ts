/**
 * GET /api/v1/context-pack
 *
 * Read-only prompt packs for Help Center 「记忆外接」 and external HTTP clients.
 */

import type { FastifyInstance } from 'fastify';

import {
  ContextPackService,
  CONTEXT_PACK_SCOPES,
  isContextPackScope,
  type ContextPackScope,
} from '../core/ContextPackService.js';

interface ContextPackQuery {
  scope?: string;
  q?: string;
  timezone?: string;
}

export async function contextPackRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ContextPackQuery }>(
    '/context-pack',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: CONTEXT_PACK_SCOPES,
            },
            q: { type: 'string' },
            timezone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const scopeRaw = (request.query.scope || 'identity_preferences').trim();
      if (!isContextPackScope(scopeRaw)) {
        return reply.code(400).send({
          error: 'invalid_scope',
          message: `scope must be one of: ${CONTEXT_PACK_SCOPES.join(', ')}`,
        });
      }
      const scope: ContextPackScope = scopeRaw;
      if (scope === 'custom' && !(request.query.q || '').trim()) {
        return reply.code(400).send({
          error: 'missing_query',
          message: 'scope=custom requires a non-empty q parameter',
        });
      }

      const service = new ContextPackService(
        request.userContext.db,
        request.userId,
      );
      const pack = await service.build({
        scope,
        query: request.query.q,
        timezone: request.query.timezone,
      });
      return reply.send(pack);
    },
  );
}
