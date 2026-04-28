import type { FastifyInstance } from 'fastify';

import type { RecallScope } from '../types/index.js';

interface DeleteMemoriesQuerystring {
  source: string;
  scope?: RecallScope;
}

const deleteMemoriesQuerystringSchema = {
  type: 'object' as const,
  required: ['source'],
  properties: {
    source: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both'],
    },
  },
  additionalProperties: false,
};

function buildScopePredicate(scope: RecallScope | undefined): {
  clause: string;
  params: string[];
} {
  if (!scope || scope === 'work') {
    return {
      clause: `AND COALESCE(scope, 'work') = ?`,
      params: ['work'],
    };
  }

  if (scope === 'personal') {
    return {
      clause: `AND COALESCE(scope, 'work') = ?`,
      params: ['personal'],
    };
  }

  return { clause: '', params: [] };
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Querystring: DeleteMemoriesQuerystring }>(
    '/memories',
    {
      schema: {
        querystring: deleteMemoriesQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              scope: { type: 'string' },
              deletedMessages: { type: 'number' },
              deletedChunks: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const source = request.query.source.trim();
      const scope = request.query.scope ?? 'work';
      const { clause: scopeClause, params: scopeParams } =
        buildScopePredicate(scope);

      const matchingMessages = db
        .prepare(
          `SELECT id
           FROM messages_raw
           WHERE source = ? ${scopeClause}`,
        )
        .all(source, ...scopeParams) as Array<{ id: string }>;
      const messageIds = matchingMessages.map((row) => row.id);

      const matchingChunks = db
        .prepare(
          `SELECT chunk_id
           FROM chunks
           WHERE source = ? ${scopeClause}`,
        )
        .all(source, ...scopeParams) as Array<{ chunk_id: number }>;
      const chunkIds = matchingChunks.map((row) => row.chunk_id);

      db.transaction(() => {
        if (chunkIds.length > 0) {
          const chunkPlaceholders = chunkIds
            .map(() => 'CAST(? AS INTEGER)')
            .join(', ');
          try {
            db.prepare(
              `DELETE FROM chunks_vec WHERE chunk_id IN (${chunkPlaceholders})`,
            ).run(...chunkIds);
          } catch {
            // sqlite-vec may be unavailable in some environments
          }
          db.prepare(
            `DELETE FROM chunks WHERE chunk_id IN (${chunkPlaceholders})`,
          ).run(...chunkIds);
          const chunkIdStrings = chunkIds.map(String);
          const metadataChunkPlaceholders = chunkIdStrings
            .map(() => '?')
            .join(', ');
          db.prepare(
            `DELETE FROM memory_metadata
             WHERE target_type = 'chunk' AND target_id IN (${metadataChunkPlaceholders})`,
          ).run(...chunkIdStrings);
        }

        if (messageIds.length > 0) {
          const messagePlaceholders = messageIds.map(() => '?').join(', ');
          try {
            db.prepare(
              `DELETE FROM messages_vec WHERE message_id IN (${messagePlaceholders})`,
            ).run(...messageIds);
          } catch {
            // sqlite-vec may be unavailable in some environments
          }
          db.prepare(
            `DELETE FROM messages_raw WHERE id IN (${messagePlaceholders})`,
          ).run(...messageIds);
          db.prepare(
            `DELETE FROM memory_metadata
             WHERE target_type = 'message' AND target_id IN (${messagePlaceholders})`,
          ).run(...messageIds);
        }
      })();

      return reply.status(200).send({
        source,
        scope,
        deletedMessages: messageIds.length,
        deletedChunks: chunkIds.length,
      });
    },
  );
}
