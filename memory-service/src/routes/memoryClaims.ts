import type { FastifyInstance } from 'fastify';

import {
  MemoryClaimCorrectionService,
  MemoryClaimCorrectionValidationError,
  MemoryClaimNotFoundError,
  MemoryClaimRevisionConflictError,
} from '../core/MemoryClaimCorrectionService.js';
import type { MemoryClaimCorrectionRequest } from '../types/index.js';

interface CorrectionParams {
  claimId: string;
}

const correctionBodySchema = {
  type: 'object' as const,
  required: ['correction', 'expectedRevision', 'source'],
  properties: {
    correction: {
      type: 'string' as const,
      enum: [
        'not_my_view',
        'my_decision',
        'reported_speech',
        'hypothesis',
        'undo_last',
      ],
    },
    expectedRevision: { type: 'integer' as const, minimum: 1 },
    source: {
      type: 'string' as const,
      enum: [
        'ask_receipt',
        'memory_lens',
        'user_profile',
        'meeting_pilot',
        'api',
      ],
    },
    idempotencyKey: {
      type: 'string' as const,
      minLength: 8,
      maxLength: 160,
    },
  },
  additionalProperties: false,
};

export async function memoryClaimRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: CorrectionParams;
    Body: MemoryClaimCorrectionRequest;
  }>(
    '/memory-claims/:claimId/corrections',
    { schema: { body: correctionBodySchema } },
    async (request, reply) => {
      try {
        const service = new MemoryClaimCorrectionService(
          request.userContext.db,
        );
        return service.correct(request.params.claimId, request.body);
      } catch (error) {
        if (error instanceof MemoryClaimNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof MemoryClaimRevisionConflictError) {
          return reply.status(409).send({
            error: error.message,
            expectedRevision: error.expectedRevision,
            currentRevision: error.currentRevision,
          });
        }
        if (error instanceof MemoryClaimCorrectionValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
