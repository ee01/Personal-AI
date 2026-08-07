# Findings & Decisions

## Requirements
- Pick one random item from `docs/index.md`.
- Check docs against code and keep docs concise.
- Search comparable products and papers for constructive guidance.
- Implement any low-decision improvement, update docs, and verify as thoroughly as practical.
- Check local `Personal AI` Reminders and mark completed related items only if this run actually addresses them.

## Selected Feature
- Feature: `Figma/Zeplin 保守分类`
- Capability: Jira Design Links
- Source doc: `docs/features/jira_design_links.md`
- Main implementation: `src/jiraDesignLinks.ts`, `src/contentScriptJira.ts`
- Verifiers: `npm run verify:jira-design-links`, `npm run verify:jira-design-links:e2e`

## Current State
- The docs already describe Figma/Zeplin handoff filtering, ignored non-handoff refs, design-field filtering, update review scope, link-open receipts, and read-only boundaries.
- `classifyDesignUrl()` and `classifyIgnoredDesignLikeUrl()` already reject Figma community/help/blog/marketing and Zeplin profile/support/marketing/settings pages.
- The E2E already proves filtered-only and mixed handoff/filtered cases.
- Remaining UX gap: a normal panel can show correct rows while the scan basis is mostly buried in footer/tooltips. A user may read it as a complete live Figma/Zeplin integration inventory instead of a Jira-visible read-only batch.

## Reminder Findings
- AppleScript listed Reminder lists but missed `Personal AI`.
- EventKit read-only fallback found `Personal AI` with 4 total items and 0 incomplete items.
- All items were completed historical Doubao/notification/test feedback, unrelated to Jira Design Links or Figma/Zeplin filtering.
- No Reminder should be marked done in this run.

## External Scan
- Figma/Jira integration docs emphasize live design context, status, and updates in Jira.
- Zeplin/Jira docs emphasize attaching screens, sections, projects, flows, and components to Jira.
- Requirements traceability research says auxiliary artifacts and metadata affect trace-link quality and should be surfaced carefully.
- Applied to this feature: show the scan basis and boundaries near the top, before users infer that the rows are a complete live source-of-truth inventory.

## Implementation Decision
- Add a visible `扫描口径` receipt when the panel renders.
- The receipt should summarize handoff entry count, source channels, filtered non-handoff refs, and read-only/no-refresh/no-write boundaries.
- Do not change URL classification, Jira API reads, Figma/Zeplin integration behavior, link opening, writeback, or Memory Service.

## Resources
- Figma Jira integration: https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma
- Zeplin Jira integration: https://zeplin.io/integrations/jira/
- Auxiliary artifacts in requirements traceability: https://arxiv.org/html/2504.19658v1
