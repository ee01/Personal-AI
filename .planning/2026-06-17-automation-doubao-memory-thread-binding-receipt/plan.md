# Doubao Memory Sync Thread Binding Receipt Plan

## Goal

Improve the selected `Memory Sync Thread` feature in Doubao Bridge by making the long-term thread create/repair action produce an explicit user-facing receipt.

## Context

- Random feature selected from `docs/index.md`: `Memory Sync Thread`.
- Source doc: `docs/features/doubao_bridge.md`.
- Main implementation: `desktop-app/src/bridgeService.ts`, `desktop-app/src/syncManager.ts`, `desktop-app/app/renderer.js`.
- Browser-level verifier: `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`.
- `docs/progressing/to-verify.md` currently has no carry-over work.
- Local Reminders is readable, but there is no visible list named `Personal AI`; no Reminder item will be incorporated or marked done.

## External Signals

- OpenAI ChatGPT memory controls emphasize visible saved-memory management and deletion boundaries.
- Claude memory import/export treats memory portability as an explicit flow, not an implicit conversation side effect.
- Gemini saved info and memory import flows make remembered preferences a user-managed surface.
- Mem0 and recent agent-memory papers support selective, structured long-term memory instead of replaying all transcript context.
- Agent Cognitive Compressor separates artifact recall from state commitment; this supports separating "thread bound" from "stable persona committed".

## Improvement Plan

1. Add a renderer-side helper that compares the pre-click long-term thread state with the returned thread.
2. Classify the result as reuse, record restore, repaired binding, or newly created thread.
3. Show a concise `绑定回执` / `修复回执` / `创建回执` in the existing message area.
4. Make the receipt state that the action only writes the `memory_sync_thread` binding; it does not sync `persona_core / voice_mode`, does not write `mobile_context_thread`, and delivery proof still comes from later sync audit entries.
5. Extend the existing Desktop App E2E to click the long-term thread action and assert the new receipt.
6. Update `docs/features/doubao_bridge.md` with the new UX contract.

## Validation Plan

- `npm --prefix desktop-app test -- src/__tests__/bridgeService.test.ts src/__tests__/syncManager.test.ts`
- `npm start`, wait for the first successful compile, then stop the watcher.
- `npm --prefix desktop-app run test:source-toggle-gating`
- Scoped `git diff --check`.
- Confirm no webpack watch process remains running.
