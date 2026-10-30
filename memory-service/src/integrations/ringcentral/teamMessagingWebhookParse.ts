import type { IngestPayload } from '../../types/index.js';
import {
  parseIsoToUnixSeconds,
  type ParsedTeamMessagingNotification,
} from './teamMessagingWebhookTypes.js';

export function notificationToIngestPayload(
  note: ParsedTeamMessagingNotification,
  input: { groupName?: string; capturePath: 'webhook' | 'backfill' },
): IngestPayload {
  const timestamp =
    parseIsoToUnixSeconds(note.modifiedTime) ??
    parseIsoToUnixSeconds(note.creationTime) ??
    Math.floor(Date.now() / 1000);

  return {
    content: note.text,
    sourceType: 'glip',
    scope: 'work',
    source: note.groupId,
    sender: note.creatorName || note.creatorId || 'unknown',
    groupId: note.groupId,
    groupName: input.groupName,
    timestamp,
    skipExtraction: input.capturePath === 'backfill',
    metadata: {
      postId: note.postId,
      groupId: note.groupId,
      threadRootPostId: note.postId,
      creatorId: note.creatorId,
      capturePath: input.capturePath,
      rcEventType: note.eventType,
      creationTime: note.creationTime,
      modifiedTime: note.modifiedTime,
    },
  };
}

export function extractTeamMessagingNotification(
  body: unknown,
  headers: Record<string, string | string[] | undefined>,
): ParsedTeamMessagingNotification | null {
  const envelope =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  if (!envelope) return null;

  const nestedBody =
    envelope.body && typeof envelope.body === 'object'
      ? (envelope.body as Record<string, unknown>)
      : envelope;

  const postId = String(
    nestedBody.id ?? nestedBody.postId ?? nestedBody.post_id ?? '',
  ).trim();
  const groupId = String(
    nestedBody.groupId ?? nestedBody.group_id ?? nestedBody.chatId ?? '',
  ).trim();
  if (!postId || !groupId) return null;

  const eventTypeRaw =
    nestedBody.eventType ??
    nestedBody.type ??
    envelope.eventType ??
    inferEventTypeFromHeader(headers);
  const eventType = parseEventType(eventTypeRaw);

  const deliveryKey = String(
    envelope.uuid ??
      envelope.id ??
      `${postId}:${eventType}:${nestedBody.modifiedTime ?? nestedBody.creationTime ?? ''}`,
  );

  return {
    deliveryKey,
    eventType,
    subscriptionId:
      typeof envelope.subscriptionId === 'string'
        ? envelope.subscriptionId
        : undefined,
    postId,
    groupId,
    text: typeof nestedBody.text === 'string' ? nestedBody.text : '',
    creatorId:
      typeof nestedBody.creatorId === 'string'
        ? nestedBody.creatorId
        : undefined,
    creationTime:
      typeof nestedBody.creationTime === 'string'
        ? nestedBody.creationTime
        : undefined,
    modifiedTime:
      typeof nestedBody.modifiedTime === 'string'
        ? nestedBody.modifiedTime
        : undefined,
    raw: nestedBody,
  };
}

function inferEventTypeFromHeader(
  headers: Record<string, string | string[] | undefined>,
): string {
  const eventHeader = headers['x-ringcentral-event'] ?? headers['rc-event'];
  if (Array.isArray(eventHeader)) return eventHeader[0] ?? '';
  return eventHeader ?? '';
}

function parseEventType(value: unknown): ParsedTeamMessagingNotification['eventType'] {
  const normalized = String(value ?? '').trim();
  if (normalized.includes('PostAdded') || normalized === 'Created') return 'PostAdded';
  if (normalized.includes('PostChanged') || normalized === 'Modified') {
    return 'PostChanged';
  }
  if (normalized.includes('PostRemoved') || normalized === 'Deleted') {
    return 'PostRemoved';
  }
  return 'Unknown';
}

export function readValidationToken(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  for (const name of ['validation-token', 'verification-token']) {
    const raw = headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
