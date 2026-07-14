# Auto Reply Save Button Boundary Plan

## Goal

Improve the `自动答复 / Reply` rule-save control point so the final `确认` / `保存` button carries the current auto-reply consequence in hover and screen-reader text.

## Selected Feature

- Feature: `自动答复 / Reply`
- Capability: Message Reaction
- Source doc: `docs/features/message_reaction.md`
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items; no Auto Reply-related Reminder feedback is open.

## External Scan

- Gmail suggested replies and Outlook suggested replies keep the generated text editable before the user sends.
- Intercom Fin human-in-the-loop approvals pause critical procedure steps for teammate review.
- The Smart Reply paper frames generated replies as response suggestions, not hidden sends.
- Product implication: Personal AI should repeat the rule-save boundary at the activation button, not only in nearby explanatory panels.

## Scope

- In scope:
  - Add a small Auto Reply save-button boundary helper.
  - Mirror that helper into `title` and `aria-label` for add/edit rule save buttons.
  - Update focused unit/E2E assertions and concise docs.
- Out of scope:
  - Auto Reply matching, LLM generation, Scheduled Messages creation, Google Sheets writes, review approval/rejection, RingCentral sends, history dedupe, or Reminder mutations.

## Plan

1. [complete] Record plan and current findings.
2. [complete] Add save-button boundary helper and wire it into add/edit buttons.
3. [complete] Update Auto Reply tests and E2E assertions.
4. [complete] Update feature docs and feature index.
5. [complete] Run targeted verification, dev compile, scoped whitespace check, and process cleanup check.

## Validation Targets

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:message-reaction`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node --check tools/verify-auto-reply-readiness-e2e.mjs`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start -- --progress` until first successful compile, then stop
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node tools/verify-auto-reply-readiness-e2e.mjs`
- Scoped `git diff --check`

## Notes

- The worktree is broadly dirty before this run. Treat this run as owning only the save-button boundary helper/UI, matching tests/docs, this planning directory, `.planning/.active_plan`, and the automation memory update.

## Validation Results

- `npm run verify:message-reaction`: passed 96/96.
- `node --check tools/verify-auto-reply-readiness-e2e.mjs`: passed.
- `npm start -- --progress`: webpack dev compile succeeded in 14696 ms, then watch was stopped.
- `node tools/verify-auto-reply-readiness-e2e.mjs`: passed.
- `npm run verify:message-reaction:e2e`: passed.
- Scoped `git diff --check`: passed.
- Narrow process cleanup check found no remaining webpack watcher, Auto Reply readiness E2E, Message Reaction toolbar E2E, or matching temp browser profile process from this run.
