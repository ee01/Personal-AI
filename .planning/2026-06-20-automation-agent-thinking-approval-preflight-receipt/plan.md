# Agent Thinking 工具审批前确认回执

## 目标功能

- 随机目标: `Agent Thinking 工具审批`
- 所属能力: Agent Thinking
- 主文档: `docs/features/agent_thinking.md`
- 代码入口: `src/agentThinking.ts`, `src/agentVisualizerPresentation.ts`, `src/agent-visualizer.tsx`

## 当前核查

- 代码已经支持按 `tool id + params` 生成精确批准 key，并在没有批准 key 时阻断中高风险或带副作用的工具。
- Options 演示已有待确认动作队列、复制 key、复制审核包、复制重跑配置、恢复边界、诊断包和 Trace 复核路线。
- 未完成但较大的方向是持久 checkpoint / 可恢复 approve-edit-reject run state；这需要跨 service worker 生命周期和 run 存储设计，不适合本轮无人值守小改。
- 本轮 AppleScript 可见 Reminders 列表没有 `Personal AI`，因此没有可纳入或标记完成的本地 Reminder item。

## 外部参考

- LangGraph interrupts: 中断应保存图状态并等待 resume，说明真正 HITL 不应只是复制 token。
- OpenAI Agents SDK HITL: 待批准工具调用会暂停 run、返回 interruption，并通过 RunState 恢复。
- LangChain HITL middleware: approve / edit / reject / respond 是明确的 decision model。
- AgentTrace: agent observability 需要把 operational / cognitive / contextual telemetry 结构化，才能追踪责任边界。

## 用户体验问题

现在待确认动作卡片有 key、审核包、重跑配置和恢复边界，但最靠前的位置仍先露出工具消息和很多操作。作为用户，我在点击复制前需要先看到:

- 这个动作当前只是 pending，停在哪个步骤。
- 当前没有执行通知、写入、删除或外部动作。
- 复制 key / 审核包 / 重跑配置只是复制文本，不等于批准、恢复或执行。
- 下一步应批准后同参数重跑；拒绝或修改参数时不复用旧 key。

## 实施计划

1. 在 `AgentPendingApprovalAction` 增加结构化 `preflightReceipt`，从现有 tool id、effect、risk、step 和 approval metadata 派生。
2. 把 `preflightReceipt` 写入复制审核包 JSON，避免离开页面后丢失审批前确认语义。
3. 在待确认动作卡片中把 `审批前确认` 渲染在复制按钮之前。
4. 补充 CSS，让回执紧凑、可换行，并保持长 key/参数不会撑破布局。
5. 更新 `tools/verify-memory-entry-agent-thinking.ts` 与 `tools/verify-agent-thinking-options-e2e.mjs`，覆盖结构化数据、UI 文案和审核包导出。
6. 更新 `docs/features/agent_thinking.md` 与 `docs/features/index.md`，只记录当前用户可感知行为，不展开实现细节。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start` 首次 webpack dev compile 后停止 watch
- `node tools/verify-agent-thinking-options-e2e.mjs`
- `git diff --check -- <本轮触达文件>`
- 检查无遗留 webpack watch 进程
