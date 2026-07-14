# Compose Assist Feedback Boundary Receipt Plan

## Target

- Feature: `回复助手阈值与反馈` under Compose Assist.
- Source doc: `docs/features/compose_assist.md`.
- Main code: `src/composer-guard/ComposerGuardController.ts`.
- Existing proof path: `tools/verify-compose-assist-direct-insert-e2e.mjs`.

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- EventKit found the local `Personal AI` Reminders list, but all four items are already completed historical Doubao / Notification notes and none are related to Compose Assist.
- External scan: Gmail Smart Compose and Outlook suggested replies keep suggestions user-controlled and configurable; Smart Compose and co-writing research both support low-friction suggestions while preserving writer agency and visible control.
- Existing files already have uncommitted review-selection preservation work; this pass leaves that behavior intact and only improves thumb-down feedback boundaries.

## Implementation Steps

1. Add a thumb-down receipt line that explicitly says the click only hides the current suggestion locally.
2. State the important non-effects: no draft send/submit, no source-memory deletion, no global shutdown of other input-box suggestions.
3. For Rehearsal-backed suggestions, say activation downgrade/background writes are only confirmed by the later receipt state.
4. Add focused E2E assertions to the existing Compose Assist direct-insert browser check.
5. Update the Compose Assist feature doc with the new receipt contract.

## Verification

1. Run the focused Composer Guard node tests.
2. Run `node --check tools/verify-compose-assist-direct-insert-e2e.mjs`.
3. Run `npm start -- --progress`, stop after first successful compile.
4. Run `node tools/verify-compose-assist-direct-insert-e2e.mjs`.
5. Run scoped `git diff --check`.
