# User Profile explicit entry receipt

## Target

- Random feature: `用户画像条目` under User Profile.
- Source doc: `docs/features/user_profile_system.md`.
- Reminder state: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be linked or completed.

## External scan

- OpenAI, Anthropic, and Google memory controls emphasize that user memories must be viewable, editable, removable, and bounded by explicit settings.
- Claude memory import/export and AI-memory portability patterns make the write/import/export boundary visible before data moves.
- Response-aware memory selection research argues against injecting every similar profile item into every answer; confirmed items should still be selected by response utility and scene.

## Plan

1. Add a pre-submit receipt to the explicit profile entry form.
2. Make the receipt dynamic for type, key, custom-key readiness, and downstream boundaries.
3. Align the success receipt with the same `active + confirmed` plus scene-selection contract.
4. Update the feature doc and index row.
5. Verify with the existing user-profile targeted script, memory-service profile tests, dev compile, user-profile extension E2E, and scoped diff check.
