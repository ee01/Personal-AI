# Compose Assist keyboard preview dwell plan

## Target

- Feature: `回复助手无感校准` from `docs/features/index.md`.
- Source docs: `docs/features/compose_assist.md` and `docs/features/memory_system.md`.
- Primary files: `src/composer-guard/ComposerGuardController.ts` and `tools/verify-compose-assist-ambient-calibration-e2e.mjs`.

## Findings

- Docs say `sent_without_insert` can be produced after the user views the hover preview or keyboard-focuses the preview, then sends their own reply.
- Pointer hover already requires a dwell window before the preview is remembered.
- Keyboard `focusin` currently remembers the preview immediately, so a fast Tab pass over the Personal AI icon can be misread as an intentional preview observation.
- External scan of Gmail Smart Compose, Outlook suggested replies, Smart Compose research, and Interaction-Required Suggestions supports keeping write-assist learning low-friction but based on deliberate user agency.
- Reminders: EventKit found the `Personal AI` list, but all items were already completed historical Doubao / digest / sync feedback and none matched Compose Assist calibration.

## Implementation

1. Make keyboard focus use the same dwell scheduling as pointer hover.
2. Cancel the pending preview observation when focus leaves the Compose Assist root before the dwell threshold.
3. Extend the ambient calibration E2E with quick keyboard focus no-trace and sustained keyboard focus trace coverage.
4. Update docs to say keyboard focus must remain long enough to count; transient focus/blur does not produce passive calibration.

## Verification

1. Run the targeted Compose Assist ambient calibration E2E after a fresh dev build.
2. Run `npm start -- --progress`, wait for the first successful compile, then stop it.
3. Run scoped `git diff --check` for the touched files.
