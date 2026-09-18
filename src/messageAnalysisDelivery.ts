import type { TopicItemWithAutoReply } from './message-reaction/AutoReplyHandler';

export const MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY =
  'messageAnalysisDeliveryReceipt';

export type MessageAnalysisDeliveryRunMode =
  | 'filter'
  | 'agentThinking'
  | 'agentWorkflow';

export type MessageAnalysisDeliveryRunSource = 'manual' | 'scheduled';

export interface MessageAnalysisDeliveryCounters {
  groupsAnalyzed: number;
  analyzedMessages: number;
  scopeRejected: number;
  memoryWriteRequests: number;
  memoryWritesAccepted: number;
  memoryDuplicateSkips: number;
  memoryWriteFailures: number;
  immediateNotificationAttempts: number;
  immediateNotificationFailures: number;
  digestQueueEntries: number;
  autoReplyHandled: number;
  autoReplySkipped: number;
  followThreadUpdates: number;
  followThreadFailures: number;
  automationPlanRequests: number;
  automationActionsCreated: number;
  automationPlanSkipped: number;
  automationPlanFailures: number;
  automationPlanPaused: number;
}

export interface MessageAnalysisDeliveryReceipt {
  version: 1;
  status: 'completed' | 'partial';
  runMode: MessageAnalysisDeliveryRunMode;
  source: MessageAnalysisDeliveryRunSource;
  capturedAt: number;
  startedAt: number;
  counters: MessageAnalysisDeliveryCounters;
  notes: string[];
}

const EMPTY_DELIVERY_COUNTERS: MessageAnalysisDeliveryCounters = {
  groupsAnalyzed: 0,
  analyzedMessages: 0,
  scopeRejected: 0,
  memoryWriteRequests: 0,
  memoryWritesAccepted: 0,
  memoryDuplicateSkips: 0,
  memoryWriteFailures: 0,
  immediateNotificationAttempts: 0,
  immediateNotificationFailures: 0,
  digestQueueEntries: 0,
  autoReplyHandled: 0,
  autoReplySkipped: 0,
  followThreadUpdates: 0,
  followThreadFailures: 0,
  automationPlanRequests: 0,
  automationActionsCreated: 0,
  automationPlanSkipped: 0,
  automationPlanFailures: 0,
  automationPlanPaused: 0,
};

export function createMessageAnalysisDeliveryReceipt(params: {
  runMode: MessageAnalysisDeliveryRunMode;
  source: MessageAnalysisDeliveryRunSource;
  groupsAnalyzed?: number;
}): MessageAnalysisDeliveryReceipt {
  const now = Date.now();
  return {
    version: 1,
    status: 'completed',
    runMode: params.runMode,
    source: params.source,
    capturedAt: now,
    startedAt: now,
    counters: {
      ...EMPTY_DELIVERY_COUNTERS,
      groupsAnalyzed: params.groupsAnalyzed || 0,
    },
    notes: [],
  };
}

export function finalizeMessageAnalysisDeliveryReceipt(
  receipt: MessageAnalysisDeliveryReceipt,
): MessageAnalysisDeliveryReceipt {
  const failures =
    receipt.counters.memoryWriteFailures +
    receipt.counters.immediateNotificationFailures +
    receipt.counters.followThreadFailures +
    receipt.counters.automationPlanFailures;

  return {
    ...receipt,
    capturedAt: Date.now(),
    status: failures > 0 ? 'partial' : 'completed',
    notes: Array.from(new Set(receipt.notes)).slice(0, 8),
  };
}

export function getMessageAnalysisDeliveryFailureCount(
  receipt: MessageAnalysisDeliveryReceipt,
): number {
  return (
    receipt.counters.memoryWriteFailures +
    receipt.counters.immediateNotificationFailures +
    receipt.counters.followThreadFailures +
    receipt.counters.automationPlanFailures
  );
}

export function getMessageAnalysisDeliveryDelayedCount(
  receipt: MessageAnalysisDeliveryReceipt,
): number {
  return (
    receipt.counters.digestQueueEntries +
    receipt.counters.automationPlanRequests +
    receipt.counters.followThreadUpdates +
    (receipt.counters.autoReplyHandled || 0)
  );
}

export function summarizeMessageAnalysisDeliveryReceipt(
  receipt: MessageAnalysisDeliveryReceipt,
): { success: boolean; error?: string; summary: string } {
  const finalized = finalizeMessageAnalysisDeliveryReceipt(receipt);
  const failures = getMessageAnalysisDeliveryFailureCount(finalized);
  const delayed = getMessageAnalysisDeliveryDelayedCount(finalized);
  const counters = finalized.counters;
  const autoReplyHandled = counters.autoReplyHandled || 0;
  const autoReplySkipped = counters.autoReplySkipped || 0;
  const baseSummary = [
    `分析 ${counters.analyzedMessages} 条`,
    `写入 ${counters.memoryWritesAccepted}/${counters.memoryWriteRequests}`,
    `重复 ${counters.memoryDuplicateSkips}`,
    `即时通知 ${counters.immediateNotificationAttempts}`,
    `摘要 ${counters.digestQueueEntries}`,
    `自动答复 ${autoReplyHandled}/${autoReplyHandled + autoReplySkipped}`,
    `联动 ${counters.automationPlanRequests}`,
    `范围拦截 ${counters.scopeRejected}`,
  ].join('，');

  if (failures > 0) {
    const failureSummary = [
      counters.memoryWriteFailures
        ? `记忆写入失败 ${counters.memoryWriteFailures}`
        : '',
      counters.immediateNotificationFailures
        ? `即时通知失败 ${counters.immediateNotificationFailures}`
        : '',
      counters.followThreadFailures
        ? `关注后续失败 ${counters.followThreadFailures}`
        : '',
      counters.automationPlanFailures
        ? `联动规划失败 ${counters.automationPlanFailures}`
        : '',
    ]
      .filter(Boolean)
      .join('，');

    return {
      success: false,
      error: `消息分析部分完成：下游失败 ${failures}`,
      summary: `${baseSummary}，下游失败 ${failures}${
        failureSummary ? `（${failureSummary}）` : ''
      }，延后队列/规划 ${delayed}`,
    };
  }

  return {
    success: true,
    summary: `${baseSummary}，下游失败 0，延后队列/规划 ${delayed}`,
  };
}

export async function persistMessageAnalysisDeliveryReceipt(
  receipt: MessageAnalysisDeliveryReceipt,
): Promise<MessageAnalysisDeliveryReceipt> {
  const finalized = finalizeMessageAnalysisDeliveryReceipt(receipt);
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return finalized;

  await storage.set({
    [MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY]: finalized,
  });
  return finalized;
}

export function shouldQueueRuleDigest(
  item?: TopicItemWithAutoReply,
): item is TopicItemWithAutoReply & {
  digestConfig: NonNullable<TopicItemWithAutoReply['digestConfig']>;
} {
  return Boolean(item && item.digestConfig?.enabled && !item.followThread);
}

export function getDigestDeliveryItems(items: TopicItemWithAutoReply[]): Array<
  TopicItemWithAutoReply & {
    digestConfig: NonNullable<TopicItemWithAutoReply['digestConfig']>;
  }
> {
  return items.filter(shouldQueueRuleDigest);
}

export function getImmediateNotificationItems(params: {
  manualItems: TopicItemWithAutoReply[];
  followThreadItem?: TopicItemWithAutoReply;
}): TopicItemWithAutoReply[] {
  const items: TopicItemWithAutoReply[] = [];
  const seen = new Set<string>();

  const push = (item?: TopicItemWithAutoReply) => {
    if (!item?.notifyMethod?.trim()) return;
    if (shouldQueueRuleDigest(item)) return;
    const key = item.id || item.text;
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  push(params.followThreadItem);
  for (const item of params.manualItems) {
    push(item);
  }

  return items;
}

export function getImmediateNotificationItem(params: {
  manualItems: TopicItemWithAutoReply[];
  followThreadItem?: TopicItemWithAutoReply;
}): TopicItemWithAutoReply | undefined {
  return getImmediateNotificationItems(params)[0];
}

/**
 * 即时通知的推送场景。
 *
 * - `message_analysis`：普通关注项命中，使用「消息分析推送」目标和通用模板。
 * - `follow_up`：关注后续命中，使用「关注后续推送」目标和独立模板。
 */
export type ImmediateNotificationPushScenario =
  | 'message_analysis'
  | 'follow_up';

export const MESSAGE_ANALYSIS_PUSH_SCENARIO = 'message_analysis' as const;
export const FOLLOW_THREAD_PUSH_SCENARIO = 'follow_up' as const;

/**
 * 一个关注项是否代表「关注后续 / Watch」规则。
 */
export function isFollowThreadPushItem(
  item?: TopicItemWithAutoReply,
): boolean {
  return Boolean(item?.followThread);
}

/**
 * 判定这次即时通知是否属于关注后续推送。
 *
 * 关注后续命中有两条路径：
 * 1. LLM 通过 `follow_thread_info` 明确识别出关联原消息（`followThreadItem`）；
 * 2. LLM 只按 `matched_rule` 命中了某条关注后续规则，此时命中的关注项本身
 *    带 `followThread` 标记，但没有 `follow_thread_info`。
 * 两条路径都属于关注后续推送，必须走同一套独立配置和模板，否则第 2 类命中
 * 会被当成普通消息分析推送，落到「消息分析推送」目标并使用通用模板。
 */
export function resolveFollowThreadPushItem(params: {
  followThreadItem?: TopicItemWithAutoReply;
  items: TopicItemWithAutoReply[];
}): TopicItemWithAutoReply | undefined {
  if (isFollowThreadPushItem(params.followThreadItem)) {
    return params.followThreadItem;
  }
  return params.items.find((item) => isFollowThreadPushItem(item));
}

export interface FollowThreadOriginalMessageInfo {
  sender: string;
  content: string;
  datetime: string;
  messageUrl: string;
}

/**
 * 从关注后续规则里取出原消息锚点，供独立模板展示原消息预览。
 */
export function buildFollowThreadOriginalMessageInfo(
  followThreadItem?: TopicItemWithAutoReply,
): FollowThreadOriginalMessageInfo | undefined {
  const original = followThreadItem?.followConfig?.originalMessage;
  if (!original) {
    return undefined;
  }

  return {
    sender: original.sender || '',
    content: original.content || '',
    datetime: String(original.datetime ?? ''),
    messageUrl: original.messageUrl || '',
  };
}

export function formatImmediateNotificationMatchedRule(
  items: TopicItemWithAutoReply[],
  fallback = '',
): string {
  const mentionItems = items.filter((item) => Boolean(item.mentionMe));
  const otherItems = items.filter((item) => !item.mentionMe);
  const labels = [...mentionItems, ...otherItems]
    .map((item) => {
      const text = (item.text || '').trim();
      if (!text) return '';
      return item.mentionMe ? `${text}（@提醒）` : text;
    })
    .filter(Boolean);

  return labels.join('\n') || fallback;
}

export function resolveImmediateNotificationDelivery(params: {
  manualItems: TopicItemWithAutoReply[];
  followThreadItem?: TopicItemWithAutoReply;
  fallbackMatchedRule?: string;
}): {
  items: TopicItemWithAutoReply[];
  notifyMethod: string;
  mention: boolean;
  matchedRule: string;
  pushScenario: ImmediateNotificationPushScenario;
  followThreadPushItem?: TopicItemWithAutoReply;
} {
  const items = getImmediateNotificationItems(params);
  const fallback =
    params.fallbackMatchedRule ||
    (params.followThreadItem
      ? `关注后续：${params.followThreadItem.followConfig?.originalMessage.content?.substring(0, 50) || ''}...`
      : '');
  const followThreadPushItem = resolveFollowThreadPushItem({
    followThreadItem: params.followThreadItem,
    items,
  });

  return {
    items,
    notifyMethod: items[0]?.notifyMethod || '',
    mention: items.some((item) => Boolean(item.mentionMe)),
    matchedRule: formatImmediateNotificationMatchedRule(items, fallback),
    pushScenario: followThreadPushItem
      ? FOLLOW_THREAD_PUSH_SCENARIO
      : MESSAGE_ANALYSIS_PUSH_SCENARIO,
    followThreadPushItem,
  };
}
