# Topic Defer Control Boundaries

## Selected Feature

- Feature: `主题稍后处理`
- Capability: Topic Messages
- Source docs: `docs/features/topic_based_messages.md`
- Index row: `docs/features/index.md`

## Current State

- `docs/progressing/to-verify.md` is empty, so this run selects a fresh feature.
- Automation memory shows several very recent Meeting Pilot, Notification Center, Doubao, Message Analysis, Jira Import, Scheduled Messages, Today Pilot, AR Data, Skill Foundry, Agent Workflow, Jira Design Links, Rehearsal, Project Dashboard, and Relationship Radar sweeps. The first random Memory Capture candidate had a close July 9 selection-capture pass, so this run uses the next suitable Topic Messages candidate.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items; no Reminder feedback is related to Topic Messages defer.

## External Scan

- Slack Later keeps saved items in a dedicated Later area with In progress / Archived / Completed tabs, and lets users jump back to original conversations or set reminders.
- Gmail Snooze temporarily removes email from the inbox and brings it back at a chosen later time; snoozed mail is findable under Snoozed / `in:snoozed`.
- Microsoft Teams Saved keeps saved messages in a Saved section and opens them back in their original conversation context.
- Email deferral research frames defer as a common triage action when handling requires more time, careful reading, replies, links, or attachments.
- Conversation curation research frames re-entry as a first-class problem for deciding whether users should be brought back to a thread.

## UX Gap

The list and detail pages already show defer boundary receipts after opening menus and after restoring. The remaining gap is at the exact control point: several `稍后处理`, `恢复`, and `查看稍后` buttons still have short or missing hover / screen-reader copy, so a user can click before seeing whether the action writes only local defer state, marks read, syncs Memory Service, or touches the original chat platform.

## Implementation Plan

1. Add reusable boundary-label helpers for Topic defer controls in `EntityListPage.vue`.
2. Add matching detail-page boundary-label helpers in `TopicDetailPage.vue`.
3. Apply the labels to menu-open, preset/custom defer, toast view/restore, persistent restore, and hidden-unread recovery controls via `title` and `aria-label`.
4. Update `tools/verify-topic-based-messages.ts` and `tools/verify-topic-based-messages-e2e.mjs` so targeted and browser checks prove the button-level boundaries.
5. Update `docs/features/topic_based_messages.md` and the `主题稍后处理` row in `docs/features/index.md`.
6. Validate with `verify:topic-based-messages`, `npm start` first successful compile, `verify:topic-based-messages:e2e`, and scoped `git diff --check`.

## Non-Goals

- Do not change localStorage schema for deferred topics.
- Do not add backend read-status or defer-sync APIs.
- Do not change unread ranking, hidden-count logic, restore behavior, source-link safety, mute behavior, or Memory Service writes.
