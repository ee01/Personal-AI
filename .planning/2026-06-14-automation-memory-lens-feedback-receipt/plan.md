# Memory Lens feedback confirmation receipt

## Context

- `docs/progressing/to-verify.md` is empty, so this run sampled a fresh feature.
- Random feature: `docs/features/memory_lens.md`.
- `webpage-mcp` was attempted first, but the native bridge socket was unavailable, so validation uses the repo Playwright extension harness.
- User persona: a product-heavy reader using Memory Lens while scanning a Falcon launch page, selecting text for recall, and giving feedback on whether the surfaced memory is useful.

## UX issue

The positive feedback path says `已记录为有用` immediately after click, before `CONTEXT_RECALL_FEEDBACK` succeeds. If the feedback write later fails, the UI corrects itself, but the first receipt still briefly claims a confirmed write that has not happened.

## Plan

1. Change positive feedback toast copy from optimistic success to `正在记录...`.
2. Show `已记录...` only after the feedback request succeeds.
3. Preserve the current failure behavior: unlock the positive button and show the failure receipt.
4. Extend the Memory Lens E2E to assert pending -> confirmed positive feedback.
5. Update `docs/features/memory_lens.md`, including the already-shipped split between the selection recall icon and the right-edge selection `+ 入库` dock.
6. Verify with the targeted helper, memory-service context recall test, `npm start` first successful compile, extension E2E, and scoped `git diff --check`.
