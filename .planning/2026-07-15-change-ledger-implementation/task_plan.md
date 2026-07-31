# Task Plan: Change Ledger / 变化脉络 Implementation

## Goal
Implement a domain-neutral state-change memory layer that extracts, stores, projects, and surfaces evidence-backed changes in Memory Lens, Source Memory, Ask, and Compose Assist, with deterministic tests, an experience eval suite, and canonical feature documentation.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm the product boundary: generic state changes, not estimate-only and not every raw edit
- [x] Map storage, Source Memory, context recall, Ask, Compose, UI, and eval extension points
- [x] Identify overlapping dirty-worktree files before edits
- [x] Document findings in findings.md
- **Status:** completed

### Phase 2: Contracts & Architecture
- [x] Define typed change values, structured diffs, authority, evidence, and projection contracts
- [x] Define migration, service, API, and client boundaries
- [x] Select deterministic extraction coverage and conservative fallback behavior
- **Status:** completed

### Phase 3: Memory Service Implementation
- [x] Add persistent change events/chains and migrations
- [x] Implement deterministic extraction, chain projection, noise filtering, and source-memory ingestion hooks
- [x] Expose read APIs and integrate context-recall / Ask evidence without confirming unverified current truth
- **Status:** completed

### Phase 4: Extension UI & Client Integration
- [x] Add client contracts and render compact "变化脉络" receipts in Memory Lens
- [x] Add Source Memory change-event/history section
- [x] Add Compose/Ask consumption boundaries without automatic send or external writeback
- **Status:** completed

### Phase 5: Evals & Automated Verification
- [x] Add focused unit/API/UI tests
- [x] Create and register `change-memory-ledger` eval cases and workflow
- [x] Run eval validation, suite report, memory regression gate if required, build, and relevant E2E
- [x] Iterate until required checks pass
- **Status:** completed

### Phase 6: Documentation & Delivery
- [x] Create canonical feature documentation and update related feature docs/index
- [x] Move the implemented demo to `docs/demo/` and remove the progressing plan
- [x] Review owned diff, verify no unrelated changes were altered, and deliver evidence
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| User-facing label is `变化脉络`; internal service remains Change Ledger | Avoids implying that only stored-memory records changed; the user sees how a real subject changed over time |
| Record only stable-subject, evidence-backed, temporally meaningful changes | Prevents a global activity log and UI noise |
| P0 is domain-neutral and deterministic | Release dates, goals, status, owners, estimates, and scope changes should share one typed contract without relying on an LLM for clear old/new syntax |
| Non-authoritative sources project `last_observed`, not confirmed current truth | Preserves current-vs-historical trust boundaries |
| An eval suite is required | Temporal reasoning, conflict handling, noise filtering, and false-premise resistance exceed ordinary compile/unit proof |
| Put most implementation in new files and patch dirty integration files narrowly | Required files already contain substantial unrelated user/automation work that must be preserved |
| Persist generic source references instead of a Source Memory-only foreign key | The same event model must later accept Jira, message, meeting, and Goal connector evidence |
| Reconcile visible current-page fields at read time | A page can confirm or supersede the last observed value without silently mutating evidence-derived history |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Existing root planning files and active plan belong to unrelated tasks | Created isolated plan `.planning/2026-07-15-change-ledger-implementation/` and switched only the active pointer |
| First focused ledger test exposed reversal-baseline, dismissed-history, and newline-noise bugs | Treat the first old value as chain baseline, synthesize source-local historical projections after deactivation, and preserve line boundaries during extraction |
| Concurrent work added migrations `052` and `053` after discovery | Renumber the owned migration from `052` to the next available `054` before delivery |
| First ledger eval passed 8/8 business cases but the report contract warned | Add suite-specific readable evidence rows for extraction, projections, Ask, and Compose, then rerun |
| Conflict projections still exposed one arbitrary candidate as `currentValue` | Make unresolved current value unknown; let a visible current-page field resolve only that read context without rewriting history |
| Initial demo QA assertions expected different Chinese wording than the rendered conflict copy | Match the assertions to the actual safe boundary (`未知` / `当前值未选择` / `当前值保持未知`) and rerun desktop/mobile interaction checks |
