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
