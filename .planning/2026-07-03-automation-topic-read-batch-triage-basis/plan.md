# Topic 未读阅读批次构成回执计划

## 目标

随机选中 `主题式未读阅读`。当前 Topic 详情页已经有 `阅读批次回执`，说明展开上下文和全部已阅的写入边界；但从用户视角看，进入 `仅未读` 后仍不够清楚这一批聊天为什么这样显示和排序，也不容易一眼区分已加载数量、当前可见数量、明确未读、暂留讨论和未知读状态。

## 外部参考

- Slack Unreads / Activity 把未读集中成 triage inbox，并提供快速标记、撤销和批量处理。
- Slack Later 把“稍后回来”从未读压力中拆出来，说明未读队列应该告诉用户哪些内容仍在当前处理批次。
- Zulip reading / muted topics / unread sync 说明未读视图通常是当前客户端加载边界内的阅读切片，静音或未加载历史会影响可见计数。
- Email deferral 和 conversation curation 研究都强调 triage 后的 re-entry；批次 UI 应直接解释当前切片、排序和恢复边界。

## 实施步骤

1. 在 Topic 详情页 `阅读批次回执` 增加可扫描的批次构成 chips：已加载、当前显示、明确未读聊天、主题未读信号、暂留讨论和未知读状态。
2. 在同一回执增加排序依据：本页先按明确未读聊天靠前，同状态保留详情返回顺序；不会补拉历史消息或重排后端主题。
3. 说明缺少明确读状态的历史聊天不会被自动算作未读，避免旧数据撑满 `仅未读`。
4. 更新 `verify-topic-based-messages` 和 E2E，对首屏回执新增文案和指标做断言。
5. 更新 `docs/features/topic_based_messages.md`，把本次行为写入 canonical docs。

## 验证

- `npm run verify:topic-based-messages`
- `npm start -- --progress` 首次成功编译后停止
- `npm run verify:topic-based-messages:e2e`
- scoped `git diff --check`
