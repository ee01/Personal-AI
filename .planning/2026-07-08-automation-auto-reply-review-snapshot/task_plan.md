# Auto Reply Review Snapshot Plan

## Goal

Improve the `自动答复 / Reply` PendingReview user journey so the human approval boundary shows the current queue-row snapshot before a reply can be approved or rejected.

## Scope

- Selected feature: `自动答复 / Reply` under Message Reaction.
- Main files: `src/scheduled-messages/ScheduledMessagesManager.tsx`, `tools/verify-scheduled-messages-status-actions-e2e.mjs`, `docs/features/message_reaction.md`, `docs/index.md`.
- Out of scope: changing AutoReplyHandler queue creation, LLM generation, ScheduledMessageService writes, Google Sheets schema, trigger matching, or actual send behavior.

## Plan

1. [complete] Read AGENT.md, to-verify, automation memory, feature index, existing docs/source/tests, Reminders, and external references.
2. [complete] Add a richer PendingReview row receipt with current body preview, schedule/method snapshot, approve/reject effects, and local snapshot boundary.
3. [complete] Update E2E assertions and concise feature docs/index wording.
4. [complete] Run targeted tests, dev compile, browser-level E2E, and scoped whitespace checks.
5. [complete] Update automation memory and close out Reminder state honestly.

## Validation Targets

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:message-reaction`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node --check tools/verify-scheduled-messages-status-actions-e2e.mjs`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start -- --progress` until first successful compile, then stop
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node tools/verify-scheduled-messages-status-actions-e2e.mjs`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node tools/verify-auto-reply-readiness-e2e.mjs`
- Scoped `git diff --check`

## Errors

| Error | Resolution |
|---|---|
| `node` was not found in PATH | Use `$HOME/.nvm/versions/node/v24.13.0/bin` for Node/npm commands |
| AppleScript did not list `Personal AI` Reminders | EventKit fallback found the list with 4 completed, 0 incomplete items |

## Validation Results

- `npm run verify:message-reaction`: passed 93/93.
- `node --check tools/verify-scheduled-messages-status-actions-e2e.mjs`: passed.
- `node --check tools/verify-auto-reply-readiness-e2e.mjs`: passed.
- `npm start -- --progress`: first successful webpack dev compile in 15973 ms, then stopped.
- `node tools/verify-scheduled-messages-status-actions-e2e.mjs`: passed.
- `node tools/verify-auto-reply-readiness-e2e.mjs`: passed.
- `npm run verify:message-reaction:e2e`: passed.
- Scoped `git diff --check`: passed.
- Process cleanup check found no remaining webpack watcher, Auto Reply/Scheduled Messages E2E, Playwright, or Chromium test process.
