# Memory Lens Source-Link Recall Plan

Goal: verify the live `esone.qiu` memory behind “Story Points estimation by AI Service - Google Docs”, determine whether a Google Docs URL exists and where it is lost, then improve the source-link contract across Memory Lens and other recall consumers without weakening link-safety or read-only boundaries.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Capture the supplied response/image, query the live read-only API, and inspect the exact stored memory/source metadata |
| 2 | complete | Trace link fields through ingestion, recall serialization, extension transport, Memory Lens view models, and existing safety helpers |
| 3 | complete | Inventory other recall consumers that can lose or hide the same link and rank the improvement scope |
| 4 | complete | Choose and document the smallest coherent contract/UI design, including safe/blocked/missing-link states |
| 5 | complete | Implement the bounded fix and update canonical feature documentation if the evidence supports a local code change |
| 6 | complete | Run targeted tests, first successful `npm start` compile when runtime code changes, relevant E2E, and scoped diff checks |
| 7 | complete | Audit the remote deployment path, current health, dirty-tree sync scope, backup/rollback points, and pre-deploy baseline |
| 8 | complete | Build and locally validate an idempotent dry-run/apply backfill plus integrity metrics for missing Source Memory recall signals |
| 9 | in_progress | Back up the live `esone.qiu` database, deploy the verified memory-service artifact, and confirm container/host health |
| 10 | pending | Run backfill dry-run, reconcile the expected target set, apply transactionally, and verify post-write integrity/counts |
| 11 | pending | Re-run the original context-recall request, sample repaired capsules, run memory-abilities, and record rollback-ready evidence |

## Decision Gates

- If the live record contains a safe Google Docs URL and `/context-recall` already returns it, keep the fix presentation-side.
- If the stored record has a URL but recall serialization drops it, repair the shared recall contract before consumer-specific UI.
- If the record has no URL, do not fabricate one from title text; identify the ingestion/backfill gap and keep UI explicit about missing source metadata.
- Preserve existing credential/signed-URL blocking and read-only/no-write source-open semantics.
- The user explicitly authorized memory-service deployment and controlled backfill on 2026-07-14; require a verified backup, dry-run count reconciliation, transactional/idempotent apply, and post-write checks before completion.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root planning files belong to an older completed Scheduled Messages task | Initial planning restore | Created this isolated plan and left the active-plan pointer untouched |
| A remote SQLite audit command had unmatched shell quoting | First metadata audit | Re-ran the read-only query with simpler double-quoted SSH SQL; no write occurred |
| Broad `deploy:memory` would include unrelated dirty-tree changes and delete a remote env backup | Deployment preflight | Switched to backup plus narrow patch/new-file sync against the current remote baseline |
