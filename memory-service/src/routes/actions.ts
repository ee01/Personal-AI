import type { FastifyInstance } from 'fastify';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ActionRepository } from '../repositories/ActionRepository.js';

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      queueStatus?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter' | 'all';
      executionMode?: 'manual' | 'auto';
      threadId?: string;
      actionType?: string;
      limit?: string;
      offset?: string;
    };
  }>('/actions', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);
    const result = repo.list({
      queueStatus: request.query.queueStatus ?? 'all',
      executionMode: request.query.executionMode,
      threadId: request.query.threadId,
      actionType: request.query.actionType,
      limit: parseInt(request.query.limit ?? '20', 10) || 20,
      offset: parseInt(request.query.offset ?? '0', 10) || 0,
    });
    return reply.status(200).send(result);
  });

  app.post<{
    Params: { id: string };
  }>('/actions/:id/retry', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.retry(request.params.id);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    return reply.status(200).send({ action });
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/actions/:id/cancel', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.cancel(request.params.id, request.body?.reason);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    return reply.status(200).send({ action });
  });

  app.post<{
    Params: { id: string };
  }>('/actions/:id/execute', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.getById(request.params.id);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }

    const executor = new ActionExecutor(db, request.userId);
    const result = await executor.executeAction(request.params.id);
    return reply.status(200).send(result);
  });
}
