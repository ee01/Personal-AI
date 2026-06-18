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
import { buildWeaveStats } from '../core/weaveStats.js';
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
      const service = new ContextRecallService(db, request.userId);
      try {
        const result: ContextRecallResponse = await service.recall(
          request.body,
        );
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
