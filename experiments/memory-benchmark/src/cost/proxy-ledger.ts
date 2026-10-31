import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ProxyLedgerEntry {
  at: string;
  scheme_id: string;
  run_id: string;
  tier: string;
  label: string;
  generation_id: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  path: string;
  streaming: boolean;
}

function benchmarkPkgRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

export function defaultProxyLedgerPath(runId: string): string {
  return join(benchmarkPkgRoot(), ".local", "proxy-ledger", `${runId}.jsonl`);
}

export function appendProxyLedgerEntry(path: string, entry: ProxyLedgerEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}

export function readProxyLedger(path: string): ProxyLedgerEntry[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const out: ProxyLedgerEntry[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as ProxyLedgerEntry);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export function sumProxyLedger(entries: ProxyLedgerEntry[]): {
  proxy_usd: number;
  proxy_calls: number;
  generation_ids: string[];
} {
  let proxy_usd = 0;
  let proxy_calls = 0;
  const generation_ids: string[] = [];
  for (const row of entries) {
    if (typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd)) {
      proxy_usd += row.cost_usd;
    }
    proxy_calls += 1;
    if (row.generation_id) generation_ids.push(row.generation_id);
  }
  return { proxy_usd, proxy_calls, generation_ids };
}

export function proxyTotalsFromFile(path: string): ReturnType<typeof sumProxyLedger> {
  return sumProxyLedger(readProxyLedger(path));
}
