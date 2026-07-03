# Project Dashboard Data Source Check Improvement Plan

Goal: improve the selected `项目数据源检查` feature by confirming docs match current code, incorporating current industry/research references, and implementing a focused low-decision UX/code fix with real verification.

## Current Phase
Phase 6

## Phases

### Phase 1: Requirements, Memory, And Reminder Discovery
- [x] Read `AGENT.md`, `docs/features/index.md`, `docs/progressing/to-verify.md`, automation memory, and existing planning state
- [x] Randomly select a feature while avoiding recent automation targets
- [x] Check local Reminders for a `Personal AI` list
- [x] Document initial findings
- **Status:** complete

### Phase 2: Feature Code And Documentation Audit
- [x] Inspect `docs/features/brain_like_project_analysis_system.md` and adjacent Project Dashboard docs
- [x] Locate Project Dashboard data-source check code, tests, and UI surfaces
- [x] Compare documented behavior with current implementation
- **Status:** complete

### Phase 3: External Scan And Improvement Plan
- [x] Search current comparable products and relevant papers
- [x] Extract constructive direction for Project Dashboard data-source diagnostics
- [x] Write the concrete implementation plan before editing runtime files
- **Status:** complete

### Phase 4: Implementation
- [x] Implement the selected scoped UX/code improvement
- [x] Update the canonical feature doc and index only where needed
- [x] Preserve unrelated dirty worktree changes
- **Status:** complete

### Phase 5: Verification
- [x] Run targeted Project Dashboard checks
- [x] Run `npm start` until first successful compile if runtime source changes
- [x] Run the narrowest relevant E2E/browser proof
- [x] Run scoped whitespace checks
- **Status:** complete

### Phase 6: Closeout
- [x] Update Reminder item if one was used
- [ ] Append automation memory with this run's outcome
- [ ] Summarize changed files and validation evidence
- [ ] Archive the Codex thread if the tool is available
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected `项目数据源检查` under Project Dashboard | Random sampler selected it from `docs/features/index.md` after excluding recent exact targets and very recent broad feature families |
| Reminder branch has no items to incorporate | Local Reminders is reachable, but list names do not include `Personal AI` |
| Use a separate `.planning/2026-06-22-automation-project-dashboard-data-source/` plan | Root planning files are an older completed Scheduled Messages run and should not be overwritten |
| Keep edits scoped to Project Dashboard data-source diagnostics | The worktree is broadly dirty from prior/user changes |
| Implement a first-row source-scope receipt for data-source checks | Current panel has strong per-source cards and local evidence, but no compact first-row statement of which sources were read, unavailable, or skipped |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| First random sampler failed on a JavaScript template-string backtick escaping syntax error | Rewrote sampler to parse `Random target` pairs with a simpler regex and reran successfully |
