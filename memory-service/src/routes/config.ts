/**
 * Runtime configuration route.
 *
 * GET  /config — Return current configuration (excluding sensitive keys).
 * PUT  /config — Persist partial configuration updates to config.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { getConfig } from '../config.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import {
  buildPersistedLegacyOpenClawImport,
  normalizeAgentExecutorInstance,
  resolveAgentExecutors,
  resolveExecutorDefaults,
  sanitizeAgentExecutorsForResponse,
  type AgentExecutorInstance,
  type AgentExecutorType,
  type ExecutorDefaults,
} from '../integrations/executors/executorRegistry.js';

const MIN_OPENCLAW_TIMEOUT_INPUT_MS = 5 * 60 * 1000;
const MIN_OPENCLAW_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Keys that may be updated at runtime. */
interface UpdatableConfig {
  heartbeatIntervalMs?: number;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  dailyCron?: string;
  weeklyCron?: string;
  weeklyReportEnabled?: boolean;
  weeklyReportCron?: string;
  weeklyReportMinMessages?: number;
  weeklyReportPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  weeklyReportPushGroupId?: string;
  dreamDigestEnabled?: boolean;
  dreamDigestScheduleType?: 'weekly' | 'every_x_days' | 'monthly';
  dreamDigestIntervalDays?: number;
  dreamDigestPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  dreamDigestPushGroupId?: string;
  reflectionEnabled?: boolean;
  reflectionActiveTopicLimit?: number;
  reflectionHeartbeatMinutes?: number;
  reflectionUrgentNotifyThreshold?: number;
  reflectionAutoExecuteThreshold?: number;
  reflectionUrgentConfidenceThreshold?: number;
  decisionCenterPushTarget?: 'me' | 'group' | 'user' | 'team';
  decisionCenterPushGroupId?: string;
  openClawEnabled?: boolean;
  openClawBaseUrl?: string;
  openClawApiKey?: string;
  openClawTimeoutMs?: number;
  clearOpenClawApiKey?: boolean;
  agentExecutors?: Array<Record<string, unknown>>;
  executorDefaults?: {
    agent_task?: string;
    reflection_research?: string;
  };
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  outreachResultPushTarget?: 'me' | 'group' | 'user' | 'team';
  outreachResultPushGroupId?: string;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecret?: string;
  ringCentralJwt?: string;
  clearRingCentralClientSecret?: boolean;
  clearRingCentralJwt?: boolean;
  botApiBaseUrl?: string;
  botToken?: string;
  botId?: string;
  botType?: 'user' | 'team';
  botTeamId?: string;
  botTargetEmail?: string;
  clearBotToken?: boolean;
}

/** Keys that must never be returned to the client. */
const SENSITIVE_KEYS = new Set([
  'openaiApiKey',
  'groqApiKey',
  'difyApiKey',
  'apiKey',
  'botToken',
  'openClawApiKey',
  'ringCentralClientSecret',
  'ringCentralJwt',
]);

function normalizePushTarget(
  value: unknown,
  allowNone = false,
): 'me' | 'group' | 'none' {
  if (value === 'group' || value === 'team') return 'group';
  if (value === 'me' || value === 'user') return 'me';
  if (allowNone && value === 'none') return 'none';
  return 'me';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the per-user config file path from the request's UserDataManager.
 * Falls back to the global dataDir if no user context is available.
 */
function getConfigFilePath(request?: FastifyRequest): string {
  if (request?.userContext?.userDataManager) {
    return request.userContext.userDataManager.getAbsolutePath('config.json');
  }
  // Fallback for cases without request context
  const config = getConfig();
  return path.join(config.dataDir, 'config.json');
}

function readPersistedConfig(request?: FastifyRequest): Record<string, unknown> {
  const filePath = getConfigFilePath(request);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    }
  } catch {
    // Corrupted or missing file — start fresh
  }
  return {};
}

function writePersistedConfig(data: Record<string, unknown>, request?: FastifyRequest): void {
  const filePath = getConfigFilePath(request);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function applyLegacyOpenClawImport(
  persisted: Record<string, unknown>,
): { persisted: Record<string, unknown>; changed: boolean } {
  const appConfig = getConfig();
  const imported = buildPersistedLegacyOpenClawImport(persisted, {
    openClawEnabled: appConfig.openClawEnabled,
    openClawBaseUrl: appConfig.openClawBaseUrl,
    openClawApiKey: appConfig.openClawApiKey,
    openClawExecutorType: appConfig.openClawExecutorType,
    openClawExecutorLabel: appConfig.openClawExecutorLabel,
  });
  if (!imported) {
    return { persisted, changed: false };
  }
  const primary = imported.agentExecutors[0];
  return {
    changed: true,
    persisted: {
      ...persisted,
      agentExecutors: imported.agentExecutors,
      executorDefaults: imported.executorDefaults,
      ...(primary?.baseUrl && !persisted.openClawBaseUrl
        ? { openClawBaseUrl: primary.baseUrl }
        : {}),
      ...(primary?.apiKey && !persisted.openClawApiKey
        ? { openClawApiKey: primary.apiKey }
        : {}),
    },
  };
}

/** Keep legacy openClaw* connection fields aligned with an OpenClaw executor row.
 * openClawEnabled is the independent「外部委派」master switch — do not mirror from
 * per-executor enabled (listed executors are always available).
 */
function mirrorOpenClawLegacyFromExecutors(
  persisted: Record<string, unknown>,
): void {
  const executors = Array.isArray(persisted.agentExecutors)
    ? persisted.agentExecutors
        .map((item) => normalizeAgentExecutorInstance(item))
        .filter((item): item is AgentExecutorInstance => Boolean(item))
    : [];
  const openclaw =
    executors.find((item) => item.id === 'openclaw') ||
    executors.find(
      (item) =>
        item.type === 'openclaw-responses' || item.type === 'openclaw-gateway',
    );
  if (!openclaw) return;
  if (openclaw.baseUrl) {
    persisted.openClawBaseUrl = openclaw.baseUrl;
  }
  // Empty apiKey means "keep existing" (clear is handled by clearApiKey on PUT).
  if (typeof openclaw.apiKey === 'string' && openclaw.apiKey.trim()) {
    persisted.openClawApiKey = openclaw.apiKey;
  }
}

function sanitizeConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SENSITIVE_KEYS.has(key)) {
      clean[key] = value;
    }
  }
  clean.openClawApiKeyConfigured =
    typeof raw.openClawApiKey === 'string' && raw.openClawApiKey.trim().length > 0;
  clean.ringCentralClientSecretConfigured =
    typeof raw.ringCentralClientSecret === 'string' &&
    raw.ringCentralClientSecret.trim().length > 0;
  clean.ringCentralJwtConfigured =
    typeof raw.ringCentralJwt === 'string' && raw.ringCentralJwt.trim().length > 0;
  clean.botTokenConfigured =
    typeof raw.botToken === 'string' && raw.botToken.trim().length > 0;

  // Expand agentExecutors with legacy OpenClaw synthesis + strip apiKeys.
  const openClawExecutorType: AgentExecutorType =
    raw.openClawExecutorType === 'openclaw-responses' ||
    raw.openClawExecutorType === 'openclaw-gateway' ||
    raw.openClawExecutorType === 'acp-codex' ||
    raw.openClawExecutorType === 'acp-claude-code'
      ? raw.openClawExecutorType
      : 'openclaw-gateway';
  const runtimeLike = {
    openClawEnabled: raw.openClawEnabled !== false,
    openClawBaseUrl:
      typeof raw.openClawBaseUrl === 'string' ? raw.openClawBaseUrl : '',
    openClawApiKey:
      typeof raw.openClawApiKey === 'string' ? raw.openClawApiKey : '',
    openClawExecutorType,
    openClawExecutorLabel:
      typeof raw.openClawExecutorLabel === 'string' &&
      raw.openClawExecutorLabel.trim()
        ? raw.openClawExecutorLabel.trim()
        : 'OpenClaw',
    agentExecutors: Array.isArray(raw.agentExecutors)
      ? (raw.agentExecutors as AgentExecutorInstance[])
      : [],
    executorDefaults: {
      agent_task: '',
      reflection_research: '',
      ...(raw.executorDefaults && typeof raw.executorDefaults === 'object'
        ? (raw.executorDefaults as Partial<ExecutorDefaults>)
        : {}),
    },
  };
  const resolved = resolveAgentExecutors(runtimeLike);
  clean.agentExecutors = sanitizeAgentExecutorsForResponse(resolved);
  clean.executorDefaults = resolveExecutorDefaults(runtimeLike);
  return clean;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const updateConfigBodySchema = {
  type: 'object' as const,
  properties: {
    heartbeatIntervalMs: { type: 'number' as const },
    quietHoursStart: { type: 'number' as const },
    quietHoursEnd: { type: 'number' as const },
    dailyCron: { type: 'string' as const },
    weeklyCron: { type: 'string' as const },
    weeklyReportEnabled: { type: 'boolean' as const },
    weeklyReportCron: { type: 'string' as const },
    weeklyReportMinMessages: { type: 'number' as const },
    weeklyReportPushTarget: {
      type: 'string' as const,
      enum: ['me', 'group', 'none', 'user', 'team'],
    },
    weeklyReportPushGroupId: { type: 'string' as const },
    dreamDigestEnabled: { type: 'boolean' as const },
    dreamDigestScheduleType: {
      type: 'string' as const,
      enum: ['weekly', 'every_x_days', 'monthly'],
    },
    dreamDigestIntervalDays: { type: 'number' as const, minimum: 1 },
    dreamDigestPushTarget: {
      type: 'string' as const,
      enum: ['me', 'group', 'none', 'user', 'team'],
    },
    dreamDigestPushGroupId: { type: 'string' as const },
    reflectionEnabled: { type: 'boolean' as const },
    reflectionActiveTopicLimit: { type: 'number' as const, minimum: 1 },
    reflectionHeartbeatMinutes: { type: 'number' as const, minimum: 1 },
    reflectionUrgentNotifyThreshold: { type: 'number' as const, minimum: 0, maximum: 1 },
    reflectionAutoExecuteThreshold: { type: 'number' as const, minimum: 0, maximum: 1 },
    reflectionUrgentConfidenceThreshold: { type: 'number' as const, minimum: 0, maximum: 1 },
    decisionCenterPushTarget: {
      type: 'string' as const,
      enum: ['me', 'group', 'user', 'team'],
    },
    decisionCenterPushGroupId: { type: 'string' as const },
    openClawEnabled: { type: 'boolean' as const },
    openClawBaseUrl: { type: 'string' as const },
    openClawApiKey: { type: 'string' as const },
    openClawTimeoutMs: { type: 'number' as const, minimum: MIN_OPENCLAW_TIMEOUT_INPUT_MS },
    clearOpenClawApiKey: { type: 'boolean' as const },
    agentExecutors: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const },
          label: { type: 'string' as const },
          type: {
            type: 'string' as const,
            enum: [
              'openclaw-responses',
              'openclaw-gateway',
              'acp-codex',
              'acp-claude-code',
              'openclaw',
            ],
          },
          baseUrl: { type: 'string' as const },
          apiKey: { type: 'string' as const },
          cwd: { type: 'string' as const },
          enabled: { type: 'boolean' as const },
          runtime: { type: 'string' as const, enum: ['local', 'remote'] },
          workerId: { type: 'string' as const },
          clearApiKey: { type: 'boolean' as const },
        },
        required: ['id'],
        additionalProperties: true,
      },
    },
    executorDefaults: {
      type: 'object' as const,
      properties: {
        agent_task: { type: 'string' as const },
        reflection_research: { type: 'string' as const },
      },
      additionalProperties: false,
    },
    outreachEnabled: { type: 'boolean' as const },
    outreachIntervalMs: { type: 'number' as const, minimum: 1000 },
    outreachRequireApprovalForReflection: { type: 'boolean' as const },
    outreachRequireApprovalForManual: { type: 'boolean' as const },
    outreachResultPushTarget: {
      type: 'string' as const,
      enum: ['me', 'group', 'user', 'team'],
    },
    outreachResultPushGroupId: { type: 'string' as const },
    ringCentralServerUrl: { type: 'string' as const },
    ringCentralClientId: { type: 'string' as const },
    ringCentralClientSecret: { type: 'string' as const },
    ringCentralJwt: { type: 'string' as const },
    clearRingCentralClientSecret: { type: 'boolean' as const },
    clearRingCentralJwt: { type: 'boolean' as const },
    botApiBaseUrl: { type: 'string' as const },
    botToken: { type: 'string' as const },
    botId: { type: 'string' as const },
    botType: { type: 'string' as const, enum: ['user', 'team'] },
    botTeamId: { type: 'string' as const },
    botTargetEmail: { type: 'string' as const },
    clearBotToken: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function configRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET /config — Return current config (excluding sensitive keys)
  app.get('/config', async (request, reply) => {
    const appConfig = getConfig();
    let persisted = readPersistedConfig(request);
    const imported = applyLegacyOpenClawImport(persisted);
    if (imported.changed) {
      persisted = imported.persisted;
      writePersistedConfig(persisted, request);
    }

    // Merge: app defaults overridden by persisted runtime values
    const merged = { ...appConfig, ...persisted };
    const safe = sanitizeConfig(merged as Record<string, unknown>);

    return reply.status(200).send(safe);
  });

  // PUT /config — Persist partial runtime configuration updates
  app.put<{ Body: UpdatableConfig }>(
    '/config',
    { schema: { body: updateConfigBodySchema } },
    async (request, reply) => {
      const updates = request.body;
      let persisted = readPersistedConfig(request);

      // Apply only the allowed keys
      if (updates.heartbeatIntervalMs !== undefined) {
        persisted.heartbeatIntervalMs = updates.heartbeatIntervalMs;
      }
      if (updates.quietHoursStart !== undefined) {
        persisted.quietHoursStart = updates.quietHoursStart;
      }
      if (updates.quietHoursEnd !== undefined) {
        persisted.quietHoursEnd = updates.quietHoursEnd;
      }
      if (updates.dailyCron !== undefined) {
        persisted.dailyCron = updates.dailyCron;
      }
      if (updates.weeklyCron !== undefined) {
        persisted.weeklyCron = updates.weeklyCron;
      }
      if (updates.weeklyReportEnabled !== undefined) {
        persisted.weeklyReportEnabled = updates.weeklyReportEnabled;
      }
      if (updates.weeklyReportCron !== undefined) {
        persisted.weeklyReportCron = updates.weeklyReportCron;
      }
      if (updates.weeklyReportMinMessages !== undefined) {
        persisted.weeklyReportMinMessages = updates.weeklyReportMinMessages;
      }
      if (updates.weeklyReportPushTarget !== undefined) {
        persisted.weeklyReportPushTarget = normalizePushTarget(updates.weeklyReportPushTarget, true);
      }
      if (updates.weeklyReportPushGroupId !== undefined) {
        persisted.weeklyReportPushGroupId = updates.weeklyReportPushGroupId.trim();
      }
      if (updates.dreamDigestEnabled !== undefined) {
        persisted.dreamDigestEnabled = updates.dreamDigestEnabled;
      }
      if (updates.dreamDigestScheduleType !== undefined) {
        persisted.dreamDigestScheduleType = updates.dreamDigestScheduleType;
      }
      if (updates.dreamDigestIntervalDays !== undefined) {
        persisted.dreamDigestIntervalDays = Math.max(1, Math.floor(updates.dreamDigestIntervalDays));
      }
      if (updates.dreamDigestPushTarget !== undefined) {
        persisted.dreamDigestPushTarget = normalizePushTarget(updates.dreamDigestPushTarget, true);
      }
      if (updates.dreamDigestPushGroupId !== undefined) {
        persisted.dreamDigestPushGroupId = updates.dreamDigestPushGroupId.trim();
      }
      if (updates.reflectionEnabled !== undefined) {
        persisted.reflectionEnabled = updates.reflectionEnabled;
      }
      if (updates.reflectionActiveTopicLimit !== undefined) {
        persisted.reflectionActiveTopicLimit = Math.max(1, Math.floor(updates.reflectionActiveTopicLimit));
      }
      if (updates.reflectionHeartbeatMinutes !== undefined) {
        persisted.reflectionHeartbeatMinutes = Math.max(1, Math.floor(updates.reflectionHeartbeatMinutes));
      }
      if (updates.reflectionUrgentNotifyThreshold !== undefined) {
        persisted.reflectionUrgentNotifyThreshold = Math.max(0, Math.min(1, updates.reflectionUrgentNotifyThreshold));
      }
      if (updates.reflectionAutoExecuteThreshold !== undefined) {
        persisted.reflectionAutoExecuteThreshold = Math.max(0, Math.min(1, updates.reflectionAutoExecuteThreshold));
      }
      if (updates.reflectionUrgentConfidenceThreshold !== undefined) {
        persisted.reflectionUrgentConfidenceThreshold = Math.max(0, Math.min(1, updates.reflectionUrgentConfidenceThreshold));
      }
      if (updates.decisionCenterPushTarget !== undefined) {
        persisted.decisionCenterPushTarget = normalizePushTarget(updates.decisionCenterPushTarget, false);
      }
      if (updates.decisionCenterPushGroupId !== undefined) {
        persisted.decisionCenterPushGroupId = updates.decisionCenterPushGroupId.trim();
      }
      if (updates.openClawEnabled !== undefined) {
        persisted.openClawEnabled = updates.openClawEnabled;
      }
      if (updates.openClawBaseUrl !== undefined) {
        persisted.openClawBaseUrl = updates.openClawBaseUrl;
      }
      if (updates.openClawApiKey !== undefined) {
        const trimmed = updates.openClawApiKey.trim();
        if (trimmed.length > 0) {
          persisted.openClawApiKey = trimmed;
        }
      }
      if (updates.openClawTimeoutMs !== undefined) {
        persisted.openClawTimeoutMs = Math.max(MIN_OPENCLAW_TIMEOUT_MS, Math.floor(updates.openClawTimeoutMs));
      }
      if (updates.clearOpenClawApiKey === true) {
        delete persisted.openClawApiKey;
      }
      if (updates.agentExecutors !== undefined) {
        const previous = Array.isArray(persisted.agentExecutors)
          ? (persisted.agentExecutors as Array<Record<string, unknown>>)
          : [];
        const previousById = new Map(
          previous
            .map((item) => normalizeAgentExecutorInstance(item))
            .filter((item): item is AgentExecutorInstance => Boolean(item))
            .map((item) => [item.id, item] as const),
        );
        persisted.agentExecutors = updates.agentExecutors
          .map((raw) => {
            const next = normalizeAgentExecutorInstance(raw);
            if (!next) return null;
            const prev = previousById.get(next.id);
            const clearApiKey = (raw as { clearApiKey?: boolean }).clearApiKey === true;
            if (clearApiKey) {
              next.apiKey = undefined;
            } else if (!next.apiKey && prev?.apiKey) {
              next.apiKey = prev.apiKey;
            }
            return next;
          })
          .filter((item): item is AgentExecutorInstance => Boolean(item));
      }
      if (updates.executorDefaults !== undefined) {
        persisted.executorDefaults = {
          agent_task:
            typeof updates.executorDefaults.agent_task === 'string'
              ? updates.executorDefaults.agent_task.trim()
              : '',
          reflection_research:
            typeof updates.executorDefaults.reflection_research === 'string'
              ? updates.executorDefaults.reflection_research.trim()
              : '',
        };
      }
      if (updates.outreachEnabled !== undefined) {
        persisted.outreachEnabled = updates.outreachEnabled;
      }
      if (updates.outreachIntervalMs !== undefined) {
        persisted.outreachIntervalMs = Math.max(1000, Math.floor(updates.outreachIntervalMs));
      }
      if (updates.outreachRequireApprovalForReflection !== undefined) {
        persisted.outreachRequireApprovalForReflection =
          updates.outreachRequireApprovalForReflection;
      }
      if (updates.outreachRequireApprovalForManual !== undefined) {
        persisted.outreachRequireApprovalForManual = updates.outreachRequireApprovalForManual;
      }
      if (updates.outreachResultPushTarget !== undefined) {
        persisted.outreachResultPushTarget = normalizePushTarget(
          updates.outreachResultPushTarget,
          false,
        );
      }
      if (updates.outreachResultPushGroupId !== undefined) {
        persisted.outreachResultPushGroupId =
          updates.outreachResultPushGroupId.trim();
      }
      if (updates.ringCentralServerUrl !== undefined) {
        persisted.ringCentralServerUrl = updates.ringCentralServerUrl.trim();
      }
      if (updates.ringCentralClientId !== undefined) {
        persisted.ringCentralClientId = updates.ringCentralClientId.trim();
      }
      if (updates.ringCentralClientSecret !== undefined) {
        const trimmed = updates.ringCentralClientSecret.trim();
        if (trimmed.length > 0) {
          persisted.ringCentralClientSecret = trimmed;
        }
      }
      if (updates.ringCentralJwt !== undefined) {
        const trimmed = updates.ringCentralJwt.trim();
        if (trimmed.length > 0) {
          persisted.ringCentralJwt = trimmed;
        }
      }
      if (updates.clearRingCentralClientSecret === true) {
        delete persisted.ringCentralClientSecret;
      }
      if (updates.clearRingCentralJwt === true) {
        delete persisted.ringCentralJwt;
      }
      if (updates.botApiBaseUrl !== undefined) {
        persisted.botApiBaseUrl = updates.botApiBaseUrl.trim();
      }
      if (updates.botToken !== undefined) {
        const trimmed = updates.botToken.trim();
        if (trimmed.length > 0) {
          persisted.botToken = trimmed;
        }
      }
      if (updates.botId !== undefined) {
        persisted.botId = updates.botId.trim();
      }
      if (updates.botType !== undefined) {
        persisted.botType = updates.botType === 'team' ? 'team' : 'user';
      }
      if (updates.botTeamId !== undefined) {
        persisted.botTeamId = updates.botTeamId.trim();
      }
      if (updates.botTargetEmail !== undefined) {
        persisted.botTargetEmail = updates.botTargetEmail.trim();
      }
      if (updates.clearBotToken === true) {
        delete persisted.botToken;
      }

      // One-time / keep-alive import of legacy OpenClaw into agentExecutors.
      const imported = applyLegacyOpenClawImport(persisted);
      persisted = imported.persisted;
      if (updates.agentExecutors !== undefined) {
        mirrorOpenClawLegacyFromExecutors(persisted);
      }

      writePersistedConfig(persisted, request);

      const ringCentralReady =
        persisted.outreachEnabled === true &&
        typeof persisted.ringCentralServerUrl === 'string' &&
        persisted.ringCentralServerUrl.trim().length > 0 &&
        typeof persisted.ringCentralClientId === 'string' &&
        persisted.ringCentralClientId.trim().length > 0 &&
        typeof persisted.ringCentralClientSecret === 'string' &&
        persisted.ringCentralClientSecret.trim().length > 0 &&
        typeof persisted.ringCentralJwt === 'string' &&
        persisted.ringCentralJwt.trim().length > 0;
      if (ringCentralReady && request.userContext?.db) {
        const ringClient = new RingCentralClient(
          request.userContext.userDataManager,
          request.userContext.db,
          request.userId,
        );
        void ringClient.syncDirectory({ scopes: ['users', 'teams'], force: true }).catch((error) => {
          request.log.warn(
            {
              userId: request.userId,
              message: error instanceof Error ? error.message : String(error),
            },
            'ringcentral directory sync after config update failed',
          );
        });
      }

      // Return the merged result (excluding sensitive keys)
      const appConfig = getConfig();
      const merged = { ...appConfig, ...persisted };
      const safe = sanitizeConfig(merged as Record<string, unknown>);

      return reply.status(200).send(safe);
    },
  );
}
