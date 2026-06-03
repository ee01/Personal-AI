import type Database from 'better-sqlite3';

import {
  ChannelDeliveryRepository,
  type DeliveryChannel,
  type DeliveryLane,
  type DeliveryStatus,
} from '../repositories/ChannelDeliveryRepository.js';
import { getBotSender, type BotSendResult } from '../utils/botSender.js';
import { formatDateTime, now } from '../utils/time.js';

export type NotificationPriority = 'high' | 'normal';
export type NotificationFeedDeliveryMode =
  | 'retry_after_cooldown'
  | 'incremental'
  | 'daily_digest';

export const TODO_DELIVERY_RETRY_COOLDOWN_SECONDS = 6 * 60 * 60;

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
    return firstPayloadString(item.payload, [
      'digestBody',
      'summary',
      'details',
      'body',
    ]);
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

  constructor(private readonly db: Database.Database) {
    this.channelDeliveryRepository = new ChannelDeliveryRepository(db);
  }

  listFeed(input: {
    channel: DeliveryChannel;
    lanes: DeliveryLane[];
    limit?: number;
    deliveryMode?: NotificationFeedDeliveryMode;
  }): NotificationEnvelope[] {
    const lanes = Array.from(new Set(input.lanes)).filter(
      (lane): lane is DeliveryLane => lane === 'todo' || lane === 'notice',
    );
    if (lanes.length === 0) return [];

    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const currentTime = now();
    const deliveryMode = input.deliveryMode ?? 'retry_after_cooldown';
    const includeDeliveredTodos = deliveryMode === 'daily_digest';
    const deliveredAfter = currentTime - TODO_DELIVERY_RETRY_COOLDOWN_SECONDS;
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
      c.status IN ('clicked', 'dismissed')
      OR c.seen_at IS NOT NULL
      OR c.dismissed_at IS NOT NULL
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
              ${notificationLaneSql} = 'todo'
              OR NOT EXISTS (
                SELECT 1
                  FROM channel_delivery_records c
                 WHERE c.source_ref = ('notification:' || n.id)
                   AND c.channel = ?
                   AND c.lane = ${notificationLaneSql}
                   AND ${successfulDeliverySql}
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
    const notificationDeliveryFilterParams = [
      input.channel,
      ...successfulDeliveryParams,
    ];

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
        limit,
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
      };
    });

    const actionDeliveryFilterSql = includeDeliveredTodos
      ? ''
      : `AND NOT EXISTS (
                  SELECT 1
                    FROM channel_delivery_records c
                   WHERE c.source_ref = ('proposed_action:' || a.id)
                     AND c.channel = ?
                     AND c.lane = 'todo'
                     AND ${successfulDeliverySql}
                )`;
    const actionDeliveryFilterParams = includeDeliveredTodos
      ? []
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
              limit,
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
          };
        })
      : [];

    return [...notifications, ...actionEnvelopes]
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority === 'high' ? -1 : 1;
        }
        const leftTs = left.sentAt ?? left.createdAt;
        const rightTs = right.sentAt ?? right.createdAt;
        return rightTs - leftTs;
      })
      .slice(0, limit);
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
    if (record.status === 'failed' && !record.hasSuccessfulDelivery) {
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
    } else if (record.status === 'failed') {
      reason = 'previous_delivery_failed';
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
    const botSender = getBotSender();
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
  } {
    const deliveryMode = options.deliveryMode ?? 'retry_after_cooldown';
    const items = this.listFeed({
      channel: provider === 'doubao' ? 'doubao' : 'chrome',
      lanes: ['todo'],
      limit: options.limit ?? (deliveryMode === 'daily_digest' ? 50 : 8),
      deliveryMode,
    });

    const lines = items.map((item) => {
      const due =
        item.dueAt || item.sentAt
          ? ` @ ${formatDateTime(item.dueAt ?? item.sentAt ?? item.createdAt)}`
          : '';
      const body = item.body ? ` - ${item.body}` : '';
      return `${item.title}${due}${body}${formatDeliveryContextHint(
        item.deliveryContext,
      )}`;
    });

    const bodyMd = [
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
      lines.length > 0
        ? lines.map((line) => `- ${line}`).join('\n')
        : '- 暂无待处理事项。',
    ].join('\n');

    return {
      bodyMd:
        bodyMd.length <= Math.max(400, tokenBudget * 4)
          ? bodyMd
          : bodyMd.slice(0, Math.max(0, tokenBudget * 4 - 32)).trim(),
      sourceRefs: items.map((item) => item.sourceRef),
      dedupeSuffix: items.map((item) => item.sourceRef).join('|'),
      itemCount: items.length,
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
  } {
    const items = this.listFeed({
      channel: provider === 'doubao' ? 'doubao' : 'chrome',
      lanes: ['notice'],
      limit: 8,
    });

    const lines = items.map(formatNoticeDigestItem);

    const bodyMd = [
      '# 通知摘要',
      '> 信息类更新：用于同步近况，不要把它们转成待办。',
      '',
      '## 更新',
      lines.length > 0
        ? lines.join('\n')
        : '- 暂无新通知。',
    ].join('\n');

    return {
      bodyMd:
        bodyMd.length <= Math.max(400, tokenBudget * 4)
          ? bodyMd
          : bodyMd.slice(0, Math.max(0, tokenBudget * 4 - 32)).trim(),
      sourceRefs: items.map((item) => item.sourceRef),
      dedupeSuffix: items.map((item) => item.sourceRef).join('|'),
      itemCount: items.length,
    };
  }
}
