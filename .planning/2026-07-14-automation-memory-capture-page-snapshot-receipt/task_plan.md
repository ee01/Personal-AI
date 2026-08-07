# Task Plan: Memory Capture whole-page snapshot receipts

## Goal
Improve the whole-page Memory Capture UX so suggestion, review, auto-save pending, success, and failure states show which page snapshot and trigger basis they apply to.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`
- [x] Confirm `docs/progressing/to-verify.md` is empty
- [x] Read automation memory and avoid recent targets
- [x] Check local `Personal AI` Reminders
- [x] Select a bounded feature from `docs/index.md`
- **Status:** complete

### Phase 2: Research & Plan
- [x] Scan current docs and code for whole-page Memory Capture
- [x] Search comparable products and papers
- [x] Define the smallest constructive improvement
- **Status:** complete

### Phase 3: Implementation
- [x] Add page snapshot / trigger-basis copy at the real control points
- [x] Update targeted verifier and docs
- **Status:** complete

### Phase 4: Verification
- [x] Run static verifier/checks
- [x] Run `npm start` until first successful compile
- [x] Run whole-page Memory Capture E2E
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory
- [x] Report outcome and any blocked validation
- **Status:** complete

## Key Questions
1. Does the user see whether a whole-page save is based on the current page snapshot, not an implicit live page that may change?
2. Does the user see why an automatic save is running before it is confirmed?
3. Can the change stay presentation-first without changing capture thresholds or backend writes?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `整页资料保存` under Memory Capture | Random eligible candidate after recent-target filtering; docs and code show a narrow UX gap still exists around snapshot basis. |
| Keep the change presentation/accessibility-only | Existing backend gates and write receipts are strong; the missing piece is first-screen clarity at the page-save control point. |
| Do not incorporate Reminders | EventKit found `Personal AI` with 4 total items and 0 incomplete items; none are related to Memory Capture. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `timeout` command missing | 1 | Used `/usr/bin/perl -e 'alarm ...'` wrapper for EventKit Reminder read. |
| `npm start` ESLint `no-extra-boolean-cast` | 1 | Removed redundant `Boolean(...)` in the new trigger helper and reran compile successfully. |
| E2E save button outside viewport | 1 | Added max-height and internal scroll to Memory Capture note panels, then reran E2E successfully. |

## Notes
- Worktree is broadly dirty from prior automation runs; touch only the Memory Capture source/doc/verifier and this planning directory.
