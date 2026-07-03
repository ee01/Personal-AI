# Glip AI 标注本地快照边界

## 目标

本轮从 `docs/features/index.md` 随机样本中选择 `Message Reaction / Glip AI 标注`。目标是修复一个小但会影响信任感的 UX 缺口：原消息旁的 AI 标注已经显示来源和缓存刷新时间，但仍容易被误读成实时远端确认。

## 参考信号

- Reminders：本机 Reminders 可读取，但没有 `Personal AI` 列表，因此没有可纳入或可完成的用户反馈项。
- 产品参考：Slack Later / Reminders 和 Gmail Snooze 都把延后事项放在统一可管理视图中；Microsoft Teams Recap 把 AI follow-up task 锚在可复核的 Recap/聊天路径里。
- 论文参考：MobileHCI 2018 Snooze 研究和 prospective memory/reminder 研究都指向同一件事：延后和提醒必须让用户知道状态、来源、何时会回来以及如何确认。

## 改进计划

1. 在 Glip AI 普通标注 tooltip 中补一条“状态边界”回执：说明它来自本地 marker cache，不代表实时远端查询。
2. 当 marker cache 超过 30 分钟未刷新时，把边界文案升级为“可能过旧”，提示刷新会话或等待后台同步。
3. 把同样的边界写入 `aria-label`，确保键盘和读屏用户也能知道这不是实时状态。
4. 更新 `tools/verify-glip-ai-markers-e2e.mjs`，覆盖源码契约和 focus 展开路径。
5. 同步 `docs/features/message_reaction.md`，保持功能文档和当前行为一致。

## 验证

- `npm run verify:glip-ai-markers:e2e`
- `npm start` 到首次成功 compile 后停止
- 重跑 `npm run verify:glip-ai-markers:e2e`
- `git diff --check -- src/contentScriptGlip.tsx docs/features/message_reaction.md tools/verify-glip-ai-markers-e2e.mjs .planning/2026-06-13-automation-glip-marker-cache-boundary/plan.md`
