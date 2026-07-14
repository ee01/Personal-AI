# Action Queue 巡检发现

## 已确认输入

- `AGENT.md` requires plan-first random feature sweeps, Reminder inspection, docs sync, targeted verifier, `npm start` first successful compile after code changes, and honest validation evidence.
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the latest runs covered Task Scheduler, Notification Center, backup restore, Jira Import, Today, Source Memory, Storyline, User Profile, Meeting ASR, Reflection, Watch, and Quick Ask. This run selected `动作队列` to avoid repeating those exact surfaces.
- EventKit found local `Personal AI` Reminders: 4 total, 0 incomplete. All current items are completed historical Doubao / Notification items, so no Action Queue feedback is available to incorporate.

## 外部参考

- OpenAI Agents SDK HITL pauses execution for sensitive tools, surfaces pending approvals, and resumes from durable run state after approve/reject.
- LangGraph HITL exposes pending action requests with structured args and per-action allowed decisions such as approve/reject/edit/respond.
- Zapier Agents activity pages show run status, apps used, timestamps, run details, and statuses such as Needs action / In progress / Failed / Cancelled / Completed.
- Microsoft AG-UI HITL frames approval as a client-visible request before execution, emphasizing safety, transparency, user control, and compliance.
- Automation transparency / trigger-action debugging research supports surfacing current state, action impact, uncertainty, and recovery paths in the same operation context.

## Code / UX Notes

- Action Queue already has mature card-level receipts: health summary, locator receipt, attention breakdown, empty-filter recovery, stale snapshot guidance, execution scope, OpenClaw preflight, approval checkpoint, pending operation, operation result, verification, and recovery receipts.
- Remaining narrow gap: action buttons still exposed only short visible text (`执行`, `确认并执行`, `重试入队`, `取消`) to hover/focus/screen-reader contexts. Card copy explains the boundary, but the final click target did not carry that same meaning.
- Implemented button-level `title` and `aria-label` receipts for execute/approve, retry, and cancel. The labels preserve behavior and clarify that requests go through Memory Service, OpenClaw writes are not confirmed external completion, retry only requeues, and cancel does not undo possible external side effects or delete evidence.
