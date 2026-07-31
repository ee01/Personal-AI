# Action Readiness Contracts Implementation

Goal: implement the approved `执行就绪契约` capability end to end on the repository's existing action execution paths, with user-visible readiness receipts, fail-closed dispatch behavior, focused tests/evals, and durable feature documentation.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read repository rules, approved capability plan, current action architecture, and overlapping dirty changes |
| 2 | complete | Define the smallest shared readiness contract and map it onto existing service/API/UI boundaries |
| 3 | complete | Implement backend readiness evaluation, persistence/API integration, and dispatch enforcement |
| 4 | complete | Implement the Action Queue readiness UI and remediation/recheck interactions |
| 5 | complete | Add focused tests, E2E/evals, and run the repository's required build/verifiers |
| 6 | complete | Update canonical feature docs and close out implementation evidence |

## Decisions

- Treat `docs/progressing/action-readiness-contracts-plan.md` as the approved product plan, but keep implementation sympathetic to the repository's current architecture.
- Preserve all pre-existing dirty changes; only edit overlapping files after reading their current contents and diffs.
- Use an isolated planning directory and `PLAN_ID=2026-07-15-action-readiness-contracts-implementation`; do not modify `.planning/.active_plan`, which belongs to another active task.
- Prefer a vertical slice through an existing high-volume action type (`delegate_openclaw`) plus a generic contract shape that other actions can adopt.
- Preserve first-run compatibility: an unknown contract can use the original action as its first proof; persisted blocked contracts fail closed, and expired automatic contracts probe first.
- Recheck uses a dedicated probe-only delegation request. It must never submit the original task and must state that no original external action was executed.
- A linked blocked contract suppresses due-action selection and Reflection persistence until a successful probe changes the contract status.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial Action Queue CSS patch missed the existing `.queue-guidance.danger` body | 1 | Re-read the exact style anchors and split the style change into smaller scoped patches |
| Action Queue E2E scope assertion matched both the readiness panel and operation receipt after probe | 1 | Narrowed the assertion to `.action-readiness-panel` before rerunning |
| Planning update patch contained an invalid multi-file hunk | 1 | Re-read the planning files and applied smaller valid patches |
| Eval validator rejected cases without framework-level input context | 1 | Added redacted `sampleContext.sourceProvenance` to every real-scenario case |
| First eval run passed 4 cases but the Reflection subprocess closed SQLite before a fire-and-forget markdown reindex completed | 1 | Stubbed `MarkdownManager.reindexFile` only inside the readiness eval fixture; the product Reflection path still ran and the rerun passed all 5 cases |
| First dispatch-history receipt patch used an outdated exact context | 1 | Re-read the current service lines and applied the receipt/model/UI changes in smaller hunks |
