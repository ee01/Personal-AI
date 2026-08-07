# Doubao Memory Sync Thread Control Boundary Plan

## Target

- Selected feature: `Memory Sync Thread` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`.
- Runtime surface: Personal AI Desktop App setup flow, especially the long-term memory thread card and recovery actions.

## Context Checked

- `AGENT.md` requires targeted verifier, first successful `npm start` compile after source changes, relevant E2E, and scoped `git diff --check`.
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent exact runs already covered Google Slides, Jira Design Links, Memory Search, Coverage, Agent Thinking, AR Data, Topic Messages, Message Analysis, Relationship Radar, Rehearsal, DigestQueue, Doubao explorer, Outreach, Memory Lens, Project Dashboard, Skill Foundry, Meeting Local ASR, Scheduled Messages, Ask, and related surfaces, so this run uses a narrower Doubao Memory Sync Thread slice.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items, so there is no related open Reminder to incorporate or mark done.

## External Scan

- OpenAI Memory FAQ: saved memories can be controlled, deleted, and turned off by the user; the UI should make memory control points clear.
- Anthropic Claude memory docs: users can view and edit the memory summary; memory visibility is part of the product contract.
- Google Gemini privacy / saved info docs: personalization depends on saved info, activity, and connected content, with user controls around deletion and saving.
- Agent-memory research on provenance-role collapse and memory-governance risk reinforces that long-term memory sync should keep source, target, and writeback boundaries visible.

## Improvement Plan

1. Add control-point `title` and `aria-label` copy for the long-term memory thread primary button.
   - Ready state should say it reuses or repairs `memory_sync_thread`.
   - Unready state should say it creates/binds the dedicated long-term memory thread.
   - All states should say it does not sync `persona_core` / `voice_mode` and does not write `mobile_context_thread`.
2. Add dynamic `title` and `aria-label` copy for thread recovery buttons.
   - `修复长期记忆线程`: binding/repair only, no persona sync.
   - `重试长期记忆`: reruns `stable_memory`, may write persona package, leaves pending/result receipt.
   - `测试 Memory Service`: read-only connection check.
   - `查看日志`: local log view only.
   - `打开豆包检查`: opens login/check path, not a sync proof.
   - Mobile actions keep their own short boundaries so shared recovery helper remains accurate.
3. Extend the existing Doubao desktop E2E check to assert these hover/ARIA boundaries on primary and dynamic recovery buttons.
4. Update `docs/features/doubao_bridge.md` and the `Memory Sync Thread` row in `docs/index.md` concisely.
5. Verify with desktop E2E, JS syntax check, first successful extension compile, and scoped diff check.
