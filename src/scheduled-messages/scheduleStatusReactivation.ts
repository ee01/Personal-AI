import type { ScheduledMessage } from './types';
import {
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleDate,
  parseLocalScheduleTime,
} from './scheduleDateTime.js';
import {
  calculateScheduledMessageNextExecution,
  getDefaultScheduleTime,
} from './scheduleNextExecution.js';

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

function isRepeatingSchedule(message: ScheduledMessage): boolean {
  return Boolean(
    normalizeComparableValue(message.Repeat_Every) &&
      normalizeComparableValue(message.Repeat_Unit),
  );
}

function isOneTimeSchedule(message: ScheduledMessage): boolean {
  return Boolean(
    normalizeComparableValue(message.Schedule_Date) &&
      !normalizeComparableValue(message.Timeline_Milestone) &&
      !isRepeatingSchedule(message),
  );
}

function parseNextExecutionAt(nextExec: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})(?::\d{1,2})?$/.exec(nextExec.trim());
  if (!match) {
    return null;
  }

  try {
    const scheduledAt = parseLocalScheduleDate(match[1]);
    const { hours, minutes } = parseLocalScheduleTime(match[2]);
    scheduledAt.setHours(hours, minutes, 0, 0);
    return scheduledAt;
  } catch {
    return null;
  }
}

function getNextScheduledAt(message: ScheduledMessage, now: Date): Date | null {
  const nextExec = calculateScheduledMessageNextExecution(message, now);
  if (!nextExec.trim()) {
    return null;
  }

  const parsed = parseNextExecutionAt(nextExec);
  if (parsed) {
    return parsed;
  }

  // One-time rows can still be compared through the original schedule fields
  // when Next_Exec is missing or malformed.
  if (!isOneTimeSchedule(message) || !message.Schedule_Date) {
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
  return SCHEDULE_REACTIVATION_FIELDS.some(
    (field) =>
      normalizeComparableValue(previousMessage[field]) !==
      normalizeComparableValue(updatedMessage[field]),
  );
}

function previewMessageForReactivation(
  previousMessage: ScheduledMessage,
  updatedMessage: ScheduledMessage,
): ScheduledMessage {
  if (isOneTimeSchedule(previousMessage) && isRepeatingSchedule(updatedMessage)) {
    return {
      ...updatedMessage,
      Exec_Count: 0,
    };
  }

  return updatedMessage;
}

export function shouldReactivateDoneMessageAfterScheduleChange(
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

  if (!hasScheduleChanged(previousMessage, updatedMessage)) {
    return false;
  }

  const previewMessage = previewMessageForReactivation(previousMessage, updatedMessage);
  const nextScheduledAt = getNextScheduledAt(previewMessage, now);
  return Boolean(nextScheduledAt && nextScheduledAt.getTime() > now.getTime());
}

/** @deprecated Use shouldReactivateDoneMessageAfterScheduleChange */
export const shouldReactivateDoneOneTimeMessageAfterScheduleChange =
  shouldReactivateDoneMessageAfterScheduleChange;

export function applyDoneScheduleReactivation(
  previousMessage: ScheduledMessage,
  updatedMessage: ScheduledMessage,
): void {
  updatedMessage.Status = 'Active';
  updatedMessage.Last_Exec = '';
  updatedMessage.Exec_Log = '待执行';

  if (isOneTimeSchedule(previousMessage) && isRepeatingSchedule(updatedMessage)) {
    updatedMessage.Exec_Count = 0;
  }
}
