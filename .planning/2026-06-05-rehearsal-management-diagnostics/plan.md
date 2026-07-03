# Rehearsal 管理页命中诊断

## 选择

- 随机功能点：`Rehearsal 管理页`
- 所属文档：`docs/features/rehearsal.md`
- 本轮避让：最近自动化已经覆盖 Relationship Radar、Message Analysis、Task Scheduler、Google Slides、Jira、Notification、Memory Service、Storyline 等功能族。

## Reminder

- Apple Reminders 可访问。
- 本机没有名为 `Personal AI` 的列表。
- 本轮没有可关联、可完成或可备注的 Reminder item。

## 外部参考

- Apple Reminders 支持时间、地点、给某人发消息时提醒和 app 链接等多 cue 触发。
- Microsoft To Do 的 flagged email 把来源邮件、预览、due date、reminder 和完成状态连起来。
- prospective memory 与智能手机提醒研究支持 context cue 对未来意图执行的重要性，但也提醒不能只靠时间/地点。

## 问题

Rehearsal 管理页已经能展示 activation history，但用户要判断一条预演该恢复、暂停、标记不相关还是继续观察时，需要自己逐条扫 outcome、score、surface/context 和 matched cues。深链从 Memory Lens、Today Pilot 或 cue card 进来时，这个判断应该更快。

## 实施计划

1. 在 `RehearsalsPage.vue` 详情页增加“命中诊断”摘要。
2. 直接从详情接口已有的 `activations` 派生最近触发、最高分、正/负反馈、主要入口和建议动作，不改后端契约。
3. 更新 `tools/verify-rehearsals-page-e2e.mjs`，固定 stale deep-link 场景下的诊断摘要和恢复建议。
4. 更新 `docs/features/rehearsal.md`，记录管理页最新行为和这轮外部参考。
5. 按 AGENT.md 做 focused API/E2E、dev compile 和 diff whitespace 验证。
