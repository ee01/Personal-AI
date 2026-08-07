# Findings & Decisions

## Requirements

- Pick one random feature from `docs/index.md`.
- Confirm docs are current enough and keep them concise.
- Scan related industry products and research.
- Check local `Personal AI` Reminders and fold in related open feedback.
- Plan first, then implement, then verify as strongly as practical.

## Feature Selection

- Selected `项目证据修复路径` under Project Dashboard.
- Recent automation targets covered Doubao Bridge, Native Join, Notification Center, Message Reaction, Message Analysis, Jira Design Links, Google Slides Analyzer, Memory Service, Agent Thinking, Topic Messages, Meeting Pilot, Relationship Radar, Memory Capture, Scheduled Messages, Today Pilot, and Skill Foundry, so those exact/family targets were skipped.
- `docs/progressing/to-verify.md` had no carry-over items.

## Reminder Findings

- EventKit access succeeded.
- `Personal AI` list exists with 4 total items and 0 incomplete items.
- All existing items are completed historical Doubao / Notification / test feedback, not related to Project Dashboard evidence repair.
- No Reminder item should be marked done for this run.

## External Product And Research Scan

- Atlassian Advanced Roadmaps missing-issue troubleshooting names concrete reasons for missing plan data, including issue source, release scope, manual exclusion, workflow resolution, and hidden Fix version fields, then routes to the relevant fix.
- Linear project updates/status treats project health as a manual, contextual status rather than an automatic consequence of issue completion. That supports not overclaiming that opening a local task means project truth was confirmed.
- Easy Agile dependency reporting exposes filters, dependency health, and external dependency uncertainty; this supports showing the calculation basis and unknowns near the action.
- Traceability research, including Comet and EALink, frames project evidence links as useful but often incomplete; repair should surface candidate links and uncertainty instead of presenting a single source as authoritative.

## Code Findings

- `src/components/dashboard/ProjectDashboard.tsx` already has complete boundaries for evidence queue buttons and data-source repair action buttons.
- `openEvidenceGapQueueItem()` records a detailed local repair receipt after click.
- `runLocalEvidenceRepairAction()` records a local repair receipt for data-source plan/ETA/source actions.
- Cross-project `.focus-item` buttons and project-level `.project-alert` buttons also open task detail but only expose `title={item.task.desc || item.task.title}` and no `aria-label`. This is weaker than surrounding evidence-repair controls and does not say whether the click reads/writes external systems.
- `tools/verify-project-dashboard-e2e.mjs` already covers evidence queue expansion, detail repair, data-source repair, and close boundaries. It should assert the newly added focus/priority boundaries on real rendered buttons.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Add a local helper in `ProjectDashboard.tsx` | The needed copy depends on already-built UI item data and does not require a shared data contract. |
| Use `title` plus `aria-label` | Matches the repository pattern for click-before boundary copy and screen-reader visibility. |
| Keep docs concise | The canonical doc already describes button-level repair boundaries; only add focus/priority entry wording if changed behavior needs to be discoverable. |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Repo has unrelated dirty state from prior automation runs. | Work only in Project Dashboard files, docs/index rows for this feature, planning files, and automation memory. |
