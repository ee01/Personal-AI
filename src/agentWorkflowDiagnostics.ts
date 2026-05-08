export type AgentWorkflowDiagnosticSeverity = 'error' | 'warning' | 'info';
export type AgentWorkflowDecisionPathStatus =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'muted';

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
  confidence?: number;
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
    confidence?: number;
    traceStatus?: string;
    failedAgents?: string[];
    toolErrorCount?: number;
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

function normalizeConfidence(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = value > 1 && value <= 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, normalized));
}

function getConfidenceLabel(confidence?: number): string {
  const normalized = normalizeConfidence(confidence);
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

  return result.matchedRule || '';
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
  const trace = Array.isArray(result.agentWorkflowTrace)
    ? result.agentWorkflowTrace
    : [];

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

  if (
    Array.isArray(result.matchedRuleRefs) &&
    result.matchedRuleRefs.length > 0 &&
    !result.shouldStore &&
    !result.shouldNotify
  ) {
    diagnostics.push({
      id: 'matched-rule-without-action',
      severity: 'warning',
      title: '命中规则没有后续动作',
      message: '检查关注项是否只用于存储，或规则引用是否已经过期。',
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

  decisionPath.push({
    id: 'trace-health',
    status:
      failedSteps.length > 0 || toolErrorCount > 0
        ? 'error'
        : skippedToolCount > 0 ||
            result.storageReview?.traceStatus === 'partial'
          ? 'warning'
          : 'success',
    title: '执行链路',
    summary: `${trace.length} 个 Agent / ${toolCount} 个工具`,
    detail:
      failedSteps.length > 0
        ? `失败：${failedSteps.map(getTraceStepLabel).join('、')}`
        : skippedToolCount > 0
          ? `跳过工具 ${skippedToolCount}`
          : undefined,
  });

  return decisionPath;
}

export function getAgentWorkflowHighestSeverity(
  diagnostics: AgentWorkflowDiagnostic[],
): AgentWorkflowDiagnosticSeverity | 'ok' {
  if (diagnostics.some((item) => item.severity === 'error')) return 'error';
  if (diagnostics.some((item) => item.severity === 'warning')) return 'warning';
  if (diagnostics.some((item) => item.severity === 'info')) return 'info';
  return 'ok';
}
