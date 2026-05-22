import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  getMessageReactionActionDefinitions,
} from '../messageReactionLayout.js';

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
