import { resolve } from "node:path";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import { loadModelsConfig } from "../../adapters/new-core/config.js";
import { defaultProxyLedgerPath } from "./proxy-ledger.js";
import {
  startOpenRouterProxy,
  type OpenRouterProxyHandle,
} from "./openrouter-proxy.js";

export const PROXY_BASE_ENV = "MEMORY_BENCHMARK_OPENROUTER_PROXY";
export const PROXY_LEDGER_ENV = "MEMORY_BENCHMARK_PROXY_LEDGER";
export const PROXY_URL_ENV = "MEMORY_BENCHMARK_PROXY_URL";
export const ACTIVE_RUN_ENV = "MEMORY_BENCHMARK_ACTIVE_RUN_ID";
export const ACTIVE_SCHEME_ENV = "MEMORY_BENCHMARK_ACTIVE_SCHEME_ID";

export interface BenchmarkProxySession {
  handle: OpenRouterProxyHandle;
  runId: string;
  schemeId: string;
  /** When true, do not stop the proxy on session end (shared standalone process). */
  external: boolean;
}

/** Resolve shared standalone proxy URL (harness reuse). */
export function resolveExternalProxyUrl(): string | null {
  const raw =
    process.env[PROXY_URL_ENV]?.trim() || process.env[PROXY_BASE_ENV]?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

export function resolveBenchmarkProxyBaseForClients(): string {
  const external = resolveExternalProxyUrl();
  if (external) return external;
  const fromEnv = process.env.OPENAI_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://openrouter.ai/api/v1";
}

/** Point OpenAI-compatible clients at the local OpenRouter accounting proxy. */
export function applyOpenRouterProxyEnv(handle: OpenRouterProxyHandle): void {
  const base = handle.baseUrl.replace(/\/+$/, "");
  process.env[PROXY_BASE_ENV] = base;
  process.env[PROXY_URL_ENV] = base;
  process.env[PROXY_LEDGER_ENV] = handle.ledgerPath;
  process.env.OPENAI_API_BASE_URL = base;
  process.env.OPENAI_BASE_URL = base;
  const key =
    process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (key) {
    process.env.OPENAI_API_KEY = key;
  }
}

export function applyActiveBenchmarkRunEnv(runId: string, schemeId: string): void {
  process.env[ACTIVE_RUN_ENV] = runId;
  process.env[ACTIVE_SCHEME_ENV] = schemeId;
}

export function clearOpenRouterProxyEnv(): void {
  delete process.env[PROXY_BASE_ENV];
  delete process.env[PROXY_LEDGER_ENV];
  delete process.env[ACTIVE_RUN_ENV];
  delete process.env[ACTIVE_SCHEME_ENV];
}

async function registerActiveRunOnProxy(
  proxyBaseUrl: string,
  run: { runId: string; schemeId: string; ledgerPath: string },
): Promise<void> {
  const root = proxyBaseUrl.replace(/\/v1\/?$/, "");
  const res = await fetch(`${root}/_benchmark/active-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_id: run.runId,
      scheme_id: run.schemeId,
      ledger_path: resolve(run.ledgerPath),
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`proxy_active_run_failed:${res.status}:${text}`);
  }
}

async function clearActiveRunOnProxy(proxyBaseUrl: string): Promise<void> {
  const root = proxyBaseUrl.replace(/\/v1\/?$/, "");
  await fetch(`${root}/_benchmark/active-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clear: true }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {
    /* best-effort */
  });
}

export async function startBenchmarkProxySession(input: {
  runId: string;
  schemeId: string;
  ledgerPath?: string;
}): Promise<BenchmarkProxySession> {
  loadBenchmarkDotenv();
  const ledgerPath = resolve(input.ledgerPath ?? defaultProxyLedgerPath(input.runId));
  const externalUrl = resolveExternalProxyUrl();

  if (externalUrl) {
    applyOpenRouterProxyEnv({
      baseUrl: externalUrl,
      port: Number(new URL(externalUrl.replace(/\/v1$/, "/")).port || 4555),
      ledgerPath,
      stop: async () => {},
    });
    applyActiveBenchmarkRunEnv(input.runId, input.schemeId);
    await registerActiveRunOnProxy(externalUrl, {
      runId: input.runId,
      schemeId: input.schemeId,
      ledgerPath,
    });
    return {
      handle: {
        baseUrl: externalUrl,
        port: Number(new URL(externalUrl.replace(/\/v1$/, "/")).port || 4555),
        ledgerPath,
        stop: async () => {
          await clearActiveRunOnProxy(externalUrl);
        },
      },
      runId: input.runId,
      schemeId: input.schemeId,
      external: true,
    };
  }

  const handle = await startOpenRouterProxy({
    runId: input.runId,
    schemeId: input.schemeId,
    ledgerPath,
  });
  applyOpenRouterProxyEnv(handle);
  applyActiveBenchmarkRunEnv(input.runId, input.schemeId);
  handle.setActiveRun?.({
    run_id: input.runId,
    scheme_id: input.schemeId,
    ledger_path: ledgerPath,
    started_at: new Date().toISOString(),
  });
  return { handle, runId: input.runId, schemeId: input.schemeId, external: false };
}

export async function stopBenchmarkProxySession(session: BenchmarkProxySession): Promise<void> {
  clearOpenRouterProxyEnv();
  if (session.external) {
    await session.handle.stop();
    return;
  }
  session.handle.setActiveRun?.(null);
  await session.handle.stop();
}

/** Shared models.json tiers for harness adapters (does not mutate production config). */
export function openRouterTierModel(tier: "main" | "fast"): string {
  const models = loadModelsConfig();
  return models[tier].model;
}
