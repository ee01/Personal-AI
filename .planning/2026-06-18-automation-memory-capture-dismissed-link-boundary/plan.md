# Memory Capture dismissed-link boundary

## Target

- Feature index item: `Memory Capture API`
- Source of truth: `docs/features/memory_capture.md`
- Main surfaces: source-memory capsule API and `memory-exploring.html#/source-memory/:id`

## Why this pass

The current dismiss path removes the linked `web` memory signal, but capsule detail can still expose the old `messageId` and keep showing `查看关联记忆`. As a user, that reads like the dismissed source is still active in recall, or at least like there is still a valid timeline target. The documentation says dismiss removes the associated `web` signal, so the API and UI should make that boundary visible.

External references from web clippers, saved-memory controls, and PIM research all point in the same direction: saved source items need clear provenance, and delete/dismiss controls need a visible distinction between retained review evidence and active future recall.

## Plan

1. Backend: return `messageId` only when the linked `messages_raw` row still exists and the capsule is saved.
2. API test: prove dismiss removes the `web` signal and the response no longer advertises a linked message.
3. Detail UI: show an active/dismissed recall-boundary receipt and hide `查看关联记忆` when the linked signal is gone.
4. E2E: assert the saved receipt, dismiss receipt, and absence of the关联记忆 link after dismiss.
5. Docs: summarize the dismissed-link boundary in `memory_capture.md`.
6. Verify with focused API tests, webpack first compile, source-memory E2E, and scoped diff check.
