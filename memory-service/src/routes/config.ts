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
  dreamDigestScheduleType?: 'weekly' | 'every_x_days' | 'monthly';
  dreamDigestIntervalDays?: number;
}

/** Keys that must never be returned to the client. */
const SENSITIVE_KEYS = new Set([
  'openaiApiKey',
  'groqApiKey',
  'difyApiKey',
  'apiKey',
]);

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
    dreamDigestScheduleType: {
      type: 'string' as const,
      enum: ['weekly', 'every_x_days', 'monthly'],
    },
    dreamDigestIntervalDays: { type: 'number' as const, minimum: 1 },
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
      if (updates.dreamDigestScheduleType !== undefined) {
        persisted.dreamDigestScheduleType = updates.dreamDigestScheduleType;
      }
      if (updates.dreamDigestIntervalDays !== undefined) {
        persisted.dreamDigestIntervalDays = Math.max(1, Math.floor(updates.dreamDigestIntervalDays));
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
