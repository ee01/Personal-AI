# Task Plan: Memory Lens Site-Control Button Boundaries

## Goal
Make Memory Lens Options site-control actions explain their passive-only scope and non-effects at the exact controls before the user clicks.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, feature index, and Memory Lens docs.
- [x] Confirm `docs/progressing/to-verify.md` has no carry-over item.
- [x] Check local Reminders via AppleScript and EventKit.
- [x] Inspect relevant source and verifier files.
- **Status:** complete

### Phase 2: Planning & Research
- [x] Scan comparable products and research for browser/page-context controls.
- [x] Select one bounded UX improvement that needs no user decision.
- [x] Record the implementation plan before editing.
- **Status:** complete

### Phase 3: Implementation
- [x] Add reusable Options site-control boundary text for refresh, allowlist, allow/remove, mute restore, site block, and page block controls.
- [x] Wire the boundary text to `title` and `aria-label` on the actual controls.
- [x] Update static/E2E checks and concise docs.
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run focused static verifier.
- [x] Run `npm start` until first successful compile, then stop it.
- [x] Run Memory Lens E2E.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with selected feature, Reminder state, changes, and verification.
- [x] Summarize outcome and limitations.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected `站点静默/屏蔽/白名单` under Memory Lens | Random sample produced this viable target and recent automation memory did not cover the same exact Options button-level gap in the latest runs. |
| Keep the change presentation/accessibility-only | Existing storage, real-time sync, conflict cleanup, and E2E behavior already exist; the remaining risk is users misreading the exact Options controls. |
| Put boundaries on `title` and `aria-label` | Matches recent repo pattern for trust-sensitive control-point clarity and avoids adding another visual block. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| AppleScript did not list `Personal AI` Reminders | Used EventKit fallback; it found the list with 4 total items and 0 incomplete items. |
| First E2E run timed out looking for exact short `恢复` button names | Updated affected Options selectors to assert the new boundary-based accessible names. |
