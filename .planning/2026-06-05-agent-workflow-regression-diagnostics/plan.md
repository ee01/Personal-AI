# Agent Workflow 批量回归诊断快照改进计划

## 目标功能

- 随机抽中的功能点：`Agent Workflow 运行诊断`
- Source of truth：`docs/features/message_analysis.md`
- 本轮目标：让 Options 的保存样例批量回归不仅比较行为字段，还能把本次运行的 trace 健康、就绪门禁、运行结论和下一步动作沉淀到页面列表与导出报告里。

## 当前判断

- 文档描述基本覆盖当前实现：决策路径、运行就绪检查、运行诊断、下一步动作、保存样例和批量回归都已存在。
- 代码缺口在批量回归闭环：单次测试页面能看到完整诊断，但批量回归结果和 JSON 报告只带 `shouldStore`、`shouldNotify`、复核、Trace、规则、置信度等基线字段。发布前排障时，用户需要重新打开单条样例才能知道为什么失败、需要修哪里。
- Reminder：本机 Reminders 可访问，但没有 `Personal AI` 列表，本轮没有可纳入或可完成的用户反馈条目。

## 外部参考结论

- OpenTelemetry GenAI agent spans 把 workflow / agent / tool execution 作为结构化 span 建模，说明报告应保留机器可读的运行状态，而不是只有自然语言摘要。
- OpenAI Agents SDK tracing 强调 trace 里包含 LLM、tool、handoff、guardrail 等事件，同时要控制敏感数据；本轮只导出诊断摘要，不导出消息原文或工具入参。
- LangGraph durable execution / persistence 强调 checkpoint 与 replay；本轮不做持久 checkpoint，但增强本地 replay regression 的可追溯结果。
- AgentTrace / XAgen / failure-aware observability 方向都强调从 trace 抽取失败信号和下一步排障动作；本轮把这些信号沉淀到批量回归报告。

## 实现步骤

1. 在 `src/options.tsx` 为批量回归结果增加诊断快照结构，复用现有 `buildAgentWorkflowResultDiagnostics`、`buildAgentWorkflowReadinessChecks`、`buildAgentWorkflowRecommendedActions` 和 `buildAgentWorkflowRunVerdict`。
2. 将诊断快照写入 `WorkflowSavedRegressionResult` 和导出的 `agent-workflow.saved-regression-report`。
3. 在批量回归列表中展示每条样例的简短门禁状态和首个建议动作，方便用户不用展开单条测试也能定位处理顺序。
4. 更新 `tools/verify-agent-workflow-options-e2e.mjs`，断言 UI 列表和导出 JSON 都包含诊断快照。
5. 更新 `docs/features/message_analysis.md`，把批量回归报告的诊断快照写入当前行为和本轮行业参考结论。

## 验证计划

- `npm run verify:agent-workflow`
- `npm start` 等待首次 webpack 编译成功后停止
- `node tools/verify-agent-workflow-options-e2e.mjs`
- `git diff --check`
