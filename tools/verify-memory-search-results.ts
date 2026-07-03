import assert from 'node:assert/strict';

import {
  buildMemoryLinkRecoveryCopiedReceipt,
  buildMemoryLinkRecoveryCopyFailureReceipt,
  buildMemoryLinkRecoveryDiagnostic,
  buildMemoryOpenReceipt,
  formatScopeBreakdownLabel,
  formatScopeBoundaryNotice,
  formatEmptySearchReceipt,
  formatEvidenceChannelOverlapReceipt,
  formatSourceCoverageReceipt,
  formatRecallChannelDiagnostics,
  formatRecallChannelReceipt,
  formatMemoryLinkSafetyStatus,
  formatMemoryTimestamp,
  getScopeBreakdown,
  getRecallChannelLabel,
  getMemoryLinkSafetyState,
  getResultChannels,
  getResultMeta,
  getScopeLabel,
  getSearchResultKey,
  getSearchHighlightTokens,
  normalizeMemorySourceUrl,
  renderHighlightedSearchText,
  sanitizeMemoryExploreRoute,
  shouldResetTypeFilter,
  formatTypeFilterChipAriaLabel,
  formatTypeFilterChipHint,
  formatTypeFilterReceipt,
} from '../src/modals/searchResultPresentation.js';

assert.equal(getScopeLabel('work'), '工作记忆');
assert.equal(getScopeLabel('personal'), '个人记忆');
assert.equal(getScopeLabel('all'), '全部记忆');
assert.equal(getScopeLabel('both'), '全部记忆');
assert.deepEqual(getSearchHighlightTokens('feedback query'), [
  'feedback',
  'query',
]);
assert.equal(
  renderHighlightedSearchText('Search feedback memory', 'feedback query'),
  'Search <mark class="search-highlight">feedback</mark> memory',
);
assert.equal(
  renderHighlightedSearchText('<script>alert(1)</script> feedback', 'feedback'),
  '&lt;script&gt;alert(1)&lt;/script&gt; <mark class="search-highlight">feedback</mark>',
);
assert.equal(renderHighlightedSearchText('unchanged', 'x'), 'unchanged');
assert.equal(
  renderHighlightedSearchText('C++ parser', 'C++'),
  '<mark class="search-highlight">C++</mark> parser',
);
assert.deepEqual(
  getScopeBreakdown([
    { id: 'work-message', scope: 'work' },
    { id: 'personal-message', scope: 'personal' },
    { id: 'metadata-work', metadata: { scope: 'work' } },
    { id: 'legacy-message' },
  ]),
  { work: 2, personal: 1, unknown: 1, total: 4 },
);
assert.deepEqual(
  getScopeBreakdown([
    {
      id: 'authoritative-column-scope',
      scope: 'work',
      metadata: { scope: 'personal' },
    },
  ]),
  { work: 1, personal: 0, unknown: 0, total: 1 },
);
assert.equal(
  formatScopeBreakdownLabel([
    { id: 'work-message', scope: 'work' },
    { id: 'personal-message', scope: 'personal' },
  ]),
  '工作 1 · 个人 1',
);
assert.equal(formatScopeBreakdownLabel([]), '');
assert.equal(
  formatScopeBoundaryNotice([{ id: 'work-message', scope: 'work' }], 'work'),
  '本次仅检索工作记忆，未纳入个人记忆。',
);
assert.equal(
  formatScopeBoundaryNotice([{ id: 'personal-message', scope: 'personal' }], 'personal'),
  '本次仅检索个人记忆，未纳入工作记忆。',
);
assert.equal(
  formatScopeBoundaryNotice([{ id: 'personal-message', scope: 'personal' }], 'all'),
  '',
);
assert.equal(formatScopeBoundaryNotice([], 'work'), '');
assert.deepEqual(
  formatEmptySearchReceipt({
    mode: 'entity',
    query: 'launch blocker',
    scope: 'work',
    source: 'recall',
    entityTypeLabel: '人物',
    resultCount: 0,
    channelDiagnostics: [
      { channel: 'vector', status: 'skipped', candidateCount: 0, reason: 'embedding_unavailable' },
      { channel: 'fts', status: 'empty', candidateCount: 0 },
      { channel: 'graph', status: 'empty', candidateCount: 0 },
    ],
  }),
  {
    title: '真实空结果回执',
    detail:
      'Memory Service 已完成记忆召回，但当前工作记忆没有返回可展示结果；空结果只代表本轮查询和已返回通道没有命中，不会写入、删除、同步外部来源、刷新连接器、写反馈或确认事实。',
    tone: 'warning',
    metrics: [
      '范围 工作记忆',
      '实体搜索 人物',
      '通道 0/3 命中',
      '未运行 1',
      '无命中 2',
      '无写入',
    ],
    recoveryActions: [
      '可用同一关键词扩展到全部记忆。',
      '可换更具体的人名、项目名、时间或来源词重新搜索。',
      '如果相关内容刚导入或刚保存，等索引完成后再搜；本页不会主动刷新连接器。',
    ],
  },
);
assert.deepEqual(
  formatEmptySearchReceipt({
    mode: 'overview',
    query: 'quick ask',
    scope: 'all',
    source: 'ask',
    resultCount: 0,
  }),
  {
    title: '真实空结果回执',
    detail:
      'Memory Service 已完成 Ask 证据搜索，但没有返回可展示结果或通道诊断；这不是模拟结果，也不会写入、删除、同步外部来源、刷新连接器、写反馈或确认事实。',
    tone: 'info',
    metrics: [
      '范围 全部记忆',
      'Ask 智能搜索',
      '通道未返回',
      '无写入',
    ],
    recoveryActions: [
      '可换更具体的人名、项目名、时间或来源词重新搜索。',
      '如果相关内容刚导入或刚保存，等索引完成后再搜；本页不会主动刷新连接器。',
    ],
  },
);
assert.equal(
  formatEmptySearchReceipt({
    query: 'has results',
    resultCount: 1,
  }),
  null,
);
assert.deepEqual(
  formatSourceCoverageReceipt({
    visibleResults: [
      { id: 'work-message', sourceTitle: 'Roadmap' },
      { id: 'work-chunk', sourceTitle: 'Roadmap' },
      { id: 'personal-message', source: 'manual' },
      { id: 'web-memory', sourceUrl: 'https://example.com/source/path' },
    ],
    totalResults: [
      { id: 'work-message', sourceTitle: 'Roadmap' },
      { id: 'work-chunk', sourceTitle: 'Roadmap' },
      { id: 'personal-message', source: 'manual' },
      { id: 'web-memory', sourceUrl: 'https://example.com/source/path' },
    ],
    selectedTypeFilter: 'all',
    selectedTypeLabel: '全部',
  }),
  {
    title: '来源覆盖回执',
    detail:
      '当前 4 条结果覆盖 3 个来源/标题；这是本页对已返回结果的本地来源摘要，不会重新读取来源、刷新连接器、写反馈或确认事实。',
    tone: 'info',
    metrics: ['来源 3', 'Top Roadmap 2', '结果 4', '本地摘要'],
  },
);
assert.deepEqual(
  formatSourceCoverageReceipt({
    visibleResults: [
      { id: 'message-1', sourceTitle: 'Single source' },
      { id: 'message-2', sourceTitle: 'Single source' },
    ],
    totalResults: [
      { id: 'message-1', sourceTitle: 'Single source' },
      { id: 'message-2', sourceTitle: 'Single source' },
    ],
  }),
  {
    title: '来源覆盖回执',
    detail:
      '当前 2 条结果都来自 Single source；这只说明本轮召回和本地筛选的来源分布，不代表其他来源没有相关记忆。查看或打开来源不会重新同步、写反馈或确认事实。',
    tone: 'warning',
    metrics: ['来源 1', 'Top Single source 2', '结果 2', '本地摘要'],
  },
);
assert.deepEqual(
  formatSourceCoverageReceipt({
    visibleResults: [{ id: 'chunk-1', sourceTitle: 'Personal source' }],
    totalResults: [
      { id: 'message-1', sourceTitle: 'Search source' },
      { id: 'chunk-1', sourceTitle: 'Personal source' },
    ],
    selectedTypeFilter: 'chunk',
    selectedTypeLabel: '片段',
  }),
  {
    title: '来源覆盖回执',
    detail:
      '当前片段可见 1/2 条结果都来自 Personal source；这只说明本轮召回和本地筛选的来源分布，不代表其他来源没有相关记忆。查看或打开来源不会重新同步、写反馈或确认事实。',
    tone: 'info',
    metrics: ['来源 1', 'Top Personal source 1', '可见 1/2', '本地摘要'],
  },
);
assert.equal(
  formatSourceCoverageReceipt({
    visibleResults: [{ id: 'message-1', sourceUrl: 'https://example.com/path?token=secret' }],
    totalResults: [{ id: 'message-1', sourceUrl: 'https://example.com/path?token=secret' }],
  }),
  null,
);
assert.deepEqual(
  formatTypeFilterReceipt({
    selectedTypeFilter: 'chunk',
    selectedTypeLabel: '片段',
    visibleCount: 1,
    totalCount: 3,
  }),
  {
    title: '类型筛选回执',
    detail:
      '当前仅显示片段类型 1/3 条；这是本页本地类型筛选，不会重新召回、重排、写反馈或隐藏服务端结果。',
    tone: 'info',
    metrics: ['筛选 片段', '已隐藏 2', '本地筛选'],
  },
);
assert.deepEqual(
  formatTypeFilterReceipt({
    selectedTypeFilter: 'message',
    selectedTypeLabel: '消息',
    visibleCount: 0,
    totalCount: 2,
  }),
  {
    title: '类型筛选无可见结果',
    detail:
      '当前消息类型没有可见结果；原始搜索仍返回 2 条，清除类型筛选即可恢复。',
    tone: 'warning',
    metrics: ['筛选 消息', '已隐藏 2', '本地筛选'],
  },
);
assert.equal(
  formatTypeFilterReceipt({
    selectedTypeFilter: 'all',
    selectedTypeLabel: '全部',
    visibleCount: 3,
    totalCount: 3,
  }),
  null,
);
assert.equal(
  formatTypeFilterReceipt({
    selectedTypeFilter: 'message',
    selectedTypeLabel: '消息',
    visibleCount: 2,
    totalCount: 2,
  }),
  null,
);

assert.equal(
  formatTypeFilterChipHint({
    key: 'all',
    name: '全部',
    count: 3,
    totalCount: 3,
    selectedTypeFilter: 'all',
  }),
  '当前显示 3 条',
);
assert.equal(
  formatTypeFilterChipHint({
    key: 'chunk',
    name: '片段',
    count: 1,
    totalCount: 3,
    selectedTypeFilter: 'all',
  }),
  '点击显示 1/3 · 隐藏 2',
);
assert.equal(
  formatTypeFilterChipHint({
    key: 'chunk',
    name: '片段',
    count: 1,
    totalCount: 3,
    selectedTypeFilter: 'chunk',
  }),
  '当前显示 1/3 条',
);
assert.equal(
  formatTypeFilterChipAriaLabel({
    key: 'chunk',
    name: '片段',
    count: 1,
    totalCount: 3,
    selectedTypeFilter: 'all',
  }),
  '片段类型筛选：点击显示 1/3 · 隐藏 2；本地筛选，不会重新召回、重排或写反馈。',
);

assert.equal(getRecallChannelLabel('vector'), '语义');
assert.equal(getRecallChannelLabel('direct'), '定位');
assert.equal(getRecallChannelLabel('unknown'), 'unknown');
assert.deepEqual(
  formatRecallChannelDiagnostics([
    { channel: 'vector', status: 'skipped', candidateCount: 0, reason: 'embedding_unavailable' },
    { channel: 'fts', status: 'hit', candidateCount: 3 },
    { channel: 'graph', status: 'empty', candidateCount: 0 },
    { channel: '', status: 'hit', candidateCount: 1 },
  ]).map(({ label, tone, title, reasonLabel }) => ({
    label,
    tone,
    title,
    reasonLabel,
  })),
  [
    {
      label: '语义 未运行',
      tone: 'warning',
      title: '语义: 语义索引不可用',
      reasonLabel: '语义索引不可用',
    },
    { label: '关键词 命中 3', tone: 'ok', title: '关键词', reasonLabel: '' },
    { label: '图谱 无命中', tone: 'muted', title: '图谱', reasonLabel: '' },
  ],
);
assert.deepEqual(
  formatRecallChannelReceipt([
    { channel: 'vector', status: 'skipped', candidateCount: 0, reason: 'embedding_unavailable' },
    { channel: 'fts', status: 'hit', candidateCount: 3 },
    { channel: 'graph', status: 'empty', candidateCount: 0 },
    { channel: 'time', status: 'empty', candidateCount: 0 },
  ]),
  {
    title: '召回通道回执',
    summary: '本轮结果来自 1/4 个召回通道：关键词3。未完整覆盖：语义未运行、图谱无命中、时间无命中。',
    detail:
      '未运行、失败或无命中不代表记忆不存在；当前结果只代表已命中的通道，查看或刷新不会写入、删除、同步外部来源或确认答案。',
    diagnostics: ['语义未运行：语义索引不可用'],
    tone: 'warning',
  },
);
assert.deepEqual(
  formatEvidenceChannelOverlapReceipt({
    visibleResults: [
      { id: 'semantic-keyword', channels: ['vector', 'fts'] },
      { id: 'keyword-only', channels: ['fts'] },
      { id: 'legacy-no-channel' },
    ],
  }),
  {
    title: '证据通道交叉回执',
    summary:
      '当前 3 条可见结果中，1 条由多个召回通道共同命中，1 条为单通道，1 条未标明通道。常见交叉：语义+关键词 1。',
    detail:
      '这是已返回证据的本地交叉支持摘要；多通道命中只说明同一证据被多条检索路径找回，不等于事实已确认，也不会重新召回、重排、写反馈或写入记忆。',
    tone: 'info',
    metrics: [
      '多通道 1',
      '单通道 1',
      '未标明 1',
      '交叉 语义+关键词 1',
      '本地摘要',
    ],
  },
);
assert.deepEqual(
  formatEvidenceChannelOverlapReceipt({
    visibleResults: [
      { id: 'keyword-a', channels: ['fts'] },
      { id: 'keyword-b', channels: ['fts'] },
    ],
  }),
  {
    title: '证据通道交叉回执',
    summary:
      '当前 2 条可见结果中，2 条为单通道。当前没有证据被多个通道共同命中。',
    detail:
      '这是已返回证据的本地交叉支持摘要；多通道命中只说明同一证据被多条检索路径找回，不等于事实已确认，也不会重新召回、重排、写反馈或写入记忆。',
    tone: 'warning',
    metrics: ['多通道 0', '单通道 2', '本地摘要'],
  },
);
assert.equal(
  formatEvidenceChannelOverlapReceipt({
    visibleResults: [{ id: 'single-result', channels: ['fts'] }],
  }),
  null,
);
assert.deepEqual(
  formatRecallChannelReceipt([
    { channel: 'vector', status: 'failed', candidateCount: 0, reason: 'EmbeddingClient.embed timed out after 800ms' },
    { channel: 'fts', status: 'hit', candidateCount: 2 },
  ])?.diagnostics,
  ['语义失败：通道超时'],
);
assert.deepEqual(
  formatRecallChannelReceipt([
    { channel: 'vector', status: 'hit', candidateCount: 2 },
    { channel: 'fts', status: 'hit', candidateCount: 1 },
  ]),
  {
    title: '召回通道回执',
    summary: '本轮 2 个召回通道都返回候选：语义2、关键词1。',
    detail:
      '未运行、失败或无命中不代表记忆不存在；当前结果只代表已命中的通道，查看或刷新不会写入、删除、同步外部来源或确认答案。',
    diagnostics: [],
    tone: 'ok',
  },
);
assert.equal(formatRecallChannelReceipt([]), null);
assert.equal(getSearchResultKey({ resultKey: 'message:101' }), 'message:101');
assert.equal(
  getSearchResultKey({ id: '101', recallType: 'chunk', type: 'message' }),
  'chunk:101',
);
assert.equal(getSearchResultKey({ id: '101', type: 'message' }), 'message:101');
assert.deepEqual(getResultChannels({ channels: ['vector', '', 1, 'fts'] }), [
  'vector',
  'fts',
]);

assert.deepEqual(
  getResultMeta({
    sourceTitle: 'Roadmap',
    source: 'jira',
    timestamp: 1_704_067_200,
  }),
  ['Roadmap', formatMemoryTimestamp(1_704_067_200)],
);

assert.equal(
  sanitizeMemoryExploreRoute('#/timeline?type=message&focus=msg-1'),
  '#/timeline?type=message&focus=msg-1',
);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=msg-1'), '#/timeline?focus=msg-1');
assert.equal(
  sanitizeMemoryExploreRoute('#/entity/Person?focus=person-1'),
  '#/entity/Person?focus=person-1',
);
assert.equal(sanitizeMemoryExploreRoute('#/topic/topic-1'), '#/topic/topic-1');
assert.equal(sanitizeMemoryExploreRoute('memory-exploring.html#/timeline'), null);
assert.equal(sanitizeMemoryExploreRoute('javascript:alert(1)'), null);
assert.equal(sanitizeMemoryExploreRoute('#//evil.example/path'), null);
assert.equal(sanitizeMemoryExploreRoute('#/settings'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline\n?focus=msg-1'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=<img>'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=%3Cimg%3E'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=%22x%22'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=%0Amsg-1'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=abc%20def'), '#/timeline?focus=abc%20def');
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=abc%'), null);

assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?q=1'),
  'https://example.com/path?q=1',
);
assert.equal(
  normalizeMemorySourceUrl('http://user:pass@example.com/path'),
  null,
);
assert.equal(normalizeMemorySourceUrl('/relative/path'), null);
assert.equal(normalizeMemorySourceUrl('javascript:alert(1)'), null);
assert.equal(normalizeMemorySourceUrl('https://example.com/path?token=secret'), null);
assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?auth-token=secret'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://idp.example.com/callback?SAMLResponse=secret'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://idp.example.com/callback?RelayState=secret'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?jwt=secret'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?ticket=secret'),
  null,
);
assert.equal(
  normalizeMemorySourceUrl(
    'https://files.example.com/private.pdf?X-Amz-Signature=abc&X-Amz-Credential=scope',
  ),
  null,
);
assert.equal(
  normalizeMemorySourceUrl(
    'https://cdn.example.com/private.pdf?Expires=1712345678&KeyName=edge&Signature=abc',
  ),
  null,
);
assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?expires=1712345678'),
  'https://example.com/path?expires=1712345678',
);
assert.deepEqual(
  getMemoryLinkSafetyState({
    exploreLink: '#/timeline?focus=%3Cimg%3E',
    sourceUrl: 'javascript:alert(1)',
  }),
  {
    exploreRoute: null,
    sourceUrl: null,
    sourceHost: '',
    blockedLabels: [
      '记忆内跳转已隐藏：不支持的目标',
      '来源链接已隐藏：仅支持 http/https',
    ],
  },
);
assert.deepEqual(
  getMemoryLinkSafetyState({
    exploreLink: '#/timeline?type=message&focus=msg-1',
    sourceUrl: 'https://user:pass@example.com/path',
  }),
  {
    exploreRoute: '#/timeline?type=message&focus=msg-1',
    sourceUrl: null,
    sourceHost: '',
    blockedLabels: ['来源链接已隐藏：包含账号信息'],
  },
);
assert.deepEqual(
  getMemoryLinkSafetyState({
    sourceUrl:
      'https://files.example.com/private.pdf?X-Goog-Signature=abc&X-Goog-Credential=scope',
  }),
  {
    exploreRoute: null,
    sourceUrl: null,
    sourceHost: '',
    blockedLabels: ['来源链接已隐藏：包含签名或访问凭据参数'],
  },
);

const internalRouteSafetyStatus = formatMemoryLinkSafetyStatus(
  getMemoryLinkSafetyState({
    exploreLink: '#/timeline?type=message&focus=msg-1',
    sourceUrl: 'https://example.com/path',
  }),
);
assert.equal(internalRouteSafetyStatus.label, '可在记忆中查看');
assert.equal(internalRouteSafetyStatus.tone, 'ready');
assert.deepEqual(internalRouteSafetyStatus.metrics, [
  '记忆内跳转',
  '来源 example.com',
]);
assert.ok(
  internalRouteSafetyStatus.detail.includes('不会打开外部网页或改写记忆'),
);

const safeSourceSafetyStatus = formatMemoryLinkSafetyStatus(
  getMemoryLinkSafetyState({
    sourceUrl: 'https://example.com/source',
  }),
);
assert.equal(safeSourceSafetyStatus.label, '可打开安全来源');
assert.equal(safeSourceSafetyStatus.tone, 'ready');
assert.ok(safeSourceSafetyStatus.metrics.includes('无凭据参数'));

const blockedSafetyStatus = formatMemoryLinkSafetyStatus(
  getMemoryLinkSafetyState({
    exploreLink: '#/settings',
    sourceUrl:
      'https://files.example.com/private.pdf?X-Goog-Signature=abc&X-Goog-Credential=scope',
  }),
);
assert.equal(blockedSafetyStatus.label, '来源或跳转已隐藏');
assert.equal(blockedSafetyStatus.tone, 'warning');
assert.ok(blockedSafetyStatus.detail.includes('不支持的目标'));
assert.ok(blockedSafetyStatus.detail.includes('包含签名或访问凭据参数'));
assert.ok(blockedSafetyStatus.metrics.includes('2 项原因'));

const unavailableSafetyStatus = formatMemoryLinkSafetyStatus(
  getMemoryLinkSafetyState({}),
);
assert.equal(unavailableSafetyStatus.label, '暂无可打开目标');
assert.equal(unavailableSafetyStatus.tone, 'muted');
assert.deepEqual(unavailableSafetyStatus.metrics, ['只读卡片']);

const memoryRouteReceipt = buildMemoryOpenReceipt({
  action: 'memory_route',
  resultTitle: 'Search result memory',
  exploreRoute: '#/timeline?type=message&focus=msg-1',
});
assert.equal(memoryRouteReceipt.title, '打开动作回执');
assert.equal(memoryRouteReceipt.tone, 'info');
assert.ok(
  memoryRouteReceipt.items.some((item) =>
    item.includes('记忆内跳转：已进入 #/timeline?type=message&focus=msg-1'),
  ),
);
assert.ok(
  memoryRouteReceipt.items.some((item) =>
    item.includes('不会改写记忆、反馈或来源资料'),
  ),
);

const sourceOpenReceipt = buildMemoryOpenReceipt({
  action: 'source_url',
  resultTitle: 'Safe source memory',
  sourceHost: 'example.com',
});
assert.equal(sourceOpenReceipt.tone, 'info');
assert.ok(
  sourceOpenReceipt.items.some((item) =>
    item.includes('已请求浏览器打开 example.com'),
  ),
);
assert.ok(
  sourceOpenReceipt.items.some((item) =>
    item.includes('不代表 Memory Service 重新读取'),
  ),
);

const blockedOpenReceipt = buildMemoryOpenReceipt({
  action: 'blocked',
  resultTitle: 'Unsafe source memory',
  blockedLabels: [
    '来源链接已隐藏：仅支持 http/https',
    '记忆内跳转已隐藏：不支持的目标',
    '来源链接已隐藏：仅支持 http/https',
  ],
});
assert.equal(blockedOpenReceipt.tone, 'warning');
assert.ok(
  blockedOpenReceipt.items.some((item) =>
    item.includes(
      '来源链接已隐藏：仅支持 http/https；记忆内跳转已隐藏：不支持的目标',
    ),
  ),
);
assert.ok(
  blockedOpenReceipt.items.some((item) =>
    item.includes('等待上游写入安全 http/https 来源'),
  ),
);

const unsafeSearchDiagnostic = buildMemoryLinkRecoveryDiagnostic({
  result: {
    id: 'unsafe-search',
    resultKey: 'message:unsafe-search',
    type: 'message',
    sourceTitle: 'Unsafe source',
    sourceUrl:
      'https://files.example.com/private.pdf?X-Amz-Signature=abc&X-Amz-Credential=scope',
  },
  blockedLabels: [
    '记忆内跳转已隐藏：不支持的目标',
    '来源链接已隐藏：包含签名或访问凭据参数',
  ],
  queryLabel: 'feedback query',
  scopeLabel: '工作记忆',
  modeLabel: 'Ask 证据',
  typeFilterLabel: '全部',
});
assert.ok(unsafeSearchDiagnostic.includes('Personal AI 搜索结果链接安全诊断'));
assert.ok(unsafeSearchDiagnostic.includes('目标：Unsafe source'));
assert.ok(unsafeSearchDiagnostic.includes('结果键：message:unsafe-search'));
assert.ok(unsafeSearchDiagnostic.includes('查询：feedback query'));
assert.ok(unsafeSearchDiagnostic.includes('范围：工作记忆'));
assert.ok(unsafeSearchDiagnostic.includes('来源标签：Unsafe source'));
assert.ok(
  unsafeSearchDiagnostic.includes('来源链接已隐藏：包含签名或访问凭据参数'),
);
assert.ok(unsafeSearchDiagnostic.includes('没有复制被拦截的原始 URL'));
assert.ok(!unsafeSearchDiagnostic.includes('X-Amz-Signature'));
assert.ok(!unsafeSearchDiagnostic.includes('private.pdf'));

const copiedSearchDiagnosticReceipt = buildMemoryLinkRecoveryCopiedReceipt({
  resultTitle: 'Unsafe source',
});
assert.equal(copiedSearchDiagnosticReceipt.title, '安全诊断复制回执');
assert.equal(copiedSearchDiagnosticReceipt.tone, 'info');
assert.ok(
  copiedSearchDiagnosticReceipt.items.some((item) =>
    item.includes('不包含被拦截的原始 URL'),
  ),
);

const failedSearchDiagnosticReceipt = buildMemoryLinkRecoveryCopyFailureReceipt({
  resultTitle: 'Unsafe source',
});
assert.equal(failedSearchDiagnosticReceipt.tone, 'warning');
assert.ok(
  failedSearchDiagnosticReceipt.items.some((item) =>
    item.includes('浏览器没有允许写入剪贴板'),
  ),
);

const unavailableOpenReceipt = buildMemoryOpenReceipt({
  action: 'unavailable',
});
assert.equal(unavailableOpenReceipt.tone, 'warning');
assert.ok(
  unavailableOpenReceipt.items.some((item) =>
    item.includes('没有可打开的安全内链、详情页或 http/https 来源'),
  ),
);

assert.equal(
  shouldResetTypeFilter('Project', [{ key: 'all' }, { key: 'message' }]),
  true,
);
assert.equal(
  shouldResetTypeFilter('message', [{ key: 'all' }, { key: 'message' }]),
  false,
);
assert.equal(shouldResetTypeFilter('Project', []), false);

console.log('verify-memory-search-results: ok');
