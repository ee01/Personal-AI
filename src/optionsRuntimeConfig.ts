import {
  normalizeBotPushTarget,
  type BotPushTargetMode,
  type EnvConfigType,
} from './utils';

export type RuntimeHydrationStatus =
  | 'pending'
  | 'ready'
  | 'error'
  | 'skipped';

export type RuntimeConfigOverlayInput = {
  dreamDigestScheduleType?: string;
  dreamDigestIntervalDays?: number;
  dreamDigestIntervalWeeks?: number;
  dreamDigestPushTarget?: string;
  dreamDigestPushGroupId?: string;
  dreamDigestEnabled?: boolean;
  reflectionEnabled?: boolean;
  reflectionHeartbeatMinutes?: number;
  decisionCenterPushTarget?: string;
  decisionCenterPushGroupId?: string;
  weeklyReportEnabled?: boolean;
  weeklyReportCron?: string;
  weeklyReportMinMessages?: number;
  weeklyReportPushTarget?: string;
  weeklyReportPushGroupId?: string;
  openClawEnabled?: boolean;
  openClawBaseUrl?: string;
  openClawTimeoutMs?: number;
  openClawApiKeyConfigured?: boolean;
  agentExecutors?: Array<{
    id?: string;
    label?: string;
    type?: string;
    baseUrl?: string;
    cwd?: string;
    runtime?: string;
    workerId?: string;
    apiKeyConfigured?: boolean;
  }>;
  executorDefaults?: {
    agent_task?: string;
    reflection_research?: string;
  };
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  outreachResultPushTarget?: string;
  outreachResultPushGroupId?: string;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecretConfigured?: boolean;
  ringCentralJwtConfigured?: boolean;
  botApiBaseUrl?: string;
  botId?: string;
  botType?: string;
  botTeamId?: string;
  botTokenConfigured?: boolean;
};

export type ServerBackedFieldDiff = {
  key: string;
  label: string;
  local: string;
  server: string;
};

export const SERVER_BACKED_DIFF_FIELDS = [
  { key: 'OUTREACH_ENABLED', label: '主动询问引擎' },
  { key: 'SELF_REFLECTION_ENABLED', label: '自我反思' },
  { key: 'OPENCLAW_ENABLED', label: '外部委派' },
  { key: 'RINGCENTRAL_SERVER_URL', label: 'RingCentral Server URL' },
  { key: 'RINGCENTRAL_CLIENT_ID', label: 'RingCentral Client ID' },
] as const;

const DEFAULT_MIN_OPENCLAW_TIMEOUT_MS = 5 * 60 * 1000;

function resolvePushTarget(
  target: string | undefined,
  fallback: BotPushTargetMode,
  allowNone: boolean,
  enabled?: boolean,
): BotPushTargetMode {
  const normalizedFallback =
    allowNone && enabled === false ? 'none' : fallback;
  return normalizeBotPushTarget(target, allowNone, normalizedFallback);
}

function mapAgentExecutors(
  items: RuntimeConfigOverlayInput['agentExecutors'],
  fallback: EnvConfigType['AGENT_EXECUTORS'],
): EnvConfigType['AGENT_EXECUTORS'] {
  if (!Array.isArray(items)) {
    return fallback || [];
  }

  return items.map((item) => {
    const type =
      item.type === 'openclaw-gateway' ||
      item.type === 'acp-codex' ||
      item.type === 'acp-claude-code' ||
      item.type === 'acp-cursor'
        ? item.type
        : 'openclaw-responses';
    const isAcp =
      type === 'acp-codex' ||
      type === 'acp-claude-code' ||
      type === 'acp-cursor';
    return {
      id: String(item.id || ''),
      label: String(item.label || item.id || ''),
      type,
      baseUrl: item.baseUrl || '',
      apiKey: '',
      cwd: item.cwd || '',
      runtime:
        item.runtime === 'remote' ? 'remote' : isAcp ? 'local' : undefined,
      workerId: item.workerId || '',
      enabled: true,
      apiKeyConfigured: Boolean(item.apiKeyConfigured),
      clearApiKey: false,
    };
  });
}

function formatDiffValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? '开启' : '关闭';
  }
  const text = String(value ?? '').trim();
  return text || '（空）';
}

export function applyRuntimeConfigToEnvConfig(
  localConfig: EnvConfigType,
  serverConfig: RuntimeConfigOverlayInput,
  options?: { minOpenClawTimeoutMs?: number },
): EnvConfigType {
  const minOpenClawTimeoutMs = Math.max(
    DEFAULT_MIN_OPENCLAW_TIMEOUT_MS,
    options?.minOpenClawTimeoutMs || DEFAULT_MIN_OPENCLAW_TIMEOUT_MS,
  );
  const scheduleType = String(serverConfig.dreamDigestScheduleType || '');
  const intervalDays =
    Number(serverConfig.dreamDigestIntervalDays) ||
    (Number(serverConfig.dreamDigestIntervalWeeks) || 0) * 7;
  const resolvedScheduleType =
    scheduleType === 'every_x_weeks' ? 'every_x_days' : scheduleType;

  return {
    ...localConfig,
    DREAM_DIGEST_SCHEDULE_TYPE:
      resolvedScheduleType === 'every_x_days' ||
      resolvedScheduleType === 'monthly'
        ? resolvedScheduleType
        : localConfig.DREAM_DIGEST_SCHEDULE_TYPE || 'every_x_days',
    DREAM_DIGEST_INTERVAL_DAYS: Number.isFinite(intervalDays)
      ? Math.max(1, Math.floor(intervalDays))
      : localConfig.DREAM_DIGEST_INTERVAL_DAYS || 1,
    DREAM_INSIGHT_PUSH_TARGET: resolvePushTarget(
      serverConfig.dreamDigestPushTarget,
      localConfig.DREAM_INSIGHT_PUSH_TARGET || 'me',
      true,
      serverConfig.dreamDigestEnabled,
    ),
    DREAM_INSIGHT_PUSH_GROUP_ID:
      serverConfig.dreamDigestPushGroupId ||
      localConfig.DREAM_INSIGHT_PUSH_GROUP_ID ||
      '',
    SELF_REFLECTION_ENABLED:
      serverConfig.reflectionEnabled !== undefined
        ? Boolean(serverConfig.reflectionEnabled)
        : localConfig.SELF_REFLECTION_ENABLED,
    SELF_REFLECTION_HEARTBEAT_MINUTES: Number.isFinite(
      Number(serverConfig.reflectionHeartbeatMinutes),
    )
      ? Math.max(1, Math.floor(Number(serverConfig.reflectionHeartbeatMinutes)))
      : localConfig.SELF_REFLECTION_HEARTBEAT_MINUTES || 15,
    DECISION_CENTER_PUSH_TARGET: resolvePushTarget(
      serverConfig.decisionCenterPushTarget,
      localConfig.DECISION_CENTER_PUSH_TARGET || 'me',
      false,
    ),
    DECISION_CENTER_PUSH_GROUP_ID:
      serverConfig.decisionCenterPushGroupId ||
      localConfig.DECISION_CENTER_PUSH_GROUP_ID ||
      '',
    WEEKLY_REPORT_CRON:
      typeof serverConfig.weeklyReportCron === 'string' &&
      serverConfig.weeklyReportCron.trim()
        ? serverConfig.weeklyReportCron
        : localConfig.WEEKLY_REPORT_CRON,
    WEEKLY_REPORT_MIN_MESSAGES:
      serverConfig.weeklyReportMinMessages !== undefined
        ? Number(serverConfig.weeklyReportMinMessages)
        : localConfig.WEEKLY_REPORT_MIN_MESSAGES,
    WEEKLY_REPORT_PUSH_TARGET: resolvePushTarget(
      serverConfig.weeklyReportPushTarget,
      localConfig.WEEKLY_REPORT_PUSH_TARGET || 'me',
      true,
      serverConfig.weeklyReportEnabled,
    ),
    WEEKLY_REPORT_PUSH_GROUP_ID:
      serverConfig.weeklyReportPushGroupId ||
      localConfig.WEEKLY_REPORT_PUSH_GROUP_ID ||
      '',
    OPENCLAW_ENABLED:
      serverConfig.openClawEnabled !== undefined
        ? Boolean(serverConfig.openClawEnabled)
        : localConfig.OPENCLAW_ENABLED !== false,
    OPENCLAW_BASE_URL:
      typeof serverConfig.openClawBaseUrl === 'string'
        ? serverConfig.openClawBaseUrl
        : localConfig.OPENCLAW_BASE_URL,
    OPENCLAW_TIMEOUT_MS: Number.isFinite(Number(serverConfig.openClawTimeoutMs))
      ? Math.max(
          minOpenClawTimeoutMs,
          Math.floor(Number(serverConfig.openClawTimeoutMs)),
        )
      : localConfig.OPENCLAW_TIMEOUT_MS || 600000,
    OPENCLAW_API_KEY_CONFIGURED: Boolean(serverConfig.openClawApiKeyConfigured),
    AGENT_EXECUTORS: mapAgentExecutors(
      serverConfig.agentExecutors,
      localConfig.AGENT_EXECUTORS || [],
    ),
    EXECUTOR_DEFAULTS: {
      agent_task: serverConfig.executorDefaults?.agent_task || '',
      reflection_research:
        serverConfig.executorDefaults?.reflection_research || '',
    },
    OUTREACH_ENABLED:
      serverConfig.outreachEnabled !== undefined
        ? Boolean(serverConfig.outreachEnabled)
        : localConfig.OUTREACH_ENABLED,
    OUTREACH_INTERVAL_MS: Number.isFinite(
      Number(serverConfig.outreachIntervalMs),
    )
      ? Math.max(1000, Math.floor(Number(serverConfig.outreachIntervalMs)))
      : localConfig.OUTREACH_INTERVAL_MS || 60000,
    OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION:
      serverConfig.outreachRequireApprovalForReflection !== undefined
        ? Boolean(serverConfig.outreachRequireApprovalForReflection)
        : localConfig.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION,
    OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL:
      serverConfig.outreachRequireApprovalForManual !== undefined
        ? Boolean(serverConfig.outreachRequireApprovalForManual)
        : localConfig.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL,
    OUTREACH_RESULT_PUSH_TARGET: resolvePushTarget(
      serverConfig.outreachResultPushTarget,
      localConfig.OUTREACH_RESULT_PUSH_TARGET || 'me',
      false,
    ),
    OUTREACH_RESULT_PUSH_GROUP_ID:
      serverConfig.outreachResultPushGroupId ||
      localConfig.OUTREACH_RESULT_PUSH_GROUP_ID ||
      '',
    RINGCENTRAL_SERVER_URL:
      typeof serverConfig.ringCentralServerUrl === 'string'
        ? serverConfig.ringCentralServerUrl
        : localConfig.RINGCENTRAL_SERVER_URL,
    RINGCENTRAL_CLIENT_ID:
      typeof serverConfig.ringCentralClientId === 'string'
        ? serverConfig.ringCentralClientId
        : localConfig.RINGCENTRAL_CLIENT_ID,
    RINGCENTRAL_CLIENT_SECRET_CONFIGURED: Boolean(
      serverConfig.ringCentralClientSecretConfigured,
    ),
    RINGCENTRAL_JWT_CONFIGURED: Boolean(serverConfig.ringCentralJwtConfigured),
    BOT_API_BASE_URL:
      typeof serverConfig.botApiBaseUrl === 'string'
        ? serverConfig.botApiBaseUrl.trim() || localConfig.BOT_API_BASE_URL
        : localConfig.BOT_API_BASE_URL,
    BOT_ID:
      typeof serverConfig.botId === 'string'
        ? serverConfig.botId.trim() || localConfig.BOT_ID
        : localConfig.BOT_ID,
    BOT_TYPE:
      serverConfig.botType === 'team' || serverConfig.botType === 'user'
        ? serverConfig.botType
        : localConfig.BOT_TYPE,
    TEAM_ID:
      typeof serverConfig.botTeamId === 'string'
        ? serverConfig.botTeamId
        : localConfig.TEAM_ID,
    BOT_TOKEN_CONFIGURED: Boolean(serverConfig.botTokenConfigured),
  };
}

export function diffServerBackedEnvConfig(
  localConfig: EnvConfigType,
  hydratedConfig: EnvConfigType,
): ServerBackedFieldDiff[] {
  return SERVER_BACKED_DIFF_FIELDS.flatMap((field) => {
    const localValue = formatDiffValue(
      localConfig[field.key as keyof EnvConfigType],
    );
    const serverValue = formatDiffValue(
      hydratedConfig[field.key as keyof EnvConfigType],
    );
    if (localValue === serverValue) {
      return [];
    }
    return [
      {
        key: field.key,
        label: field.label,
        local: localValue,
        server: serverValue,
      },
    ];
  });
}

export function formatRuntimeHydrationReceipt(
  diffs: ServerBackedFieldDiff[],
): string {
  if (diffs.length === 0) {
    return '已从 Memory Service 加载运行时配置，与本机缓存一致。';
  }
  const details = diffs
    .map((diff) => `${diff.label} 本机 ${diff.local} → 服务端 ${diff.server}`)
    .join('；');
  return `已采用 Memory Service 的运行时配置（覆盖本机缓存）：${details}。加载完成前不会用本机缓存覆盖服务端。`;
}

export function displayServerBackedToggle(
  hydration: RuntimeHydrationStatus,
  value: boolean,
): boolean {
  if (hydration === 'pending') {
    return false;
  }
  return value === true;
}

export function displayServerBackedDefaultOn(
  hydration: RuntimeHydrationStatus,
  value: boolean | undefined,
): boolean {
  if (hydration === 'pending') {
    return false;
  }
  return value !== false;
}

export function shouldWriteRuntimeConfig(
  hydration: RuntimeHydrationStatus,
): boolean {
  return hydration === 'ready';
}

export function canSaveWithRuntimeConfig(
  hydration: RuntimeHydrationStatus,
): boolean {
  return hydration !== 'pending';
}
