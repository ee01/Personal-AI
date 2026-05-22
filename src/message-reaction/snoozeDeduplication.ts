import type { ScheduledMessage } from '../scheduled-messages/types';
import { normalizeLocalScheduleTime } from '../scheduled-messages/scheduleDateTime.js';
import type { MessageInfo } from './SnoozeManager';

const CLOSED_SNOOZE_STATUSES = new Set(['Completed', 'Done']);

export interface SnoozeReminderScheduleExpectation {
  scheduleDate?: string;
  scheduleTime?: string;
}

export function getScheduledMessageCategories(category?: string): string[] {
  return (category || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isClosedSnoozeStatus(status?: string): boolean {
  return CLOSED_SNOOZE_STATUSES.has(status || '');
}

export function isOpenSnoozeReminder(
  message: Pick<ScheduledMessage, 'Category' | 'Status'>,
): boolean {
  return (
    getScheduledMessageCategories(message.Category).includes('Snooze') &&
    !isClosedSnoozeStatus(message.Status)
  );
}

export function getSnoozeReminderSourceKey(
  messageInfo: Pick<MessageInfo, 'groupId' | 'id' | 'messageLink'>,
): string {
  const sourceLink = messageInfo.messageLink?.trim();
  if (sourceLink) {
    return sourceLink;
  }

  const groupId = messageInfo.groupId?.trim();
  const messageId = messageInfo.id?.trim();
  if (groupId && messageId) {
    return `${groupId}:${messageId}`;
  }

  return messageId || '';
}

export function isOpenSnoozeReminderForMessage(
  message: ScheduledMessage,
  messageInfo: Pick<MessageInfo, 'messageLink'>,
): boolean {
  const sourceLink = messageInfo.messageLink?.trim();
  if (!sourceLink) {
    return false;
  }

  if (!isOpenSnoozeReminder(message)) {
    return false;
  }

  return Boolean(message.Content?.includes(sourceLink));
}

export function findOpenSnoozeReminderForMessage(
  messages: ScheduledMessage[],
  messageInfo: Pick<MessageInfo, 'messageLink'>,
): ScheduledMessage | null {
  return (
    messages.find((message) =>
      isOpenSnoozeReminderForMessage(message, messageInfo),
    ) || null
  );
}

export function doesSnoozeReminderMatchSchedule(
  message: Pick<ScheduledMessage, 'Schedule_Date' | 'Schedule_Time'>,
  expectation: SnoozeReminderScheduleExpectation = {},
): boolean {
  const expectedDate = expectation.scheduleDate?.trim();
  if (expectedDate && message.Schedule_Date?.trim() !== expectedDate) {
    return false;
  }

  const rawExpectedTime = expectation.scheduleTime?.trim();
  const expectedTime = normalizeLocalScheduleTime(rawExpectedTime);
  if (rawExpectedTime && !expectedTime) {
    return false;
  }

  if (!expectedTime) {
    return true;
  }

  return normalizeLocalScheduleTime(message.Schedule_Time) === expectedTime;
}
