# Skill Foundry Suggestion Card Receipt Plan

## Selected Feature

- Feature index row: `技能库技能建议`
- Capability: Skill Foundry
- Source doc: `docs/features/personal_skill_foundry.md`
- Main UI: `memory-exploring.html#/skills`

## Current State

- `docs/progressing/to-verify.md` has no carry-over items.
- EventKit found the local `Personal AI` Reminder list with 4 total items and 0 incomplete items. All are completed historical Doubao / Notification feedback, not related to Skill Foundry suggestions.
- Recent automation memory already covered Notification, Message Analysis, Memory Lens, Agent Thinking, Jira Design Links, Source Memory, Today, DigestQueue and several Skill Foundry adjacent surfaces. This run focuses specifically on the suggestion inbox card path, not Public Skill URL or platform-sync settings.

## External Scan

- Anthropic Agent Skills treats skills as reusable folders with instructions, scripts and resources loaded only when relevant; this reinforces showing package/source/sync boundaries before a user promotes a suggestion.
- OpenAI GPTs expose user-facing name, description, share/version management and actions; this reinforces that a reusable capability should be understandable from its preview before the user commits.
- Alloy and ReUseIt-style research on reusable agent workflows argues for transparent, editable workflows and clear generalization from demonstrations; this supports making suggestion cards explain why the workflow exists and what promotion will do.

## UX Gap

The page already has a top-level decision overview and a detail-level `确认后会发生什么` receipt. But each suggestion card itself still mostly shows summary, source and review reasons. As a user scanning several suggestions, I cannot tell from the card whether clicking the primary button will only open evidence, promote to active, cover an existing active skill, or touch OpenClaw/Desktop/manual-only sync paths.

## Implementation Plan

1. Add a compact `建议处理回执` block to each visible suggestion card.
2. Keep it read-only and derived from existing state: review status, external-change binding, enabled sync settings, Desktop App availability and manual-only boundary.
3. Update the Skill Foundry E2E fixture to assert the card receipt for reviewed, external-change and quick-promote suggestions.
4. Update `docs/features/personal_skill_foundry.md` and the `docs/index.md` row.
5. Verify with syntax check, dev extension compile, focused Skill Foundry E2E and scoped `git diff --check`.

## Non-Goals

- No Memory Service route changes.
- No status-machine changes.
- No new suggestion state.
- No platform-sync behavior changes.
- No Reminder mutation because no related incomplete Reminder exists.
