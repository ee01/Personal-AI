# Task Plan: Coverage low-score sort receipt

## Goal
Improve Memory Coverage Map's quality-score sorting UX so users can tell what "low score first" reorders, what it excludes, and that it is a read-only current-snapshot view.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, and `docs/index.md`.
- [x] Randomly select a non-recent target from the feature index.
- [x] Check local Reminders `Personal AI` list through AppleScript and EventKit.
- [x] Review target docs/source/E2E and external product/research references.
- **Status:** complete

### Phase 2: Plan
- [x] Define the bounded UX gap and implementation path.
- [x] Keep scope to visible Coverage quality-score sorting receipt and docs/E2E.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a visible `质量分排序回执` when low-score sorting is active.
- [x] Update `docs/features/memory_coverage_map.md` concisely.
- [x] Extend `tools/verify-memory-coverage-e2e.mjs` assertions.
- **Status:** complete

### Phase 4: Verification
- [x] Run syntax check for the E2E script.
- [x] Run `npm start` until first successful compile, then stop it.
- [x] Run the focused Coverage E2E verifier.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory.
- [x] Summarize owned files, Reminder status, research basis, and verification.
- **Status:** complete

## Key Questions
1. Does low-score sorting change data truth or trigger a refresh? No, it should only reorder active/derived platform cards in the current snapshot.
2. Should inactive P1+ planning channels affect the sorting receipt? They should be explicitly excluded from current-fault sorting.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a presentation-only receipt | The backend already returns quality score, breakdown, priorityFocus, and repair-route boundary. The remaining UX gap is explaining the local sorting action. |
| Do not change scoring or priorityFocus selection | Existing service tests and docs already encode the desired algorithm; changing it would widen risk without a clear user need. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| AppleScript Reminder list did not show `Personal AI` | 1 | Used EventKit fallback, which found the list and all 4 completed historical items. |

## Notes
- Worktree was already broadly dirty before this run; only touch Coverage Map target files and this planning directory.
- Selected feature: `Coverage 质量分` from `docs/index.md`.
