# Memory Coverage Map duplicate import receipt

## Target

Feature: `Memory Coverage Map / 记忆覆盖地图`

Random index pick: `记忆覆盖地图` from `docs/features/index.md`.

Reminder status: local Reminders has no `Personal AI` list on this machine, so no user feedback item was available to fold in or mark done.

## Current finding

The smart import UI already has strong receipts for successful commits, external AI import scope, high-risk commit confirmation, backup download, and restore follow-up. The duplicate path is weaker: `/import/inspect` can return `status: duplicate` with `existingBatchId`, but the primary button becomes disabled and the user only sees a short status line. That makes "already safely saved" harder to audit than a fresh import.

Nearby source defects in the same Vue/test surface make validation noisier:

- `SmartMemoryImportInspectResponse` is imported twice in `MemoryCoveragePage.vue`.
- The quality score explanation element has a duplicate `aria-label`.
- `scoreTone()` repeats the same non-number guard.
- The E2E ordinary zip fixture repeats `zipTotalFiles`.

## External context

- Microsoft 365 Copilot connector docs expose connector statistics, partial indexing, out-of-sync items, and index-browser checks for item status, properties, and permissions. The useful pattern is a durable diagnostic receipt, not just a generic success/failure state.
- Notion Enterprise Search documents query-time permission checks, connector sync progress, deletion/retention boundaries, and audit trails. Coverage Map should keep source, permission, and non-effect boundaries visible.
- PIM research on information scraps emphasizes that people keep information across many tools and need confidence that archived scraps were actually saved and recoverable.

## Implementation plan

1. Add a duplicate dry-run receipt card in `MemoryCoveragePage.vue`.
   - Show it when `importInspect.status === 'duplicate'`.
   - Include source hash, existing batch id, scope, and boundary text.
   - State that this dry-run wrote nothing and did not overwrite/delete/sync externally.
2. Reuse the existing smart import receipt visual style where possible, but give the duplicate receipt its own `aria-label` for E2E proof.
3. Keep the primary action disabled for duplicates; the receipt is for audit/recovery, not for forcing another write.
4. Fix the nearby duplicate import / duplicate attribute / repeated guard / duplicate fixture field.
5. Update `docs/features/memory_coverage_map.md` to describe duplicate dry-run receipts.
6. Extend `tools/verify-memory-coverage-e2e.mjs` with a duplicate inspect fixture and assertions.

## Verification plan

Run:

```bash
npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts src/__tests__/api-smart-import.test.ts
npm --prefix memory-service run build
npm start
npm run verify:memory-coverage:e2e
git diff --check -- .planning/2026-06-13-automation-memory-coverage-duplicate-receipt/plan.md docs/features/memory_coverage_map.md src/modals/components/MemoryCoveragePage.vue tools/verify-memory-coverage-e2e.mjs
```

Stop `npm start` after the first successful compile.
