# Skill Foundry suggestion card selection boundary

## Target

- Feature: `技能使用/丢弃/稍后审`
- Source doc: `docs/features/personal_skill_foundry.md`
- Index row: `docs/index.md`
- Runtime surface: `memory-exploring.html#/skills`

## Context checks

- `AGENT.md` read. Runtime source changes require targeted verification plus `npm start` until the first successful compile.
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the newest exact/family runs covered Relationship Radar Context Card, Message Analysis diagnostics, Memory Capture whole-page receipts, Jira Design Links, Google Slides entry, Skill Foundry platform sync, Agent Workflow, Rehearsal, and others. This pass focuses on Skill Foundry suggestion decisions, not platform sync or Public Skill URL.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No Reminder feedback was available for this target.

## External scan

- Anthropic / Claude Skills keep skills as scoped instruction + resource packages and emphasize progressive disclosure, which supports making the large card click read-only while keeping final write actions on explicit buttons.
- OpenAI Agents SDK human-in-the-loop / guardrails / tracing patterns support separating review/navigation from high-impact state mutations and preserving the boundary before the user clicks.
- Agent skill lifecycle and skill-registry security papers treat skills as reusable, executable, and supply-chain-sensitive artifacts, so suggestion cards should expose source/review context without implying card selection is a promote/dismiss/snooze action.

## Improvement plan

1. Add explicit `title` / `aria-label` copy to ready suggestion cards: selecting the card only opens details/evidence and does not use, dismiss, snooze, cover active truth, sync platforms, or execute the skill.
2. Add matching read-only selection copy to snoozed suggestion cards: selecting the card only opens the snoozed detail/recovery context and does not restore, dismiss, use, cover, sync, or execute.
3. Add matching read-only selection copy to active/dismissed skill cards in the rail: selecting a skill only opens details and does not change status, generate/copy share tokens, sync, write platforms, or execute.
4. Extend the existing Skill Foundry E2E verifier to assert these card-level boundaries separately from the write-action buttons.
5. Update canonical docs and the index row, then run the targeted verifier, dev compile, and scoped diff checks.

## Non-goals

- Do not change Skill Foundry APIs, suggestion status transitions, review gate semantics, platform sync settings, Public Skill URL generation, clipboard payloads, or skill execution behavior.
- Do not mark any Reminder done because there are no incomplete relevant items.
