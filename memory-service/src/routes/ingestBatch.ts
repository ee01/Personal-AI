/**
 * Batch ingestion route.
 *
 * POST /ingest/batch - accepts an array of IngestPayload items,
 * processes each through the IngestionPipeline, and returns
 * aggregated results with summary statistics.
 */

import type { FastifyInstance } from 'fastify';

import {
  SOURCE_TYPES,
  type BatchIngestDecisionSummary,
  type IngestDecisionReason,
  type IngestExtractionStatus,
  type IngestPayload,
  type IngestResult,
  type IngestSanitization,
  type IngestStorageDecision,
  type IngestTrustClass,
} from '../types/index.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { getEventBus } from './events.js';
import { ingestClaimAttributionDecisionSchema } from './claimAttributionSchemas.js';

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
  decisionSummary: BatchIngestDecisionSummary;
}

const INGEST_STORAGE_KEYS = [
  'indexed',
  'stored_unindexed',
  'duplicate',
  'error',
] as const satisfies readonly IngestStorageDecision[];

const INGEST_DECISION_REASONS = [
  'salience_indexed',
  'salience_below_threshold',
  'extraction_skipped',
  'extraction_unavailable',
  'duplicate_post_id',
  'duplicate_content_source_sender',
  'indexing_failed',
  'insert_failed',
] as const satisfies readonly IngestDecisionReason[];

const INGEST_EXTRACTION_STATUSES = [
  'extracted',
  'skipped',
  'unavailable',
] as const satisfies readonly IngestExtractionStatus[];

const INGEST_TRUST_CLASSES = [
  'trusted',
  'internal',
  'untrusted',
] as const satisfies readonly IngestTrustClass[];

const INGEST_SANITIZATION_STATUSES = [
  'clean',
  'flagged',
] as const satisfies readonly IngestSanitization[];

// ---------------------------------------------------------------------------
// JSON schema for Fastify validation
// ---------------------------------------------------------------------------

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
        'indexing_failed',
        'insert_failed',
      ],
    },
    salienceScore: { type: 'number' as const },
    salienceComponents: {
      type: 'object' as const,
      properties: {
        importance: { type: 'number' as const },
        frequency: { type: 'number' as const },
        recency: { type: 'number' as const },
        surprise: { type: 'number' as const },
        redundancy: { type: 'number' as const },
        userInterestBoost: { type: 'number' as const },
        entityAffinityBoost: { type: 'number' as const },
      },
    },
    extractionStatus: {
      type: 'string' as const,
      enum: ['extracted', 'skipped', 'unavailable'],
    },
    shouldIndex: { type: 'boolean' as const },
    indexed: { type: 'boolean' as const },
    duplicateOf: { type: 'string' as const },
    dedupeReason: {
      type: 'string' as const,
      enum: ['post_id', 'content_source_sender'],
    },
    trustClass: {
      type: 'string' as const,
      enum: ['trusted', 'internal', 'untrusted'],
    },
    sanitization: {
      type: 'string' as const,
      enum: ['clean', 'flagged'],
    },
    injectionFlags: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    mergeOp: {
      type: 'object' as const,
      properties: {
        op: {
          type: 'string' as const,
          enum: ['UPDATE', 'MERGE', 'NOOP'],
        },
        neighborIds: {
          type: 'array' as const,
          items: { type: 'number' as const },
        },
        reason: { type: 'string' as const },
      },
    },
    claimAttribution: ingestClaimAttributionDecisionSchema,
  },
};

const decisionReasonCountSchema = {
  type: 'object' as const,
  properties: {
    salience_indexed: { type: 'number' as const },
    salience_below_threshold: { type: 'number' as const },
    extraction_skipped: { type: 'number' as const },
    extraction_unavailable: { type: 'number' as const },
    duplicate_post_id: { type: 'number' as const },
    duplicate_content_source_sender: { type: 'number' as const },
    indexing_failed: { type: 'number' as const },
    insert_failed: { type: 'number' as const },
    unknown: { type: 'number' as const },
  },
};

const batchDecisionSummarySchema = {
  type: 'object' as const,
  properties: {
    totalItems: { type: 'number' as const },
    storage: {
      type: 'object' as const,
      properties: {
        indexed: { type: 'number' as const },
        stored_unindexed: { type: 'number' as const },
        duplicate: { type: 'number' as const },
        error: { type: 'number' as const },
        unknown: { type: 'number' as const },
      },
    },
    reasons: decisionReasonCountSchema,
    extractionStatus: {
      type: 'object' as const,
      properties: {
        extracted: { type: 'number' as const },
        skipped: { type: 'number' as const },
        unavailable: { type: 'number' as const },
        unknown: { type: 'number' as const },
      },
    },
    trustClass: {
      type: 'object' as const,
      properties: {
        trusted: { type: 'number' as const },
        internal: { type: 'number' as const },
        untrusted: { type: 'number' as const },
        unknown: { type: 'number' as const },
      },
    },
    sanitization: {
      type: 'object' as const,
      properties: {
        clean: { type: 'number' as const },
        flagged: { type: 'number' as const },
        unknown: { type: 'number' as const },
      },
    },
    indexing: {
      type: 'object' as const,
      properties: {
        requested: { type: 'number' as const },
        completed: { type: 'number' as const },
        notRequested: { type: 'number' as const },
        failedAfterRequest: { type: 'number' as const },
        unknown: { type: 'number' as const },
      },
    },
    missingDecision: { type: 'number' as const },
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
      enum: SOURCE_TYPES,
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
              decisionSummary: batchDecisionSummarySchema,
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
        decisionSummary: buildBatchDecisionSummary(results, items.length),
      };

      return reply.status(200).send(response);
    },
  );
}

function createCountRecord<T extends readonly string[]>(
  keys: T,
): Record<T[number] | 'unknown', number> {
  const record = { unknown: 0 } as Record<T[number] | 'unknown', number>;
  for (const key of keys) {
    record[key as T[number]] = 0;
  }
  return record;
}

function buildBatchDecisionSummary(
  results: IngestResult[],
  totalItems: number,
): BatchIngestDecisionSummary {
  const summary: BatchIngestDecisionSummary = {
    totalItems,
    storage: createCountRecord(INGEST_STORAGE_KEYS),
    reasons: createCountRecord(INGEST_DECISION_REASONS),
    extractionStatus: createCountRecord(INGEST_EXTRACTION_STATUSES),
    trustClass: createCountRecord(INGEST_TRUST_CLASSES),
    sanitization: createCountRecord(INGEST_SANITIZATION_STATUSES),
    indexing: {
      requested: 0,
      completed: 0,
      notRequested: 0,
      failedAfterRequest: 0,
      unknown: 0,
    },
    missingDecision: 0,
  };

  for (const result of results) {
    const decision = result.decision;
    if (!decision) {
      summary.missingDecision++;
      summary.storage.unknown++;
      summary.reasons.unknown++;
      summary.extractionStatus.unknown++;
      summary.trustClass.unknown++;
      summary.sanitization.unknown++;
      summary.indexing.unknown++;
      continue;
    }

    if (decision.storage && decision.storage in summary.storage) {
      summary.storage[decision.storage]++;
    } else {
      summary.storage.unknown++;
    }

    if (decision.reason && decision.reason in summary.reasons) {
      summary.reasons[decision.reason]++;
    } else {
      summary.reasons.unknown++;
    }

    if (
      decision.extractionStatus &&
      decision.extractionStatus in summary.extractionStatus
    ) {
      summary.extractionStatus[decision.extractionStatus]++;
    } else {
      summary.extractionStatus.unknown++;
    }

    if (decision.trustClass && decision.trustClass in summary.trustClass) {
      summary.trustClass[decision.trustClass]++;
    } else {
      summary.trustClass.unknown++;
    }

    if (
      decision.sanitization &&
      decision.sanitization in summary.sanitization
    ) {
      summary.sanitization[decision.sanitization]++;
    } else {
      summary.sanitization.unknown++;
    }

    if (decision.shouldIndex === true) {
      summary.indexing.requested++;
      if (decision.indexed === false) {
        summary.indexing.failedAfterRequest++;
      }
    } else if (decision.shouldIndex === false) {
      summary.indexing.notRequested++;
    } else {
      summary.indexing.unknown++;
    }

    if (decision.indexed === true) {
      summary.indexing.completed++;
    }
  }

  return summary;
}
