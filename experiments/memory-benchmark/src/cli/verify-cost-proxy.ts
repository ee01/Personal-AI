#!/usr/bin/env node
/**
 * E-166: run synthetic-mini for schemes A–E and compare OpenRouter key usage vs proxy ledger.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import {
  fetchOpenRouterKeyUsage,
  usageDelta,
} from "../cost/openrouter-key-usage.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkgRoot = resolve(__dirname, "../..");
const date = new Date().toISOString().slice(0, 10);

const SCHEMES = [
  { flag: "A", label: "A" },
  { flag: "B", label: "B" },
  { flag: "C", label: "C" },
  { flag: "D", label: "D" },
  { flag: "E", label: "E" },
];

async function runScheme(scheme: string): Promise<{ reportPath: string }> {
  const outDir = join(pkgRoot, "reports", `cost-proxy-verify-${date}`, scheme);
  await mkdir(outDir, { recursive: true });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "npm",
      ["run", "run", "--", "--scheme", scheme, "--fixture", "synthetic-mini", "--out", outDir],
      { cwd: pkgRoot, stdio: "inherit", env: process.env },
    );
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`scheme_${scheme}_exit_${code}`));
      else resolvePromise({ reportPath: outDir });
    });
  });
}

async function main() {
  loadBenchmarkDotenv();
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY missing — skip live verification");
    process.exit(2);
  }

  const before = await fetchOpenRouterKeyUsage(apiKey);
  const rows: string[] = [
    "| scheme | proxy_usd | key_delta_usd | deviation_pct | note |",
    "| --- | ---: | ---: | ---: | --- |",
  ];

  for (const { flag } of SCHEMES) {
    const beforeScheme = await fetchOpenRouterKeyUsage(apiKey);
    await runScheme(flag);
    const afterScheme = await fetchOpenRouterKeyUsage(apiKey);
    const keyDelta = usageDelta(beforeScheme, afterScheme);
    rows.push(
      `| ${flag} | (see report dir) | ${keyDelta.toFixed(6)} | — | synthetic-mini via harness |`,
    );
  }

  const after = await fetchOpenRouterKeyUsage(apiKey);
  const totalKeyDelta = usageDelta(before, after);

  const reportDir = join(pkgRoot, "reports");
  await mkdir(reportDir, { recursive: true });
  const mdPath = join(reportDir, `cost-proxy-verify-${date}.md`);
  const body = [
    `# OpenRouter proxy verification (${date})`,
    "",
    `Total key usage delta (all schemes): $${totalKeyDelta.toFixed(6)}`,
    "",
    ...rows,
    "",
    "Per-scheme JSON reports live under `reports/cost-proxy-verify-" + date + "/`.",
    "",
    "Compare each run's `cost.proxy_usd` to the per-scheme key delta; target deviation ≤10%.",
  ].join("\n");
  await writeFile(mdPath, body, "utf8");
  console.log(`Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
