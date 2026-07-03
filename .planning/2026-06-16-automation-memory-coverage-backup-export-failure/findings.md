# Memory Coverage Backup Export Failure Findings

## Repo Findings

- `docs/progressing/to-verify.md` says `暂无。`; there is no carry-over verification item.
- `docs/features/memory_coverage_map.md` is current for the large existing surface: coverage snapshot receipts, quality score boundaries, repair queue scoping, smart import dry-run/commit, duplicate import receipts, external AI import scope, backup zip restore preview, replace confirmation, and restore failure receipts.
- Current UI gap: `记忆备份` success leaves a persistent `备份下载回执`, but export failure only uses a transient toast. For a backup/portability operation, a missed toast leaves users unsure whether a file was saved or whether any restore/delete/sync happened.
- Existing E2E file `tools/verify-memory-coverage-e2e.mjs` already owns the backup-download success flow and can be extended with one failed `/export` attempt before the success case.

## External Reference Findings

- Microsoft 365 Copilot connector docs expose connector item status, metadata, ACLs, errors, and user access checks; connection details include cumulative discovered/indexed/failed counts and a refreshable index status. This supports persistent receipts and explicit failure state for coverage or export operations.
- OpenAI ChatGPT memory docs expose memory controls, memory summary freshness, and sources used for personalization. The export docs make data export a verified, asynchronous zip download path, including failure/retry timing. This supports showing when a backup file was not actually saved.
- Data portability research (`Data Portability between Online Services`) studies export/import behavior across 182 online services and emphasizes that portability is often indirect and infrastructure-limited. This supports keeping export and restore as separate, explicit steps instead of implying a failed export created a usable backup.
- Data export user-study references report that inspecting exported data can improve privacy attitudes, while transfer to substitute services often has limited usefulness. This supports local, reviewable receipts around backup and restore rather than a generic success/failure toast.

## Implementation Slice

- Add a durable backup-export failure receipt that says:
  - the export request failed and no backup zip was saved by this action;
  - no restore, deletion, sync, or external send happened;
  - the user can retry after checking Memory Service connectivity.
- Do not modify backend export, backup schema, or restore semantics.
