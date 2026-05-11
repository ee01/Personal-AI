import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
} from '../ComposerGuardController.ts';

test('normalizeComposerAssistThreshold: defaults to 0.78 and clamps bounds', () => {
  assert.equal(normalizeComposerAssistThreshold(undefined), 0.78);
  assert.equal(DEFAULT_ASSIST_CONFIDENCE_THRESHOLD, 0.78);
  assert.equal(normalizeComposerAssistThreshold(0.1), 0.62);
  assert.equal(normalizeComposerAssistThreshold(0.99), 0.92);
  assert.equal(normalizeComposerAssistThreshold(undefined, 0.99), 0.92);
});

test('getNextComposerAssistThreshold: accepted feedback lowers non-linearly', () => {
  const first = getNextComposerAssistThreshold(0.78, 'accepted');
  const second = getNextComposerAssistThreshold(first, 'accepted');
  const firstDelta = 0.78 - first;
  const secondDelta = first - second;

  assert.ok(first < 0.78);
  assert.ok(second < first);
  assert.ok(firstDelta > secondDelta);
});

test('getNextComposerAssistThreshold: rejected feedback raises non-linearly', () => {
  const first = getNextComposerAssistThreshold(0.78, 'rejected');
  const second = getNextComposerAssistThreshold(first, 'rejected');
  const firstDelta = first - 0.78;
  const secondDelta = second - first;

  assert.ok(first > 0.78);
  assert.ok(second > first);
  assert.ok(firstDelta > secondDelta);
});
