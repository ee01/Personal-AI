# Task Plan: Recall LLM Routing Audit

## Goal
Trace every recall-dependent interface, explain why captured `/recall` calls never enabled the LLM summary stage, and recommend where generated synthesis is or is not appropriate without changing runtime code.

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

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Analysis only; no runtime changes | User asked why and which interfaces should use LLM more reasonably |
| Separate retrieval from synthesis | `blockTypes` mixes render blocks and an optional LLM stage; callers have different latency and trust needs |

## Errors Encountered
| Error | Resolution |
|-------|------------|
