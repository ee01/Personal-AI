# Doubao Run-now Audit Provenance

## Target

- Random feature: `Persona / 近期重点 / 提醒推送`
- Feature family: Doubao Bridge
- Canonical doc: `docs/features/doubao_bridge.md`

## Pre-checks

- `AGENT.md` read.
- `docs/progressing/to-verify.md` says `暂无`.
- Existing worktree already had unrelated Native Join automation changes; this run did not revert them.
- AppleScript did not list `Personal AI`; EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. All items were completed historical Doubao / Notification feedback, so no Reminder item was incorporated or marked done.

## External Scan

- ChatGPT Memory FAQ emphasizes user controls for saved memory, chat-history reference, deletion, and temporary chat boundaries: https://help.openai.com/articles/8590148-memory-faq
- ChatGPT Scheduled Tasks exposes scheduled work as manageable objects with next-run, pause/resume/edit/delete, and notification state: https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- Claude memory import/export documents provider-to-provider memory transfer and backup/migration as first-class flows: https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- Mem0 and LongMemEval both support the same design pressure: long-term assistant memory needs salient extraction plus auditable provenance and update/abstention behavior: https://arxiv.org/abs/2504.19413 and https://arxiv.org/abs/2410.10813

## Plan

1. Keep the scope on manual Doubao output sync audit receipts, not provider transport or Memory Service package rendering.
2. Make `/sync/run-now` return the same audit metadata the UI already expects for immediate "本次审计" copy.
3. Count source references by unique source id when `reminder_sync` merges todo and notice sub-results, while keeping source ids out of persisted recent attempts and HTTP responses.
4. Update unit, server, and UI E2E coverage.
5. Update concise feature docs and index wording.

## Result

- `desktop-app/src/server.ts` now returns run-now audit metadata through an explicit allowlist.
- `desktop-app/src/syncManager.ts` now keeps rendered source ids in an internal `WeakMap` only long enough to dedupe merged results. Persisted `recentAttempts` and HTTP responses keep only `sourceRefCount`.
- Tests now cover deduped source counts, run-now metadata response, and no source id leakage.
- Docs now describe the source count as deduped and the immediate audit as coming from `/sync/run-now`.

## Verification

- `node --check desktop-app/app/renderer.js`
- `node --check desktop-app/scripts/doubao-source-toggle-gating-check.mjs`
- `NODE_ENV=test ./node_modules/.bin/tsx --test src/__tests__/syncManager.test.ts src/__tests__/bridgeService.test.ts`
- `npm --prefix desktop-app run test:source-toggle-gating`
- `npm --prefix desktop-app run build`
- `npm start -- --progress` reached first successful webpack compile in 14335 ms and was stopped.
- `git diff --check -- desktop-app/src/syncManager.ts desktop-app/src/server.ts desktop-app/src/__tests__/syncManager.test.ts desktop-app/src/__tests__/bridgeService.test.ts desktop-app/scripts/doubao-source-toggle-gating-check.mjs docs/features/doubao_bridge.md docs/features/index.md`
- Process check found no remaining webpack watcher or target verifier process.
