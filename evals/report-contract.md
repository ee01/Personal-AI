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
