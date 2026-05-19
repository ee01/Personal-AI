import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  DEFAULT_ASSIST_PREVIEW_LIMIT,
  getComposerAssistPreviewText,
  getComposerAssistRiskLabel,
  getComposerAssistSourceSummary,
  getComposerGuardPrimaryAction,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  sanitizeComposerAssistInsertText,
  shouldPreviewComposerAssistBeforeInsert,
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

test('getComposerGuardPrimaryAction: preview-required assists require explicit preview', () => {
  assert.equal(
    shouldPreviewComposerAssistBeforeInsert({
      previewRequired: false,
      riskLevel: 'low',
    }),
    false,
  );
  assert.equal(
    getComposerGuardPrimaryAction({
      previewRequired: false,
      riskLevel: 'low',
    }),
    'insert',
  );
  assert.equal(
    shouldPreviewComposerAssistBeforeInsert({
      previewRequired: true,
      riskLevel: 'medium',
    }),
    true,
  );
  assert.equal(
    getComposerGuardPrimaryAction({
      previewRequired: true,
      riskLevel: 'medium',
    }),
    'preview',
  );
  assert.equal(
    getComposerGuardPrimaryAction({
      previewRequired: false,
      riskLevel: 'high',
    }),
    'preview',
  );
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

test('getComposerAssistSourceSummary: exposes source count and insert risk', () => {
  const summary = getComposerAssistSourceSummary({
    riskLevel: 'medium',
    previewRequired: true,
    evidence: [
      {
        id: 'memory-1',
        type: 'chunk',
        snippet: 'Factory AI needs security approval.',
        sourceTitle: 'AI tools selection',
      },
      {
        id: 'memory-2',
        type: 'message',
        snippet: 'Do not auto-send prompts.',
        sourceLabel: 'doubao',
      },
    ],
  });

  assert.match(summary, /2 条记忆/);
  assert.match(summary, /中风险 · 确认后插入/);
  assert.match(summary, /AI tools selection/);
  assert.match(summary, /doubao/);
  assert.equal(
    getComposerAssistRiskLabel({ riskLevel: 'high', previewRequired: false }),
    '高风险 · 先预览',
  );
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
