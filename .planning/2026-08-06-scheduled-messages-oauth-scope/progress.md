# Scheduled Messages OAuth Scope Progress

## Session: 2026-08-06

### Phase 1: Audit authorization contracts

- **Status:** complete
- **Started:** 2026-08-06
- Actions taken:
  - Read repository agent instructions and the planning-with-files skill.
  - Preserved the existing active plan and created an isolated plan directory.
  - Carried forward verified browser evidence from the immediately preceding diagnosis.
  - Inventoried all shared Google auth callers and grouped them into Sheets, Slides, identity, App Script admin, and full setup contracts.
  - Confirmed the installed Chrome TypeScript definitions predate `grantedScopes` typing.
- Files created:
  - `.planning/2026-08-06-scheduled-messages-oauth-scope/task_plan.md`
  - `.planning/2026-08-06-scheduled-messages-oauth-scope/findings.md`
  - `.planning/2026-08-06-scheduled-messages-oauth-scope/progress.md`

### Phase 2: Scoped auth design

- **Status:** complete
- Decisions:
  - Per-call scopes override the broad manifest list.
  - Requested scopes are also required scopes unless a caller explicitly overrides them.
  - Partial grants return a structured `missing_scopes` result and no usable token.
  - Silent errors remain non-interactive but retain sanitized error details for the caller.
  - One Click Setup explicitly requests the full scope set.

### Phase 3: Implementation

- **Status:** complete
- Actions taken:
  - Added scope constants, structured token results, granted-scope validation, failure formatting, and recovery-error detection in `src/utils/googleAuth.ts`.
  - Scoped all shared auth callers across Scheduled Messages, background jobs, popup Slides/Jira actions, Sheet/Slide compatibility helpers, and auto reply.
  - Kept One Click Setup on the complete nine-scope contract.
  - Updated Scheduled Messages recovery UI and Sheets API 401/scope handling.
  - Added static and extension E2E auth verifiers and updated the App Script verifier.
  - Updated canonical Google auth and Scheduled Messages documentation.

### Phase 4: Verification

- **Status:** complete
- `npm start`: webpack compiled successfully; watcher stopped after first compile.
- `npm run verify:google-auth-scopes`: passed.
- `npm run verify:google-auth-scopes:e2e`: passed.
- `npm run verify:appscript-auto-update`: passed after updating its expected scoped call contract.
- `npm run verify:scheduled-messages-one-click-setup`: passed.
- `npm run verify:scheduled-messages-one-click-setup:e2e`: passed.
- `npm run verify:scheduled-messages-config-sync:e2e`: passed.
- `npm run verify:scheduled-messages-jira-rule-sync`: passed.
- `npm run verify:google-slides-analyzer`: passed.
- `npm run verify:google-slides-analyzer:e2e`: passed.
- Scoped `git diff --check`: passed.

### Phase 5: Delivery

- **Status:** complete
- Reviewed the scoped auth diff and preserved unrelated dirty worktree changes.
- Did not click the user's live Google consent screen; real-account consent completion remains a user-controlled boundary.

## Test Results

| Test | Expected | Actual | Status |
| --- | --- | --- | --- |
| Static scope verifier | Scope sets, partial grants, full setup, errors, source contracts pass | Passed | ✓ |
| Auth extension E2E | Scheduled Messages requests Sheets only under Slides-only partial grant | Passed | ✓ |
| Existing Scheduled Messages and Slides regressions | No behavior regressions | All targeted checks passed | ✓ |
| Dev webpack compile | Fresh `dist/` builds | Compiled successfully | ✓ |
| Scoped whitespace check | No diff whitespace errors | Passed | ✓ |

## Error Log

| Error | Attempt | Resolution |
| --- | --- | --- |
| `verify:appscript-auto-update` failed its source-string assertion after the scoped call became multiline | 1 | Replaced the old literal assertion with a regex that also verifies `APPS_SCRIPT_ADMIN` scope |
