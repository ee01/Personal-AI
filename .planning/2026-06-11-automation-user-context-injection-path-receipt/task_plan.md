# Automation Plan: User Context Injection Path Receipt

## Goal

Improve the `用户上下文注入` feature in Prompt Config so users can see, before saving or previewing raw prompt text, which configured context fields enter which analysis scopes and what authority boundary applies.

## Context

- Selected from `docs/features/index.md`: `用户上下文注入` under Prompt Config (`docs/features/custom_prompts.md`).
- `docs/progressing/to-verify.md`: `暂无。`
- Reminders probe: Reminders list is readable, but there is no `Personal AI` list, so no Reminder items are incorporated or marked done.
- Existing worktree is broadly dirty. Keep edits scoped to Prompt Config docs/source/verifiers and this planning directory.

## Plan

1. Inspect current Prompt Config docs, helpers, UI, and verifiers. Status: complete.
2. Research adjacent product / paper / security guidance for visible memory controls, profile selection, and prompt-injection boundaries. Status: complete.
3. Add a small structured helper for user-context section receipts. Status: complete.
4. Render the receipt on relevant context tabs without introducing a new review queue or blocking flow. Status: complete.
5. Extend focused verifier and E2E assertions. Status: complete.
6. Update `docs/features/custom_prompts.md`. Status: complete.
7. Validate with focused tests, `npm start` first compile, E2E, and `git diff --check`. Status: complete.

## Proposed UX Change

Show an inline `注入路径` receipt on user-context configuration tabs. It should state:

- whether the current fields are base context, message-only analysis context, or project/meeting/document context;
- whether user-context injection is active or only saved locally because global/source injection is paused;
- that fields are serialized as low-priority `user_context` data and cannot override system/developer/tool/return-format constraints.

## Validation

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-custom-prompts.ts`
- `npm start` first webpack dev compile, then watcher stopped
- `node tools/verify-custom-prompts-e2e.mjs`
- `git diff --check`
- `pgrep -fl 'webpack --watch|npm start' || true`
