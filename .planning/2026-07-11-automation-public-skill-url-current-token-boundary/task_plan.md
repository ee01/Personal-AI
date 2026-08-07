# Public Skill URL Current Token Boundary Plan

Goal: improve the selected `Public Skill URL` feature by keeping the docs current, checking related product/research guidance, and implementing one low-decision UX fix that makes the click consequence clear before copying or opening a bearer skill URL.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, planning context, and Reminders |
| 2 | completed | Randomly choose an eligible feature after excluding the freshest exact automation targets |
| 3 | completed | Inspect Skill Foundry docs, implementation, current diff, and existing E2E coverage |
| 4 | completed | Check current external product/security/research references for agent skills and bearer/capability URLs |
| 5 | completed | Add enabled-button title/ARIA copy that names the current version, sha, token tail, and non-effects |
| 6 | completed | Update focused E2E assertions plus concise docs/index notes |
| 7 | completed | Run targeted validation, first successful `npm start` compile, scoped diff check, and automation memory update |

## Decisions

- Selected feature: `Public Skill URL` under Skill Foundry.
- Source doc: `docs/features/personal_skill_foundry.md`; index row: `docs/index.md`.
- Reminder state: EventKit found the local `Personal AI` list with 4 total items and 0 open items. All are completed historical Doubao / notification / test feedback, unrelated to Skill Foundry, token URL, secret scan, copy, preview, or token freshness.
- Existing implementation already covers share receipt, copy receipt, preview receipt, popup-blocked preview, stale copy/preview receipt after live token rotation, and unavailable button states.
- The smallest useful gap is before activation: enabled `复制可访问 URL`, `打开预览`, and manual install-copy controls currently say "with token" but do not identify the current active version, sha, or token tail at the button control itself.
- Implementation should stay presentation/accessibility-only. Do not change share token creation, revocation, Memory Service APIs, public URL routing, platform sync, clipboard payloads, preview opening, or Reminder state.
- Validation passed with `node --check tools/verify-personal-skill-foundry-e2e.mjs`, `npm start -- --progress` first compile, `node tools/verify-personal-skill-foundry-e2e.mjs`, scoped `git diff --check`, planning whitespace check, and no residual webpack/Foundry E2E process.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript did not list `Personal AI` | Reminder list scan | Used EventKit, which found `Personal AI` with 4 completed and 0 open items |
| Worktree already broadly dirty | Initial status check | Keep edits scoped to `PersonalSkillsPage.vue`, Foundry E2E, feature docs/index, planning, and automation memory |
| Process check matched the check command itself | First narrow `pgrep` | Re-ran with a bracketed `ps` pattern and confirmed no webpack or Foundry E2E process remained |
