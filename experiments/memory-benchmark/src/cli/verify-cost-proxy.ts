#!/usr/bin/env node
/**
 * E-167: run synthetic-mini for schemes A–E and compare OpenRouter key usage vs proxy ledger.
 * Prerequisite startup order: `npm run proxy` → D/E services (see envs/README.md) → this script.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import {
  fetchOpenRouterKeyUsage,
  usageDelta,
} from "../cost/openrouter-key-usage.js";
import { proxyTotalsFromFile } from "../cost/proxy-ledger.js";
import { resolveExternalProxyUrl } from "../cost/benchmark-proxy-session.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkgRoot = resolve(__dirname, "../..");
const date = new Date().toISOString().slice(0, 10);

const SCHEMES = ["A", "B", "C", "D", "E"] as const;

function deviationPct(proxyUsd: number, keyDelta: number): number | null {
  if (keyDelta <= 0 && proxyUsd <= 0) return 0;
  if (keyDelta <= 0) return null;
  return (Math.abs(proxyUsd - keyDelta) / keyDelta) * 100;
}

async function latestReportJson(outDir: string, scheme: string): Promise<string | null> {
  let files: string[];
  try {
    files = await readdir(outDir);
  } catch {
    return null;
  }
  const matches = files
    .filter((f) => f.startsWith(`${scheme}-run-`) && f.endsWith(".json"))
    .sort();
  if (matches.length === 0) return null;
  return join(outDir, matches[matches.length - 1]!);
}

async function runScheme(scheme: string): Promise<{ outDir: string; runId: string | null }> {
  const outDir = join(pkgRoot, "reports", `cost-proxy-verify-${date}`, scheme);
  await mkdir(outDir, { recursive: true });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "npm",
      ["run", "run", "--", "--scheme", scheme, "--fixture", "synthetic-mini", "--out", outDir],
      { cwd: pkgRoot, stdio: "inherit", env: process.env },
    );
    child.on("exit", async (code) => {
      if (code !== 0) {
        reject(new Error(`scheme_${scheme}_exit_${code}`));
        return;
      }
      const jsonPath = await latestReportJson(outDir, scheme);
      let runId: string | null = null;
      if (jsonPath) {
        const report = JSON.parse(await readFile(jsonPath, "utf8")) as { run_id?: string };
        runId = report.run_id ?? null;
      }
      resolvePromise({ outDir, runId });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadBenchmarkDotenv();
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY missing — skip live verification");
    process.exit(2);
  }

  const proxyUrl = resolveExternalProxyUrl();
  const attributionNote = proxyUrl
    ? "共享代理：harness 请求带 `X-Benchmark-Run`；D/E 服务走「当前活动 run 窗口」"
    : "嵌入式代理：每 run 独立随机端口（未设置 MEMORY_BENCHMARK_PROXY_URL）";

  const rows: Array<{
    scheme: string;
    proxy_usd: number;
    key_delta: number;
    deviation_pct: number | null;
    pass: boolean;
    note: string;
  }> = [];

  for (const scheme of SCHEMES) {
    const beforeScheme = await fetchOpenRouterKeyUsage(apiKey);
    const { outDir } = await runScheme(scheme);
    await sleep(3000);
    const afterScheme = await fetchOpenRouterKeyUsage(apiKey);
    const keyDelta = usageDelta(beforeScheme, afterScheme);

    const jsonPath = await latestReportJson(outDir, scheme);
    let proxyUsd = 0;
    let note = "synthetic-mini";
    if (jsonPath) {
      const report = JSON.parse(await readFile(jsonPath, "utf8")) as {
        cost?: { proxy_usd?: number };
        run_id?: string;
      };
      proxyUsd = report.cost?.proxy_usd ?? 0;
      const ledgerPath = report.run_id
        ? join(pkgRoot, ".local", "proxy-ledger", `${report.run_id}.jsonl`)
        : null;
      if (ledgerPath) {
        const ledgerTotals = proxyTotalsFromFile(ledgerPath);
        if (ledgerTotals.proxy_usd > 0) proxyUsd = ledgerTotals.proxy_usd;
      }
      if (scheme === "D" && deviationPct(proxyUsd, keyDelta) !== null && (deviationPct(proxyUsd, keyDelta) ?? 0) > 10) {
        note += "; Supermemory 可能含非 LLM 路径或 generation 回填延迟";
      }
    } else {
      note += "; report missing";
    }

    const dev = deviationPct(proxyUsd, keyDelta);
    const pass = dev !== null && dev <= 10;
    rows.push({
      scheme,
      proxy_usd: proxyUsd,
      key_delta: keyDelta,
      deviation_pct: dev,
      pass,
      note,
    });
  }

  const mdLines = [
    `# OpenRouter proxy verification (${date})`,
    "",
    "## 启动顺序",
    "",
    "1. `cd experiments/memory-benchmark && npm run proxy`（默认 `127.0.0.1:4555`，可设 `MEMORY_BENCHMARK_PROXY_PORT`）",
    "2. 导出 `MEMORY_BENCHMARK_PROXY_URL=http://127.0.0.1:4555/v1`",
    "3. 按 `envs/README.md` 启动 Supermemory / Letta（`OPENAI_BASE_URL` 指向代理）",
    "4. `npm run verify-cost-proxy` 或逐方案 `npm run run -- --scheme …`",
    "5. 结束后停止 D/E 与 proxy",
    "",
    "## run 归属",
    "",
    attributionNote,
    "",
    "## 五方案对账（synthetic-mini）",
    "",
    "| scheme | proxy_usd | key_delta_usd | deviation_pct | pass (≤10%) | note |",
    "| --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const r of rows) {
    mdLines.push(
      `| ${r.scheme} | ${r.proxy_usd.toFixed(6)} | ${r.key_delta.toFixed(6)} | ${
        r.deviation_pct === null ? "—" : r.deviation_pct.toFixed(2) + "%"
      } | ${r.pass ? "✅" : "❌"} | ${r.note} |`,
    );
  }

  mdLines.push("", `Per-scheme artifacts: \`reports/cost-proxy-verify-${date}/\`.`);

  const reportDir = join(pkgRoot, "reports");
  await mkdir(reportDir, { recursive: true });
  const mdPath = join(reportDir, `cost-proxy-verify-${date}.md`);
  await writeFile(mdPath, mdLines.join("\n"), "utf8");
  console.log(`Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
