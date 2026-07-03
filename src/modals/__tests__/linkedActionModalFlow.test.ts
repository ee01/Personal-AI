import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPendingLinkedActionConfig } from '../../message-reaction/linkedActionEntry.js';
import {
  buildLinkedActionDraftPrefill,
  buildLinkedActionExecutionPreview,
  buildLinkedActionPreviewReceipt,
  buildLinkedActionSaveReceipt,
  getLinkedActionTriggerContextItems,
  isPendingLinkedActionConfigFresh,
  LINKED_ACTION_SAMPLE_CATALOG,
  parseLinkedActionMessageTimestamp,
  selectLinkedActionSampleForMessage,
  shouldAutoRequestLinkedActionSuggestion,
} from '../linkedActionHelpers.js';

test('pending linked-action payload hydrates modal prefill state', () => {
  const pending = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupId: 'release-chat',
    groupName: 'Release Chat',
    content: '请帮我跟进这个 Jira ticket',
    messageId: 'msg-1',
    timestamp: '2026-06-01T09:30:00.000Z',
  });

  assert.equal(isPendingLinkedActionConfigFresh(pending), true);
  assert.equal(pending.messageTimestamp, '2026-06-01T09:30:00.000Z');
  const prefill = buildLinkedActionDraftPrefill(pending);
  assert.match(prefill.topicText, /发送了内容与以下语义相似/);
  assert.equal(prefill.filterSender, 'Alice');
  assert.equal(prefill.filterGroup, 'Release Chat');
  assert.equal(prefill.autoReply, false);
  assert.equal(prefill.followThread, false);
});

test('linked-action trigger context keeps original message time separate from request freshness', () => {
  const requestedAt = Date.parse('2026-06-04T12:00:00.000Z');
  const pending = buildPendingLinkedActionConfig(
    {
      sender: 'Alice',
      groupName: 'Release Chat',
      content: '把这个附件放到 Drive',
      messageId: 'msg-1',
      timestamp: '2026-05-01T09:30:00.000Z',
    },
    requestedAt,
  );

  assert.equal(isPendingLinkedActionConfigFresh(pending, requestedAt), true);
  assert.equal(
    parseLinkedActionMessageTimestamp(pending.messageTimestamp)?.toISOString(),
    '2026-05-01T09:30:00.000Z',
  );
  assert.deepEqual(
    getLinkedActionTriggerContextItems(pending, {
      formatDate: (date) => date.toISOString(),
    }),
    [
      { label: '会话', value: 'Release Chat' },
      { label: '发送人', value: 'Alice' },
      { label: '原消息时间', value: '2026-05-01T09:30:00.000Z' },
      { label: '消息 ID', value: 'msg-1' },
    ],
  );
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

test('linked-action sample picker falls back to generic OpenClaw delegation', () => {
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '请帮我给 Jira ticket 补一条 comment',
    ).sampleId,
    'jira-comment',
  );
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '把当前附件下载并上传到 Drive，完成后发链接',
    ).sampleId,
    'openclaw-file-delegation',
  );
  assert.equal(
    selectLinkedActionSampleForMessage(
      LINKED_ACTION_SAMPLE_CATALOG,
      '这件事帮我处理一下',
    ).sampleId,
    'openclaw-general-delegation',
  );
});

test('linked-action save receipt separates draft save from immediate execution', () => {
  const context = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupName: 'Release Chat',
    content: '把这个 Jira 结果同步给项目群',
    messageId: 'msg-2',
    timestamp: '2026-06-01T09:30:00.000Z',
  });

  const disconnectedReceipt = buildLinkedActionSaveReceipt({
    context,
    openClawConfigured: false,
    requiresApproval: false,
  });
  assert.match(disconnectedReceipt, /已保存联动操作草稿/);
  assert.match(disconnectedReceipt, /没有回扫历史消息/);
  assert.match(disconnectedReceipt, /没有创建 RuntimeAction/);
  assert.match(disconnectedReceipt, /没有调用 OpenClaw/);
  assert.match(disconnectedReceipt, /待激活/);

  const approvalReceipt = buildLinkedActionSaveReceipt({
    context,
    openClawConfigured: true,
    requiresApproval: true,
  });
  assert.match(approvalReceipt, /后续新消息命中后才会生成需批准的 RuntimeAction/);
  assert.match(approvalReceipt, /外部写操作前仍要你批准/);

  const autoReceipt = buildLinkedActionSaveReceipt({
    context,
    openClawConfigured: true,
    requiresApproval: false,
  });
  assert.match(autoReceipt, /按免批准设置执行可执行动作/);
});

test('linked-action execution preview explains the pre-save lane and non-effects', () => {
  const context = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupName: 'Release Chat',
    content: '把这个 Jira 结果同步给项目群',
    messageId: 'msg-2',
    timestamp: '2026-06-01T09:30:00.000Z',
  });

  const pendingPreview = buildLinkedActionExecutionPreview({
    context,
    openClawConfigured: false,
    requiresApproval: false,
  });
  assert.equal(pendingPreview.tone, 'pending');
  assert.equal(pendingPreview.label, '待激活');
  assert.match(pendingPreview.headline, /待激活动作计划/);
  assert.match(pendingPreview.contextLine, /Release Chat/);
  assert.match(pendingPreview.items.join(' '), /不会回扫历史消息/);
  assert.match(pendingPreview.items.join(' '), /连接 OpenClaw 前不会执行外部写操作/);

  const reviewPreview = buildLinkedActionExecutionPreview({
    context,
    openClawConfigured: true,
    requiresApproval: true,
  });
  assert.equal(reviewPreview.tone, 'review');
  assert.equal(reviewPreview.label, '需批准');
  assert.match(reviewPreview.items.join(' '), /生成需批准的 RuntimeAction/);
  assert.match(reviewPreview.items.join(' '), /Action Queue 批准/);

  const autoPreview = buildLinkedActionExecutionPreview({
    context,
    openClawConfigured: true,
    requiresApproval: false,
  });
  assert.equal(autoPreview.tone, 'auto');
  assert.equal(autoPreview.label, '自动执行');
  assert.match(autoPreview.items.join(' '), /免批准设置执行/);
  assert.match(autoPreview.items.join(' '), /窄范围、低风险动作/);
});

test('linked-action dry-run receipt explains sample, outcome, and non-effects', () => {
  const context = buildPendingLinkedActionConfig({
    sender: 'Alice',
    groupName: 'Launch Room',
    content: '帮我创建一个带 owner 和 due date 的后续任务',
    messageId: 'msg-3',
    timestamp: '2026-06-01T09:30:00.000Z',
  });

  const readyReceipt = buildLinkedActionPreviewReceipt({
    context,
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

  assert.equal(readyReceipt.tone, 'ready');
  assert.equal(readyReceipt.title, '预演结果回执');
  assert.match(readyReceipt.summary, /dry-run 可规划 1 个候选动作/);
  assert.match(readyReceipt.items.join(' '), /Launch Room/);
  assert.match(readyReceipt.items.join(' '), /不会保存规则/);
  assert.match(readyReceipt.items.join(' '), /不会调用 OpenClaw/);
  assert.match(readyReceipt.items.join(' '), /Action Queue 批准/);

  const warningReceipt = buildLinkedActionPreviewReceipt({
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
    suggestedPrompt: '补足目标系统、对象、权限和成功回执。',
  });

  assert.equal(warningReceipt.tone, 'warning');
  assert.match(warningReceipt.summary, /暂不能稳定规划/);
  assert.match(warningReceipt.items.join(' '), /未生成候选动作/);
  assert.match(warningReceipt.items.join(' '), /应用建议文案/);
});
