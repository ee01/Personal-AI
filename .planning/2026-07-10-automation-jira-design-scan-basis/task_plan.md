# Task Plan: Jira Design Links Scan Basis Receipt

## Goal
Improve the `Figma/Zeplin 保守分类` UX so users can immediately tell that the panel is a read-only Jira-visible handoff scan, not a live Figma/Zeplin inventory or writeback.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/features/index.md`, automation memory, and `docs/progressing/to-verify.md`
- [x] Check Reminders list state with AppleScript and EventKit fallback
- [x] Inspect `docs/features/jira_design_links.md`, `src/jiraDesignLinks.ts`, `src/contentScriptJira.ts`, and existing verifier/E2E
- [x] Run a small external scan for Figma/Jira, Zeplin/Jira, and traceability guidance
- **Status:** complete

### Phase 2: Plan
- [x] Choose one bounded improvement that does not require user decisions
- [x] Record scope and constraints in `findings.md`
- **Status:** complete

### Phase 3: Implementation
- [x] Add a scan-basis presentation helper in `src/jiraDesignLinks.ts`
- [x] Render a first-screen scan-basis receipt in `src/contentScriptJira.ts`
- [x] Update targeted verifier and extension E2E assertions
- **Status:** complete

### Phase 4: Docs
- [x] Update `docs/features/jira_design_links.md`
- [x] Update the matching `docs/features/index.md` row
- **Status:** complete

### Phase 5: Verification
- [x] Run `npm run verify:jira-design-links`
- [x] Run `npm start -- --progress` until the first successful compile, then stop it
- [x] Run `npm run verify:jira-design-links:e2e`
- [x] Run scoped `git diff --check`
- [x] Confirm no lingering webpack/E2E process from this run
- **Status:** complete

### Phase 6: Closeout
- [x] Update automation memory with the selected feature, Reminder state, research, implementation, and verification
- [x] Summarize exact scope and remaining risk
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `Figma/Zeplin 保守分类` | Random sample included it and it was not the freshest exact automation target. |
| Keep change presentation-only | Current filtering logic is already strong; the remaining UX gap is whether users can understand the scan basis before trusting the rows. |
| Do not mark Reminders | EventKit found `Personal AI`, but all four items were completed and unrelated to Jira Design Links. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| AppleScript did not list `Personal AI` | Used EventKit fallback, which found the list and confirmed no incomplete related items. |
