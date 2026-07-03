# Agent Workflow 工具错误定位计划

## 目标功能

- 随机抽中：`Agent Workflow 运行诊断`
- Source of truth：`docs/features/agent_workflow.md`
- 本轮目标：让 Options 测试结果在首屏诊断里直接指出工具级错误发生在哪个 Agent / 工具上，而不是只显示 `工具错误 N`。

## 当前判断

- 文档描述基本覆盖当前实现：运行前范围、结构覆盖、编排回执、运行结论、就绪检查、下一步动作、运行诊断、保存样例和批量回归都已落地。
- 体验缺口在工具错误定位：如果 trace 里某个工具返回 `status: "error"`，但整个 Agent 仍有 trace，当前回执/诊断多处只显示 `工具错误 1`。作为排障用户，必须再展开执行 Trace 才能知道要修 `Agent / Tool` 哪一段。
- Reminder：本机 Reminders 可访问，但没有 `Personal AI` 列表，本轮没有可纳入或标记完成的反馈项。

## 外部参考结论

- OpenAI Agents SDK tracing 和 LangSmith / LangGraph 类产品都把工具调用作为可观测单元；排障摘要应该能直接定位工具调用，而不是只保留数量。
- OpenTelemetry GenAI 语义约定把 agent、tool 和 execution 字段结构化，说明报告应保留可索引的 Agent / Tool 身份。
- 2026 年 agentic workflow 结构覆盖论文强调 declared tools 是否被实际 exercised；本轮继续把工具错误定位留在结构化摘要，不导出原始消息正文或工具参数。

## 实现步骤

1. 在 `src/agentWorkflowDiagnostics.ts` 的 trace issue 汇总里加入 `toolErrorLabels`。
2. 让结构覆盖、编排回执、决策路径、运行诊断、运行就绪和下一步动作优先展示前几个 `Agent / Tool` 标签；只有 trace 没有标签时才回退到 `工具错误 N`。
3. 更新 `tools/verify-agent-workflow-diagnostics.ts` 覆盖 storageReview-only 和 trace-derived tool error 两种路径。
4. 更新 `tools/verify-agent-workflow-options-e2e.mjs`，确认 Options UI 在工具错误场景下首屏出现具体 Agent / Tool。
5. 更新 `docs/features/agent_workflow.md` 和 `docs/features/index.md` 的简要描述。

## 验证计划

- `npm run verify:agent-workflow`
- `npm start` 等待首次 webpack dev compile 成功后停止
- `node tools/verify-agent-workflow-options-e2e.mjs`
- scoped `git diff --check`
