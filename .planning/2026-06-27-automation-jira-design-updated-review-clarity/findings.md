# Jira Design Links Updated Review Clarity Findings

## Local Findings

- `docs/progressing/to-verify.md` is empty.
- Recent automation memory says to avoid User Profile export, Agent Workflow, and Dream Replay; this run selected `设计链接更新时间展示`.
- Local Reminders list `Personal AI` is absent. Visible lists are `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, and `菜头`.
- Current Jira Design Links docs and code already support updated-time source chips, missing updated-time labels, update review scope summaries, non-handoff URL filtering, and read-only recovered issue-key receipts.

## External Reference Findings

- Figma Jira integration docs say Jira shows real-time design status after a Figma file is linked, including `Design updated` and `Ready for dev`; updates come from file-level webhooks when Dev Mode status changes or the file changes.
- Atlassian JQL design search exposes `design[status]`, `design[type]`, `design[lastUpdated]`, and `design[totalCount]`, and `design[lastUpdated]` is a date field intended for finding issues with recent design updates.
- Atlassian automation design smart values expose `{{design.status}}`, `{{design.url}}`, and `{{design.updatedDate}}`, with `updatedDate` documented as a UTC timestamp for the design's last update.
- Figma Dev Mode ready-for-dev view supports recent activity sorting and status-oriented handoff. That reinforces showing not just a date but the basis of that date in Jira handoff surfaces.
- Requirements traceability research on auxiliary artifacts says metadata and supporting artifacts can affect trace-link quality and validation, supporting visible source/basis labels for recovered design-update metadata.

## Candidate UX Gap

- The current UI shows row-level `状态时间` / `对象日期` / `链接时间` chips, but the top `复查范围` summary only shows `最新 <date>`.
- A user scanning the top receipt can tell that a design update exists, but not whether the latest date came from Figma/Jira status metadata, object metadata, or remote-link metadata without hovering or inspecting rows.
- Proposed narrow fix: add a visible latest-source/basis chip to the `复查范围` row while keeping existing row-level chips, tooltips, sorting, and non-write boundaries unchanged.
