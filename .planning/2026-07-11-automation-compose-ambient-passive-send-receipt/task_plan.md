# Compose Assist Passive Send Calibration Receipt

## Context

- Automation target: `回复助手无感校准` from `docs/features/index.md`.
- Source docs: `docs/features/compose_assist.md` and `docs/features/memory_system.md`.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found the list with 4 total items and 0 incomplete items, all completed historical Doubao/test feedback, so no Reminder item is incorporated or marked done.
- Recent automation memory already covered direct insert, thumb-down, and several adjacent Compose/Message/Memory surfaces. This run focuses on the passive `sent_without_insert` path after a user actually dwells on a suggestion and sends their own reply.

## External Scan

- Gmail Smart Compose keeps suggestions lightweight, user-accepted, and configurable, with personalization scoped to the user's own account: https://support.google.com/mail/answer/9116836
- Outlook suggested replies expose an explicit off switch and keep replies user-controlled before sending: https://support.microsoft.com/en-us/outlook/how-do-i-turn-off-suggested-replies
- The Smart Compose paper frames assisted writing as real-time interactive suggestions, not automatic sending: https://arxiv.org/abs/1906.00080
- Interaction-Required Suggestions argues that human involvement in generation improves control, ownership, awareness, and fine-grained agency: https://arxiv.org/abs/2504.08726

## Plan

1. Keep the current hover/focus dwell gate and backend privacy gate unchanged.
2. Add a short visible receipt only after a real `sent_without_insert` trace attempt, explaining that the user viewed a suggestion, sent their own reply, and Personal AI is recording only a redacted calibration signal.
3. Make the receipt update from pending to stored/duplicate/failed/unavailable using the same calibration result path as thumb-down and inserted receipts.
4. Update the existing ambient calibration E2E to assert the passive-send receipt and its privacy/no-global-silence boundary.
5. Update concise feature docs and index wording for the new visible receipt.
6. Verify with the targeted Compose Assist tests, `npm start` first successful compile, the ambient E2E, and scoped `git diff --check`.

## Non-goals

- Do not change recall, ranking, threshold math, prompt generation, Memory Service trace schema, writing-style aggregation, or cue/outcome policies.
- Do not add a feedback form or require a user decision before passive calibration.
- Do not mark any Reminder done because no open related item exists.
