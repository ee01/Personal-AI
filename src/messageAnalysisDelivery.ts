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
} {
  const items = getImmediateNotificationItems(params);
  const fallback =
    params.fallbackMatchedRule ||
    (params.followThreadItem
      ? `关注后续：${params.followThreadItem.followConfig?.originalMessage.content?.substring(0, 50) || ''}...`
      : '');

  return {
    items,
    notifyMethod: items[0]?.notifyMethod || '',
    mention: items.some((item) => Boolean(item.mentionMe)),
    matchedRule: formatImmediateNotificationMatchedRule(items, fallback),
  };
}
