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

const ingestPayloadItemSchema = {
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

export async function ingestBatchRoutes(
  app: FastifyInstance,
): Promise<void> {
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
                    status: { type: 'string', enum: ['created', 'duplicate', 'error'] },
                    entitiesExtracted: { type: 'number' },
                    matchedProjects: { type: 'array', items: { type: 'string' } },
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
      const pipeline = new IngestionPipeline(db, userDataManager, request.userId);
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
