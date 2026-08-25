export type AutoBackupScheduleType = 'daily' | 'every_x_hours' | 'weekly';

export interface AutoBackupScheduleConfig {
  enabled: boolean;
  scheduleType: AutoBackupScheduleType;
  preferredHour: number;
  intervalHours: number;
}

export function normalizePreferredHour(value: unknown, fallback = 3): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, Math.floor(parsed)));
}

export function normalizeIntervalHours(value: unknown, fallback = 24): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function computeNextBackupAt(
  config: AutoBackupScheduleConfig,
  lastSuccessAt: string | undefined,
  now = new Date(),
): Date | null {
  if (!config.enabled) return null;

  if (!lastSuccessAt) {
    return now;
  }

  const last = new Date(lastSuccessAt);
  if (Number.isNaN(last.getTime())) {
    return now;
  }

  if (config.scheduleType === 'every_x_hours') {
    return new Date(last.getTime() + config.intervalHours * 60 * 60 * 1000);
  }

  const next = new Date(last);
  next.setMilliseconds(0);
  next.setSeconds(0);
  next.setMinutes(0);
  next.setHours(config.preferredHour, 0, 0, 0);
  const stepDays = config.scheduleType === 'weekly' ? 7 : 1;
  next.setDate(next.getDate() + stepDays);
  return next;
}

export function isBackupDue(
  config: AutoBackupScheduleConfig,
  lastSuccessAt: string | undefined,
  now = new Date(),
): boolean {
  const next = computeNextBackupAt(config, lastSuccessAt, now);
  if (!next) return false;
  return now.getTime() >= next.getTime();
}
