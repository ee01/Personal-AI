# 新能力：Ambient Memory Forgetting / 无感记忆遗忘层

> Codex 会话标题建议：新能力：无感记忆遗忘层
> 生成时间：2026-05-26 CST  
> Demo：[`memory-lifecycle-gardener-demo.html`](./memory-lifecycle-gardener-demo.html)（仅作为架构可视化，不代表 P0 新页面）
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有可选的新功能 idea，也没有 item 需要标记 done。

## 结论

建议把这个方向从 **Memory Lifecycle Gardener / 记忆生命周期管家** 改成 **Ambient Memory Forgetting / 无感记忆遗忘层**。

这个能力不应该是一个需要用户定期审批的管家、平台或 review queue。它应该是 Memory Service 后台定时任务的一部分：在巩固、画像重建、召回反馈和自然使用信号中，持续调整记忆影响力，让不常用、过期、重复、低价值的记忆慢慢淡出默认关联。

它解决的不是“再多一个记忆召回入口”，而是 Personal AI 越记越多之后的核心问题：

> 哪些记忆还应该影响 Ask、Memory Lens、Compose Assist、Today Pilot 和外部 AI 上下文包？哪些只应该作为原始证据保留，不再进入提示和排序？

本轮真实数据里有一个很强的信号：`/stats` 返回 `9545` 条 messages、`4736` chunks、`13669` entities、`49364` relationships、`37` 条 pending confirm requests；SQLite 只读查询显示 `memory_metadata` 里 `temporary=1514`、`archived=2204`、`forgotten=1855`，但 `working/consolidated/core` 当前没有稳定分层。最近消息里还出现大量 future calendar、Doubao truth-conflict、OpenClaw capability-missing、重复日程和系统提醒。这说明 Personal AI 已经有“记住很多”的基础，但还缺一个**默认自动运行、能直接影响检索排序与过滤的遗忘层**。

这个能力的产品承诺是：

> 让记忆像人脑一样自然衰减：常用和重要的被巩固，久远且不用的被降权，最终归档为默认不关联；原始证据保留到流水账或冷归档中，只有显式搜索或审计时再找回。

## 重要修订：无感后台，不做用户审批平台

这份计划的 P0 不再设计 `/lifecycle` 主页面、候选 lane、批量审批按钮或用户日常 review 流程。

正确的产品形态是：

- Memory Service 定时任务自动运行遗忘/巩固。
- User Profile 的历史画像同样参与衰减，低 salience 的画像不再注入 `USER_CORE`、provider context、Ask 风格提示。
- Ask / Context Recall / Compose Assist / Today Pilot 统一读取 lifecycle / retrieval tier，不再各自手写降权规则。
- 用户只在两个地方感知到结果：
  - 召回变少、变准。
  - 高级诊断或 Memory Coverage Map 中能看到“近期归档/降权了多少”，用于排障，不用于审批。

换句话说，用户不需要每天判断“这条记忆要不要遗忘”。系统根据时间、使用、反馈、来源、重复度、当前项目状态自动处理；只有物理删除、敏感清理、或者会改变 confirmed profile/current truth 的高责任动作，才交给现有的 Decision Center / User Profile 确认。

## 与人脑遗忘机制的关系

是的，这个能力本质上应该被设计成 Personal AI 的**类人遗忘系统**，而不是普通的清理工具。

人的记忆不是只有“存在 / 删除”两种状态：刚发生的事情会短期可用；反复使用、情绪强、决策价值高或被主动复习的内容会被巩固；长期不用、重复、低价值或已被新事实覆盖的内容会逐渐变弱，最后不会自然浮现在脑海里。Personal AI 也应该采用同样的模型：

```text
raw event -> temporary -> working -> consolidated/core
                    \-> weak/raw-only -> archived -> explicit search only
```

关键原则：

1. **遗忘的是默认关联影响力，不是先删除证据。**
   太久远或很少使用的记忆，应该逐步降低 salience、缩短主动提示资格、退出 Memory Lens / Compose Assist / Today Pilot 的默认候选池；但原始 evidence 仍保留，除非用户明确要求物理删除。

2. **不用的记忆最终归档，不再被动关联。**
   `archived` 或 `raw_only` 记忆默认不参与被动召回、日级 mission、外部 AI context pack 和草稿证据，只能通过明确搜索、时间线定位、来源页面回溯或审计 receipt 打开。

3. **使用会强化，纠错会降权。**
   用户展开、复制、采纳、再次搜索同一记忆，应该延长半衰期；用户忽略、点不相关、删除插入内容、在同类场景反复不用，应该加速遗忘。

4. **重要记忆不能只因时间久就遗忘。**
   已确认画像、长期偏好、关键决策、仍开放的 action、当前项目事实、关系边界、用户 pin 的记忆，需要更长半衰期，甚至进入 core。遗忘系统要区分“久远但重要”和“久远且无用”。

5. **旧事实要变成历史，不要假装当前仍成立。**
   例如旧 owner、旧 deadline、旧 Jira 状态应被标成 `historical/as_of`。它可以回答“当时为什么这么做”，但不应默认回答“现在是什么”。

所以更准确的名字可以理解为：**Memory Lifecycle + Forgetting Engine**。页面只是少量可见控制面；真正核心是在后台持续做衰减、巩固、归档和可回滚影响力调整。

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

**Ambient Memory Forgetting 是 Memory Service 的后台记忆衰减、巩固与归档策略。**

它不需要用户审批每条记忆，而是在 `ConsolidationEngine` / `ForgettingEngine` / `HeartbeatLoop` 这类定时任务里自动完成：

- 太久远、低 salience、无访问、无反馈的临时记忆逐步降权。
- 使用过、被采纳过、被反复搜索过的记忆被强化，半衰期变长。
- 已确认 profile、关键决策、开放 action 和用户 pin 的内容被保护，不因时间久自动消失。
- 旧 profile、旧项目状态、旧 source evidence 变成 historical，不再默认进入当前上下文。
- 归档内容默认不参与 Ask / Context Recall / Compose Assist / Today Pilot 的被动关联，只保留在显式搜索或审计路径。

## 后台任务设计

### 已有基础

当前代码里已经有可复用骨架：

- `memory-service/src/core/ConsolidationEngine.ts`
  - Phase 3.5 已经会衰减 `user_profile_items.salience_score`，低于阈值的 active profile 会变成 `archived`，并重建 `USER_CORE.md`。
  - Phase 4 已经调用 `ForgettingEngine.runForgettingCycle()`。
- `memory-service/src/core/ForgettingEngine.ts`
  - 已经按 `memory_metadata.salience_score`、`last_accessed`、`half_life_days`、`decay_rate` 计算衰减。
  - 当前阈值已有：`< 0.15 -> archived`，`< 0.05 -> forgotten`。
- `memory-service/src/core/RecallEngine.ts`
  - 已经在召回后读取 `memory_metadata.salience_score` 并把 salience 加进 MMR 排序。
  - 当前缺口是只加分，没有统一过滤 `archived/forgotten`，Context Recall / Ask / Time / Graph 通道仍可能把旧记忆带回来。

所以 P0 不应该新建用户工作台，而应该把现有遗忘机制接到所有召回入口。

### 定时任务流程

建议每天低峰运行一次完整 lifecycle，Heartbeat 可以每小时做轻量版：

```text
Heartbeat / daily consolidation
  -> collect usage signals
  -> decay memory_metadata
  -> decay user_profile_items
  -> assign retrieval tier
  -> rebuild active retrieval projections
  -> optionally export cold archive
  -> write audit metrics
```

#### 1. 收集信号

输入来源：

- `memory_metadata.access_count / last_accessed / salience_score / half_life_days`
- `memory_feedback_events`：有用、不相关、撤销、显式负反馈
- `messages_raw.source_type / timestamp / importance / scope`
- `chunks.source_type / created_at / related_project`
- `user_profile_items.salience_score / mention_count / last_seen / user_confirmed / status`
- `confirm_requests.state / reason_code`
- `proposed_actions.state / last_error / source_kind`
- 当前 active projects / recent day missions / open actions

#### 2. 计算 effective salience

不要只看时间。建议计算一个 `effective_salience`：

```ts
effectiveSalience =
  baseSalience
  * ageDecay
  * sourcePolicyWeight
  * scopeFitWeight
  * feedbackWeight
  * redundancyWeight
  * conflictWeight
  * openLoopProtection
```

其中：

- `ageDecay`：按 half-life 指数衰减。
- `feedbackWeight`：用户点不相关、删除插入内容、多次忽略会加速衰减；采纳/复制/打开来源会强化。
- `sourcePolicyWeight`：`calendar` recurring、`system` 中间态、capability_missing 默认短半衰期；meeting / explicit user note / confirmed profile 更长。
- `scopeFitWeight`：personal/work 场景错位时降权。
- `openLoopProtection`：仍有 pending action / pending decision / active project 的记忆不自动归档。

#### 3. 写入 retrieval tier

建议沿用 `memory_metadata.consolidation_level`，但补一个更直接给检索用的字段：

```sql
ALTER TABLE memory_metadata ADD COLUMN retrieval_tier TEXT DEFAULT 'active';
ALTER TABLE memory_metadata ADD COLUMN effective_salience REAL DEFAULT 0;
ALTER TABLE memory_metadata ADD COLUMN archived_at INTEGER;
ALTER TABLE memory_metadata ADD COLUMN archive_reason TEXT;
ALTER TABLE memory_metadata ADD COLUMN archive_path TEXT;
```

`retrieval_tier` 取值：

| tier | 含义 | 默认检索行为 |
| --- | --- | --- |
| `core` | 稳定画像、长期偏好、关键身份、长期关系边界 | 可进入 Ask / provider context，但仍受 scope 和确认状态限制。 |
| `active` | 近期或高价值普通记忆 | 默认可被 Ask / Context Recall 使用。 |
| `weak` | 低 salience、低访问、可能过期 | Ask 可低权重使用；被动召回默认不使用。 |
| `historical` | 过去成立、当前不确定 | 只在用户问“当时/以前/历史/为什么”时使用。 |
| `archive_only` | 原始证据保留，不主动关联 | 默认所有被动和普通 Ask 排除。 |
| `forgotten` | 已遗忘，只保留最小墓碑或冷归档 | 只在 explicit archive search / exact id / audit 中可见。 |

`consolidation_level` 仍表达巩固层级，`retrieval_tier` 表达检索资格。这样不会把“长期重要 core memory”和“当前需要用的 active memory”混在一个字段里。

## User Profile 的遗忘策略

历史画像数据也应该衰减。当前 `ConsolidationEngine.phaseProfileConsolidate()` 已经有基础逻辑，但需要把它变成明确策略。

### Profile item 生命周期

```text
pending_confirm -> active -> weak -> archived
                        \-> superseded
                        \-> retracted
```

规则：

1. `user_confirmed = 1` 的事实/偏好/约束不代表永久有效，只代表可以用于个性化；它仍然会按使用和时间衰减。
2. `role/name/timezone` 这类 identity fact 半衰期很长，除非有冲突证据，不自动降为 archived。
3. `writing_style / response_preference / current_focus / tool_preference` 这类偏好需要按最近使用和反馈衰减。
4. `last_seen` 长期未更新、`mention_count` 低、`salience_score` 低的 profile item 不进入 `USER_CORE`。
5. 被新 profile item 覆盖的旧项进入 `superseded` 或 `archived`，不再注入 provider context，但保留 evidence refs。

### USER_CORE 和 provider context 选择

需要调整所有用户画像注入点：

- `ProfileManager.renderUserCore()`：只选 `status='active'`、`user_confirmed=1`、`salience_score >= profileActiveThreshold` 的 profile items。
- `/ask` 的 `loadUserCoreContext()`：默认只加载 active/current profile；当用户明确问“我过去的偏好/历史画像是什么”时再允许 archived profile。
- `ContextAssistService` / Compose Assist：只允许 confirmed active profile 作为风格约束，不使用 archived/superseded profile。
- Provider package / Doubao bridge：只导出 active confirmed profile；历史 profile 只进入备份和审计。

## 检索层如何降级和排除

### 统一入口：LifecycleRetrievalPolicy

新增一个小的共享策略层，避免每个入口各自写规则：

```ts
type RetrievalMode =
  | 'active_default'
  | 'passive_surface'
  | 'composer_surface'
  | 'meeting_surface'
  | 'historical_ask'
  | 'explicit_search'
  | 'audit_exact';

interface LifecycleDecision {
  allow: boolean;
  weight: number;
  reason?: string;
  tier: 'core' | 'active' | 'weak' | 'historical' | 'archive_only' | 'forgotten';
}
```

策略表：

| 调用方 | 默认 mode | `weak` | `historical` | `archive_only` / `forgotten` |
| --- | --- | --- | --- | --- |
| Context Recall / Memory Lens | `passive_surface` | 默认排除 | 排除 | 排除 |
| Compose Assist | `composer_surface` | 排除，除非当前 thread exact anchor | 排除 | 排除 |
| Meeting prep / Today Pilot | `meeting_surface` / `active_default` | 仅低权重备选 | 只在会议明确要复盘历史时使用 | 排除 |
| Ask 普通问题 | `active_default` | 低权重可用 | 用户问历史时可用 | 排除 |
| Ask 历史问题 | `historical_ask` | 可用 | 可用并标注 as-of | `archive_only` 可二阶段加载 |
| Search / Timeline | `explicit_search` | 可用 | 可用 | 可选开关显示 |
| 精确证据链接 | `audit_exact` | 可用 | 可用 | 可打开，标明已归档 |

### RecallEngine 改造点

当前 `RecallEngine` 已经有 `enrichWithSalience()`。建议改成：

```ts
enrichWithLifecycle(candidates, retrievalMode)
  -> load memory_metadata for target_type/target_id
  -> compute effective score
  -> filter by LifecycleRetrievalPolicy
  -> attach metadata.lifecycle = { tier, reason, effectiveSalience }
```

排序从：

```ts
score + RECENCY_WEIGHT * recency + SALIENCE_WEIGHT * salience
```

改成：

```ts
(score + RECENCY_WEIGHT * recency + SALIENCE_WEIGHT * effectiveSalience)
  * lifecycleWeight
```

其中建议默认权重：

| tier | weight |
| --- | --- |
| `core` | 1.15 |
| `active` | 1.0 |
| `weak` | 0.35 |
| `historical` | 0.2，且必须带 as-of 文案 |
| `archive_only` | 0 in default modes |
| `forgotten` | 0 in default modes |

### SQL / 性能优化

P0 可以先 post-filter，因为当前数据规模不大；但为了避免 vector/FTS 先召回一堆 archived 结果，需要同步做 over-fetch：

- Context Recall 原本 `CONTEXT_OVER_FETCH_FACTOR = 6`，保持或略提高。
- RecallEngine vector/fts/time channel 先取 `topK * factor`，post-filter 后再 MMR。

P1 再把过滤前移：

- vector / fts query join `memory_metadata`，排除 `retrieval_tier IN ('archive_only','forgotten')`。
- `chunks_fts` / `chunks_vec` 对冷归档内容做物理移除或维护 active-only index。
- Graph channel 的 entity evidence check 必须只统计 active evidence；如果实体只剩 archived evidence，默认不返回。

## 归档设计：DB 还是 MD / 流水账

### 判断

短期不建议直接把归档内容移出 DB 作为 P0。

原因：

- 当前规模约 9545 messages、4736 chunks，SQLite + 索引在这个量级不是主要性能瓶颈。
- 真正影响体验的是 archived/forgotten 没有从召回层过滤，而不是 DB 体积。
- 直接迁出 DB 会带来事务一致性、证据链接、graph evidence、backup/import、精确定位和回滚复杂度。

但长期需要冷归档，否则几年后 FTS/vector 和 raw message 会持续膨胀。推荐分两阶段。

### P0：热库标记归档

P0 只做逻辑归档：

- `memory_metadata.retrieval_tier='archive_only' | 'forgotten'`
- `messages_raw` / `chunks` / `entities` 原表不删除。
- RecallEngine / ContextRecallService 默认排除这些 tier。
- Search/Timeline 明确开关 `includeArchived=true` 才显示。
- 精确 evidence link 可打开，但显示 `已归档，不参与默认关联`。

这样最安全，也能立刻解决“被关联到”的问题。

### P1：冷归档流水账

当单用户 DB 达到阈值时，再做物理冷归档。触发条件可以是：

- `memory.db > 1GB`
- `messages_raw > 200k`
- `chunks > 500k`
- `archive_only` 内容超过热库 50%
- FTS/vector 查询 p95 超过目标

推荐不要用纯 MD 作为唯一归档格式。更稳的结构是：

```text
memory-service/data/users/{userId}/archive/
  2026/
    05/
      memory-ledger-2026-05.jsonl
      memory-ledger-2026-05.md
      manifest.json
```

JSONL 是真源流水账，MD 是人类可读摘要。

`memory-ledger-YYYY-MM.jsonl` 每行：

```json
{
  "id": "message-id-or-chunk-id",
  "targetType": "message",
  "sourceType": "glip",
  "scope": "work",
  "timestamp": 1779660000,
  "title": "RingCentral message",
  "content": "...",
  "summary": "...",
  "entities": [],
  "metadata": {},
  "hash": "sha256...",
  "archivedAt": 1780000000,
  "archiveReason": "low_salience_no_access_180d"
}
```

热 DB 只保留墓碑表：

```sql
CREATE TABLE archived_memory_entries (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  original_table TEXT NOT NULL,
  source_type TEXT,
  scope TEXT,
  title TEXT,
  summary TEXT,
  timestamp INTEGER,
  archive_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  archive_reason TEXT,
  archived_at INTEGER NOT NULL
);
```

冷归档事务流程：

1. 选取 `retrieval_tier='archive_only'` 且超过冷却期的内容。
2. 写入 JSONL，并 fsync。
3. 写入 `archived_memory_entries` 墓碑。
4. 从 `messages_vec`、`chunks_vec`、`chunks_fts` 删除向量/全文索引。
5. 可选：从 `chunks` 删除正文，保留最小 source ref；或从 `messages_raw` 删除 content，仅保留 id/source/timestamp/hash。
6. 更新 `memory_metadata.archive_path`。
7. 跑 integrity check：hash、行数、manifest。

归档后默认不会被关联，因为：

- 它不在 active vector / FTS index。
- RecallEngine 默认不读 archive ledger。
- Graph evidence 只统计热库 active evidence。
- Ask 普通 mode 不扫 `archive/`。

只有这些路径会读归档：

- 用户显式勾选“包含归档记忆”的 Search/Timeline。
- Ask 检测到历史意图，例如“以前/当时/去年/历史上/为什么那时”。
- evidence deep link 精确打开。
- backup/export。

## P0 范围

P0 只做后台遗忘和检索接入，不做用户审批平台。

### P0 必须做

1. 扩展 `memory_metadata`：增加 `retrieval_tier`、`effective_salience`、`archived_at`、`archive_reason`、`archive_path`。
2. 改造 `ForgettingEngine.runForgettingCycle()`：
   - 计算 `effective_salience`。
   - 根据阈值写 `retrieval_tier`。
   - 不物理删除。
3. 改造 `ConsolidationEngine.phaseProfileConsolidate()`：
   - 历史 profile 降权/归档。
   - `USER_CORE.md` 只使用 active confirmed high-salience profile。
4. 增加 `LifecycleRetrievalPolicy`。
5. 改造 `RecallEngine`：
   - `enrichWithSalience()` 升级为 lifecycle enrichment。
   - 默认排除 `archive_only/forgotten`。
   - `historical_ask` / `explicit_search` 才允许历史和归档。
6. 改造 `ContextRecallService`：
   - 默认使用 `passive_surface` mode。
   - archived/forgotten 不返回，weak 默认不返回。
7. 改造 `/ask`：
   - 普通问题用 `active_default`。
   - 检测历史意图时用 `historical_ask`，并在答案中标明 `as-of`。
8. 增加只读诊断指标：
   - `/stats` 或 Coverage Map 中显示过去 24h 降权、归档、profile 归档数量。

### P0 不做

- 不做 `/lifecycle` 审批页面。
- 不做批量 apply 按钮。
- 不要求用户确认每条降权。
- 不物理删除或冷迁移 raw memory。
- 不自动修改 current truth。
- 不自动确认或删除 user profile。
- 不把归档结果推送成通知。

### P1 范围

- 冷归档 JSONL + MD 流水账。
- 删除 archived 内容的 active vector/FTS 索引。
- `includeArchived` 显式搜索。
- 冷归档 integrity check / restore。
- archive manifest 纳入 backup/export。

## 验证计划

### 后端单测

新增：

```bash
npm --prefix memory-service test -- --run src/__tests__/forgettingEngine.test.ts src/__tests__/recallLifecyclePolicy.test.ts src/__tests__/api-ask.test.ts src/__tests__/api-context-recall.test.ts src/__tests__/api-profile.test.ts
```

覆盖：

- `ForgettingEngine` 会把低 salience / 长期未访问记忆写成 `retrieval_tier='archive_only'` 或 `forgotten`。
- `ForgettingEngine` 不会归档仍有 open action、pending decision、active project protection 的记忆。
- `ConsolidationEngine.phaseProfileConsolidate()` 会衰减历史 profile，并从 `USER_CORE` 排除 archived / low salience profile。
- `RecallEngine` 普通 mode 默认排除 `archive_only/forgotten`。
- `/ask` 普通问题不使用归档记忆；历史意图问题可以进入 `historical_ask` 并标注 as-of。
- `/context-recall` / Compose Assist 不返回 weak / archived / forgotten 记忆。
- Graph channel 不用只剩 archived evidence 的 entity 做默认关联。

### 归档验证

新增：

```bash
node tools/verify-memory-archive-ledger.ts
```

覆盖：

- P0 逻辑归档不会删除 `messages_raw` / `chunks`。
- P1 冷归档写 JSONL 后，hash、manifest、墓碑表一致。
- 冷归档内容从 active vector / FTS index 移除后，不再被普通 Context Recall 命中。
- explicit search / exact evidence link 仍可找回归档内容。

### 召回回归

用现有 context recall eval 样本加 5 类 new golden：

1. RingCentral 空会议页不应因 recurring calendar 召回大量不相关历史。
2. “那个 BE ready 了吗”不应召回泛 AI 工具分享。
3. Today Pilot 不应把 20 条 truth conflict 分成 20 张 mission。
4. 普通 Ask 不应用 archived profile 作为当前用户偏好。
5. “去年/当时/以前为什么这么做”这类历史问题可以召回 historical / archive-only evidence，并明确标注时间。

### 构建验证

如果进入实现：

```bash
npm --prefix memory-service run build
npm start
```

`npm start` 按 AGENT.md，只等第一次成功 compile 后停止。

## Demo 说明

Demo 文件：[`memory-lifecycle-gardener-demo.html`](./memory-lifecycle-gardener-demo.html)

这个 demo 是上一版“管家页面”的可视化草稿。按本次修订，它不应作为 P0 产品入口实现，只保留用于说明几类记忆如何从 active 变成 weak / archive-only。

如果后续还要做 UI，应改成 Coverage Map 或 Memory System 里的只读诊断，不提供“每日审批 / 批量 apply”主流程。

## 真实使用场景

### 场景 1：用户早上打开 Today Pilot，避免被噪声占据

现在可能看到：

- 多条 recurring meeting。
- 多条 truth conflict。
- OpenClaw 缺能力失败。
- 真实需要准备的 Cursor workshop 或 CoP 分享反而被挤到下面。

有无感遗忘层后：

1. 夜间 `ForgettingEngine` 把重复 recurring calendar 写成 `weak/archive_only`。
2. `DayPilotService` 读取 active/default retrieval policy，天然不再把这些历史日程拆成 mission。
3. Day Pilot 只剩 3-5 个真正可行动 mission。
4. 用户不需要审批；如果排障，可以在 Coverage/Stats 里看到“过去 24h 自动归档 recurring calendar 18 条”。

### 场景 2：用户在 RingCentral 回复“那个 BE ready 了吗”

现在可能发生：

- Context Recall 召回泛 AI 工具、Codex、Jira 自动化讨论。
- 用户看到的建议像在复述 Personal AI 背景，不像能直接回复。

有无感遗忘层后：

1. 泛 AI 工具讨论因为长期在具体 BE 场景被忽略，已自动进入 scene-specific weak tier。
2. capability_missing / truth-conflict 系统消息是 archive-only 或 diagnostics-only，不进入 composer evidence。
3. `ContextRecallService` 使用 `composer_surface` mode，只允许 active/current thread 证据。
4. 用户点“不相关”只写反馈事件，后台下次定时任务自动加速同类记忆衰减。

### 场景 3：用户问“我以前为什么决定这么做？”

普通场景下 archived memory 不会被关联。但当 Ask 检测到历史意图：

1. `/ask` 切到 `historical_ask` mode。
2. RecallEngine 允许 `historical`，必要时二阶段读取 `archive_only`。
3. 回答中明确写 `截至 2026-04 的证据显示...`，避免把历史事实当当前事实。
4. 如果证据已经冷归档，答案只引用 summary / source ref，并提供精确证据链接。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 系统误降权重要记忆 | open action、pending decision、active project、confirmed identity、pinned memory 加保护；P0 不物理删除。 |
| 用户不知道为什么少了某些记忆 | Stats/Coverage 只读显示过去 24h 衰减/归档数量和原因分布。 |
| archived 仍被检索关联 | RecallEngine 统一 lifecycle policy，Context Recall / Compose / Day Pilot 默认排除 archive-only/forgotten。 |
| 历史问题答不出来 | Ask 增加 historical intent mode，显式历史问题才二阶段读取 historical/archive。 |
| DB 继续变大 | P0 逻辑归档先解决准确率；P1 JSONL+MD 冷归档和 active-only vector/FTS index 再解决体积。 |
| 与 User Profile 重叠 | Profile 也走无感衰减，但 confirmed/current profile 写入和删除仍由 User Profile/Decision Center 控制。 |
| 与 Freshness 重叠 | Freshness 负责 source change，Lifecycle 负责 influence state。 |

## 成功指标

1. Context Recall 真实样本中“不相关 top 3”比例下降。
2. Today Pilot mission 中系统噪声卡数量下降。
3. 用户点“不相关”后，同类噪声重复出现次数下降。
4. Ask / Compose Assist context pack token 数下降，但关键证据保留率不下降。
5. 普通 Ask 中 archived/forgotten evidence 出现率接近 0。
6. historical Ask 的证据找回率不下降，并能显示 as-of。
7. `USER_CORE` 里低 salience / archived profile 不再出现。
8. FTS/vector p95 在冷归档后下降或稳定。

## 推荐实施顺序

1. **Schema + policy**
   增加 `retrieval_tier` / `effective_salience` / archive fields，新增 `LifecycleRetrievalPolicy`。

2. **ForgettingEngine 接入**
   在定时任务里计算 effective salience 和 retrieval tier，不做物理删除。

3. **Profile 衰减落地**
   调整 `phaseProfileConsolidate()`、`renderUserCore()`、provider context，使历史画像不再注入。

4. **RecallEngine 过滤**
   `enrichWithSalience()` 升级为 lifecycle enrichment，Ask/Context Recall/Compose/Day Pilot 统一调用。

5. **历史 Ask 二阶段检索**
   只在历史意图时允许 historical/archive-only evidence，并标注 as-of。

6. **只读诊断**
   `/stats` 或 Coverage Map 展示最近衰减/归档摘要，不做审批操作。

7. **P1 冷归档**
   JSONL+MD 流水账、墓碑表、active-only vector/FTS index、restore/integrity check。

## 最小可交付定义

如果未来进入实现，MVP 通过标准是：

- 后台定时任务能把长期不用的 memory 写成 `weak/archive_only/forgotten`。
- `ContextRecallService` 默认不返回 `archive_only/forgotten`。
- `/ask` 普通问题不使用 archived evidence，历史问题可以显式读取 historical evidence。
- `USER_CORE` 不包含 archived / low salience profile。
- Day Pilot 不再把同类 recurring calendar / truth conflict 拆成多张 mission。
- 原始证据仍可通过显式搜索、时间线或精确 evidence link 找回。
