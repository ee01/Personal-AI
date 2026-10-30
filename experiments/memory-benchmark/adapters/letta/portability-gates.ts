import type { PersonalMemoryEvent } from "../../src/types.js";
import type { MemoryBenchmarkAdapter } from "../../src/types.js";
import { runDeleteRevokeGate, runExportGate } from "../../src/gates/adapter-gates.js";
import {
  createLettaSchemeEAdapter,
  lettaServerReachable,
} from "./adapter.js";
import { LettaAppClient } from "./client.js";
import { agentMetaKey, memfsPathForEvent } from "./runtime.js";

export interface PortabilityGateResult {
  gate: string;
  ok: boolean;
  failures: string[];
}

export interface PortabilityReport {
  scheme_id: "E";
  run_at: string;
  server_reachable: boolean;
  all_passed: boolean;
  gates: PortabilityGateResult[];
  notes: string[];
}

const baseEvent: PersonalMemoryEvent = {
  event_id: "gate:e-export",
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

export async function runLettaPortabilityGates(
  runId = `gate-${Date.now()}`,
): Promise<PortabilityReport> {
  const serverOk = await lettaServerReachable();
  const notes: string[] = [];
  if (!serverOk) {
    return {
      scheme_id: "E",
      run_at: new Date().toISOString(),
      server_reachable: false,
      all_passed: false,
      gates: [{ gate: "server", ok: false, failures: ["letta_app_server_unreachable"] }],
      notes: ["Start Letta App Server per envs/README.md before running gates."],
    };
  }

  const gates: PortabilityGateResult[] = [];
  const adapter = await createLettaSchemeEAdapter({ runId, fresh: true });

  try {
    const exportGate = await runExportGate(adapter);
    gates.push({ gate: "source_export", ok: exportGate.ok, failures: exportGate.failures });

    gates.push(await runIdempotencyGate(adapter));
    gates.push(await runModifyPropagationGate(adapter));
    gates.push(
      await runDeleteRevokeGate(adapter, {
        ...baseEvent,
        event_id: "gate:e-delete",
        text: "delete revoke gate content for scheme E letta",
        provenance: { source_version: "del-v1" },
      }).then((r) => ({
        gate: "delete_revoke_propagation",
        ok: r.ok,
        failures: r.failures,
      })),
    );
    gates.push(await runScopeIsolationGate(runId));
  } finally {
    await adapter.close();
  }

  const all_passed = gates.every((g) => g.ok);
  if (!all_passed) {
    notes.push("One or more portability gates failed; review MemFS mapping before prod replay.");
  } else {
    notes.push("Core portability gates passed for scheme E.");
  }

  return {
    scheme_id: "E",
    run_at: new Date().toISOString(),
    server_reachable: true,
    all_passed,
    gates,
    notes,
  };
}

async function runIdempotencyGate(adapter: MemoryBenchmarkAdapter): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const sample: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: "gate:e-idem",
    text: "idempotent ingest text letta",
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
): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const eventId = "gate:e-modify";
  const v1: PersonalMemoryEvent = {
    ...baseEvent,
    event_id: eventId,
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
    const before = await adapter.recall(
      { text: "Shanghai modify", scope: v1.scope },
      v1.observed_at,
      v1.scope,
    );
    if (before.hits.length === 0) failures.push("modify_pre_recall_empty");

    await adapter.ingest(v2);
    const after = await adapter.recall(
      { text: "Hangzhou modify", scope: v2.scope },
      v2.observed_at,
      v2.scope,
    );
    if (!after.hits.some((h) => h.text.includes("Hangzhou"))) {
      failures.push("modify_post_recall_missing_new");
    }
    const exported = (await adapter.export()) as {
      evidence_events?: Array<{ source_version: string; body: string }>;
    };
    const versions = (exported.evidence_events ?? []).filter((r) => r.body?.includes("Hangzhou"));
    if (versions.length < 1) failures.push("modify_sidecar_missing_new_body");
  } catch (e) {
    failures.push(`modify_threw:${e instanceof Error ? e.message : String(e)}`);
  }
  return { gate: "modify_delete_propagation", ok: failures.length === 0, failures };
}

async function runScopeIsolationGate(runId: string): Promise<PortabilityGateResult> {
  const failures: string[] = [];
  const adapterA = await createLettaSchemeEAdapter({ runId: `${runId}-iso-a`, fresh: true });
  const adapterB = await createLettaSchemeEAdapter({ runId: `${runId}-iso-b`, fresh: true });
  try {
    await adapterA.ingest({
      ...baseEvent,
      event_id: "gate:e-iso-secret",
      scope: "scope-a",
      acl: { scope: "scope-a", trust_class: null },
      text: "Scope A isolated secret phrase alpha-8899 letta.",
      provenance: { source_version: "iso-v1" },
    });
    const leak = await adapterB.recall(
      { text: "alpha-8899 isolated", scope: "scope-b" },
      baseEvent.observed_at,
      "scope-b",
    );
    if (leak.hits.some((h) => h.text.includes("alpha-8899"))) {
      failures.push("cross_scope_recall_leak");
    }
    const exportB = (await adapterB.export()) as { evidence_events?: unknown[] };
    if ((exportB.evidence_events ?? []).length > 0) {
      failures.push("scope_b_should_have_no_evidence");
    }
  } catch (e) {
    failures.push(`isolation_threw:${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await adapterA.close();
    await adapterB.close();
  }
  return { gate: "permission_isolation", ok: failures.length === 0, failures };
}

export async function verifyMemfsRoundTrip(runId: string): Promise<boolean> {
  const client = new LettaAppClient();
  try {
    const agentId = await client.createBenchmarkAgent("openrouter/z-ai/glm-5.3", runId);
    const path = memfsPathForEvent("gate:memfs-smoke");
    const body = "---\nname: smoke\ndescription: smoke\n---\n\nroundtrip";
    await client.writeMemoryFile(agentId, path, body);
    const read = await client.readMemoryFile(agentId, path);
    await client.deleteMemoryFile(agentId, path);
    await client.deleteAgent(agentId);
    return read === body;
  } finally {
    client.close();
  }
}

export { agentMetaKey, memfsPathForEvent };
