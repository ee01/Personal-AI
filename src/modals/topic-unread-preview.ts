const DISCUSSION_ID_KEYS = [
  'messageId',
  'conversationId',
  'sourceMessageId',
  'id',
] as const;

const TOPIC_CONVERSATION_CONTAINERS = [
  'recentDataDetails',
  'relatedData',
] as const;

const TOPIC_TOP_LEVEL_CONVERSATION_KEYS = [
  'conversations',
  'latestConversations',
] as const;

const getTopicConversationLists = (topic: any): any[][] => {
  if (!topic) return [];

  const lists: any[][] = [];
  TOPIC_CONVERSATION_CONTAINERS.forEach((containerKey) => {
    const conversations = topic[containerKey]?.conversations;
    if (Array.isArray(conversations) && !lists.includes(conversations)) {
      lists.push(conversations);
    }
  });
  TOPIC_TOP_LEVEL_CONVERSATION_KEYS.forEach((conversationKey) => {
    const conversations = topic[conversationKey];
    if (Array.isArray(conversations) && !lists.includes(conversations)) {
      lists.push(conversations);
    }
  });
  return lists;
};

const getConversationReadNodes = (conversation: any): any[] => {
  const nodes = conversation ? [conversation] : [];
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  contextMessages.forEach((contextMessage: any) => {
    if (contextMessage && !nodes.includes(contextMessage)) {
      nodes.push(contextMessage);
    }
  });

  return nodes;
};

const isConversationExplicitlyUnread = (conversation: any): boolean => {
  return getConversationReadNodes(conversation).some(
    (message) => message?.isRead === false,
  );
};

export const getTopicUnreadConversationCount = (topic: any): number => {
  const lists = getTopicConversationLists(topic);
  if (lists.length === 0) return 0;

  return Math.max(
    0,
    ...lists.map(
      (conversations) =>
        conversations.filter((conversation: any) =>
          isConversationExplicitlyUnread(conversation),
        ).length,
    ),
  );
};

export const getUnreadDiscussionMessageId = (discussion: any): string => {
  for (const key of DISCUSSION_ID_KEYS) {
    const value = discussion?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
};

export const getUnreadDiscussionText = (discussion: any): string => {
  const text =
    discussion?.text ||
    discussion?.summary ||
    discussion?.content ||
    discussion?.highlightText ||
    discussion?.title;
  const normalizedText = String(text || '').trim();
  return normalizedText || '未读讨论';
};

export const getUnreadDiscussionKey = (
  discussion: any,
  index: number,
): string => {
  return (
    getUnreadDiscussionMessageId(discussion) ||
    `${getUnreadDiscussionText(discussion)}:${index}`
  );
};

export const getTopicUnreadPreviewCount = (topic: any): number => {
  return Array.isArray(topic?.unreadDiscussions)
    ? topic.unreadDiscussions.length
    : 0;
};

export const getTopicUnreadTotalCount = (topic: any): number => {
  const readStatusCount = Number(topic?.readStatus?.unreadCount);
  const previewCount = getTopicUnreadPreviewCount(topic);
  const conversationCount = getTopicUnreadConversationCount(topic);
  if (Number.isFinite(readStatusCount)) {
    return Math.max(0, readStatusCount, previewCount, conversationCount);
  }
  return Math.max(previewCount, conversationCount);
};

export const getTopicUnreadPreviewMeta = (topic: any): string => {
  const previewCount = getTopicUnreadPreviewCount(topic);
  if (previewCount === 0) return '';

  const totalCount = getTopicUnreadTotalCount(topic);
  return totalCount > previewCount
    ? `(${previewCount}/${totalCount}条预览)`
    : `(${previewCount}条)`;
};

export const getTopicUnreadRemainingCount = (
  topic: any,
  visibleLimit = 3,
): number => {
  const visiblePreviewCount = Math.min(
    getTopicUnreadPreviewCount(topic),
    Math.max(0, visibleLimit),
  );
  return Math.max(0, getTopicUnreadTotalCount(topic) - visiblePreviewCount);
};
