# Eval Report Reader Contract

Every runnable eval report must render through the shared Reader Contract model before HTML is generated. The first screen must answer:

1. What did this run prove?
2. What did this run not prove?
3. Which cases passed, failed, or need attention?
4. For each case, what was the input, expected behavior, actual output, proof basis, conclusion, and next step?
5. If the case has a manual product check, how should a reviewer run it?
6. Where can a reviewer inspect complete debug artifacts?

## Reader Report Model

`tools/eval-run.mjs` normalizes suite-specific runner output into `reader-report.json` and renders `report.html` from that model.

Top-level summary fields:

- `summary.title`
- `summary.headline`
- `summary.readerProof.source`
- `summary.readerProof.claims[]`
- `summary.readerProof.boundaries[]`
- `summary.proved[]`
- `summary.notProved[]`
- `summary.keyStats[]`
- `summary.nextSteps[]`

Per-case fields:

- `cases[].kindLabel`
- `cases[].caseGoal`
- `cases[].inputSummary`
- `cases[].expectedSummary`
- `cases[].actualSummary`
- `cases[].proofChecks[]`
- `cases[].outcomeSignals[]`
- `cases[].conclusion`
- `cases[].nextSteps[]`
- `cases[].manualVerification` when the case declares manual review steps
- `cases[].debugLinks[]`

Artifacts:

- `case-results.json`
- `reader-report.json`
- `requests.jsonl`
- `responses.jsonl`
- `judge-results.jsonl`

## Requirement Proof Contract

The “这份 report 到底证明了什么” section is a requirement-proof surface, not a report-format health summary. A suite should declare `readerProof` in `evals/registry.yaml`:

```yaml
readerProof:
  claims:
    - id: clean-new-question
      statement: 新问题不会继承上一轮话题。
      caseIds:
        - new-question-isolation
      requiredScores:
        context_isolation: 3
  boundaries:
    - 本报告不验证客户端本地存储交互。
```

Each claim resolves from the current run only:

- Every mapped `caseId` must have run and have a successful status: `pass`, or `hide_expected` for a correctly suppressed negative case.
- Every optional `requiredScores` threshold must be present and satisfied by every mapped case.
- Missing, failed, warned, skipped, or below-threshold evidence moves the claim to `not_proved` with a concrete reason.
- The HTML lists the mapped case title, case id, status, actual score, and threshold under each claim.
- `boundaries` states the adjacent UI, data, environment, or distribution claims this report did not test.

Suites without `readerProof` remain renderable for backward compatibility, but the runner derives top-level claims from the executed case conclusions and labels the result as a case-level fallback. It must never fall back to sample counts or Reader Contract completeness in the requirement-proof section.

Report readability stays separate in `summary.reportContract` and the “报告契约” metric. It cannot make a product requirement claim pass.

## Runner Responsibilities

Runner output can stay domain-specific, but it must be mappable into the Reader Contract. Prefer structured fields such as:

- `caseTitle`
- `sampleSummary` or redacted `sampleDetails`
- `expectedBehavior`, `expectedTopics`, or suite-specific expected objects
- `actualOutput`, `topMatch`, `error`, or `reason`
- `scores`
- `userConclusion`
- `improvementSuggestions`
- optional `manualVerification` with `summary`, `prerequisites`, `steps`, `expected`, `cleanup`, and `evidence`

If a suite needs domain-specific interpretation, add an adapter that compresses that domain object into reader fields. Do not add a suite-specific full HTML renderer.

Raw request, response, judge traces, and debug payloads belong in artifact files. The main report should summarize the evidence and link to artifacts instead of dumping raw debug by default.
Manual verification is not an automated score. Use it only when the automated eval proves backend or adapter behavior but a reviewer still needs to inspect real UI affordances such as browser icons, hover copy, insertion behavior, permission prompts, or external-app boundaries.

## Contract Check

`npm run eval:validate` checks suite metadata and workflow coverage. `npm run eval:run` checks every executed case for renderable Reader Contract fields:

- `caseGoal`
- `inputSummary`
- `expectedSummary`
- `actualSummary`
- `proofChecks`
- `conclusion`
- `nextSteps`

Contract warnings are report readability warnings, not direct business-quality scores. A case can pass its suite but still need report-contract cleanup if a reviewer cannot understand what was proved.

Existing artifacts can be re-rendered without rerunning a live endpoint. The renderer uses the proof contract recorded with the run, and falls back to the current registry only for older artifacts that have no contract snapshot:

```bash
npm run eval:run -- --rerender .eval-runs/<runId>
```
