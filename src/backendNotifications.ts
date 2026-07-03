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
  | 'previous_delivery_failed'
  | 'already_delivered_unfinished';

export interface BackendNotificationDeliveryContext {
  channel?: 'chrome' | 'doubao' | 'glip';
  reason: BackendNotificationDeliveryReason;
  lastStatus?: BackendNotificationDeliveryStatus;
  effectiveStatus?: BackendNotificationDeliveryStatus;
  hasSuccessfulDelivery?: boolean;
  lastAttemptAt?: number;
  lastDeliveredAt?: number;
  lastError?: string;
}

export interface BackendNotificationChannelReceipt {
  channel: 'chrome' | 'doubao' | 'glip';
  state: 'not_attempted' | 'delivered' | 'failed' | 'clicked' | 'dismissed';
  label: string;
  detail?: string;
  status?: BackendNotificationDeliveryStatus;
  effectiveStatus?: BackendNotificationDeliveryStatus;
  hasSuccessfulDelivery: boolean;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface BackendNotificationEvidenceReceipt {
  evidenceCount: number;
  label: string;
  detail?: string;
  boundary?: string;
  sampleRefs?: string[];
}

export interface BackendNotificationSnoozeReceipt {
  label: string;
  detail?: string;
  boundary?: string;
  sourceNotificationId?: string;
  rootNotificationId?: string;
  snoozedAt?: number;
  scheduledAt?: number;
  delaySeconds?: number;
  count: number;
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

export interface BackendNotificationDeliveryEvent {
  sourceRef: string;
  lane: BackendNotificationLane;
  status: BackendNotificationDeliveryStatus;
  externalRef?: string;
  error?: string;
}

export interface BackendNotificationSecondaryActionHandlers {
  reportDelivery(events: BackendNotificationDeliveryEvent[]): Promise<void>;
  snoozeNotification(
    id: string,
    delaySeconds: number,
  ): Promise<unknown>;
  dismissNotification(id: string, detail?: string): Promise<unknown>;
}

export interface BackendNotificationSecondaryActionResult {
  action: 'snoozed' | 'dismissed' | 'channel_hidden';
  notificationId?: string;
  delaySeconds?: number;
  deliveryStatus: BackendNotificationDeliveryStatus;
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

function normalizeReportFilename(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const filename = trimmed.startsWith('reports/')
    ? trimmed.slice('reports/'.length)
    : trimmed;
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    !filename.endsWith('.md')
  ) {
    return undefined;
  }
  return filename;
}

function normalizeDreamFilename(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const filename = trimmed.startsWith('dreams/')
    ? trimmed.slice('dreams/'.length)
    : trimmed;
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    !filename.endsWith('.md')
  ) {
    return undefined;
  }
  return filename;
}

function getWeeklyReportTargetHash(
  payload: Record<string, unknown> | undefined,
): string {
  const reportFilename = normalizeReportFilename(
    getStringPayloadValue(payload, 'reportPath'),
  );
  return reportFilename
    ? `/reports?file=${encodeURIComponent(reportFilename)}`
    : '/reports';
}

function getFirstPayloadArrayString(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = payload?.[key];
  if (!Array.isArray(value)) return undefined;
  const first = value.find(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return first?.trim();
}

function getDreamDigestTargetHash(
  payload: Record<string, unknown> | undefined,
): string {
  const dreamFilename = normalizeDreamFilename(
    getStringPayloadValue(payload, 'latestDreamPath') ||
      getStringPayloadValue(payload, 'latestDreamFile') ||
      getStringPayloadValue(payload, 'dreamPath') ||
      getStringPayloadValue(payload, 'dreamFile') ||
      getFirstPayloadArrayString(payload, 'dreamPaths') ||
      getFirstPayloadArrayString(payload, 'dreamFiles'),
  );
  return dreamFilename
    ? `/dreams?file=${encodeURIComponent(dreamFilename)}`
    : '/dreams';
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
  if (type === 'weekly_report') {
    return getWeeklyReportTargetHash(payload);
  }
  if (type === 'dream_digest') {
    return getDreamDigestTargetHash(payload);
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

function readPositivePayloadNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function formatSnoozeDelay(delaySeconds: number): string {
  const rounded = Math.max(1, Math.floor(delaySeconds));
  const days = Math.floor(rounded / 86_400);
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor(rounded / 60);

  if (days >= 1 && rounded % 86_400 === 0) {
    return `${days}天`;
  }
  if (hours >= 1 && rounded % 3_600 === 0) {
    return `${hours}小时`;
  }
  if (minutes >= 1) {
    return `${minutes}分钟`;
  }
  return `${rounded}秒`;
}

function getSnoozeReminderContextLabel(
  payload?: Record<string, unknown>,
): string | undefined {
  const snooze = payload?.snooze;
  if (!snooze || typeof snooze !== 'object') return undefined;

  const snoozeRecord = snooze as Record<string, unknown>;
  const count = readPositivePayloadNumber(snoozeRecord, 'count');
  const scheduledAt = readPositivePayloadNumber(snoozeRecord, 'scheduledAt');
  const delaySeconds = readPositivePayloadNumber(snoozeRecord, 'delaySeconds');
  const parts = [
    count && count > 1 ? `第${Math.floor(count)}次稍后提醒` : '稍后提醒',
  ];
  if (scheduledAt) {
    parts.push(`原定 ${formatDueAt(scheduledAt)}`);
  }
  if (delaySeconds) {
    parts.push(`延后${formatSnoozeDelay(delaySeconds)}`);
  }
  return parts.join(' · ');
}

function getSnoozeReceiptContextLabel(
  receipt?: BackendNotificationSnoozeReceipt,
): string | undefined {
  if (!receipt) return undefined;
  const parts = [receipt.label || '稍后提醒'];
  if (
    typeof receipt.scheduledAt === 'number' &&
    Number.isFinite(receipt.scheduledAt) &&
    receipt.scheduledAt > 0
  ) {
    parts.push(`原定 ${formatDueAt(receipt.scheduledAt)}`);
  }
  if (
    typeof receipt.delaySeconds === 'number' &&
    Number.isFinite(receipt.delaySeconds) &&
    receipt.delaySeconds > 0
  ) {
    parts.push(`延后${formatSnoozeDelay(receipt.delaySeconds)}`);
  }
  return parts.join(' · ');
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

function formatBackendChannelLabel(
  channel: BackendNotificationChannelReceipt['channel'],
): string {
  switch (channel) {
    case 'chrome':
      return 'Chrome';
    case 'doubao':
      return '豆包';
    case 'glip':
      return 'Glip';
    default:
      return channel;
  }
}

function formatChannelReceiptSummary(
  receipts: BackendNotificationChannelReceipt[] | undefined,
  currentChannel?: BackendNotificationDeliveryContext['channel'],
): string {
  const meaningfulReceipts = (receipts || []).filter(
    (receipt) =>
      receipt.channel !== currentChannel && receipt.state !== 'not_attempted',
  );
  if (meaningfulReceipts.length === 0) return '';
  return meaningfulReceipts
    .map(formatChannelReceiptSummaryItem)
    .join('，');
}

function compactReceiptError(raw: string | undefined): string {
  const compacted = (raw || '').replace(/\s+/g, ' ').trim();
  if (!compacted) return '';
  if (compacted.length <= 48) return compacted;
  return `${compacted.slice(0, 47).trim()}…`;
}

function formatEffectiveStatusBoundary(
  status: BackendNotificationDeliveryStatus | undefined,
): string {
  switch (status) {
    case 'clicked':
      return '已查看不回滚';
    case 'dismissed':
      return '已忽略不回滚';
    case 'delivered':
      return '曾已送达';
    case 'failed':
      return '未送达';
    default:
      return '未送达';
  }
}

function formatChannelReceiptSummaryItem(
  receipt: BackendNotificationChannelReceipt,
): string {
  const base = `${formatBackendChannelLabel(receipt.channel)}${receipt.label}`;
  if (receipt.status !== 'failed' && receipt.state !== 'failed') {
    return base;
  }

  const error = compactReceiptError(receipt.lastError);
  const boundary =
    receipt.hasSuccessfulDelivery && receipt.effectiveStatus !== 'failed'
      ? formatEffectiveStatusBoundary(receipt.effectiveStatus)
      : '未送达';
  return `${base}（${[error, boundary].filter(Boolean).join('，')}）`;
}

function formatDeliveryFailureContext(
  deliveryContext: BackendNotificationDeliveryContext,
): string {
  const error = compactReceiptError(deliveryContext.lastError);
  const boundary =
    deliveryContext.hasSuccessfulDelivery === undefined
      ? ''
      : deliveryContext.hasSuccessfulDelivery &&
          deliveryContext.effectiveStatus !== 'failed'
        ? formatEffectiveStatusBoundary(deliveryContext.effectiveStatus)
        : '未送达';
  const detail = [error, boundary].filter(Boolean).join('，');
  return detail ? `上次发送失败（${detail}）` : '上次发送失败';
}

export function buildBackendNotificationMessage(input: {
  body?: string;
  type?: string;
  payload?: Record<string, unknown>;
  maxLength?: number;
}): string {
  const maxLength = Math.max(40, input.maxLength ?? 200);
  let payloadPreview = '';
  if (input.type === 'dream_digest') {
    payloadPreview = firstPayloadPreview(
      input.payload,
      ['dreamDigestScopeReceipt', 'digestBody', 'summary', 'details', 'body'],
      maxLength,
    );
  } else if (input.type === 'weekly_report') {
    payloadPreview = firstPayloadPreview(
      input.payload,
      ['reportSummary', 'reportExcerpt', 'summary', 'details', 'body'],
      maxLength,
    );
  } else {
    payloadPreview = firstPayloadPreview(
      input.payload,
      ['summary', 'details', 'message'],
      maxLength,
    );
  }
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
  channelReceipts?: BackendNotificationChannelReceipt[],
  evidenceReceipt?: BackendNotificationEvidenceReceipt,
  snoozeReceipt?: BackendNotificationSnoozeReceipt,
  sourceType?: BackendNotificationSourceType,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const laneLabel = lane === 'todo' ? '待处理' : '通知';
  const priorityLabel = priority === 'high' ? '高优先级' : '普通';
  const parts = [`${laneLabel}`, `${priorityLabel}`];
  if (lane === 'todo' && typeof dueAt === 'number' && dueAt > 0) {
    parts.push(`截止 ${formatDueAt(dueAt)}`);
  }
  if (
    evidenceReceipt &&
    Number.isFinite(evidenceReceipt.evidenceCount) &&
    evidenceReceipt.evidenceCount > 0
  ) {
    parts.push(`依据 ${Math.floor(evidenceReceipt.evidenceCount)} 条记忆`);
  }
  const snoozeLabel =
    getSnoozeReceiptContextLabel(snoozeReceipt) ||
    getSnoozeReminderContextLabel(payload);
  if (snoozeLabel) {
    parts.push(snoozeLabel);
  }
  if (deliveryContext?.reason === 'retry_after_cooldown') {
    parts.push('再次提醒');
  } else if (deliveryContext?.reason === 'previous_delivery_failed') {
    parts.push(formatDeliveryFailureContext(deliveryContext));
  } else if (deliveryContext?.reason === 'already_delivered_unfinished') {
    parts.push('仍待处理');
  }
  const channelReceiptSummary = formatChannelReceiptSummary(
    channelReceipts,
    deliveryContext?.channel,
  );
  if (channelReceiptSummary) {
    parts.push(`其他渠道 ${channelReceiptSummary}`);
  }
  const snoozeActionHint = buildBackendNotificationSnoozeActionHint(
    { lane, dueAt, sourceType },
    nowSeconds,
  );
  if (snoozeActionHint) {
    parts.push(snoozeActionHint);
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

export function buildBackendNotificationSnoozeActionHint(
  meta: Pick<BackendNotificationMeta, 'lane' | 'dueAt'> & {
    sourceType?: BackendNotificationSourceType;
  },
  nowSeconds = Math.floor(Date.now() / 1000),
): string | undefined {
  if (meta.sourceType !== 'notification' || meta.lane !== 'todo') {
    return undefined;
  }

  const delaySeconds = getBackendNotificationSnoozeSeconds(meta, nowSeconds);
  const scheduledAt = nowSeconds + delaySeconds;
  return `稍后按钮：${formatDueAt(scheduledAt)} 再提醒（延后${formatSnoozeDelay(
    delaySeconds,
  )}）；不确认、不发送、不执行，也不修改原始证据。`;
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

export async function performBackendNotificationSecondaryAction(
  meta: BackendNotificationMeta,
  externalRef: string,
  handlers: BackendNotificationSecondaryActionHandlers,
): Promise<BackendNotificationSecondaryActionResult> {
  const deliveryStatus = getBackendNotificationSecondaryActionDeliveryStatus(
    meta,
  );
  const deliveryEvent: BackendNotificationDeliveryEvent = {
    sourceRef: meta.sourceRef,
    lane: meta.lane,
    status: deliveryStatus,
    externalRef,
  };

  if (meta.sourceRef.startsWith('notification:')) {
    const notificationId =
      meta.notificationId || meta.sourceRef.slice('notification:'.length);

    if (meta.sourceType === 'notification' && meta.lane === 'todo') {
      const delaySeconds = getBackendNotificationSnoozeSeconds(meta);
      await handlers.snoozeNotification(notificationId, delaySeconds);
      await handlers.reportDelivery([deliveryEvent]);
      return {
        action: 'snoozed',
        notificationId,
        delaySeconds,
        deliveryStatus,
      };
    }

    await handlers.dismissNotification(
      notificationId,
      'chrome_notification_dismiss_button',
    );
    await handlers.reportDelivery([deliveryEvent]);
    return {
      action: 'dismissed',
      notificationId,
      deliveryStatus,
    };
  }

  await handlers.reportDelivery([deliveryEvent]);
  return {
    action: 'channel_hidden',
    deliveryStatus,
  };
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
