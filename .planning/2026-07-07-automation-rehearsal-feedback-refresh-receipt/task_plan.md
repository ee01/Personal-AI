# Task Plan: Rehearsal feedback refresh receipt

## Goal
Fix one bounded Rehearsal management UX defect: confirmed feedback/status results must remain visible even if the detail refresh is pending or stale, with docs and E2E coverage.

## Current Phase
Complete

## Phases

### Phase 1: Discovery and plan
- [x] Read automation memory, AGENT.md, feature index, to-verify, and current Reminders state.
- [x] Randomly select a feature while avoiding the freshest exact automation surfaces.
- [x] Inspect Rehearsal docs, UI code, E2E, and service contracts.
- **Status:** complete

### Phase 2: External scan
- [x] Search comparable products and research for reminder/prospective-memory feedback patterns.
- [x] Capture constructive design implications in findings.md.
- **Status:** complete

### Phase 3: Implementation
- [x] Preserve confirmed Rehearsal feedback/action receipts across detail refreshes.
- [x] Add a small receipt row or copy that explains refresh/stale-detail scope where needed.
- [x] Keep data-contract changes out unless the existing API cannot support the UX.
- **Status:** complete

### Phase 4: Docs and verification
- [x] Update docs/features/rehearsal.md concisely.
- [x] Extend tools/verify-rehearsals-page-e2e.mjs for the selected bug.
- [x] Run targeted tests, first successful npm start compile, Rehearsal E2E, and scoped diff checks.
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory with files and validation evidence.
- [x] Report Reminder outcome and owned files.
- **Status:** complete

## Key Questions
1. Can the existing Rehearsal APIs support the UX fix without backend contract changes? Yes, likely by preserving the mutation response as authoritative while detail refresh catches up.
2. Is any Reminder item related to Rehearsal? No; EventKit found four completed historical Doubao/Notification items only.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected Rehearsal / future scene memory | It was a random candidate not covered by the freshest exact Topic/Scheduled/Memory Lens/Prompt Config sweeps. |
| Keep change presentation-first in RehearsalsPage.vue | Existing APIs already return mutation truth; the UX issue is how the page presents refresh authority. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| planning-with-files skill read first used /Users/Esone/.codex path | 1 | Re-read from the listed /Users/Esone/.agents skill path. |
| .planning/.active_plan pointed at a missing prior directory | 1 | Create a fresh dated planning directory and switch the pointer for this run. |

## Notes
- Treat all existing dirty worktree changes as pre-existing unless explicitly edited in this run.
