# Jira Issue Key Recovery Scope Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders list names were readable, but no list named `Personal AI` exists.
- Memory notes show previous Jira Design Links work added `只读恢复` tags for query/data/ARIA/raw-text recovery, terminal filtering for Figma/Zeplin non-handoff URLs, and visible updated-time basis chips.

## Research Notes

- Figma for Jira exposes linked design files/prototypes, real-time design status, and Dev Mode status inside Jira when the Figma file is explicitly linked to the issue. This reinforces that Personal AI's recovered issue keys should not look like official Figma/Jira design links unless Jira exposed that relationship clearly.
- Figma Dev Mode treats Ready for dev status and notifications as part of the developer handoff loop. Jira Design Links should continue surfacing official status/updated signals, but weakly recovered UX keys should stay marked as candidates.
- Zeplin for Jira similarly centers attached screens, sections, projects, and flows on Jira issues. A raw/query/ARIA recovered UX key is weaker than an attached Zeplin/Figma design resource and needs a visible boundary.
- Atlassian issue linking and remote issue linking are designed to add explicit context and relationships to Jira issues. Personal AI's recovery path reads visible page evidence but does not create those Jira relationships.
- Issue-link research over 16 Jira repositories reports that link practices and link types vary substantially across projects and maintainers. This supports showing recovered key scope instead of assuming every visible key means the same relationship.
- 2025 traceability-link recovery research says RAG/LLM approaches improve automatic recovery, but the performance still may not be enough for full practical automation. This supports keeping recovered UX tickets as reviewable, read-only candidates.

## Code Findings

- `docs/features/jira_design_links.md` is current for query/data/ARIA/raw-text recovery and read-only tags.
- `src/jiraDesignLinks.ts` already has row-level helpers: `getUXTicketKeySourceLabel`, `getUXTicketKeySourceHint`, `getUXTicketKeyRecoveryBoundaryLabel`, and `getUXTicketKeyRecoveryBoundaryHint`.
- `src/contentScriptJira.ts` renders the row-level `Key from ...` and `Read-only recovered` chips for non-standard key sources, but there is no panel-level first-visible receipt when multiple recovered candidates are mixed into the design rows.
- `tools/verify-jira-design-links-e2e.mjs` already has a fixture with four non-standard recovered candidates, making it a good target for a panel-level receipt assertion.
