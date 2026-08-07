# Findings

## Local State

- `docs/progressing/to-verify.md` says there is no carry-over.
- Automation memory shows the freshest exact feature targets were Message Analysis, Coverage Map, Snooze, Jira Design Links, Topic Messages, Project Dashboard, Agent Workflow, Ask, Compose Assist, Google Slides, and Meeting Pilot; this run avoids those exact targets.
- Random selection from `docs/index.md` chose `Popup Top 3` under Today Pilot.
- EventKit found the `Personal AI` Reminders list with 4 total items and 0 incomplete items. AppleScript did not list `Personal AI`, which matches prior local probe quirks.

## Product/Research Scan

- Gemini Daily Brief presents a daily priority snapshot from Gmail, Calendar, and Gemini chats, with source visibility and direct actions. This supports keeping the popup compact while preserving source/recovery affordances.
- Microsoft 365 Copilot Chat catch-up guidance focuses on summaries of projects, meetings, emails, chats, due items, updates, and recent communications. This supports treating Today Pilot popup as a catch-up entry point, not the entire work queue.
- Slack Unreads/Catch up shows a count and lets users jump to unread conversations or reveal fresh batches. This supports an explicit overflow handoff from a compact summary to the full list.
- Microsoft Research on AI-powered reminders for collaborative tasks highlights how knowledge workers incorporate AI reminders into workflows and want control over reminder interaction.
- Notification batching research suggests batched summaries can reduce attention cost, but hiding everything can increase fear of missing out; compact summaries should preserve a clear way to inspect what was not shown.

## UX Gap

`buildTodayPilotPopupScopeReceipt` already computes hidden-by-Top-3 count and says `另有 N 张需进首页查看`, but the popup only makes the `Today Pilot` title and card bodies clickable. There is no explicit action attached to the overflow count, so a user can miss the recovery path.

## Intended Improvement

Add an explicit `查看全部 N` / `View all N` button in the scope receipt when the popup has hidden visible missions beyond the Top 3. The button should open Today Pilot home and say this is a handoff to inspect the full visible brief, not a refresh, feedback write, source-system mutation, send, or execution.
