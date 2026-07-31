import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isCoveredByStaticRoadmapMatch,
  roadmapMatchPatternFromBaseUrl,
  STATIC_ROADMAP_MATCHES,
} from '../roadmapContentScriptRegistry.js';

test('builds match patterns from ROADMAP_BASE_URL', () => {
  assert.equal(
    roadmapMatchPatternFromBaseUrl('http://roadmap.xmnup.com'),
    'http://roadmap.xmnup.com/*',
  );
  assert.equal(
    roadmapMatchPatternFromBaseUrl('http://roadmap.xmnup.com/?team=x'),
    'http://roadmap.xmnup.com/*',
  );
  assert.equal(
    roadmapMatchPatternFromBaseUrl('https://roadmap.xmnup.com/'),
    'https://roadmap.xmnup.com/*',
  );
  assert.equal(roadmapMatchPatternFromBaseUrl('not-a-url'), null);
});

test('covers the default public host in static matches', () => {
  assert.ok(STATIC_ROADMAP_MATCHES.includes('http://roadmap.xmnup.com/*'));
  assert.ok(STATIC_ROADMAP_MATCHES.includes('https://roadmap.xmnup.com/*'));
  assert.equal(isCoveredByStaticRoadmapMatch('http://roadmap.xmnup.com/*'), true);
  assert.equal(
    isCoveredByStaticRoadmapMatch('http://custom.example:3220/*'),
    false,
  );
});
