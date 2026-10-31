#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StubMemoryAdapter } from "../../adapters/stub-adapter.js";
import { BaselineSchemeAAdapter } from "../../adapters/baseline/baseline-adapter.js";
import { createNewCoreSchemeBAdapter } from "../../adapters/new-core/adapter.js";
import { createMem0SchemeCAdapter } from "../../adapters/mem0/adapter.js";
import { createSupermemorySchemeDAdapter } from "../../adapters/supermemory/adapter.js";
import { createLettaSchemeEAdapter } from "../../adapters/letta/adapter.js";
import type { MemoryBenchmarkAdapter } from "../types.js";
import type { AuthorityFixture } from "../clock/authority-fixture.js";
import { AuthorityFixtureStore } from "../clock/authority-fixture.js";
import { CostTracker } from "../cost/tracker.js";
import { loadEventsJsonl, loadProbesJsonl } from "../data/load.js";
import { writeReports } from "../report/generate.js";
import { runBenchmark } from "../scoring/probe-runner.js";
import { NotificationSink } from "../sink/notification-sink.js";
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import {
  startBenchmarkProxySession,
  stopBenchmarkProxySession,
} from "../cost/benchmark-proxy-session.js";

function resolveSchemeLetter(raw: string): string {
  if (raw === "baseline") return "A";
  if (raw === "new-core") return "B";
  if (raw === "mem0") return "C";
  if (raw === "supermemory") return "D";
  if (raw === "letta") return "E";
  return raw.length === 1 ? raw.toUpperCase() : raw;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "../..");

interface CliArgs {
  fixture: string;
  events?: string;
  probes?: string;
  authority?: string;
  outDir: string;
  budgetUsd: number;
  scheme: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    fixture: "synthetic-mini",
    outDir: join(pkgRoot, "out"),
    budgetUsd: 50,
    scheme: "stub",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture" && argv[i + 1]) args.fixture = argv[++i]!;
    else if (a === "--events" && argv[i + 1]) args.events = argv[++i];
    else if (a === "--probes" && argv[i + 1]) args.probes = argv[++i];
    else if (a === "--authority" && argv[i + 1]) args.authority = argv[++i];
    else if (a === "--out" && argv[i + 1]) args.outDir = resolve(argv[++i]!);
    else if (a === "--budget-usd" && argv[i + 1]) args.budgetUsd = Number(argv[++i]);
    else if (a === "--scheme" && argv[i + 1]) args.scheme = argv[++i];
  }
  return args;
}

function fixturePaths(fixture: string) {
  const base = join(pkgRoot, "fixtures", fixture);
  return {
    events: join(base, "events.jsonl"),
    probes: join(base, "probes.jsonl"),
    authority: join(base, "authority.json"),
  };
}

async function main() {
  const cli = parseArgs(process.argv);
  loadBenchmarkDotenv();
  const paths = fixturePaths(cli.fixture);
  const eventsPath = cli.events ?? paths.events;
  const probesPath = cli.probes ?? paths.probes;
  const authorityPath = cli.authority ?? paths.authority;

  const events = await loadEventsJsonl(eventsPath);
  const probes = await loadProbesJsonl(probesPath);
  const authorityJson = JSON.parse(await readFile(authorityPath, "utf8")) as AuthorityFixture;
  const authority = new AuthorityFixtureStore(authorityJson);
  const sink = new NotificationSink();
  const cost = new CostTracker({ max_usd: cli.budgetUsd });

  const runId = `run-${Date.now()}`;
  const schemeLetter = resolveSchemeLetter(cli.scheme);

  const proxySession = await startBenchmarkProxySession({
    runId,
    schemeId: schemeLetter,
  });

  let adapter: MemoryBenchmarkAdapter;
  try {
  if (cli.scheme === "A" || cli.scheme === "baseline") {
    adapter = new BaselineSchemeAAdapter(
      cli.scheme === "baseline" ? "A" : cli.scheme,
      proxySession.handle.baseUrl,
    );
  } else if (cli.scheme === "B" || cli.scheme === "new-core") {
    adapter = await createNewCoreSchemeBAdapter({ schemeId: "B", fresh: true, runId });
  } else if (cli.scheme === "C" || cli.scheme === "mem0") {
    adapter = await createMem0SchemeCAdapter({ schemeId: "C", fresh: true, runId });
  } else if (cli.scheme === "D" || cli.scheme === "supermemory") {
    adapter = await createSupermemorySchemeDAdapter({ schemeId: "D", fresh: true, runId });
  } else if (cli.scheme === "E" || cli.scheme === "letta") {
    adapter = await createLettaSchemeEAdapter({ schemeId: "E", fresh: true, runId });
  } else {
    adapter = new StubMemoryAdapter(cli.scheme);
  }

  const report = await runBenchmark({
    adapter,
    events,
    probes,
    authority,
    sink,
    cost,
    fixtureId: cli.fixture,
    runId,
    mode: "quality",
    proxyLedgerPath: proxySession.handle.ledgerPath,
  });

  await mkdir(cli.outDir, { recursive: true });
  const jsonPath = join(cli.outDir, `${cli.scheme}-${runId}.json`);
  const mdPath = join(cli.outDir, `${cli.scheme}-${runId}.md`);
  await writeReports(report, jsonPath, mdPath);

  console.log(`Wrote ${mdPath}`);
  console.log(
    `probes ${report.probes_passed}/${report.probes_run}, mean=${report.mean_composite.toFixed(2)}, cost harness/adapter/combined/proxy=$${report.cost.harness_usd.toFixed(4)}/$${report.cost.adapter_usd.toFixed(4)}/$${report.cost.combined_usd.toFixed(4)}/$${report.cost.proxy_usd.toFixed(4)}`,
  );

  if ("close" in adapter && typeof adapter.close === "function") {
    await adapter.close();
  }
  } finally {
    await stopBenchmarkProxySession(proxySession);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
