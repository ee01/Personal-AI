# Agent Thinking 工具审批决策导览

## 目标功能

- 随机抽中: `Agent Thinking 工具审批`
- 功能文档: `docs/features/agent_thinking.md`
- 主要源码: `src/agentThinking.ts`, `src/agentVisualizerPresentation.ts`, `src/agent-visualizer.tsx`, `static/agent-visualizer.css`
- 验证脚本: `tools/verify-memory-entry-agent-thinking.ts`, `tools/verify-agent-thinking-options-e2e.mjs`

## 当前观察

- 工具审批已经会执行前阻断高风险/副作用工具，生成精确绑定 `tool id + 参数` 的批准 key。
- Options 待确认动作卡片已经展示审批前确认、复核重点、安全说明、处理方式、恢复边界、参数、key、审核包和重跑配置。
- 仍未完成的是持久 checkpoint / 可恢复 approve-edit-reject run state；这需要更大的状态模型和用户决策，本轮不直接实现。
- 作为用户体验官视角，当前最小卡点是: 用户看到三种处理方式时，还要从说明段落里推断“当前状态是什么、点复制后会不会执行、拒绝或修改时旧 key 是否还能用”。

## 外部参考约束

- OpenAI / LangChain / LangGraph 的 human-in-the-loop 工具调用都把审批建模成 interrupt/review/resume，而不是单纯暴露 token。
- AgentTrace / AgentOps / AEGIS 相关论文强调执行前拦截、结构化审批上下文和可审计路径。
- Personal AI 当前没有持久恢复 run state，因此应该继续明确“临时重跑凭据”的边界，同时让 approve / reject / edit 三条路径更可扫。

## 实施计划

1. 在 presentation 层新增 `decisionGuide` 数据结构，给每个待确认动作生成批准、拒绝、修改三条路径的当前状态、下一步和边界。
2. 把 `decisionGuide` 写入审核包 JSON，便于离开页面复核时仍保留同一组路径说明。
3. 在 Options 待确认动作卡片中展示“审批决策导览”，放在复核重点之后、具体按钮之前。
4. 补 CSS，保证移动/窄宽度下三条路径不会挤爆或遮挡。
5. 更新 Agent Thinking 文档，说明这是临时审批 UI 的新增行为，不等于持久 checkpoint。
6. 跑 Agent Thinking targeted verify、`npm start` 首次编译、Options E2E 和 scoped `git diff --check`。

## Reminder 状态

本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有可纳入或可标记完成的 Reminder item。
