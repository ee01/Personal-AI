import type { FastifyInstance } from 'fastify';

import { ContextAssistService } from '../core/ContextAssistService.js';
import type {
  ContextAssistRequest,
  ContextAssistResponse,
} from '../types/index.js';

const participantSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const },
    email: { type: 'string' as const },
    responseStatus: { type: 'string' as const },
  },
  additionalProperties: false,
};

const contextAssistBodySchema = {
  type: 'object' as const,
  required: ['surface', 'contextType'],
  properties: {
    surface: {
      type: 'string' as const,
      enum: ['meeting_prep', 'composer_guard'],
    },
    contextType: {
      type: 'string' as const,
      enum: ['meeting', 'message_thread', 'jira_issue', 'web_agent_prompt'],
    },
    title: { type: 'string' as const },
    url: { type: 'string' as const },
    userGoal: { type: 'string' as const },
    primaryText: { type: 'string' as const },
    secondaryTexts: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 12,
    },
    keywords: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 12,
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
      maxItems: 24,
    },
    event: {
      type: 'object' as const,
      properties: {
        externalId: { type: 'string' as const },
        seriesKey: { type: 'string' as const },
        title: { type: 'string' as const },
        descriptionPreview: { type: 'string' as const },
        startTime: { type: 'number' as const },
        endTime: { type: 'number' as const },
        organizer: participantSchema,
        attendees: {
          type: 'array' as const,
          items: participantSchema,
          maxItems: 80,
        },
        location: { type: 'string' as const },
        joinUrl: { type: 'string' as const },
        sourceUrl: { type: 'string' as const },
        cancelled: { type: 'boolean' as const },
        lastModifiedTime: { type: 'number' as const },
        metadata: {
          type: 'object' as const,
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    composer: {
      type: 'object' as const,
      additionalProperties: true,
    },
    sourceTypes: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 20,
    },
    limit: { type: 'integer' as const, minimum: 1, maximum: 5 },
    debug: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function contextAssistRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ContextAssistRequest }>(
    '/context-assist',
    {
      schema: {
        body: contextAssistBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new ContextAssistService(db, request.userId);
      try {
        const result: ContextAssistResponse = await service.assist(
          request.body,
        );
        return reply.send(result);
      } catch (err) {
        request.log.warn({ err }, 'context-assist failed');
        const fallback: ContextAssistResponse = {
          available: false,
          surface: request.body?.surface || 'meeting_prep',
          suggestionType: 'none',
          title: '情境助理暂不可用',
          summary: 'Personal AI 无法读取相关记忆。',
          cueCards: [],
          evidence: [],
          riskLevel: 'low',
          previewRequired: false,
          confidence: 0,
          queryTimeMs: 0,
          debug: request.body?.debug
            ? {
                rejectedReason: 'internal_error',
              }
            : undefined,
        };
        return reply.send(fallback);
      }
    },
  );
}
