// Bridge to memory-service runtime; dynamic import is intentional (cross-package).
// @ts-nocheck
import type {
  ConsolidateResult,
  DecideInput,
  DecideResult,
  MemoryBenchmarkAdapter,
  PersonalMemoryEvent,
  RecallQuery,
  RecallResult,
} from "../../src/types.js";

type InnerAdapter = {
  schemeId: string;
  ingest(event: PersonalMemoryEvent): Promise<void>;
  consolidate(virtualNow: string): Promise<ConsolidateResult>;
  recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult>;
  decide(input: DecideInput): Promise<DecideResult>;
  export(): Promise<Record<string, unknown>>;
  delete(eventId: string): Promise<void>;
  revoke(scope: string): Promise<void>;
  close(): Promise<void>;
};

/**
 * Scheme A adapter — delegates to in-process memory-service harness runtime.
 */
export class BaselineSchemeAAdapter implements MemoryBenchmarkAdapter {
  readonly schemeId: string;
  private inner: InnerAdapter | null = null;

  constructor(schemeId = "A") {
    this.schemeId = schemeId;
  }

  async init(): Promise<void> {
    if (this.inner) return;
    const mod = await import(
      "../../../../memory-service/src/benchmark/createBaselineMemoryAdapter.js"
    );
    this.inner = (await mod.createBaselineMemoryAdapter({
      schemeId: this.schemeId,
      fresh: true,
    })) as InnerAdapter;
  }

  private async runtime(): Promise<InnerAdapter> {
    await this.init();
    return this.inner!;
  }

  async ingest(event: PersonalMemoryEvent): Promise<void> {
    await (await this.runtime()).ingest(event);
  }

  async consolidate(virtualNow: string): Promise<ConsolidateResult> {
    return (await this.runtime()).consolidate(virtualNow);
  }

  async recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult> {
    return (await this.runtime()).recall(query, asOf, scope);
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    return (await this.runtime()).decide(input);
  }

  async export(): Promise<Record<string, unknown>> {
    return (await this.runtime()).export();
  }

  async delete(eventId: string): Promise<void> {
    await (await this.runtime()).delete(eventId);
  }

  async revoke(scope: string): Promise<void> {
    await (await this.runtime()).revoke(scope);
  }

  async close(): Promise<void> {
    if (this.inner) {
      await this.inner.close();
      this.inner = null;
    }
  }
}

export async function createBaselineSchemeAAdapter(
  schemeId = "A",
): Promise<BaselineSchemeAAdapter> {
  const adapter = new BaselineSchemeAAdapter(schemeId);
  await adapter.init();
  return adapter;
}
