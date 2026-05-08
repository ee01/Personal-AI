import assert from 'node:assert/strict';

import {
  formatMemoryTimestamp,
  getRecallChannelLabel,
  getResultChannels,
  getResultMeta,
  getScopeLabel,
  getSearchResultKey,
  normalizeMemorySourceUrl,
  sanitizeMemoryExploreRoute,
  shouldResetTypeFilter,
} from '../src/modals/searchResultPresentation.js';

assert.equal(getScopeLabel('work'), '工作记忆');
assert.equal(getScopeLabel('personal'), '个人记忆');
assert.equal(getScopeLabel('all'), '全部记忆');
assert.equal(getScopeLabel('both'), '全部记忆');

assert.equal(getRecallChannelLabel('vector'), '语义');
assert.equal(getRecallChannelLabel('unknown'), 'unknown');
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

assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=msg-1'), '#/timeline?focus=msg-1');
assert.equal(sanitizeMemoryExploreRoute('memory-exploring.html#/timeline'), null);
assert.equal(sanitizeMemoryExploreRoute('javascript:alert(1)'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline\n?focus=msg-1'), null);
assert.equal(sanitizeMemoryExploreRoute('#/timeline?focus=<img>'), null);

assert.equal(
  normalizeMemorySourceUrl('https://example.com/path?q=1'),
  'https://example.com/path?q=1',
);
assert.equal(
  normalizeMemorySourceUrl('http://user:pass@example.com/path'),
  'http://example.com/path',
);
assert.equal(normalizeMemorySourceUrl('/relative/path'), null);
assert.equal(normalizeMemorySourceUrl('javascript:alert(1)'), null);

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
