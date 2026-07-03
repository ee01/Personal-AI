import type { ScheduledMessage } from './types';
import {
  formatLocalScheduleDate,
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleDate,
  parseLocalScheduleTime,
} from './scheduleDateTime.js';

export const AS_ME_DEFAULT_SCHEDULE_TIME = '09:00';
export const EXECUTOR_DEFAULT_SCHEDULE_TIME = '08:00';

type ScheduleLike = Pick<
  ScheduledMessage,
  | 'Schedule_Date'
  | 'Schedule_Time'
  | 'End_Date'
  | 'Repeat_Every'
  | 'Repeat_Unit'
  | 'Repeat_Count'
  | 'Repeat_Days'
  | 'Exec_Count'
  | 'Push_Method'
  | 'AI_Endpoint'
>;

type ExecutorScheduleLike = Pick<ScheduledMessage, 'Push_Method'> &
  Partial<Pick<ScheduledMessage, 'AI_Endpoint'>>;

export function getDefaultScheduleTime(message: ExecutorScheduleLike): string {
  return isExecutorDrivenSchedule(message)
    ? EXECUTOR_DEFAULT_SCHEDULE_TIME
    : AS_ME_DEFAULT_SCHEDULE_TIME;
}

export function hasConfiguredAiEndpoint(endpoint?: string | null): boolean {
  return Boolean(endpoint?.trim());
}

export function isExecutorDrivenSchedule(message: ExecutorScheduleLike): boolean {
  return message.Push_Method === 'Bot' ||
    message.Push_Method === 'AI' ||
    (message.Push_Method === 'JiraAutomation' && hasConfiguredAiEndpoint(message.AI_Endpoint));
}

export function getDefaultScheduleTimeLabel(message: ExecutorScheduleLike): string {
  return isExecutorDrivenSchedule(message)
    ? `${EXECUTOR_DEFAULT_SCHEDULE_TIME} 后`
    : AS_ME_DEFAULT_SCHEDULE_TIME;
}

export function getEmptyScheduleTimeHint(message: ExecutorScheduleLike): string {
  return isExecutorDrivenSchedule(message)
    ? `留空则按 ${EXECUTOR_DEFAULT_SCHEDULE_TIME} 后排队。`
    : `留空则按 ${AS_ME_DEFAULT_SCHEDULE_TIME} 推送。`;
}

export function formatScheduleDateTimeForDisplay(
  dateStr: string,
  scheduleTime: string | undefined,
  message: ExecutorScheduleLike,
): string {
  return `${dateStr} ${normalizeLocalScheduleTime(scheduleTime) || getDefaultScheduleTime(message)}`;
}

function parseScheduleDateTime(
  dateStr: string,
  scheduleTime: string | undefined,
  message: ExecutorScheduleLike,
): Date {
  const date = parseLocalScheduleDate(dateStr);
  const normalizedTime = normalizeLocalScheduleTime(scheduleTime);
  if (hasLocalScheduleTime(scheduleTime) && !normalizedTime) {
    throw new Error('Invalid schedule time');
  }

  const { hours, minutes } = parseLocalScheduleTime(
    normalizedTime || getDefaultScheduleTime(message),
  );

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function parseRepeatDays(value?: string): number[] {
  if (!value || !value.trim()) return [];

  return Array.from(new Set(
    value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )).sort((a, b) => a - b);
}

function getWeekIndexSinceStart(candidate: Date, start: Date): number {
  const candidateDay = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const daysSinceStart = Math.floor((candidateDay.getTime() - startDay.getTime()) / 86400000);
  return Math.floor(daysSinceStart / 7);
}

function isAfterEndDate(candidate: Date, endDate?: string): boolean {
  if (!endDate?.trim()) {
    return false;
  }

  let parsedEndDate: Date;
  try {
    parsedEndDate = parseLocalScheduleDate(endDate);
  } catch {
    return false;
  }

  const candidateDay = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
  return candidateDay.getTime() > parsedEndDate.getTime();
}

function formatNextDateIfWithinEndDate(
  nextDate: Date,
  message: ScheduleLike,
): string {
  if (isAfterEndDate(nextDate, message.End_Date)) {
    return '';
  }

  return formatScheduleDateTimeForDisplay(
    formatLocalScheduleDate(nextDate),
    message.Schedule_Time,
    message,
  );
}

function hasReachedRepeatCount(message: ScheduleLike): boolean {
  const repeatCount = Number(message.Repeat_Count);
  if (!Number.isFinite(repeatCount) || repeatCount <= 0) {
    return false;
  }

  const execCount = Number(message.Exec_Count || 0);
  return Number.isFinite(execCount) && execCount >= repeatCount;
}

function findNextWeeklyRepeatDay(
  start: Date,
  now: Date,
  every: number,
  allowedDays: number[],
): Date | null {
  const searchFrom = new Date(Math.max(start.getTime(), now.getTime()));
  const searchDay = new Date(
    searchFrom.getFullYear(),
    searchFrom.getMonth(),
    searchFrom.getDate(),
  );
  const scheduleHours = start.getHours();
  const scheduleMinutes = start.getMinutes();

  for (let offset = 0; offset <= 366; offset++) {
    const candidate = new Date(
      searchDay.getFullYear(),
      searchDay.getMonth(),
      searchDay.getDate() + offset,
      scheduleHours,
      scheduleMinutes,
      0,
      0,
    );

    if (candidate.getTime() <= now.getTime()) {
      continue;
    }

    if (!allowedDays.includes(candidate.getDay())) {
      continue;
    }

    const weekIndex = getWeekIndexSinceStart(candidate, start);
    if (weekIndex >= 0 && weekIndex % every === 0) {
      return candidate;
    }
  }

  return null;
}

export function calculateScheduledMessageNextExecution(
  message: ScheduleLike,
  now = new Date(),
): string {
  if (!message.Schedule_Date) {
    return '';
  }

  let nextDate: Date;
  try {
    nextDate = parseScheduleDateTime(message.Schedule_Date, message.Schedule_Time, message);
  } catch {
    return '';
  }

  if (!message.Repeat_Every || !message.Repeat_Unit) {
    return formatScheduleDateTimeForDisplay(
      message.Schedule_Date,
      message.Schedule_Time,
      message,
    );
  }

  if (hasReachedRepeatCount(message)) {
    return '';
  }

  const every = Number(message.Repeat_Every);
  if (!Number.isFinite(every) || every <= 0) {
    return '';
  }

  const repeatDays = message.Repeat_Unit === 'Week'
    ? parseRepeatDays(message.Repeat_Days)
    : [];

  if (repeatDays.length > 0) {
    const weeklyNext = findNextWeeklyRepeatDay(nextDate, now, every, repeatDays);
    if (!weeklyNext) return '';
    return formatNextDateIfWithinEndDate(weeklyNext, message);
  }

  if (message.Repeat_Unit === 'Day') {
    for (let attempts = 0; attempts < 1000; attempts++) {
      if (isAfterEndDate(nextDate, message.End_Date)) {
        return '';
      }

      if (
        nextDate.getTime() > now.getTime() &&
        nextDate.getDay() >= 1 &&
        nextDate.getDay() <= 5
      ) {
        return formatNextDateIfWithinEndDate(nextDate, message);
      }

      nextDate.setDate(nextDate.getDate() + every);
    }

    return '';
  }

  while (nextDate.getTime() <= now.getTime()) {
    if (message.Repeat_Unit === 'Week') {
      nextDate.setDate(nextDate.getDate() + (7 * every));
    } else if (message.Repeat_Unit === 'Month') {
      nextDate.setMonth(nextDate.getMonth() + every);
    } else if (message.Repeat_Unit === 'Year') {
      nextDate.setFullYear(nextDate.getFullYear() + every);
    } else {
      return '';
    }
  }

  return formatNextDateIfWithinEndDate(nextDate, message);
}
