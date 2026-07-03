# Findings

## Repo Context

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item.
- The random picker selected `本地 agent skill 导入建议` under Skill Foundry from `docs/features/index.md`.
- Existing docs and E2E already cover local directory source, resource count, ignored unsafe path count, missing validation clues, review gate, confirmation boundaries, and post-promote boundaries.
- Backend metadata already includes `validationFilePaths` and `rejectedFilePaths` in `memory-service/src/routes/skills.ts`; the UI mostly shows counts, not the path names.

## Reminder Check

- Apple Reminders list enumeration returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No `Personal AI` list is present, so there are no related Reminder items to incorporate or mark done.

## External References

- OpenAI Codex Skills documents a skill directory as `SKILL.md` plus optional `scripts/`, `references/`, `assets/`, and other files; this supports treating imported skill packages as file bundles, not just prose.
- Claude Code Skills similarly presents custom skills as shareable packages with supporting files, which supports showing source/package evidence before adoption.
- Recent agent-skills survey work frames skills as reusable procedural infrastructure with packaging, lifecycle, runtime integration, and governance concerns.
- Trigger-action programming security/usability research supports showing users concrete risky artifacts and boundaries before they activate automation-like behavior.

## Product Gap

The current UI tells the user that a local skill package has ignored unsafe files or validation clues, but not which paths drove those facts. That makes review less actionable: the user cannot tell whether `已忽略 1 个越界文件` was a serious path traversal attempt, a harmless duplicate, or a packaging mistake without leaving the page.
