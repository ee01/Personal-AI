# Findings

## Current Product Behavior

- `MemoryCoveragePage.vue` already recognizes `backup_zip` through `/import/inspect`, forces restore into the import drawer, supports merge/replace preview, requires review for cross-user/replace/overwrite/delete/warning cases, and disables repeated restore after success.
- `exportBackup()` calls `POST /api/v1/export`, downloads the returned zip, and only shows a transient toast.
- Restore completion shows database/file counts, but it does not explicitly tell the user what remains manual after restore: keep the downloaded zip private, refresh/re-scan coverage, and re-open restore with a new file for another run.
- E2E already verifies smart import, ordinary zip fallback from backup mode, external AI import scope, backup dry-run, review confirmation, and restore completion.

## External Research

- Google Takeout export is archive-oriented and warns that archives may omit changes made between request and creation; it also hands off responsibility when a user sends archives to third-party storage.
- OpenAI ChatGPT export sends a zip through a time-limited email link and includes chat history plus account data, which reinforces that export files are explicit user-held artifacts rather than live sync.
- Claude memory import/export frames memory as copy/paste or file-backed backup/migration, with review after import and possible scope limits on what is retained.
- Data portability research highlights lack of standardization, user awareness, and scope ambiguity; restore UX should show scope and limitations before and after action.
- PIM research treats backup, archive, deletion, privacy, and maintenance as part of keeping personal information usable over time.

## Implementation Direction

Use existing client/server contracts. Add presentation-only receipts in Coverage Map:

- `备份下载回执`: file name, download time, zip/content type, privacy/storage boundary, and restore path.
- `恢复后续回执`: restored layers/mode, refresh state, manual next step, and non-authority boundary.

Do not alter import/export API behavior in this pass.
