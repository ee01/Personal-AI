# Jira Design Links Conservative Classification Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` is empty.
- Automation memory recently covered Google Slides, Memory ingest, Agent Thinking, Topic defer, Meeting side panel, Notification feed, Quick Ask, Scheduled Messages, Rehearsal, Skill Foundry, and related boundary work. This run avoids those exact targets and stays on Jira Design Links classifier behavior.
- Worktree is already broadly dirty before this run, including Jira Design Links docs/code/verifiers. Do not revert unrelated changes.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. Existing completed items are historical Doubao/Notification feedback and are unrelated to Jira Design Links.

## Code And UX Findings

- `docs/features/jira_design_links.md` is already current for recent Figma/Zeplin filtering, filtered-reason receipts, scan-basis receipts, update-review receipts, recovered issue-key receipts, and pre-click/open-receipt boundaries.
- `src/jiraDesignLinks.ts` already filters Figma Community/help/blog/about/pricing and Zeplin support/marketing/profile/settings pages.
- Gap: `classifyDesignUrl()` currently treats any `miro.com` or `loom.com` URL as a design handoff entry. That can turn product marketing, pricing, help, or account pages into fake design entries.
- Low-decision fix: accept Miro board paths and Loom share/embed paths only, preserving real handoff links while silently dropping non-handoff product/docs pages.

## External Reference Findings

- Figma Jira docs and Dev Mode docs describe Jira design context around linked files/prototypes, Dev Mode status, update notifications, and ready-for-dev views; this supports surfacing real handoff links and update/status context, not broad product pages.
- Zeplin Jira docs describe attaching screens, sections, projects, flows, and components to Jira issues; this supports path-level resource classification rather than host-only matching.
- The 2026 SoK on software artifact traceability emphasizes that traceability links support maintenance/change impact but automated recovery remains fragmented and benefits from role-centric artifact paths. This supports conservative classification plus visible source/filtered boundaries.
- Figma handoff guidance and design handoff research emphasize preserving design intent and avoiding ambiguous handoff state; this supports treating non-resource pages as noise rather than actionable design rows.

