import type Database from 'better-sqlite3';

import { ChannelDeliveryRepository, type DeliveryChannel, type DeliveryLane, type DeliveryStatus } from '../repositories/ChannelDeliveryRepository.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { getBotSender, type BotSendResult } from '../utils/botSender.js';
import { formatDateTime, now } from '../utils/time.js';

export type NotificationPriority = 'high' | 'normal';

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

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
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

export function shouldRouteToGlip(envelope: Pick<NotificationEnvelope, 'lane' | 'priority'>): boolean {
  return envelope.lane === 'notice' && envelope.priority === 'high';
}

export class NotificationCenterService {
  private readonly notificationRepository: NotificationRepository;
  private readonly channelDeliveryRepository: ChannelDeliveryRepository;

  constructor(private readonly db: Database.Database) {
    this.notificationRepository = new NotificationRepository(db);
    this.channelDeliveryRepository = new ChannelDeliveryRepository(db);
  }

  listFeed(input: {
    channel: DeliveryChannel;
    lanes: DeliveryLane[];
    limit?: number;
  }): NotificationEnvelope[] {
    const lanes = Array.from(new Set(input.lanes)).filter(
      (lane): lane is DeliveryLane => lane === 'todo' || lane === 'notice',
    );
    if (lanes.length === 0) return [];

    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const notifications = this.notificationRepository
      .list({ state: 'pending', limit: Math.max(limit * 3, 20), includeFuture: false })
      .map<NotificationEnvelope>((notification) => {
        const routing = classifyNotificationRouting({
          sourceType: 'notification',
          type: notification.type,
        });
        return {
          sourceRef: `notification:${notification.id}`,
          sourceType: 'notification',
          sourceId: notification.id,
          lane: routing.lane,
          priority: routing.priority,
          title: notification.title,
          body: notification.body,
          createdAt: notification.createdAt,
          sentAt: notification.sentAt,
          type: notification.type,
          payload: notification.payload,
        };
      });

    const actions = this.db
      .prepare(
        `SELECT id, type, action_type, title, description, state, expires_at, created_at, params_json
           FROM proposed_actions
          WHERE state = 'pending'
            AND queue_status IN ('queued', 'running')
          ORDER BY priority DESC, created_at DESC
          LIMIT ?`,
      )
      .all(Math.max(limit * 3, 20)) as ProposedActionRow[];

    const actionEnvelopes = actions.map<NotificationEnvelope>((action) => {
      const payload = safeJsonParse<Record<string, unknown>>(action.params_json);
      return {
        sourceRef: `proposed_action:${action.id}`,
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
      };
    });

    const combined = [...notifications, ...actionEnvelopes]
      .filter((item) => lanes.includes(item.lane))
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority === 'high' ? -1 : 1;
        }
        const leftTs = left.sentAt ?? left.createdAt;
        const rightTs = right.sentAt ?? right.createdAt;
        return rightTs - leftTs;
      });

    const delivered = this.channelDeliveryRepository.getSuccessfulSourceRefs(
      combined.map((item) => item.sourceRef),
      input.channel,
      lanes,
    );

    return combined.filter((item) => !delivered.has(item.sourceRef)).slice(0, limit);
  }

  recordDelivery(events: Array<{
    sourceRef: string;
    channel: DeliveryChannel;
    lane: DeliveryLane;
    status: DeliveryStatus;
    externalRef?: string;
    error?: string;
  }>) {
    return this.channelDeliveryRepository.upsertEvents(
      events.map((event) => ({
        ...event,
        recordedAt: now(),
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

  formatTodoDigest(provider: string, tokenBudget: number): {
    bodyMd: string;
    sourceRefs: string[];
    dedupeSuffix: string;
    itemCount: number;
  } {
    const items = this.listFeed({
      channel: provider === 'doubao' ? 'doubao' : 'chrome',
      lanes: ['todo'],
      limit: 8,
    });

    const lines = items.map((item) => {
      const due =
        item.dueAt || item.sentAt
          ? ` @ ${formatDateTime(item.dueAt ?? item.sentAt ?? item.createdAt)}`
          : '';
      const body = item.body ? ` - ${item.body}` : '';
      return `${item.title}${due}${body}`;
    });

    const bodyMd = [
      '# Todo Digest',
      '> Rolling todo context for short-term action sync.',
      '',
      '## Pending Todos',
      lines.length > 0 ? lines.map((line) => `- ${line}`).join('\n') : '- No pending todos.',
    ].join('\n');

    return {
      bodyMd: bodyMd.length <= Math.max(400, tokenBudget * 4) ? bodyMd : bodyMd.slice(0, Math.max(0, tokenBudget * 4 - 32)).trim(),
      sourceRefs: items.map((item) => item.sourceRef),
      dedupeSuffix: items.map((item) => item.sourceRef).join('|'),
      itemCount: items.length,
    };
  }

  formatNoticeDigest(provider: string, tokenBudget: number): {
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

    const lines = items.map((item) => {
      const when = item.sentAt ? ` @ ${formatDateTime(item.sentAt)}` : '';
      const body = item.body ? ` - ${item.body}` : '';
      return `${item.title}${when}${body}`;
    });

    const bodyMd = [
      '# Notice Digest',
      '> Informational updates for the mobile context; do not turn these into todos.',
      '',
      '## Updates',
      lines.length > 0 ? lines.map((line) => `- ${line}`).join('\n') : '- No new notices.',
    ].join('\n');

    return {
      bodyMd: bodyMd.length <= Math.max(400, tokenBudget * 4) ? bodyMd : bodyMd.slice(0, Math.max(0, tokenBudget * 4 - 32)).trim(),
      sourceRefs: items.map((item) => item.sourceRef),
      dedupeSuffix: items.map((item) => item.sourceRef).join('|'),
      itemCount: items.length,
    };
  }
}
