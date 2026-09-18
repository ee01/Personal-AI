/**
 * Regression: the analytics store's sumBackendCostByCapabilitySince raw SQL
 * rows carry `est_cost_usd` (snake_case); an unmapped passthrough made
 * row.estCostUsd undefined → NaN spend → the budget gate would reject EVERY
 * LLM call while /health showed spentTodayUsd=null. This test uses a REAL
 * AnalyticsStore (no mocks) so column-name drift can never slip through
 * mocked stubs again.
 */

import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AnalyticsStore } from '../analytics/AnalyticsStore.js';
import { checkBudget, resetBudgetMemo } from '../analytics/BudgetGuard.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-guard-real-'));

// The guard reads the module singleton; point it at our real store.
const { initAnalyticsStore, closeAnalyticsStore } = await import(
  '../analytics/AnalyticsStore.js'
);
const store = initAnalyticsStore(tempDir) as AnalyticsStore;

afterAll(() => {
  closeAnalyticsStore();
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.LLM_DAILY_BUDGET_USD;
});

describe('BudgetGuard against a real AnalyticsStore', () => {
  it('spend rows are usable numbers and the cap denies cleanly when exceeded', () => {
    store.recordUsageEvent({
      ts: Date.now(),
      userId: 'u1',
      side: 'backend',
      capability: 'ask',
      model: 'gpt-4o-mini',
      promptTokens: 1000,
      completionTokens: 100,
    });

    const rows = store.sumBackendCostByCapabilitySince(0);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.estCostUsd).toBe('number');
      expect(Number.isNaN(row.estCostUsd)).toBe(false);
    }
    const sum = rows.reduce((a, r) => a + r.estCostUsd, 0);
    expect(sum).toBeGreaterThan(0);

    // Cap below today's spend must deny cleanly (NaN comparisons used to
    // deny EVERYTHING — including under-cap traffic).
    process.env.LLM_DAILY_BUDGET_USD = String(sum / 2);
    resetBudgetMemo();
    const denied = checkBudget('ask');
    expect(denied.allowed).toBe(false);
    expect(denied.spentUsd).toBeGreaterThan(0);
    expect(Number.isNaN(denied.spentUsd)).toBe(false);

    // Cap above today's spend must ALLOW — the NaN bug denied this too.
    process.env.LLM_DAILY_BUDGET_USD = String(sum * 10);
    resetBudgetMemo();
    const allowed = checkBudget('ask');
    expect(allowed.allowed).toBe(true);

    delete process.env.LLM_DAILY_BUDGET_USD;
    resetBudgetMemo();
  });
});
