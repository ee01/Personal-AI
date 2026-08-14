# Task Plan: Recall LLM Routing Audit

## Goal
Trace every recall-dependent interface, then implement the approved Recall contract cleanup, intentional user-triggered synthesis, dead-call fixes, observability, documentation, and validation without disturbing unrelated worktree changes.

## Current Phase
Complete

## Phases

### Phase 1: Map Contracts And Callers
- [x] Inspect `/recall`, `ActiveRecallService`, `RecallEngine`, and LLM gating
- [x] Enumerate direct `/recall` clients and indirect recall-dependent services
- [x] Record latency, evidence, generation, and downstream-LLM boundaries
- **Status:** complete

### Phase 2: Capture-Specific Verification
- [x] Classify the 84 captured recall bodies by caller-shaped request fields
- [x] Determine whether no-summary behavior is deliberate, unused capability, or both
- **Status:** complete

### Phase 3: Product Routing Assessment
- [x] Decide which interfaces benefit from deterministic evidence only
- [x] Decide which interfaces benefit from optional or mandatory LLM synthesis
- [x] Identify double-generation, hallucination, latency, and cost risks
- **Status:** complete

### Phase 4: Recommendation And Validation
- [x] Propose an explicit recall mode contract and migration plan
- [x] Define metrics/evals and rollout checks
- **Status:** complete

### Phase 5: Delivery
- [x] Re-read evidence and deliver a comprehensive Chinese analysis
- **Status:** complete

### Phase 6: Re-baseline And Contract Design
- [x] Re-check current dirty files and post-audit code drift
- [x] Define a backward-compatible separation of retrieval, presentation, and synthesis
- [x] Define synthesis grounding, status receipts, cache, and timing contracts
- **Status:** complete

### Phase 7: Backend Implementation
- [x] Implement separated Recall routing while preserving legacy `blockTypes`
- [x] Add grounded synthesis, cache/single-flight, and explicit receipts/timings
- [x] Remove unsupported schema claims or implement supported behavior
- **Status:** complete

### Phase 8: Caller And UI Repairs
- [x] Add explicit Memory Exploring user-triggered summarization
- [x] Remove discarded Dashboard Recall and repair empty workflow replay query
- [x] Preserve all no-LLM and downstream-specialized LLM boundaries
- **Status:** complete

### Phase 9: Tests, Evals, Docs, Verification
- [x] Add backend/client/UI targeted coverage including LLM success/failure/cache cases
- [x] Update canonical memory feature documentation
- [x] Run targeted tests, eval validation/suite, extension dev build, and scoped diff checks
- **Status:** complete

### Phase 10: Delivery
- [x] Re-read plan/findings, audit owned diff, and report verified outcomes and remaining boundaries
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Analysis only; no runtime changes | User asked why and which interfaces should use LLM more reasonably |
| Separate retrieval from synthesis | `blockTypes` mixes render blocks and an optional LLM stage; callers have different latency and trust needs |
| Preserve legacy `blockTypes` during migration | Existing API clients may depend on the old request shape even though current repo callers do not request summary |
| LLM synthesis remains explicit and user-triggered | Prevent hidden token use in passive/background/agent-tool recall paths |
| Do not deploy the dirty working tree by default | `deploy:memory` would sync unrelated user changes currently present under `memory-service/` |
| Namespace synthesis cache by database instance | Prevent any cross-user reuse even when two per-user databases contain identical-looking evidence |

## Errors Encountered
| Error | Resolution |
|-------|------------|
