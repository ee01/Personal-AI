import type { ThoughtStep } from './agentThinking';

export type AgentFlowStepType = 'analysis' | 'thought' | 'tool' | 'decision';
export type AgentFlowStepResultClass =
  | 'success'
  | 'error'
  | 'blocked'
  | 'skipped'
  | 'partial';

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
  return getToolResultValues(step).some((value: any) => Boolean(value?.error));
};

export const stepWasSkipped = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) => Boolean(value?.skipped));
};

export const stepHasToolBlocked = (step: ThoughtStep) => {
  return getToolResultValues(step).some((value: any) => Boolean(value?.blocked));
};

export const stepAllToolResultsBlocked = (step: ThoughtStep) => {
  const values = getToolResultValues(step);
  return values.length > 0 && values.every((value: any) => Boolean(value?.blocked));
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

export const getStepKind = (step: ThoughtStep) => {
  if (step.action === 'finish') return '完成';
  if (step.action === 'max_actions_reached') return '已截断';
  if (step.action === 'stopped') return '已停止';
  if (step.toolUsed) {
    if (stepHasToolError(step)) return '失败';
    if (stepAllToolResultsBlocked(step)) return '已阻断';
    if (stepHasToolBlocked(step)) return '部分阻断';
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
    if (stepHasToolBlocked(step)) return 'blocked';
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
    if (stepHasToolBlocked(step)) {
      if (stepAllToolResultsBlocked(step)) {
        return `${toolList || '工具'} 未通过工具校验，已阻断执行。`;
      }
      return `${toolList || '工具'} 中部分调用未通过校验，已阻断执行。`;
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
  if (stepAllToolResultsBlocked(step)) {
    return { label: '已阻断', className: 'blocked' };
  }
  if (stepHasToolBlocked(step)) {
    return { label: '部分阻断', className: 'blocked' };
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
      flowSteps.push({
        type: 'tool',
        name: step.toolUsed,
        result: presentation.label,
        resultClass: presentation.className,
        time: formatTime(step.timestamp),
      });
    } else if (index > 0 || step.action !== 'finish') {
      flowSteps.push({
        type: 'thought',
        name: '思考分析',
        time: formatTime(step.timestamp),
      });
    }
  });

  flowSteps.push({
    type: 'decision',
    name: '最终决策',
    time: formatTime(thoughtProcess[thoughtProcess.length - 1].timestamp + 1000),
  });

  return flowSteps;
}
