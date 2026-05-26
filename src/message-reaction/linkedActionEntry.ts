import type { PendingLinkedActionConfig } from '../modals/linkedActionHelpers';

export interface OpenLinkedActionConfigPayload {
  sender?: string;
  groupId?: string;
  groupName?: string;
  content?: string;
  messageId?: string;
  timestamp?: string | number;
  messageLink?: string;
}

export function buildPendingLinkedActionConfig(
  payload: OpenLinkedActionConfigPayload,
  requestedAt = Date.now(),
): PendingLinkedActionConfig {
  return {
    sender: payload.sender,
    groupId: payload.groupId,
    groupName: payload.groupName,
    content: payload.content,
    messageId: payload.messageId,
    timestamp: requestedAt,
    messageTimestamp: payload.timestamp,
    messageLink: payload.messageLink,
  };
}
