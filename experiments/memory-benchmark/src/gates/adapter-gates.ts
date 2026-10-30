/** Post-run acceptance checks for adapter gate tests (delete / revoke / export). */
import type { MemoryBenchmarkAdapter, PersonalMemoryEvent } from "../types.js";

export interface GateCheckResult {
  ok: boolean;
  failures: string[];
}

function exportHasRecallCache(exported: Record<string, unknown>): boolean {
  const keys = exported.recall_cache_keys;
  return Array.isArray(keys) && keys.length > 0;
}

function recallCacheReferencesEvent(
  exported: Record<string, unknown>,
  eventId: string,
): boolean {
  const ids = exported.recall_cache_event_ids;
  if (Array.isArray(ids)) {
    return ids.includes(eventId);
  }
  return exportHasRecallCache(exported);
}

function derivedStillReferencesEvent(
  exported: Record<string, unknown>,
  eventId: string,
): boolean {
  const derived = exported.derived_snippets;
  if (!Array.isArray(derived)) return false;
  return derived.some((d) => typeof d === "string" && d.includes(eventId));
}

export async function runExportGate(adapter: MemoryBenchmarkAdapter): Promise<GateCheckResult> {
  const failures: string[] = [];
  try {
    const data = await adapter.export();
    if (data === null || typeof data !== "object") failures.push("export_not_object");
  } catch (e) {
    failures.push(`export_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ok: failures.length === 0, failures };
}

export async function runDeleteRevokeGate(
  adapter: MemoryBenchmarkAdapter,
  sample: PersonalMemoryEvent,
): Promise<GateCheckResult> {
  const failures: string[] = [];
  await adapter.ingest(sample);
  await adapter.recall(
    { text: sample.text.slice(0, 20), scope: sample.scope },
    sample.observed_at,
    sample.scope,
  );
  await adapter.consolidate(sample.observed_at);

  await adapter.delete(sample.event_id);

  const recallAfterDelete = await adapter.recall(
    { text: sample.text.slice(0, 20), scope: sample.scope },
    sample.observed_at,
    sample.scope,
  );
  if (recallAfterDelete.hits.some((h) => h.event_id === sample.event_id)) {
    failures.push("delete_still_recalled");
  }

  const exportAfterDelete = (await adapter.export()) as Record<string, unknown>;
  if (derivedStillReferencesEvent(exportAfterDelete, sample.event_id)) {
    failures.push("delete_still_in_derived");
  }
  if (recallCacheReferencesEvent(exportAfterDelete, sample.event_id)) {
    failures.push("delete_still_in_recall_cache");
  }

  await adapter.revoke(sample.scope);
  const recallAfterRevoke = await adapter.recall(
    { text: sample.text.slice(0, 20), scope: sample.scope },
    sample.observed_at,
    sample.scope,
  );
  if (recallAfterRevoke.hits.length > 0) {
    failures.push("revoke_still_recalled");
  }

  const exportAfterRevoke = (await adapter.export()) as Record<string, unknown>;
  if (derivedStillReferencesEvent(exportAfterRevoke, sample.event_id)) {
    failures.push("revoke_still_in_derived");
  }
  if (recallCacheReferencesEvent(exportAfterRevoke, sample.event_id)) {
    failures.push("revoke_still_in_recall_cache");
  }

  const inFlight = exportAfterRevoke.in_flight_consolidation;
  if (inFlight !== null && inFlight !== undefined) {
    failures.push("revoke_inflight_consolidation_exposed");
  }

  return { ok: failures.length === 0, failures };
}
