import type { FastifyInstance } from 'fastify';

import { ReflectionThreadService } from '../core/ReflectionThreadService.js';

export async function reflectionThreadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      status?: 'active' | 'paused' | 'closed' | 'all';
      limit?: string;
      offset?: string;
      search?: string;
    };
  }>('/reflection-threads', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const result = service.listThreads({
      status: request.query.status ?? 'active',
      limit: parseInt(request.query.limit ?? '20', 10) || 20,
      offset: parseInt(request.query.offset ?? '0', 10) || 0,
      search: request.query.search,
    });

    return reply.status(200).send(result);
  });

  app.get<{
    Params: { id: string };
  }>('/reflection-threads/:id', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const detail = service.getThreadDetail(request.params.id);
    if (!detail) {
      return reply.status(404).send({ error: 'Reflection thread not found' });
    }
    return reply.status(200).send(detail);
  });

  app.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/reflection-threads/:id/runs', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const detail = service.getThreadDetail(request.params.id);
    if (!detail) {
      return reply.status(404).send({ error: 'Reflection thread not found' });
    }
    const limit = parseInt(request.query.limit ?? '20', 10) || 20;
    const items = service.listRuns(request.params.id, limit);
    return reply.status(200).send({
      items,
      total: items.length,
      limit,
    });
  });

  app.post<{
    Params: { id: string };
    Body: { force?: boolean };
  }>('/reflection-threads/:id/revisit', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    try {
      const result = await service.runReflection(request.params.id, {
        runType: 'manual_revisit',
        triggerType: 'manual',
        force: request.body?.force ?? true,
      });
      return reply.status(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(400).send({ error: message });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/reflection-threads/:id/pause', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const thread = service.pauseThread(request.params.id, request.body?.reason);
    if (!thread) {
      return reply.status(404).send({ error: 'Reflection thread not found' });
    }
    return reply.status(200).send({ thread });
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/reflection-threads/:id/close', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const thread = service.closeThread(request.params.id, request.body?.reason);
    if (!thread) {
      return reply.status(404).send({ error: 'Reflection thread not found' });
    }
    return reply.status(200).send({ thread });
  });

  app.post<{
    Params: { id: string };
  }>('/reflection-threads/:id/resume', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const service = new ReflectionThreadService(db, userDataManager, request.userId);
    const thread = service.resumeThread(request.params.id);
    if (!thread) {
      return reply.status(404).send({ error: 'Reflection thread not found' });
    }
    return reply.status(200).send({ thread });
  });
}
