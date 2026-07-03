# Jira Design Links Filter Scope Receipt

## Target

- Random feature: `Figma/Zeplin 保守分类` in `docs/features/index.md`.
- Source of truth: `docs/features/jira_design_links.md`.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item is available for this target.

## External Signals

- Figma for Jira treats linked design files/prototypes, `Ready for dev`, `Design updated`, and update timestamps as Jira-facing handoff context.
- Zeplin for Jira attaches screens, sections, projects, components, and flows to Jira issues; profile, documentation, marketing, and settings pages are not equivalent handoff resources.
- Traceability research says auxiliary artifacts influence link quality and interpretation, so filtered design-tool references should be explained where users read the candidate links.

## Plan

1. Keep the current conservative URL classification rules for Figma and Zeplin.
2. Add a visible mixed-result receipt when real handoff entries and filtered non-handoff refs appear together.
3. Preserve the existing filtered-only empty-state receipt and no-write Jira boundary.
4. Update E2E assertions and canonical docs.
5. Verify with the feature script, dev compile, E2E, i18n check, and scoped diff check.

## Acceptance

- Mixed Jira fixture shows `过滤范围` / `Filter scope` without requiring footer hover.
- The receipt states non-handoff design-tool links were filtered and that Personal AI does not create or edit Jira.
- Design entry count remains the count of actual handoff rows, not including the receipt.
