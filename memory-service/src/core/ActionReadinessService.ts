import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import {
  OpenClawDelegationService,
  type DelegationOutcome,
} from '../integrations/OpenClawDelegationService.js';
import { resolveAgentExecutors } from '../integrations/executors/executorRegistry.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { now } from '../utils/time.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';

const READY_TTL_SECONDS = 6 * 60 * 60;
const DEGRADED_TTL_SECONDS = 15 * 60;
/** Single-task proof failure should not permanently block the whole scope. */
const PROOF_FAIL_TTL_SECONDS = 5 * 60;

export type ActionReadinessStatus =
  | 'ready'
  | 'unknown'
  | 'blocked_auth'
  | 'blocked_capability'
  | 'blocked_input'
  | 'blocked_proof'
  | 'degraded'
  | 'expired';

export type ActionReadinessDecision =
  | 'allow'
  | 'allow_manual_only'
  | 'probe_first'
  | 'block';

export type ActionReadinessLinkReason =
  | 'blocked_by_readiness'
  | 'depends_on_readiness'
  | 'proved_by_action_result';

export interface ActionReadinessContract {
  id: string;
  scopeKey: string;
  actionFamily: string;
  targetSystem?: string;
  capability?: string;
  status: ActionReadinessStatus;
  statusReason?: string;
  requiredInputs: string[];
  requiredApprovals: string[];
  proofRequirements: string[];
  lastProbeAt?: number;
  lastProbeResult?: Record<string, unknown>;
  expiresAt?: number;
  blockedSince?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ActionReadinessReceipt {
  contractId: string;
  scopeKey: string;
  status: ActionReadinessStatus;
  checkedAt: number;
  expiresAt?: number;
  reason?: string;
  affectedActionCount: number;
  requiredInputs: string[];
  requiredApprovals: string[];
  proofRequirements: string[];
  dispatchState: 'not_dispatched' | 'dispatched';
  doesNotProve: string[];
}

export interface ActionReadinessCheckResult {
  decision: ActionReadinessDecision;
  receipt: ActionReadinessReceipt;
  linksToCreate: Array<{
    sourceKind: string;
    sourceRefId: string;
    linkReason: ActionReadinessLinkReason;
  }>;
}

export interface ActionReadinessSummary {
  status: 'ready' | 'attention' | 'blocked';
  title: string;
  detail: string;
  trackedActionCount: number;
  affectedActionCount: number;
  blockedContractCount: number;
  degradedContractCount: number;
  unknownActionCount: number;
  contracts: ActionReadinessReceipt[];
  boundary: string;
  readAt: number;
  readOnly: true;
}

export interface ActionReadinessProbeResponse {
  decision: ActionReadinessDecision;
  receipt: ActionReadinessReceipt;
  probeReceipt: {
    probeOnly: true;
    originalActionExecuted: false;
    checkedAt: number;
    status: ActionReadinessStatus;
    summary: string;
    boundary: string;
  };
}

export interface ActionReadinessCandidate {
  id?: string;
  actionType: string;
  title?: string;
  description?: string;
  params?: Record<string, unknown>;
  executionMode?: 'manual' | 'auto';
  requiresApproval?: boolean;
  sourceKind?: string;
  sourceRefId?: string;
  /** Legacy/worker source tag (e.g. reflection_worker). */
  source?: string;
  threadId?: string;
  runId?: string;
  queueStatus?: string;
  retryCount?: number;
  result?: Record<string, unknown>;
}

interface ActionReadinessCheckOptions {
  persistStaticBlock?: boolean;
}

interface ReadinessScope {
  scopeKey: string;
  actionFamily: string;
  targetSystem?: string;
  capability: string;
  mode: 'read' | 'write';
}

interface ContractRow {
  id: string;
  scope_key: string;
  action_family: string;
  target_system: string | null;
  capability: string | null;
  status: ActionReadinessStatus;
  status_reason: string | null;
  required_inputs_json: string;
  required_approvals_json: string;
  proof_requirements_json: string;
  last_probe_at: number | null;
  last_probe_result_json: string | null;
  expires_at: number | null;
  blocked_since: number | null;
  created_at: number;
  updated_at: number;
}

interface UpsertContractInput extends ReadinessScope {
  status: ActionReadinessStatus;
  statusReason?: string;
  requiredInputs?: string[];
  requiredApprovals?: string[];
  proofRequirements?: string[];
  lastProbeAt?: number;
  lastProbeResult?: Record<string, unknown>;
  expiresAt?: number;
}

const BLOCKING_STATUSES = new Set<ActionReadinessStatus>([
  'blocked_auth',
  'blocked_capability',
  'blocked_input',
  'blocked_proof',
]);

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function uniqStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string =>
          Boolean(typeof value === 'string' && value.trim()),
        )
        .map((value) => value.trim()),
    ),
  );
}

function normalizeScopePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function getNestedValue(
  value: Record<string, unknown>,
  path: string,
): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

function isBlockingStatus(status: ActionReadinessStatus): boolean {
  return BLOCKING_STATUSES.has(status);
}

function isGenericAgentTask(action: ActionReadinessCandidate): boolean {
  const params = safeObject(action.params);
  const targetSystem =
    typeof params.targetSystem === 'string' && params.targetSystem.trim()
      ? normalizeScopePart(params.targetSystem)
      : undefined;
  return targetSystem === 'agent_task';
}

function outcomeSearchText(outcome: DelegationOutcome): string {
  const payload = safeObject(outcome.payload);
  return [
    outcome.summary,
    payload.error,
    payload.message,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function isGatewayUnreachable(outcome: DelegationOutcome): boolean {
  return /pairing required|device is not approved|ECONNREFUSED|ENOTFOUND|missing baseUrl|not configured|gateway 不可用|gateway unavailable/i.test(
    outcomeSearchText(outcome),
  );
}

/**
 * Generic agent_task prompts do not name a real connector. Only connection-layer
 * signals may update openclaw:global; tool/proof failures stay with the executor.
 */
function isConnectionLayerOutcome(
  action: ActionReadinessCandidate,
  outcome: DelegationOutcome,
  source: 'action_execution' | 'probe',
): boolean {
  if (!isGenericAgentTask(action)) return true;
  if (source === 'probe') return true;
  if (
    outcome.status === 'success' ||
    outcome.status === 'need_human_decision'
  ) {
    return true;
  }
  const payload = safeObject(outcome.payload);
  if (outcome.status === 'auth_error') {
    const httpStatus = Number(payload.httpStatus);
    return (
      httpStatus === 401 ||
      httpStatus === 403 ||
      isGatewayUnreachable(outcome)
    );
  }
  if (outcome.status === 'capability_missing') {
    return payload.configured === false || isGatewayUnreachable(outcome);
  }
  if (outcome.status === 'error') {
    return isGatewayUnreachable(outcome);
  }
  return false;
}

function statusReason(status: ActionReadinessStatus): string {
  switch (status) {
    case 'ready':
      return '最近一次 probe 或可验证 action 结果证明当前能力可用。';
    case 'blocked_auth':
      return 'OpenClaw 鉴权或目标权限未通过。';
    case 'blocked_capability':
      return 'OpenClaw 未配置，或当前目标 connector / tool 不可用。';
    case 'blocked_input':
      return '动作缺少执行前必填输入，尚未调用 OpenClaw。';
    case 'blocked_proof':
      return '执行器无法返回可验证 artifact，结果不能进入 action_results。';
    case 'degraded':
      return '最近一次连接或执行失败，自动动作需要先重测。';
    case 'expired':
      return '最近一次就绪证明已过期，自动动作需要先重测。';
    default:
      return '还没有近期就绪证明；首次执行结果会建立契约。';
  }
}

export function getActionReadinessScope(
  action: ActionReadinessCandidate,
): ReadinessScope | null {
  if (
    action.actionType !== 'delegate_openclaw' &&
    action.actionType !== 'delegate_agent'
  ) {
    return null;
  }
  const params = safeObject(action.params);
  const mode = params.mode === 'write' ? 'write' : 'read';
  const targetSystem =
    typeof params.targetSystem === 'string' && params.targetSystem.trim()
      ? normalizeScopePart(params.targetSystem)
      : undefined;

  if (!targetSystem) {
    return {
      scopeKey: mode === 'write' ? 'openclaw:unscoped:write' : 'openclaw:global',
      actionFamily: 'openclaw',
      capability: mode === 'write' ? 'unscoped:write' : 'gateway',
      mode,
    };
  }

  // Generic Agent Task prompts do not name a connector. triggerSource (jira_rule,
  // roadmap, …) is who queued the work, not which capability it needs — partitioning
  // on it made “open baidu” block unrelated Jira-triggered tasks. Keep only the
  // gateway connection gate; tool availability stays with the executor.
  if (targetSystem === 'agent_task') {
    return globalOpenClawScope();
  }

  return {
    scopeKey: `openclaw:${targetSystem}:${mode}`,
    actionFamily: 'openclaw',
    targetSystem,
    capability: mode,
    mode,
  };
}

function globalOpenClawScope(): ReadinessScope {
  return {
    scopeKey: 'openclaw:global',
    actionFamily: 'openclaw',
    capability: 'gateway',
    mode: 'read',
  };
}

export class ActionReadinessService {
  private readonly delegationService: OpenClawDelegationService;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.delegationService = new OpenClawDelegationService(
      userDataManager,
      userId,
    );
  }

  getByScopeKey(scopeKey: string): ActionReadinessContract | null {
    const row = this.db
      .prepare(
        'SELECT * FROM action_readiness_contracts WHERE scope_key = ?',
      )
      .get(scopeKey) as ContractRow | undefined;
    return row ? this.rowToContract(row) : null;
  }

  checkAction(
    action: ActionReadinessCandidate,
    options: ActionReadinessCheckOptions = {},
  ): ActionReadinessCheckResult {
    const scope = getActionReadinessScope(action);
    if (!scope) {
      throw new Error(
        `Action readiness does not support action type "${action.actionType}"`,
      );
    }

    const contract = this.resolveContract(
      action,
      scope,
      options.persistStaticBlock === true,
    );
    const effective = this.toEffectiveContract(contract);
    const decision = this.decisionFor(effective.status, action);
    const linkReason: ActionReadinessLinkReason =
      decision === 'block' ? 'blocked_by_readiness' : 'depends_on_readiness';
    const sourceKind = action.id
      ? 'proposed_action'
      : action.sourceKind ?? 'action_candidate';
    const sourceRefId = action.id ?? action.sourceRefId;

    return {
      decision,
      receipt: this.toReceipt(effective, action),
      linksToCreate: sourceRefId
        ? [{ sourceKind, sourceRefId, linkReason }]
        : [],
    };
  }

  async prepareActionForDispatch(
    action: QueuedActionRecord,
  ): Promise<ActionReadinessCheckResult> {
    const check = this.checkAction(action, { persistStaticBlock: true });
    if (check.decision === 'block') {
      this.linkCheck(check);
      return check;
    }

    if (check.decision === 'probe_first') {
      const probe = await this.probeAction(action);
      if (
        probe.decision !== 'allow' &&
        probe.decision !== 'allow_manual_only'
      ) {
        const blocked = this.checkAction(action, { persistStaticBlock: true });
        this.linkCheck(blocked);
        return {
          ...blocked,
          decision: 'block',
        };
      }
      return this.checkAction(action, { persistStaticBlock: true });
    }

    return check;
  }

  recordDelegationOutcome(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
  ): ActionReadinessReceipt {
    return this.applyDelegationOutcome(action, outcome, 'action_execution');
  }

  async probeAction(
    action: QueuedActionRecord,
  ): Promise<ActionReadinessProbeResponse> {
    const initial = this.checkAction(action, { persistStaticBlock: true });
    const config = getUserRuntimeConfig(this.userDataManager);
    const reflectionBlocked =
      this.isReflectionDelegationSource(action) && !config.openClawEnabled;
    const localConfigurationBlocked =
      reflectionBlocked || !config.openClawBaseUrl;
    if (
      localConfigurationBlocked ||
      initial.receipt.status === 'blocked_input'
    ) {
      this.linkCheck(initial);
      return {
        decision: 'block',
        receipt: initial.receipt,
        probeReceipt: {
          probeOnly: true,
          originalActionExecuted: false,
          checkedAt: now(),
          status: initial.receipt.status,
          summary: initial.receipt.reason ?? statusReason(initial.receipt.status),
          boundary:
            initial.receipt.status === 'blocked_input'
              ? '本次只检查必填输入；输入仍不完整，未调用 OpenClaw，也未提交原动作。'
              : reflectionBlocked
                ? '外部委派已关闭；本次未提交反思/联动原动作（Agent Task 不受此开关影响）。'
                : '本次只检查本地 OpenClaw 配置；未提交原动作，未读取或写入外部业务数据。',
        },
      };
    }

    const scope = getActionReadinessScope(action);
    if (!scope) {
      throw new Error('Only agent delegate actions support readiness probes');
    }

    const checkedAt = now();
    const targetLabel = scope.targetSystem ?? 'OpenClaw gateway';
    const outcome = await this.delegationService.delegate({
      task: [
        'Readiness probe only. Do not execute the original action and do not modify external data.',
        `Check whether the ${targetLabel} capability is reachable and authorized for a future ${scope.mode} action.`,
        'Capability metadata or a connector permission check is allowed; do not read business records beyond what is necessary for the capability check.',
        'On success, return one synthetic verifiable artifact with metadata.sourceSystem, metadata.entityKey="readiness-probe", metadata.verification, and metadata.observedFields=["connection","authorization","capability"].',
      ].join('\n'),
      mode: 'read',
      targetSystem: scope.targetSystem,
      threadId: action.threadId ?? action.id,
      runId: action.runId,
      actionId: `${action.id}:readiness-probe:${checkedAt}`,
      sessionKey: `readiness:${scope.scopeKey}:${this.userId ?? 'default'}`,
      metadata: {
        probeOnly: true,
        originalActionId: action.id,
        requestedMode: scope.mode,
        scopeKey: scope.scopeKey,
      },
    });

    const receipt = this.applyDelegationOutcome(action, outcome, 'probe');
    const refreshed = this.checkAction(action);
    const decision =
      refreshed.decision === 'probe_first' ? 'block' : refreshed.decision;
    if (decision === 'block') this.linkCheck(refreshed);

    return {
      decision,
      receipt,
      probeReceipt: {
        probeOnly: true,
        originalActionExecuted: false,
        checkedAt,
        status: receipt.status,
        summary: outcome.summary,
        boundary:
          '本次只重测连接、鉴权和 capability；未提交原动作，不代表 Jira、Drive 或其他外部写操作已经发生。',
      },
    };
  }

  linkSource(
    contractId: string,
    sourceKind: string,
    sourceRefId: string,
    linkReason: ActionReadinessLinkReason,
  ): void {
    const exists = this.db
      .prepare('SELECT id FROM action_readiness_contracts WHERE id = ?')
      .get(contractId) as { id: string } | undefined;
    if (!exists) return;

    this.db
      .prepare(
        `INSERT OR IGNORE INTO action_readiness_links
          (id, contract_id, source_kind, source_ref_id, link_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        contractId,
        sourceKind,
        sourceRefId,
        linkReason,
        now(),
      );
  }

  enrichActionList<T extends QueuedActionRecord>(input: {
    items: T[];
    total: number;
    limit: number;
    offset: number;
  }): {
    items: Array<T & { readinessReceipt?: ActionReadinessReceipt }>;
    readinessSummary: ActionReadinessSummary;
  } {
    const receipts: ActionReadinessReceipt[] = [];
    const items = input.items.map((action) => {
      if (
        action.actionType !== 'delegate_openclaw' &&
        action.actionType !== 'delegate_agent'
      ) {
        return action;
      }
      const readinessReceipt = this.checkAction(action).receipt;
      receipts.push(readinessReceipt);
      return { ...action, readinessReceipt };
    });

    return {
      items,
      readinessSummary: this.buildSummary(receipts),
    };
  }

  private resolveContract(
    action: ActionReadinessCandidate,
    scope: ReadinessScope,
    persistStaticBlock: boolean,
  ): ActionReadinessContract {
    const staticBlock = this.getStaticBlock(
      action,
      scope,
      persistStaticBlock,
    );
    if (staticBlock) return staticBlock;

    const globalContract = this.getByScopeKey('openclaw:global');
    if (globalContract) {
      const effectiveGlobal = this.toEffectiveContract(globalContract);
      if (
        scope.scopeKey === 'openclaw:global' ||
        isBlockingStatus(effectiveGlobal.status) ||
        effectiveGlobal.status === 'degraded' ||
        effectiveGlobal.status === 'expired'
      ) {
        return effectiveGlobal;
      }
    }

    const scopedContract = this.getByScopeKey(scope.scopeKey);
    if (scopedContract) return this.toEffectiveContract(scopedContract);

    const currentTime = now();
    return {
      id: `unpersisted:${scope.scopeKey}`,
      scopeKey: scope.scopeKey,
      actionFamily: scope.actionFamily,
      targetSystem: scope.targetSystem,
      capability: scope.capability,
      status: 'unknown',
      statusReason: statusReason('unknown'),
      requiredInputs: this.requiredInputs(action),
      requiredApprovals: this.requiredApprovals(action, scope),
      proofRequirements: this.proofRequirements(scope),
      createdAt: currentTime,
      updatedAt: currentTime,
    };
  }

  private isReflectionDelegationSource(
    action: ActionReadinessCandidate,
  ): boolean {
    const sourceKind = String(action.sourceKind || '');
    const source = String(action.source || '');
    return (
      sourceKind === 'reflection_thread' ||
      sourceKind === 'reflection_run' ||
      source === 'reflection_worker'
    );
  }

  private getStaticBlock(
    action: ActionReadinessCandidate,
    scope: ReadinessScope,
    persist: boolean,
  ): ActionReadinessContract | null {
    const config = getUserRuntimeConfig(this.userDataManager);

    // Master「外部委派」switch: only gates reflection/linkage, not Agent Task.
    if (this.isReflectionDelegationSource(action) && !config.openClawEnabled) {
      return this.materializeStaticContract({
        ...globalOpenClawScope(),
        status: 'blocked_capability',
        statusReason:
          '外部委派已关闭（反思查证 / 联动操作）；Agent Task 不受影响。',
        proofRequirements: this.proofRequirements(scope),
      }, persist);
    }

    const hasOpenClawConnection =
      Boolean(config.openClawBaseUrl) ||
      resolveAgentExecutors(config).some(
        (item) =>
          (item.type === 'openclaw-responses' ||
            item.type === 'openclaw-gateway') &&
          Boolean(item.baseUrl),
      );

    if (!hasOpenClawConnection) {
      return this.materializeStaticContract({
        ...globalOpenClawScope(),
        status: 'blocked_capability',
        statusReason: 'OpenClaw 缺少 base URL，原动作尚未提交。',
        proofRequirements: this.proofRequirements(scope),
      }, persist);
    }

    const missingInputs = this.missingRequiredInputs(action);
    if (missingInputs.length > 0) {
      return this.materializeStaticContract({
        ...scope,
        status: 'blocked_input',
        statusReason: `缺少必填输入：${missingInputs.join('、')}。`,
        requiredInputs: this.requiredInputs(action),
        requiredApprovals: this.requiredApprovals(action, scope),
        proofRequirements: this.proofRequirements(scope),
      }, persist);
    }

    return null;
  }

  private materializeStaticContract(
    input: UpsertContractInput,
    persist: boolean,
  ): ActionReadinessContract {
    if (persist) return this.upsertContract(input);
    const currentTime = now();
    return {
      id: `unpersisted:${input.scopeKey}`,
      scopeKey: input.scopeKey,
      actionFamily: input.actionFamily,
      targetSystem: input.targetSystem,
      capability: input.capability,
      status: input.status,
      statusReason: input.statusReason ?? statusReason(input.status),
      requiredInputs: uniqStrings(input.requiredInputs ?? []),
      requiredApprovals: uniqStrings(input.requiredApprovals ?? []),
      proofRequirements: uniqStrings(input.proofRequirements ?? []),
      lastProbeAt: input.lastProbeAt,
      lastProbeResult: input.lastProbeResult,
      expiresAt: input.expiresAt,
      blockedSince: isBlockingStatus(input.status) ? currentTime : undefined,
      createdAt: currentTime,
      updatedAt: currentTime,
    };
  }

  private decisionFor(
    status: ActionReadinessStatus,
    action: ActionReadinessCandidate,
  ): ActionReadinessDecision {
    if (isBlockingStatus(status)) return 'block';
    if (status === 'expired' || status === 'degraded') {
      return action.executionMode === 'auto'
        ? 'probe_first'
        : 'allow_manual_only';
    }
    if (status === 'unknown' && action.executionMode === 'manual') {
      return 'allow_manual_only';
    }
    return 'allow';
  }

  private applyDelegationOutcome(
    action: QueuedActionRecord,
    outcome: DelegationOutcome,
    source: 'action_execution' | 'probe',
  ): ActionReadinessReceipt {
    const scope = getActionReadinessScope(action);
    if (!scope) {
      throw new Error('Only agent delegate outcomes update readiness');
    }

    const payload = safeObject(outcome.payload);
    if (!isConnectionLayerOutcome(action, outcome, source)) {
      const current = this.resolveContract(action, scope, false);
      return this.toReceipt(this.toEffectiveContract(current), action);
    }

    const currentTime = now();
    const probeResult = {
      source,
      outcome: outcome.status,
      summary: outcome.summary,
      actionId: action.id,
      ...(typeof payload.httpStatus === 'number'
        ? { httpStatus: payload.httpStatus }
        : {}),
      ...(typeof payload.artifactValidation === 'string'
        ? { artifactValidation: payload.artifactValidation }
        : {}),
    };
    const update = (
      targetScope: ReadinessScope,
      status: ActionReadinessStatus,
      reason: string,
      expiresAt?: number,
    ) =>
      this.upsertContract({
        ...targetScope,
        status,
        statusReason: reason,
        requiredInputs: this.requiredInputs(action),
        requiredApprovals: this.requiredApprovals(action, scope),
        proofRequirements: this.proofRequirements(scope),
        lastProbeAt: currentTime,
        lastProbeResult: probeResult,
        expiresAt,
      });

    let contract: ActionReadinessContract;
    if (outcome.status === 'success') {
      if (scope.scopeKey !== 'openclaw:global') {
        update(
          globalOpenClawScope(),
          'ready',
          'OpenClaw gateway 连接和鉴权最近一次检查通过。',
          currentTime + READY_TTL_SECONDS,
        );
      }
      contract = update(
        scope,
        'ready',
        source === 'probe'
          ? 'probe 已通过；本次重测没有再次执行原动作。'
          : '最近一次 action 返回了可验证 artifact。',
        currentTime + READY_TTL_SECONDS,
      );
    } else if (outcome.status === 'auth_error') {
      const httpStatus = Number(payload.httpStatus);
      const targetScope =
        httpStatus === 401 || httpStatus === 403
          ? globalOpenClawScope()
          : scope;
      contract = update(targetScope, 'blocked_auth', outcome.summary);
    } else if (outcome.status === 'capability_missing') {
      if (payload.configured === false) {
        // True config gap — block the whole gateway until Options is fixed.
        contract = update(
          globalOpenClawScope(),
          'blocked_capability',
          outcome.summary,
        );
      } else if (source === 'action_execution') {
        // One task missing a tool (browser bridge, a Jira skill, …) must not
        // permanently freeze every sibling that shares this coarse scope.
        contract = update(
          scope,
          'degraded',
          `单次能力缺失（短时降级，不永久封锁同 scope）: ${outcome.summary}`,
          currentTime + PROOF_FAIL_TTL_SECONDS,
        );
      } else {
        contract = update(
          scope,
          'blocked_capability',
          outcome.summary,
          currentTime + DEGRADED_TTL_SECONDS,
        );
      }
    } else if (
      outcome.status === 'error' &&
      payload.artifactValidation === 'missing_verifiable_artifact'
    ) {
      // Fault #3: do not cascade blocked_proof across the whole scope.
      // Keep siblings dispatchable; short degraded TTL allows automatic probe recovery.
      contract = update(
        scope,
        'degraded',
        `单次 artifact 校验失败（不影响同 scope 其他任务）: ${outcome.summary}`,
        currentTime + PROOF_FAIL_TTL_SECONDS,
      );
    } else if (outcome.status === 'need_human_decision') {
      contract = update(
        scope,
        'ready',
        '能力可用，但原动作仍需独立的人工选择或审批。',
        currentTime + READY_TTL_SECONDS,
      );
    } else {
      contract = update(
        scope,
        'degraded',
        outcome.summary,
        currentTime + DEGRADED_TTL_SECONDS,
      );
    }

    this.linkSource(
      contract.id,
      'proposed_action',
      action.id,
      source === 'probe'
        ? 'depends_on_readiness'
        : 'proved_by_action_result',
    );
    if (isBlockingStatus(contract.status)) {
      this.linkSource(
        contract.id,
        'proposed_action',
        action.id,
        'blocked_by_readiness',
      );
    }
    return this.toReceipt(this.toEffectiveContract(contract), action);
  }

  private upsertContract(
    input: UpsertContractInput,
  ): ActionReadinessContract {
    const existing = this.getByScopeKey(input.scopeKey);
    const currentTime = now();
    const id = existing?.id ?? randomUUID();
    const blockedSince = isBlockingStatus(input.status)
      ? existing?.blockedSince ?? currentTime
      : undefined;
    const lastProbeAt = input.lastProbeAt ?? existing?.lastProbeAt;
    const lastProbeResult =
      input.lastProbeResult ?? existing?.lastProbeResult;

    this.db
      .prepare(
        `INSERT INTO action_readiness_contracts
          (id, scope_key, action_family, target_system, capability, status,
           status_reason, required_inputs_json, required_approvals_json,
           proof_requirements_json, last_probe_at, last_probe_result_json,
           expires_at, blocked_since, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope_key) DO UPDATE SET
           action_family = excluded.action_family,
           target_system = excluded.target_system,
           capability = excluded.capability,
           status = excluded.status,
           status_reason = excluded.status_reason,
           required_inputs_json = excluded.required_inputs_json,
           required_approvals_json = excluded.required_approvals_json,
           proof_requirements_json = excluded.proof_requirements_json,
           last_probe_at = excluded.last_probe_at,
           last_probe_result_json = excluded.last_probe_result_json,
           expires_at = excluded.expires_at,
           blocked_since = excluded.blocked_since,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.scopeKey,
        input.actionFamily,
        input.targetSystem ?? null,
        input.capability,
        input.status,
        input.statusReason ?? statusReason(input.status),
        JSON.stringify(uniqStrings(input.requiredInputs ?? existing?.requiredInputs ?? [])),
        JSON.stringify(
          uniqStrings(input.requiredApprovals ?? existing?.requiredApprovals ?? []),
        ),
        JSON.stringify(
          uniqStrings(input.proofRequirements ?? existing?.proofRequirements ?? []),
        ),
        lastProbeAt ?? null,
        lastProbeResult ? JSON.stringify(lastProbeResult) : null,
        input.expiresAt ?? null,
        blockedSince ?? null,
        existing?.createdAt ?? currentTime,
        currentTime,
      );

    return this.getByScopeKey(input.scopeKey)!;
  }

  private rowToContract(row: ContractRow): ActionReadinessContract {
    return {
      id: row.id,
      scopeKey: row.scope_key,
      actionFamily: row.action_family,
      targetSystem: row.target_system ?? undefined,
      capability: row.capability ?? undefined,
      status: row.status,
      statusReason: row.status_reason ?? undefined,
      requiredInputs: safeJsonParse<string[]>(row.required_inputs_json, []),
      requiredApprovals: safeJsonParse<string[]>(
        row.required_approvals_json,
        [],
      ),
      proofRequirements: safeJsonParse<string[]>(
        row.proof_requirements_json,
        [],
      ),
      lastProbeAt: row.last_probe_at ?? undefined,
      lastProbeResult: safeJsonParse<Record<string, unknown> | undefined>(
        row.last_probe_result_json,
        undefined,
      ),
      expiresAt: row.expires_at ?? undefined,
      blockedSince: row.blocked_since ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toEffectiveContract(
    contract: ActionReadinessContract,
  ): ActionReadinessContract {
    if (
      contract.expiresAt &&
      contract.expiresAt <= now() &&
      (contract.status === 'ready' ||
        contract.status === 'degraded' ||
        // Proof/capability failures use a short TTL so one bad run does not
        // permanently park the whole scope (see PROOF_FAIL_TTL_SECONDS).
        isBlockingStatus(contract.status))
    ) {
      return {
        ...contract,
        status: 'expired',
        statusReason: statusReason('expired'),
      };
    }
    return contract;
  }

  private toReceipt(
    contract: ActionReadinessContract,
    action: ActionReadinessCandidate,
  ): ActionReadinessReceipt {
    const affectedActionCount = this.countAffectedActions(contract.id);
    const dispatchState = this.actionWasDispatched(action, contract)
      ? 'dispatched'
      : 'not_dispatched';
    return {
      contractId: contract.id,
      scopeKey: contract.scopeKey,
      status: contract.status,
      checkedAt:
        contract.lastProbeAt ?? contract.updatedAt ?? contract.createdAt ?? now(),
      expiresAt: contract.expiresAt,
      reason: contract.statusReason ?? statusReason(contract.status),
      affectedActionCount: Math.max(
        affectedActionCount,
        action.id && isBlockingStatus(contract.status) ? 1 : 0,
      ),
      requiredInputs: contract.requiredInputs,
      requiredApprovals: contract.requiredApprovals,
      proofRequirements: contract.proofRequirements,
      dispatchState,
      doesNotProve:
        dispatchState === 'dispatched'
          ? [
              '不证明历史派发没有产生外部副作用',
              '不代表外部事实已经确认',
              '不代表旧失败或潜在副作用已经撤销',
            ]
          : [
              '不代表原动作已经执行',
              '不代表外部事实已经确认',
              '不代表旧失败或潜在副作用已经撤销',
            ],
    };
  }

  private actionWasDispatched(
    action: ActionReadinessCandidate,
    contract: ActionReadinessContract,
  ): boolean {
    if (
      action.id &&
      contract.lastProbeResult?.actionId === action.id &&
      contract.lastProbeResult?.source === 'action_execution'
    ) {
      return true;
    }
    if (action.queueStatus === 'running' || action.queueStatus === 'succeeded') {
      return true;
    }
    if ((action.retryCount ?? 0) > 0) return true;
    return Boolean(action.result && Object.keys(action.result).length > 0);
  }

  private countAffectedActions(contractId: string): number {
    if (contractId.startsWith('unpersisted:')) return 0;
    const row = this.db
      .prepare(
        `SELECT COUNT(DISTINCT links.source_ref_id) AS count
         FROM action_readiness_links links
         JOIN proposed_actions actions
           ON links.source_kind = 'proposed_action'
          AND actions.id = links.source_ref_id
         WHERE links.contract_id = ?
           AND links.link_reason = 'blocked_by_readiness'
           AND actions.queue_status IN ('queued', 'failed', 'dead_letter')`,
      )
      .get(contractId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  private requiredInputs(action: ActionReadinessCandidate): string[] {
    const params = safeObject(action.params);
    const metadata = safeObject(params.metadata);
    const explicit = [
      ...(Array.isArray(params.readinessRequiredInputs)
        ? params.readinessRequiredInputs
        : []),
      ...(Array.isArray(metadata.requiredInputs)
        ? metadata.requiredInputs
        : []),
    ];
    return uniqStrings(explicit);
  }

  private missingRequiredInputs(action: ActionReadinessCandidate): string[] {
    const params = safeObject(action.params);
    return this.requiredInputs(action).filter(
      (path) => !hasMeaningfulValue(getNestedValue(params, path)),
    );
  }

  private requiredApprovals(
    action: ActionReadinessCandidate,
    scope: ReadinessScope,
  ): string[] {
    if (scope.mode === 'write' && action.requiresApproval) {
      return ['human_approval'];
    }
    return [];
  }

  private proofRequirements(scope: ReadinessScope): string[] {
    return scope.mode === 'write'
      ? [
          'sourceSystem',
          'entityKey',
          'verification',
          'operation_or_changedFields',
        ]
      : [
          'sourceSystem',
          'entityKey',
          'verification',
          'observedFields',
        ];
  }

  private linkCheck(check: ActionReadinessCheckResult): void {
    for (const link of check.linksToCreate) {
      this.linkSource(
        check.receipt.contractId,
        link.sourceKind,
        link.sourceRefId,
        link.linkReason,
      );
    }
  }

  private buildSummary(
    receipts: ActionReadinessReceipt[],
  ): ActionReadinessSummary {
    const uniqueContracts = Array.from(
      new Map(receipts.map((receipt) => [receipt.scopeKey, receipt])).values(),
    );
    const blocked = uniqueContracts.filter((receipt) =>
      isBlockingStatus(receipt.status),
    );
    const degraded = uniqueContracts.filter(
      (receipt) =>
        receipt.status === 'degraded' || receipt.status === 'expired',
    );
    const unknownActionCount = receipts.filter(
      (receipt) => receipt.status === 'unknown',
    ).length;
    const visibleBlockedActionCount = receipts.filter((receipt) =>
      isBlockingStatus(receipt.status),
    ).length;
    const affectedActionCount = Math.max(
      visibleBlockedActionCount,
      ...blocked.map((receipt) => receipt.affectedActionCount),
      0,
    );

    if (blocked.length > 0) {
      return {
        status: 'blocked',
        title: 'OpenClaw 执行就绪受阻',
        detail: `${blocked.length} 个能力契约影响 ${affectedActionCount} 条动作；尚未派发的动作会停在计次前，已有失败记录仍需复核旧 attempt 与潜在外部副作用。`,
        trackedActionCount: receipts.length,
        affectedActionCount,
        blockedContractCount: blocked.length,
        degradedContractCount: degraded.length,
        unknownActionCount,
        contracts: uniqueContracts,
        boundary:
          '重测只检查连接、鉴权和 capability，不会执行原动作，也不会撤销旧失败或潜在外部副作用。',
        readAt: now(),
        readOnly: true,
      };
    }

    if (degraded.length > 0 || unknownActionCount > 0) {
      return {
        status: 'attention',
        title: '部分 OpenClaw 能力需要建立或刷新证明',
        detail: `${degraded.length} 个契约需要重测，${unknownActionCount} 条动作尚无近期就绪证明；手动动作仍保留独立审批边界。`,
        trackedActionCount: receipts.length,
        affectedActionCount: 0,
        blockedContractCount: 0,
        degradedContractCount: degraded.length,
        unknownActionCount,
        contracts: uniqueContracts,
        boundary:
          '未知或过期不等于外部动作已经失败；本摘要只描述执行前能力状态。',
        readAt: now(),
        readOnly: true,
      };
    }

    return {
      status: 'ready',
      title: receipts.length > 0 ? 'OpenClaw 就绪证明有效' : '当前没有 OpenClaw 动作',
      detail:
        receipts.length > 0
          ? '当前可见 OpenClaw 动作没有被 readiness contract 阻断；执行和审批仍按每条 action 的风险边界处理。'
          : '当前列表没有需要执行就绪判断的 OpenClaw 动作。',
      trackedActionCount: receipts.length,
      affectedActionCount: 0,
      blockedContractCount: 0,
      degradedContractCount: 0,
      unknownActionCount: 0,
      contracts: uniqueContracts,
      boundary:
        'ready 只证明近期 capability 可用，不代表原动作、外部事实或外部写操作已经完成。',
      readAt: now(),
      readOnly: true,
    };
  }
}
