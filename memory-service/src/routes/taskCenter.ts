import type { FastifyInstance } from 'fastify';

import {
  ActionRepository,
  TASK_KINDS,
  TASK_LANES,
  normalizeTaskKind,
  normalizeTaskLane,
  type QueuedActionRecord,
  type TaskKind,
  type TaskLane,
} from '../repositories/ActionRepository.js';
import { TaskCenterMaintenanceService } from '../core/TaskCenterMaintenanceService.js';
import { now } from '../utils/time.js';

/**
 * Task Center: one write path for every task-producing entry point.
 *
 * Glip scheduled messages, later-reminders, Jira rule imports, reflection
 * promotions and dev handoffs all POST here. Which scheduler ends up owning the
 * trigger (lane) is decided here, not by the caller — that is what keeps the
 * entry points from each growing their own copy of the routing rules.
 */

/** Kinds whose scheduling can be handed to Jira Automation via a Sheet mirror row. */
const CLOUD_CAPABLE_KINDS: TaskKind[] = ['push', 'agent'];

/**
 * Kinds pinned to local scheduling: they need gates, dependencies or file
 * artifacts, none of which a Sheet row can express.
 */
export function isLaneSelectable(taskKind: TaskKind | undefined): boolean {
  return Boolean(taskKind && CLOUD_CAPABLE_KINDS.includes(taskKind));
}

export interface LaneDecision {
  lane: TaskLane;
  /** Why this lane, in words the editor can show next to the picker. */
  reason: string;
  /** False when the caller asked for a lane it could not have. */
  honoredRequest: boolean;
}

/**
 * Decide the lane for a task.
 *
 * `cloudLaneAvailable` is the Level 2 signal (Sheet + Apps Script + Jira rule
 * configured). A caller asking for jira_sheet without it falls back to local
 * rather than failing: the task should still run, just on the other scheduler.
 */
export function resolveLane(input: {
  taskKind?: TaskKind;
  requestedLane?: TaskLane;
  cloudLaneAvailable: boolean;
}): LaneDecision {
  const { taskKind, requestedLane, cloudLaneAvailable } = input;

  if (!isLaneSelectable(taskKind)) {
    return {
      lane: 'memory_cron',
      reason: `${taskKind ?? 'task'} 需要人工节点 / 依赖 / 产物能力，固定由 memory-service 调度`,
      honoredRequest: requestedLane === undefined || requestedLane === 'memory_cron',
    };
  }

  if (requestedLane === 'jira_sheet') {
    return cloudLaneAvailable
      ? {
          lane: 'jira_sheet',
          reason: 'Jira Automation 云端触发，memory-service 离线也会执行',
          honoredRequest: true,
        }
      : {
          lane: 'memory_cron',
          reason: '未启用 Level 2（Google Sheet + Jira Automation），已回落本地调度',
          honoredRequest: false,
        };
  }

  return {
    lane: 'memory_cron',
    reason: 'memory-service 到期队列调度',
    honoredRequest: true,
  };
}

interface CreateTaskBody {
  taskKind?: string;
  title?: string;
  description?: string;
  /** What the task actually does; shape depends on taskKind. */
  payload?: Record<string, unknown>;
  lane?: string;
  /** Level 2 availability, reported by the caller (the extension knows). */
  cloudLaneAvailable?: boolean;
  actionType?: string;
  executionMode?: 'manual' | 'auto';
  requiresApproval?: boolean;
  priority?: number;
  scheduledAt?: number;
  recurrenceSpec?: Record<string, unknown>;
  dependsOn?: string[];
  parentActionId?: string;
  idempotencyKey?: string;
  sourceKind?: string;
  sourceRefId?: string;
  mirrorRef?: Record<string, unknown>;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Default action type per kind. Reminders and reflection candidates only ever
 * notify; AI reports fetch then notify; outreach creates a session; pushes and
 * agent tasks otherwise delegate to an executor.
 */
function defaultActionType(
  taskKind: TaskKind,
  payload: Record<string, unknown>,
): string {
  const pushMethod =
    typeof payload.pushMethod === 'string'
      ? payload.pushMethod.trim().toLowerCase()
      : '';
  switch (taskKind) {
    case 'remind':
    case 'reflection':
      return 'notify_user';
    case 'outreach':
      return 'ask_external_user';
    case 'push':
      if (pushMethod === 'outreach') return 'ask_external_user';
      if (pushMethod === 'ai') return 'run_http_push';
      if (pushMethod === 'agent') return 'delegate_agent';
      return 'notify_user';
    case 'dev':
    case 'agent':
    default:
      return 'delegate_agent';
  }
}

/**
 * Reject a dependency set that would deadlock.
 *
 * The due-scan holds a task until every dependency succeeds, so a cycle is not
 * an error there — it is a task that silently never runs. Catching it at create
 * time is the only place it can still be reported to whoever built the tree.
 */
export function findDependencyCycle(
  repo: Pick<ActionRepository, 'getById'>,
  dependsOn: string[],
  candidateId = '__new__',
): string[] | null {
  const visiting = new Set<string>();
  const done = new Set<string>();

  const walk = (id: string, path: string[]): string[] | null => {
    if (id === candidateId) return [...path, id];
    if (done.has(id)) return null;
    if (visiting.has(id)) return [...path, id];
    visiting.add(id);
    const action = repo.getById(id);
    for (const next of action?.dependsOn ?? []) {
      const cycle = walk(next, [...path, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    done.add(id);
    return null;
  };

  for (const dep of dependsOn) {
    const cycle = walk(dep, [candidateId]);
    if (cycle) return cycle;
  }
  return null;
}

function serializeTask(action: QueuedActionRecord) {
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    taskKind: action.taskKind,
    lane: action.lane,
    queueStatus: action.queueStatus,
    scheduledAt: action.scheduledAt,
    startedAt: action.startedAt,
    finishedAt: action.finishedAt,
    priority: action.priority,
    dependsOn: action.dependsOn,
    parentActionId: action.parentActionId,
    recurrenceSpec: action.recurrenceSpec,
    mirrorRef: action.mirrorRef,
    params: action.params,
    result: action.result,
    lastError: action.lastError,
    retryCount: action.retryCount,
    sourceKind: action.sourceKind,
    sourceRefId: action.sourceRefId,
    createdAt: action.createdAt,
  };
}

export async function taskCenterRoutes(app: FastifyInstance): Promise<void> {
  /** The ledger list, grouped the way the Task Center UI reads it. */
  app.get<{
    Querystring: {
      taskKind?: string;
      lane?: string;
      queueStatus?: string;
      parentActionId?: string;
      limit?: string;
    };
  }>('/task-center/tasks', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);

    const result = repo.list({
      taskKind: normalizeTaskKind(request.query.taskKind),
      lane: normalizeTaskLane(request.query.lane),
      parentActionId: nonEmpty(request.query.parentActionId),
      queueStatus: (request.query.queueStatus as never) ?? 'all',
      limit: Math.max(1, Math.min(parseInt(request.query.limit ?? '100', 10) || 100, 200)),
    });

    return reply.status(200).send({
      items: result.items.map(serializeTask),
      total: result.total,
    });
  });

  /**
   * Look a task up by the idempotency key its entry point used.
   * Lets a caller (e.g. the snooze entry) find the reminder it created earlier
   * for the same message and reschedule it instead of stacking a duplicate.
   */
  app.get<{ Querystring: { idempotencyKey?: string } }>(
    '/task-center/tasks/by-key',
    async (request, reply) => {
      const key = nonEmpty(request.query.idempotencyKey);
      if (!key) return reply.status(400).send({ error: 'idempotencyKey is required' });
      const repo = new ActionRepository(request.userContext.db);
      const found = repo.findReusableByIdempotencyKey(key);
      return reply.status(200).send({ task: found ? serializeTask(found) : null });
    },
  );

  /** Lane availability + which kinds may choose, so the editor can grey correctly. */
  app.get('/task-center/capabilities', async (request, reply) => {
    return reply.status(200).send({
      lanes: TASK_LANES,
      taskKinds: TASK_KINDS,
      laneSelectableKinds: CLOUD_CAPABLE_KINDS,
      // Level 2 lives in the extension (Google + Jira credentials are there),
      // so this service cannot detect it; the caller reports it per request.
      cloudLaneDetection: 'client_reported',
    });
  });

  app.post<{ Body: CreateTaskBody }>('/task-center/tasks', async (request, reply) => {
    const body = request.body ?? {};
    const { db } = request.userContext;
    const repo = new ActionRepository(db);

    const taskKind = normalizeTaskKind(body.taskKind);
    if (!taskKind) {
      return reply.status(400).send({
        error: 'invalid_task_kind',
        detail: `taskKind must be one of: ${TASK_KINDS.join(', ')}`,
      });
    }

    const title = nonEmpty(body.title);
    if (!title) {
      return reply.status(400).send({ error: 'title is required' });
    }

    const dependsOn = Array.isArray(body.dependsOn)
      ? body.dependsOn.filter((id): id is string => typeof id === 'string' && !!id.trim())
      : [];
    const cycle = findDependencyCycle(repo, dependsOn);
    if (cycle) {
      return reply.status(400).send({
        error: 'dependency_cycle',
        detail: `依赖成环，任务将永远不会执行：${cycle.join(' → ')}`,
        cycle,
      });
    }

    if (body.parentActionId && !repo.getById(body.parentActionId)) {
      return reply.status(400).send({
        error: 'parent_not_found',
        detail: `父任务不存在：${body.parentActionId}`,
      });
    }

    const laneDecision = resolveLane({
      taskKind,
      requestedLane: normalizeTaskLane(body.lane),
      cloudLaneAvailable: body.cloudLaneAvailable === true,
    });

    const payload = body.payload ?? {};
    const notifyVia = payload.notifyVia ?? payload.channel;
    const notifyTarget = payload.notifyTarget;
    const actionType = nonEmpty(body.actionType) ?? defaultActionType(taskKind, payload);

    const action = repo.create({
      actionType,
      title,
      description: nonEmpty(body.description),
      params: {
        ...payload,
        title: payload.title ?? title,
        body: payload.body ?? nonEmpty(body.description),
        task:
          typeof payload.task === 'string' && payload.task.trim()
            ? payload.task
            : nonEmpty(body.description) ?? title,
        taskKind,
        laneReason: laneDecision.reason,
        metadata: {
          ...(payload.metadata && typeof payload.metadata === 'object'
            ? (payload.metadata as Record<string, unknown>)
            : {}),
          notifyVia,
          notifyTarget,
          successReceipt: payload.successReceipt !== false,
          notifyTemplate: payload.notifyTemplate,
          // Left undefined when the task never chose, so the delivery layer
          // can fall back to the mode default (write quiet, read still pushes).
          notifyWhenEmpty:
            payload.notifyWhenEmpty === undefined
              ? undefined
              : payload.notifyWhenEmpty !== false,
        },
      },
      // Dev delegations and write-mode agent work stop for a human before they
      // run; everything else drains automatically.
      requiresApproval: body.requiresApproval === true,
      executionMode: body.executionMode ?? 'auto',
      priority: body.priority,
      scheduledAt: body.scheduledAt ?? now(),
      dependsOn,
      parentActionId: nonEmpty(body.parentActionId),
      recurrenceSpec: body.recurrenceSpec,
      lane: laneDecision.lane,
      taskKind,
      mirrorRef: body.mirrorRef,
      idempotencyKey: nonEmpty(body.idempotencyKey),
      sourceKind: nonEmpty(body.sourceKind) ?? 'task_center',
      sourceRefId: nonEmpty(body.sourceRefId),
      queueStatus: 'queued',
    });

    return reply.status(201).send({
      task: serializeTask(action),
      lane: laneDecision,
      // The Sheet row is written by the extension (it holds the Google token),
      // so a jira_sheet task is not fully scheduled until that mirror lands.
      mirrorRequired: laneDecision.lane === 'jira_sheet',
    });
  });

  /**
   * Reschedule, pause or resume a task.
   *
   * Re-snoozing an existing reminder needs this: the entry point looks the task
   * up by its idempotency key and moves its due time instead of stacking a
   * second reminder for the same message.
   */
  app.patch<{
    Params: { id: string };
    Body: { scheduledAt?: number; queueStatus?: 'queued' | 'cancelled'; title?: string };
  }>('/task-center/tasks/:id', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ActionRepository(db);
    const existing = repo.getById(request.params.id);
    if (!existing) {
      return reply.status(404).send({ error: 'task_not_found' });
    }

    const body = request.body ?? {};
    if (body.queueStatus === 'cancelled') {
      repo.cancel(request.params.id, 'Cancelled from Task Center');
    } else if (typeof body.scheduledAt === 'number' && Number.isFinite(body.scheduledAt)) {
      // Reschedule also re-opens a task that already finished or was cancelled,
      // which is what "remind me again, later" means.
      repo.rescheduleTask(request.params.id, body.scheduledAt, nonEmpty(body.title));
    }

    const updated = repo.getById(request.params.id);
    return reply.status(200).send({ task: updated ? serializeTask(updated) : null });
  });

  /** Manual sweep, so the UI can roll a series forward without waiting a tick. */
  app.post('/task-center/sweep', async (request, reply) => {
    const { db } = request.userContext;
    const result = new TaskCenterMaintenanceService(db).sweep();
    return reply.status(200).send(result);
  });
}
