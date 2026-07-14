# Findings

## Repo / Reminder

- `docs/progressing/to-verify.md` says there are no pending verification items.
- Automation memory shows the freshest runs already covered Skill Foundry, Relationship Radar, Message Analysis, Memory Capture, Jira Design Links, Google Slides, Rehearsal, Project Dashboard, Quick Ask, and nearby trust-boundary surfaces.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No Reminder item is available for this timeline improvement.

## Current Timeline State

- The timeline page already has page-level receipts for scope/range/source, empty states, refresh-in-progress snapshots, refresh failures, safe-link status, navigation receipts, and feedback receipts.
- The actual controls that change or refine the page are weaker: range tabs, scope tabs, source select, source overview chips, refresh, and empty-state recovery buttons do not consistently expose pre-click `title` / `aria-label` boundaries.
- Best bounded improvement: move the existing page-level trust contract onto these controls without changing behavior.

## External Scan

- Microsoft Recall exposes timeline-style revisiting with privacy controls, app/site filtering, and explicit snapshot-saving boundaries. This supports making filter and refresh consequences visible at the control point.
- Google My Activity lets users review/manage history and filter by date/product/keyword. This supports distinguishing timeline narrowing from deletion or global account changes.
- THEANINE / timeline-based memory management research argues that temporal/cause-effect memory timelines preserve contextual cues for long-term agents. This supports keeping time/source/scope controls explanatory instead of hiding context behind one flat list.
- Personal information management and refinding research emphasizes partial contextual cues, navigation, and source/path context. This supports showing whether a control re-reads data, narrows an existing set, or keeps the last snapshot.

