# Agent Thinking trace 复核路线步骤定位

## 目标

- 随机目标: `Agent Thinking trace 可视化`。
- 让 Options 演示页首屏 `Trace 复核路线` 不只展示状态摘要，还能直接定位到相关 trace 步骤。
- 保持本轮为 UI / presentation 层改进，不引入标准 exporter、持久 checkpoint 或新的审批状态机。

## 检查结论

- `docs/features/agent_thinking.md` 已覆盖当前诊断包、trace id、审批队列、流程图定位和待确认动作边界；未完成的大项是标准 exporter 与可恢复 run checkpoint，自动化里不直接实现。
- 代码的 `buildAgentTraceReviewLane()` 已把运行状态、审批上下文、工具证据和诊断包拆成四个条目，但首屏条目本身没有步骤跳转，用户仍需要往下找运行检查或流程图节点。
- Reminders 可访问，但本机没有 `Personal AI` 列表，因此没有可纳入或完成的 Reminder 项。
- 外部参考: OpenAI Agents SDK tracing/human review、LangSmith/Langfuse observability、OpenTelemetry GenAI conventions、AgentTrace/AgentOps/AEGIS 都支持“先呈现可追责状态，再快速定位风险/证据/审批步骤”的方向。

## 实施计划

1. 给 `AgentTraceReviewLaneItem` 增加可选 `stepIndexes`，由诊断包里的 terminal step、pending approvals 和 review items 派生。
2. 在 `AgentVisualizer` 的 `Trace 复核路线` 卡片内渲染 `步骤 #N` 按钮，复用现有 `jumpToStep()`，点击只展开并聚焦对应 trace 步骤，不批准、不复制、不重跑、不执行外部动作。
3. 补 CSS，保证步骤按钮在紧凑卡片里不会撑破布局。
4. 更新 `tools/verify-agent-thinking-options-e2e.mjs`，验证审批上下文和工具证据路线能显示步骤按钮并跳转。
5. 更新 `docs/features/agent_thinking.md`，记录当前能力边界和验证覆盖。
