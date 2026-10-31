import http from "node:http";
import { resolve } from "node:path";
import { defaultProxyLedgerPath } from "./proxy-ledger.js";

export const BENCHMARK_RUN_HEADER = "x-benchmark-run";
export const BENCHMARK_SCHEME_HEADER = "x-benchmark-scheme";

export interface BenchmarkRunContext {
  run_id: string;
  scheme_id: string;
  ledger_path: string;
  attribution: "header" | "active_window" | "embedded_default" | "unattributed";
}

export interface ActiveBenchmarkRun {
  run_id: string;
  scheme_id: string;
  ledger_path: string;
  started_at: string;
}

export interface EmbeddedProxyDefaults {
  run_id: string;
  scheme_id: string;
  ledger_path: string;
}

function headerValue(headers: http.IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v || undefined;
}

export function resolveBenchmarkRunContext(input: {
  headers: http.IncomingHttpHeaders;
  embedded: EmbeddedProxyDefaults | null;
  activeRun: ActiveBenchmarkRun | null;
}): BenchmarkRunContext {
  const runFromHeader = headerValue(input.headers, BENCHMARK_RUN_HEADER);
  const schemeFromHeader = headerValue(input.headers, BENCHMARK_SCHEME_HEADER);

  if (runFromHeader) {
    const scheme_id =
      schemeFromHeader ||
      input.embedded?.scheme_id ||
      input.activeRun?.scheme_id ||
      "unknown";
    return {
      run_id: runFromHeader,
      scheme_id,
      ledger_path: resolve(defaultProxyLedgerPath(runFromHeader)),
      attribution: "header",
    };
  }

  if (input.activeRun) {
    return {
      run_id: input.activeRun.run_id,
      scheme_id: input.activeRun.scheme_id,
      ledger_path: resolve(input.activeRun.ledger_path),
      attribution: "active_window",
    };
  }

  if (input.embedded) {
    return {
      run_id: input.embedded.run_id,
      scheme_id: input.embedded.scheme_id,
      ledger_path: resolve(input.embedded.ledger_path),
      attribution: "embedded_default",
    };
  }

  return {
    run_id: "unattributed",
    scheme_id: "unknown",
    ledger_path: resolve(defaultProxyLedgerPath("unattributed")),
    attribution: "unattributed",
  };
}
