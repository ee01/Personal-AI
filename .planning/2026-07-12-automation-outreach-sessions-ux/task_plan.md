# Task Plan: Automation Outreach Sessions UX

## Goal
Improve the `主动询问会话管理` feature by checking docs against current code, grounding the UX in external product/research references and local Reminder feedback, implementing one low-decision fix, and verifying it through the repo's matching harness.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, feature index, automation memory, stale root plan files, and `docs/progressing/to-verify.md`
- [x] Randomly select a non-fresh feature family from `docs/index.md`
- [x] Inspect local `Personal AI` Reminders for Outreach-related feedback
- [x] Inspect Outreach docs, source, tests, and dirty worktree context
- [x] Document findings in findings.md
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Run a small product and paper scan for proactive outreach / human-in-loop session management
- [x] Pick the smallest constructive implementation slice that needs no user decision
- [x] Update this plan with the chosen approach before editing runtime files
- **Status:** completed

### Phase 3: Implementation
- [x] Apply navigation/read-only control boundary labels in Outreach list and detail pages
- [x] Extend `tools/verify-outreach-sessions-e2e.mjs` to assert those labels
- [x] Update `docs/memory_system.md` and `docs/index.md`
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run syntax/static targeted checks
- [x] Run targeted Outreach verifier/E2E
- [x] Run `npm start` to first successful dev compile and stop the watcher
- [x] Run scoped `git diff --check`
- [x] Document test results
- **Status:** completed

### Phase 5: Delivery
- [x] Mark any completed source Reminder item done with notes, if applicable
- [x] Update automation memory with the run summary and current time
- [x] Summarize owned changes, verification, and any limitations
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `主动询问会话管理` | It was randomly selected after excluding the freshest exact/family targets from today's automation memory. |
| Use isolated plan `.planning/2026-07-12-automation-outreach-sessions-ux/` | The root `task_plan.md` is stale Scheduled Messages work from June and should not steer this run. |
| Implementation slice: read-only navigation/control boundaries | Existing Outreach send/cancel/retry/edit flows already have receipts; the remaining UX gap is click-level clarity for refresh, setup, route links, and source links that only view/open context. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
