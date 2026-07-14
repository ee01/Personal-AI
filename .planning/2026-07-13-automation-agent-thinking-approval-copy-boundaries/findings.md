# Findings

## Repo

- `docs/progressing/to-verify.md` says there are no pending carry-over verification items.
- `docs/features/index.md` random sample included `Agent Thinking 工具审批`; more recent exact targets such as Quick Ask, Notification feed, Meeting side panel, User Profile export, and Project Dashboard were skipped.
- `docs/features/agent_thinking.md` already documents that approval is a temporary retry credential, not persistent checkpointing.
- `src/agent-visualizer.tsx` renders three approval copy buttons: `复制 key`, `复制审核包`, and `复制重跑配置`.
- Surrounding approval receipts are strong, but the buttons themselves only have short `aria-label` values. That leaves the actual click point weaker than nearby copy.

## Reminders

- AppleScript listed Reminders lists but did not expose `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- No Agent Thinking or tool-approval Reminder item was incorporated or marked done.

## External Scan

- OpenAI Agents SDK HITL pauses tool calls needing approval, surfaces interruptions, lets callers serialize `RunState`, approve/reject, and resume the original run.
- LangChain HITL middleware uses interrupts plus checkpoint persistence; decisions can approve, edit, reject, or respond, and multiple pending actions each need their own decision.
- Vercel AI SDK uses `needsApproval` gates between tool call generation and execution, including conditional approval predicates.
- Current agent-safety research emphasizes transparent, accountable, human-overseen progression rather than assuming autonomy is trustworthy by design.

## UX Direction

Because Personal AI currently does not persist a paused Agent run, the safest bounded improvement is to make every approval-copy control say that copying is local text only and does not approve, resume, rerun, send, write, delete, or execute anything.
