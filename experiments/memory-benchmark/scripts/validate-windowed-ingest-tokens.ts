#!/usr/bin/env node
/** Offline: ingest N events under windowed full isolation; report proxy input_tokens median. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadBenchmarkDotenv } from "../adapters/mem0/load-env.js";
import { loadEventsJsonl } from "../src/data/load.js";
import { BaselineSchemeAAdapter } from "../adapters/baseline/baseline-adapter.js";
import { applyIngestIsolation, capIngestEventText, resolveIngestIsolation } from "../src/windowed/ingest-extraction.js";
import { startBenchmarkProxySession, stopBenchmarkProxySession } from "../src/cost/benchmark-proxy-session.js";

const N = Number(process.env.VALIDATE_N ?? 20);
const EVENTS = resolve(
  "../../memory-service/evals/personal-memory-dataset/raw-only/events.jsonl",
);

async function main() {
  loadBenchmarkDotenv();
  const isolation = resolveIngestIsolation("paired-control", "full");
  applyIngestIsolation(isolation);
  const events = (await loadEventsJsonl(EVENTS))
    .filter(e => e.observed_at <= "2026-08-18T06:51:44.000Z")
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
    .slice(0, N);
  const runId = `validate-ingest-${Date.now()}`;
  const session = await startBenchmarkProxySession({ runId, schemeId: "A" });
  const t0 = performance.now();
  const adapter = new BaselineSchemeAAdapter("A", session.handle.baseUrl, true);
  await adapter.init();
  try {
    for (const event of events) {
      await adapter.ingest(capIngestEventText(event, isolation));
    }
  } finally {
    await adapter.close();
    await stopBenchmarkProxySession(session);
  }
  const ledger = readFileSync(session.handle.ledgerPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as { input_tokens?: number; model?: string });
  const tokens = ledger.map(r => r.input_tokens ?? 0).filter(n => n > 0);
  tokens.sort((a, b) => a - b);
  const median = tokens[Math.floor(tokens.length / 2)] ?? 0;
  const max = tokens.length ? Math.max(...tokens) : 0;
  const timedOut = ledger.some(r => (r as { error?: string }).error?.includes?.("timeout"));
  console.log(
    JSON.stringify(
      {
        events: events.length,
        llm_calls: tokens.length,
        input_tokens_median: median,
        input_tokens_max: max,
        wall_ms: Math.round(performance.now() - t0),
        ledger: session.handle.ledgerPath,
        ok: median > 0 && median < 2500 && max < 8000,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
