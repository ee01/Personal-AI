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
}

export interface AgentPendingApprovalAction {
  stepIndex: number;
  toolId: string;
  approvalKey: string;
  effect?: string;
  riskLevel?: string;
  paramsPreview: string;
  reviewPayload: string;
  message: string;
  reviewHint: string;
}

export interface AgentFlowStep {
  type: AgentFlowStepType;
  name: string;
  result?: string;
  resultClass?: AgentFlowStepResultClass;
  time: string;
}

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
            allowedDecisions: [
              'approve_with_approvalKey',
              'reject',
              'edit_params_then_regenerate_key',
            ],
            resumeInstruction:
              '批准时把 approvalKey 放入 approvedToolActionKeys 后重新运行；拒绝或修改参数时不要复用旧 key。',
          });

          return {
            stepIndex,
            toolId,
            approvalKey,
            effect: approvalValue.effect,
            riskLevel: approvalValue.riskLevel,
            paramsPreview,
            reviewPayload,
            message,
            reviewHint,
          };
        }),
    );
  });
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

export function buildAgentRunReviewItems(
  thoughtProcess: ThoughtStep[],
  options: { isProcessing?: boolean } = {},
): AgentRunReviewItem[] {
  if (thoughtProcess.length === 0) return [];

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
    });
  }

  if (approvalRequiredCount > 0) {
    items.push({
      severity: 'warning',
      title: '需要人工确认',
      detail: `${approvalRequiredCount} 个工具步骤涉及高风险或外部副作用动作，已暂停执行。`,
      action: '先让用户确认具体工具和参数，再带对应批准 key 重新运行。',
    });
  }

  if (blockedCount > 0) {
    items.push({
      severity: 'warning',
      title: '工具被阻断',
      detail: `${blockedCount} 个工具步骤未通过执行前校验。`,
      action: '改用工具目录里的 ID，或补齐必填参数后重试。',
    });
  }

  if (emptyEvidenceCount > 0) {
    items.push({
      severity: 'warning',
      title: '工具证据不足',
      detail: `${emptyEvidenceCount} 个工具步骤完成但没有返回可用证据。`,
      action: '调整查询参数、补充上下文，或在结论中标记证据不足。',
    });
  }

  if (budgetCount > 0) {
    items.push({
      severity: 'warning',
      title: '行动次数用完',
      detail: 'Agent 在达到 maxActions 后使用已有信息结束。可能仍有未验证的问题。',
      action: '提高 maxActions，或缩小本轮问题范围后重新分析。',
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
    });
  }

  if (skippedCount > 0) {
    items.push({
      severity: 'info',
      title: '重复调用已跳过',
      detail: `${skippedCount} 个工具步骤复用了本轮已有结果，避免重复请求。`,
      action: '通常无需处理；如证据不足，可换用更具体参数再运行。',
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
  const terminalStep = thoughtProcess.find((step) =>
    ['finish', 'max_actions_reached', 'stopped'].includes(step.action),
  );

  const flowSteps: AgentFlowStep[] = [
    {
      type: 'analysis',
      name: '初始分析',
      time: formatTime(thoughtProcess[0].timestamp - 1000),
    },
  ];

  thoughtProcess.forEach((step) => {
    if (step.toolUsed) {
      const presentation = getToolStepResultPresentation(step);
      flowSteps.push({
        type: 'tool',
        name: step.toolUsed,
        result: presentation.label,
        resultClass: presentation.className,
        time: formatTime(step.timestamp),
      });
    } else if (
      !['finish', 'max_actions_reached', 'stopped'].includes(step.action)
    ) {
      flowSteps.push({
        type: 'thought',
        name: '思考分析',
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
    flowSteps.push({
      type: 'decision',
      name: terminalName,
      time: formatTime(terminalStep.timestamp),
    });
  }

  return flowSteps;
}
