/**
 * Ingest route.
 *
 * POST /ingest - accepts an IngestPayload, validates it,
 * delegates to the IngestionPipeline, and returns an IngestResult.
 */

import type { FastifyInstance } from 'fastify';

import type { IngestPayload, IngestResult } from '../types/index.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';

const sourceTypeEnum = [
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'meeting',
  'calendar',
  'ai_chat',
  'doubao',
] as const;

const ingestDecisionSchema = {
  type: 'object' as const,
  properties: {
    storage: {
      type: 'string' as const,
      enum: ['indexed', 'stored_unindexed', 'duplicate', 'error'],
    },
    reason: {
      type: 'string' as const,
      enum: [
        'salience_indexed',
        'salience_below_threshold',
        'extraction_skipped',
        'extraction_unavailable',
        'duplicate_post_id',
        'duplicate_content_source_sender',
        'insert_failed',
      ],
    },
    salienceScore: { type: 'number' as const },
    shouldIndex: { type: 'boolean' as const },
    indexed: { type: 'boolean' as const },
    duplicateOf: { type: 'string' as const },
    dedupeReason: {
      type: 'string' as const,
      enum: ['post_id', 'content_source_sender'],
    },
  },
};

const ingestBodySchema = {
  type: 'object' as const,
  required: ['content', 'sourceType'],
  properties: {
    content: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal'],
    },
    source: { type: 'string' as const, minLength: 1 },
    sourceType: {
      type: 'string' as const,
      enum: sourceTypeEnum,
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

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
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
              status: {
                type: 'string',
                enum: ['created', 'duplicate', 'error'],
              },
              entitiesExtracted: { type: 'number' },
              matchedProjects: { type: 'array', items: { type: 'string' } },
              decision: ingestDecisionSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db, userDataManager } = request.userContext;
      const pipeline = new IngestionPipeline(
        db,
        userDataManager,
        request.userId,
      );
      const payload = request.body;

      const result: IngestResult = await pipeline.ingest(payload);

      const statusCode = result.status === 'error' ? 500 : 200;
      return reply.status(statusCode).send(result);
    },
  );
}
