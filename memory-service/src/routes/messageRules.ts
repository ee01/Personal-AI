import type { FastifyInstance } from 'fastify';

import { MessageRuleAutomationPlanner } from '../core/MessageRuleAutomationPlanner.js';
import { ActionRepository } from '../repositories/ActionRepository.js';

const messageRulePlanBodySchema = {
  type: 'object' as const,
  required: ['ruleRef', 'automationPrompt', 'message'],
  properties: {
    ruleRef: { type: 'string' as const, minLength: 1 },
    ruleText: { type: 'string' as const },
    automationPrompt: { type: 'string' as const, minLength: 1 },
    requiresApproval: { type: 'boolean' as const },
    message: {
      type: 'object' as const,
      required: ['content'],
      properties: {
        postId: { type: 'string' as const },
        sender: { type: 'string' as const },
        groupId: { type: 'string' as const },
        groupName: { type: 'string' as const },
        content: { type: 'string' as const, minLength: 1 },
        timestamp: { type: 'number' as const },
        timezone: { type: 'string' as const },
        event: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            start: { type: 'string' as const },
            end: { type: 'string' as const },
            startAtMs: { type: 'number' as const },
            endAtMs: { type: 'number' as const },
            timeRange: { type: 'string' as const },
            location: { type: 'string' as const },
            allDay: { type: 'boolean' as const },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    match: {
      type: 'object' as const,
      properties: {
        matchedRule: { type: 'string' as const },
        summary: { type: 'string' as const },
        confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export async function messageRuleRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      ruleRef: string;
      ruleText?: string;
      automationPrompt: string;
      requiresApproval?: boolean;
      message: {
        postId?: string;
        sender?: string;
        groupId?: string;
        groupName?: string;
        content: string;
        timestamp?: number;
        timezone?: string;
        event?: {
          title?: string;
          start?: string;
          end?: string;
          startAtMs?: number;
          endAtMs?: number;
          timeRange?: string;
          location?: string;
          allDay?: boolean;
        };
      };
      match?: {
        matchedRule?: string;
        summary?: string;
        confidence?: number;
      };
    };
  }>(
    '/message-rules/preview',
    {
      schema: {
        body: messageRulePlanBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const planner = new MessageRuleAutomationPlanner(
        new ActionRepository(db),
      );
      const result = planner.preview(request.body);
      return reply.status(200).send(result);
    },
  );

  app.post<{
    Body: {
      ruleRef: string;
      ruleText?: string;
      automationPrompt: string;
      requiresApproval?: boolean;
      message: {
        postId?: string;
        sender?: string;
        groupId?: string;
        groupName?: string;
        content: string;
        timestamp?: number;
        timezone?: string;
        event?: {
          title?: string;
          start?: string;
          end?: string;
          startAtMs?: number;
          endAtMs?: number;
          timeRange?: string;
          location?: string;
          allDay?: boolean;
        };
      };
      match?: {
        matchedRule?: string;
        summary?: string;
        confidence?: number;
      };
    };
  }>(
    '/message-rules/plan',
    {
      schema: {
        body: messageRulePlanBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const planner = new MessageRuleAutomationPlanner(new ActionRepository(db));
      const result = planner.planAndQueue(request.body);
      return reply.status(200).send(result);
    },
  );
}
