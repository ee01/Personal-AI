import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendProxyLedgerEntry,
  proxyTotalsFromFile,
  sumProxyLedger,
} from "../src/cost/proxy-ledger.js";
import { isCombinedOverBudget, buildMergedCostSummary } from "../src/cost/adapter-ledger.js";

describe("proxy ledger", () => {
  it("sums cost_usd and counts calls", () => {
    const dir = mkdtempSync(join(tmpdir(), "proxy-ledger-"));
    const path = join(dir, "run.jsonl");
    appendProxyLedgerEntry(path, {
      at: new Date().toISOString(),
      scheme_id: "A",
      run_id: "run-1",
      tier: "fast",
      label: "extract",
      generation_id: "gen-1",
      model: "z-ai/glm-5.3-flash",
      input_tokens: 10,
      output_tokens: 5,
      cost_usd: 0.002,
      path: "/v1/chat/completions",
      streaming: false,
    });
    appendProxyLedgerEntry(path, {
      at: new Date().toISOString(),
      scheme_id: "A",
      run_id: "run-1",
      tier: "main",
      label: "reconcile",
      generation_id: "gen-2",
      model: "z-ai/glm-5.3",
      input_tokens: 20,
      output_tokens: 8,
      cost_usd: 0.003,
      path: "/v1/chat/completions",
      streaming: false,
    });
    const totals = proxyTotalsFromFile(path);
    expect(totals.proxy_usd).toBeCloseTo(0.005, 6);
    expect(totals.proxy_calls).toBe(2);
    expect(totals.generation_ids).toEqual(["gen-1", "gen-2"]);
    expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it("uses proxy_usd for budget when ledger path is wired", () => {
    const summary = buildMergedCostSummary(
      0,
      0.01,
      {
        llm_calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cached_replay_calls: 0,
        live_inference_calls: 0,
      },
      { adapter_usd: 0.5 },
      "/tmp/unused-but-set.jsonl",
    );
    summary.proxy_usd = 0.011;
    expect(isCombinedOverBudget(summary, "/tmp/unused-but-set.jsonl")).toBe(true);
    summary.proxy_usd = 0.005;
    expect(isCombinedOverBudget(summary, "/tmp/unused-but-set.jsonl")).toBe(false);
    expect(sumProxyLedger([]).proxy_calls).toBe(0);
  });
});
