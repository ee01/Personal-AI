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
  | 'acp-claude-code'
  | 'acp-cursor';

export function isAcpExecutorType(
  type: unknown,
): type is Extract<AgentExecutorType, `acp-${string}`> {
  return type === 'acp-codex' || type === 'acp-claude-code' || type === 'acp-cursor';
}

export type ExecutorDefaultUse = 'agent_task' | 'reflection_research';

/** ACP spawn location. Worker is a channel, not a fifth executor type. */
export type AgentExecutorRuntime = 'local' | 'remote';

export interface AgentExecutorInstance {
  id: string;
  label: string;
  type: AgentExecutorType;
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
  enabled: boolean;
  /** ACP only. OpenClaw types ignore this (gateway is already remote). */
  runtime?: AgentExecutorRuntime;
  /** Required when runtime=remote. */
  workerId?: string;
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
    value === 'acp-claude-code' ||
    value === 'acp-cursor'
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
  const isAcp = isAcpExecutorType(type);
  const runtime: AgentExecutorRuntime | undefined = isAcp
    ? input.runtime === 'remote'
      ? 'remote'
      : 'local'
    : undefined;
  return {
    id,
    label,
    type,
    baseUrl: nonEmpty(input.baseUrl),
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : undefined,
    cwd: nonEmpty(input.cwd),
    enabled: input.enabled !== false,
    runtime,
    workerId: isAcp ? nonEmpty(input.workerId) : undefined,
  };
}

function hasLegacyOpenClawConfig(
  config: Pick<
    UserRuntimeConfig,
    | 'openClawEnabled'
    | 'openClawBaseUrl'
    | 'openClawApiKey'
  >,
): boolean {
  return (
    Boolean(config.openClawEnabled) ||
    Boolean(nonEmpty(config.openClawBaseUrl)) ||
    Boolean(config.openClawApiKey && String(config.openClawApiKey).trim())
  );
}

function synthesizeLegacyOpenClaw(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey'
  > &
    Partial<
      Pick<UserRuntimeConfig, 'openClawExecutorType' | 'openClawExecutorLabel'>
    >,
): AgentExecutorInstance | null {
  if (!hasLegacyOpenClawConfig(config)) return null;
  const type =
    normalizeExecutorType(config.openClawExecutorType) ?? 'openclaw-gateway';
  return {
    id: LEGACY_OPENCLAW_EXECUTOR_ID,
    label: nonEmpty(config.openClawExecutorLabel) || 'OpenClaw',
    type,
    baseUrl: nonEmpty(config.openClawBaseUrl),
    apiKey: config.openClawApiKey || undefined,
    // Listed executors are always available; openClawEnabled is a separate
    // master switch for reflection/linkage external delegation only.
    enabled: true,
  };
}

export type OpenClawEnvDefaults = {
  openClawEnabled?: boolean;
  openClawBaseUrl?: string;
  openClawApiKey?: string;
  openClawExecutorType?: AgentExecutorType;
  openClawExecutorLabel?: string;
};

/**
 * Persist-ready import: if the user still only has legacy openClaw* fields and
 * no `openclaw` executor row, create one. Env defaults fill missing connection
 * fields so new users get the shared Gateway without opening Options first.
 * Returns null when nothing to write.
 */
export function buildPersistedLegacyOpenClawImport(
  persisted: Record<string, unknown>,
  envDefaults: OpenClawEnvDefaults = {},
): {
  agentExecutors: AgentExecutorInstance[];
  executorDefaults: ExecutorDefaults;
} | null {
  const existingRaw = Array.isArray(persisted.agentExecutors)
    ? persisted.agentExecutors
    : [];
  const existing = existingRaw
    .map((item) => normalizeAgentExecutorInstance(item))
    .filter((item): item is AgentExecutorInstance => Boolean(item));
  if (existing.some((item) => item.id === LEGACY_OPENCLAW_EXECUTOR_ID)) {
    return null;
  }
  // A non-empty custom list means the user already chose executors.
  if (existing.length > 0) {
    return null;
  }

  const persistedUrl =
    typeof persisted.openClawBaseUrl === 'string'
      ? persisted.openClawBaseUrl.trim()
      : '';
  const persistedKey =
    typeof persisted.openClawApiKey === 'string' ? persisted.openClawApiKey : '';
  const legacy = synthesizeLegacyOpenClaw({
    openClawEnabled:
      typeof persisted.openClawEnabled === 'boolean'
        ? persisted.openClawEnabled
        : Boolean(envDefaults.openClawEnabled),
    openClawBaseUrl: persistedUrl || envDefaults.openClawBaseUrl || '',
    openClawApiKey: persistedKey || envDefaults.openClawApiKey || '',
    openClawExecutorType:
      envDefaults.openClawExecutorType ?? 'openclaw-gateway',
    openClawExecutorLabel: envDefaults.openClawExecutorLabel || 'OpenClaw',
  });
  if (!legacy || !nonEmpty(legacy.baseUrl)) return null;

  const rawDefaults =
    persisted.executorDefaults && typeof persisted.executorDefaults === 'object'
      ? (persisted.executorDefaults as Record<string, unknown>)
      : {};
  const agentTask = nonEmpty(rawDefaults.agent_task) || LEGACY_OPENCLAW_EXECUTOR_ID;
  const reflection =
    nonEmpty(rawDefaults.reflection_research) || LEGACY_OPENCLAW_EXECUTOR_ID;

  return {
    agentExecutors: [legacy, ...existing],
    executorDefaults: {
      agent_task: agentTask,
      reflection_research: reflection,
    },
  };
}

export type AgentExecutorResolveConfig = Pick<
  UserRuntimeConfig,
  'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
> &
  Partial<
    Pick<UserRuntimeConfig, 'openClawExecutorType' | 'openClawExecutorLabel'>
  >;

/**
 * Effective registry: explicit agentExecutors, or a synthetic OpenClaw entry
 * derived from the legacy openClaw* fields when the list is empty.
 */
export function resolveAgentExecutors(
  config: AgentExecutorResolveConfig,
): AgentExecutorInstance[] {
  const configured = Array.isArray(config.agentExecutors)
    ? config.agentExecutors
        .map((item) => normalizeAgentExecutorInstance(item))
        .filter((item): item is AgentExecutorInstance => Boolean(item))
    : [];

  if (configured.length > 0) {
    return configured;
  }

  // Runtime fallback while older configs are still migrating into agentExecutors.
  const legacy = synthesizeLegacyOpenClaw(config);
  return legacy ? [legacy] : [];
}

export function resolveEnabledAgentExecutors(
  config: Pick<
    UserRuntimeConfig,
    'openClawEnabled' | 'openClawBaseUrl' | 'openClawApiKey' | 'agentExecutors'
  >,
): AgentExecutorInstance[] {
  // Listed executors are available; per-item enabled is ignored (compat field).
  return resolveAgentExecutors(config).map((item) => ({
    ...item,
    enabled: true,
  }));
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

/**
 * Empty executor means Options Agent Task default.
 * An explicit instance id, including `openclaw`, pins that instance.
 */
export function resolveAgentTaskExecutorId(
  requested: string | undefined | null,
  defaults: ExecutorDefaults,
): string {
  return nonEmpty(requested) || defaults.agent_task;
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

export type DelegationExecutorConfig = Pick<
  UserRuntimeConfig,
  | 'openClawEnabled'
  | 'openClawBaseUrl'
  | 'openClawApiKey'
  | 'agentExecutors'
  | 'executorDefaults'
>;

export interface DelegationExecutorTarget {
  actionType: string;
  sourceKind?: string;
  params?: Record<string, unknown>;
}

/**
 * Single source of truth for "who runs this delegation". Readiness probes and
 * real dispatch must resolve the same instance, otherwise a probe can condemn
 * a runtime that execution never uses.
 */
export function resolveExecutorForDelegation(
  config: DelegationExecutorConfig,
  target: DelegationExecutorTarget,
): AgentExecutorInstance | null {
  const params = target.params ?? {};
  const metadata =
    params.metadata &&
    typeof params.metadata === 'object' &&
    !Array.isArray(params.metadata)
      ? (params.metadata as Record<string, unknown>)
      : {};
  const requested =
    nonEmpty(params.executor) ||
    nonEmpty(metadata.executor) ||
    nonEmpty(metadata.executorId);

  const defaults = resolveExecutorDefaults(config);
  // Agent Task v1 callers baked executor=openclaw (type name). Honor the
  // Options Agent Task default, including retries of already-queued rows.
  if (target.sourceKind === 'agent_task') {
    return findEnabledExecutor(config, requested || defaults.agent_task);
  }

  if (requested) {
    return findEnabledExecutor(config, requested);
  }

  // Legacy action type without an explicit executor id.
  if (target.actionType === 'delegate_openclaw') {
    return findEnabledExecutor(config, 'openclaw');
  }

  return findEnabledExecutor(config, defaults.agent_task);
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
