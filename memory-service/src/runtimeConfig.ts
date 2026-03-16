import { getConfig } from './config.js';
import type { UserDataManager } from './storage/UserDataManager.js';

export type RuntimePushTarget = 'me' | 'group' | 'none';
export type DreamDigestScheduleType = 'weekly' | 'every_x_days' | 'monthly';

export interface UserRuntimeConfig {
  weeklyReportEnabled: boolean;
  weeklyReportCron: string;
  weeklyReportMinMessages: number;
  weeklyReportPushTarget: RuntimePushTarget;
  weeklyReportPushGroupId: string;
  dreamDigestEnabled: boolean;
  dreamDigestScheduleType: DreamDigestScheduleType;
  dreamDigestIntervalDays: number;
  dreamDigestPushTarget: RuntimePushTarget;
  dreamDigestPushGroupId: string;
  reflectionEnabled: boolean;
  reflectionActiveTopicLimit: number;
  reflectionHeartbeatMinutes: number;
  reflectionUrgentNotifyThreshold: number;
  reflectionAutoExecuteThreshold: number;
  reflectionUrgentConfidenceThreshold: number;
  decisionCenterPushTarget: RuntimePushTarget;
  decisionCenterPushGroupId: string;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return fallback;
  return Math.max(1, Math.floor(candidate));
}

function normalizeUnitInterval(value: unknown, fallback: number): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return fallback;
  return Math.max(0, Math.min(1, candidate));
}

function normalizePushTarget(
  value: unknown,
  allowNone: boolean,
  fallback: RuntimePushTarget,
): RuntimePushTarget {
  if (value === 'group' || value === 'team') return 'group';
  if (value === 'me' || value === 'user') return 'me';
  if (allowNone && value === 'none') return 'none';
  return fallback;
}

function readPersistedConfig(userDataManager?: UserDataManager): Record<string, unknown> {
  if (!userDataManager) return {};
  try {
    const raw = userDataManager.readFile('config.json');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getUserRuntimeConfig(userDataManager?: UserDataManager): UserRuntimeConfig {
  const appConfig = getConfig();
  const persisted = readPersistedConfig(userDataManager);

  const weeklyReportPushTarget = normalizePushTarget(
    persisted.weeklyReportPushTarget,
    true,
    appConfig.weeklyReportEnabled ? 'me' : 'none',
  );
  const dreamDigestPushTarget = normalizePushTarget(
    persisted.dreamDigestPushTarget,
    true,
    appConfig.dreamDigestEnabled ? 'me' : 'none',
  );

  return {
    weeklyReportEnabled: normalizeBoolean(
      persisted.weeklyReportEnabled,
      weeklyReportPushTarget !== 'none' && appConfig.weeklyReportEnabled,
    ),
    weeklyReportCron:
      typeof persisted.weeklyReportCron === 'string' && persisted.weeklyReportCron.trim().length > 0
        ? persisted.weeklyReportCron
        : appConfig.weeklyReportCron,
    weeklyReportMinMessages: normalizePositiveInteger(
      persisted.weeklyReportMinMessages,
      appConfig.weeklyReportMinMessages,
    ),
    weeklyReportPushTarget,
    weeklyReportPushGroupId:
      typeof persisted.weeklyReportPushGroupId === 'string' ? persisted.weeklyReportPushGroupId : '',
    dreamDigestEnabled: normalizeBoolean(
      persisted.dreamDigestEnabled,
      dreamDigestPushTarget !== 'none' && appConfig.dreamDigestEnabled,
    ),
    dreamDigestScheduleType:
      persisted.dreamDigestScheduleType === 'every_x_days' || persisted.dreamDigestScheduleType === 'monthly'
        ? persisted.dreamDigestScheduleType
        : appConfig.dreamDigestScheduleType,
    dreamDigestIntervalDays: normalizePositiveInteger(
      persisted.dreamDigestIntervalDays,
      appConfig.dreamDigestIntervalDays,
    ),
    dreamDigestPushTarget,
    dreamDigestPushGroupId:
      typeof persisted.dreamDigestPushGroupId === 'string' ? persisted.dreamDigestPushGroupId : '',
    reflectionEnabled: normalizeBoolean(persisted.reflectionEnabled, appConfig.reflectionEnabled),
    reflectionActiveTopicLimit: normalizePositiveInteger(
      persisted.reflectionActiveTopicLimit,
      appConfig.reflectionActiveTopicLimit,
    ),
    reflectionHeartbeatMinutes: normalizePositiveInteger(
      persisted.reflectionHeartbeatMinutes,
      appConfig.reflectionHeartbeatMinutes,
    ),
    reflectionUrgentNotifyThreshold: normalizeUnitInterval(
      persisted.reflectionUrgentNotifyThreshold,
      appConfig.reflectionUrgentNotifyThreshold,
    ),
    reflectionAutoExecuteThreshold: normalizeUnitInterval(
      persisted.reflectionAutoExecuteThreshold,
      appConfig.reflectionAutoExecuteThreshold,
    ),
    reflectionUrgentConfidenceThreshold: normalizeUnitInterval(
      persisted.reflectionUrgentConfidenceThreshold,
      appConfig.reflectionUrgentConfidenceThreshold,
    ),
    decisionCenterPushTarget: normalizePushTarget(persisted.decisionCenterPushTarget, false, 'me'),
    decisionCenterPushGroupId:
      typeof persisted.decisionCenterPushGroupId === 'string' ? persisted.decisionCenterPushGroupId : '',
  };
}
