# Findings & Decisions

## Requirements
- Follow the random docs/features sweep loop: plan first, implement fully, update docs, verify with the repo harness, and close any completed related Reminder items.
- Selected feature: `主题静音` under Topic Messages (`docs/features/topic_based_messages.md`).
- Reminder check: EventKit found `Personal AI` with 4 total items and 0 incomplete items. No open Reminder item related to Topic Messages, topic mute, unread triage, or mute recovery.

## Research Findings
- Slack mute keeps mute as a per-conversation notification control while keeping muted conversations recoverable in settings or UI surfaces.
- Zulip mute separates muted topics from normal feeds/unread counters but keeps them findable through explicit include/recent-conversation paths; prior UX issues show that missing unmute/recovery affordances are a real product risk.
- Email deferral and notification-interruption research both support treating triage actions as reversible/recoverable attention controls, not as deletion or read-state changes.
- Current Personal AI implementation already has local mute state, reason choices, duration choices, undo, persistent muted card note, and no-write restore receipts.
- Gap: after muting from the unread list, the topic disappears and the toast only offers immediate undo. Users who do not undo need an obvious "where did it go?" path to inspect the muted view without scanning the filter tabs.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `查看静音` to the list post-mute toast | Solves the orientation gap at the moment of highest confusion without changing data contracts. |
| Keep Topic Detail unchanged for this pass | Detail already keeps the current topic on screen and exposes persistent cancel-mute state; the list disappearance is the sharper UX bug. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `rg` over broad paths produced very large output and hit missing `scripts` path | Narrowed subsequent reads to the Topic files and verifiers. |

## Resources
- https://slack.com/help/articles/204411433-Mute-channels-and-direct-messages
- https://slack.com/help/articles/360056534254-Manage-notifications-for-specific-channels-and-direct-messages
- https://zulip.com/help/mute-a-channel
- https://zulip.com/help/topic-notifications
- https://github.com/zulip/zulip-mobile/issues/3473
- https://www.microsoft.com/en-us/research/uploads/prod/2018/11/Characterizing_and_Predicting_Email_Deferral_Behavior.pdf
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/
