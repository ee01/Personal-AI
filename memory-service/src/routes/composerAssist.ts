import type { FastifyInstance } from 'fastify';

import { ComposerAssistService } from '../core/ComposerAssistService.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
} from '../types/index.js';

const visibleMessageSchema = {
  type: 'object' as const,
  required: ['text'],
  properties: {
    id: { type: 'string' as const },
    sender: { type: 'string' as const },
    text: { type: 'string' as const },
    timestampLabel: { type: 'string' as const },
  },
  additionalProperties: false,
};

const audienceSchema = {
  type: 'object' as const,
  properties: {
    conversationTitle: { type: 'string' as const },
    conversationId: { type: 'string' as const },
    groupId: { type: 'string' as const },
    issueKey: { type: 'string' as const },
    issueSummary: { type: 'string' as const },
    people: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 24,
    },
    provider: { type: 'string' as const },
    relationshipHint: { type: 'string' as const },
  },
  additionalProperties: false,
};

const contextItemSchema = {
  type: 'object' as const,
  required: ['type'],
  properties: {
    type: {
      type: 'string' as const,
      enum: [
        'message',
        'thread_root',
        'thread_reply',
        'jira_summary',
        'jira_description',
        'jira_comment',
        'attachment',
        'image',
      ],
    },
    id: { type: 'string' as const },
    sender: { type: 'string' as const },
    title: { type: 'string' as const },
    text: { type: 'string' as const },
    timestampLabel: { type: 'string' as const },
    url: { type: 'string' as const },
    metadata: {
      type: 'object' as const,
      additionalProperties: true,
    },
  },
  additionalProperties: false,
};

const composerAssistBodySchema = {
  type: 'object' as const,
  required: ['surface', 'contextType'],
  properties: {
    surface: {
      type: 'string' as const,
      enum: [
        'ringcentral_message',
        'ringcentral_thread',
        'jira_issue',
        'chatgpt',
        'doubao',
        'claude',
        'gemini',
        'generic_agent',
      ],
    },
    contextType: {
      type: 'string' as const,
      enum: ['message_thread', 'jira_issue', 'web_agent_prompt'],
    },
    scenario: {
      type: 'string' as const,
      enum: [
        'instant_message_reply',
        'thread_reply',
        'jira_comment',
        'web_agent_prompt',
        'document_note',
      ],
    },
    title: { type: 'string' as const },
    url: { type: 'string' as const },
    draftText: { type: 'string' as const },
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
    identifiers: {
      type: 'object' as const,
      properties: {
        conversationId: { type: 'string' as const },
        groupId: { type: 'string' as const },
        threadRootPostId: { type: 'string' as const },
        issueKey: { type: 'string' as const },
        provider: { type: 'string' as const },
      },
      additionalProperties: false,
    },
    visibleMessages: {
      type: 'array' as const,
      items: visibleMessageSchema,
      maxItems: 12,
    },
    threadRoot: visibleMessageSchema,
    audience: audienceSchema,
    contextItems: {
      type: 'array' as const,
      items: contextItemSchema,
      maxItems: 32,
    },
    sourceTypes: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 20,
    },
    automationLevel: {
      type: 'string' as const,
      enum: ['L1', 'L2'],
    },
    debug: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

export async function composerAssistRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ComposerAssistRequest }>(
    '/composer/assist',
    {
      schema: {
        body: composerAssistBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new ComposerAssistService(db);
      try {
        const result: ComposerAssistResponse = await service.assist(request.body);
        return reply.send(result);
      } catch (err) {
        request.log.warn({ err }, 'composer-assist failed');
        const fallback: ComposerAssistResponse = {
          available: false,
          suggestionType: 'none',
          title: '记忆提词暂不可用',
          summary: 'Composer Guard 无法读取相关记忆。',
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
