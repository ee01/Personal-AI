/**
 * DB-backed model pricing (docs/features/usage_analytics.md, 成本估算):
 * `model_pricing` table overrides pricing.ts's compiled-in seed, and the
 * repriceFlaggedEvents fix (B1) actually reaches previously-unpriced rows
 * instead of being crowded out by rows that will never be priceable.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AnalyticsStore } from '../analytics/AnalyticsStore.js';
import { setPricingOverrides } from '../analytics/pricing.js';

describe('AnalyticsStore pricing', () => {
  let tempDir: string;
  let dbPath: string;
  let store: AnalyticsStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-pricing-'));
    dbPath = path.join(tempDir, 'usage.db');
    store = new AnalyticsStore(dbPath);
  });

  afterEach(() => {
    store.close();
    // Every store construction repopulates this module-level map from its
    // own DB; reset it explicitly so other test files don't inherit a stale
    // override from whichever temp DB ran last.
    setPricingOverrides({});
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('merges DB overrides over the compiled-in seed and tags source', () => {
    store.upsertPricing([
      { model: 'llama3', inputPer1M: 0.01, outputPer1M: 0.02, note: 'admin override of the free-tier seed' },
    ]);
    const table = store.getPricingTable();
    const llama3 = table.find((row) => row.model === 'llama3');
    const deepseek = table.find((row) => row.model === 'deepseek-v3');

    expect(llama3?.source).toBe('db');
    expect(llama3?.inputPer1M).toBe(0.01);
    // A model nobody has ever overridden still shows up, from the seed.
    expect(deepseek?.source).toBe('builtin');
  });

  it('reprices existing flagged rows immediately after upsertPricing (no restart needed)', () => {
    store.recordUsageEvent({
      side: 'backend',
      userId: 'u1',
      capability: 'memory_capture',
      model: 'totally-new-model',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    const before = store.getUsageAggregate({ sinceMs: 0, nowMs: Date.now() + 1 });
    expect(before.find((r) => r.model === 'totally-new-model')?.estCostUsd).toBe(0);

    store.upsertPricing([{ model: 'totally-new-model', inputPer1M: 2, outputPer1M: 4 }]);

    const after = store.getUsageAggregate({ sinceMs: 0, nowMs: Date.now() + 1 });
    // 1M prompt @ $2/1M + 1M completion @ $4/1M = $6
    expect(after.find((r) => r.model === 'totally-new-model')?.estCostUsd).toBeCloseTo(6, 5);
  });

  it('getUnpricedModels only returns models still flagged un-priced in the window', () => {
    const now = Date.now();
    store.recordUsageEvent({
      side: 'backend',
      userId: 'u1',
      capability: 'memory_capture',
      model: 'unpriced-model',
      promptTokens: 100,
      completionTokens: 50,
      ts: now,
    });
    // A genuinely-free/known-zero-cost model must NOT show up as "needs pricing".
    store.recordUsageEvent({
      side: 'backend',
      userId: 'u1',
      capability: 'memory_capture',
      model: 'llama3',
      promptTokens: 100,
      completionTokens: 50,
      ts: now,
    });

    const unpriced = store.getUnpricedModels(now - 1000);
    expect(unpriced.map((r) => r.model)).toEqual(['unpriced-model']);
  });

  it('B1: reprices a genuinely-newly-priced model even when a large volume of permanently-flagged rows exists', () => {
    // Simulate the actual bug: thousands of rows for a model that will
    // NEVER be priced (e.g. a one-off test/probe model), which under the old
    // `est_cost_usd = 0 LIMIT 5000` filter would occupy the entire batch
    // forever and starve out any row for a model that later gets priced.
    for (let i = 0; i < 200; i++) {
      store.recordUsageEvent({
        side: 'backend',
        userId: 'u1',
        capability: 'memory_capture',
        model: 'permanently-unpriced-probe-model',
        promptTokens: 10,
        completionTokens: 10,
      });
    }
    store.recordUsageEvent({
      side: 'backend',
      userId: 'u1',
      capability: 'memory_capture',
      model: 'newly-priced-model',
      promptTokens: 1000,
      completionTokens: 1000,
    });

    // Admin prices the second model — reopening the store (as a deploy
    // restart would) must still find and reprice it despite the 200
    // never-priceable rows sharing the flagged set.
    store.upsertPricing([{ model: 'newly-priced-model', inputPer1M: 1, outputPer1M: 1 }]);
    const reopened = new AnalyticsStore(dbPath);
    try {
      const rows = reopened.getUsageAggregate({ sinceMs: 0, nowMs: Date.now() + 1 });
      const priced = rows.find((r) => r.model === 'newly-priced-model');
      const stillUnpriced = rows.find((r) => r.model === 'permanently-unpriced-probe-model');
      expect(priced?.estCostUsd).toBeCloseTo(0.002, 6); // 1000 prompt + 1000 completion @ $1/1M each
      expect(stillUnpriced?.estCostUsd).toBe(0);
    } finally {
      reopened.close();
    }
  });

  it('B1 (production regression, 2026-08-26): reprices a model whose flagged rows sit behind a FULL 5000-row batch of never-priceable rows', () => {
    // The 200-row test above didn't actually exercise the bug: with only 201
    // total flagged rows, the very first (and only) LIMIT-5000 batch already
    // contains the priceable row, so it "worked" even under the old
    // `if (repricedThisBatch === 0) break` logic. The real bug only shows up
    // when an entire first batch is 100% unpriceable — this reproduces
    // exactly what happened live: 12000+ historical rows for models nobody
    // had priced yet, with claude-sonnet-4-6 (already priced in the seed
    // table) sitting un-repriced behind them because the old code gave up
    // after batch 1 repriced nothing.
    for (let i = 0; i < 6000; i++) {
      store.recordUsageEvent({
        side: 'backend',
        userId: 'u1',
        capability: 'memory_capture',
        model: 'never-priced-noisy-model',
        promptTokens: 10,
        completionTokens: 10,
      });
    }
    store.recordUsageEvent({
      side: 'backend',
      userId: 'u1',
      capability: 'memory_capture',
      model: 'already-seeded-model',
      promptTokens: 1000,
      completionTokens: 1000,
    });

    store.upsertPricing([{ model: 'already-seeded-model', inputPer1M: 1, outputPer1M: 1 }]);
    const reopened = new AnalyticsStore(dbPath);
    try {
      const rows = reopened.getUsageAggregate({ sinceMs: 0, nowMs: Date.now() + 1 });
      const priced = rows.find((r) => r.model === 'already-seeded-model');
      expect(priced?.estCostUsd).toBeCloseTo(0.002, 6);
    } finally {
      reopened.close();
    }
  });
});

describe('AnalyticsStore.getTodayCallCountForRoute (webpage-analysis quota)', () => {
  let tempDir: string;
  let store: AnalyticsStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-quota-'));
    store = new AnalyticsStore(path.join(tempDir, 'usage.db'));
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('counts only today, only this user, and only this route', () => {
    const now = Date.now();
    const yesterday = now - 25 * 3600 * 1000;
    const route = '/source-memory/webpage-analysis';

    store.recordUsageEvent({ side: 'backend', userId: 'u1', route, capability: 'memory_capture', model: 'm', ts: now });
    store.recordUsageEvent({ side: 'backend', userId: 'u1', route, capability: 'memory_capture', model: 'm', ts: now });
    store.recordUsageEvent({ side: 'backend', userId: 'u1', route, capability: 'memory_capture', model: 'm', ts: yesterday });
    store.recordUsageEvent({ side: 'backend', userId: 'u2', route, capability: 'memory_capture', model: 'm', ts: now });
    store.recordUsageEvent({ side: 'backend', userId: 'u1', route: '/other-route', capability: 'memory_capture', model: 'm', ts: now });

    expect(store.getTodayCallCountForRoute('u1', route, now)).toBe(2);
    expect(store.getTodayCallCountForRoute('u2', route, now)).toBe(1);
    expect(store.getTodayCallCountForRoute('u1', '/other-route', now)).toBe(1);
  });
});
