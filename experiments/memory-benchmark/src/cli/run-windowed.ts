#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { BaselineSchemeAAdapter } from "../../adapters/baseline/baseline-adapter.js";
import { createNewCoreSchemeBAdapter } from "../../adapters/new-core/adapter.js";
import { createMem0SchemeCAdapter } from "../../adapters/mem0/adapter.js";
import { createSupermemorySchemeDAdapter } from "../../adapters/supermemory/adapter.js";
import { createLettaSchemeEAdapter } from "../../adapters/letta/adapter.js";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import { loadEventsJsonl, loadProbesJsonl } from "../data/load.js";
import { HistoryIndex, recentEvents } from "../windowed/history.js";
import { configureBaselineBge } from "../windowed/baseline-bge.js";
import { attachHistory } from "../windowed/adapter.js";
import { applyAblationEnv, parseAblationMode } from "../ablation/config.js";
import { startBenchmarkProxySession, stopBenchmarkProxySession } from "../cost/benchmark-proxy-session.js";
import { adapterCostFromExport, buildMergedCostSummary } from "../cost/adapter-ledger.js";
import { CostTracker, latencySummary } from "../cost/tracker.js";
import { buildAdapterDecideInput, buildAdapterRecallQuery } from "../scene/adapter-input.js";
import { checkHardGates, scoreProbe } from "../scoring/scorer.js";
import { writeReports } from "../report/generate.js";
import { proxyTotalsFromFile } from "../cost/proxy-ledger.js";
import type { BenchmarkReport, MemoryBenchmarkAdapter, ProbeRunOutcome } from "../types.js";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!, process.argv[i + 1]!);
const required = (key: string) => { const value = args.get(key); if (!value) throw new Error(`missing_${key}`); return value; };
async function main() {
  const started = Date.now();
  loadBenchmarkDotenv();
  process.env.MEMORY_BENCHMARK_STRICT_BGE = "1";
  const ablation = parseAblationMode(args.get("--ablation") ?? "none");
  applyAblationEnv(ablation);
  const scheme = required("--scheme"), asOf = required("--as-of"), out = resolve(required("--out"));
  const hours = Number(args.get("--hours") ?? 8);
  if (![8,24,72].includes(hours)) throw new Error("invalid_window_hours");
  const strategy = args.get("--strategy") ?? "8h";
  if (!["8h", "full"].includes(strategy)) throw new Error("invalid_strategy");
  const events = await loadEventsJsonl(required("--events"));
  const probes = (await loadProbesJsonl(required("--probes"))).filter(p => p.as_of === asOf);
  if (probes.some(p => !(p.scene_input.text || p.scene_input.recall_query || p.scene_input.scene_id))) throw new Error("missing_scene_only_query");
  if (!probes.length) throw new Error("empty_window_probes");
  const visible = events.filter(e => Date.parse(e.observed_at) <= Date.parse(asOf));
  const recent = strategy === "8h" ? recentEvents(events, asOf, hours) : visible.sort((a,b) => Date.parse(a.observed_at)-Date.parse(b.observed_at));
  await mkdir(out, { recursive: true });
  const history = new HistoryIndex(events);
  // Local-only index can be shared. No generated fact, summary or answer is reused.
  const indexStarted = Date.now();
  if (strategy === "8h") await history.prepare(resolve(".local/windowed-bge-m3"));
  const indexMs = Date.now() - indexStarted;
  const runId = required("--run-id");
  const session = await startBenchmarkProxySession({ runId, schemeId: scheme });
  let adapter: MemoryBenchmarkAdapter | undefined;
  const outcomes: ProbeRunOutcome[] = [], ingestTimes: number[] = [], decideTimes: number[] = [];
  let ingested = 0, consolidations = 0, stopped: string | undefined;
  try {
    const options = { fresh: true, runId };
    if (scheme === "A") adapter = new BaselineSchemeAAdapter("A", session.handle.baseUrl, true);
    else if (scheme === "B") adapter = await createNewCoreSchemeBAdapter(options);
    else if (scheme === "C") adapter = await createMem0SchemeCAdapter(options);
    else if (scheme === "D") adapter = await createSupermemorySchemeDAdapter(options);
    else if (scheme === "E") adapter = await createLettaSchemeEAdapter(options);
    else throw new Error("invalid_scheme");
    if (scheme === "A") await configureBaselineBge(adapter);
    const traces = await attachHistory(adapter, history, strategy === "8h", hours);
    const gateCtx = { eventsById: new Map(events.map(e => [e.event_id, e])), revokedScopes: new Set<string>(), deletedEventIds: new Set<string>() };
    const policyPath = process.env.MEMORY_BENCHMARK_BUDGET_POLICY;
    const checkBudget = async () => {
      if (!policyPath) throw new Error("missing_budget_policy");
      const { budgetBlockReason } = await import("../cost/budget-guard.js");
      const reason = budgetBlockReason(policyPath, scheme);
      if (reason) throw new Error(reason);
    };
    const score = async (checkpoint: string) => {
      for (const p of probes.filter(p => (p.checkpoint ?? "post_consolidation") === checkpoint)) {
        await checkBudget();
        const decide = await adapter!.decide(buildAdapterDecideInput(p));
        const recall = await adapter!.recall(buildAdapterRecallQuery(p), p.as_of, p.scope);
        const failures = checkHardGates(p, decide, recall, gateCtx);
        const scopeIds = [...decide.cited_event_ids, ...recall.hits.flatMap(h => h.event_id ? [h.event_id] : [])];
        for (const id of scopeIds) { const e = gateCtx.eventsById.get(id); if (e && e.scope !== p.scope) failures.push(`scope_leak:${id}`); }
        const scores = scoreProbe(p, decide, recall);
        outcomes.push({ probe: p, decide, recall, ...scores, hard_gate_failures: failures, passed: !failures.length && scores.composite >= 0 });
        decideTimes.push(decide.latency_ms);
        await writeFile(join(out, "partial-outcomes.json"), JSON.stringify(outcomes, null, 2));
        if (failures.some(f => /future|scope_leak|revoked|deleted/.test(f))) throw new Error("safety_gate_failed");
      }
    };
    try {
      let previousDay: string | undefined;
      for (const event of recent) {
        const day = event.observed_at.slice(0, 10);
        if (previousDay && day !== previousDay) {
          await checkBudget();
          await adapter.consolidate(`${previousDay}T23:59:59.999Z`); consolidations++;
        }
        previousDay = day;
        await checkBudget();
        const t0 = performance.now(); await adapter.ingest(event); ingestTimes.push(performance.now() - t0); ingested++;
        if (ingested % 20 === 0) console.log(JSON.stringify({ event: "ingest", runId, ingested, total: recent.length }));
      }
      await score("pre_consolidation");
      await checkBudget();
      // Never consolidate at EOD then query an earlier as_of.
      await adapter.consolidate(asOf); consolidations++;
      await score("post_consolidation");
    } catch (error) { stopped = String(error); }
    const exported = await adapter.export();
    await writeFile(join(out,"adapter-export.json"), JSON.stringify(exported,null,2));
    const tracker = new CostTracker({ max_usd: 50 });
    const snap = tracker.snapshot();
    const cost = buildMergedCostSummary(0, 50, snap, adapterCostFromExport(scheme, exported), session.handle.ledgerPath);
    const ingest = latencySummary(ingestTimes), decide = latencySummary(decideTimes);
    const scenes: Record<string, number[]> = {};
    for (const o of outcomes) (scenes[o.probe.scene] ??= []).push(o.composite);
    const report: BenchmarkReport = {
      scheme_id: scheme, run_id: runId, mode: "quality", fixture_id: `development-v1.1-${strategy}-${hours}h-common-history`, ablation_mode: ablation,
      events_ingested: ingested, consolidations, probes_run: outcomes.length, probes_passed: outcomes.filter(o => o.passed).length,
      hard_gate_failures: outcomes.reduce((n,o) => n + o.hard_gate_failures.length, 0), mean_composite: outcomes.reduce((n,o) => n+o.composite,0)/(outcomes.length||1),
      scene_means: Object.fromEntries(Object.entries(scenes).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length])), cost, outcomes, stopped_reason: stopped,
      latency: { ingest_p50_ms: ingest.p50, ingest_p95_ms: ingest.p95, ingest_p99_ms: ingest.p99, decide_p50_ms: decide.p50, decide_p95_ms: decide.p95, decide_p99_ms: decide.p99 },
    };
    await writeReports(report, join(out, "report.json"), join(out, "report.md"));
    await writeFile(join(out,"retrieval-traces.json"), JSON.stringify(traces,null,2));
    await writeFile(join(out,"execution.json"), JSON.stringify({ strategy, hours, as_of: asOf, started, local_index_ms: indexMs, wall_ms: Date.now()-started, visible_events: visible.length, recent_events: recent.length, probes_expected: probes.length, isolation: "as_of window; B decision SAVEPOINT rollback; A/C/D/E read-only decision audit", generation_evidence: proxyTotalsFromFile(session.handle.ledgerPath), stopped }, null, 2));
    if (stopped) process.exitCode = 2;
  } finally {
    if (adapter && "close" in adapter) await (adapter as MemoryBenchmarkAdapter & { close(): Promise<void> }).close();
    history.close();
    await stopBenchmarkProxySession(session);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
