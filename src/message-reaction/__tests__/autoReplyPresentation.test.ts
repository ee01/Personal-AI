import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAutoReplyConfigLaunchReceipt,
  buildAutoReplyContentReadinessReceipt,
  buildAutoReplyModeReceipt,
  buildAutoReplyRuleScopeReceipt,
  buildAutoReplyTopic,
  normalizeAutoReplyContent,
  normalizeAutoReplyDelayHours,
} from '../autoReplyPresentation.js';

test('buildAutoReplyTopic falls back to message content when summary is missing', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: 'Morgan Lee',
      groupId: 'team-1',
      groupName: 'Support',
      messageContent: 'Please review the escalation before EOD.',
      datetime: '2026-05-01T08:00:00.000Z',
      postId: 'post-1',
    }),
    '自动答复 Morgan「Please review the escalation before EOD.」',
  );
});

test('buildAutoReplyTopic avoids repeating sender name from the summary', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: 'Alex Chen',
      groupId: 'team-1',
      groupName: 'Support',
      messageContent: 'Can someone confirm the action owner?',
      summary: 'Alex asks who owns the action',
      datetime: '2026-05-01T08:00:00.000Z',
      postId: 'post-2',
    }),
    '自动答复「Alex asks who owns the action」',
  );
});

test('buildAutoReplyTopic has a stable fallback for empty context text', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: '',
      groupId: '',
      groupName: '',
      messageContent: '',
      summary: '   ',
      datetime: '2026-05-01T08:00:00.000Z',
    }),
    '自动答复「消息」',
  );
});

test('normalizeAutoReplyDelayHours clamps imported or typed delay values', () => {
  assert.equal(normalizeAutoReplyDelayHours(undefined), 1);
  assert.equal(normalizeAutoReplyDelayHours('0'), 1);
  assert.equal(normalizeAutoReplyDelayHours(2.8), 2);
  assert.equal(normalizeAutoReplyDelayHours('99'), 72);
});

test('normalizeAutoReplyContent trims empty fallback text', () => {
  assert.equal(normalizeAutoReplyContent(undefined), '');
  assert.equal(normalizeAutoReplyContent('   '), '');
  assert.equal(
    normalizeAutoReplyContent('  Thanks, I will check.  '),
    'Thanks, I will check.',
  );
});

test('buildAutoReplyConfigLaunchReceipt keeps toolbar click in draft setup boundary', () => {
  const receipt = buildAutoReplyConfigLaunchReceipt();

  assert.match(receipt, /未发送/);
  assert.match(receipt, /未创建规则/);
  assert.match(receipt, /保存规则后/);
});

test('buildAutoReplyModeReceipt explains delayed AI-generated reply behavior', () => {
  assert.deepEqual(
    buildAutoReplyModeReceipt({
      reviewMode: 'delayed',
      delayHours: '99',
      useAIGenerate: true,
    }),
    {
      tone: 'warning',
      title: '72 小时可拦截',
      timingText: '命中后会先排到 72 小时后发送。',
      reviewText: '发送前可在定时消息管理器里修改、暂停或删除。',
      generationText: '每次命中都会重新生成草稿，固定文本只作为风格参考。',
      fallbackText:
        '如果 AI 生成失败或返回空文本，本次会跳过自动答复，不会写入默认短句。',
    },
  );
});

test('buildAutoReplyModeReceipt distinguishes AI fallback from skip behavior', () => {
  assert.equal(
    buildAutoReplyModeReceipt({
      reviewMode: 'manual',
      useAIGenerate: true,
      replyContent: 'Thanks, I will check.',
    }).fallbackText,
    '如果 AI 生成失败，会改用当前固定文本入队；不会替换成默认短句。',
  );
  assert.equal(
    buildAutoReplyModeReceipt({
      reviewMode: 'manual',
      useAIGenerate: true,
      replyContent: '   ',
    }).fallbackText,
    '如果 AI 生成失败或返回空文本，本次会跳过自动答复，不会写入默认短句。',
  );
});

test('buildAutoReplyContentReadinessReceipt separates generated, fallback, and inert states', () => {
  assert.deepEqual(
    buildAutoReplyContentReadinessReceipt({
      useAIGenerate: true,
      replyContent: 'Thanks, I will check.',
    }),
    {
      tone: 'safe',
      title: 'AI 生成 + 固定 fallback 就绪',
      detailText:
        '后续命中会先尝试 AI 生成；生成失败或为空时，改用当前固定文本入队。',
      recoveryText: '改动模板只影响后续新消息，不会更新已排队的自动答复。',
      listTitle: '自动答复草稿',
      listSummary: 'Thanks, I will check.',
    },
  );

  assert.deepEqual(
    buildAutoReplyContentReadinessReceipt({
      useAIGenerate: true,
      replyContent: '   ',
    }),
    {
      tone: 'warning',
      title: 'AI 生成就绪 · 无固定 fallback',
      detailText:
        '后续命中会尝试 AI 生成；如果生成失败或为空，本次会跳过入队。',
      recoveryText: '需要更稳时补一条固定 fallback，或切到仅审核后再观察。',
      listTitle: 'AI 自动答复',
      listSummary: '每次命中实时生成；没有固定 fallback，生成失败会跳过入队。',
    },
  );

  assert.deepEqual(
    buildAutoReplyContentReadinessReceipt({
      useAIGenerate: false,
      replyContent: '',
    }),
    {
      tone: 'danger',
      title: '固定回复未就绪',
      detailText:
        '保存后其他规则动作仍生效，但自动答复命中会跳过，不创建空回复队列行。',
      recoveryText: '补充固定回复，或开启“每次 AI 生成类似答复”。',
      listTitle: '自动答复未就绪',
      listSummary: '固定回复为空且未开启 AI 生成；命中时只会跳过自动答复入队。',
    },
  );
});

test('buildAutoReplyModeReceipt distinguishes immediate and manual review paths', () => {
  assert.equal(
    buildAutoReplyModeReceipt({
      reviewMode: 'immediate',
      useAIGenerate: false,
    }).reviewText,
    '不会进入审核队列，只适合低风险、范围很窄的规则。',
  );
  assert.equal(
    buildAutoReplyModeReceipt({
      reviewMode: 'manual',
      useAIGenerate: false,
    }).timingText,
    '命中后只进入待审核列表。',
  );
});

test('buildAutoReplyRuleScopeReceipt explains broad immediate rule non-effects', () => {
  const receipt = buildAutoReplyRuleScopeReceipt({
    reviewMode: 'immediate',
    useAIGenerate: false,
  });

  assert.equal(receipt.tone, 'danger');
  assert.match(receipt.scopeText, /未限定发送人或群组/);
  assert.match(receipt.activationText, /不会回扫历史消息/);
  assert.match(receipt.activationText, /不会直接向任何人发送/);
  assert.match(receipt.queueText, /Active 队列行/);
  assert.match(receipt.queueText, /保存配置本身不会立即发送/);
});

test('buildAutoReplyRuleScopeReceipt carries explicit scope and manual approval path', () => {
  const receipt = buildAutoReplyRuleScopeReceipt({
    filterSender: 'Morgan Lee',
    filterGroup: 'Support Escalations',
    reviewMode: 'manual',
    useAIGenerate: true,
  });

  assert.equal(receipt.tone, 'safe');
  assert.equal(
    receipt.scopeText,
    '命中范围：发送人 Morgan Lee；群组 Support Escalations。',
  );
  assert.match(receipt.queueText, /PendingReview 行/);
  assert.match(receipt.queueText, /批准某一行后/);
  assert.match(receipt.queueText, /拒绝只关闭该行/);
});
