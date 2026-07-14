# Task Plan: Scheduled Messages CRUD Boundary

## Goal
Improve the randomly selected `定时消息创建/编辑/删除` feature by aligning docs with code, incorporating industry/research guidance, implementing one low-decision UX/code fix, and verifying the result end to end as far as practical.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, feature index, automation memory, and `docs/progressing/to-verify.md`
- [x] Randomly select one viable feature from `docs/features/index.md`
- [x] Check the local `Personal AI` Reminders list
- [x] Inspect feature docs, code, and current verification harness
- [x] Document in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Search current product and research references
- [x] Identify one focused improvement that does not need new user decisions
- [x] Write the concrete implementation plan before code edits
- **Status:** complete

### Phase 3: Implementation
- [x] Update Scheduled Messages CRUD presentation/code
- [x] Update focused verifier assertions
- [x] Update canonical feature docs and index
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted Scheduled Messages verifier(s)
- [x] Run `npm start` to first successful compile, then stop it
- [x] Run focused E2E if the touched surface has an existing harness
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Delivery
- [x] Mark any incorporated Reminder item done if applicable
- [x] Update automation memory
- [x] Summarize changed files, verification, and unresolved risks
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected `定时消息创建/编辑/删除` | First viable item from randomized feature-index sample after excluding the freshest exact targets in automation memory. |
| No Reminder item to incorporate | EventKit found `Personal AI` with 4 total items and 0 incomplete items; AppleScript still did not list it. |
| Keep edits narrowly scoped | The worktree already has broad unrelated dirty changes; this run should only own Scheduled Messages CRUD boundary changes, docs/index, verifier updates, and this planning directory. |
| Implement button-level edit/delete boundaries | Docs and receipts already cover save/delete aftermath, but the actual row controls still need hover/reader copy that states the click consequence before activation. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial planning directory used a pre-random candidate name | Created the correct `2026-07-11-automation-scheduled-messages-crud-bound` plan and made it active. |
| `rg` command for JSX attributes interpreted backticks in the shell | Re-ran narrower `sed`/`rg` reads without shell-sensitive patterns. |
