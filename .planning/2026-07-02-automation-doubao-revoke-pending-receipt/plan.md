# Doubao Revoke Pending Receipt

## Target

- Feature: `Revoke ingested memory`
- Source: `docs/index.md` -> `docs/features/doubao_bridge.md`
- Surface: `Personal AI.app` Explorer source cards for Doubao / ChatGPT

## Inputs Checked

- `AGENT.md` workflow and validation rules.
- `docs/progressing/to-verify.md`: no carry-over work.
- Automation memory: recent July 2 targets were Decision Center, Action Queue, notification digest, Prompt Config, Memory Capture, Scheduled Messages, and Message Analysis; this pass avoids those exact targets.
- Reminders: AppleScript did not list `Personal AI`; EventKit did. All 4 `Personal AI` items were already completed. The historical Doubao feedback is relevant as a regression constraint, but nothing needs marking done.
- Industry scan:
  - ChatGPT Memory FAQ separates saved memories from chat history and says deleting a chat does not delete saved memory.
  - Gemini Privacy / Enterprise memory controls separate activity, saved memory, source toggles, and deletion effects.
  - Claude memory import/export makes portability an explicit user-controlled path.
  - Machine unlearning / deletion-verification work emphasizes auditability and user-visible confirmation.

## Finding

The existing revoke path already separates Memory Service deletion from local Explorer artifact audit and result tone. The missing UX boundary is the in-flight window after the user confirms but before the Memory Service deletion and local audit mark return. During that window the button is busy, but the card does not preserve a receipt saying what has only been requested and what has not happened yet.

## Plan

1. Add a pre-result `撤回请求回执` immediately after confirmation and before `explorerApi.revokeIngestedMemory()` resolves.
2. Keep the existing final success / warning / failure behavior unchanged.
3. Extend the existing source-toggle-gating E2E to delay the revoke response, assert the pending receipt, then release the response and assert the existing final result.
4. Update the Doubao Bridge feature doc with the new pending-state contract.
5. Verify with focused syntax checks, desktop E2E, dev webpack compile, and scoped whitespace check.
