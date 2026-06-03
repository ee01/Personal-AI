# Scene Memory Autopilot Findings

## 2026-06-03 Initial Findings

- `docs/features/memory_system.md` already documents the 4-channel RecallEngine flow: vector, FTS, graph, time -> merge/dedup -> MMR rerank -> Top-K.
- The same doc has a system-level reflection/action/confirm/notification flow. Autopilot should not replace it; it should consume pressure signals only when a current user scene needs them.
- The right insertion point for the first slice is after `RecallEngine.recall(...)` returns candidates and before `ContextRecallService` returns displayable matches to Lens/Compose/Meeting/Today.
- Existing Memory Lens doc already acknowledges a serious issue: backend marks high semantic candidates as `displayPriority=p1`, and a client `overlapAudit` was used as a stopgap because real RingCentral tests showed about 60% weak-overlap noise.
- Implementation should move the stopgap direction into backend diagnostics: stronger scene anchor gates, duplicate/noise suppression, and explicit quiet reasons.

## 2026-06-03 Implementation Findings

- Current `ContextRecallService` already had substantial scene-aware ranking logic in the worktree: signal extraction, anchor overlap, suppression reasons, `displayPriority=hidden`, and source cluster merge. The implementation formalized this as a visible `autopilot` response contract instead of duplicating ranking logic.
- The right user-facing contract is not only "top match is relevant"; it is "the service can explain why it did or did not interrupt." The response now reports `mode`, scene anchors, quiet reasons, shown/quieted/hidden counts, low-information count, source-excluded count, and duplicate merges.
- The Lens UI does not need a new entry for this first slice. Reusing the current Rest/Hover/Card shell is correct as long as strong candidates must carry `whyRelevant`, and frontend filtering remains a final safety net.
- The deterministic eval should run local `ContextRecallService` against synthetic cases so it validates the current worktree, while the existing `context-recall` suite continues to validate real RingCentral samples against a configured service endpoint.
