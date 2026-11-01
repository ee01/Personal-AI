import type { PersonalMemoryEvent } from "../types.js";

/** UTF-8 bytes — conservative ~2k tokenizer tokens for ingest LLM extraction. */
export const WINDOWED_INGEST_EXTRACTION_BYTE_LIMIT = 8_192;

export const WINDOWED_INGEST_ISOLATED_ENV = "MEMORY_BENCHMARK_WINDOWED_INGEST_ISOLATED";

/** Shared by all schemes in run-windowed.ts before the ingest loop. */
export function applyWindowedIngestEnv(strategy: "8h" | "full"): void {
  process.env[WINDOWED_INGEST_ISOLATED_ENV] = "1";
  process.env.MEMORY_BENCHMARK_WINDOWED_STRATEGY = strategy;
  process.env.ATTENTION_TRIAGE_ENABLED ??= "off";
  process.env.MEMORY_BENCHMARK_SKIP_DAILY_LOG_APPEND ??= "1";
  process.env.MEMORY_BENCHMARK_SKIP_CONTEXT_FRAMES ??= "1";
  process.env.MEMORY_BENCHMARK_SKIP_PROJECT_TIMELINE ??= "1";
}

export function capIngestEventText(event: PersonalMemoryEvent): PersonalMemoryEvent {
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
