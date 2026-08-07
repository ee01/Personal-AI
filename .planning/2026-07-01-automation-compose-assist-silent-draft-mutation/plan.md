# Compose Assist Silent Draft Mutation Plan

## Target

- Feature: `回复助手草稿辅助`
- Capability: Compose Assist
- Source doc: `docs/features/assist.md`

## Reminder Check

- Local Reminders were readable.
- No `Personal AI` list exists on this machine, so no Reminder item is included or marked done in this run.

## Product And Research Notes

- Gmail Smart Compose, Outlook suggested replies/Copilot draft flows, Grammarly suggestions, and interaction-required writing-assistant research all keep generated text under user control before sending.
- The practical implication for this feature is that a suggestion must remain tied to the exact draft version it was generated from. If the host editor mutates without a normal `input` event, Personal AI should notice before the user can mistake the old suggestion for current context.

## Implementation Plan

1. Detect silent draft text changes during the active composer re-scan path, not only in the `input` event path.
2. When the draft changed without an input event, increment the active session revision, clear the old assist, close review mode, and schedule a fresh assist request.
3. Extend the RingCentral draft-staleness E2E to mutate a contenteditable editor without dispatching `input`, then assert that a new assist request uses the new draft and the inserted suggestion comes from that new request.
4. Update the Compose Assist feature doc with the current behavior boundary.
5. Verify with the focused unit/static check, `npm start` first successful compile, the focused E2E, and scoped `git diff --check`.
