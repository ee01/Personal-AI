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

const MESSAGE_ID_KEYS = [
  'id',
  'messageId',
  'message_id',
  'conversationId',
  'conversation_id',
  'sourceMessageId',
  'source_message_id',
  'externalMessageId',
  'external_message_id',
] as const;

const MESSAGE_URL_KEYS = ['teamUrl', 'sourceUrl', 'permalink', 'url'] as const;

const URL_MESSAGE_ID_PARAM_KEYS = [
  'messageId',
  'message_id',
  'conversationId',
  'conversation_id',
  'sourceMessageId',
  'source_message_id',
  'externalMessageId',
  'external_message_id',
  'id',
  'msg',
  'ts',
  'thread_ts',
] as const;

const decodeIdentityValue = (value: string): string | null => {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? null : decoded;
  } catch (_error) {
    return null;
  }
};

const getSlackPermalinkTimestampAlias = (value: string): string | null => {
  const match = /^p(\d{10})(\d{5,6})$/.exec(String(value || '').trim());
  if (!match) return null;
  return `${match[1]}.${match[2].padStart(6, '0')}`;
};

const getSlackTimestampPermalinkAlias = (value: string): string | null => {
  const match = /^(\d{10,})\.(\d{6})$/.exec(String(value || '').trim());
  if (!match) return null;
  return `p${match[1]}${match[2]}`;
};

const appendIdentity = (
  values: string[],
  seen: Set<string>,
  value: unknown,
) => {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  values.push(normalized);
};

const appendSlackIdentityAliases = (
  values: string[],
  seen: Set<string>,
  value: string,
) => {
  appendIdentity(values, seen, getSlackPermalinkTimestampAlias(value));
  appendIdentity(values, seen, getSlackTimestampPermalinkAlias(value));
};

const looksLikeMessagePathSegment = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return normalized.length >= 8 || /\d/.test(normalized);
};

const appendUrlIdentityAliases = (
  values: string[],
  seen: Set<string>,
  value: string,
) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch (_error) {
    return;
  }

  URL_MESSAGE_ID_PARAM_KEYS.forEach((key) => {
    const paramValue = url.searchParams.get(key);
    appendIdentity(values, seen, paramValue);
    const decodedParamValue = paramValue ? decodeIdentityValue(paramValue) : null;
    appendIdentity(values, seen, decodedParamValue);
  });

  const hashValue = url.hash.replace(/^#/, '').trim();
  if (hashValue) {
    appendIdentity(values, seen, hashValue);
    const decodedHashValue = decodeIdentityValue(hashValue);
    appendIdentity(values, seen, decodedHashValue);

    const hashQuery =
      hashValue.includes('?') || hashValue.includes('=')
        ? hashValue.slice(hashValue.indexOf('?') + 1)
        : '';
    if (hashQuery) {
      const hashParams = new URLSearchParams(hashQuery);
      URL_MESSAGE_ID_PARAM_KEYS.forEach((key) => {
        const paramValue = hashParams.get(key);
        appendIdentity(values, seen, paramValue);
        const decodedParamValue = paramValue
          ? decodeIdentityValue(paramValue)
          : null;
        appendIdentity(values, seen, decodedParamValue);
      });
    }
  }

  const pathSegments = url.pathname
    .split('/')
    .map((segment) => decodeIdentityValue(segment) || segment)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  if (looksLikeMessagePathSegment(lastSegment)) {
    appendIdentity(values, seen, lastSegment);
    appendSlackIdentityAliases(values, seen, lastSegment);
  }
};

export const getTopicMessageIdentityCandidates = (value: unknown): string[] => {
  const values: string[] = [];
  const seen = new Set<string>();
  appendIdentity(values, seen, value);

  const normalized = values[0] || '';
  if (normalized) {
    appendIdentity(values, seen, decodeIdentityValue(normalized));
    values.slice().forEach((candidate) => {
      appendSlackIdentityAliases(values, seen, candidate);
      appendUrlIdentityAliases(values, seen, candidate);
    });
  }

  return values;
};

export const getTopicMessageIdentityValues = (message: any): string[] => {
  const values: string[] = [];
  const seen = new Set<string>();
  [...MESSAGE_ID_KEYS, ...MESSAGE_URL_KEYS].forEach((key) => {
    getTopicMessageIdentityCandidates(message?.[key]).forEach((candidate) =>
      appendIdentity(values, seen, candidate),
    );
  });
  return values;
};

export const topicMessageMatchesIdentity = (
  message: any,
  identity: unknown,
): boolean => {
  const identitySet = new Set(getTopicMessageIdentityCandidates(identity));
  if (identitySet.size === 0) return false;
  return getTopicMessageIdentityValues(message).some((value) =>
    identitySet.has(value),
  );
};

export const getTopicConversationPrimaryId = (conversation: any): string => {
  return getTopicMessageIdentityValues(conversation)[0] || '';
};

export const getTopicConversationReadSyncId = (conversation: any): string => {
  const primaryId = getTopicConversationPrimaryId(conversation);
  if (primaryId) return primaryId;

  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];
  for (const contextMessage of contextMessages) {
    const contextMessageId = getTopicMessageIdentityValues(contextMessage)[0];
    if (contextMessageId) return contextMessageId;
  }

  return '';
};

export const getTopicConversationRenderIdentity = (
  conversation: any,
  index = 0,
): string => {
  const stableMessageId = getTopicConversationReadSyncId(conversation);
  return stableMessageId || `conversation-${index}`;
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
  if (getTopicMessageIdentityCandidates(messageId).length === 0) return null;

  const conversations = getTopicDetailRecentData(topic).conversations;
  return (
    conversations.find((conversation) => {
      if (topicMessageMatchesIdentity(conversation, messageId)) {
        return true;
      }

      const contextMessages = Array.isArray(conversation?.contextMessages)
        ? conversation.contextMessages
        : [];
      return contextMessages.some((contextMessage: any) =>
        topicMessageMatchesIdentity(contextMessage, messageId),
      );
    }) || null
  );
};
