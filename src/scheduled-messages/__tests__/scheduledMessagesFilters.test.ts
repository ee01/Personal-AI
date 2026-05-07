import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  buildScheduledMessagesReviewUrl,
  filterScheduledMessagesForView,
  getScheduledMessageCategories,
  hasScheduledMessagesViewFilters,
  isSelfOnlyScheduledMessage,
  parseScheduledMessagesQueryFilters,
} from '../scheduledMessagesFilters.js';

const makeMessage = (overrides: Partial<ScheduledMessage>): ScheduledMessage => ({
  ID: overrides.ID || `msg_${Math.random()}`,
  Topic: overrides.Topic || 'Topic',
  Content: overrides.Content || 'Content',
  Push_Method: overrides.Push_Method || 'Bot',
  Target_Type: overrides.Target_Type || 'private',
  Status: overrides.Status || 'Active',
  ...overrides,
});

test('scheduled messages query parser extracts a single category filter', () => {
  assert.deepEqual(
    parseScheduledMessagesQueryFilters('?category=Snooze'),
    {
      categories: ['Snooze'],
      filterPendingReview: false,
      filterSelfOnly: false,
    },
  );
});

test('scheduled messages query parser supports repeated and comma-separated categories', () => {
  assert.deepEqual(
    parseScheduledMessagesQueryFilters('?category=Snooze&categories=%E6%8F%90%E9%86%92,AutoReply&filterPendingReview=true&filterSelfOnly=1&messageId=reply_123'),
    {
      categories: ['Snooze', '提醒', 'AutoReply'],
      filterPendingReview: true,
      filterSelfOnly: true,
      targetMessageId: 'reply_123',
    },
  );
});

test('scheduled messages review URL preserves message id as a single query string', () => {
  assert.equal(
    buildScheduledMessagesReviewUrl('auto reply/123'),
    'scheduled-messages.html?filterPendingReview=true&messageId=auto+reply%2F123',
  );
});

test('scheduled message category parsing trims empty values', () => {
  assert.deepEqual(getScheduledMessageCategories(' Snooze, , AutoReply ,提醒 '), [
    'Snooze',
    'AutoReply',
    '提醒',
  ]);
});

test('scheduled messages self-only filter matches only the current single recipient', () => {
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'esone.qiu' }), 'Esone.Qiu'),
    true,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'esone.qiu+john.doe' }), 'esone.qiu'),
    false,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'john.doe' }), 'esone.qiu'),
    false,
  );
});

test('scheduled messages view filter composes pending review, self-only, and categories', () => {
  const messages = [
    makeMessage({ ID: 'pending-snooze', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-self', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'esone.qiu' }),
    makeMessage({ ID: 'active-snooze', Status: 'Active', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-other-category', Status: 'PendingReview', Category: 'AutoReply', Glip_User_Name: 'john.doe' }),
  ];

  const filtered = filterScheduledMessagesForView(messages, {
    selectedCategories: ['snooze'],
    filterPendingReview: true,
    filterSelfOnly: true,
    currentUsername: 'esone.qiu',
  });

  assert.deepEqual(filtered.map((message) => message.ID), ['pending-snooze']);
});

test('scheduled messages view filter reports whether recovery UI is needed', () => {
  assert.equal(
    hasScheduledMessagesViewFilters({
      selectedCategories: [],
      filterPendingReview: false,
      filterSelfOnly: false,
    }),
    false,
  );
  assert.equal(
    hasScheduledMessagesViewFilters({
      selectedCategories: ['Snooze'],
      filterPendingReview: false,
      filterSelfOnly: false,
    }),
    true,
  );
});
