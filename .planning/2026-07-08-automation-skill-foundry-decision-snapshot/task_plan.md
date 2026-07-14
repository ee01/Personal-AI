# Skill Foundry Decision Snapshot Plan

Goal: improve the selected `技能使用/丢弃/稍后审` feature by keeping docs aligned with current code, incorporating external skill-lifecycle references and local Reminder state, then implementing one bounded UX trust improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory hints, `docs/progressing/to-verify.md`, feature index, scripts, and current worktree state |
| 2 | completed | Randomly select a non-recent feature and inspect Skill Foundry docs, UI, service routes, client methods, and existing E2E harness |
| 3 | completed | Check local Reminders via AppleScript plus EventKit fallback and gather relevant product/research references |
| 4 | completed | Implement a scoped decision-snapshot receipt for suggestion actions |
| 5 | completed | Update focused docs/index text and extend existing Skill Foundry E2E assertions |
| 6 | completed | Run targeted verifier, `npm start` first compile, E2E, and scoped diff checks |
| 7 | completed | Update automation memory and summarize Reminder closeout |

## Decisions

- Selected feature: `技能使用/丢弃/稍后审` under Skill Foundry.
- Source doc: `docs/features/personal_skill_foundry.md`.
- Implementation slice: add a click-time suggestion snapshot row to pending/result/failure receipts for use, dismiss, snooze, and unsnooze. Keep backend status transitions unchanged.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found the list with 4 total items and 0 incomplete items. No open Skill Foundry-related item is available to incorporate or mark done.
- Worktree state is broadly dirty before this run. Only touch Skill Foundry source/E2E/docs plus this planning directory and `.planning/.active_plan`.
- Verification completed: `node --check tools/verify-personal-skill-foundry-e2e.mjs`, `npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts`, `npm start -- --progress` first successful compile, `node tools/verify-personal-skill-foundry-e2e.mjs`, scoped `git diff --check`, and process cleanup check.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `node` missing from default PATH | package script inspection | Use `$HOME/.nvm/versions/node/v24.13.0/bin` for Node/npm commands |
| AppleScript did not show `Personal AI` Reminders | Reminder list scan | EventKit fallback confirmed the list and showed all 4 items completed/unrelated |
