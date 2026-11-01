import type { PersonalMemoryEvent } from "../types.js";

/** UTF-8 bytes — conservative ~2k tokenizer tokens for ingest LLM extraction. */
export const WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT = 8_192;

export const WINDOWED_INGEST_ISOLATED_ENV = "MEMORY_BENCHMARK_WINDOWED_INGEST_ISOLATED";

/** Sidecars / modes disabled when paired-control ingest isolation is active. */
export const INGEST_ISOLATION_BYPASS_ENV_KEYS = [
  "ATTENTION_TRIAGE_ENABLED",
  "MEMORY_BENCHMARK_SKIP_DAILY_LOG_APPEND",
  "MEMORY_BENCHMARK_SKIP_CONTEXT_FRAMES",
  "MEMORY_BENCHMARK_SKIP_PROJECT_TIMELINE",
  "RECONCILE_B_MODE",
] as const;

export interface IngestIsolationActive {
  enabled: true;
  stage: "paired-control";
  strategy: "8h" | "full";
  text_cap_utf8_bytes: number;
  bypasses: string[];
  defer_mid_ingest_consolidate: boolean;
}

export type IngestIsolationConfig = IngestIsolationActive | { enabled: false };

const WINDOWED_ENV_KEYS = [
  WINDOWED_INGEST_ISOLATED_ENV,
  "MEMORY_BENCHMARK_WINDOWED_STRATEGY",
  "MEMORY_BENCHMARK_INGEST_EXTRACTION_MAX_TOKENS",
  "MEMORY_BENCHMARK_INGEST_EXTRACTION_BYTE_LIMIT",
  "MEMORY_WRITE_V3_SHADOW",
  ...INGEST_ISOLATION_BYPASS_ENV_KEYS,
] as const;

export function clearWindowedIngestEnv(): void {
  for (const key of WINDOWED_ENV_KEYS) delete process.env[key];
}

/** Isolation applies only to paired-control (full + 8h); other stages use native scheme A ingest. */
export function resolveIngestIsolation(stage: string | undefined, strategy: "8h" | "full"): IngestIsolationConfig {
  if (stage !== "paired-control") return { enabled: false };
  const bypasses = [
    ...INGEST_ISOLATION_BYPASS_ENV_KEYS.map((k) => `${k}=off_or_skip`),
    `ingest_text_cap_utf8_bytes=${WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT}`,
  ];
  return {
    enabled: true,
    stage: "paired-control",
    strategy,
    text_cap_utf8_bytes: WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT,
    bypasses,
    defer_mid_ingest_consolidate: strategy === "full",
  };
}

export function applyIngestIsolation(config: IngestIsolationConfig): void {
  clearWindowedIngestEnv();
  if (!config.enabled) return;
  process.env[WINDOWED_INGEST_ISOLATED_ENV] = "1";
  process.env.MEMORY_BENCHMARK_WINDOWED_STRATEGY = config.strategy;
  process.env.ATTENTION_TRIAGE_ENABLED = "off";
  process.env.MEMORY_BENCHMARK_SKIP_DAILY_LOG_APPEND = "1";
  process.env.MEMORY_BENCHMARK_SKIP_CONTEXT_FRAMES = "1";
  process.env.MEMORY_BENCHMARK_SKIP_PROJECT_TIMELINE = "1";
  process.env.RECONCILE_B_MODE = "off";
  process.env.MEMORY_WRITE_V3_SHADOW = "0";
  process.env.MEMORY_BENCHMARK_INGEST_EXTRACTION_BYTE_LIMIT = String(
    WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT,
  );
  process.env.MEMORY_BENCHMARK_INGEST_EXTRACTION_MAX_TOKENS ??= "2048";
  process.env.PROACTIVE_SCHEDULER_ENABLED = "0";
  process.env.PROACTIVE_BACKGROUND_ENABLED = "0";
}

/** @deprecated Use applyIngestIsolation(resolveIngestIsolation(...)) */
export function applyWindowedIngestEnv(strategy: "8h" | "full"): void {
  applyIngestIsolation(resolveIngestIsolation("paired-control", strategy));
}

export function capIngestEventText(
  event: PersonalMemoryEvent,
  isolation?: IngestIsolationConfig,
): PersonalMemoryEvent {
  const active =
    isolation ??
    (process.env[WINDOWED_INGEST_ISOLATED_ENV] === "1"
      ? ({ enabled: true } as IngestIsolationActive)
      : { enabled: false });
  if (!active.enabled) return event;
  const text = event.text ?? "";
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT) return event;
  const capped = buf.subarray(0, WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT).toString("utf8");
  return { ...event, text: capped };
}

export function extractionTextForBenchmark(content: string): string {
  const buf = Buffer.from(content, "utf8");
  if (buf.length <= WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT) return content;
  return buf.subarray(0, WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT).toString("utf8");
}
