# Action Queue 空筛选恢复回执

## 背景

- 随机目标：`docs/index.md` 里的“动作队列”。
- Reminder：EventKit 找到 `Personal AI` 列表，但 4 条都是已完成的豆包/通知历史反馈；本轮没有 open item 可并入或标记完成。
- 外部参照：OpenAI Agents SDK / LangGraph HITL 都强调暂停、审批、恢复和状态持久化；Zapier Agents Activity 把 run 问题和需要处理项放在 activity 页；HITL 研究也要求高风险或不确定节点有清晰的人类介入边界。

## 发现

动作队列已经有定位请求回执、处理构成回执和刷新失败快照回执，但空筛选状态仍有一个可用性缝隙：如果用户从深链 `actionId` 或来源筛选进入 0 条结果，页面提示“清除筛选”，但实际只提供状态/模式筛选按钮，没有从 route filter 回到完整队列的入口。用户容易把 0 条误读成动作完成、已取消或队列清空。

## 实施计划

1. 在 `ActionQueue.vue` 空态中加入 `筛选空结果回执`，列出 actionId / 来源 / 状态 / 模式切片和 0 条结果边界。
2. 对 route filter 空态提供 `查看全部动作` 入口；对 UI 状态/模式筛选保留 `清除状态/模式筛选`。
3. 扩展 `tools/verify-action-queue-e2e.mjs`，覆盖状态筛选空结果和深链 actionId 空结果恢复。
4. 更新 `docs/memory_system.md` 与 `docs/index.md`，保持当前功能文档简洁同步。

## 验证计划

- `node --check tools/verify-action-queue-e2e.mjs`
- scoped `git diff --check`
- `npm start -- --progress` 等首轮 webpack dev 编译成功后停止
- `node tools/verify-action-queue-e2e.mjs`
