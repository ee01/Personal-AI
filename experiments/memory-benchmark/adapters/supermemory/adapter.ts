import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type {
  ConsolidateResult,
  DecideInput,
  DecideResult,
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  RecallQuery,
  RecallResult,
} from "../../src/types.js";
import { SupermemoryRuntime } from "./runtime.js";
import { defaultSupermemoryCheckout, SupermemoryClient } from "./client.js";
import { loadBenchmarkDotenv, openRouterKeyPresent } from "./load-env.js";

function defaultDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../.local/supermemory-data");
}

export interface CreateSupermemoryAdapterOptions {
  schemeId?: string;
  dataRoot?: string;
  fresh?: boolean;
  runId?: string;
  client?: SupermemoryClient;
}

export class SupermemorySchemeDAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private runtime: SupermemoryRuntime | null = null;
  private dbPath: string;
  private runKey: string;
  private client?: SupermemoryClient;

  constructor(
    schemeId: string,
    dbPath: string,
    runKey: string,
    client?: SupermemoryClient,
  ) {
    this.schemeId = schemeId;
    this.dbPath = dbPath;
    this.runKey = runKey;
    this.client = client;
  }

  async init(): Promise<void> {
    if (this.runtime) return;
    this.runtime = new SupermemoryRuntime({
      dbPath: this.dbPath,
      runKey: this.runKey,
      client: this.client,
    });
  }

  private async rt(): Promise<SupermemoryRuntime> {
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

export async function createSupermemorySchemeDAdapter(
  options: CreateSupermemoryAdapterOptions = {},
): Promise<SupermemorySchemeDAdapter> {
  const schemeId = options.schemeId ?? "D";
  const dataRoot = options.dataRoot ?? defaultDataRoot();
  fs.mkdirSync(dataRoot, { recursive: true });
  const runKey = options.runId ?? `run-${Date.now()}`;
  const dbPath = path.join(dataRoot, `${schemeId}-${runKey}.sqlite`);

  if (options.fresh !== false && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  const adapter = new SupermemorySchemeDAdapter(schemeId, dbPath, runKey, options.client);
  await adapter.init();
  return adapter;
}

export function supermemoryIntegrationAvailable(): boolean {
  loadBenchmarkDotenv();
  if (!openRouterKeyPresent()) return false;
  const checkout = defaultSupermemoryCheckout();
  if (!existsSync(checkout)) return false;
  try {
    new SupermemoryClient();
    return true;
  } catch {
    return false;
  }
}

export async function supermemoryServerReachable(): Promise<boolean> {
  if (!supermemoryIntegrationAvailable()) return false;
  const client = new SupermemoryClient();
  return client.healthOk();
}
