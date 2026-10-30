import type { PersonalMemoryEvent } from "../../src/types.js";
import type { MemoryBenchmarkAdapter } from "../../src/types.js";
import { runDeleteRevokeGate, runExportGate } from "../../src/gates/adapter-gates.js";
import {
  createSupermemorySchemeDAdapter,
  supermemoryServerReachable,
} from "./adapter.js";
import { SupermemoryClient } from "./client.js";
import { documentIdForEvent, namespaceForScope } from "./runtime.js";

export interface PortabilityGateResult {
  gate: string;
  ok: boolean;
  failures: string[];
}

export interface PortabilityReport {
  scheme_id: "D";
  run_at: string;
  server_reachable: boolean;
  all_passed: boolean;
  gates: PortabilityGateResult[];
  swap_to_graphiti: boolean;
  notes: string[];
}

const baseEvent: PersonalMemoryEvent = {
  event_id: "gate:d-export",
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

export async function runSupermemoryPortabilityGates(
  runId = `gate-${Date.now()}`,
): Promise<PortabilityReport> {
  const serverOk = await supermemoryServerReachable();
  const notes: string[] = [];
  if (!serverOk) {
    return {
      scheme_id: "D",
      run_at: new Date().toISOString(),
      server_reachable: false,
      all_passed: false,
      gates: [{ gate: "server", ok: false, failures: ["supermemory_server_unreachable"] }],
      swap_to_graphiti: true,
      notes: ["Start supermemory-server per envs/README.md before running gates."],
    };
  }

  const gates: PortabilityGateResult[] = [];
  const adapter = await createSupermemorySchemeDAdapter({ runId, fresh: true });

  try {
    const exportGate = await runExportGate(adapter);
    gates.push({ gate: "source_export", ok: exportGate.ok, failures: exportGate.failures });

    const idempotent = await runIdempotencyGate(adapter);
    gates.push(idempotent);

    const modify = await runModifyPropagationGate(adapter, runId);
    gates.push(modify);

    const deleteRevoke = await runDeleteRevokeGate(adapter, {
      ...baseEvent,
      event_id: "gate:d-delete",
      text: "delete revoke gate content for scheme D",
      provenance: { source_version: "del-v1" },
    });
    gates.push({
      gate: "delete_revoke_propagation",
      ok: deleteRevoke.ok,
      failures: deleteRevoke.failures,
    });

    const isolation = await runScopeIsolationGate(runId);
    gates.push(isolation);

    const chinese = await runChineseRetrievalGate(runId);
    gates.push(chinese);
  } finally {
    await adapter.close();
  }

  const all_passed = gates.every((g) => g.ok);
  if (!all_passed) {
    notes.push("One or more portability gates failed; E-141 slot D should swap to Graphiti.");
  } else {
    notes.push("All five portability gates passed; keep Supermemory Local in slot D.");
  }

  return {
    scheme_id: "D",
    run_at: new Date().toISOString(),
    server_reachable: true,
    all_passed,
    gates,
    swap_to_graphiti: !all_passed,
    notes,
  };
}

async function runIdempotencyGate(adapter: MemoryBenchmarkAdapter): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const sample: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: "gate:d-idem",
    text: "idempotent ingest text",
    provenance: { source_version: "idem-v1" },
  };
  try {
    await adapter.ingest(sample);
    await adapter.ingest(sample);
    const exported = (await adapter.export()) as { evidence_events?: unknown[] };
    const rows = exported.evidence_events ?? [];
    const matching = rows.filter(
      (r) => (r as { event_id?: string }).event_id === sample.event_id,
    );
    if (matching.length !== 1) failures.push(`idempotent_row_count:${matching.length}`);
  } catch (e) {
    failures.push(`idempotent_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { gate: "idempotency", ok: failures.length === 0, failures };
}

async function runModifyPropagationGate(
  adapter: MemoryBenchmarkAdapter,
  runId: string,
): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const client = new SupermemoryClient();
  const scope = "work-mod";
  const ns = namespaceForScope(runId, scope);
  const eventId = "gate:d-modify";
  const docId = documentIdForEvent(eventId);

  const v1: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: eventId,
    scope,
    acl: { scope, trust_class: null },
    text: "Original benchmark modify text Shanghai.",
    provenance: { source_version: "mod-v1" },
  };
  const v2: PersonalMemoryEvent = {
    ...v1,
    text: "Updated benchmark modify text Hangzhou.",
    provenance: { source_version: "mod-v2" },
  };

  try {
    await adapter.ingest(v1);
    const before = await client.search(ns, "Shanghai modify", 3, 0);
    if (!(before.results?.length ?? 0)) failures.push("modify_pre_search_empty");

    await adapter.ingest(v2);
    await client.waitDocumentDone(ns, docId);
    const afterNew = await client.search(ns, "Hangzhou modify", 3, 0);
    if (!(afterNew.results?.length ?? 0)) failures.push("modify_post_search_missing_new");
    const afterOld = await client.search(ns, "Shanghai modify", 3, 0);
    const oldChunk = afterOld.results?.[0]?.chunk ?? afterOld.results?.[0]?.content ?? "";
    const oldSim = afterOld.results?.[0]?.similarity ?? afterOld.results?.[0]?.score ?? 0;
    const oldStillTop = oldChunk.includes("Shanghai") && oldSim > 0.55;
    if (oldStillTop) failures.push("modify_old_content_still_dominant");
  } catch (e) {
    failures.push(`modify_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { gate: "modify_delete_propagation", ok: failures.length === 0, failures };
}

async function runScopeIsolationGate(runId: string): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const client = new SupermemoryClient();
  const adapterA = await createSupermemorySchemeDAdapter({
    runId: `${runId}-iso-a`,
    fresh: true,
  });
  const adapterB = await createSupermemorySchemeDAdapter({
    runId: `${runId}-iso-b`,
    fresh: true,
  });
  try {
    await adapterA.ingest({
      ...baseEvent,
      event_id: "gate:d-iso-secret",
      scope: "scope-a",
      acl: { scope: "scope-a", trust_class: null },
      text: "Scope A isolated secret phrase alpha-7788.",
      provenance: { source_version: "iso-v1" },
    });
    const leak = await adapterB.recall(
      { text: "alpha-7788 isolated", scope: "scope-b" },
      baseEvent.observed_at,
      "scope-b",
    );
    if (leak.hits.some((h) => h.text.includes("alpha-7788"))) {
      failures.push("cross_scope_recall_leak");
    }
    const nsB = namespaceForScope(`${runId}-iso-b`, "scope-b");
    const native = await client.search(nsB, "alpha-7788", 5, 0);
    if ((native.results?.length ?? 0) > 0) failures.push("cross_scope_native_search_leak");
  } catch (e) {
    failures.push(`isolation_threw:${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await adapterA.close();
    await adapterB.close();
  }
  return { gate: "permission_isolation", ok: failures.length === 0, failures };
}

async function runChineseRetrievalGate(runId: string): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const client = new SupermemoryClient();
  const adapter = await createSupermemorySchemeDAdapter({ runId: `${runId}-zh`, fresh: true });
  const scope = "work-zh";
  const ns = namespaceForScope(`${runId}-zh`, scope);
  /** Same protocol as Stage 1 smoke (`envs/README.md`): English source, Chinese query. */
  const source = "I will attend the product review in Hangzhou next Thursday.";
  const query = "下周四的产品评审在哪座城市？";
  try {
    await adapter.ingest({
      ...baseEvent,
      event_id: "gate:d-zh",
      scope,
      acl: { scope, trust_class: null },
      text: source,
      provenance: { source_version: "zh-v1" },
    });
    const result = await client.search(ns, query, 5, 0, "hybrid");
    const top = result.results?.[0];
    const score = top ? (top.similarity ?? top.score ?? 0) : 0;
    if (score < 0.5) failures.push(`chinese_retrieval_low_score:${score.toFixed(3)}`);
  } catch (e) {
    failures.push(`chinese_threw:${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await adapter.close();
  }
  return { gate: "chinese_retrieval", ok: failures.length === 0, failures };
}
