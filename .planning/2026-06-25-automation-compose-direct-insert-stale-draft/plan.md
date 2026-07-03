# Compose Assist Direct Insert Stale Draft Guard

## Target

- Random feature row: `回复助手直接插入`
- Canonical doc: `docs/features/compose_assist.md`
- Main implementation: `src/composer-guard/ComposerGuardController.ts`
- Existing proof path: `tools/verify-compose-assist-direct-insert-e2e.mjs`

## External Signals

- Gmail Smart Compose keeps writing suggestions lightweight and user-accepted instead of sending automatically.
- Copilot in Outlook generates a draft, then asks the user to review/edit before sending.
- Google Smart Compose research emphasizes real-time assistance quality and low-friction acceptance.
- AI writing-assistant agency research warns that autocomplete can shift ownership and control when intervention is too strong or stale.

## Current Gap

The existing controller drops stale async responses when the draft changes before the response arrives, and normal `input` events clear old suggestions. The remaining fragile point is the direct insert action itself: if the target text changes without the expected input event, or between review display and confirmation, `insertLatestAssist()` can still write the suggestion that was generated for the previous draft.

## Implementation Plan

1. Track the context key and draft revision that produced the current `latestAssist`.
2. Before any direct insert, refresh the live draft and compare it with the assist generation revision.
3. If the draft is stale, do not write anything, clear the old affordance, and show a short `草稿已变化` receipt saying Personal AI did not send/submit and the user should retry from the current draft.
4. Extend the existing direct-insert E2E with a no-input stale-draft mutation before confirmation.
5. Update the Compose Assist doc with the new guard and verification notes.

## Verification Plan

- `node tools/verify-compose-assist-direct-insert-e2e.mjs`
- `npm start` until first successful compile, then stop
- Rerun `node tools/verify-compose-assist-direct-insert-e2e.mjs` against fresh `dist`
- Scoped `git diff --check`
