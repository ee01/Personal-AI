# Rehearsal 管理页处理回执

## 选择

- 随机功能点：`Rehearsal 管理页`
- 所属文档：`docs/features/rehearsal.md`
- 本轮避让：最近自动化已经密集覆盖 Relationship Radar、Project Dashboard、User Profile、Memory Coverage、Message Reaction、Compose Assist 等功能族。

## Reminder

- Apple Reminders 可访问。
- 本机没有名为 `Personal AI` 的列表。
- 本轮没有可关联、可完成或可备注的 Reminder item。

## 外部参考

- Apple Reminders 支持时间、地点、给某人发消息时提醒等多 cue 触发，说明未来提醒需要让触发条件可见。
- Microsoft To Do flagged email 把任务和来源邮件、预览、提醒状态连起来，说明管理页操作后应保留来源和状态边界。
- prospective memory / implementation intentions 研究强调“遇到 X 时做 Y”的 cue-action 绑定。
- context-aware reminder 论文强调自然语言提醒需要被结构化成可检查的触发逻辑。

## 问题

Rehearsal 管理页已经有命中诊断，但用户点击暂停、恢复、标记已使用、不相关或归档后，只看到一句短消息。对于一个会影响现场提示的记忆层，操作后应该明确告诉用户：新状态是什么、是否还会进入现场提示、证据和触发历史是否保留、下一步如何恢复或复核。

## 实施计划

1. 在 `RehearsalsPage.vue` 增加“处理回执”，由当前前端状态派生，不改后端契约。
2. 回执覆盖暂停、恢复/重新激活、标记已使用、标记不相关、归档。
3. 更新 `tools/verify-rehearsals-page-e2e.mjs`，断言重新激活后的回执状态、现场提示边界和审计保留说明。
4. 更新 `docs/features/rehearsal.md`，记录管理页操作后的状态/恢复边界。
5. 运行 Rehearsal API、dev compile、页面 E2E 和 diff whitespace 验证。

## 结果

- 已实现 `处理回执`，覆盖暂停、恢复/重新激活、标记已使用、不相关、归档。
- 已更新 Rehearsal 页面 E2E 和功能文档。
- 已通过 `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts`、`npm start` 首轮编译、`node tools/verify-rehearsals-page-e2e.mjs`、`git diff --check`。
- 运行结束：2026-06-11T02:09:05+08:00。
