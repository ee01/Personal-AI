export interface TopicDetailRecentData {
  conversations: any[];
  webpages: any[];
  resources: any[];
  projects: any[];
  jiraTickets: any[];
}

const firstUsefulArray = (...values: any[]): any[] => {
  const nonEmptyArray = values.find(
    (value) => Array.isArray(value) && value.length > 0,
  );
  if (nonEmptyArray) return nonEmptyArray;

  return values.find((value) => Array.isArray(value)) || [];
};

const getMessageIds = (message: any): string[] => {
  return [
    message?.id,
    message?.messageId,
    message?.conversationId,
    message?.sourceMessageId,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value));
};

export const getTopicConversationPrimaryId = (conversation: any): string => {
  return getMessageIds(conversation)[0] || '';
};

export type TopicConversationReadFilter = 'all' | 'unread' | 'read';

const getConversationReadNodes = (conversation: any): any[] => {
  if (!conversation) return [];

  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];
  return [conversation, ...contextMessages.filter(Boolean)];
};

export const isTopicMessageExplicitlyUnread = (message: any): boolean => {
  return message?.isRead === false;
};

export const getTopicConversationUnreadMessageCount = (
  conversation: any,
): number => {
  const readNodes = getConversationReadNodes(conversation);
  if (readNodes.length === 0) return 0;

  return readNodes.filter((message) =>
    isTopicMessageExplicitlyUnread(message),
  ).length;
};

export const isTopicConversationUnread = (conversation: any): boolean => {
  return getTopicConversationUnreadMessageCount(conversation) > 0;
};

export const getTopicConversationUnreadCount = (
  conversations: any[],
): number => {
  return conversations.filter((conversation) =>
    isTopicConversationUnread(conversation),
  ).length;
};

export const filterTopicConversationsByReadState = (
  conversations: any[],
  readFilter: TopicConversationReadFilter,
): any[] => {
  if (readFilter === 'unread') {
    return conversations.filter((conversation) =>
      isTopicConversationUnread(conversation),
    );
  }
  if (readFilter === 'read') {
    return conversations.filter(
      (conversation) => !isTopicConversationUnread(conversation),
    );
  }
  return conversations;
};

export const sortTopicConversationsForTriage = (
  conversations: any[],
): any[] => {
  return conversations
    .map((conversation, index) => ({ conversation, index }))
    .sort((a, b) => {
      const unreadDelta =
        Number(isTopicConversationUnread(b.conversation)) -
        Number(isTopicConversationUnread(a.conversation));
      return unreadDelta || a.index - b.index;
    })
    .map((item) => item.conversation);
};

const getNormalizedQuery = (query: string): string => {
  return String(query || '').trim().toLowerCase();
};

const valueMatchesQuery = (value: unknown, normalizedQuery: string): boolean => {
  if (!normalizedQuery) return true;
  return String(value || '').toLowerCase().includes(normalizedQuery);
};

const getConversationSearchValues = (conversation: any): unknown[] => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return [
    conversation?.summary,
    conversation?.sender,
    conversation?.groupName,
    conversation?.highlightText,
    conversation?.originalContent,
    conversation?.content,
    conversation?.sourceTitle,
    conversation?.teamUrl,
    conversation?.sourceUrl,
    conversation?.permalink,
    conversation?.url,
    ...contextMessages.flatMap((contextMessage: any) => [
      contextMessage?.sender,
      contextMessage?.content,
      contextMessage?.summary,
      contextMessage?.sourceTitle,
      contextMessage?.teamUrl,
      contextMessage?.sourceUrl,
      contextMessage?.permalink,
      contextMessage?.url,
    ]),
  ];
};

export const topicConversationHasContextMatch = (
  conversation: any,
  query: string,
): boolean => {
  const normalizedQuery = getNormalizedQuery(query);
  if (!normalizedQuery) return false;

  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return contextMessages.some((contextMessage: any) =>
    [
      contextMessage?.sender,
      contextMessage?.content,
      contextMessage?.summary,
      contextMessage?.sourceTitle,
      contextMessage?.teamUrl,
      contextMessage?.sourceUrl,
      contextMessage?.permalink,
      contextMessage?.url,
    ].some((value) => valueMatchesQuery(value, normalizedQuery)),
  );
};

export const topicConversationMatchesQuery = (
  conversation: any,
  query: string,
): boolean => {
  const normalizedQuery = getNormalizedQuery(query);
  if (!normalizedQuery) return true;
  return getConversationSearchValues(conversation).some((value) =>
    valueMatchesQuery(value, normalizedQuery),
  );
};

export const getTopicDetailRecentData = (topic: any): TopicDetailRecentData => {
  const recent = topic?.recentDataDetails || {};
  const related = topic?.relatedData || {};

  return {
    conversations: firstUsefulArray(
      recent.conversations,
      related.conversations,
      topic?.conversations,
      topic?.latestConversations,
    ),
    webpages: firstUsefulArray(
      recent.webpages,
      related.webpages,
      topic?.webpages,
    ),
    resources: firstUsefulArray(
      recent.resources,
      related.resources,
      related.relatedResources,
      topic?.relatedResources,
    ),
    projects: firstUsefulArray(
      recent.projects,
      related.projects,
      related.relatedProjects,
      topic?.relatedProjects,
    ),
    jiraTickets: firstUsefulArray(
      recent.jiraTickets,
      recent.tickets,
      related.jiraTickets,
      related.tickets,
      related.relatedTickets,
      topic?.relatedTickets,
    ),
  };
};

export const getTopicDetailUnreadCount = (topic: any): number => {
  const readStatusCount = Number(topic?.readStatus?.unreadCount);
  const previewCount = Array.isArray(topic?.unreadDiscussions)
    ? topic.unreadDiscussions.length
    : 0;
  const conversationUnreadCount = getTopicConversationUnreadCount(
    getTopicDetailRecentData(topic).conversations,
  );

  return Math.max(
    0,
    Number.isFinite(readStatusCount) ? readStatusCount : 0,
    previewCount,
    conversationUnreadCount,
  );
};

export const findTopicConversationByMessageId = (
  topic: any,
  messageId: string,
): any | null => {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) return null;

  const conversations = getTopicDetailRecentData(topic).conversations;
  return (
    conversations.find((conversation) => {
      if (getMessageIds(conversation).includes(normalizedMessageId)) {
        return true;
      }

      const contextMessages = Array.isArray(conversation?.contextMessages)
        ? conversation.contextMessages
        : [];
      return contextMessages.some((contextMessage: any) =>
        getMessageIds(contextMessage).includes(normalizedMessageId),
      );
    }) || null
  );
};
