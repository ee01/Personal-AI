# Scheduled Messages OAuth Scope Plan

## Goal

Make Google authorization feature-scoped, keep full authorization for first-time One Click Setup, validate granted scopes, and improve auth failure recovery without disturbing unrelated worktree changes.

## Current Phase

Complete

## Phases

### Phase 1: Audit authorization contracts
- [x] Inventory every Google auth caller and required scopes
- [x] Inspect existing tests and installed TypeScript Chrome API types
- [x] Record findings
- **Status:** complete

### Phase 2: Design scoped auth API
- [x] Define reusable scope constants and result/error contract
- [x] Decide full-scope One Click Setup behavior
- [x] Decide partial-grant and expired-token behavior
- **Status:** complete

### Phase 3: Implement
- [x] Update shared Google auth helper
- [x] Update Scheduled Messages, Slides, Sheets, and background callers
- [x] Add focused tests and user-facing diagnostics
- **Status:** complete

### Phase 4: Verify
- [x] Run targeted authorization tests
- [x] Run Scheduled Messages verifier/E2E where applicable
- [x] Run first successful `npm start` compile
- [x] Run scoped whitespace/diff checks
- **Status:** complete

### Phase 5: Deliver
- [x] Review scoped diff against user request
- [x] Summarize behavior, evidence, and remaining live-auth boundary
- **Status:** complete

## Key Questions

1. Can `chrome.identity.getAuthToken({ scopes })` safely request a subset without invalidating existing broader grants?
2. Which callers need Sheets, Slides, Drive, or Apps Script scopes?
3. How should the UI distinguish missing scope, user cancellation, and an invalid cached token?

## Decisions Made

| Decision | Rationale |
| --- | --- |
| Keep One Click Setup on the full manifest scope set | User explicitly requested first-time setup to retain comprehensive authorization |
| Use an isolated planning directory without changing `.planning/.active_plan` | Preserve another active plan owned by existing workspace work |
| Add per-call scope sets and default required-scope validation | Minimal tokens avoid unrelated consent while partial grants fail honestly |
| Preserve token-returning wrappers and add structured result helpers | Limits call-site churn while allowing Scheduled Messages to show accurate failure reasons |
| Use a local Chrome callback compatibility type | Avoid a risky repository-wide `@types/chrome` upgrade |

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `verify:appscript-auto-update` expected the old single-line auth call | 1 | Updated the verifier to require the new silent/interactive App Script admin scope contract |
