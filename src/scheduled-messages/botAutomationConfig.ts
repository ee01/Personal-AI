import { BotAutomationConfig, BotAutomationRule, RingCentralSenderConfig, SheetConfig } from './types';

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
  return `${jiraBaseUrl}/jira/software/c/projects/${encodeURIComponent(projectKey)}/automation#/rule/${encodeURIComponent(ruleId)}`;
}

export function normalizeSheetConfig<T extends Partial<SheetConfig> | null | undefined>(config: T): T {
  if (!config) {
    return config;
  }

  const botAutomation = getBotAutomationConfig(config);
  const nextConfig = {
    ...config,
    botAutomation,
    botExecutor: botAutomation.executorRule,
    ringCentralSender: normalizeRingCentralSenderConfig(config.ringCentralSender),
  };

  return nextConfig as T;
}

export function withBotAutomation(
  config: SheetConfig,
  botAutomation: BotAutomationConfig
): SheetConfig {
  return normalizeSheetConfig({
    ...config,
    botAutomation,
    botExecutor: botAutomation.executorRule,
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
