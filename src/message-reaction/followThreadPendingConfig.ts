export interface FollowThreadConfigRequestData {
  postId: string;
  sender: string;
  groupId: string;
  groupName: string;
  content: string;
  messageLink: string;
  messageTimestamp?: string | number;
  timestamp?: string | number;
}

export interface PendingFollowThreadConfig
  extends Omit<FollowThreadConfigRequestData, 'timestamp'> {
  requestedAt: number;
  requestTimestamp?: number;
  timestamp?: string | number;
}

const DEFAULT_PENDING_FOLLOW_THREAD_FRESHNESS_MS = 5 * 60 * 1000;

function normalizeEpochToMillis(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    return normalizeEpochToMillis(numeric);
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPendingFollowThreadConfig(
  data: FollowThreadConfigRequestData,
  requestedAt = Date.now(),
): PendingFollowThreadConfig {
  const { timestamp, messageTimestamp, ...rest } = data;
  return {
    ...rest,
    messageTimestamp: messageTimestamp ?? timestamp,
    requestedAt,
  };
}

export function getPendingFollowThreadRequestTime(
  config: Pick<
    PendingFollowThreadConfig,
    'requestedAt' | 'requestTimestamp' | 'timestamp'
  >,
): number | null {
  return normalizeEpochToMillis(
    config.requestedAt ?? config.requestTimestamp ?? config.timestamp,
  );
}

export function isPendingFollowThreadConfigFresh(
  config: Pick<
    PendingFollowThreadConfig,
    'requestedAt' | 'requestTimestamp' | 'timestamp'
  >,
  now = Date.now(),
  freshnessMs = DEFAULT_PENDING_FOLLOW_THREAD_FRESHNESS_MS,
): boolean {
  const requestTime = getPendingFollowThreadRequestTime(config);
  return requestTime !== null && now - requestTime < freshnessMs;
}

export function getPendingFollowThreadOriginalDatetime(
  config: Pick<
    PendingFollowThreadConfig,
    'messageTimestamp' | 'timestamp' | 'requestedAt'
  >,
): string | number {
  return config.messageTimestamp ?? config.timestamp ?? config.requestedAt;
}
