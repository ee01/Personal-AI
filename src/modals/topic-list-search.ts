const normalizeQueryTerms = (query: string): string[] =>
  String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

const appendString = (values: string[], value: unknown) => {
  if (value === undefined || value === null) return;
  const text = String(value).trim();
  if (text) values.push(text.toLowerCase());
};

const appendArrayValues = (
  values: string[],
  items: unknown,
  keys: readonly string[],
) => {
  if (!Array.isArray(items)) return;

  items.forEach((item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      appendString(values, item);
      return;
    }

    keys.forEach((key) => appendString(values, item[key]));
  });
};

const appendUniqueLabel = (
  labels: string[],
  seen: Set<string>,
  value: unknown,
) => {
  if (value === undefined || value === null) return;
  const label = String(value).trim();
  if (!label) return;
  const normalized = label.toLowerCase();
  if (seen.has(normalized)) return;
  seen.add(normalized);
  labels.push(label);
};

const appendObjectLabel = (
  labels: string[],
  seen: Set<string>,
  item: any,
  keys: readonly string[],
) => {
  if (!item) return;
  if (typeof item === 'string') {
    appendUniqueLabel(labels, seen, item);
    return;
  }

  keys.some((key) => {
    const value = item[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      return false;
    }
    appendUniqueLabel(labels, seen, value);
    return true;
  });
};

const appendPeopleLabels = (
  labels: string[],
  seen: Set<string>,
  items: unknown,
) => {
  if (!Array.isArray(items)) return;

  items.forEach((item: any) =>
    appendObjectLabel(labels, seen, item, [
      'name',
      'displayName',
      'fullName',
      'label',
      'title',
      'email',
      'username',
      'handle',
    ]),
  );
};

const appendCooccurringPeopleLabels = (
  labels: string[],
  seen: Set<string>,
  items: unknown,
) => {
  if (!Array.isArray(items)) return;

  items.forEach((item: any) => {
    const type = String(
      item?.type || item?.entityType || item?.entity?.type || '',
    ).toLowerCase();
    if (type !== 'person' && type !== 'people') return;
    appendObjectLabel(labels, seen, item?.entity || item, [
      'name',
      'displayName',
      'fullName',
      'label',
      'title',
      'email',
      'username',
      'handle',
    ]);
  });
};

const getTopicConversationArrays = (topic: any): any[][] => {
  if (!topic) return [];

  const arrays: any[][] = [];
  const recent = topic?.recentDataDetails || {};
  const related = topic?.relatedData || {};
  [
    recent.conversations,
    related.conversations,
    topic?.conversations,
    topic?.latestConversations,
  ].forEach((conversations) => {
    if (Array.isArray(conversations) && !arrays.includes(conversations)) {
      arrays.push(conversations);
    }
  });
  return arrays;
};

const appendConversationParticipantLabels = (
  labels: string[],
  seen: Set<string>,
  conversations: unknown,
) => {
  if (!Array.isArray(conversations)) return;

  conversations.forEach((conversation: any) => {
    appendObjectLabel(labels, seen, conversation, [
      'sender',
      'senderName',
      'author',
      'authorName',
      'creatorName',
      'creatorUsername',
      'username',
    ]);

    appendPeopleLabels(labels, seen, conversation?.participants);

    if (Array.isArray(conversation?.contextMessages)) {
      conversation.contextMessages.forEach((contextMessage: any) => {
        appendObjectLabel(labels, seen, contextMessage, [
          'sender',
          'senderName',
          'author',
          'authorName',
          'creatorName',
          'creatorUsername',
          'username',
        ]);
        appendPeopleLabels(labels, seen, contextMessage?.participants);
      });
    }
  });
};

const collectTopicParticipantLabels = (topic: any): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();
  const recent = topic?.recentDataDetails || {};
  const related = topic?.relatedData || {};

  [
    topic?.people,
    topic?.participants,
    topic?.participantNames,
    topic?.relatedPeople,
    recent.people,
    recent.participants,
    related.people,
    related.participants,
    related.relatedPeople,
  ].forEach((items) => appendPeopleLabels(labels, seen, items));

  [
    topic?.cooccurringEntities,
    recent.cooccurringEntities,
    related.cooccurringEntities,
  ].forEach((items) => appendCooccurringPeopleLabels(labels, seen, items));

  getTopicConversationArrays(topic).forEach((conversations) =>
    appendConversationParticipantLabels(labels, seen, conversations),
  );

  return labels;
};

export const getTopicParticipantLabels = (
  topic: any,
  limit = 4,
): string[] => {
  const labels = collectTopicParticipantLabels(topic);
  return Number.isFinite(limit) && limit >= 0 ? labels.slice(0, limit) : labels;
};

export const getTopicParticipantTotalCount = (topic: any): number =>
  collectTopicParticipantLabels(topic).length;

const collectConversationValues = (values: string[], conversations: unknown) => {
  if (!Array.isArray(conversations)) return;

  conversations.forEach((conversation: any) => {
    if (!conversation) return;
    [
      'id',
      'messageId',
      'conversationId',
      'sourceMessageId',
      'summary',
      'content',
      'originalContent',
      'highlightText',
      'sender',
      'groupName',
      'sourceTitle',
      'teamUrl',
      'sourceUrl',
      'permalink',
      'url',
    ].forEach((key) => appendString(values, conversation[key]));

    appendArrayValues(values, conversation.contextMessages, [
      'id',
      'messageId',
      'sourceMessageId',
      'summary',
      'content',
      'sender',
      'sourceTitle',
      'teamUrl',
      'sourceUrl',
      'permalink',
      'url',
    ]);
  });
};

export const getTopicListSearchText = (topic: any): string => {
  const values: string[] = [];
  appendString(values, topic?.name);
  appendString(values, topic?.description);
  appendArrayValues(values, topic?.tags, []);
  appendArrayValues(values, topic?.aliases, []);
  collectTopicParticipantLabels(topic).forEach((label) =>
    appendString(values, label),
  );
  appendArrayValues(values, topic?.unreadDiscussions, [
    'id',
    'messageId',
    'conversationId',
    'sourceMessageId',
    'text',
    'summary',
    'content',
    'highlightText',
    'title',
    'sender',
    'groupName',
  ]);

  const recent = topic?.recentDataDetails || {};
  const related = topic?.relatedData || {};
  collectConversationValues(values, recent.conversations);
  collectConversationValues(values, related.conversations);
  collectConversationValues(values, topic?.conversations);
  collectConversationValues(values, topic?.latestConversations);

  [
    recent.resources,
    related.resources,
    related.relatedResources,
    topic?.relatedResources,
  ].forEach((resources) =>
    appendArrayValues(values, resources, [
      'id',
      'name',
      'title',
      'description',
      'summary',
      'url',
      'sourceUrl',
    ]),
  );

  [
    recent.projects,
    related.projects,
    related.relatedProjects,
    topic?.relatedProjects,
  ].forEach((projects) =>
    appendArrayValues(values, projects, [
      'id',
      'name',
      'title',
      'description',
      'status',
      'sourceUrl',
    ]),
  );

  [
    recent.jiraTickets,
    recent.tickets,
    related.jiraTickets,
    related.tickets,
    related.relatedTickets,
    topic?.relatedTickets,
  ].forEach((tickets) =>
    appendArrayValues(values, tickets, [
      'id',
      'key',
      'name',
      'title',
      'summary',
      'status',
      'url',
      'sourceUrl',
    ]),
  );

  [recent.webpages, related.webpages, topic?.webpages].forEach((webpages) =>
    appendArrayValues(values, webpages, [
      'id',
      'title',
      'name',
      'summary',
      'url',
      'sourceUrl',
      'sourceTitle',
    ]),
  );

  return values.join('\n');
};

export const topicMatchesListQuery = (topic: any, query: string): boolean => {
  const terms = normalizeQueryTerms(query);
  if (terms.length === 0) return true;

  const haystack = getTopicListSearchText(topic);
  return terms.every((term) => haystack.includes(term));
};
