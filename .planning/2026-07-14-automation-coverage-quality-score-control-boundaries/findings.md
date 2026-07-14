# Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows very recent exact or adjacent work on Meeting Pilot ASR, Snooze quick menus, Memory Timeline, Skill Foundry, Relationship Radar, Message Analysis, AR Data, Today Pilot, Jira Design Links, Agent Workflow and related control-boundary sweeps.
- `Coverage 质量分` already documents score snapshot, score boundary, priority focus, and low-score sort receipts.
- Current UI gap: the clickable controls around those receipts do not all carry the same pre-click `title` / `aria-label` boundary. Specifically, `查看平台`, `默认`, `低分优先`, and `刷新切片` rely on surrounding text.
- EventKit Reminders result: `Personal AI` exists, total 4, incomplete 0.

## External Scan

- Microsoft 365 Copilot connector index browser exposes index status, last refresh time, metadata and ACL checks, supporting the idea that source health dashboards should separate read-only inspection from crawl/sync or permission repair.
- IBM's data quality dimensions overview highlights accuracy, completeness, consistency, timeliness, validity and uniqueness. Coverage quality score should continue to say it measures only observable coverage health and freshness, not factual correctness or answer readiness.
- PIM information-fragmentation research describes fragmentation across software, time and personal projects; Coverage Map is valuable because it makes scattered personal sources visible before retrieval or automation relies on them.
- New America's AI agents and memory analysis argues that persistent cross-service memory creates visibility and control questions; UI-level memory dashboards should make what is remembered and which services are involved reviewable.

## Constructive Direction

Make the exact controls say what they do before click:

- `查看平台`: only selects the platform in the current Coverage snapshot and repair panel.
- `低分优先`: only reorders active / derived platform cards in the current frontend snapshot.
- `默认`: returns to API/default group order without refreshing or recalculating scores.
- `刷新切片`: rereads only the four P0 diagnostic slice APIs, not `/coverage/map` or provider sync.
