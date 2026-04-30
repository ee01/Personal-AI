import assert from 'node:assert/strict';

import { createPinia, setActivePinia } from 'pinia';

import { chromeAPI, useMemoryStore } from '../src/modals/memory-store.ts';

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

async function verifyDetailOnlyMarkAllRead() {
  const store = createStore();
  const detailTopic = createTopic('topic-detail-only');

  store.entities = [] as any;
  store.topicDetailData = detailTopic as any;

  await store.markTopicAsRead('topic-detail-only');

  assert.equal(detailTopic.readStatus.unreadCount, 0);
  assert.equal(
    detailTopic.recentDataDetails.conversations.every((message) => message.isRead),
    true,
  );
  assert.equal(cacheMessages.length, 1);
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

async function main() {
  await verifyWholeTopicReadSyncsListAndDetail();
  await verifyDetailOnlyMarkAllRead();
  await verifySingleConversationReadSyncsBothSurfaces();

  console.log('verify-topic-based-messages: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
