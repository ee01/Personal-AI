#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StubMemoryAdapter } from "../../adapters/stub-adapter.js";
import type { AuthorityFixture } from "../clock/authority-fixture.js";
import { AuthorityFixtureStore } from "../clock/authority-fixture.js";
import { CostTracker } from "../cost/tracker.js";
import { loadEventsJsonl, loadProbesJsonl } from "../data/load.js";
import { writeReports } from "../report/generate.js";
import { runBenchmark } from "../scoring/probe-runner.js";
import { NotificationSink } from "../sink/notification-sink.js";

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

  const adapter = new StubMemoryAdapter(cli.scheme);
  const runId = `run-${Date.now()}`;

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
  });

  await mkdir(cli.outDir, { recursive: true });
  const jsonPath = join(cli.outDir, `${cli.scheme}-${runId}.json`);
  const mdPath = join(cli.outDir, `${cli.scheme}-${runId}.md`);
  await writeReports(report, jsonPath, mdPath);

  console.log(`Wrote ${mdPath}`);
  console.log(
    `probes ${report.probes_passed}/${report.probes_run}, mean=${report.mean_composite.toFixed(2)}, cost=$${report.cost.total_usd.toFixed(4)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
