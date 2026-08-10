# Agent 执行架构落地

Goal: 按 `docs/progressing/agent-executor-architecture-plan.md` 落地除 Block E 外的全部采纳项；独立文档 `docs/features/agent_executor_runtime.md`；补确定性 eval 并跑通。

Source of truth: `docs/features/agent_executor_runtime.md`（progressing plan 已删除/归档）
Decision: Block 0/A/B/C/D/F/G/H 采纳；**Block E 不做**；文档独立；每期补 eval。

## Phases

### Phase 0 — Block 0 止血（Sheet 假成功）
- [x] Status: complete

### Phase 1 — Block A+B+H（基础）
- [x] Status: complete

### Phase 2 — Block C（Gateway）
- [x] Status: complete
- OpenClawGatewayExecutor；remote run ID；断连 reconcile → running；legacy responses 保留
- ActionExecutor 对 running/input_required 不 markSucceeded

### Phase 3 — Block F → D
- [x] Status: complete
- F: Streamable HTTP `/mcp` + 证据级工具 + `memory_evidence_get`
- D: AcpExecutor（codex-acp stdio）+ MCP 记忆注入

### Phase 4 — Block G（无 E）
- [x] Status: complete
- A2A routes + Agent Card；taskId ↔ agent_run_id

### Phase 5 — Docs + Evals
- [x] Status: complete
- `docs/features/agent_executor_runtime.md` + `docs/index.md`
- 回写 scheduled_messages / action_readiness
- eval suite `agent-executor-runtime`
- 删除 progressing plan

## Out of scope this run
- Block E（反向 Worker）
- OpenClaw/Codex 侧 `cleanup retired shared client` 根治

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| DispatchOutcome 缺 running → 误 markSucceeded | 1 | 扩展 queueStatus + executeAction early return |
| A2A test setUserRuntimeConfig 不存在 | 1 | 改用 PUT /api/v1/config |
