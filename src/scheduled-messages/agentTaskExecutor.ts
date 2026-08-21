import type { RuntimeConfigResponse } from '../services/MemoryServiceClient';

export type AgentExecutorOption = {
  id: string;
  label: string;
};

export function listAgentExecutorOptions(
  runtime: Pick<RuntimeConfigResponse, 'agentExecutors'> | null | undefined,
): AgentExecutorOption[] {
  if (!Array.isArray(runtime?.agentExecutors)) return [];
  return runtime.agentExecutors
    .filter((item) => item && typeof item.id === 'string' && item.id.trim())
    .map((item) => {
      const id = item.id.trim();
      const label = String(item.label || id).trim() || id;
      return { id, label };
    });
}

export function resolveAgentTaskExecutorSelection(input: {
  savedId?: string;
  defaultId?: string;
  executors: AgentExecutorOption[];
}): string {
  const saved = (input.savedId || '').trim();
  const fallback = (input.defaultId || '').trim();
  const ids = new Set(input.executors.map((item) => item.id));
  if (saved && ids.has(saved)) return saved;
  if (fallback && ids.has(fallback)) return fallback;
  return input.executors[0]?.id || '';
}

export function agentTaskExecutorMissingReason(
  executors: AgentExecutorOption[],
  loaded: boolean,
): string {
  if (!loaded) {
    return '正在检查 Agent 执行器，请稍候。';
  }
  if (executors.length === 0) {
    return '尚未配置任何 Agent 执行器，帮我做任务到期后无法执行。请先在 Options → Agent 执行器 中添加。';
  }
  return '';
}
