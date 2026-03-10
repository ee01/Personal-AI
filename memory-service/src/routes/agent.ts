/**
 * Agent Model API routes — CRUD for AI agent persona profiles.
 *
 * GET  /agent/:kind          - Get active agent profile content
 * PUT  /agent/:kind          - Update agent profile
 * GET  /agent/:kind/history  - Get version history
 */

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_KINDS = ['identity', 'soul', 'policy'] as const;
type AgentKind = (typeof VALID_KINDS)[number];

interface KindParams {
  kind: string;
}

interface UpdateAgentBody {
  content: string;
  rationale?: string;
}

interface HistoryQuerystring {
  limit?: string;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const kindParamsSchema = {
  type: 'object' as const,
  required: ['kind'],
  properties: {
    kind: { type: 'string' as const, enum: ['identity', 'soul', 'policy'] },
  },
};

const updateAgentBodySchema = {
  type: 'object' as const,
  required: ['content'],
  properties: {
    content: { type: 'string' as const, minLength: 1 },
    rationale: { type: 'string' as const },
  },
  additionalProperties: false,
};

const historyQuerystringSchema = {
  type: 'object' as const,
  properties: {
    limit: { type: 'string' as const },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function agentRoutes(
  app: FastifyInstance,
): Promise<void> {

  // -------------------------------------------------------------------------
  // GET /agent/:kind — Get active agent profile content
  // -------------------------------------------------------------------------
  app.get<{ Params: KindParams }>(
    '/agent/:kind',
    {
      schema: {
        params: kindParamsSchema,
      },
    },
    async (request, reply) => {
      const { db, profileManager } = request.userContext;
      const kind = request.params.kind as AgentKind;

      const content = profileManager.getActiveProfile(kind);

      if (content === null) {
        return reply.status(404).send({
          error: `No active profile found for kind '${kind}'`,
        });
      }

      // Retrieve the full active row to get createdAt (used as updatedAt)
      const row = db
        .prepare(
          'SELECT created_at FROM agent_profile_versions WHERE kind = ? AND is_active = 1',
        )
        .get(kind) as { created_at: number } | undefined;

      return reply.status(200).send({
        kind,
        content,
        updatedAt: row?.created_at ?? 0,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /agent/:kind — Update agent profile
  // -------------------------------------------------------------------------
  app.put<{ Params: KindParams; Body: UpdateAgentBody }>(
    '/agent/:kind',
    {
      schema: {
        params: kindParamsSchema,
        body: updateAgentBodySchema,
      },
    },
    async (request, reply) => {
      const { profileManager } = request.userContext;
      const kind = request.params.kind as AgentKind;
      const { content, rationale } = request.body;

      const id = profileManager.updateProfile(kind, content, 'user', rationale);

      return reply.status(200).send({
        id,
        kind,
        message: 'Profile updated',
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /agent/:kind/history — Get version history
  // -------------------------------------------------------------------------
  app.get<{ Params: KindParams; Querystring: HistoryQuerystring }>(
    '/agent/:kind/history',
    {
      schema: {
        params: kindParamsSchema,
        querystring: historyQuerystringSchema,
      },
    },
    async (request, reply) => {
      const { profileManager } = request.userContext;
      const kind = request.params.kind as AgentKind;
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1),
        200,
      );

      const versions = profileManager.getProfileHistory(kind, limit);

      return reply.status(200).send({
        kind,
        versions,
      });
    },
  );
}
