import type { CostBudget, LlmUsageRecord } from "../types.js";

export class CostTracker {
  private records: LlmUsageRecord[] = [];

  constructor(private budget: CostBudget) {}

  record(entry: LlmUsageRecord): { allowed: boolean; total_usd: number } {
    this.records.push(entry);
    const total = this.totalUsd();
    return { allowed: total <= this.budget.max_usd, total_usd: total };
  }

  totalUsd(): number {
    return this.records.reduce((s, r) => s + r.cost_usd, 0);
  }

  snapshot() {
    const live = this.records.filter((r) => !r.cached_replay);
    const cached = this.records.filter((r) => r.cached_replay);
    return {
      total_usd: this.totalUsd(),
      budget_usd: this.budget.max_usd,
      llm_calls: this.records.length,
      input_tokens: this.records.reduce((s, r) => s + r.input_tokens, 0),
      output_tokens: this.records.reduce((s, r) => s + r.output_tokens, 0),
      cached_replay_calls: cached.length,
      live_inference_calls: live.length,
      records: [...this.records],
    };
  }

  isOverBudget(): boolean {
    return this.totalUsd() > this.budget.max_usd;
  }
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

export function latencySummary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}
