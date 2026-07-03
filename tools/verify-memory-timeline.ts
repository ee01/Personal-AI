import assert from 'node:assert/strict';

import {
  formatMemoryLinkSafetyStatus,
  getMemoryLinkSafetyState,
} from '../src/modals/searchResultPresentation.js';
import {
  ALL_TIMELINE_SOURCE_FILTER_KEY,
  UNKNOWN_TIMELINE_SOURCE_FILTER_KEY,
  buildTimelineBoundaryReceipt,
  buildTimelineEmptyReceipt,
  buildTimelineLinkRecoveryCopiedReceipt,
  buildTimelineLinkRecoveryCopyFailureReceipt,
  buildTimelineLinkRecoveryDiagnostic,
  buildTimelineNavigationReceipt,
  buildTimelineRefreshFailureReceipt,
  buildTimelineRefreshingSnapshotReceipt,
  buildTimelineSourceFilterOptions,
  filterTimelineEventsBySource,
  formatTimelineClockTime,
  formatTimelineExactTime,
  formatTimelineTime,
  getTimelineRangeSeconds,
  getTimelineDateTimeValue,
  groupTimelineEventsByDay,
  mapRecallItemsToTimelineEvents,
  normalizeTimelineScope,
  parseTimelineFocus,
} from '../src/modals/timelinePresentation.js';

assert.equal(normalizeTimelineScope('work'), 'work');
assert.equal(normalizeTimelineScope('personal'), 'personal');
assert.equal(normalizeTimelineScope('both'), 'both');
assert.equal(normalizeTimelineScope('all'), 'all');
assert.equal(normalizeTimelineScope('invalid'), 'all');

assert.deepEqual(parseTimelineFocus('message:msg-1'), {
  id: 'msg-1',
  type: 'message',
  isLegacyTypedFocus: true,
});
assert.deepEqual(parseTimelineFocus('chunk:42'), {
  id: '42',
  type: 'chunk',
  isLegacyTypedFocus: true,
});
assert.deepEqual(parseTimelineFocus('msg-2', 'message'), {
  id: 'msg-2',
  type: 'message',
  isLegacyTypedFocus: false,
});
assert.deepEqual(parseTimelineFocus('msg-3'), {
  id: 'msg-3',
  isLegacyTypedFocus: false,
});

const fixedNoon = new Date(2026, 4, 9, 12, 34, 0).getTime();
const todayRange = getTimelineRangeSeconds(fixedNoon, 'today');
assert.equal(
  todayRange.start,
  Math.floor(new Date(2026, 4, 9, 0, 0, 0).getTime() / 1000),
);
assert.equal(todayRange.end, Math.floor(fixedNoon / 1000) + 60);

const recentRange = getTimelineRangeSeconds(fixedNoon, 'recent', 7);
assert.equal(recentRange.end - recentRange.start, 7 * 24 * 60 * 60);

const clampedRange = getTimelineRangeSeconds(fixedNoon, 'recent', 999);
assert.equal(clampedRange.end - clampedRange.start, 30 * 24 * 60 * 60);

const defaultRecentRange = getTimelineRangeSeconds(fixedNoon, 'recent', 0);
assert.equal(defaultRecentRange.end - defaultRecentRange.start, 24 * 60 * 60);

const nonFiniteRecentRange = getTimelineRangeSeconds(
  fixedNoon,
  'recent',
  Number.NaN,
);
assert.equal(
  nonFiniteRecentRange.end - nonFiniteRecentRange.start,
  24 * 60 * 60,
);

const events = mapRecallItemsToTimelineEvents([
  {
    id: 'older',
    type: 'message',
    content: 'Older memory content',
    score: 0.7,
    timestamp: 100,
    source: 'manual',
    metadata: { channels: ['time'] },
  },
  {
    id: 'newer',
    type: 'chunk',
    content: 'Newer memory content',
    displayTitle: 'Newer display title',
    displayText: 'Newer display text',
    score: 0.9,
    timestamp: 200,
    source: 'meeting',
    sourceUrl: 'https://example.com/source',
    sourceTitle: 'Source title',
    exploreLink: '#/timeline?focus=newer',
    metadata: { channels: ['time', '', 1, 'fts'] },
  },
] as any);

assert.equal(events[0].id, 'newer');
assert.equal(events[0].resultKey, 'chunk:newer');
assert.equal(events[0].title, 'Newer display title');
assert.equal(events[0].content, 'Newer display text');
assert.equal(events[0].sourceUrl, 'https://example.com/source');
assert.deepEqual(events[0].channels, ['time', 'fts']);
assert.equal(events[1].id, 'older');

const sourceOptions = buildTimelineSourceFilterOptions([
  ...events,
  {
    id: 'unknown-source',
    resultKey: 'message:unknown-source',
    type: 'message',
    title: 'Unknown source',
    content: 'No source metadata',
    channels: ['time'],
  },
]);
assert.equal(
  sourceOptions.find((option) => option.key === 'Source title')?.count,
  1,
);
assert.equal(sourceOptions.find((option) => option.key === 'manual')?.count, 1);
assert.equal(
  sourceOptions.find(
    (option) => option.key === UNKNOWN_TIMELINE_SOURCE_FILTER_KEY,
  )?.label,
  '来源未知',
);
assert.deepEqual(
  filterTimelineEventsBySource(events, ALL_TIMELINE_SOURCE_FILTER_KEY).map(
    (event) => event.id,
  ),
  ['newer', 'older'],
);
assert.deepEqual(
  filterTimelineEventsBySource(events, 'Source title').map((event) => event.id),
  ['newer'],
);

const allTimelineReceipt = buildTimelineBoundaryReceipt({
  scope: 'all',
  rangeLabel: '今天',
  sourceFilterKey: ALL_TIMELINE_SOURCE_FILTER_KEY,
  sourceFilterLabel: '全部来源',
  totalEventCount: 2,
  visibleEventCount: 2,
});
assert.equal(allTimelineReceipt.title, '全部 · 今天 · 时间轴回执');
assert.ok(
  allTimelineReceipt.items.some((item) =>
    item.includes('读取全部记忆；卡片仍保留工作/个人标签'),
  ),
);
assert.ok(
  allTimelineReceipt.items.some((item) =>
    item.includes('来源筛选只收窄本批结果'),
  ),
);

const filteredTimelineReceipt = buildTimelineBoundaryReceipt({
  scope: 'work',
  rangeLabel: '近7天',
  sourceFilterKey: 'Source title',
  sourceFilterLabel: 'Source title',
  totalEventCount: 4,
  visibleEventCount: 1,
  hasFocusedEvent: true,
});
assert.equal(filteredTimelineReceipt.title, '工作 · 近7天 · 时间轴回执');
assert.deepEqual(filteredTimelineReceipt.items, [
  '范围：只读取工作记忆；个人记忆没有进入本次时间轴。',
  '时间：通过 time 通道请求近7天窗口，结果按记忆时间分组。',
  '来源：当前只显示 Source title 的 1 条，隐藏 3 条其他来源；切回全部来源可恢复。',
  '定位：目标记忆已置顶；它可能来自当前时间窗或来源筛选之外，请按“定位目标”标记判断。',
]);

const emptyTimelineReceipt = buildTimelineEmptyReceipt({
  scope: 'personal',
  rangeLabel: '今天',
  sourceFilterKey: ALL_TIMELINE_SOURCE_FILTER_KEY,
  sourceFilterLabel: '全部来源',
  totalEventCount: 0,
  visibleEventCount: 0,
});
assert.equal(emptyTimelineReceipt.title, '时间轴空结果回执');
assert.ok(
  emptyTimelineReceipt.items.some((item) =>
    item.includes('读取成功，Memory Service 返回 0 条可展示记忆'),
  ),
);
assert.ok(
  emptyTimelineReceipt.items.some((item) =>
    item.includes('不是刷新失败'),
  ),
);
assert.ok(
  emptyTimelineReceipt.items.some((item) =>
    item.includes('没有删除记忆、清空索引、写入反馈或同步来源'),
  ),
);

const sourceEmptyTimelineReceipt = buildTimelineEmptyReceipt({
  scope: 'all',
  rangeLabel: '近7天',
  sourceFilterKey: 'Hidden source',
  sourceFilterLabel: 'Hidden source',
  totalEventCount: 4,
  visibleEventCount: 0,
});
assert.equal(sourceEmptyTimelineReceipt.title, '来源筛选空结果回执');
assert.ok(
  sourceEmptyTimelineReceipt.items.some((item) =>
    item.includes('已成功读取 4 条，但 Hidden source 下当前可见 0 条'),
  ),
);
assert.ok(
  sourceEmptyTimelineReceipt.items.some((item) =>
    item.includes('本地来源筛选后的 successful empty'),
  ),
);
assert.ok(
  sourceEmptyTimelineReceipt.items.some((item) =>
    item.includes('切回全部来源可显示被隐藏的 4 条'),
  ),
);

const encodedUnsafeTimelineLinkState = getMemoryLinkSafetyState({
  exploreLink: '#/timeline?focus=%3Cscript%3E',
  sourceUrl: 'https://idp.example.com/callback?SAMLResponse=secret',
});
assert.deepEqual(encodedUnsafeTimelineLinkState, {
  exploreRoute: null,
  sourceUrl: null,
  sourceHost: '',
  blockedLabels: [
    '记忆内跳转已隐藏：不支持的目标',
    '来源链接已隐藏：包含敏感参数',
  ],
});
const encodedUnsafeTimelineStatus = formatMemoryLinkSafetyStatus(
  encodedUnsafeTimelineLinkState,
);
assert.equal(encodedUnsafeTimelineStatus.label, '来源或跳转已隐藏');
assert.equal(encodedUnsafeTimelineStatus.tone, 'warning');
assert.ok(
  encodedUnsafeTimelineStatus.detail.includes('不支持的目标'),
);
assert.ok(
  encodedUnsafeTimelineStatus.detail.includes('包含敏感参数'),
);

const memoryRouteReceipt = buildTimelineNavigationReceipt({
  action: 'memory_route',
  eventTitle: 'Newer display title',
  exploreRoute: '#/timeline?type=message&focus=newer',
});
assert.equal(memoryRouteReceipt.title, '打开动作回执');
assert.equal(memoryRouteReceipt.tone, 'info');
assert.ok(
  memoryRouteReceipt.items.some((item) =>
    item.includes('记忆内跳转：已进入 #/timeline?type=message&focus=newer'),
  ),
);
assert.ok(
  memoryRouteReceipt.items.some((item) =>
    item.includes('不会改写记忆、反馈或来源资料'),
  ),
);

const sourceUrlReceipt = buildTimelineNavigationReceipt({
  action: 'source_url',
  eventTitle: 'Source-backed timeline memory',
  sourceHost: 'example.com',
});
assert.equal(sourceUrlReceipt.tone, 'info');
assert.ok(
  sourceUrlReceipt.items.some((item) =>
    item.includes('已请求浏览器打开 example.com'),
  ),
);
assert.ok(
  sourceUrlReceipt.items.some((item) =>
    item.includes('不代表 Memory Service 重新读取'),
  ),
);

const blockedNavigationReceipt = buildTimelineNavigationReceipt({
  action: 'blocked',
  eventTitle: 'Unsafe source memory',
  blockedLabels: [
    '来源链接已隐藏：仅支持 http/https',
    '记忆内跳转已隐藏：不支持的目标',
    '来源链接已隐藏：仅支持 http/https',
  ],
});
assert.equal(blockedNavigationReceipt.tone, 'warning');
assert.ok(
  blockedNavigationReceipt.items.some((item) =>
    item.includes(
      '来源链接已隐藏：仅支持 http/https；记忆内跳转已隐藏：不支持的目标',
    ),
  ),
);
assert.ok(
  blockedNavigationReceipt.items.some((item) =>
    item.includes('等待上游写入安全 http/https 来源'),
  ),
);

const unsafeDiagnostic = buildTimelineLinkRecoveryDiagnostic({
  event: {
    id: 'unsafe',
    resultKey: 'message:unsafe',
    type: 'message',
    title: 'Unsafe source memory',
    content: 'Unsafe source should not become a button.',
    timestamp: Math.floor(fixedNoon / 1000),
    source: 'manual',
    sourceTitle: 'Unsafe source',
    sourceUrl:
      'https://files.example.com/private.pdf?X-Amz-Signature=abc&X-Amz-Credential=scope',
    exploreLink: '#/timeline?focus=%3Cscript%3E',
    scope: 'work',
    channels: ['time'],
  },
  blockedLabels: [
    '记忆内跳转已隐藏：不支持的目标',
    '来源链接已隐藏：包含签名或访问凭据参数',
  ],
  scopeLabel: '工作记忆',
  rangeLabel: '今天',
  sourceFilterLabel: 'Unsafe source',
});
assert.ok(unsafeDiagnostic.includes('Personal AI 时间轴链接安全诊断'));
assert.ok(unsafeDiagnostic.includes('目标：Unsafe source memory'));
assert.ok(unsafeDiagnostic.includes('记忆键：message:unsafe'));
assert.ok(unsafeDiagnostic.includes('来源标签：Unsafe source'));
assert.ok(unsafeDiagnostic.includes('记忆内跳转已隐藏：不支持的目标'));
assert.ok(unsafeDiagnostic.includes('包含签名或访问凭据参数'));
assert.ok(unsafeDiagnostic.includes('没有复制被拦截的原始 URL'));
assert.ok(!unsafeDiagnostic.includes('X-Amz-Signature'));
assert.ok(!unsafeDiagnostic.includes('private.pdf'));

const copiedDiagnosticReceipt = buildTimelineLinkRecoveryCopiedReceipt({
  eventTitle: 'Unsafe source memory',
});
assert.equal(copiedDiagnosticReceipt.title, '安全诊断复制回执');
assert.equal(copiedDiagnosticReceipt.tone, 'info');
assert.ok(
  copiedDiagnosticReceipt.items.some((item) =>
    item.includes('不包含被拦截的原始 URL'),
  ),
);

const failedDiagnosticReceipt = buildTimelineLinkRecoveryCopyFailureReceipt({
  eventTitle: 'Unsafe source memory',
});
assert.equal(failedDiagnosticReceipt.tone, 'warning');
assert.ok(
  failedDiagnosticReceipt.items.some((item) =>
    item.includes('浏览器没有允许写入剪贴板'),
  ),
);

const unavailableNavigationReceipt = buildTimelineNavigationReceipt({
  action: 'unavailable',
});
assert.equal(unavailableNavigationReceipt.tone, 'warning');
assert.ok(
  unavailableNavigationReceipt.items.some((item) =>
    item.includes('没有可打开的安全内链或 http/https 来源'),
  ),
);

const refreshFailureReceipt = buildTimelineRefreshFailureReceipt({
  scope: 'all',
  rangeLabel: '今天',
  sourceFilterLabel: 'Timeline source',
  totalEventCount: 3,
  visibleEventCount: 1,
  errorMessage: 'memory service unavailable',
});
assert.equal(refreshFailureReceipt.title, '刷新失败 · 上次快照');
assert.ok(
  refreshFailureReceipt.items.some((item) =>
    item.includes('下面仍显示上次成功读取的 1 / 3 条时间轴记忆'),
  ),
);
assert.ok(
  refreshFailureReceipt.items.some((item) =>
    item.includes('没有把失败结果当作空时间轴'),
  ),
);

const refreshingSnapshotReceipt = buildTimelineRefreshingSnapshotReceipt({
  scope: 'work',
  rangeLabel: '近7天',
  sourceFilterLabel: 'Timeline source',
  totalEventCount: 4,
  visibleEventCount: 2,
});
assert.equal(refreshingSnapshotReceipt.title, '刷新中 · 上次快照');
assert.ok(
  refreshingSnapshotReceipt.items.some((item) =>
    item.includes(
      '正在重新读取 工作 · 近7天 · Timeline source；下面暂时仍是上次成功快照',
    ),
  ),
);
assert.ok(
  refreshingSnapshotReceipt.items.some((item) =>
    item.includes('当前可见 2 / 4 条旧快照记忆'),
  ),
);
assert.ok(
  refreshingSnapshotReceipt.items.some((item) =>
    item.includes('不代表 Memory Service 已确认最新状态'),
  ),
);
assert.ok(
  refreshFailureReceipt.items.some((item) =>
    item.includes('失败时不会复用旧范围快照'),
  ),
);
assert.ok(
  refreshFailureReceipt.items.some((item) =>
    item.includes('memory service unavailable'),
  ),
);

assert.equal(
  formatTimelineTime(Math.floor(fixedNoon / 1000), fixedNoon),
  '刚刚',
);
assert.equal(
  formatTimelineTime(Math.floor((fixedNoon - 3 * 60_000) / 1000), fixedNoon),
  '3分钟前',
);
assert.equal(formatTimelineTime(undefined, fixedNoon), '时间未知');
assert.equal(
  getTimelineDateTimeValue(Math.floor(fixedNoon / 1000)),
  new Date(fixedNoon).toISOString(),
);
assert.match(formatTimelineExactTime(Math.floor(fixedNoon / 1000)), /2026/);
assert.match(formatTimelineClockTime(Math.floor(fixedNoon / 1000)), /12:34/);

const grouped = groupTimelineEventsByDay(
  [
    {
      id: 'today-1',
      resultKey: 'message:today-1',
      type: 'message',
      title: 'Today memory',
      content: 'Today content',
      timestamp: Math.floor(fixedNoon / 1000),
      sourceTitle: 'Meeting notes',
      channels: ['time'],
    },
    {
      id: 'today-2',
      resultKey: 'chunk:today-2',
      type: 'chunk',
      title: 'Second memory',
      content: 'Second content',
      timestamp: Math.floor((fixedNoon - 60_000) / 1000),
      source: 'manual',
      channels: ['time'],
    },
    {
      id: 'yesterday-1',
      resultKey: 'message:yesterday-1',
      type: 'message',
      title: 'Yesterday memory',
      content: 'Yesterday content',
      timestamp: Math.floor((fixedNoon - 24 * 60 * 60_000) / 1000),
      source: 'manual',
      channels: ['time'],
    },
  ],
  fixedNoon,
);

assert.equal(grouped.length, 2);
assert.ok(grouped[0].label.startsWith('今天 · '));
assert.equal(grouped[0].summary, '2 条记忆 · Meeting notes、manual');
assert.equal(grouped[0].events.length, 2);
assert.ok(grouped[1].label.startsWith('昨天 · '));
assert.equal(grouped[1].summary, '1 条记忆 · manual');

console.log('verify-memory-timeline: ok');
