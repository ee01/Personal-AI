# OpenClaw Delegation Findings

## Requirements
- User asked for a random `docs/index.md` feature sweep: verify current docs vs code, research related products/papers, include relevant `Personal AI` Reminders, plan first, implement, update docs, and run strong verification.
- Selected feature: `OpenClaw 外部委派` under Memory Service, source doc `docs/memory_system.md`.
- Initial random draw selected `梦境重放`, but `.planning/2026-07-12-automation-dream-review-filter/` already covered the Dream Replay family recently, so this run rerolled.
- Reminder state: AppleScript listed Reminder lists but missed `Personal AI`; Swift/EventKit found `Personal AI` with 4 total items and 0 incomplete items. All items are completed historical Doubao/Notification feedback and unrelated to OpenClaw delegation.

## Code And UX Findings
- `docs/memory_system.md` is current for the core OpenClaw delegation design: `delegate_openclaw` actions, approval gating, artifact validation, transcript path, recovery actions, and July 6 queued-auto scheduler boundary are all described.
- `src/modals/components/ActionQueue.vue` already has OpenClaw-specific preflight, approval checkpoint, operation pending/result, failure, artifact verification, recovery path, result artifact, structured payload, and stale-running receipts.
- Prior `.planning/2026-07-06-automation-openclaw-delegation-receipt/` already implemented the queued-auto background scheduler boundary, including E2E assertions.
- Remaining low-decision UX gap: the transcript toggle button remains a generic `展开` / `收起`. The surrounding panel says `transcript: ...`, but the click target does not expose that expansion only reads a stored `delegations/` user file and does not rerun OpenClaw, approve/retry/cancel a queue item, write `action_results`, confirm external facts, or mutate Jira/Drive/deployment systems.
- The existing E2E fixture already has a succeeded OpenClaw delegation with a real transcript file route, making it the right proof surface for the transcript control boundary.

## External Reference Findings
- OpenAI Agents SDK HITL docs model sensitive tool calls as run interruptions that pause for approval/rejection and resume from serialized run state: https://openai.github.io/openai-agents-python/human_in_the_loop/
- LangGraph HITL docs emphasize durable interrupts/checkpoints, explicit approve/reject/edit/respond decisions, and rendering the pending action in a review card before resume: https://docs.langchain.com/oss/python/langchain/frontend/human-in-the-loop
- Zapier Human in the Loop pauses automation runs for reviewer approval, lets reviewers approve/decline/change data, supports timeout behavior, and exposes audit-log review: https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop
- Salesforce Agentforce Operations emphasizes centralized process status and a full audit trail for actions, supporting visible action evidence rather than hidden automation state: https://www.salesforce.com/agentforce/operations/
- Microsoft Copilot Studio RFI pauses agent flows to collect human reviewer input and resumes with those responses, reinforcing that human-review surfaces need clear pause/resume boundaries: https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information
- Atlassian Rovo automation docs show agents can be invoked inside automation rules and require admin-managed triggers for autonomous work, supporting explicit trigger/source boundaries: https://support.atlassian.com/rovo/docs/agents-in-automations/
- Magentic-UI research frames human-agent interaction around action approval, answer verification, memory, and multitasking; for this feature, transcript expansion should be clearly framed as verification/audit rather than execution: https://arxiv.org/html/2507.22358v1

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a helper for transcript toggle boundary text | Keeps repeated title/ARIA text consistent and easy to test. |
| Include mode, target system, and transcript path in the boundary | Users should know whether this is a read/write delegation and what stored file is being inspected. |
| Keep transcript fetch behavior unchanged | The UI already safely rejects non-`delegations/` paths and reads through `client.readUserFile`; the issue is presentation clarity. |
| Assert the boundary in `verify-action-queue-e2e.mjs` | Existing E2E already loads the built extension, fixture actions, and transcript route. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The repo has broad pre-existing dirty state in many feature files | Limit ownership to the transcript-boundary helper/attributes, matching E2E assertion, concise docs/index updates, planning files, active-plan pointer, and automation memory. |
| `OpenClaw 外部委派` already has many receipts | Chose the remaining actual control-point gap instead of adding a redundant panel. |

## Resources
- `src/modals/components/ActionQueue.vue`
- `tools/verify-action-queue-e2e.mjs`
- `docs/memory_system.md`
- `docs/index.md`
- `.planning/2026-07-06-automation-openclaw-delegation-receipt/`
