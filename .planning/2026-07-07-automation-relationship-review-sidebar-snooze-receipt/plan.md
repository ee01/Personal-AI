# Relationship Radar 侧栏快速稍后回执计划

## 背景

- 本轮从 `docs/features/index.md` 随机样本中选择 `人脉关系 Review Queue`，避开最近几轮已经精确覆盖的 Task Scheduler、Memory Capture、Rehearsal、Slides、Compose Assist 和 Ask 等功能点。
- `docs/progressing/to-verify.md` 当前无待校验事项。
- EventKit 能读取本机 `Personal AI` Reminders 列表，但 4 条均已完成，且都是 Doubao / Notification / 测试历史项；没有开放的 Relationship Radar / Review Queue 相关反馈可纳入或标记完成。
- 现有 Review Queue 已有完整复核卡、确认 / 驳回 / 稍后成功失败回执、空筛选回执和侧栏分流；主要 UX 缺口在右侧摘要卡的 `稍后 7 天` 快捷按钮。

## 外部参考

- Google Contacts 的 `Merge & fix` 是建议式校准入口，用户仍要逐条查看建议后合并或忽略。
- Salesforce Einstein Relationship Insights 把关系推荐、证据和 CRM 更新路径放在同一工作流，适合作为 evidence-backed relationship calibration 参考。
- Human-AI interaction guidelines 和 AI suggestion review bias 研究都强调：系统建议不能只给动作按钮，还需要说明自治边界、证据、用户控制权和副作用。
- 通知 snooze / deferral 研究提醒，`稍后` 不是无副作用查看行为，而是会改变再次出现时间的状态操作；即使不写画像，也应在按钮旁说明它改变的是 Review Queue 状态。

## 改进计划

1. 在 `RelationshipRadarPage.vue` 的右侧 `确认队列` 摘要卡中加入 `快速稍后回执`，说明侧栏按钮只把候选移出待确认约 7 天，不确认 / 驳回 / 写入人物画像 / 删除证据 / 发送消息 / 创建跟进。
2. 回执同时提示：侧栏 quick snooze 会使用当前候选原文和已有备注；如果用户要改写入内容或补备注，应先点 `进入复核`。
3. 保持现有 API、Review Queue 状态机、完整复核卡、成功失败回执和侧栏 `进入复核` 行为不变。
4. 扩展 `tools/verify-relationship-radar-e2e.mjs`，覆盖侧栏回执文本，并继续断言打开完整卡不会写入画像。
5. 更新 `docs/features/relationship_radar.md` 和 `docs/features/index.md` 的简短说明，文档只记录用户可见边界，不写实现细节。
6. 验证：`node --check tools/verify-relationship-radar-e2e.mjs`、`npm run verify:relationship-radar`、`npm start -- --progress` 首次成功编译后停止、`npm run verify:relationship-radar:e2e`、scoped `git diff --check`。

## 执行结果

- 已完成侧栏 `快速稍后回执`、E2E 覆盖和功能文档更新。
- 本轮改动不改变 Review Queue API、确认 / 驳回 / 稍后状态机、成功失败回执、证据打开策略或人物画像写入规则。
- 所有计划内验证已通过。
