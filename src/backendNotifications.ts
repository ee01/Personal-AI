export type BackendNotificationLane = 'todo' | 'notice';
export type BackendNotificationPriority = 'high' | 'normal';
export type BackendNotificationSourceType = 'notification' | 'proposed_action';

export interface BackendNotificationMeta {
  sourceRef: string;
  lane: BackendNotificationLane;
  type?: string;
  targetHash: string;
  notificationId?: string;
}

export const BACKEND_NOTIFICATION_META_STORAGE_PREFIX =
  'backend_notification_meta_';

export function getBackendNotificationMetaStorageKey(
  notificationId: string,
): string {
  return `${BACKEND_NOTIFICATION_META_STORAGE_PREFIX}${notificationId}`;
}

export function buildBackendNotificationId(sourceRef: string): string {
  return `backend-${sourceRef.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function getBackendTargetHash(
  type?: string,
  sourceType?: BackendNotificationSourceType,
  sourceId?: string,
): string {
  if (sourceType === 'proposed_action') {
    return sourceId
      ? `/actions?actionId=${encodeURIComponent(sourceId)}`
      : '/actions';
  }
  if (type === 'dream_digest' || type === 'weekly_report') {
    return '/dreams';
  }
  if (type === 'project_update' || type === 'property_change') {
    return '/timeline';
  }
  return '/decisions';
}

export function inferLegacyLane(type?: string): BackendNotificationLane {
  if (type === 'dream_digest' || type === 'weekly_report') {
    return 'notice';
  }
  return 'todo';
}

function formatDueAt(dueAt: number): string {
  const date = new Date(dueAt * 1000);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rawHour = date.getHours();
  const rawMinute = date.getMinutes();
  const hour = rawHour < 10 ? `0${rawHour}` : String(rawHour);
  const minute = rawMinute < 10 ? `0${rawMinute}` : String(rawMinute);
  return `${month}/${day} ${hour}:${minute}`;
}

function compactNotificationText(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return '';
  const compacted = raw
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function firstPayloadPreview(
  payload: Record<string, unknown> | undefined,
  keys: string[],
  maxLength: number,
): string {
  if (!payload) return '';
  for (const key of keys) {
    const preview = compactNotificationText(payload[key], maxLength);
    if (preview) return preview;
  }
  return '';
}

export function buildBackendNotificationMessage(input: {
  body?: string;
  type?: string;
  payload?: Record<string, unknown>;
  maxLength?: number;
}): string {
  const maxLength = Math.max(40, input.maxLength ?? 200);
  const payloadPreview =
    input.type === 'dream_digest'
      ? firstPayloadPreview(
          input.payload,
          ['digestBody', 'summary', 'details', 'body'],
          maxLength,
        )
      : firstPayloadPreview(
          input.payload,
          ['summary', 'details', 'message'],
          maxLength,
        );
  const bodyPreview = compactNotificationText(input.body, maxLength);
  if (!payloadPreview) return bodyPreview;
  if (!bodyPreview) return payloadPreview;
  return compactNotificationText(
    `${bodyPreview} · ${payloadPreview}`,
    maxLength,
  );
}

export function buildBackendNotificationContextMessage(
  lane: BackendNotificationLane,
  priority: BackendNotificationPriority,
  dueAt?: number,
): string {
  const laneLabel = lane === 'todo' ? '待处理' : '通知';
  const priorityLabel = priority === 'high' ? '高优先级' : '普通';
  const parts = [`${laneLabel}`, `${priorityLabel}`];
  if (lane === 'todo' && typeof dueAt === 'number' && dueAt > 0) {
    parts.push(`截止 ${formatDueAt(dueAt)}`);
  }
  return parts.join(' · ');
}

export function buildBackendNotificationButtons(
  lane: BackendNotificationLane,
): Array<{ title: string }> {
  return [
    { title: lane === 'todo' ? '查看待办' : '查看通知' },
    { title: '忽略' },
  ];
}

export function normalizeBackendNotificationMeta(
  value: unknown,
): BackendNotificationMeta | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceRef !== 'string' || !record.sourceRef.trim()) {
    return null;
  }
  if (record.lane !== 'todo' && record.lane !== 'notice') {
    return null;
  }
  if (
    typeof record.targetHash !== 'string' ||
    !record.targetHash.startsWith('/')
  ) {
    return null;
  }

  const meta: BackendNotificationMeta = {
    sourceRef: record.sourceRef,
    lane: record.lane,
    targetHash: record.targetHash,
  };
  if (typeof record.type === 'string' && record.type.trim()) {
    meta.type = record.type;
  }
  if (
    typeof record.notificationId === 'string' &&
    record.notificationId.trim()
  ) {
    meta.notificationId = record.notificationId;
  }
  return meta;
}
