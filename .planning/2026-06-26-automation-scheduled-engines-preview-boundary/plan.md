# Scheduled Messages Engine Preview Boundary Plan

Goal: improve the `Scheduled Messages / 多执行引擎` UX so missing Bot executor configuration is visibly previewable without implying the message can be saved or sent.

## Findings

- `docs/progressing/to-verify.md` has no carry-over items.
- Recent automation runs heavily covered Memory Coverage, Skill Foundry, Memory Exploring, Agent Workflow, Meeting Pilot, Project Dashboard, Notification Center, Jira Design Links, Memory Capture, Relationship Radar, Quick Ask, and related receipt surfaces, so this run selected Scheduled Messages.
- Local Reminders are readable, but there is no visible `Personal AI` list.
- Existing Scheduled Messages code already centralizes execution route and lane wording in `src/scheduled-messages/executionRoute.ts`.
- Current gap: Bot / AI Report buttons remain clickable when the Bot executor is missing, but they are styled like disabled controls. Users can miss the fact that they may select them to inspect the execution-engine receipt while save remains blocked.
- External scan: Apps Script triggers have installable-trigger/runtime boundaries, Zapier exposes run history for troubleshooting, Twilio separates scheduled/canceled message state, and trigger-action debugging research supports visible why/why-not explanations before users can diagnose automation behavior.

## Plan

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo instructions, automation memory, feature index, Reminders list state, Scheduled Messages docs/code/tests, and relevant memory notes |
| 2 | completed | Search current product/docs and research references for scheduled automation execution/debug patterns |
| 3 | completed | Implement a focused preview-boundary UX for unconfigured Bot/AI execution-engine selection |
| 4 | completed | Update Scheduled Messages docs with the concise user-visible behavior change |
| 5 | completed | Extend focused E2E coverage and run verification |
| 6 | completed | Update automation memory and summarize outcome |

## Implementation Slice

- Add a visible preview-mode explanation under push method selection when Bot executor is missing.
- Keep Bot / AI Report selectable, but style the unconfigured buttons as warning preview choices rather than disabled choices.
- Preserve the existing save block and `配置 Bot 执行规则` recovery action.
- Do not change backend execution semantics, Sheet schema, Jira Automation rules, or runtime contracts.

## Progress

- Added warning preview styling and a visible `执行引擎预览` receipt for missing Bot executor.
- Updated the focused Scheduled Messages execution-route E2E to assert the preview badge, no-write/no-send/no-Jira-rule boundary, and continued selectable Bot button.
- Updated `docs/features/scheduled_messages_manager.md` with the user-visible behavior.
- Verification passed: `node --check tools/verify-scheduled-messages-execution-route-e2e.mjs`, scoped `git diff --check`, `npm start` first successful webpack compile then stopped, `npm run verify:scheduled-messages-execution-route:e2e`, and `pgrep -fl "webpack.*webpack\\.dev\\.cjs"` showed no watcher.
- Automation memory was updated at `2026-06-25T20:06:22Z`.
