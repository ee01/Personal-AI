/**
 * Agent executor registry — resolves configured instances + legacy OpenClaw fields.
 * Protocol details stay inside executor implementations; this module only picks who runs.
 */

import type { UserRuntimeConfig } from '../../runtimeConfig.js';

export const AGENT_ACTION_TYPES = ['delegate_agent', 'delegate_openclaw'] as const;

export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

export type AgentExecutorType =
  | 'openclaw-responses'
  | 'openclaw-gateway'
  | 'acp-codex'
  | 'acp-claude-code';

export type ExecutorDefaultUse = 'agent_task' | 'reflection_research';

export interface AgentExecutorInstance {
  id: string;
  label: string;
  type: AgentExecutorType;
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
  enabled: boolean;
  /** Present on sanitized GET responses only. */
  apiKeyConfigured?: boolean;
}

export interface ExecutorDefaults {
  agent_task: string;
  reflection_research: string;
}

export const LEGACY_OPENCLAW_EXECUTOR_ID = 'openclaw';

export function isAgentDelegateActionType(actionType: string): boolean {
  return (
    actionType === 'delegate_agent' || actionType === 'delegate_openclaw'
  );
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeExecutorType(value: unknown): AgentExecutorType | null {
  if (
    value === 'openclaw-responses' ||
    value === 'openclaw-gateway' ||
    value === 'acp-codex' ||
    value === 'acp-claude-code'
  ) {
    return value;
  }
  // Accept short aliases used by Sheet / older callers.
  if (value === 'openclaw' || value === 'openclaw-legacy') {
    return 'openclaw-responses';
  }
  return null;
}

export function normalizeAgentExecutorInstance(
  raw: unknown,
): AgentExecutorInstance | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const id = nonEmpty(input.id);
  if (!id) return null;
  const type = normalizeExecutorType(input.type) ?? 'openclaw-responses';
  const label = nonEmpty(input.label) || id;
  return {
    id,
    label,
    type,
    baseUrl: nonEmpty(input.baseUrl),
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : undefined,
    cwd: nonEmpty(input.cwd),
    enabled: input.enabled !== false,
  };
}

function synthesizeLegacyOpenClaw(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey'
  >,
): AgentExecutorInstance | null {
  if (!config.openClawEnabled) return null;
  return {
    id: LEGACY_OPENCLAW_EXECUTOR_ID,
    label: 'OpenClaw',
    type: 'openclaw-responses',
    baseUrl: nonEmpty(config.openClawBaseUrl),
    apiKey: config.openClawApiKey || undefined,
    enabled: true,
  };
}

/**
 * Effective registry: explicit agentExecutors, or a synthetic OpenClaw entry
 * derived from the legacy openClaw* fields when the list is empty.
 */
export function resolveAgentExecutors(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
  >,
): AgentExecutorInstance[] {
  const configured = Array.isArray(config.agentExecutors)
    ? config.agentExecutors
        .map((item) => normalizeAgentExecutorInstance(item))
        .filter((item): item is AgentExecutorInstance => Boolean(item))
    : [];

  if (configured.length > 0) {
    return configured;
  }

  const legacy = synthesizeLegacyOpenClaw(config);
  return legacy ? [legacy] : [];
}

export function resolveEnabledAgentExecutors(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
  >,
): AgentExecutorInstance[] {
  return resolveAgentExecutors(config).filter((item) => item.enabled);
}

export function resolveExecutorDefaults(
  config: Pick<
    UserRuntimeConfig,
    | 'openClawEnabled'
    | 'openClawBaseUrl'
    | 'openClawApiKey'
    | 'agentExecutors'
    | 'executorDefaults'
  >,
): ExecutorDefaults {
  const enabled = resolveEnabledAgentExecutors(config);
  const fallbackId = enabled[0]?.id || LEGACY_OPENCLAW_EXECUTOR_ID;
  const raw = config.executorDefaults || {};
  const pick = (use: ExecutorDefaultUse): string => {
    const candidate = nonEmpty(raw[use]);
    if (candidate && enabled.some((item) => item.id === candidate)) {
      return candidate;
    }
    return fallbackId;
  };
  return {
    agent_task: pick('agent_task'),
    reflection_research: pick('reflection_research'),
  };
}

export function findEnabledExecutor(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
  >,
  executorId: string | undefined | null,
): AgentExecutorInstance | null {
  const id = nonEmpty(executorId);
  if (!id) return null;
  // Sheet / callers may still pass the short alias "openclaw".
  const aliases = new Set([id]);
  if (id === 'openclaw') {
    aliases.add(LEGACY_OPENCLAW_EXECUTOR_ID);
  }
  return (
    resolveEnabledAgentExecutors(config).find((item) =>
      aliases.has(item.id),
    ) || null
  );
}

export function sanitizeAgentExecutorsForResponse(
  executors: AgentExecutorInstance[],
): Array<Omit<AgentExecutorInstance, 'apiKey'> & { apiKeyConfigured: boolean }> {
  return executors.map((item) => {
    const { apiKey, ...rest } = item;
    return {
      ...rest,
      apiKeyConfigured: Boolean(apiKey && apiKey.trim()),
    };
  });
}

export function publicExecutorOptions(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
  >,
): Array<{ id: string; label: string; type: AgentExecutorType }> {
  return resolveEnabledAgentExecutors(config).map((item) => ({
    id: item.id,
    label: item.label,
    type: item.type,
  }));
}
