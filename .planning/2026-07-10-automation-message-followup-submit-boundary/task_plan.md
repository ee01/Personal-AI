# Message Reaction Followup Submit Boundary

## Target

- Feature: `跟进追问 / Followup` under Message Reaction.
- Source doc: `docs/features/message_reaction.md`.
- Selected from a randomized `docs/index.md` sample after `docs/progressing/to-verify.md` was empty and very recent exact automation targets were avoided.

## Current State

- Followup appears only on the user's own Glip messages and opens a lightweight dialog.
- The dialog already shows a run summary, creation boundary, duplicate-session handling, and zero-auto-followup wording.
- The actual submit button still only says `创建跟进`, so the activation control does not carry the current target, interval, follow-up count, and non-send boundary for hover or assistive tech.

## External Signals

- Gmail Nudges and Google Messages Nudges frame follow-up reminders as prompts to revisit messages, not automatic sends.
- Slack reminders keep reminders anchored to a message/time and provide a management path.
- AI-powered reminder research on collaborative tasks highlights extracted commitments, user workflow fit, and the need to distinguish reminder creation from task completion or message delivery.
- Applied here: Followup should expose the current "create/reuse Outreach session, then check the original thread before any follow-up" boundary directly on the submit control.

## Reminder State

- AppleScript listed Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- Existing completed items are historical Doubao / notification feedback and unrelated to Message Reaction Followup; nothing will be marked done.

## Implementation Plan

1. Add a reusable Followup submit-boundary formatter that combines target, current run summary, and no-side-effect semantics.
2. Wire the formatter into the dialog submit button `title` and `aria-label`, refreshing when interval or max-followup changes and during pending state.
3. Extend the existing Followup presentation tests and `message-reaction-toolbar-check` E2E assertions.
4. Update `docs/features/message_reaction.md` and the `docs/index.md` row concisely.
5. Verify with the focused Followup presentation test, `npm start` first successful compile, `node desktop-app/scripts/message-reaction-toolbar-check.mjs`, and scoped `git diff --check`.
