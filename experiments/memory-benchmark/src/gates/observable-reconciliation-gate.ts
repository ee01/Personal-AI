/** Gate: ingest → consolidate → export traceability; idle consolidate must not add facts. */
import type { MemoryBenchmarkAdapter, PersonalMemoryEvent } from "../types.js";
import type { GateCheckResult } from "./adapter-gates.js";

const baseEvent: PersonalMemoryEvent = {
  event_id: "gate:obs-ingest",
  source: "messages_raw",
  source_type: "glip",
  occurred_at: "2026-01-05T10:00:00.000Z",
  observed_at: "2026-01-05T10:00:05.000Z",
  scope: "work-obs",
  group_id: "g-obs",
  thread_root: "t-obs",
  sender: null,
  text: "Observable reconciliation gate trace phrase obs-trace-9911.",
  metadata: { gate: "observable" },
  acl: { scope: "work-obs", trust_class: null },
  provenance: { source_version: "obs-v1", reconcile_batch: "gate-obs-1" },
};

function factCount(exported: Record<string, unknown>): number {
  if (typeof exported.event_count === "number") return exported.event_count;
  if (Array.isArray(exported.fact_revisions)) return exported.fact_revisions.length;
  if (Array.isArray(exported.evidence_events)) return exported.evidence_events.length;
  return 0;
}

function traceLinksEvent(exported: Record<string, unknown>, eventId: string): boolean {
  const ingestTraces = exported.ingest_traces;
  if (
    Array.isArray(ingestTraces) &&
    ingestTraces.some((t) => (t as { event_id?: string }).event_id === eventId)
  ) {
    return true;
  }
  const consolidateTraces = exported.consolidate_traces;
  if (Array.isArray(consolidateTraces) && consolidateTraces.length > 0) return true;
  const decisionTraces = exported.decision_traces;
  if (Array.isArray(decisionTraces) && decisionTraces.length > 0) return true;
  const days = exported.consolidation_days;
  if (Array.isArray(days) && days.length > 0) return true;
  const reconcileRuns = exported.reconcile_nightly_runs;
  if (Array.isArray(reconcileRuns) && reconcileRuns.length > 0) return true;
  const evidenceIds = exported.evidence_event_ids;
  if (Array.isArray(evidenceIds) && evidenceIds.includes(eventId)) return true;
  return false;
}

export async function runObservableReconciliationGate(
  adapter: MemoryBenchmarkAdapter,
): Promise<GateCheckResult> {
  const failures: string[] = [];
  const virtualNow = "2026-01-05T23:00:00.000Z";
  const idlePass = "2026-01-05T23:30:00.000Z";

  try {
    await adapter.ingest(baseEvent);
    await adapter.consolidate(virtualNow);
    await adapter.decide({
      scene: "message_sidecar",
      as_of: virtualNow,
      scope: baseEvent.scope,
      context: { text: "obs-trace-9911 reconciliation" },
    });

    const exported = (await adapter.export()) as Record<string, unknown>;
    if (!traceLinksEvent(exported, baseEvent.event_id)) {
      failures.push("missing_observable_trace_chain");
    }

    const cost = exported.cost_ledger;
    if (cost !== undefined && cost !== null && typeof cost !== "object") {
      failures.push("cost_ledger_not_object");
    }

    const beforeFacts = factCount(exported);
    await adapter.consolidate(idlePass);
    const afterIdle = (await adapter.export()) as Record<string, unknown>;
    const afterFacts = factCount(afterIdle);
    if (afterFacts > beforeFacts) {
      failures.push(`idle_consolidation_added_facts:${beforeFacts}->${afterFacts}`);
    }

    const revBefore = Array.isArray(exported.fact_revisions)
      ? exported.fact_revisions.length
      : null;
    const revAfter = Array.isArray(afterIdle.fact_revisions)
      ? afterIdle.fact_revisions.length
      : null;
    if (revBefore !== null && revAfter !== null && revAfter > revBefore) {
      failures.push(`idle_consolidation_added_revisions:${revBefore}->${revAfter}`);
    }
  } catch (e) {
    failures.push(`observable_gate_threw:${e instanceof Error ? e.message : String(e)}`);
  }

  return { ok: failures.length === 0, failures };
}
