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
 * Known model prices (USD per 1M tokens). Keys are compared case-insensitively.
 * Local models (e.g. ollama llama3) are priced at 0 but still count as "known".
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'qwen3.6:latest': { inputPer1M: 0.3, outputPer1M: 0.6 },
  'gpt-5.5': { inputPer1M: 1.25, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'deepseek-ai/deepseek-r1': { inputPer1M: 0.55, outputPer1M: 2.19 },
  // Deployed memory-service currently uses deepseek-v4-pro via oneapi.
  'deepseek-v4-pro': { inputPer1M: 0.55, outputPer1M: 2.19 },
  'deepseek-v3': { inputPer1M: 0.27, outputPer1M: 1.1 },
  'deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.1 },
  llama3: { inputPer1M: 0, outputPer1M: 0 },
};

export interface CostEstimate {
  estCostUsd: number;
  /** True when the model is not in MODEL_PRICING (cost recorded as 0). */
  flagged: boolean;
}

function normalizeModelKey(model: string | null | undefined): string {
  return (model ?? '').trim().toLowerCase();
}

/**
 * Look up pricing for a model name (case-insensitive). Returns undefined when
 * the model is not in the pricing table.
 */
export function getModelPricing(model: string | null | undefined): ModelPricing | undefined {
  const key = normalizeModelKey(model);
  if (!key) return undefined;
  return MODEL_PRICING[key];
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
