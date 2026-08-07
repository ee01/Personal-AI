# Doubao / ChatGPT Explorer Run Request Receipt Plan

Goal: improve the selected `Doubao / ChatGPT explorer 输入链路` feature by checking docs/code freshness, incorporating current industry and research references, then implementing a focused UX improvement that makes manual source reads honest before the run finishes.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, old planning state, feature index, and local Reminders list state |
| 2 | completed | Randomly select a non-recent feature from `docs/index.md` |
| 3 | completed | Inspect Doubao Bridge docs, desktop Explorer source code, UI renderer, and existing verifier coverage |
| 4 | completed | Search current product/docs and paper references for AI chat memory import/export, source controls, and conversational-memory provenance |
| 5 | completed | Implement the smallest no-extra-decision UX/code change |
| 6 | completed | Update feature docs and focused verifier expectations |
| 7 | completed | Run targeted desktop-app tests, UI E2E, dev compile, i18n if relevant, and scoped whitespace checks |
| 8 | completed | Update automation memory and close out Reminder state if applicable |

## Selected Feature

- Feature index row: `Doubao / ChatGPT explorer 输入链路`
- Capability: `Doubao Bridge`
- Source doc: `docs/features/doubao_bridge.md`
- Main UI/code: `desktop-app/app/renderer.js`, `desktop-app/app/index.html`, `desktop-app/src/explorer/**`
- Main verifier: `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`

## Improvement Plan

1. Add an immediate manual-run request receipt when the user clicks `立即抓取` for Doubao or ChatGPT.
2. The receipt should appear before `savePendingExplorerSourceSettings()` and `explorerApi.runNow()` finish.
3. The receipt should say whether pending source settings will be saved first, show the current draft scope/lookback/conversation limit/transport preference, and state that the run has not yet written new Memory Service artifacts or changed/deleted source chats.
4. Preserve existing completion and failure messages. Completion still uses the returned run summary and actual transport/fallback status.
5. Extend the existing desktop UI verifier to assert the immediate request receipt for both Doubao and ChatGPT.
6. Update `docs/features/doubao_bridge.md` only at the feature-behavior level.

## Decisions

- Do not change source adapters, extraction, cache schema, or Memory Service contracts. The backend already returns the needed run summary and transport status.
- Do not add a modal or new review queue. The gap is the pending/request state on an existing explicit user action.
- Treat Reminders as unavailable because the local Reminders app has no `Personal AI` list.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Planning skill path initially checked under `.codex/skills` | First read | Corrected to `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| Repo root `task_plan.md` is stale from a 2026-06-04 Scheduled Messages run | Planning restore | Created this isolated `.planning/2026-06-28-automation-doubao-chatgpt-explorer-run-request-receipt/` plan instead of reusing root files |
| Local Reminders lacks `Personal AI` list | AppleScript list scan | Stop Reminder branch; no items can be incorporated or marked done |
| Broad `rg` over desktop/scripts produced too much noise | Initial code search | Switched to renderer function names, source ids, and verifier selectors |
