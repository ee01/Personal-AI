# Topic Messages Unread Refresh Boundary Plan

## Goal
Improve the randomly selected `主题式未读阅读` feature by checking current docs/code, using outside product and research references, implementing one bounded UX/code improvement that does not need user decisions, updating docs, and validating through the repo harness.

## Current Phase
Complete

## Phases

### Phase 1: Discovery And Selection
- [x] Read `AGENT.md`, automation memory, memory hints, `docs/progressing/to-verify.md`, and `docs/features/index.md`.
- [x] Check local Reminders list names.
- [x] Randomly select an eligible feature while avoiding the freshest automation-memory feature families.
- **Status:** complete

### Phase 2: Code, Docs, And UX Inspection
- [x] Read `docs/features/topic_based_messages.md`.
- [x] Inspect Topic Messages implementation files and existing verify/E2E scripts.
- [x] Identify a bounded defect or UX gap.
- **Status:** complete

### Phase 3: External References
- [x] Search current product references for comparable unread/inbox triage behavior.
- [x] Search current research/paper references for attention, triage, or notification UX constraints.
- [x] Record actionable implications in `findings.md`.
- **Status:** complete

### Phase 4: Concrete Plan Before Runtime Edits
- [x] Turn inspection findings into a short implementation plan.
- [x] Pick one low-decision slice with clear verification.
- [x] Share the plan before touching runtime code.
- **Status:** complete

### Phase 5: Implementation And Docs
- [x] Implement the selected scoped fix.
- [x] Update the canonical feature doc.
- [x] Preserve unrelated dirty worktree changes.
- **Status:** complete

### Phase 6: Verification
- [x] Run targeted Topic Messages verification.
- [x] Run `npm start` until the first successful compile, then stop it.
- [x] Run the smallest relevant E2E/browser-level check.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 7: Closeout
- [x] Mark relevant Reminder items done if any were used.
- [x] Update automation memory with summary and runtime.
- [x] Attempt session archive only if the environment exposes a working archive command.
- **Status:** complete

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Selected `主题式未读阅读` / Topic Messages | It was the first random eligible candidate after excluding the freshest automation-memory families. |
| No Reminder item incorporated | Reminders is readable, but there is no visible `Personal AI` list on this machine. |
| Keep scope to Topic Messages | The worktree is already broadly dirty; unrelated files must be left untouched. |
| Fix Topic load-failure boundary | Topic unread triage should not render generated mock topics when the Memory Service list load fails. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| No visible `Personal AI` Reminders list | 1 | Record absence and skip Reminder item completion. |
| Repo-external automation memory path passed to `git status` | 1 | Re-run status only with repository paths; memory file remains updated outside Git. |
