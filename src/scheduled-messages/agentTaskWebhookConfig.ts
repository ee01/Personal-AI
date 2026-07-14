import type { AgentTaskWebhookConfig } from './types';

const MEMORY_SERVICE_API_PREFIX = '/api/v1';
const AGENT_TASK_EXECUTE_PATH = '/agent-tasks/execute';
const AGENT_TASK_USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export interface ResolveAgentTaskWebhookConfigInput {
  existingWebhook?: AgentTaskWebhookConfig;
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  userIdCandidates?: unknown[];
  requireUserId?: boolean;
  nowIso?: string;
}

export interface ResolveAgentTaskWebhookConfigResult {
  webhook?: AgentTaskWebhookConfig;
  changed: boolean;
  missingReason?: string;
}

function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function trimOptional(value?: unknown): string | undefined {
  const trimmed = String(value || '').trim();
  return trimmed || undefined;
}

function getUrlPathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

export function buildAgentTaskWebhookUrlFromMemoryBase(baseUrl?: string): string {
  const normalizedBase = trimTrailingSlashes(baseUrl || '');
  if (!normalizedBase) {
    return '';
  }

  if (/\/agent-tasks\/execute$/i.test(normalizedBase)) {
    return normalizedBase;
  }

  if (/\/api\/v1$/i.test(normalizedBase)) {
    return `${normalizedBase}${AGENT_TASK_EXECUTE_PATH}`;
  }

  if (!/\/api\/v1(?:\/|$)/i.test(getUrlPathname(normalizedBase))) {
    return `${normalizedBase}${MEMORY_SERVICE_API_PREFIX}${AGENT_TASK_EXECUTE_PATH}`;
  }

  return `${normalizedBase}${AGENT_TASK_EXECUTE_PATH}`;
}

export function normalizeAgentTaskUserId(value?: unknown): string | undefined {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return undefined;
  }

  const candidate = rawValue.includes('@') ? rawValue.split('@')[0] : rawValue;
  return AGENT_TASK_USER_ID_PATTERN.test(candidate) ? candidate : undefined;
}

export function resolveAgentTaskWebhookConfig(
  input: ResolveAgentTaskWebhookConfigInput,
): ResolveAgentTaskWebhookConfigResult {
  const existingWebhook = input.existingWebhook;
  const webhookUrl = trimOptional(existingWebhook?.webhookUrl) ||
    buildAgentTaskWebhookUrlFromMemoryBase(input.memoryServiceBaseUrl);

  if (!webhookUrl) {
    return {
      changed: false,
      missingReason: '缺少 memory-service webhook URL',
    };
  }

  const candidateUserIds = input.userIdCandidates || [];
  const userId = trimOptional(existingWebhook?.userId) ||
    candidateUserIds.map(normalizeAgentTaskUserId).find(Boolean);

  if (input.requireUserId && !userId) {
    return {
      changed: false,
      missingReason: '缺少 memory-service 用户身份',
    };
  }

  const authToken = trimOptional(existingWebhook?.authToken) ||
    trimOptional(input.memoryServiceApiKey);
  const updatedAt = trimOptional(existingWebhook?.updatedAt) ||
    input.nowIso ||
    new Date().toISOString();

  const webhook: AgentTaskWebhookConfig = {
    ...existingWebhook,
    webhookUrl,
    authToken,
    userId,
    updatedAt,
  };

  const changed =
    trimOptional(existingWebhook?.webhookUrl) !== webhook.webhookUrl ||
    trimOptional(existingWebhook?.authToken) !== webhook.authToken ||
    trimOptional(existingWebhook?.userId) !== webhook.userId ||
    !trimOptional(existingWebhook?.updatedAt);

  return {
    webhook,
    changed,
  };
}
