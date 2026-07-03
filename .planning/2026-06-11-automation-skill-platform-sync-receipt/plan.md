# Skill Foundry Platform Sync Receipt Plan

## Target

- Random feature: `平台同步` under Skill Foundry.
- Source of truth: `docs/features/personal_skill_foundry.md`.
- User-visible surface: `memory-exploring.html#/skills` platform sync dialog.

## Context

- `docs/progressing/to-verify.md` is empty.
- Local Reminders probe returned `__NO_PERSONAL_AI_LIST__`; no Reminder items apply.
- Existing UI already shows platform capability diagnostics and suggestion review gates.
- Gap: after a manual sync run, the dialog only shows one compressed status string. Users cannot quickly tell which side changed, whether changes are awaiting review, whether manual-only platforms were excluded, or whether failures preserved the queue.

## External Signals

- Claude Skills are filesystem packages with instructions, scripts, templates, and resources, so sync UX should expose package/source boundaries.
- GPT editing keeps draft/update/version history explicit, and app/action use may require user confirmation.
- MCP specification and security research emphasize explicit consent, operation review, and clear UI around data access, tool execution, and updates.

## Implementation Plan

1. Add a structured sync receipt model in `PersonalSkillsPage.vue`.
2. Derive OpenClaw and Desktop-App sync receipts from existing result fields without changing backend contracts.
3. Show rows for platform, scanned/processed scope, Personal AI changes, platform writes, review queue, failure/skipped state, and boundaries.
4. Keep old status visibility through readable receipt text so existing user flow remains simple.
5. Update `tools/verify-personal-skill-foundry-e2e.mjs` to assert the receipt.
6. Update `docs/features/personal_skill_foundry.md` with the platform-sync receipt behavior.

## Validation

- `npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts`
- `npm start` first successful dev compile, then stop watcher
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check`
