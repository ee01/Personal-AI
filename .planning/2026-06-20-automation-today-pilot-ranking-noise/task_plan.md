# Task Plan: Today Pilot Ranking Noise Sweep

## Goal
Improve the randomly selected `今天排序与噪声控制` feature so Today Pilot gives users clearer, more trustworthy mission ranking and noise boundaries, then verify the change end to end.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, and `docs/features/index.md`.
- [x] Randomly select a feature while avoiding recent exact automation targets.
- [x] Check local Reminders `Personal AI` list.
- [x] Inspect Today Pilot service/UI/tests and identify a bounded implementation gap.
- [x] Record product/research references in `findings.md`.
- **Status:** complete

### Phase 2: Plan
- [x] Decide the smallest code/docs/test change that improves user experience.
- [x] Confirm touched files are scoped and compatible with existing dirty worktree.
- **Status:** complete

### Phase 3: Implementation
- [x] Implement the Today Pilot ranking/noise UX or logic improvement.
- [x] Update canonical feature docs and feature index if behavior changes.
- [x] Add or update targeted tests/E2E assertions.
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted Today Pilot backend tests or verifier.
- [x] Run `npm start` until first successful compile and stop watcher.
- [x] Run Today Pilot E2E verifier where practical.
- [x] Run scoped `git diff --check`.
- [x] Confirm no lingering webpack watcher.
- **Status:** complete

### Phase 5: Closeout
- [ ] Update automation memory with summary and runtime.
- [ ] Mark related Reminder items done if any were used.
- [ ] Archive current Codex session if archive tool is available.
- [ ] Final response with validation evidence and one inbox directive.
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `今天排序与噪声控制` under Today Pilot | Random sampler selected it after excluding recent exact targets; recent Today Pilot meeting-prep work was adjacent but not the same sorting/noise surface. |
| No Reminder item will be completed | Local Reminders is reachable but has no `Personal AI` list. |
| Keep work narrowly scoped | The repository has many unrelated pre-existing dirty files, so only Today Pilot ranking/noise files should be touched. |
| Recompute selected counts from visible cards | Filtering receipts should describe the current board after feedback/source-state hiding, not stale generation-time card selection. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Perl sampler printed mojibake in terminal | The selected row was decoded from the source index as `今天排序与噪声控制`; continue with exact feature from `docs/features/index.md`. |
| First watcher-cleanup probe matched the probe command itself | Reran with fully bracketed patterns: `rg '[w]ebpack|[n]pm start|[w]ebpack\\.dev\\.cjs'`; no watcher remained. |
