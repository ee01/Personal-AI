# Snooze 快速时间菜单改进计划

## Goal

从 `docs/features/index.md` 随机选中的 `Snooze 快速时间菜单` 出发，复核 Message Reaction 的文档、代码、测试和用户体验，做一个不需要额外用户决策的窄改进，并完成项目要求的验证闭环。

## Target

- 小功能点：`Snooze 快速时间菜单`
- 所属能力：Message Reaction
- 文档：`docs/features/message_reaction.md`
- 初始范围：RingCentral 消息提醒的 15/30 分钟、1/2/3 小时、工作日等快捷时间菜单，已有 Snooze 改期预告，本地 cache 口径与写入边界。

## Plan

1. [complete] 复核 Message Reaction 文档、源码、verifier/E2E，确认当前行为和缺口。
2. [complete] 汇总 Reminder 和外部产品/论文参考，提炼一个可实施的 UX 改进。
3. [complete] 实现一个窄范围改进，优先强化用户在点击快捷时间前后的时间口径和写入边界。
4. [complete] 同步更新 `docs/features/message_reaction.md` 与 `docs/features/index.md`。
5. [complete] 运行 targeted verifier、`npm start` 首次成功编译、相关 E2E 和 scoped `git diff --check`。
6. [complete] 更新自动化 memory，记录 Reminder 处理状态和验证证据。

## Reminder State

- AppleScript 未列出 `Personal AI`。
- EventKit 找到 `Personal AI`，共 4 条，未完成 0 条。
- 当前没有和 Snooze 快速时间菜单相关的未完成用户反馈可纳入，也没有需要标记完成的 Reminder。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| None yet | - | - |
