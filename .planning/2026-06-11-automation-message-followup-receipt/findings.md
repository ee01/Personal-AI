# Findings

## Local Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders are readable but there is no `Personal AI` list, so no Reminder item is related or completed this run.
- The selected feature is `跟进追问 / Followup` under Message Reaction, from `docs/features/message_reaction.md`.
- Existing implementation already creates `POST /api/v1/outreach/sessions/from-message`, dedupes by original chat/post id, and returns the existing session without overwriting the original completion standard.
- Existing E2E (`npm run verify:message-reaction:e2e`) already covers the Followup dialog, required goal, clamped interval/max-followup values, success toast, review deep link, and duplicate-session toast.

## External Reference Notes

- Slack reminders support setting reminders from messages/files and returning to the item later; useful product pattern: keep the reminder anchored to the original message.
- Microsoft Teams Recap exposes follow-up tasks alongside meeting artifacts; useful pattern: follow-ups should remain visible in a review/task path, not only as a transient action.
- Boomerang's no-reply follow-up model emphasizes conditional follow-up after no response; useful pattern: explain the if-no-reply condition at setup time.
- Prospective memory / implementation-intention research frames future action as cue plus intended behavior; useful pattern: the UI should name the cue and the intended completion standard.

## Chosen Improvement

Add a compact `创建边界` receipt inside the Followup dialog before submission. It should say the click creates or reuses a one-off Outreach session for the current conversation/original message, first checks whether the original thread already satisfies the completion standard, only asks again if still unmet, and does not immediately send a message, write Google Sheet, or create a reusable Outreach template.
