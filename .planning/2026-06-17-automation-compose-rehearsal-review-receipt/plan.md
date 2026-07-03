# Compose Assist Rehearsal Review Receipt

## Target

- Random index item: `回复助手预演提醒`.
- Canonical docs: `docs/features/rehearsal.md` and `docs/features/compose_assist.md`.
- Main implementation: `src/composer-guard/ComposerGuardController.ts` and `src/composer-guard/assistPreviewPolicy.ts`.

## Current State

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is readable, but no `Personal AI` list is visible, so no Reminder item can be incorporated or marked done.
- Existing Compose Assist already treats Rehearsal evidence as review-required, shows hover cue scope, and writes accepted / irrelevant feedback through context recall feedback.
- The review state still compresses cue scope, rehearsal script, score, and source into one evidence line. Before the final insert click, this makes the action script harder to scan than the surrounding source-route and draft receipts.

## External Signals

- Gmail Smart Compose and Outlook suggested replies keep writing suggestions lightweight, editable, and feedback-capable instead of sending automatically.
- Prospective memory and implementation-intention research emphasizes binding a future cue to the intended action.
- Context-aware reminder work supports turning complex reminder conditions into explainable cue/action logic.

## Plan

1. Add a compact `预演复核` block in the locked Compose Assist review state when the suggestion includes Rehearsal evidence.
2. Separate the user-critical fields into stable rows: matched cue, rehearsal script, insert boundary, and feedback path.
3. Keep the block hidden for ordinary low-risk and high-risk non-Rehearsal suggestions.
4. Update the direct-insert E2E to assert the new receipt and verify it is absent from high-risk non-Rehearsal review.
5. Update `docs/features/rehearsal.md` and `docs/features/compose_assist.md` with the current behavior.
6. Validate with targeted scripts, `npm start` first successful compile, E2E, and diff checks.
