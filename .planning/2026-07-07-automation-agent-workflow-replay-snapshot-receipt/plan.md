# Agent Workflow 最近消息回放范围回执计划

## 背景

- 本轮从 `docs/features/index.md` 随机样本中选择 `Agent Workflow 关注项测试`，避开最近几轮刚精确覆盖的 Relationship Radar、Task Scheduler、Memory Capture、Rehearsal、Slides、Compose Assist、Ask、Meeting Pilot 和 Timeline 等功能点。
- `docs/progressing/to-verify.md` 当前无待校验事项。
- EventKit 能读取本机 `Personal AI` Reminders 列表：4 total / 0 incomplete，全部是已完成 Doubao / Notification / 测试历史项；没有开放的 Agent Workflow / 关注项测试 / 回放样例 / 本地门禁相关反馈可纳入或标记完成。
- Agent Workflow Options 测试面板已有运行前范围、内置样例、保存样例、批量回归、编排回执、证据包和基线写回等边界说明。剩余缺口在 `最近消息` 回放：刷新中、空结果、读取失败和选中样本状态仍主要靠下拉框或 error message，用户不容易判断它只是 Memory Service time 召回的只读快照。

## 外部参考

- OpenAI Agents SDK tracing 把 workflow、agent、tool、guardrail 等事件纳入 trace，并提醒敏感数据处理；这支持继续把本功能做成轻量可复核 trace，而不是复制完整消息正文。
- OpenAI Agents SDK HITL 文档把敏感工具调用暂停到人工审批；这支持本地测试面板继续清楚区分本地候选、真实复核入口和真实外部副作用。
- LangSmith Evaluation 文档把历史生产 traces、人工样例和回归测试串成 dataset -> evaluator -> experiment -> feedback loop；这支持最近消息回放只作为样本来源，真正发布前证据仍需保存样例和基线。
- Zapier Agents 当前产品文档把 configure/test/publish 分开，并说明 publish 才激活 trigger；这支持 Options 测试面板前置“测试不等于线上自动化运行”的边界。
- 2026-05 arXiv `Testing Agentic Workflows with Structural Coverage Criteria` 强调只看最终成功不足以证明 agent/tool/delegation 结构被覆盖；这支持本功能继续用样例、回放和保存基线展示结构覆盖资格，而不是把最近消息列表误当成完整 coverage。

## 改进计划

1. 扩展 `buildAgentWorkflowReplaySourceReceipt`，让最近消息来源回执能表达加载中、空结果、读取失败、未选择、已选中样本这几种状态。
2. 回执文案明确：刷新只发起 Memory Service time 召回读请求；空结果或失败不证明没有相关消息、不代表当前聊天页已覆盖；回放不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖保存基线。
3. 在 `options.tsx` 里把 `workflowReplayLoading`、`workflowReplayError`、`workflowReplaySamples.length` 传给回执 builder，保留现有刷新按钮、select 状态和错误提示。
4. 扩展 `tools/verify-agent-workflow-replay.ts` 覆盖 builder 的 loading / empty / error / selected 状态。
5. 扩展 `tools/verify-agent-workflow-options-e2e.mjs`，在 mocked 空 recall 下断言最近消息回执的只读快照、空结果和无副作用边界。
6. 更新 `docs/features/agent_workflow.md` 和 `docs/features/index.md` 的简短说明，只记录用户可见边界，不写实现细节。
7. 验证：`node --check` 相关脚本、`npm run verify:agent-workflow`、`npm start -- --progress` 首次成功编译后停止、`node tools/verify-agent-workflow-options-e2e.mjs`、scoped `git diff --check`。

## 执行结果

- 已完成最近消息回放来源回执扩展、Options 接入、focused verifier / E2E 覆盖和功能文档更新。
- 本轮改动不改变 Agent Workflow 编排、Memory Service recall / ingest API、真实消息入口、通知 / 自动化副作用、保存样例 schema 或基线写回语义。
- 所有计划内验证已通过。
