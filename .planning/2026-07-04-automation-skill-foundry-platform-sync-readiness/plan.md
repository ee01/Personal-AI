# Skill Foundry Platform Sync Readiness Plan

Goal: improve the randomly selected `平台同步` feature in Skill Foundry by making the sync dialog's executable scope match the actual OpenClaw/Desktop/manual-only readiness state, then verify the UI path end to end.

## Context

- Selected feature: `平台同步` under Skill Foundry from `docs/index.md`.
- Source doc: `docs/features/personal_skill_foundry.md`.
- Code surface: `src/modals/components/PersonalSkillsPage.vue`.
- E2E surface: `tools/verify-personal-skill-foundry-e2e.mjs`.
- Reminder state: AppleScript does not list `Personal AI`; EventKit found 4 Personal AI reminders, all completed historical Doubao/digest/sync items. No open or Skill Foundry-related Reminder item is in scope.

## Findings

- The current doc is current for platform-level sync: Memory Service remains the active skill source of truth; OpenClaw can API sync; Codex/Claude Code/Cursor require Desktop App file sync; ChatGPT/GPTs and Claude.ai Skills are manual-only.
- The sync dialog already shows row-level diagnostics such as `Desktop App 未运行，无法读写本机目录`.
- UX gap: the dialog title counts all enabled API and Desktop-file platforms as `可同步平台`, even when a Desktop-file platform is enabled but the Desktop App is not currently available. That can make a blocked local sync look executable.
- External scan:
  - Anthropic Agent Skills package instructions, code, and reference files and can run inside a VM/container, so platform capability matters.
  - OpenAI GPT Actions distinguish schema/auth/API execution from ordinary instructions, supporting explicit capability categories.
  - Agent skill lifecycle and supply-chain research treats skills as executable/procedural packages, so readiness and security boundaries should be visible before sync/install.
  - Snyk ToxicSkills and SKILL.md supply-chain work reinforce that installed/synced skill packages need provenance and capability clarity.

## Implementation Plan

1. Change the sync overview title to count only currently executable targets as ready, and separately count Desktop App-gated platforms that are enabled but waiting.
2. Keep manual-only platforms excluded from ready counts and visible in their existing row.
3. Add an E2E branch where Desktop App health fails while Codex is enabled, then assert the overview shows `等待 Desktop App` instead of treating Codex as ready.
4. Update `docs/features/personal_skill_foundry.md` with a concise current-state note.
5. Validate with syntax/E2E, `npm start` first successful compile, and scoped `git diff --check`.

## Status

- Phase 1 context, Reminders, docs/code scan, and external scan: complete.
- Phase 2 implementation: complete.
- Phase 3 verification: complete.

## Verification

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node --check tools/verify-personal-skill-foundry-e2e.mjs`: passed.
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start -- --progress`: first webpack dev compile passed in 14905 ms, then watch was stopped.
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node tools/verify-personal-skill-foundry-e2e.mjs`: passed.
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/2026-07-04-automation-skill-foundry-platform-sync-readiness/plan.md`: passed.
- Process check found no lingering repo webpack watcher or Skill Foundry verifier after validation.
