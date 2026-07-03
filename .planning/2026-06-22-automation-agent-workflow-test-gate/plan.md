# Agent Workflow 关注项测试本地门禁计划

## 目标

让 Options 里的关注项测试在用户点击前区分两件事：

1. 当前表单是否可以运行一次本地测试。
2. 这次测试是否足够作为发布前本地回归证据。

## 外部参考

- OpenAI Agents SDK HITL：审批/恢复和真实副作用需要明确暂停点。
- LangSmith evaluation：发布前证据需要数据集、评估结果和版本对比。
- Zapier Agents publish/test：测试态和发布后自动触发态必须分开。
- Testing Agentic Workflows with Structural Coverage Criteria：多 Agent 测试不能只看最终结果，也要确认 declared agents/tools/restrictions 被实际覆盖。

## 实施步骤

1. 扩展 `buildAgentWorkflowRunScopeReceipt()`，加入本地门禁资格判断。
2. 在 Options 页传入当前保存样例是否有基线、输入是否仍对齐保存样例、当前 Agent 配置是否匹配基线。
3. 更新 targeted verifier 和 Options E2E，覆盖无保存基线、门禁可用、配置变更、结果过期等状态。
4. 更新 `docs/features/agent_workflow.md` 和 `docs/features/index.md`，保持文档和代码一致。
5. 运行 `verify:agent-workflow`、`npm start` 首次成功编译、Options E2E 和 scoped `git diff --check`。
