import { resolve } from "node:path";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import { loadModelsConfig } from "../../adapters/new-core/config.js";
import { defaultProxyLedgerPath } from "./proxy-ledger.js";
import { startOpenRouterProxy, type OpenRouterProxyHandle } from "./openrouter-proxy.js";

export const PROXY_BASE_ENV = "MEMORY_BENCHMARK_OPENROUTER_PROXY";
export const PROXY_LEDGER_ENV = "MEMORY_BENCHMARK_PROXY_LEDGER";

export interface BenchmarkProxySession {
  handle: OpenRouterProxyHandle;
  runId: string;
  schemeId: string;
}

/** Point OpenAI-compatible clients at the local OpenRouter accounting proxy. */
export function applyOpenRouterProxyEnv(handle: OpenRouterProxyHandle): void {
  const base = handle.baseUrl.replace(/\/+$/, "");
  process.env[PROXY_BASE_ENV] = base;
  process.env[PROXY_LEDGER_ENV] = handle.ledgerPath;
  process.env.OPENAI_API_BASE_URL = base;
  process.env.OPENAI_BASE_URL = base;
  const key =
    process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (key) {
    process.env.OPENAI_API_KEY = key;
  }
}

export function clearOpenRouterProxyEnv(): void {
  delete process.env[PROXY_BASE_ENV];
  delete process.env[PROXY_LEDGER_ENV];
}

export async function startBenchmarkProxySession(input: {
  runId: string;
  schemeId: string;
  ledgerPath?: string;
}): Promise<BenchmarkProxySession> {
  loadBenchmarkDotenv();
  const ledgerPath = input.ledgerPath ?? defaultProxyLedgerPath(input.runId);
  const handle = await startOpenRouterProxy({
    runId: input.runId,
    schemeId: input.schemeId,
    ledgerPath: resolve(ledgerPath),
  });
  applyOpenRouterProxyEnv(handle);
  return { handle, runId: input.runId, schemeId: input.schemeId };
}

export async function stopBenchmarkProxySession(session: BenchmarkProxySession): Promise<void> {
  clearOpenRouterProxyEnv();
  await session.handle.stop();
}

/** Shared models.json tiers for harness adapters (does not mutate production config). */
export function openRouterTierModel(tier: "main" | "fast"): string {
  const models = loadModelsConfig();
  return models[tier].model;
}
