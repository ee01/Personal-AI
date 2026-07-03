# Skill Foundry Local Package Path Preview Plan

## Goal

Improve `本地 agent skill 导入建议` so a user can see which local skill package paths were ignored or counted as validation clues before confirming an imported Codex / Claude Code / Cursor skill.

## Target

- Feature: `本地 agent skill 导入建议`
- Capability: Skill Foundry
- Doc: `docs/features/personal_skill_foundry.md`
- UI: `src/modals/components/PersonalSkillsPage.vue`
- E2E: `tools/verify-personal-skill-foundry-e2e.mjs`

## Plan

1. Completed context intake
   - Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, Skill Foundry doc, code, E2E, and prior local-import plan.
   - Checked Reminders list names; no `Personal AI` list is present.
   - Gathered product/research references for local agent skill packages and governance.
2. Completed local path previews
   - Reuse existing `validationFilePaths` and `rejectedFilePaths` metadata.
   - Show compact path previews in card facts, review audit facts, confirmation receipt, and post-promote receipt.
   - Keep semantics unchanged: no file read, no validation execution, no writeback to local skill directories.
3. Completed tests and docs update
   - Extend the Skill Foundry E2E fixture with validation and rejected path examples.
   - Assert card, gate, decision receipt, and action receipt path previews.
   - Update the canonical feature doc without over-detailing implementation.
4. Completed verification
   - Run syntax check for the E2E.
   - Run `npm start -- --progress` until first successful compile and stop it.
   - Run `node tools/verify-personal-skill-foundry-e2e.mjs`.
   - Run scoped `git diff --check`.

## Status

- Current phase: complete.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Wrong skill path for `planning-with-files` | Initial read used `/Users/Esone/.codex/skills/...` | Re-read from `/Users/Esone/.agents/skills/...` |
