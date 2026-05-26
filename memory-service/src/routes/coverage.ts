import type { FastifyInstance } from 'fastify';

import { MemoryCoverageService } from '../core/MemoryCoverageService.js';

export async function coverageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/coverage/map', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send(service.buildMap());
  });

  app.get('/coverage/messages-by-source', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send({
      items: service.getMessagesBySource(),
    });
  });

  app.get('/coverage/provider-jobs/recent', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send({
      items: service.getProviderJobsRecent(),
    });
  });

  app.get('/coverage/pressure', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send(service.getPressure());
  });

  app.get('/coverage/skills-sync', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send({
      items: service.getSkillSync(),
    });
  });
}
