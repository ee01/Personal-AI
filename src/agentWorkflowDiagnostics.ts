export type AgentWorkflowDiagnosticSeverity = 'error' | 'warning' | 'info';
export type AgentWorkflowDecisionPathStatus =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'muted';
export type AgentWorkflowRecommendedActionStatus =
  | 'review'
  | 'fix'
  | 'optimize'
  | 'verify'
  | 'done';
export type AgentWorkflowReadinessStatus =
  | 'ready'
  | 'review'
  | 'blocked'
  | 'skipped';
export type AgentWorkflowRunVerdictStatus =
  | 'ready'
  | 'review'
  | 'blocked'
  | 'idle';

export interface AgentWorkflowDiagnostic {
  id: string;
  severity: AgentWorkflowDiagnosticSeverity;
  title: string;
  message: string;
  detail?: string;
}

export interface AgentWorkflowDecisionPathItem {
  id: string;
  status: AgentWorkflowDecisionPathStatus;
  title: string;
  summary: string;
  detail?: string;
}

export interface AgentWorkflowRecommendedAction {
  id: string;
  status: AgentWorkflowRecommendedActionStatus;
  title: string;
  summary: string;
  detail?: string;
}

export interface AgentWorkflowReadinessCheck {
  id: string;
  status: AgentWorkflowReadinessStatus;
  title: string;
  summary: string;
  detail?: string;
}

export interface AgentWorkflowRunVerdict {
  status: AgentWorkflowRunVerdictStatus;
  title: string;
  summary: string;
  detail?: string;
  actionLabel?: string;
}

export interface AgentWorkflowAgentLike {
  id?: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  tools?: string[];
}

export interface AgentWorkflowTraceToolLike {
  name?: string;
  displayName?: string;
  status?: string;
  durationMs?: number;
  summary?: string;
  error?: string;
}

export interface AgentWorkflowTraceStepLike {
  agentId?: string;
  agentName?: string;
  priority?: number;
  status?: string;
  durationMs?: number;
  tools?: AgentWorkflowTraceToolLike[];
  outputSummary?: string;
  error?: string;
}

export interface AgentWorkflowResultLike {
  shouldStore?: boolean;
  shouldNotify?: boolean;
  confidence?: number | string;
  summary?: string;
  matchedRule?: string;
  matchedRuleRefs?: string[];
  matchedRuleIds?: number[];
  agentWorkflowTrace?: AgentWorkflowTraceStepLike[];
  storageReview?: {
    summary?: string;
    primaryReason?: string;
    reasonSource?: string;
    shouldStore?: boolean;
    shouldNotify?: boolean;
    confidence?: number | string;
    matchedRuleRefs?: string[];
    matchedRuleIds?: number[];
    traceStatus?: string;
    failedAgents?: string[];
    toolErrorCount?: number;
    toolSkippedCount?: number;
  };
  notificationReview?: {
    required?: boolean;
    message?: string;
  };
}

const SLOW_AGENT_MS = 12000;
const SLOW_TOOL_MS = 5000;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getAgentLabel(agent: AgentWorkflowAgentLike): string {
  return agent.name || agent.id || '未命名 Agent';
}

function getTraceStepLabel(step: AgentWorkflowTraceStepLike): string {
  return step.agentName || step.agentId || '未知 Agent';
}

function getToolLabel(tool: AgentWorkflowTraceToolLike): string {
  return tool.displayName || tool.name || '未知工具';
}

export function normalizeAgentWorkflowConfidence(
  value?: number | string | null,
): number | null {
  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim().replace(/%$/, '');
    if (!normalized) return null;
    numeric = Number(normalized);
  } else {
    return null;
  }

  if (!Number.isFinite(numeric)) return null;
  const normalized = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, normalized));
}

function getConfidenceLabel(confidence?: number | string | null): string {
  const normalized = normalizeAgentWorkflowConfidence(confidence);
  if (normalized === null) {
    return '';
  }
  return `${Math.round(normalized * 100)}%`;
}

function getMatchedRuleLabel(result: AgentWorkflowResultLike): string {
  const refs = Array.isArray(result.matchedRuleRefs)
    ? result.matchedRuleRefs
    : [];
  if (refs.length > 0) return refs.join('、');

  const ids = Array.isArray(result.matchedRuleIds) ? result.matchedRuleIds : [];
  if (ids.length > 0) return ids.join('、');

  const storageRefs = Array.isArray(result.storageReview?.matchedRuleRefs)
    ? result.storageReview.matchedRuleRefs
    : [];
  if (storageRefs.length > 0) return storageRefs.join('、');

  const storageIds = Array.isArray(result.storageReview?.matchedRuleIds)
    ? result.storageReview.matchedRuleIds
    : [];
  if (storageIds.length > 0) return storageIds.join('、');

  return result.matchedRule || '';
}

function getTrace(result: AgentWorkflowResultLike): AgentWorkflowTraceStepLike[] {
  return Array.isArray(result.agentWorkflowTrace)
    ? result.agentWorkflowTrace
    : [];
}

function getTraceIssueSummary(trace: AgentWorkflowTraceStepLike[]): {
  failedSteps: AgentWorkflowTraceStepLike[];
  skippedToolCount: number;
  toolErrorCount: number;
  slowStepLabels: string[];
  slowToolLabels: string[];
  externalPlaceholderLabels: string[];
} {
  const failedSteps = trace.filter((step) => step.status === 'error');
  const skippedToolCount = trace.reduce(
    (count, step) =>
      count +
      (step.tools || []).filter((tool) => tool.status === 'skipped').length,
    0,
  );
  const toolErrorCount = trace.reduce(
    (count, step) =>
      count +
      (step.tools || []).filter((tool) => tool.status === 'error').length,
    0,
  );
  const slowStepLabels = trace
    .filter(
      (step) =>
        typeof step.durationMs === 'number' && step.durationMs >= SLOW_AGENT_MS,
    )
    .map(
      (step) =>
        `${getTraceStepLabel(step)} ${Math.round(step.durationMs || 0)}ms`,
    );
  const slowToolLabels = trace.flatMap((step) =>
    (step.tools || [])
      .filter(
        (tool) =>
          typeof tool.durationMs === 'number' && tool.durationMs >= SLOW_TOOL_MS,
      )
      .map(
        (tool) =>
          `${getTraceStepLabel(step)} / ${getToolLabel(tool)} ${Math.round(
            tool.durationMs || 0,
          )}ms`,
      ),
  );
  const externalPlaceholderLabels = uniq(
    trace.flatMap((step) =>
      (step.tools || [])
        .filter((tool) => {
          if (tool.name !== 'externalServiceQuery') return false;
          const summary = String(tool.summary || '');
          return (
            tool.status === 'skipped' ||
            tool.status === 'error' ||
            /success=false|unsupported|不支持|缺少参数|placeholder|占位/.test(
              summary,
            )
          );
        })
        .map((tool) => `${getTraceStepLabel(step)} / ${getToolLabel(tool)}`),
    ),
  );

  return {
    failedSteps,
    skippedToolCount,
    toolErrorCount,
    slowStepLabels,
    slowToolLabels,
    externalPlaceholderLabels,
  };
}

function getStorageReasonSourceLabel(reasonSource?: string): string {
  const labels: Record<string, string> = {
    concernedItemMatcher: '关注项匹配',
    relevanceJudgment: '重要性判断',
    message: '消息摘要',
    workflow: '工作流默认',
  };
  return reasonSource ? labels[reasonSource] || reasonSource : '';
}

function getEnabledAgents(agents: AgentWorkflowAgentLike[]) {
  return agents
    .filter((agent) => agent.enabled !== false)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function buildAgentWorkflowConfigDiagnostics(
  agents: AgentWorkflowAgentLike[] = [],
  availableToolNames: string[] = [],
): AgentWorkflowDiagnostic[] {
  const diagnostics: AgentWorkflowDiagnostic[] = [];
  const enabledAgents = getEnabledAgents(agents);
  const availableTools = new Set(availableToolNames);

  if (enabledAgents.length === 0) {
    diagnostics.push({
      id: 'no-enabled-agents',
      severity: 'error',
      title: '没有启用 Agent',
      message: 'Agent Workflow 当前不会处理任何阶段，请至少启用一个 Agent。',
    });
  }

  const idCounts = new Map<string, number>();
  agents.forEach((agent) => {
    const id = String(agent.id || '').trim();
    if (!id) return;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  if (duplicateIds.length > 0) {
    diagnostics.push({
      id: 'duplicate-agent-ids',
      severity: 'error',
      title: 'Agent ID 重复',
      message: `重复 ID 会让 trace 和配置难以定位：${duplicateIds.join('、')}`,
    });
  }

  const noToolAgents = enabledAgents.filter((agent) => {
    return !Array.isArray(agent.tools) || agent.tools.length === 0;
  });
  if (noToolAgents.length > 0) {
    diagnostics.push({
      id: 'enabled-agent-without-tools',
      severity: 'warning',
      title: '启用 Agent 没有工具',
      message: noToolAgents.map(getAgentLabel).join('、'),
    });
  }

  const unknownTools = uniq(
    enabledAgents.flatMap((agent) =>
      (agent.tools || []).filter((tool) => !availableTools.has(tool)),
    ),
  );
  if (unknownTools.length > 0) {
    diagnostics.push({
      id: 'unknown-tools',
      severity: 'warning',
      title: '存在未注册工具',
      message: `这些工具会在运行时被跳过：${unknownTools.join('、')}`,
    });
  }

  const firstEntityIndex = enabledAgents.findIndex((agent) =>
    (agent.tools || []).includes('entityExtraction'),
  );
  const firstRelationshipIndex = enabledAgents.findIndex((agent) =>
    (agent.tools || []).includes('relationshipAnalysis'),
  );
  if (
    firstRelationshipIndex >= 0 &&
    (firstEntityIndex < 0 || firstEntityIndex > firstRelationshipIndex)
  ) {
    diagnostics.push({
      id: 'relationship-before-entity',
      severity: 'warning',
      title: '关系分析缺少前置实体',
      message: '关系分析依赖实体识别结果，应确保实体提取阶段先执行。',
    });
  }

  const externalAgents = enabledAgents.filter((agent) =>
    (agent.tools || []).includes('externalServiceQuery'),
  );
  if (externalAgents.length > 0) {
    diagnostics.push({
      id: 'external-query-placeholder',
      severity: 'info',
      title: '外部查询仍是占位实现',
      message: `${externalAgents.map(getAgentLabel).join('、')} 不会读取真实 Jira/Wiki 数据。`,
    });
  }

  return diagnostics;
}

export function buildAgentWorkflowResultDiagnostics(
  result?: AgentWorkflowResultLike | null,
): AgentWorkflowDiagnostic[] {
  if (!result) return [];

  const diagnostics: AgentWorkflowDiagnostic[] = [];
  const trace = getTrace(result);
  const matchedRuleLabel = getMatchedRuleLabel(result);

  if (result.notificationReview?.required) {
    diagnostics.push({
      id: 'notification-review-required',
      severity: 'warning',
      title: '通知已转待复核',
      message:
        result.notificationReview.message ||
        '低置信度关注项命中没有直接触发通知。',
    });
  }

  if (result.shouldNotify && !matchedRuleLabel) {
    diagnostics.push({
      id: 'notification-without-rule',
      severity: 'warning',
      title: '通知缺少规则归因',
      message: '本次会发送通知，但没有 matchedRuleRefs / matchedRuleIds。',
      detail: '先补齐规则引用，避免后续误报无法追溯到关注项。',
    });
  }

  if (result.shouldStore && !result.storageReview) {
    diagnostics.push({
      id: 'missing-storage-review',
      severity: 'warning',
      title: '缺少存储审计',
      message: '本次运行要求存储，但没有返回 storageReview。',
    });
  }

  if (trace.length === 0) {
    diagnostics.push({
      id: 'missing-trace',
      severity: 'warning',
      title: '缺少执行 Trace',
      message: '无法追溯每个 Agent 和工具的处理结果。',
    });
    return diagnostics;
  }

  const failedSteps = trace.filter((step) => step.status === 'error');
  if (failedSteps.length > 0) {
    diagnostics.push({
      id: 'agent-step-errors',
      severity: 'error',
      title: 'Agent 执行失败',
      message: failedSteps.map(getTraceStepLabel).join('、'),
      detail: uniq(failedSteps.map((step) => step.error || '')).join('；'),
    });
  }

  const skippedTools = uniq(
    trace.flatMap((step) =>
      (step.tools || [])
        .filter((tool) => tool.status === 'skipped')
        .map((tool) => `${getTraceStepLabel(step)} / ${getToolLabel(tool)}`),
    ),
  );
  if (skippedTools.length > 0) {
    diagnostics.push({
      id: 'skipped-tools',
      severity: 'warning',
      title: '有工具被跳过',
      message: skippedTools.join('、'),
    });
  }

  const slowAgents = trace.filter(
    (step) =>
      typeof step.durationMs === 'number' && step.durationMs >= SLOW_AGENT_MS,
  );
  if (slowAgents.length > 0) {
    diagnostics.push({
      id: 'slow-agents',
      severity: 'warning',
      title: 'Agent 耗时偏高',
      message: slowAgents
        .map((step) => `${getTraceStepLabel(step)} ${Math.round(step.durationMs || 0)}ms`)
        .join('、'),
    });
  }

  const slowTools = trace.flatMap((step) =>
    (step.tools || [])
      .filter(
        (tool) =>
          typeof tool.durationMs === 'number' && tool.durationMs >= SLOW_TOOL_MS,
      )
      .map(
        (tool) =>
          `${getTraceStepLabel(step)} / ${getToolLabel(tool)} ${Math.round(
            tool.durationMs || 0,
          )}ms`,
      ),
  );
  if (slowTools.length > 0) {
    diagnostics.push({
      id: 'slow-tools',
      severity: 'warning',
      title: '工具耗时偏高',
      message: slowTools.join('、'),
    });
  }

  if (
    result.storageReview?.traceStatus === 'partial' &&
    failedSteps.length === 0 &&
    (result.storageReview.toolErrorCount || 0) > 0
  ) {
    diagnostics.push({
      id: 'partial-trace',
      severity: 'warning',
      title: 'Trace 部分异常',
      message: `工具错误 ${result.storageReview.toolErrorCount}`,
    });
  }

  if (matchedRuleLabel && !result.shouldStore && !result.shouldNotify) {
    diagnostics.push({
      id: 'matched-rule-without-action',
      severity: 'warning',
      title: '命中规则没有后续动作',
      message: matchedRuleLabel,
      detail: '确认该关注项是否只作静默证据；否则补齐存储、通知或自动化动作。',
    });
  }

  return diagnostics;
}

export function buildAgentWorkflowDecisionPath(
  result?: AgentWorkflowResultLike | null,
): AgentWorkflowDecisionPathItem[] {
  if (!result) return [];

  const decisionPath: AgentWorkflowDecisionPathItem[] = [];
  const matchedRuleLabel = getMatchedRuleLabel(result);
  const confidenceLabel =
    getConfidenceLabel(result.confidence) ||
    getConfidenceLabel(result.storageReview?.confidence);

  if (matchedRuleLabel) {
    decisionPath.push({
      id: 'watch-rule-match',
      status: result.notificationReview?.required
        ? 'warning'
        : result.shouldNotify
          ? 'success'
          : 'info',
      title: '关注项匹配',
      summary: matchedRuleLabel,
      detail: [
        confidenceLabel ? `置信度 ${confidenceLabel}` : '',
        result.summary || result.storageReview?.summary || '',
      ]
        .filter(Boolean)
        .join(' / '),
    });
  } else if (result.shouldNotify) {
    decisionPath.push({
      id: 'watch-rule-missing',
      status: 'warning',
      title: '通知归因',
      summary: '将发送通知，但没有规则引用',
      detail: '检查 matchedRuleRefs / matchedRuleIds 是否被正确写入。',
    });
  }

  if (result.shouldStore) {
    const reason =
      result.storageReview?.primaryReason ||
      result.storageReview?.summary ||
      result.summary ||
      '已决定写入记忆';
    const reasonSource = getStorageReasonSourceLabel(
      result.storageReview?.reasonSource,
    );
    decisionPath.push({
      id: 'storage-decision',
      status:
        result.storageReview?.traceStatus === 'partial' ? 'warning' : 'success',
      title: '存储决策',
      summary: reason,
      detail: reasonSource ? `来源：${reasonSource}` : undefined,
    });
  } else {
    decisionPath.push({
      id: 'storage-decision',
      status: 'muted',
      title: '存储决策',
      summary: '本次不会写入记忆',
    });
  }

  if (result.notificationReview?.required) {
    decisionPath.push({
      id: 'notification-review',
      status: 'warning',
      title: '通知复核',
      summary:
        result.notificationReview.message ||
        '低置信度关注项命中已转为人工复核。',
    });
  } else if (result.shouldNotify) {
    decisionPath.push({
      id: 'notification-decision',
      status: 'success',
      title: '通知决策',
      summary: '会发送用户通知',
      detail: confidenceLabel ? `置信度 ${confidenceLabel}` : undefined,
    });
  } else {
    decisionPath.push({
      id: 'notification-decision',
      status: 'muted',
      title: '通知决策',
      summary: '本次不发送通知',
    });
  }

  const trace = Array.isArray(result.agentWorkflowTrace)
    ? result.agentWorkflowTrace
    : [];
  if (trace.length === 0) {
    decisionPath.push({
      id: 'trace-health',
      status: 'warning',
      title: '执行链路',
      summary: '缺少执行 Trace',
    });
    return decisionPath;
  }

  const failedSteps = trace.filter((step) => step.status === 'error');
  const skippedToolCount = trace.reduce(
    (count, step) =>
      count +
      (step.tools || []).filter((tool) => tool.status === 'skipped').length,
    0,
  );
  const toolCount = trace.reduce(
    (count, step) => count + (step.tools || []).length,
    0,
  );
  const toolErrorCount =
    result.storageReview?.toolErrorCount ||
    trace.reduce(
      (count, step) =>
        count +
        (step.tools || []).filter((tool) => tool.status === 'error').length,
      0,
    );
  const storageSkippedToolCount = result.storageReview?.toolSkippedCount;
  const effectiveSkippedToolCount =
    skippedToolCount > 0
      ? skippedToolCount
      : typeof storageSkippedToolCount === 'number'
        ? storageSkippedToolCount
        : 0;

  decisionPath.push({
    id: 'trace-health',
    status:
      failedSteps.length > 0 || toolErrorCount > 0
        ? 'error'
        : effectiveSkippedToolCount > 0 ||
            result.storageReview?.traceStatus === 'partial'
          ? 'warning'
          : 'success',
    title: '执行链路',
    summary: `${trace.length} 个 Agent / ${toolCount} 个工具`,
    detail:
      failedSteps.length > 0
        ? `失败：${failedSteps.map(getTraceStepLabel).join('、')}`
        : toolErrorCount > 0
          ? `工具错误 ${toolErrorCount}`
        : effectiveSkippedToolCount > 0
          ? `跳过工具 ${effectiveSkippedToolCount}`
          : undefined,
  });

  return decisionPath;
}

export function buildAgentWorkflowRecommendedActions(
  result?: AgentWorkflowResultLike | null,
  diagnostics?: AgentWorkflowDiagnostic[],
): AgentWorkflowRecommendedAction[] {
  if (!result) return [];

  const runDiagnostics =
    diagnostics || buildAgentWorkflowResultDiagnostics(result);
  const diagnosticIds = new Set(runDiagnostics.map((item) => item.id));
  const actions: AgentWorkflowRecommendedAction[] = [];
  const matchedRuleLabel = getMatchedRuleLabel(result);
  const confidenceLabel =
    getConfidenceLabel(result.confidence) ||
    getConfidenceLabel(result.storageReview?.confidence);

  if (result.notificationReview?.required) {
    actions.push({
      id: 'review-notification',
      status: 'review',
      title: '处理通知/自动化复核',
      summary:
        result.notificationReview.message ||
        '低置信度关注项命中需要人工确认。',
      detail: matchedRuleLabel
        ? `规则：${matchedRuleLabel}${confidenceLabel ? ` / ${confidenceLabel}` : ''}`
        : confidenceLabel
          ? `置信度 ${confidenceLabel}`
          : undefined,
    });
  }

  if (diagnosticIds.has('agent-step-errors')) {
    const failedAgents =
      result.storageReview?.failedAgents?.filter(Boolean).join('、') ||
      runDiagnostics.find((item) => item.id === 'agent-step-errors')?.message ||
      '查看失败 Agent';
    actions.push({
      id: 'fix-agent-errors',
      status: 'fix',
      title: '修复失败阶段',
      summary: failedAgents,
      detail: '先处理失败 Agent，再重新运行同一条测试消息。',
    });
  }

  if (diagnosticIds.has('partial-trace')) {
    actions.push({
      id: 'fix-tool-errors',
      status: 'fix',
      title: '修复工具异常',
      summary:
        runDiagnostics.find((item) => item.id === 'partial-trace')?.message ||
        'Trace 标记为部分异常。',
      detail: '先定位工具错误来源，再重新运行同一条测试消息。',
    });
  }

  if (diagnosticIds.has('notification-without-rule')) {
    actions.push({
      id: 'fix-notification-attribution',
      status: 'fix',
      title: '补齐通知归因',
      summary: '通知会发送，但没有稳定规则引用。',
      detail: '优先写入 matchedRuleRefs，matchedRuleIds 只作为旧格式兼容。',
    });
  }

  if (diagnosticIds.has('matched-rule-without-action')) {
    actions.push({
      id: 'review-rule-without-action',
      status: 'review',
      title: '复核无动作规则',
      summary: matchedRuleLabel || '规则已命中，但没有存储或通知动作。',
      detail: '确认该关注项是否只作静默证据；需要提醒时补齐存储、通知或自动化动作。',
    });
  }

  if (diagnosticIds.has('skipped-tools')) {
    actions.push({
      id: 'fix-skipped-tools',
      status: 'fix',
      title: '补齐被跳过工具',
      summary:
        runDiagnostics.find((item) => item.id === 'skipped-tools')?.message ||
        '存在未注册或不可用工具。',
      detail: '检查自定义 Agent 配置，移除旧工具或替换为已注册工具。',
    });
  }

  if (
    diagnosticIds.has('slow-agents') ||
    diagnosticIds.has('slow-tools')
  ) {
    const slowSummary = runDiagnostics
      .filter((item) => item.id === 'slow-agents' || item.id === 'slow-tools')
      .map((item) => item.message)
      .join('、');
    actions.push({
      id: 'optimize-slow-steps',
      status: 'optimize',
      title: '压缩慢步骤',
      summary: slowSummary || '有阶段耗时偏高。',
      detail: '优先检查 historySearch、外部查询和 LLM 调用是否可缓存或缩小输入。',
    });
  }

  if (diagnosticIds.has('missing-storage-review')) {
    actions.push({
      id: 'fix-storage-review',
      status: 'fix',
      title: '补齐存储审计',
      summary: '本次决定写入记忆，但缺少 storageReview。',
      detail: '没有审计字段会让后续回溯和误报处理变困难。',
    });
  }

  if (diagnosticIds.has('missing-trace')) {
    actions.push({
      id: 'fix-missing-trace',
      status: 'fix',
      title: '恢复执行 Trace',
      summary: '本次运行没有返回 Agent / 工具 trace。',
      detail: '先确认测试是否真正走到 Agent Workflow 编排器。',
    });
  }

  if (result.shouldStore && result.storageReview) {
    actions.push({
      id: 'verify-storage',
      status: 'verify',
      title: '确认记忆审计',
      summary:
        result.storageReview.primaryReason ||
        result.storageReview.summary ||
        '确认这条消息应写入 Memory Service。',
      detail: result.storageReview.reasonSource
        ? `来源：${getStorageReasonSourceLabel(result.storageReview.reasonSource)}`
        : undefined,
    });
  }

  if (result.shouldNotify) {
    actions.push({
      id: 'verify-notification',
      status: 'verify',
      title: '确认通知发送',
      summary: matchedRuleLabel || '本次会发送用户通知。',
      detail: confidenceLabel ? `置信度 ${confidenceLabel}` : undefined,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'no-followup',
      status: 'done',
      title: '无需后续动作',
      summary: '本次不会存储，也不会发送通知。',
    });
  }

  return actions.slice(0, 5);
}

export function buildAgentWorkflowReadinessChecks(
  result?: AgentWorkflowResultLike | null,
): AgentWorkflowReadinessCheck[] {
  if (!result) return [];

  const trace = getTrace(result);
  const matchedRuleLabel = getMatchedRuleLabel(result);
  const traceIssues = getTraceIssueSummary(trace);
  const storageToolErrorCount = result.storageReview?.toolErrorCount || 0;
  const storageFailedAgents = Array.isArray(result.storageReview?.failedAgents)
    ? result.storageReview.failedAgents.filter(Boolean)
    : [];
  const matchedRuleWithoutAction =
    Boolean(matchedRuleLabel) && !result.shouldStore && !result.shouldNotify;
  const effectiveSkippedToolCount =
    traceIssues.skippedToolCount || result.storageReview?.toolSkippedCount || 0;
  const checks: AgentWorkflowReadinessCheck[] = [];

  if (trace.length === 0) {
    checks.push({
      id: 'trace',
      status: 'blocked',
      title: '执行 Trace',
      summary: '缺少 Agent / 工具执行记录',
      detail: '先确认测试确实走到 Agent Workflow 编排器。',
    });
  } else if (
    traceIssues.failedSteps.length > 0 ||
    traceIssues.toolErrorCount > 0 ||
    storageToolErrorCount > 0 ||
    storageFailedAgents.length > 0
  ) {
    checks.push({
      id: 'trace',
      status: 'blocked',
      title: '执行 Trace',
      summary: `失败：${
        traceIssues.failedSteps.map(getTraceStepLabel).join('、') ||
        storageFailedAgents.join('、') ||
        `工具错误 ${traceIssues.toolErrorCount || storageToolErrorCount}`
      }`,
      detail: '修复失败阶段后再允许自动运行。',
    });
  } else if (
    effectiveSkippedToolCount > 0 ||
    result.storageReview?.traceStatus === 'partial'
  ) {
    checks.push({
      id: 'trace',
      status: 'review',
      title: '执行 Trace',
      summary: effectiveSkippedToolCount
        ? `有 ${effectiveSkippedToolCount} 个工具被跳过`
        : 'Trace 标记为部分异常',
      detail: effectiveSkippedToolCount
        ? '确认是否为旧自定义 Agent 或未注册工具。'
        : 'storageReview 缺少具体失败/跳过明细，请查看原始 trace。',
    });
  } else {
    checks.push({
      id: 'trace',
      status: 'ready',
      title: '执行 Trace',
      summary: `${trace.length} 个 Agent 已完成`,
    });
  }

  if (result.shouldStore && !result.storageReview) {
    checks.push({
      id: 'storage',
      status: 'blocked',
      title: '记忆写入',
      summary: '缺少 storageReview',
      detail: '没有存储审计会阻断后续误报复盘。',
    });
  } else if (result.shouldStore) {
    checks.push({
      id: 'storage',
      status:
        result.storageReview?.traceStatus === 'partial' ? 'review' : 'ready',
      title: '记忆写入',
      summary:
        result.storageReview?.primaryReason ||
        result.storageReview?.summary ||
        '已有存储审计',
      detail: result.storageReview?.reasonSource
        ? `来源：${getStorageReasonSourceLabel(result.storageReview.reasonSource)}`
        : undefined,
    });
  } else {
    checks.push({
      id: 'storage',
      status: 'skipped',
      title: '记忆写入',
      summary: '本次不写入 Memory Service',
    });
  }

  if (result.notificationReview?.required) {
    checks.push({
      id: 'notification',
      status: 'review',
      title: '通知/自动化',
      summary:
        result.notificationReview.message ||
        '低置信度命中已暂停通知和自动化。',
      detail: matchedRuleLabel ? `规则：${matchedRuleLabel}` : undefined,
    });
  } else if (result.shouldNotify && !matchedRuleLabel) {
    checks.push({
      id: 'notification',
      status: 'blocked',
      title: '通知/自动化',
      summary: '将发送通知但缺少规则归因',
      detail: '先补 matchedRuleRefs，再允许外部副作用继续。',
    });
  } else if (result.shouldNotify) {
    checks.push({
      id: 'notification',
      status: 'ready',
      title: '通知/自动化',
      summary: matchedRuleLabel || '通知归因已确认',
    });
  } else {
    checks.push({
      id: 'notification',
      status: 'skipped',
      title: '通知/自动化',
      summary: '本次不触发通知或规则自动化',
    });
  }

  if (matchedRuleWithoutAction) {
    checks.push({
      id: 'rule-action',
      status: 'review',
      title: '规则动作',
      summary: '命中关注项但没有后续动作',
      detail: `规则：${matchedRuleLabel}`,
    });
  }

  if (traceIssues.externalPlaceholderLabels.length > 0) {
    checks.push({
      id: 'external-info',
      status: 'review',
      title: '外部信息',
      summary: traceIssues.externalPlaceholderLabels.join('、'),
      detail: '外部查询仍未接真实 Jira/Wiki adapter，只能作为占位结果参考。',
    });
  }

  const slowTraceLabels = [
    ...traceIssues.slowStepLabels,
    ...traceIssues.slowToolLabels,
  ];
  if (slowTraceLabels.length > 0) {
    checks.push({
      id: 'performance',
      status: 'review',
      title: '耗时',
      summary: slowTraceLabels.join('、'),
      detail: '优先缩小 historySearch、外部查询和 LLM 输入。',
    });
  }

  return checks;
}

export function buildAgentWorkflowRunVerdict(
  result?: AgentWorkflowResultLike | null,
  readinessChecks?: AgentWorkflowReadinessCheck[],
  recommendedActions?: AgentWorkflowRecommendedAction[],
): AgentWorkflowRunVerdict | null {
  if (!result) return null;

  const checks = readinessChecks || buildAgentWorkflowReadinessChecks(result);
  const actions =
    recommendedActions || buildAgentWorkflowRecommendedActions(result);
  const blockedChecks = checks.filter((item) => item.status === 'blocked');
  const reviewChecks = checks.filter((item) => item.status === 'review');
  const firstAction = actions.find((item) => item.status !== 'done');
  const matchedRuleLabel = getMatchedRuleLabel(result);
  const confidenceLabel =
    getConfidenceLabel(result.confidence) ||
    getConfidenceLabel(result.storageReview?.confidence);
  const summarizeChecks = (items: AgentWorkflowReadinessCheck[]) =>
    items
      .slice(0, 3)
      .map((item) => item.title)
      .join('、');
  const detailChecks = (items: AgentWorkflowReadinessCheck[]) =>
    items
      .slice(0, 2)
      .map((item) => `${item.title}：${item.summary}`)
      .join('；');
  const firstFixAction = actions.find((item) => item.status === 'fix');
  const firstReviewAction = actions.find((item) => item.status === 'review');

  if (blockedChecks.length > 0) {
    const blockedAction = firstFixAction || firstAction;
    return {
      status: 'blocked',
      title: '先修复阻塞项',
      summary: summarizeChecks(blockedChecks),
      detail: detailChecks(blockedChecks),
      actionLabel: blockedAction?.title,
    };
  }

  if (reviewChecks.length > 0 || result.notificationReview?.required) {
    const reviewAction = firstReviewAction || firstFixAction || firstAction;
    const reviewSummary =
      summarizeChecks(reviewChecks) ||
      result.notificationReview?.message ||
      '本次运行需要人工复核';
    return {
      status: 'review',
      title: '需要复核后再执行',
      summary: reviewSummary,
      detail:
        reviewAction?.summary ||
        (matchedRuleLabel
          ? `规则：${matchedRuleLabel}${confidenceLabel ? ` / ${confidenceLabel}` : ''}`
          : undefined),
      actionLabel: reviewAction?.title,
    };
  }

  if (result.shouldNotify) {
    const notificationAction =
      actions.find((item) => item.id === 'verify-notification') ||
      firstAction;
    return {
      status: 'ready',
      title: '可执行通知/自动化',
      summary: matchedRuleLabel
        ? `规则 ${matchedRuleLabel} 已通过门禁`
        : '通知动作已通过门禁',
      detail: confidenceLabel ? `置信度 ${confidenceLabel}` : undefined,
      actionLabel: notificationAction?.title,
    };
  }

  if (result.shouldStore) {
    const storageAction =
      actions.find((item) => item.id === 'verify-storage') || firstAction;
    return {
      status: 'ready',
      title: '可写入记忆',
      summary:
        result.storageReview?.primaryReason ||
        result.storageReview?.summary ||
        result.summary ||
        '记忆写入已通过门禁',
      detail: result.storageReview?.reasonSource
        ? `来源：${getStorageReasonSourceLabel(result.storageReview.reasonSource)}`
        : undefined,
      actionLabel: storageAction?.title,
    };
  }

  return {
    status: 'idle',
    title: '无需后续动作',
    summary: matchedRuleLabel
      ? '命中规则但本次没有自动动作'
      : '本次不会存储，也不会发送通知',
    detail: firstAction?.summary,
    actionLabel: firstAction?.title,
  };
}

export function getAgentWorkflowHighestSeverity(
  diagnostics: AgentWorkflowDiagnostic[],
): AgentWorkflowDiagnosticSeverity | 'ok' {
  if (diagnostics.some((item) => item.severity === 'error')) return 'error';
  if (diagnostics.some((item) => item.severity === 'warning')) return 'warning';
  if (diagnostics.some((item) => item.severity === 'info')) return 'info';
  return 'ok';
}
