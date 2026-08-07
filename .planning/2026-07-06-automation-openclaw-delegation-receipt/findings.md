# OpenClaw Auto Delegation Findings

## Requirements
- User asked for a random `docs/index.md` feature sweep: verify docs vs code, search industry/papers, incorporate relevant Reminders, plan first, implement, update docs, and run strong verification.
- Selected feature: `OpenClaw 外部委派` under Memory Service, source doc `docs/memory_system.md`.
- Reminder state: AppleScript did not list `Personal AI`; Swift/EventKit found `Personal AI` with 4 completed historical Doubao/Notification items and 0 open related items.

## Research Findings
- Code already has OpenClaw-specific pending operation receipts, approval checkpoint receipts, failure receipts, artifact verification receipts, recovery-path receipts, and result panels.
- The remaining UX gap is `delegate_openclaw` with `queueStatus='queued'`, `executionMode='auto'`, and no approval requirement. The schedule panel says it will run on the next scheduler scan, but the OpenClaw preflight text still says "will send to OpenClaw" without naming the background trigger. A user could mistake viewing the card for starting the delegation.
- OpenAI Agents SDK HITL docs model sensitive tool calls as approval interruptions that pause and later resume from run state: https://openai.github.io/openai-agents-python/human_in_the_loop/
- Anthropic Computer Use docs treat desktop/browser control as higher risk and recommend isolation, limited privileges, domain allowlists, and human confirmation for consequential actions: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- Microsoft Research Magentic-UI frames agentic external tool work around co-planning, action guards, approvals, and answer verification; this supports making trigger and verification boundaries visible: https://www.microsoft.com/en-us/research/wp-content/uploads/2025/07/magentic-ui-report.pdf
- Trigger-action debugging research (EUDebug) shows users need to understand when rules fire and how actions are simulated/debugged, because invisible triggers can produce surprising outcomes: https://dl.acm.org/doi/fullHtml/10.1145/3290605.3300618

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add an auto-trigger fact/helper to OpenClaw preflight | Keeps the change local to the presentation layer and reuses existing queue/action state. |
| Cover a read-only auto queued OpenClaw fixture in E2E | Proves the new copy appears for automatic delegation without changing manual approval/write paths. |
| Avoid backend action policy changes | Existing `resolveDelegateOpenClawPolicy` already prevents approval-required actions from staying auto; the request is UX correctness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing OpenClaw receipts are extensive | Narrowed implementation to the one state transition not yet named: queued automatic scheduler pickup. |

## Resources
- `src/modals/components/ActionQueue.vue`
- `tools/verify-action-queue-e2e.mjs`
- `docs/memory_system.md`
- `memory-service/src/core/actions/ActionExecutor.ts`
- `memory-service/src/core/actions/delegateOpenClawPolicy.ts`
