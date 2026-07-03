import assert from 'node:assert/strict';

import {
  LINKED_ACTION_SAMPLE_CATALOG,
  buildLinkedActionExecutionPreview,
  buildHistoryLinkedActionSuggestion,
  buildLinkedActionDraftPrefill,
  buildLinkedActionPreviewReceipt,
  buildSampleLinkedActionSuggestion,
  isPendingLinkedActionConfigFresh,
  selectLinkedActionSampleForMessage,
} from '../src/modals/linkedActionHelpers.js';
import { buildPendingLinkedActionConfig } from '../src/message-reaction/linkedActionEntry.js';
import { detectAutomationActionFamily } from '../memory-service/src/core/actions/detectAutomationActionFamily.js';

async function main() {
  assert.equal(
    LINKED_ACTION_SAMPLE_CATALOG.length,
    7,
    'should ship seven linked-action guardrail samples',
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
      'openclaw-general-delegation',
      'openclaw-file-delegation',
    ],
  );
  for (const sample of LINKED_ACTION_SAMPLE_CATALOG) {
    const detectedFamily = detectAutomationActionFamily(sample.examplePrompt);
    if (sample.actionFamily === 'openclaw_delegation') {
      assert.equal(
        detectedFamily,
        'unknown',
        `sample ${sample.sampleId} should use backend OpenClaw fallback delegation`,
      );
    } else {
      assert.equal(
        detectedFamily,
        sample.actionFamily,
        `sample ${sample.sampleId} should align with backend action-family detection`,
      );
    }
  }
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '这个 Jira ticket 的 latest status 需要同步',
    ).sampleId,
    'jira-comment',
  );
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '请把这段录制视频下载后上传到 Drive 并把链接发我',
    ).sampleId,
    'openclaw-file-delegation',
  );
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '这个事情麻烦帮我处理一下',
    ).sampleId,
    'openclaw-general-delegation',
  );

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

  const historySuggestion = buildHistoryLinkedActionSuggestion(
    {
      text: '历史 Jira 规则',
      automationPrompt: '识别 Jira ticket 后补充 comment，并附上原消息链接。',
    },
    {
      sender: 'Alice',
      groupName: 'Release Chat',
      content: '请给 RCV-123 补一条 comment',
    },
    {
      openClawEnabled: true,
      jiraConfigured: true,
      memoryServiceAvailable: true,
    },
  );
  assert.match(historySuggestion, /识别 Jira ticket/);
  assert.match(historySuggestion, /OpenClaw=enabled/);
  assert.match(historySuggestion, /Jira=configured/);

  const sample = selectLinkedActionSampleForMessage(
    LINKED_ACTION_SAMPLE_CATALOG,
    '请把这个 Jira ticket 的最新进展同步一下',
  );
  const sampleSuggestion = buildSampleLinkedActionSuggestion(
    sample,
    {
      sender: 'Bob',
      groupName: 'Ops Chat',
      content: '请把这个 Jira ticket 的最新进展同步一下',
    },
    {
      openClawEnabled: true,
      jiraConfigured: true,
      memoryServiceAvailable: true,
    },
  );
  assert.equal(sample.sampleId, 'jira-comment');
  assert.match(sampleSuggestion, /Jira/);
  assert.match(sampleSuggestion, /OpenClaw=enabled/);

  const pendingPreview = buildLinkedActionExecutionPreview({
    context: pendingConfig,
    openClawConfigured: false,
    requiresApproval: false,
  });
  assert.equal(pendingPreview.tone, 'pending');
  assert.match(pendingPreview.headline, /待激活动作计划/);
  assert.match(pendingPreview.items.join(' '), /不会立即创建 RuntimeAction/);
  assert.match(pendingPreview.items.join(' '), /连接 OpenClaw 前不会执行外部写操作/);

  const reviewPreview = buildLinkedActionExecutionPreview({
    context: pendingConfig,
    openClawConfigured: true,
    requiresApproval: true,
  });
  assert.equal(reviewPreview.tone, 'review');
  assert.match(reviewPreview.headline, /批准队列/);
  assert.match(reviewPreview.items.join(' '), /Action Queue 批准/);

  const autoPreview = buildLinkedActionExecutionPreview({
    context: pendingConfig,
    openClawConfigured: true,
    requiresApproval: false,
  });
  assert.equal(autoPreview.tone, 'auto');
  assert.match(autoPreview.headline, /自动执行/);
  assert.match(autoPreview.items.join(' '), /窄范围、低风险动作/);

  const previewReceipt = buildLinkedActionPreviewReceipt({
    context: pendingConfig,
    canPlan: true,
    actionFamily: 'openclaw_delegation',
    actions: [
      {
        actionType: 'delegate_openclaw',
        title: 'Create follow-up task',
        targetSystem: 'OpenClaw',
        requiresApproval: true,
      },
    ],
    warnings: [
      {
        code: 'delegated_to_openclaw_black_box',
        severity: 'info',
        message: '实际能力以 OpenClaw 执行结果为准。',
      },
    ],
    requiresApproval: true,
  });
  assert.equal(previewReceipt.tone, 'ready');
  assert.match(previewReceipt.summary, /dry-run 可规划 1 个候选动作/);
  assert.match(previewReceipt.items.join(' '), /不会保存规则/);
  assert.match(previewReceipt.items.join(' '), /不会调用 OpenClaw/);
  assert.match(previewReceipt.items.join(' '), /Action Queue 批准/);

  const blockedPreviewReceipt = buildLinkedActionPreviewReceipt({
    canPlan: false,
    skippedReason: 'unsupported_or_unparseable_automation_prompt',
    actionFamily: 'unknown',
    actions: [],
    warnings: [
      {
        code: 'unsupported_action_family',
        severity: 'warning',
        message: '当前联动操作文案还不能稳定映射。',
      },
    ],
    suggestedPrompt: '补充目标系统、对象、权限和成功回执。',
  });
  assert.equal(blockedPreviewReceipt.tone, 'warning');
  assert.match(blockedPreviewReceipt.summary, /暂不能稳定规划/);
  assert.match(blockedPreviewReceipt.items.join(' '), /未生成候选动作/);
  assert.match(blockedPreviewReceipt.items.join(' '), /应用建议文案/);

  console.log('verify-linked-action-flow: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
