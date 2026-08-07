import type { FastifyInstance } from 'fastify';

import { ComposerAssistService } from '../core/ComposerAssistService.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
} from '../types/index.js';

const DEFAULT_MAX_CONCURRENT_COMPOSER_ASSIST = 1;
const DEFAULT_COMPOSER_ASSIST_ROUTE_TIMEOUT_MS = 8000;

let activeComposerAssistRequests = 0;

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
        'codex_cli',
        'claude_code_cli',
        'cursor_agent_cli',
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
        'compose_to_ai',
        'agent_compose',
        'document_note',
      ],
    },
    assistIntent: {
      type: 'string' as const,
      enum: ['draft_compose', 'draft_refine'],
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
    visibleFields: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' as const, maxLength: 120 },
          value: { type: 'string' as const, maxLength: 120 },
          rawText: { type: 'string' as const, maxLength: 240 },
        },
        additionalProperties: false,
      },
      maxItems: 16,
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
    interactionScene: {
      type: 'object' as const,
      additionalProperties: true,
    },
    debug: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildUnavailableComposerAssistResponse({
  title,
  summary,
  rejectedReason,
  debug,
  queryTimeMs = 0,
  activeRequests,
  maxConcurrent,
}: {
  title: string;
  summary: string;
  rejectedReason: string;
  debug?: boolean;
  queryTimeMs?: number;
  activeRequests?: number;
  maxConcurrent?: number;
}): ComposerAssistResponse {
  return {
    available: false,
    suggestionType: 'none',
    title,
    summary,
    evidence: [],
    riskLevel: 'low',
    previewRequired: false,
    confidence: 0,
    queryTimeMs,
    debug: debug
      ? {
          rejectedReason,
          activeRequests,
          maxConcurrent,
        }
      : undefined,
  };
}

function withComposerAssistRouteTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('composer_assist_route_timeout')),
      timeoutMs,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function composerAssistRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: ComposerAssistRequest }>(
    '/composer/assist',
    {
      schema: {
        body: composerAssistBodySchema,
      },
    },
    async (request, reply) => {
      const maxConcurrent = getPositiveIntegerEnv(
        'COMPOSER_ASSIST_MAX_CONCURRENT',
        DEFAULT_MAX_CONCURRENT_COMPOSER_ASSIST,
      );
      if (activeComposerAssistRequests >= maxConcurrent) {
        request.log.warn(
          { activeComposerAssistRequests, maxConcurrent },
          'composer-assist overloaded',
        );
        return reply
          .header('Retry-After', '2')
          .send(
            buildUnavailableComposerAssistResponse({
              title: '回复助手繁忙',
              summary: '回复助手正在处理上一条请求，请稍后重试。',
              rejectedReason: 'composer_assist_busy',
              debug: request.body?.debug,
              activeRequests: activeComposerAssistRequests,
              maxConcurrent,
            }),
          );
      }

      const { db } = request.userContext;
      const service = new ComposerAssistService(db, request.userId);
      const timeoutMs = getPositiveIntegerEnv(
        'COMPOSER_ASSIST_ROUTE_TIMEOUT_MS',
        DEFAULT_COMPOSER_ASSIST_ROUTE_TIMEOUT_MS,
      );
      const startedAt = Date.now();
      activeComposerAssistRequests += 1;
      let routeReturned = false;
      const servicePromise = service.assist(request.body);
      servicePromise
        .catch((err) => {
          if (routeReturned) {
            request.log.warn(
              { err },
              'composer-assist failed after route returned',
            );
          }
        })
        .finally(() => {
          activeComposerAssistRequests = Math.max(
            0,
            activeComposerAssistRequests - 1,
          );
        });

      try {
        const result: ComposerAssistResponse =
          await withComposerAssistRouteTimeout(servicePromise, timeoutMs);
        routeReturned = true;
        return reply.send(result);
      } catch (err) {
        routeReturned = true;
        if (
          err instanceof Error &&
          err.message === 'composer_assist_route_timeout'
        ) {
          request.log.warn(
            { timeoutMs, activeComposerAssistRequests },
            'composer-assist timed out',
          );
          return reply.send(
            buildUnavailableComposerAssistResponse({
              title: '回复助手暂未完成',
              summary: '回复助手本次生成超时，请稍后重试。',
              rejectedReason: 'composer_assist_timeout',
              debug: request.body?.debug,
              queryTimeMs: Date.now() - startedAt,
              activeRequests: activeComposerAssistRequests,
              maxConcurrent,
            }),
          );
        }

        request.log.warn({ err }, 'composer-assist failed');
        return reply.send(
          buildUnavailableComposerAssistResponse({
            title: '记忆提词暂不可用',
            summary: 'Composer Guard 无法读取相关记忆。',
            rejectedReason: 'internal_error',
            debug: request.body?.debug,
            queryTimeMs: Date.now() - startedAt,
          }),
        );
      }
    },
  );
}
