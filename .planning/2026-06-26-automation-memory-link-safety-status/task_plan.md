# Memory Link Safety Status Plan

## Goal
Improve the Memory Exploring timeline/search safe-link UX so users can see openability and block reasons before clicking, without loosening existing URL safety rules.

## Current Phase
Complete

## Phases

### Phase 1: Discovery And Plan
- [x] Read AGENT.md, docs/features/index.md, docs/progressing/to-verify.md, automation memory, and relevant prior memory registry lines.
- [x] Check Reminders list availability.
- [x] Randomly select a non-recent feature candidate from docs/features/index.md.
- [x] Inspect target docs, code, and validation harnesses.
- **Status:** complete

### Phase 2: Implementation
- [x] Add a shared link safety status view for safe memory routes, safe sources, blocked links, and missing targets.
- [x] Render the status consistently in Timeline and Search result cards.
- [x] Keep all existing allowlist and credential/signed URL blocking rules unchanged.
- **Status:** complete

### Phase 3: Tests
- [x] Extend the presentation verifier for the shared status view.
- [x] Extend timeline E2E assertions for pre-click blocked status.
- [x] Run targeted verifier scripts and dev build.
- **Status:** complete

### Phase 4: Documentation And Closeout
- [x] Update docs/features/memory_system.md with concise current behavior.
- [x] Run scoped git diff checks.
- [x] Update automation memory with outcome and current run time.
- **Status:** complete

## Key Questions
1. Can users tell before clicking whether a timeline/search card will open internally, open a source, or stay blocked?
2. Can the UI explain block reasons without making unsafe URLs more clickable?
3. Does the change stay scoped to presentation and tests?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep existing URL safety rules unchanged | Research and prior docs support strict http/https plus credential/signed URL blocking. The gap is presentation, not policy. |
| Use a shared presentation helper | Timeline and Search already share link safety parsing; a shared status view avoids divergent copy. |
| Show status before click and keep click receipt | Pre-click status helps scanning; click receipt still confirms the attempted action and boundary. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `verify:memory-timeline:e2e` strict text match found both the new status detail and old hidden-link chip | 1 | Narrowed old assertions to `.link-safety-note` and kept separate status assertions. |

## Verification
- `npm run verify:memory-search-results` passed.
- `npm run verify:memory-timeline` passed.
- `npm start` compiled successfully once and the watcher was stopped.
- `npm run verify:memory-timeline:e2e` passed after narrowing the ambiguous text locator.
- `npm run verify:memory-search-scope:e2e` passed.
- Scoped `git diff --check` passed.
- `pgrep -fl "webpack --watch --config webpack.dev.cjs|npm start"` returned no leftover watcher.

## Notes
- Reminders app lists were readable, but no `Personal AI` list exists on this machine, so no reminder item can be completed for this run.
- Worktree was already very dirty; current edits must stay restricted to target files and this planning directory.
