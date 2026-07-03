# Message Analysis 系统观察刷新失败快照计划

## 目标功能

- 随机选中：`系统观察规则` / Message Analysis
- 主文档：`docs/features/message_analysis.md`
- 主要入口：`topic-modal.html` 的“记忆入口规则”页面

## 现状检查

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有待接续验证项。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，因此没有 Reminder 条目可纳入或标记完成。
- 规则页已经能读取 Outreach runtime status，并展示系统观察数量、样例范围、观察起点、副作用边界和成功空状态。
- 当前缺口：如果页面已经成功读到运行中的内部观察，下一次读取失败会清空样例并只显示不可用。真实用户排查时无法区分“Memory Service 暂时读取失败”和“内部观察已经全部停止”。

## 外部参考

- Slack Workflow Builder 的 keyword workflow 需要显式声明 channel 和 keyword conditions，支持把触发范围做成用户可理解的状态。
- Zapier Filters / Paths 把条件 gate 和后续动作拆开，失败或不满足条件时不会继续执行后续步骤。
- Trigger-action programming 研究强调非程序员需要看见触发条件、动作后果和调试证据。
- Attention-Sensitive Alerting 研究支持把可能打扰用户的通知和后台观察分开表达，避免内部观察伪装成即时打扰。

## 改进计划

1. 在 `SystemObservationSnapshot` 中保留刷新失败元信息：是否为 stale snapshot、最近成功读取时间、刷新失败时间和失败原因。
2. 在系统观察摘要中提供 `重新读取` 控制；它只重新拉取 Outreach runtime status，不触发历史消息分析或规则写入。
3. `loadSystemObservationSnapshot()` 失败时，如果当前已有成功快照或成功空状态，保留原来的数量和样例，只把状态标为失败并增加“刷新失败 · 上次快照”回执。
4. 渲染层在失败但有上次快照时继续展示 metrics / samples / empty receipt，并明确当前 Memory Service 状态未确认、不可据此判断内部观察已停止或仍在运行。
5. 扩展 `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`：先验证成功快照，再点击 `重新读取` 模拟 runtime status 503，断言上次样例保留且显示未确认边界，再恢复空状态验证原空状态路径。
6. 更新 `docs/features/message_analysis.md`，把系统观察刷新失败快照边界写入主文档。

## 验证计划

- `npm run verify:message-analysis-rule-diagnostics:e2e`
- `npm start` 首次成功编译后停止 watch
- `git diff --check -- src/modals/topic-modal.tsx tools/verify-message-analysis-rule-diagnostics-e2e.mjs docs/features/message_analysis.md .planning/2026-06-16-automation-message-analysis-system-observation-stale-snapshot/plan.md`
