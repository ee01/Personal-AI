# Scheduled Messages 草稿建议回执

## 目标

- 随机选中 `docs/index.md` 中的 `Scheduled Messages / 队列可视化与改期建议`。
- 本轮只处理新增 / 编辑表单里的 `使用建议时间` 路径，不改执行器、Sheet schema 或 Jira Automation 规则。

## 外部参照

- Slack / Teams / Gmail 这类排程消息入口强调集中管理、编辑、改期和取消，不把草稿选择等同于已发送。
- Twilio Message Scheduling 和 Jira Automation 文档都把 scheduled / canceled / disabled / audit log 这类运行状态显式化，适合继续强化“建议、写入、真实执行”三段边界。
- Trigger-action debugging 研究指出终端用户需要看到失败位置、下一步和规则是否真正生效；这里的队列建议也应解释为什么建议这个时间。

## 实施计划

1. 核对文档、`scheduleQueuePressure`、管理页 UI 和现有 E2E，确认当前列表卡片已有建议原因。
2. 给新增 / 编辑表单的 `使用建议时间` 增加草稿回执，显示目标时间、原因，以及尚未写入 Sheet / 尚未发送的边界。
3. 当用户继续手动修改日期、时间、执行方式或队列相关字段时，清掉旧草稿回执。
4. 更新 `docs/features/scheduled_messages_manager.md`，只补当前用户可感知行为。
5. 扩展 queue suggestion E2E，验证草稿建议不会触发 Sheet 写入，并保留原有列表一键改期验证。

## 验证

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/scheduled-messages/__tests__/scheduleQueuePressure.test.ts`
- `npm start` 到第一次 webpack successful compile 后停止 watch
- `node tools/verify-scheduled-messages-queue-suggestion-e2e.mjs`
- `git diff --check -- src/scheduled-messages/ScheduledMessagesManager.tsx tools/verify-scheduled-messages-queue-suggestion-e2e.mjs docs/features/scheduled_messages_manager.md .planning/2026-06-18-automation-scheduled-draft-suggestion-receipt/plan.md`
