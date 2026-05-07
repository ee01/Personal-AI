export interface LocalScheduleDateTime {
  dateStr: string;
  timeStr: string;
}

export interface LocalScheduleTime {
  hours: number;
  minutes: number;
  timeStr: string;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalScheduleDate(value: Date | string | number): string {
  return formatLocalScheduleDateTime(value).dateStr;
}

export function formatLocalScheduleTime(value: Date | string | number): string {
  return formatLocalScheduleDateTime(value).timeStr;
}

export function formatLocalScheduleDateTime(
  value: Date | string | number,
): LocalScheduleDateTime {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
        ? parseLocalScheduleDate(value)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid schedule date');
  }

  return {
    dateStr: `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    timeStr: `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`,
  };
}

export function getTodayLocalScheduleDate(): string {
  return formatLocalScheduleDate(new Date());
}

export function parseLocalScheduleDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error('Invalid schedule date');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Invalid schedule date');
  }

  return date;
}

export function getLocalScheduleDayOfWeek(value: string): number {
  return parseLocalScheduleDate(value).getDay();
}

export function normalizeLocalScheduleTime(
  value?: string | number | null,
): string | undefined {
  const trimmed = value === undefined || value === null ? '' : String(value).trim();
  if (!trimmed) {
    return undefined;
  }

  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  return `${padDatePart(hours)}:${padDatePart(minutes)}`;
}

export function parseLocalScheduleTime(value: string | number): LocalScheduleTime {
  const normalized = normalizeLocalScheduleTime(value);
  if (!normalized) {
    throw new Error('Invalid schedule time');
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return {
    hours,
    minutes,
    timeStr: normalized,
  };
}

export function isValidLocalScheduleTime(value?: string | number | null): boolean {
  const trimmed = value === undefined || value === null ? '' : String(value).trim();
  return !trimmed || normalizeLocalScheduleTime(trimmed) !== undefined;
}
