# Doubao Memory Sync Thread Target Receipt

## Scope

- Selected feature: `Memory Sync Thread` under Doubao Bridge, from `docs/index.md`.
- Canonical doc: `docs/features/doubao_bridge.md`.
- Runtime surface: Desktop App broadcast column, `绑定长期记忆线程`.
- Verification surface: `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`.

## Discovery

- `docs/progressing/to-verify.md` has no carry-over items.
- AppleScript did not list `Personal AI`, but EventKit did. The list has 4 items and all are already completed. One historical Doubao item is adjacent, but it was already done and its notes already describe previous mobile briefing / sync audit fixes, so no Reminder item should be marked in this run.
- Recent automation memory covered Skill Foundry, Compose Assist, Outreach, User Profile, Project Dashboard, Message Analysis, Meeting Pilot ASR, Timeline, Watch, Memory Capture, Jira Design Links, Today, Notification, Dream, Scheduled Messages, Rehearsal, Google Slides, and Glip. Doubao `Memory Sync Thread` is not the freshest exact target.

## External Signals

- ChatGPT Memory and Gemini personalization both make memory sources and user control visible.
- Claude memory/search guidance emphasizes viewing and managing what the assistant remembers.
- Mem0 argues for structured, persistent memory rather than full-history stuffing.
- LongMemEval highlights information extraction, temporal reasoning, knowledge updates, and abstention as core long-term memory capabilities.

## UX Gap

The Desktop App already shows the bound long-term thread and recent `stable_memory` sync audit. However, a user can still miss whether the most recent `stable_memory` delivery target matches the currently bound `memory_sync_thread`, especially after repaired bindings, stale records, or incomplete sync-job telemetry.

## Plan

1. Add a local target comparison helper that recognizes both thread ids and thread ids embedded in Doubao `/chat` or `/thread` URLs.
2. Render a `投递目标回执` in the long-term memory thread card.
3. Keep normal success copy when the recent `stable_memory` target matches the current binding.
4. When the recent target is missing or different, change the card to a target-audit state and expose `修复长期记忆线程` / `查看日志`.
5. Update the Desktop App Playwright check for matched, mismatched, and missing-target receipts.
6. Update `docs/features/doubao_bridge.md` with the user-visible behavior.
7. Verify with syntax check, targeted Desktop App check, dev webpack compile, and scoped diff check.

## Non-Goals

- Do not change sync-job reporting, Memory Service provider routes, Doubao sending, binding writes, or mobile context behavior.
- Do not mark any Reminder item done because no open related item exists.
