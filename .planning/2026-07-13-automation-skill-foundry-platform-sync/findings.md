# Findings

## Repository State
- `docs/progressing/to-verify.md` is empty.
- The repo has broad pre-existing dirty state across source, docs, tools, generated assets, and many planning directories.
- This run should own only the Skill Foundry platform-sync control-boundary edits, matching docs/E2E updates, the active-plan pointer, this planning directory, and automation memory.

## Feature Selection
- Selected feature: `平台同步` under Skill Foundry, documented in `docs/features/personal_skill_foundry.md` and indexed in `docs/features/index.md`.
- Existing docs already describe platform-level sync as per-platform, not per-skill, with OpenClaw API, Desktop App local filesystem platforms, and manual-only platforms.
- Existing implementation already has post-click receipts for switch pending/success/failure and sync pending/result states.

## Reminder Check
- AppleScript listed local Reminders lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total reminders and 0 incomplete reminders.
- All items were completed historical Doubao / notification feedback, unrelated to Skill Foundry platform sync. Nothing needs to be marked done.

## External Scan
- Anthropic Agent Skills and Claude Code Skills show skills as filesystem packages with `SKILL.md`, supporting files, automatic relevance loading, and cross-product availability. This supports making sync provenance and target platform explicit before copying or installing skills.
- Zapier Agents separates drafts/testing from published versions that activate triggers. This supports separating "save sync setting", "run sync now", and actual downstream automation effects.
- OpenAI Agents SDK docs emphasize server-owned deployment/state/approval choices and resumable approval/guardrail flows. This supports exposing whether a click is only UI/config, a sync request, or a risky external action.
- Trigger-action programming research and EUDebug work show that end users need help understanding, simulating, and debugging automations before unintended behavior happens. This supports pre-click control labels instead of only after-the-fact receipts.

## UX Gap
- The sync dialog entry buttons, close button, row-level `立即同步` buttons, and switches currently have either no title/aria-label or generic labels.
- Users can read rich receipts after clicking, but keyboard/hover/screen-reader users do not get the same consequence boundary at the control point.

## Proposed Improvement
- Add reusable helper copy for sync-dialog entry, close, run-now, and switch controls.
- Include platform, current/pending state, active-skill scope, API-vs-Desktop path, manual-only exclusion, no skill execution, no active-source overwrite, and disabled/pending reasons where relevant.
- Keep visible copy compact; place the detail in `title` and `aria-label`.
