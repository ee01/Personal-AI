import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readProxyLedger } from "./proxy-ledger.js";
export interface BudgetPolicy {
  ledger_dir: string;
  total_ceiling_usd: number;
  scheme_ceilings_usd: Record<string, number>;
  paused?: boolean;
}
export function budgetBlockReason(path: string, scheme: string): string | undefined {
  try {
    const p = JSON.parse(readFileSync(path, "utf8")) as BudgetPolicy;
    if (p.paused) return "budget_policy_paused";
    if (!Number.isFinite(p.total_ceiling_usd) || !Number.isFinite(p.scheme_ceilings_usd[scheme])) return "invalid_budget_policy";
    let total = 0, schemeTotal = 0;
    for (const file of readdirSync(p.ledger_dir).filter(f => f.endsWith(".jsonl"))) {
      for (const row of readProxyLedger(join(p.ledger_dir, file))) {
        if (!Number.isFinite(row.cost_usd) || row.cost_usd < 0) return "unreconciled_ledger_cost";
        total += row.cost_usd;
        if (row.scheme_id === scheme) schemeTotal += row.cost_usd;
      }
    }
    if (total >= p.total_ceiling_usd) return "total_proxy_budget_exceeded";
    if (schemeTotal >= Math.min(49, p.scheme_ceilings_usd[scheme]!)) return "scheme_proxy_budget_exceeded";
    return undefined;
  } catch { return "budget_policy_unreadable"; }
}
