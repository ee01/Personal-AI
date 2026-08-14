export interface LocalScheduleDateTime {
  dateStr: string;
  timeStr: string;
}

export interface LocalScheduleTime {
  hours: number;
  minutes: number;
  timeStr: string;
}

const INVISIBLE_TIME_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;
const LOCAL_SCHEDULE_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeChinesePeriod(value: string): 'AM' | 'PM' {
  return value === '下午' ? 'PM' : 'AM';
}

export function getLocalScheduleTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
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

export function getLocalScheduleTimeText(
  value?: string | number | null,
): string {
  return value === undefined || value === null
    ? ''
    : String(value).replace(INVISIBLE_TIME_CHARS, '').trim();
}

export function hasLocalScheduleTime(value?: string | number | null): boolean {
  return getLocalScheduleTimeText(value).length > 0;
}

export function normalizeLocalScheduleTime(
  value?: string | number | null,
): string | undefined {
  let trimmed = getLocalScheduleTimeText(value);
  if (!trimmed) {
    return undefined;
  }

  let localizedPeriod = '';
  const chinesePrefix = /^(上午|下午)\s*/.exec(trimmed);
  if (chinesePrefix) {
    localizedPeriod = normalizeChinesePeriod(chinesePrefix[1]);
    trimmed = trimmed.slice(chinesePrefix[0].length).trim();
  }

  const chineseSuffix = /\s*(上午|下午)$/.exec(trimmed);
  if (chineseSuffix) {
    localizedPeriod = normalizeChinesePeriod(chineseSuffix[1]);
    trimmed = trimmed.slice(0, chineseSuffix.index).trim();
  }

  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/i.exec(trimmed);
  if (!match) {
    return undefined;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  const period = match[4]?.toUpperCase() || localizedPeriod;

  if (period) {
    if (!Number.isInteger(hours) || hours < 1 || hours > 12) {
      return undefined;
    }

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
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
  const trimmed = getLocalScheduleTimeText(value);
  return !trimmed || normalizeLocalScheduleTime(trimmed) !== undefined;
}

export function formatTimezoneOffsetFromMinutes(timezoneOffsetMinutes: number): string {
  if (!Number.isFinite(timezoneOffsetMinutes)) {
    return 'UTC';
  }

  const totalMinutes = -timezoneOffsetMinutes;
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  return `UTC${sign}${padDatePart(hours)}:${padDatePart(minutes)}`;
}

function parseLocalScheduleDateTimeForTimezone(value: string): Date | null {
  const match = LOCAL_SCHEDULE_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = match[4] === undefined ? 12 : Number(match[4]);
  const minutes = match[5] === undefined ? 0 : Number(match[5]);
  const seconds = match[6] === undefined ? 0 : Number(match[6]);
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null;
  }

  return date;
}

function coerceTimezoneReferenceDate(value?: Date | string | number | null): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  if (typeof value === 'string') {
    const localDate = parseLocalScheduleDateTimeForTimezone(value);
    if (localDate) {
      return localDate;
    }
  }

  if (value !== undefined && value !== null) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
}

export function formatLocalScheduleTimezoneLabel(
  value?: Date | string | number | null,
): string {
  const date = coerceTimezoneReferenceDate(value);
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || '本机时区';

  return `${timezoneName} (${formatTimezoneOffsetFromMinutes(date.getTimezoneOffset())})`;
}

export function formatLocalScheduleTimezoneHint(
  value?: Date | string | number | null,
): string {
  return `本机时区：${formatLocalScheduleTimezoneLabel(value)}；跨时区接收人请按此时间换算。`;
}
