# Watch 取消关注确认回执计划

## 目标功能

- 随机抽中的小功能点：`关注后续 / Watch`
- 主文档：`docs/features/message_reaction.md`
- 主要代码：`src/modals/components/FollowThreads.vue`、`src/message-reaction/followThreadPresentation.ts`
- 现有验证：`npm run verify:message-reaction`、`npm run verify:follow-threads-management:e2e`

## 发现

- `docs/progressing/to-verify.md` 为空，本轮应从 `docs/index.md` 随机选择已落地功能。
- Watch 管理页已经有列表快照、监听状态、空筛选和操作完成回执。
- 取消关注仍依赖浏览器原生 `confirm()`，确认前只显示规则名，没有说明它只删除本机手动规则、不会删除原消息、不会清理已写入 Memory Service 的历史索引、不会补发或撤回通知。
- 这会把关键安全边界放到操作之后才出现，且原生 dialog 不符合当前页面已有的回执式 UX。

## 实施计划

1. 新增取消前的 `取消关注待确认` 回执文案构建器，包含规则、删除范围、非效果边界和可撤回的“返回”动作。
2. 将 Watch 管理页的 `confirm()` 替换为卡片内 inline 确认态；第一次点击只打开确认回执，二次确认才删除本地手动规则。
3. 保持延长、筛选、命中时间线、系统 Watch 隐藏和存储结构不变。
4. 更新 Message Reaction 单元测试和 Follow Threads E2E：断言无原生 dialog、确认前 storage 不变、确认后只删除手动规则并保留系统 Watch。
5. 更新 `docs/features/message_reaction.md` 和 `docs/index.md` 的 Watch 行，记录取消前确认边界。

## 验证计划

- `node --check tools/verify-follow-threads-management-e2e.mjs`
- `npm run verify:message-reaction`
- `npm start -- --progress`，等首次成功编译后停止
- `npm run verify:follow-threads-management:e2e`
- scoped `git diff --check`

## 非目标

- 不改变关注后续匹配、索引、通知、Digest、ChromaDB、Memory Service 历史索引或后台清理策略。
- 不改变 `concernedItems` 数据结构。
- 不新增远端读取、历史回扫、通知补发或消息发送。
