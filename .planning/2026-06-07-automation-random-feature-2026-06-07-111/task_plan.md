# Storyline Draft Evidence Grounding Plan

## Goal
Improve Memory Storyline Builder so Storyline drafts distinguish cited evidence from merely returned evidence, and fall back when model segments underuse the available source material.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read automation memory, `AGENT.md`, `docs/index.md`, and `docs/progressing/to-verify.md`
- [x] Randomly select a non-recent feature from the feature index
- [x] Check local Reminders list names before item-level Reminder work
- [x] Inspect current Storyline docs, route, service, page, tests, E2E, and existing diffs
- **Status:** completed

### Phase 2: Planning & Research
- [x] Review adjacent products and papers for source-grounded generation patterns
- [x] Decide the bounded no-extra-user-decision improvement
- [x] Record findings and plan before code edits
- **Status:** completed

### Phase 3: Implementation
- [x] Make Storyline Draft service fall back when accepted model segments cite too little distinct evidence
- [x] Make Storyline Draft page count/group cited refs separately from returned evidence details
- [x] Preserve existing unsupported-source and manual-copy boundaries
- **Status:** completed

### Phase 4: Docs & Tests
- [x] Extend API tests for low-distinct-evidence model output
- [x] Extend Storyline Draft page E2E for cited-vs-returned evidence copy
- [x] Update `docs/features/memory_storyline_builder.md`
- **Status:** completed

### Phase 5: Verification & Delivery
- [x] Run Storyline API tests
- [x] Run `npm start` until first successful compile, then stop
- [x] Run Storyline Draft page E2E
- [x] Run scoped and full `git diff --check`
- [x] Update automation memory and summarize outcome
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected `Storyline Draft API` / Memory Storyline Builder | Random sample picked it first after excluding recent automation targets |
| Do not add an external writeback destination | Current product boundary is manual review and copy only |
| Improve grounding receipts instead of adding a review queue | The gap is source clarity at generation/copy time, not a need for another management surface |
| Count cited refs separately from returned evidence details | Users need to know what the generated draft actually used |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial Perl random-selection one-liner had a quoting error | Re-ran selection with a simpler Ruby sampler |
| Local Reminders has no `Personal AI` list | Record absence and do not fabricate Reminder completion |
