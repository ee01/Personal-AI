# Outreach Sessions Triage Plan

Goal: improve `主动询问会话管理` by aligning the doc with current code, checking current product/research references, and implementing a small UX improvement that makes the page's next action and non-effect boundaries visible before the user scans individual sessions.

## Plan

1. Read repo guidance, automation memory, feature index, existing planning state, and local Reminders.
   - Status: completed
2. Inspect current Outreach docs, list UI, service client, engine routes, and E2E verifier.
   - Status: completed
3. Search current product and research references for proactive/HITL/follow-up assistant patterns.
   - Status: completed
4. Implement a page-level `本页优先级` triage receipt for Outreach Sessions.
   - Status: completed
5. Update feature docs and focused E2E coverage.
   - Status: completed
6. Run targeted verification, dev compile, scoped whitespace check, and watcher cleanup.
   - Status: completed
7. Update automation memory and archive the current Codex session if the tool is available.
   - Status: in_progress

## Selected Target

- Feature index row: `主动询问会话管理`
- Source doc: `docs/memory_system.md`
- Main UI: `src/modals/components/OutreachSessions.vue`
- Verifier: `tools/verify-outreach-sessions-e2e.mjs`

## Implementation Decision

Add one page-level triage band above the filters. It summarizes the current filtered state, prioritizes setup errors, retryable terminal sessions, pending approvals, waiting replies, queued sends, and pending templates, and explicitly states that refresh/filtering only reads Memory Service state. The actual external effects remain in card/detail actions: approve, cancel, retry, send by engine, and RingCentral writes.

## Errors And Environment

- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder feedback can be incorporated or completed.
- The worktree is broadly dirty from previous/user work. Keep changes scoped to Outreach Sessions docs/UI/E2E and this planning folder.
- First Outreach E2E rerun failed because the new triage receipt repeated the load-error text and made an old selector non-unique. The assertion was narrowed to the alert text and the E2E passed.
