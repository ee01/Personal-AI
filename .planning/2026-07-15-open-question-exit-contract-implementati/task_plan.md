# Task Plan: Open Question Exit Contract Implementation

## Goal
Implement the open-question lifecycle contract end to end so duplicate reflection/action work is suppressed and high-value evidence-driven resumptions can enter Today Pilot without adding a new page or default Quick Ask UI.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm the revised product boundary from user feedback
- [x] Inspect current reflection, action, confirm-request, Evidence Watch, Today Pilot, persistence, and test paths
- [x] Identify overlapping dirty-worktree changes and preserve them
- [x] Document discoveries in findings.md
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Define the smallest complete backend contract and persistence shape
- [x] Define Today Pilot eligibility and receipt mapping
- [x] Define focused unit, integration, E2E, and eval coverage
- **Status:** completed

### Phase 3: Implementation
- [x] Add persistence/service lifecycle decisions, duplicate suppression, and resume handling
- [x] Integrate the contract at the reflection/action generation boundary
- [x] Feed only resumed, today-relevant items into Today Pilot
- [x] Add small explainability receipts on existing detail/action surfaces only where supported
- [x] Keep Quick Ask free of default aggregate/status UI
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run focused service and Today Pilot tests
- [x] Run repository-native verifiers/E2E for every touched surface
- [x] Run the new eval suite/report if the implementation crosses LLM/ranking behavior
- [x] Run build/compile and scoped whitespace checks
- [x] Document all results and residual risks
- **Status:** completed (full-suite residual failures are isolated to unrelated concurrent Storyline/Meeting Prep work)

### Phase 5: Delivery
- [x] Update canonical feature docs with final behavior and trust boundaries
- [x] Retire the progressing plan and move the Today Pilot demo to `docs/demo/`
- [x] Review the final diff without touching unrelated changes
- [x] Deliver implementation and verification summary
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| No independent UI or governance queue | The capability is primarily a lifecycle/suppression contract and should not create review work. |
| Today Pilot is the only proactive consumer | It already owns daily attention filtering and concrete missions. |
| Quick Ask gets no default status aggregate | Quick Ask is intent-driven; retired/waiting counts are internal governance noise. |
| Parked/closed records remain auditable | Retirement changes future eligibility but must not delete evidence or history. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Memory Service build initially failed in concurrent `ContextAssistService.ts` work | Kept that code untouched; a later clean retry passed. |
| Full Memory Service run initially had 32 unrelated failures | Retried after concurrent changes settled; final aggregate is 104/106 files and 823/827 tests, with four residual Storyline/Meeting Prep failures outside this feature. |
