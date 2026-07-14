# Findings

## Repo

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the most recent exact targets were Rehearsal management, Project Dashboard data-source close, Quick Ask status card, Notification Center feed, Meeting Pilot side panel, User Profile export, Task Scheduler next-step, Google Slides writeback, Decision Center, Scheduled one-click setup, Ask active answer, and Native Join manual recovery.
- Randomized `docs/features/index.md` sample included `Figma/Zeplin 保守分类`; this was selected after avoiding the newest exact/family targets.
- Existing Jira Design Links implementation already filters Figma Community/help/blog/marketing and Zeplin profile/settings/marketing pages and exposes scan/filter receipts.

## Reminders

- AppleScript listed local Reminders lists but did not expose `Personal AI`.
- EventKit read-only fallback found `Personal AI`.
- `Personal AI` has 4 total items and 0 incomplete items.
- No Reminder item is related to this Jira Design Links pass, so nothing should be marked done.

## External Scan

- Atlassian Jira + Figma support docs show Jira issue views can link Figma designs and show design update state, which supports exposing link/update/review boundaries.
- Figma Jira integration docs frame the value as live design context in backlog/sprints and real-time design status, so Personal AI should not overclaim live inventory when it only scans the current Jira-visible batch.
- Zeplin Jira docs and marketplace copy focus on attaching screens/sections/projects to issues and opening/previewing designs, reinforcing that open controls need to distinguish navigation from writeback or review confirmation.
- Design handoff / co-creation research argues design tools should move beyond one-time handoffs toward clearer collaboration contexts; traceability research shows artifact links are often incomplete and untrustworthy unless their basis is visible.

## UX Gap

- Post-click `来源打开回执` is already strong.
- Pre-click anchors still expose mostly raw URL/ticket-key `title` values and lack a control-level `aria-label` boundary.
- A user hovering or using assistive tech before clicking can still misread a design/UX link open as refreshing Figma/Zeplin, confirming review, or creating a Jira relationship.

## Proposed Fix

- Add a shared pre-click open-boundary label derived from the same metadata used by the existing post-click receipt.
- Bind that label to each design, UX ticket, and UX Epic anchor's `title` and `aria-label`.
- Include update-context and recovered-key context when present.
