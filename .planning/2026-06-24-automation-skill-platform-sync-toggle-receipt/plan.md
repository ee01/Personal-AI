# Skill Foundry Platform Sync Toggle Receipt Plan

## Target

- Random feature: `平台同步`
- Capability: Skill Foundry
- Source doc: `docs/features/personal_skill_foundry.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Recent automation memory covered Doubao, Message Analysis, Reflection, Jira Import, Outreach, Google Slides, Message Reaction, Rehearsal, Scheduled Messages, Prompt Config, and several Memory Service surfaces. This run focuses on Skill Foundry platform sync.

## Product Direction

External skill systems treat skills as portable packages with instructions, scripts, resources, and lifecycle risk. For Personal AI, platform sync must keep these boundaries visible:

- Saving a platform setting is not the same as running sync.
- Running sync is not the same as installing, executing, or validating a skill.
- Manual-only platforms remain copy/install handoffs.
- External changes still enter Inbox review before active truth changes.

## Implementation Steps

1. Add a persistent `开关回执` in the platform sync dialog after sync setting save success or failure.
2. On success, state the platform-level scope, downstream sync boundary, manual-only exclusion, and no immediate execution/write.
3. On failure, restore the original switch state and state that no sync, remote write, local file write, skill execution, or manual-only write occurred.
4. Update Skill Foundry docs and feature index.
5. Extend the existing Skill Foundry E2E fixture to cover successful OpenClaw enable/disable and failed Claude Code save.

## Validation Plan

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start` first successful development compile, then stop watcher
- `npm run verify:personal-skill-foundry:e2e`
- Scoped `git diff --check` over touched files
