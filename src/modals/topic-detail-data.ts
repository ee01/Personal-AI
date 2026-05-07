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
