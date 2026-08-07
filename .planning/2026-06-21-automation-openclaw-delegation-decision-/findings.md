# OpenClaw Delegation Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `OpenClaw 外部委派`.
- Feature owner/capability: Memory Service action queue / external delegation.
- Source document: `docs/memory_system.md`.
- Local Reminders scan returned `NO_PERSONAL_AI_LIST`; available lists were `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, and `Tasks`.
- No local Reminder item can be incorporated or completed for this feature in this run.
- The worktree is broadly dirty from prior user/automation work; preserve unrelated changes.

## Code And UX Findings

- `docs/memory_system.md` is current for the OpenClaw delegation backend contract: `/v1/responses`, black-box single-turn delegation, final JSON result consumption, transcript display, verifiable artifact gating, stale running handling, and failure recovery actions.
- Backend safety is already strong: `ActionExecutor.delegateOpenClaw()` blocks approval-required auto execution, only records action results on success, and enqueues recovery confirmation/notification paths for capability, auth, and human-decision failures.
- `OpenClawDelegationService` requires verifiable artifact anchors before accepting external results as durable `action_results`.
- Action Queue already has `委派预检`, `证据校验回执`, result artifact panels, transcript expansion, and post-click `操作回执`.
- UX gap: the `人工确认` panel is generic. For `delegate_openclaw`, the decision point should repeat the critical mode/target/result boundary where the user actually clicks `确认并执行`, especially for write-bearing external actions.

## External Reference Findings

- OpenAI Agents SDK HITL treats sensitive tool calls as pending approvals and resumes from serialized run state after approval or rejection.
- LangChain/LangGraph HITL frames human decisions as approve, edit, reject, or respond over paused graph state.
- Microsoft Copilot Studio RFI and multistage approvals model human review as a structured pause for oversight in automated flows.
- Recent agent-audit guidance emphasizes logging the prompt/context/action chain and retaining approved action accountability, not only trace/debug information.
- Product/research direction: the approval card should make the proposed external action, approval meaning, and proof-of-completion contract visible before the click.
