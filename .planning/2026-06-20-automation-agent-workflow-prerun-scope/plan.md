# Agent Workflow 关注项测试运行前范围

## 目标

在 `Agent Workflow 关注项测试` 里补一个点击前总览，让用户在运行测试、样例、回放或保存样例前先看到：这只是 Options 本地测试，不会写入 Memory Service、发送通知、执行规则自动化、标记原消息已读或覆盖本地基线。

## 外部参考判断

- OpenAI Agents SDK 和 LangGraph 的 HITL 文档都强调暂停、审批、恢复和真实工具调用边界；当前功能还不是持久 HITL，因此应该避免把本地测试说成真实复核或执行。
- 2026 年结构覆盖测试论文强调 agent/tool/delegation 是否被实际覆盖；当前页面已有结构覆盖回执，本轮继续把覆盖与副作用边界前置。
- AgentTrace / observability 论文强调 trace 可用于排障和信任校准；当前应保留轻量 trace，不增加原始正文或工具参数导出。

## 实施步骤

1. 在 `agentWorkflowReplay.ts` 增加运行前范围 receipt builder，复用现有 receipt 类型。
2. 在 Options 关注项测试 header 下渲染 receipt，覆盖当前表单、样例/回放/保存样例/批量回归的统一运行边界。
3. 给 receipt 增加轻量样式和移动端适配。
4. 更新 Agent Workflow 功能文档和索引行。
5. 扩展 targeted verifier 与 Options E2E，证明点击前 receipt 可见且边界文案稳定。

## 验证计划

- `npm run verify:agent-workflow`
- `npm start` 首次成功编译后停止 watch
- `node tools/verify-agent-workflow-options-e2e.mjs`
- scoped `git diff --check`
