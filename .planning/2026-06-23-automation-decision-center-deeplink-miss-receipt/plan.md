# Decision Center Deep-Link Miss Receipt Plan

## Target

- Random feature: `决策中心` under Memory Service.
- Source doc: `docs/memory_system.md`.
- Main UI: `src/modals/components/DecisionCenter.vue`.
- Existing proof: `tools/verify-decision-center-e2e.mjs`.

## Context Checked

- `AGENT.md`
- `docs/progressing/to-verify.md` (`暂无。`)
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- `docs/index.md`
- Local Reminders: Reminders is reachable, but there is no `Personal AI` list.

## External Scan

- Zapier Human in the Loop pauses a workflow so a reviewer can review, correct, approve, or provide more data before the workflow continues.
- LangGraph interrupts preserve graph state and require a stable thread id / resume point, making the waiting state explicit.
- Automation-bias and human-oversight research point to the same UX need: approval surfaces should help users verify and contest AI proposals rather than rubber-stamp them.

## UX Gap

Notification deep links already highlight a live confirm request, but the missing-target state is under-specified. If the item was answered, expired, merged, or one queue failed to refresh, the page only says it is not in the current queue. As a user, that can read like broken notification routing rather than a clear read-only queue lookup result.

## Implementation Plan

1. Make the missing-target notice state explicit about which queues were checked.
2. If any queue failed, avoid claiming absence from failed queues; say the page only checked successful or last-retained data.
3. Keep the refresh boundary visible: refreshing does not approve, restore, expire, create actions, or send anything.
4. Update the existing Decision Center E2E to assert the new receipt copy.
5. Update the feature doc and index date.

## Verification Plan

1. `node --check tools/verify-decision-center-e2e.mjs`
2. `npm start`, wait for first successful development compile, then stop the watcher.
3. `npm run verify:decision-center:e2e`
4. Scoped `git diff --check`.
