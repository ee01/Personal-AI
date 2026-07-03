# Memory Backup Manifest Receipt Plan

## Target

- Random feature: `记忆导入/导出/备份`
- Source doc: `docs/features/memory_system.md`
- Primary surfaces: `/export`, Coverage Map backup download receipt, backup restore dry-run flow

## Current Finding

The backup system already validates `manifest.json`, supports dry-run, requires cross-user confirmation, and shows restore failure boundaries. The weaker UX point is export completion: the page confirms a zip was downloaded, but it does not surface the backup manifest summary that the service already generated. A user can see file name and size, but not which Memory Service user space, format version, include count, or A/B/C layer counts the downloaded archive represents.

## External Signals

- Google Takeout makes export scope and archive format explicit before download and repeatedly states export does not delete server data.
- OpenAI's exported-conversation transfer docs emphasize that upload/reference is not a full migration or account merge.
- Data portability literature distinguishes syntactic data, semantic meaning, policy scope, and derived data, which maps well to the current A/B/C backup layers.
- Agent-memory privacy research emphasizes keeping memory boundary operations deterministic and visible.

## Implementation Steps

1. Add manifest summary headers to `/api/v1/export` and expose them via CORS.
2. Parse those headers in `MemoryServiceClient.exportMemory()`.
3. Show manifest summary rows in the Coverage Map backup download receipt.
4. Extend `verify-memory-backup.ts` and `verify-memory-coverage-e2e.mjs` to prove the header contract and receipt rendering.
5. Update `docs/features/memory_system.md` with the export receipt behavior.

## Verification Plan

- `npm run verify:memory-backup`
- `npm run verify:memory-coverage:e2e`
- `npm start` until first successful compile, then stop the watcher
- `git diff --check -- <touched files>`
