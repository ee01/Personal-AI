# Agent Workflow 保存基线配置快照

## 目标

随机选中 `Agent Workflow 关注项测试`。本轮聚焦一个小但关键的 UX 边界：保存样例基线已经能比较存储、通知、复核、Trace、规则和置信度，但没有把“建立基线时的 Agent 配置版本”纳入对比，用户调整 Agent 顺序或工具后容易把配置版本差异误读成消息判断质量漂移。

## 外部参考

- OpenAI Agents SDK tracing：agent / tool / guardrail trace 应服务开发与生产排障。
- LangSmith Evaluations：保存 curated datasets 并比较版本，是发布前回归的主路径。
- OpenTelemetry GenAI semantic conventions：agent workflow/tool execution 需要结构化、可过滤的观测字段。
- Testing Agentic Workflows with Structural Coverage Criteria：多 Agent 工作流测试不只看最终结果，还要确认 agents、tool edges 和限制路径是否被覆盖。

## Plan

1. 在保存样例的 expected result 中加入 Agent 配置快照：启用 Agent 数、总 Agent 数、启用工具数、首阶段和稳定 comparison key。
2. 保持旧保存样例兼容：旧基线没有配置快照时不强制判定为行为漂移。
3. 在保存样例来源回执里，当基线配置和当前配置不同，明确标出“配置已变更”；如果结果也已过期，两者同时展示。
4. 在单条保存基线对比和批量回归报告中加入配置行/配置摘要，帮助区分配置版本变化和业务结果变化。
5. 更新 `docs/features/agent_workflow.md`，并跑 Agent Workflow helper verify、extension compile、Options E2E 和 scoped diff check。

## 实现结果

- `src/agentWorkflowReplay.ts`：新增 Agent 配置快照结构、归一化、格式化和保存样例回执配置漂移文案。
- `src/options.tsx`：复用配置快照作为 stale key；保存基线、批量回归、导出报告都携带配置摘要。
- `tools/verify-agent-workflow-replay.ts`：覆盖配置快照、回读和配置漂移回执。
- `tools/verify-agent-workflow-options-e2e.mjs`：覆盖真实 Options 保存基线、报告字段和配置变更后的回执提示。
- `docs/features/agent_workflow.md`：同步当前行为。

## Reminder

本机 Reminders 可读，但列表名中没有 `Personal AI`，因此本轮没有相关 Reminder item 可纳入、备注或标记完成。

## Validation

- `npm run verify:agent-workflow-replay`：通过。
- `npm run verify:agent-workflow`：通过。
- `npm start`：首次 webpack dev compile 通过，随后停止 watch。
- `node tools/verify-agent-workflow-options-e2e.mjs`：通过。
- `git diff --check -- src/agentWorkflowReplay.ts src/options.tsx tools/verify-agent-workflow-replay.ts tools/verify-agent-workflow-options-e2e.mjs docs/features/agent_workflow.md .planning/2026-06-15-automation-agent-workflow-baseline-config-snapshot/plan.md`：通过。
