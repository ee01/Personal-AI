# Message Followup Outreach Boundary Plan

## Goal

Improve `跟进追问 / Followup` so the docs match current code, the UX is clearer about what follow-up creation actually does, and the change is verified with the narrowest real checks.

## Current Phase

Phase 5

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, and `docs/index.md`
- [x] Check local Reminders `Personal AI` list state
- [x] Inspect Followup docs, source, and existing verifiers
- **Status:** complete

### Phase 2: Product And Research Scan
- [x] Search comparable product patterns and relevant research
- [x] Record useful findings and improvement direction
- **Status:** complete

### Phase 3: Implementation
- [x] Implement the smallest low-decision UX/code improvement
- [x] Update `docs/features/message_reaction.md` and `docs/index.md` if behavior changes
- **Status:** complete

### Phase 4: Verification
- [x] Run focused tests/verifiers for Message Reaction Followup
- [x] Run `npm start` until first successful compile and stop the watcher
- [x] Run the smallest relevant E2E
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory
- [x] Mark Reminder item done if one was used
- [ ] Archive this Codex session if the archive tool is available
- **Status:** in_progress

## Decisions Made

| Decision | Rationale |
| --- | --- |
| Select `跟进追问 / Followup` | Random sample produced it after excluding the freshest exact targets; it has a trust-sensitive boundary between creating a follow-up session and actually asking/sending. |
| Treat Reminders as absent | Bounded AppleScript returned `NO_PERSONAL_AI_LIST`; do not invent Reminder feedback or completion. |
| Keep scope to Message Reaction | The worktree is broadly dirty; only touch Followup-related code/docs/verifiers and this run's planning/memory files. |
| Add submitting-state receipt | Comparable products and proactive-agent research point to clear timing and side-effect boundaries; the Followup dialog should stay explicit while the create request is pending. |

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is stale Scheduled Messages state | Startup plan restore | Created an isolated `.planning` directory for this run instead of reusing root plan files. |
