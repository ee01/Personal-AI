# Findings & Decisions

## Requirements
- Pick a random feature from `docs/features/index.md`.
- Verify docs/code are current, inspect defects and UX blockers, do brief external product/paper research, check local Reminders, plan first, implement if low-decision, update docs, test thoroughly, update automation memory, and archive the Codex session when possible.

## Research Findings
- Local Reminders list names are `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; there is no visible `Personal AI` list, so no Reminder item was incorporated or can be marked done.
- `docs/features/scheduled_messages_manager.md` is current for queue health: it documents same-slot queue pressure, 30-minute compensation, no-time 08:00 queue semantics, one-click recovery, success/failure receipts, and latest reference links.
- Existing implementation already calculates `ScheduleHealthIssue`, queue slot summaries, row-order pressure, recovery suggestions, and persistent success/failure receipts in `ScheduledMessagesManager.tsx`.
- UX gap: before the user clicks `一键改期` or `改到建议`, the banner explains risk and suggestion but does not explicitly say the click only writes the `Messages` row, does not send immediately, and requires sync/refresh/Jira polling to confirm current queue health.
- Google Apps Script installable triggers can run as often as every minute but the actual firing time can be randomized and triggers run as the creator account, supporting explicit timing/ownership boundaries.
- Slack scheduled messages are listed/deleted and update is modeled as delete plus re-schedule, reinforcing that scheduled messages should remain manageable objects before delivery.
- Twilio scheduled messages can be created successfully but fail at send time, supporting separate creation/recovery receipts from actual send success.
- Zapier, Power Automate, and Airtable expose run history, replay/resubmit, or troubleshooting details, reinforcing visible recovery state and next-step guidance for automation failures.
- Trigger-action debugging research shows non-programmer users struggle to locate why automations did or did not fire, supporting pre-action explanation of writeback scope and verification path.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add the boundary in the existing banners rather than a new modal | The action is low-risk Sheet row writeback; inline copy is less disruptive and matches existing receipt style |
| Assert the copy in existing E2E scripts | Browser-level checks already exercise the exact banners and apply buttons |
| Avoid backend/data-contract changes | Existing recovery suggestions and receipts already encode the needed behavior |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Broad dirty worktree | Keep the patch scoped to Scheduled Messages and planning files |
| Existing root planning files are stale for this run | Use isolated `.planning` directory |

## Resources
- https://developers.google.com/apps-script/guides/triggers/installable
- https://docs.slack.dev/messaging/sending-and-scheduling-messages/
- https://www.twilio.com/docs/messaging/features/message-scheduling
- https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs
- https://learn.microsoft.com/en-us/power-automate/fix-flow-failures
- https://support.airtable.com/docs/managing-airtable-automations
- https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445567
- https://people.cs.uchicago.edu/~shanlu/paper/UbiComp23.pdf
