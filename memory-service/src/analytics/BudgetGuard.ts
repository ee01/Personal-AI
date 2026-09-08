/**
 * BudgetGuard — P0b daily LLM spend hard cap (memory-foundation plan §6.5 /
 * §11.3).
 *
 * Before any paid LLM call the client checks today's estimated backend spend
 * against a configured cap. When the cap is exceeded the call is REJECTED
 * with a typed error and a visible `budget_rejected` usage event — never
 * silently skipped ("预算拒绝进入可见 queue 状态，不得静默跳过").
 *
 * Configuration (env, dynamic):
 *   LLM_DAILY_BUDGET_USD            global backend hard cap (0/unset = off)
 *   LLM_DAILY_BUDGET_<CAP>_USD      optional per-capability override
 *                                  (e.g. LLM_DAILY_BUDGET_MEMORY_EXTRACTION_USD)
 *
 * The spend lookup is memoized for a short window to keep the analytics DB
 * off the hot path; correctness beats freshness for a hard cap (events are
 * recorded before the memo can expire and a rejected call never spends).
 */

import { getAnalyticsStore } from './AnalyticsStore.js';
import { normalizeCapability } from './capabilityMap.js';

const MEMO_TTL_MS = 60_000;

interface SpendMemo {
  at: number;
  globalUsd: number;
  byCapability: Map<string, number>;
}

let memo: SpendMemo | null = null;

function parseCapEnv(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Effective caps: (global cap, per-capability map). Null cap = disabled. */
export function getBudgetCaps(): {
  global: number | null;
  perCapability: Map<string, number>;
} {
  const perCapability = new Map<string, number>();
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('LLM_DAILY_BUDGET_') || !key.endsWith('_USD')) continue;
    const cap = parseCapEnv(value);
    if (cap === null) continue;
    const capability = key
      .slice('LLM_DAILY_BUDGET_'.length, -'_USD'.length)
      .toLowerCase();
    if (capability && capability !== 'usd') {
      perCapability.set(normalizeCapability(capability), cap);
    }
  }
  return { global: parseCapEnv(process.env.LLM_DAILY_BUDGET_USD), perCapability };
}

function readTodaySpend(): { globalUsd: number; byCapability: Map<string, number> } {
  const store = getAnalyticsStore();
  if (!store) return { globalUsd: 0, byCapability: new Map() };

  const nowMs = Date.now();
  const dayStartMs = Math.floor(nowMs / 86_400_000) * 86_400_000;
  const rows = store.sumBackendCostByCapabilitySince(dayStartMs);
  let globalUsd = 0;
  const byCapability = new Map<string, number>();
  for (const row of rows) {
    globalUsd += row.estCostUsd;
    if (row.capability) {
      // Store under the same normalized key the lookup uses.
      const key = normalizeCapability(row.capability);
      byCapability.set(key, (byCapability.get(key) ?? 0) + row.estCostUsd);
    }
  }
  return { globalUsd, byCapability };
}

function todaySpend(): { globalUsd: number; byCapability: Map<string, number> } {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_TTL_MS) {
    return { globalUsd: memo.globalUsd, byCapability: memo.byCapability };
  }
  const fresh = readTodaySpend();
  memo = { at: now, ...fresh };
  return fresh;
}

/** Test hook: drop the memoized spend so the next check re-reads. */
export function resetBudgetMemo(): void {
  memo = null;
}

export interface BudgetCheckResult {
  allowed: boolean;
  spentUsd: number;
  capUsd: number | null;
  scope: 'global' | 'capability' | 'unconfigured';
}

/**
 * Check whether a paid LLM call may proceed under today's caps. Does not
 * throw; callers decide. A per-capability cap overrides the global cap for
 * that capability; with no caps configured everything is allowed.
 */
export function checkBudget(capability?: string | null): BudgetCheckResult {
  const caps = getBudgetCaps();
  if (caps.global === null && caps.perCapability.size === 0) {
    return { allowed: true, spentUsd: 0, capUsd: null, scope: 'unconfigured' };
  }

  const spend = todaySpend();
  const normalized = capability ? normalizeCapability(capability) : null;
  const capabilityCap =
    normalized !== null ? caps.perCapability.get(normalized) : undefined;

  if (capabilityCap !== undefined) {
    const spent = normalized !== null ? spend.byCapability.get(normalized) ?? 0 : 0;
    return {
      allowed: spent < capabilityCap,
      spentUsd: spent,
      capUsd: capabilityCap,
      scope: 'capability',
    };
  }

  if (caps.global !== null) {
    return {
      allowed: spend.globalUsd < caps.global,
      spentUsd: spend.globalUsd,
      capUsd: caps.global,
      scope: 'global',
    };
  }

  return { allowed: true, spentUsd: spend.globalUsd, capUsd: null, scope: 'unconfigured' };
}

/** Readiness snapshot for /health and diagnostics. */
export function budgetSnapshot(): {
  configured: boolean;
  globalCapUsd: number | null;
  spentTodayUsd: number;
  overBudget: boolean;
} {
  const caps = getBudgetCaps();
  const spend = todaySpend();
  return {
    configured: caps.global !== null || caps.perCapability.size > 0,
    globalCapUsd: caps.global,
    spentTodayUsd: Number(spend.globalUsd.toFixed(4)),
    overBudget: caps.global !== null && spend.globalUsd >= caps.global,
  };
}
