/**
 * Batch ingestion route.
 *
 * POST /ingest/batch - accepts an array of IngestPayload items,
 * processes each through the IngestionPipeline, and returns
 * aggregated results with summary statistics.
 */

import type { FastifyInstance } from 'fastify';

import type { IngestPayload, IngestResult } from '../types/index.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { getEventBus } from './events.js';

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface BatchIngestBody {
  items: IngestPayload[];
}

interface BatchIngestResponse {
  results: IngestResult[];
  totalCreated: number;
  totalDuplicate: number;
  totalError: number;
}

// ---------------------------------------------------------------------------
// JSON schema for Fastify validation
// ---------------------------------------------------------------------------

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

const ingestPayloadItemSchema = {
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

const batchBodySchema = {
  type: 'object' as const,
  required: ['items'],
  properties: {
    items: {
      type: 'array' as const,
      items: ingestPayloadItemSchema,
      minItems: 1,
      maxItems: 500,
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function ingestBatchRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BatchIngestBody }>(
    '/ingest/batch',
    {
      schema: {
        body: batchBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['created', 'duplicate', 'error'],
                    },
                    entitiesExtracted: { type: 'number' },
                    matchedProjects: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    decision: ingestDecisionSchema,
                  },
                },
              },
              totalCreated: { type: 'number' },
              totalDuplicate: { type: 'number' },
              totalError: { type: 'number' },
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
      const { items } = request.body;
      const results: IngestResult[] = [];

      let totalCreated = 0;
      let totalDuplicate = 0;
      let totalError = 0;

      for (const item of items) {
        try {
          const result = await pipeline.ingest(item);
          results.push(result);

          switch (result.status) {
            case 'created':
              totalCreated++;
              break;
            case 'duplicate':
              totalDuplicate++;
              break;
            case 'error':
              totalError++;
              break;
          }
        } catch (err) {
          request.log.error(err, 'Batch item ingestion failed');
          results.push({
            id: '',
            status: 'error',
            decision: {
              storage: 'error',
              reason: 'insert_failed',
              indexed: false,
            },
          });
          totalError++;
        }
      }

      // Emit a single event after the entire batch completes
      const bus = getEventBus();
      bus.emit('ingestion_complete', {
        batch: true,
        totalItems: items.length,
        totalCreated,
        totalDuplicate,
        totalError,
        timestamp: Date.now(),
      });

      const response: BatchIngestResponse = {
        results,
        totalCreated,
        totalDuplicate,
        totalError,
      };

      return reply.status(200).send(response);
    },
  );
}
