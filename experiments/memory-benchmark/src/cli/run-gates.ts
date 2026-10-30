#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAdapterFactoryForScheme,
  runAllSchemeGates,
  runSchemeGates,
  type SchemeLetter,
} from "../gates/run-scheme-gates.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv: string[]): { scheme?: SchemeLetter; outDir: string; all: boolean } {
  let scheme: SchemeLetter | undefined;
  let outDir = join(pkgRoot, "reports", `gates-exec-${new Date().toISOString().slice(0, 10)}`);
  let all = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scheme" && argv[i + 1]) {
      scheme = argv[++i]!.toUpperCase() as SchemeLetter;
    } else if (a === "--out" && argv[i + 1]) {
      outDir = argv[++i]!;
    } else if (a === "--all") {
      all = true;
    }
  }
  if (!scheme && !all) all = true;
  return { scheme, outDir, all };
}

const { scheme, outDir, all } = parseArgs(process.argv);
mkdirSync(outDir, { recursive: true });

let reports;
if (all || !scheme) {
  reports = await runAllSchemeGates();
} else {
  const cfg = await createAdapterFactoryForScheme(scheme);
  reports = [
    await runSchemeGates({
      scheme,
      createAdapter: cfg.factory,
      enabled: cfg.enabled,
      skipReason: cfg.skipReason,
      serverReachable: cfg.serverReachable,
      annotateLettaLimitation: cfg.annotateLetta,
    }),
  ];
}

const summary = {
  generated_at: new Date().toISOString(),
  out_dir: outDir,
  reports,
};

writeFileSync(join(outDir, "gate-results.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
for (const r of reports) {
  writeFileSync(
    join(outDir, `scheme-${r.scheme_id}.json`),
    `${JSON.stringify(r, null, 2)}\n`,
    "utf8",
  );
}

console.log(JSON.stringify(summary, null, 2));
const failed = reports.filter((r) => !r.all_passed && !r.skipped);
process.exit(failed.length ? 1 : 0);
