# Jira Design Links Conservative Classification Plan

Goal: improve the randomly selected `Figma/Zeplin 保守分类` feature by keeping docs aligned with current code, using current product/research references, and fixing one low-decision false-positive path in Jira Design Links.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, worktree state, and Reminder state |
| 2 | completed | Inspect Jira Design Links docs, classifier code, render path, and existing verifier/E2E coverage |
| 3 | completed | Search current product/paper references for design handoff, Jira integrations, and traceability |
| 4 | completed | Implement the bounded conservative-classification fix and matching assertions |
| 5 | completed | Update feature docs/index for the current behavior |
| 6 | completed | Run targeted verifier, dev build, Jira Design Links E2E, and scoped diff check |
| 7 | completed | Update automation memory and summarize the outcome |

## Decisions

- Selected feature: `Figma/Zeplin 保守分类` under Jira Design Links.
- Source doc: `docs/features/jira_design_links.md`.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items; all were completed historical Doubao/Notification feedback, so no item is related or needs completion.
- Existing dirty worktree is broad and includes Jira Design Links files. Preserve prior changes and layer only the Miro/Loom conservative-classification fix plus matching docs/tests.
- Implementation slice: restrict Miro to board handoff URLs and Loom to share/embed handoff URLs. Do not add Jira writes, live Figma/Zeplin refresh, or new user decisions.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Planning skill first path missing | Initial skill read used `/Users/Esone/.codex/skills/...` | Read the available skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| AppleScript may miss `Personal AI` | Reminder list scan showed no `Personal AI` | EventKit fallback found the list and showed 0 incomplete items |

## Verification

- `node --check tools/verify-jira-design-links-e2e.mjs` passed.
- `npm run verify:jira-design-links` passed.
- `npm start -- --progress` compiled successfully and was stopped after the first success.
- `npm run verify:jira-design-links:e2e` passed.
- Scoped `git diff --check` passed.
- Process check found no remaining webpack watcher or Jira Design Links E2E/temp-profile process.

## Changed Files

- `src/jiraDesignLinks.ts`
- `tools/verify-jira-design-links.ts`
- `tools/verify-jira-design-links-e2e.mjs`
- `docs/features/jira_design_links.md`
- `docs/index.md`
