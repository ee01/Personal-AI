# Findings

## Repo State

- `docs/progressing/to-verify.md` is empty.
- Worktree was broadly dirty before this run; this pass should only own the memory backup fingerprint changes, matching docs/tests, and this planning directory.
- AppleScript listed Reminders lists but not `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items, so no Reminder feedback was incorporated or marked done.

## Current Behavior

- `/export` returns a Personal AI backup zip with manifest headers for user, exported time, format version, include count, and layer counts.
- `/import` supports dry-run preview and merge/replace commit, validates manifest paths, sizes, checksums, unsupported entries, and cross-user confirmation.
- Coverage Map shows download, dry-run, impact, restore, failure, and next-step receipts.

## Gap

Dry-run and commit receipts do not expose a stable archive fingerprint for the selected zip. A user can see manifest counts and exported time, but cannot easily verify that the restore preview and the later write refer to the same uploaded archive snapshot.

## Product Direction

Backup/restore should keep the high-responsibility boundary visible: identity, integrity, target user, destructive mode, and no external side effects should be explicit before commit.
