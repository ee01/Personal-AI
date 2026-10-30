import type {
  BenchmarkReport,
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  ProbePoint,
  ProbeRunOutcome,
} from "../types.js";
import { AuthorityFixtureStore } from "../clock/authority-fixture.js";
import {
  probesDueAtCheckpoint,
  runVirtualReplay,
  type ReplayCheckpoint,
} from "../clock/virtual-replay.js";
import { NotificationSink } from "../sink/notification-sink.js";
import { CostTracker } from "../cost/tracker.js";
import { latencySummary } from "../cost/tracker.js";
import { checkHardGates, scoreProbe } from "../scoring/scorer.js";
import {
  buildAdapterDecideInput,
  buildAdapterRecallQuery,
} from "../scene/adapter-input.js";
import { parseVirtualMs } from "../clock/virtual-time.js";

export interface ProbeRunnerOptions {
  adapter: MemoryBenchmarkAdapter;
  events: PersonalMemoryEvent[];
  probes: ProbePoint[];
  authority: AuthorityFixtureStore;
  sink: NotificationSink;
  cost: CostTracker;
  mode?: "quality" | "capacity";
  fixtureId: string;
  runId: string;
  /** @deprecated Per-probe `checkpoint` on ProbePoint. */
  probeCheckpoint?: "pre_consolidation" | "post_consolidation";
}

async function runDueProbes(
  due: ProbePoint[],
  checkpoint: ReplayCheckpoint,
  opts: {
    adapter: MemoryBenchmarkAdapter;
    sink: NotificationSink;
    cost: CostTracker;
    gateCtx: {
      eventsById: Map<string, PersonalMemoryEvent>;
      revokedScopes: Set<string>;
      deletedEventIds: Set<string>;
    };
    decideLatencies: number[];
    outcomes: ProbeRunOutcome[];
  },
): Promise<string | undefined> {
  for (const probe of due) {
    if (parseVirtualMs(probe.as_of) > parseVirtualMs(checkpoint.virtual_now)) {
      continue;
    }
    if (opts.cost.isOverBudget()) {
      return "cost_budget_exceeded";
    }

    const decideInput = buildAdapterDecideInput(probe);
    const decide = await opts.adapter.decide(decideInput);
    opts.decideLatencies.push(decide.latency_ms);

    const recall = await opts.adapter.recall(
      buildAdapterRecallQuery(probe),
      probe.as_of,
      probe.scope,
    );

    const hard_gate_failures = checkHardGates(probe, decide, recall, opts.gateCtx);
    const { scores, composite } = scoreProbe(probe, decide, recall);
    const passed = hard_gate_failures.length === 0 && composite >= 0;

    if (decide.action !== "silence") {
      opts.sink.record({
        at_virtual: probe.as_of,
        action: decide.action,
        target: probe.target_object,
        body: decide.output_text,
        cited_event_ids: decide.cited_event_ids,
      });
    }

    opts.outcomes.push({
      probe,
      decide,
      recall,
      scores,
      composite,
      hard_gate_failures,
      passed: passed && hard_gate_failures.length === 0,
    });
  }
  return undefined;
}

export async function runBenchmark(opts: ProbeRunnerOptions): Promise<BenchmarkReport> {
  const sink = opts.sink;
  const ingestLatencies: number[] = [];
  const decideLatencies: number[] = [];
  const outcomes: ProbeRunOutcome[] = [];
  const eventsById = new Map(opts.events.map((e) => [e.event_id, e]));
  const gateCtx = {
    eventsById,
    revokedScopes: new Set<string>(),
    deletedEventIds: new Set<string>(),
  };

  let stoppedReason: string | undefined;

  const wrapped: MemoryBenchmarkAdapter = {
    schemeId: opts.adapter.schemeId,
    ingest: async (event) => {
      const t0 = performance.now();
      await opts.adapter.ingest(event);
      ingestLatencies.push(performance.now() - t0);
    },
    consolidate: (virtualNow) => opts.adapter.consolidate(virtualNow),
    recall: (q, asOf, scope) => opts.adapter.recall(q, asOf, scope),
    decide: (input) => opts.adapter.decide(input),
    export: () => opts.adapter.export(),
    delete: (id) => opts.adapter.delete(id),
    revoke: (scope) => opts.adapter.revoke(scope),
  };

  const replay = await runVirtualReplay(
    wrapped,
    opts.events,
    opts.authority,
    sink,
    { probeCheckpoint: opts.probeCheckpoint },
    {
      onCheckpoint: async (checkpoint) => {
        if (stoppedReason) return;
        const due = probesDueAtCheckpoint(opts.probes, checkpoint);
        const reason = await runDueProbes(due, checkpoint, {
          adapter: opts.adapter,
          sink,
          cost: opts.cost,
          gateCtx,
          decideLatencies,
          outcomes,
        });
        if (reason) stoppedReason = reason;
      },
    },
  );

  const sceneBuckets: Record<string, number[]> = {};
  for (const o of outcomes) {
    const s = o.probe.scene;
    if (!sceneBuckets[s]) sceneBuckets[s] = [];
    sceneBuckets[s].push(o.composite);
  }
  const scene_means: Record<string, number> = {};
  for (const [k, vals] of Object.entries(sceneBuckets)) {
    scene_means[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const ingest = latencySummary(ingestLatencies);
  const decideLat = latencySummary(decideLatencies);
  const costSnap = opts.cost.snapshot();

  return {
    scheme_id: opts.adapter.schemeId,
    run_id: opts.runId,
    mode: opts.mode ?? "quality",
    fixture_id: opts.fixtureId,
    events_ingested: replay.events_ingested,
    consolidations: replay.consolidations,
    probes_run: outcomes.length,
    probes_passed: outcomes.filter((o) => o.passed).length,
    hard_gate_failures: outcomes.reduce((n, o) => n + o.hard_gate_failures.length, 0),
    mean_composite:
      outcomes.length > 0
        ? outcomes.reduce((s, o) => s + o.composite, 0) / outcomes.length
        : 0,
    scene_means,
    cost: {
      total_usd: costSnap.total_usd,
      budget_usd: costSnap.budget_usd,
      llm_calls: costSnap.llm_calls,
      input_tokens: costSnap.input_tokens,
      output_tokens: costSnap.output_tokens,
      cached_replay_calls: costSnap.cached_replay_calls,
      live_inference_calls: costSnap.live_inference_calls,
    },
    latency: {
      ingest_p50_ms: ingest.p50,
      ingest_p95_ms: ingest.p95,
      ingest_p99_ms: ingest.p99,
      decide_p50_ms: decideLat.p50,
      decide_p95_ms: decideLat.p95,
      decide_p99_ms: decideLat.p99,
    },
    outcomes,
    stopped_reason: stoppedReason,
  };
}
