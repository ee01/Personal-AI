# Storyline Regenerate Pending Lock

## Context

- Target feature: `docs/features/memory_storyline_builder.md`.
- User persona: a cautious meeting-prep user generating a shareable storyline draft who wants pending generation, manual copy, and external writeback boundaries to stay visible.
- Current dirty worktree already adds Storyline request, regenerate, cache, copy, and output-target receipts.

## Gap

While a Storyline Draft API request is already pending, the header still leaves `重新生成` clickable. That can create duplicate Draft API requests and weakens the pending receipt because the user cannot tell whether the current request or a new regenerate request is in control.

## Steps

1. Disable `重新生成` while `loading` is true.
2. Add a title / ARIA label that explains the lock: the page is waiting for the current Draft API receipt and avoids duplicate regenerate requests.
3. Keep a defensive `reloadDraft()` guard so keyboard or script-triggered clicks cannot bypass the lock.
4. Extend the existing Storyline Draft E2E pending-request scenario to assert the disabled state and single-request behavior.
5. Update the Storyline feature doc with the pending-regenerate lock contract.
6. Verify with Storyline targeted checks, dev compile, E2E, and scoped whitespace checks.
