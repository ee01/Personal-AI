# Jira Design Field Filter Receipt Plan

Goal: improve the selected `Figma/Zeplin 保守分类` feature by making filtered UX design-field links unambiguous, keeping docs current, and verifying the Jira Design Links user path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, `docs/progressing/to-verify.md`, automation memory, Reminders, memory guidance, package scripts, and current dirty status |
| 2 | completed | Inspect Jira Design Links docs, source rendering/classification code, and focused verifier/E2E coverage |
| 3 | completed | Search current Figma/Jira, Zeplin/Jira, and design-handoff research/product references |
| 4 | completed | Implement a concise first-screen receipt for UX design-field non-handoff filters |
| 5 | completed | Update verifier/E2E assertions plus feature docs/index |
| 6 | completed | Run targeted verification, first `npm start` compile, E2E, and scoped whitespace checks |
| 7 | completed | Update automation memory, Reminder state if needed, and close out |

## Decisions

- Selected feature: `Figma/Zeplin 保守分类` under Jira Design Links.
- Source doc: `docs/features/jira_design_links.md`.
- Relevant Reminder state: EventKit found `Personal AI`, but all 4 items are already completed and unrelated to Jira Design Links.
- Existing worktree is broadly dirty. Keep ownership limited to Jira Design Links source/verifier/docs/index plus this planning directory and automation memory.
- Implementation slice: if filtered Figma/Zeplin-like URLs include `design_field`, show a visible `设计字段被过滤` tag and tooltip explaining that those URLs were scanned but remain non-handoff, so a UX ticket can still show `Missing link`.

## External Scan Summary

- Figma for Jira and Atlassian/Figma docs emphasize live design status and linked design context inside Jira.
- Zeplin for Jira supports attaching screens, sections, components, projects, and other concrete handoff resources to Jira issues.
- Handoff research and CHI work emphasize that one-time handoff artifacts are often insufficient without clear collaboration context and artifact validity.
- Product implication: conservative filtering is correct, but the UI must distinguish “field scanned but only non-handoff refs found” from “field not scanned.”

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `node` missing from shell PATH | Package script inspection | Use `$HOME/.nvm/versions/node/v24.13.0/bin` per repo guidance |
| `shuf` missing on this macOS host | Random shortlist command | Re-ran randomization with Perl `List::Util::shuffle` |
| CSS hover bug suspected from truncated output | Initial render skim | Re-opened exact source lines and confirmed it was output truncation, not a source bug |
| E2E filter-scope tooltip assertion mismatch | First `verify:jira-design-links:e2e` run | Changed UI tooltip to the clearer asserted wording `设计字段已扫描...` and reran build/E2E |
