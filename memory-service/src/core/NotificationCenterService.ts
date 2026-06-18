import type Database from 'better-sqlite3';

import {
  ChannelDeliveryRepository,
  type ChannelDeliveryRecord,
  type DeliveryChannel,
  type DeliveryLane,
  type DeliveryStatus,
} from '../repositories/ChannelDeliveryRepository.js';
import {
  BotSender,
  getBotSender,
  type BotConfig,
  type BotSendResult,
} from '../utils/botSender.js';
import { formatDateTime, now } from '../utils/time.js';

export type NotificationPriority = 'high' | 'normal';
export type NotificationFeedDeliveryMode =
  | 'retry_after_cooldown'
  | 'incremental'
  | 'daily_digest';

export const TODO_DELIVERY_RETRY_COOLDOWN_SECONDS = 6 * 60 * 60;
const DELIVERY_CHANNELS: DeliveryChannel[] = ['chrome', 'doubao', 'glip'];

export interface NotificationEnvelope {
  sourceRef: string;
  sourceType: 'notification' | 'proposed_action';
  sourceId: string;
  lane: DeliveryLane;
  priority: NotificationPriority;
  title: string;
  body?: string;
  dueAt?: number;
  createdAt: number;
  sentAt?: number;
  type?: string;
  payload?: Record<string, unknown>;
  deliveryContext?: NotificationDeliveryContext;
  channelReceipts?: NotificationChannelReceipt[];
}

export interface NotificationChannelReceipt {
  channel: DeliveryChannel;
  state: 'not_attempted' | 'delivered' | 'failed' | 'clicked' | 'dismissed';
  label: string;
  detail: string;
  status?: DeliveryStatus;
  effectiveStatus?: DeliveryStatus;
  hasSuccessfulDelivery: boolean;
  firstDeliveredAt?: number;
  lastDeliveredAt?: number;
  seenAt?: number;
  dismissedAt?: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface NotificationDeliveryContext {
  channel: DeliveryChannel;
  reason:
    | 'new'
    | 'retry_after_cooldown'
    | 'previous_delivery_failed'
    | 'already_delivered_unfinished';
  lastStatus?: DeliveryStatus;
  effectiveStatus?: DeliveryStatus;
  hasSuccessfulDelivery: boolean;
  lastAttemptAt?: number;
  lastDeliveredAt?: number;
  cooldownSeconds?: number;
}

export interface NotificationFeedResult {
  items: NotificationEnvelope[];
  meta: {
    channel: DeliveryChannel;
    lanes: DeliveryLane[];
    deliveryMode: NotificationFeedDeliveryMode;
    limit: number;
    returned: number;
    hasMore: boolean;
  };
}

interface ProposedActionRow {
  id: string;
  type: string;
  action_type: string | null;
  title: string;
  description: string | null;
  state: string;
  expires_at: number | null;
  created_at: number;
  params_json: string | null;
}

interface NotificationFeedRow {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  payload_json: string | null;
  sent_at: number | null;
  created_at: number;
}

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function compactPayloadDetail(
  raw: unknown,
  maxLength = 900,
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const compacted = raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!compacted) return undefined;
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function firstPayloadString(
  payload: Record<string, unknown> | undefined,
  keys: string[],
  maxLength?: number,
): string | undefined {
  if (!payload) return undefined;
  for (const key of keys) {
    const detail = compactPayloadDetail(payload[key], maxLength);
    if (detail) return detail;
  }
  return undefined;
}

function noticePayloadDetail(item: NotificationEnvelope): string | undefined {
  if (item.type === 'dream_digest') {
    const scopeReceipt = firstPayloadString(
      item.payload,
      ['dreamDigestScopeReceipt'],
      700,
    );
    const detail = firstPayloadString(item.payload, [
      'digestBody',
      'summary',
      'details',
      'body',
    ]);
    return [scopeReceipt, detail].filter(Boolean).join('\n\n') || undefined;
  }

  if (item.type === 'weekly_report') {
    const reportDetail = firstPayloadString(item.payload, [
      'reportExcerpt',
      'reportSummary',
      'summary',
      'details',
    ]);
    if (reportDetail) return reportDetail;

    const reportPath = firstPayloadString(item.payload, ['reportPath'], 200);
    return reportPath ? `Report file: ${reportPath}` : undefined;
  }

  return firstPayloadString(item.payload, [
    'summary',
    'details',
    'digestBody',
    'message',
  ]);
}

function indentMarkdownBlock(raw: string): string {
  return raw
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function formatNoticeDigestItem(item: NotificationEnvelope): string {
  const when = item.sentAt ? ` @ ${formatDateTime(item.sentAt)}` : '';
  const body = item.body ? ` - ${item.body}` : '';
  const retryHint = formatDeliveryContextHint(item.deliveryContext);
  const detail = noticePayloadDetail(item);
  if (!detail) return `- ${item.title}${when}${body}${retryHint}`;
  return `- ${item.title}${when}${body}${retryHint}\n${indentMarkdownBlock(detail)}`;
}

function formatDeliveryContextHint(
  deliveryContext: NotificationDeliveryContext | undefined,
): string {
  if (!deliveryContext) return '';
  if (deliveryContext.reason === 'retry_after_cooldown') {
    return ' [再次提醒：冷却后仍未处理]';
  }
  if (deliveryContext.reason === 'previous_delivery_failed') {
    return ' [重试：上次发送失败]';
  }
  if (deliveryContext.reason === 'already_delivered_unfinished') {
    return ' [已提醒过，仍待处理]';
  }
  return '';
}

function formatChannelLabel(channel: DeliveryChannel): string {
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

function buildChannelReceiptBaseLabel(record: ChannelDeliveryRecord): string {
  switch (record.effectiveStatus) {
    case 'clicked':
      return '已查看';
    case 'dismissed':
      return '已忽略';
    case 'delivered':
      return '已送达';
    case 'failed':
      return '发送失败';
    default:
      return record.effectiveStatus;
  }
}

function buildChannelReceiptLabel(record: ChannelDeliveryRecord): string {
  const baseLabel = buildChannelReceiptBaseLabel(record);
  if (record.status === 'failed' && record.hasSuccessfulDelivery) {
    return `${baseLabel}，最近失败`;
  }
  return baseLabel;
}

function buildChannelReceiptEffectiveDetail(
  record: ChannelDeliveryRecord,
): string {
  switch (record.effectiveStatus) {
    case 'clicked':
      return '用户已从该渠道进入处理入口';
    case 'dismissed':
      return '用户已在该渠道忽略或关闭提醒';
    case 'delivered':
      return '渠道已报告送达；这不等于用户已处理';
    case 'failed':
      return record.lastError
        ? `最近一次渠道发送失败：${record.lastError}`
        : '最近一次渠道发送失败';
    default:
      return '该渠道已有回执记录';
  }
}

function buildChannelReceiptDetail(record: ChannelDeliveryRecord): string {
  if (record.status === 'failed' && record.hasSuccessfulDelivery) {
    const failureDetail = record.lastError
      ? `最近一次回执失败：${record.lastError}`
      : '最近一次回执失败';
    return `${buildChannelReceiptEffectiveDetail(record)}；${failureDetail}`;
  }
  return buildChannelReceiptEffectiveDetail(record);
}

function compactReceiptError(raw: string | undefined): string {
  const compacted = (raw || '').replace(/\s+/g, ' ').trim();
  if (!compacted) return '';
  if (compacted.length <= 90) return compacted;
  return `${compacted.slice(0, 89).trim()}…`;
}

function formatEffectiveReceiptStateLabel(
  status: DeliveryStatus | undefined,
): string {
  switch (status) {
    case 'clicked':
      return '已查看';
    case 'dismissed':
      return '已忽略';
    case 'delivered':
      return '已送达';
    case 'failed':
      return '发送失败';
    default:
      return '已有回执';
  }
}

function buildChannelReceipt(
  channel: DeliveryChannel,
  record: ChannelDeliveryRecord | undefined,
): NotificationChannelReceipt {
  if (!record) {
    return {
      channel,
      state: 'not_attempted',
      label: '未尝试',
      detail: '该渠道尚未写入投递回执',
      hasSuccessfulDelivery: false,
    };
  }

  const state =
    record.status === 'failed' && !record.hasSuccessfulDelivery
      ? 'failed'
      : record.effectiveStatus;
  return {
    channel,
    state,
    label: buildChannelReceiptLabel(record),
    detail: buildChannelReceiptDetail(record),
    status: record.status,
    effectiveStatus: record.effectiveStatus,
    hasSuccessfulDelivery: record.hasSuccessfulDelivery,
    firstDeliveredAt: record.firstDeliveredAt,
    lastDeliveredAt: record.lastDeliveredAt,
    seenAt: record.seenAt,
    dismissedAt: record.dismissedAt,
    lastAttemptAt: record.updatedAt,
    lastError: record.lastError,
  };
}

function formatChannelReceiptFailureDetail(
  receipt: NotificationChannelReceipt,
): string {
  if (receipt.status !== 'failed') return '';
  const channelLabel = formatChannelLabel(receipt.channel);
  const error = compactReceiptError(receipt.lastError);
  const errorDetail = error ? `${channelLabel}：${error}` : channelLabel;
  if (
    receipt.hasSuccessfulDelivery &&
    receipt.effectiveStatus &&
    receipt.effectiveStatus !== 'failed'
  ) {
    const stateNote =
      receipt.effectiveStatus === 'delivered'
        ? '有效状态仍按已送达，不等于已处理'
        : `有效状态仍按${formatEffectiveReceiptStateLabel(
            receipt.effectiveStatus,
          )}`;
    return `${errorDetail}（${stateNote}）`;
  }
  return errorDetail;
}

function formatChannelReceiptsHint(
  receipts: NotificationChannelReceipt[] | undefined,
  currentChannel: DeliveryChannel | undefined,
): string {
  const meaningfulReceipts = (receipts || []).filter(
    (receipt) =>
      receipt.channel !== currentChannel && receipt.state !== 'not_attempted',
  );
  if (meaningfulReceipts.length === 0) return '';
  const summary = meaningfulReceipts
    .map(
      (receipt) =>
        `${formatChannelLabel(receipt.channel)}${receipt.label}`,
    )
    .join('，');
  const failureDetails = meaningfulReceipts
    .map(formatChannelReceiptFailureDetail)
    .filter(Boolean);
  if (failureDetails.length === 0) {
    return ` [其他渠道：${summary}]`;
  }
  return ` [其他渠道：${summary}；失败原因：${failureDetails.join('；')}]`;
}

function maxDigestMarkdownLength(tokenBudget: number): number {
  return Math.max(400, tokenBudget * 4);
}

function buildDigestTruncationReceipt(omittedCount: number): string {
  return `> 已截断：还有 ${omittedCount} 条未放入本次摘要；未显示条目不会写入本次渠道送达回执。`;
}

function renderBoundedDigestMarkdown(input: {
  headerLines: string[];
  itemBlocks: Array<{ sourceRef: string; bodyMd: string }>;
  emptyLine: string;
  tokenBudget: number;
}): {
  bodyMd: string;
  sourceRefs: string[];
  itemCount: number;
  omittedItemCount: number;
} {
  if (input.itemBlocks.length === 0) {
    return {
      bodyMd: [...input.headerLines, input.emptyLine].join('\n'),
      sourceRefs: [],
      itemCount: 0,
      omittedItemCount: 0,
    };
  }

  const maxLength = maxDigestMarkdownLength(input.tokenBudget);

  const compose = (visibleCount: number): string => {
    const omittedCount = input.itemBlocks.length - visibleCount;
    const bodyLines = [
      ...input.headerLines,
      visibleCount > 0
        ? input.itemBlocks
            .slice(0, visibleCount)
            .map((item) => item.bodyMd)
            .join('\n')
        : '- 本次摘要预算不足，未放入完整条目。',
    ];
    if (omittedCount > 0) {
      bodyLines.push('', buildDigestTruncationReceipt(omittedCount));
    }
    return bodyLines.join('\n');
  };

  for (
    let visibleCount = input.itemBlocks.length;
    visibleCount >= 0;
    visibleCount -= 1
  ) {
    const bodyMd = compose(visibleCount);
    if (bodyMd.length <= maxLength) {
      const visibleItems = input.itemBlocks.slice(0, visibleCount);
      return {
        bodyMd,
        sourceRefs: visibleItems.map((item) => item.sourceRef),
        itemCount: visibleItems.length,
        omittedItemCount: input.itemBlocks.length - visibleItems.length,
      };
    }
  }

  return {
    bodyMd: [
      ...input.headerLines,
      '- 本次摘要预算不足，未放入完整条目。',
      '',
      buildDigestTruncationReceipt(input.itemBlocks.length),
    ].join('\n'),
    sourceRefs: [],
    itemCount: 0,
    omittedItemCount: input.itemBlocks.length,
  };
}

function deliveryContextSortWeight(
  deliveryContext: NotificationDeliveryContext | undefined,
): number {
  switch (deliveryContext?.reason) {
    case 'previous_delivery_failed':
      return 0;
    case 'new':
      return 1;
    case 'retry_after_cooldown':
      return 2;
    case 'already_delivered_unfinished':
      return 3;
    default:
      return 1;
  }
}

export function classifyNotificationRouting(params: {
  sourceType: 'notification' | 'proposed_action';
  type?: string | null;
}): { lane: DeliveryLane; priority: NotificationPriority } {
  if (params.sourceType === 'proposed_action') {
    return { lane: 'todo', priority: 'high' };
  }

  switch (params.type || '') {
    case 'truth_conflict':
    case 'new_conflict':
    case 'deadline':
    case 'notify_user':
      return { lane: 'todo', priority: 'high' };
    case 'weekly_report':
    case 'dream_digest':
      return { lane: 'notice', priority: 'high' };
    case 'project_update':
    case 'property_change':
      return { lane: 'notice', priority: 'normal' };
    default:
      return { lane: 'notice', priority: 'normal' };
  }
}

export function shouldRouteToGlip(
  envelope: Pick<NotificationEnvelope, 'lane' | 'priority'>,
): boolean {
  return envelope.lane === 'notice' && envelope.priority === 'high';
}

export class NotificationCenterService {
  private readonly channelDeliveryRepository: ChannelDeliveryRepository;

  constructor(
    private readonly db: Database.Database,
    private readonly botConfigProvider?: () => BotConfig,
  ) {
    this.channelDeliveryRepository = new ChannelDeliveryRepository(db);
  }

  listFeed(input: {
    channel: DeliveryChannel;
    lanes: DeliveryLane[];
    limit?: number;
    deliveryMode?: NotificationFeedDeliveryMode;
  }): NotificationEnvelope[] {
    return this.listFeedResult(input).items;
  }

  listFeedResult(input: {
    channel: DeliveryChannel;
    lanes: DeliveryLane[];
    limit?: number;
    deliveryMode?: NotificationFeedDeliveryMode;
  }): NotificationFeedResult {
    const lanes = Array.from(new Set(input.lanes)).filter(
      (lane): lane is DeliveryLane => lane === 'todo' || lane === 'notice',
    );

    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const deliveryMode = input.deliveryMode ?? 'retry_after_cooldown';
    if (lanes.length === 0) {
      return {
        items: [],
        meta: {
          channel: input.channel,
          lanes,
          deliveryMode,
          limit,
          returned: 0,
          hasMore: false,
        },
      };
    }

    const queryLimit = limit + 1;
    const currentTime = now();
    const includeDeliveredTodos = deliveryMode === 'daily_digest';
    const deliveredAfter = currentTime - TODO_DELIVERY_RETRY_COOLDOWN_SECONDS;
    const terminalDeliverySql = `(
      c.status IN ('clicked', 'dismissed')
      OR c.seen_at IS NOT NULL
      OR c.dismissed_at IS NOT NULL
    )`;
    const todoSuccessfulDeliverySql =
      deliveryMode === 'incremental'
        ? `(
            c.status = 'delivered'
            OR c.first_delivered_at IS NOT NULL
            OR c.last_delivered_at IS NOT NULL
          )`
        : 'COALESCE(c.last_delivered_at, c.first_delivered_at) > ?';
    const successfulDeliveryParams =
      deliveryMode === 'incremental' ? [] : [deliveredAfter];
    const successfulDeliverySql = `(
      ${terminalDeliverySql}
      OR (
        c.lane = 'notice'
        AND (
          c.status = 'delivered'
          OR c.first_delivered_at IS NOT NULL
          OR c.last_delivered_at IS NOT NULL
        )
      )
      OR (
        c.lane = 'todo'
        AND ${todoSuccessfulDeliverySql}
      )
    )`;
    const notificationLaneSql = `CASE n.type
      WHEN 'truth_conflict' THEN 'todo'
      WHEN 'new_conflict' THEN 'todo'
      WHEN 'deadline' THEN 'todo'
      WHEN 'notify_user' THEN 'todo'
      ELSE 'notice'
    END`;
    const notificationPrioritySql = `CASE n.type
      WHEN 'truth_conflict' THEN 0
      WHEN 'new_conflict' THEN 0
      WHEN 'deadline' THEN 0
      WHEN 'notify_user' THEN 0
      WHEN 'weekly_report' THEN 0
      WHEN 'dream_digest' THEN 0
      ELSE 1
    END`;
    const lanePlaceholders = lanes.map(() => '?').join(', ');

    const notificationDeliveryFilterSql = includeDeliveredTodos
      ? `AND (
              (
                ${notificationLaneSql} = 'todo'
                AND NOT EXISTS (
                  SELECT 1
                    FROM channel_delivery_records c
                   WHERE c.source_ref = ('notification:' || n.id)
                     AND c.channel = ?
                     AND c.lane = ${notificationLaneSql}
                     AND ${terminalDeliverySql}
                )
              )
              OR (
                ${notificationLaneSql} <> 'todo'
                AND NOT EXISTS (
                  SELECT 1
                    FROM channel_delivery_records c
                   WHERE c.source_ref = ('notification:' || n.id)
                     AND c.channel = ?
                     AND c.lane = ${notificationLaneSql}
                     AND ${successfulDeliverySql}
                )
              )
            )`
      : `AND NOT EXISTS (
                SELECT 1
                  FROM channel_delivery_records c
                 WHERE c.source_ref = ('notification:' || n.id)
                   AND c.channel = ?
                   AND c.lane = ${notificationLaneSql}
                   AND ${successfulDeliverySql}
            )`;
    const notificationDeliveryFilterParams = includeDeliveredTodos
      ? [input.channel, input.channel, ...successfulDeliveryParams]
      : [input.channel, ...successfulDeliveryParams];

    const notificationRows = this.db
      .prepare(
        `SELECT n.id, n.type, n.title, n.body, n.payload_json, n.sent_at, n.created_at
           FROM notification_records n
          WHERE n.clicked_at IS NULL
            AND n.dismissed_at IS NULL
            AND (n.sent_at IS NULL OR n.sent_at <= ?)
            AND ${notificationLaneSql} IN (${lanePlaceholders})
            ${notificationDeliveryFilterSql}
          ORDER BY ${notificationPrioritySql} ASC, COALESCE(n.sent_at, n.created_at) DESC
          LIMIT ?`,
      )
      .all(
        currentTime,
        ...lanes,
        ...notificationDeliveryFilterParams,
        queryLimit,
      ) as NotificationFeedRow[];

    const notifications = notificationRows.map<NotificationEnvelope>((row) => {
      const routing = classifyNotificationRouting({
        sourceType: 'notification',
        type: row.type,
      });
      const sourceRef = `notification:${row.id}`;
      return {
        sourceRef,
        sourceType: 'notification',
        sourceId: row.id,
        lane: routing.lane,
        priority: routing.priority,
        title: row.title,
        body: row.body ?? undefined,
        createdAt: row.created_at,
        sentAt: row.sent_at ?? undefined,
        type: row.type ?? undefined,
        payload: safeJsonParse<Record<string, unknown>>(row.payload_json),
        deliveryContext: this.buildDeliveryContext({
          sourceRef,
          channel: input.channel,
          lane: routing.lane,
          deliveredAfter,
          includeDeliveredTodos,
        }),
        channelReceipts: this.buildChannelReceipts(sourceRef, routing.lane),
      };
    });

    const actionDeliveryFilterSql = includeDeliveredTodos
      ? `AND NOT EXISTS (
                  SELECT 1
                    FROM channel_delivery_records c
                   WHERE c.source_ref = ('proposed_action:' || a.id)
                     AND c.channel = ?
                     AND c.lane = 'todo'
                     AND ${terminalDeliverySql}
                )`
      : `AND NOT EXISTS (
                  SELECT 1
                    FROM channel_delivery_records c
                   WHERE c.source_ref = ('proposed_action:' || a.id)
                     AND c.channel = ?
                     AND c.lane = 'todo'
                     AND ${successfulDeliverySql}
                )`;
    const actionDeliveryFilterParams = includeDeliveredTodos
      ? [input.channel]
      : [input.channel, ...successfulDeliveryParams];

    const actionEnvelopes = lanes.includes('todo')
      ? (
          this.db
            .prepare(
              `SELECT id, type, action_type, title, description, state, expires_at, created_at, params_json
               FROM proposed_actions a
              WHERE state = 'pending'
                AND queue_status IN ('queued', 'running')
                AND (expires_at IS NULL OR expires_at > ?)
                ${actionDeliveryFilterSql}
              ORDER BY priority DESC, created_at DESC
              LIMIT ?`,
            )
            .all(
              currentTime,
              ...actionDeliveryFilterParams,
              queryLimit,
            ) as ProposedActionRow[]
        ).map<NotificationEnvelope>((action) => {
          const payload = safeJsonParse<Record<string, unknown>>(
            action.params_json,
          );
          const sourceRef = `proposed_action:${action.id}`;
          return {
            sourceRef,
            sourceType: 'proposed_action',
            sourceId: action.id,
            lane: 'todo',
            priority: 'high',
            title: action.title,
            body: action.description ?? undefined,
            dueAt: action.expires_at ?? undefined,
            createdAt: action.created_at,
            type: action.action_type ?? action.type,
            payload,
            deliveryContext: this.buildDeliveryContext({
              sourceRef,
              channel: input.channel,
              lane: 'todo',
              deliveredAfter,
              includeDeliveredTodos,
            }),
            channelReceipts: this.buildChannelReceipts(sourceRef, 'todo'),
          };
        })
      : [];

    const combined = [...notifications, ...actionEnvelopes].sort(
      (left, right) => {
        if (left.priority !== right.priority) {
          return left.priority === 'high' ? -1 : 1;
        }
        const leftContextWeight = deliveryContextSortWeight(
          left.deliveryContext,
        );
        const rightContextWeight = deliveryContextSortWeight(
          right.deliveryContext,
        );
        if (leftContextWeight !== rightContextWeight) {
          return leftContextWeight - rightContextWeight;
        }
        const leftTs = left.sentAt ?? left.createdAt;
        const rightTs = right.sentAt ?? right.createdAt;
        return rightTs - leftTs;
      },
    );
    const items = combined.slice(0, limit);
    return {
      items,
      meta: {
        channel: input.channel,
        lanes,
        deliveryMode,
        limit,
        returned: items.length,
        hasMore: combined.length > limit,
      },
    };
  }

  private buildChannelReceipts(
    sourceRef: string,
    lane: DeliveryLane,
  ): NotificationChannelReceipt[] {
    return DELIVERY_CHANNELS.map((channel) =>
      buildChannelReceipt(
        channel,
        this.channelDeliveryRepository.getRecord(sourceRef, channel, lane),
      ),
    );
  }

  private buildDeliveryContext(input: {
    sourceRef: string;
    channel: DeliveryChannel;
    lane: DeliveryLane;
    deliveredAfter: number;
    includeDeliveredTodos?: boolean;
  }): NotificationDeliveryContext {
    const record = this.channelDeliveryRepository.getRecord(
      input.sourceRef,
      input.channel,
      input.lane,
    );
    if (!record) {
      return {
        channel: input.channel,
        reason: 'new',
        hasSuccessfulDelivery: false,
        cooldownSeconds:
          input.lane === 'todo'
            ? TODO_DELIVERY_RETRY_COOLDOWN_SECONDS
            : undefined,
      };
    }

    const lastDeliveredAt = record.lastDeliveredAt ?? record.firstDeliveredAt;
    let reason: NotificationDeliveryContext['reason'] = 'new';
    if (record.status === 'failed') {
      reason = 'previous_delivery_failed';
    } else if (
      input.includeDeliveredTodos &&
      input.lane === 'todo' &&
      record.hasSuccessfulDelivery
    ) {
      reason = 'already_delivered_unfinished';
    } else if (
      input.lane === 'todo' &&
      lastDeliveredAt !== undefined &&
      lastDeliveredAt <= input.deliveredAfter
    ) {
      reason = 'retry_after_cooldown';
    }

    return {
      channel: input.channel,
      reason,
      lastStatus: record.status,
      effectiveStatus: record.effectiveStatus,
      hasSuccessfulDelivery: record.hasSuccessfulDelivery,
      lastAttemptAt: record.updatedAt,
      lastDeliveredAt,
      cooldownSeconds:
        input.lane === 'todo'
          ? TODO_DELIVERY_RETRY_COOLDOWN_SECONDS
          : undefined,
    };
  }

  recordDelivery(
    events: Array<{
      sourceRef: string;
      channel: DeliveryChannel;
      lane: DeliveryLane;
      status: DeliveryStatus;
      externalRef?: string;
      error?: string;
      recordedAt?: number;
    }>,
  ) {
    const recordedAt = now();
    return this.channelDeliveryRepository.upsertEvents(
      events.map((event) => ({
        ...event,
        recordedAt: event.recordedAt ?? recordedAt,
      })),
    );
  }

  async deliverNoticeToGlip(input: {
    sourceRef: string;
    title: string;
    body: string;
    mention?: boolean;
    targetUserId?: string;
    targetGroupId?: string;
  }): Promise<BotSendResult> {
    const botSender = this.botConfigProvider
      ? new BotSender(this.botConfigProvider())
      : getBotSender();
    if (!botSender.isConfigured()) {
      const result: BotSendResult = {
        sent: false,
        error: 'BotSender is not configured',
      };
      this.recordDelivery([
        {
          sourceRef: input.sourceRef,
          channel: 'glip',
          lane: 'notice',
          status: 'failed',
          error: result.error,
        },
      ]);
      return result;
    }

    const result = await botSender.sendMarkdown(input.title, input.body, {
      mention: input.mention,
      targetUserId: input.targetUserId,
      targetGroupId: input.targetGroupId,
    });

    this.recordDelivery([
      {
        sourceRef: input.sourceRef,
        channel: 'glip',
        lane: 'notice',
        status: result.sent ? 'delivered' : 'failed',
        externalRef: result.messageId,
        error: result.error,
      },
    ]);

    return result;
  }

  formatTodoDigest(
    provider: string,
    tokenBudget: number,
    options: {
      deliveryMode?: NotificationFeedDeliveryMode;
      limit?: number;
    } = {},
  ): {
    bodyMd: string;
    sourceRefs: string[];
    dedupeSuffix: string;
    itemCount: number;
    omittedItemCount: number;
  } {
    const deliveryMode = options.deliveryMode ?? 'retry_after_cooldown';
    const items = this.listFeed({
      channel: provider === 'doubao' ? 'doubao' : 'chrome',
      lanes: ['todo'],
      limit: options.limit ?? (deliveryMode === 'daily_digest' ? 50 : 8),
      deliveryMode,
    });

    const itemBlocks = items.map((item) => {
      const due =
        item.dueAt || item.sentAt
          ? ` @ ${formatDateTime(item.dueAt ?? item.sentAt ?? item.createdAt)}`
          : '';
      const body = item.body ? ` - ${item.body}` : '';
      return {
        sourceRef: item.sourceRef,
        bodyMd: `- ${item.title}${due}${body}${formatDeliveryContextHint(
          item.deliveryContext,
        )}${formatChannelReceiptsHint(
          item.channelReceipts,
          item.deliveryContext?.channel,
        )}`,
      };
    });

    const rendered = renderBoundedDigestMarkdown({
      headerLines: [
        deliveryMode === 'daily_digest' ? '# 每日待办摘要' : '# 待办摘要',
        deliveryMode === 'daily_digest'
          ? '> 每日低打扰汇总：列出仍未完成的待办。'
          : deliveryMode === 'incremental'
            ? '> 新待办同步：只列出还没有成功提醒过的事项。'
            : '> 滚动待办同步：列出当前需要处理或重新提醒的事项。',
        '',
        deliveryMode === 'daily_digest'
          ? '## 未完成待办'
          : deliveryMode === 'incremental'
            ? '## 新待办'
            : '## 待处理事项',
      ],
      itemBlocks,
      emptyLine: '- 暂无待处理事项。',
      tokenBudget,
    });

    return {
      bodyMd: rendered.bodyMd,
      sourceRefs: rendered.sourceRefs,
      dedupeSuffix: rendered.sourceRefs.join('|'),
      itemCount: rendered.itemCount,
      omittedItemCount: rendered.omittedItemCount,
    };
  }

  formatNoticeDigest(
    provider: string,
    tokenBudget: number,
  ): {
    bodyMd: string;
    sourceRefs: string[];
    dedupeSuffix: string;
    itemCount: number;
    omittedItemCount: number;
  } {
    const items = this.listFeed({
      channel: provider === 'doubao' ? 'doubao' : 'chrome',
      lanes: ['notice'],
      limit: 8,
    });

    const itemBlocks = items.map((item) => ({
      sourceRef: item.sourceRef,
      bodyMd: `${formatNoticeDigestItem(item)}${formatChannelReceiptsHint(
        item.channelReceipts,
        item.deliveryContext?.channel,
      )}`,
    }));

    const rendered = renderBoundedDigestMarkdown({
      headerLines: [
        '# 通知摘要',
        '> 信息类更新：用于同步近况，不要把它们转成待办。',
        '',
        '## 更新',
      ],
      itemBlocks,
      emptyLine: '- 暂无新通知。',
      tokenBudget,
    });

    return {
      bodyMd: rendered.bodyMd,
      sourceRefs: rendered.sourceRefs,
      dedupeSuffix: rendered.sourceRefs.join('|'),
      itemCount: rendered.itemCount,
      omittedItemCount: rendered.omittedItemCount,
    };
  }
}
