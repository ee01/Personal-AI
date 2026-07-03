# Skill Foundry Suggestion Decision Overview

## Target

- Feature: `技能使用/丢弃/稍后审`
- Source doc: `docs/features/personal_skill_foundry.md`
- User path: open `memory-exploring.html#/skills`, triage current Inbox suggestions, postpone or restore some, and only promote/dismiss after understanding the write boundary.

## Research Notes

- Anthropic Agent Skills frames skills as structured folders with instructions, metadata, scripts, and resources loaded through progressive disclosure, so Foundry should expose summary-level decision state before asking users to open every skill package.
- OpenAI GPT builder docs keep configuration, testing, versioning, actions, and confirmation as separate steps; Foundry should keep suggestion review separate from active skill publication or platform writes.
- OpenAI Agents SDK and LangGraph human-in-the-loop docs both emphasize surfacing pending approvals/interruptions before sensitive tool execution; Foundry should show pending review and non-effect boundaries before `使用` / `丢弃` / `稍后审`.
- EvoSkill shows automated skill discovery is useful only when discovered skills are selected and retained by evidence or validation, which supports showing risk/evidence counts before promotion.

## Plan

1. Add a first-row decision overview for ready, snoozed, review-required, external-change, local-import, and script/dependency suggestion counts.
2. Keep the overview read-only and make the write boundary explicit: browsing/searching/detail review does not write; only use/cover, dismiss, snooze, and unsnooze mutate suggestion state.
3. Update the Skill Foundry feature doc and index to describe the decision overview.
4. Extend the existing Skill Foundry E2E fixture to assert the overview across ready, snoozed, restore, and dismiss states.
5. Verify with the existing extension build and Skill Foundry E2E path.
