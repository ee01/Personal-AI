import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { OpenClawDelegationService } from '../integrations/OpenClawDelegationService.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
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
  executionHints?: Record<string, unknown>;
  notifyTemplate?: string;
  triggerSource?: string;
  arBindingId?: string;
  idempotencyKey?: string;
  userId?: string;
  timeoutMs?: number;
  notify?: boolean;
  source?: Record<string, unknown>;
  scheduleSpec?: Record<string, unknown>;
  notifyTarget?: AgentTaskNotifyTarget;
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

      const executor = nonEmptyString(body.executor) || 'openclaw';
      if (executor !== 'openclaw') {
        return reply.status(400).send({
          error: 'unsupported_executor',
          detail: 'v1 only supports openclaw as the automatic AgentTask executor',
        });
      }

      const { db, userDataManager } = request.userContext;
      const userId = nonEmptyString(body.userId) || request.userId || 'default';
      const title = nonEmptyString(body.title) || taskId;
      const triggerSource = nonEmptyString(body.triggerSource) || 'jira_rule';
      const targetSystem =
        nonEmptyString(body.targetSystem) || (arBindingId ? 'personal_ai_ar' : 'agent_task');
      const taskKind = nonEmptyString(body.taskKind);
      const executionHints =
        body.executionHints && typeof body.executionHints === 'object'
          ? body.executionHints
          : undefined;
      const idempotencyKey =
        nonEmptyString(body.idempotencyKey) ||
        `${triggerSource}:${taskId}:${Date.now()}`;
      const sourceRefId = nonEmptyString(body.sheetMessageId) || taskId;
      const notifyTarget = normalizeAgentTaskNotifyTarget(body.notifyTarget);
      const timeoutMs = normalizeAgentTaskTimeoutMs(body.timeoutMs);
      const resolvedNotificationTarget = resolveAgentTaskNotificationTarget(
        notifyTarget,
        userId,
      );

      const repo = new ActionRepository(db);
      const existingAction = repo.findReusableByIdempotencyKey(idempotencyKey);
      const action = existingAction ?? repo.create({
        actionType: 'delegate_openclaw',
        title,
        description: task,
        params: {
          task,
          mode: 'read',
          targetSystem,
          timeoutMs,
          metadata: {
            taskId,
            sheetMessageId: body.sheetMessageId,
            rowIndex: body.rowIndex,
            executor,
            targetSystem,
            taskKind,
            executionHints,
            notifyTemplate: body.notifyTemplate,
            triggerSource,
            arBindingId,
            notifyTarget,
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
      if (
        reused &&
        ['running', 'succeeded', 'failed', 'dead_letter'].includes(action.queueStatus)
      ) {
        return reply.status(200).send({
          accepted: true,
          reused: true,
          taskId,
          actionId: action.id,
          queueStatus: action.queueStatus,
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

      const executorService = new ActionExecutor(db, userDataManager, userId);
      const execution = await executorService.executeAction(action.id);

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

      let notificationBody = defaultBody;
      const notifyTemplate = nonEmptyString(body.notifyTemplate);
      if (body.notify !== false && notifyTemplate && execution.queueStatus === 'succeeded') {
        try {
          notificationBody = await formatSuccessNotificationWithTemplate({
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

      let notification:
        | Awaited<ReturnType<NotificationCenterService['deliverNoticeToGlip']>>
        | { sent: false; skipped: true; reason: string };
      if (body.notify === false) {
        notification = {
          sent: false,
          skipped: true,
          reason: 'notification_disabled',
        };
      } else {
        const notificationService = new NotificationCenterService(db);
        notification = await notificationService.deliverNoticeToGlip({
          sourceRef: `agent_task:${action.id}`,
          title:
            execution.queueStatus === 'succeeded'
              ? `帮我做完成: ${title}`
              : `帮我做失败: ${title}`,
          body: notificationBody,
          mention: true,
          targetUserId:
            resolvedNotificationTarget.type === 'private'
              ? resolvedNotificationTarget.targetUserId
              : undefined,
          targetGroupId:
            resolvedNotificationTarget.type === 'group'
              ? resolvedNotificationTarget.targetGroupId
              : undefined,
        });
      }

      return reply.status(200).send({
        accepted: true,
        reused,
        taskId,
        actionId: action.id,
        queueStatus: execution.queueStatus,
        result: execution.result,
        error: execution.error,
        notificationTarget: resolvedNotificationTarget,
        notification,
      });
    },
  );
}
