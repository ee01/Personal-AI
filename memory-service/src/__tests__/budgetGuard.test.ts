/**
 * P0b daily-budget hard cap tests (memory-foundation plan §6.5 / §11.3):
 * - cap parsing + per-capability override + memoized spend lookup
 * - LLMClient rejects before any provider call and records a visible
 *   `budget_rejected` usage event (never silently skipped)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storeStub = {
  sumBackendCostByCapabilitySince: vi.fn(),
};
const recordLlmUsageMock = vi.fn();
vi.mock('../analytics/AnalyticsStore.js', () => ({
  getAnalyticsStore: () => storeStub,
}));

import {
  budgetSnapshot,
  checkBudget,
  resetBudgetMemo,
} from '../analytics/BudgetGuard.js';
import { LLMBudgetExceededError } from '../llm/llmErrors.js';

describe('BudgetGuard (P0b daily hard cap)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  const setEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };

  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('LLM_DAILY_BUDGET_')) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
    }
    storeStub.sumBackendCostByCapabilitySince.mockReset();
    resetBudgetMemo();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) setEnv(k, v);
    resetBudgetMemo();
  });

  it('unconfigured → everything allowed', () => {
    const result = checkBudget('memory_service');
    expect(result).toMatchObject({ allowed: true, scope: 'unconfigured' });
  });

  it('global cap exceeded → rejected with spent/cap detail', () => {
    setEnv('LLM_DAILY_BUDGET_USD', '1.50');
    storeStub.sumBackendCostByCapabilitySince.mockReturnValue([
      { capability: 'memory_service', estCostUsd: 1.2 },
      { capability: 'ask', estCostUsd: 0.4 },
    ]);
    resetBudgetMemo();

    const result = checkBudget('memory_service');
    expect(result).toMatchObject({
      allowed: false,
      scope: 'global',
      spentUsd: 1.6,
      capUsd: 1.5,
    });
  });

  it('per-capability cap overrides the global cap', () => {
    setEnv('LLM_DAILY_BUDGET_USD', '10');
    setEnv('LLM_DAILY_BUDGET_MEMORY_SERVICE_USD', '0.5');
    storeStub.sumBackendCostByCapabilitySince.mockReturnValue([
      { capability: 'memory_service', estCostUsd: 0.7 },
      { capability: 'ask', estCostUsd: 3.0 },
    ]);
    resetBudgetMemo();

    const extraction = checkBudget('memory_service');
    const ask = checkBudget('ask');

    expect(extraction).toMatchObject({
      allowed: false,
      scope: 'capability',
      spentUsd: 0.7,
      capUsd: 0.5,
    });
    // ask is still under the (much higher) global cap
    expect(ask).toMatchObject({ allowed: true, scope: 'global' });
  });

  it('invalid cap values are ignored, not treated as zero', () => {
    setEnv('LLM_DAILY_BUDGET_USD', 'abc');
    expect(checkBudget('ask')).toMatchObject({
      allowed: true,
      scope: 'unconfigured',
    });
  });

  it('budgetSnapshot reflects today spend and over-budget state', () => {
    setEnv('LLM_DAILY_BUDGET_USD', '1');
    storeStub.sumBackendCostByCapabilitySince.mockReturnValue([
      { capability: 'ask', estCostUsd: 1.4 },
    ]);
    resetBudgetMemo();

    const snap = budgetSnapshot();
    expect(snap).toMatchObject({
      configured: true,
      globalCapUsd: 1,
      spentTodayUsd: 1.4,
      overBudget: true,
    });
  });
});

vi.mock('../analytics/UsageRecorder.js', () => ({
  recordLlmUsage: (...args: unknown[]) => recordLlmUsageMock(...args),
}));

describe('LLMClient budget rejection (P0b)', () => {

  it('throws LLMBudgetExceededError before calling the provider', async () => {
    process.env.LLM_DAILY_BUDGET_USD = '0.01';
    storeStub.sumBackendCostByCapabilitySince.mockReturnValue([
      { capability: 'ask', estCostUsd: 0.02 },
    ]);
    resetBudgetMemo();

    const { LLMClient } = await import('../llm/LLMClient.js');
    const { makeTestConfig } = await import('./llmConfigFixtures.js');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new LLMClient(makeTestConfig());
    await expect(client.generate('hello')).rejects.toThrow(
      LLMBudgetExceededError,
    );

    // No provider call was made.
    expect(fetchMock).not.toHaveBeenCalled();
    // The rejection is visible in usage analytics, not silent.
    const recorded = recordLlmUsageMock.mock.calls.find(
      (c) => (c[0] as { errorKind?: string }).errorKind === 'budget_rejected',
    );
    expect(recorded).toBeTruthy();

    delete process.env.LLM_DAILY_BUDGET_USD;
    resetBudgetMemo();
    vi.unstubAllGlobals();
  });
});
