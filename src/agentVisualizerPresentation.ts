import type { ThoughtStep } from './agentThinking';

export type AgentFlowStepType = 'analysis' | 'thought' | 'tool' | 'decision';
export type AgentFlowStepResultClass =
  | 'success'
  | 'error'
  | 'approval'
  | 'blocked'
  | 'empty'
  | 'skipped'
  | 'partial';

export type AgentRunReviewSeverity = 'ok' | 'info' | 'warning' | 'critical';

export interface AgentRunReviewItem {
  severity: AgentRunReviewSeverity;
  title: string;
  detail: string;
  action: string;
  stepIndexes?: number[];
}

export interface AgentApprovalDecisionOption {
  type: 'approve' | 'reject' | 'edit';
  label: string;
  description: string;
}

export interface AgentApprovalDecisionGuideItem {
  type: AgentApprovalDecisionOption['type'];
  label: string;
  currentState: string;
  nextStep: string;
  boundary: string;
}

export interface AgentApprovalReviewBoundary {
  mode: 'single_run_retry';
  generatedAt: string;
  label: string;
  description: string;
  scope: string;
  expiresWhen: string;
  approvalKeyBinding: string;
}

export interface AgentApprovalRetryReceipt {
  title: string;
  configScope: string;
  copiedFields: string;
  notCopied: string;
  recoveryBoundary: string;
}

export interface AgentApprovalPreflightReceipt {
  title: string;
  pendingAction: string;
  noEffectBoundary: string;
  copyBoundary: string;
  nextStep: string;
}

export interface AgentApprovalQueueReceipt {
  title: string;
  traceScope: string;
  pendingScope: string;
  persistenceBoundary: string;
  copyBoundary: string;
  nextStep: string;
  stepNumbers: number[];
}

export type AgentApprovalCopyTarget = 'key' | 'payload' | 'retry';

export interface AgentApprovalCopyButtonBoundary {
  title: string;
  ariaLabel: string;
}

export interface AgentPendingApprovalAction {
  stepIndex: number;
  toolId: string;
  approvalKey: string;
  effect?: string;
  riskLevel?: string;
  paramsPreview: string;
  reviewPayload: string;
  retryConfigPatch: string;
  message: string;
  reviewHint: string;
  safetyNote?: string;
  preflightReceipt: AgentApprovalPreflightReceipt;
  decisionOptions: AgentApprovalDecisionOption[];
  decisionGuide: AgentApprovalDecisionGuideItem[];
  resumeInstruction: string;
  reviewBoundary: AgentApprovalReviewBoundary;
  retryReceipt: AgentApprovalRetryReceipt;
}

export interface AgentFlowStep {
  type: AgentFlowStepType;
  name: string;
  result?: string;
  resultClass?: AgentFlowStepResultClass;
  detail?: string;
  stepIndex?: number;
  time: string;
}

export type AgentRunDiagnosticStatus =
  | 'empty'
  | 'running'
  | 'finished'
  | 'max_actions_reached'
  | 'stopped'
  | 'missing_terminal';

export interface AgentRunDiagnosticPacket {
  type: 'agent_thinking_run_diagnostics';
  version: 1;
  generatedAt: string;
  traceIdentity: AgentDiagnosticTraceIdentity;
  status: AgentRunDiagnosticStatus;
  severity: AgentRunReviewSeverity;
  summary: {
    stepCount: number;
    terminalStepNumber?: number;
    terminalAction?: string;
    toolErrorCount: number;
    approvalRequiredCount: number;
    blockedCount: number;
    emptyEvidenceCount: number;
    skippedCount: number;
    pendingApprovalCount: number;
    toolsInvolved: string[];
  };
  reviewItems: Array<{
    severity: AgentRunReviewSeverity;
    title: string;
    detail: string;
    action: string;
    stepNumbers: number[];
  }>;
  pendingApprovals: Array<{
    stepNumber: number;
    toolId: string;
    effect?: string;
    riskLevel?: string;
    message: string;
    reviewHint: string;
    safetyNote?: string;
    approvalKeyAvailable: boolean;
    retryConfigAvailable: boolean;
    reviewBoundary: AgentApprovalReviewBoundary;
  }>;
  approvalQueueReceipt?: AgentApprovalQueueReceipt;
  flowSteps: Array<{
    type: AgentFlowStepType;
    name: string;
    result?: string;
    resultClass?: AgentFlowStepResultClass;
    detail?: string;
    stepNumber?: number;
    time: string;
  }>;
  navigationReceipt: AgentTraceNavigationReceipt;
  traceSpans: AgentDiagnosticTraceSpan[];
  traceSpanComposition: AgentTraceSpanComposition;
  resultHandoffReceipt?: AgentResultHandoffReceipt;
  schemaBoundary: AgentDiagnosticSchemaBoundary;
  snapshotBoundary: AgentDiagnosticSnapshotBoundary;
  privacyNote: string;
}

export type AgentRunSnapshotChipTone =
  | 'neutral'
  | AgentRunReviewSeverity;

export interface AgentRunSnapshotChip {
  label: string;
  value: string;
  tone: AgentRunSnapshotChipTone;
}

export interface AgentRunSnapshot {
  statusLabel: string;
  detail: string;
  primaryAction: string;
  chips: AgentRunSnapshotChip[];
}

export interface AgentResultHandoffReceipt {
  title: string;
  traceState: string;
  resultState: string;
  unresolvedIssueSummary: string;
  inspectionRoute: string;
  boundary: string;
  terminalStepNumber?: number;
}

export interface AgentDiagnosticCopyScope {
  title: string;
  detail: string;
  identityBoundary: string;
  freshnessBoundary: string;
  privacyBoundary: string;
  exportBoundary: string;
  schemaBoundary: string;
  approvalBoundary: string;
}

export interface AgentDiagnosticCopyPreflightItem {
  label: string;
  value: string;
  tone: AgentRunSnapshotChipTone;
}

export interface AgentDiagnosticCopyPreflight {
  title: string;
  detail: string;
  items: AgentDiagnosticCopyPreflightItem[];
}

export interface AgentDiagnosticCopiedSnapshot {
  traceId: string;
  checksum: string;
  generatedAt: string;
  statusLabel: string;
  traceSpanCount: number;
}

export interface AgentTraceStepRoute {
  stepNumber: number;
  reason: string;
}

export interface AgentTraceReviewLaneItem {
  key: 'status' | 'approval' | 'tool_issues' | 'diagnostics';
  label: string;
  value: string;
  detail: string;
  tone: AgentRunSnapshotChipTone;
  stepIndexes?: number[];
  stepRoutes?: AgentTraceStepRoute[];
}

export interface AgentTraceReviewLane {
  title: string;
  detail: string;
  items: AgentTraceReviewLaneItem[];
}

export interface AgentTraceNavigationReceipt {
  title: string;
  currentTrace: string;
  primaryRoute: string;
  stepScope: string;
  noEffectBoundary: string;
  stepNumbers: number[];
  stepRoutes: AgentTraceStepRoute[];
}

export interface AgentTraceSpanCompositionItem {
  key: 'run' | 'steps' | 'tools' | 'decision' | 'issues';
  label: string;
  value: string;
  detail: string;
  tone: AgentRunSnapshotChipTone;
  stepNumbers?: number[];
}

export interface AgentTraceSpanComposition {
  title: string;
  detail: string;
  items: AgentTraceSpanCompositionItem[];
  boundary: string;
}

export interface AgentDiagnosticSchemaBoundary {
  schemaName: 'personal_ai_agent_thinking_diagnostics';
  schemaVersion: 1;
  spanLineage: string[];
  exporterStatus: 'local_only_not_standard_export';
  supportedUses: string[];
  unsupportedUses: string[];
  approvalContextBoundary: string;
}

export interface AgentDiagnosticSnapshotBoundary {
  generatedAt: string;
  status: AgentRunDiagnosticStatus;
  statusLabel: string;
  source: 'current_page_trace_snapshot';
  copySemantics: string;
  notLive: string;
  refreshBoundary: string;
}

export interface AgentDiagnosticTraceIdentity {
  traceId: string;
  checksum: string;
  checksumAlgorithm: 'fnv1a32-local';
  source: 'sanitized_diagnostic_snapshot';
  matchBoundary: string;
  notFor: string[];
}

export type AgentDiagnosticSpanOperation =
  | 'agent.run'
  | 'agent.step'
  | 'agent.decision'
  | 'execute_tool';

export type AgentDiagnosticSpanStatus =
  | 'ok'
  | 'running'
  | 'error'
  | 'approval_required'
  | 'blocked'
  | 'empty_evidence'
  | 'skipped'
  | 'max_actions_reached'
  | 'stopped'
  | 'missing_terminal';

export type AgentDiagnosticSpanAttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | undefined;

export interface AgentDiagnosticTraceSpan {
  spanId: string;
  parentSpanId?: string;
  operationName: AgentDiagnosticSpanOperation;
  name: string;
  status: {
    code: AgentDiagnosticSpanStatus;
    message?: string;
  };
  severity: AgentRunReviewSeverity;
  stepNumber?: number;
  startedAt: string;
  endedAt: string;
  summary?: string;
  attributes: Record<string, AgentDiagnosticSpanAttributeValue>;
}

const TRACE_ISSUE_STATUSES: AgentDiagnosticSpanStatus[] = [
  'error',
  'approval_required',
  'blocked',
  'empty_evidence',
];

export const normalizeToolResult = (result: any) => {
  if (typeof result !== 'string') return result;

  try {
    return JSON.parse(result);
  } catch (_error) {
    return result;
  }
};

export const getToolResultObject = (step: ThoughtStep) => {
  return normalizeToolResult(step.toolResult ?? (step as any).result);
};

const collectToolResultValues = (value: any): any[] => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectToolResultValues(item));
  }
  return [value];
};

const buildLocalChecksum = (input: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildAgentDiagnosticTraceIdentity = (input: {
  generatedAt: string;
  status: AgentRunDiagnosticStatus;
  severity: AgentRunReviewSeverity;
  summary: AgentRunDiagnosticPacket['summary'];
  reviewItems: AgentRunDiagnosticPacket['reviewItems'];
  pendingApprovals: AgentRunDiagnosticPacket['pendingApprovals'];
  traceSpans: AgentDiagnosticTraceSpan[];
  schemaBoundary: AgentDiagnosticSchemaBoundary;
  snapshotBoundary: AgentDiagnosticSnapshotBoundary;
}): AgentDiagnosticTraceIdentity => {
  const checksumInput = JSON.stringify({
    generatedAt: input.generatedAt,
    status: input.status,
    severity: input.severity,
    summary: input.summary,
    reviewItems: input.reviewItems.map((item) => ({
      severity: item.severity,
      title: item.title,
      action: item.action,
      stepNumbers: item.stepNumbers,
    })),
    pendingApprovals: input.pendingApprovals.map((approval) => ({
      stepNumber: approval.stepNumber,
      toolId: approval.toolId,
      effect: approval.effect,
      riskLevel: approval.riskLevel,
      approvalKeyAvailable: approval.approvalKeyAvailable,
      retryConfigAvailable: approval.retryConfigAvailable,
    })),
    traceSpans: input.traceSpans.map((span) => ({
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.operationName,
      status: span.status.code,
      severity: span.severity,
      stepNumber: span.stepNumber,
      name: span.name,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      attributes: span.attributes,
    })),
    schemaBoundary: input.schemaBoundary,
    snapshotBoundary: input.snapshotBoundary,
  });
  const checksum = buildLocalChecksum(checksumInput);
  return {
    traceId: `pai-agent-trace-${checksum}`,
    checksum,
    checksumAlgorithm: 'fnv1a32-local',
    source: 'sanitized_diagnostic_snapshot',
    matchBoundary:
      'Use this local trace id and checksum only to match the copied diagnostics JSON with this Options page snapshot.',
    notFor: [
      'standard OpenTelemetry, LangSmith, or Langfuse trace correlation',
      'persistent run checkpoint or resume',
      'tool approval, rejection, or execution proof',
    ],
  };
};

export const getToolResultValues = (step: ThoughtStep) => {
  const result = getToolResultObject(step);
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result.flatMap(collectToolResultValues);
  return Object.values(result).flatMap(collectToolResultValues);
};

export const stepHasToolError = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) =>
    Boolean(value?.error || value?.success === false || value?.result?.success === false),
  );
};

export const stepWasSkipped = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) => Boolean(value?.skipped));
};

export const stepHasToolBlocked = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) => Boolean(value?.blocked));
};

export const stepHasToolApprovalRequired = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) =>
    Boolean(value?.approvalRequired || value?.reason === 'approval_required'),
  );
};

const isEmptyEvidenceValue = (value: any) => {
  if (!value || typeof value !== 'object') return false;
  if (
    value.error ||
    value.blocked ||
    value.skipped ||
    value.success === false ||
    value.result?.success === false
  ) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'result')) return false;

  return !hasMeaningfulEvidence(value.result);
};

const hasMeaningfulEvidence = (result: any): boolean => {
  if (result === null || result === undefined || result === '') return false;
  if (Array.isArray(result)) return result.length > 0;
  if (typeof result === 'object') {
    const values = Object.values(result);
    return values.length > 0 && values.some(hasMeaningfulEvidence);
  }
  return true;
};

export const stepHasEmptyToolEvidence = (step: ThoughtStep) => {
  return getToolResultValues(step).some(isEmptyEvidenceValue);
};

export const stepAllToolResultsEmptyEvidence = (step: ThoughtStep) => {
  const values = getToolResultValues(step).filter(
    (value: any) =>
      !value?.error &&
      !value?.blocked &&
      !value?.skipped &&
      value?.success !== false &&
      value?.result?.success !== false,
  );
  return values.length > 0 && values.every(isEmptyEvidenceValue);
};

export const stepAllToolResultsBlocked = (step: ThoughtStep) => {
  const values = getToolResultValues(step);
  return values.length > 0 && values.every((value: any) => Boolean(value?.blocked));
};

export const stepAllToolResultsApprovalRequired = (step: ThoughtStep) => {
  const values = getToolResultValues(step);
  return (
    values.length > 0 &&
    values.every((value: any) =>
      Boolean(value?.approvalRequired || value?.reason === 'approval_required'),
    )
  );
};

export const stepAllToolResultsSkipped = (step: ThoughtStep) => {
  const values = getToolResultValues(step);
  return values.length > 0 && values.every((value: any) => Boolean(value?.skipped));
};

export const clipText = (text: string, maxLength = 120) => {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= maxLength) return cleanText;
  return `${cleanText.substring(0, maxLength)}...`;
};

const getFirstApprovalKey = (step: ThoughtStep) => {
  const approvalValue = getToolResultValues(step).find(
    (value: any) => typeof value?.approvalKey === 'string' && value.approvalKey,
  );
  return approvalValue?.approvalKey || '';
};

const isApprovalRequiredValue = (value: any) => {
  return Boolean(value?.approvalRequired || value?.reason === 'approval_required');
};

const normalizeApprovalValueList = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeApprovalValueList(item));
  }
  if (value && typeof value === 'object') return [value];
  return [];
};

const stringifyApprovalParams = (params: any) => {
  if (!params || typeof params !== 'object') return '无参数';

  try {
    return JSON.stringify(params);
  } catch (_error) {
    return '参数无法显示';
  }
};

const stringifyApprovalReviewPayload = (payload: Record<string, any>) => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_error) {
    return JSON.stringify({
      ...payload,
      params: undefined,
      paramsPreview: payload.paramsPreview || '参数无法显示',
    }, null, 2);
  }
};

const buildApprovalRetryConfigPatch = (approvalKey: string) =>
  stringifyApprovalReviewPayload({
    approvedToolActionKeys: approvalKey ? [approvalKey] : [],
  });

const APPROVAL_COPY_TARGET_BOUNDARY: Record<
  AgentApprovalCopyTarget,
  {
    label: string;
    copyScope: string;
    missingScope: string;
  }
> = {
  key: {
    label: '批准 key',
    copyScope: '只复制当前本地 trace 里的临时批准 key',
    missingScope: '当前动作没有可复制的批准 key',
  },
  payload: {
    label: '审核包',
    copyScope:
      '只复制当前待确认动作的工具、参数、审批边界和重跑提示',
    missingScope: '当前动作没有可复制的审核包',
  },
  retry: {
    label: '重跑配置',
    copyScope:
      '只复制 approvedToolActionKeys patch，不复制工具参数、原始结果、通知正文或外部执行凭据',
    missingScope: '当前动作没有可复制的重跑配置',
  },
};

export const buildAgentApprovalCopyButtonBoundary = (input: {
  toolId: string;
  target: AgentApprovalCopyTarget;
  available: boolean;
}): AgentApprovalCopyButtonBoundary => {
  const targetBoundary = APPROVAL_COPY_TARGET_BOUNDARY[input.target];
  const prefix = input.available
    ? `复制 ${input.toolId} 的${targetBoundary.label}`
    : `无法复制 ${input.toolId} 的${targetBoundary.label}`;
  const copyScope = input.available
    ? targetBoundary.copyScope
    : targetBoundary.missingScope;
  const sharedBoundary =
    '复制只产生本地文本，不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作；参数、上下文、工具策略或 trace 变化后需要重新生成。';

  return {
    title: `${prefix}：${copyScope}；${sharedBoundary}`,
    ariaLabel: `${prefix}。${copyScope}；${sharedBoundary}`,
  };
};

const buildApprovalRetryReceipt = (
  toolId: string,
  approvalValue: any,
): AgentApprovalRetryReceipt => ({
  title: '重跑配置回执',
  configScope: `${toolId} / ${formatApprovalEffect(approvalValue.effect)} / ${formatApprovalRisk(approvalValue.riskLevel)}。`,
  copiedFields:
    '重跑配置只复制 approvedToolActionKeys；调用方仍需重新运行同一工具和同一参数。',
  notCopied:
    '不复制工具参数、原始工具结果、通知正文或外部执行凭据。',
  recoveryBoundary:
    '拒绝、修改参数、上下文变化或工具策略变化时，应重新生成批准 key，不复用当前配置。',
});

const getApprovalNoEffectBoundary = (effect?: string) => {
  const effectBoundary: Record<string, string> = {
    read: '读取工具还没有执行。',
    external_read: '外部读取还没有执行。',
    write: '写入还没有发生。',
    notify: '通知还没有发送。',
    delete: '删除还没有发生。',
  };
  return effectBoundary[effect || ''] || '工具动作还没有执行。';
};

const buildApprovalPreflightReceipt = (
  toolId: string,
  approvalValue: any,
  stepIndex: number,
): AgentApprovalPreflightReceipt => ({
  title: '审批前确认',
  pendingAction: `${toolId} / ${formatApprovalEffect(approvalValue.effect)} / ${formatApprovalRisk(approvalValue.riskLevel)}，停在步骤 ${stepIndex + 1}，等待人工确认。`,
  noEffectBoundary: `${getApprovalNoEffectBoundary(approvalValue.effect)} 本轮只是生成临时批准 key、审核包和重跑配置。`,
  copyBoundary:
    '复制 key、审核包或重跑配置只复制文本，不会批准、恢复 run、发送通知、写入、删除或执行外部动作。',
  nextStep:
    '批准时复制重跑配置并用同一工具和同一参数重新运行；拒绝或修改参数时不要复用旧 key。',
});

const APPROVAL_DECISION_OPTIONS: AgentApprovalDecisionOption[] = [
  {
    type: 'approve',
    label: '批准',
    description: '参数无误时复制重跑配置，带 approvalKey 重新运行。',
  },
  {
    type: 'reject',
    label: '拒绝',
    description: '不执行该动作，把拒绝原因反馈给 Agent。',
  },
  {
    type: 'edit',
    label: '修改',
    description: '先改参数再重新生成批准 key，不复用旧 key。',
  },
];

const APPROVAL_RESUME_INSTRUCTION =
  '批准后复制重跑配置重新运行；拒绝或修改参数时不要复用旧 key。';

const buildApprovalDecisionGuide = (
  toolId: string,
  approvalValue: any,
  stepIndex: number,
): AgentApprovalDecisionGuideItem[] => {
  const effectLabel = formatApprovalEffect(approvalValue.effect);
  const riskLabel = formatApprovalRisk(approvalValue.riskLevel);
  const pendingAction = `${toolId} / ${effectLabel} / ${riskLabel}`;
  const noEffectBoundary = getApprovalNoEffectBoundary(approvalValue.effect);

  return [
    {
      type: 'approve',
      label: '批准后重跑',
      currentState: `${pendingAction} 仍停在步骤 ${stepIndex + 1}，${noEffectBoundary}`,
      nextStep:
        '确认参数无误后复制重跑配置，并让调用方用同一工具和同一参数重新运行。',
      boundary:
        '复制配置本身不会执行动作；上下文、参数或工具策略变化后要重新生成批准 key。',
    },
    {
      type: 'reject',
      label: '拒绝本次动作',
      currentState: `${pendingAction} 可以直接拒绝；当前批准 key 不应继续使用。`,
      nextStep:
        '把拒绝原因反馈给 Agent，或重新运行一个不触发该工具动作的分析路径。',
      boundary:
        '拒绝不会自动恢复本轮 run，也不会发送通知、写入、删除或执行外部动作。',
    },
    {
      type: 'edit',
      label: '修改参数后再审',
      currentState: `${pendingAction} 的参数、范围、接收方或内容一旦变化，旧 key 就不能代表新动作。`,
      nextStep:
        '先修改工具参数或重新生成建议，再用新的待确认动作和批准 key 复核。',
      boundary:
        '不要把旧 key 套到新参数；新参数必须重新经过执行前校验和人工确认。',
    },
  ];
};

const formatApprovalGeneratedAt = (timestamp?: number) => {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return new Date(0).toISOString();
  }

  return new Date(timestamp).toISOString();
};

const buildApprovalReviewBoundary = (
  step: ThoughtStep,
): AgentApprovalReviewBoundary => ({
  mode: 'single_run_retry',
  generatedAt: formatApprovalGeneratedAt(step.timestamp),
  label: '临时重跑凭据',
  description:
    '这是本轮 trace 生成的轻量审批包，不会持久暂停或自动恢复 Agent run。',
  scope: '只适用于同一 tool id 和完全相同参数的下一次重跑。',
  expiresWhen: '工具定义、参数、提示词、上下文或用户意图变化后应重新生成。',
  approvalKeyBinding:
    '批准 key 与 tool id + 参数精确绑定；拒绝或修改参数时不要复用旧 key。',
});

export const formatApprovalEffect = (effect?: string) => {
  const labels: Record<string, string> = {
    read: '只读',
    external_read: '外部只读',
    write: '写入',
    notify: '通知',
    delete: '删除',
  };
  return labels[effect || ''] || effect || '未知动作';
};

export const formatApprovalRisk = (riskLevel?: string) => {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  };
  return labels[riskLevel || ''] || riskLevel || '未知风险';
};

export const buildApprovalReviewHint = (
  effect?: string,
  riskLevel?: string,
) => {
  const effectHints: Record<string, string> = {
    read: '确认读取范围和敏感数据边界。',
    external_read: '确认外部读取范围、账号权限和敏感数据边界。',
    write: '确认写入对象、字段变化和回滚方式后再批准。',
    notify: '确认通知内容、接收渠道和触发原因后再批准。',
    delete: '确认删除对象、影响范围和恢复方式后再批准。',
  };
  const riskHints: Record<string, string> = {
    low: '',
    medium: '中风险动作需要确认参数无误。',
    high: '高风险动作需要明确用户授权。',
  };
  return [
    effectHints[effect || ''] || '确认工具动作、参数和影响范围后再批准。',
    riskHints[riskLevel || ''],
  ]
    .filter(Boolean)
    .join(' ');
};

export function buildPendingApprovalActions(
  thoughtProcess: ThoughtStep[],
): AgentPendingApprovalAction[] {
  return thoughtProcess.flatMap((step, stepIndex) => {
    const result = getToolResultObject(step);
    if (!result || typeof result !== 'object') return [];

    const entries = Array.isArray(result)
      ? [[step.toolUsed || '工具', result] as const]
      : Object.entries(result);

    return entries.flatMap(([toolId, value]) =>
      normalizeApprovalValueList(value)
        .filter(isApprovalRequiredValue)
        .map((approvalValue: any) => {
          const approvalKey =
            typeof approvalValue.approvalKey === 'string'
              ? approvalValue.approvalKey
              : '';
          const paramsPreview = stringifyApprovalParams(approvalValue.params);
          const message =
            typeof approvalValue.message === 'string'
              ? approvalValue.message
              : `${toolId} 需要人工确认。`;
          const reviewHint = buildApprovalReviewHint(
            approvalValue.effect,
            approvalValue.riskLevel,
          );
          const safetyNote =
            typeof approvalValue.safetyNote === 'string'
              ? approvalValue.safetyNote.trim()
              : '';
          const reviewBoundary = buildApprovalReviewBoundary(step);
          const retryConfigPatch = buildApprovalRetryConfigPatch(approvalKey);
          const retryReceipt = buildApprovalRetryReceipt(toolId, approvalValue);
          const preflightReceipt = buildApprovalPreflightReceipt(
            toolId,
            approvalValue,
            stepIndex,
          );
          const decisionGuide = buildApprovalDecisionGuide(
            toolId,
            approvalValue,
            stepIndex,
          );
          const reviewPayload = stringifyApprovalReviewPayload({
            type: 'agent_tool_approval_review',
            toolId,
            approvalKey,
            effect: approvalValue.effect || 'unknown',
            riskLevel: approvalValue.riskLevel || 'unknown',
            stepNumber: stepIndex + 1,
            params: approvalValue.params ?? null,
            paramsPreview,
            message,
            reviewHint,
            safetyNote: safetyNote || undefined,
            preflightReceipt,
            allowedDecisions: [
              'approve_with_approvalKey',
              'reject',
              'edit_params_then_regenerate_key',
            ],
            decisionOptions: APPROVAL_DECISION_OPTIONS,
            decisionGuide,
            retryConfigPatch: approvalKey
              ? { approvedToolActionKeys: [approvalKey] }
              : { approvedToolActionKeys: [] },
            retryReceipt,
            resumeInstruction: APPROVAL_RESUME_INSTRUCTION,
            reviewBoundary,
          });

          return {
            stepIndex,
            toolId,
            approvalKey,
            effect: approvalValue.effect,
            riskLevel: approvalValue.riskLevel,
            paramsPreview,
            reviewPayload,
            retryConfigPatch,
            message,
            reviewHint,
            safetyNote: safetyNote || undefined,
            preflightReceipt,
            decisionOptions: APPROVAL_DECISION_OPTIONS,
            decisionGuide,
            resumeInstruction: APPROVAL_RESUME_INSTRUCTION,
            reviewBoundary,
            retryReceipt,
          };
        }),
    );
  });
}

export function buildAgentApprovalQueueReceipt(input: {
  traceIdentity: AgentDiagnosticTraceIdentity;
  pendingApprovals: AgentRunDiagnosticPacket['pendingApprovals'];
}): AgentApprovalQueueReceipt | null {
  if (input.pendingApprovals.length === 0) return null;

  const stepNumbers = Array.from(
    new Set(input.pendingApprovals.map((approval) => approval.stepNumber)),
  ).sort((a, b) => a - b);
  const toolLabels = Array.from(
    new Set(input.pendingApprovals.map((approval) => approval.toolId)),
  )
    .slice(0, 3)
    .join('、');
  const overflowCount = Math.max(
    0,
    new Set(input.pendingApprovals.map((approval) => approval.toolId)).size - 3,
  );
  const toolSummary = `${toolLabels}${overflowCount > 0 ? ` 等 ${overflowCount + 3} 个工具` : ''}`;
  const stepSummary = stepNumbers.map((stepNumber) => `#${stepNumber}`).join('、');

  return {
    title: '待确认队列口径',
    traceScope: `当前页面 trace ${input.traceIdentity.traceId} 汇总 ${input.pendingApprovals.length} 个待确认动作，来自步骤 ${stepSummary}。`,
    pendingScope: `队列只汇总本轮已被执行前阻断的人审工具动作；${toolSummary} 还没有执行。`,
    persistenceBoundary:
      '这不是持久审批队列，也不会让本轮 Agent run 在后台继续暂停等待；刷新、重跑、工具策略或参数变化后需重新生成。',
    copyBoundary:
      '复制 key、审核包或重跑配置只复制文本，不会批准、恢复 run、发送通知、写入、删除或执行外部动作。',
    nextStep:
      '逐条复核参数、接收方和安全说明；批准时复制对应重跑配置并用同一工具和同一参数重新运行，拒绝或修改时不要复用旧 key。',
    stepNumbers,
  };
}

export const getStepKind = (step: ThoughtStep) => {
  if (step.action === 'finish') return '完成';
  if (step.action === 'max_actions_reached') return '已截断';
  if (step.action === 'stopped') return '已停止';
  if (step.toolUsed) {
    if (stepHasToolError(step)) return '失败';
    if (stepAllToolResultsApprovalRequired(step)) return '待确认';
    if (stepHasToolApprovalRequired(step)) return '部分待确认';
    if (stepAllToolResultsBlocked(step)) return '已阻断';
    if (stepHasToolBlocked(step)) return '部分阻断';
    if (stepAllToolResultsEmptyEvidence(step)) return '证据不足';
    if (stepHasEmptyToolEvidence(step)) return '部分缺证';
    if (stepAllToolResultsSkipped(step)) return '跳过';
    if (stepWasSkipped(step)) return '部分跳过';
    return '工具';
  }
  return '分析';
};

export const getStepKindClass = (step: ThoughtStep) => {
  if (step.action === 'finish') return 'done';
  if (step.action === 'max_actions_reached') return 'budget';
  if (step.action === 'stopped') return 'stopped';
  if (step.toolUsed) {
    if (stepHasToolError(step)) return 'error';
    if (stepHasToolApprovalRequired(step)) return 'approval';
    if (stepHasToolBlocked(step)) return 'blocked';
    if (stepHasEmptyToolEvidence(step)) return 'empty';
    if (stepAllToolResultsSkipped(step)) return 'skipped';
    if (stepWasSkipped(step)) return 'partial';
    return 'tool';
  }
  return 'analysis';
};

export const getStepSummary = (step: ThoughtStep) => {
  if (step.toolUsed) {
    const toolList = step.toolUsed
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean)
      .join('、');

    if (stepHasToolError(step)) {
      return `${toolList || '工具'} 调用失败，需要查看调试详情。`;
    }
    if (stepHasToolApprovalRequired(step)) {
      if (stepAllToolResultsApprovalRequired(step)) {
        return `${toolList || '工具'} 需要人工确认，当前未执行。`;
      }
      return `${toolList || '工具'} 中部分调用需要人工确认，未确认的动作已阻断。`;
    }
    if (stepHasToolBlocked(step)) {
      if (stepAllToolResultsBlocked(step)) {
        return `${toolList || '工具'} 未通过工具校验，已阻断执行。`;
      }
      return `${toolList || '工具'} 中部分调用未通过校验，已阻断执行。`;
    }
    if (stepHasEmptyToolEvidence(step)) {
      if (stepAllToolResultsEmptyEvidence(step)) {
        return `${toolList || '工具'} 已执行，但没有返回可用证据。`;
      }
      return `${toolList || '工具'} 中部分调用没有返回可用证据，其余结果已用于分析。`;
    }
    if (stepWasSkipped(step)) {
      if (stepAllToolResultsSkipped(step)) {
        return `${toolList || '工具'} 已有相同参数的执行记录，本轮未重复调用。`;
      }
      return `${toolList || '工具'} 中部分重复调用已跳过，其余结果已用于补充当前分析。`;
    }
    return `${toolList || '工具'} 已执行，用于补充当前分析上下文。`;
  }

  return clipText(step.thought || step.action || '分析步骤');
};

export const getStepVisibleSummary = (step: ThoughtStep) => {
  if (step.toolUsed) {
    return getStepSummary(step);
  }

  if (step.publicSummary?.trim()) {
    return clipText(step.publicSummary, 180);
  }

  return getStepSummary(step);
};

export const getStepIntentSummary = (step: ThoughtStep) => {
  const publicSummary = step.publicSummary?.trim();
  if (!publicSummary) return '';

  const clippedSummary = clipText(publicSummary, 180);
  return clippedSummary === getStepVisibleSummary(step) ? '' : clippedSummary;
};

export const getStepDiagnosticSummary = (step: ThoughtStep) => {
  if (step.toolUsed) {
    if (stepHasToolError(step)) {
      return '工具调用失败。请检查工具配置、网络/API 权限或参数后重试。';
    }
    if (stepHasToolApprovalRequired(step)) {
      const approvalKey = getFirstApprovalKey(step);
      const approvalKeyText = approvalKey ? ` 批准 key: ${approvalKey}。` : '';
      return `工具涉及写入、通知、删除或更高风险动作，需要调用方先展示给用户确认；确认后用精确匹配工具和参数的批准 key 重新执行。${approvalKeyText}`;
    }
    if (stepHasToolBlocked(step)) {
      return '工具调用被执行前校验拦截，通常是工具未注册或缺少必填参数。';
    }
    if (stepHasEmptyToolEvidence(step)) {
      return '工具调用完成，但返回结果为空。最终判断可能仍可用，但需要确认是否应调整查询参数或补充证据。';
    }
    if (stepWasSkipped(step)) {
      return '已跳过重复参数调用，并继续复用本轮已有工具结果。';
    }
    return '工具已返回结果，可展开查看补充到本轮分析的上下文。';
  }

  if (step.action === 'max_actions_reached') {
    return '行动次数已用完；如需更完整分析，可提高 maxActions 或缩小本轮问题范围。';
  }
  if (step.action === 'stopped') {
    return '本轮处理已按停止请求中止，当前结果只包含停止前已收集的信息。';
  }
  if (step.action === 'finish') {
    return 'Agent 已认为当前信息足够，准备输出最终结果。';
  }

  return '';
};

const countSteps = (
  thoughtProcess: ThoughtStep[],
  predicate: (step: ThoughtStep) => boolean,
) => thoughtProcess.filter(predicate).length;

const collectStepIndexes = (
  thoughtProcess: ThoughtStep[],
  predicate: (step: ThoughtStep) => boolean,
) =>
  thoughtProcess.flatMap((step, index) =>
    predicate(step) ? [index] : [],
  );

const uniqueStepIndexes = (...stepIndexGroups: number[][]) =>
  Array.from(new Set(stepIndexGroups.flat())).sort((a, b) => a - b);

const formatIssueCount = (label: string, count: number) =>
  count > 0 ? `${label} ${count} 个步骤` : '';

const buildOpenIssueSummary = (counts: {
  toolErrorCount: number;
  approvalRequiredCount: number;
  blockedCount: number;
  emptyEvidenceCount: number;
}) =>
  [
    formatIssueCount('工具失败', counts.toolErrorCount),
    formatIssueCount('待确认', counts.approvalRequiredCount),
    formatIssueCount('被阻断', counts.blockedCount),
    formatIssueCount('证据不足', counts.emptyEvidenceCount),
  ]
    .filter(Boolean)
    .join('、');

const countOpenToolIssues = (thoughtProcess: ThoughtStep[]) => {
  const toolErrorCount = countSteps(thoughtProcess, stepHasToolError);
  const approvalRequiredCount = countSteps(
    thoughtProcess,
    stepHasToolApprovalRequired,
  );
  const blockedCount = countSteps(
    thoughtProcess,
    (step) => stepHasToolBlocked(step) && !stepHasToolApprovalRequired(step),
  );
  const emptyEvidenceCount = countSteps(thoughtProcess, stepHasEmptyToolEvidence);

  return {
    toolErrorCount,
    approvalRequiredCount,
    blockedCount,
    emptyEvidenceCount,
    summary: buildOpenIssueSummary({
      toolErrorCount,
      approvalRequiredCount,
      blockedCount,
      emptyEvidenceCount,
    }),
  };
};

export function buildAgentRunReviewItems(
  thoughtProcess: ThoughtStep[],
  options: { isProcessing?: boolean } = {},
): AgentRunReviewItem[] {
  if (thoughtProcess.length === 0) return [];

  const toolErrorStepIndexes = collectStepIndexes(
    thoughtProcess,
    stepHasToolError,
  );
  const approvalRequiredStepIndexes = collectStepIndexes(
    thoughtProcess,
    stepHasToolApprovalRequired,
  );
  const blockedStepIndexes = collectStepIndexes(
    thoughtProcess,
    (step) => stepHasToolBlocked(step) && !stepHasToolApprovalRequired(step),
  );
  const emptyEvidenceStepIndexes = collectStepIndexes(
    thoughtProcess,
    stepHasEmptyToolEvidence,
  );
  const skippedStepIndexes = collectStepIndexes(thoughtProcess, stepWasSkipped);
  const budgetStepIndexes = collectStepIndexes(
    thoughtProcess,
    (step) => step.action === 'max_actions_reached',
  );
  const stoppedStepIndexes = collectStepIndexes(
    thoughtProcess,
    (step) => step.action === 'stopped',
  );

  const {
    toolErrorCount,
    approvalRequiredCount,
    blockedCount,
    emptyEvidenceCount,
    summary: openIssueSummary,
  } = countOpenToolIssues(thoughtProcess);
  const skippedCount = countSteps(thoughtProcess, stepWasSkipped);
  const budgetCount = countSteps(
    thoughtProcess,
    (step) => step.action === 'max_actions_reached',
  );
  const stoppedCount = countSteps(
    thoughtProcess,
    (step) => step.action === 'stopped',
  );
  const hasTerminalStep = thoughtProcess.some((step) =>
    ['finish', 'max_actions_reached', 'stopped'].includes(step.action),
  );
  const items: AgentRunReviewItem[] = [];

  if (toolErrorCount > 0) {
    items.push({
      severity: 'critical',
      title: '工具调用失败',
      detail: `${toolErrorCount} 个工具步骤失败，最终判断可能缺少证据。`,
      action: '检查工具配置、网络/API 权限或参数后重新运行。',
      stepIndexes: toolErrorStepIndexes,
    });
  }

  if (approvalRequiredCount > 0) {
    items.push({
      severity: 'warning',
      title: '需要人工确认',
      detail: `${approvalRequiredCount} 个工具步骤涉及高风险或外部副作用动作，已暂停执行。`,
      action: '先让用户确认具体工具和参数，再带对应批准 key 重新运行。',
      stepIndexes: approvalRequiredStepIndexes,
    });
  }

  if (blockedCount > 0) {
    items.push({
      severity: 'warning',
      title: '工具被阻断',
      detail: `${blockedCount} 个工具步骤未通过执行前校验。`,
      action: '改用工具目录里的 ID，或补齐必填参数后重试。',
      stepIndexes: blockedStepIndexes,
    });
  }

  if (emptyEvidenceCount > 0) {
    items.push({
      severity: 'warning',
      title: '工具证据不足',
      detail: `${emptyEvidenceCount} 个工具步骤完成但没有返回可用证据。`,
      action: '调整查询参数、补充上下文，或在结论中标记证据不足。',
      stepIndexes: emptyEvidenceStepIndexes,
    });
  }

  if (budgetCount > 0) {
    items.push({
      severity: 'warning',
      title: '行动次数用完',
      detail: openIssueSummary
        ? `Agent 在达到 maxActions 后使用已有信息结束；预算用完时仍有${openIssueSummary}需要处理。`
        : 'Agent 在达到 maxActions 后使用已有信息结束。可能仍有未验证的问题。',
      action: openIssueSummary
        ? '先处理失败、待确认、阻断或缺证问题，再提高 maxActions 或缩小问题范围重新分析。'
        : '提高 maxActions，或缩小本轮问题范围后重新分析。',
      stepIndexes: uniqueStepIndexes(
        toolErrorStepIndexes,
        approvalRequiredStepIndexes,
        blockedStepIndexes,
        emptyEvidenceStepIndexes,
        budgetStepIndexes,
      ),
    });
  }

  if (!hasTerminalStep) {
    items.push(
      options.isProcessing
        ? {
            severity: 'info',
            title: '正在运行',
            detail: 'Agent 还没有输出最终决策，当前内容只是中间状态。',
            action: '等待运行结束后再根据检查结果处理。',
          }
        : {
            severity: 'warning',
            title: '缺少完成状态',
            detail: '本轮 trace 没有 finish、停止或预算耗尽步骤。',
            action: '检查调用方是否提前中断，或补充终止状态记录。',
          },
    );
  }

  if (stoppedCount > 0) {
    items.push({
      severity: 'info',
      title: '用户已停止',
      detail: '本轮分析保留了停止前已经收集的信息。',
      action: '如需完整结论，请重新运行分析。',
      stepIndexes: stoppedStepIndexes,
    });
  }

  if (skippedCount > 0) {
    items.push({
      severity: 'info',
      title: '重复调用已跳过',
      detail: `${skippedCount} 个工具步骤复用了本轮已有结果，避免重复请求。`,
      action: '通常无需处理；如证据不足，可换用更具体参数再运行。',
      stepIndexes: skippedStepIndexes,
    });
  }

  if (items.length === 0) {
    items.push({
      severity: 'ok',
      title: '运行正常',
      detail: '没有发现工具失败、阻断、预算耗尽或异常中断。',
      action: '可继续查看时间线和工具证据。',
    });
  }

  return items;
}

export function getAgentRunReviewSeverity(
  items: AgentRunReviewItem[],
): AgentRunReviewSeverity {
  if (items.some((item) => item.severity === 'critical')) return 'critical';
  if (items.some((item) => item.severity === 'warning')) return 'warning';
  if (items.some((item) => item.severity === 'info')) return 'info';
  return 'ok';
}

export const formatToolResult = (result: any) => {
  if (!result) return '无结果';

  try {
    const normalizedResult = normalizeToolResult(result);
    const resultStr =
      typeof normalizedResult === 'string'
        ? normalizedResult
        : JSON.stringify(normalizedResult, null, 2);
    if (resultStr.length > 500) {
      return resultStr.substring(0, 500) + '...';
    }
    return resultStr;
  } catch (_error) {
    return '无法显示结果';
  }
};

export function getToolStepResultPresentation(step: ThoughtStep): {
  label: string;
  className: AgentFlowStepResultClass;
} {
  if (stepHasToolError(step)) {
    return { label: '失败', className: 'error' };
  }
  if (stepAllToolResultsApprovalRequired(step)) {
    return { label: '待确认', className: 'approval' };
  }
  if (stepHasToolApprovalRequired(step)) {
    return { label: '部分待确认', className: 'approval' };
  }
  if (stepAllToolResultsBlocked(step)) {
    return { label: '已阻断', className: 'blocked' };
  }
  if (stepHasToolBlocked(step)) {
    return { label: '部分阻断', className: 'blocked' };
  }
  if (stepAllToolResultsEmptyEvidence(step)) {
    return { label: '证据不足', className: 'empty' };
  }
  if (stepHasEmptyToolEvidence(step)) {
    return { label: '部分缺证', className: 'empty' };
  }
  if (stepAllToolResultsSkipped(step)) {
    return { label: '跳过', className: 'skipped' };
  }
  if (stepWasSkipped(step)) {
    return { label: '部分跳过', className: 'partial' };
  }
  return { label: '成功', className: 'success' };
}

export function buildAgentFlowSteps(
  thoughtProcess: ThoughtStep[],
  formatTime: (timestamp: number) => string,
): AgentFlowStep[] {
  if (thoughtProcess.length === 0) return [];
  const terminalStepIndex = thoughtProcess.findIndex((step) =>
    ['finish', 'max_actions_reached', 'stopped'].includes(step.action),
  );
  const terminalStep =
    terminalStepIndex >= 0 ? thoughtProcess[terminalStepIndex] : undefined;
  const budgetOpenIssueSummary =
    terminalStep?.action === 'max_actions_reached'
      ? countOpenToolIssues(thoughtProcess).summary
      : '';

  const flowSteps: AgentFlowStep[] = [
    {
      type: 'analysis',
      name: '初始分析',
      time: formatTime(thoughtProcess[0].timestamp - 1000),
    },
  ];

  thoughtProcess.forEach((step, index) => {
    if (step.toolUsed) {
      const presentation = getToolStepResultPresentation(step);
      const detail = getStepIntentSummary(step) || getStepVisibleSummary(step);
      flowSteps.push({
        type: 'tool',
        name: step.toolUsed,
        result: presentation.label,
        resultClass: presentation.className,
        detail,
        stepIndex: index,
        time: formatTime(step.timestamp),
      });
    } else if (
      !['finish', 'max_actions_reached', 'stopped'].includes(step.action)
    ) {
      flowSteps.push({
        type: 'thought',
        name: '思考分析',
        detail: getStepVisibleSummary(step),
        stepIndex: index,
        time: formatTime(step.timestamp),
      });
    }
  });

  if (terminalStep) {
    const terminalName =
      terminalStep.action === 'max_actions_reached'
        ? '预算耗尽'
        : terminalStep.action === 'stopped'
          ? '已停止'
          : '最终决策';
    const terminalDetail = getStepVisibleSummary(terminalStep);
    flowSteps.push({
      type: 'decision',
      name: terminalName,
      detail:
        budgetOpenIssueSummary && terminalStep.action === 'max_actions_reached'
          ? `${terminalDetail} 预算用完时仍有${budgetOpenIssueSummary}需要处理。`
          : terminalDetail,
      stepIndex: terminalStepIndex,
      time: formatTime(terminalStep.timestamp),
    });
  }

  return flowSteps;
}

const redactApprovalKeyText = (text: string) =>
  text.replace(/批准 key[:：][\s\S]*$/i, '批准 key: [omitted]');

const toIsoTimestamp = (timestamp: number | undefined, fallback: string) =>
  Number.isFinite(timestamp) ? new Date(timestamp as number).toISOString() : fallback;

const splitToolNames = (toolUsed?: string) =>
  String(toolUsed || '')
    .split(',')
    .map((toolId) => toolId.trim())
    .filter(Boolean);

const sanitizeSpanAttributes = (
  attributes: Record<string, AgentDiagnosticSpanAttributeValue>,
) =>
  Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );

const getStepSpanStatus = (step: ThoughtStep): AgentDiagnosticSpanStatus => {
  if (step.action === 'max_actions_reached') return 'max_actions_reached';
  if (step.action === 'stopped') return 'stopped';
  if (stepHasToolError(step)) return 'error';
  if (stepHasToolApprovalRequired(step)) return 'approval_required';
  if (stepHasToolBlocked(step)) return 'blocked';
  if (stepHasEmptyToolEvidence(step)) return 'empty_evidence';
  if (stepWasSkipped(step)) return 'skipped';
  return 'ok';
};

const getSpanSeverityForStatus = (
  status: AgentDiagnosticSpanStatus,
): AgentRunReviewSeverity => {
  if (status === 'error') return 'critical';
  if (
    [
      'approval_required',
      'blocked',
      'empty_evidence',
      'max_actions_reached',
      'missing_terminal',
    ].includes(status)
  ) {
    return 'warning';
  }
  if (status === 'running' || status === 'skipped' || status === 'stopped') {
    return 'info';
  }
  return 'ok';
};

const getEvidenceStatus = (step: ThoughtStep) => {
  if (!step.toolUsed) return undefined;
  if (stepHasEmptyToolEvidence(step)) return 'empty';
  if (stepHasToolError(step)) return 'error';
  if (stepHasToolApprovalRequired(step)) return 'pending_approval';
  if (stepHasToolBlocked(step)) return 'blocked';
  if (stepWasSkipped(step)) return 'skipped';
  return 'available';
};

const getToolResultEntries = (step: ThoughtStep): Array<[string, any, number]> => {
  const result = getToolResultObject(step);
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) {
    return result.map((value, index) => [step.toolUsed || 'tool', value, index]);
  }
  return Object.entries(result).flatMap(([toolId, value]) => {
    if (Array.isArray(value)) {
      return value.map((item, index) => [toolId, item, index] as [string, any, number]);
    }
    return [[toolId, value, 0] as [string, any, number]];
  });
};

const getToolValueStatus = (value: any): AgentDiagnosticSpanStatus => {
  if (!value || typeof value !== 'object') return 'ok';
  if (value.error || value.success === false || value.result?.success === false) {
    return 'error';
  }
  if (value.approvalRequired || value.reason === 'approval_required') {
    return 'approval_required';
  }
  if (value.blocked) return 'blocked';
  if (value.skipped) return 'skipped';
  if (isEmptyEvidenceValue(value)) return 'empty_evidence';
  return 'ok';
};

const getToolValueSummary = (value: any, fallback: string) => {
  if (!value || typeof value !== 'object') return fallback;
  if (typeof value.message === 'string' && value.message.trim()) {
    return clipText(redactApprovalKeyText(value.message), 180);
  }
  if (typeof value.error === 'string' && value.error.trim()) {
    return clipText(value.error, 180);
  }
  return fallback;
};

function buildDiagnosticTraceSpans(
  thoughtProcess: ThoughtStep[],
  params: {
    generatedAt: string;
    status: AgentRunDiagnosticStatus;
    severity: AgentRunReviewSeverity;
    summary: AgentRunDiagnosticPacket['summary'];
  },
): AgentDiagnosticTraceSpan[] {
  if (thoughtProcess.length === 0) {
    return [
      {
        spanId: 'run',
        operationName: 'agent.run',
        name: 'Agent Thinking run',
        status: {
          code: params.status === 'running' ? 'running' : 'missing_terminal',
          message: 'No trace steps were recorded.',
        },
        severity: params.severity,
        startedAt: params.generatedAt,
        endedAt: params.generatedAt,
        summary: 'No Agent Thinking steps were recorded.',
        attributes: sanitizeSpanAttributes({
          'agent.name': 'Personal AI Agent Thinking',
          'agent.status': params.status,
          'agent.step.count': 0,
        }),
      },
    ];
  }

  const runStartedAt = toIsoTimestamp(thoughtProcess[0]?.timestamp, params.generatedAt);
  const runEndedAt = toIsoTimestamp(
    thoughtProcess[thoughtProcess.length - 1]?.timestamp,
    params.generatedAt,
  );
  const rootStatus: AgentDiagnosticSpanStatus =
    params.status === 'finished'
      ? 'ok'
      : params.status === 'empty'
        ? 'missing_terminal'
        : params.status;
  const spans: AgentDiagnosticTraceSpan[] = [
    {
      spanId: 'run',
      operationName: 'agent.run',
      name: 'Agent Thinking run',
      status: {
        code: rootStatus,
        message:
          params.status === 'missing_terminal'
            ? 'Trace has no finish, stopped, or max_actions_reached step.'
            : undefined,
      },
      severity: params.severity,
      startedAt: runStartedAt,
      endedAt: runEndedAt,
      summary: `Agent Thinking run ${params.status}`,
      attributes: sanitizeSpanAttributes({
        'agent.name': 'Personal AI Agent Thinking',
        'agent.status': params.status,
        'agent.step.count': params.summary.stepCount,
        'agent.terminal.step_number': params.summary.terminalStepNumber,
        'agent.terminal.action': params.summary.terminalAction,
        'agent.tool.error.count': params.summary.toolErrorCount,
        'agent.tool.blocked.count': params.summary.blockedCount,
        'agent.tool.empty_evidence.count': params.summary.emptyEvidenceCount,
        'agent.approval.pending.count': params.summary.pendingApprovalCount,
        'agent.tools': params.summary.toolsInvolved,
      }),
    },
  ];

  thoughtProcess.forEach((step, index) => {
    const stepNumber = index + 1;
    const stepStatus = getStepSpanStatus(step);
    const stepTimestamp = toIsoTimestamp(step.timestamp, params.generatedAt);
    const toolNames = splitToolNames(step.toolUsed);
    const isTerminalStep = ['finish', 'max_actions_reached', 'stopped'].includes(
      step.action,
    );
    const stepSpanId = `step-${stepNumber}`;
    const visibleSummary = getStepVisibleSummary(step);

    spans.push({
      spanId: stepSpanId,
      parentSpanId: 'run',
      operationName: isTerminalStep ? 'agent.decision' : 'agent.step',
      name: isTerminalStep
        ? `decision ${step.action}`
        : step.toolUsed
          ? `step ${stepNumber} tool ${step.toolUsed}`
          : `step ${stepNumber} ${step.action || 'analysis'}`,
      status: {
        code: stepStatus,
        message: getStepDiagnosticSummary(step)
          ? redactApprovalKeyText(getStepDiagnosticSummary(step))
          : undefined,
      },
      severity: getSpanSeverityForStatus(stepStatus),
      stepNumber,
      startedAt: stepTimestamp,
      endedAt: stepTimestamp,
      summary: visibleSummary,
      attributes: sanitizeSpanAttributes({
        'agent.step.number': stepNumber,
        'agent.step.action': step.action,
        'agent.step.kind': getStepKind(step),
        'agent.step.summary': visibleSummary,
        'agent.tool.names': toolNames.length > 0 ? toolNames : undefined,
        'agent.evidence.status': getEvidenceStatus(step),
        'agent.approval.required': stepHasToolApprovalRequired(step) || undefined,
      }),
    });

    getToolResultEntries(step).forEach(([toolId, value, resultIndex]) => {
      const toolStatus = getToolValueStatus(value);
      const toolTimestamp = stepTimestamp;
      const resultSuffix = resultIndex > 0 ? `-${resultIndex + 1}` : '';
      spans.push({
        spanId: `step-${stepNumber}-tool-${toolId}${resultSuffix}`,
        parentSpanId: stepSpanId,
        operationName: 'execute_tool',
        name: `execute_tool ${toolId}`,
        status: {
          code: toolStatus,
          message: getToolValueSummary(value, getStepSummary(step)),
        },
        severity: getSpanSeverityForStatus(toolStatus),
        stepNumber,
        startedAt: toolTimestamp,
        endedAt: toolTimestamp,
        summary: getToolValueSummary(value, getStepSummary(step)),
        attributes: sanitizeSpanAttributes({
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': toolId,
          'gen_ai.tool.type': 'function',
          'agent.step.number': stepNumber,
          'agent.tool.status': toolStatus,
          'agent.tool.blocked': Boolean(value?.blocked) || undefined,
          'agent.tool.skipped': Boolean(value?.skipped) || undefined,
          'agent.tool.error': Boolean(
            value?.error || value?.success === false || value?.result?.success === false,
          ) || undefined,
          'agent.approval.required':
            Boolean(value?.approvalRequired || value?.reason === 'approval_required') ||
            undefined,
          'agent.evidence.status': isEmptyEvidenceValue(value)
            ? 'empty'
            : toolStatus === 'ok'
              ? 'available'
              : toolStatus,
          'agent.tool.effect': typeof value?.effect === 'string' ? value.effect : undefined,
          'agent.tool.risk_level':
            typeof value?.riskLevel === 'string' ? value.riskLevel : undefined,
        }),
      });
    });
  });

  return spans;
}

export function buildAgentRunDiagnosticPacket(
  thoughtProcess: ThoughtStep[],
  options: { isProcessing?: boolean; generatedAt?: string } = {},
): AgentRunDiagnosticPacket {
  const terminalStepIndex = thoughtProcess.findIndex((step) =>
    ['finish', 'max_actions_reached', 'stopped'].includes(step.action),
  );
  const terminalStep =
    terminalStepIndex >= 0 ? thoughtProcess[terminalStepIndex] : undefined;
  const status: AgentRunDiagnosticStatus =
    thoughtProcess.length === 0
      ? 'empty'
      : terminalStep?.action === 'finish'
        ? 'finished'
        : terminalStep?.action === 'max_actions_reached'
          ? 'max_actions_reached'
          : terminalStep?.action === 'stopped'
            ? 'stopped'
            : options.isProcessing
              ? 'running'
              : 'missing_terminal';
  const reviewItems = buildAgentRunReviewItems(thoughtProcess, {
    isProcessing: options.isProcessing,
  });
  const pendingApprovals = buildPendingApprovalActions(thoughtProcess);
  const toolIssueCounts = countOpenToolIssues(thoughtProcess);
  const skippedCount = countSteps(thoughtProcess, stepWasSkipped);
  const flowSteps = buildAgentFlowSteps(thoughtProcess, (timestamp) =>
    Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '',
  );
  const toolsInvolved = Array.from(
    new Set(
      flowSteps
        .filter((step) => step.type === 'tool')
        .flatMap((step) =>
          step.name
            .split(',')
            .map((toolId) => toolId.trim())
            .filter(Boolean),
        ),
    ),
  ).sort();

  const summary = {
    stepCount: thoughtProcess.length,
    terminalStepNumber:
      terminalStepIndex >= 0 ? terminalStepIndex + 1 : undefined,
    terminalAction: terminalStep?.action,
    toolErrorCount: toolIssueCounts.toolErrorCount,
    approvalRequiredCount: toolIssueCounts.approvalRequiredCount,
    blockedCount: toolIssueCounts.blockedCount,
    emptyEvidenceCount: toolIssueCounts.emptyEvidenceCount,
    skippedCount,
    pendingApprovalCount: pendingApprovals.length,
    toolsInvolved,
  };
  const severity = getAgentRunReviewSeverity(reviewItems);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const diagnosticReviewItems = reviewItems.map((item) => ({
    severity: item.severity,
    title: item.title,
    detail: item.detail,
    action: item.action,
    stepNumbers: (item.stepIndexes || []).map((stepIndex) => stepIndex + 1),
  }));
  const diagnosticPendingApprovals = pendingApprovals.map((approval) => ({
    stepNumber: approval.stepIndex + 1,
    toolId: approval.toolId,
    effect: approval.effect,
    riskLevel: approval.riskLevel,
    message: redactApprovalKeyText(approval.message),
    reviewHint: approval.reviewHint,
    safetyNote: approval.safetyNote,
    approvalKeyAvailable: Boolean(approval.approvalKey),
    retryConfigAvailable: Boolean(approval.retryConfigPatch),
    reviewBoundary: approval.reviewBoundary,
  }));
  const diagnosticFlowSteps = flowSteps.map((step) => ({
    type: step.type,
    name: step.name,
    result: step.result,
    resultClass: step.resultClass,
    detail: step.detail,
    stepNumber:
      Number.isInteger(step.stepIndex) && step.stepIndex !== undefined
        ? step.stepIndex + 1
        : undefined,
    time: step.time,
  }));
  const diagnosticTraceSpans = buildDiagnosticTraceSpans(thoughtProcess, {
    generatedAt,
    status,
    severity,
    summary,
  });
  const schemaBoundary: AgentDiagnosticSchemaBoundary = {
    schemaName: 'personal_ai_agent_thinking_diagnostics',
    schemaVersion: 1,
    spanLineage: [
      'OpenTelemetry GenAI-inspired agent.run / execute_tool span naming',
      'LangSmith / Langfuse-inspired step, tool, and decision grouping',
      'Personal AI privacy-preserving run review metadata',
    ],
    exporterStatus: 'local_only_not_standard_export',
    supportedUses: [
      'local debugging',
      'eval fixtures',
      'support handoff without raw tool payloads',
    ],
    unsupportedUses: [
      'direct OpenTelemetry ingestion',
      'direct LangSmith or Langfuse import',
      'tool approval, rejection, or run resume',
    ],
    approvalContextBoundary:
      'This diagnostics packet only says approvals exist. Use the per-action approval review packet or retry config for approval context.',
  };
  const snapshotBoundary: AgentDiagnosticSnapshotBoundary = {
    generatedAt,
    status,
    statusLabel: AGENT_RUN_STATUS_LABELS[status],
    source: 'current_page_trace_snapshot',
    copySemantics:
      'This diagnostics packet is a point-in-time snapshot of the trace currently rendered on the Options page.',
    notLive:
      'It will not subscribe to later tool results, approval decisions, retries, or reruns.',
    refreshBoundary:
      'Refresh the page, rerun the Agent, or copy a new packet after the trace changes.',
  };
  const traceIdentity = buildAgentDiagnosticTraceIdentity({
    generatedAt,
    status,
    severity,
    summary,
    reviewItems: diagnosticReviewItems,
    pendingApprovals: diagnosticPendingApprovals,
    traceSpans: diagnosticTraceSpans,
    schemaBoundary,
    snapshotBoundary,
  });
  const navigationReceipt = buildAgentTraceNavigationReceipt({
    traceIdentity,
    status,
    summary,
    reviewItems: diagnosticReviewItems,
    pendingApprovals: diagnosticPendingApprovals,
    traceSpans: diagnosticTraceSpans,
    snapshotBoundary,
  });
  const traceSpanComposition = buildAgentTraceSpanComposition(
    diagnosticTraceSpans,
  );
  const approvalQueueReceipt = buildAgentApprovalQueueReceipt({
    traceIdentity,
    pendingApprovals: diagnosticPendingApprovals,
  });
  const resultHandoffReceipt = buildAgentResultHandoffReceipt({
    status,
    summary,
    snapshotBoundary,
    isProcessing: options.isProcessing,
  });

  return {
    type: 'agent_thinking_run_diagnostics',
    version: 1,
    generatedAt,
    traceIdentity,
    status,
    severity,
    summary,
    reviewItems: diagnosticReviewItems,
    pendingApprovals: diagnosticPendingApprovals,
    approvalQueueReceipt: approvalQueueReceipt || undefined,
    flowSteps: diagnosticFlowSteps,
    navigationReceipt,
    traceSpans: diagnosticTraceSpans,
    traceSpanComposition,
    resultHandoffReceipt: resultHandoffReceipt || undefined,
    schemaBoundary,
    snapshotBoundary,
    privacyNote:
      'This packet omits raw tool results, approval keys, and tool parameters. traceSpans are structured for diagnostics/evals, not a full OpenTelemetry export. navigationReceipt.stepRoutes records first-screen route reasons for prioritized local step inspection. traceSpanComposition summarizes the local span shape without adding standard exporter semantics. approvalQueueReceipt summarizes current-page pending approvals only, not a durable checkpoint. resultHandoffReceipt appears only when a terminal trace is still waiting for the result card. traceIdentity is a local checksum for matching this sanitized snapshot only. schemaBoundary records the local-only export contract. snapshotBoundary records that this is a point-in-time page snapshot. Use the approval review packet for action-specific approval context.',
  };
}

const AGENT_RUN_STATUS_LABELS: Record<AgentRunDiagnosticStatus, string> = {
  empty: '无记录',
  running: '运行中',
  finished: '已完成',
  max_actions_reached: '预算耗尽',
  stopped: '已停止',
  missing_terminal: '缺少完成状态',
};

const AGENT_RUN_TERMINAL_ACTION_LABELS: Record<string, string> = {
  finish: '最终决策',
  max_actions_reached: '预算耗尽',
  stopped: '已停止',
};

export function buildAgentResultHandoffReceipt(input: {
  status: AgentRunDiagnosticStatus;
  summary: AgentRunDiagnosticPacket['summary'];
  snapshotBoundary: AgentDiagnosticSnapshotBoundary;
  isProcessing?: boolean;
}): AgentResultHandoffReceipt | null {
  if (
    !input.isProcessing ||
    !input.summary.terminalAction ||
    input.status === 'running' ||
    input.status === 'missing_terminal' ||
    input.status === 'empty'
  ) {
    return null;
  }

  const terminalLabel =
    AGENT_RUN_TERMINAL_ACTION_LABELS[input.summary.terminalAction] ||
    input.summary.terminalAction;
  const terminalStep = input.summary.terminalStepNumber
    ? `步骤 #${input.summary.terminalStepNumber}`
    : '终止步骤';
  const issueParts: string[] = [];
  if (input.summary.pendingApprovalCount > 0) {
    issueParts.push(`${input.summary.pendingApprovalCount} 个待确认动作`);
  }
  if (input.summary.toolErrorCount > 0) {
    issueParts.push(`${input.summary.toolErrorCount} 个工具失败步骤`);
  }
  if (input.summary.blockedCount > 0) {
    issueParts.push(`${input.summary.blockedCount} 个已阻断工具步骤`);
  }
  if (input.summary.emptyEvidenceCount > 0) {
    issueParts.push(`${input.summary.emptyEvidenceCount} 个证据不足步骤`);
  }
  const unresolvedIssueSummary =
    issueParts.length > 0
      ? `整理前仍有 ${issueParts.join('、')}，需要按运行检查复核。`
      : '当前 trace 没有待确认、工具失败、阻断或证据不足步骤；等待结果摘要卡片完成渲染。';

  return {
    title: '结果整理中',
    traceState: `Trace 已到达 ${terminalStep}（${terminalLabel}），状态快照为 ${input.snapshotBoundary.statusLabel}，生成于 ${input.snapshotBoundary.generatedAt}。`,
    resultState:
      '结果摘要卡片仍在生成；在它出现前，不要把当前页面解读成最终已交付结果。',
    unresolvedIssueSummary,
    inspectionRoute: input.summary.terminalStepNumber
      ? `可先定位终止步骤 #${input.summary.terminalStepNumber}，只展开当前页面时间线里的这个步骤。`
      : '当前没有可定位的终止步骤按钮；继续使用运行检查里的步骤链接复核。',
    boundary:
      '这个整理状态不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作；待确认和工具问题仍按运行检查处理。',
    terminalStepNumber: input.summary.terminalStepNumber,
  };
}

const appendCountChip = (
  chips: AgentRunSnapshotChip[],
  label: string,
  count: number,
  tone: AgentRunSnapshotChipTone,
) => {
  if (count <= 0) return;
  chips.push({
    label,
    value: String(count),
    tone,
  });
};

export function buildAgentRunSnapshot(
  packet: AgentRunDiagnosticPacket,
): AgentRunSnapshot {
  const statusLabel = AGENT_RUN_STATUS_LABELS[packet.status];
  const primaryReviewItem =
    packet.reviewItems.find((item) => item.severity !== 'ok') ||
    packet.reviewItems[0];
  const terminalActionLabel = packet.summary.terminalAction
    ? AGENT_RUN_TERMINAL_ACTION_LABELS[packet.summary.terminalAction] ||
      packet.summary.terminalAction
    : '';
  const terminalDetail = packet.summary.terminalStepNumber
    ? `终止于步骤 #${packet.summary.terminalStepNumber}${
        terminalActionLabel ? `（${terminalActionLabel}）` : ''
      }。`
    : packet.status === 'running'
      ? '还在等待终止步骤。'
      : '没有记录终止步骤。';
  const toolsDetail =
    packet.summary.toolsInvolved.length > 0
      ? `涉及 ${packet.summary.toolsInvolved.length} 个工具。`
      : '没有工具调用。';
  const chips: AgentRunSnapshotChip[] = [
    {
      label: '状态',
      value: statusLabel,
      tone: packet.severity,
    },
    {
      label: '步骤',
      value: String(packet.summary.stepCount),
      tone: 'neutral',
    },
    {
      label: 'Trace spans',
      value: String(packet.traceSpans.length),
      tone: 'neutral',
    },
    {
      label: '本地 trace',
      value: packet.traceIdentity.traceId.replace('pai-agent-trace-', ''),
      tone: 'neutral',
    },
  ];

  appendCountChip(chips, '失败', packet.summary.toolErrorCount, 'critical');
  appendCountChip(
    chips,
    '待确认动作',
    packet.summary.pendingApprovalCount,
    'warning',
  );
  appendCountChip(chips, '阻断', packet.summary.blockedCount, 'warning');
  appendCountChip(chips, '缺证', packet.summary.emptyEvidenceCount, 'warning');
  appendCountChip(chips, '跳过', packet.summary.skippedCount, 'info');
  appendCountChip(
    chips,
    '工具',
    packet.summary.toolsInvolved.length,
    'neutral',
  );

  return {
    statusLabel,
    detail: `${terminalDetail} ${toolsDetail}`.trim(),
    primaryAction: primaryReviewItem?.action || '查看时间线和工具证据。',
    chips,
  };
}

const buildAgentTraceStatusDetail = (
  packet: Pick<AgentRunDiagnosticPacket, 'status'>,
) => {
  if (packet.status === 'finished') {
    return '已到达最终决策；仍可按工具证据和审批边界复核。';
  }
  if (packet.status === 'max_actions_reached') {
    return '预算已用完；剩余审批、阻断或缺证应先于结论外发处理。';
  }
  if (packet.status === 'running') {
    return '仍在运行；当前 trace 只是中间快照。';
  }
  if (packet.status === 'stopped') {
    return '用户已停止；只代表停止前收集到的证据。';
  }
  if (packet.status === 'missing_terminal') {
    return '缺少 finish / stopped / max_actions_reached 终止步骤。';
  }
  return '没有可复核的 trace 步骤。';
};

type AgentTraceNavigationReceiptSource = Pick<
  AgentRunDiagnosticPacket,
  | 'traceIdentity'
  | 'status'
  | 'summary'
  | 'reviewItems'
  | 'pendingApprovals'
  | 'traceSpans'
  | 'snapshotBoundary'
>;

const stepNumbersToIndexes = (...stepNumberGroups: number[][]) =>
  Array.from(
    new Set(
      stepNumberGroups
        .flat()
        .filter((stepNumber) => Number.isInteger(stepNumber) && stepNumber > 0)
        .map((stepNumber) => stepNumber - 1),
    ),
  ).sort((a, b) => a - b);

const mergeStepRoutes = (
  ...routeGroups: AgentTraceStepRoute[][]
): AgentTraceStepRoute[] => {
  const reasonsByStep = new Map<number, string[]>();

  routeGroups.flat().forEach((route) => {
    if (!Number.isInteger(route.stepNumber) || route.stepNumber <= 0) return;
    const reason = route.reason.trim();
    const existingReasons = reasonsByStep.get(route.stepNumber) || [];
    if (reason && !existingReasons.includes(reason)) {
      existingReasons.push(reason);
    }
    reasonsByStep.set(route.stepNumber, existingReasons);
  });

  return Array.from(reasonsByStep.entries())
    .sort(([leftStep], [rightStep]) => leftStep - rightStep)
    .map(([stepNumber, reasons]) => ({
      stepNumber,
      reason: reasons.join('；'),
    }));
};

const stepRoutesToIndexes = (routes: AgentTraceStepRoute[]) =>
  stepNumbersToIndexes(routes.map((route) => route.stepNumber));

const buildReviewItemStepRoutes = (
  reviewItems: AgentTraceNavigationReceiptSource['reviewItems'],
  titles: string[],
) =>
  mergeStepRoutes(
    ...reviewItems
      .filter((item) => titles.includes(item.title))
      .map((item) =>
        item.stepNumbers.map((stepNumber) => ({
          stepNumber,
          reason: `${item.title}：${item.action}`,
        })),
      ),
  );

const buildTerminalStepRoutes = (
  packet: Pick<AgentTraceNavigationReceiptSource, 'summary' | 'status'>,
): AgentTraceStepRoute[] =>
  packet.summary.terminalStepNumber
    ? [
        {
          stepNumber: packet.summary.terminalStepNumber,
          reason: `运行状态：${buildAgentTraceStatusDetail(packet)}`,
        },
      ]
    : [];

const buildApprovalStepRoutes = (
  pendingApprovals: AgentTraceNavigationReceiptSource['pendingApprovals'],
): AgentTraceStepRoute[] =>
  pendingApprovals.map((approval) => ({
    stepNumber: approval.stepNumber,
    reason: `审批上下文：${approval.toolId} 尚未执行，需使用单个动作审核包或重跑配置复核。`,
  }));

export function buildAgentTraceNavigationReceipt(
  packet: AgentTraceNavigationReceiptSource,
): AgentTraceNavigationReceipt {
  const issueStepRoutes = mergeStepRoutes(
    buildTerminalStepRoutes(packet),
    buildApprovalStepRoutes(packet.pendingApprovals),
    buildReviewItemStepRoutes(
      packet.reviewItems,
      [
        '工具调用失败',
        '需要人工确认',
        '工具被阻断',
        '工具证据不足',
        '行动次数用完',
      ],
    ),
  );
  const issueStepNumbers = issueStepRoutes.map((route) => route.stepNumber);
  const statusLabel = AGENT_RUN_STATUS_LABELS[packet.status];
  const toolIssueParts = [
    packet.summary.toolErrorCount > 0
      ? `失败 ${packet.summary.toolErrorCount}`
      : '',
    packet.summary.pendingApprovalCount > 0
      ? `待确认 ${packet.summary.pendingApprovalCount}`
      : '',
    packet.summary.blockedCount > 0
      ? `阻断 ${packet.summary.blockedCount}`
      : '',
    packet.summary.emptyEvidenceCount > 0
      ? `缺证 ${packet.summary.emptyEvidenceCount}`
      : '',
  ].filter(Boolean);

  return {
    title: '当前 trace 导航',
    currentTrace:
      `当前 trace ${packet.traceIdentity.traceId}（${statusLabel}，生成于 ${packet.snapshotBoundary.generatedAt}）。`,
    primaryRoute:
      toolIssueParts.length > 0
        ? `先处理 ${toolIssueParts.join(' / ')}，再阅读完整时间线或复制诊断包。`
        : '没有待处理工具问题；可直接阅读时间线或复制诊断包做交接。',
    stepScope:
      issueStepNumbers.length > 0
        ? `本页共 ${packet.summary.stepCount} 步 / ${packet.traceSpans.length} 个 span；首屏可直接跳到步骤 ${issueStepNumbers.map((stepNumber) => `#${stepNumber}`).join('、')}。`
        : `本页共 ${packet.summary.stepCount} 步 / ${packet.traceSpans.length} 个 span；当前没有需要优先定位的问题步骤。`,
    noEffectBoundary:
      '点击步骤定位只展开当前页面时间线，不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作。',
    stepNumbers: issueStepNumbers,
    stepRoutes: issueStepRoutes,
  };
}

export function buildAgentTraceSpanComposition(
  traceSpans: AgentDiagnosticTraceSpan[],
): AgentTraceSpanComposition {
  const countByOperation = (operationName: AgentDiagnosticSpanOperation) =>
    traceSpans.filter((span) => span.operationName === operationName).length;
  const runSpanCount = countByOperation('agent.run');
  const stepSpanCount = countByOperation('agent.step');
  const toolSpanCount = countByOperation('execute_tool');
  const decisionSpanCount = countByOperation('agent.decision');
  const issueSpanCount = traceSpans.filter((span) =>
    TRACE_ISSUE_STATUSES.includes(span.status.code),
  ).length;
  const issueStepNumbers = Array.from(
    new Set(
      traceSpans
        .filter((span) => TRACE_ISSUE_STATUSES.includes(span.status.code))
        .map((span) => span.stepNumber)
        .filter(
          (stepNumber): stepNumber is number =>
            Number.isInteger(stepNumber) && stepNumber > 0,
        ),
    ),
  ).sort((a, b) => a - b);
  const issueTone: AgentRunSnapshotChipTone = traceSpans.some(
    (span) => span.status.code === 'error',
  )
    ? 'critical'
    : issueSpanCount > 0
      ? 'warning'
      : 'ok';

  return {
    title: 'Trace span 构成',
    detail: `这份本地 trace 由 ${traceSpans.length} 个 span 组成；先看工具执行和问题 span，再决定是否复制诊断包。`,
    items: [
      {
        key: 'run',
        label: 'Root run',
        value: `${runSpanCount}`,
        detail: '运行级状态、终止动作和工具计数入口。',
        tone: 'neutral',
      },
      {
        key: 'steps',
        label: 'Agent steps',
        value: `${stepSpanCount}`,
        detail: '非终止步骤，用于定位分析、工具前后状态和证据口径。',
        tone: 'neutral',
      },
      {
        key: 'tools',
        label: 'Tool calls',
        value: `${toolSpanCount}`,
        detail: '工具执行 span；保留工具名、状态和证据/审批状态，不含原始参数或结果。',
        tone: toolSpanCount > 0 ? 'info' : 'neutral',
      },
      {
        key: 'decision',
        label: 'Terminal',
        value: `${decisionSpanCount}`,
        detail: 'finish、stopped 或 max_actions_reached 终止决策 span。',
        tone: decisionSpanCount > 0 ? 'neutral' : 'warning',
      },
      {
        key: 'issues',
        label: '问题 span',
        value: `${issueSpanCount}`,
        detail:
          issueStepNumbers.length > 0
            ? `只统计失败、待确认、阻断和缺证 span；对应步骤 ${issueStepNumbers.map((stepNumber) => `#${stepNumber}`).join('、')}。`
            : '只统计失败、待确认、阻断和缺证 span；不把 root、跳过或普通 OK span 当成待处理问题。',
        tone: issueTone,
        stepNumbers: issueStepNumbers,
      },
    ],
    boundary:
      '这是 Personal AI 本地 span 构成，不是标准 OpenTelemetry / LangSmith / Langfuse 拓扑；查看或复制它不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。',
  };
}

export function buildAgentTraceReviewLane(
  packet: AgentRunDiagnosticPacket,
): AgentTraceReviewLane {
  const statusLabel = AGENT_RUN_STATUS_LABELS[packet.status];
  const terminalStepRoutes = buildTerminalStepRoutes(packet);
  const approvalStepRoutes = buildApprovalStepRoutes(packet.pendingApprovals);
  const toolIssueStepRoutes = buildReviewItemStepRoutes(
    packet.reviewItems,
    ['工具调用失败', '工具被阻断', '工具证据不足'],
  );
  const terminalStepIndexes = stepRoutesToIndexes(terminalStepRoutes);
  const approvalStepIndexes = stepRoutesToIndexes(approvalStepRoutes);
  const toolIssueStepIndexes = stepRoutesToIndexes(toolIssueStepRoutes);
  const allNavigationStepRoutes = mergeStepRoutes(
    terminalStepRoutes,
    approvalStepRoutes,
    toolIssueStepRoutes,
  );
  const openToolIssueCount =
    packet.summary.toolErrorCount +
    packet.summary.blockedCount +
    packet.summary.emptyEvidenceCount;
  const openToolIssueParts = [
    packet.summary.toolErrorCount > 0
      ? `失败 ${packet.summary.toolErrorCount}`
      : '',
    packet.summary.blockedCount > 0
      ? `阻断 ${packet.summary.blockedCount}`
      : '',
    packet.summary.emptyEvidenceCount > 0
      ? `缺证 ${packet.summary.emptyEvidenceCount}`
      : '',
  ].filter(Boolean);

  return {
    title: 'Trace 复核路线',
    detail:
      '先分清运行状态、审批上下文、工具证据和本地诊断包；复制诊断包不等于批准、恢复或外部写入。',
    items: [
      {
        key: 'status',
        label: '运行状态',
        value: statusLabel,
        detail: buildAgentTraceStatusDetail(packet),
        tone: packet.severity,
        stepIndexes: terminalStepIndexes,
        stepRoutes: terminalStepRoutes,
      },
      {
        key: 'approval',
        label: '审批上下文',
        value:
          packet.summary.pendingApprovalCount > 0
            ? `${packet.summary.pendingApprovalCount} 个待确认`
            : '无待确认',
        detail:
          packet.summary.pendingApprovalCount > 0
            ? '审批仍走单个待确认动作的审核包或重跑配置；诊断包不含批准 key。'
            : '没有待确认动作；诊断包也不会生成审批或执行凭据。',
        tone: packet.summary.pendingApprovalCount > 0 ? 'warning' : 'ok',
        stepIndexes: approvalStepIndexes,
        stepRoutes: approvalStepRoutes,
      },
      {
        key: 'tool_issues',
        label: '工具证据',
        value:
          openToolIssueCount > 0
            ? openToolIssueParts.join(' / ')
            : '无阻塞问题',
        detail:
          openToolIssueCount > 0
            ? '失败、阻断或缺证需要回到涉及步骤复核，不能只看最终摘要。'
            : '未发现失败、阻断或空证据工具步骤。',
        tone:
          packet.summary.toolErrorCount > 0
            ? 'critical'
            : openToolIssueCount > 0
              ? 'warning'
              : 'ok',
        stepIndexes: toolIssueStepIndexes,
        stepRoutes: toolIssueStepRoutes,
      },
      {
        key: 'diagnostics',
        label: '诊断包',
        value: `${packet.traceSpans.length} spans`,
        detail:
          allNavigationStepRoutes.length > 0
            ? `仅是当前页面本地快照；会保留 ${allNavigationStepRoutes.length} 个优先步骤的复核理由，但不复制原始工具结果、工具参数或批准 key。`
            : '仅是当前页面本地快照；不复制原始工具结果、工具参数或批准 key。',
        tone: 'neutral',
      },
    ],
  };
}

export function buildAgentDiagnosticCopyScope(
  packet: AgentRunDiagnosticPacket,
): AgentDiagnosticCopyScope {
  const pendingApprovalSummary =
    packet.summary.pendingApprovalCount > 0
      ? `${packet.summary.pendingApprovalCount} 个待确认动作摘要`
      : '无待确认动作摘要';

  return {
    title: '诊断包范围',
    detail: `包含 ${packet.traceSpans.length} 个结构化 trace span、${packet.reviewItems.length} 条运行检查和 ${pendingApprovalSummary}，用于排障或 eval。`,
    identityBoundary:
      `本地 trace id ${packet.traceIdentity.traceId}，校验 ${packet.traceIdentity.checksum}；只用于匹配这份复制 JSON 和当前页面快照。`,
    freshnessBoundary:
      `生成于 ${packet.snapshotBoundary.generatedAt}，状态 ${packet.snapshotBoundary.statusLabel}；复制的是当前页面快照，不会随审批、重跑或后续工具结果自动更新。`,
    privacyBoundary: '不会复制原始工具结果、工具参数或批准 key。',
    exportBoundary:
      '这是 Personal AI 本地诊断包，不是 OpenTelemetry / LangSmith / Langfuse 标准导出。',
    schemaBoundary:
      `${packet.schemaBoundary.schemaName} v${packet.schemaBoundary.schemaVersion}；span 命名参考 OTel GenAI，分组参考 LangSmith / Langfuse，但不能直接导入这些平台。`,
    approvalBoundary:
      '本地 trace id 不能用于标准追踪关联、恢复 run 或审批动作；需要审批上下文时，仍使用单个待确认动作的审核包或重跑配置。',
  };
}

export function buildAgentDiagnosticCopyPreflight(
  packet: AgentRunDiagnosticPacket,
): AgentDiagnosticCopyPreflight {
  const shortTraceId = packet.traceIdentity.checksum;
  const pendingApprovalSummary =
    packet.summary.pendingApprovalCount > 0
      ? `${packet.summary.pendingApprovalCount} 个待确认动作摘要`
      : '无待确认动作摘要';
  const statusTone: AgentRunSnapshotChipTone =
    packet.status === 'running' ? 'info' : packet.severity;
  const freshnessValue =
    packet.status === 'running'
      ? `运行中快照，生成于 ${packet.snapshotBoundary.generatedAt}；后续步骤不会自动进入这份复制内容。`
      : `生成于 ${packet.snapshotBoundary.generatedAt}，状态 ${packet.snapshotBoundary.statusLabel}。`;

  return {
    title: '诊断包复制预检',
    detail:
      `准备复制当前页面 trace ${shortTraceId} 的本地诊断 JSON；复制只产生文本，不会批准、恢复或执行工具。`,
    items: [
      {
        label: '复制对象',
        value: `${packet.traceSpans.length} 个 trace span / ${packet.snapshotBoundary.statusLabel} / ${pendingApprovalSummary}`,
        tone: statusTone,
      },
      {
        label: '可用于',
        value: '本地排障、eval fixture、支持交接；不含原始工具结果、工具参数或批准 key。',
        tone: 'neutral',
      },
      {
        label: '不会发生',
        value: '不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作。',
        tone: packet.summary.pendingApprovalCount > 0 ? 'warning' : 'neutral',
      },
      {
        label: '新鲜度',
        value: freshnessValue,
        tone: packet.status === 'running' ? 'info' : 'neutral',
      },
      {
        label: '导出边界',
        value: '这是 Personal AI 本地 schema，不能直接导入 OpenTelemetry / LangSmith / Langfuse。',
        tone: 'neutral',
      },
    ],
  };
}

export function buildAgentDiagnosticCopySuccessReceipt(
  packet: AgentRunDiagnosticPacket,
) {
  return [
    `已复制诊断包：${packet.traceSpans.length} 个 trace span，状态 ${packet.snapshotBoundary.statusLabel}，本地 trace ${packet.traceIdentity.checksum}。`,
    '这是当前页面快照；未复制原始工具结果、工具参数或批准 key。',
    '本地 trace id 只用于匹配这份 JSON；审批或恢复仍使用单个待确认动作的审核包或重跑配置。',
  ].join(' ');
}

export function buildAgentDiagnosticCopiedSnapshot(
  packet: AgentRunDiagnosticPacket,
): AgentDiagnosticCopiedSnapshot {
  return {
    traceId: packet.traceIdentity.traceId,
    checksum: packet.traceIdentity.checksum,
    generatedAt: packet.snapshotBoundary.generatedAt,
    statusLabel: packet.snapshotBoundary.statusLabel,
    traceSpanCount: packet.traceSpans.length,
  };
}

export function buildAgentDiagnosticCopyFreshnessReceipt(
  copiedSnapshot: AgentDiagnosticCopiedSnapshot,
  currentPacket: AgentRunDiagnosticPacket | null,
) {
  if (!currentPacket) {
    return [
      `旧诊断包回执：上次复制内容仍是 ${copiedSnapshot.traceId}（${copiedSnapshot.statusLabel}，${copiedSnapshot.traceSpanCount} 个 span，生成于 ${copiedSnapshot.generatedAt}）。`,
      '当前页面没有可匹配的 trace；重新运行并复制新诊断包后再用于排障或 eval。',
    ].join(' ');
  }

  if (copiedSnapshot.traceId === currentPacket.traceIdentity.traceId) {
    return [
      `当前诊断包回执：上次复制内容仍匹配当前页面 ${copiedSnapshot.traceId}（${copiedSnapshot.statusLabel}，${copiedSnapshot.traceSpanCount} 个 span）。`,
      '它仍只是本地快照，不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。',
    ].join(' ');
  }

  return [
    `旧诊断包回执：上次复制内容仍是 ${copiedSnapshot.traceId}（${copiedSnapshot.statusLabel}，${copiedSnapshot.traceSpanCount} 个 span，生成于 ${copiedSnapshot.generatedAt}）。`,
    `当前页面已经变为 ${currentPacket.traceIdentity.traceId}（${currentPacket.snapshotBoundary.statusLabel}，${currentPacket.traceSpans.length} 个 span）。`,
    '请重新复制后再用于排障或 eval；旧包不会随新步骤、审批、重跑或后续工具结果更新。',
  ].join(' ');
}
