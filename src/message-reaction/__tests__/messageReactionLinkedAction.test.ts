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
  assert.equal(
    actions[3]?.runtimeMessageType,
    LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  );
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
