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
npm run eval:report
npm run eval:run -- --suite context-recall
npm run eval:run -- --case rc-coach-codex-token
npm run eval:run -- --case rc-coach-codex-token --repair=auto
npm run eval:scheduler
npm run eval:cron
```

Run artifacts are ignored by git because they can contain private memory and RingCentral context. Reports are written as HTML, for example `.eval-runs/<runId>/report.html` and `.eval-runs/latest-report.html`.

The latest report page uses a shared platform shell, but each suite can render its own readable result view. `context-recall` currently renders a Chinese Memory Lens report with one card per RingCentral/Glip group, including target data, Lens output, score, user-facing conclusion, and improvement suggestions.

`eval:run` only calls an agent when `--repair=auto` is passed or a scheduler item uses `action: repair`. The default agent is Codex.

## Configuration

- `registry.yaml` lists suites, case paths, schedule mode, judge mode, and repair policy.
- `agents.yaml` configures pluggable repair runners. Codex is the default.
- `cases/*/*.jsonl` stores versioned cases.
- `workflows/*/*.md` stores human-readable workflow instructions.
- `judges/*.md` stores LLM-as-judge rubrics.

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
