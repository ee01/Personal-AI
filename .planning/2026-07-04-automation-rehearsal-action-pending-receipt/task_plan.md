# Rehearsal Action Pending Receipt Plan

Goal: improve the selected `Rehearsal 管理页` feature by checking docs/code against the current behavior, incorporating related product and paper research, and implementing one bounded UX fix with end-to-end verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, feature index, and current worktree state |
| 2 | completed | Randomly sample feature candidates and select `Rehearsal 管理页` while avoiding very recent exact targets |
| 3 | completed | Inspect Rehearsal docs, management page source, existing E2E, and Reminder state |
| 4 | completed | Search current product and paper references for context-aware/prospective reminders and task management |
| 5 | completed | Implement the selected pending-action receipt UX and update docs/E2E |
| 6 | completed | Run targeted Rehearsal E2E, first successful `npm start` compile, and scoped `git diff --check` |
| 7 | completed | Update automation memory and summarize Reminder status, sources, changed files, and validation |

## Plan

1. Keep runtime scope inside `src/modals/components/RehearsalsPage.vue`, `tools/verify-rehearsals-page-e2e.mjs`, and `docs/features/rehearsal.md`.
2. Add a `处理请求回执` immediately when pause/restore/reactivate/used/irrelevant/archive starts. It must say the write is only requested, current truth remains the previous status, buttons are temporarily disabled to prevent duplicate writes, and no external action/script execution has happened.
3. Preserve existing success and failure receipts by replacing the pending receipt after Memory Service returns.
4. Extend the existing Playwright E2E by delaying the pause request and asserting the pending receipt before the existing failure receipt.
5. Update docs to mention the in-flight boundary and verification expectation.

## Decisions

- Selected feature: `Rehearsal 管理页` from `docs/index.md`.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found it with 4 items, all completed and unrelated to Rehearsal.
- External scan supports visible cue/action binding, centralized management, pause/delete/recover paths, and explicit limits before treating an action as done.
- Implementation stays presentation-first; no Rehearsal API, activation, recall, feedback semantics, or memory-service write path changes.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript did not show `Personal AI` Reminders list | Reminder list probe | EventKit fallback confirmed the list and showed all 4 items completed/unrelated |
| `rg` output for Rehearsal was too large and truncated | Broad source search | Switched to direct reads of `RehearsalsPage.vue`, E2E, and doc verification sections |
