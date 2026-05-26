import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAutoReplyModeReceipt,
  buildAutoReplyTopic,
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
