# Agent Workflow 单次运行证据包改进计划

## 本轮目标

- 随机目标：`Agent Workflow` / `关注项测试`
- 选择原因：近期自动化已经连续触达 Meeting Pilot、Project Dashboard、Notification Center、Jira Design Links、Memory Capture、Today Pilot、Message Reaction、User Profile、Rehearsal、Relationship Radar 等功能；本轮避开这些最新家族。
- Reminders：本机 Reminders 可读，但列表名中没有 `Personal AI`，因此没有可纳入或标记完成的用户反馈项。

## 现状检查

- 文档 `docs/features/agent_workflow.md` 已经覆盖关注项测试、最近消息回放、本地保存样例、结构覆盖、运行前范围、基线写回和批量回归。
- 代码侧已有 `buildAgentWorkflowOrchestrationReceipt`、`buildAgentWorkflowStructuralCoverage`、`buildAgentWorkflowRunVerdict`、readiness checks、recommended actions 和批量回归 JSON 导出。
- UX 缺口：单次运行刚完成时，用户只能看页面或等保存样例后做批量报告，不能把本次结论、结构覆盖、复核/阻塞项和副作用边界作为一段可携带材料复制给发布检查或 issue 备注。

## 外部参考

- Zapier Agents 把 trigger、tools、knowledge sources 和测试/发布边界拆开，说明 agent 自动化需要发布前测试材料。
- LangSmith Evaluation 强调 curated datasets、版本比较和回归捕捉，说明本地保存样例之外还需要轻量可交接证据。
- OpenAI Agents SDK tracing / HITL 把 trace 和人工审批边界做成运行结果的一部分，说明复制材料必须保留“不会真实执行副作用”的边界。
- `Testing Agentic Workflows with Structural Coverage Criteria` 论文强调多 Agent 测试不能只看最终成功，还要证明 agent/tool 结构被实际覆盖。

## 改进计划

1. 在 `src/agentWorkflowDiagnostics.ts` 增加 `buildAgentWorkflowRunEvidencePacket()`：
   - 输入本次运行结果和当前 Agent 配置。
   - 输出 title、summary、detail、chips、boundary 和可复制 text。
   - 复制文本只包含 verdict、编排摘要、结构覆盖、就绪项、下一步动作、存储/通知/置信度和无副作用边界。
   - 明确不包含原始消息正文、工具参数或长期 Memory Service 写入。
2. 在 `src/options.tsx` 的关注项测试结果区增加“单次运行证据包”卡片：
   - 提供 `复制证据包` 按钮。
   - 复制成功后显示本地剪贴板回执。
   - 如果结果已因输入或配置变更而过期，回执标记为 `旧快照`，避免用户把旧结果当作当前门禁。
3. 更新 `tools/verify-agent-workflow-diagnostics.ts` 和 `tools/verify-agent-workflow-options-e2e.mjs`：
   - helper 断言覆盖包内容、边界和不含原始正文。
   - E2E 断言页面可复制、剪贴板有结构覆盖/下一步、无 Memory Service/通知/规则自动化副作用，且旧快照提示可见。
4. 更新 `docs/features/agent_workflow.md`：
   - 保持文档简洁，只补单次运行证据包的用户可见行为和边界。

## 验证计划

- `npm run verify:agent-workflow`
- `npm start` 等首个 webpack dev compile 成功后停止
- `npm run verify:agent-workflow-options:e2e` 或直接运行对应 E2E 脚本（若脚本未注册则使用现有命令）
- scoped `git diff --check`
