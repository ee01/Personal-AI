import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WebpageAnalysisFailureBackoff,
  classifyWebpageAnalysisFailure,
} from '../webpageAnalysisBackoff.js';

test('failure backoff advances through bounded cooldowns and survives hydration', () => {
  const backoff = new WebpageAnalysisFailureBackoff({
    delaysMs: [100, 200, 300],
    retentionMs: 1_000,
  });

  const first = backoff.recordFailure('page', 'network', 1_000);
  assert.equal(first.retryAfter, 1_100);
  assert.equal(backoff.getCooldown('page', 1_099)?.attempts, 1);
  assert.equal(backoff.getCooldown('page', 1_100), undefined);

  const second = backoff.recordFailure('page', 'network', 1_101);
  assert.equal(second.retryAfter, 1_301);
  const third = backoff.recordFailure('page', 'network', 1_302);
  assert.equal(third.retryAfter, 1_602);
  const fourth = backoff.recordFailure('page', 'network', 1_603);
  assert.equal(fourth.retryAfter, 1_903);

  const restored = new WebpageAnalysisFailureBackoff({
    delaysMs: [100, 200, 300],
    retentionMs: 1_000,
  });
  restored.hydrate(backoff.snapshot(1_700), 1_700);
  assert.equal(restored.getCooldown('page', 1_700)?.attempts, 4);
});

test('success clear removes a pending cooldown', () => {
  const backoff = new WebpageAnalysisFailureBackoff({ delaysMs: [100] });
  backoff.recordFailure('page', 'server', 1_000);
  assert.equal(backoff.clear('page'), true);
  assert.equal(backoff.getCooldown('page', 1_001), undefined);
});

test('failure classifier keeps telemetry low-cardinality', () => {
  assert.equal(classifyWebpageAnalysisFailure({ status: 401 }), 'auth');
  assert.equal(classifyWebpageAnalysisFailure({ status: 429 }), 'rate_limit');
  assert.equal(classifyWebpageAnalysisFailure(new Error('Failed to fetch')), 'network');
  assert.equal(classifyWebpageAnalysisFailure(new Error('request timeout')), 'timeout');
});
