/**
 * Recall route.
 *
 * POST /recall - accepts a RecallQuery, delegates to the
 * RecallEngine, and returns a RecallResult.
 */

import type { FastifyInstance } from 'fastify';

import type { RecallQuery, RecallResult } from '../types/index.js';
import { RecallEngine } from '../core/RecallEngine.js';

const recallBodySchema = {
  type: 'object' as const,
  required: ['query'],
  properties: {
    query: { type: 'string' as const, minLength: 1 },
    topK: { type: 'number' as const, minimum: 1, maximum: 100 },
    channels: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['vector', 'fts', 'graph', 'time'],
      },
    },
    timeRange: {
      type: 'object' as const,
      properties: {
        start: { type: 'number' as const },
        end: { type: 'number' as const },
      },
    },
    entityTypes: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['Person', 'Project', 'Task', 'Organization', 'Document', 'Technology', 'Topic'],
      },
    },
    projectFilter: { type: 'string' as const },
    minSalience: { type: 'number' as const },
    includeMetadata: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function recallRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: RecallQuery }>(
    '/recall',
    {
      schema: {
        body: recallBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    content: { type: 'string' },
                    score: { type: 'number' },
                    source: { type: 'string' },
                    timestamp: { type: 'number' },
                    metadata: { type: 'object' },
                  },
                },
              },
              totalFound: { type: 'number' },
              queryTimeMs: { type: 'number' },
              channels: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const engine = new RecallEngine(db);
      const query = request.body;

      try {
        const result: RecallResult = await engine.recall(query);
        return reply.status(200).send(result);
      } catch (err) {
        request.log.error(err, 'Recall failed');
        return reply.status(500).send({
          items: [],
          totalFound: 0,
          queryTimeMs: 0,
          channels: [],
          error: (err as Error).message,
        });
      }
    },
  );
}
