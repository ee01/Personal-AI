# Compose Assist direct insert receipt

## Target

- Feature: `回复助手直接插入` / Compose Assist.
- Canonical doc: `docs/features/assist.md`.
- Runtime focus: `src/composer-guard/ComposerGuardController.ts` and `src/composer-guard/assistPreviewPolicy.ts`.

## Current State

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is incorporated or completed.
- The worktree was already broadly dirty before this run; this plan keeps the run scoped to Compose Assist files.

## Research Signal

- Gmail Smart Compose and Grammarly keep suggestion acceptance explicit before text is applied.
- Outlook Copilot generates a draft for review before the user keeps or edits it.
- Recent AI writing-assistant research warns that autocomplete-style suggestions can alter expression and attitude, so accepted suggestions should preserve visible user ownership.

## Improvement Plan

1. Add a compact post-insert receipt helper that names the write target.
2. Show the receipt in the undo toast after successful direct insert.
3. State the side-effect boundary: no prompt submit, Jira comment submit, RingCentral send, or generic external action happened.
4. State the learning boundary: accepted feedback and ambient calibration are recorded only after the undo window expires.
5. Keep the toast responsive so the new boundary copy wraps cleanly.
6. Update unit and direct-insert E2E assertions.
7. Update the canonical feature doc without adding implementation noise.

## Validation Plan

- `TS_NODE_TRANSPILE_ONLY=1 /Users/Esone/.nvm/versions/node/v24.13.0/bin/node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts`
- `/Users/Esone/.nvm/versions/node/v24.13.0/bin/npm start`, wait for the first successful webpack compile, then stop the watch process.
- `/Users/Esone/.nvm/versions/node/v24.13.0/bin/node tools/verify-compose-assist-direct-insert-e2e.mjs`
- Scoped `git diff --check` over touched files.
