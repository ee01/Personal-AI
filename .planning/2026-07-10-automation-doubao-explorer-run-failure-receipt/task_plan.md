# Task Plan: Doubao Explorer Run Failure Receipt

## Goal
Improve the Doubao / ChatGPT explorer input path so a failed manual fetch preserves the same source/scope/transport boundary that was shown before the request.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, feature index, automation memory, and `docs/progressing/to-verify.md`.
- [x] Randomly select a feature outside the freshest automation targets.
- [x] Check `Personal AI` Reminders through AppleScript and EventKit.
- **Status:** complete

### Phase 2: Research And UX Gap
- [x] Inspect `docs/features/doubao_bridge.md`, `desktop-app/app/renderer.js`, and the existing explorer E2E.
- [x] Scan comparable products and papers for source/memory portability and audit boundaries.
- [x] Choose one bounded improvement.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a shared failure formatter for explorer manual fetch errors.
- [x] Use it from Doubao and ChatGPT manual fetch handlers.
- [x] Extend the existing E2E to cover request context after a failed fetch.
- [x] Update canonical feature docs and index wording.
- **Status:** complete

### Phase 4: Verification
- [x] Run syntax checks for changed JS/MJS files.
- [x] Run the Desktop App explorer E2E.
- [x] Run `npm start` until first successful compile, then stop it.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory with exact scope and validation evidence.
- [x] Report Reminder handling and any residual risk.
- **Status:** complete

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Keep the change presentation-only | The gap is loss of user-facing request context on failure, not fetch pipeline behavior. |
| Reuse `formatExplorerRunRequestReceipt` | It already contains the correct source, scope, lookback, max conversation, transport, cache/cursor, and no-write boundary. |
| Use the existing `doubao-source-toggle-gating-check.mjs` harness | It already drives the real Desktop App explorer source cards and pending run state. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| AppleScript did not list `Personal AI` Reminders | 1 | Used EventKit fallback, which found the list and confirmed no open items. |

## Notes
- Worktree had broad unrelated dirty state before this run; only files in this plan should be treated as owned by this run.
- `docs/features/doubao_bridge.md` still contains intentional/pre-existing Markdown hard-break trailing spaces on lines 48 and 215; scoped `git diff --check` passed and this run did not touch those lines.
