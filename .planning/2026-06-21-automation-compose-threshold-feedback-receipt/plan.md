# Compose Assist Threshold Feedback Receipt

## Target

- Random feature: `回复助手阈值与反馈`
- Source doc: `docs/features/assist.md`
- Scope: thumb-down feedback receipt for Compose Assist, not direct insert, Web AI source routing, or ambient calibration privacy rules.

## Product / Research Direction

- Gmail Smart Compose and Outlook Suggested Replies keep writing suggestions low-friction, editable, and user-controlled.
- Smart Compose research emphasizes real-time suggestion quality and practical serving constraints.
- Interaction-Required Suggestions argues for agency, ownership, and fine-grained control in co-writing interfaces.
- Decision: keep thumb-down as a one-click low-burden signal, but make the exact surface-scoped threshold update visible so the user can tell what changed.

## Implementation Plan

1. Keep thumb-down hiding immediate and non-blocking.
2. Return the saved threshold event from `recordAssistFeedback()`.
3. Show feedback receipt state transitions for threshold persistence: saving, saved with `before -> after`, or failed.
4. Preserve the separate ambient calibration receipt state, because local UI gating and backend learning are different trust boundaries.
5. Update docs and the existing direct-insert E2E assertion for the ChatGPT surface threshold case.

## Verification Plan

1. Run the targeted ComposerGuard node test.
2. Run `npm start` until the first successful compile and stop the watcher.
3. Run `node tools/verify-compose-assist-direct-insert-e2e.mjs`.
4. Run scoped `git diff --check` for touched files.
