# Relationship Context Card 控制点边界

## 选择

- 随机样本命中 `人脉关系 Context Card`。
- 跳过最近刚覆盖的 Memory Lens、Message Analysis、Agent Thinking / Workflow、Memory Capture、Jira Design Links、Google Slides 等 exact 或相邻目标后，选择 Relationship Radar 的 Context Card 子能力。

## 现状

- `docs/progressing/to-verify.md` 当前无遗留项。
- EventKit 确认本机 `Personal AI` Reminders 列表存在，4 条总项目、0 条未完成；完成项目都属于 Doubao / Notification 历史反馈，本轮无可纳入或需标记 done 的相关条目。
- `docs/features/relationship_radar.md` 已描述 Context Card 的隐私过滤、请求回执、失败保留快照和复制回执。
- 代码已经在 `RelationshipRadarService` 里实现 context receipt、privacy summary 和 includeSensitive 过滤；页面也显示请求 / 失败 / 复制回执。

## 外部参考

- Introhive / Affinity / Salesforce / Microsoft Copilot for Sales 这类 relationship intelligence 产品都强调关系强度、最近互动、会议前上下文、证据和下一步建议。
- context-aware recommender 和 personal assistant 研究的共同建议是：个性化推荐应暴露上下文依据、隐私范围、可复核证据和行动边界，避免把当前建议误读成已确认事实或自动外发动作。

## 缺口

Context Card 的关键控制点本身还缺少点击前边界：

- `复制当前上下文` 只在点击后显示复制回执；按钮本身没有说明是当前卡片还是失败保留快照、默认隐藏还是含敏感上下文、是否会发送或写画像。
- `临时包含敏感上下文` / `恢复默认隐藏` 按钮没有说明它只是重新请求卡片、返回前不替换内容且复制会锁定。
- `查看依据` 和 open loop 证据按钮没有把“只打开证据来源，不写入/不发送/不确认”的边界暴露给 hover / 读屏用户。

## 实施计划

1. 在 `src/modals/components/RelationshipRadarPage.vue` 增加 Context Card 控制点边界 helper。
2. 给复制按钮、敏感范围切换按钮、建议证据按钮、open loop 证据按钮绑定 `title` 和 `aria-label`。
3. 更新 `tools/verify-relationship-radar-e2e.mjs`，断言这些控制点在点击前已有边界文案。
4. 更新 `docs/features/relationship_radar.md` 和 `docs/features/index.md`，只补充当前行为概述，不展开实现细节。
5. 验证：`npm run verify:relationship-radar`、`npm start` 首次成功编译、`npm run verify:relationship-radar:e2e`、scoped `git diff --check`。

## 边界

- 仅 presentation / accessibility 修复。
- 不改变 Context Card API、隐私过滤、stored card 复用、敏感数据纳入规则、复制内容、Review Queue、Meeting Brief、Assistant Draft、Memory Service 写入或 Reminder 状态。
