import type { ScheduledMessage } from '../scheduled-messages/types';
import type { MessageInfo } from './SnoozeManager';

const CLOSED_SNOOZE_STATUSES = new Set(['Completed', 'Done']);

function getScheduledMessageCategories(category?: string): string[] {
  return (category || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

  if (!getScheduledMessageCategories(message.Category).includes('Snooze')) {
    return false;
  }

  if (CLOSED_SNOOZE_STATUSES.has(message.Status)) {
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
