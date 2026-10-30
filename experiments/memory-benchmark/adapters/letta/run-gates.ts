#!/usr/bin/env node
/** Legacy entry — writes adapter-local gate-results.json via unified six-gate executor. */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAdapterFactoryForScheme,
  runSchemeGates,
} from "../../src/gates/run-scheme-gates.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "gate-results.json");
const cfg = await createAdapterFactoryForScheme("E");
const report = await runSchemeGates({
  scheme: "E",
  createAdapter: cfg.factory,
  enabled: cfg.enabled,
  skipReason: cfg.skipReason,
  serverReachable: cfg.serverReachable,
  annotateLettaLimitation: cfg.annotateLetta,
});
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
process.exit(report.all_passed ? 0 : 1);
