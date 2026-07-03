# Agent Thinking 诊断包快照边界计划

创建时间: 2026-06-15 21:05:15 CST

## 目标功能

- 随机选中: `Agent Thinking trace 可视化`
- 主文档: `docs/features/agent_thinking.md`
- 主要代码: `src/agentVisualizerPresentation.ts`、`src/agent-visualizer.tsx`

## 背景判断

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有需要优先完成的 carry-over。
- 本机 Reminders 可读，但没有名为 `Personal AI` 的列表，因此没有可纳入本轮的 Reminder 条目，也没有完成项可标记。
- 当前 worktree 已经很脏，本轮只触碰 Agent Thinking 诊断包/Options trace 可视化相关文件。

## 外部参考

- LangSmith Observability 把 agent trace 定义为从输入到最终响应的完整执行记录，包含工具调用、模型交互和决策点。
- Langfuse 把 trace 建模为一次请求/操作的容器，observations 是 trace 内的步骤；这支持在 UI 中区分单次 trace、步骤和会话。
- OpenTelemetry GenAI agent span 文档已迁到专门仓库且仍在演进，因此 Personal AI 当前本地诊断包不应伪装成标准 exporter。
- AgentTrace 论文强调 agent telemetry 需要结构化、可追溯、可用于 accountability；对本地复制诊断包而言，快照时间和非实时边界应显式可见。

## 改进计划

1. 在 `AgentRunDiagnosticPacket` 中增加 `snapshotBoundary`，记录生成时间、运行状态、来源和非实时复制语义。
2. 在 `buildAgentDiagnosticCopyScope` 中派生中文快照说明，让 Options UI 在复制前就说明“当前页面快照，不会自动更新”。
3. 在 `AgentVisualizer` 的诊断包范围列表中展示该说明。
4. 扩展 `tools/verify-memory-entry-agent-thinking.ts` 和 `tools/verify-agent-thinking-options-e2e.mjs`，同时覆盖 JSON payload 和 UI 文案。
5. 更新 `docs/features/agent_thinking.md`，记录本轮行为、边界、Reminder 状态和验证。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start` 首次 webpack dev 编译成功后停止 watch
- `node tools/verify-agent-thinking-options-e2e.mjs`
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md .planning/2026-06-15-automation-agent-thinking-diagnostic-snapshot-boundary/plan.md .planning/2026-06-15-automation-agent-thinking-diagnostic-snapshot-boundary/findings.md .planning/2026-06-15-automation-agent-thinking-diagnostic-snapshot-boundary/progress.md`
