# Jira Automation Import Error Redaction Plan

## Goal
Improve the selected `secret value 脱敏` slice of Jira Automation Import by preventing failed import responses from leaking secret-bearing Jira/API payloads, keeping docs current, and validating the user-visible path.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, automation memory state, feature index, Reminder list state, and relevant repo memory.
- [x] Select one random feature slice while avoiding very recent exact feature repeats.
- [x] Inspect current docs, source, tests, and dirty-file context for Jira Automation Import.
- **Status:** complete

### Phase 2: Research And UX Plan
- [x] Check current industry/product references and trigger-action debugging research.
- [x] Identify a bounded no-extra-user-decision improvement.
- [x] Record the plan before editing.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a reusable Jira Automation import error redaction helper.
- [x] Use it before rendering failed import toasts and before console logging unsafe response details.
- [x] Extend targeted tests and E2E fixture to cover secret-bearing API failures.
- [x] Update `docs/features/jira_automation_import.md`.
- **Status:** complete

### Phase 4: Verification
- [x] Run `npm run verify:jira-automation-import`.
- [x] Run first successful `npm start` compile and stop watch.
- [x] Run `npm run verify:jira-automation-import:e2e`.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closure
- [x] Confirm Reminder branch state and mark no items because `Personal AI` list is absent.
- [x] Update automation memory with this run's outcome and time.
- [x] Attempt/session-archive closure if a supported local mechanism exists, otherwise report the limitation.
- **Status:** complete

## Decisions Made

| Decision | Rationale |
|---|---|
| Selected `Jira Automation Import / secret value 脱敏` | It appeared in the random sample and is an independent, trust-sensitive feature slice with existing verifiers. |
| Improve failed import redaction | Current preview/create payload paths are already heavily covered, but failed API responses are still concatenated into visible toast text. |
| Keep the user-facing failure actionable but not raw | The user needs status, disabled-copy boundary, and retry/review next step; raw Jira response bodies can contain headers, URLs, or tokens. |
| Do not touch `.planning/.active_plan` | The worktree already has an active plan pointer from another run; this task uses an isolated planning directory only. |

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Missing `$CODEX_HOME/automations/automation/memory.md` | Initial automation-memory read | Treat as absent for selection and create/update `/Users/Esone/.codex/automations/automation/memory.md` at closure. |
| No `Personal AI` Reminders list | AppleScript list scan | Stop Reminder branch; no item can be incorporated or marked done. |
| Root planning files belong to an older Scheduled Messages run | Planning restore | Read them as legacy context and create this isolated planning directory. |
| Targeted test expected `Authorization: Bearer REDACTED` but helper over-redacted to `Authorization: REDACTED REDACTED` | First `npm run verify:jira-automation-import` | Removed plain `authorization` from the generic key-value regex so Bearer/Basic type stays visible while the credential is redacted. |
| Email assertion depended on URL parser preserving a non-sensitive `owner` query | Second `npm run verify:jira-automation-import` | Added an independent plain-text email sample to the unit test and kept URL redaction behavior parser-driven. |
