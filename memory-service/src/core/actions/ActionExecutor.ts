import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { OpenClawClient } from '../../integrations/OpenClawClient.js';
import {
  OpenClawDelegationService,
  type DelegationOutcome,
} from '../../integrations/OpenClawDelegationService.js';
import { OpenClawResponsesExecutor } from '../../integrations/executors/OpenClawResponsesExecutor.js';
import { OpenClawGatewayExecutor } from '../../integrations/executors/OpenClawGatewayExecutor.js';
import { AcpExecutor } from '../../integrations/executors/AcpExecutor.js';
import {
  findEnabledExecutor,
  isAgentDelegateActionType,
  resolveExecutorDefaults,
  type AgentExecutorInstance,
} from '../../integrations/executors/executorRegistry.js';
import {
  ActionRepository,
  type ActionQueueStatus,
  type QueuedActionRecord,
} from '../../repositories/ActionRepository.js';
import { ActionResultRepository } from '../../repositories/ActionResultRepository.js';
import { ConfirmRequestRepository } from '../../repositories/ConfirmRequestRepository.js';
import { getUserRuntimeConfig } from '../../runtimeConfig.js';
import { now } from '../../utils/time.js';
import { buildMessageRuleImprovementContextFromDelegationOutcome } from '../MessageRuleAutomationAdvisor.js';
import { TruthMaintainer, type PropertyChange } from '../TruthMaintainer.js';
import { ReflectionThreadService } from '../ReflectionThreadService.js';
import { OutreachEngine } from '../OutreachEngine.js';
import { EvidenceWatchContractService } from '../EvidenceWatchContractService.js';
import {
  ActionReadinessService,
  type ActionReadinessReceipt,
} from '../ActionReadinessService.js';
import type { UserDataManager } from '../../storage/UserDataManager.js';

const OPENCLAW_STALE_RUNNING_GRACE_SECONDS = 60;

export interface ActionExecutionResult {
  actionId: string;
  actionType: string;
  queueStatus: string;
  result?: Record<string, unknown>;
  error?: string;
  readinessReceipt?: ActionReadinessReceipt;
}

export interface ActionExecutionOptions {
  approve?: boolean;
}

interface DispatchOutcome {
  result: Record<string, unknown>;
  queueStatus?: Extract<
    ActionQueueStatus,
    'failed' | 'dead_letter' | 'running' | 'input_required'
  >;
  errorMessage?: string;
  delegationOutcome?: DelegationOutcome;
}

interface FollowUpActionSummary {
  id: string;
  actionType: string;
  title: string;
  queueStatus: ActionQueueStatus;
  sourceKind?: string;
  sourceRefId?: string;
}

function safeJsonValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

function normalizePriorityLabel(
  value: unknown,
  fallbackPriority?: number,
): 'high' | 'normal' | 'low' {
  if (value === 'high' || value === 'normal' || value === 'low') {
    return value;
  }
  if ((fallbackPriority ?? 0) >= 8) return 'high';
  if ((fallbackPriority ?? 0) <= 4) return 'low';
  return 'normal';
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeOutreachIntent(action: QueuedActionRecord): {
  targetType: string;
  targetRef: string;
  question: string;
} {
  const params = safeJsonValue(action.params);
  const targetObject =
    params.target &&
    typeof params.target === 'object' &&
    !Array.isArray(params.target)
      ? (params.target as Record<string, unknown>)
      : {};
  const targetType =
    firstNonEmptyString(
      params.targetType,
      params.target_type,
      targetObject.type,
    ) ?? 'person';
  const targetRef =
    firstNonEmptyString(
      params.targetRef,
      params.target_ref,
      params.targetId,
      params.chatId,
      targetObject.id,
    ) ?? '未指定目标';
  const question =
    firstNonEmptyString(
      params.question,
      params.prompt,
      action.description,
      action.title,
    ) ?? '未提供问题';

  return {
    targetType,
    targetRef,
    question,
  };
}

function isSelfDirectedOutreach(
  targetType: string,
  targetRef: string,
): boolean {
  const normalizedTargetType = targetType.trim().toLowerCase();
  const normalizedTargetRef = targetRef.trim().toLowerCase();
  if (
    normalizedTargetRef === 'user' ||
    normalizedTargetRef === 'me' ||
    normalizedTargetRef === 'self'
  ) {
    return true;
  }
  return (
    normalizedTargetType === 'person' && normalizedTargetRef === 'current-user'
  );
}

export function getOpenClawStaleRunningAfterSeconds(
  userDataManager?: UserDataManager,
): number {
  const config = getUserRuntimeConfig(userDataManager);
  return (
    Math.ceil(config.openClawTimeoutMs / 1000) +
    OPENCLAW_STALE_RUNNING_GRACE_SECONDS
  );
}

export function buildOpenClawStaleRunningError(
  staleAfterSeconds: number,
): string {
  return (
    `OpenClaw action exceeded stale running timeout (${staleAfterSeconds}s). ` +
    'The external operation may have completed without returning to Memory Service; review before retrying to avoid duplicate writes.'
  );
}

export class ActionExecutor {
  private readonly actionRepo: ActionRepository;
  private readonly actionResultRepo: ActionResultRepository;
  private readonly confirmRequestRepo: ConfirmRequestRepository;
  private readonly openClaw: OpenClawClient;
  private readonly delegationService: OpenClawDelegationService;
  private readonly threadService: ReflectionThreadService;
  private readonly actionReadinessService: ActionReadinessService;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.actionRepo = new ActionRepository(db);
    this.actionResultRepo = new ActionResultRepository(db);
    this.confirmRequestRepo = new ConfirmRequestRepository(db);
    this.openClaw = new OpenClawClient(userDataManager);
    this.delegationService = new OpenClawDelegationService(
      userDataManager,
      userId,
    );
    this.threadService = new ReflectionThreadService(
      db,
      userDataManager,
      userId,
    );
    this.actionReadinessService = new ActionReadinessService(
      db,
      userDataManager,
      userId,
    );
  }

  async runDueActions(limit = 10): Promise<ActionExecutionResult[]> {
    const staleAfterSeconds = getOpenClawStaleRunningAfterSeconds(
      this.userDataManager,
    );
    const staleError = buildOpenClawStaleRunningError(staleAfterSeconds);
    this.actionRepo.recoverStaleRunningActions({
      actionType: 'delegate_openclaw',
      staleAfterSeconds,
      errorMessage: staleError,
    });
    this.actionRepo.recoverStaleRunningActions({
      actionType: 'delegate_agent',
      staleAfterSeconds,
      errorMessage: staleError,
    });

    const dueActions = this.actionRepo.listDueAutoActions(limit);
    const results: ActionExecutionResult[] = [];

    for (const action of dueActions) {
      results.push(await this.executeAction(action.id));
    }

    return results;
  }

  /**
   * Injection defense (P0-2 P1): returns true when any evidence ref points at a
   * memory that was flagged with injection patterns at ingest (messages_raw /
   * chunks `injection_flags_json`). Evidence refs are strings such as
   * `message:<id>` or `chunk:<id>`; unknown shapes are ignored.
   */
  private evidenceHasFlaggedMemory(evidenceRefs: string[] | undefined): boolean {
    if (!evidenceRefs || evidenceRefs.length === 0) return false;
    const messageIds: string[] = [];
    const chunkIds: string[] = [];
    for (const ref of evidenceRefs) {
      if (typeof ref !== 'string') continue;
      const idx = ref.indexOf(':');
      const kind = idx > 0 ? ref.slice(0, idx) : '';
      const id = idx > 0 ? ref.slice(idx + 1) : ref;
      if (!id) continue;
      if (kind === 'message' || kind === 'messages' || kind === '') messageIds.push(id);
      else if (kind === 'chunk' || kind === 'chunks') chunkIds.push(id);
    }
    try {
      if (messageIds.length > 0) {
        const ph = messageIds.map(() => '?').join(', ');
        const row = this.db
          .prepare(
            `SELECT 1 FROM messages_raw
              WHERE id IN (${ph}) AND injection_flags_json IS NOT NULL LIMIT 1`,
          )
          .get(...messageIds);
        if (row) return true;
      }
      if (chunkIds.length > 0) {
        const ph = chunkIds.map(() => '?').join(', ');
        const row = this.db
          .prepare(
            `SELECT 1 FROM chunks
              WHERE id IN (${ph}) AND injection_flags_json IS NOT NULL LIMIT 1`,
          )
          .get(...chunkIds);
        if (row) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  async executeAction(
    actionId: string,
    options: ActionExecutionOptions = {},
  ): Promise<ActionExecutionResult> {
    let action = this.actionRepo.getById(actionId);
    if (!action) {
      throw new Error(`Action "${actionId}" not found`);
    }

    // Injection defense (P0-2 P1): if the action's evidence chain references any
    // flagged (possible-injection) memory, sever the "injection → reflection →
    // auto-action" path by forcing manual confirmation, regardless of the
    // action's executionMode. A human-initiated approve (options.approve===true)
    // still proceeds; only the unattended auto-runner is blocked.
    if (
      action.queueStatus !== 'cancelled' &&
      action.queueStatus !== 'succeeded' &&
      !action.approvedAt &&
      options.approve !== true &&
      this.evidenceHasFlaggedMemory(action.evidenceRefs)
    ) {
      throw new Error(
        `Action "${action.id}" references flagged (possible-injection) memory; manual confirmation required`,
      );
    }

    if (
      action.queueStatus === 'cancelled' ||
      action.queueStatus === 'succeeded'
    ) {
      return {
        actionId: action.id,
        actionType: action.actionType,
        queueStatus: action.queueStatus,
        result: action.result,
      };
    }

    if (isAgentDelegateActionType(action.actionType)) {
      const readiness =
        await this.actionReadinessService.prepareActionForDispatch(action);
      if (readiness.decision === 'block') {
        return {
          actionId: action.id,
          actionType: action.actionType,
          queueStatus: action.queueStatus,
          result: {
            status: 'blocked_by_readiness',
            readinessReceipt: readiness.receipt,
          },
          error:
            readiness.receipt.reason ??
            'Action is blocked by its readiness contract',
          readinessReceipt: readiness.receipt,
        };
      }
    }

    if (
      action.requiresApproval &&
      !action.approvedAt &&
      action.executionMode !== 'auto'
    ) {
      if (options.approve !== true) {
        throw new Error(
          `Action "${action.id}" requires human approval before execution`,
        );
      }
      action = this.actionRepo.markApproved(action.id) ?? action;
    }

    const attemptId = this.actionRepo.markRunning(action.id);
    try {
      const outcome = await this.dispatch(action);
      if (
        outcome.queueStatus === 'running' ||
        outcome.queueStatus === 'input_required'
      ) {
        // Keep queue_status=running with remote run metadata for later reconcile.
        this.actionRepo.patchRunningResult(action.id, {
          ...outcome.result,
          parkReason: outcome.queueStatus,
        });
        return {
          actionId: action.id,
          actionType: action.actionType,
          queueStatus: 'running',
          result: outcome.result,
        };
      }
      if (
        outcome.queueStatus === 'failed' ||
        outcome.queueStatus === 'dead_letter'
      ) {
        const updated =
          this.actionRepo.markFailed(
            action.id,
            attemptId,
            outcome.errorMessage ?? 'Action execution failed',
            outcome.queueStatus === 'dead_letter',
            outcome.result,
          ) ?? action;
        if (outcome.delegationOutcome) {
          const engine = new OutreachEngine(
            this.db,
            this.userDataManager,
            this.userId,
          );
          await engine.syncDelegationFailureToSession(
            updated,
            outcome.delegationOutcome,
            outcome.result,
          );
        }
        if (updated.threadId) {
          this.threadService.refreshThreadDocument(updated.threadId);
        }
        return {
          actionId: updated.id,
          actionType: updated.actionType,
          queueStatus: updated.queueStatus,
          result: outcome.result,
          error: outcome.errorMessage,
        };
      }

      const updated =
        this.actionRepo.markSucceeded(action.id, attemptId, outcome.result) ??
        action;
      if (outcome.delegationOutcome) {
        const engine = new OutreachEngine(
          this.db,
          this.userDataManager,
          this.userId,
        );
        await engine.syncDelegationResultToSession(
          updated,
          outcome.delegationOutcome,
        );
      }
      if (updated.threadId) {
        this.threadService.refreshThreadDocument(updated.threadId);
      }
      return {
        actionId: updated.id,
        actionType: updated.actionType,
        queueStatus: updated.queueStatus,
        result: outcome.result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated =
        this.actionRepo.markFailed(
          action.id,
          attemptId,
          message,
          action.retryCount >= 2,
        ) ?? action;
      if (updated.threadId) {
        this.threadService.refreshThreadDocument(updated.threadId);
      }
      return {
        actionId: updated.id,
        actionType: updated.actionType,
        queueStatus: updated.queueStatus,
        error: message,
      };
    }
  }

  private async dispatch(action: QueuedActionRecord): Promise<DispatchOutcome> {
    if (action.actionType === 'notify_user') {
      return { result: await this.notifyUser(action) };
    }
    if (action.actionType === 'create_confirm_request') {
      return { result: await this.createConfirmRequest(action) };
    }
    if (action.actionType === 'update_truth_property') {
      return { result: await this.updateTruthProperty(action) };
    }
    if (isAgentDelegateActionType(action.actionType)) {
      return this.delegateAgent(action);
    }
    if (action.actionType === 'query_external_tool') {
      return { result: await this.queryExternalTool(action) };
    }
    if (action.actionType === 'ask_external_user') {
      return { result: await this.askExternalUser(action) };
    }

    throw new Error(`Unsupported action type: ${action.actionType}`);
  }

  private async notifyUser(
    action: QueuedActionRecord,
  ): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const notificationId = randomUUID();
    const currentTime = now();

    this.db
      .prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, topic_id, related_entity_id, utility_score, sent_at, created_at)
         VALUES (?, 'reflection_action', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notificationId,
        action.actionType,
        String(params.title ?? action.title),
        String(params.body ?? action.description ?? ''),
        JSON.stringify(params.payload ?? { actionId: action.id }),
        String(
          (params.payload as Record<string, unknown> | undefined)?.threadId ??
            action.threadId ??
            action.id,
        ),
        typeof params.relatedEntityId === 'string'
          ? params.relatedEntityId
          : null,
        action.utilityScore ?? null,
        currentTime,
        currentTime,
      );

    return {
      notificationId,
      botPushed: false,
    };
  }

  private async createConfirmRequest(
    action: QueuedActionRecord,
  ): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const currentTime = now();
    const priorityLabel = normalizePriorityLabel(
      params.priority,
      action.priority,
    );
    const fallbackSourceAnchor =
      typeof params.sourceAnchor === 'string' &&
      params.sourceAnchor.trim().length > 0
        ? params.sourceAnchor.trim()
        : action.sourceKind === 'ask_request' && action.sourceRefId
          ? `ask:${action.sourceRefId}`
          : action.sourceKind === 'outreach_session' && action.sourceRefId
            ? `outreach:${action.sourceRefId}`
            : action.threadId
              ? `thread:${action.threadId}`
              : null;
    const confirmRequestInput = {
      id:
        typeof params.confirmRequestId === 'string'
          ? params.confirmRequestId
          : undefined,
      question: String(params.question ?? action.title),
      context:
        typeof params.context === 'string'
          ? params.context
          : (action.description ?? null),
      options: Array.isArray(params.options)
        ? (params.options as Array<{ label: string; value: string }>)
        : [],
      evidenceRefs: uniqStrings([
        ...action.evidenceRefs,
        ...(Array.isArray(params.evidenceRefs)
          ? params.evidenceRefs.filter(
              (item): item is string => typeof item === 'string',
            )
          : []),
      ]),
      category:
        typeof params.category === 'string' ? params.category : 'reflection',
      relatedEntityId:
        typeof params.relatedEntityId === 'string'
          ? params.relatedEntityId
          : null,
      relatedPropertyId:
        typeof params.relatedPropertyId === 'number'
          ? params.relatedPropertyId
          : null,
      priority: priorityLabel,
      routing: (params.routing === 'watch' ? 'watch' : 'decision') as
        | 'watch'
        | 'decision',
      reasonCode:
        typeof params.reasonCode === 'string' ? params.reasonCode : null,
      sourceAnchor: fallbackSourceAnchor,
      gapType: typeof params.gapType === 'string' ? params.gapType : null,
      createdAt: currentTime,
    };
    const reusedFromThread = action.threadId
      ? this.confirmRequestRepo.reusePendingForOriginThread(
          action.threadId,
          confirmRequestInput,
        )
      : null;
    const { record: confirmRequest, created } = reusedFromThread
      ? { record: reusedFromThread, created: false }
      : this.confirmRequestRepo.createOrReusePending(confirmRequestInput);
    const confirmRequestId = confirmRequest.id;
    const evidenceWatchContractId =
      typeof params.evidenceWatchContractId === 'string' &&
      params.evidenceWatchContractId.trim().length > 0
        ? params.evidenceWatchContractId.trim()
        : undefined;
    if (evidenceWatchContractId) {
      new EvidenceWatchContractService(this.db).linkConfirmRequest(
        evidenceWatchContractId,
        confirmRequestId,
      );
    }

    let alertActionId: string | undefined;
    if (
      created &&
      priorityLabel === 'high' &&
      confirmRequest.routing !== 'watch'
    ) {
      const notifyAction = this.actionRepo.create({
        actionType: 'notify_user',
        title: `待确认: ${String(params.question ?? action.title)}`,
        description:
          typeof params.context === 'string' && params.context.trim().length > 0
            ? params.context.trim()
            : (action.description ?? '有一个高优先级待确认项需要你处理。'),
        params: {
          title: `需要确认: ${String(params.question ?? action.title)}`,
          body:
            typeof params.context === 'string' &&
            params.context.trim().length > 0
              ? params.context.trim()
              : (action.description ?? '请在决策中心查看并处理该确认请求。'),
          payload: {
            confirmRequestId,
            threadId: action.threadId,
            actionId: action.id,
          },
          botPush: true,
        },
        requiresApproval: false,
        executionMode: 'auto',
        priority: Math.max(8, action.priority),
        threadId: action.threadId,
        runId: action.runId,
        sourceKind: 'confirm_request_alert',
        sourceRefId: confirmRequestId,
        queueStatus: 'queued',
        confidence: action.confidence,
        utilityScore: action.utilityScore,
        urgencyScore: Math.max(action.urgencyScore ?? 0.8, 0.8),
      });
      alertActionId = notifyAction.id;
      await this.executeAction(notifyAction.id);
    }

    if (action.threadId && confirmRequest.routing !== 'watch') {
      this.threadService.markThreadWaitingForConfirmRequest(action.threadId);
    }

    return {
      confirmRequestId,
      reusedExisting: !created,
      ...(alertActionId ? { alertActionId } : {}),
    };
  }

  private async updateTruthProperty(
    action: QueuedActionRecord,
  ): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const truthMaintainer = new TruthMaintainer(this.db);
    await truthMaintainer.processPropertyChange(
      params as unknown as PropertyChange,
    );
    return { updated: true };
  }

  private resolveExecutorForAction(
    action: QueuedActionRecord,
    params: Record<string, unknown>,
  ): AgentExecutorInstance | null {
    const config = getUserRuntimeConfig(this.userDataManager);
    const metadata =
      params.metadata &&
      typeof params.metadata === 'object' &&
      !Array.isArray(params.metadata)
        ? (params.metadata as Record<string, unknown>)
        : {};
    const requested =
      (typeof params.executor === 'string' && params.executor.trim()) ||
      (typeof metadata.executor === 'string' && metadata.executor.trim()) ||
      (typeof metadata.executorId === 'string' && metadata.executorId.trim()) ||
      undefined;

    if (requested) {
      return findEnabledExecutor(config, requested);
    }

    // Legacy action type without an explicit executor id.
    if (action.actionType === 'delegate_openclaw') {
      return findEnabledExecutor(config, 'openclaw');
    }

    const defaults = resolveExecutorDefaults(config);
    return findEnabledExecutor(config, defaults.agent_task);
  }

  private async delegateAgent(
    action: QueuedActionRecord,
  ): Promise<DispatchOutcome> {
    const params = safeJsonValue(action.params);
    const mode = params.mode === 'write' ? 'write' : 'read';
    if (action.requiresApproval && action.executionMode === 'auto') {
      return {
        result: {
          status: 'error',
          summary: '需要审批的 Agent 委派动作不能以自动模式执行。',
          payload: {
            mode,
            executionMode: action.executionMode,
            requiresApproval: action.requiresApproval,
          },
        },
        queueStatus: 'failed',
        errorMessage: '需要审批的 Agent 委派动作不能以自动模式执行。',
      };
    }

    const executorInstance = this.resolveExecutorForAction(action, params);
    if (!executorInstance) {
      return {
        result: {
          status: 'capability_missing',
          summary: '未找到已启用的 Agent 执行器，请在 Options → Agent 执行器 中配置。',
          payload: { configured: false },
        },
        queueStatus: 'failed',
        errorMessage:
          '未找到已启用的 Agent 执行器，请在 Options → Agent 执行器 中配置。',
      };
    }

    if (
      executorInstance.type !== 'openclaw-responses' &&
      executorInstance.type !== 'openclaw-gateway' &&
      executorInstance.type !== 'acp-codex' &&
      executorInstance.type !== 'acp-claude-code'
    ) {
      return {
        result: {
          status: 'capability_missing',
          summary: `执行器类型「${executorInstance.type}」尚未接入。`,
          payload: {
            executorId: executorInstance.id,
            executorType: executorInstance.type,
          },
        },
        queueStatus: 'failed',
        errorMessage: `执行器类型「${executorInstance.type}」尚未接入。`,
      };
    }

    const executor =
      executorInstance.type === 'openclaw-gateway'
        ? new OpenClawGatewayExecutor(executorInstance, {
            defaultTimeoutMs: getUserRuntimeConfig(this.userDataManager)
              .openClawTimeoutMs,
            onProgress: async (patch) => {
              this.actionRepo.patchRunningResult(action.id, patch);
            },
          })
        : executorInstance.type === 'acp-codex' ||
            executorInstance.type === 'acp-claude-code'
          ? new AcpExecutor(executorInstance, {
              userId: this.userId ?? 'default',
              defaultTimeoutMs: getUserRuntimeConfig(this.userDataManager)
                .openClawTimeoutMs,
            })
          : new OpenClawResponsesExecutor(
              this.delegationService,
              executorInstance,
            );
    const envelope = await executor.submit({
      task:
        typeof params.task === 'string' && params.task.trim().length > 0
          ? params.task.trim()
          : [action.title, action.description].filter(Boolean).join('\n\n'),
      mode,
      targetSystem:
        typeof params.targetSystem === 'string' &&
        params.targetSystem.trim().length > 0
          ? params.targetSystem.trim()
          : undefined,
      threadId: action.threadId ?? String(params.threadId ?? action.id),
      runId: action.runId,
      actionId: action.id,
      sessionKey: this.buildSessionKey(action, params),
      agentId:
        typeof params.agentId === 'string' && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : undefined,
      timeoutMs:
        typeof params.timeoutMs === 'number' && Number.isFinite(params.timeoutMs)
          ? Math.max(1000, Math.floor(params.timeoutMs))
          : undefined,
      metadata:
        params.metadata &&
        typeof params.metadata === 'object' &&
        !Array.isArray(params.metadata)
          ? {
              ...(params.metadata as Record<string, unknown>),
              executorId: executorInstance.id,
              executorType: executorInstance.type,
            }
          : {
              executorId: executorInstance.id,
              executorType: executorInstance.type,
            },
    });

    if (envelope.status === 'running' || envelope.status === 'input_required') {
      this.actionRepo.patchRunningResult(action.id, {
        status: envelope.status,
        summary: envelope.summary,
        remoteRunId: envelope.remoteRunId,
        eventCursor: envelope.eventCursor,
        sessionKey: envelope.sessionKey,
        payload: envelope.payload,
        executorId: executorInstance.id,
        executorType: executorInstance.type,
      });
      return {
        result: {
          status: envelope.status,
          summary: envelope.summary,
          remoteRunId: envelope.remoteRunId,
          eventCursor: envelope.eventCursor,
          sessionKey: envelope.sessionKey,
          payload: envelope.payload,
        },
        queueStatus: envelope.status,
      };
    }

    const outcome: DelegationOutcome = {
      status:
        envelope.status === 'succeeded'
          ? 'success'
          : envelope.status === 'capability_missing'
            ? 'capability_missing'
            : envelope.status === 'auth_error'
              ? 'auth_error'
              : envelope.status === 'need_human_decision'
                ? 'need_human_decision'
                : 'error',
      summary: envelope.summary,
      artifacts: envelope.artifacts || [],
      transcriptPath: envelope.transcriptPath,
      payload: {
        ...(envelope.payload || {}),
        executorId: executorInstance.id,
        executorType: executorInstance.type,
        remoteRunId: envelope.remoteRunId,
        eventCursor: envelope.eventCursor,
        sessionKey: envelope.sessionKey,
      },
    };
    this.actionReadinessService.recordDelegationOutcome(action, outcome);

    if (outcome.status === 'success') {
      await this.recordDelegationSuccess(action, outcome);
      return {
        result: {
          status: outcome.status,
          summary: outcome.summary,
          artifacts: outcome.artifacts,
          transcriptPath: outcome.transcriptPath,
          payload: outcome.payload,
        },
        delegationOutcome: outcome,
      };
    }

    if (
      outcome.status === 'capability_missing' ||
      outcome.status === 'auth_error'
    ) {
      const followUpActionIds = await this.enqueueDelegationRecovery(
        action,
        outcome,
      );
      const improvementActionId =
        await this.enqueueMessageRuleImprovementRequest(action, outcome);
      const allFollowUpActionIds = [
        ...followUpActionIds,
        ...(improvementActionId ? [improvementActionId] : []),
      ];
      return {
        result: {
          status: outcome.status,
          summary: outcome.summary,
          followUpActionIds: allFollowUpActionIds,
          followUpActions: this.getFollowUpActionSummaries(
            allFollowUpActionIds,
          ),
          transcriptPath: outcome.transcriptPath,
          payload: outcome.payload,
        },
        delegationOutcome: outcome,
        queueStatus: 'failed',
        errorMessage: outcome.summary,
      };
    }

    if (outcome.status === 'need_human_decision') {
      const confirmActionId = await this.enqueueHumanDecisionRequest(
        action,
        outcome,
      );
      const improvementActionId =
        await this.enqueueMessageRuleImprovementRequest(action, outcome);
      const allFollowUpActionIds = [
        ...(confirmActionId ? [confirmActionId] : []),
        ...(improvementActionId ? [improvementActionId] : []),
      ];
      return {
        result: {
          status: outcome.status,
          summary: outcome.summary,
          followUpActionIds: allFollowUpActionIds,
          followUpActions: this.getFollowUpActionSummaries(
            allFollowUpActionIds,
          ),
          transcriptPath: outcome.transcriptPath,
          payload: outcome.payload,
        },
        delegationOutcome: outcome,
        queueStatus: 'failed',
        errorMessage: outcome.summary,
      };
    }

    const improvementActionId =
      await this.enqueueMessageRuleImprovementRequest(action, outcome);
    const followUpActionIds = improvementActionId ? [improvementActionId] : [];
    return {
      result: {
        status: outcome.status,
        summary: outcome.summary,
        ...(followUpActionIds.length > 0
          ? {
              followUpActionIds,
              followUpActions: this.getFollowUpActionSummaries(
                followUpActionIds,
              ),
            }
          : {}),
        transcriptPath: outcome.transcriptPath,
        payload: outcome.payload,
      },
      delegationOutcome: outcome,
      queueStatus: action.retryCount >= 2 ? 'dead_letter' : 'failed',
      errorMessage: outcome.summary,
    };
  }

  private getFollowUpActionSummaries(ids: string[]): FollowUpActionSummary[] {
    return ids
      .map((id) => this.actionRepo.getById(id))
      .filter((item): item is QueuedActionRecord => Boolean(item))
      .map((item) => ({
        id: item.id,
        actionType: item.actionType,
        title: item.title,
        queueStatus: item.queueStatus,
        ...(item.sourceKind ? { sourceKind: item.sourceKind } : {}),
        ...(item.sourceRefId ? { sourceRefId: item.sourceRefId } : {}),
      }));
  }

  private async recordDelegationSuccess(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Promise<void> {
    if (!action.threadId) return;

    const record = this.actionResultRepo.create({
      actionId: action.id,
      threadId: action.threadId,
      runId: action.runId,
      resultType: outcome.status,
      summary: outcome.summary,
      payload: {
        artifacts: outcome.artifacts,
        ...(outcome.payload ?? {}),
      },
      transcriptPath: outcome.transcriptPath,
    });
    this.threadService.recordActionResult(record);

    const detail = this.threadService.getThreadDetail(action.threadId);
    if (
      detail?.thread.status === 'active' &&
      getUserRuntimeConfig(this.userDataManager).reflectionEnabled
    ) {
      await this.threadService.runReflection(action.threadId, {
        runType: 'action_result_followup',
        triggerType: 'action_result',
        force: false,
      });
    }
  }

  private async enqueueDelegationRecovery(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Promise<string[]> {
    const followUps: string[] = [];
    const actionMetadata =
      action.params.metadata &&
      typeof action.params.metadata === 'object' &&
      !Array.isArray(action.params.metadata)
        ? (action.params.metadata as Record<string, unknown>)
        : {};
    const suppressRecoveryNotifications =
      actionMetadata.suppressRecoveryNotifications === true;

    if (!suppressRecoveryNotifications) {
      const notifyAction = this.actionRepo.create({
        actionType: 'notify_user',
        title:
          outcome.status === 'auth_error'
            ? `外部委派鉴权失败: ${action.title}`
            : `外部委派缺少能力: ${action.title}`,
        description: outcome.summary,
        params: {
          title:
            outcome.status === 'auth_error'
              ? `OpenClaw 鉴权失败: ${action.title}`
              : `OpenClaw 缺少能力: ${action.title}`,
          body: outcome.summary,
          payload: {
            actionId: action.id,
            threadId: action.threadId,
            outcome: outcome.status,
          },
          botPush: true,
        },
        requiresApproval: false,
        executionMode: 'auto',
        priority: Math.max(8, action.priority),
        threadId: action.threadId,
        runId: action.runId,
        sourceKind: 'delegation_recovery',
        sourceRefId: action.id,
        queueStatus: 'queued',
        confidence: action.confidence,
        utilityScore: action.utilityScore,
        urgencyScore: 1,
      });
      followUps.push(notifyAction.id);
    }

    const confirmAction = this.actionRepo.create({
      actionType: 'create_confirm_request',
      title: `需要处理 OpenClaw 配置后重试: ${action.title}`,
      description: outcome.summary,
      params: {
        question:
          outcome.status === 'auth_error'
            ? `OpenClaw 鉴权失败。配置或授权修复后，是否重试「${action.title}」？`
            : `OpenClaw 当前缺少能力。配置完成后，是否重试「${action.title}」？`,
        context: outcome.summary,
        options: [
          { label: '配置好了，请重试', value: 'retry' },
          { label: '暂时跳过', value: 'skip_once' },
          { label: '不再查询', value: 'stop' },
        ],
        category: 'openclaw_delegation',
        priority: 'high',
        evidenceRefs: [`action:${action.id}`],
      },
      requiresApproval: false,
      executionMode: 'auto',
      priority: Math.max(8, action.priority),
      threadId: action.threadId,
      runId: action.runId,
      sourceKind: 'delegation_recovery',
      sourceRefId: action.id,
      queueStatus: 'queued',
      confidence: action.confidence,
      utilityScore: action.utilityScore,
      urgencyScore: 1,
    });
    followUps.push(confirmAction.id);

    for (const id of followUps) {
      await this.executeAction(id);
    }

    return followUps;
  }

  private async enqueueHumanDecisionRequest(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Promise<string | undefined> {
    const payload = safeJsonValue(outcome.payload);
    const options = Array.isArray(payload.options)
      ? payload.options
          .filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object',
          )
          .map((item) => ({
            label:
              typeof item.label === 'string'
                ? item.label
                : String(item.value ?? 'option'),
            value:
              typeof item.value === 'string'
                ? item.value
                : String(item.label ?? 'option'),
          }))
      : [
          { label: '继续', value: 'continue' },
          { label: '取消', value: 'cancel' },
        ];

    const confirmAction = this.actionRepo.create({
      actionType: 'create_confirm_request',
      title: `需要人工判断: ${action.title}`,
      description: outcome.summary,
      params: {
        question:
          typeof payload.question === 'string' &&
          payload.question.trim().length > 0
            ? payload.question.trim()
            : `处理「${action.title}」前需要你的判断。`,
        context: outcome.summary,
        options,
        category: 'openclaw_delegation',
        priority: action.priority >= 8 ? 'high' : 'normal',
        evidenceRefs: [`action:${action.id}`],
      },
      requiresApproval: false,
      executionMode: 'auto',
      priority: Math.max(7, action.priority),
      threadId: action.threadId,
      runId: action.runId,
      sourceKind: 'delegation_recovery',
      sourceRefId: action.id,
      queueStatus: 'queued',
      confidence: action.confidence,
      utilityScore: action.utilityScore,
      urgencyScore: action.urgencyScore,
    });

    await this.executeAction(confirmAction.id);
    return confirmAction.id;
  }

  private async enqueueMessageRuleImprovementRequest(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): Promise<string | undefined> {
    if (action.sourceKind !== 'message_rule') {
      const metadata =
        action.params.metadata &&
        typeof action.params.metadata === 'object' &&
        !Array.isArray(action.params.metadata)
          ? (action.params.metadata as Record<string, unknown>)
          : {};
      if (typeof metadata.ruleRef !== 'string' || !metadata.ruleRef.trim()) {
        return undefined;
      }
    }

    const context =
      buildMessageRuleImprovementContextFromDelegationOutcome(action, outcome);
    if (!context) {
      return undefined;
    }

    const confirmAction = this.actionRepo.create({
      actionType: 'create_confirm_request',
      title: `建议改进记忆入口规则: ${context.ruleRef}`,
      description: context.summary,
      params: {
        question: `这条记忆入口规则的联动操作可能需要改写，是否打开规则应用建议？`,
        context: JSON.stringify(context),
        options: [{ label: '忽略建议', value: 'dismissed' }],
        category: 'message_rule_improvement',
        priority: 'normal',
        reasonCode: 'action_result_improvement',
        sourceAnchor: `message_rule:${context.ruleRef}`,
        gapType: 'linked_action_prompt_improvement',
        evidenceRefs: [
          `action:${action.id}`,
          `message_rule:${context.ruleRef}`,
        ],
      },
      requiresApproval: false,
      executionMode: 'auto',
      priority: Math.max(6, action.priority),
      threadId: action.threadId,
      runId: action.runId,
      sourceKind: 'message_rule_improvement',
      sourceRefId: context.ruleRef,
      queueStatus: 'queued',
      confidence: action.confidence,
      utilityScore: action.utilityScore,
      urgencyScore: action.urgencyScore,
    });

    await this.executeAction(confirmAction.id);
    return confirmAction.id;
  }

  private async queryExternalTool(
    action: QueuedActionRecord,
  ): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const rawQuery = safeJsonValue(params.query);
    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        query[key] = value;
      }
    }
    const result = await this.openClaw.request({
      path: typeof params.path === 'string' ? params.path : '',
      method: typeof params.method === 'string' ? params.method : 'POST',
      query,
      body: params.body,
    });

    return {
      status: result.status,
      ok: result.ok,
      data: result.data,
      text: result.text,
    };
  }

  private async askExternalUser(
    action: QueuedActionRecord,
  ): Promise<Record<string, unknown>> {
    const intent = normalizeOutreachIntent(action);
    if (isSelfDirectedOutreach(intent.targetType, intent.targetRef)) {
      return this.createOutreachFallbackConfirmRequest(
        action,
        'self_target',
        intent,
      );
    }

    const runtime = getUserRuntimeConfig(this.userDataManager);
    if (!runtime.outreachEnabled) {
      return this.createOutreachFallbackConfirmRequest(
        action,
        'disabled',
        intent,
      );
    }

    const ringCentralReady =
      Boolean(runtime.ringCentralServerUrl?.trim()) &&
      Boolean(runtime.ringCentralClientId?.trim()) &&
      Boolean(runtime.ringCentralClientSecret) &&
      Boolean(runtime.ringCentralJwt);
    if (!ringCentralReady) {
      return this.createOutreachFallbackConfirmRequest(
        action,
        'missing_config',
        intent,
      );
    }

    const engine = new OutreachEngine(
      this.db,
      this.userDataManager,
      this.userId,
    );
    const session = await engine.createSessionFromAction({ action });

    if (action.threadId) {
      this.threadService.markThreadWaitingForOutreach(action.threadId);
    }

    return {
      status: 'session_created',
      summary: `Outreach session ${session.id} created with status ${session.status}`,
      outreachSessionId: session.id,
      sessionId: session.id,
      sessionStatus: session.status,
      requiresApproval: session.requiresApproval,
      targetType: session.targetType,
      targetRef: session.targetRef,
    };
  }

  private async createOutreachFallbackConfirmRequest(
    action: QueuedActionRecord,
    reason: 'disabled' | 'missing_config' | 'self_target',
    intent = normalizeOutreachIntent(action),
  ): Promise<Record<string, unknown>> {
    const { targetType, targetRef, question } = intent;

    const prompt =
      reason === 'self_target'
        ? '这条询问的目标是你自己，不会进入主动询问引擎。是否改为由你手动处理，或转入决策中心继续判断？'
        : reason === 'disabled'
          ? `主动询问引擎尚未开启：是否先去 Options 开启后，再向 ${targetRef} 发起询问？`
          : `主动询问依赖的 RingCentral 配置未完成：是否先去 Options 补齐配置后，再向 ${targetRef} 发起询问？`;
    const context =
      `原计划目标：${targetType} / ${targetRef}\n` +
      `原计划问题：${question}\n` +
      (reason === 'self_target'
        ? '因为目标实际上是当前用户，这条动作不会创建主动询问会话，而会回到决策中心等待你的决定。'
        : '当前动作不会创建主动询问会话，改为进入决策中心等待你的选择。');

    const confirmResult = await this.createConfirmRequest({
      ...action,
      actionType: 'create_confirm_request',
      title: prompt,
      description: context,
      params: {
        question: prompt,
        context,
        category:
          reason === 'self_target'
            ? 'outreach_target_review'
            : 'outreach_setup',
        priority: 'high',
        options:
          reason === 'self_target'
            ? [
                { label: '我手动处理', value: 'handle_manually' },
                {
                  label: '放入决策中心继续判断',
                  value: 'review_in_decision_center',
                },
                { label: '忽略这次询问', value: 'skip' },
              ]
            : [
                { label: '去 Options 配置', value: 'configure_outreach' },
                { label: '我手动处理', value: 'handle_manually' },
                { label: '忽略这次询问', value: 'skip' },
              ],
        evidenceRefs: uniqStrings([
          ...action.evidenceRefs,
          action.threadId ? `reflection_thread:${action.threadId}` : null,
          `outreach_target:${targetType}:${targetRef}`,
        ]),
      },
    } as QueuedActionRecord);

    return {
      status: 'blocked',
      blockReason: reason,
      summary:
        reason === 'self_target'
          ? 'Self-directed ask converted into confirm request instead of outreach session'
          : reason === 'disabled'
            ? 'Outreach engine disabled; created confirm request instead of session'
            : 'RingCentral config missing; created confirm request instead of session',
      confirmRequestId: confirmResult.confirmRequestId,
      targetType,
      targetRef,
      question,
    };
  }

  private buildSessionKey(
    action: QueuedActionRecord,
    params: Record<string, unknown>,
  ): string {
    if (
      typeof params.sessionKey === 'string' &&
      params.sessionKey.trim().length > 0
    ) {
      return params.sessionKey.trim();
    }
    return `reflection-thread:${action.threadId ?? action.id}`;
  }
}
