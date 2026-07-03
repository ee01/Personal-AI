# Skill Foundry Sync Setting Receipt Plan

Date: 2026-06-29
Automation: automation-3 / 真实体验官

## Goal

Experience Personal Skill Foundry as a cautious user managing imported agent skills and platform sync settings, then fix one concrete UX gap that can cause a user to mistake a local UI action for confirmed platform writeback.

## User Lens

I am a user who keeps Codex/Claude/Cursor skills in local directories, occasionally imports suggestions into Personal AI, and wants every write boundary to be explicit. I care less about a prettier inbox and more about knowing whether a click only changed a draft, saved a platform setting, created a suggestion, pushed a skill, or executed anything.

## Plan

1. Confirm there is no pending `docs/progressing/to-verify.md` carry-over and no local Reminders `Personal AI` list to close.
2. Inspect the current Skill Foundry doc, main page, and E2E harness, focusing on suggestion decisions and platform-level sync settings.
3. Use `webpage-mcp` first to check whether a relevant Skill Foundry page is already inspectable; if not, use the existing unpacked-extension Playwright E2E path.
4. If the real-user pass finds a trust/boundary gap, implement the smallest fix in the existing UI model and update the canonical feature doc.
5. Extend the existing E2E so it proves the new visible receipt/state, then run the targeted verifier, `npm start` first successful compile, E2E, and scoped whitespace checks.

## Current Findings

- `docs/progressing/to-verify.md` says `暂无。`; no carry-over task is pending.
- Local Reminders are readable, but there is no list named `Personal AI`; no Reminder item can be marked done.
- `webpage-mcp` can inspect current HTTP(S) tabs, but no Skill Foundry extension page is available there.
- Selected feature: `docs/features/personal_skill_foundry.md`.
- Real-user gap found: platform sync setting toggles had final success/failure receipts, but no visible pending receipt or write lock while `PUT /skills/sync-settings/:platform` was in flight. A cautious user could see an old receipt while the new save was still unconfirmed.

## Result

- Added a `开关保存中` pending receipt for platform sync setting changes.
- The pending state displays the attempted target state (`保存开启中` / `保存关闭中`) while locking other sync toggles and `立即同步` buttons.
- The pending receipt states that no sync has run yet, no local skill directory or remote platform has been written, manual-only platforms are untouched, no skill executed, and active truth has not been overwritten.
- Updated the Skill Foundry E2E to delay the OpenClaw setting save and assert pending receipt, lock state, final success receipt, and existing failure handling.
- Updated `docs/features/personal_skill_foundry.md` with the 2026-06-29 behavior note.

## Verification Target

- Passed: `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node --check tools/verify-personal-skill-foundry-e2e.mjs`
- Passed: `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start` first successful webpack compile, then stopped
- Passed: `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node tools/verify-personal-skill-foundry-e2e.mjs`
- Passed: `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/2026-06-29-automation-skill-foundry-sync-setting-receipt/plan.md`
- Passed: no leftover webpack watch process after validation
