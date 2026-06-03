import assert from 'node:assert/strict';

import {
  ALL_TIMELINE_SOURCE_FILTER_KEY,
  UNKNOWN_TIMELINE_SOURCE_FILTER_KEY,
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
