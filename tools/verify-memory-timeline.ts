import assert from 'node:assert/strict';

import {
  formatTimelineTime,
  getTimelineRangeSeconds,
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

assert.equal(formatTimelineTime(Math.floor(fixedNoon / 1000), fixedNoon), '刚刚');
assert.equal(
  formatTimelineTime(Math.floor((fixedNoon - 3 * 60_000) / 1000), fixedNoon),
  '3分钟前',
);
assert.equal(formatTimelineTime(undefined, fixedNoon), '时间未知');

console.log('verify-memory-timeline: ok');
