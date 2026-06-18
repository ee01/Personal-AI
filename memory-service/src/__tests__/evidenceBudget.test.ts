import { describe, expect, it } from 'vitest';

import { assembleEvidenceContext } from '../routes/ask.js';
import type { RecallItem } from '../types/index.js';

function item(i: number, contentLen: number): RecallItem {
  return {
    id: `m-${i}`,
    type: 'message',
    content: `C${i} ` + 'x'.repeat(contentLen),
    previewText: `P${i} ` + 'y'.repeat(40),
    score: 1 - i * 0.01,
    source: 'ringcentral',
    sourceTitle: `Title ${i}`,
    timestamp: 1_700_000_000 + i,
  };
}

describe('assembleEvidenceContext (QW-3 progressive evidence)', () => {
  it('renders top items at full content (L2) and tail as summaries (L1)', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(i, 300));
    const { text, tiers } = assembleEvidenceContext(items, {
      tokenBudget: 1200,
      fullCount: 4,
    });
    expect(tiers.l2).toBe(4);
    expect(tiers.l1).toBeGreaterThan(0);
    expect(tiers.omitted).toBe(0);
    // L2 items keep full content marker; L1 items use the preview marker.
    expect(text).toContain('[title: Title 0]');
    expect(text).toContain('P5'); // a tail item rendered via preview
  });

  it('keeps the provenance header at every tier', () => {
    const items = Array.from({ length: 6 }, (_, i) => item(i, 200));
    const { text } = assembleEvidenceContext(items, { tokenBudget: 400, fullCount: 2 });
    // Even title-only / summary lines carry index + title.
    for (let i = 0; i < 3; i++) {
      expect(text).toContain(`[${i + 1}]`);
      expect(text).toContain(`[title: Title ${i}]`);
    }
  });

  it('omits overflow with an explicit note instead of silent truncation', () => {
    const items = Array.from({ length: 40 }, (_, i) => item(i, 480));
    const { text, tiers } = assembleEvidenceContext(items, {
      tokenBudget: 300,
      fullCount: 2,
    });
    expect(tiers.omitted).toBeGreaterThan(0);
    expect(text).toContain('more memories omitted to fit the context budget');
  });

  it('uses fewer characters than the legacy all-full rendering', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i, 480));
    const legacyChars = items.reduce((sum, it) => sum + Math.min(it.content.length, 500) + 60, 0);
    const { text } = assembleEvidenceContext(items, { tokenBudget: 1000, fullCount: 4 });
    expect(text.length).toBeLessThan(legacyChars);
  });

  it('downgrades L2 to a cheaper tier when the budget is tiny', () => {
    const items = Array.from({ length: 3 }, (_, i) => item(i, 480));
    const { tiers } = assembleEvidenceContext(items, { tokenBudget: 200, fullCount: 3 });
    // With an 800-char floor, not all 3 can be full; some downgrade or omit.
    expect(tiers.l2).toBeLessThan(3);
  });
});
