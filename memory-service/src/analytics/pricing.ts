/**
 * Model pricing table for local usage-cost estimation.
 *
 * Prices are expressed in USD per 1,000,000 tokens, split by input (prompt)
 * and output (completion). These are best-effort local estimates only — no
 * external billing/reconciliation is performed. Unknown models resolve to a
 * cost of 0 and are flagged so the report can surface un-priced usage.
 */

export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  inputPer1M: number;
  /** USD per 1M output (completion) tokens. */
  outputPer1M: number;
}

/**
 * Known model prices (USD per 1M tokens), compiled into the binary as a seed /
 * fallback. Keys are compared case-insensitively. Local models (e.g. ollama
 * llama3) are priced at 0 but still count as "known".
 *
 * This table drifts out of date the moment the deployed LLM_PROVIDER/model
 * changes (it has happened at least once — see git history). The
 * `model_pricing` DB table (see AnalyticsStore) is the live source of truth;
 * entries there are merged over this seed at runtime via
 * `setPricingOverrides()` and are what admins actually maintain through
 * `GET/PUT /api/v1/usage/pricing` or the `update-model-pricing` skill.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'qwen3.6:latest': { inputPer1M: 0.3, outputPer1M: 0.6 },
  'gpt-5.5': { inputPer1M: 1.25, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'deepseek-ai/deepseek-r1': { inputPer1M: 0.55, outputPer1M: 2.19 },
  'deepseek-v4-pro': { inputPer1M: 0.55, outputPer1M: 2.19 },
  'deepseek-v3': { inputPer1M: 0.27, outputPer1M: 1.1 },
  'deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.1 },
  llama3: { inputPer1M: 0, outputPer1M: 0 },
  // Seeded 2026-08-25 from the usage-analytics/platform-bill reconciliation in
  // docs/features/usage_analytics.md 的成本治理与 2026-08 事故复盘 (30d tracked
  // cost vs Console bill closed within 2.8% at this rate). Re-verify with the
  // update-model-pricing skill if the deployed model or its price changes.
  'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
};

export interface CostEstimate {
  estCostUsd: number;
  /** True when the model is not in the pricing table (cost recorded as 0). */
  flagged: boolean;
}

function normalizeModelKey(model: string | null | undefined): string {
  return (model ?? '').trim().toLowerCase();
}

/**
 * Runtime overrides loaded from the `model_pricing` DB table. Populated by
 * AnalyticsStore on construction and after every pricing write; takes
 * precedence over the compiled-in seed above. Kept as a module-level map
 * (rather than threading AnalyticsStore into every estimateCostUsd call site)
 * to avoid a circular import — AnalyticsStore already imports this module.
 */
let pricingOverrides: Record<string, ModelPricing> = {};

/** Replace the live pricing overrides (called by AnalyticsStore). */
export function setPricingOverrides(overrides: Record<string, ModelPricing>): void {
  pricingOverrides = overrides;
}

/**
 * Look up pricing for a model name (case-insensitive): DB override first,
 * then the compiled-in seed. Returns undefined when the model is priced
 * nowhere.
 */
export function getModelPricing(model: string | null | undefined): ModelPricing | undefined {
  const key = normalizeModelKey(model);
  if (!key) return undefined;
  return pricingOverrides[key] ?? MODEL_PRICING[key];
}

/** True when `model` resolves only from the compiled-in seed, not the DB. */
export function isBuiltinOnlyPricing(model: string | null | undefined): boolean {
  const key = normalizeModelKey(model);
  return Boolean(key) && !pricingOverrides[key] && Boolean(MODEL_PRICING[key]);
}

/**
 * Estimate the USD cost of a single LLM call. Unknown models return
 * `{ estCostUsd: 0, flagged: true }`.
 */
export function estimateCostUsd(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): CostEstimate {
  const pricing = getModelPricing(model);
  if (!pricing) {
    return { estCostUsd: 0, flagged: true };
  }
  const prompt = Number.isFinite(promptTokens) ? Math.max(0, promptTokens) : 0;
  const completion = Number.isFinite(completionTokens)
    ? Math.max(0, completionTokens)
    : 0;
  const estCostUsd =
    (prompt / 1_000_000) * pricing.inputPer1M +
    (completion / 1_000_000) * pricing.outputPer1M;
  return { estCostUsd, flagged: false };
}
