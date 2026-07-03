# Scheduled Queue Suggestion Reason Plan

## Goal
Improve Scheduled Messages queue visualization / reschedule suggestions by making the recommendation reason visible before click and preserved in the success receipt, then update docs and verify the flow end to end.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, and old root planning files
- [x] Check local Reminders list names
- [x] Randomly select target feature and inspect source/doc anchors
- [x] Document discovery in `findings.md`
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Define low-decision improvement slice
- [x] Choose verification path
- **Status:** completed

### Phase 3: Implementation
- [x] Add reason text to queue suggestion data contract
- [x] Surface the reason in queue cards, button title, and reschedule success receipt
- [x] Update queue helper/E2E coverage and canonical feature doc
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run targeted queue helper test
- [x] Run `npm start` until first successful compile and stop watch
- [x] Run scheduled queue suggestion E2E
- [x] Run scoped `git diff --check`
- **Status:** completed

### Phase 5: Delivery
- [ ] Update automation memory with run summary and current time
- [ ] Attempt thread archive
- [ ] Deliver concise final summary
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `队列可视化与改期建议` in `docs/features/scheduled_messages_manager.md` | Randomly selected from candidates that avoid the most recent exact automation-memory feature families where practical |
| No Reminder item incorporated | Local Reminders is readable but has no visible list named `Personal AI` |
| Implementation slice: carry a queue recommendation reason through the shared suggestion object | Current UI shows target/time/boundary, but the "why this recommendation" is only inferable from surrounding queue metrics and is not preserved after click |
| Verification path: helper test + dev compile + `verify:scheduled-messages-queue-suggestion:e2e` | The change touches deterministic queue logic plus user-visible scheduled-messages UI |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `web.open` failed for search result ids | Opened source URLs directly instead |
| Plain `node` was not on PATH | Reran commands with `export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` |
| Queue E2E broad text locator matched both old queue text and new reason text | Tightened assertions to exact or full-line text |
