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
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecret?: string;
  ringCentralJwt?: string;
  clearRingCentralClientSecret?: boolean;
  clearRingCentralJwt?: boolean;
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
    openClawTimeoutMs: { type: 'number' as const, minimum: 1000 },
    clearOpenClawApiKey: { type: 'boolean' as const },
    outreachEnabled: { type: 'boolean' as const },
    outreachIntervalMs: { type: 'number' as const, minimum: 1000 },
    outreachRequireApprovalForReflection: { type: 'boolean' as const },
    outreachRequireApprovalForManual: { type: 'boolean' as const },
    ringCentralServerUrl: { type: 'string' as const },
    ringCentralClientId: { type: 'string' as const },
    ringCentralClientSecret: { type: 'string' as const },
    ringCentralJwt: { type: 'string' as const },
    clearRingCentralClientSecret: { type: 'boolean' as const },
    clearRingCentralJwt: { type: 'boolean' as const },
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
    const persisted = readPersistedConfig(request);

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
      const persisted = readPersistedConfig(request);

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
        persisted.openClawTimeoutMs = Math.max(1000, Math.floor(updates.openClawTimeoutMs));
      }
      if (updates.clearOpenClawApiKey === true) {
        delete persisted.openClawApiKey;
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

      writePersistedConfig(persisted, request);

      // Return the merged result (excluding sensitive keys)
      const appConfig = getConfig();
      const merged = { ...appConfig, ...persisted };
      const safe = sanitizeConfig(merged as Record<string, unknown>);

      return reply.status(200).send(safe);
    },
  );
}
