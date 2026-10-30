export const RC_TM_POSTS_EVENT_FILTER = '/team-messaging/v1/posts';

export type TeamMessagingPostEventType =
  | 'PostAdded'
  | 'PostChanged'
  | 'PostRemoved'
  | 'Unknown';

export interface ParsedTeamMessagingNotification {
  deliveryKey: string;
  eventType: TeamMessagingPostEventType;
  subscriptionId?: string;
  postId: string;
  groupId: string;
  text: string;
  creatorId?: string;
  creatorName?: string;
  creationTime?: string;
  modifiedTime?: string;
  raw: Record<string, unknown>;
}

export function parseTeamMessagingPostEventType(
  value: unknown,
): TeamMessagingPostEventType {
  const normalized = String(value ?? '').trim();
  if (normalized === 'PostAdded') return 'PostAdded';
  if (normalized === 'PostChanged') return 'PostChanged';
  if (normalized === 'PostRemoved') return 'PostRemoved';
  return 'Unknown';
}

export function parseIsoToUnixSeconds(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000);
}
