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
