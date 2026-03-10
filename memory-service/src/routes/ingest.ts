/**
 * Ingest route.
 *
 * POST /ingest - accepts an IngestPayload, validates it,
 * delegates to the IngestionPipeline, and returns an IngestResult.
 */

import type { FastifyInstance } from 'fastify';

import type { IngestPayload, IngestResult } from '../types/index.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';

const ingestBodySchema = {
  type: 'object' as const,
  required: ['content', 'sourceType'],
  properties: {
    content: { type: 'string' as const, minLength: 1 },
    sourceType: {
      type: 'string' as const,
      enum: ['glip', 'jira', 'web', 'manual', 'system'],
    },
    sender: { type: 'string' as const },
    groupId: { type: 'string' as const },
    groupName: { type: 'string' as const },
    sourceUrl: { type: 'string' as const },
    sourceTitle: { type: 'string' as const },
    timestamp: { type: 'number' as const },
    metadata: { type: 'object' as const, additionalProperties: true },
    skipExtraction: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function ingestRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: IngestPayload }>(
    '/ingest',
    {
      schema: {
        body: ingestBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['created', 'duplicate', 'error'] },
              entitiesExtracted: { type: 'number' },
              matchedProjects: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db, userDataManager } = request.userContext;
      const pipeline = new IngestionPipeline(db, userDataManager);
      const payload = request.body;

      const result: IngestResult = await pipeline.ingest(payload);

      const statusCode = result.status === 'error' ? 500 : 200;
      return reply.status(statusCode).send(result);
    },
  );
}
