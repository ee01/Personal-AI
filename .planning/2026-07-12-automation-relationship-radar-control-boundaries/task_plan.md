# Relationship Radar 控件级边界改进计划

## 目标功能

- 随机目标：`人脉关系人物雷达`
- 主文档：`docs/features/relationship_radar.md`
- 代码入口：`src/modals/components/RelationshipRadarPage.vue`
- 验证入口：`npm run verify:relationship-radar`、`npm run verify:relationship-radar:e2e`

## 现状

- `docs/progressing/to-verify.md` 为空。
- EventKit 能读取本机 `Personal AI` Reminders；4 条都是已完成历史 Doubao / 通知反馈，没有未完成的 Relationship Radar 相关条目。
- 页面已经有 `雷达路线回执` 和 spotlight `行动前回执`，但首屏控件本身缺少一致的 hover / screen reader 边界：
  - 搜索输入没有说明 Enter 后只重新读取当前筛选人物和上下文卡。
  - 顶部刷新和后台整理按钮没有在按钮上区分“读列表/队列/图谱”与“整理投影/上下文卡”。
  - 状态筛选、候选切换、清空筛选和人物卡点击没有说明它们不会写人物画像、发送消息或创建跟进。
  - spotlight 的 `查看完整 brief`、`强制刷新此人`、`复制给 AI` 有周边回执，但按钮本身仍可被误读。

## 外部检索要点

- Microsoft Dynamics 365 Relationship Intelligence 把 relationship health、who-knows-whom、邮件/会议互动来源和 introduction action 放在销售工作流里，说明关系智能需要把数据来源和下一步动作分清。
- Affinity relationship strength 基于 recency / frequency，并把 connection strength 与 warm introduction 场景绑定，说明人物优先级需要解释排序依据。
- Salesforce Einstein Relationship Insights 会扫描内外部来源、在页面内展示连接，并提供 CRM 更新入口，说明“建议/发现”和“写回 CRM”必须分离。
- AI-mediated communication 研究显示算法回复会改变语言和人际感知，且被怀疑使用 AI 时会影响评价；2025 epistemic trust 讨论也强调 AI 介入沟通会改变信任判断。Relationship Radar 的人物建议和复制给 AI 行为因此需要贴近控制点说明证据、隐私和写入边界。

## 实施计划

1. 在 `RelationshipRadarPage.vue` 增加控件级 boundary copy helper。
2. 给首屏搜索、刷新、后台整理、状态筛选、候选切换、查看候选、清空筛选、人物卡和 spotlight 三个动作补 `title` / `aria-label`。
3. 保持行为不变：不改 API、排序、筛选、context card、Review Queue、后台整理逻辑或存储 schema。
4. 扩展 `tools/verify-relationship-radar-e2e.mjs`，断言新 boundary 覆盖且 `title` 与 `aria-label` 一致。
5. 更新 `docs/features/relationship_radar.md` 和 `docs/index.md`，只记录用户可见边界，不铺实现细节。
6. 验证：`node --check`、`npm run verify:relationship-radar`、`npm start` 首次 successful compile、`npm run verify:relationship-radar:e2e`、scoped `git diff --check`。
