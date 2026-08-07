# Memory Lens Source Open Receipt Plan

Goal: improve `记忆提示 Expanded Card` in Memory Lens by making source/detail opening visible as a bounded, read-only action, then update docs and verify through the existing Memory Lens harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, feature index, Reminders state, and prior random-loop guidance |
| 2 | completed | Select Memory Lens Expanded Card and inspect feature doc, source code, and verification scripts |
| 3 | completed | Scan current product/research references for source attribution, RAG transparency, and browser permission trust patterns |
| 4 | completed | Implement a card-level source-open receipt and existing `opened_source` outcome recording |
| 5 | completed | Update Memory Lens docs with the new user-visible boundary |
| 6 | completed | Run targeted verifier, `npm start` first compile, E2E, i18n, and scoped diff checks |
| 7 | completed | Update automation memory and summarize Reminder status |

## Decisions

- Selected feature: `记忆提示 Expanded Card` under Memory Lens from `docs/index.md`.
- Reminder branch: Reminders is readable, but there is no `Personal AI` list on this machine, so no Reminder item can be incorporated or marked done.
- Current gap: Expanded Card shows source links and source status chips, but opening a source/detail link does not leave a visible receipt in the card. Users can infer navigation happened without seeing whether it was current page, same-site, external source, memory detail, or whether any write/confirmation occurred.
- Implementation slice: after clicking `在记忆中查看` or an original source link, show a compact `来源打开回执` in the card. It should name the opened target, state the review scope, and explicitly say it does not write memory, insert text, send content, or confirm the fact.
- Existing telemetry path: reuse `submitContextRecallAmbientTrace(..., 'opened_source', ...)`; do not add a new backend route or user decision.
- Worktree is already broadly dirty; keep edits scoped to `src/contentScriptWebIntelligence.ts`, `desktop-app/scripts/webpage-memory-detection-check.mjs`, `docs/features/memory_lens.md`, this planning directory, and automation memory.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` was unset in the first automation-memory command | Read `$CODEX_HOME/automations/automation/memory.md` literally | Re-read via `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md` |
| Root planning files were stale from an older Scheduled Messages run | Planning-with-files restore check | Use an isolated `.planning/2026-06-29-automation-memory-lens-source-open-receipt/` plan and switch `.planning/.active_plan` |
