# Progress Log

## Session: 2026-07-16

### Current Status
- **Phase:** 5 - Delivery complete
- **Started:** 2026-07-16

### Actions Taken
- Confirmed the MTR-148115 Lens has ordinary recall but no ledger section.
- Confirmed local Memory Service is not listening on port 3210.
- Performed a read-only remote SQLite check; all three Change Ledger tables are absent.
- Created a dedicated deployment plan to keep this production operation separate from the completed implementation plan.
- Inspected `tools/deploy-memory-service.mjs`; it uses a broad `rsync --delete` and invokes bare `docker` under `bash -lc`.
- Confirmed the remote worktree is already heavily pre-synced and dirty, while the running container remains healthy but old.
- Identified the deployment failure as missing `/usr/local/bin` in remote noninteractive PATH; Docker works through its absolute path.
- Updated `tools/deploy-memory-service.mjs` with `--skip-sync` recovery mode and a remote macOS Docker PATH bootstrap.
- Rebuilt the local Memory Service successfully before remote deployment.
- Tagged the current remote image as `personal-ai-memory-service:pre-change-ledger-20260716` for rollback.
- Stopped the first remote build before container replacement after confirming it was packaging the 4.2GB persistent data directory.
- Added and synced `memory-service/.dockerignore` as the minimal build-context repair.
- Rebuilt and recreated the remote Memory Service successfully; migrations 051 through 056, including 054 Change Ledger, were applied to `esone.qiu` on first user-scoped request.
- Confirmed the remote user-scoped stats endpoint is healthy again with 11,391 messages, 14,186 entities, and 10,196 chunks.
- Added a compiled bounded backfill CLI and changed ledger refreshes to preserve `saved_at` over a later note-update timestamp.
- Rebuilt local TypeScript successfully after the backfill correction.
- Ran the bounded production backfill for MTR-148115: 15 source records checked and 9 ledger events extracted, without creating user-visible notes or updating Jira.
- Confirmed remote `context-recall` returns three projections for MTR-148115, including two Story Points conflicts and the current QA Estimate change.
- Fixed the extension background response to forward `changeProjections`; it had previously dropped the server field before the Lens content script could render it.
- Added a stored-email identity fallback for the Chrome profile that does not persist `userinfo.username`.
- Reloaded the unpacked extension and refreshed the real Jira tab. The live Lens contains the `变化脉络` section for MTR-148115.
- Removed the temporary production request diagnostic after it confirmed the real Jira request used `esone.qiu`, the MTR issue key, and returned three projections.
- Recreated the remote container with diagnostics disabled; the final image is healthy and the real projection request continues to return three ledger entries.

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Remote MTR-148115 Context Recall | Return at least one ledger projection | Returned 3 projections | passed |
| Live Jira Lens after extension reload | Render the `变化脉络` section | Rendered three projection cards in the existing Lens | passed |
| `npm --prefix memory-service test -- api-change-memory-ledger.test.ts` | Ledger API contract passes | 1 test passed | passed |
| `node tools/verify-change-memory-ledger-e2e.mjs` | Lens and Source Memory presentation verifier passes | passed; screenshots emitted under `/tmp` | passed |
| `git diff --check` (deployment files) | No whitespace errors | passed | passed |

### Errors
| Error | Resolution |
|-------|------------|
| Initial plan patch did not match the generated findings template | Re-read the template and used its actual headings |
