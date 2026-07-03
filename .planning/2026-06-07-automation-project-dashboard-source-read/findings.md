# Findings & Decisions

## Requirements
- Automation task: choose a random feature from docs/features/index.md, compare docs to current code, research similar products/papers, implement low-decision improvements, validate deeply, and update Reminders only when related Personal AI items exist.
- Carry-over check: docs/progressing/to-verify.md says "暂无。".
- Reminder check: local Reminders is accessible, but no list named "Personal AI" exists. No Reminder items can be incorporated or marked done.
- Random feature selected: 项目数据源检查 under Project Dashboard, source doc docs/features/brain_like_project_analysis_system.md.

## Research Findings
- Atlassian Jira dashboard gadgets summarize project/work-item data and are configurable around relevant work-item details, so Personal AI should be explicit about which sources it has and has not read.
- GitHub Projects status updates expose current status plus start/target dates; status is a user-visible artifact rather than an implicit side effect of a sync button.
- Linear Project Graph is based on issue activity and estimates and updates on a cadence, reinforcing that project graphs need enough structured source data before they should be trusted.
- Asana project/smart status combines health indicators, dates, and drafted updates, but asks users to choose status/scope and review generated status.
- Dashboard-design research highlights data quality, mismatched expectations, and verification challenges, which maps to this UX gap: users need the local evidence quality surfaced before they trust source status.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `localEvidence` to `ProjectSyncReadiness` | Keeps the receipt in the backend message contract, reusable for status toast, header, and E2E assertions. |
| Classify local evidence as `ready`, `attention`, or `empty` | Matches current Product Dashboard language without implying ML prediction or external authority. |
| Keep the action focused on ETA/source repair | Current local coverage model already computes ETA/source coverage and samples missing source tasks; this is the smallest product-visible fix. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Worktree already broadly dirty | Touch only Project Dashboard source/doc/test/planning files; do not stage or revert unrelated changes. |

## Resources
- https://support.atlassian.com/jira-cloud-administration/docs/use-dashboard-gadgets/
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/sharing-project-updates
- https://linear.app/docs/project-graph
- https://help.asana.com/s/article/smart-status
- https://arxiv.org/abs/2209.06363
