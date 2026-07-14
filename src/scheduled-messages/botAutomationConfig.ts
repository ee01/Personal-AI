import {
  AgentTaskWebhookConfig,
  BotAutomationConfig,
  BotAutomationRule,
  RingCentralSenderConfig,
  SheetConfig,
} from './types';

const RINGCENTRAL_SENDER_EXECUTOR_RULE_VERSION = '1.4.0';

export type BotConfigValidityStatus =
  | 'ok'
  | 'missing_executor_rule'
  | 'missing_timeline_sync_rule'
  | 'missing_both';

export type BotConfigDialogMode = 'create' | 'upgrade-sync-only' | 'repair';

function cloneRule(rule?: BotAutomationRule): BotAutomationRule | undefined {
  return rule ? { ...rule } : undefined;
}

function trimOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseRuleVersion(rule?: Partial<BotAutomationRule>): string | undefined {
  const explicitVersion = trimOptional(rule?.ruleVersion);
  if (explicitVersion) {
    return explicitVersion;
  }

  const versionMatch = rule?.ruleName?.match(/\bv(\d+\.\d+\.\d+)\b/);
  return versionMatch?.[1];
}

function compareVersionStrings(left: string, right: string): number {
  const leftParts = left.split('.').map(part => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map(part => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function isLegacyExecutorRuleForRingCentralSender(rule?: Partial<BotAutomationRule>): boolean {
  if (!rule?.ruleId) {
    return false;
  }

  const version = parseRuleVersion(rule);
  return !version || compareVersionStrings(version, RINGCENTRAL_SENDER_EXECUTOR_RULE_VERSION) < 0;
}

export function normalizeRingCentralSenderConfig(
  config?: Partial<RingCentralSenderConfig> | null
): RingCentralSenderConfig | undefined {
  if (!config) {
    return undefined;
  }

  const normalized: RingCentralSenderConfig = {
    enabled: Boolean(config.enabled),
    clientId: trimOptional(config.clientId),
    clientSecret: trimOptional(config.clientSecret),
    jwt: trimOptional(config.jwt),
    updatedAt: trimOptional(config.updatedAt),
  };

  const hasAnyValue = normalized.enabled ||
    Boolean(normalized.clientId || normalized.clientSecret || normalized.jwt || normalized.updatedAt);

  return hasAnyValue ? normalized : undefined;
}

export function normalizeAgentTaskWebhookConfig(
  config?: Partial<AgentTaskWebhookConfig> | null
): AgentTaskWebhookConfig | undefined {
  if (!config) {
    return undefined;
  }

  const normalized: AgentTaskWebhookConfig = {
    webhookUrl: trimOptional(config.webhookUrl),
    authToken: trimOptional(config.authToken),
    userId: trimOptional(config.userId),
    updatedAt: trimOptional(config.updatedAt),
  };

  return normalized.webhookUrl || normalized.authToken || normalized.userId || normalized.updatedAt
    ? normalized
    : undefined;
}

export function getAgentTaskWebhookConfig(
  config?: Partial<SheetConfig> | null
): AgentTaskWebhookConfig | undefined {
  return normalizeAgentTaskWebhookConfig(config?.agentTaskWebhook);
}

export function hasAgentTaskWebhookConfig(config?: Partial<SheetConfig> | null): boolean {
  return Boolean(getAgentTaskWebhookConfig(config)?.webhookUrl);
}

export function getRingCentralSenderConfig(
  config?: Partial<SheetConfig> | null
): RingCentralSenderConfig | undefined {
  return normalizeRingCentralSenderConfig(config?.ringCentralSender);
}

export function hasRingCentralSenderCredentials(config?: Partial<SheetConfig> | null): boolean {
  const senderConfig = getRingCentralSenderConfig(config);
  return Boolean(
    senderConfig?.enabled &&
    senderConfig.clientId &&
    senderConfig.clientSecret &&
    senderConfig.jwt
  );
}

export function hasCompleteRingCentralSenderConfig(
  config?: Partial<RingCentralSenderConfig> | null
): boolean {
  const senderConfig = normalizeRingCentralSenderConfig(config);
  return Boolean(
    senderConfig?.enabled &&
    senderConfig.clientId &&
    senderConfig.clientSecret &&
    senderConfig.jwt
  );
}

export function shouldRecreateExecutorRuleForRingCentralSenderUpgrade(
  currentConfig: Partial<SheetConfig> | null | undefined,
  nextSenderConfig?: Partial<RingCentralSenderConfig> | null
): boolean {
  const executorRule = getExecutorRule(currentConfig);
  return Boolean(
    isLegacyExecutorRuleForRingCentralSender(executorRule) &&
    !hasRingCentralSenderCredentials(currentConfig) &&
    hasCompleteRingCentralSenderConfig(nextSenderConfig)
  );
}

export function getBotAutomationConfig(config?: Partial<SheetConfig> | null): BotAutomationConfig {
  const executorRule = cloneRule(config?.botAutomation?.executorRule || config?.botExecutor);
  const timelineSyncRule = cloneRule(config?.botAutomation?.timelineSyncRule);

  return {
    executorRule,
    timelineSyncRule,
  };
}

export function getExecutorRule(config?: Partial<SheetConfig> | null): BotAutomationRule | undefined {
  return getBotAutomationConfig(config).executorRule;
}

export function getTimelineSyncRule(config?: Partial<SheetConfig> | null): BotAutomationRule | undefined {
  return getBotAutomationConfig(config).timelineSyncRule;
}

export function hasExecutorRule(config?: Partial<SheetConfig> | null): boolean {
  return Boolean(getExecutorRule(config)?.ruleId);
}

export function hasTimelineSyncRule(config?: Partial<SheetConfig> | null): boolean {
  return Boolean(getTimelineSyncRule(config)?.ruleId);
}

export function getJiraAutomationRuleUrl(rule?: Partial<BotAutomationRule> | null): string {
  const jiraUrl = rule?.jiraUrl?.trim();
  const projectKey = rule?.projectKey?.trim();
  const ruleId = rule?.ruleId?.toString().trim();

  if (!jiraUrl || !projectKey || !ruleId) {
    return '';
  }

  const jiraBaseUrl = jiraUrl.replace(/\/+$/, '');
  return `${jiraBaseUrl}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${encodeURIComponent(projectKey)}#/rule/${encodeURIComponent(ruleId)}`;
}

export function normalizeSheetConfig<T extends Partial<SheetConfig> | null | undefined>(config: T): T {
  if (!config) {
    return config;
  }

  const botAutomation = getBotAutomationConfig(config);
  const nextConfig = {
    ...config,
    botAutomation,
    ringCentralSender: normalizeRingCentralSenderConfig(config.ringCentralSender),
    agentTaskWebhook: normalizeAgentTaskWebhookConfig(config.agentTaskWebhook),
  };
  delete (nextConfig as Partial<SheetConfig>).botExecutor;

  return nextConfig as T;
}

export function withBotAutomation(
  config: SheetConfig,
  botAutomation: BotAutomationConfig
): SheetConfig {
  return normalizeSheetConfig({
    ...config,
    botAutomation,
  }) as SheetConfig;
}

export function withRingCentralSender(
  config: SheetConfig,
  ringCentralSender: RingCentralSenderConfig | undefined
): SheetConfig {
  return normalizeSheetConfig({
    ...config,
    ringCentralSender,
  }) as SheetConfig;
}

export function withAgentTaskWebhook(
  config: SheetConfig,
  agentTaskWebhook: AgentTaskWebhookConfig | undefined
): SheetConfig {
  return normalizeSheetConfig({
    ...config,
    agentTaskWebhook,
  }) as SheetConfig;
}

export function getBotDialogModeForStatus(
  status: BotConfigValidityStatus,
  config?: Partial<SheetConfig> | null
): BotConfigDialogMode {
  if (status === 'missing_timeline_sync_rule' && hasExecutorRule(config)) {
    return 'upgrade-sync-only';
  }

  if (status === 'missing_executor_rule' || status === 'missing_both') {
    return hasExecutorRule(config) || hasTimelineSyncRule(config) ? 'repair' : 'create';
  }

  if (hasExecutorRule(config) && !hasTimelineSyncRule(config)) {
    return 'upgrade-sync-only';
  }

  return hasExecutorRule(config) || hasTimelineSyncRule(config) ? 'repair' : 'create';
}
