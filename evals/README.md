# Personal AI Evals

This folder stores file-first experience evals for Personal AI.

## Vocabulary

- Eval Case: one sample with input context, expected anchors, banned topics, and expected behavior.
- Eval Workflow: human-readable steps for collection, scoring, reporting, and optional repair.
- Eval Suite: a group of cases with one workflow and one repair policy.
- Eval Run: one execution stored under `.eval-runs/<runId>/`.
- Repair Attempt: an optional agent run triggered by a failed eval.

## Commands

```bash
npm run eval:list
npm run eval:validate
npm run eval:report
npm run eval:run -- --suite context-recall
npm run eval:run -- --suite compose-assist --live --no-llm
npm run eval:run -- --case rc-coach-codex-token
npm run eval:run -- --case rc-coach-codex-token --repair=auto
npm run eval:scheduler
npm run eval:cron
```

Run artifacts are ignored by git because they can contain private memory and RingCentral context. Reports are written as HTML:

- `.eval-runs/latest-report.html` is the dashboard-style overview.
- `.eval-runs/latest-context-recall-report.html` is the current suite-level Memory Lens report across the RingCentral/Glip group samples.
- `.eval-runs/<runId>/report.html` is a single run or single case evidence report.

The latest report page uses a shared platform shell, but each suite can render its own readable detail report. `context-recall` currently renders a Chinese Memory Lens report with one card per RingCentral/Glip group, including target data, Lens output, score, user-facing conclusion, improvement suggestions, and links to the single-case evidence reports.

`eval:run` only calls an agent when `--repair=auto` is passed or a scheduler item uses `action: repair`. The default agent is Codex.

## Report Contract

The canonical contract lives in `evals/report-contract.md`. Every runnable suite should make its report answer the same user questions:

- What data or target did this case evaluate?
- What behavior was expected?
- What did the system actually return or generate?
- What was the score/verdict and why?
- What should be improved next?

Runner results should include `caseTitle`, `sampleSummary` or redacted `sampleDetails`, `expectedBehavior`, a structured `actualOutput` or `topMatch`, `scores`, `userConclusion`, and `improvementSuggestions`. If a suite needs domain-specific interpretation, add a suite-specific HTML renderer; otherwise the generic card renderer is the fallback.

Run `npm run eval:validate` after adding a suite or case. The validator checks that each suite has a Chinese description, workflow, cases file, and `Report requirements` section, and that cases include enough input/expected-output fields to produce a readable report.

For Compose Assist context-pack cases, the report must show the evaluated chat/composer sample, draft text, source types, generated compose text, returned evidence, debug summary, verdict, and improvement suggestions. Live Web AI sampling uses `webpage-mcp` through `mcporter` when `--live` is passed; if no matching tab is available, the runner records the live failure and falls back to the case snapshot.

## Configuration

- `registry.yaml` lists suites, Chinese descriptions, case paths, schedule mode, judge mode, and repair policy.
- `agents.yaml` configures pluggable repair runners. Codex is the default.
- `cases/*/*.jsonl` stores versioned cases.
- `workflows/*/*.md` stores human-readable workflow instructions. The overview report uses these files to explain what each suite evaluates and links back to the source workflow.
- `judges/*.md` stores LLM-as-judge rubrics.
- `report-contract.md` stores the required user-facing report shape for all suites.
- `workflows/_template.md` is the starting point for new suite workflows and includes the required report section.

## Scheduling

Scheduling policy belongs in `registry.yaml`, not in individual case files.

- `scheduler.pollInterval` controls how often `eval:scheduler` checks due work.
- `suites[].schedule.every` controls suite-level frequency.
- `suites[].caseSchedules[]` can override frequency per case.
- `action: report` writes reports only.
- `action: repair` runs the eval and calls the configured agent if it fails.

Use `npm run eval:scheduler` for a long-running local process. Use `npm run eval:cron` from system cron or launchd for a one-shot due check.

## Adding A Case

1. Add one JSON object per line to `evals/cases/<suite>/...jsonl`.
2. Include a stable `id`, `kind`, context URL or snapshot, `expectedTopics`, `mustNotReturnTopics`, `expectedBehavior`, `privacy`, and `owner`.
3. If it should run on its own schedule, add an entry under the suite's `caseSchedules` in `registry.yaml`.
4. Run `npm run eval:run -- --case <id>` and inspect the generated `.eval-runs/<runId>/report.html`.

Case files describe evaluation data. Registry entries describe operating policy: frequency, report versus repair, agent, and validation commands.
