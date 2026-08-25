import type { FastifyInstance } from 'fastify';

import { ActionReadinessService } from '../core/ActionReadinessService.js';
import {
  findEnabledExecutor,
  resolveEnabledAgentExecutors,
} from '../integrations/executors/executorRegistry.js';
import {
  probeExecutor,
  type ExecutorProbeResult,
} from '../integrations/executors/executorProbe.js';
import { AgentWorkerService } from '../integrations/workers/AgentWorkerService.js';
import { PROBE_CACHE_TTL_MS } from '../integrations/workers/workerProtocol.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';

const probeCache = new Map<string, ExecutorProbeResult>();

function cacheKey(userId: string, executorId: string, deep: boolean): string {
  return `${userId}:${executorId}:${deep ? 'deep' : 'light'}`;
}

export async function agentExecutorRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: { deep?: boolean; force?: boolean };
  }>('/agent-executors/:id/probe', async (request, reply) => {
    const executorId = String(request.params.id || '').trim();
    if (!executorId) {
      return reply.code(400).send({ error: 'executor id required' });
    }
    const deep = request.body?.deep === true;
    const force = request.body?.force === true;
    const userId = request.userId || 'default';
    const key = cacheKey(userId, executorId, deep);
    const cached = probeCache.get(key);
    if (
      !force &&
      cached &&
      Date.now() - cached.checkedAt < PROBE_CACHE_TTL_MS
    ) {
      return { ...cached, cached: true };
    }

    const { db, userDataManager } = request.userContext;
    const config = getUserRuntimeConfig(userDataManager);
    const instance =
      findEnabledExecutor(config, executorId) ||
      resolveEnabledAgentExecutors(config).find((item) => item.id === executorId);
    if (!instance) {
      return reply.code(404).send({
        ok: false,
        stage: 'connect',
        detail: `执行器 ${executorId} 不存在。请先保存后再测。`,
        nextAction: '在 Options 保存执行器列表。',
      });
    }

    const workers = new AgentWorkerService(db, userDataManager, userId);
    const result = await probeExecutor(
      instance,
      { deep },
      {
        lookupWorkerHeartbeat: (workerId) =>
          Promise.resolve(workers.lookupHeartbeat(workerId)),
        enqueueEcho: (workerId) => Promise.resolve(workers.enqueueEcho(workerId)),
        waitEcho: (commandId, timeoutMs) => workers.waitEcho(commandId, timeoutMs),
      },
    );
    probeCache.set(key, result);
    try {
      new ActionReadinessService(db, userDataManager, userId).recordExecutorProbe(
        instance.id,
        { ...result },
        { executorType: instance.type },
      );
    } catch {
      /* probe must still return even if readiness write fails */
    }
    return result;
  });
}
