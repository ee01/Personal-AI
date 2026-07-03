# Message Reaction Followup zero-send boundary plan

## Target

- Feature: `跟进追问 / Followup` from `docs/features/index.md`.
- Current doc: `docs/features/message_reaction.md`.
- Reminder branch: local Reminders is readable, but this Mac has no `Personal AI` list, so no Reminder item is linked or completed in this run.

## External scan

- Boomerang and Superhuman both frame this pattern as "if no reply" follow-up, which means the product must distinguish checking for a reply from sending another message.
- Microsoft Teams message tasks / Recap / Facilitator keep follow-up work anchored to a reviewable task or recap path instead of treating a message action as immediate send.
- Reminder and prospective-memory research supports exposing the cue, timing, and recovery path before the reminder/action is scheduled.

Useful references:

- https://www.boomeranggmail.com/
- https://blog.superhuman.com/reminders/
- https://support.microsoft.com/en-us/office/recap-meetings-in-microsoft-teams-30a984ef-7f4f-4bb2-9c21-49a1ecb0db98
- https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/
- https://weberdo.com/publications/2018-Snooze-Investigating-the-User-Defined-Deferral-of-Mobile-Notifications.pdf

## Finding

The Followup dialog already shows scope and a creation boundary, but the visible run summary always says the system may continue to ask follow-up questions. The advanced field allows `最多追问次数 = 0`, which is a valid bounded-monitor mode, yet the dialog still reads like it will send a future AI follow-up. The submit button text also says `开始追问`, which makes this worse for a user who only wants the system to check the original thread.

## Implementation steps

1. Extract / extend the Followup presentation helper so run summaries include the max-followup setting.
2. Update the dialog to refresh the run summary when either interval or max-followup changes.
3. Change the submit label from immediate-send language to creation language.
4. Keep the pending/submitting receipt explicit when max-followup is `0`: no immediate send, no Google Sheet, no reusable template, and no automatic AI follow-up.
5. Update the Message Reaction E2E script and feature doc.

## Validation

- `npm run verify:message-reaction`
- `npm start -- --progress` until first successful dev compile, then stop
- `npm run verify:message-reaction:e2e`
- `npm run verify:i18n`
- scoped `git diff --check`
