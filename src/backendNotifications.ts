export type BackendNotificationLane = 'todo' | 'notice';
export type BackendNotificationPriority = 'high' | 'normal';
export type BackendNotificationSourceType = 'notification' | 'proposed_action';
export type BackendNotificationDeliveryStatus =
  | 'delivered'
  | 'failed'
  | 'clicked'
  | 'dismissed';

export type BackendNotificationDeliveryReason =
  | 'new'
  | 'retry_after_cooldown'
  | 'previous_delivery_failed';

export interface BackendNotificationDeliveryContext {
  reason: BackendNotificationDeliveryReason;
  lastStatus?: BackendNotificationDeliveryStatus;
  lastAttemptAt?: number;
  lastDeliveredAt?: number;
}

export interface BackendNotificationMeta {
  sourceRef: string;
  sourceType?: BackendNotificationSourceType;
  lane: BackendNotificationLane;
  type?: string;
  targetHash: string;
  notificationId?: string;
  dueAt?: number;
}

export const BACKEND_NOTIFICATION_META_STORAGE_PREFIX =
  'backend_notification_meta_';
export const DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS = 24 * 60 * 60;

const MIN_DUE_AWARE_SNOOZE_SECONDS = 5 * 60;
const OVERDUE_NOTIFICATION_SNOOZE_SECONDS = 15 * 60;
const DUE_REMINDER_BUFFER_SECONDS = 15 * 60;

export function getBackendNotificationMetaStorageKey(
  notificationId: string,
): string {
  return `${BACKEND_NOTIFICATION_META_STORAGE_PREFIX}${notificationId}`;
}

export function buildBackendNotificationId(sourceRef: string): string {
  return `backend-${sourceRef.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function getStringPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getBackendTargetHash(
  type?: string,
  sourceType?: BackendNotificationSourceType,
  sourceId?: string,
  payload?: Record<string, unknown>,
): string {
  if (sourceType === 'proposed_action') {
    return sourceId
      ? `/actions?actionId=${encodeURIComponent(sourceId)}`
      : '/actions';
  }
  const confirmRequestId = getStringPayloadValue(payload, 'confirmRequestId');
  if (sourceType === 'notification' && confirmRequestId) {
    return `/decisions?confirmRequestId=${encodeURIComponent(
      confirmRequestId,
    )}`;
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

function getSnoozeReminderContextLabel(
  payload?: Record<string, unknown>,
): string | undefined {
  const snooze = payload?.snooze;
  if (!snooze || typeof snooze !== 'object') return undefined;

  const count = (snooze as Record<string, unknown>).count;
  if (typeof count === 'number' && Number.isFinite(count) && count > 1) {
    return `第${Math.floor(count)}次稍后提醒`;
  }
  return '稍后提醒';
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
  deliveryContext?: BackendNotificationDeliveryContext,
  payload?: Record<string, unknown>,
): string {
  const laneLabel = lane === 'todo' ? '待处理' : '通知';
  const priorityLabel = priority === 'high' ? '高优先级' : '普通';
  const parts = [`${laneLabel}`, `${priorityLabel}`];
  if (lane === 'todo' && typeof dueAt === 'number' && dueAt > 0) {
    parts.push(`截止 ${formatDueAt(dueAt)}`);
  }
  const snoozeLabel = getSnoozeReminderContextLabel(payload);
  if (snoozeLabel) {
    parts.push(snoozeLabel);
  }
  if (deliveryContext?.reason === 'retry_after_cooldown') {
    parts.push('再次提醒');
  } else if (deliveryContext?.reason === 'previous_delivery_failed') {
    parts.push('上次发送失败');
  }
  return parts.join(' · ');
}

export function buildBackendNotificationButtons(
  lane: BackendNotificationLane,
  sourceType?: BackendNotificationSourceType,
): Array<{ title: string }> {
  let secondaryTitle = '忽略';
  if (sourceType === 'notification' && lane === 'todo') {
    secondaryTitle = '稍后提醒';
  } else if (sourceType === 'notification' && lane === 'notice') {
    secondaryTitle = '不再提示';
  } else if (sourceType === 'proposed_action') {
    secondaryTitle = '暂不提醒';
  }

  return [
    { title: lane === 'todo' ? '查看待办' : '查看通知' },
    { title: secondaryTitle },
  ];
}

export function getBackendNotificationSnoozeSeconds(
  meta: Pick<BackendNotificationMeta, 'lane' | 'dueAt'>,
  nowSeconds = Math.floor(Date.now() / 1000),
): number {
  if (
    meta.lane !== 'todo' ||
    typeof meta.dueAt !== 'number' ||
    !Number.isFinite(meta.dueAt)
  ) {
    return DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS;
  }

  const secondsUntilDue = Math.floor(meta.dueAt - nowSeconds);
  if (secondsUntilDue <= 0) {
    return OVERDUE_NOTIFICATION_SNOOZE_SECONDS;
  }

  if (secondsUntilDue <= DUE_REMINDER_BUFFER_SECONDS) {
    return Math.max(
      MIN_DUE_AWARE_SNOOZE_SECONDS,
      Math.floor(secondsUntilDue / 2),
    );
  }

  return Math.min(
    DEFAULT_BACKEND_NOTIFICATION_SNOOZE_SECONDS,
    secondsUntilDue - DUE_REMINDER_BUFFER_SECONDS,
  );
}

export function getBackendNotificationSecondaryActionDeliveryStatus(
  meta: Pick<BackendNotificationMeta, 'lane' | 'sourceType'>,
): BackendNotificationDeliveryStatus {
  if (meta.lane === 'todo' && meta.sourceType === 'proposed_action') {
    return 'delivered';
  }

  return 'dismissed';
}

export function getBackendNotificationClosedDeliveryStatus(
  meta: Pick<BackendNotificationMeta, 'lane'>,
): BackendNotificationDeliveryStatus {
  return meta.lane === 'todo' ? 'delivered' : 'dismissed';
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
  if (
    record.sourceType === 'notification' ||
    record.sourceType === 'proposed_action'
  ) {
    meta.sourceType = record.sourceType;
  }
  if (typeof record.type === 'string' && record.type.trim()) {
    meta.type = record.type;
  }
  if (
    typeof record.notificationId === 'string' &&
    record.notificationId.trim()
  ) {
    meta.notificationId = record.notificationId;
  }
  if (
    typeof record.dueAt === 'number' &&
    Number.isFinite(record.dueAt) &&
    record.dueAt > 0
  ) {
    meta.dueAt = record.dueAt;
  }
  return meta;
}
