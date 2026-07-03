# Agent Thinking 诊断包导出边界计划

## 选择理由

- 随机候选来自 `docs/features/index.md` 的 `Agent Thinking 分析编排`。
- `docs/progressing/to-verify.md` 当前为空；本机 Reminders 可读，但没有 `Personal AI` 列表。
- 近几轮 Agent Thinking 已把诊断包、trace spans 和复制范围做成 UI 收据；剩余缺口是诊断包被复制到页面外后，payload 自身没有足够的 schema/export 边界。

## 外部参考

- OpenTelemetry GenAI agent spans 将 agent、workflow 和 tool execution 建模为可计算 span。
- LangSmith / Langfuse 这类产品强调 trace 要覆盖工具调用、模型交互和决策点。
- OpenAI Agents SDK HITL 文档把审批建模为可序列化、可恢复的 run state；当前 Personal AI 仍是本地临时重跑凭据，不应伪装成持久 checkpoint。
- AgentTrace 论文强调 operational / cognitive / contextual telemetry；本轮只补本地诊断 schema 边界，不引入完整 exporter。

## 实施步骤

1. 在 `AgentRunDiagnosticPacket` 中新增 `schemaBoundary`，写明 Personal AI 本地 schema、OTel/LangSmith/Langfuse 启发来源、支持用途、不支持用途和审批上下文边界。
2. 在 Options “诊断包范围”收据中展示同一 schema/export 边界。
3. 更新 `tools/verify-memory-entry-agent-thinking.ts` 和 `tools/verify-agent-thinking-options-e2e.mjs`，确认复制出来的 JSON 与 UI 文案都包含边界，且不泄露批准 key。
4. 更新 `docs/features/agent_thinking.md`，补上 2026-06-13 状态、Reminder 结果和验证记录。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start` 首次成功编译后停止 watch
- `node tools/verify-agent-thinking-options-e2e.mjs`
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md .planning/2026-06-13-automation-agent-thinking-export-boundary/plan.md`
