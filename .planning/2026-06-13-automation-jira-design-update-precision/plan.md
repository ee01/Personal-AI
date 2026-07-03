# Jira Design Links date-precision receipt plan

## Context

- Selected feature: `设计链接更新时间展示` under Jira Design Links.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`
- Automation memory: the previous two runs already covered Memory Coverage Map and Memory Search, so this run avoids those surfaces.
- Reminder check: local Reminders is reachable, but there is no list named `Personal AI`; no Reminder item is used or eligible to mark done.

## Product and research scan

- Figma for Jira exposes `Design updated` and `Ready for dev` in Jira, and the status is meant to keep developers aware of design changes without leaving the issue.
- Figma Dev Mode treats ready-for-dev status and notifications as handoff state, so the Jira panel should preserve the difference between exact freshness and coarse status.
- Atlassian's setup docs note that live design updates require the app/setup path to be available, so the extension should make source gaps explicit instead of pretending all metadata has the same precision.
- Zeplin's Jira integration also centers live issue/design linkage, reinforcing that source and freshness cues are part of design handoff trust.
- Traceability research frames auxiliary artifacts as factors that affect link quality; here the timestamp label is an auxiliary artifact that should not overstate precision.

## UX defect

Current `Updated YYYY-MM-DD` handling is good for compact scanning, but a date-only value such as `2026-05-21` can be parsed as midnight UTC and surfaced in the tooltip as `2026-05-21 00:00 UTC`. That makes a day-level Jira/Figma field look like a precise timestamp, which weakens the receipt boundary for a developer deciding whether to re-check a design.

## Implementation plan

1. Add date-precision helpers in `src/jiraDesignLinks.ts`.
   - Keep `formatDesignUpdatedDate` unchanged for the visible compact tag.
   - Detect date-only input before converting it to a UTC timestamp.
   - Make `formatDesignUpdatedTooltip` say "reported on YYYY-MM-DD" for date-only metadata and only include UTC time for timestamp metadata.
2. Extend the lightweight verifier in `tools/verify-jira-design-links.ts`.
   - Assert timestamp values still produce UTC tooltips.
   - Assert date-only values do not expose a fake `00:00 UTC` precision.
3. Extend the Jira extension E2E fixture in `tools/verify-jira-design-links-e2e.mjs`.
   - Add one remote link with `Design updated` and `updatedDate: '2026-05-21'`.
   - Confirm it renders before older updated rows, shows `Updated 2026-05-21`, and its tooltip/aria label explains day-level precision.
4. Update `docs/features/jira_design_links.md`.
   - Document the date-only boundary in the Remote Links and styling sections.

## Validation plan

1. `npm run verify:jira-design-links`
2. `npm start` until first successful compile, then stop watch mode.
3. `npm run verify:jira-design-links:e2e`
4. `git diff --check -- src/jiraDesignLinks.ts src/contentScriptJira.ts tools/verify-jira-design-links.ts tools/verify-jira-design-links-e2e.mjs docs/features/jira_design_links.md .planning/2026-06-13-automation-jira-design-update-precision/plan.md`
