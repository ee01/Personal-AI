import type { FastifyInstance } from 'fastify';

import { getEventBus } from './events.js';
import { ProviderContextService } from '../core/ProviderContextService.js';
import type { ProviderSyncJobRecord } from '../repositories/ProviderRepository.js';

interface UpsertBindingBody {
  externalThreadId: string;
  title?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  lastError?: string | null;
}

interface RenderContextPackageBody {
  provider: string;
  scenario: string;
  query?: string;
  tokenBudget?: number;
  freshnessWindowDays?: number;
  includeKinds?: string[];
  deviceContext?: string;
  bindingType?: string;
  deliveryMode?: string;
  createSyncJob?: boolean;
}

interface ReportSyncJobBody {
  status: ProviderSyncJobRecord['status'];
  result?: Record<string, any>;
  errorMessage?: string;
  response?: Record<string, any>;
  providerMessageId?: string;
  externalThreadId?: string;
  completedAt?: number;
  startedAt?: number;
}

const upsertBindingBodySchema = {
  type: 'object' as const,
  required: ['externalThreadId'],
  properties: {
    externalThreadId: { type: 'string' as const, minLength: 1 },
    title: { type: 'string' as const },
    deviceId: { type: 'string' as const },
    metadata: { type: 'object' as const },
    isActive: { type: 'boolean' as const },
    lastError: { type: 'string' as const },
  },
  additionalProperties: false,
};

const renderContextPackageBodySchema = {
  type: 'object' as const,
  required: ['provider', 'scenario'],
  properties: {
    provider: { type: 'string' as const, minLength: 1 },
    scenario: { type: 'string' as const, minLength: 1 },
    query: { type: 'string' as const },
    tokenBudget: { type: 'number' as const, minimum: 1 },
    freshnessWindowDays: { type: 'number' as const, minimum: 1 },
    includeKinds: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    deviceContext: { type: 'string' as const },
    bindingType: { type: 'string' as const },
    deliveryMode: {
      type: 'string' as const,
      enum: ['incremental', 'daily_digest'],
    },
    createSyncJob: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

const reportSyncJobBodySchema = {
  type: 'object' as const,
  required: ['status'],
  properties: {
    status: {
      type: 'string' as const,
      enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'skipped'],
    },
    result: { type: 'object' as const },
    errorMessage: { type: 'string' as const },
    response: { type: 'object' as const },
    providerMessageId: { type: 'string' as const },
    externalThreadId: { type: 'string' as const },
    completedAt: { type: 'number' as const },
    startedAt: { type: 'number' as const },
  },
  additionalProperties: false,
};

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { provider: string };
  }>('/providers/:provider/capabilities', async (request, reply) => {
    const { provider } = request.params;
    const service = new ProviderContextService(request.userContext.db);
    return reply.status(200).send(service.getCapabilities(provider));
  });

  app.get<{
    Params: { provider: string };
    Querystring: { bindingType?: string };
  }>('/providers/:provider/bindings', async (request, reply) => {
    const { provider } = request.params;
    const service = new ProviderContextService(request.userContext.db);
    const bindings = service.listBindings(provider);
    const filtered = request.query.bindingType
      ? bindings.filter((binding) => binding.bindingType === request.query.bindingType)
      : bindings;
    return reply.status(200).send({ items: filtered, total: filtered.length });
  });

  app.put<{
    Params: { provider: string; bindingType: string };
    Body: UpsertBindingBody;
  }>(
    '/providers/:provider/bindings/:bindingType',
    { schema: { body: upsertBindingBodySchema } },
    async (request, reply) => {
      const { provider, bindingType } = request.params;
      const service = new ProviderContextService(request.userContext.db);
      const binding = service.upsertBinding(provider, bindingType, request.body);
      getEventBus().emit('provider_binding_updated', {
        provider,
        bindingType,
        binding,
        userId: request.userId,
      });
      return reply.status(200).send({ binding });
    },
  );

  app.post<{
    Body: RenderContextPackageBody;
  }>(
    '/providers/context-packages/render',
    { schema: { body: renderContextPackageBodySchema } },
    async (request, reply) => {
      const service = new ProviderContextService(request.userContext.db);
      const response = await service.renderContextPackage({
        provider: request.body.provider,
        scenario: request.body.scenario,
        query: request.body.query,
        tokenBudget: request.body.tokenBudget,
        freshnessWindowDays: request.body.freshnessWindowDays,
        includeKinds: request.body.includeKinds as any,
        deviceContext: request.body.deviceContext,
        bindingType: request.body.bindingType,
        deliveryMode: request.body.deliveryMode as any,
        createSyncJob: request.body.createSyncJob,
      });

      getEventBus().emit('provider_context_package_rendered', {
        provider: request.body.provider,
        scenario: request.body.scenario,
        syncJobId: response.syncJob?.id,
        userId: request.userId,
      });

      return reply.status(200).send(response);
    },
  );

  app.get<{
    Params: { provider: string };
    Querystring: { status?: string; bindingType?: string; limit?: string; offset?: string };
  }>('/providers/:provider/sync-jobs', async (request, reply) => {
    const service = new ProviderContextService(request.userContext.db);
    const { items, total } = service.listSyncJobs(request.params.provider, {
      status: request.query.status,
      bindingType: request.query.bindingType,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      offset: request.query.offset ? Number(request.query.offset) : undefined,
    });
    return reply.status(200).send({ items, total });
  });

  app.get<{
    Params: { provider: string; id: string };
  }>('/providers/:provider/sync-jobs/:id', async (request, reply) => {
    const service = new ProviderContextService(request.userContext.db);
    const job = service.getSyncJob(request.params.provider, request.params.id);
    if (!job) {
      return reply.status(404).send({ error: 'Sync job not found' });
    }
    return reply.status(200).send({ job });
  });

  app.post<{
    Params: { provider: string; id: string };
    Body: ReportSyncJobBody;
  }>(
    '/providers/:provider/sync-jobs/:id/report',
    { schema: { body: reportSyncJobBodySchema } },
    async (request, reply) => {
      const service = new ProviderContextService(request.userContext.db);
      try {
        const job = service.reportSyncJob(request.params.provider, request.params.id, request.body);
        getEventBus().emit('provider_sync_job_updated', {
          provider: request.params.provider,
          jobId: request.params.id,
          status: request.body.status,
          userId: request.userId,
        });
        return reply.status(200).send({ job });
      } catch (error) {
        return reply.status(404).send({
          error: (error as Error).message,
        });
      }
    },
  );
}
