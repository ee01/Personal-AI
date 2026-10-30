import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ConsolidateResult,
  DecideInput,
  DecideResult,
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  RecallQuery,
  RecallResult,
} from "../../src/types.js";
import { NewCoreRuntime, type NewCoreRuntimeOptions } from "./runtime.js";
import { defaultLedgerPath, FileCostLedger } from "./ledger-file.js";
import { loadBenchmarkDotenv } from "../mem0/load-env.js";

function defaultDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../.local/new-core-data");
}

export interface CreateNewCoreAdapterOptions {
  schemeId?: string;
  dataRoot?: string;
  fresh?: boolean;
  runId?: string;
  /** Share cost ledger across runs (default true). */
  sharedLedger?: boolean;
}

export class NewCoreSchemeBAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private runtime: NewCoreRuntime | null = null;
  private readonly runtimeOptions: NewCoreRuntimeOptions;

  constructor(schemeId: string, runtimeOptions: NewCoreRuntimeOptions) {
    this.schemeId = schemeId;
    this.runtimeOptions = runtimeOptions;
  }

  async init(): Promise<void> {
    if (this.runtime) return;
    this.runtime = new NewCoreRuntime(this.runtimeOptions);
  }

  private async rt(): Promise<NewCoreRuntime> {
    await this.init();
    return this.runtime!;
  }

  async ingest(event: PersonalMemoryEvent): Promise<void> {
    await (await this.rt()).ingest(event);
  }

  async consolidate(virtualNow: string): Promise<ConsolidateResult> {
    return (await this.rt()).consolidate(virtualNow);
  }

  async recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> {
    return (await this.rt()).recall(query, asOf, scope);
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    return (await this.rt()).decide(input);
  }

  async export(): Promise<Record<string, unknown>> {
    return (await this.rt()).export();
  }

  async delete(eventId: string): Promise<void> {
    await (await this.rt()).delete(eventId);
  }

  async revoke(scope: string): Promise<void> {
    await (await this.rt()).revoke(scope);
  }

  async close(): Promise<void> {
    if (this.runtime) {
      this.runtime.close();
      this.runtime = null;
    }
  }
}

export async function createNewCoreSchemeBAdapter(
  options: CreateNewCoreAdapterOptions = {},
): Promise<NewCoreSchemeBAdapter> {
  loadBenchmarkDotenv();
  const schemeId = options.schemeId ?? "B";
  const dataRoot = options.dataRoot ?? defaultDataRoot();
  fs.mkdirSync(dataRoot, { recursive: true });
  const runKey = options.runId ?? `run-${Date.now()}`;
  const dbPath = path.join(dataRoot, `${schemeId}-${runKey}.sqlite`);
  if (options.fresh !== false && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }
  const useShared = options.sharedLedger !== false;
  const budget = Number(process.env.MEMORY_B_SCHEME_BUDGET_USD ?? 50);
  const costLedger = useShared
    ? FileCostLedger.open(defaultLedgerPath(dataRoot), budget)
    : undefined;
  const adapter = new NewCoreSchemeBAdapter(schemeId, {
    dbPath,
    dataRoot,
    costLedger,
  });
  await adapter.init();
  return adapter;
}
