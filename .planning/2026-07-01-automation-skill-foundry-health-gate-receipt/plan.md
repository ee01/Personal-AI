# Skill Foundry Health Gate Receipt Plan

## Target

- Feature: `技能使用/丢弃/稍后审` under Skill Foundry.
- Canonical doc: `docs/features/personal_skill_foundry.md`.
- Selected because recent automation covered platform sync toggles, but not the documented quality-gate visibility gap.

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders are readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Current code already has durable decision receipts for use, dismiss, snooze, restore, and pending states.
- Backend already exposes Skill Quality Gate health through `GET /skills/:id/health`; the Foundry page did not surface it.

## External Scan

- Anthropic Agent Skills emphasize progressive disclosure and bundled resources, so skill state should be shown near the selected skill rather than buried in full package details.
- OpenAI GPTs expose build/share/version controls, reinforcing that reusable agent capabilities need visible lifecycle and access state.
- Agent-skill lifecycle and supply-chain research highlights evaluation, provenance, and governance; degraded skills should be visible as lifecycle state, not mistaken for deletion or sync failure.

## Plan

1. Add typed extension-client support for `GET /skills/:id/health`.
2. Fetch selected-skill health best-effort when the user opens a Skill Foundry detail.
3. Render a compact `质量门控` receipt for candidate / active / degraded / retired / user_pinned states.
4. Keep the receipt explicitly read-only: no skill execution, no status mutation, no sync, no external write.
5. Extend the existing Skill Foundry E2E mock to cover a degraded active skill.
6. Update `docs/features/personal_skill_foundry.md` with the shipped behavior and Reminder result.

## Verification

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start -- --progress` until the first successful compile, then stop it.
- `npm run verify:personal-skill-foundry:e2e`
- Scoped `git diff --check` for touched files.
