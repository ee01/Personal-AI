# Jira Design Field Filter Receipt Findings

## Initial Context

- `docs/progressing/to-verify.md` is empty.
- Latest automation memory already covered Topic Messages, Project Dashboard, Agent Workflow, Relationship Radar, Task Scheduler, Memory Capture, and adjacent surfaces. This run avoids those exact recent targets.
- EventKit Reminders check found the local `Personal AI` list with 4 total items, all completed historical Doubao/Notification/test items. No open item relates to Jira Design Links, Figma/Zeplin handoff, filtered design links, or UX ticket design fields.
- The repository has a broad pre-existing dirty worktree. Do not revert unrelated changes.

## Code And UX Findings

- `docs/features/jira_design_links.md` is broadly current: it documents Figma/Zeplin conservative classification, filtered-only rows, mixed filter-scope receipts, source/reason summaries, safe open receipts, and no-write Jira boundaries.
- `src/jiraDesignLinks.ts` already filters Figma Community/help/blog and Zeplin profile/settings/support/marketing URLs, including when generic design-field links are otherwise allowed.
- `src/contentScriptJira.ts` already merges filtered refs from description, Jira Designs, remote links, and UX ticket design fields into a visible `过滤范围` receipt and footer source/reason tags.
- UX gap: when a UX ticket design field contains only filtered design-tool URLs, the user sees a `Missing link` row plus a generic `Design field 1` source summary. It does not explicitly say that the design field was scanned and rejected as non-handoff, which can look like a contradiction.
- Low-decision improvement: add a visible design-field-specific filter tag/tooltip to the existing filter receipt and filtered-only row. This is presentation-only and preserves all classification, Jira API, URL safety, and write boundaries.

## External Reference Findings

- Figma Help says Jira integration brings live design context into backlog/sprints, including linked files/prototypes, previews, and design status in Jira.
- Zeplin's Jira integration describes attaching concrete screens, sections, components, component groups/sections, or projects to issues/tasks.
- Atlassian/Figma community material frames design links in Jira as context needed directly in the issue, including multiple designs when needed.
- Design handoff research and CHI work point away from opaque one-time handoff artifacts and toward clear context/co-creation support; here that means explaining filtered field evidence rather than silently hiding it.
