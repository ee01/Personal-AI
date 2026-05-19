import type { ScheduledMessage } from './types';
import {
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleDate,
  parseLocalScheduleTime,
} from './scheduleDateTime.js';
import { getDefaultScheduleTime } from './scheduleNextExecution.js';

const SCHEDULE_REACTIVATION_FIELDS: Array<keyof ScheduledMessage> = [
  'Schedule_Date',
  'Schedule_Time',
  'Push_Method',
  'AI_Endpoint',
  'Repeat_Every',
  'Repeat_Unit',
  'Repeat_Count',
  'Repeat_Days',
  'End_Date',
  'Timeline_Milestone',
];

function normalizeComparableValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function isOneTimeSchedule(message: ScheduledMessage): boolean {
  return Boolean(
    normalizeComparableValue(message.Schedule_Date) &&
      !normalizeComparableValue(message.Timeline_Milestone) &&
      !normalizeComparableValue(message.Repeat_Every) &&
      !normalizeComparableValue(message.Repeat_Unit),
  );
}

function getOneTimeScheduledAt(message: ScheduledMessage): Date | null {
  if (!isOneTimeSchedule(message)) {
    return null;
  }

  try {
    const scheduledAt = parseLocalScheduleDate(String(message.Schedule_Date));
    const normalizedTime = normalizeLocalScheduleTime(message.Schedule_Time);

    if (hasLocalScheduleTime(message.Schedule_Time) && !normalizedTime) {
      return null;
    }

    const { hours, minutes } = parseLocalScheduleTime(
      normalizedTime || getDefaultScheduleTime(message),
    );
    scheduledAt.setHours(hours, minutes, 0, 0);
    return scheduledAt;
  } catch {
    return null;
  }
}

function hasScheduleRelatedUpdate(updates: Partial<ScheduledMessage>): boolean {
  return SCHEDULE_REACTIVATION_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(updates, field),
  );
}

function hasScheduleChanged(
  previousMessage: ScheduledMessage,
  updatedMessage: ScheduledMessage,
): boolean {
  const previousScheduledAt = getOneTimeScheduledAt(previousMessage);
  const updatedScheduledAt = getOneTimeScheduledAt(updatedMessage);

  if (previousScheduledAt && updatedScheduledAt) {
    return previousScheduledAt.getTime() !== updatedScheduledAt.getTime();
  }

  return SCHEDULE_REACTIVATION_FIELDS.some(
    (field) =>
      normalizeComparableValue(previousMessage[field]) !==
      normalizeComparableValue(updatedMessage[field]),
  );
}

export function shouldReactivateDoneOneTimeMessageAfterScheduleChange(
  previousMessage: ScheduledMessage,
  updatedMessage: ScheduledMessage,
  updates: Partial<ScheduledMessage>,
  now = new Date(),
): boolean {
  if (previousMessage.Status !== 'Done') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'Status')) {
    return false;
  }

  if (!hasScheduleRelatedUpdate(updates)) {
    return false;
  }

  const updatedScheduledAt = getOneTimeScheduledAt(updatedMessage);
  if (!updatedScheduledAt || updatedScheduledAt.getTime() <= now.getTime()) {
    return false;
  }

  return hasScheduleChanged(previousMessage, updatedMessage);
}
