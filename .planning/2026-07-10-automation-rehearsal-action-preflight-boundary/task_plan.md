# Rehearsal action preflight boundary

## Target

- Selected feature: `未来场景预演记忆` / Rehearsal from `docs/index.md`.
- Source doc: `docs/features/rehearsal.md`.
- Main UI: `src/modals/components/RehearsalsPage.vue`.
- Browser proof: `tools/verify-rehearsals-page-e2e.mjs`.

## Inputs checked

- `docs/progressing/to-verify.md`: no carry-over item.
- Automation memory: latest exact targets were DigestQueueService, Doubao explorer, Outreach, Memory Lens selection tooltip, and Project Dashboard data-source boundary, so this run avoids those.
- Reminders: AppleScript did not list `Personal AI`; EventKit found `Personal AI` with 0 incomplete items, so no Reminder item is tied to this run.
- External scan: ChatGPT Tasks, Apple Reminders, context-aware reminder authoring, and TriggerBench/prospective-memory work all reinforce cue-action clarity plus explicit operation boundaries before a reminder or future-scene script is treated as active.

## Plan

1. Fix the Rehearsal detail action set so paused records do not render two equivalent `恢复` buttons.
2. Add per-button hover and screen-reader boundary labels for pause, restore/reactivate, mark used, mark irrelevant, and archive actions before the user clicks.
3. Extend the existing Rehearsal E2E fixture to cover button-level boundaries and the paused duplicate-restore regression.
4. Update concise feature docs and the index row without widening the behavior contract.
5. Verify with direct syntax/E2E checks, `npm start` first successful compile, and scoped `git diff --check`.

## Boundary

This run is presentation/accessibility only. It must not change Rehearsal API payloads, matching/scoring, lifecycle rules, feedback semantics, Memory Service writes, source evidence, activation history, external systems, or Reminder state.
