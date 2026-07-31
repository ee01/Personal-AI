# Task Plan: Change Ledger Memory Service Deployment

## Goal
Deploy the verified Change Memory Ledger service to `10.32.56.212`, apply its schema safely, refresh one bounded MTR-148115 source, and verify a real Context Recall projection.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm the missing UI is caused by absent service-side projection data, not Lens rendering
- [x] Confirm local `127.0.0.1:3210` is stopped and remote `esone.qiu` lacks all three ledger tables
- [x] Inspect deployment script, remote repository, container health, logs, and migration status
- [x] Document findings in findings.md
- **Status:** completed

### Phase 2: Scoped Deployment Plan
- [x] Choose a deploy path that repairs the remote PATH failure and does not overwrite the already-synced remote worktree
- [x] Define rollback and bounded MTR-148115 refresh verification
- **Status:** completed

### Phase 3: Deploy & Backfill
- [x] Deploy the Memory Service changes and migration
- [x] Confirm remote container health and schema application
- [x] Deploy the bounded historical-backfill correction and refresh MTR-148115 sources
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Verify remote Context Recall returns `changeProjections` for MTR-148115
- [x] Verify Lens renders the projection after extension reload and Jira refresh
- [x] Run focused backend health/build checks and document results
- **Status:** completed

### Phase 5: Delivery
- [x] Review deployment scope and residual risks
- [x] Deliver exact user validation steps
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Deploy only the Memory Service scope needed by Change Ledger | The local worktree is dirty; a broad sync can accidentally ship unrelated changes |
| Prove with MTR-148115 | It has explicit Story Points and QA Estimate old/new evidence, including a reversal |
| Treat historical source refresh as a bounded write | Pre-feature Source Memory capsules will not gain events from a schema migration alone |
| Build the existing remote worktree before recreating the container | The current source was already synced there; resyncing it would make an unsafe `--delete` deployment even broader |
| Add `--skip-sync` to the deploy script | Supports recovery when source has already arrived remotely but the build/restart step failed |
| Use a compiled `backfillChangeLedger` CLI for historical records | Regenerates only ledger tables from existing evidence, preserving capsule state and avoiding user-visible note updates |
| Use the legacy Docker builder for this host | The remote BuildKit daemon disconnected during compose builds; the legacy builder produced a verified 5.53 MB context image |
| Resolve the stored work-email local part when `username` is absent | Ensures the extension uses the existing `esone.qiu` data namespace across the affected Chrome profile |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| User saw no ledger on MTR-148115 | Diagnosed absent local service and zero remote ledger tables; inspect remote deployment state before changing UI code |
| Current deploy script fails remotely before Docker build | Remote macOS noninteractive PATH omits `/usr/local/bin`, while Docker is installed there |
| Build appeared to hang after Docker PATH repair | Remote Docker was packaging the 4.2GB persistent `data/` directory because `memory-service/.dockerignore` was absent; added ignore rules and synced only that file |
