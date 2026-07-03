# Skill Foundry Suggestion Empty Inbox Receipt

## Target

- Feature: `技能库技能建议`
- Source doc: `docs/features/personal_skill_foundry.md`
- UI surface: `memory-exploring.html#/skills`

## Findings

- `PersonalSkillsPage.vue` already shows suggestion counts, priority reasons, snoozed recovery, review gates, pending decision receipts, and skill health receipts when suggestion rows exist.
- When both ready and snoozed suggestion reads succeed with zero rows, the first screen currently has no suggestion-specific receipt. Users can see active skills, but cannot tell whether the suggestion inbox is successfully empty, still loading, blocked by sync settings, or hidden by a filter.
- Reminders: AppleScript did not list `Personal AI`; EventKit found the list and 4 completed historical items. No open or target-related Reminder item was incorporated.
- External scan: Claude Skills, LangChain Deep Agents memory, OpenAI Agents SDK, SkillFortify, and recent agent skill supply-chain discussion all point to skill suggestions as a lifecycle / trust boundary. The empty state should preserve that boundary by saying no suggestion was created, promoted, synced, or executed.

## Plan

1. Add a first-screen `建议队列空回执` when `GET /skills/suggestions` ready and snoozed views are both empty after a successful load.
2. Make the receipt explicit about success-empty vs loading/failure, active skill count, where new suggestions can come from, and no write/sync/execute side effects.
3. Extend `verify-personal-skill-foundry-e2e.mjs` with an empty suggestion scenario.
4. Update `docs/features/personal_skill_foundry.md` with the new current behavior and concise research rationale.
5. Run targeted E2E, `npm start` first successful compile, and scoped `git diff --check`.
