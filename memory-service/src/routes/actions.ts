import type { FastifyInstance } from 'fastify';

import {
  ActionExecutor,
  buildOpenClawStaleRunningError,
  getOpenClawStaleRunningAfterSeconds,
} from '../core/actions/ActionExecutor.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { ActionReadinessService } from '../core/ActionReadinessService.js';
import {
  AGENT_ACTION_TYPES,
  isAgentDelegateActionType,
} from '../integrations/executors/executorRegistry.js';
import {
  ActionRepository,
  normalizeTaskKind,
  normalizeTaskLane,
} from '../repositories/ActionRepository.js';

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      actionId?: string;
      queueStatus?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead_letter' | 'all';
      executionMode?: 'manual' | 'auto';
      threadId?: string;
      actionType?: string;
      sourceKind?: string;
      sourceRefId?: string;
      lane?: string;
      taskKind?: string;
      parentActionId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/actions', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const staleAfterSeconds =
      getOpenClawStaleRunningAfterSeconds(userDataManager);
    for (const actionType of AGENT_ACTION_TYPES) {
      repo.recoverStaleRunningActions({
        actionType,
        staleAfterSeconds,
        errorMessage: buildOpenClawStaleRunningError(staleAfterSeconds),
        excludeWithRemoteRunId: true,
      });
    }
    const result = repo.list({
      actionId: request.query.actionId,
      queueStatus: request.query.queueStatus ?? 'all',
      executionMode: request.query.executionMode,
      threadId: request.query.threadId,
      actionType: request.query.actionType,
      sourceKind: request.query.sourceKind,
      sourceRefId: request.query.sourceRefId,
      lane: normalizeTaskLane(request.query.lane),
      taskKind: normalizeTaskKind(request.query.taskKind),
      parentActionId: request.query.parentActionId,
      limit: parseInt(request.query.limit ?? '20', 10) || 20,
      offset: parseInt(request.query.offset ?? '0', 10) || 0,
    });
    const readiness = new ActionReadinessService(
      db,
      userDataManager,
      request.userId,
    ).enrichActionList(result);
    return reply.status(200).send({
      ...result,
      items: readiness.items,
      readinessSummary: readiness.readinessSummary,
    });
  });

  app.post<{
    Params: { id: string };
  }>('/actions/:id/retry', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const existing = repo.getById(request.params.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    if (isAgentDelegateActionType(existing.actionType)) {
      const readiness = new ActionReadinessService(
        db,
        userDataManager,
        request.userId,
      ).checkAction(existing);
      if (
        readiness.decision === 'block' ||
        readiness.decision === 'probe_first'
      ) {
        return reply.status(409).send({
          code:
            readiness.decision === 'block'
              ? 'readiness_blocked'
              : 'readiness_probe_required',
          error:
            readiness.receipt.reason ??
            'Readiness must be repaired and rechecked before retry',
          readinessReceipt: readiness.receipt,
        });
      }
    }
    const action = repo.retry(request.params.id)!;
    if (action.threadId) {
      const threadService = new ReflectionThreadService(db, userDataManager, request.userId);
      threadService.refreshThreadDocument(action.threadId);
    }
    return reply.status(200).send({ action });
  });

  app.post<{
    Params: { id: string };
  }>('/actions/:id/readiness/probe', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.getById(request.params.id);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    if (!isAgentDelegateActionType(action.actionType)) {
      return reply.status(400).send({
        code: 'readiness_not_supported',
        error: 'Readiness probe is only supported for agent delegate actions',
      });
    }

    const service = new ActionReadinessService(
      db,
      userDataManager,
      request.userId,
    );
    const result = await service.probeAction(action);
    return reply.status(200).send(result);
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/actions/:id/cancel', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.cancel(request.params.id, request.body?.reason);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    if (action.threadId) {
      const threadService = new ReflectionThreadService(db, userDataManager, request.userId);
      threadService.refreshThreadDocument(action.threadId);
    }
    return reply.status(200).send({ action });
  });

  app.post<{
    Params: { id: string };
    Body?: { approve?: boolean };
  }>('/actions/:id/execute', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const action = repo.getById(request.params.id);
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }
    if (
      action.requiresApproval &&
      !action.approvedAt &&
      action.executionMode !== 'auto' &&
      request.body?.approve !== true
    ) {
      return reply.status(409).send({
        code: 'approval_required',
        error: 'Action requires human approval before execution',
        action,
      });
    }

    const executor = new ActionExecutor(db, userDataManager, request.userId);
    const result = await executor.executeAction(request.params.id, {
      approve: request.body?.approve === true,
    });
    return reply.status(200).send(result);
  });
}
