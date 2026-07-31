# Task Plan: Keystone Memory Briefs Implementation

## Goal
Implement the approved P0 Keystone Memory Briefs capability so passive Memory Lens reuses its existing floating entry and presents a ready brief as the primary first-screen object, while raw related memories remain available as evidence and the current card path remains the fallback.

## Current Phase
Complete

## Phases

### Phase 1: Requirements And Discovery
- [x] Confirm the revised interaction direction with the user
- [x] Inspect dirty worktree and current Memory Lens, context-recall, source-memory, API, persistence, and verifier paths
- [x] Identify the smallest complete P0 contract that fits existing architecture
- [x] Record findings and overlapping changes without reverting them
- **Status:** complete

### Phase 2: Contract And Test Design
- [x] Define brief persistence/API/service contracts and deterministic readiness/fallback behavior
- [x] Define Memory Lens presentation mapping: ready primary, partial conflict-primary, stale warning plus raw fallback, blocked/hidden/absent raw fallback
- [x] Define focused service tests, extension verifier/E2E coverage, and eval fixtures
- **Status:** complete

### Phase 3: Backend Implementation
- [x] Add Keystone brief storage/service/API support
- [x] Match briefs from current scene anchors without changing ordinary context-recall ranking
- [x] Preserve provenance, freshness, authority, privacy, feedback, and repair state
- **Status:** complete

### Phase 4: Memory Lens Implementation
- [x] Reuse Rest, Hover Peek, and Expanded Card instead of adding a second entry
- [x] Render a ready brief as the primary card object
- [x] Move raw memories into evidence/related-memory detail and retain ordinary-card fallback
- [x] Preserve Selection Memory Search, Rehearsal, feedback, pagination, cache, and read-only boundaries
- **Status:** complete

### Phase 5: Verification And Evaluation
- [x] Run focused service tests and registered eval/report if LLM or ranking quality is involved
- [x] Run first successful extension dev compile and stop watch cleanly
- [x] Run Memory Lens verifier and E2E, including ready/partial/stale/absent behavior
- [x] Run scoped whitespace and diff review
- **Status:** complete

### Phase 6: Documentation And Delivery
- [x] Update canonical feature docs with implemented behavior and maintenance contracts
- [x] Move the interactive demo to `docs/demo/` and delete the completed progressing plan/demo
- [x] Explain how to exercise the feature locally with concrete scenarios
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|---|---|
| Same Memory Lens entry and shell | Avoids competing icons and preserves the existing low-interruption interaction contract. |
| Ready brief replaces the first-screen raw-card presentation | The product value is synthesis; showing both at equal hierarchy recreates the original scanning burden. |
| Raw memories remain evidence, not deleted results | Users still need provenance, conflict inspection, and recovery. |
| Ordinary cards remain the fallback | Stale, blocked, hidden, missing, or low-confidence briefs must not hide usable recall evidence; partial briefs may lead only with an explicit conflict state and visible evidence. |
| Selection Search and Rehearsal keep their own variants | Their user intent and authority semantics differ from passive page briefs. |
| Attach `keystoneBrief` to Context Recall response | Preserves the exact raw matches and requires no second passive request. |
| Persist full source-grounded brief contract | Enables provenance, freshness, conflict repair, events, and future consumers without parsing rendered text. |
| Dedicated brief events | Brief usefulness/hide/not-accurate signals must not be written as feedback against one arbitrary raw memory. |
| Passive matching stays synchronous and deterministic | Avoids LLM latency or failure in the Memory Lens fast path. |

## Errors Encountered
| Error | Resolution |
|---|---|
| Initial combined backend patch did not match the concurrently edited `ContextRecallResponse` block | No changes landed; split the implementation into migration, types, service, route, and integration patches against freshly read context. |
| Root `tsc --noEmit` stopped in existing Fastify declaration files because the root TypeScript version cannot parse their newer const type parameters | Use the repository's webpack watch compile for extension validation; keep the independently passing `memory-service` TypeScript build as the backend check. |
| First static verifier run used a backend-only selected-text pattern against the content script | Replaced it with the actual renderer guard, `!isSelectionSearch && options.keystoneBrief`. |
| Initial E2E harness patch used a stale return-object context and did not apply | No changes landed; split fixture, endpoint, and browser assertions into narrow patches against current harness structure. |
| First Keystone eval run passed 5/6 cases; URL redaction consumed Chinese-punctuation-separated token and email text | Stop URL and credential patterns at ASCII/CJK punctuation so each sensitive value is redacted precisely without over-deleting the summary. |
