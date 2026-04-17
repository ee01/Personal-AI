import assert from 'node:assert/strict';

import {
  LINKED_ACTION_SAMPLE_CATALOG,
  buildLinkedActionDraftPrefill,
  generateLinkedActionSuggestion,
  isPendingLinkedActionConfigFresh,
} from '../src/modals/linkedActionHelpers.js';
import { buildPendingLinkedActionConfig } from '../src/message-reaction/linkedActionEntry.js';
import { detectAutomationActionFamily } from '../memory-service/src/core/actions/detectAutomationActionFamily.js';

async function main() {
  assert.equal(
    LINKED_ACTION_SAMPLE_CATALOG.length,
    5,
    'should ship five linked-action guardrail samples',
  );
  assert.deepEqual(
    LINKED_ACTION_SAMPLE_CATALOG.map(
      (item: { sampleId: string }) => item.sampleId,
    ),
    [
      'forward-message',
      'jira-comment',
      'spreadsheet-write',
      'glip-status',
      'schedule-reminder',
    ],
  );
  for (const sample of LINKED_ACTION_SAMPLE_CATALOG) {
    assert.equal(
      detectAutomationActionFamily(sample.examplePrompt),
      sample.actionFamily,
      `sample ${sample.sampleId} should align with backend action-family detection`,
    );
  }

  const pendingConfig = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupId: 'release-chat',
    groupName: 'Release Chat',
    content: '请明天下午帮我同步 Jira ticket 进展',
    messageId: 'msg-1',
    messageLink:
      'https://app.ringcentral.com/messages/release-chat?messageId=msg-1',
  });
  assert.equal(pendingConfig.sender, 'Alice');
  assert.equal(pendingConfig.groupId, 'release-chat');
  assert.equal(pendingConfig.messageId, 'msg-1');
  assert.ok(typeof pendingConfig.timestamp === 'number');
  assert.equal(isPendingLinkedActionConfigFresh(pendingConfig), true);
  assert.equal(
    isPendingLinkedActionConfigFresh({
      ...pendingConfig,
      timestamp: Date.now() - 10 * 60 * 1000,
    }),
    false,
  );

  const prefill = buildLinkedActionDraftPrefill({
    sender: 'Alice',
    groupName: 'Release Chat',
    content: '请明天下午帮我同步 Jira ticket 进展',
  });
  assert.match(prefill.topicText, /发送了内容与以下语义相似/);
  assert.equal(prefill.filterSender, 'Alice');
  assert.equal(prefill.filterGroup, 'Release Chat');
  assert.equal(prefill.notifyMethod, '');
  assert.equal(prefill.autoReply, false);
  assert.equal(prefill.followThread, false);
  assert.equal(prefill.digestEnabled, false);

  const historySuggestion = await generateLinkedActionSuggestion({
    context: {
      sender: 'Alice',
      groupName: 'Release Chat',
      content: '请给 RCV-123 补一条 comment',
    },
    configSignals: {
      openClawEnabled: true,
      jiraConfigured: true,
      memoryServiceAvailable: true,
    },
    historyTopics: [
      {
        text: '历史 Jira 规则',
        automationPrompt: '识别 Jira ticket 后补充 comment，并附上原消息链接。',
      },
    ],
  });
  assert.equal(historySuggestion.sourceType, 'history');
  assert.match(historySuggestion.prompt, /历史 Jira 规则|识别 Jira ticket/);
  assert.match(historySuggestion.prompt, /OpenClaw=enabled/);
  assert.match(historySuggestion.prompt, /Jira=configured/);

  const sampleSuggestion = await generateLinkedActionSuggestion({
    context: {
      sender: 'Bob',
      groupName: 'Ops Chat',
      content: '请把这个 Jira ticket 的最新进展同步一下',
    },
    configSignals: {
      openClawEnabled: true,
      jiraConfigured: true,
      memoryServiceAvailable: true,
    },
    historyTopics: [],
  });
  assert.equal(sampleSuggestion.sourceType, 'sample');
  assert.equal(sampleSuggestion.sampleId, 'jira-comment');
  assert.match(sampleSuggestion.sourceLabel, /Jira/);

  console.log('verify-linked-action-flow: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
