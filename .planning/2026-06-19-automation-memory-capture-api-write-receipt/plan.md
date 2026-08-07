# Memory Capture API write receipt plan

## Target

- Random feature: `Memory Capture API` from `docs/index.md`.
- Source of truth: `docs/features/memory_capture.md`.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list on this machine, so no Reminder item can be merged or completed.

## Research signal

- Notion Web Clipper, Readwise Reader, Obsidian Web Clipper, Zotero Connector, Hypothesis, and Raindrop all make capture/save a visible user action with clear destination, source, notes, snapshots, or later-review paths.
- PIM / KFTF research frames saved web information as material that must be re-found with source and purpose, not just silently collected.
- Product direction for this run: Memory Capture API should return a stable post-save receipt that says whether a capsule and recall/search signal were actually written, and what does not happen automatically.

## Implementation steps

1. Add `writeReceipt` to `SourceMemoryCapsule` responses.
2. Derive receipt state from capsule status and linked `web` memory signal:
   - saved + linked signal: write and later recall are active.
   - saved + missing linked signal: capsule exists, but recall/search signal is not active.
   - dismissed: linked signal has been removed and later recall is off.
3. Update `MemoryServiceClient` types and content-script success toasts to use the API receipt as detail copy.
4. Update `docs/features/memory_capture.md` with the API receipt contract.

## Verification plan

```bash
npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts
npm run verify:webpage-memory-detection
npm start
node tools/verify-source-memory-capsule-e2e.mjs
git diff --check -- memory-service/src/core/SourceMemoryCaptureService.ts memory-service/src/__tests__/api-source-memory.test.ts src/services/MemoryServiceClient.ts src/contentScriptWebIntelligence.ts docs/features/memory_capture.md .planning/2026-06-19-automation-memory-capture-api-write-receipt/plan.md
```
