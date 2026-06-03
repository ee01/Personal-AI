import type { TopicItemWithAutoReply } from './message-reaction/AutoReplyHandler';

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

export function getImmediateNotificationItem(params: {
  manualItems: TopicItemWithAutoReply[];
  followThreadItem?: TopicItemWithAutoReply;
}): TopicItemWithAutoReply | undefined {
  if (params.followThreadItem?.notifyMethod?.trim()) {
    return params.followThreadItem;
  }

  return params.manualItems.find(
    (item) =>
      Boolean(item.notifyMethod?.trim()) && !shouldQueueRuleDigest(item),
  );
}
