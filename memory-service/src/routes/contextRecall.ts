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
import type Database from 'better-sqlite3';

import { ContextRecallService } from '../core/ContextRecallService.js';
import { KeystoneBriefService } from '../core/KeystoneBriefService.js';
import { buildWeaveStats } from '../core/weaveStats.js';
import { getUiLanguageFromHeaders, type UiLanguage } from '../i18n.js';
import type {
  ContextRecallMatch,
  ContextRecallRequest,
  ContextRecallResponse,
} from '../types/index.js';

const DEFAULT_CONTEXT_RECALL_ROUTE_TIMEOUT_MS = 6000;
const DEFAULT_MAX_CONCURRENT_CONTEXT_RECALL = 1;
const PASSIVE_ROUTE_GUARD_SURFACES = new Set([
  'web_passive',
  'meeting_passive',
  'popup_passive',
  'follow_thread',
]);

let activeContextRecallRequests = 0;

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
    currentContext: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' as const },
        url: { type: 'string' as const },
        conversationId: { type: 'string' as const },
        groupId: { type: 'string' as const },
        meetingId: { type: 'string' as const },
        issueKey: { type: 'string' as const },
        participants: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        visibleMessages: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            required: ['text'],
            properties: {
              id: { type: 'string' as const },
              sender: { type: 'string' as const },
              text: { type: 'string' as const },
              timestamp: { type: 'number' as const },
              timestampLabel: { type: 'string' as const },
            },
            additionalProperties: false,
          },
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
        },
        verifiedSourceFields: {
          type: 'array' as const,
          maxItems: 12,
          items: {
            type: 'object' as const,
            required: ['propertyKey', 'name', 'value', 'source', 'checkedAt'],
            properties: {
              propertyKey: { type: 'string' as const, maxLength: 120 },
              name: { type: 'string' as const, maxLength: 120 },
              value: { type: ['string', 'null'] as const, maxLength: 120 },
              source: { type: 'string' as const, enum: ['jira_rest'] },
              checkedAt: { type: 'number' as const },
            },
            additionalProperties: false,
          },
        },
        sourceAnchorHints: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
      },
      additionalProperties: false,
    },
    interactionScene: {
      type: 'object' as const,
      required: ['sceneType', 'surface', 'userMode'],
      properties: {
        sceneType: {
          type: 'string' as const,
          enum: [
            'jira_issue_reading',
            'jira_field_inspection',
            'jira_comment_composing',
            'ringcentral_thread_reading',
            'ringcentral_estimate_discussion',
            'ringcentral_reply_composing',
            'web_reading',
            'web_ai_prompt_composing',
            'selection_memory_search',
            'meeting_live',
            'unknown',
          ],
        },
        surface: {
          type: 'string' as const,
          enum: [
            'memory_lens',
            'compose_assist',
            'meeting_pilot',
            'today_pilot',
            'ask',
          ],
        },
        userMode: {
          type: 'string' as const,
          enum: [
            'read',
            'inspect_field',
            'focus_composer',
            'compose',
            'reply',
            'comment',
            'select_text',
            'submit_candidate',
            'unknown',
          ],
        },
        url: { type: 'string' as const },
        title: { type: 'string' as const },
        issueKey: { type: 'string' as const },
        conversationId: { type: 'string' as const },
        groupId: { type: 'string' as const },
        meetingId: { type: 'string' as const },
        participants: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        activeElement: {
          type: 'object' as const,
          required: ['kind', 'hasFocus'],
          properties: {
            kind: {
              type: 'string' as const,
              enum: [
                'none',
                'button',
                'input',
                'textarea',
                'contenteditable',
                'editor',
                'link',
                'other',
              ],
            },
            role: { type: 'string' as const },
            mode: {
              type: 'string' as const,
              enum: [
                'read',
                'inspect_field',
                'focus_composer',
                'compose',
                'reply',
                'comment',
                'select_text',
                'submit_candidate',
                'unknown',
              ],
            },
            label: { type: 'string' as const, maxLength: 240 },
            placeholder: { type: 'string' as const, maxLength: 240 },
            nearbyText: { type: 'string' as const, maxLength: 520 },
            containerRole: { type: 'string' as const, maxLength: 120 },
            containerLabel: { type: 'string' as const, maxLength: 520 },
            selectorFingerprint: { type: 'string' as const, maxLength: 240 },
            hasFocus: { type: 'boolean' as const },
          },
          additionalProperties: false,
        },
        visibleFacts: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            required: ['kind', 'value', 'source', 'confidence'],
            properties: {
              kind: {
                type: 'string' as const,
                enum: [
                  'jira_field',
                  'message',
                  'page_heading',
                  'status_badge',
                  'table_cell',
                  'other',
                ],
              },
              name: { type: 'string' as const, maxLength: 120 },
              value: { type: 'string' as const, maxLength: 240 },
              rawText: { type: 'string' as const, maxLength: 520 },
              source: { type: 'string' as const, enum: ['current_page'] },
              issueKey: { type: 'string' as const },
              confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
            },
            additionalProperties: false,
          },
        },
        draftText: { type: 'string' as const, maxLength: 1200 },
        selectedText: { type: 'string' as const, maxLength: 1200 },
        nearbyMessages: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            required: ['text'],
            properties: {
              id: { type: 'string' as const },
              sender: { type: 'string' as const },
              text: { type: 'string' as const },
              timestamp: { type: 'number' as const },
              timestampLabel: { type: 'string' as const },
            },
            additionalProperties: false,
          },
        },
        sourceAnchorHints: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        admission: {
          type: 'object' as const,
          required: ['state'],
          properties: {
            state: {
              type: 'string' as const,
              enum: ['blocked', 'passive_ready', 'composer_ready', 'unknown'],
            },
            reasons: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
            confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
          },
          additionalProperties: false,
        },
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

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function isTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    Boolean(process.env.VITEST_WORKER_ID)
  );
}

function shouldUsePassiveRouteFallback(
  requestBody: ContextRecallRequest | undefined,
): boolean {
  if (!requestBody || !PASSIVE_ROUTE_GUARD_SURFACES.has(requestBody.surface)) {
    return false;
  }
  if (parseOptionalBooleanEnv('CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED') === true) {
    return false;
  }
  const explicitGuard = parseOptionalBooleanEnv(
    'CONTEXT_RECALL_ROUTE_PASSIVE_FAST_FALLBACK_ENABLED',
  );
  if (explicitGuard !== undefined) {
    return explicitGuard;
  }
  return !isTestRuntime();
}

function buildContextRecallFallback(
  requestBody: ContextRecallRequest | undefined,
  startedAt: number,
  rejectedReason: string,
): ContextRecallResponse {
  return {
    matches: [],
    topMatch: null,
    queryTimeMs: Date.now() - startedAt,
    debug: requestBody?.debug
      ? {
          normalizedQuery: '',
          channelsHit: [],
          rejectedReason,
        }
      : undefined,
  };
}

function buildKeystoneOnlyFallback(
  request: ContextRecallRequest,
  startedAt: number,
  db: Database.Database,
  outputLanguage: UiLanguage,
): ContextRecallResponse {
  const fallback = buildContextRecallFallback(
    request,
    startedAt,
    'passive_fast_search_disabled',
  );
  const presentation = new KeystoneBriefService(db).matchContext(
    request,
    [],
    { requireRecallEvidence: false, outputLanguage },
  );
  if (!presentation || presentation.presentationMode === 'stale_notice') {
    return fallback;
  }
  const brief = presentation.brief;
  const english = outputLanguage === 'en-US';
  const match: ContextRecallMatch = {
    id: `keystone:${brief.id}`,
    type: 'reflection_thread',
    score: presentation.presentationMode === 'conflict' ? 0.94 : 0.97,
    title: brief.title,
    uiSummary: brief.summary,
    snippet: brief.summary,
    sourceLabel: english ? 'Keystone Brief' : '关键简报',
    links: [],
    whyMatched: presentation.whyNow,
    whyRelevant: [
      english
        ? `Keystone Brief: ${brief.sourceMap.length} sources`
        : `关键简报：${brief.sourceMap.length} 条来源`,
      presentation.whyNow,
    ],
    reasonType: 'prior_decision',
    evidenceRole: 'context',
    displayPriority: 'p1',
    timestamp: brief.sourceAsOf,
    metadata: { keystoneBriefFallback: true },
  };
  return {
    ...fallback,
    matches: [match],
    topMatch: match,
    keystoneBrief: presentation,
  };
}

function withContextRecallRouteTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('context_recall_route_timeout')),
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

export async function contextRecallRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ContextRecallRequest }>(
    '/context-recall',
    {
      schema: {
        body: contextRecallBodySchema,
      },
    },
    async (request, reply) => {
      const startedAt = Date.now();
      if (shouldUsePassiveRouteFallback(request.body)) {
        request.log.info(
          { surface: request.body.surface },
          'context-recall skipped by passive route guard',
        );
        return reply.send(
          buildKeystoneOnlyFallback(
            request.body,
            startedAt,
            request.userContext.db,
            getUiLanguageFromHeaders(request.headers),
          ),
        );
      }

      const maxConcurrent = getPositiveIntegerEnv(
        'CONTEXT_RECALL_MAX_CONCURRENT',
        DEFAULT_MAX_CONCURRENT_CONTEXT_RECALL,
      );
      if (activeContextRecallRequests >= maxConcurrent) {
        request.log.warn(
          { activeContextRecallRequests, maxConcurrent },
          'context-recall overloaded',
        );
        return reply
          .header('Retry-After', '2')
          .send(
            buildContextRecallFallback(
              request.body,
              Date.now(),
              'context_recall_busy',
            ),
          );
      }

      const { db } = request.userContext;
      const service = new ContextRecallService(db, request.userId);
      const timeoutMs = getPositiveIntegerEnv(
        'CONTEXT_RECALL_ROUTE_TIMEOUT_MS',
        DEFAULT_CONTEXT_RECALL_ROUTE_TIMEOUT_MS,
      );
      let routeReturned = false;
      activeContextRecallRequests += 1;
      const servicePromise = service.recall(request.body);
      servicePromise.catch((err) => {
        if (routeReturned) {
          request.log.warn({ err }, 'context-recall failed after route returned');
        }
      }).finally(() => {
        activeContextRecallRequests = Math.max(
          0,
          activeContextRecallRequests - 1,
        );
      });
      try {
        const result: ContextRecallResponse = await withContextRecallRouteTimeout(
          servicePromise,
          timeoutMs,
        );
        routeReturned = true;
        // Weave provenance (P0-5): surface a badge only when the Lens hit
        // stitched ≥2 sources or a ≥7-day span. Single source → no field.
        const weave = buildWeaveStats(
          (result.matches ?? []).map((m) => ({
            type: m.type,
            source: m.sourceLabel,
            timestamp: m.timestamp,
            id: m.id,
            metadata: m.metadata,
          })),
        );
        if (weave.crossSource) result.weave = weave;
        try {
          result.keystoneBrief = new KeystoneBriefService(db).matchContext(
            request.body,
            result.matches ?? [],
            { outputLanguage: getUiLanguageFromHeaders(request.headers) },
          );
        } catch (err) {
          request.log.warn(
            { err },
            'keystone brief matching failed; returning ordinary recall',
          );
        }
        return reply.send(result);
      } catch (err) {
        routeReturned = true;
        if (
          err instanceof Error &&
          err.message === 'context_recall_route_timeout'
        ) {
          request.log.warn({ timeoutMs }, 'context-recall timed out');
          return reply.send(
            buildContextRecallFallback(
              request.body,
              startedAt,
              'context_recall_timeout',
            ),
          );
        }

        request.log.warn({ err }, 'context-recall failed');
        return reply.send(
          buildContextRecallFallback(
            request.body,
            startedAt,
            'internal_error',
          ),
        );
      }
    },
  );
}
