# Task Plan: Message Reaction Auto Reply Boundary

## Goal
Improve the Message Reaction Auto Reply setup UX so users can see before saving what scope will match, what queue row will be created, and what will not be sent yet.

## Current Phase
Phase 3

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints
- [x] Document in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define approach
- [x] Keep scope to Message Reaction Auto Reply docs, presentation helper, config UI, and tests
- **Status:** complete

### Phase 3: Implementation
- [x] Add Auto Reply rule-scope/queue boundary receipt helper
- [x] Render receipt in new/edit auto reply config panels
- [x] Update docs/features/message_reaction.md and docs/features/index.md
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted Message Reaction tests
- [x] Run dev webpack compile via npm start and stop watcher
- [x] Run Message Reaction toolbar E2E
- [x] Run topic-modal Auto Reply receipt E2E
- [x] Run scoped git diff --check
- [x] Document test results
- **Status:** complete

### Phase 5: Delivery
- [ ] Update automation memory
- [ ] Archive current Codex session
- [ ] Deliver to user
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `自动答复 / Reply` from `docs/features/index.md` | Randomly sampled from index after excluding recently touched automation feature families. |
| Add an in-form rule boundary receipt | The risk is user misunderstanding before saving: save rule vs send now vs future queue row vs review path. |
| Keep change client-side/presentation-only | Existing backend queue and PendingReview behavior already has coverage; the UX gap is visible explanation. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `Personal AI` Reminders list absent | Recorded absence and skipped Reminder item matching/completion. |
| Initial topic-modal E2E assertion timed out after clicking edit | The product code was present; fixed the test to stop filtering by card text after edit mode moves text into input values. |
