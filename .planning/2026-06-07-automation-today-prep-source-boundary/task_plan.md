# Task Plan: Today Pilot Meeting Prep Source Boundary

## Goal
Improve the randomly selected `会前准备` feature so the code, user-facing source boundary, docs, and verification stay current.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Read automation memory, `AGENT.md`, feature index, carry-over file, and local Reminder list state.
- [x] Randomly select a target feature while avoiding the most recent automation targets.
- [x] Inspect Today Pilot meeting prep code, docs, and existing tests.
- [x] Collect external product and paper signals for meeting prep / grounded agenda assistant UX.
- **Status:** complete

### Phase 2: Improvement Plan
- [x] Identify a small constructive improvement that needs no user decision.
- [x] Write the code/docs/test plan before editing implementation files.
- **Status:** complete

### Phase 3: Implementation
- [x] Update the relevant Today Pilot meeting prep implementation.
- [x] Update targeted tests or E2E harness.
- [x] Update `docs/features/today_pilot.md`.
- **Status:** complete

### Phase 4: Verification
- [x] Run targeted tests for the changed surface.
- [x] Run first successful `npm start` dev compile and stop the watcher.
- [x] Run extension/user-visible E2E where practical.
- [x] Run `git diff --check`.
- **Status:** complete

### Phase 5: Closure
- [x] Confirm Reminder completion state, if any matching item existed.
- [x] Write automation memory with run summary and close time.
- [x] Summarize changed files and validation evidence.
- **Status:** complete

## Key Questions
1. Does the current meeting prep UI explain when prep is based only on calendar/fallback data versus memory evidence?
2. Can the code expose a more actionable source/confidence receipt without increasing review burden?
3. Which existing verifier is the smallest trustworthy E2E path for this feature?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `会前准备` under Today Pilot | Random sample selected this feature from `docs/features/index.md`; latest automation runs already covered other surfaces. |
| No Reminder items to incorporate | Local Reminders are accessible but there is no `Personal AI` list on this machine. |
| Improve the Video Home prep receipt instead of server generation | Existing records already expose mode/status/evidence; the user risk is misreading source coverage in the meeting-list consumer surface. |
| Show high-confidence sources, basic background, and meeting-use boundary separately | Copilot/Gemini and provenance papers emphasize access/sources, limited summaries when related content is missing, and concise verifiable attribution. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `shuf` is unavailable on this macOS shell | 1 | Used `awk` random sampling instead. |

## Notes
- Worktree was already broadly dirty; only touch files required for this run.
- Follow `AGENT.md`: runtime changes need targeted checks plus first successful `npm start`; UI-facing changes need E2E where practical.
