/**
 * Context Recall route — passive associative recall.
 *
 * POST /context-recall
 *
 * Replaces the legacy POST /context-match endpoint. The new contract is
 * surface-aware (web/meeting/popup) and returns multiple matches with stable
 * `exploreLink`s back into the memory-exploring (Vue) UI.
 */

import type { FastifyInstance } from 'fastify';

import { ContextRecallService } from '../core/ContextRecallService.js';
import type {
  ContextRecallRequest,
  ContextRecallResponse,
} from '../types/index.js';

const contextRecallBodySchema = {
  type: 'object' as const,
  required: ['surface', 'contextType'],
  properties: {
    surface: {
      type: 'string' as const,
      enum: [
        'web_passive',
        'meeting_passive',
        'popup_passive',
        'follow_thread',
        'meeting_prep',
        'composer_guard',
      ],
    },
    contextType: {
      type: 'string' as const,
      enum: [
        'webpage',
        'meeting',
        'message_thread',
        'jira_issue',
        'document',
        'selected_text',
      ],
    },
    title: { type: 'string' as const },
    url: { type: 'string' as const },
    sourceContext: {
      type: 'object' as const,
      properties: {
        contextType: { type: 'string' as const },
        sourceType: { type: 'string' as const },
        host: { type: 'string' as const },
        url: { type: 'string' as const },
        title: { type: 'string' as const },
        participants: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        topic: { type: 'string' as const },
        meetingId: { type: 'string' as const },
        groupId: { type: 'string' as const },
        conversationId: { type: 'string' as const },
        messageId: { type: 'string' as const },
        issueKey: { type: 'string' as const },
        calendarEventId: { type: 'string' as const },
      },
      additionalProperties: false,
    },
    exclude: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        urls: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        meetingIds: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        groupIds: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        conversationIds: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
      },
      additionalProperties: false,
    },
    primaryText: { type: 'string' as const },
    secondaryTexts: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    entityHints: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['kind', 'value'],
        properties: {
          kind: { type: 'string' as const },
          value: { type: 'string' as const },
          entityId: { type: 'string' as const },
        },
        additionalProperties: false,
      },
    },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both', 'all'],
    },
    sourceTypes: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    limit: { type: 'integer' as const, minimum: 1, maximum: 5 },
    debug: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function contextRecallRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ContextRecallRequest }>(
    '/context-recall',
    {
      schema: {
        body: contextRecallBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new ContextRecallService(db);
      try {
        const result: ContextRecallResponse = await service.recall(
          request.body,
        );
        return reply.send(result);
      } catch (err) {
        request.log.warn({ err }, 'context-recall failed');
        const fallback: ContextRecallResponse = {
          matches: [],
          topMatch: null,
          queryTimeMs: 0,
          debug: request.body?.debug
            ? {
                normalizedQuery: '',
                channelsHit: [],
                rejectedReason: 'internal_error',
              }
            : undefined,
        };
        return reply.send(fallback);
      }
    },
  );
}
