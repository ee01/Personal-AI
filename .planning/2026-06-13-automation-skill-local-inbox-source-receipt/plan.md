# Skill Foundry Local Inbox Source Receipt Plan

## Goal

Make the Skill Foundry Inbox truthful when the current suggestions come only from local agent skill directories.

## User Scenario

A user opens `memory-exploring.html#/skills` after Desktop App scans `~/.codex/skills` and finds a new Codex skill. Before deciding whether to use it, they should immediately see that the Inbox is sourced from local agent directories, not from Flight Recorder, OpenClaw, or generic memory mining.

## Plan

1. Keep the existing suggestion state machine and review gate unchanged.
2. Add a local-only Inbox source summary for Codex CLI / Claude Code / Cursor suggestions.
3. Cover the local-only Inbox case in `tools/verify-personal-skill-foundry-e2e.mjs`.
4. Update `docs/features/personal_skill_foundry.md` with the user-visible boundary.
5. Validate with the focused E2E, first `npm start` compile, and touched-file diff hygiene.

## Status

- Discovery: complete
- Design: complete
- Implement: complete
- Verify: complete

## Validation

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start` first webpack compile succeeded; stopped watch after first success.
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/2026-06-13-automation-skill-local-inbox-source-receipt/plan.md`

## Notes

- `webpage-mcp` was unavailable because the native bridge socket was not running, so real-browser tab inspection fell back to the repo Playwright extension harness.
