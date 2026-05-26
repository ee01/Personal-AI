import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRuleActionSummaryItems,
  getRuleSafetySummary,
} from '../topic-rule-safety.js';

test('rule safety flags global auto-executed linked actions as highest risk', () => {
  const summary = getRuleSafetySummary({
    automationPrompt: '从消息中创建外部系统动作',
    automationRequiresApproval: false,
    notifyMethod: 'bot',
  });

  assert.equal(summary.tone, 'danger');
  assert.equal(summary.label, '全局自动执行');
  assert.deepEqual(summary.reasons, [
    '所有群组/发送人生效',
    '联动操作免批准',
    '即时通知',
  ]);
});

test('rule safety asks for review on short scopes and auto execution', () => {
  const summary = getRuleSafetySummary({
    filterGroup: 'AI, Release Chat',
    filterSender: 'Morgan Lee',
    automationPrompt: '同步 OpenClaw 状态',
    automationRequiresApproval: false,
    digestEnabled: true,
  });

  assert.equal(summary.tone, 'warn');
  assert.equal(summary.label, '需复核范围');
  assert.ok(summary.reasons.includes('范围词较短'));
  assert.ok(summary.reasons.includes('联动操作免批准'));
});

test('rule safety treats scoped approval-based rules as clear', () => {
  const summary = getRuleSafetySummary({
    filterGroup: 'Release Chat',
    filterSender: 'Morgan Lee',
    notifyMethod: 'bot',
    digestEnabled: true,
    automationPrompt: '生成待批准的 follow-up 动作',
    automationRequiresApproval: true,
  });

  assert.equal(summary.tone, 'ok');
  assert.equal(summary.label, '范围清晰');
  assert.deepEqual(summary.reasons, ['联动操作需批准']);
});

test('rule safety does not warn on common two-character CJK scopes', () => {
  const summary = getRuleSafetySummary({
    filterGroup: '研发',
    filterSender: '李雷',
    notifyMethod: 'bot',
    digestEnabled: true,
  });

  assert.equal(summary.tone, 'ok');
  assert.equal(summary.label, '基础安全');
  assert.deepEqual(summary.reasons, ['范围明确']);
});

test('rule action summary exposes trigger outcomes before saving edits', () => {
  const items = getRuleActionSummaryItems({
    notifyMethod: 'bot,chrome',
    mentionMe: true,
    digestEnabled: true,
    digestFrequency: 'weekly',
    autoReply: true,
    autoReplyMode: 'manual',
    followThread: true,
    automationPrompt: '创建一个待审批的 OpenClaw 动作',
    automationRequiresApproval: true,
  });

  assert.deepEqual(items, [
    '写入记忆',
    '每周摘要（不即时推送）',
    '自动答复：手动审核',
    '关注后续',
    '联动操作：需批准',
  ]);
});

test('rule action summary treats digest as the low-interruption delivery path', () => {
  const items = getRuleActionSummaryItems({
    notifyMethod: '',
    digestEnabled: true,
    digestFrequency: 'daily',
  });

  assert.deepEqual(items, ['写入记忆', '每日摘要（不即时推送）']);
});
