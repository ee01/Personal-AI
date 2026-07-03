# Agent Workflow 批量基线写回回执

## 目标功能

- 随机抽中：`Agent Workflow 关注项测试`
- 主文档：`docs/features/agent_workflow.md`
- 入口：Options 页面 `标准 Agent 工作流` 的关注项测试、保存样例和批量回归。

## 发现

- 文档和实现已经覆盖内置样例、最近消息回放、保存样例、单次基线对比、批量回归和导出报告。
- 批量回归的 `接受 N 个结果为基线` 会改写本地保存样例的 `expectedResult`，但旧 UI 只显示一行状态，用户不容易确认改写范围、失败项是否被覆盖、以及是否触发真实消息处理副作用。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有可合并或可标记完成的反馈项。

## 外部参考

- OpenAI Agents SDK tracing / LangGraph persistence / LangSmith evaluations / structural coverage testing 都指向同一方向：保存样例和回归基线要保留可复核的 trace、覆盖和版本对比边界；写回基线应说明它只改变测试基线，不等于线上消息处理已经通过。

## 改进计划

1. 在批量接受结果为基线后显示 `批量基线写回回执`。
2. 回执说明接受数量、变化样例数、无基线样例数、失败项未覆盖、样例总数和本地 storage 边界。
3. 保持现有回归数据结构、导出报告和真实消息处理路径不变。
4. 更新 Options E2E 断言和功能文档。
5. 验证：`npm run verify:agent-workflow`、`npm start` 首次编译、`node tools/verify-agent-workflow-options-e2e.mjs`、`git diff --check`。
