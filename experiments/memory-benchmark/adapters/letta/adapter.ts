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
import { LettaRuntime } from "./runtime.js";
import {
  defaultLettaCheckout,
  LettaAppClient,
  lettaIntegrationAvailable,
} from "./client.js";
import { loadBenchmarkDotenv, openRouterKeyPresent } from "./load-env.js";

function defaultDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../.local/letta-data");
}

export interface CreateLettaAdapterOptions {
  schemeId?: string;
  dataRoot?: string;
  fresh?: boolean;
  runId?: string;
  client?: LettaAppClient;
}

export class LettaSchemeEAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private runtime: LettaRuntime | null = null;
  private dbPath: string;
  private runKey: string;
  private client?: LettaAppClient;

  constructor(schemeId: string, dbPath: string, runKey: string, client?: LettaAppClient) {
    this.schemeId = schemeId;
    this.dbPath = dbPath;
    this.runKey = runKey;
    this.client = client;
  }

  async init(): Promise<void> {
    if (this.runtime) return;
    this.runtime = new LettaRuntime({
      dbPath: this.dbPath,
      runKey: this.runKey,
      client: this.client,
    });
  }

  private async rt(): Promise<LettaRuntime> {
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

export async function createLettaSchemeEAdapter(
  options: CreateLettaAdapterOptions = {},
): Promise<LettaSchemeEAdapter> {
  const schemeId = options.schemeId ?? "E";
  const dataRoot = options.dataRoot ?? defaultDataRoot();
  fs.mkdirSync(dataRoot, { recursive: true });
  const runKey = options.runId ?? `run-${Date.now()}`;
  const dbPath = path.join(dataRoot, `${schemeId}-${runKey}.sqlite`);

  if (options.fresh !== false && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  const adapter = new LettaSchemeEAdapter(schemeId, dbPath, runKey, options.client);
  await adapter.init();
  return adapter;
}

export function lettaCheckoutPresent(): boolean {
  return lettaIntegrationAvailable();
}

export function lettaAdapterAvailable(): boolean {
  loadBenchmarkDotenv();
  return openRouterKeyPresent() && lettaIntegrationAvailable();
}

export async function lettaServerReachable(): Promise<boolean> {
  if (!lettaAdapterAvailable()) return false;
  const client = new LettaAppClient();
  try {
    return await client.healthOk();
  } finally {
    client.close();
  }
}

export { defaultLettaCheckout };
