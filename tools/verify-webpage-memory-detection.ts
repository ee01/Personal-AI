import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
  filterSceneRehearsalSourceTypes,
} from '../src/utils';
import {
  getMemoryLinkSafetyState,
  normalizeMemorySourceUrl,
} from '../src/modals/searchResultPresentation';
import {
  CONTEXT_SITE_ALLOW_STORAGE_KEY,
  CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY,
  CONTEXT_PAGE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_BLOCK_STORAGE_KEY,
  CONTEXT_SITE_MUTE_TTL_MS,
  buildContextRecallCompactMetaItems,
  buildContextRecallMetaItems,
  buildContextRecallPeekFooterItems,
  buildSourceMemoryRecallReceiptItems,
  formatContextRecallDisplayPriorityLabel,
  formatContextRecallEvidenceRole,
  formatContextRecallMemoryType,
  formatContextRecallReasonType,
  formatContextRecallScopeLabel,
  formatContextRecallSourceLabel,
  formatContextSiteMuteRemaining,
  getContextSiteMuteExpiresAt,
  hasSensitiveUrlSignal,
  isContextSelectionTextEligible,
  isContextHostCoveredBySiteRecord,
  isContextPageUrlBlockedByPrefix,
  isDisplayableContextRecallMatch,
  isLowValueContextHost,
  isMemoryCaptureSelectionTextEligible,
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
  removeContextSiteRecordConflicts,
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from '../src/web-intelligence/contextRecallGuards';

assert.equal(
  sanitizeContextExternalUrl('https://example.com/source?a=1'),
  'https://example.com/source?a=1',
);
assert.equal(
  sanitizeContextExternalUrl('https://example.com/source?utm_source=mail&b=2&a=1#section'),
  'https://example.com/source?a=1&b=2',
);
assert.equal(
  sanitizeContextExternalUrl('/source', 'https://example.com/page'),
  'https://example.com/source',
);
assert.equal(
  sanitizeContextExternalUrl('https://user:pass@example.com/source'),
  null,
);
assert.equal(
  sanitizeContextExternalUrl('https://example.com/source?token=secret&ticket=PAI-123'),
  null,
);
assert.equal(sanitizeContextExternalUrl('javascript:alert(1)'), null);
assert.equal(sanitizeContextExternalUrl('data:text/html,hello'), null);

assert.equal(
  normalizeMemorySourceUrl('https://example.com/source?a=1'),
  'https://example.com/source?a=1',
);
assert.equal(
  normalizeMemorySourceUrl('https://user:pass@example.com/source'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://example.com/source?token=secret&ticket=PAI-123'),
  null,
);
assert.deepEqual(
  getMemoryLinkSafetyState({
    sourceUrl: 'https://example.com/source?token=secret&ticket=PAI-123',
  }).blockedLabels,
  ['来源链接已隐藏：包含敏感参数'],
);
assert.deepEqual(
  getMemoryLinkSafetyState({
    sourceUrl: 'https://user:pass@example.com/source',
  }).blockedLabels,
  ['来源链接已隐藏：包含账号信息'],
);

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
assert.equal(formatContextRecallMemoryType('source_memory'), '资料记忆');
assert.equal(formatContextRecallMemoryType('custom'), 'custom记忆');
assert.equal(formatContextRecallSourceLabel('glip'), 'RingCentral 消息');
assert.equal(formatContextRecallSourceLabel('ai_chat'), 'AI 对话');
assert.equal(formatContextRecallSourceLabel('Web memory'), 'Web memory');
assert.equal(formatContextRecallReasonType('keyword_overlap'), '关键词匹配');
assert.equal(formatContextRecallReasonType('semantic_match'), '语义相关');
assert.equal(formatContextRecallEvidenceRole('supporting'), '支持证据');
assert.equal(formatContextRecallEvidenceRole('direct_evidence'), '直接证据');
assert.equal(formatContextRecallScopeLabel('work'), '工作记忆');
assert.equal(formatContextRecallScopeLabel('personal'), '个人记忆');
assert.equal(formatContextRecallScopeLabel('both'), null);
assert.equal(formatContextRecallDisplayPriorityLabel('p1'), '强相关');
assert.equal(formatContextRecallDisplayPriorityLabel('p2'), '可能相关');
assert.equal(formatContextRecallDisplayPriorityLabel('hidden'), null);
const metaItems = buildContextRecallMetaItems({
  type: 'message',
  scope: 'work',
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
  '范围：工作记忆',
]);
assert.equal(
  metaItems[3],
  '来源标题：PAI-123 launch readiness',
);
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
  scope: 'personal',
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
  compactMetaItems.includes('个人记忆'),
  '紧凑元信息应显示记忆范围',
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
const sourceMemoryMetaItems = buildContextRecallMetaItems({
  type: 'source_memory',
  sourceLabel: 'source_memory',
  sourceTitle: 'Falcon source packet',
  timestamp: 1_700_000_000,
  reasonType: 'keyword',
  evidenceRole: 'artifact',
  metadata: {
    sourceKind: 'selection',
    captureMode: 'manual',
  },
});
assert.ok(
  sourceMemoryMetaItems.includes('资料类型：选区资料'),
  '资料记忆元信息应显示资料类型',
);
assert.ok(
  sourceMemoryMetaItems.includes('保存方式：主动保存'),
  '资料记忆元信息应显示保存方式',
);
const sourceMemoryCompactMetaItems = buildContextRecallCompactMetaItems({
  type: 'source_memory',
  sourceLabel: 'source_memory',
  sourceTitle: 'Falcon source packet',
  metadata: {
    sourceKindLabel: '选区资料',
    captureModeLabel: '主动保存',
  },
});
assert.ok(
  sourceMemoryCompactMetaItems.includes('主动保存'),
  '资料记忆紧凑元信息应保留保存方式',
);
assert.ok(
  sourceMemoryCompactMetaItems.includes('选区资料'),
  '资料记忆紧凑元信息应保留资料类型',
);
const sourceMemoryRecallReceiptItems = buildSourceMemoryRecallReceiptItems(
  {
    type: 'source_memory',
    sourceLabel: 'source_memory',
    sourceTitle: 'Falcon source packet',
    exploreLink: '#/source-memory/falcon-source-packet',
    metadata: {
      sourceKind: 'selection',
      captureMode: 'manual',
      sourceMemoryDistillationStatus: 'ready',
      sourceMemoryCue: 'Falcon handoff source packet should be checked before launch.',
    },
  },
  {
    sourceLinks: [
      {
        label: 'Falcon source packet',
        url: 'https://example.com/falcon/source',
      },
    ],
  },
);
assert.deepEqual(
  sourceMemoryRecallReceiptItems.map(([label]) => label),
  ['资料', '蒸馏', '复核', '来源', '边界'],
  '资料记忆回执应稳定展示资料、蒸馏、复核、来源和边界',
);
assert.ok(
  sourceMemoryRecallReceiptItems.some(([, value]) =>
    /已保存的 选区资料 \/ 主动保存/.test(value),
  ),
  '资料记忆回执应集中展示资料类型和保存方式',
);
assert.ok(
  sourceMemoryRecallReceiptItems.some(([, value]) =>
    /已生成蒸馏提示/.test(value),
  ),
  '资料记忆回执应展示蒸馏状态',
);
assert.ok(
  sourceMemoryRecallReceiptItems.some(([, value]) =>
    /打开资料详情/.test(value),
  ),
  '资料记忆回执应说明资料详情复核入口',
);
assert.ok(
  sourceMemoryRecallReceiptItems.some(([, value]) =>
    /本卡只读/.test(value),
  ),
  '资料记忆回执应保留只读边界',
);
const hiddenSourceMemoryReceiptItems = buildSourceMemoryRecallReceiptItems({
  type: 'source_memory',
  sourceLabel: 'source_memory',
  exploreLink: '#/source-memory/hidden-source-packet',
  metadata: {
    sourceKindLabel: '整页资料',
    captureModeLabel: '自动保存',
    sourceMemoryDistillationStatus: 'blocked',
  },
});
assert.ok(
  hiddenSourceMemoryReceiptItems.some(([, value]) =>
    /原始来源未展示或已隐藏/.test(value),
  ),
  '资料记忆回执应说明敏感或缺失原始来源不影响详情复核',
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
const timestampedPeekFooterItems = buildContextRecallPeekFooterItems({
  sourceLabel: 'glip',
  sourceTitle: '2026 Hackathon Project',
  timestamp: Math.floor(Date.now() / 1000),
  reasonType: 'open_action',
  evidenceRole: 'action_item',
});
assert.equal(timestampedPeekFooterItems[0], 'RingCentral 消息');
assert.ok(
  timestampedPeekFooterItems[1],
  'Hover Peek footer should reserve the second slot for recorded time when available',
);
assert.equal(timestampedPeekFooterItems[2], '2026 Hackathon Project');
assert.equal(timestampedPeekFooterItems.length, 5);
assert.ok(
  timestampedPeekFooterItems.includes('行动项'),
  'Hover Peek footer should preserve the evidence role when there is still room',
);
const stalePeekFooterItems = buildContextRecallPeekFooterItems({
  sourceLabel: 'web',
  scope: 'personal',
  sourceTitle: 'Falcon stale source status note',
  timestamp: Math.floor((Date.now() - 120 * 24 * 60 * 60 * 1000) / 1000),
  reasonType: 'source_match',
});
assert.deepEqual(stalePeekFooterItems.slice(0, 2), ['网页', '个人记忆']);
assert.ok(
  stalePeekFooterItems.some((item) => /天前记录，行动前复核/.test(item)),
  'Hover Peek footer should surface stale evidence before opening Expanded Card',
);
assert.ok(
  stalePeekFooterItems.includes('Falcon stale source status note'),
  'Hover Peek footer should preserve the readable source title after scope/freshness',
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
assert.equal(isMemoryCaptureSelectionTextEligible('ok'), false);
assert.equal(
  isMemoryCaptureSelectionTextEligible('Personal AI should capture this source paragraph as useful browser evidence.'),
  true,
);
assert.equal(
  isMemoryCaptureSelectionTextEligible('这段网页资料解释了记忆捕捉的自动入库策略和用户确认入口'),
  true,
);
assert.equal(
  isMemoryCaptureSelectionTextEligible('RingCentral Video'),
  false,
);
assert.equal(
  isMemoryCaptureSelectionTextEligible('api_key = sk-proj-1234567890abcdefghijklmnop'),
  false,
);

assert.deepEqual(
  filterSceneRehearsalSourceTypes(
    ['rehearsal'],
    { CONTEXT_ASSIST_ENABLED: true, SCENE_REHEARSAL_DISPLAY_ENABLED: false },
  ),
  Array.from(DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL),
  'disabled scene rehearsal should not fall back to an undefined sourceTypes default',
);
assert.deepEqual(
  filterSceneRehearsalSourceTypes(
    ['glip', 'rehearsal'],
    { CONTEXT_ASSIST_ENABLED: true, SCENE_REHEARSAL_DISPLAY_ENABLED: false },
  ),
  ['glip'],
  'disabled scene rehearsal should preserve non-rehearsal requested sources',
);
assert.deepEqual(
  filterSceneRehearsalSourceTypes(
    ['rehearsal'],
    { CONTEXT_ASSIST_ENABLED: true, SCENE_REHEARSAL_DISPLAY_ENABLED: true },
  ),
  ['rehearsal'],
  'enabled scene rehearsal should preserve explicit rehearsal requests',
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
assert.deepEqual(
  removeContextSiteRecordConflicts('docs.example.com', {
    'example.com': now,
    'api.example.com': now - 1,
    'other.example.com': now - 2,
  }),
  {
    record: {
      'api.example.com': now - 1,
      'other.example.com': now - 2,
    },
    removedHosts: ['example.com'],
    changed: true,
  },
);
assert.deepEqual(
  removeContextSiteRecordConflicts('example.com', {
    'docs.example.com': now,
    'example.org': now - 1,
  }),
  {
    record: { 'example.org': now - 1 },
    removedHosts: ['docs.example.com'],
    changed: true,
  },
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

const contentScriptSource = readFileSync(
  new URL('../src/contentScriptWebIntelligence.ts', import.meta.url),
  'utf8',
);
const optionsSource = readFileSync(
  new URL('../src/options.tsx', import.meta.url),
  'utf8',
);
const sourceMemoryServiceSource = readFileSync(
  new URL('../memory-service/src/core/SourceMemoryCaptureService.ts', import.meta.url),
  'utf8',
);
assert.match(
  contentScriptSource,
  /CONTEXT_THUMB_DOWN_ICON_HTML/,
  'negative feedback should remain a compact thumb-down icon entry',
);
assert.match(
  contentScriptSource,
  /pai-context-feedback-sheet/,
  'negative feedback should open the lightweight reason sheet',
);
assert.match(
  contentScriptSource,
  /\.pai-context-feedback-layer\s*\{[\s\S]*?position:\s*fixed/,
  'relevance trainer drawer should be a viewport-level overlay',
);
assert.match(
  contentScriptSource,
  /document\.body\.appendChild\(drawer\)/,
  'relevance trainer drawer should be mounted at page level',
);
assert.doesNotMatch(
  contentScriptSource,
  /\$\{renderNegativeFeedbackLayer\(match,\s*view\)\}/,
  'relevance trainer drawer should not be rendered inside the Lens card',
);
assert.match(
  contentScriptSource,
  /generic_topic_overlap/,
  'relevance trainer should keep the generic-topic-overlap reason',
);
assert.match(
  contentScriptSource,
  /wrong_group_or_project/,
  'relevance trainer should keep the wrong-group-or-project reason',
);
assert.match(
  contentScriptSource,
  /empty_meeting_shell/,
  'relevance trainer should keep the empty-meeting-shell reason',
);
assert.match(
  contentScriptSource,
  /memory_relevance_trainer/,
  'feedback detail should identify the relevance trainer interaction',
);
assert.match(
  contentScriptSource,
  /feedback_reason/,
  'feedback detail should carry the selected reason',
);
assert.match(
  contentScriptSource,
  /pai-context-source-receipt/,
  'Expanded Card should render a compact source receipt when source links are unavailable',
);
assert.match(
  contentScriptSource,
  /else if \(!sourceLinks\.length\) \{\s*receipts\.push\('原始来源缺失'\)/,
  'Expanded Card should disclose a missing original source even when memory detail remains available',
);
assert.match(
  contentScriptSource,
  /receipts\.push\('已保存资料来源可复核'\);\s*receipts\.push\(`同站 \$\{sourceUrl\.hostname\}`\)/,
  'Source Memory links on the same host should preserve both saved-source provenance and host topology',
);
assert.match(
  contentScriptSource,
  /buildContextRecallSourceStatusReceipts/,
  'Expanded Card should render source status receipts for available provenance',
);
assert.match(
  contentScriptSource,
  /const peekFooter = buildContextRecallPeekFooterItems\(match\)\.join\(' · '\)/,
  'Hover Peek footer should use the shared provenance helper',
);
assert.match(
  contentScriptSource,
  /recallBasis\?: string/,
  'Memory Lens bubble options should carry a visible recall-basis receipt',
);
assert.match(
  contentScriptSource,
  /buildContextRecallCurrentBasisReceipt/,
  'Fresh Memory Lens recall should label the current request basis',
);
assert.match(
  contentScriptSource,
  /buildContextRecallCachedBasisReceipt\(cached\.ts, now\)/,
  'Cached Memory Lens recall should label cache age and avoid implying a new request',
);
assert.match(
  contentScriptSource,
  /pai-context-peek-basis/,
  'Hover Peek should render the current-vs-cached recall basis before the action boundary',
);
assert.match(
  contentScriptSource,
  /pai-context-peek-slice/,
  'Hover Peek should render a visible slice receipt when multiple candidates exist',
);
assert.match(
  contentScriptSource,
  /当前预览第 \$\{currentIndex \+ 1\}\/\$\{matches\.length\} 条；点击后可翻页查看本轮其他候选/,
  'Hover Peek slice receipt should name the current candidate and available paging',
);
assert.match(
  contentScriptSource,
  /本轮召回 · 页面稳定后重新请求/,
  'Hover Peek should state when the visible hint came from this page-stable recall',
);
assert.match(
  contentScriptSource,
  /本地缓存 · \$\{formatContextRecallCacheAgeLabel\(now - cachedAtMs\)\}召回；未重新请求/,
  'Hover Peek should state when the visible hint reused local cache',
);
assert.match(
  contentScriptSource,
  /buildPassivePeekSliceReceipt\(\),[\s\S]{0,180}view\.recallBasis,[\s\S]{0,140}'只读提示，不写入\/插入\/发送'/,
  'Rest icon tooltip should include visible slice, recall basis, and no-write boundary',
);
assert.match(
  contentScriptSource,
  /只读提示 · 点击查看详情，不写入\/插入\/发送/,
  'Hover Peek should disclose its read-only boundary before the user opens the card',
);
assert.match(
  contentScriptSource,
  /buildContextBubbleRestReceipt/,
  'collapsed Memory Lens bubble should build a compact reason receipt',
);
assert.match(
  contentScriptSource,
  /打开相关记忆提示：\$\{receipt\}/,
  'collapsed Memory Lens bubble aria label should explain why the bubble appeared',
);
assert.match(
  contentScriptSource,
  /pai-context-action-boundary/,
  'Expanded Card should render an always-visible action-boundary receipt',
);
assert.match(
  contentScriptSource,
  /pai-context-feedback-receipt/,
  'Expanded Card should render in-card feedback write receipts',
);
assert.match(
  contentScriptSource,
  /确认前不会当作已学习/,
  'Positive feedback should show a pending state before service confirmation',
);
assert.match(
  contentScriptSource,
  /有用反馈已确认写入/,
  'Positive feedback should only show learned state after service confirmation',
);
assert.match(
  contentScriptSource,
  /本次没有学习成功/,
  'Failed positive feedback should tell users the learning write did not happen',
);
assert.match(
  contentScriptSource,
  /buildContextAutopilotReceiptItems/,
  'Passive Memory Lens should derive its autopilot receipt from the backend decision',
);
assert.match(
  contentScriptSource,
  /buildContextAutopilotCompactSummaryText/,
  'Passive Memory Lens should compress the Autopilot count summary into the footer boundary',
);
assert.match(
  contentScriptSource,
  /pai-context-action-boundary-detail/,
  'Passive Memory Lens should reveal Autopilot details from the footer boundary on hover or click',
);
assert.doesNotMatch(
  contentScriptSource,
  /pai-context-autopilot-receipt/,
  'Passive Memory Lens should not render the full Autopilot receipt as a large first-screen block',
);
assert.match(
  contentScriptSource,
  /只读展示前过滤；不写入记忆、不强化访问计数、不外发来源/,
  'Autopilot receipt should disclose that display filtering is not a write, access reinforcement, or external send',
);
assert.match(
  contentScriptSource,
  /预演回执/,
  'Rehearsal Memory Lens cards should render a structured rehearsal receipt',
);
assert.match(
  contentScriptSource,
  /触发线索/,
  'Rehearsal receipt should expose matched future-scene cues',
);
assert.match(
  contentScriptSource,
  /可打开 Rehearsal 管理页复核脚本、来源和激活历史/,
  'Rehearsal receipt should tell users where to review the script and evidence',
);
assert.match(
  contentScriptSource,
  /有用\/不相关只调整这条预演后续命中/,
  'Rehearsal receipt should disclose feedback scope',
);
assert.match(
  contentScriptSource,
  /这条预演提醒不适合当前场景/,
  'Rehearsal negative feedback drawer should not label a future-scene script as a normal memory',
);
assert.match(
  contentScriptSource,
  /只读预演，不生成\/插入\/发送\/执行/,
  'Rehearsal cards should disclose no generation, insertion, sending, or execution',
);
assert.match(
  contentScriptSource,
  /只读提示，不写入\/插入\/发送/,
  'Expanded Card should disclose that ordinary Lens cards are read-only',
);
assert.match(
  contentScriptSource,
  /只读检索，不保存\/插入\/外发/,
  'Selection Search cards should disclose no save, insert, or external send action',
);
assert.match(
  contentScriptSource,
  /个人记忆已进入本次提示/,
  'Memory Lens should visibly warn when passive recall surfaces personal memory',
);
assert.match(
  contentScriptSource,
  /行动前复核/,
  'stale Memory Lens source receipts should prompt users to re-check before acting',
);
assert.match(
  contentScriptSource,
  /记忆入口已隐藏/,
  'unsafe memory explore routes should be disclosed instead of disappearing silently',
);
assert.match(
  contentScriptSource,
  /policyReceipt/,
  'Memory Capture candidate UI should consume the structured policy receipt from the scoring API',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureCandidateReceipt/,
  'Memory Capture chips and review panels should render policy receipts before falling back to raw score reasons',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSourceBoundaryReceipt/,
  'Whole-page Memory Capture review should expose source/scope boundary before saving',
);
assert.match(
  contentScriptSource,
  /formatMemoryCapturePreReviewReceipt/,
  'Whole-page Memory Capture chip should expose a pre-review no-write receipt before opening the panel',
);
assert.match(
  contentScriptSource,
  /未写入 · 先复核/,
  'Whole-page Memory Capture chip should show a compact no-write review label on hover or focus',
);
assert.match(
  contentScriptSource,
  /不会因点击直接保存、外发或同步/,
  'Whole-page Memory Capture pre-review receipt should clarify the chip click has no direct writeback or egress',
);
assert.match(
  contentScriptSource,
  /pai-memory-capture-page-chip--pending-review:hover[\s\S]*width: 184px/,
  'Whole-page Memory Capture pending-review chip should expand enough to show the receipt',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSaveFailureReceipt/,
  'Memory Capture save failures should render a structured no-write retry receipt',
);
assert.match(
  contentScriptSource,
  /自动入库失败/,
  'Automatic whole-page Memory Capture failures should not be silent',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureAutoSavePendingReceipt/,
  'Automatic whole-page Memory Capture should expose a pending receipt while the save request is in flight',
);
assert.match(
  contentScriptSource,
  /页面资料入库提交中/,
  'Automatic whole-page Memory Capture pending toast should be visibly distinct from a confirmed save',
);
assert.match(
  contentScriptSource,
  /尚未确认创建 source-memory capsule 或写入/,
  'Automatic whole-page Memory Capture pending receipt should say no capsule or recall signal has been confirmed yet',
);
assert.match(
  contentScriptSource,
  /写 confirmed profile 或创建任务/,
  'Automatic whole-page Memory Capture pending receipt should keep downstream profile/task side effects out of scope',
);
assert.match(
  contentScriptSource,
  /pai-context-toast--memory-capture-auto:hover[\s\S]*flex-wrap: wrap/,
  'Automatic Memory Capture toast should expand into a readable multi-line receipt on hover',
);
assert.match(
  contentScriptSource,
  /pai-context-toast--memory-capture-auto \.pai-context-toast-detail[\s\S]*white-space: normal/,
  'Automatic Memory Capture toast detail should not clip the write receipt as one nowrap line',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureWriteReceipt/,
  'Memory Capture save success should render the API-provided write receipt',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureDuplicateWriteReceipt/,
  'Memory Capture duplicate saves should use a duplicate-specific receipt instead of the generic write receipt',
);
assert.match(
  contentScriptSource,
  /本次没有新建第二条资料/,
  'Memory Capture duplicate no-note receipts should say no new capsule was created',
);
assert.match(
  contentScriptSource,
  /没有更新备注或正文/,
  'Memory Capture duplicate no-note receipts should say existing content was not updated',
);
assert.match(
  contentScriptSource,
  /showContextToast\(\s*'已存入记忆',\s*buildSourceMemoryDetailToastAction\(capsuleId\),[\s\S]{0,900}ariaLabel: '撤销本次自动入库'/,
  'Automatic whole-page Memory Capture success should offer both inspect and undo actions',
);
assert.match(
  contentScriptSource,
  /showContextToast\(\s*'已撤销本网页自动入库',\s*undefined,[\s\S]{0,260}formatMemoryCaptureWriteReceipt\(response\.result\?\.capsule\)/,
  'Automatic whole-page Memory Capture undo should display the API-provided dismissed write receipt',
);
assert.match(
  contentScriptSource,
  /不会自动外发、插入或同步|不会自动外发、插入输入框或同步/,
  'Memory Capture write receipts should disclose no external send, insert, or sync side effect',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSourceBoundaryReceipt\(\s*this\.buildMemoryCaptureSelectionRequest\(payload\)/,
  'Selected-text Memory Capture review should expose source/scope boundary before saving',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSelectionSnapshotReceipt/,
  'Selected-text Memory Capture review should expose the selected-text snapshot that will be saved',
);
assert.match(
  contentScriptSource,
  /formatMemoryCapturePageSnapshotReceipt/,
  'Whole-page Memory Capture should expose the exact page snapshot basis that will be saved',
);
assert.match(
  contentScriptSource,
  /formatMemoryCapturePageTriggerReceipt/,
  'Whole-page Memory Capture should expose the local trigger basis for suggestion and auto-save',
);
assert.match(
  contentScriptSource,
  /页面快照：将保存/,
  'Whole-page Memory Capture page snapshot receipt should be visible to the user',
);
assert.match(
  contentScriptSource,
  /不会重新抓取页面或改成之后滚动、跳转后的内容/,
  'Whole-page Memory Capture page snapshot receipt should clarify notes do not retarget a later page state',
);
assert.match(
  contentScriptSource,
  /这是当前浏览器本地行为信号，不代表系统确认页面事实/,
  'Whole-page Memory Capture trigger receipt should avoid overclaiming page truth',
);
assert.match(
  contentScriptSource,
  /pai-memory-capture-page-snapshot/,
  'Whole-page Memory Capture review panel should render page snapshot receipt as a distinct visible row',
);
assert.match(
  contentScriptSource,
  /pai-memory-capture-page-trigger/,
  'Whole-page Memory Capture review panel should render trigger basis receipt as a distinct visible row',
);
assert.match(
  contentScriptSource,
  /不会重新抓取页面或改成当前新的选区/,
  'Selected-text snapshot receipt should disclose that notes do not rescan or retarget the page selection',
);
assert.match(
  contentScriptSource,
  /没有创建资料记忆或\$\{getMemoryCaptureWriteSignalLabel\(request\)\}/,
  'Memory Capture failure receipt should state that no capsule or search signal was written',
);
assert.match(
  sourceMemoryServiceSource,
  /saved_with_recall_signal/,
  'Memory Capture API should expose a post-save write receipt when the recall/search signal is active',
);
assert.match(
  sourceMemoryServiceSource,
  /saved_without_recall_signal/,
  'Memory Capture API should disclose saved capsules whose linked recall/search signal is missing',
);
assert.doesNotMatch(
  contentScriptSource,
  /当前页面上下文已变化，未保存。/,
  'Memory Capture context-change failures should not fall back to an ambiguous no-save sentence',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSaveFailureReceipt\(\s*'选区资料',\s*'页面上下文已变化，请重新选择要保存的资料'/,
  'Selected-text context changes should reuse the structured no-write retry receipt',
);
assert.match(
  contentScriptSource,
  /formatMemoryCaptureSaveFailureReceipt\(\s*'页面资料',\s*'页面上下文已变化，请重新选择要保存的资料'/,
  'Whole-page context changes should reuse the structured no-write retry receipt',
);
assert.match(
  contentScriptSource,
  /pai-context-site-control-receipt/,
  'Memory Lens more menu should render a structured site-control boundary receipt',
);
assert.match(
  contentScriptSource,
  /只影响右下角 Lens、页面召回和被动入库候选|只影响右下角 Lens、页面召回、整页\/视觉入库候选/,
  'Memory Lens site-control receipt should name passive processing scope',
);
assert.match(
  contentScriptSource,
  /当前状态/,
  'Memory Lens site-control receipt should show the current host control status',
);
assert.match(
  contentScriptSource,
  /会开启白名单并允许此站点[\s\S]{0,160}只影响被动网页处理/,
  'Memory Lens site-control receipt should explain the allow action before users click it',
);
assert.match(
  contentScriptSource,
  /将移除 \$\{conflictCount\} 条覆盖此站点的静默\/屏蔽规则/,
  'Memory Lens allow action should disclose covered mute/block conflict cleanup',
);
assert.match(
  contentScriptSource,
  /会保存当前站点屏蔽设置[\s\S]{0,180}允许\/静默\/旧屏蔽覆盖规则/,
  'Memory Lens block action should disclose allow/mute conflict cleanup',
);
assert.match(
  contentScriptSource,
  /主动划词仍可用/,
  'Memory Lens site controls should disclose that active selection search remains available',
);
assert.match(
  contentScriptSource,
  /不删除、不同步、不外发已有记忆|不删除已有记忆/,
  'Memory Lens site controls should not look like deletion or external sharing actions',
);
assert.match(
  optionsSource,
  /context-site-control-status/,
  'Options should render a persistent Memory Lens site-control status receipt',
);
assert.match(
  optionsSource,
  /站点控制状态/,
  'Options site-control receipt should have a visible title',
);
assert.match(
  optionsSource,
  /右下角 Lens、页面召回、整页\/视觉入库候选/,
  'Options site-control receipt should name passive processing scope',
);
assert.match(
  optionsSource,
  /白名单已开启但没有允许站点：普通网页被动提示全部保持静默/,
  'Options site-control receipt should warn when allowlist mode has no allowed sites',
);
assert.match(
  optionsSource,
  /主动划词检索仍可用/,
  'Options site-control receipt should preserve active selection search boundary',
);
assert.match(
  optionsSource,
  /不删除、不同步、不外发已有记忆，也不反写当前网站/,
  'Options site-control receipt should state non-effects of site controls',
);
assert.match(
  contentScriptSource,
  /已永久关闭此页面路径记忆提示[\s\S]{0,900}主动划词仍可用[\s\S]{0,400}不会删除、同步或外发已有记忆/,
  'Memory Lens page-path block toast should preserve active selection and no-delete/no-sync/no-egress boundaries',
);
assert.match(
  contentScriptSource,
  /siteControlSyncToastSuppressedUntil/,
  'Memory Lens live site-control receipts should suppress duplicate toasts from same-page actions',
);
assert.match(
  contentScriptSource,
  /站点控制已生效：已停止此页被动记忆提示[\s\S]{0,500}已清除右下角 Lens、页面召回和被动入库候选[\s\S]{0,300}主动划词仍可用[\s\S]{0,300}不会删除、同步或外发已有记忆/,
  'Memory Lens live site-control suppression receipt should explain current-page passive stop and non-effects',
);
assert.match(
  contentScriptSource,
  /站点控制已恢复：重新评估此页记忆提示[\s\S]{0,500}重新评估右下角 Lens、页面召回和被动入库候选[\s\S]{0,300}主动划词仍受敏感页保护[\s\S]{0,300}不会写入、删除或外发记忆/,
  'Memory Lens live site-control restore receipt should explain current-page re-evaluation and non-effects',
);
assert.match(
  contentScriptSource,
  /已恢复此页面路径记忆提示[\s\S]{0,700}主动划词仍受敏感页保护[\s\S]{0,300}不会写入、删除或外发记忆/,
  'Memory Lens page-path restore toast should state the restored passive-only scope',
);
assert.match(
  optionsSource,
  /formatSiteControlActionReceipt\(\s*`已永久关闭 \$\{prefix\} 下的被动网页处理`/,
  'Options page-path block result should not sound like deletion or full active-search disablement',
);
assert.match(
  optionsSource,
  /formatSiteControlActionReceipt\(\s*`已移除 \$\{prefix\} 下的页面路径屏蔽`/,
  'Options page-path restore result should state the passive-only recovery boundary',
);
assert.match(
  optionsSource,
  /白名单模式仍会让此站点的被动提示保持静默，除非重新加入允许列表/,
  'Options site-control action receipt should distinguish removing a rule from restoring passive prompts under allowlist mode',
);
assert.match(
  optionsSource,
  /已打开页面会实时重新评估右下角 Lens、页面召回和被动入库候选/,
  'Options site-control action receipt should explain the live-page re-evaluation effect',
);
assert.match(
  optionsSource,
  /主动划词仍可用；不会写入、删除、同步或外发已有记忆/,
  'Options site-control action receipt should keep active selection and no-write/no-egress boundaries visible',
);
assert.match(
  optionsSource,
  /formatSiteControlButtonBoundary/,
  'Options should centralize Memory Lens site-control button boundary copy',
);
assert.match(
  optionsSource,
  /刷新只重读本机 extension storage 的站点控制快照，不新增、恢复或删除规则/,
  'Options refresh control should disclose read-only local snapshot scope before click',
);
assert.match(
  optionsSource,
  /开启白名单模式：仅允许列表内站点被动提示/,
  'Options allowlist toggle should disclose the passive prompt scope before click',
);
assert.match(
  optionsSource,
  /默认模式下只是保存允许候选；开启白名单后才限制为允许列表/,
  'Options allow-site button should distinguish saved allow candidates from active allowlist mode',
);
assert.match(
  optionsSource,
  /title=\{allowSiteBoundary\}[\s\S]{0,120}aria-label=\{allowSiteBoundary\}/,
  'Options allow-site button should expose the boundary through title and aria-label',
);
assert.match(
  optionsSource,
  /title=\{blockSiteBoundary\}[\s\S]{0,120}aria-label=\{blockSiteBoundary\}/,
  'Options block-site button should expose the boundary through title and aria-label',
);
assert.match(
  optionsSource,
  /title=\{buildUnblockPageBoundary\(page\.prefix\)\}[\s\S]{0,140}aria-label=\{buildUnblockPageBoundary\(page\.prefix\)\}/,
  'Options page-path restore button should expose the boundary through title and aria-label',
);
assert.match(
  contentScriptSource,
  /资料记忆和网页检索信号/,
  'Whole-page Memory Capture review should explain the source-memory plus web search write path',
);
assert.match(
  contentScriptSource,
  /点击只打开已命中的本轮划词结果；不二次召回、不保存、不插入、不发送、不调用外部 AI/,
  'Selection Memory Search card should disclose that opening uses already matched candidates without recall or side effects',
);
assert.match(
  contentScriptSource,
  /trigger\.dataset\.tooltipPlacement\s*=\s*top < 58 \? 'bottom' : 'top'/,
  'Selection Memory Search trigger should flip its tooltip below the icon near the top viewport edge',
);
assert.match(
  contentScriptSource,
  /pai-context-selection-trigger\[data-tooltip-placement='bottom'\] \.pai-context-selection-tooltip/,
  'Selection Memory Search tooltip CSS should support below-icon placement',
);
assert.match(
  contentScriptSource,
  /本轮 \$\{safeCount\} 条强相关候选；当前第 \$\{currentIndex \+ 1\} 条/,
  'Selection Memory Search card should show candidate count and current candidate position',
);
assert.match(
  sourceMemoryServiceSource,
  /建议复核入库/,
  'Memory Capture scoring API should expose a user-readable review receipt state',
);

console.log('[verify-webpage-memory-detection] helper checks passed');
