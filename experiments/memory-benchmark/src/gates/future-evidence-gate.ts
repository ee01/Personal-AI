/** Hard gate: no evidence with observed_at > as_of in recall, decide, or export derivatives. */
import type { MemoryBenchmarkAdapter, PersonalMemoryEvent } from "../types.js";
import { isVisibleAt, parseVirtualMs } from "../clock/virtual-time.js";
import type { GateCheckResult } from "./adapter-gates.js";

const BASE: Omit<PersonalMemoryEvent, "event_id" | "text" | "observed_at" | "occurred_at"> = {
  source: "messages_raw",
  source_type: "glip",
  scope: "work",
  group_id: "g-future",
  thread_root: "t-future",
  sender: null,
  metadata: {},
  acl: { scope: "work", trust_class: null },
  provenance: { source_version: "future-gate-v1" },
};

function exportLeaksFutureContent(exported: Record<string, unknown>): string[] {
  const failures: string[] = [];
  const marker = "delta-future-gate-5678";
  const derived = exported.derived_snippets;
  if (Array.isArray(derived) && derived.some((d) => typeof d === "string" && d.includes(marker))) {
    failures.push("future_in_derived_snippets");
  }
  const cacheIds = exported.recall_cache_event_ids;
  if (Array.isArray(cacheIds) && cacheIds.includes("gate:future-future")) {
    failures.push("future_in_recall_cache_export");
  }
  return failures;
}

function hitsFutureAtAsOf(
  hits: Array<{ event_id?: string; observed_at?: string; text?: string }>,
  future: PersonalMemoryEvent,
  asOf: string,
): boolean {
  const asOfMs = parseVirtualMs(asOf);
  for (const hit of hits) {
    if (hit.event_id === future.event_id) {
      if (parseVirtualMs(future.observed_at) > asOfMs) return true;
    }
    if (hit.observed_at && parseVirtualMs(hit.observed_at) > asOfMs) {
      if (hit.text?.includes("delta-future-gate") || hit.event_id === future.event_id) return true;
    }
  }
  return false;
}

export async function runFutureEvidenceHardGate(
  adapter: MemoryBenchmarkAdapter,
): Promise<GateCheckResult> {
  const failures: string[] = [];
  const scope = "work";

  const past: PersonalMemoryEvent = {
    ...BASE,
    event_id: "gate:future-past",
    occurred_at: "2026-01-01T10:00:00.000Z",
    observed_at: "2026-01-01T10:00:05.000Z",
    text: "Past gate phrase gamma-future-gate-1234 unique.",
    provenance: { source_version: "past-v1" },
  };
  const future: PersonalMemoryEvent = {
    ...BASE,
    event_id: "gate:future-future",
    occurred_at: "2026-01-03T10:00:00.000Z",
    observed_at: "2026-01-03T10:00:00.000Z",
    text: "Future gate phrase delta-future-gate-5678 unique.",
    provenance: { source_version: "future-v1" },
  };
  const asOfBeforeFuture = "2026-01-02T12:00:00.000Z";

  try {
    await adapter.ingest(past);
    await adapter.ingest(future);
    await adapter.consolidate(asOfBeforeFuture);

    const recallBefore = await adapter.recall(
      { text: "delta-future-gate-5678", scope },
      asOfBeforeFuture,
      scope,
    );
    if (hitsFutureAtAsOf(recallBefore.hits, future, asOfBeforeFuture)) {
      failures.push("future_recall_leak_before_as_of");
    }
    if (recallBefore.hits.some((h) => h.event_id === future.event_id)) {
      failures.push("future_event_id_in_recall");
    }

    const decideBefore = await adapter.decide({
      scene: "message_sidecar",
      as_of: asOfBeforeFuture,
      scope,
      context: { text: "delta-future-gate-5678 future phrase" },
    });
    if (decideBefore.cited_event_ids.includes(future.event_id)) {
      failures.push("future_citation_in_decide");
    }
    if (
      decideBefore.output_text.includes("delta-future-gate-5678") &&
      !decideBefore.cited_event_ids.includes(past.event_id)
    ) {
      failures.push("future_text_in_decide_output");
    }

    const exportedBefore = (await adapter.export()) as Record<string, unknown>;
    failures.push(...exportLeaksFutureContent(exportedBefore));

    await adapter.consolidate(future.observed_at);
    const boundaryRecall = await adapter.recall(
      { text: "delta-future-gate-5678", scope },
      future.observed_at,
      scope,
    );
    const visibleAtBoundary = boundaryRecall.hits.some(
      (h) =>
        h.event_id === future.event_id ||
        h.text.includes("delta-future-gate-5678"),
    );
    if (!visibleAtBoundary && isVisibleAt(future, future.observed_at)) {
      failures.push("boundary_as_of_equals_observed_missing_future");
    }

    const futureV2: PersonalMemoryEvent = {
      ...future,
      text: "Future gate phrase delta-future-gate-5678 UPDATED version two.",
      provenance: { source_version: "future-v2" },
      observed_at: "2026-01-04T10:00:00.000Z",
      occurred_at: "2026-01-04T10:00:00.000Z",
    };
    await adapter.ingest(futureV2);
    const recallStillPast = await adapter.recall(
      { text: "UPDATED version two", scope },
      asOfBeforeFuture,
      scope,
    );
    if (recallStillPast.hits.some((h) => h.text.includes("UPDATED version two"))) {
      failures.push("future_modify_visible_at_past_as_of");
    }

    await adapter.delete(future.event_id);
    const recallAfterFutureDelete = await adapter.recall(
      { text: "delta-future-gate-5678", scope },
      asOfBeforeFuture,
      scope,
    );
    if (recallAfterFutureDelete.hits.some((h) => h.event_id === future.event_id)) {
      failures.push("future_delete_still_visible_at_past_as_of");
    }
  } catch (e) {
    failures.push(`future_gate_threw:${e instanceof Error ? e.message : String(e)}`);
  }

  return { ok: failures.length === 0, failures };
}
