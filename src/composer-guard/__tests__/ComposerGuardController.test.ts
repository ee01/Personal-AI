import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  DEFAULT_ASSIST_PREVIEW_LIMIT,
  getComposerAssistPreviewText,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  sanitizeComposerAssistInsertText,
} from '../assistPreviewPolicy.ts';
import { isComposerAssistEnabledFromConfig } from '../assistConfig.ts';

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

test('getComposerAssistPreviewText: truncates hover previews but preserves locked previews', () => {
  const longSuggestion = 'A'.repeat(DEFAULT_ASSIST_PREVIEW_LIMIT + 24);

  const hoverPreview = getComposerAssistPreviewText(longSuggestion);
  assert.equal(hoverPreview.length, DEFAULT_ASSIST_PREVIEW_LIMIT + 3);
  assert.ok(hoverPreview.endsWith('...'));

  const lockedPreview = getComposerAssistPreviewText(longSuggestion, {
    forceFull: true,
  });
  assert.equal(lockedPreview, longSuggestion);
});

test('sanitizeComposerAssistInsertText: strips wrapper copy before preview or insert', () => {
  const insertText = sanitizeComposerAssistInsertText(
    'Personal AI context pack (review before sending):\n请结合 Orbit blocker 回复。\nPlease review and edit before sending.',
  );

  assert.equal(insertText, '请结合 Orbit blocker 回复。');
});

test('isComposerAssistEnabledFromConfig: context and compose toggles both gate the feature', () => {
  assert.equal(isComposerAssistEnabledFromConfig(undefined), true);
  assert.equal(isComposerAssistEnabledFromConfig({}), true);
  assert.equal(
    isComposerAssistEnabledFromConfig({ CONTEXT_ASSIST_ENABLED: false }),
    false,
  );
  assert.equal(
    isComposerAssistEnabledFromConfig({ COMPOSE_ASSIST_ENABLED: false }),
    false,
  );
  assert.equal(
    isComposerAssistEnabledFromConfig({
      CONTEXT_ASSIST_ENABLED: true,
      COMPOSE_ASSIST_ENABLED: true,
    }),
    true,
  );
});
