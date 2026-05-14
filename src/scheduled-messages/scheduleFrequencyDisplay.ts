import type { ScheduledMessage } from './types';
import {
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleDate,
} from './scheduleDateTime.js';
import { getDefaultScheduleTime, isExecutorDrivenSchedule } from './scheduleNextExecution.js';

type FrequencyDisplayMessage = Pick<
  ScheduledMessage,
  | 'Schedule_Date'
  | 'Schedule_Time'
  | 'Repeat_Every'
  | 'Repeat_Unit'
  | 'Repeat_Days'
  | 'Push_Method'
  | 'AI_Endpoint'
>;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function parseRepeatDays(value?: string): number[] {
  if (!value?.trim()) {
    return [];
  }

  return Array.from(new Set(
    value
      .split(',')
      .map((day) => Number(day.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )).sort((left, right) => left - right);
}

function getScheduleDateWeekday(scheduleDate?: string): string {
  if (!scheduleDate) {
    return '';
  }

  try {
    return WEEKDAYS[parseLocalScheduleDate(scheduleDate).getDay()];
  } catch {
    return '';
  }
}

function formatRepeatDays(days: number[]): string {
  if (
    days.length === 5 &&
    days[0] === 1 &&
    days[1] === 2 &&
    days[2] === 3 &&
    days[3] === 4 &&
    days[4] === 5
  ) {
    return '工作日';
  }

  if (days.length === 2 && days[0] === 0 && days[1] === 6) {
    return '周末';
  }

  return `周${days.map((day) => WEEKDAYS[day]).join('、')}`;
}

function formatWeeklyFrequency(message: FrequencyDisplayMessage, every: number): string {
  const repeatDays = parseRepeatDays(message.Repeat_Days);

  if (repeatDays.length > 0) {
    const daysLabel = formatRepeatDays(repeatDays);
    if (every === 1) {
      if (daysLabel === '工作日' || daysLabel === '周末') {
        return daysLabel;
      }

      return `每${daysLabel}`;
    }

    return `每 ${every} 周的${daysLabel}`;
  }

  const scheduleWeekday = getScheduleDateWeekday(message.Schedule_Date);
  if (every === 1) {
    return scheduleWeekday ? `每周${scheduleWeekday}` : '每周';
  }

  return scheduleWeekday ? `每 ${every} 周的周${scheduleWeekday}` : `每 ${every} 周`;
}

function formatBaseFrequency(message: FrequencyDisplayMessage): string {
  if (!message.Repeat_Every || !message.Repeat_Unit) {
    return '推送一次';
  }

  const every = Number(message.Repeat_Every);
  if (!Number.isFinite(every) || every <= 0) {
    return '重复规则异常';
  }

  if (message.Repeat_Unit === 'Day') {
    return every === 1 ? '每个工作日' : `每 ${every} 天（仅工作日）`;
  }

  if (message.Repeat_Unit === 'Week') {
    return formatWeeklyFrequency(message, every);
  }

  if (message.Repeat_Unit === 'Month') {
    const day = (() => {
      try {
        return message.Schedule_Date ? parseLocalScheduleDate(message.Schedule_Date).getDate() : null;
      } catch {
        return null;
      }
    })();

    if (!day) {
      return every === 1 ? '每月' : `每 ${every} 月`;
    }

    return every === 1 ? `每月 ${day} 号` : `每 ${every} 月的 ${day} 号`;
  }

  if (message.Repeat_Unit === 'Year') {
    if (every !== 1) {
      return `每 ${every} 年`;
    }

    try {
      if (!message.Schedule_Date) {
        return '每年';
      }
      const date = parseLocalScheduleDate(message.Schedule_Date);
      return `每年 ${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return '每年';
    }
  }

  return '重复规则异常';
}

export function formatScheduledMessageFrequency(message: FrequencyDisplayMessage): string {
  const baseFrequency = formatBaseFrequency(message);

  if (hasLocalScheduleTime(message.Schedule_Time)) {
    const normalizedScheduleTime = normalizeLocalScheduleTime(message.Schedule_Time);
    return normalizedScheduleTime
      ? `${baseFrequency} ${normalizedScheduleTime}`
      : `${baseFrequency} 时间格式异常`;
  }

  const defaultTime = getDefaultScheduleTime({
    Push_Method: message.Push_Method,
    AI_Endpoint: message.AI_Endpoint,
  });

  return isExecutorDrivenSchedule({
    Push_Method: message.Push_Method,
    AI_Endpoint: message.AI_Endpoint,
  })
    ? `${baseFrequency} ${defaultTime} 后`
    : `${baseFrequency} ${defaultTime}`;
}
