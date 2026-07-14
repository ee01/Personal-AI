# Task Plan: Memory Lens Hover Peek Cache Receipt

## Goal
Improve Memory Lens Hover Peek so users can tell whether the visible hint is from the current recall or a local cached recall, without changing recall ranking or write behavior.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read AGENT.md, feature index, automation memory, and to-verify.
- [x] Randomly select a non-fresh exact feature target.
- [x] Check Reminders Personal AI list with AppleScript and EventKit fallback.
- [x] Inspect Memory Lens docs, source, and verifier.
- **Status:** complete

### Phase 2: Research & UX Decision
- [x] Review product references for memory/source transparency.
- [x] Review papers for RAG trust and end-user control.
- [x] Choose one bounded UX improvement.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a Hover Peek/Rest receipt for current-vs-cached recall basis.
- [x] Keep the change presentation-only; do not alter backend recall or feedback writes.
- [x] Update Memory Lens docs and verifier assertions.
- **Status:** complete

### Phase 4: Verification
- [x] Run `npm run verify:webpage-memory-detection`.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run `npm run verify:webpage-memory-detection:e2e` or the nearest existing browser-level check.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update progress and automation memory.
- [x] Mark related Reminder item done only if an open related item exists.
- [x] Summarize touched files and validation.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `记忆提示 Hover Peek` in `docs/features/memory_lens.md` | Random sample first eligible target; recent sweeps touched adjacent Memory Lens areas but not this exact Hover Peek cache basis. |
| Add basis receipt to Rest/Hover only | User sees Rest/Peek before expanded card, so this is the lowest-friction place to prevent confusing cached hints with fresh recall. |
| Keep backend and ranking unchanged | Current bug is presentation trust, not recall quality or data contract behavior. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm` not found in shell PATH | 1 | Rerun validation with `$HOME/.nvm/versions/node/v24.13.0/bin` prepended, per `AGENT.md`. |
