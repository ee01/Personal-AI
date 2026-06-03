import { parseLocalScheduleDate, parseLocalScheduleTime, formatLocalScheduleTimezoneLabel } from './scheduleDateTime.js';
import type { ScheduledMessage } from './types.js';

interface JiraScheduleRestoreTiming {
  localDate: string;
  localTime: string;
  timezoneLabel: string;
  utcTime: string;
}

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getMessageLocalDate(message: Pick<ScheduledMessage, 'Schedule_Date'>): Date {
  if (message.Schedule_Date) {
    try {
      return parseLocalScheduleDate(message.Schedule_Date);
    } catch (error) {
      console.warn('无法解析计划日期，使用当前日期恢复 Jira trigger:', error);
    }
  }

  return new Date();
}

export function getJiraScheduleRestoreTiming(
  message: Pick<ScheduledMessage, 'Schedule_Date' | 'Schedule_Time'>,
): JiraScheduleRestoreTiming {
  const scheduleDate = getMessageLocalDate(message);
  let localTime = '09:00';

  try {
    localTime = parseLocalScheduleTime(message.Schedule_Time || localTime).timeStr;
  } catch (error) {
    console.warn('无法解析计划时间，使用 09:00 恢复 Jira trigger:', error);
  }

  const [localHours, localMinutes] = localTime.split(':').map(Number);
  const localDateTime = new Date(
    scheduleDate.getFullYear(),
    scheduleDate.getMonth(),
    scheduleDate.getDate(),
    localHours,
    localMinutes,
    0,
    0,
  );

  return {
    localDate: message.Schedule_Date || `${scheduleDate.getFullYear()}-${padTimePart(scheduleDate.getMonth() + 1)}-${padTimePart(scheduleDate.getDate())}`,
    localTime,
    timezoneLabel: formatLocalScheduleTimezoneLabel(localDateTime),
    utcTime: `${padTimePart(localDateTime.getUTCHours())}:${padTimePart(localDateTime.getUTCMinutes())}`,
  };
}
