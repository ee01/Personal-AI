import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRuleDeliveryReceipt,
  getRuleActionSummaryItems,
  getRuleSafetySummary,
  getRuleScopeExecutionReceipt,
  getRuleRunPreviewReceipt,
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

test('rule safety does not let stale digest config hide follow-thread notifications', () => {
  const summary = getRuleSafetySummary({
    filterGroup: 'Customer Room',
    filterSender: 'Morgan Lee',
    notifyMethod: 'bot,chrome',
    digestEnabled: true,
    followThread: true,
  });

  assert.equal(summary.tone, 'ok');
  assert.equal(summary.label, '基础安全');
  assert.deepEqual(summary.reasons, ['关注后续通知']);
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

test('rule scope execution receipt explains OR candidates and final gates', () => {
  const receipt = getRuleScopeExecutionReceipt({
    filterGroup: 'Release Chat, SDK Updates',
    filterSender: 'Morgan Lee; Alice',
  });

  assert.equal(receipt.tone, 'ok');
  assert.equal(receipt.title, '范围执行回执');
  assert.match(receipt.summary, /Release Chat 或 SDK Updates/);
  assert.match(receipt.summary, /Morgan Lee 或 Alice/);
  assert.match(receipt.filterText, /同一维度内按 OR/);
  assert.match(receipt.filterText, /必须两者都命中/);
  assert.match(receipt.finalCheckText, /再次按发送人、群组、时间/);
  assert.match(receipt.boundaryText, /不会分析历史消息/);
});

test('rule scope execution receipt flags global candidates before save', () => {
  const receipt = getRuleScopeExecutionReceipt({});

  assert.equal(receipt.tone, 'danger');
  assert.equal(receipt.title, '范围执行回执 · 全局候选');
  assert.match(receipt.summary, /所有可读取群组和所有发送人/);
});

test('rule scope execution receipt marks expired rules as stopped candidates', () => {
  const receipt = getRuleScopeExecutionReceipt({
    filterGroup: 'Expired Room',
    filterSender: 'Morgan Lee',
    inactive: true,
  });

  assert.equal(receipt.tone, 'inactive');
  assert.equal(receipt.title, '范围执行回执 · 已停止');
  assert.match(receipt.summary, /不会进入运行时候选/);
  assert.match(receipt.summary, /Expired Room/);
  assert.match(receipt.summary, /Morgan Lee/);
  assert.match(receipt.filterText, /LLM 前候选筛选会跳过/);
  assert.match(receipt.filterText, /旧 ruleRef/);
  assert.match(receipt.finalCheckText, /保存为有效规则后/);
  assert.match(receipt.boundaryText, /不会分析历史消息/);
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
    openClawConfigured: true,
  });

  assert.deepEqual(items, [
    '写入记忆',
    '每周摘要（不即时推送）',
    '自动答复：手动审核',
    '关注后续',
    '联动操作：需批准',
  ]);
});

test('rule action summary marks linked actions as pending activation when OpenClaw is disconnected', () => {
  const items = getRuleActionSummaryItems({
    automationPrompt: '连接外部系统执行这个操作',
    automationRequiresApproval: false,
    openClawConfigured: false,
  });

  assert.deepEqual(items, ['写入记忆', '联动操作：待激活']);
});

test('rule action summary treats digest as the low-interruption delivery path', () => {
  const items = getRuleActionSummaryItems({
    notifyMethod: '',
    digestEnabled: true,
    digestFrequency: 'daily',
  });

  assert.deepEqual(items, ['写入记忆', '每日摘要（不即时推送）']);
});

test('rule delivery receipt explains memory-only matches', () => {
  const receipt = getRuleDeliveryReceipt({});

  assert.equal(receipt.tone, 'silent');
  assert.equal(receipt.label, '静默入库');
  assert.match(receipt.detail, /只写入记忆/);
  assert.match(receipt.detail, /不进入定时摘要/);
});

test('rule delivery receipt explains digest suppression of immediate notifications', () => {
  const receipt = getRuleDeliveryReceipt({
    notifyMethod: 'bot,chrome',
    mentionMe: true,
    digestEnabled: true,
    digestFrequency: 'weekly',
  });

  assert.equal(receipt.tone, 'digest');
  assert.equal(receipt.label, '每周摘要');
  assert.match(receipt.detail, /进入每周摘要/);
  assert.match(receipt.detail, /替代 Glip \/ Chrome 即时通知/);
});

test('rule delivery receipt gives follow-thread notifications priority', () => {
  const receipt = getRuleDeliveryReceipt({
    notifyMethod: 'bot',
    followThread: true,
  });

  assert.equal(receipt.tone, 'followup');
  assert.equal(receipt.label, '关注后续通知');
  assert.match(receipt.detail, /后续相关消息优先按关注后续走 Glip/);
});

test('rule run preview separates saving from automatic background capture', () => {
  const receipt = getRuleRunPreviewReceipt({
    notifyMethod: 'bot',
    isSilentAnalysisEnabled: false,
  });

  assert.equal(receipt.tone, 'paused');
  assert.equal(receipt.title, '保存前运行路径 · 仅保存');
  assert.match(receipt.triggerText, /保存只更新本机手动规则/);
  assert.match(receipt.triggerText, /不会自动捕获后续新消息/);
  assert.match(receipt.boundaryText, /不会回扫历史消息/);
  assert.match(receipt.boundaryText, /不会.*创建 RuntimeAction/);
});

test('rule run preview shows future-message trigger and digest outcome', () => {
  const receipt = getRuleRunPreviewReceipt({
    notifyMethod: 'bot,chrome',
    digestEnabled: true,
    digestFrequency: 'weekly',
    isSilentAnalysisEnabled: true,
  });

  assert.equal(receipt.tone, 'ready');
  assert.equal(receipt.title, '保存前运行路径');
  assert.match(receipt.triggerText, /只自动观察后续新消息/);
  assert.match(receipt.triggerText, /立即分析最近/);
  assert.match(receipt.matchText, /LLM 判断规则语义/);
  assert.match(receipt.outcomeText, /进入每周摘要/);
  assert.match(receipt.outcomeText, /替代 Glip \/ Chrome 即时通知/);
});
