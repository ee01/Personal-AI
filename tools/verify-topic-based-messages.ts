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
  findTopicConversationByMessageId,
  getTopicDetailRecentData,
  topicConversationHasContextMatch,
  topicConversationMatchesQuery,
} from '../src/modals/topic-detail-data.ts';
import { renderHighlightedText } from '../src/modals/topic-detail-rendering.ts';

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

function verifyTopicMuteUiIsReachable() {
  const overviewSource = readFileSync(
    new URL('../src/modals/components/OverviewPage.vue', import.meta.url),
    'utf8',
  );
  const listSource = readFileSync(
    new URL('../src/modals/components/EntityListPage.vue', import.meta.url),
    'utf8',
  );

  assert.match(overviewSource, /handleMuteTopic/);
  assert.match(overviewSource, /🔕 静音/);
  assert.match(listSource, /topicViewMode === 'muted'/);
  assert.match(listSource, /取消静音/);
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
  await verifySingleConversationReadCountsMultipleBoundPreviews();
  await verifySingleConversationReadWithoutReadStatusUsesInferredCount();
  await verifyDeferredTopicLeavesUnreadQueueWithoutReading();
  await verifyMutedTopicLeavesUnreadQueueWithoutReading();
  verifyExpiredMutedTopicReturnsToUnreadQueue();
  await verifyTopLevelConversationReadState();
  verifyTopicDetailLegacyDataFallback();
  verifyTopicDetailHighlightEscapesHtml();
  verifyTopicConversationSearchCoversContextAndSource();
  verifyTopicDeferPresetOptions();
  verifyTopicMutePresetOptions();
  verifyTopicDetailHasNoDeadMutationControls();
  verifyTopicMuteUiIsReachable();

  console.log('verify-topic-based-messages: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
