# Popup Top 3 Control Boundaries Plan

Goal: improve `Popup Top 3` under Today Pilot by keeping docs current, using current product/research references, checking local `Personal AI` Reminders, and implementing one bounded UX/code fix with repo-native verification.

## Feature Selection

- Selected feature: `Popup Top 3` from `docs/index.md` -> `docs/features/today_pilot.md`.
- Randomization note: the first randomized candidates included recent Agent Workflow, Topic, Doubao, Coverage, Ask, Rehearsal, Reflection, and Scheduled/Project families. `Popup Top 3` is a valid less-recent target with a clear popup/E2E verification path.
- Carry-over check: `docs/progressing/to-verify.md` says `暂无`.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items, so no Reminder item applies or should be completed.

## Plan

| Step | Status | Notes |
|---|---|---|
| 1 | completed | Recorded plan, research, Reminder result, and selected gap |
| 2 | completed | Added dynamic `title` / `aria-label` boundaries to Popup Top 3 card controls |
| 3 | completed | Updated Today Pilot docs and `docs/index.md` with concise current behavior |
| 4 | completed | Static verifier, `npm start` first compile, Today Pilot E2E, and scoped `git diff --check` passed |

## Intended Scope

- In scope: popup card main button, `查看全部`, `完成`, `稍后`, normal `复制`, external execution review, and meeting Video Home button hover/read-screen boundaries.
- Out of scope: Today Pilot ranking, `/today-pilot/today`, feedback API semantics, context-pack rendering, meeting prep, home page mission cards, source stats math, Memory Service writes, external execution behavior, and Reminder state.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| AppleScript did not list `Personal AI` | Reminder scan | Used EventKit fallback; found 0 incomplete items |
| Initial popup E2E locator timed out after ARIA expansion | `getByRole(name: "查看全部 4")` no longer matched because `aria-label` intentionally became the full boundary | Updated popup E2E locators to use visible button text/CSS while still asserting the expanded ARIA boundary |
