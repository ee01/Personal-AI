# 多用户隔离身份按钮边界 Findings

## Repo findings

- `docs/progressing/to-verify.md` is empty.
- `docs/features/index.md` maps `多用户隔离` to `docs/features/memory_system.md`.
- `/api/v1/stats` returns `user.id`, `identitySource`, `storageKey`, `fallbackToDefault`, and machine-readable `writeBoundary`.
- `Memory Exploring` already shows the identity card and snapshot receipt, but the `刷新身份快照` and `打开设置` buttons do not expose their no-write / no-migration boundary through `title` or `aria-label`.
- Existing proof path: `npm run verify:memory-user-identity:e2e`.

## Reminder findings

- AppleScript list enumeration did not include `Personal AI`.
- EventKit found `Personal AI` and reported `PERSONAL_AI_INCOMPLETE_COUNT=0`.
- No Reminder item is related to multi-user isolation or identity recovery, and nothing needs to be marked done.

## External scan

- OpenAI Memory FAQ and memory controls emphasize visible memory management and deletion controls.
- Claude chat search and memory exposes memory/search controls and retrieval behavior to users.
- Notion Enterprise Search security emphasizes query-time permission checks and continuously verified user mapping.
- `Governed Shared Memory for Multi-Agent LLM Systems` frames scope and provenance as explicit governance dimensions and calls out unauthorized leakage and provenance collapse as production failure modes.
