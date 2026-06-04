# Task Plan: Today Pilot Sorting And Noise Control Sweep

## Goal
Improve the randomly selected Today Pilot `今天排序与噪声控制` feature by reconciling docs/code, incorporating relevant Reminder and external research signals, implementing one focused low-decision improvement, and validating it.

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [x] Read automation memory, repo rules, feature index, and previous planning state
- [x] Randomly select a non-repeated feature from `docs/features/index.md`
- [x] Check local Reminders `Personal AI` list for relevant feedback
- [x] Inspect current Today Pilot docs, code, tests, and dirty diffs
- [x] Document discoveries in findings.md
- **Status:** complete

### Phase 2: External Product And Research Scan
- [x] Search current product patterns and papers relevant to daily prioritization, agenda ranking, and noise control
- [x] Extract constructive suggestions that fit Personal AI's autonomous-memory direction
- **Status:** complete

### Phase 3: Concrete Improvement Plan
- [x] Identify the smallest useful implementation slice that does not need extra user decisions
- [x] Update this plan with the chosen scope and risks before editing code
- **Status:** complete

### Phase 4: Implementation
- [x] Add selected-evidence counts to Today Pilot source stats
- [x] Update homepage filtering summary copy and fallback behavior
- [x] Update concise feature docs
- **Status:** complete

### Phase 5: Testing & Verification
- [x] Run targeted tests/checks for Today Pilot sorting/noise behavior
- [x] Run extension build/E2E if user-visible UI changes are touched
- [x] Document test results
- **Status:** complete

### Phase 6: Reminder And Delivery
- [x] Mark any completed relevant Reminder item done and write notes when applicable
- [x] Update automation memory
- [x] Review outputs
- [x] Deliver to user
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `今天排序与噪声控制` | Randomly selected from `docs/features/index.md`, excluding the last-run Scheduled Messages feature to avoid immediate repetition. |
| Use isolated plan directory | Root planning files contain the previous completed Scheduled Messages automation run and should not be overwritten. |
| Improvement slice: selected-evidence stats | This fixes a concrete UX ambiguity in ranking/noise summary without requiring new user decisions or a new review queue. |
| No Reminder completion | The local Reminders app has no visible `Personal AI` list, so there is nothing to mark done in this run. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| No visible `Personal AI` Reminders list | Recorded the absence and skipped Reminder incorporation/completion. |
| `git status` rejected repo-external automation memory path | Re-ran status for repo files only; memory file is handled outside Git. |
