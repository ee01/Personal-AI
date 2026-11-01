#!/usr/bin/env node
/** Matrix-parity ingest token validation: same entry as run-windowed.ts (paired-control / A / full). */
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const BENCH = resolve(fileURLToPath(import.meta.url), "..", "..");
const ROOT = resolve(BENCH, "..", "..");
const EVENTS = join(ROOT, "memory-service/evals/personal-memory-dataset/raw-only/events.jsonl");
const PROBES = join(ROOT, "memory-service/evals/personal-memory-dataset/raw-only/probes/development.v1.1.jsonl");
const SLICE = join(BENCH, "reports/run-2026-10-31/slice-events.jsonl");
const N = Number(process.env.VALIDATE_N ?? 20);
const OUT = join(BENCH, ".local/validate-ingest-matrix-parity");

const runId = `validate-matrix-parity-${Date.now()}`;
const cmd = [
  "npx",
  "tsx",
  "src/cli/run-windowed.ts",
  "--scheme",
  "A",
  "--stage",
  "paired-control",
  "--strategy",
  "full",
  "--as-of",
  "2026-08-18T06:51:44.000Z",
  "--events",
  SLICE,
  "--probes",
  PROBES,
  "--run-id",
  runId,
  "--out",
  OUT,
  "--hours",
  "8",
  "--ablation",
  "none",
  "--validate-max-events",
  String(N),
];

const env = {
  ...process.env,
  LLM_TRACE_CALLSITE: "1",
  MEMORY_BENCHMARK_STRICT_BGE: "1",
  MEMORY_BENCHMARK_BUDGET_POLICY: join(BENCH, ".local/windowed-budget.json"),
};

const result = spawnSync(cmd[0]!, cmd.slice(1), {
  cwd: BENCH,
  env,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
