# AR Data Repeat Detach Boundary Plan

## Goal

Improve `AR 数据网页叠加` so an existing repeated AR binding cannot be silently detached from its scheduled AgentTask. The user should see the repeat/write boundary before saving, and canceling repeat should update the scheduled row instead of only clearing local storage.

## Plan

1. Inspect current AR Data docs, content script, background AgentTask bridge, and E2E.
2. Check Personal AI Reminders and external product/paper references for relevant constraints.
3. Implement a focused editor receipt plus background detach path for existing repeated AR bindings.
4. Update AR Data docs/index with concise current behavior.
5. Verify with syntax checks, `npm start` first successful compile, AR Data E2E, and scoped `git diff --check`.

## Status

- [x] Context, Reminders, and initial code inspection
- [x] External scan
- [x] Implementation
- [x] Docs update
- [x] Verification

## Boundaries

- Scope: `docs/features/ar_data_overlay.md`, `docs/index.md`, `src/contentScriptWebIntelligence.ts`, `src/background.ts`, `tools/verify-ar-data-overlay-e2e.mjs`, and this planning directory.
- Do not change AR execution prompt semantics, OpenClaw payloads, Sheet schema, Memory Service routes, or unrelated Scheduled Messages UI.

## Errors Encountered

| Error | Resolution |
|---|---|
| Initial random parser mixed term-table rows and recent features | Reran a stricter feature-row parser and selected `AR 数据网页叠加` from viable candidates. |
