# Memory events identity receipt plan

## Target feature

- Random feature: `多用户隔离` in `docs/memory_system.md`
- Scope: Memory Service `/events` SSE identity boundary
- Reminder state: local Reminders was readable, but there is no `Personal AI` list, so no Reminder item is included.

## Research signals

- ChatGPT Memory and Claude memory docs keep user memory controls visible instead of making memory state implicit.
- Microsoft 365 Copilot and Notion search documentation emphasize permission-aware retrieval and user/workspace boundaries at query time.
- Agent-memory research points in the same direction: identity, scope, source, and minimization gates need to travel with read/write paths, not just storage layout.

## Gap

`/stats` already returns a visible per-user storage receipt and Memory Exploring renders it. The `/events` SSE read path validates `?userId=` and filters by user, but its initial `connected` event only says `userId`. It does not tell the client whether the identity came from the EventSource query, from the request header, or from a default fallback.

## Implementation steps

1. Extend the SSE identity resolver with a small structured receipt: identity source, fallback flag, per-user storage key, and event-filter boundary.
2. Include that receipt in the initial `connected` event without changing downstream notification payloads.
3. Expand the existing `verify:memory-events-multiuser` helper and `events.test.ts` assertions.
4. Update `docs/memory_system.md` so the multi-user isolation section matches the code.
5. Validate with the targeted memory-events script, first successful `npm start` compile, memory user identity E2E, and scoped whitespace checks.
