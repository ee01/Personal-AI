# Jira issue key recovery source breakdown

## Target

- Feature: `Jira issue key 解析`
- Canonical doc: `docs/features/jira_design_links.md`
- Main files: `src/jiraDesignLinks.ts`, `src/contentScriptJira.ts`

## External scan

- Atlassian Jira linked work items docs emphasize explicit dependencies and visibility between work items.
- Atlassian/Figma design integration docs expose linked design status and last-updated properties as first-class Jira context.
- Traceability-link recovery research treats recovered links as candidate evidence, not confirmed relationships, so the UI should show the actual source and boundary of each recovered candidate.

## UX issue

The current Jira Design Links panel already marks non-standard UX key recovery as read-only, but the top-level `恢复范围` receipt only shows a total count and a generic tooltip naming all possible recovery sources. On pages where only URL query, data attributes, or ARIA labels were actually used, the receipt still mentions raw text. As a user, that makes the recovery trail look broader and weaker than it really was.

## Plan

1. Add a presentation helper that counts recovered UX ticket candidates by actual `uxTicketKeySource`.
2. Surface the source distribution in the top `恢复范围` receipt and container `aria-label`.
3. Keep the no-write boundary unchanged: Personal AI only displays read-only candidates and does not create or edit Jira links, design fields, or relationships.
4. Update focused verifier and E2E assertions so this behavior is covered.
5. Update the feature doc with a concise note about actual recovery-source breakdown.

## Verification

- `npm run verify:jira-design-links`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:jira-design-links:e2e`
- `git diff --check -- src/jiraDesignLinks.ts src/contentScriptJira.ts tools/verify-jira-design-links.ts tools/verify-jira-design-links-e2e.mjs docs/features/jira_design_links.md .planning/2026-06-30-automation-jira-key-recovery-source-breakdown/plan.md`
