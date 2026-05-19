import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPinia, setActivePinia } from 'pinia';

import {
  chromeAPI,
  getTopicDeferPresetOptions,
  getTopicMutePresetOptions,
  useMemoryStore,
} from '../src/modals/memory-store.ts';
import {
  filterTopicConversationsByReadState,
  findTopicConversationByMessageId,
  getTopicConversationPrimaryId,
  getTopicConversationUnreadMessageCount,
  getTopicConversationUnreadCount,
  getTopicDetailRecentData,
  getTopicDetailUnreadCount,
  isTopicMessageExplicitlyUnread,
  isTopicConversationUnread,
  sortTopicConversationsForTriage,
  topicConversationHasContextMatch,
  topicConversationMatchesQuery,
} from '../src/modals/topic-detail-data.ts';
import { renderHighlightedText } from '../src/modals/topic-detail-rendering.ts';
import { getSafeExternalUrl } from '../src/modals/topic-link-safety.ts';
import {
  getTopicTriagePriority,
  sortTopicsForTriage,
} from '../src/modals/topic-triage.ts';
import {
  getTopicUnreadPreviewCount,
  getTopicUnreadPreviewMeta,
  getTopicUnreadConversationCount,
  getTopicUnreadRemainingCount,
  getTopicUnreadTotalCount,
  getUnreadDiscussionKey,
  getUnreadDiscussionMessageId,
  getUnreadDiscussionText,
} from '../src/modals/topic-unread-preview.ts';
import {
  formatTopicRelativeTime,
  normalizeTopicTimestamp,
} from '../src/modals/topic-time.ts';

const cacheMessages: any[] = [];

(chromeAPI as any).sendMessage = async (message: any) => {
  cacheMessages.push(message);
  return { success: true };
};

function createTopic(id = 'topic-alpha') {
  return {
    id,
    name: 'Topic Alpha',
    type: 'Topic',
    readStatus: {
      isRead: false,
      unreadCount: 2,
      lastReadTime: null,
      lastUpdateTime: 1000,
    },
    unreadDiscussions: [
      { id: 'msg-1', text: 'First unread discussion' },
      { id: 'msg-2', text: 'Second unread discussion' },
    ],
    recentDataDetails: {
      conversations: [
        { id: 'msg-1', isRead: false, summary: 'First message' },
        { id: 'msg-2', isRead: false, summary: 'Second message' },
      ],
    },
    relatedData: {
      conversations: [{ id: 'legacy-msg', isRead: false }],
    },
  };
}

function createStore() {
  setActivePinia(createPinia());
  cacheMessages.length = 0;
  return useMemoryStore();
}

async function verifyWholeTopicReadSyncsListAndDetail() {
  const store = createStore();
  const listTopic = createTopic();
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markTopicAsRead('topic-alpha');

  for (const topic of [listTopic, detailTopic]) {
    assert.equal(topic.readStatus.unreadCount, 0);
    assert.equal(topic.readStatus.isRead, true);
    assert.ok(typeof topic.readStatus.lastReadTime === 'number');
    assert.deepEqual(topic.unreadDiscussions, []);
    assert.equal(
      topic.recentDataDetails.conversations.every((message) => message.isRead),
      true,
    );
    assert.equal(
      topic.relatedData.conversations.every((message) => message.isRead),
      true,
    );
  }

  assert.equal(store.getUnreadTopics().length, 0);
  assert.equal(cacheMessages.length, 2);
}

async function verifyWholeTopicReadCanUndo() {
  const store = createStore();
  const listTopic = createTopic();
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markTopicAsRead('topic-alpha');

  assert.equal(store.getUnreadTopics().length, 0);
  assert.equal((store.topicReadUndo as any)?.topicName, 'Topic Alpha');

  const didUndo = await store.undoLastTopicRead();

  assert.equal(didUndo, true);
  for (const topic of [listTopic, detailTopic]) {
    assert.equal(topic.readStatus.unreadCount, 2);
    assert.equal(topic.readStatus.isRead, false);
    assert.equal(topic.readStatus.lastReadTime, null);
    assert.deepEqual(
      topic.unreadDiscussions.map((discussion) => discussion.id),
      ['msg-1', 'msg-2'],
    );
    assert.equal(
      topic.recentDataDetails.conversations.some((message) => message.isRead),
      false,
    );
  }

  assert.equal(store.getUnreadTopics().length, 1);
  assert.equal(store.topicReadUndo, null);
  assert.equal(cacheMessages.length, 4);
}

async function verifyDetailOnlyMarkAllRead() {
  const store = createStore();
  const detailTopic = createTopic('topic-detail-only');

  store.entities = [] as any;
  store.topicDetailData = detailTopic as any;

  await store.markTopicAsRead('topic-detail-only');

  assert.equal(detailTopic.readStatus.unreadCount, 0);
  assert.equal(
    detailTopic.recentDataDetails.conversations.every(
      (message) => message.isRead,
    ),
    true,
  );
  assert.equal(cacheMessages.length, 1);
}

async function verifyTopicDetailFallsBackWhenApiReturnsNoData() {
  const store = createStore();

  await store.loadTopicDetail('topic-ai-workflow');

  assert.equal(store.topicDetailData.id, 'topic-ai-workflow');
  assert.ok(
    store.topicDetailData.recentDataDetails.conversations.length > 0,
    'fallback topic detail should include mock conversations',
  );
  assert.equal(
    findTopicConversationByMessageId(store.topicDetailData, 'msg-1')?.id,
    'msg-1',
    'fallback topic detail should support list preview message deep links',
  );
}

async function verifySingleConversationReadSyncsBothSurfaces() {
  const store = createStore();
  const listTopic = createTopic();
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markConversationAsRead('topic-alpha', 'msg-1');

  assert.equal(listTopic.readStatus.unreadCount, 1);
  assert.equal(detailTopic.readStatus.unreadCount, 1);
  assert.equal(listTopic.recentDataDetails.conversations[0].isRead, true);
  assert.equal(detailTopic.recentDataDetails.conversations[0].isRead, true);
  assert.deepEqual(
    listTopic.unreadDiscussions.map((discussion) => discussion.id),
    ['msg-2'],
  );
  assert.equal(store.getUnreadTopics().length, 1);

  await store.markConversationAsRead('topic-alpha', 'msg-2');

  assert.equal(listTopic.readStatus.unreadCount, 0);
  assert.equal(detailTopic.readStatus.unreadCount, 0);
  assert.deepEqual(listTopic.unreadDiscussions, []);
  assert.equal(store.getUnreadTopics().length, 0);
}

async function verifySingleConversationReadSkipsUnmatchedListTopic() {
  const store = createStore();
  const listTopic = {
    ...createTopic(),
    unreadDiscussions: [{ id: 'msg-2', text: 'Second unread discussion' }],
    recentDataDetails: {
      conversations: [
        { id: 'msg-2', isRead: false, summary: 'Second message' },
      ],
    },
  };
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markConversationAsRead('topic-alpha', 'msg-1');

  assert.equal(detailTopic.readStatus.unreadCount, 1);
  assert.equal(detailTopic.recentDataDetails.conversations[0].isRead, true);
  assert.equal(listTopic.readStatus.unreadCount, 2);
  assert.equal(listTopic.recentDataDetails.conversations[0].isRead, false);
  assert.deepEqual(
    listTopic.unreadDiscussions.map((discussion) => discussion.id),
    ['msg-2'],
  );
  assert.equal(cacheMessages.length, 1);
}

async function verifySingleConversationReadSyncsBoundPreviewWithoutConversation() {
  const store = createStore();
  const listTopic = {
    ...createTopic(),
    unreadDiscussions: [
      { id: 'msg-1', text: 'First unread discussion' },
      { id: 'msg-2', text: 'Second unread discussion' },
    ],
    recentDataDetails: {
      conversations: [] as any[],
    },
  };
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markConversationAsRead('topic-alpha', 'msg-1');

  assert.equal(detailTopic.readStatus.unreadCount, 1);
  assert.equal(listTopic.readStatus.unreadCount, 1);
  assert.deepEqual(
    listTopic.unreadDiscussions.map((discussion) => discussion.id),
    ['msg-2'],
  );
  assert.equal(cacheMessages.length, 2);
}

async function verifySingleConversationReadCanUndo() {
  const store = createStore();
  const listTopic = createTopic();
  const detailTopic = createTopic();

  store.entities = [listTopic] as any;
  store.topicDetailData = detailTopic as any;

  await store.markConversationAsRead('topic-alpha', 'msg-1');

  assert.equal(listTopic.readStatus.unreadCount, 1);
  assert.equal(detailTopic.readStatus.unreadCount, 1);
  assert.equal((store.conversationReadUndo as any)?.conversationId, 'msg-1');
  assert.match(
    (store.conversationReadUndo as any)?.conversationLabel,
    /First message/,
  );

  const didUndo = await store.undoLastConversationRead();

  assert.equal(didUndo, true);
  for (const topic of [listTopic, detailTopic]) {
    assert.equal(topic.readStatus.unreadCount, 2);
    assert.equal(topic.readStatus.isRead, false);
    assert.equal(topic.recentDataDetails.conversations[0].isRead, false);
    assert.deepEqual(
      topic.unreadDiscussions.map((discussion) => discussion.id),
      ['msg-1', 'msg-2'],
    );
  }
  assert.equal(store.conversationReadUndo, null);
}

async function verifyConversationReadSyncsContextMessageState() {
  const store = createStore();
  const topic = {
    ...createTopic(),
    readStatus: {
      isRead: false,
      unreadCount: 1,
      lastReadTime: null,
      lastUpdateTime: 1000,
    },
    unreadDiscussions: [{ messageId: 'ctx-msg-1', text: 'Nested unread' }],
    recentDataDetails: {
      conversations: [
        {
          id: 'msg-1',
          isRead: true,
          summary: 'Parent already read',
          contextMessages: [
            { id: 'ctx-msg-1', isRead: false, content: 'Nested unread' },
            {
              id: 'ctx-msg-2',
              isRead: true,
              readTimestamp: 123,
              content: 'Nested read',
            },
          ],
        },
      ],
    },
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;

  await store.markConversationAsRead('topic-alpha', 'ctx-msg-1');

  const [conversation] = topic.recentDataDetails.conversations;
  assert.equal(topic.readStatus.unreadCount, 0);
  assert.equal(conversation.isRead, true);
  assert.equal(conversation.contextMessages[0].isRead, true);
  assert.equal(typeof conversation.contextMessages[0].readTimestamp, 'number');
  assert.equal(conversation.contextMessages[1].readTimestamp, 123);

  const didUndo = await store.undoLastConversationRead();

  assert.equal(didUndo, true);
  assert.equal(topic.readStatus.unreadCount, 1);
  assert.equal(conversation.isRead, true);
  assert.equal(conversation.contextMessages[0].isRead, false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      conversation.contextMessages[0],
      'readTimestamp',
    ),
    false,
  );
  assert.equal(conversation.contextMessages[1].readTimestamp, 123);
}

async function verifyTopicWithoutReadStatusCountsUnreadContextMessages() {
  const store = createStore();
  const topic: any = {
    id: 'topic-context-only',
    name: 'Topic Context Only',
    type: 'Topic',
    recentDataDetails: {
      conversations: [
        {
          id: 'msg-context-only',
          isRead: true,
          summary: 'Parent read with unread context',
          contextMessages: [
            { id: 'ctx-context-only', isRead: false, content: 'Need review' },
          ],
        },
      ],
    },
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;

  await store.markConversationAsRead('topic-context-only', 'ctx-context-only');

  assert.equal(topic.readStatus.unreadCount, 0);
  assert.equal(topic.readStatus.isRead, true);
  assert.equal(
    topic.recentDataDetails.conversations[0].contextMessages[0].isRead,
    true,
  );
  assert.equal(store.getUnreadTopics().length, 0);
}

async function verifySingleConversationReadCountsMultipleBoundPreviews() {
  const store = createStore();
  const topic = {
    ...createTopic(),
    readStatus: {
      isRead: false,
      unreadCount: 3,
      lastReadTime: null,
      lastUpdateTime: 1000,
    },
    unreadDiscussions: [
      { id: 'msg-1', text: 'First unread discussion' },
      { messageId: 'ctx-msg-1', text: 'Nested unread discussion' },
      { id: 'msg-2', text: 'Second unread discussion' },
    ],
    recentDataDetails: {
      conversations: [
        {
          id: 'msg-1',
          isRead: false,
          summary: 'First message',
          contextMessages: [{ id: 'ctx-msg-1', content: 'Nested message' }],
        },
        { id: 'msg-2', isRead: false, summary: 'Second message' },
      ],
    },
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;

  await store.markConversationAsRead('topic-alpha', 'msg-1');

  assert.equal(topic.readStatus.unreadCount, 1);
  assert.deepEqual(
    topic.unreadDiscussions.map((discussion) => discussion.id),
    ['msg-2'],
  );
}

async function verifySingleConversationReadWithoutReadStatusUsesInferredCount() {
  const store = createStore();
  const topic: any = {
    id: 'topic-without-read-status',
    name: 'Topic Without Read Status',
    type: 'Topic',
    unreadDiscussions: [
      { id: 'msg-1', text: 'First unread discussion' },
      { id: 'msg-2', text: 'Second unread discussion' },
    ],
    recentDataDetails: {
      conversations: [
        { id: 'msg-1', isRead: false, summary: 'First message' },
        { id: 'msg-2', isRead: false, summary: 'Second message' },
      ],
    },
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;

  await store.markConversationAsRead('topic-without-read-status', 'msg-1');

  assert.equal(topic.readStatus.unreadCount, 1);
  assert.equal(topic.readStatus.isRead, false);
  assert.deepEqual(
    topic.unreadDiscussions.map((discussion) => discussion.id),
    ['msg-2'],
  );
  assert.equal(store.getUnreadTopics().length, 1);

  await store.markConversationAsRead('topic-without-read-status', 'msg-2');

  assert.equal(topic.readStatus.unreadCount, 0);
  assert.equal(topic.readStatus.isRead, true);
  assert.equal(store.getUnreadTopics().length, 0);
}

async function verifyDeferredTopicLeavesUnreadQueueWithoutReading() {
  const store = createStore();
  const topic = createTopic('topic-deferred');

  store.entities = [topic] as any;

  await store.deferTopicForLater('topic-deferred', Date.now() + 3600000);

  assert.equal(topic.readStatus.unreadCount, 2);
  assert.equal(topic.readStatus.isRead, false);
  assert.equal(store.getUnreadTopics().length, 0);
  assert.equal(store.getDeferredTopics()[0].id, 'topic-deferred');
  assert.equal(
    store.entityTypes.find((item) => item.type === 'Topic')?.count,
    0,
  );

  store.restoreDeferredTopic('topic-deferred');

  assert.equal(store.getUnreadTopics().length, 1);
  assert.equal(store.getDeferredTopics().length, 0);
  assert.equal(
    store.entityTypes.find((item) => item.type === 'Topic')?.count,
    1,
  );
}

async function verifyMutedTopicLeavesUnreadQueueWithoutReading() {
  const store = createStore();
  const topic = createTopic('topic-muted');

  store.entities = [topic] as any;

  await store.muteTopic('topic-muted', Date.now() + 3600000);

  assert.equal(topic.readStatus.unreadCount, 2);
  assert.equal(topic.readStatus.isRead, false);
  assert.equal(store.getUnreadTopics().length, 0);
  assert.equal(store.getMutedTopics()[0].id, 'topic-muted');
  assert.equal(
    store.entityTypes.find((item) => item.type === 'Topic')?.count,
    0,
  );

  store.restoreMutedTopic('topic-muted');

  assert.equal(store.getUnreadTopics().length, 1);
  assert.equal(store.getMutedTopics().length, 0);
  assert.equal(
    store.entityTypes.find((item) => item.type === 'Topic')?.count,
    1,
  );
}

function verifyExpiredMutedTopicReturnsToUnreadQueue() {
  const store = createStore();
  const topic = createTopic('topic-expired-mute');

  store.entities = [topic] as any;
  store.mutedTopics = {
    'topic-expired-mute': {
      until: Date.now() - 1000,
      createdAt: Date.now() - 3600000,
    },
  } as any;

  assert.equal(store.getUnreadTopics().length, 1);
  assert.equal(store.getMutedTopics().length, 0);
}

async function verifyTopLevelConversationReadState() {
  const store = createStore();
  const topic = {
    id: 'topic-top-level',
    name: 'Top Level Topic',
    type: 'Topic',
    readStatus: {
      isRead: false,
      unreadCount: 2,
      lastReadTime: null,
      lastUpdateTime: 1000,
    },
    unreadDiscussions: [
      { messageId: 'ctx-top-1', text: 'Context unread discussion' },
      { conversationId: 'conv-top-2', text: 'Second unread discussion' },
    ],
    conversations: [
      {
        id: 'conv-top-1',
        isRead: false,
        contextMessages: [{ id: 'ctx-top-1', content: 'Nested message' }],
      },
      { id: 'conv-top-2', isRead: false },
    ],
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;

  await store.markConversationAsRead('topic-top-level', 'ctx-top-1');

  assert.equal(topic.conversations[0].isRead, true);
  assert.equal(topic.readStatus.unreadCount, 1);
  assert.deepEqual(
    topic.unreadDiscussions.map((discussion) => discussion.conversationId),
    ['conv-top-2'],
  );

  await store.markTopicAsRead('topic-top-level');

  assert.equal(
    topic.conversations.every((conversation) => conversation.isRead),
    true,
  );
  assert.equal(topic.readStatus.unreadCount, 0);
}

function verifyTopicDetailLegacyDataFallback() {
  const legacyTopic = {
    id: 'legacy-topic',
    relatedData: {
      conversations: [
        {
          id: 'legacy-conv',
          summary: 'Legacy conversation',
          contextMessages: [{ id: 'legacy-context', content: 'Context' }],
        },
      ],
      relatedProjects: [{ id: 'project-1', name: 'Project' }],
      relatedResources: [{ id: 'resource-1', name: 'Resource' }],
      relatedTickets: [{ id: 'ticket-1', title: 'Ticket' }],
      webpages: [{ id: 'web-1', title: 'Webpage' }],
    },
  };

  const recentData = getTopicDetailRecentData(legacyTopic);

  assert.equal(recentData.conversations[0].id, 'legacy-conv');
  assert.equal(recentData.projects[0].id, 'project-1');
  assert.equal(recentData.resources[0].id, 'resource-1');
  assert.equal(recentData.jiraTickets[0].id, 'ticket-1');
  assert.equal(recentData.webpages[0].id, 'web-1');
  assert.equal(
    findTopicConversationByMessageId(legacyTopic, 'legacy-context')?.id,
    'legacy-conv',
  );
}

function verifyTopicDetailUnreadCountFallsBackToKnownMessages() {
  const topic = {
    id: 'topic-missing-read-status',
    unreadDiscussions: [{ messageId: 'preview-only', text: 'Preview' }],
    recentDataDetails: {
      conversations: [
        {
          messageId: 'message-only-id',
          isRead: true,
          summary: 'Parent is read',
          contextMessages: [
            {
              conversationId: 'ctx-only-id',
              isRead: false,
              content: 'Nested',
            },
          ],
        },
        {
          conversationId: 'conversation-only-id',
          isRead: false,
          summary: 'No id field here',
        },
      ],
    },
  };

  assert.equal(getTopicDetailUnreadCount(topic), 2);
  assert.equal(
    getTopicConversationPrimaryId(topic.recentDataDetails.conversations[0]),
    'message-only-id',
  );
  assert.equal(
    getTopicConversationPrimaryId(topic.recentDataDetails.conversations[1]),
    'conversation-only-id',
  );
  assert.equal(
    getTopicConversationPrimaryId(
      findTopicConversationByMessageId(topic, 'ctx-only-id'),
    ),
    'message-only-id',
  );
}

function verifyTopicDetailHighlightEscapesHtml() {
  const rendered = renderHighlightedText(
    '<img src=x onerror=alert(1)> AI & data',
    'AI',
  );

  assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(rendered, /<mark[^>]*>AI<\/mark>/);
  assert.ok(
    !rendered.includes('<img'),
    'highlighted message content should not include raw HTML tags',
  );
  assert.match(renderHighlightedText('100% done', '%'), /<mark[^>]*>%<\/mark>/);
}

function verifyTopicConversationSearchCoversContextAndSource() {
  const conversation = {
    id: 'conv-source-context',
    summary: 'Roadmap update',
    sender: 'Ada',
    groupName: 'Product Sync',
    sourceUrl: 'https://example.com/messages/thread-123',
    contextMessages: [
      {
        sender: 'Ben',
        content: 'Budget risk should be reviewed before launch.',
      },
    ],
  };

  assert.equal(topicConversationMatchesQuery(conversation, 'roadmap'), true);
  assert.equal(topicConversationMatchesQuery(conversation, 'Product Sync'), true);
  assert.equal(topicConversationMatchesQuery(conversation, 'thread-123'), true);
  assert.equal(topicConversationMatchesQuery(conversation, 'budget risk'), true);
  assert.equal(topicConversationHasContextMatch(conversation, 'budget'), true);
  assert.equal(topicConversationHasContextMatch(conversation, 'thread-123'), false);
  assert.equal(topicConversationMatchesQuery(conversation, 'unrelated'), false);
}

function verifyTopicConversationReadTriageIncludesContextMessages() {
  const conversations = [
    {
      id: 'conv-read',
      isRead: true,
      summary: 'Already read',
      contextMessages: [{ id: 'ctx-read', isRead: true }],
    },
    {
      id: 'conv-context-unread',
      isRead: true,
      summary: 'Parent read but nested unread',
      contextMessages: [{ id: 'ctx-unread', isRead: false }],
    },
    {
      id: 'conv-parent-unread',
      isRead: false,
      summary: 'Parent unread',
      contextMessages: [{ id: 'ctx-parent', isRead: true }],
    },
    {
      id: 'conv-unknown',
      summary: 'Legacy conversation without read fields',
      contextMessages: [{ id: 'ctx-unknown', content: 'Legacy context' }],
    },
  ];

  assert.equal(isTopicConversationUnread(conversations[0]), false);
  assert.equal(isTopicConversationUnread(conversations[1]), true);
  assert.equal(isTopicConversationUnread(conversations[2]), true);
  assert.equal(isTopicConversationUnread(conversations[3]), false);
  assert.equal(getTopicConversationUnreadMessageCount(conversations[1]), 1);
  assert.equal(getTopicConversationUnreadMessageCount(conversations[2]), 1);
  assert.equal(getTopicConversationUnreadMessageCount(conversations[3]), 0);
  assert.equal(
    isTopicMessageExplicitlyUnread(conversations[3].contextMessages[0]),
    false,
  );
  assert.equal(getTopicConversationUnreadCount(conversations), 2);
  assert.deepEqual(
    filterTopicConversationsByReadState(conversations, 'unread').map(
      (conversation) => conversation.id,
    ),
    ['conv-context-unread', 'conv-parent-unread'],
  );
  assert.deepEqual(
    filterTopicConversationsByReadState(conversations, 'read').map(
      (conversation) => conversation.id,
    ),
    ['conv-read', 'conv-unknown'],
  );
  assert.deepEqual(
    sortTopicConversationsForTriage(conversations).map(
      (conversation) => conversation.id,
    ),
    ['conv-context-unread', 'conv-parent-unread', 'conv-read', 'conv-unknown'],
  );
}

async function verifyUnknownConversationReadStateStaysNeutral() {
  const store = createStore();
  const topic = {
    id: 'topic-legacy-neutral',
    name: 'Legacy Neutral',
    type: 'Topic',
    recentDataDetails: {
      conversations: [
        {
          id: 'legacy-neutral-conv',
          summary: 'No explicit read state should stay neutral',
          contextMessages: [{ id: 'legacy-neutral-context', content: 'Context' }],
        },
      ],
    },
  };

  store.entities = [topic] as any;
  store.topicDetailData = topic as any;
  store.updateTopicUnreadCount();

  assert.equal(getTopicDetailUnreadCount(topic), 0);
  assert.equal(store.getUnreadTopics().length, 0);

  const didMarkRead = await store.markConversationAsRead(
    'topic-legacy-neutral',
    'legacy-neutral-conv',
  );

  assert.equal(didMarkRead, false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      topic.recentDataDetails.conversations[0],
      'isRead',
    ),
    false,
  );
  assert.equal(cacheMessages.length, 0);
}

function verifyTopicDeferPresetOptions() {
  const fridayMorning = new Date(2026, 4, 1, 10, 15, 0, 0).getTime();
  const options = getTopicDeferPresetOptions(fridayMorning);
  const optionByKey = new Map(options.map((option) => [option.key, option]));

  assert.equal(
    optionByKey.get('one-hour')?.until,
    fridayMorning + 60 * 60 * 1000,
  );
  assert.equal(optionByKey.get('this-evening')?.label, '今天晚些时候');
  assert.equal(
    optionByKey.get('this-evening')?.until,
    new Date(2026, 4, 1, 18, 0, 0, 0).getTime(),
  );
  assert.equal(
    optionByKey.get('tomorrow-morning')?.until,
    new Date(2026, 4, 2, 9, 0, 0, 0).getTime(),
  );
  assert.equal(
    optionByKey.get('next-monday')?.until,
    new Date(2026, 4, 4, 9, 0, 0, 0).getTime(),
  );

  const fridayNight = new Date(2026, 4, 1, 19, 0, 0, 0).getTime();
  const fallbackOption = getTopicDeferPresetOptions(fridayNight).find(
    (option) => option.key === 'this-evening',
  );

  assert.equal(fallbackOption?.label, '明天上午');
  assert.equal(
    fallbackOption?.until,
    new Date(2026, 4, 2, 9, 0, 0, 0).getTime(),
  );
}

function verifyTopicMutePresetOptions() {
  const now = new Date(2026, 4, 1, 10, 15, 0, 0).getTime();
  const options = getTopicMutePresetOptions(now);
  const optionByKey = new Map(options.map((option) => [option.key, option]));

  assert.equal(optionByKey.get('one-day')?.until, now + 24 * 60 * 60 * 1000);
  assert.equal(
    optionByKey.get('one-week')?.until,
    now + 7 * 24 * 60 * 60 * 1000,
  );
  assert.equal(optionByKey.get('indefinite')?.until, null);
}

function verifyTopicDetailHasNoDeadMutationControls() {
  const source = readFileSync(
    new URL('../src/modals/components/TopicDetailPage.vue', import.meta.url),
    'utf8',
  );

  assert.equal(source.includes('编辑主题'), false);
  assert.equal(source.includes('添加关联'), false);
  assert.equal(source.includes('+ 添加项目'), false);
  assert.equal(source.includes('+ 添加资源'), false);
  assert.equal(source.includes('+ 添加Ticket'), false);
  assert.equal(source.includes('class="item-action"'), false);
}

function verifyTopicDetailUsesSafeTraceableLinks() {
  const source = readFileSync(
    new URL('../src/modals/components/TopicDetailPage.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /getSafeExternalUrl/);
  assert.match(source, /class="webpage-open-link"/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noreferrer"/);
}

function verifyTopicListResourcePreviewUsesSafeLinks() {
  const source = readFileSync(
    new URL('../src/modals/components/EntityListPage.vue', import.meta.url),
    'utf8',
  );

  assert.equal(
    getSafeExternalUrl('https://example.com/resource?x=1'),
    'https://example.com/resource?x=1',
  );
  assert.equal(
    getSafeExternalUrl('http://example.com/guide'),
    'http://example.com/guide',
  );
  assert.equal(getSafeExternalUrl('javascript:alert(1)'), '');
  assert.equal(getSafeExternalUrl('file:///tmp/secret'), '');
  assert.equal(getSafeExternalUrl('#'), '');
  assert.match(source, /handleResourcePreviewClick/);
  assert.match(source, /handleUnreadDiscussionClick/);
  assert.match(source, /navigateToTopicDiscussion/);
  assert.match(source, /getTopicUnreadPreviewMeta/);
  assert.match(source, /getUnreadDiscussionMessageId/);
  assert.match(source, /noopener,noreferrer/);
  assert.match(source, /查看主题详情中的资源上下文/);
  assert.match(
    source,
    /getSafeExternalUrl\(resource\.url\) \? '打开' : '详情'/,
  );
}

function verifyTopicDetailTimeFallbacks() {
  const now = new Date(2026, 4, 1, 12, 0, 0, 0).getTime();

  assert.equal(formatTopicRelativeTime(undefined, now), '');
  assert.equal(formatTopicRelativeTime('not-a-date', now), '');
  assert.equal(formatTopicRelativeTime(0, now), '');
  assert.equal(formatTopicRelativeTime(now + 1000, now), '刚刚');
  assert.equal(formatTopicRelativeTime(now + 2 * 60 * 1000, now), '');
  assert.equal(formatTopicRelativeTime(now - 30 * 60 * 1000, now), '刚刚');
  assert.equal(
    formatTopicRelativeTime(now - 2 * 60 * 60 * 1000, now),
    '2小时前',
  );
  assert.equal(
    formatTopicRelativeTime(now - 2 * 24 * 60 * 60 * 1000, now),
    '2天前',
  );
  assert.equal(
    normalizeTopicTimestamp(Math.floor((now - 3600000) / 1000)),
    now - 3600000,
  );
  assert.equal(
    formatTopicRelativeTime(Math.floor((now - 3600000) / 1000), now),
    '1小时前',
  );
}

function verifyTopicTriagePrioritySort() {
  const now = new Date(2026, 4, 1, 12, 0, 0, 0).getTime();
  const topics = [
    {
      id: 'stale-low',
      readStatus: { unreadCount: 1, lastUpdateTime: now - 20 * 86400000 },
      importance: 0.3,
      statistic: { conversations: 2 },
    },
    {
      id: 'recent-low',
      readStatus: { unreadCount: 1, lastUpdateTime: now - 10 * 60000 },
      importance: 0.4,
      statistic: { conversations: 4 },
    },
    {
      id: 'bulk-unread',
      readStatus: { unreadCount: 12, lastUpdateTime: now - 10 * 86400000 },
      importance: 0.3,
      statistic: { conversations: 18 },
    },
    {
      id: 'urgent',
      readStatus: { unreadCount: 5, lastUpdateTime: now - 30 * 60000 },
      importance: 0.9,
      statistic: { conversations: 30 },
    },
  ];

  assert.deepEqual(
    sortTopicsForTriage(topics, now).map((topic) => topic.id),
    ['urgent', 'bulk-unread', 'recent-low', 'stale-low'],
  );
  assert.equal(getTopicTriagePriority(topics[3], now).label, '优先处理');
  assert.equal(getTopicTriagePriority(topics[2], now).label, '多条未读');
  assert.equal(getTopicTriagePriority(topics[1], now).label, '近期更新');
  assert.match(
    getTopicTriagePriority(topics[3], now).reasons.join('、'),
    /未读较多/,
  );

  const driftedTopic = {
    id: 'preview-drift',
    readStatus: { unreadCount: 0, lastUpdateTime: now - 60_000 },
    unreadDiscussions: [{ messageId: 'drift-msg', text: 'Preview says unread' }],
    importance: 0.4,
    statistic: { conversations: 1 },
  };
  assert.equal(getTopicTriagePriority(driftedTopic, now).unreadCount, 1);
}

function verifyTopicUnreadPreviewHelpers() {
  const topic = {
    readStatus: { unreadCount: 7 },
    unreadDiscussions: [
      { id: 'preview-id', messageId: 'msg-1', text: 'Direct message' },
      { conversationId: 'conv-2', summary: 'Conversation fallback' },
      { sourceMessageId: 'src-3', content: 'Source fallback' },
      { title: 'Untitled source' },
    ],
  };

  assert.equal(getTopicUnreadPreviewCount(topic), 4);
  assert.equal(getTopicUnreadTotalCount(topic), 7);
  assert.equal(getTopicUnreadPreviewMeta(topic), '(4/7条预览)');
  assert.equal(getTopicUnreadRemainingCount(topic, 3), 4);
  assert.equal(
    getUnreadDiscussionMessageId(topic.unreadDiscussions[0]),
    'msg-1',
  );
  assert.equal(
    getUnreadDiscussionMessageId(topic.unreadDiscussions[1]),
    'conv-2',
  );
  assert.equal(
    getUnreadDiscussionText(topic.unreadDiscussions[1]),
    'Conversation fallback',
  );
  assert.equal(
    getUnreadDiscussionKey(topic.unreadDiscussions[3], 3),
    'Untitled source:3',
  );
  assert.equal(getUnreadDiscussionText({}), '未读讨论');
  assert.equal(getTopicUnreadPreviewMeta({ unreadDiscussions: [] }), '');
  assert.equal(
    getTopicUnreadTotalCount({
      readStatus: { unreadCount: 0 },
      unreadDiscussions: [{ id: 'preview-only' }],
    }),
    1,
  );

  const legacyConversationTopic = {
    recentDataDetails: {
      conversations: [
        { id: 'read-conv', isRead: true },
        { id: 'unread-parent', isRead: false },
        {
          id: 'unread-context',
          isRead: true,
          contextMessages: [{ id: 'ctx-unread', isRead: false }],
        },
        { id: 'unknown-read-state' },
      ],
    },
  };
  assert.equal(getTopicUnreadConversationCount(legacyConversationTopic), 2);
  assert.equal(getTopicUnreadTotalCount(legacyConversationTopic), 2);
  assert.equal(
    getTopicUnreadTotalCount({
      readStatus: { unreadCount: 0 },
      recentDataDetails: legacyConversationTopic.recentDataDetails,
    }),
    2,
  );
}

function verifyTopicUnreadSignalsSurviveReadStatusDrift() {
  const store = createStore();
  const topic = {
    id: 'topic-preview-drift',
    name: 'Preview Drift',
    type: 'Topic',
    readStatus: {
      isRead: true,
      unreadCount: 0,
      lastReadTime: 100,
      lastUpdateTime: 200,
    },
    unreadDiscussions: [
      { messageId: 'preview-drift-msg', text: 'Backend preview is newer' },
    ],
  };

  store.entities = [topic] as any;
  store.updateTopicUnreadCount();

  assert.equal(store.getUnreadTopics().length, 1);
  assert.equal(
    store.entityTypes.find((item) => item.type === 'Topic')?.count,
    1,
  );
}

function verifyTopicMuteUiIsReachable() {
  const overviewSource = readFileSync(
    new URL('../src/modals/components/OverviewPage.vue', import.meta.url),
    'utf8',
  );
  const listSource = readFileSync(
    new URL('../src/modals/components/EntityListPage.vue', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(overviewSource, /handleMuteTopic/);
  assert.doesNotMatch(overviewSource, /topic-action-btn/);
  assert.match(overviewSource, /未读主题入口/);
  assert.match(overviewSource, /\/entity\/Topic/);
  assert.match(listSource, /topicViewMode === 'muted'/);
  assert.match(listSource, /handleMuteTopic/);
  assert.match(listSource, /🔕 静音/);
  assert.match(listSource, /取消静音/);
}

function verifyTopicDetailUnreadTriageUiIsReachable() {
  const source = readFileSync(
    new URL('../src/modals/components/TopicDetailPage.vue', import.meta.url),
    'utf8',
  );
  const listSource = readFileSync(
    new URL('../src/modals/components/EntityListPage.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /conversationUnreadCount/);
  assert.match(source, /convReadFilter/);
  assert.match(source, /getTopicDetailUnreadCount/);
  assert.match(source, /getConversationRenderId/);
  assert.match(source, /getTopicConversationPrimaryId/);
  assert.match(
    source,
    /store\.markConversationAsRead\(topicId\.value, messageId\)/,
  );
  assert.match(source, /getConversationContextLabel/);
  assert.match(source, /仅未读/);
  assert.match(source, /normalizeReadFilterValue/);
  assert.match(source, /route\.query\.readFilter/);
  assert.match(source, /convReadFilter\.value = 'all'/);
  assert.match(source, /isConversationUnread\(conv\)/);
  assert.match(source, /isContextMessageUnread\(contextMsg\)/);
  assert.match(source, /isTopicMessageExplicitlyUnread\(contextMessage\)/);
  assert.match(listSource, /优先处理排序/);
  assert.match(listSource, /sortTopicsForTriage/);
  assert.match(listSource, /topic-priority-pill/);
  assert.match(listSource, /getTopicDisplayTime/);
  assert.match(listSource, /navigateToTopicUnread/);
  assert.match(listSource, /readFilter: 'unread'/);
  assert.match(listSource, /getTopicUnreadTotalCount\(entity\)/);
}

async function main() {
  await verifyWholeTopicReadSyncsListAndDetail();
  await verifyWholeTopicReadCanUndo();
  await verifyDetailOnlyMarkAllRead();
  await verifyTopicDetailFallsBackWhenApiReturnsNoData();
  await verifySingleConversationReadSyncsBothSurfaces();
  await verifySingleConversationReadSkipsUnmatchedListTopic();
  await verifySingleConversationReadSyncsBoundPreviewWithoutConversation();
  await verifySingleConversationReadCanUndo();
  await verifyConversationReadSyncsContextMessageState();
  await verifyTopicWithoutReadStatusCountsUnreadContextMessages();
  await verifySingleConversationReadCountsMultipleBoundPreviews();
  await verifySingleConversationReadWithoutReadStatusUsesInferredCount();
  await verifyDeferredTopicLeavesUnreadQueueWithoutReading();
  await verifyMutedTopicLeavesUnreadQueueWithoutReading();
  verifyExpiredMutedTopicReturnsToUnreadQueue();
  await verifyTopLevelConversationReadState();
  verifyTopicDetailLegacyDataFallback();
  verifyTopicDetailUnreadCountFallsBackToKnownMessages();
  verifyTopicDetailHighlightEscapesHtml();
  verifyTopicConversationSearchCoversContextAndSource();
  verifyTopicConversationReadTriageIncludesContextMessages();
  await verifyUnknownConversationReadStateStaysNeutral();
  verifyTopicDeferPresetOptions();
  verifyTopicMutePresetOptions();
  verifyTopicDetailHasNoDeadMutationControls();
  verifyTopicDetailUsesSafeTraceableLinks();
  verifyTopicListResourcePreviewUsesSafeLinks();
  verifyTopicDetailTimeFallbacks();
  verifyTopicTriagePrioritySort();
  verifyTopicUnreadPreviewHelpers();
  verifyTopicUnreadSignalsSurviveReadStatusDrift();
  verifyTopicMuteUiIsReachable();
  verifyTopicDetailUnreadTriageUiIsReachable();

  console.log('verify-topic-based-messages: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
