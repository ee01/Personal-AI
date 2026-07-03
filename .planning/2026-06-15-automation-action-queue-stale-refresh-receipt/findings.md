# Action Queue Stale Refresh Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says `暂无。`; there is no carry-over verification item.
- Random selected feature: `动作队列` under Memory Service, documented in `docs/features/memory_system.md`.
- The Action Queue page already summarizes visible results, attention items, running items, and failed/dead-letter items.
- `ActionQueue.vue` preserves data on silent polling failures, but a manual refresh failure clears `actions` and `totalActions` even when the page already had a valid list. That makes a transient service failure feel like the queue is empty or unavailable rather than "current state is unknown, last snapshot retained."
- `loadError` is displayed below guidance. When data is retained after a silent failure, the primary guidance can still say the queue is normal, so the user has to notice the lower error box to understand freshness.
- Existing E2E fixture already covers health summary, stale running actions, approval execution, failed filter, empty filter, OpenClaw verification receipts, payload preview, and transcript expansion.

## Reminder Findings

- Local Reminders lists visible on this machine: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible list named `Personal AI`; no Reminder item can be read, incorporated, completed, or annotated for this run.

## External Reference Findings

- OpenAI Agents SDK HITL docs describe approval interruptions that pause a run and later resume from saved run state. This supports making pending/approval state durable and visible rather than collapsing it into a generic loading state.
- LangGraph interrupt/HITL docs describe pausing execution, persisting graph state, and resuming after approve/edit/reject/respond decisions. This supports the Action Queue model of retained state plus explicit next action.
- Zapier Agents activity/status docs expose per-run status such as needs action, in progress, failed, cancelled, completed, and let users inspect issues for a specific run. This supports keeping previous action rows visible for troubleshooting even when refresh fails.
- Trigger-action debugging research highlights inaccurate user expectations around timing/control flow and the need for debugging visibility. For Action Queue, the equivalent is distinguishing "last known snapshot" from "freshly confirmed queue state."

## Implementation Plan

- Add a `lastLoadedAt`/stale snapshot state in `ActionQueue.vue`.
- On successful load, record the timestamp.
- On refresh failure when there are existing actions, keep the list and show a top warning receipt that says the current service state is not confirmed and the visible rows are the last successful snapshot.
- Only clear actions when there is no previous data or the page is still in the initial loading state.
- Extend `verify-action-queue-e2e.mjs` to force one `/actions` GET failure after the first successful load and assert that the warning appears while the original action cards remain visible.
