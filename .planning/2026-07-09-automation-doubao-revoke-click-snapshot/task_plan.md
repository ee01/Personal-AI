# Doubao Revoke Click Snapshot

## Goal

Improve the `Revoke ingested memory` path in Doubao Bridge so a user can tell which saved source/scope/artifact snapshot a revoke result belongs to, even if source settings or Explorer counts change while the destructive request is pending.

## Plan

1. Complete context pass.
   - Status: complete
   - Read `AGENT.md`, `docs/features/index.md`, automation memory, `docs/progressing/to-verify.md`, Reminder state, `docs/features/doubao_bridge.md`, and the revoke UI / E2E files.
2. Research and scope the UX change.
   - Status: complete
   - Use product and research references around memory deletion, activity deletion, portability, provenance, and machine-unlearning verification.
3. Implement the bounded UX improvement.
   - Status: complete
   - Add a revoke click snapshot to request and result copy for Doubao / ChatGPT source cards.
   - Keep behavior presentation-only: no API, deletion, scope, cache, or sync semantics change.
4. Update docs and index.
   - Status: complete
   - Keep docs concise; note that revoke request/results retain the clicked saved-scope and local artifact snapshot.
5. Verify.
   - Status: complete
   - Run syntax check for the E2E script, `npm --prefix desktop-app run test:source-toggle-gating`, first successful `npm start -- --progress` compile, and scoped `git diff --check`.

## Reminder State

AppleScript listed local Reminder lists but did not expose `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. No related Reminder needs implementation or completion.

## External References

- OpenAI Memory FAQ: deleting saved memory is separate from deleting chats.
- Gemini Privacy / Activity docs: activity deletion, auto-delete, connected-app boundaries need explicit lifecycle wording.
- Claude memory import/export docs: memory portability is now a first-class AI assistant flow.
- Machine unlearning verification papers: deletion requests benefit from verifiable completion evidence and clear proof boundaries.

## Validation Notes

Use `$HOME/.nvm/versions/node/v24.13.0/bin` if `node` or `npm` is missing from PATH.

## Validation Results

- `node --check desktop-app/app/renderer.js`: passed.
- `node --check desktop-app/scripts/doubao-source-toggle-gating-check.mjs`: passed.
- `npm --prefix desktop-app run test:source-toggle-gating`: passed before and after the dev compile.
- `npm --prefix desktop-app run build`: passed.
- `npm start -- --progress`: first webpack compile passed in 14282 ms, then watch was stopped.
- `git diff --check` for touched tracked files: passed.
- `rg -n "[ \t]$"` for the new planning directory: no trailing whitespace.
- Process cleanup: no remaining webpack or Doubao source-toggle E2E process found.
