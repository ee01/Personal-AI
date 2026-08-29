/**
 * Schedule spec interpreter.
 *
 * Extracted verbatim from OutreachEngine so the Task Center's recurrence
 * rollover reuses the exact semantics outreach templates have been running on
 * in production, rather than growing a second, subtly different answer to
 * "when does this fire next".
 *
 * Semantics worth knowing before touching this:
 * - Date arithmetic happens on a "floating" Date whose UTC fields hold the
 *   caller's local wall-clock, converted only at the boundaries. That is what
 *   makes it DST-safe.
 * - repeatUnit 'Day' means *workday*: Saturday and Sunday are skipped.
 * - repeatUnit 'Week' + repeatDays selects weekdays (0=Sunday..6=Saturday) and
 *   only fires on weeks where (weekIndex % repeatEvery === 0).
 * - endDate is compared by day, inclusive; past it the schedule terminates.
 * - repeatCount/dispatchCount are NOT handled here — the caller owns that
 *   (OutreachRepository.markTemplateDispatch for outreach; the Task Center
 *   recurrence roller for ledger tasks).
 */

import { getConfig } from '../config.js';

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function sanitizeScheduleTimeZone(value: unknown): string {
  const candidates = [
    typeof value === 'string' ? value.trim() : '',
    getConfig().todayPilotTimezone,
    'Asia/Shanghai',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(0);
      return candidate;
    } catch {
      // Try the next fallback.
    }
  }

  return 'UTC';
}

export function readDateTimePartsInTimeZone(timestampMs: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const read = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? parseInt(value, 10) : 0;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = readDateTimePartsInTimeZone(utcMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

function zonedLocalDateTimeToUtcMs(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
): number {
  const guessUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  const firstOffset = getTimeZoneOffsetMs(timeZone, guessUtcMs);
  const firstPass = guessUtcMs - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(timeZone, firstPass);
  return secondOffset === firstOffset ? firstPass : guessUtcMs - secondOffset;
}

export function parseScheduleSeed(
  scheduleDate: string,
  scheduleTime: string,
): Date | null {
  const dateMatch = scheduleDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = scheduleTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

export function parseRepeatDays(value: unknown): number[] {
  const rawDays = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawDays
        .map((item) => Number(String(item).trim()))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((left, right) => left - right);
}

export function getDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function getWeekIndexSinceStart(candidate: Date, start: Date): number {
  const daysSinceStart = Math.floor(
    (getDayStart(candidate).getTime() - getDayStart(start).getTime()) /
      86400000,
  );
  return Math.floor(daysSinceStart / 7);
}

function isAfterScheduleEndDate(candidate: Date, endDate?: string): boolean {
  if (!endDate) return false;
  const parsedEndDate = parseScheduleSeed(endDate, '00:00');
  if (!parsedEndDate) return false;
  return (
    getDayStart(candidate).getTime() > getDayStart(parsedEndDate).getTime()
  );
}

function findNextWeeklyRepeatDay(
  seed: Date,
  baselineDate: Date,
  every: number,
  allowedDays: number[],
  endDate?: string,
): Date | null {
  const searchFrom = new Date(Math.max(seed.getTime(), baselineDate.getTime()));
  const searchDay = getDayStart(searchFrom);

  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(
      Date.UTC(
        searchDay.getUTCFullYear(),
        searchDay.getUTCMonth(),
        searchDay.getUTCDate() + offset,
        seed.getUTCHours(),
        seed.getUTCMinutes(),
        0,
        0,
      ),
    );

    if (isAfterScheduleEndDate(candidate, endDate)) return null;
    if (candidate.getTime() <= baselineDate.getTime()) continue;
    if (!allowedDays.includes(candidate.getUTCDay())) continue;

    const weekIndex = getWeekIndexSinceStart(candidate, seed);
    if (weekIndex >= 0 && weekIndex % every === 0) {
      return candidate;
    }
  }

  return null;
}

export function getScheduleTimeZone(scheduleSpec: Record<string, unknown>): string {
  return sanitizeScheduleTimeZone(scheduleSpec.timezone);
}

export function floatingDateToEpochSeconds(date: Date, timeZone: string): number {
  return Math.floor(
    zonedLocalDateTimeToUtcMs(
      {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      },
      timeZone,
    ) / 1000,
  );
}

export function epochSecondsToFloatingDate(
  timestampSeconds: number,
  timeZone: string,
): Date {
  const parts = readDateTimePartsInTimeZone(timestampSeconds * 1000, timeZone);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    ),
  );
}

export function parseNextDispatch(
  scheduleSpec: Record<string, unknown> | undefined,
  baseline: number,
): number | null {
  if (!scheduleSpec) return null;
  const timeZone = getScheduleTimeZone(scheduleSpec);
  const scheduleDate = normalizeString(scheduleSpec.scheduleDate);
  const scheduleTime = normalizeString(scheduleSpec.scheduleTime) ?? '09:00';
  const repeatEvery = Number(scheduleSpec.repeatEvery);
  const repeatUnit = normalizeString(scheduleSpec.repeatUnit);
  const repeatDays = repeatUnit === 'Week'
    ? parseRepeatDays(scheduleSpec.repeatDays)
    : [];
  const endDate = normalizeString(scheduleSpec.endDate);
  const baselineDate = epochSecondsToFloatingDate(baseline, timeZone);

  if (scheduleDate) {
    const seed = parseScheduleSeed(scheduleDate, scheduleTime);
    if (seed) {
      const candidate = new Date(seed.getTime());
      if (Number.isFinite(repeatEvery) && repeatEvery > 0 && repeatUnit) {
        if (repeatUnit === 'Week' && repeatDays.length > 0) {
          const nextWeeklyDay = findNextWeeklyRepeatDay(
            candidate,
            baselineDate,
            repeatEvery,
            repeatDays,
            endDate,
          );
          return nextWeeklyDay
            ? floatingDateToEpochSeconds(nextWeeklyDay, timeZone)
            : null;
        }

        for (let attempts = 0; attempts < 1000; attempts += 1) {
          if (isAfterScheduleEndDate(candidate, endDate)) return null;

          if (candidate.getTime() > baselineDate.getTime()) {
            if (
              repeatUnit !== 'Day' ||
              (candidate.getUTCDay() >= 1 && candidate.getUTCDay() <= 5)
            ) {
              return floatingDateToEpochSeconds(candidate, timeZone);
            }
          }

          if (repeatUnit === 'Day') {
            candidate.setUTCDate(candidate.getUTCDate() + repeatEvery);
          } else if (repeatUnit === 'Week') {
            candidate.setUTCDate(candidate.getUTCDate() + repeatEvery * 7);
          } else if (repeatUnit === 'Month') {
            candidate.setUTCMonth(candidate.getUTCMonth() + repeatEvery);
          } else if (repeatUnit === 'Year') {
            candidate.setUTCFullYear(candidate.getUTCFullYear() + repeatEvery);
          } else {
            break;
          }
        }
        return null;
      }

      const oneShotAt = floatingDateToEpochSeconds(seed, timeZone);
      return oneShotAt > baseline && !isAfterScheduleEndDate(seed, endDate)
        ? oneShotAt
        : null;
    }
  }

  const intervalSeconds = Number(scheduleSpec.intervalSeconds);
  const nextDispatchAt = Number(scheduleSpec.nextDispatchAt);
  if (Number.isFinite(intervalSeconds) && intervalSeconds > 0) {
    return Math.max(baseline + Math.floor(intervalSeconds), baseline + 60);
  }
  if (Number.isFinite(nextDispatchAt) && nextDispatchAt > baseline) {
    return Math.floor(nextDispatchAt);
  }
  return null;
}

export function isRecurringSchedule(scheduleSpec: Record<string, unknown>): boolean {
  const repeatEvery = Number(scheduleSpec.repeatEvery);
  const repeatUnit = normalizeString(scheduleSpec.repeatUnit);
  return Number.isFinite(repeatEvery) && repeatEvery > 0 && Boolean(repeatUnit);
}