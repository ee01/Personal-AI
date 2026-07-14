# Task Plan: New Capability Automation 2026-07-13

## Goal
Create one non-duplicative Personal AI new-capability plan under `docs/progressing`, with an optional Chinese demo HTML, grounded in Reminder state, live memory-service signals, repo de-duplication, and current product/research references.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, existing progressing docs, feature index, and prior planning files
- [x] Confirm `docs/progressing/to-verify.md` is empty
- [x] Inspect local Reminders `Personal AI`
- [x] Query live `10.32.56.212` memory-service data for `esone.qiu`
- [x] Document discovery in `findings.md`
- **Status:** completed

### Phase 2: Idea Selection & Research
- [x] Select a non-duplicate capability idea
- [x] Gather current product/research references with links
- [x] Compare with adjacent `docs/progressing` and canonical features
- **Status:** completed

### Phase 3: Artifact Drafting
- [x] Create `docs/progressing/<slug>-plan.md`
- [x] Create `docs/progressing/<slug>-demo.html` if the interaction benefits from a preview
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run scoped whitespace checks
- [x] Check required plan sections with `rg`
- [x] Parse demo JavaScript where applicable
- [x] Run browser/Playwright preview if practical
- **Status:** completed

### Phase 5: Delivery
- [x] Update automation memory
- [x] Mark Reminder done and annotate if the idea came from Reminder
- [x] Deliver title, paths, rationale, and validation summary
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Docs-first only | User asked for a plan/demo for decision, not implementation |
| Use EventKit for Reminders | Prior runs showed AppleScript can miss the `Personal AI` list |
| No Reminder idea selected | EventKit found the `Personal AI` list with 0 incomplete items |
| Selected `Desktop Selection Memory Capsule` | It is explicit, selection-driven, cross-desktop recall and does not duplicate browser Memory Lens, Quick Ask, Prompt Context Compiler, AI Context Passport, or shelved implicit return-stack ideas |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| First Playwright run clicked a hidden duplicate copy button | Re-ran with panel-scoped selectors and desktop/mobile checks passed |
