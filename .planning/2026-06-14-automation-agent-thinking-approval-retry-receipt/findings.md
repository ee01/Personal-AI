# Agent Thinking Approval Retry Receipt Findings

## Current State

- `docs/progressing/to-verify.md` says `暂无。`; there is no carry-over validation item.
- Local Reminders lists are visible, but none are named `Personal AI`.
- `docs/features/agent_thinking.md` is current through 2026-06-13 and already documents temporary review boundaries, schema/export boundaries, and copyable approval packages.
- Main implementation files inspected: `src/agentVisualizerPresentation.ts`, `src/agent-visualizer.tsx`, `src/agentThinking.ts`, `src/options.tsx`, `tools/verify-memory-entry-agent-thinking.ts`, `tools/verify-agent-thinking-options-e2e.mjs`, and `static/agent-visualizer.css`.
- Existing approval UX includes: pending action queue, full approval key, review hint, safety note, decision options, resume note, temporary boundary, params preview, copy key, copy review package, copy retry config, and manual-copy fallbacks.

## Gap

- The retry config block currently shows raw JSON with `approvedToolActionKeys`, but it does not carry a compact receipt explaining that the config is only a one-time rerun token, does not include tool parameters/results, and must not be reused after reject/edit/context drift.
- This is a smaller, low-decision fix than implementing persistent checkpoints, and it supports the documented trust boundary.

## External References

- LangGraph interrupts persist graph state and resume from an interrupt point, which confirms that true recovery is a state-management feature rather than just a copied key.
- OpenAI Agents human review docs distinguish guardrails from human approval and describe pausing runs for approve/reject decisions.
- LangChain HITL middleware supports approve/edit/reject/respond decisions before tool execution, reinforcing that edit/reject should not reuse an old approval key.
- AEGIS argues for pre-execution mediation and audit records before side effects, supporting explicit approval receipts and local audit context.
