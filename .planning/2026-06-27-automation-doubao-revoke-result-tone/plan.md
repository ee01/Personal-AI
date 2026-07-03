# Doubao Bridge Revoke Result Tone

## Target

- Random feature index target: `Revoke ingested memory` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`.
- Code surface: `desktop-app/app/renderer.js` and Explorer revoke checks.

## Research Signals

- ChatGPT Memory controls separate deleting saved memories from deleting past chats; memory deletion must not imply original chat deletion.
- Gemini privacy controls separate activity/history management from personalization controls.
- Machine-unlearning and AI-forgetting audit work emphasizes verifiable deletion and auditability, so partial or unverifiable outcomes should not be styled as ordinary success.

## UX Problem

After a revoke request, `remote_only`, `local_only`, and `empty` outcomes were rendered through the same green success path as a full `remote_and_local` revoke. The message text had some caveats, but the visual state still implied a complete success. Users could then open the local preview, see withdrawn audit rows, and misread them as evidence that deletion failed.

## Plan

1. Keep Explorer revoke backend and storage semantics unchanged.
2. Add a renderer-level result tone helper:
   - `remote_and_local` -> success.
   - `remote_only`, `local_only`, `empty` -> warning.
3. Expand revoke result notices to state that withdrawn rows may remain in preview as audit-only rows and are no longer active memories.
4. Update the focused Desktop App source gating check to assert the local-only warning state and audit-only wording.
5. Update `docs/features/doubao_bridge.md` with the user-facing boundary.

## Verification

- `node --check desktop-app/app/renderer.js`
- `node --check desktop-app/scripts/doubao-source-toggle-gating-check.mjs`
- targeted desktop-app tests for Explorer revoke/store behavior
- `npm start` first successful compile
- `npm --prefix desktop-app run test:source-toggle-gating`
- scoped `git diff --check`
