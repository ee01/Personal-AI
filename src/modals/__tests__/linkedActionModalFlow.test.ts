import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPendingLinkedActionConfig } from '../../message-reaction/linkedActionEntry.js';
import {
  buildLinkedActionDraftPrefill,
  isPendingLinkedActionConfigFresh,
  shouldAutoRequestLinkedActionSuggestion,
} from '../linkedActionHelpers.js';

test('pending linked-action payload hydrates modal prefill state', () => {
  const pending = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupId: 'release-chat',
    groupName: 'Release Chat',
    content: '请帮我跟进这个 Jira ticket',
    messageId: 'msg-1',
  });

  assert.equal(isPendingLinkedActionConfigFresh(pending), true);
  const prefill = buildLinkedActionDraftPrefill(pending);
  assert.match(prefill.topicText, /发送了内容与以下语义相似/);
  assert.equal(prefill.filterSender, 'Alice');
  assert.equal(prefill.filterGroup, 'Release Chat');
  assert.equal(prefill.autoReply, false);
  assert.equal(prefill.followThread, false);
});

test('auto suggestion gate opens for linked-action draft even before OpenClaw is connected', () => {
  assert.equal(
    shouldAutoRequestLinkedActionSuggestion({
      showAddForm: true,
      newRuleSource: 'linkedAction',
      linkedActionSuggestionStatus: 'idle',
      newAutomationPrompt: '',
    }),
    true,
  );

  assert.equal(
    shouldAutoRequestLinkedActionSuggestion({
      showAddForm: true,
      newRuleSource: 'linkedAction',
      linkedActionSuggestionStatus: 'idle',
      newAutomationPrompt: '已有建议文本',
    }),
    false,
  );
});
