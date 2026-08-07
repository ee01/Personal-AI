# Memory Capture API Action Receipt Plan

## Target

- Random feature: `Memory Capture API` from `docs/index.md`.
- Source of truth: `docs/features/memory_capture.md`.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be merged or marked done.

## Problem

`writeReceipt` now tells whether a source-memory capsule and linked recall signal are active. After the user clicks `查看` or opens the capsule later, the detail page still loses the last user-visible operation context: newly saved, duplicate found, duplicate note refreshed, note updated, dismissed, or resaved after dismiss. Since distillation events are internal and usually happen after the user action, the API should expose a filtered latest action receipt instead of making the UI infer it from timestamps.

## Research Signal

- Web clipper and reader tools such as Notion, Mem, and Readwise emphasize visible save destination, source, note/highlight state, and later review.
- PIM research emphasizes that saved web information must remain refindable with source and purpose, not just stored as an opaque item.
- Product direction: when Memory Capture returns a capsule, the API should carry both current recall state and the latest user-perceived operation state.

## Implementation Steps

1. Add `actionReceipt` to `SourceMemoryCapsule` responses.
2. Derive it from the latest non-distillation event in `source_memory_events`.
3. Cover saved, duplicate save without note, duplicate save with updated note, resaved, note updated, and dismissed states.
4. Update extension client types and Source Memory detail UI to show `最近操作回执`.
5. Extend API and E2E tests, then update canonical docs.

## Verification Plan

```bash
npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts
npm start
node tools/verify-source-memory-capsule-e2e.mjs
git diff --check -- memory-service/src/core/SourceMemoryCaptureService.ts memory-service/src/__tests__/api-source-memory.test.ts src/services/MemoryServiceClient.ts src/modals/components/SourceMemoryDetailPage.vue tools/verify-source-memory-capsule-e2e.mjs docs/features/memory_capture.md .planning/2026-06-27-automation-source-memory-action-receipt/plan.md .planning/2026-06-27-automation-source-memory-action-receipt/findings.md .planning/2026-06-27-automation-source-memory-action-receipt/progress.md
```

## Errors Encountered

| Error | Resolution |
| --- | --- |
| Initial random sample hit Meeting Pilot local ASR, too close to recent Meeting Pilot/ASR work | Rerolled after excluding Meeting Pilot / ASR from candidate set |
| Root `task_plan.md` is stale from an older Scheduled Messages run | Created this isolated `.planning/` plan and left root files untouched |
| Reminders list `Personal AI` is absent | Stop Reminder branch honestly; nothing can be marked done |
| API test initially returned the original `saved` event for duplicate/dismiss actions | Added `rowid DESC` after `created_at DESC` because source-memory events use second-level timestamps |
| Source Memory E2E strict selectors matched the new action receipt chips/headings | Scoped assertions to status chips and the action panel |
| Source Memory E2E fixture used `?ticket=...`, now treated as a sensitive query signal | Switched the primary open-source fixture to a safe URL and kept the dedicated sensitive fixture for hidden-link coverage |
