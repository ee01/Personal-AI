# 新能力：Memory Lifecycle Gardener / 记忆生命周期管家

> Codex 会话标题建议：新能力：记忆生命周期管家  
> 生成时间：2026-05-26 CST  
> Demo：[`memory-lifecycle-gardener-demo.html`](./memory-lifecycle-gardener-demo.html)  
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有可选的新功能 idea，也没有 item 需要标记 done。

## 结论

建议设计一个新能力：**Memory Lifecycle Gardener / 记忆生命周期管家**。

它解决的不是“再多一个记忆召回入口”，而是 Personal AI 越记越多之后的核心问题：

> 哪些记忆还应该影响 Ask、Memory Lens、Compose Assist、Today Pilot 和外部 AI 上下文包？哪些只应该作为原始证据保留，不再进入提示和排序？

本轮真实数据里有一个很强的信号：`/stats` 返回 `9545` 条 messages、`4736` chunks、`13669` entities、`49364` relationships、`37` 条 pending confirm requests；SQLite 只读查询显示 `memory_metadata` 里 `temporary=1514`、`archived=2204`、`forgotten=1855`，但 `working/consolidated/core` 当前没有稳定分层。最近消息里还出现大量 future calendar、Doubao truth-conflict、OpenClaw capability-missing、重复日程和系统提醒。这说明 Personal AI 已经有“记住很多”的基础，但还缺一个用户可理解、可回滚的**记忆影响力生命周期层**。

这个能力的产品承诺是：

> 保留原始证据，但控制影响力。让重要记忆被提升，噪声记忆被降权，重复和过期记忆不再污染用户每天看到的提示。

## 为什么现在值得做

### 1. 用户当前最痛的是召回准确性，不是再增加入口

近期已被搁置或收敛的计划说明了方向：

- `Memory Egress Firewall` 被搁置，因为当前优先级是先解决准确率问题。
- `Recall Calibration Studio` 已改成 `Ambient Recall Calibration`，说明用户不想每天维护一个校准后台。
- `Memory Lens` 已被收敛为现有右下角关联记忆的升级，不应再新造大页面。
- `AI Tool Compass` 被搁置，因为它会滑向跨 AI 工具切换和上下文护照的重复方向。

Lifecycle Gardener 不和这些能力抢入口。它从源头解决“哪些记忆还允许影响结果”，让现有入口更准。

### 2. 当前数据已经暴露生命周期空位

本轮只读检查到的状态：

| 信号 | 说明 |
| --- | --- |
| `messages.total=9545` | 记忆量已经足够大，召回排序会受到噪声影响。 |
| `memory_metadata.temporary=1514` | 有大量临时记忆仍在影响候选池。 |
| `working/consolidated/core=0` | “重要记忆提升成稳定层”的路径还没有形成用户可见产品闭环。 |
| `confirm_requests.pending=37` | 事实冲突和外部查证缺口会反复进入 Today Pilot 或动作队列。 |
| 未来日历大量出现在最近查询中 | 时间线和 Day Pilot 容易被 recurring calendar/meeting shell 挤占。 |
| Doubao 里出现多条 `Pending truth conflict` | 外部 AI 记忆回流后需要低打扰归并，而不是每条都变成独立提醒。 |

### 3. 业内记忆产品已经把“用户可控生命周期”做成基础能力

- [OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 强调用户可以查看、删除、关闭 saved memories 和 reference chat history，并通过 Memory Sources 理解哪些内容影响个性化。
- [Claude memory import/export](https://support.claude.com/en/articles/12123587-importing-and-exporting-your-memory-from-claude) 已把 AI 记忆导入导出做成迁移能力，同时提醒导入仍可能不完整，这说明“记忆进入系统之后如何被吸收和管理”本身就是用户体验问题。
- [Gemini Workspace conversation history](https://workspaceupdates.googleblog.com/2026/02/gemini-conversation-history-is-coming-to-side-panel-in-google-workspace.html) 把会话历史带进 Workspace 侧栏，说明主流产品正在把历史上下文直接放入工作流。Personal AI 更需要比它们更强的来源、范围和影响力控制。
- [Anthropic context management](https://www.anthropic.com/news/context-management?cam=claude) 提到长任务会积累 tool result，需要移除 stale content 来延长 agent 能稳定工作的时间。Personal AI 的长期记忆也有同样问题：旧证据必须保留，但不应总是进入工作上下文。

### 4. 最新研究也指向“记忆管理不是只存和搜”

- [Rethinking Memory in AI](https://arxiv.org/abs/2505.00675) 把 AI memory 拆成 Consolidation、Updating、Indexing、Forgetting、Retrieval、Compression 六类操作。Personal AI 现在召回和索引较强，但用户可见的 consolidation / forgetting / compression 还不够。
- [Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670) 把持续巩固、可信反思、learned forgetting、隐私治理列为 agent memory 的开放挑战。
- [When Continual Learning Moves to Memory](https://arxiv.org/abs/2604.27003) 指出在有限上下文下，新旧经验会竞争检索位置，旧经验可能造成负迁移。
- [FSFM](https://arxiv.org/abs/2604.20300) 和 [FadeMem](https://arxiv.org/abs/2601.18642) 都把 selective forgetting 作为 agent memory 的关键机制，核心不是删除一切，而是让低价值内容更少被访问。
- [LongMemEval](https://arxiv.org/abs/2410.10813) 把 long-term memory 能力拆成信息抽取、多会话推理、时间推理、知识更新和拒答。Lifecycle Gardener 可以直接支持“知识更新”和“拒答”：旧事实如果没有当前证据，就应带 `as-of` 或降权。
- [Mem0](https://arxiv.org/abs/2504.19413) 和 [A-MEM](https://arxiv.org/abs/2502.12110) 都强调持续对话里的选择性提炼和动态结构化。Personal AI 的差异点是：用户自己的跨平台记忆必须有可见的影响力边界，而不是后台黑箱整理。

## 与已有能力的边界

| 已有/计划能力 | 它负责 | Lifecycle Gardener 不重复的地方 |
| --- | --- | --- |
| Memory Coverage Map | 哪些来源可用、最近同步是否健康、如何导入 | Lifecycle 看的是已入库记忆的影响力、保留策略和升降级，不是来源连通性。 |
| Memory Freshness Radar | 外部来源变化后创建 memory patch | Lifecycle 消费 freshness / patch 结果，决定旧记忆是否降为历史证据。 |
| Ambient Recall Calibration | 从用户自然行为学习召回好坏 | Lifecycle 给这些学习结果一个可审计出口：为什么某类记忆被降权或提升。 |
| Memory Lens | 当前页面/消息/会议的被动召回 | Lifecycle 决定哪些记忆有资格进入 Lens 候选池。 |
| Today Pilot | 今天 3-7 张可行动 mission | Lifecycle 不做 daily board，只减少 Day Pilot 输入里的噪声和重复项。 |
| User Profile | 管理用户事实、偏好、约束 | Lifecycle 管理任意 memory item 的 influence，不直接替代 profile 确认。 |
| Decision Center | 高责任决策/确认队列 | Lifecycle 只把“影响力调整”做成低风险可批处理，高风险事实仍交给 Decision Center。 |
| Reality Check | 检查 AI 输出的 claim 是否被记忆支持 | Lifecycle 是输出前的记忆池治理；Reality Check 是输出后的事实核验。 |

## 一句话产品定位

**Memory Lifecycle Gardener 是 Personal AI 的记忆影响力调度层。**

它不要求用户逐条整理所有记忆，而是每周或在问题出现时，给用户一组很小的、可解释的建议：

- 这 8 条重复日程只保留最新一个进入 Day Pilot。
- 这 12 条 Doubao truth-conflict 合并成 1 个冲突簇，先不再打扰。
- 这条用户明确表达的工作偏好应该从 temporary 提升到 confirmed profile candidate。
- 这批 OpenClaw capability-missing 只作为工具健康证据，不再进入普通 Ask 的答案证据。
- 这条旧项目状态还可搜索，但默认不影响 Compose Assist，因为已有更新证据。

## 核心用户需求

1. **用户不想再看到错误或泛泛相关的记忆。**  
   不是每条旧消息都值得出现在当前场景里。

2. **用户不想维护一个复杂后台。**  
   需要默认自动运行，只在高影响变化时给出可批处理建议。

3. **用户希望保留证据，不希望系统偷偷删除。**  
   默认操作是 `archive influence` 或 `raw only`，物理删除必须显式确认。

4. **用户需要知道调整会影响哪里。**  
   每张生命周期建议卡都要显示：会影响 Ask / Memory Lens / Compose Assist / Today Pilot / Context Passport 哪些入口。

5. **用户希望错了能撤销。**  
   所有批处理都要产出 receipt，支持按批次回滚 influence 变更。

## 用户体验设计

### 入口

入口不做成又一个常驻大红点。建议三个低打扰入口：

1. **Memory Exploring 侧栏：记忆生命周期**  
   用于主动查看本周影响力建议。

2. **Coverage Map 页面右上角：整理影响力**  
   当来源健康但召回质量差时，从来源健康跳到记忆治理。

3. **Memory Lens / Ask 反馈之后的轻提示**  
   用户点“不相关”后，如果系统发现同一噪声簇反复出现，显示小提示：  
   `已发现 12 条类似噪声，可降权这个簇`。

### 页面结构

页面不是“记忆列表管理器”，而是一张影响力工作台：

- 顶部：本周影响力摘要
  - 可继续影响提示的记忆数
  - 仅保留证据的记忆数
  - 待提升候选
  - 待合并噪声簇
  - 可能影响用户体验的入口
- 左侧：建议 lane
  - `应提升`
  - `应降权`
  - `重复/噪声簇`
  - `冲突待定`
  - `策略规则`
- 中间：建议卡
  - 一句话说明
  - 影响入口
  - 证据样例
  - 默认建议动作
  - 风险等级
- 右侧：影响预览
  - 调整前/后 Ask、Lens、Today Pilot 的候选变化
  - 不展示虚假准确率，只展示“会少出现什么、还可从哪里打开原始证据”

### 卡片形态

每张卡必须回答四个问题：

1. **为什么出现？**  
   例如：`同一 recurring meeting 在 14 天内出现 18 次，且从未被用户展开。`

2. **建议做什么？**  
   例如：`只保留下一场进入 Today Pilot，其余作为 raw calendar evidence。`

3. **影响哪里？**  
   例如：`Today Pilot、Timeline、Ask time channel。`

4. **如何撤销？**  
   例如：`本次批次 receipt 可在 30 天内撤销。`

### 默认动作

| 动作 | 用户感知 | 数据含义 |
| --- | --- | --- |
| 提升到 working | “这条最近会经常用到” | 提高 salience、延长 half-life、加入 influence index。 |
| 提升到 core candidate | “这可能是稳定事实/偏好” | 创建 profile/decision/skill candidate，不直接确认。 |
| 只保留原始证据 | “以后别主动提示，但搜索还能搜到” | 降低 active influence，不删除 raw message/chunk。 |
| 合并噪声簇 | “同类重复只显示一个代表” | 创建 cluster，召回时 diversify / cap。 |
| 标记历史事实 | “过去成立，现在不一定” | 进入 `as_of` 历史证据，默认不当 current truth。 |
| 物理删除 | “彻底删除这批内容” | 只在用户显式 dry-run 后执行。P0 不做默认入口。 |

## 推荐信息架构

### 新路由

`memory-exploring.html#/lifecycle`

### 状态模型

```ts
type MemoryInfluenceState =
  | 'active'
  | 'working'
  | 'core_candidate'
  | 'raw_only'
  | 'historical'
  | 'cluster_representative'
  | 'suppressed_noise'
  | 'archived'
  | 'delete_candidate';

type LifecycleCandidateKind =
  | 'promote'
  | 'demote'
  | 'dedupe_cluster'
  | 'stale_fact'
  | 'conflict_cluster'
  | 'source_noise'
  | 'scope_boundary'
  | 'profile_candidate'
  | 'skill_candidate';
```

### 数据表建议

```sql
CREATE TABLE memory_lifecycle_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_refs_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  source_kinds_json TEXT NOT NULL,
  affected_surfaces_json TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low',
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memory_lifecycle_decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  candidate_id TEXT,
  batch_id TEXT,
  action TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  receipt_md TEXT NOT NULL DEFAULT '',
  reversible_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE memory_influence_clusters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cluster_key TEXT NOT NULL,
  title TEXT NOT NULL,
  representative_ref_json TEXT NOT NULL,
  member_refs_json TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 复用现有表

- `memory_metadata`
  - 已有 `salience_score`、`importance`、`frequency`、`redundancy`、`access_count`、`decay_rate`、`half_life_days`、`consolidation_level`、`next_review_at`。
  - P0 应优先复用这些字段，不要另建一套影响力分数。
- `memory_feedback_events`
  - 用于收集用户在 Lens / Timeline / Search / Compose Assist 的自然反馈。
- `confirm_requests`
  - 高风险事实冲突仍进入 Decision Center，不在 Lifecycle 页面直接拍板事实真伪。
- `user_profile_items`
  - 只有用户确认后才进入 confirmed profile。
- `day_missions`
  - Day Pilot 可以显示 lifecycle cleanup 结果，但不应该承担 lifecycle 的审核逻辑。

## 生成候选的规则

### P0 候选

1. **Recurring calendar 噪声**
   - 同一 series/title 高频出现。
   - 缺少具体 agenda 或只有 join link。
   - 用户近期没有展开或用于行动。
   - 建议：只保留下一场进入 Today Pilot，历史事件 raw only。

2. **系统 truth-conflict 噪声簇**
   - 多条 `Pending truth conflict` 或 evidence-resolution 由同一 source anchor 派生。
   - 建议：合并成一张冲突簇，除非高风险，不再逐条进 Today Pilot。

3. **capability-missing / failed delegation 簇**
   - OpenClaw / external tool 缺少能力导致重复失败。
   - 建议：归入 provider health / Action Queue，不再作为普通项目事实证据。

4. **用户明确偏好候选**
   - 用户在对话中明确表达“我希望/不要/优先/以后都”。
   - 建议：进入 `profile_candidate`，显示证据并要求用户确认。

5. **已被显式标记不相关的召回簇**
   - 同一 entity/topic/source 在多个场景被点“不相关”。
   - 建议：对该 scene 降权，不全局删除。

### P1 候选

1. **陈旧项目事实**
   - Freshness Radar 或新证据显示旧 owner/date/status 已过期。
   - 建议：旧事实改为 historical，当前事实进入 confirm request。

2. **长期未访问临时记忆**
   - temporary memory 半衰期到期，且无 access / no feedback / low salience。
   - 建议：raw only 或 archived，不参与主动提示。

3. **重复 AI 对话摘要**
   - ChatGPT / Doubao / Codex 同一任务导入多次。
   - 建议：保留最新 source receipt，旧版本做 revision history。

4. **scope 错位**
   - personal 记忆反复进入 work 场景，或 work 记忆进入 personal 场景。
   - 建议：修正 scope 或设置 scene gate。

## 影响力评分

不要做一个用户看不懂的“大模型分数”。建议使用可解释加权：

```ts
influenceScore =
  confirmedBoost
  + recencyBoost
  + reuseBoost
  + surfaceSuccessBoost
  + sourceAuthorityBoost
  - redundancyPenalty
  - stalePenalty
  - ignoredPenalty
  - conflictPenalty
  - scopeMismatchPenalty
```

每张卡只显示前 3 个原因：

- `近期被 Compose Assist 使用 3 次`
- `同一日程重复 18 次`
- `用户两次点“不相关”`

## API 设计

### 聚合页面

`GET /api/v1/lifecycle/overview`

返回：

```json
{
  "summary": {
    "openCandidates": 18,
    "safeBatchCount": 7,
    "temporaryMemories": 1514,
    "activeInfluenceItems": 2920,
    "affectedSurfaces": ["today_pilot", "memory_lens", "ask"]
  },
  "lanes": [
    {
      "id": "demote",
      "title": "应降权",
      "count": 6,
      "items": []
    }
  ]
}
```

### 创建候选

`POST /api/v1/lifecycle/scan`

参数：

```json
{
  "windowDays": 30,
  "kinds": ["source_noise", "dedupe_cluster", "profile_candidate"],
  "dryRun": true
}
```

### 应用一个建议

`POST /api/v1/lifecycle/candidates/:id/apply`

### 批量应用低风险建议

`POST /api/v1/lifecycle/batches/apply-safe`

只允许：

- raw only
- cluster cap
- scene-specific demote
- snooze duplicate prompts

不允许：

- 删除
- confirmed profile 写入
- current truth 改写
- 自动发送给外部 AI

### 回滚批次

`POST /api/v1/lifecycle/batches/:batchId/revert`

## 前端实现建议

### 页面组件

`src/modals/components/MemoryLifecyclePage.vue`

建议结构：

- `LifecycleSummaryStrip`
- `LifecycleLaneTabs`
- `LifecycleCandidateList`
- `LifecycleImpactPreview`
- `LifecycleReceiptDrawer`

### MemoryServiceClient 方法

```ts
getLifecycleOverview(): Promise<LifecycleOverview>
scanLifecycleCandidates(input: LifecycleScanInput): Promise<LifecycleScanResult>
applyLifecycleCandidate(id: string, input: LifecycleApplyInput): Promise<LifecycleDecisionReceipt>
applySafeLifecycleBatch(input: LifecycleBatchInput): Promise<LifecycleBatchReceipt>
revertLifecycleBatch(batchId: string): Promise<LifecycleBatchReceipt>
```

## P0 范围

P0 只做“影响力治理”，不做物理删除。

### P0 必须做

1. 后端生成 4 类候选：
   - recurring calendar 噪声
   - truth-conflict 噪声簇
   - capability-missing 簇
   - explicit preference/profile candidate
2. 前端展示 `/lifecycle` 页面。
3. 支持单条 apply 和低风险批量 apply。
4. 每次 apply 写 `memory_lifecycle_decisions` receipt。
5. Ask / Context Recall / Day Pilot 至少读取 `raw_only`、`suppressed_noise`、cluster cap 信息。
6. 提供 path-scoped 验证脚本。

### P0 不做

- 不做物理删除。
- 不自动确认用户画像。
- 不自动修改 current truth。
- 不做复杂 memory graph 可视化。
- 不新建通知流。
- 不替代 Coverage Map / Decision Center / User Profile。

## 验证计划

### 后端单测

新增：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-lifecycle.test.ts
```

覆盖：

- recurring calendar 被聚合成一个 source_noise candidate。
- pending truth conflict 被合并成 conflict_cluster candidate。
- capability_missing action/confirm request 被归入 provider/action 类，不进入普通事实降权。
- profile candidate 只创建 pending，不写 confirmed profile。
- apply-safe 不允许 delete / confirmed write / truth update。
- revert batch 恢复 memory_metadata 旧值。

### 前端静态验证

新增：

```bash
node tools/verify-memory-lifecycle-e2e.mjs
```

覆盖：

- 页面能渲染 summary / lane / candidate detail / impact preview。
- 低风险批处理按钮只对 safe candidates 生效。
- apply 后 receipt drawer 显示 batch id、影响入口、可回滚时间。
- 空态说明“没有需要处理的影响力建议”，不显示假数据。
- 服务失败显示可重试，不误报“已整理完成”。

### 召回回归

用现有 context recall eval 样本加 3 类新 golden：

1. RingCentral 空会议页不应因 recurring calendar 召回大量不相关历史。
2. “那个 BE ready 了吗”不应召回泛 AI 工具分享。
3. Today Pilot 不应把 20 条 truth conflict 分成 20 张 mission。

### 构建验证

如果进入实现：

```bash
npm --prefix memory-service run build
npm start
```

`npm start` 按 AGENT.md，只等第一次成功 compile 后停止。

## Demo 说明

Demo 文件：[`memory-lifecycle-gardener-demo.html`](./memory-lifecycle-gardener-demo.html)

Demo 模拟一个集成在 Memory Exploring 中的新页面：

- 左侧为已有 Memory Exploring 导航。
- 顶部展示本轮真实数据风格的影响力摘要。
- 中间是 lifecycle candidate lanes。
- 右侧展示调整前/后的 Ask、Memory Lens、Today Pilot 影响预览。
- 支持切换候选、应用单条建议、应用低风险批处理，并显示 receipt。

Demo 数据是模拟数据，但数值和场景来自本轮只读观察：temporary memory、truth conflict、recurring calendar、OpenClaw capability-missing、Doubao 随手记/系统候选。

## 真实使用场景

### 场景 1：用户早上打开 Today Pilot，避免被噪声占据

现在可能看到：

- 多条 recurring meeting。
- 多条 truth conflict。
- OpenClaw 缺能力失败。
- 真实需要准备的 Cursor workshop 或 CoP 分享反而被挤到下面。

有 Lifecycle Gardener 后：

1. 系统把 18 条 recurring calendar 聚合成 1 个低优先级日程背景。
2. 把 37 条 evidence-resolution 冲突收敛成 1 张“待核对事实冲突”聚合卡。
3. Day Pilot 只剩 3-5 个真正可行动 mission。
4. 用户如果想审计，可以从 mission 打开 lifecycle receipt，看哪些记忆被降权，不会担心系统偷偷删了证据。

### 场景 2：用户在 RingCentral 回复“那个 BE ready 了吗”

现在可能发生：

- Context Recall 召回泛 AI 工具、Codex、Jira 自动化讨论。
- 用户看到的建议像在复述 Personal AI 背景，不像能直接回复。

有 Lifecycle Gardener 后：

1. 同一群组里被多次忽略的泛 AI 工具记忆被 scene-specific 降权。
2. capability_missing / truth-conflict 系统消息不再默认进入 composer 证据。
3. Compose Assist 优先使用当前群组、最近 BE/Jira/source anchor 的 working memory。
4. 如果用户仍觉得不相关，点一次“不相关”会强化这个 lifecycle rule，而不是要求用户进入校准后台。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 系统误降权重要记忆 | P0 默认 raw only，不物理删除；所有变更有 receipt 和 revert。 |
| 用户被新页面打扰 | 不主动推送，只在 Coverage / Memory Exploring / 反馈后进入。 |
| 降权逻辑变成黑箱 | 每张卡展示前 3 个原因、影响入口和证据样例。 |
| 与 User Profile 重叠 | profile candidate 必须进入 User Profile 确认队列，Lifecycle 不直接确认。 |
| 与 Freshness 重叠 | Freshness 负责 source change，Lifecycle 负责 influence state。 |
| 批处理太危险 | safe batch 只允许低风险 demote / cluster / raw only，不允许 delete 和 truth update。 |

## 成功指标

1. Context Recall 真实样本中“不相关 top 3”比例下降。
2. Today Pilot mission 中系统噪声卡数量下降。
3. 用户点“不相关”后，同类噪声重复出现次数下降。
4. Ask / Compose Assist context pack token 数下降，但关键证据保留率不下降。
5. 用户批处理后 7 天内 revert 比例低。
6. 用户能从任意被降权记忆打开 raw evidence。

## 推荐实施顺序

1. **Plan / Demo review**  
   先确认本方案是否作为独立能力推进。

2. **Backend P0 scan only**  
   增加 candidate scan API，只读生成建议，不改变影响力。

3. **Memory Exploring 页面**  
   先能看见建议和影响预览。

4. **Apply single low-risk decision**  
   只支持 raw only / cluster cap。

5. **接入 Day Pilot / Context Recall**  
   让两条最容易受噪声影响的入口读取 influence state。

6. **Safe batch + receipt + revert**  
   再做批量应用。

## 最小可交付定义

如果未来进入实现，MVP 通过标准是：

- 用户打开 `/lifecycle`，能看到至少 3 类真实候选。
- 点击一个 recurring calendar 噪声建议，能看到它会影响 Today Pilot / Timeline。
- 应用后，Day Pilot 不再把同类日程重复拆成多张卡。
- 原始日程仍能在 Timeline/Search 中查到，并显示“仅保留为原始证据”。
- 可以通过 receipt 撤销本次影响力变更。

