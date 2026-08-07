import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionRequestCacheKey,
  SessionRequestCache,
} from '../sessionRequestCache.js';

test('cache key is stable across object property order', () => {
  assert.equal(
    buildSessionRequestCacheKey('context', { title: 'A', limit: 3 }),
    buildSessionRequestCacheKey('context', { limit: 3, title: 'A' }),
  );
});

test('session cache hydrates live entries and discards expired entries', () => {
  const cache = new SessionRequestCache<string>(1000, 3);
  cache.hydrate(
    {
      live: { expiresAt: 2000, value: 'cached' },
      expired: { expiresAt: 999, value: 'old' },
    },
    1000,
  );

  assert.equal(cache.get('live', 1000), 'cached');
  assert.equal(cache.get('expired', 1000), undefined);
});

test('session cache bounds entries and supports per-entry ttl', () => {
  const cache = new SessionRequestCache<string>(1000, 2);
  cache.set('one', '1', { now: 100 });
  cache.set('two', '2', { now: 200 });
  cache.set('three', '3', { now: 300, ttlMs: 50 });

  assert.equal(cache.get('one', 300), undefined);
  assert.equal(cache.get('two', 300), '2');
  assert.equal(cache.get('three', 349), '3');
  assert.equal(cache.get('three', 350), undefined);
});
