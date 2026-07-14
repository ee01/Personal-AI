# Task Plan: Memory Backup Button Boundaries

## Goal
Improve the randomly selected `记忆导入/导出/备份` feature by making backup export/restore control-point consequences visible on the actual buttons, then update docs and verify with the existing Memory Coverage harness.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, memory notes, existing planning state, `docs/progressing/to-verify.md`, and feature index
- [x] Randomly select a feature from `docs/features/index.md`
- [x] Check local Reminders via AppleScript and EventKit fallback
- [x] Inspect relevant docs, source, and existing verify/E2E coverage
- [x] Gather external product/research references
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Define one bounded low-decision implementation slice
- [x] Keep scope to Memory Coverage backup/export/restore UX and docs
- **Status:** completed

### Phase 3: Implementation
- [x] Add dynamic `title` / `aria-label` copy to the top-level backup download button and backup zip mode button
- [x] Extend the existing Memory Coverage E2E to assert the button-level boundaries
- [x] Update `docs/features/memory_system.md` and the feature index copy concisely
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run `node --check tools/verify-memory-coverage-e2e.mjs`
- [x] Run `npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts src/__tests__/api-smart-import.test.ts`
- [x] Run `npm --prefix memory-service run build`
- [x] Run `npm start -- --progress`, wait for first successful compile, then stop it
- [x] Run `npm run verify:memory-coverage:e2e`
- [x] Run scoped `git diff --check`
- [x] Check for leftover repo-owned watcher/E2E processes
- **Status:** completed

### Phase 5: Delivery
- [x] Update automation memory with feature, Reminder state, research, implementation boundary, verification, and run time
- [x] Summarize changed files and validation honestly
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `记忆导入/导出/备份` | First valid random feature row after filtering the index to real feature rows. |
| Reminder branch: no action | AppleScript missed `Personal AI`, but EventKit found the list with 4 total and 0 incomplete items. |
| Implementation slice: button-level backup boundaries | The page already has strong receipts; the remaining UX gap is that the actual export/restore entry buttons do not expose the consequences before hover/focus/click. |
| Keep behavior unchanged | Existing `/export`, `/import`, manifest validation, dry-run, merge/replace, and cross-user confirmation contracts are already substantial and covered by tests. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial planning skill path under `.codex/skills` did not exist | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
| First random sampling command included glossary rows | Re-ran sampling constrained to the `小功能点索引` table rows with feature-doc links. |
| `git diff --stat` for touched docs/source looked broad | Files were already dirty from previous automation runs; confirmed this run's owned changes via targeted `rg` anchors and scoped validation. |
| `git status --short` rejected an absolute automation-memory path outside the repo | Re-ran status only for repository-owned paths; automation memory update is tracked separately at `/Users/Esone/.codex/automations/automation/memory.md`. |
