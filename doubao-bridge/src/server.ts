import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { BridgeConfig } from './config.js';
import type {
  BindingType,
  MobileBriefingRequest,
  QueryInjectRequest,
  ReminderSyncRequest,
  StableMemorySyncRequest,
} from './types.js';
import { DoubaoBridgeService } from './bridgeService.js';

function readToken(request: Pick<FastifyRequest, 'headers'>): string | undefined {
  const value = request.headers['x-bridge-token'];
  return Array.isArray(value) ? value[0] : value;
}

function createAuthHook(service: DoubaoBridgeService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === '/health' || request.url === '/pair') return;

    const status = await service.getStatus();
    if (!status.pairToken) {
      await reply.code(401).send({ error: 'Bridge is not paired' });
      return;
    }

    const token = readToken(request);
    if (token !== status.pairToken) {
      await reply.code(401).send({ error: 'Missing or invalid bridge token' });
    }
  };
}

export async function createBridgeServer(config: BridgeConfig, service: DoubaoBridgeService) {
  const app = Fastify({ logger: true });

  app.addHook('onRequest', createAuthHook(service));

  app.get('/health', async () => service.getHealth());

  app.post<{
    Body: { token?: string };
  }>('/pair', async (request, reply) => {
    try {
      return await service.pair(request.body?.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pair failed';
      return reply.code(401).send({ error: message });
    }
  });

  app.get('/auth/status', async () => service.getStatus());

  app.post('/auth/open-login', async () => service.openLogin());

  app.get('/threads', async () => service.listThreads());

  app.post('/threads/create-memory-sync', async () => service.createMemorySyncThread());

  app.post<{
    Body: { title?: string };
  }>('/threads/auto-bind-mobile', async (request, reply) => {
    const binding = await service.bindMobileContextByTitle(request.body?.title || '手机版对话');
    if (!binding) {
      return reply.code(404).send({ error: 'Mobile-context thread not found' });
    }
    return binding;
  });

  app.post<{
    Body: { bindingType: BindingType; threadId?: string; threadUrl?: string; title?: string };
  }>('/threads/bind', async (request) =>
    service.bindThread(request.body.bindingType, {
      id: request.body.threadId,
      threadUrl: request.body.threadUrl,
      url: request.body.threadUrl,
      title: request.body.title,
    }),
  );

  app.post<{ Body: StableMemorySyncRequest }>('/sync/stable-memory', async (request) =>
    service.syncStableMemory(request.body),
  );

  app.post<{ Body: MobileBriefingRequest }>('/sync/mobile-briefing', async (request) =>
    service.syncMobileBriefing(request.body),
  );

  app.post<{ Body: QueryInjectRequest }>('/inject/query', async (request) => service.injectQuery(request.body));

  app.post<{ Body: ReminderSyncRequest }>('/reminders/sync', async (request) => service.syncReminders(request.body));

  return app;
}
