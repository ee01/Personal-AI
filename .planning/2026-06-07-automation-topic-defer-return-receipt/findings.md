# Findings & Decisions

## Requirements
- Feature selected from `docs/index.md`: `主题稍后处理` under Topic Messages, source doc `docs/features/topic_based_messages.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Reminders: local Reminders lists are accessible, but no `Personal AI` list exists; no Reminder item can be incorporated or marked done.
- Automation memory recent targets include Timeline/Search safe jump, Project Dashboard source checks, Memory Lens, Today Pilot, Storyline, Scheduled Messages, User Profile, Jira Design Links, Ask, Prompt Config, Google Slides, Memory Capture, Notification Center, Message Reaction, Jira Automation Import, and others. Avoid repeating them.

## Research Findings
- Gmail Snooze temporarily removes mail from the inbox and returns it to the top at a chosen time; snoozed items are still findable under `Snoozed` and `in:snoozed`. Product implication: defer state should show the return time and recovery location.
- Slack Later separates saved/reminder items into `In progress`, `Archived`, and `Completed`; reminders can be dated, edited, and filtered. Product implication: deferred Topic state should be inspectable and distinguish pending-vs-due, not behave like hidden read state.
- Microsoft Teams Saved lets users revisit saved messages in context, even when the saved item changes or is deleted. Product implication: Topic defer should preserve the original unread topic context and not imply message-level completion.
- Zulip topic mute hides muted topics from high-noise feeds while keeping them findable with explicit filters; mute is separate from defer because it changes notification/noise handling, not return timing.
- `Characterizing and Predicting Email Deferral Behavior` (WSDM 2019) reports that users defer when messages require careful reading, replies, links, or attachments, and that deferral is common in weekday triage. Product implication: defer receipts should answer "why is this out of my unread flow, and when will it come back?"
- `A Snooze-less User-Aware Notification System for Proactive Conversational Agents` frames snoozing as a response to alert fatigue and missed alerts. Product implication: defer should reduce noise but include a visible return boundary so users do not forget important topics.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Focus on the defer return path and user-visible receipt | The docs already call out local-only defer state and restore semantics; the likely UX risk is hidden timing/source of local state rather than a backend mutation. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- `docs/features/topic_based_messages.md`
- `src/modals/memory-store.ts`
- `src/modals/components/EntityListPage.vue`
- `src/modals/components/TopicDetailPage.vue`
- `tools/verify-topic-based-messages.ts`
- `tools/verify-topic-based-messages-e2e.mjs`
