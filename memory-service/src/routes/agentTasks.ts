import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ActionReadinessService } from '../core/ActionReadinessService.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { OpenClawDelegationService } from '../integrations/OpenClawDelegationService.js';
import {
  findEnabledExecutor,
  isAgentDelegateActionType,
  publicExecutorOptions,
  resolveAgentTaskExecutorId,
  resolveExecutorDefaults,
} from '../integrations/executors/executorRegistry.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';

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

export interface AgentTaskNotifyTarget {
  type?: 'private' | 'group';
  targetUserId?: string;
  targetGroupId?: string;
  glipUserName?: string;
  glipUser?: string;
  glipTeamId?: string;
}

export interface ResolvedAgentTaskNotificationTarget {
  type: 'private' | 'group' | 'default_bot_config';
  targetUserId?: string;
  targetGroupId?: string;
  defaulted: boolean;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeNotifyTargetUser(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;

  const firstUser = raw.split(/[+,]/)[0]?.trim();
  if (!firstUser) return undefined;

  const localPart = firstUser.includes('@')
    ? firstUser.split('@')[0]?.trim()
    : firstUser;
  const normalized = localPart?.toLowerCase().replace(/\s+/g, '.');
  return normalized && /^[a-z0-9._-]+$/i.test(normalized) ? normalized : undefined;
}

export function normalizeAgentTaskNotifyTarget(
  value: unknown,
): AgentTaskNotifyTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const input = value as Record<string, unknown>;
  const groupId =
    nonEmptyString(input.targetGroupId) || nonEmptyString(input.glipTeamId);
  if ((input.type === 'group' || groupId) && groupId) {
    return {
      type: 'group',
      targetGroupId: groupId,
      glipTeamId: groupId,
    };
  }

  const targetUserId =
    normalizeNotifyTargetUser(input.targetUserId) ||
    normalizeNotifyTargetUser(input.glipUserName) ||
    normalizeNotifyTargetUser(input.glipUser);
  if (targetUserId) {
    return {
      type: 'private',
      targetUserId,
      glipUserName: nonEmptyString(input.glipUserName) || nonEmptyString(input.glipUser),
      glipUser: nonEmptyString(input.glipUser),
    };
  }

  return undefined;
}

export function resolveAgentTaskNotificationTarget(
  notifyTarget: AgentTaskNotifyTarget | undefined,
  userId: string,
): ResolvedAgentTaskNotificationTarget {
  if (notifyTarget?.type === 'group' && notifyTarget.targetGroupId) {
    return {
      type: 'group',
      targetGroupId: notifyTarget.targetGroupId,
      defaulted: false,
    };
  }

  if (notifyTarget?.type === 'private' && notifyTarget.targetUserId) {
    return {
      type: 'private',
      targetUserId: notifyTarget.targetUserId,
      defaulted: false,
    };
  }

  if (userId && userId !== 'default') {
    return {
      type: 'private',
      targetUserId: userId,
      defaulted: true,
    };
  }

  return {
    type: 'default_bot_config',
    defaulted: true,
  };
}

export type AgentTaskNotificationKind =
  | 'result'
  | 'success_receipt'
  | 'failure_receipt';

export type AgentTaskNotifyVia = 'bot' | 'asme';

export interface AgentTaskNotificationDelivery {
  kind: AgentTaskNotificationKind;
  targetUserId?: string;
  targetGroupId?: string;
  /** Template formatting only applies to success result notifications. */
  useTemplate: boolean;
}

export function normalizeAgentTaskNotifyVia(value: unknown): AgentTaskNotifyVia {
  return String(value || '').trim().toLowerCase() === 'asme' ? 'asme' : 'bot';
}

export function normalizeAsMeSenderCredentials(value: unknown): {
  clientId: string;
  clientSecret: string;
  jwt: string;
  serverUrl?: string;
} | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const clientId = nonEmptyString(input.clientId);
  const clientSecret = nonEmptyString(input.clientSecret);
  const jwt = nonEmptyString(input.jwt);
  if (!clientId || !clientSecret || !jwt) return undefined;
  return {
    clientId,
    clientSecret,
    jwt,
    serverUrl: nonEmptyString(input.serverUrl),
  };
}

export function resolveAgentTaskDeliveryVia(
  kind: AgentTaskNotificationKind,
  notifyVia: AgentTaskNotifyVia,
): AgentTaskNotifyVia {
  return kind === 'result' && notifyVia === 'asme' ? 'asme' : 'bot';
}

export interface AgentTaskAsMeRingClient {
  isConfigured(): boolean;
  resolveTarget(input: {
    targetType: string;
    targetRef: string;
    limit?: number;
  }): Promise<{
    status: 'unresolved' | 'ambiguous' | 'resolved';
    resolved?: {
      kind: 'user' | 'chat';
      entityId: string;
      chatId?: string;
    };
  }>;
  resolveDirectConversationChatId(userEntityId: string): Promise<string | null>;
  sendMessage(input: {
    targetType: string;
    targetRef: string;
    text: string;
    targetResolvedType?: string;
    targetResolvedId?: string;
    targetResolvedChatId?: string;
  }): Promise<{ chatId: string; postId: string }>;
}

export async function deliverAgentTaskAsMeNotice(input: {
  ringClient: AgentTaskAsMeRingClient;
  title: string;
  body: string;
  targetUserId?: string;
  targetGroupId?: string;
}): Promise<{ sent: boolean; error?: string; chatId?: string; postId?: string }> {
  if (!input.ringClient.isConfigured()) {
    return { sent: false, error: 'RingCentral not configured for AsMe notify' };
  }

  const text = `**${input.title}**\n\n${input.body}`;
  try {
    const targetGroupId = input.targetGroupId?.trim();
    if (targetGroupId) {
      const sent = await input.ringClient.sendMessage({
        targetType: 'group',
        targetRef: targetGroupId,
        text,
      });
      return { sent: true, chatId: sent.chatId, postId: sent.postId };
    }

    const targetUserId = input.targetUserId?.trim();
    if (!targetUserId) {
      return { sent: false, error: 'AsMe notify missing private target' };
    }

    const resolution = await input.ringClient.resolveTarget({
      targetType: 'private',
      targetRef: targetUserId,
      limit: 8,
    });
    if (resolution.status !== 'resolved' || !resolution.resolved) {
      return {
        sent: false,
        error: `AsMe notify target unresolved (${resolution.status}): ${targetUserId}`,
      };
    }

    let chatId = resolution.resolved.chatId;
    if (!chatId && resolution.resolved.kind === 'user' && resolution.resolved.entityId) {
      chatId =
        (await input.ringClient.resolveDirectConversationChatId(resolution.resolved.entityId)) ||
        undefined;
    }
    if (!chatId) {
      return { sent: false, error: `AsMe notify missing chat id for ${targetUserId}` };
    }

    const sent = await input.ringClient.sendMessage({
      targetType: 'private',
      targetRef: targetUserId,
      targetResolvedType: resolution.resolved.kind,
      targetResolvedId: resolution.resolved.entityId,
      targetResolvedChatId: chatId,
      text,
    });
    return { sent: true, chatId: sent.chatId, postId: sent.postId };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Plan Glip deliveries for an AgentTask run.
 *
 * Matrix (when notify !== false):
 * - Failure: always Bot private failure receipt to owner (never to notifyTarget).
 * - Success + result target + successReceipt: result to target; owner receipt unless target is already owner private (dedupe).
 * - Success + result target + !successReceipt: result to target only.
 * - Success + no result target + successReceipt: owner private success receipt (default body, no template).
 * - Success + no result target + !successReceipt: silent.
 *
 * `notifyVia=asme` only changes the success **result** delivery identity.
 * Credentials come from Sheet AsMe RingCentral sender (`ringcentral_sender_*`),
 * the same token used by AsMe push-method messages. Receipts always stay Bot.
 * AsMe failure does not fall back to Bot.
 *
 * `notify === false` (API-level, e.g. AR) suppresses all deliveries including failure.
 */
export function planAgentTaskNotifications(input: {
  succeeded: boolean;
  notify: boolean;
  successReceipt: boolean;
  resultTarget?: ResolvedAgentTaskNotificationTarget;
  ownerUserId: string;
}): AgentTaskNotificationDelivery[] {
  if (!input.notify) return [];

  const ownerUserId =
    input.ownerUserId && input.ownerUserId !== 'default'
      ? input.ownerUserId
      : undefined;
  const resultTarget =
    input.resultTarget && !input.resultTarget.defaulted
      ? input.resultTarget
      : undefined;

  if (!input.succeeded) {
    return [
      {
        kind: 'failure_receipt',
        targetUserId: ownerUserId,
        useTemplate: false,
      },
    ];
  }

  const deliveries: AgentTaskNotificationDelivery[] = [];
  if (resultTarget) {
    deliveries.push({
      kind: 'result',
      targetUserId:
        resultTarget.type === 'private' ? resultTarget.targetUserId : undefined,
      targetGroupId:
        resultTarget.type === 'group' ? resultTarget.targetGroupId : undefined,
      useTemplate: true,
    });
  }

  if (!input.successReceipt) {
    return deliveries;
  }

  const isOwnerPrivateResult =
    resultTarget?.type === 'private' &&
    Boolean(ownerUserId) &&
    resultTarget.targetUserId === ownerUserId;
  if (isOwnerPrivateResult) {
    // Merged into the single result delivery above.
    return deliveries;
  }

  deliveries.push({
    kind: 'success_receipt',
    targetUserId: ownerUserId,
    useTemplate: false,
  });
  return deliveries;
}

export function resolveExplicitAgentTaskResultTarget(
  notifyTarget: AgentTaskNotifyTarget | undefined,
): ResolvedAgentTaskNotificationTarget | undefined {
  if (!notifyTarget) return undefined;
  if (notifyTarget.type === 'group' && notifyTarget.targetGroupId) {
    return {
      type: 'group',
      targetGroupId: notifyTarget.targetGroupId,
      defaulted: false,
    };
  }
  if (notifyTarget.type === 'private' && notifyTarget.targetUserId) {
    return {
      type: 'private',
      targetUserId: notifyTarget.targetUserId,
      defaulted: false,
    };
  }
  return undefined;
}

function compactText(value: unknown, maxLength = 1600): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}...`;
}

function normalizeAgentTaskTimeoutMs(value: unknown): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return AGENT_TASK_OPENCLAW_TIMEOUT_MS;
  }
  return Math.max(AGENT_TASK_OPENCLAW_TIMEOUT_MS, Math.floor(candidate));
}

function buildDefaultNotificationBody(input: {
  title: string;
  taskId: string;
  resultStatus: string;
  queueStatus: string;
  summary?: string;
  error?: string;
  actionId: string;
  triggerSource: string;
  arBindingId?: string;
}): string {
  const lines = [
    `任务: ${input.title}`,
    `状态: ${input.resultStatus || input.queueStatus}`,
    input.summary ? `结果: ${compactText(input.summary, 900)}` : '',
    input.error ? `错误: ${compactText(input.error, 900)}` : '',
    `Run: ${input.actionId}`,
    `触发: ${input.triggerSource}`,
    input.arBindingId ? `AR: ${input.arBindingId}` : '',
    '边界: Sheet 只记录计划和到期领取；原始执行结果、artifact 和错误以 memory-service run 账本为准。',
  ];
  return lines.filter(Boolean).join('\n');
}

function getExecutionSummary(result?: Record<string, unknown>): string | undefined {
  const summary = result?.summary;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : undefined;
}

function getResultStatus(result?: Record<string, unknown>, queueStatus?: string): string {
  const status = result?.status;
  if (typeof status === 'string' && status.trim()) {
    return status.trim();
  }
  return queueStatus || 'unknown';
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

async function formatSuccessNotificationWithTemplate(input: {
  template: string;
  title: string;
  task: string;
  defaultBody: string;
  result?: Record<string, unknown>;
  userDataManager: any;
  userId: string;
}): Promise<string> {
  const template = input.template.trim();
  if (!template) return input.defaultBody;

  const formatter = new OpenClawDelegationService(input.userDataManager, input.userId);
  const outcome = await formatter.delegate({
    task: [
      '你只负责把 Agent task 执行结果整理成通知文案，不执行外部操作，不改变 artifact。',
      '请按用户给出的模板风格输出可以直接私发给用户的中文通知。',
      '返回 JSON envelope，其中 summary 字段就是最终通知正文，并附带一个 artifact 说明这是通知格式化结果。',
      '',
      `任务标题: ${input.title}`,
      `任务内容: ${input.task}`,
      `用户通知模板: ${template}`,
      `默认摘要:\n${input.defaultBody}`,
      `原始结果 JSON:\n${JSON.stringify(input.result ?? {}, null, 2)}`,
    ].join('\n'),
    mode: 'read',
    targetSystem: 'agent_task_notification',
    threadId: `agent-task-notification:${input.title}`,
    actionId: `agent-task-notification:${randomUUID()}`,
    sessionKey: `agent-task-notification:${input.title}:${Date.now()}`,
    metadata: {
      notificationOnly: true,
      template,
    },
  });

  if (outcome.status === 'success' && outcome.summary?.trim()) {
    return outcome.summary.trim();
  }

  return input.defaultBody;
}

export async function agentTaskRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { ids?: string; limit?: string };
  }>('/agent-tasks/runtime-status', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const repo = new ActionRepository(db);
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
      const item = enrichRuntimeStatusWithReadiness(
        buildAgentTaskRuntimeStatusItem(action),
        action,
        readinessService,
      );
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
      const notifyTarget = normalizeAgentTaskNotifyTarget(body.notifyTarget);
      const timeoutMs = normalizeAgentTaskTimeoutMs(body.timeoutMs);
      const shouldNotify = body.notify !== false;
      const successReceipt = body.successReceipt !== false;
      const notifyVia = normalizeAgentTaskNotifyVia(body.notifyVia);
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
            notifyTemplate: body.notifyTemplate,
            triggerSource,
            arBindingId,
            notifyTarget,
            successReceipt,
            notifyVia,
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
      // (HeartbeatLoop also drains due auto actions). Result and notification are
      // independent — notification failure must not rewrite run status.
      const notifyTemplate = nonEmptyString(body.notifyTemplate);
      setImmediate(() => {
        void (async () => {
          try {
            const executorService = new ActionExecutor(db, userDataManager, userId);
            const execution = await executorService.executeAction(action.id);
            const succeeded = execution.queueStatus === 'succeeded';
            const deliveries = planAgentTaskNotifications({
              succeeded,
              notify: shouldNotify,
              successReceipt,
              resultTarget,
              ownerUserId: userId,
            });
            if (deliveries.length === 0) return;

            const resultStatus = getResultStatus(execution.result, execution.queueStatus);
            const summary = getExecutionSummary(execution.result);
            const defaultBody = buildDefaultNotificationBody({
              title,
              taskId,
              resultStatus,
              queueStatus: execution.queueStatus,
              summary,
              error: execution.error,
              actionId: action.id,
              triggerSource,
              arBindingId: nonEmptyString(body.arBindingId),
            });

            let templatedResultBody = defaultBody;
            const needsTemplate =
              Boolean(notifyTemplate) &&
              succeeded &&
              deliveries.some((item) => item.useTemplate);
            if (needsTemplate && notifyTemplate) {
              try {
                templatedResultBody = await formatSuccessNotificationWithTemplate({
                  template: notifyTemplate,
                  title,
                  task,
                  defaultBody,
                  result: execution.result,
                  userDataManager,
                  userId,
                });
              } catch (error) {
                request.log.warn(
                  { err: error, taskId, actionId: action.id },
                  'AgentTask notification template formatting failed; using default body',
                );
              }
            }

            const notificationService = new NotificationCenterService(db);
            for (const [index, delivery] of deliveries.entries()) {
              const bodyText =
                delivery.useTemplate && succeeded ? templatedResultBody : defaultBody;
              const noticeTitle =
                delivery.kind === 'failure_receipt'
                  ? `帮我做失败: ${title}`
                  : `帮我做完成: ${title}`;
              const deliveryVia = resolveAgentTaskDeliveryVia(delivery.kind, notifyVia);
              if (deliveryVia === 'asme') {
                if (!asmeSender) {
                  request.log.warn(
                    { taskId, actionId: action.id, kind: delivery.kind },
                    'AgentTask AsMe result notify missing Sheet RingCentral sender credentials',
                  );
                  continue;
                }
                const asmeResult = await deliverAgentTaskAsMeNotice({
                  ringClient: new RingCentralClient(userDataManager, db, userId, asmeSender),
                  title: noticeTitle,
                  body: bodyText,
                  targetUserId: delivery.targetUserId,
                  targetGroupId: delivery.targetGroupId,
                });
                if (!asmeResult.sent) {
                  request.log.warn(
                    {
                      err: asmeResult.error,
                      taskId,
                      actionId: action.id,
                      kind: delivery.kind,
                    },
                    'AgentTask AsMe result notify failed',
                  );
                }
                continue;
              }
              await notificationService.deliverNoticeToGlip({
                sourceRef: `agent_task:${action.id}:${delivery.kind}:${index}`,
                title: noticeTitle,
                body: bodyText,
                mention: true,
                targetUserId: delivery.targetUserId,
                targetGroupId: delivery.targetGroupId,
              });
            }
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
        },
      });
    },
  );
}
