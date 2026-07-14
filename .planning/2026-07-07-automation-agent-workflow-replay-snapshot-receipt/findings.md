# Agent Workflow 最近消息回放范围回执 Findings

## 仓库与 Reminder

- `AGENT.md` 要求本类 runtime/UI 改动至少走 focused verifier + `npm start` 首次成功编译，Options/extension UI 变更还应跑相关 Playwright E2E。
- `docs/progressing/to-verify.md` 当前为空。
- 自动化记忆显示最近刚覆盖 Relationship Radar、Task Scheduler、Memory Capture、Rehearsal、Google Slides、Compose Assist、Ask、Meeting Pilot 和 Timeline 等；本轮选择 Agent Workflow 关注项测试，避免重复最新精确目标。
- EventKit 读到本机 `Personal AI` Reminders 列表：4 total / 0 incomplete；条目均为已完成 Doubao / Notification / 测试反馈，无 Agent Workflow 相关开放项。
- 工作区已有大量 unrelated dirty state；本轮只拥有 Agent Workflow 最近消息回放范围回执、对应验证、简短 docs/index 更新、计划文件和自动化记忆。

## 代码发现

- `docs/features/agent_workflow.md` 已描述 Agent Workflow 的编排、低置信度复核、Options 关注项测试、保存样例、批量回归、证据包和本地门禁。
- `src/options.tsx` 的 `loadWorkflowReplaySamples` 会调用 `MemoryServiceClient.recall('', { channels:['time'], includeMetadata:true })`，再用 `buildAgentWorkflowReplayMessages` 构造最多 8 条最近消息样本。
- 最近消息 select 在加载中/空结果时会显示 `加载中...` 或 `无可用消息`，并用 `workflowReplayError` 显示 `没有可回放的最近消息` 或错误消息。
- `buildAgentWorkflowReplaySourceReceipt` 目前只根据是否有选中 message 显示 `最近消息范围` / `最近消息回放范围`，不能表达 loading、empty 或 error 是否只是只读快照。
- `tools/verify-agent-workflow-replay.ts` 已覆盖 replay message 构造和基础回执；适合补 builder 级状态断言。
- `tools/verify-agent-workflow-options-e2e.mjs` 当前 mock `/api/v1/recall` 返回空 items，适合补 Options 首屏空结果回执断言。

## 外部参考

- OpenAI Agents SDK tracing: trace 覆盖 LLM、tool、handoff、guardrail 等 workflow event，并有 sensitive data 章节；支持本功能继续前置轻量 trace 和敏感原文不默认复制。
- OpenAI Agents SDK HITL: 敏感 tool 可暂停到人工审批，审批通过/拒绝后 resume；支持把本地低置信/测试候选和真实复核入口分开。
- LangSmith Evaluation: 评估 workflow 包含 curated dataset、历史 production traces、evaluator、experiment 和 feedback loop；支持最近消息回放只是样本来源，发布前证据应落到保存样例和基线。
- Zapier Agents: configure/test/publish 分离，publish 后 trigger 才会激活；支持 Options 测试面板持续强调本地测试不触发线上自动化。
- `Testing Agentic Workflows with Structural Coverage Criteria` (arXiv:2605.26521): 结构覆盖能证明 agents/tools/delegation obligations 是否被 exercised，但不替代语义和端到端评估；支持不要把最近消息样本数量误作完整 coverage。

## 选定切片

为 `最近消息` 来源回执增加刷新中、空结果、读取失败和已选中样本的只读快照边界。这是 presentation/test-only 改进，不改 Agent Workflow 编排、Memory Service recall API、真实消息入口、副作用或保存样例 schema。
