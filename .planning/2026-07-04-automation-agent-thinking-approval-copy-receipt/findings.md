# Agent Thinking Approval Copy Receipt Findings

## Local State

- `docs/progressing/to-verify.md` says `暂无`.
- Random selection chose `Agent Thinking 工具审批` from `docs/features/index.md`.
- `docs/features/agent_thinking.md` is current and already documents approval key exact matching, review packages, retry config, diagnostic packages, trace navigation, and no-effect boundaries.
- Current UI has durable freshness receipts for diagnostic package copy, but approval key / review package / retry config copy only shows a short transient status. The user can lose the first-screen confirmation of what clipboard content currently represents.

## Reminders

- AppleScript Reminders probe timed out.
- EventKit read succeeded and found `Personal AI` with 4 items.
- All 4 items are completed historical Doubao / Weekly Dream Digest / sync feedback. None are open or Agent Thinking approval-related.

## External References

- OpenAI Agents SDK HITL docs model approval as an interruption that pauses a run and resumes from a `RunState`.
- LangChain / LangGraph HITL docs use interrupts and configurable approval policies before sensitive tool calls.
- Vercel AI SDK HITL recipe uses tool-level `needsApproval` so execution waits for user approval.
- Human-AI interaction guidance and HITL reviews support making the user's oversight role, system state, and no-effect boundaries explicit before action.

## UX Gap

- Approval-copy actions are clipboard handoffs. They do not approve, execute, resume, write, notify, or delete anything.
- Because the success status auto-clears quickly, the page lacks a durable current-copy receipt comparable to the run diagnostic copy freshness receipt.
- A compact receipt scoped to the copied approval artifact should reduce ambiguity without implying persistent checkpoint support.
