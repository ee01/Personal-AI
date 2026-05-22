import assert from 'node:assert/strict';

import {
  CONTEXT_SITE_ALLOW_STORAGE_KEY,
  CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
  CONTEXT_PAGE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_MUTE_TTL_MS,
  buildContextRecallCompactMetaItems,
  buildContextRecallMetaItems,
  buildContextRecallPeekFooterItems,
  formatContextRecallDisplayPriorityLabel,
  formatContextRecallEvidenceRole,
  formatContextRecallMemoryType,
  formatContextRecallReasonType,
  formatContextRecallSourceLabel,
  formatContextSiteMuteRemaining,
  getContextSiteMuteExpiresAt,
  hasSensitiveUrlSignal,
  isContextSelectionTextEligible,
  isContextHostCoveredBySiteRecord,
  isContextPageUrlBlockedByPrefix,
  isDisplayableContextRecallMatch,
  isLowValueContextHost,
  isSensitiveControlDescriptor,
  isContextSiteMuteActive,
  normalizeContextPageBlockPrefix,
  normalizeContextSiteMuteHost,
  normalizeContextPageUrl,
  normalizeContextSelectionText,
  pruneContextPageBlockRecord,
  pruneContextSiteAllowRecord,
  pruneContextSiteBlockRecord,
  pruneContextSiteMuteRecord,
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from '../src/web-intelligence/contextRecallGuards';

assert.equal(
  sanitizeContextExternalUrl('https://example.com/source?a=1'),
  'https://example.com/source?a=1',
);
assert.equal(
  sanitizeContextExternalUrl('/source', 'https://example.com/page'),
  'https://example.com/source',
);
assert.equal(sanitizeContextExternalUrl('javascript:alert(1)'), null);
assert.equal(sanitizeContextExternalUrl('data:text/html,hello'), null);

assert.equal(sanitizeExploreRoute('#/timeline?focus=abc'), '#/timeline?focus=abc');
assert.equal(sanitizeExploreRoute('memory-exploring.html#/timeline'), null);
assert.equal(sanitizeExploreRoute('javascript:alert(1)'), null);
assert.equal(sanitizeExploreRoute('#/timeline\n?focus=abc'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=abc%20def'), '#/timeline?focus=abc%20def');
assert.equal(sanitizeExploreRoute('#/timeline?focus=abc" onclick="alert(1)'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=<img>'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=`template`'), null);

assert.equal(
  isDisplayableContextRecallMatch({
    title: 'RingCentral Video',
    snippet: '会议: RingCentral Video',
    sourceLabel: 'meeting',
    sourceTitle: 'RingCentral Video',
  }),
  false,
);
assert.equal(
  isDisplayableContextRecallMatch({
    title: '内容',
    snippet: '发送位置：当前这个 RingCentral 群',
    sourceLabel: 'glip',
    sourceTitle: 'AI Service',
  }),
  false,
);
assert.equal(
  isDisplayableContextRecallMatch({
    title: 'RingCentral Video',
    snippet: 'MTR-144449 Refine In-Meeting Video Tile Layout and UX dependency review.',
    sourceLabel: 'meeting',
    sourceTitle: 'RingCentral Video',
  }),
  true,
);
assert.equal(formatContextRecallMemoryType('message'), '消息记忆');
assert.equal(formatContextRecallMemoryType('chunk'), '片段记忆');
assert.equal(formatContextRecallMemoryType('entity'), '实体记忆');
assert.equal(formatContextRecallMemoryType('custom'), 'custom记忆');
assert.equal(formatContextRecallSourceLabel('glip'), 'RingCentral 消息');
assert.equal(formatContextRecallSourceLabel('ai_chat'), 'AI 对话');
assert.equal(formatContextRecallSourceLabel('Web memory'), 'Web memory');
assert.equal(formatContextRecallReasonType('keyword_overlap'), '关键词匹配');
assert.equal(formatContextRecallReasonType('semantic_match'), '语义相关');
assert.equal(formatContextRecallEvidenceRole('supporting'), '支持证据');
assert.equal(formatContextRecallEvidenceRole('direct_evidence'), '直接证据');
assert.equal(formatContextRecallDisplayPriorityLabel('p1'), '强相关');
assert.equal(formatContextRecallDisplayPriorityLabel('p2'), '可能相关');
assert.equal(formatContextRecallDisplayPriorityLabel('hidden'), null);
const metaItems = buildContextRecallMetaItems({
  type: 'message',
  sourceLabel: 'jira',
  sourceTitle: 'PAI-123 launch readiness',
  timestamp: 1_700_000_000,
  whyMatched: '关键词命中网页上下文',
  whyRelevant: ['项目：Falcon', '主题：owner handoff'],
  reasonType: 'keyword_overlap',
  evidenceRole: 'supporting',
  sourceContext: 'Falcon readiness context cluster',
});
assert.deepEqual(metaItems.slice(0, 3), [
  '记忆类型：消息记忆',
  '来源：Jira',
  '来源标题：PAI-123 launch readiness',
]);
assert.ok(
  metaItems.some((item) => item.startsWith('记录时间：')),
  '元信息应显式包含记录时间',
);
assert.ok(
  metaItems.includes('匹配原因：关键词命中网页上下文'),
  '元信息应显式包含匹配原因',
);
assert.ok(
  metaItems.includes('关联锚点：项目：Falcon / 主题：owner handoff'),
  '元信息应显式包含 whyRelevant 关联锚点',
);
assert.ok(
  metaItems.includes('匹配类型：关键词匹配'),
  '元信息应把 reasonType 映射成中文标签',
);
assert.ok(
  metaItems.includes('证据角色：支持证据'),
  '元信息应把 evidenceRole 映射成中文标签',
);
assert.ok(
  metaItems.includes('来源上下文：Falcon readiness context cluster'),
  '元信息应支持 sourceContext',
);
const compactMetaItems = buildContextRecallCompactMetaItems({
  type: 'message',
  sourceLabel: 'jira',
  sourceTitle: 'PAI-123 launch readiness',
  timestamp: 1_700_000_000,
  whyMatched: '关键词命中网页上下文',
  reasonType: 'keyword_overlap',
  evidenceRole: 'supporting',
  sourceContext: 'Falcon readiness context cluster',
});
assert.ok(
  compactMetaItems.includes('PAI-123 launch readiness'),
  '紧凑元信息应优先显示可读来源标题',
);
assert.ok(
  compactMetaItems.includes('关键词匹配'),
  '紧凑元信息应显示用户能理解的匹配类型',
);
assert.equal(
  compactMetaItems.some((item) => item.startsWith('记忆类型：')),
  false,
  '紧凑元信息不应占用空间展示技术型记忆类型',
);
assert.equal(
  isDisplayableContextRecallMatch({
    title: 'Falcon launch readiness',
    uiSummary: 'Falcon launch has an owner handoff dependency.',
    displayPriority: 'hidden',
  }),
  false,
);
assert.equal(
  isDisplayableContextRecallMatch({
    title: 'Falcon launch readiness',
    uiSummary: 'Falcon launch has an owner handoff dependency.',
  }),
  true,
);
assert.deepEqual(
  buildContextRecallPeekFooterItems({
    sourceLabel: 'glip',
    reasonType: 'open_action',
    evidenceRole: 'action_item',
  }),
  ['RingCentral 消息', '未关闭行动项', '行动项'],
);
assert.equal(normalizeContextSelectionText('  Codex\nsetup\twith MCP skills  '), 'Codex setup with MCP skills');
assert.equal(isContextSelectionTextEligible('ok'), false);
assert.equal(isContextSelectionTextEligible('Codex setup with MCP skills'), true);
assert.equal(isContextSelectionTextEligible('额度申请流程'), true);
assert.equal(
  isContextSelectionTextEligible('Cursor token budget exceeded the monthly quota'),
  true,
);
assert.equal(
  isContextSelectionTextEligible('api_key = sk-proj-1234567890abcdefghijklmnop'),
  false,
);
assert.equal(
  isContextSelectionTextEligible('client_secret=abcdef1234567890'),
  false,
);
assert.equal(
  isContextSelectionTextEligible('4111 1111 1111 1111'),
  false,
);

assert.equal(isLowValueContextHost('www.google.com'), true);
assert.equal(isLowValueContextHost('m.youtube.com'), true);
assert.equal(isLowValueContextHost('docs.google.com'), false);
assert.equal(isLowValueContextHost('notgoogle.com'), false);

assert.equal(
  normalizeContextPageUrl(
    'https://user:pass@example.com/docs?utm_source=mail&b=2&a=1&fbclid=abc#section',
  ),
  'https://example.com/docs?a=1&b=2',
);
assert.equal(
  normalizeContextPageUrl('https://example.com/callback?code=oauth-code'),
  null,
);
assert.equal(normalizeContextPageUrl('javascript:alert(1)'), null);

assert.equal(hasSensitiveUrlSignal('https://example.com/login'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/settings/password'), true);
assert.equal(hasSensitiveUrlSignal('https://login.example.com/dashboard'), true);
assert.equal(hasSensitiveUrlSignal('https://billing.example.com/dashboard'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/oauth/callback'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/callback?code=abc'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/wiki/authentication-design'), false);
assert.equal(hasSensitiveUrlSignal('https://auth0.com/docs'), false);
assert.equal(hasSensitiveUrlSignal('https://example.com/wiki/project-falcon'), false);

assert.equal(isSensitiveControlDescriptor({ type: 'password' }), true);
assert.equal(
  isSensitiveControlDescriptor({ autocomplete: 'one-time-code' }),
  true,
);
assert.equal(
  isSensitiveControlDescriptor({ name: 'jira-search-query', type: 'search' }),
  false,
);

const now = 1_700_000_000_000;
assert.equal(normalizeContextSiteMuteHost(' Example.COM. '), 'example.com');
assert.equal(isContextSiteMuteActive(now - 1_000, now), true);
assert.equal(isContextSiteMuteActive(now - CONTEXT_SITE_MUTE_TTL_MS - 1, now), false);
assert.equal(getContextSiteMuteExpiresAt(now), now + CONTEXT_SITE_MUTE_TTL_MS);
assert.equal(formatContextSiteMuteRemaining(now - 2 * 60 * 60 * 1000, now), '22 小时后恢复');
assert.deepEqual(
  pruneContextSiteMuteRecord(
    {
      ' Example.COM. ': now - 1_000,
      'expired.example': now - CONTEXT_SITE_MUTE_TTL_MS - 1,
      invalid: 'not-number',
    },
    now,
  ),
  {
    record: { 'example.com': now - 1_000 },
    changed: true,
  },
);
assert.equal(CONTEXT_SITE_BLOCK_STORAGE_KEY, 'pai-context-blocked-sites-v1');
assert.equal(CONTEXT_SITE_ALLOW_STORAGE_KEY, 'pai-context-allowed-sites-v1');
assert.equal(
  CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
  'pai-context-site-allowlist-mode-v1',
);
assert.equal(
  CONTEXT_PAGE_BLOCK_STORAGE_KEY,
  'pai-context-blocked-page-prefixes-v1',
);
assert.deepEqual(
  pruneContextSiteBlockRecord({
    ' Example.COM. ': now - 1_000,
    'bad.example': Number.NaN,
    'expired.example': 0,
  }),
  {
    record: { 'example.com': now - 1_000 },
    changed: true,
  },
);
assert.deepEqual(
  pruneContextSiteAllowRecord({
    ' Example.COM. ': now - 1_000,
    'bad.example': Number.NaN,
  }),
  {
    record: { 'example.com': now - 1_000 },
    changed: true,
  },
);
assert.equal(
  isContextHostCoveredBySiteRecord('app.example.com', {
    'example.com': now,
  }),
  true,
);
assert.equal(
  isContextHostCoveredBySiteRecord('example.com', {
    'app.example.com': now,
  }),
  false,
);
assert.equal(
  isContextHostCoveredBySiteRecord('notexample.com', {
    'example.com': now,
  }),
  false,
);
assert.equal(
  normalizeContextPageBlockPrefix(
    'https://user:pass@example.com/docs/project?a=1&token=secret#section',
  ),
  'https://example.com/docs/project',
);
assert.equal(normalizeContextPageBlockPrefix('example.com/docs/project/'), 'https://example.com/docs/project');
assert.equal(normalizeContextPageBlockPrefix('https://example.com/'), null);
assert.deepEqual(
  pruneContextPageBlockRecord({
    'https://Example.com/docs/project/?token=secret#section': now - 1_000,
    'https://example.com/': now - 1_000,
    'javascript:alert(1)': now - 1_000,
    'https://example.com/bad': Number.NaN,
  }),
  {
    record: { 'https://example.com/docs/project': now - 1_000 },
    changed: true,
  },
);
assert.equal(
  isContextPageUrlBlockedByPrefix('https://example.com/docs/project/edit?x=1', {
    'https://example.com/docs/project': now,
  }),
  true,
);
assert.equal(
  isContextPageUrlBlockedByPrefix('https://example.com/docs/project-2', {
    'https://example.com/docs/project': now,
  }),
  false,
);

console.log('[verify-webpage-memory-detection] helper checks passed');
