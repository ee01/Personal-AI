import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  getMessageReactionActionDefinitions,
} from '../messageReactionLayout.js';
import { buildPendingLinkedActionConfig } from '../linkedActionEntry.js';

test('toolbar keeps linked action in the fourth functional slot', () => {
  const actions = getMessageReactionActionDefinitions({
    enableSnooze: true,
    enableFollowThread: true,
    enableAutoReply: true,
    enableLinkedAction: true,
  });

  assert.deepEqual(
    actions.map((action) => action.key),
    ['snooze', 'followThread', 'autoReply', 'linkedAction'],
  );
  assert.equal(actions[3]?.label, '联动操作');
  assert.deepEqual(
    actions.map((action) => action.compactLabel),
    ['稍后', '关注', '答复', '联动'],
  );
  assert.deepEqual(
    actions.map((action) => action.compactAlign || 'start'),
    ['start', 'start', 'end', 'start'],
  );
  assert.equal(
    actions[3]?.runtimeMessageType,
    LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  );
});

test('toolbar replaces auto-reply with follow-up ask on own messages', () => {
  const actions = getMessageReactionActionDefinitions(
    {
      enableSnooze: true,
      enableFollowThread: true,
      enableAutoReply: true,
      enableLinkedAction: true,
    },
    { isOwnMessage: true },
  );

  assert.deepEqual(
    actions.map((action) => action.key),
    ['snooze', 'followThread', 'followupAsk', 'linkedAction'],
  );
  assert.equal(actions[2]?.label, '跟进追问');
  assert.equal(actions[2]?.compactLabel, '跟进');
});

test('toolbar respects linked-action toggle filtering', () => {
  const actions = getMessageReactionActionDefinitions({
    enableSnooze: false,
    enableFollowThread: true,
    enableAutoReply: false,
    enableLinkedAction: true,
  });

  assert.deepEqual(
    actions.map((action) => action.key),
    ['followThread', 'linkedAction'],
  );
});

test('linked action pending config freshness uses request time, not message time', () => {
  const messageTimestamp = Date.parse('2026-05-15T09:30:00Z');
  const requestedAt = Date.parse('2026-05-24T09:30:00Z');

  const pendingConfig = buildPendingLinkedActionConfig(
    {
      sender: 'Alicia Chen',
      groupName: 'Release Room',
      content: 'Please follow up with the release owner before tomorrow noon.',
      messageId: 'msg-1',
      timestamp: messageTimestamp,
      messageLink: 'https://app.ringcentral.com/messages/12345/msg-1',
    },
    requestedAt,
  );

  assert.equal(pendingConfig.timestamp, requestedAt);
  assert.equal(pendingConfig.messageTimestamp, messageTimestamp);
});
