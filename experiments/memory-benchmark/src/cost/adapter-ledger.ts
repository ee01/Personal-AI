import type { CostSummary } from "../types.js";

interface LedgerRow {
  cost_usd?: number;
}

/** Sum `cost_usd` on adapter export `cost_ledger` rows (harness consolidation / scheme B LLM). */
export function sumExportedCostLedger(records: unknown): number {
  if (!Array.isArray(records)) return 0;
  return records.reduce((sum, row) => {
    const usd = (row as LedgerRow).cost_usd;
    return sum + (typeof usd === "number" && Number.isFinite(usd) ? usd : 0);
  }, 0);
}

export interface AdapterCostFromExport {
  adapter_usd: number;
  reconciliation_note?: string;
}

/** Read adapter-side spend from `export()` payload. */
export function adapterCostFromExport(
  schemeId: string,
  exported: Record<string, unknown>,
): AdapterCostFromExport {
  const adapter_usd = sumExportedCostLedger(exported.cost_ledger);
  let reconciliation_note: string | undefined;
  if (schemeId === "D") {
    reconciliation_note =
      "需 OpenRouter Activity 对账（Supermemory Local 服务端抽取无 token 回传）";
  }
  return { adapter_usd, reconciliation_note };
}

export function buildMergedCostSummary(
  harnessUsd: number,
  budgetUsd: number,
  harnessSnap: {
    llm_calls: number;
    input_tokens: number;
    output_tokens: number;
    cached_replay_calls: number;
    live_inference_calls: number;
  },
  adapterPart: AdapterCostFromExport,
): CostSummary {
  const combined_usd = harnessUsd + adapterPart.adapter_usd;
  return {
    harness_usd: harnessUsd,
    adapter_usd: adapterPart.adapter_usd,
    total_usd: combined_usd,
    combined_usd,
    budget_usd: budgetUsd,
    llm_calls: harnessSnap.llm_calls,
    input_tokens: harnessSnap.input_tokens,
    output_tokens: harnessSnap.output_tokens,
    cached_replay_calls: harnessSnap.cached_replay_calls,
    live_inference_calls: harnessSnap.live_inference_calls,
    reconciliation_note: adapterPart.reconciliation_note,
  };
}

export function isCombinedOverBudget(cost: CostSummary): boolean {
  return cost.combined_usd > cost.budget_usd;
}
