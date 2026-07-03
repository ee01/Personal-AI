# Jira Design Links Issue-Key Parsing Improvement Plan

Goal: improve the randomly selected `Jira issue key 解析` feature by checking the current docs and implementation, incorporating relevant product/paper references and local Reminder feedback when available, then implementing a focused low-decision UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, carry-over notes, `AGENT.md`, feature index, existing planning files, worktree state, and local Reminder list state |
| 2 | completed | Inspect Jira Design Links docs, issue-key parsing code, UX rendering, tests, and current dirty scope |
| 3 | completed | Research comparable product behavior and relevant papers for issue-link traceability and artifact extraction |
| 4 | completed | Decide the smallest constructive improvement and write the plan before code edits |
| 5 | completed | Implement scoped code/docs/test updates while preserving unrelated dirty worktree changes |
| 6 | completed | Run targeted verification, dev compile, E2E/browser proof where practical, and diff checks |
| 7 | completed | Update automation memory and summarize Reminder/archive outcome |

## Decisions

- Selected feature: `Jira issue key 解析`.
- Capability/doc: Jira Design Links, `docs/features/jira_design_links.md`.
- Local Reminders app is reachable, but no visible `Personal AI` list exists, so no Reminder item can be incorporated or marked done unless another source appears.
- Existing worktree is broadly dirty from prior runs. Keep this run scoped to Jira Design Links plus this isolated planning directory and automation memory.
- Implementation slice: linked-issue anchors that expose the target only through known Jira query params such as `selectedIssue=UX-123` should be parsed, and non-standard key recovery should show a compact receipt so users know why a Missing link row appeared.

## Implementation Plan

1. Extend the shared Jira issue URL parser to read known Jira issue-key query parameters after the path-based parser.
2. Carry linked-issue key source metadata from DOM extraction into UX design rows.
3. Show a small key-source receipt only for non-standard sources such as URL query, `data-issue-key`, `aria-label`, or raw text.
4. Add unit and extension E2E assertions for board/query URL fallback and the visible receipt.
5. Update `docs/features/jira_design_links.md` with the query-param fallback and key-source receipt behavior.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark any Reminder items done |
| `URLSearchParams.entries()` did not iterate under the ts-node verifier transpilation path | First `npm run verify:jira-design-links` after adding query-param parsing | Switched the parser helper to `URLSearchParams.forEach`, matching nearby code patterns |
