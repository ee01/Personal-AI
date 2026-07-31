# Project Dashboard Task Entry Boundaries

## Target

- Random feature: `项目证据修复路径`
- Feature family: Project Dashboard
- Canonical doc: `docs/features/brain_like_project_analysis_system.md`
- Index row: `docs/features/index.md:152`

## Pre-checks

- `AGENT.md` read.
- `docs/progressing/to-verify.md` says `暂无`.
- Automation memory read; latest exact/family targets were avoided.
- Worktree already had unrelated dirty state from prior Doubao and Native Join automation runs. This run must not revert or stage those changes.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No Reminder item is open or related to Project Dashboard evidence repair, so no Reminder item will be incorporated or marked done.

## External Scan

- Atlassian Advanced Roadmaps documents missing-issue troubleshooting by showing why an issue is missing and routing the user to the relevant source/scope/release/exclusion fix path.
- Linear project updates/status docs separate manual health/status from automatic issue completion, and put context, challenges, and next steps near the project status.
- Easy Agile dependency reporting exposes dependency health, filters, and external dependency uncertainty before asking users to act on risks.
- Traceability-link research says project evidence links are often incomplete and repair should combine multiple weak signals rather than overclaiming authority from one source.

## Plan

1. Keep scope presentation/accessibility-only: no external Jira/GitHub/Confluence reads, no Memory Service writeback, no project data model changes.
2. Add pre-click boundary copy to cross-project focus task cards and project-level priority task cards because they open the task detail repair path but currently expose only the raw task title/description.
3. Include task, project, risk label/score, visible reason, local-snapshot basis, and no external read/write/send/confirmation boundary in `title` and `aria-label`.
4. Update the Project Dashboard E2E verifier to assert these real rendered button boundaries.
5. Update concise feature docs and the index row only if the user-facing behavior description needs adjustment.
6. Run focused static/E2E checks, first successful `npm start` compile, and scoped `git diff --check`.

## Current Phase

Complete

## Phases

### Phase 1: Requirements & Discovery

- [x] Read repo workflow, feature index, automation memory, and current worktree state.
- [x] Check `Personal AI` Reminders through EventKit.
- [x] Randomly select a viable feature outside the freshest automation families.
- [x] Inspect canonical docs, relevant source, and verifier coverage.
- **Status:** complete

### Phase 2: Plan

- [x] Lock bounded implementation plan.
- [x] Record external scan and Reminder result.
- **Status:** complete

### Phase 3: Implementation

- [x] Patch Project Dashboard focus/priority task entry boundaries.
- [x] Patch targeted verifier assertions.
- [x] Update concise docs/index wording if needed.
- **Status:** complete

### Phase 4: Testing & Verification

- [x] Run targeted Project Dashboard verifier.
- [x] Run `npm start` until first successful compile, then stop it.
- [x] Run Project Dashboard E2E verifier.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Delivery

- [x] Update automation memory with runtime summary.
- [x] Report scope, verification, Reminder outcome, and source links.
- **Status:** complete

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Target `项目证据修复路径` | First viable randomized candidate after excluding recently covered exact/family targets. |
| Improve focus/priority task cards | They are real entry points into the same local evidence repair path but lacked click-before consequence copy. |
| Keep implementation presentation-only | External scan supports clearer provenance and repair paths before broader automation; current code already has the data model and repair mechanics. |

## Errors Encountered

| Error | Resolution |
|-------|------------|
| Planning skill path under `/Users/Esone/.codex/skills` did not exist. | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
