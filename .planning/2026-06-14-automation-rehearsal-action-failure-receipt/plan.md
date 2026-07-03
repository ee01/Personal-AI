# Rehearsal action failure receipt plan

## Context

- Selected feature: Rehearsal / 未来场景预演记忆.
- Reminder status: local Reminders is readable, but there is no `Personal AI` list on this machine, so no Reminder item is available for this run.
- Current UX already explains deep-link focus, missing future-scene cues, activation diagnostics, and successful action receipts.
- Gap: if a management action fails, such as pause, reactivate, mark used, mark irrelevant, or archive, the page currently relies on the thrown client error. The user does not get a durable receipt that says the write was not confirmed, the prior state remains authoritative, and the same action can be retried.

## External reference signal

- Apple Reminders and Microsoft To Do keep reminders tied to trigger/source state and completion/recovery flows.
- Recent context-aware reminder research emphasizes structured trigger logic rather than vague reminder text.
- Implementation-intention research supports keeping the cue/action binding visible. For Rehearsal, a failed state mutation must not blur whether the cue/action script is still eligible for future prompts.

## Implementation

1. Add a pending state around Rehearsal management actions so rapid double-clicks cannot send duplicate write requests.
2. Wrap each mutation action in a shared failure handler.
3. On failure, show a visible retryable receipt that says `未确认写入`, preserves the previous status, and explains that prompt eligibility, source evidence, and activation history were not changed.
4. Keep successful receipts unchanged.
5. Extend the existing Rehearsal page E2E to cover a failed pause request before the successful reactivation path.
6. Update `docs/features/rehearsal.md` with the new failure-boundary behavior.

## Verification

1. `node tools/verify-rehearsals-page-e2e.mjs`
2. `npm start` until first successful compile, then stop.
3. `git diff --check -- src/modals/components/RehearsalsPage.vue tools/verify-rehearsals-page-e2e.mjs docs/features/rehearsal.md .planning/2026-06-14-automation-rehearsal-action-failure-receipt/plan.md`
