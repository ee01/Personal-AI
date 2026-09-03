import type { FastifyInstance } from 'fastify';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ActionReadinessService } from '../core/ActionReadinessService.js';
import {
  buildAgentTaskResultAnnouncementBody,
  buildDefaultNotificationBody,
  deliverAgentTaskAsMeNotice,
  formatSuccessNotificationWithTemplate,
  getExecutionSummary,
  getResultStatus,
  normalizeAgentTaskNotifyTarget,
  normalizeAgentTaskNotifyVia,
  normalizeAsMeSenderCredentials,
  planAgentTaskNotifications,
  resolveAgentTaskDeliveryVia,
  resolveAgentTaskNotificationTarget,
  resolveExplicitAgentTaskResultTarget,
  shouldNotifyEmptyResult,
  type AgentTaskNotifyTarget,
  type AgentTaskNotifyVia,
  type ResolvedAgentTaskNotificationTarget,
} from '../core/agentTaskNotification.js';
import {
  findEnabledExecutor,
  isAgentDelegateActionType,
  publicExecutorOptions,
  resolveAgentTaskExecutorId,
  resolveExecutorDefaults,
} from '../integrations/executors/executorRegistry.js';
import { ActionRepository, type QueuedActionRecord } from '../repositories/ActionRepository.js';
import { ChannelDeliveryRepository } from '../repositories/ChannelDeliveryRepository.js';
import { AgentTaskNotifyConfigRepository } from '../repositories/AgentTaskNotifyConfigRepository.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';

export {
  buildAgentTaskResultAnnouncementBody,
  deliverAgentTaskAsMeNotice,
  formatSuccessNotificationWithTemplate,
  normalizeAgentTaskNotifyTarget,
  normalizeAgentTaskNotifyVia,
  normalizeAsMeSenderCredentials,
  planAgentTaskNotifications,
  resolveAgentTaskDeliveryVia,
  resolveAgentTaskNotificationTarget,
  resolveExplicitAgentTaskResultTarget,
};
export type {
  AgentTaskNotifyTarget,
  AgentTaskNotifyVia,
  ResolvedAgentTaskNotificationTarget,
};

const AGENT_TASK_OPENCLAW_TIMEOUT_MS = 10 * 60 * 1000;

interface AgentTaskExecuteBody {
  taskId?: string;
  sheetMessageId?: string;
  rowIndex?: number;
  title?: string;
  task?: string;
  executor?: string;
  targetSystem?: string;
  taskKind?: string;
  /** External effect boundary. Omitted means read-only for backward compatibility. */
  mode?: 'read' | 'write';
  executionHints?: Record<string, unknown>;
  notifyTemplate?: string;
  triggerSource?: string;
  arBindingId?: string;
  idempotencyKey?: string;
  userId?: string;
  timeoutMs?: number;
  notify?: boolean;
  /** Controls success receipt only; failure receipt is always on when notify !== false. Default true. */
  successReceipt?: boolean;
  /** Result notification identity. Receipts always use Bot. */
  notifyVia?: 'bot' | 'asme';
  /** Push the result notice even when the run matched nothing. Default: stay quiet. */
  notifyWhenEmpty?: boolean;
  /** Sheet AsMe RingCentral sender credentials. Used only for notifyVia=asme; not persisted. */
  asmeSender?: {
    clientId?: string;
    clientSecret?: string;
    jwt?: string;
    serverUrl?: string;
  };
  source?: Record<string, unknown>;
  scheduleSpec?: Record<string, unknown>;
  notifyTarget?: AgentTaskNotifyTarget;
}

function resolveAgentTaskMode(value: unknown): 'read' | 'write' | undefined {
  if (value === undefined || value === null || value === '') return 'read';
  if (value === 'read' || value === 'write') return value;
  return undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeAgentTaskTimeoutMs(value: unknown): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return AGENT_TASK_OPENCLAW_TIMEOUT_MS;
  }
  return Math.max(AGENT_TASK_OPENCLAW_TIMEOUT_MS, Math.floor(candidate));
}

export interface AgentTaskEvidencePreview {
  kind?: string;
  title?: string;
  content?: string;
}

export interface AgentTaskRuntimeStatusItem {
  sourceRefId: string;
  sheetMessageId?: string;
  taskId?: string;
  latestAction?: {
    id: string;
    title: string;
    queueStatus: string;
    resultStatus?: string;
    startedAt?: number;
    finishedAt?: number;
    createdAt?: number;
    lastError?: string;
  } | null;
  /** Prefer OpenClaw result.summary; fall back to lastError when failed. */
  summary?: string;
  /** First artifact for evidence hover; does not replace summary as primary result. */
  evidence?: AgentTaskEvidencePreview;
  /** Queued action blocked by ActionReadiness (OpenClaw config/auth); not a terminal queue_status. */
  readinessBlocked?: boolean;
  /**
   * Status of the templated result notification sent to the configured notify
   * target (group/private), independent of the run's own success/failure.
   * Undefined when no such delivery was attempted (e.g. no notify target
   * configured, or the run failed and only a failure receipt went out).
   */
  resultNotifyDelivery?: { delivered: boolean; error?: string };
}

function enrichRuntimeStatusWithReadiness(
  item: AgentTaskRuntimeStatusItem,
  action: QueuedActionRecord,
  readinessService: ActionReadinessService,
): AgentTaskRuntimeStatusItem {
  if (
    action.queueStatus !== 'queued' ||
    !isAgentDelegateActionType(action.actionType)
  ) {
    return item;
  }
  const check = readinessService.checkAction(action);
  if (check.decision !== 'block') return item;
  const scopeKey = check.receipt.scopeKey;
  const base =
    check.receipt.reason?.trim() ||
    'Agent 执行被就绪检查拦截（请检查 Options → Agent 执行器 / OpenClaw 网关配置）';
  // Make it obvious this is a shared readiness contract, not this task's own run log.
  const reason = `就绪检查拦截（scope=${scopeKey}，可能来自同 scope 其它 AgentTask）: ${base}`;
  return {
    ...item,
    summary: reason,
    readinessBlocked: true,
    latestAction: item.latestAction
      ? {
          ...item.latestAction,
          lastError: reason,
        }
      : item.latestAction,
  };
}

function firstArtifactPreview(
  result?: Record<string, unknown>,
): AgentTaskEvidencePreview | undefined {
  const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
  for (const raw of artifacts) {
    if (!raw || typeof raw !== 'object') continue;
    const artifact = raw as Record<string, unknown>;
    const kind =
      typeof artifact.kind === 'string' && artifact.kind.trim()
        ? artifact.kind.trim()
        : undefined;
    const title =
      typeof artifact.title === 'string' && artifact.title.trim()
        ? artifact.title.trim()
        : undefined;
    const content =
      typeof artifact.content === 'string' && artifact.content.trim()
        ? artifact.content.trim()
        : undefined;
    if (!title && !content) continue;
    return { kind, title, content };
  }
  return undefined;
}

export function buildAgentTaskRuntimeStatusItem(action: {
  id: string;
  title: string;
  queueStatus: string;
  startedAt?: number;
  finishedAt?: number;
  createdAt?: number;
  lastError?: string;
  result?: Record<string, unknown>;
  sourceRefId?: string;
  params?: Record<string, unknown>;
}): AgentTaskRuntimeStatusItem {
  const metadata =
    action.params?.metadata && typeof action.params.metadata === 'object'
      ? (action.params.metadata as Record<string, unknown>)
      : undefined;
  const sheetMessageId =
    nonEmptyString(metadata?.sheetMessageId) ||
    (action.sourceRefId?.startsWith('msg_') ? action.sourceRefId : undefined);
  const taskId =
    nonEmptyString(metadata?.taskId) ||
    (action.sourceRefId && !action.sourceRefId.startsWith('msg_')
      ? action.sourceRefId
      : undefined);
  const summary =
    getExecutionSummary(action.result) ||
    (action.lastError?.trim() ? action.lastError.trim() : undefined);
  const evidence = firstArtifactPreview(action.result);

  return {
    sourceRefId: action.sourceRefId || sheetMessageId || taskId || action.id,
    sheetMessageId,
    taskId,
    latestAction: {
      id: action.id,
      title: action.title,
      queueStatus: action.queueStatus,
      resultStatus: getResultStatus(action.result, action.queueStatus),
      startedAt: action.startedAt,
      finishedAt: action.finishedAt,
      createdAt: action.createdAt,
      lastError: action.lastError,
    },
    summary,
    evidence,
  };
}

export async function agentTaskRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { ids?: string; limit?: string };
  }>('/agent-tasks/runtime-status', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
    const deliveryRepo = new ChannelDeliveryRepository(db);
    const readinessService = new ActionReadinessService(
      db,
      userDataManager,
      request.userId,
    );
    const ids =
      typeof request.query.ids === 'string'
        ? request.query.ids
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
    const limit = Math.max(
      1,
      Math.min(parseInt(request.query.limit ?? '100', 10) || 100, 200),
    );
    const scopedIds = ids.slice(0, limit);

    if (scopedIds.length === 0) {
      return reply.status(200).send({ items: [], total: 0 });
    }

    const actions = repo.listLatestBySourceRefs({
      sourceKind: 'agent_task',
      sourceRefIds: scopedIds,
      limitPerRef: 1,
    });

    const byRef = new Map<string, AgentTaskRuntimeStatusItem>();
    for (const action of actions) {
      let item = enrichRuntimeStatusWithReadiness(
        buildAgentTaskRuntimeStatusItem(action),
        action,
        readinessService,
      );
      if (action.queueStatus === 'succeeded') {
        // Result-kind deliveries are always planned first when present — see
        // planAgentTaskNotifications — so index 0 is where to look.
        const deliveryRecord = deliveryRepo.getRecord(
          `agent_task:${action.id}:result:0`,
          'glip',
          'notice',
        );
        if (deliveryRecord) {
          item = {
            ...item,
            resultNotifyDelivery: {
              delivered: deliveryRecord.status === 'delivered',
              error: deliveryRecord.status === 'delivered' ? undefined : deliveryRecord.lastError,
            },
          };
        }
      }
      const keys = [item.sourceRefId, item.sheetMessageId, item.taskId].filter(
        (value): value is string => Boolean(value),
      );
      for (const key of keys) {
        if (!byRef.has(key)) {
          byRef.set(key, item);
        }
      }
    }

    const items = scopedIds.map(
      (id) =>
        byRef.get(id) ||
        ({
          sourceRefId: id,
          latestAction: null,
        } satisfies AgentTaskRuntimeStatusItem),
    );

    return reply.status(200).send({ items, total: items.length });
  });

  app.post<{ Body: AgentTaskExecuteBody }>(
    '/agent-tasks/execute',
    async (request, reply) => {
      const body = request.body ?? {};
      const taskId = nonEmptyString(body.taskId) || nonEmptyString(body.sheetMessageId);
      const task = nonEmptyString(body.task);
      const arBindingId = nonEmptyString(body.arBindingId);

      if (!taskId) {
        return reply.status(400).send({ error: 'taskId is required' });
      }
      if (!task) {
        return reply.status(400).send({ error: 'task is required' });
      }

      const { db, userDataManager } = request.userContext;
      const runtimeConfig = getUserRuntimeConfig(userDataManager);
      const defaults = resolveExecutorDefaults(runtimeConfig);
      const requestedExecutor = resolveAgentTaskExecutorId(
        body.executor,
        defaults,
      );
      const executorInstance = findEnabledExecutor(
        runtimeConfig,
        requestedExecutor,
      );
      if (!executorInstance) {
        const available = publicExecutorOptions(runtimeConfig);
        return reply.status(400).send({
          error: 'unsupported_executor',
          detail: available.length
            ? `executor "${requestedExecutor}" is not enabled; available: ${available
                .map((item) => item.id)
                .join(', ')}`
            : 'no enabled agent executors configured; open Options → Agent 执行器',
          available,
        });
      }
      const executor = executorInstance.id;

      const userId = nonEmptyString(body.userId) || request.userId || 'default';
      const title = nonEmptyString(body.title) || taskId;
      const triggerSource = nonEmptyString(body.triggerSource) || 'jira_rule';
      const targetSystem =
        nonEmptyString(body.targetSystem) || (arBindingId ? 'personal_ai_ar' : 'agent_task');
      const taskKind = nonEmptyString(body.taskKind);
      const mode = resolveAgentTaskMode(body.mode);
      if (!mode) {
        return reply.status(400).send({
          error: 'invalid_mode',
          detail: 'mode must be "read" or "write"',
        });
      }
      const executionHints =
        body.executionHints && typeof body.executionHints === 'object'
          ? body.executionHints
          : undefined;
      const idempotencyKey =
        nonEmptyString(body.idempotencyKey) ||
        [
          triggerSource,
          taskId,
          nonEmptyString(body.scheduleSpec) || 'adhoc',
        ].join(':');
      const sourceRefId = nonEmptyString(body.sheetMessageId) || taskId;
      // A request body field always wins; this row only fills in what the caller
      // omitted. It exists because the deployed Apps Script version is what
      // decides which fields actually get sent — see migration 064.
      const storedNotifyConfig = new AgentTaskNotifyConfigRepository(db).get(sourceRefId);
      const notifyTarget = normalizeAgentTaskNotifyTarget(
        body.notifyTarget !== undefined ? body.notifyTarget : storedNotifyConfig?.notifyTarget,
      );
      const timeoutMs = normalizeAgentTaskTimeoutMs(body.timeoutMs);
      const shouldNotify = body.notify !== false;
      const successReceipt =
        body.successReceipt !== undefined
          ? body.successReceipt !== false
          : storedNotifyConfig?.successReceipt !== undefined
            ? storedNotifyConfig.successReceipt !== 'N'
            : true;
      const notifyVia = normalizeAgentTaskNotifyVia(
        body.notifyVia !== undefined ? body.notifyVia : storedNotifyConfig?.notifyVia,
      );
      const notifyTemplate =
        nonEmptyString(body.notifyTemplate) ??
        nonEmptyString(storedNotifyConfig?.notifyTemplate);
      // Undefined stays undefined so the delivery layer applies the shared default (stay quiet).
      const notifyWhenEmpty =
        body.notifyWhenEmpty !== undefined
          ? body.notifyWhenEmpty !== false
          : storedNotifyConfig?.notifyWhenEmpty !== undefined
            ? storedNotifyConfig.notifyWhenEmpty !== 'N'
            : undefined;
      const asmeSender = normalizeAsMeSenderCredentials(body.asmeSender);
      const resultTarget = resolveExplicitAgentTaskResultTarget(notifyTarget);
      // API response: prefer explicit result target; otherwise report owner receipt fallback.
      const resolvedNotificationTarget =
        resultTarget ||
        resolveAgentTaskNotificationTarget(undefined, userId);

      const repo = new ActionRepository(db);
      const existingAction = repo.findReusableByIdempotencyKey(idempotencyKey);
      const action = existingAction ?? repo.create({
        actionType: 'delegate_agent',
        title,
        description: task,
        params: {
          task,
          mode,
          targetSystem,
          timeoutMs,
          executor,
          metadata: {
            taskId,
            sheetMessageId: body.sheetMessageId,
            rowIndex: body.rowIndex,
            executor,
            executorId: executor,
            executorType: executorInstance.type,
            targetSystem,
            taskKind,
            executionHints,
            notifyTemplate,
            triggerSource,
            arBindingId,
            notifyTarget,
            successReceipt,
            notifyVia,
            notifyWhenEmpty,
            source: body.source,
            scheduleSpec: body.scheduleSpec,
            suppressRecoveryNotifications: body.notify === false,
            candidateArtifacts: arBindingId
              ? [
                  {
                    kind: 'ar_binding',
                    title,
                    entityKey: arBindingId,
                    sourceSystem: targetSystem,
                  },
                ]
              : undefined,
          },
        },
        riskLevel: 'medium',
        confidence: 0.8,
        requiresApproval: false,
        executionMode: 'auto',
        priority: 7,
        idempotencyKey,
        sourceKind: 'agent_task',
        sourceRefId,
        queueStatus: 'queued',
        scheduledAt: now(),
      });

      const reused = Boolean(existingAction);
      const statusUrl = `/api/v1/agent-tasks/runtime-status?ids=${encodeURIComponent(sourceRefId)}`;
      // Only short-circuit when a run is in flight or already succeeded with a stored result.
      // failed / dead_letter / stale queued fall through so the user can retry the same idempotency key.
      if (
        reused &&
        ['running', 'succeeded', 'input_required'].includes(action.queueStatus)
      ) {
        return reply.status(200).send({
          accepted: true,
          reused: true,
          taskId,
          runId: action.id,
          actionId: action.id,
          queueStatus: action.queueStatus,
          statusUrl,
          result: action.result,
          error: action.lastError,
          notificationTarget: resolvedNotificationTarget,
          notification: {
            sent: false,
            skipped: true,
            reason: 'idempotent_duplicate',
          },
        });
      }

      // Block A: enqueue-and-return. Execution + notification run in background
      // (HeartbeatLoop also drains due auto actions). Delivery now lives inside
      // ActionExecutor so the home-lane due-scan uses the same path; failure
      // must not rewrite run status.
      setImmediate(() => {
        void (async () => {
          try {
            const executorService = new ActionExecutor(db, userDataManager, userId);
            await executorService.executeAction(action.id, { asmeSender });
          } catch (error) {
            request.log.error(
              { err: error, taskId, actionId: action.id },
              'AgentTask background execution/notification failed',
            );
          }
        })();
      });

      return reply.status(202).send({
        accepted: true,
        reused,
        taskId,
        runId: action.id,
        actionId: action.id,
        queueStatus: action.queueStatus,
        statusUrl,
        notificationTarget: resolvedNotificationTarget,
        notification: {
          sent: false,
          skipped: !shouldNotify,
          reason: shouldNotify ? 'queued_for_delivery' : 'notification_disabled',
          successReceipt,
          notifyVia,
          notifyWhenEmpty: shouldNotifyEmptyResult({ mode: mode ?? 'read', notifyWhenEmpty }),
        },
      });
    },
  );

  /**
   * Registers AgentTask notification preferences directly, so they don't depend
   * on a triggering caller's request body carrying every field — the deployed
   * Apps Script version decides which fields it forwards, and can lag the
   * template that defines them. Values sent here are consumed as a fallback by
   * /agent-tasks/execute whenever the body omits the corresponding field.
   */
  app.post<{
    Body: {
      sheetMessageId?: string;
      notifyTarget?: AgentTaskNotifyTarget | null;
      successReceipt?: 'Y' | 'N' | boolean;
      notifyVia?: 'bot' | 'asme';
      notifyTemplate?: string;
      notifyWhenEmpty?: 'Y' | 'N' | boolean;
    };
  }>('/agent-tasks/notify-config', async (request, reply) => {
    const body = request.body ?? {};
    const sheetMessageId = nonEmptyString(body.sheetMessageId);
    if (!sheetMessageId) {
      return reply.status(400).send({ error: 'sheetMessageId is required' });
    }

    const { db } = request.userContext;
    const repo = new AgentTaskNotifyConfigRepository(db);
    const notifyTarget = normalizeAgentTaskNotifyTarget(body.notifyTarget) || undefined;
    const successReceipt =
      body.successReceipt === 'Y' || body.successReceipt === true
        ? 'Y'
        : body.successReceipt === 'N' || body.successReceipt === false
          ? 'N'
          : undefined;
    const notifyVia =
      body.notifyVia === 'asme' ? 'asme' : body.notifyVia === 'bot' ? 'bot' : undefined;
    const notifyWhenEmpty =
      body.notifyWhenEmpty === 'Y' || body.notifyWhenEmpty === true
        ? 'Y'
        : body.notifyWhenEmpty === 'N' || body.notifyWhenEmpty === false
          ? 'N'
          : undefined;

    repo.upsert({
      sheetMessageId,
      notifyTarget,
      successReceipt,
      notifyVia,
      notifyTemplate: nonEmptyString(body.notifyTemplate),
      notifyWhenEmpty,
    });

    return reply.status(200).send({ ok: true, config: repo.get(sheetMessageId) });
  });

  app.delete<{ Params: { sheetMessageId: string } }>(
    '/agent-tasks/notify-config/:sheetMessageId',
    async (request, reply) => {
      const sheetMessageId = nonEmptyString(request.params.sheetMessageId);
      if (!sheetMessageId) {
        return reply.status(400).send({ error: 'sheetMessageId is required' });
      }

      const { db } = request.userContext;
      new AgentTaskNotifyConfigRepository(db).delete(sheetMessageId);
      return reply.status(200).send({ ok: true });
    },
  );
}
