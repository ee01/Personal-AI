#!/usr/bin/env node
import { glob, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { BenchmarkReport } from "../types.js";
import {
  aggregateRescoredSummaries,
  reconcileWithReview,
  rescoreBenchmarkReport,
  type ReconcileExpectation,
} from "../scoring/rescore-v2.js";

interface CliArgs {
  report?: string;
  reportsGlob?: string;
  reconcile?: string;
  scheme?: string;
  jsonStdout: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { jsonStdout: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report" && argv[i + 1]) args.report = resolve(argv[++i]!);
    else if (a === "--reports-glob" && argv[i + 1]) args.reportsGlob = argv[++i]!;
    else if (a === "--reconcile" && argv[i + 1]) args.reconcile = resolve(argv[++i]!);
    else if (a === "--scheme" && argv[i + 1]) args.scheme = argv[++i]!;
    else if (a === "--json") args.jsonStdout = true;
    else if (a === "--help") {
      console.log(`Usage:
  rescore-report.ts --report <report.json>
  rescore-report.ts --reports-glob '<pattern>' [--reconcile review.json] [--scheme A]

Writes report.rescored.json beside each input (never overwrites report.json).`);
      process.exit(0);
    }
  }
  return args;
}

async function loadReport(path: string): Promise<BenchmarkReport> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as BenchmarkReport;
}

async function expandGlob(pattern: string): Promise<string[]> {
  const matches: string[] = [];
  for await (const entry of glob(pattern)) {
    matches.push(String(entry));
  }
  return matches.sort();
}

async function main() {
  const args = parseArgs(process.argv);
  const paths: string[] = [];

  if (args.report) paths.push(args.report);
  if (args.reportsGlob) {
    const resolved = args.reportsGlob.startsWith("/")
      ? args.reportsGlob
      : resolve(process.cwd(), args.reportsGlob);
    paths.push(...(await expandGlob(resolved)));
  }

  if (paths.length === 0) {
    console.error("Provide --report or --reports-glob");
    process.exit(1);
  }

  const rescoredReports = [];
  for (const p of paths) {
    const report = await loadReport(p);
    const rescored = rescoreBenchmarkReport(report, { source_report_path: p });
    const outPath = join(dirname(p), "report.rescored.json");
    await writeFile(outPath, `${JSON.stringify(rescored, null, 2)}\n`, "utf8");
    if (!args.jsonStdout) {
      console.error(`wrote ${outPath}`);
    }
    rescoredReports.push(rescored);
  }

  if (args.reconcile && args.scheme) {
    const reviewRaw = JSON.parse(await readFile(args.reconcile, "utf8")) as {
      schemes: Record<string, ReconcileExpectation & { n?: number }>;
    };
    const expected = reviewRaw.schemes[args.scheme];
    if (!expected) {
      console.error(`Scheme ${args.scheme} not in reconcile file`);
      process.exit(1);
    }
    const { summary } = aggregateRescoredSummaries(rescoredReports);
    const { ok, diffs } = reconcileWithReview(summary, expected);
    const payload = {
      scheme: args.scheme,
      reports: paths.length,
      reconcile_ok: ok,
      diffs,
      actual: {
        safety_flagged_probes: summary.safety.safety_flagged_probes,
        action_match: summary.action.action_match,
        negative_false_actions: summary.action.negative_false_actions,
        positive_silence: summary.action.positive_silence,
      },
      expected: {
        safety_flagged_probes: expected.safety_flagged_probes,
        action_match: expected.action_match,
        negative_false_actions: expected.negative_false_actions,
        positive_silence: expected.positive_silence,
      },
    };
    if (args.jsonStdout) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.error(JSON.stringify(payload, null, 2));
    }
    if (!ok) process.exit(2);
  } else if (args.jsonStdout && paths.length === 1) {
    console.log(JSON.stringify(rescoredReports[0]!.rescored_summary, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
