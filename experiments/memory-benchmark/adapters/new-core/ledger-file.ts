import fs from "node:fs";
import path from "node:path";
import type { LlmCallRecord, SharedCostLedger } from "./llm.js";

interface LedgerFileBody {
  version: 1;
  max_usd: number;
  reserved: number;
  records: LlmCallRecord[];
}

const ledgerCache = new Map<string, FileCostLedger>();

export function defaultLedgerPath(dataRoot: string): string {
  return path.join(dataRoot, "scheme-B-shared-ledger.json");
}

/** Cross-run shared ledger for scheme B (survives per-run SQLite isolation). */
export class FileCostLedger implements SharedCostLedger {
  private records: LlmCallRecord[];
  private reserved: number;

  private constructor(
    private filePath: string,
    private maxUsd: number,
    body: LedgerFileBody,
  ) {
    this.records = [...body.records];
    this.reserved = body.reserved;
  }

  static open(filePath: string, maxUsd: number): FileCostLedger {
    const abs = path.resolve(filePath);
    const cached = ledgerCache.get(abs);
    if (cached) return cached;

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    let body: LedgerFileBody;
    if (fs.existsSync(abs)) {
      try {
        body = JSON.parse(fs.readFileSync(abs, "utf8")) as LedgerFileBody;
        if (body.version !== 1 || !Array.isArray(body.records)) throw new Error("bad ledger");
      } catch {
        body = { version: 1, max_usd: maxUsd, reserved: 0, records: [] };
      }
    } else {
      body = { version: 1, max_usd: maxUsd, reserved: 0, records: [] };
    }
    body.max_usd = maxUsd;
    body.reserved = 0;
    const ledger = new FileCostLedger(abs, maxUsd, body);
    ledger.persist();
    ledgerCache.set(abs, ledger);
    return ledger;
  }

  ledgerPath(): string {
    return this.filePath;
  }

  private persist(): void {
    const tmp = `${this.filePath}.tmp`;
    const body: LedgerFileBody = {
      version: 1,
      max_usd: this.maxUsd,
      reserved: this.reserved,
      records: this.records,
    };
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  totalUsd(): number {
    const spent = this.records.reduce((s, r) => s + r.cost_usd, 0);
    return spent + this.reserved;
  }

  reserve(worstCaseUsd: number): boolean {
    const spent = this.records.reduce((s, r) => s + r.cost_usd, 0);
    if (spent + this.reserved + worstCaseUsd > this.maxUsd) return false;
    this.reserved += worstCaseUsd;
    this.persist();
    return true;
  }

  settle(record: LlmCallRecord, releasedReserveUsd?: number): void {
    const release = releasedReserveUsd ?? record.cost_usd;
    this.reserved = Math.max(0, this.reserved - release);
    this.records.push(record);
    this.persist();
  }

  snapshot(): LlmCallRecord[] {
    return [...this.records];
  }
}

export interface MergedLedgerReport {
  run_ledger_paths: string[];
  total_usd: number;
  by_tier: Record<string, number>;
  by_label: Record<string, number>;
  call_count: number;
}

/** Merge persisted ledgers after independent DB builds (same shared file dedupes automatically). */
export function mergeLedgerReports(paths: string[]): MergedLedgerReport {
  const seen = new Set<string>();
  const all: LlmCallRecord[] = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    try {
      const body = JSON.parse(fs.readFileSync(p, "utf8")) as LedgerFileBody;
      for (const r of body.records) {
        const key = `${r.label}|${r.at_virtual}|${r.input_tokens}|${r.output_tokens}|${r.cost_usd}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(r);
      }
    } catch {
      /* skip */
    }
  }
  const by_tier: Record<string, number> = {};
  const by_label: Record<string, number> = {};
  let total = 0;
  for (const r of all) {
    total += r.cost_usd;
    by_tier[r.tier] = (by_tier[r.tier] ?? 0) + r.cost_usd;
    by_label[r.label] = (by_label[r.label] ?? 0) + r.cost_usd;
  }
  return {
    run_ledger_paths: paths,
    total_usd: total,
    by_tier,
    by_label,
    call_count: all.length,
  };
}
