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

# Memory Abilities benchmark (P0-1) — standalone runner, hits a live /ask
# endpoint with real user data; deterministic heuristic judge (no judge model).
memory-service/node_modules/.bin/tsx tools/eval-memory-abilities.ts \
  --endpoint http://10.32.56.212:3210/api/v1/ask --user esone.qiu
# add --update-baseline to refresh evals/.baseline/memory-abilities.json

# Passive webpage analysis contract eval (synthetic, no external model call)
npm run eval:passive-webpage-analysis

# Recall synthesis routing contract eval (synthetic, no external model call)
npm run eval:recall-synthesis-contract
```

### Passive webpage analysis contract eval (standalone)

`tools/eval-passive-webpage-analysis.ts` runs the blocker, decision-chat,
static-shell, and strict-skip fixtures under
`evals/cases/passive-webpage-analysis/cases.jsonl`. It checks that runtime
normalization keeps only facts/entities with direct page evidence, enforces the
empty `skip` contract, and does not let unsupported context entities or
notification flags survive. It is deliberately synthetic and does not call a
live provider; provider/model quality still needs a controlled live comparison
when the configured model or prompt version changes.

### Recall synthesis contract eval (standalone)

`tools/eval-recall-synthesis-contract.ts` uses an in-memory Recall database and
synthetic model outputs to verify default zero-LLM retrieval, minimum-evidence
gating, grounded evidence IDs, invalid-output rejection, and same-snapshot cache
reuse. It deliberately does not call a live provider, so prose quality and live
retrieval relevance remain outside this suite's proof boundary.

### Memory Abilities benchmark (standalone)

`tools/eval-memory-abilities.ts` scores six abilities (extraction /
multi_session / temporal / knowledge_update / abstention / prospective) against
a **live** memory-service `/ask` endpoint with real data. It is intentionally
standalone (not wired into `eval:run`) because it judges end-to-end answers from
a running server rather than a synthetic in-memory fixture, and uses a
deterministic heuristic judge to avoid judge-model variance.

- Cases: `evals/cases/memory-abilities/cases.jsonl` (golden grounded in real
  `esone.qiu` data, probed from the online server).
- Rubric: `evals/judges/memory-abilities.md`.
- Baseline: `evals/.baseline/memory-abilities.json`; the runner exits non-zero on
  any ability regressing more than 0.05. Re-run after any recall- or write-path
  change (PPR, behavior affinity, merge/evolution) and before shipping.
- Grounded cases require returned evidence and reject ambiguous-topic
  clarifications; the runner strips question/candidate echoes before keyword
  scoring and writes `contextMatchState` plus `evidencePreview` to
  `responses.jsonl` for failure review.

Run artifacts are ignored by git because they can contain private memory and RingCentral context. Reports are normalized into a reader-facing model, then written as HTML:

- `.eval-runs/latest-report.html` is the dashboard-style overview.
- `.eval-runs/latest-context-recall-report.html` is the current suite-level Memory Lens report across the RingCentral/Glip group samples.
- `.eval-runs/<runId>/report.html` is a single run or single case evidence report.
- `.eval-runs/<runId>/reader-report.json` is the normalized Reader Contract model used to render the HTML.

The run report uses a shared Reader Contract renderer. Suites can keep domain-specific runner output, but they should adapt that output into reader fields instead of adding suite-specific full HTML renderers.

`eval:run` only calls an agent when `--repair=auto` is passed or a scheduler item uses `action: repair`. The default agent is Codex.

## Report Reader Contract

The canonical contract lives in `evals/report-contract.md`. Every runnable suite should make its report answer the same user questions:

- What did this run prove?
- What did this run not prove?
- Which cases passed, failed, or need attention?
- For each case, what was the input, expected behavior, actual output, proof basis, conclusion, and next step?
- If a case needs real product inspection, what manual experience steps should a reviewer run?
- Where can a reviewer inspect complete debug artifacts?

Runner results should include `caseTitle`, `sampleSummary` or redacted `sampleDetails`, `expectedBehavior`, a structured `actualOutput` or `topMatch`, `scores`, `userConclusion`, and `improvementSuggestions`. Cases can also include optional `manualVerification` with reviewer setup, steps, expected results, cleanup, and evidence notes; the shared report renders it when present and does not count it as automated scoring. If a suite needs domain-specific interpretation, add an adapter that maps its output to `caseGoal`, `inputSummary`, `expectedSummary`, `actualSummary`, `proofChecks`, `outcomeSignals`, `conclusion`, `nextSteps`, `manualVerification`, and `debugLinks`.

New runnable suites should also declare `readerProof.claims` and `readerProof.boundaries` in `registry.yaml`. Each claim maps a reader-facing requirement statement to one or more `caseIds` and optional `requiredScores`; the report marks it proved only when all mapped evidence ran and met the declared thresholds. Report-format health is shown separately as “报告契约” and never appears as feature proof. Legacy suites use case conclusions as a labeled fallback until they adopt the explicit contract.

Run `npm run eval:validate` after adding a suite or case. The validator checks that each suite has a Chinese description, workflow, cases file, and `Report requirements` section, and that cases include enough input/expected-output fields to produce a readable report. `npm run eval:run` also records report-contract warnings when a case cannot be normalized into a readable Reader Contract card.

For Compose Assist context-pack cases, the adapter must summarize the evaluated chat/composer sample, draft text, source types, generated compose text, returned evidence, verdict, and improvement suggestions. Full debug summary belongs in artifacts unless it is needed to explain a reader-facing proof check. Live Web AI sampling uses `webpage-mcp` through `mcporter` when `--live` is passed; if no matching tab is available, the runner records the live failure and falls back to the case snapshot.

## Configuration

- `registry.yaml` lists suites, Chinese descriptions, case paths, schedule mode, judge mode, and repair policy.
- `registry.yaml` also stores suite-level `readerProof` claims, case/score evidence mappings, and honest validation boundaries.
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
