import type { FastifyInstance } from 'fastify';

import {
  SourceMemoryCaptureService,
  SourceMemoryCaptureValidationError,
  type SourceMemoryCandidateInput,
  type SourceMemoryCreateInput,
} from '../core/SourceMemoryCaptureService.js';
import {
  PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION,
  PassiveWebpageAnalysisService,
  type PassiveWebpageAnalysisInput,
} from '../core/PassiveWebpageAnalysisService.js';
import { getConfig } from '../config.js';
import { getAnalyticsStore } from '../analytics/AnalyticsStore.js';

const WEBPAGE_ANALYSIS_ROUTE = '/source-memory/webpage-analysis';

const interactionSignalsSchema = {
  type: 'object' as const,
  properties: {
    dwellMs: { type: 'number' as const, minimum: 0 },
    activeMs: { type: 'number' as const, minimum: 0 },
    scrollDepth: { type: 'number' as const, minimum: 0, maximum: 1 },
    selectedText: { type: 'boolean' as const },
    copiedText: { type: 'boolean' as const },
    repeatVisit: { type: 'boolean' as const },
    ownerAuthored: { type: 'boolean' as const },
    manualClick: { type: 'boolean' as const },
    openedFromMemory: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

const entityHintsSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    required: ['kind', 'value'],
    properties: {
      kind: { type: 'string' as const },
      value: { type: 'string' as const },
    },
    additionalProperties: false,
  },
};

const candidateBodySchema = {
  type: 'object' as const,
  properties: {
    sourceKind: {
      type: 'string' as const,
      enum: [
        'webpage',
        'visual_memory',
        'selection',
        'jira_comment',
        'message_reply',
        'web_ai_prompt',
        'ai_conversation',
        'document',
        'meeting_material',
        'manual',
      ],
    },
    sourceUrl: { type: 'string' as const },
    sourceTitle: { type: 'string' as const },
    text: { type: 'string' as const },
    selectedText: { type: 'string' as const },
    nearbyText: { type: 'string' as const },
    entityHints: entityHintsSchema,
    interactions: interactionSignalsSchema,
    scope: { type: 'string' as const, enum: ['work', 'personal'] },
    metadata: { type: 'object' as const, additionalProperties: true },
  },
  additionalProperties: false,
};

const webpageAnalysisBodySchema = {
  type: 'object' as const,
  required: ['title', 'url', 'mainContent'],
  properties: {
    title: { type: 'string' as const, maxLength: 500 },
    url: { type: 'string' as const, minLength: 1, maxLength: 2_048 },
    mainContent: {
      type: 'string' as const,
      minLength: 120,
      maxLength: 16_000,
    },
    domain: { type: 'string' as const, maxLength: 255 },
    wordCount: { type: 'number' as const, minimum: 0 },
  },
  additionalProperties: false,
};

const createBodySchema = {
  ...candidateBodySchema,
  properties: {
    ...candidateBodySchema.properties,
    captureMode: {
      type: 'string' as const,
      enum: ['auto', 'suggested', 'manual'],
    },
    captureReason: { type: 'string' as const },
    note: { type: 'string' as const },
    privacyLevel: {
      type: 'string' as const,
      enum: ['private', 'work', 'shareable_summary', 'needs_review'],
    },
    metadata: { type: 'object' as const, additionalProperties: true },
  },
};

const dismissBodySchema = {
  type: 'object' as const,
  properties: {
    reason: { type: 'string' as const },
  },
  additionalProperties: false,
};

const noteBodySchema = {
  type: 'object' as const,
  properties: {
    note: { type: 'string' as const },
  },
  additionalProperties: false,
};

function buildValidationErrorResponse(error: SourceMemoryCaptureValidationError): {
  error: string;
  noWriteReceipt?: SourceMemoryCaptureValidationError['noWriteReceipt'];
} {
  return {
    error: error.message,
    ...(error.noWriteReceipt ? { noWriteReceipt: error.noWriteReceipt } : {}),
  };
}

export async function sourceMemoryRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PassiveWebpageAnalysisInput }>(
    WEBPAGE_ANALYSIS_ROUTE,
    {
      schema: {
        body: webpageAnalysisBodySchema,
      },
    },
    async (request, reply) => {
      // Per-user daily quota guard against a runaway loop / test script
      // repeating this route (a single POC account once produced $85/month
      // on its own — see docs/features/usage_analytics.md, 成本治理与 2026-08 事故复盘).
      const dailyLimit = getConfig().webpageAnalysisDailyLimit;
      const store = getAnalyticsStore();
      if (dailyLimit > 0 && store && request.userId) {
        const usedToday = store.getTodayCallCountForRoute(
          request.userId,
          WEBPAGE_ANALYSIS_ROUTE,
        );
        if (usedToday >= dailyLimit) {
          return reply.status(429).send({
            error: 'webpage_analysis_daily_quota_exceeded',
            limit: dailyLimit,
            used: usedToday,
          });
        }
      }

      const service = new PassiveWebpageAnalysisService();
      const result = await service.analyze(request.body);
      return reply.status(200).send({
        result,
        promptVersion: PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION,
      });
    },
  );

  app.post<{ Body: SourceMemoryCandidateInput }>(
    '/source-memory/candidates/score',
    {
      schema: {
        body: candidateBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new SourceMemoryCaptureService(db);
      return reply.status(200).send(service.scoreCandidate(request.body));
    },
  );

  app.post<{ Body: SourceMemoryCandidateInput }>(
    '/source-memory/candidates/selection',
    {
      schema: {
        body: candidateBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new SourceMemoryCaptureService(db);
      return reply.status(200).send(
        service.scoreCandidate({
          ...request.body,
          sourceKind: request.body.sourceKind ?? 'selection',
          interactions: {
            ...(request.body.interactions ?? {}),
            selectedText: true,
          },
        }),
      );
    },
  );

  app.post<{ Body: SourceMemoryCreateInput }>(
    '/source-memory/capsules',
    {
      schema: {
        body: createBodySchema,
      },
    },
    async (request, reply) => {
      try {
        const { db, userDataManager } = request.userContext;
        const service = new SourceMemoryCaptureService(db, userDataManager);
        const capsule = service.createCapsule(request.body);
        return reply.status(200).send({ capsule });
      } catch (error) {
        if (error instanceof SourceMemoryCaptureValidationError) {
          return reply.status(error.statusCode).send(buildValidationErrorResponse(error));
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/source-memory/capsules/:id',
    async (request, reply) => {
      try {
        const { db } = request.userContext;
        const service = new SourceMemoryCaptureService(db);
        return reply.status(200).send({ capsule: service.getCapsule(request.params.id) });
      } catch (error) {
        if (error instanceof SourceMemoryCaptureValidationError) {
          return reply.status(error.statusCode).send(buildValidationErrorResponse(error));
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/source-memory/capsules/:id/note',
    {
      schema: {
        body: noteBodySchema,
      },
    },
    async (request, reply) => {
      try {
        const { db, userDataManager } = request.userContext;
        const service = new SourceMemoryCaptureService(db, userDataManager);
        return reply
          .status(200)
          .send({ capsule: service.updateCapsuleNote(request.params.id, request.body?.note) });
      } catch (error) {
        if (error instanceof SourceMemoryCaptureValidationError) {
          return reply.status(error.statusCode).send(buildValidationErrorResponse(error));
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/source-memory/capsules/:id/dismiss',
    {
      schema: {
        body: dismissBodySchema,
      },
    },
    async (request, reply) => {
      try {
        const { db } = request.userContext;
        const service = new SourceMemoryCaptureService(db);
        return reply
          .status(200)
          .send({ capsule: service.dismissCapsule(request.params.id, request.body?.reason) });
      } catch (error) {
        if (error instanceof SourceMemoryCaptureValidationError) {
          return reply.status(error.statusCode).send(buildValidationErrorResponse(error));
        }
        throw error;
      }
    },
  );
}
