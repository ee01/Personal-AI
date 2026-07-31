# 2026-07-15 Automation: Memory Scope Control Boundaries

## Goal

Improve the shipped `工作/个人/全部范围语义` feature from `docs/features/index.md` by checking current docs/code, incorporating Reminder state, researching comparable products/papers, then implementing one low-risk user-facing improvement with focused verification.

## Selected Feature

- Feature: `工作/个人/全部范围语义`
- Ability: Memory Service
- Source doc: `docs/features/memory_system.md`
- Selection: randomized from `docs/features/index.md` after avoiding the freshest exact/family automation targets where practical.

## Plan

1. [complete] Read repo instructions, current feature index, `docs/progressing/to-verify.md`, automation memory, long-term memory, and Reminders.
2. [complete] Inspect current docs/code/verifiers for Memory Service scope semantics.
3. [complete] Research comparable product and research guidance for memory/search scope boundaries.
4. [complete] Implement a small presentation/accessibility improvement for scope controls.
5. [complete] Update canonical docs and index wording without over-detailing.
6. [complete] Run targeted verifier, dev extension compile, E2E, and scoped whitespace checks.
7. [complete] Update automation memory and close out Reminder state.

## Implementation Target

Add dynamic `title` / `aria-label` copy to the Memory Exploring scope segmented buttons. The copy should say:

- which domain the button will read
- whether clicking it reruns the active query immediately or only stages the next search scope
- which domain is excluded, or whether personal evidence may enter results
- old visible results are not current evidence while rerun is in flight
- the click does not write, delete, sync external sources, write feedback, confirm answers, or send data externally

## Non-Goals

- No change to `RecallEngine`, `/recall`, `/ask`, ranking, default `work` behavior, `all`/`both` backend normalization, feedback writes, Memory Service deployment, or real data mutation.
- No Reminder completion, because EventKit found the `Personal AI` list but it has 0 incomplete items.

## Validation Plan

- `node --check tools/verify-memory-search-scope-e2e.mjs`
- `npm run verify:memory-search-results`
- `npm start -- --progress`, stop after first successful compile
- `npm run verify:memory-search-scope:e2e`
- scoped `git diff --check` for touched files

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript Reminders list did not include `Personal AI` | Reminder probe | Used EventKit; list exists with 0 incomplete items |
| `verify:memory-search-scope:e2e` strict locator matched all scope buttons after long ARIA labels | First E2E run | Updated the verifier to locate scope buttons by exact visible text while still asserting long title/ARIA copy |
