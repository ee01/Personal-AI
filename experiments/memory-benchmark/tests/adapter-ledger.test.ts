import { describe, expect, it } from "vitest";
import {
  adapterCostFromExport,
  buildMergedCostSummary,
  sumExportedCostLedger,
} from "../src/cost/adapter-ledger.js";

describe("adapter cost ledger merge", () => {
  it("sums export cost_ledger rows", () => {
    const total = sumExportedCostLedger([
      { cost_usd: 0.01 },
      { cost_usd: 0.00571 },
    ]);
    expect(total).toBeCloseTo(0.01571, 5);
  });

  it("builds harness / adapter / combined columns", () => {
    const summary = buildMergedCostSummary(
      0,
      50,
      {
        llm_calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cached_replay_calls: 0,
        live_inference_calls: 0,
      },
      { adapter_usd: 0.00571 },
    );
    expect(summary.harness_usd).toBe(0);
    expect(summary.adapter_usd).toBeCloseTo(0.00571, 5);
    expect(summary.combined_usd).toBeCloseTo(0.00571, 5);
    expect(summary.proxy_usd).toBe(0);
    expect(summary.proxy_calls).toBe(0);
    expect(summary.total_usd).toBe(summary.combined_usd);
  });

  it("notes Supermemory Local reconciliation", () => {
    const { reconciliation_note } = adapterCostFromExport("D", { cost_ledger: [] });
    expect(reconciliation_note).toContain("OpenRouter Activity");
  });
});
