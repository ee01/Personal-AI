# Task Plan: Coverage Smart Import Submit Boundary

## Goal
Improve the Memory Coverage Map `智能资料录入` path so the exact dry-run / commit consequence is visible at the primary control point and during ordinary smart-import submission.

## Current Phase
Phase 3

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, and `docs/features/index.md`
- [x] Pick a non-fresh random feature: `智能资料录入`
- [x] Check local Reminders `Personal AI` through EventKit
- [x] Inspect Coverage docs, UI, smart-import service, and existing E2E
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define one bounded UX fix: primary action boundary and ordinary commit-pending receipt
- [x] Keep backend behavior unchanged; update docs and E2E only for presentation/accessibility proof
- **Status:** complete

### Phase 3: Implementation
- [x] Add smart-import pending receipt for non-external-AI ordinary imports
- [x] Add `title` and `aria-label` boundary copy to the drawer primary action button
- [x] Update Coverage E2E assertions
- [x] Update `docs/features/memory_coverage_map.md` and `docs/features/index.md`
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted memory-service smart import / coverage tests
- [x] Run `npm --prefix memory-service run build`
- [x] Run `npm start` until first successful compile, then stop it
- [x] Run `npm run verify:memory-coverage:e2e`
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with selected feature, Reminder state, research, implementation, verification, and current run time
- [x] Summarize changed files and validation evidence
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `智能资料录入` under Memory Coverage Map | Random reroll avoided very fresh Memory Lens selection-search work. |
| Keep the fix presentation/accessibility-only | Existing backend already enforces dry-run, duplicate protection, and high-risk confirmation; the UX gap is control-point clarity. |
| Add ordinary submit-pending receipt | External AI imports already have a rich pending receipt; ordinary paste/document/zip commits currently only show one terse status line while waiting. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial random pick hit recent Memory Lens selection search | Rerolled with recent automation memory and `.planning` traces considered. |
