# Jira Design Links Open Receipt

## Target

- Random feature: `docs/features/jira_design_links.md`.
- User persona: a developer opening Jira design handoff links before implementation who cares whether the click only opens a source or also refreshes, reviews, or writes Jira/Figma state.
- Current browser check: `webpage-mcp` found Jira Dashboard and Issue Navigator tabs, but no inspectable Jira issue detail tab; use the repo's Jira fixture E2E for the complete content-script experience.
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list.

## Gap

The panel already explains scan, filter, recovery, and update-review boundaries before the user clicks. After the user opens a design link, UX ticket, or UX Epic from the panel, the original Jira page has no visible receipt saying what happened. A cautious user can misread the click as a fresh design review, a Jira relationship confirmation, or a Figma refresh.

## Plan

1. Add a compact `来源打开回执` row inside the existing Jira Design Links panel.
2. Trigger it when the user clicks a panel design link, UX ticket link, or UX Epic link.
3. Include the opened target label, source type, host or ticket key, and a boundary: opening the target does not refresh Figma/Jira metadata, mark review complete, create/edit Jira links, or write to Memory Service.
4. Keep the receipt local to the current Jira page and replace it on the next panel-link click.
5. Update the existing E2E fixture to click a design link and a recovered UX ticket link, then assert the receipt text and no-write/no-review boundary.
6. Update `docs/features/jira_design_links.md` with the post-click receipt behavior.

## Verification

- `npm run verify:jira-design-links`
- `npm start` until the first successful development compile, then stop
- `npm run verify:jira-design-links:e2e`
- Scoped `git diff --check`
