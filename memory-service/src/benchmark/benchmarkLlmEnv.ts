import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetConfigForTests } from '../config.js';

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

  process.env[ LIVE_ENV ] = 'true';
  process.env.OPENAI_API_KEY = apiKey;
  process.env.OPENAI_API_BASE_URL = options.openAiBaseUrl.replace(/\/+$/, '');
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_MODEL = models.main.model;
  process.env.INGEST_LLM_EXTRACTION_ENABLED = 'true';
  process.env.MEMORY_EXTRACTION_LLM_FALLBACKS = `openai/${models.fast.model}`;
  process.env.RECONCILE_CHEAP_TARGET = `openai/${models.main.model}`;
  process.env.RECONCILE_B_MODE = 'on';
  resetConfigForTests();
}
