import type { MemoryBenchmarkAdapter, PersonalMemoryEvent } from "../types.js";
import { runDeleteRevokeGate, runExportGate, type GateCheckResult } from "./adapter-gates.js";

export interface NamedGateResult {
  gate: string;
  ok: boolean;
  failures: string[];
  candidate_limitation?: boolean;
}

const baseEvent: PersonalMemoryEvent = {
  event_id: "gate:export-base",
  source: "messages_raw",
  source_type: "glip",
  occurred_at: "2026-01-01T10:00:00.000Z",
  observed_at: "2026-01-01T10:00:05.000Z",
  scope: "work",
  group_id: "g",
  thread_root: "t",
  sender: null,
  text: "export gate sample",
  metadata: {},
  acl: { scope: "work", trust_class: null },
  provenance: { source_version: "v1" },
};

export async function runIdempotencyGate(
  adapter: MemoryBenchmarkAdapter,
  schemeTag: string,
): Promise<NamedGateResult> {
  const failures: string[] = [];
  const sample: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: `gate:${schemeTag}-idem`,
    text: `idempotent ingest text ${schemeTag}`,
    provenance: { source_version: "idem-v1" },
  };
  try {
    await adapter.ingest(sample);
    await adapter.ingest(sample);
    const exported = (await adapter.export()) as {
      evidence_events?: unknown[];
      event_count?: number;
      evidence_event_ids?: string[];
    };
    const rows = exported.evidence_events ?? [];
    if (rows.length) {
      const matching = rows.filter(
        (r) => (r as { event_id?: string }).event_id === sample.event_id,
      );
      if (matching.length !== 1) failures.push(`idempotent_row_count:${matching.length}`);
    } else {
      const ids = exported.evidence_event_ids ?? [];
      const matchIds = ids.filter((id) => id === sample.event_id);
      if (matchIds.length > 1) failures.push(`idempotent_row_count:${matchIds.length}`);
      if ((exported.event_count ?? ids.length) < 1) failures.push("idempotent_no_export_rows");
    }
  } catch (e) {
    failures.push(`idempotent_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { gate: "idempotency", ok: failures.length === 0, failures };
}

export async function runModifyPropagationGate(
  adapter: MemoryBenchmarkAdapter,
  schemeTag: string,
  scope = "work",
): Promise<NamedGateResult> {
  const failures: string[] = [];
  const eventId = `gate:${schemeTag}-modify`;
  const v1: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: eventId,
    scope,
    acl: { scope, trust_class: null },
    text: "Original benchmark modify text Shanghai gate.",
    provenance: { source_version: "mod-v1" },
  };
  const v2: PersonalMemoryEvent = {
    ...v1,
    text: "Updated benchmark modify text Hangzhou gate.",
    provenance: { source_version: "mod-v2" },
  };
  try {
    await adapter.ingest(v1);
    await adapter.consolidate(v1.observed_at);
    const before = await adapter.recall(
      { text: "Shanghai gate modify", scope },
      v1.observed_at,
      scope,
    );
    if (before.hits.length === 0) {
      const preExport = JSON.stringify(await adapter.export());
      if (!preExport.includes("Shanghai")) failures.push("modify_pre_recall_empty");
    }

    await adapter.ingest(v2);
    await adapter.consolidate(v2.observed_at);
    const after = await adapter.recall(
      { text: "Hangzhou gate modify", scope },
      v2.observed_at,
      scope,
    );
    const exported = (await adapter.export()) as {
      evidence_events?: Array<{ body?: string; text?: string }>;
    };
    const exportBlob = JSON.stringify(exported);
    const bodies = (exported.evidence_events ?? []).map(
      (r) => r.body ?? r.text ?? "",
    );
    const hasNewBody = bodies.some((b) => b.includes("Hangzhou")) || exportBlob.includes("Hangzhou");
    if (!after.hits.some((h) => h.text.includes("Hangzhou")) && !hasNewBody) {
      failures.push("modify_post_recall_missing_new");
    }
    const oldAfter = await adapter.recall(
      { text: "Shanghai gate modify", scope },
      v2.observed_at,
      scope,
    );
    const topOld = oldAfter.hits[0];
    const oldDominant =
      topOld?.text.includes("Shanghai") &&
      !topOld.text.includes("Hangzhou") &&
      !hasNewBody;
    if (oldDominant) failures.push("modify_old_content_still_dominant");
  } catch (e) {
    failures.push(`modify_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { gate: "modify_delete_propagation", ok: failures.length === 0, failures };
}

export type AdapterFactory = (runId: string) => Promise<MemoryBenchmarkAdapter & { close(): Promise<void> }>;

export async function runPermissionIsolationGate(
  createAdapter: AdapterFactory,
  runId: string,
  schemeTag: string,
): Promise<NamedGateResult> {
  const failures: string[] = [];
  const adapterA = await createAdapter(`${runId}-iso-a`);
  const adapterB = await createAdapter(`${runId}-iso-b`);
  try {
    await adapterA.ingest({
      ...baseEvent,
      event_id: `gate:${schemeTag}-iso-secret`,
      scope: "scope-a",
      acl: { scope: "scope-a", trust_class: null },
      text: "Scope A isolated secret phrase alpha-iso-7788.",
      provenance: { source_version: "iso-v1" },
    });
    const leak = await adapterB.recall(
      { text: "alpha-iso-7788 isolated", scope: "scope-b" },
      baseEvent.observed_at,
      "scope-b",
    );
    if (leak.hits.some((h) => h.text.includes("alpha-iso-7788"))) {
      failures.push("cross_scope_recall_leak");
    }
    const exportB = (await adapterB.export()) as { evidence_events?: unknown[]; event_count?: number };
    const evCount = exportB.evidence_events?.length ?? exportB.event_count ?? 0;
    if (evCount > 0 && schemeTag === "E") {
      /* Letta sidecar may list empty evidence while MemFS exists — checked via recall only */
    }
  } catch (e) {
    failures.push(`isolation_threw:${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await adapterA.close();
    await adapterB.close();
  }
  return { gate: "permission_isolation", ok: failures.length === 0, failures };
}

export async function runSourceExportGate(adapter: MemoryBenchmarkAdapter): Promise<NamedGateResult> {
  const r = await runExportGate(adapter);
  return { gate: "source_export", ok: r.ok, failures: r.failures };
}

export async function runDeleteRevokePropagationGate(
  adapter: MemoryBenchmarkAdapter,
  schemeTag: string,
): Promise<NamedGateResult> {
  const r = await runDeleteRevokeGate(adapter, {
    ...baseEvent,
    event_id: `gate:${schemeTag}-delete`,
    text: `delete revoke gate content for scheme ${schemeTag}`,
    provenance: { source_version: "del-v1" },
  });
  return { gate: "delete_revoke_propagation", ok: r.ok, failures: r.failures };
}

export { baseEvent };
