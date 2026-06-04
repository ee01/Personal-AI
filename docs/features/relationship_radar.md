# Relationship Radar / 关系记忆雷达

*最后更新: 2026-05-30*

## 是什么

Relationship Radar 是 Personal AI 的人物关系上下文能力，入口位于 `memory-exploring.html#/entity/Person`。它把 Memory Service 里已经识别到的 Person、消息、会议、项目、关系边和确认项，整理成可查看、可确认、可复制给其他 AI 的人物上下文。

它不是销售 CRM，也不是联系人管理器。它的目标是在用户准备沟通、开会、写 follow-up 或让 AI 起草内容前，回答一个更具体的问题：

> 我和这个人最近有哪些真实上下文、未闭环事项、稳定协作事实和需要谨慎确认的推断？

## 大白话运行逻辑

Relationship Radar 会把“和某个人有关的记忆”整理成人物上下文卡：最近互动、未闭环事项、已确认事实、关系提示、当前建议和证据。它的重点不是联系方式管理，而是帮助用户在沟通前知道哪些话题、承诺或边界要注意，以及下一步最应该先确认什么。

这个功能保持独立文档，而不是并入 `memory_system.md`。原因是它已经是一组完整的人物关系能力：有自己的 UI、API、后台整理、存储表、人工确认队列、会议简报和回复助手；`memory_system.md` 只负责解释它在整个记忆系统里的位置，并链接到本文。

结果主要受这些因素影响：

1. 人物实体合并质量：同一个人如果有多个名字、邮箱或别名，合并质量直接影响雷达准确度。
2. 互动证据：最近消息、会议、项目和关系边越多，人物状态越可靠。
3. 确认程度：已确认事实优先于推断事实；敏感上下文默认不进入外发卡片。
4. Open loops：未闭环事项会显著影响 meeting brief、assistant draft 和人物优先级。
5. 调用 surface 和 token budget：不同场景会生成不同长度和敏感度的 context card。

## 数据生成链路

Relationship Radar 不是等用户点开页面才“凭空生成”。它采用 hybrid projection：

1. **Lazy fallback**：页面或 API 第一次读取人物时，直接从 `entities`、`messages_raw`、`entity_properties` 和 `relationships` 即时计算候选人物、分数、状态和基础上下文。优点是没有后台结果时也能展示，缺点是质量偏索引级。
2. **后台整理**：每日 `ProactiveScheduler` 在 normal daily consolidation 之后调用 `RelationshipRadarService.consolidatePeople()`，只整理高频人物，把更稳定的 context card、open loop、relationship event 写入专用表。
3. **人工确认**：review item 被用户 confirm 后写入 `entity_properties.relationship_context`，之后该人物的 `dataQuality` 升级为 `confirmed`，优先反哺会议、回复和检索。

因此页面里会明确显示 `dataQuality` / `projectionSource`：

| 字段 | 含义 |
| ---- | ---- |
| `indexed` + `lazy` | 只来自索引即时计算，可作为 fallback，不应当当成稳定事实 |
| `generated` + `background` | 后台整理过，质量高于 lazy，但仍需保留证据边界 |
| `confirmed` + `user_confirmed` | 用户确认过的人物事实，可进入更稳定的画像/检索提示 |
| `stale` | 后台整理后又出现更新互动，需要下一轮刷新 |

后台整理会覆盖同一个人的 lazy projection；这不是丢数据，而是把即时索引结果升级成更高质量的关系上下文。

## 当前能力

### 人物雷达

`RelationshipRadarService` 会从 Person 实体、消息证据、关系边和已确认属性里生成人物投影：

- `core` / `active` / `rising` / `dormant` / `watch` 等 radar state。
- interaction count、active days、recent interaction、confirmed facts 等信号。
- 达到阈值的人物进入主列表，低频候选可以在页面里单独查看。
- projection 会记录 `dataQuality` 和 `projectionSource`，避免把 lazy/generated/confirmed 状态混成同一类事实。
- 人物搜索支持姓名、描述、别名和邮箱别名；页面会显示当前搜索 / 状态 / 候选筛选范围，空结果时可以直接清空筛选或打开低频候选。

### 人物详情与证据

单个人物详情会展示：

- 最近互动时间线。
- open loops / 未闭环事项。
- 稳定关系边和相关人物。
- 已确认事实、推断事实和待确认 review item。
- 可跳转回记忆系统的 `exploreLink` 证据。
- 证据按钮只接受安全的内部 `#/...` 路由和 `http(s)` 外部链接；导入数据里携带的危险 URL 会被拦截并给出提示。

证据需要能追溯到 message、entity property 或 relationship，不把无证据推断直接包装成事实。

### Context Card

`POST /api/v1/relationships/context-card` 生成单个人物上下文卡：

- 支持按 `personId` 或 `personName` 查找。
- 支持 `surface` 和 `tokenBudget`。
- 默认不包含敏感信息，除非调用方显式传入 `includeSensitive`；默认卡片会过滤邮箱/电话/密钥类别名、事实、证据、open loop 和检索 boost，并返回 `privacySummary` 说明隐藏数量。
- 输出 `contextMd`、bullets、action suggestions、known facts、relationship hints、open loops、do-not-assume 和 evidence refs。

`actionSuggestions` 是 Context Card 的总结层，不只是证据重排。它会把 open loop、关系边、已确认/待确认事实压成“现在建议”，例如先闭环某个 owner / next step、沟通前确认关联对象边界、或先把推断升级成可用事实。每条建议都带 `tone`、`reason` 和可选 `evidenceRef`；UI 会把这块放在事实和关系证据之前，复制出去的 `contextMd` 也会包含 `## 现在建议`。如果读取到旧的 stored context card 没有该字段，service / UI 都会用现有 open loops、关系边和事实即时补齐兜底建议。

Context Card 适合被 Meeting Pilot、Compose Assist、Quick Ask 或外部 AI context package 复用。UI 默认显示“敏感上下文未纳入”的状态，并只展示隐藏类型计数（例如别名、事实、证据、跟进、检索），让用户不必揭开敏感内容也能判断是否需要临时包含。用户需要显式点“临时包含敏感上下文”才会重新拉取可外发前复核的完整卡片；此时复制按钮会标成“复制含敏感上下文”，复制成功提示也会提醒外发前复核。详情 brief 里的“复制当前上下文”始终复制当前选中人物的 context card；即使首屏 spotlight 仍然指向另一个更高优先级人物，用户也能把正在查看的人物上下文直接交给外部 AI 或聊天草稿使用。

这块的产品参考是 Salesforce Einstein Relationship Insights 的 evidence-backed recommendation、Clay contact card 的 relationship timeline / network strength、Microsoft Dynamics 365 Copilot record summary 的嵌入式摘要；研究参考主要来自 mixed-initiative context 和 user-centered XAI。共同结论是：人物上下文应该是可解释、可调范围、可复核的对象，而不是默认把所有私密证据打包给下游 AI。

### Meeting Brief

`POST /api/v1/relationships/meeting-brief` 会根据会议标题、时间和 attendees 生成会前人物摘要：

- 每个 attendee 尝试匹配 Person 实体。
- 支持 `Name <email>`、邮箱-only、常见日历 attendee object，并优先用显示名、别名、邮箱别名匹配 Person。
- 返回 `coverage` 汇总和每个 attendee 的 `matchedBy`、`matchReason`、`matchConfidence`、`coverageState`。
- 弱匹配（例如只靠邮箱前缀命中别名）会额外标成 `identityCheckRequired`，覆盖统计、会前准备状态、页面卡片和复制简报都会显示“身份待核对”；这些上下文只能作为会前线索，不能直接当成确认事实。
- 有匹配时展示最近上下文、未闭环事项、建议问法和可引用证据入口。
- 无匹配时保持低承诺提示，明确标出需要会中确认角色或补充人物别名，不伪造关系信息。
- 大会议默认只展开前 16 位参会人的人物上下文；如果日历或手动输入超过上限，API、页面和复制简报都会显示已分析/未分析人数，并列出未展开参会人，避免覆盖统计看起来比实际更完整。
- 页面内手动生成简报时，如果用户还没有改过默认会议标题/参会人，切换人物会自动把默认参会人同步到当前人物；一旦用户手动编辑，就保留用户输入。
- 生成结果会额外给出 `readiness`：把参会人覆盖、证据数量、open loop、未匹配和未展开名单压成“准备就绪 / 部分就绪 / 需要补齐 / 缺少参会人”，并列出下一步和成功标准；页面和复制简报都保留这段会前检查。

这块的产品参考是 Read AI Pre-Read、Fireflies Meeting Prep、Microsoft Teams Intelligent Recap、Google Meet Gemini notes；研究参考包括 prospective reflection for meetings、LLM meeting recap 和 action-item-driven summarization。共同结论是：会前简报不能只列人物资料，还应该直接告诉用户“这场会还缺什么、先确认什么、会后要沉淀什么”。

### Assistant Draft

`POST /api/v1/relationships/assistant/draft` 为给某个人的沟通场景生成草稿上下文：

- 使用 relationship context 和 do-not-assume 约束。
- 适合辅助用户起草 follow-up、确认问题或同步信息。
- 当前只产出上下文和草稿建议，不自动发送消息。

### Review Queue

`GET /api/v1/relationships/review-items` 和 `POST /api/v1/relationships/review-items/:id/:action` 提供关系事实校准：

- 用户可以 confirm / reject / snooze 待确认项。
- confirm 可写入用户编辑后的值。
- snooze 会延后再次提示；到期后会重新进入“待确认”，不会永久藏在“稍后”筛选里。
- review item 保留 evidence refs、confidence、priority 和用户备注。
- UI 的确认队列始终使用独立的待确认列表，不会被“已确认 / 已驳回 / 全部”等筛选误导。
- 人工确认卡会展示人物、写入字段、优先级、置信度、证据入口、可编辑写入内容和复核备注，避免用户在缺少上下文时 rubber-stamp 关系事实。

这块的产品参考是 Google Contacts 的“Merge & fix”建议式合并、Salesforce Einstein Relationship Insights 的 evidence-backed relationship recommendation、HubSpot task queue 和 Covve relationship reminders；研究参考主要来自 mixed-initiative UI、AI suggestion review bias、task reminders 和 notification snooze/deferral。共同结论是：系统可以提出候选关系事实，但写入前必须保留证据、用户可编辑权和明确的稍后/驳回路径。

### Relationship Graph

`GET /api/v1/relationships/graph` 生成轻量人物关系图：

- node 来自高频 Person 和其强关系对象。
- edge 来自 `relationships`，保留 relation type、strength 和目标实体。
- dynamics 会标出 rising、dormant、review_needed 等可行动变化。

这不是完整知识图谱编辑器，而是给用户快速判断“最近哪些人关系升温、沉默或需要确认”的工作视图。

## 数据模型

迁移 `memory-service/src/storage/migrations/020_relationship_radar.sql` 维护四类表：

| 表 | 用途 |
|---|---|
| `relationship_radar_people` | 人物雷达投影、状态、分数、证据和生成时间 |
| `relationship_context_cards` | 已生成的人物上下文卡和 source hash |
| `relationship_event_index` | 关系事件索引，例如 open loop 或重要互动 |
| `relationship_review_items` | 待确认关系事实、推断或校准项 |

### 兼容性注意

`020_relationship_radar.sql` 曾在早期版本只创建了较少字段。长期运行的个人数据库如果已经 applied 早期 020，后续修改 `CREATE TABLE IF NOT EXISTS` 不会自动补列。为避免远端旧库出现 `table relationship_radar_people has no column named data_quality` 这类问题：

- `Database.ensureSchemaCompatibility()` 会在启动迁移后补齐 `relationship_radar_people` 的 legacy 缺失列。
- `032_relationship_radar_compat.sql` 会确保 `relationship_context_cards` 和 `relationship_event_index` 等后续表存在。
- 如果页面显示 0 人且 Network 返回 500，应先查 `/api/v1/relationships/people` 的错误，而不是直接判断“没有人物数据”。

### 没有数据时怎么排查

1. 调 `GET /api/v1/relationships/people?limit=10`，确认不是 500 或 timeout。
2. 如果报缺 column/table，说明旧库 schema drift，运行最新迁移或 compatibility pass。
3. 如果 `totalCandidates=0`，检查 `entities` 里是否有 `type='Person' AND status='active'`。
4. 如果有候选但 `items=[]`，打开页面“候选”筛选或传 `includeBelowThreshold=true`，判断是否只是未达到高频阈值。
5. 如果人物存在但上下文弱，检查消息的 `entities_json`、sender/name/alias、`relationships` 和 `entity_properties` 是否能关联到同一 Person。

## 代码入口

- UI: `src/modals/components/RelationshipRadarPage.vue`
- API routes: `memory-service/src/routes/relationships.ts`
- Core service: `memory-service/src/core/RelationshipRadarService.ts`
- Migration: `memory-service/src/storage/migrations/020_relationship_radar.sql`

## 边界

- 不自动替用户发消息。
- 不把关系打成绝对好坏分数。
- 不把未确认推断当作事实。
- 不默认把敏感人物上下文外发给其他 AI。
- 不打开未经安全检查的证据链接。
- 不替代 `memory_system.md` 里的自我反思、决策中心、主动询问和通知链路；Relationship Radar 消费这些链路产出的证据。

## 验证建议

改动 Relationship Radar 时优先运行相关 memory-service 测试，并补充最小 UI/E2E 验证：

```bash
npm run verify:relationship-radar
npm start
npm run verify:relationship-radar:e2e
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。
