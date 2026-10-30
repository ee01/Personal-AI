import { execSync } from "node:child_process";
import type { MemoryBenchmarkAdapter } from "../types.js";
import { runFutureEvidenceHardGate } from "./future-evidence-gate.js";
import { runObservableReconciliationGate } from "./observable-reconciliation-gate.js";
import {
  runDeleteRevokePropagationGate,
  runIdempotencyGate,
  runModifyPropagationGate,
  runPermissionIsolationGate,
  runSourceExportGate,
  type AdapterFactory,
  type NamedGateResult,
} from "./shared-portability-gates.js";

export type SchemeLetter = "A" | "B" | "C" | "D" | "E";

export interface SchemeGateReport {
  scheme_id: SchemeLetter;
  run_id: string;
  run_at: string;
  git_head: string;
  server_reachable: boolean | null;
  skipped: boolean;
  skip_reason?: string;
  all_passed: boolean;
  gates: NamedGateResult[];
  candidate_limitations: string[];
  notes: string[];
}

export interface RunSchemeGatesOptions {
  scheme: SchemeLetter;
  runId?: string;
  /** When false, do not run (e.g. Mem0 checkout missing). */
  enabled?: boolean;
  skipReason?: string;
  serverReachable?: boolean | null;
  createAdapter: AdapterFactory;
  /** Annotate Letta MemFS historical-view limits on future gate failures. */
  annotateLettaLimitation?: boolean;
}

function gitHead(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function mergeModifyDelete(
  modify: NamedGateResult,
  deleteRevoke: NamedGateResult,
): NamedGateResult {
  return {
    gate: "modify_delete_revoke_propagation",
    ok: modify.ok && deleteRevoke.ok,
    failures: [...modify.failures, ...deleteRevoke.failures],
  };
}

export async function runSchemeGates(options: RunSchemeGatesOptions): Promise<SchemeGateReport> {
  const runId = options.runId ?? `gate-${Date.now()}`;
  const scheme = options.scheme;
  const notes: string[] = [];
  const candidate_limitations: string[] = [];

  if (options.enabled === false) {
    return {
      scheme_id: scheme,
      run_id: runId,
      run_at: new Date().toISOString(),
      git_head: gitHead(),
      server_reachable: options.serverReachable ?? null,
      skipped: true,
      skip_reason: options.skipReason ?? "integration_unavailable",
      all_passed: false,
      gates: [],
      candidate_limitations,
      notes: [options.skipReason ?? "Scheme gates skipped."],
    };
  }

  if (options.serverReachable === false) {
    return {
      scheme_id: scheme,
      run_id: runId,
      run_at: new Date().toISOString(),
      git_head: gitHead(),
      server_reachable: false,
      skipped: true,
      skip_reason: "server_unreachable",
      all_passed: false,
      gates: [
        {
          gate: "server",
          ok: false,
          failures: [`${scheme.toLowerCase()}_server_unreachable`],
        },
      ],
      candidate_limitations,
      notes: ["Start external server per envs/README.md before running gates."],
    };
  }

  const gates: NamedGateResult[] = [];
  const adapter = await options.createAdapter(runId);

  try {
    gates.push(await runSourceExportGate(adapter));
    gates.push(await runIdempotencyGate(adapter, scheme));

    const modify = await runModifyPropagationGate(adapter, scheme);
    const deleteRevoke = await runDeleteRevokePropagationGate(adapter, scheme);
    gates.push(mergeModifyDelete(modify, deleteRevoke));

    await adapter.close();
    gates.push(await runPermissionIsolationGate(options.createAdapter, runId, scheme));

    const obsAdapter = await options.createAdapter(`${runId}-obs`);
    try {
      gates.push({
        gate: "observable_reconciliation",
        ...(await runObservableReconciliationGate(obsAdapter)),
      });
    } finally {
      await obsAdapter.close();
    }

    const futureAdapter = await options.createAdapter(`${runId}-future`);
    try {
      const future = await runFutureEvidenceHardGate(futureAdapter);
      const futureResult: NamedGateResult = {
        gate: "future_evidence_hard",
        ok: future.ok,
        failures: future.failures,
      };
      if (
        options.annotateLettaLimitation &&
        !future.ok &&
        future.failures.some((f) => f.includes("future"))
      ) {
        futureResult.candidate_limitation = true;
        candidate_limitations.push(
          "Letta MemFS reads current workspace; strict historical ref/as-of is sidecar-only (E-141 slot E).",
        );
      }
      gates.push(futureResult);
    } finally {
      await futureAdapter.close();
    }
  } catch (e) {
    notes.push(`gate_runner_error:${e instanceof Error ? e.message : String(e)}`);
    gates.push({
      gate: "runner",
      ok: false,
      failures: [e instanceof Error ? e.message : String(e)],
    });
  }

  const hardFailures = gates.filter((g) => !g.ok && !g.candidate_limitation);
  const all_passed = hardFailures.length === 0;

  if (!all_passed) {
    notes.push(`Scheme ${scheme}: one or more gates failed (see failures).`);
  } else if (gates.some((g) => g.candidate_limitation)) {
    notes.push(`Scheme ${scheme}: passed with candidate_limitation annotations.`);
  } else {
    notes.push(`Scheme ${scheme}: all six gates passed.`);
  }

  return {
    scheme_id: scheme,
    run_id: runId,
    run_at: new Date().toISOString(),
    git_head: gitHead(),
    server_reachable: options.serverReachable ?? true,
    skipped: false,
    all_passed,
    gates,
    candidate_limitations,
    notes,
  };
}

export async function createAdapterFactoryForScheme(
  scheme: SchemeLetter,
): Promise<{ factory: AdapterFactory; enabled: boolean; skipReason?: string; serverReachable?: boolean | null; annotateLetta?: boolean }> {
  switch (scheme) {
    case "A": {
      const { createBaselineSchemeAAdapter } = await import("../../adapters/baseline/index.js");
      return {
        enabled: true,
        factory: async () => createBaselineSchemeAAdapter("A"),
      };
    }
    case "B": {
      const { createNewCoreSchemeBAdapter } = await import("../../adapters/new-core/adapter.js");
      return {
        enabled: true,
        factory: async (runId) => createNewCoreSchemeBAdapter({ runId, fresh: true }),
      };
    }
    case "C": {
      const { createMem0SchemeCAdapter, mem0IntegrationAvailable } = await import(
        "../../adapters/mem0/adapter.js"
      );
      if (!mem0IntegrationAvailable()) {
        return {
          enabled: false,
          skipReason: "mem0_checkout_or_venv_unavailable",
          factory: async () => {
            throw new Error("mem0 unavailable");
          },
        };
      }
      return {
        enabled: true,
        factory: async (runId) => createMem0SchemeCAdapter({ runId, fresh: true }),
      };
    }
    case "D": {
      const { createSupermemorySchemeDAdapter, supermemoryServerReachable } = await import(
        "../../adapters/supermemory/adapter.js"
      );
      const reachable = await supermemoryServerReachable();
      return {
        enabled: reachable,
        serverReachable: reachable,
        skipReason: reachable ? undefined : "supermemory_server_unreachable",
        factory: async (runId) => createSupermemorySchemeDAdapter({ runId, fresh: true }),
      };
    }
    case "E": {
      const { createLettaSchemeEAdapter, lettaServerReachable } = await import(
        "../../adapters/letta/adapter.js"
      );
      const reachable = await lettaServerReachable();
      return {
        enabled: reachable,
        serverReachable: reachable,
        skipReason: reachable ? undefined : "letta_app_server_unreachable",
        annotateLetta: true,
        factory: async (runId) => createLettaSchemeEAdapter({ runId, fresh: true }),
      };
    }
    default:
      throw new Error(`Unknown scheme ${scheme}`);
  }
}

export async function runAllSchemeGates(schemes: SchemeLetter[] = ["A", "B", "C", "D", "E"]) {
  const reports: SchemeGateReport[] = [];
  for (const scheme of schemes) {
    const cfg = await createAdapterFactoryForScheme(scheme);
    reports.push(
      await runSchemeGates({
        scheme,
        createAdapter: cfg.factory,
        enabled: cfg.enabled,
        skipReason: cfg.skipReason,
        serverReachable: cfg.serverReachable,
        annotateLettaLimitation: cfg.annotateLetta,
      }),
    );
  }
  return reports;
}
