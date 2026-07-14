# Task Plan: Follow Thread List Snapshot Receipt

## Goal
Improve `关注后续 / Watch` so the management page exposes a page-level list snapshot receipt: what local store was read, which manual/system rules are included or hidden, what filter/sort is applied, and which actions did not happen.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, and `docs/features/index.md`.
- [x] Randomly sampled feature candidates and selected `关注后续 / Watch`.
- [x] Checked local Reminders through EventKit after AppleScript historically missed `Personal AI`.
- [x] Inspected Message Reaction docs, Watch code, FollowThreads management UI, and current verifier coverage.
- **Status:** complete

### Phase 2: Research & UX Decision
- [x] Search current product docs and research for followed threads, saved-message management, AI reminders, and multi-party thread detection.
- [x] Pick a bounded UX/trust improvement that does not need extra user decision.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a FollowThreads list snapshot receipt helper.
- [x] Render the receipt on the management page with current filter/sort, visible/hidden counts, read time, source, and no-side-effect boundary.
- [x] Update focused E2E assertions and feature docs.
- **Status:** complete

### Phase 4: Verification
- [x] Run message-reaction targeted tests.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run the FollowThreads management E2E.
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
| Target `关注后续 / Watch` | It was a viable random sample not covered by the freshest exact automation runs. |
| Add a page-level snapshot receipt | Per-item receipts already explain individual rules, but the list as a whole does not state read basis, hidden system-rule count, filter/sort scope, or read-only boundaries. |
| Keep Watch behavior unchanged | This is a UX/trust surface fix, not a matching, notification, storage, or Memory Service indexing change. |

## Reminder State
EventKit found the `Personal AI` Reminders list with 4 completed historical Doubao / Notification / local app log items. None are open or related to Watch, so no Reminder item is incorporated or markable.

## Validation
- `npm run verify:message-reaction` passed 92/92.
- `npm start -- --progress` compiled successfully once in 15146 ms and was stopped.
- `npm run verify:follow-threads-management:e2e` passed.
- Scoped `git diff --check` passed.
- Process check found no remaining repo webpack watcher beyond the checking command itself.

## External Scan
- Microsoft Teams followed threads supports automatic/manual follow, a centralized Followed threads view, unread filtering, and per-thread actions.
- Slack threads and Later separate thread notification state from saved/reminder management and let users return to original conversations.
- AI-powered reminders research highlights asynchronous collaboration reminders and the need to fit reminders into existing workflows.
- Context-aware thread detection research shows multi-party chat often interleaves multiple conversations, so Watch should be explicit about match routes and snapshot limits.
