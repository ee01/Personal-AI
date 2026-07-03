# Memory Coverage Map Manual Rescan Receipt

## Target

Randomly selected feature: `记忆覆盖地图` / Memory Coverage Map.

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders are readable, but there is no `Personal AI` list on this machine.
- Recent automation runs already covered backup receipts, quality-score repair route, slice receipts, and timeline freshness, so this pass avoids those subareas.
- External product and research scan supports explicit connector/index status, freshness, and no-side-effect boundaries after manual reads.

## Plan

1. Keep backend coverage aggregation, scoring, import, and restore behavior unchanged.
2. Add a persistent user-facing receipt for manual `重扫覆盖`.
3. Receipt states requested/completed time, old snapshot, new snapshot, current read counts, and the read-only operation boundary.
4. Failed manual refresh keeps the previous platform cards visible and says the failed result did not replace the snapshot.
5. Extend the existing Coverage Map E2E to cover failed and successful manual refresh receipts.
6. Update the canonical feature doc.

## Verification

- `npm run verify:memory-coverage:e2e`
- `npm start` until first successful compile, then stop
- Scoped `git diff --check`
