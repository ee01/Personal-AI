# Findings & Decisions

## Requirements
- Follow the `personal-ai` random-feature automation loop.
- Keep `docs/features/index.md` and the target feature document current without excessive detail.
- Search comparable products and research for constructive guidance.
- Implement any low-decision unfinished/UX/code improvement.
- Check code quality, bugs, blocking operations, and user experience.
- Check local `Personal AI` Reminders and incorporate related incomplete items.
- Plan first, then implement step by step, then run the strongest practical verification.

## Research Findings
- `docs/progressing/to-verify.md` currently says there is nothing pending.
- Automation memory shows the most recent exact targets include Quick Ask voice, Topic unread, Native Join, Followup, Today Pilot catch-up, Scheduled Messages compensation, Doubao explorer, DigestQueue, Relationship Radar Assistant Draft, Rehearsal, and Message Analysis watch rules. This run avoids those exact slices.
- Randomized feature sample selected `定时消息创建/编辑/删除` under Scheduled Messages as the first viable item.
- Reminder check: AppleScript listed many local Reminder lists but did not expose `Personal AI`; Swift/EventKit did find `Personal AI` with 4 total items and 0 incomplete items.
- Current docs already describe the CRUD core: saved messages focus the just-written row and show a persistent create/update receipt; deletes show a persistent delete receipt; duplicate submit is guarded by an in-flight ref; edit/delete row buttons have readable labels.
- Current code implements create/update/delete through `ScheduledMessageService`, reads live headers before append/full-row update, and has `verify:scheduled-messages-crud-focus:e2e` covering create, edit, delete, target focus, filter receipts, queue details, and duplicate submit.
- UX gap: row edit/delete buttons expose only terse hover text (`编辑消息` / `删除消息`) even though the click either opens a local draft or starts a destructive delete confirmation. Surrounding docs/receipts are good, but the actual control point still does not state no immediate send/write/delete before click, nor whether managed Jira/Outreach follow-up work is involved.
- Slack user docs put scheduled messages in a manage area with edit/reschedule/send/cancel/delete actions; Slack developer docs say updating a pending scheduled message is delete-and-reschedule, so users benefit from knowing whether a click is only edit draft or a queue mutation.
- Microsoft Teams scheduled chat docs expose edit, reschedule, and delete as separate operations on the scheduled message.
- Gmail scheduled-send docs say changing a scheduled email starts with cancel-send and then reschedule; cancel returns the email to draft, reinforcing recoverable edit/cancel semantics.
- Google Messages and Google Chat likewise expose scheduled messages as editable/deletable/manageable objects near the conversation or Drafts area.
- Twilio scheduled-message docs distinguish creation success from send-time failure and require saved message identifiers for cancellation, reinforcing that "saved" is not "sent".
- Trigger-action research on mental models and debugging shows that users mispredict automated rule behavior when trigger/action boundaries and bug states are hidden; CRUD controls should state the direct consequence at the point of action.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Target `docs/features/scheduled_messages_manager.md` and Scheduled Messages CRUD code | The selected index row points to that document and describes Messages table driven create/edit/delete behavior. |
| Use a new isolated `.planning` directory | Existing root planning files are stale and `.planning/.active_plan` pointed at the prior Quick Ask run. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Broad pre-existing dirty worktree | Treat unrelated changes as user/automation-owned and use scoped diffs/checks for files touched by this run. |
| EventKit warning about optional reminder title interpolation | The read-only Reminder probe still returned the needed list/item counts; no code change required. |

## Resources
- `AGENT.md`
- `docs/features/index.md`
- `docs/features/scheduled_messages_manager.md`
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- Slack scheduled messages: https://slack.com/help/articles/201457107-Send-and-read-messages
- Slack developer scheduling docs: https://docs.slack.dev/messaging/sending-and-scheduling-messages/
- Microsoft Teams scheduled chat messages: https://support.microsoft.com/en-us/teams/chat/schedule-chat-messages-in-microsoft-teams
- Gmail schedule send: https://support.google.com/mail/answer/9214606
- Google Messages scheduled messages: https://support.google.com/messages/answer/10456318
- Google Chat scheduled messages announcement: https://workspaceupdates.googleblog.com/2025/12/schedule-messages-send-later-google-chat.html
- Twilio Message Scheduling: https://www.twilio.com/docs/messaging/features/message-scheduling
- Corno et al., Supporting end-user debugging of trigger-action rules: https://www.sciencedirect.com/science/article/abs/pii/S1071581918306529
- Huang and Cakmak, Supporting Mental Model Accuracy in Trigger-Action Programming: https://hcrlab.cs.washington.edu/assets/pdfs/2015/huang2015ubicomp.pdf
- Brackenbury et al., How Users Interpret Bugs in Trigger-Action Programming: https://hewj.info/papers/chi19-ifttt-cameraready.pdf
