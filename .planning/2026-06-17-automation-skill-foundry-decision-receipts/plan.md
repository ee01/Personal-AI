# Skill Foundry Suggestion Decision Receipts

## Target

- Feature: `技能使用/丢弃/稍后审`
- Doc: `docs/features/personal_skill_foundry.md`
- Surface: `memory-exploring.html#/skills`

## Context

- `docs/progressing/to-verify.md` has no pending carry-over item.
- Local Reminders is readable, but there is no visible `Personal AI` list.
- The selected feature already has a complete backend state machine for `use`, `dismiss`, `snooze`, and `unsnooze`.
- The UX gap is that promote leaves a durable receipt, while `稍后审`, `现在审`, and `丢弃` only show transient messages.

## External Signals

- Claude Skills and Agent Skills treat skills as packages of instructions, metadata, scripts, templates, and resources, so suggestion decisions should preserve provenance and review boundaries.
- OpenAI GPTs expose configuration, testing, version history, knowledge, capabilities, and actions as managed surfaces, which supports explicit management receipts rather than hidden state changes.
- 2026 agent-skill lifecycle research emphasizes admission gates, verification, lineage, and avoiding polluted skill libraries.
- Human-in-the-loop feedback research warns that excessive feedback can reduce trust, so the right fix is a lightweight receipt rather than a heavier review state.

## Plan

1. Reuse the existing Skill Foundry receipt component, but let its header describe the action type.
2. Add durable receipts for `稍后审`, `现在审`, and `丢弃`.
3. Keep the backend state machine unchanged.
4. Update the Skill Foundry E2E to assert the receipts in the real page flow.
5. Update the feature doc and run targeted verification, first successful dev compile, E2E, and scoped whitespace checks.

## Expected Behavior

- `稍后审` says the item remains a suggestion, when it returns to Inbox, and that no active write/sync/execution happened.
- `现在审` says only `snoozed_until` was cleared and final use/cover still needs the original gate.
- `丢弃` says the item is dismissed, duplicate suggestions cool down, and no active/external/local deletion or sync happened.
