/**
 * Recall route — active research recall.
 *
 * POST /recall
 *
 * Active recall pipeline. Returns:
 *   - `items`     : evidence list (always)
 *   - `blocks`    : structured UI blocks (when `blockTypes` is provided)
 *   - `analysis`  : LLM-synthesized summary / findings (when `blockTypes`
 *                   includes `'summary'`)
 *
 * The single `blockTypes` field decides everything: omit it for a fast
 * evidence-only response; include `'summary'` to opt-in to the LLM stage.
 *
 * For passive associative recall used by web/meeting bubbles, see
 * POST /context-recall instead.
 */

import type { FastifyInstance } from 'fastify';

import type { RecallQuery, RecallResult } from '../types/index.js';
import { ActiveRecallService } from '../core/ActiveRecallService.js';

const recallBodySchema = {
  type: 'object' as const,
  required: ['query'],
  properties: {
    query: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both', 'all'],
    },
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
        enum: [
          'Person',
          'Project',
          'Task',
          'Organization',
          'Document',
          'Technology',
          'Topic',
        ],
      },
    },
    projectFilter: { type: 'string' as const },
    minSalience: { type: 'number' as const },
    includeMetadata: { type: 'boolean' as const },
    senderFilter: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    groupFilter: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    minImportance: { type: 'number' as const },
    sourceTypes: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    presentationHint: {
      type: 'string' as const,
      enum: [
        'default',
        'compact',
        'meeting_pilot',
        'research',
        'dashboard',
      ],
    },
    previewMaxLength: { type: 'number' as const, minimum: 16, maximum: 280 },
    analysisMode: {
      type: 'string' as const,
      enum: ['search', 'research', 'aggregate'],
    },
    blockTypes: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: [
          'summary',
          'timeline',
          'table',
          'chart',
          'evidence_list',
          'media',
        ],
      },
    },
  },
  additionalProperties: false,
};

export async function recallRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RecallQuery }>(
    '/recall',
    {
      schema: {
        body: recallBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new ActiveRecallService(db);
      const query: RecallQuery = {
        ...request.body,
        scope: request.body.scope ?? 'work',
      };

      try {
        const result: RecallResult = await service.recall(query);
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
