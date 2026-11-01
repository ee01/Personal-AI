import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetConfigForTests } from '../config.js';
import { resetLlmClientSingleton } from '../llm/LLMClient.js';
import { resetExtractionLlmClient } from '../core/v3/ExtractionWorker.js';

export interface BenchmarkModelTier {
  provider: string;
  model: string;
  temperature?: number;
  base_url?: string;
}

export interface BenchmarkModelsFile {
  main: BenchmarkModelTier;
  fast: BenchmarkModelTier;
}

const LIVE_ENV = 'MEMORY_BENCHMARK_LIVE_LLM';

export function isBenchmarkLiveLlmEnabled(): boolean {
  const raw = process.env[LIVE_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function defaultModelsPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../experiments/memory-benchmark/config/models.json');
}

export function loadBenchmarkModelsJson(modelsPath?: string): BenchmarkModelsFile {
  const file = modelsPath ?? defaultModelsPath();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BenchmarkModelsFile;
  if (!raw?.main?.model || !raw?.fast?.model) {
    throw new Error(`Invalid benchmark models.json: ${file}`);
  }
  return raw;
}

/**
 * Inject OpenRouter tier routing for scheme A in-process harness runs.
 * Uses process env only; production defaults remain unchanged outside this process.
 */
export function applyBaselineBenchmarkLlmEnv(options: {
  openAiBaseUrl: string;
  modelsPath?: string;
  enableLive?: boolean;
}): void {
  if (options.enableLive === false) return;
  const models = loadBenchmarkModelsJson(options.modelsPath);
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
  if (!apiKey) return;

  process.env[LIVE_ENV] = 'true';
  process.env.OPENAI_API_KEY = apiKey;
  process.env.OPENAI_API_BASE_URL = options.openAiBaseUrl.replace(/\/+$/, '');
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_MODEL = models.main.model;
  process.env.INGEST_LLM_EXTRACTION_ENABLED = 'true';
  // Benchmark policy: single configured tier only — no provider/model fallback chains.
  process.env.LLM_FALLBACKS = '';
  process.env.LLM_FALLBACK_ON_JSON_PARSE = 'false';
  process.env.MEMORY_EXTRACTION_LLM_FALLBACKS = `openai/${models.main.model}`;
  process.env.LLM_REQUEST_TIMEOUT_MS = '180000';
  process.env.RECONCILE_CHEAP_TARGET = `openai/${models.main.model}`;
  const isolated =
    process.env.MEMORY_BENCHMARK_WINDOWED_INGEST_ISOLATED === '1';
  if (isolated) {
    process.env.RECONCILE_B_MODE = 'off';
    process.env.MEMORY_WRITE_V3_SHADOW = '0';
    process.env.ATTENTION_TRIAGE_ENABLED = 'off';
    process.env.MEMORY_BENCHMARK_SKIP_DAILY_LOG_APPEND = '1';
    process.env.MEMORY_BENCHMARK_SKIP_CONTEXT_FRAMES = '1';
    process.env.MEMORY_BENCHMARK_SKIP_PROJECT_TIMELINE = '1';
    process.env.MEMORY_BENCHMARK_INGEST_EXTRACTION_MAX_TOKENS ??= '2048';
  } else {
    process.env.RECONCILE_B_MODE = 'on';
  }
  resetConfigForTests();
  resetLlmClientSingleton();
  resetExtractionLlmClient();
}
