# Findings & Decisions

## Requirements
- Deploy the Change Ledger backend safely to the user's remote memory-service.
- Do not ship unrelated dirty worktree changes.
- Verify the user can obtain a real ledger projection for MTR-148115.

## Research Findings
- The MTR-148115 screenshot contains normal Lens matches but no ledger section.
- Local `http://127.0.0.1:3210/health` refused the connection during diagnosis.
- Read-only remote SQLite inspection at `/Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db` found zero of `memory_change_extractions`, `memory_change_events`, and `memory_change_chains`.
- The issue has historical source text containing `Story Points Original: 0 New: 14`, `Story Points Original: 14 New: 0`, `Story Points Original: 13 New: 14`, and `QA Estimate Original: 1.01 New: 1.02`.
- Historical capsules predate ledger extraction; a migration alone will not create events. A bounded source refresh/backfill is required after deployment.
- `tools/deploy-memory-service.mjs` invokes `docker` through `bash -lc`; remote macOS resolves Docker only at `/usr/local/bin/docker`, so the prior deployment stopped at `command not found: docker`.
- The remote `memory-service` container is healthy but was created about 25 hours ago and is still using the pre-Ledger image.
- The remote worktree already contains the Ledger source and migration, along with many other pre-synced uncommitted files. Re-running the script's `rsync --delete` would be unnecessarily broad.
- The remote Git base has only `routes/ask.ts` from the Ledger integration set; all newer Context Recall/Source Memory modules are untracked staged source, so a clean-base micro-patch cannot be built safely without reconstructing a large dependency graph.
- Remote `memory-service` is 4.6GB, including a 4.2GB persistent `data/` directory. The Docker build context had no project `.dockerignore`, so direct and compose builds stalled while tarring database/repair-backup files.
- Added `memory-service/.dockerignore` excluding persistent data, dependencies, generated output, logs, and local env files. Synced only this new ignore file to the remote worktree; no user data was copied, deleted, or modified.
- The first production deploy applied migrations through 056, including ledger migration 054. The historical MTR-148115 capsules still needed explicit extraction because migrations do not replay previously captured sources.
- The bounded backfill inspected 15 matching source records and extracted 9 ledger events. It produced the Story Points and QA Estimate chains used by the Jira page.
- The production `/api/v1/context-recall` request for MTR-148115 now returns three projections: two conflicts for Story Points and one confirmed QA Estimate change.
- The deployed extension had a separate forwarding defect: `src/background.ts` omitted `changeProjections` from its response to the content script. The content script therefore had nothing to render despite a valid service response.
- One Chrome profile stores only a work email in `userinfo`; deriving the valid local-part user id preserves the expected `esone.qiu` user namespace instead of falling back to the default database.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use remote schema/projection checks as the release gate | The visible Lens can only render data returned by the deployed service |
| Build the current remote worktree using an absolute Docker binary | This repairs the actual failure while avoiding another destructive full source sync |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| First plan patch used a stale template heading | Re-read the generated plan files and applied a template-compatible patch |
| Remote `docker compose ps` failed in noninteractive shell | Confirmed `/usr/local/bin/docker` via login shell, then used that absolute path for inspection |
| Direct Docker build failed with a broken pipe while adding a repair-backup SQL file | Stopped the build before any container replacement; added `.dockerignore` to remove persistent data from the build context |
| Docker Compose BuildKit repeatedly disconnected from the remote daemon | Used `DOCKER_BUILDKIT=0 docker build` followed by `docker compose up -d --no-build`; the resulting container reached healthy state |

## Resources
- `tools/deploy-memory-service.mjs`
- `memory-service/src/storage/migrations/054_change_memory_ledger.sql`
- `memory-service/src/core/MemoryChangeLedgerService.ts`
- `https://jira.ringcentral.com/browse/MTR-148115`
- `tools/verify-change-memory-ledger-e2e.mjs`
