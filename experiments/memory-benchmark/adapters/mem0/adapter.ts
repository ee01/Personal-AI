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
import { existsSync } from "node:fs";
import { Mem0PythonWorker } from "./python-bridge.js";
import { loadBenchmarkDotenv, openRouterKeyPresent } from "./load-env.js";
import { Mem0Runtime } from "./runtime.js";

function defaultDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../.local/mem0-data");
}

export interface CreateMem0AdapterOptions {
  schemeId?: string;
  dataRoot?: string;
  fresh?: boolean;
  runId?: string;
}

export class Mem0SchemeCAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private runtime: Mem0Runtime | null = null;
  private dbPath: string;
  private qdrantPath: string;
  private collection: string;
  private runKey: string;

  constructor(schemeId: string, dbPath: string, qdrantPath: string, collection: string, runKey: string) {
    this.schemeId = schemeId;
    this.dbPath = dbPath;
    this.qdrantPath = qdrantPath;
    this.collection = collection;
    this.runKey = runKey;
  }

  async init(): Promise<void> {
    if (this.runtime) return;
    this.runtime = new Mem0Runtime({
      dbPath: this.dbPath,
      qdrantPath: this.qdrantPath,
      collection: this.collection,
      runKey: this.runKey,
    });
  }

  private async rt(): Promise<Mem0Runtime> {
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
      await this.runtime.close();
      this.runtime = null;
    }
  }
}

export async function createMem0SchemeCAdapter(
  options: CreateMem0AdapterOptions = {},
): Promise<Mem0SchemeCAdapter> {
  const schemeId = options.schemeId ?? "C";
  const dataRoot = options.dataRoot ?? defaultDataRoot();
  fs.mkdirSync(dataRoot, { recursive: true });
  const runKey = options.runId ?? `run-${Date.now()}`;
  const dbPath = path.join(dataRoot, `${schemeId}-${runKey}.sqlite`);
  const qdrantPath = path.join(dataRoot, `${schemeId}-${runKey}-qdrant`);
  const collection = `mem0_benchmark_${runKey.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (options.fresh !== false) {
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
    if (fs.existsSync(qdrantPath)) fs.rmSync(qdrantPath, { recursive: true, force: true });
  }

  const adapter = new Mem0SchemeCAdapter(schemeId, dbPath, qdrantPath, collection, runKey);
  await adapter.init();
  return adapter;
}

export function mem0IntegrationAvailable(): boolean {
  loadBenchmarkDotenv();
  if (!openRouterKeyPresent()) return false;
  const checkout = Mem0PythonWorker.defaultCheckout();
  const python = Mem0PythonWorker.defaultPython(checkout);
  return existsSync(checkout) && existsSync(python);
}
