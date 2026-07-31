import type { FastifyInstance } from 'fastify';

import { StorylineDraftService } from '../core/StorylineDraftService.js';
import type { StorylineDraftRequest } from '../types/index.js';

const storylineDraftBodySchema = {
  type: 'object' as const,
  required: ['sourceKind'],
  properties: {
    sourceKind: {
      type: 'string' as const,
      enum: ['today_meeting_prep', 'source_memory_seed'],
    },
    prepId: {
      type: 'string' as const,
      minLength: 1,
    },
    capsuleId: {
      type: 'string' as const,
      minLength: 1,
    },
    seedId: {
      type: 'string' as const,
      minLength: 1,
    },
    targetArtifact: {
      type: 'string' as const,
      enum: ['speaker_notes', 'slides_outline', 'ringcentral_post', 'docs_brief'],
    },
    audienceHint: {
      type: 'string' as const,
      maxLength: 160,
    },
  },
  oneOf: [
    {
      properties: { sourceKind: { const: 'today_meeting_prep' } },
      required: ['prepId'],
    },
    {
      properties: { sourceKind: { const: 'source_memory_seed' } },
      required: ['capsuleId', 'seedId'],
    },
  ],
  additionalProperties: false,
};

export async function storylineRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: StorylineDraftRequest }>(
    '/storylines/draft',
    {
      schema: {
        body: storylineDraftBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const service = new StorylineDraftService(db, request.userId);
      try {
        const result = await service.createDraft(request.body);
        return reply.status(200).send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        if (message.includes('unsupported_storyline_source')) {
          return reply.status(400).send({ error: message });
        }
        if (message.includes('storyline_source_has_no_usable_evidence')) {
          return reply.status(422).send({
            error: 'storyline_source_has_no_usable_evidence',
            detail:
              'Storyline draft requires at least one usable evidence ref from the selected source.',
          });
        }
        request.log.warn({ err: error }, 'storyline draft generation failed');
        return reply.status(502).send({
          error: 'storyline_draft_generation_failed',
          detail: message,
        });
      }
    },
  );
}
