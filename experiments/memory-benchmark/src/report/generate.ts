import { writeFile } from "node:fs/promises";
import type { BenchmarkReport } from "../types.js";
import { bootstrapStorylineCi, storylineBucketsFromOutcomes } from "./bootstrap.js";

export function renderMarkdownReport(report: BenchmarkReport): string {
  const ci = bootstrapStorylineCi(storylineBucketsFromOutcomes(report.outcomes));
  const lines: string[] = [
    `# Memory benchmark report`,
    ``,
    `- **scheme**: ${report.scheme_id}`,
    `- **run_id**: ${report.run_id}`,
    `- **fixture**: ${report.fixture_id}`,
    `- **mode**: ${report.mode}`,
    `- **events ingested**: ${report.events_ingested}`,
    `- **consolidations**: ${report.consolidations}`,
    `- **probes**: ${report.probes_passed}/${report.probes_run} passed`,
    `- **mean composite**: ${report.mean_composite.toFixed(2)}`,
    `- **storyline bootstrap 95% CI**: [${ci.ci_low.toFixed(2)}, ${ci.ci_high.toFixed(2)}] (n=${ci.n_storylines})`,
    `- **cost (harness / adapter / combined)**: $${report.cost.harness_usd.toFixed(4)} / $${report.cost.adapter_usd.toFixed(4)} / $${report.cost.combined_usd.toFixed(4)} / $${report.cost.budget_usd} (live ${report.cost.live_inference_calls}, cached ${report.cost.cached_replay_calls})`,
    `- **latency decide p95**: ${report.latency.decide_p95_ms.toFixed(1)} ms`,
  ];
  if (report.stopped_reason) {
    lines.push(`- **stopped**: ${report.stopped_reason}`);
  }
  lines.push(``, `## Scene means`, ``);
  for (const [scene, mean] of Object.entries(report.scene_means)) {
    lines.push(`- ${scene}: ${mean.toFixed(2)}`);
  }
  lines.push(``, `## Hard gates`, ``, `- failures: ${report.hard_gate_failures}`);
  return lines.join("\n");
}

export async function writeReports(
  report: BenchmarkReport,
  outJsonPath: string,
  outMdPath: string,
): Promise<void> {
  const ci = bootstrapStorylineCi(storylineBucketsFromOutcomes(report.outcomes));
  const payload = { ...report, storyline_ci: ci };
  await writeFile(outJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(outMdPath, `${renderMarkdownReport(report)}\n`, "utf8");
}
