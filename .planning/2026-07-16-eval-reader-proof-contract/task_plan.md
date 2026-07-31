# Eval Reader Proof Contract

## Goal

Make future eval reports explain which requirement-specific E2E behaviors the executed cases actually proved, while keeping report-format integrity separate and stating untested boundaries honestly.

## Phases

- [completed] Inspect the current report renderer, registry schema, validator, and continuity suite.
- [completed] Define and implement a reusable suite-level reader proof contract with result-based resolution and a useful legacy fallback.
- [completed] Add requirement-specific proof metadata to the Ask conversation continuity suite and update eval documentation.
- [completed] Add focused architecture tests and run registry validation.
- [completed] Regenerate a continuity report, inspect the rendered proof section, and record final evidence.

## Constraints

- Preserve unrelated dirty-worktree changes.
- Do not claim a capability was proved unless its mapped cases/checks ran and passed.
- Keep generic report contract checks out of the requirement-proof block.

## Decisions

- Add `suite.readerProof.claims[]` with `id`, `statement`, `caseIds`, and optional `requiredScores`.
- A claim is proved only when every mapped case ran, passed, and met every declared score threshold.
- Store structured evidence in `reader-report.json`; render case names and score checks under each claim.
- Keep `readerProof.boundaries[]` for honest scope limitations.
- Suites without the new metadata fall back to executed case conclusions, never sample-count/report-format boilerplate.
- Add an offline `--rerender <run-dir>` path so existing run artifacts can verify report architecture without re-hitting a live service.

## Errors

| Error | Attempt | Resolution |
| --- | --- | --- |
| Combined test/package patch did not match the current `eval:scheduler` line | 1 | Confirmed the test file was not created, found the exact current package context, and split/retried the patch. |
| In-app browser rejected reloading the local `file://` report under its URL policy | 1 | Stopped browser attempts and used an offline report-generation integration test plus generated HTML/JSON assertions instead. |
