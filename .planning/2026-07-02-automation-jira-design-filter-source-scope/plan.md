# Jira Design Links filtered-source scope plan

## Selected feature

- Feature index target: `Figma/Zeplin 保守分类`
- Source doc: `docs/features/jira_design_links.md`
- Reminder check: AppleScript did not list `Personal AI`; EventKit did. All four items in `Personal AI` were already completed and were about Doubao / digest sync, not Jira Design Links.

## External scan

- Figma for Jira and Atlassian design search expose design status and `design[lastUpdated]` as first-class handoff signals, so this feature should keep status/update provenance visible instead of treating every Figma-looking URL as a handoff.
- Zeplin for Jira focuses on attached screens, sections, projects, and flows; profile, docs, settings, and integration pages are not equivalent developer handoff resources.
- Design handoff and traceability research, including Relay and recent software-artifact traceability surveys, supports making recovered or filtered artifact links easy to audit by source.

## UX gap

The panel already shows a `过滤范围` receipt and a filtered non-handoff count. The remaining ambiguity is source scope: if a page has Description links, native Jira Designs, remote links, and UX ticket fields, a user can see that several Figma/Zeplin references were filtered but cannot tell which scan channel produced those filtered references. That still leaves room to suspect a real handoff link was missed.

## Implementation plan

1. Track optional source metadata on ignored Figma/Zeplin non-handoff refs.
2. Preserve and merge ignored-link sources across Description, Jira Designs, remote links, and UX ticket design contexts.
3. Show a compact filtered-source tag in mixed and filtered-only receipts, plus the accessible summary.
4. Keep behavior read-only: do not write Jira links, refresh Figma/Jira metadata, or change design-link classification beyond surfacing the existing filter provenance.
5. Update the Jira Design Links doc and focused verification coverage.

## Validation plan

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-jira-design-links.ts`
- `node --check tools/verify-jira-design-links-e2e.mjs`
- `npm start -- --progress`, stop after first successful compile
- `npm run verify:jira-design-links:e2e`
- Scoped `git diff --check`
