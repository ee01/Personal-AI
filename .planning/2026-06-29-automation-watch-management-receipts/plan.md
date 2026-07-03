# 关注后续管理页命中回执改进计划

## 目标

本轮从 `docs/features/index.md` 随机落到 Message Reaction 的 `关注后续 / Watch`。近期自动化已经覆盖自动答复、Snooze、Glip marker 和手动规则边界，本轮只补 Watch 管理页里“后续命中之后到底发生了什么”的可见性。

## 外部参考

- Slack threads / Save for later 把线程回复、稍后处理和原消息回看放在同一上下文里，用户能回到原消息或 Later 视图确认状态：https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions 和 https://docs.slack.dev/changelog/2023-07-its-later-already-for-stars-and-reminders
- Microsoft Teams Followed threads 把自动/手动 follow、集中查看和通知设置拆开，说明 follow 是持续关注，不是任务完成：https://support.microsoft.com/en-us/teams/teams-channels/follow-threads-in-microsoft-teams
- AI-powered reminders 研究指出协作提醒需要把 commitment/request 识别、提醒投递和工作流互动分开：https://www.microsoft.com/en-us/research/publication/ai-powered-reminders-for-collaborative-tasks-experiences-and-futures/
- attention management / notification overload 研究强调减少不必要打断，并把通知投递和用户行动状态分开：https://dl.acm.org/doi/10.1145/3214261 和 https://dl.acm.org/doi/10.1145/3626705.3627766

## 发现

- 现有 Watch 创建、保存、延长、取消都已有边界回执。
- 管理页每条规则只显示关联数、通知方式、到期时间和最新关联；展开时间线只显示 relation type 与 summary。
- 用户无法直接判断关联命中是否已通知、展开时间线是否会重发、没有关联是否是失败、或本页是否会回扫历史/写长期记忆。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有 Reminder 来源。

## 实施步骤

1. 在 `followThreadPresentation.ts` 增加 Watch 管理页状态回执和单条命中通知状态文案。
2. 在 `FollowThreads.vue` 每条规则卡片内展示“监听状态回执”，并在命中时间线每条记录下展示通知状态。
3. 扩展 presentation 单测和 FollowThreads E2E，覆盖有命中、无命中、已通知、未记录通知时间和不会重发边界。
4. 更新 `docs/features/message_reaction.md` 的 Watch 段落。
5. 运行 `npm run verify:message-reaction`、`npm start` 首次成功编译、`npm run verify:follow-threads-management:e2e`、`npm run verify:i18n` 和 scoped `git diff --check`。

## 非目标

- 不改变 Watch 匹配、通知发送、Memory Service 写入或 Glip marker 同步逻辑。
- 不新增 Reminder 操作；本机没有 `Personal AI` 列表。
