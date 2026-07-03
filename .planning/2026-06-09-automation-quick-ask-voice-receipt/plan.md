# Quick Ask Voice Receipt Plan

## Target

- Random feature: `Quick Ask 语音输入`
- Feature doc: `docs/features/doubao_bridge.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is accessible, but there is no `Personal AI` list, so no Reminder items are included or completed.
- Existing implementation already keeps transcript in a voice draft and exposes microphone / speech permission recovery.
- External references point toward reviewable dictation, visible waveform/status, local/privacy boundaries, and recoverable permission paths.

## Plan

1. Add a compact voice draft receipt inside the Quick Ask voice sheet.
2. Keep the current voice control state machine unchanged.
3. Update the desktop Quick Ask E2E to assert listening, permission-error, helper-error, and final transcript receipt states.
4. Update the canonical feature doc with the receipt behavior and research-driven UX rationale.
5. Validate with targeted desktop E2E, desktop tests/build, `npm start` first compile, and `git diff --check`.
