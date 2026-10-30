import { describe, expect, it } from "vitest";
import { isVisibleAt, virtualDayKey } from "../src/clock/virtual-time.js";
import { scoreProbe, checkHardGates } from "../src/scoring/scorer.js";
import type { PersonalMemoryEvent, ProbePoint } from "../src/types.js";
import {
  buildAdapterDecideInput,
  buildAdapterRecallQuery,
  PROBE_GOLDEN_FIELD_NAMES,
} from "../src/scene/adapter-input.js";
import { runDeleteRevokeGate } from "../src/gates/adapter-gates.js";
import { StubMemoryAdapter } from "../adapters/stub-adapter.js";
import { loadEventsJsonl } from "../src/data/load.js";

const baseEvent: PersonalMemoryEvent = {
  event_id: "e1",
  source: "messages_raw",
  source_type: "glip",
  occurred_at: "2026-01-01T10:00:00.000Z",
  observed_at: "2026-01-01T10:00:05.000Z",
  scope: "work",
  group_id: "g",
  thread_root: "t",
  sender: null,
  text: "hello",
  metadata: {},
  acl: { scope: "work", trust_class: null },
  provenance: {},
};

const sceneInput = {
  scene_id: "t",
  text: "hello there",
  thread_id: "t",
  group_id: "g",
};

describe("virtual-time", () => {
  it("filters by observed_at", () => {
    expect(isVisibleAt(baseEvent, "2026-01-01T10:00:05.000Z")).toBe(true);
    expect(isVisibleAt(baseEvent, "2026-01-01T10:00:04.000Z")).toBe(false);
    expect(virtualDayKey(baseEvent.observed_at)).toBe("2026-01-01");
  });
});

describe("adapter input (golden isolation)", () => {
  const probe: ProbePoint = {
    probe_id: "t",
    storyline_key: "s",
    scene: "message_sidecar",
    as_of: "2026-01-01T12:00:00.000Z",
    scope: "work",
    scene_input: sceneInput,
    visible_evidence_ids: ["e1"],
    required_facts: ["secret-golden"],
    forbidden_assertions: [],
    allowed_actions: ["show_sidecar", "silence"],
    trigger_window: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" },
    should_trigger: true,
    latency_budget_ms: 500,
  };

  it("does not pass golden fields to decide context", () => {
    const input = buildAdapterDecideInput(probe);
    for (const key of PROBE_GOLDEN_FIELD_NAMES) {
      expect(Object.keys(input.context)).not.toContain(key);
    }
    expect(input.context.text).toBe(sceneInput.text);
  });

  it("builds recall query from scene_input only", () => {
    const q = buildAdapterRecallQuery(probe);
    expect(q.text).toBe(sceneInput.text);
    expect(q.text).not.toContain("secret-golden");
  });
});

describe("runBenchmark smoke", () => {
  it("runs synthetic-mini fixture end-to-end", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const { loadProbesJsonl } = await import("../src/data/load.js");
    const { AuthorityFixtureStore } = await import("../src/clock/authority-fixture.js");
    const { NotificationSink } = await import("../src/sink/notification-sink.js");
    const { CostTracker } = await import("../src/cost/tracker.js");
    const { runBenchmark } = await import("../src/scoring/probe-runner.js");

    const fixture = join(pkgRoot, "fixtures/synthetic-mini");
    const events = await loadEventsJsonl(join(fixture, "events.jsonl"));
    const probes = await loadProbesJsonl(join(fixture, "probes.jsonl"));
    const authorityJson = JSON.parse(await readFile(join(fixture, "authority.json"), "utf8"));
    const report = await runBenchmark({
      adapter: new StubMemoryAdapter("stub"),
      events,
      probes,
      authority: new AuthorityFixtureStore(authorityJson),
      sink: new NotificationSink(),
      cost: new CostTracker({ max_usd: 50 }),
      fixtureId: "synthetic-mini",
      runId: "test",
    });
    expect(report.events_ingested).toBe(4);
    expect(report.probes_run).toBe(3);
    expect(report.probes_passed).toBeGreaterThanOrEqual(2);
  });

  it("runs probes at checkpoints before later days are ingested", async () => {
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const { loadProbesJsonl } = await import("../src/data/load.js");
    const { AuthorityFixtureStore } = await import("../src/clock/authority-fixture.js");
    const { NotificationSink } = await import("../src/sink/notification-sink.js");
    const { CostTracker } = await import("../src/cost/tracker.js");
    const { runBenchmark } = await import("../src/scoring/probe-runner.js");

    class CountingAdapter extends StubMemoryAdapter {
      eventsAtDecide: Record<string, number> = {};
      async decide(input: Parameters<StubMemoryAdapter["decide"]>[0]) {
        const exported = (await this.export()) as { event_count?: number };
        const sceneId = (input.context as { scene_id?: string }).scene_id;
        if (sceneId) {
          this.eventsAtDecide[sceneId] = exported.event_count ?? 0;
        }
        return super.decide(input);
      }
    }

    const fixture = join(pkgRoot, "fixtures/synthetic-mini");
    const events = await loadEventsJsonl(join(fixture, "events.jsonl"));
    const probes = await loadProbesJsonl(join(fixture, "probes.jsonl"));
    const adapter = new CountingAdapter("count");
    await runBenchmark({
      adapter,
      events,
      probes,
      authority: new AuthorityFixtureStore({ records: [] }),
      sink: new NotificationSink(),
      cost: new CostTracker({ max_usd: 50 }),
      fixtureId: "synthetic-mini",
      runId: "checkpoint-order",
    });
    expect(adapter.eventsAtDecide.p2).toBe(2);
    expect(adapter.eventsAtDecide.p3).toBe(4);
  });
});

describe("delete/revoke gates", () => {
  it("blocks recall cache and derived snippets", async () => {
    const adapter = new StubMemoryAdapter("gate");
    const sample: PersonalMemoryEvent = {
      ...baseEvent,
      event_id: "gate:1",
      text: "gate sample content",
    };
    const result = await runDeleteRevokeGate(adapter, sample);
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("scheme B passes delete/revoke gate", async () => {
    const { createNewCoreSchemeBAdapter } = await import("../adapters/new-core/adapter.js");
    const adapter = await createNewCoreSchemeBAdapter({ runId: "gate-test", fresh: true });
    const sample: PersonalMemoryEvent = {
      ...baseEvent,
      event_id: "gate:b1",
      text: "gate sample content for scheme B",
    };
    const result = await runDeleteRevokeGate(adapter, sample);
    await adapter.close();
    expect(result.ok).toBe(true);
  });

  it("scheme C passes delete/revoke gate", async () => {
    const { createMem0SchemeCAdapter, mem0IntegrationAvailable } = await import(
      "../adapters/mem0/adapter.js"
    );
    if (!mem0IntegrationAvailable()) return;
    const adapter = await createMem0SchemeCAdapter({ runId: "gate-test", fresh: true });
    const sample: PersonalMemoryEvent = {
      ...baseEvent,
      event_id: "gate:c1",
      text: "gate sample content for scheme C mem0",
    };
    const result = await runDeleteRevokeGate(adapter, sample);
    await adapter.close();
    expect(result.ok).toBe(true);
  }, 120_000);

  it("scheme D passes delete/revoke gate", async () => {
    const { createSupermemorySchemeDAdapter, supermemoryServerReachable } = await import(
      "../adapters/supermemory/adapter.js"
    );
    if (!(await supermemoryServerReachable())) return;
    const adapter = await createSupermemorySchemeDAdapter({ runId: "gate-test", fresh: true });
    const sample: PersonalMemoryEvent = {
      ...baseEvent,
      event_id: "gate:d1",
      text: "gate sample content for scheme D supermemory",
    };
    const result = await runDeleteRevokeGate(adapter, sample);
    await adapter.close();
    expect(result.ok).toBe(true);
  }, 180_000);

  it("scheme E passes delete/revoke gate", async () => {
    const { createLettaSchemeEAdapter, lettaServerReachable } = await import(
      "../adapters/letta/adapter.js"
    );
    if (!(await lettaServerReachable())) return;
    const adapter = await createLettaSchemeEAdapter({ runId: "gate-test", fresh: true });
    const sample: PersonalMemoryEvent = {
      ...baseEvent,
      event_id: "gate:e1",
      text: "gate sample content for scheme E letta",
    };
    const result = await runDeleteRevokeGate(adapter, sample);
    await adapter.close();
    expect(result.ok).toBe(true);
  }, 180_000);
});

describe("phase1 synthetic sample JSONL", () => {
  it("loads committed synthetic-sample-events.jsonl", async () => {
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const path = join(
      pkgRoot,
      "../../memory-service/evals/personal-memory-dataset/synthetic-sample-events.jsonl",
    );
    const events = await loadEventsJsonl(path);
    expect(events.length).toBe(3);
    expect(events.every((e) => e.provenance && (e.provenance as { synthetic?: boolean }).synthetic)).toBe(
      true,
    );
  });
});

describe("scorer", () => {
  const probe: ProbePoint = {
    probe_id: "t",
    storyline_key: "s",
    scene: "message_sidecar",
    as_of: "2026-01-01T12:00:00.000Z",
    scope: "work",
    scene_input: sceneInput,
    visible_evidence_ids: ["e1"],
    required_facts: ["hello"],
    forbidden_assertions: [],
    allowed_actions: ["show_sidecar", "silence"],
    trigger_window: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" },
    should_trigger: true,
    latency_budget_ms: 500,
  };

  it("scores silence negative correctly", () => {
    const { composite } = scoreProbe(
      { ...probe, should_trigger: false },
      { action: "silence", output_text: "", cited_event_ids: [], latency_ms: 1 },
      undefined,
    );
    expect(composite).toBe(100);
  });

  it("hard gate catches future citation", () => {
    const failures = checkHardGates(
      probe,
      {
        action: "show_sidecar",
        output_text: "hello",
        cited_event_ids: ["e1"],
        latency_ms: 1,
      },
      undefined,
      {
        eventsById: new Map([["e1", { ...baseEvent, observed_at: "2026-01-02T00:00:00.000Z" }]]),
        revokedScopes: new Set(),
        deletedEventIds: new Set(),
      },
    );
    expect(failures.some((f) => f.startsWith("future_citation"))).toBe(true);
  });
});

describe("six-gate helpers", () => {
  it("stub passes future evidence hard gate", async () => {
    const { runFutureEvidenceHardGate } = await import("../src/gates/future-evidence-gate.js");
    const adapter = new StubMemoryAdapter("future-stub");
    const result = await runFutureEvidenceHardGate(adapter);
    expect(result.ok).toBe(true);
  });

  it("stub passes observable reconciliation gate", async () => {
    const { runObservableReconciliationGate } = await import(
      "../src/gates/observable-reconciliation-gate.js"
    );
    const adapter = new StubMemoryAdapter("obs-stub");
    const result = await runObservableReconciliationGate(adapter);
    expect(result.ok).toBe(true);
  });
});
