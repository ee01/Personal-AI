# 新能力：Memory Reflection Governor / 记忆反思巡航台（搁置）

> 生成日期：2026-06-01 CST
> Codex 会话标题建议：`新能力：记忆反思巡航台（搁置）`
> Demo：[`memory-reflection-governor-demo.html`](./memory-reflection-governor-demo.html)
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有可随机选择或标记完成的全新功能 idea。本方案来自远端 `esone.qiu` 真实记忆抽样、`docs/progressing` 去重、现有 Reflection / Action Queue 代码路径和 2026 年 agent memory / observability / context engineering 资料。

## 搁置原因

本方案先记录为搁置方向。

核心原因有两个：

1. 这个方向更像一个“总览和治理后台”，不是一个新的核心记忆能力。现有的 `Reflection Threads`、`Action Queue`、`Decision Center / Confirm Requests`、`Answer Memory Tracker` 已经覆盖了大部分信息聚合和决策入口，再单独做一层巡航台，容易和现有页面重叠。
2. 需要用户决策的内容，不应该主要靠一个新页面去承接，而应该通过用户已经在用的交互入口提示出去，比如聊天中的追问、提醒、推送、待办卡片或 Today Pilot 里的高信号卡。这样更符合真实场景里的“看到就能决策”，也避免把重要事项藏进后台总览。

因此，本方案暂不作为独立新能力推进，而是作为一个可复用的设计方向保留。若未来复活，优先应嵌入现有交互面，而不是先建一个独立巡航页。

## 结论

本方案记录为搁置方向：**Memory Reflection Governor / 记忆反思巡航台**。

一句话：

> Personal AI 不只会“自我反思”和“继续外部核实”，还要知道哪些问题值得继续巡航、哪些已经重复、哪些应该停损、哪些需要合并成一个用户可决策的高信号卡片。

它解决的不是“再做一个记忆搜索页”，也不是“替代 Action Queue / Decision Center”。它原本想补的是 Personal AI 作为长期私人记忆系统后必然出现的一层：**后台反思好奇心治理**。但从产品形态看，这层治理更适合被拆回到聊天、提醒、推送和现有决策入口中，而不是单独起一个新页面。

当前系统已经有自我反思线程、confirm requests、proposed actions、OpenClaw 委派和 TruthMaintainer。问题是：当反思能力越来越强，它会持续生成开放问题、外部核实动作和用户确认请求。如果没有预算、去重、停损和可解释的巡航策略，用户最终面对的不是更聪明的 Personal AI，而是一堆“看起来都重要”的内部待办。

## 为什么值得做

Personal AI 的目标是留存用户与 AI、网页、会议、消息、操作、偏好、skill 等所有记忆，并在真实场景里提示相关记忆。这个目标越成功，系统就越需要一个“反思治理层”：

- 记忆多了以后，系统会发现大量事实可能变化。
- 反思线程会把开放问题持续滚动。
- 外部核实动作会进入 Action Queue。
- TruthMaintainer 会创建 confirm requests。
- 用户却只关心少数真正影响今天工作、对外沟通或下一次 AI 使用的变化。

本次真实数据抽样显示这个问题已经出现：

- `/api/v1/stats`：`esone.qiu` 当前有约 `10085` 条 messages、`7413` 个 chunks、`50218` 条 relationships、`50` 个 pending confirm requests。
- `/api/v1/actions?queueStatus=queued` 返回 `448` 个 proposed actions，其中很多来自 `reflection_worker`，标题类似 `继续外部核实: 事实跟进: ...`。
- confirm requests 里有多条围绕 `BE` / `MTR-141852` 的近似变化确认，例如同一个状态从 `waiting for new design, not ready` 变化成多种语言和表达的“未就绪”。
- Action Queue 里存在明显应停损或合并的例子：OpenClaw 缺少能力后继续要求重试、外部事实缺少官方来源但反复追问、GitHub / Jira / Web 候选线索被拼坏后仍入队。
- Reflection threads 中有长期反复出现的开放问题，例如 `demo_update_link` 是否有正式更新流程、`Augment default_model` 是否会变化、`New AI Meetings Desktop Client` adoption 增长能否持续。

这些不是单点 bug，而是长期记忆系统的自然副作用：**系统越会思考，越需要知道什么时候不要继续思考同一件事。**
但对应的产品解法，应该优先是“把需要用户决策的内容推到用户当下会互动的通道里”，而不是新增一张汇总页面。

## 产品定义

### 功能名

**Memory Reflection Governor / 记忆反思巡航台**

也可以在 UI 中简称：**反思巡航**

### 核心承诺

1. **把重复反思合并成一个巡航对象**
   同一个实体/项目/属性/问题的多个 reflection thread、confirm request 和 proposed action，会聚合成一个 `watch cluster`。

2. **给每个追踪问题一个好奇心预算**
   预算不是 token 计费，而是用户注意力和系统行动预算：最多多久查一次、最多创建几条确认、连续几次无新证据后暂停、什么条件下才打扰用户。

3. **把“为什么还在追踪”讲清楚**
   每个巡航卡都展示：当前假设、上次新证据、还缺什么、重复/停滞原因、影响哪些入口。

4. **默认减少打扰，而不是多开任务**
   低价值、重复、工具缺失、无新证据的追踪默认合并、暂停或降级到周报；高影响且需要用户判断时才进入决策中心。

5. **不自动篡改事实**
   巡航台可以关闭一个 watch、合并动作、暂停外部核实；但不会自动接受事实变化、不会覆盖 confirmed profile、不会替用户做外发动作。

## 和已有能力的边界

| 已有能力 / plan | 解决什么 | 记忆反思巡航台不重复的地方 |
| --- | --- | --- |
| Reflection Threads | 保存某个主题的反思、开放问题、运行记录 | 巡航台横跨多个线程，管理“是否还值得继续反思”和“重复问题如何合并” |
| Action Queue | 展示/执行 proposed actions | 巡航台在动作进入队列前后做聚类、预算、停损和批量处理建议 |
| Decision Center / Confirm Requests | 让用户判断事实冲突或高风险动作 | 巡航台减少重复确认，把多条近似确认折叠成一张高信号决策卡 |
| Answer Memory Tracker / 活答案记忆 | 管理用户反复追问的问题当前答案 | 巡航台管理后台反思和外部核实预算；高频用户问题可被“升级为活答案” |
| Memory Freshness Radar | 源头网页/文档变化后影响旧记忆 | 巡航台可把“来源会变化”的 watch 转交给 Freshness Radar，但不负责 source diff |
| Memory Lifecycle Gardener | 管理记忆影响力、保留、降权和遗忘 | 巡航台管理 reflection / action / confirm 的运行层噪音，不直接决定每条记忆的召回权重 |
| Memory Trust Console（搁置） | 全局记忆质量、隐私、可信治理 | 巡航台更窄，只处理自我反思产生的开放问题、动作和确认债 |
| AI Outcome Memory Ledger | 追踪 AI 输出是否被采用、改写、产生价值 | 巡航台不追踪 AI 结果成效；它追踪系统内部“还要不要继续查/问/想” |
| Agent Memory Control Tower（搁置） | 多 agent 分工、执行、合并 | 巡航台不调度多个 agent 干活，只治理 Personal AI 自己的反思和外部核实队列 |

一句边界：**Answer Tracker 关心用户问的问题，Reflection Governor 关心 Personal AI 自己反复追的问题。**

## 竞品与行业观察

### OpenAI Trace Grading

[OpenAI Trace Grading](https://developers.openai.com/api/docs/guides/trace-grading) 把 agent 的决策、工具调用和 reasoning steps 标注成结构化分数或标签，用来定位 agent 在哪里做对或做错。它说明 agent 质量不能只看最终回答，还要看执行路径。

对 Personal AI 的启发：

- 反思线程不是纯文本日志，而是可评分、可聚合、可停损的运行轨迹。
- 巡航台应给每个 watch cluster 打 `novelty`、`utility`、`repeat debt`、`tool blocked` 等标签。
- 不应让用户读完整 trace，用户需要的是“这条巡航为什么还值得留着”。

### LangSmith Observability

[LangSmith Observability](https://docs.langchain.com/oss/python/langchain/observability) 强调 traces 记录 agent 从输入到最终响应的每一步，包括工具调用、模型交互和决策点，用于 debug、评估和生产监控。

对 Personal AI 的启发：

- 现在 `reflection_runs`、`proposed_actions`、`confirm_requests` 已经有类似 trace 的素材。
- 但 Personal AI 的重点不是企业级 observability dashboard，而是把 trace 聚合成个人可操作的巡航建议。

### Langfuse Annotation Queues

[Langfuse Annotation Queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues) 让专家给 traces、observations 或 sessions 添加评分、评论和 corrected outputs，并支持通过 API 管理队列。

对 Personal AI 的启发：

- 用户不是要逐条审核 448 个 actions，而是要审核系统筛出的少量高影响 clusters。
- “人工批注队列”这件事应存在，但必须有聚类、优先级和完成出口，否则就是把噪音搬到另一个页面。

### Anthropic Context Engineering / Claude Memory Tool

[Anthropic 的 context engineering 文章](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 指出 agent 的关键不只是 prompt，而是每一步如何策展有限注意力预算；他们也在 [Claude Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) 里强调 just-in-time context retrieval、跨 session 记忆和 memory expiration。

对 Personal AI 的启发：

- 反思系统本身也需要 context budget。旧开放问题不能无限进入下一轮。
- “停损、过期、分页、限制文件大小”这些 memory tool 建议可以转译成 Personal AI 的 watch budget。
- 巡航台不是压制反思，而是让反思带着明确的下一次触发条件继续。

### OpenMemory / Supermemory / Notion Enterprise Search

[OpenMemory](https://mem0.ai/openmemory) 和 [Supermemory](https://supermemory.ai/) 都在做跨 agent / 跨工具的 memory layer；[Notion Enterprise Search](https://www.notion.com/en-gb/help/enterprise-search) 强调从 connected apps 中回答问题并引用来源。

对 Personal AI 的启发：

- 行业正在把“统一记忆 + 来源引用”做成基础设施。
- Personal AI 的差异机会不是再做一个 memory API，而是给私人记忆系统加上“后台追踪治理”和“用户注意力保护”。
- 当所有工具都能记忆，真正稀缺的是：哪些记忆、开放问题、外部核实值得继续占用系统和用户的注意力。

## 论文与技术依据

### Memory for Autonomous LLM Agents

[Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers](https://arxiv.org/abs/2603.07670) 将 agent memory 形式化为 `write-manage-read` loop，并把 trustworthy reflection、learned forgetting、contradiction handling、latency budgets、privacy governance 作为开放挑战。

巡航台正好落在 `manage` 层：

- write：Reflection worker 写入开放问题、动作和确认请求。
- manage：巡航台聚类、预算、停损、降噪。
- read：Ask、Today Pilot、Memory Lens、Action Queue 只读取高信号状态。

### Generative Agents

[Generative Agents](https://arxiv.org/abs/2304.03442) 证明 observation、planning、reflection 对长期 agent 行为有价值。但这类 reflection 一旦进入真实个人系统，就必须有用户注意力治理：不是所有 reflection 都值得长期保留或继续触发外部动作。

### Agentic / reflective memory 方向

2025-2026 年的 agent memory 研究普遍把 self-reflection、context compression、evidence-gap tracking、memory consolidation 放进长期 agent 架构。对 Personal AI 来说，关键不是再增加一个反思 loop，而是让反思 loop 可控、可合并、可审计、可停止。

## 用户体验设计

### 信息架构

新增入口建议放在 Memory Exploring：

```text
Memory Exploring
  ├── 搜索
  ├── 时间轴
  ├── 自我反思线程
  ├── 决策中心
  ├── 动作队列
  └── 反思巡航
```

`反思巡航` 不是替代现有页面，而是一个跨页面总控：

- 从 Reflection Threads 看到“哪些线程在重复反思”。
- 从 Action Queue 看到“哪些动作是同一个 watch 的重复外部核实”。
- 从 Decision Center 看到“哪些 confirm requests 可以合并成一个判断”。
- 从 Freshness / Answer Tracker / Lifecycle 获取建议去向。

### 首屏结构

1. **顶部健康摘要**
   - 活跃巡航对象数。
   - 本周新增发现数。
   - 重复确认债。
   - 工具阻塞债。
   - 本周节省的用户确认次数。

2. **左侧 watch cluster 列表**
   - `需要你决策`
   - `建议暂停`
   - `重复待合并`
   - `继续巡航`
   - `已降级周报`

3. **右侧决策面板**
   - 当前假设。
   - 为什么还在追踪。
   - 最近新证据。
   - 反复卡住的原因。
   - 建议动作。
   - 影响面。

4. **底部操作日志**
   - 记录用户最近的巡航策略变更，避免静默治理。

### 单个巡航卡内容

```ts
type ReflectionWatchCluster = {
  id: string;
  title: string;
  subjectType: 'entity_property' | 'open_question' | 'external_check' | 'answer_state';
  subjectKey: string;
  currentHypothesis: string;
  openQuestionSummary: string;
  evidenceSummary: string;
  repeatDebt: {
    confirmRequestCount: number;
    proposedActionCount: number;
    reflectionRunCount: number;
    noNewEvidenceRuns: number;
  };
  budget: {
    mode: 'active' | 'weekly' | 'paused' | 'closed';
    maxRunsPerWeek: number;
    maxPendingActions: number;
    nextReviewAt: number;
    stopAfterNoNewEvidenceRuns: number;
  };
  recommendation: {
    kind: 'merge' | 'pause' | 'continue' | 'promote_to_answer' | 'handoff_to_freshness' | 'ask_user' | 'close';
    reason: string;
    confidence: number;
  };
  affectedSurfaces: Array<'ask' | 'today_pilot' | 'memory_lens' | 'action_queue' | 'decision_center'>;
};
```

### 关键操作

| 操作 | 用户看到的文案 | 系统行为 |
| --- | --- | --- |
| 合并重复确认 | `合并为 1 张决策卡` | 关闭/折叠同 subject 的重复 confirm requests，保留一条 merged decision card |
| 暂停巡航 | `暂停 7 天` / `暂停到有新来源` | 设置 watch budget，Reflection worker 不再重复创建动作 |
| 继续巡航 | `继续追踪，但只进周报` | 降低即时打扰，只在 summary/digest 出现 |
| 升级为活答案 | `以后问这个问题先返回当前答案` | 创建/更新 Answer Memory Tracker 对象 |
| 转来源保鲜 | `改为监控来源变化` | 创建 Freshness Radar source watch，不再做 open-ended reflection |
| 关闭巡航 | `这件事不用再追` | 关闭 watch cluster，不删除原始记忆 |
| 手动复查 | `现在跑一次` | 调用现有 `/reflection-threads/:id/revisit`，但附带 budget reason |

### 不同状态的 UX

#### 需要你决策

用于高影响且无法自动判断的事实变化，例如多个 BE readiness confirm requests。UI 应显示：

- 同类请求数量。
- 各版本表述差异。
- 证据时间范围。
- 推荐合并后的唯一问题。
- 三个按钮：`接受新表述`、`保留旧表述`、`继续观察`。

#### 建议暂停

用于连续多次无新证据、工具缺失、候选来源坏掉、外部事实没有官方来源的 watch。UI 应显示：

- 为什么暂停。
- 什么时候自动恢复。
- 暂停不会删除哪些记忆。

#### 继续巡航

用于来源确实会变化且影响明显的 watch，例如 AI 工具授权、默认模型、公司政策、关键项目状态。UI 应显示：

- 下次检查触发条件。
- 最大频率。
- 是否只进入周报。

#### 重复待合并

用于多个 action / confirm / thread 指向同一问题。UI 应显示：

- 可合并数量。
- 合并后保留的主问题。
- 被合并项的来源列表。

## 技术方案

### P0：只读巡航面板

第一阶段不改 Reflection worker，只做只读聚合和人工动作建议。

新增后端服务：

```ts
class ReflectionGovernorService {
  buildOverview(): ReflectionGovernorOverview;
  listClusters(filter: ReflectionGovernorFilter): ReflectionWatchCluster[];
  getClusterDetail(id: string): ReflectionWatchClusterDetail | null;
}
```

数据来源：

- `reflection_threads`
- `reflection_runs`
- `proposed_actions`
- `confirm_requests`
- `entity_properties`
- `action_results`

新增只读 API：

```http
GET /api/v1/reflection-governor/overview
GET /api/v1/reflection-governor/clusters?status=needs_decision
GET /api/v1/reflection-governor/clusters/:id
```

前端：

- `src/modals/components/ReflectionGovernorPage.vue`
- `MemoryServiceClient.getReflectionGovernorOverview()`
- `MemoryServiceClient.getReflectionGovernorClusters()`
- Memory Exploring route：`/reflection-governor`

P0 不自动修改任何数据。所有“建议暂停/合并/关闭”只作为 UI 建议。

### P1：人工批准后的批量治理动作

新增写 API：

```http
POST /api/v1/reflection-governor/clusters/:id/actions
```

body：

```json
{
  "action": "pause" | "merge_confirm_requests" | "close" | "promote_to_answer" | "handoff_to_freshness",
  "reason": "用户在巡航台确认"
}
```

实际写入规则：

- `pause`：调用现有 `ReflectionThreadService.pauseThread(...)`，并写入 governor policy。
- `close`：调用 `closeThread(...)`，但保留原始 thread document。
- `merge_confirm_requests`：新增 `confirm_request_group`，不直接删除原请求；重复请求标记 `superseded_by_group`。
- `promote_to_answer`：只创建 Answer Tracker 候选，不自动成为 confirmed answer。
- `handoff_to_freshness`：只创建 source watch 候选，需用户确认来源 URL/文档。

### P2：Reflection worker 前置预算门

让 Reflection worker 在创建 proposed action / confirm request 前调用：

```ts
const gate = reflectionGovernor.evaluateNextStep({
  thread,
  run,
  proposedQuestion,
  candidateAction,
  evidenceRefs,
});
```

返回：

```ts
type GovernorGateResult =
  | { decision: 'allow'; budgetEvent: BudgetEvent }
  | { decision: 'merge'; clusterId: string; reason: string }
  | { decision: 'snooze'; until: number; reason: string }
  | { decision: 'weekly_digest'; reason: string }
  | { decision: 'block'; reason: string };
```

这一步是核心价值：让系统以后少制造重复债。

### P3：体验评测

新增 eval suite：

```text
evals/cases/reflection-governor/
evals/workflows/reflection-governor/experience.md
```

评测用例：

1. `be-readiness-duplicate-confirm`
   输入 8 条近似 BE readiness confirm requests，应合并为 1 个 `needs_decision` cluster。

2. `openclaw-capability-blocked`
   OpenClaw 缺少能力且已有失败记录，应建议暂停或人工配置，不应继续创建同类委派。

3. `no-new-evidence-streak`
   同一 reflection thread 连续多次无新证据，应降级到 weekly digest。

4. `high-volatility-source`
   AI 工具默认模型/授权政策变化，仍应保留巡航，但要求官方来源或已保存 source watch。

5. `user-impact-routing`
   影响 Today Pilot / Ask 的问题优先级应高于普通技术新闻追踪。

成功标准：

- 重复确认减少。
- 阻塞工具动作不再堆积。
- 高影响 watch 不被误关。
- 所有自动建议都有 visible reason。

## 核心算法

### 聚类 key

按优先级计算：

1. `entity_property:<entityId>:<property>`
2. `project:<projectId>:<normalizedQuestionIntent>`
3. `source_watch:<normalizedUrlOrDocId>`
4. `external_check:<targetSystem>:<normalizedQuestion>`
5. `semantic:<embeddingClusterId>`

同时保留 `surfaceHints`：

- 来自 Ask 的问题。
- 来自 reflection heartbeat。
- 来自 TruthMaintainer。
- 来自 Action Queue。
- 来自 Freshness / Source Memory。

### Utility Score

```text
utility =
  user_proximity * 0.22
  + affected_surface_count * 0.18
  + source_volatility * 0.14
  + evidence_novelty * 0.16
  + recency * 0.10
  + explicit_user_interest * 0.12
  + downstream_risk * 0.08
```

降权：

```text
penalty =
  duplicate_confirm_count * 0.08
  + no_new_evidence_runs * 0.10
  + blocked_tool_count * 0.15
  + broken_candidate_url * 0.12
  + low_source_authority * 0.08
  + never_used_by_surface * 0.10
```

建议动作：

- `utility >= 0.75` 且 `penalty < 0.25`：继续巡航。
- `utility >= 0.55` 且重复债高：合并。
- `penalty >= 0.45`：暂停或 weekly digest。
- `blocked_tool_count > 0` 且无新能力配置：阻断继续创建同类动作。
- `confirm_count >= 3` 且语义相似度高：合并成一张决策卡。

### Stop Loss Rules

默认规则：

- 连续 3 次无新证据：降级 weekly digest。
- 连续 5 次无新证据：暂停 14 天。
- 同一 action 因工具缺失失败 2 次：阻断同类 action，提示配置缺口。
- 同一 property 的 confirm requests 超过 3 条且只是措辞差异：合并。
- 候选 URL 明显解析坏掉：不再委派外部查询，先进入 repair-needed。
- 没有用户可感知影响的事实追踪：默认周报，不打断用户。

### Resume Triggers

暂停不是永久遗忘。以下信号可以恢复：

- 用户在 Ask / Memory Lens / Today Pilot 明确问到该 topic。
- Freshness Radar 检测到来源变化。
- 新消息/会议/Jira 提到同一 entity/property，且证据新颖。
- 用户手动点击 `恢复巡航`。
- 上游工具从 unavailable 变成 available。

## 隐私与安全

1. **不保存额外原文**
   P0 只读取现有 thread/action/confirm 摘要和 evidence refs。

2. **不自动接受事实变化**
   合并 confirm requests 只减少 UI 噪音，不自动写入 TruthMaintainer 结果。

3. **不自动外发**
   对 OpenClaw / web / Jira 的动作仍走 Action Queue 审批。

4. **治理动作可追踪**
   每次 pause/merge/close 都写入 `watch_budget_events`，可在 cluster detail 查看。

5. **避免系统自我审查黑箱**
   用户能看到为什么一个 watch 被暂停、何时恢复、哪些原始证据仍保留。

## MVP 范围

### P0 必做

- 只读聚合页面。
- BE readiness 这类重复 confirm request 聚类。
- Reflection worker queued actions 聚类。
- 工具阻塞 / 无新证据 / 重复确认三类理由展示。
- 每个 cluster 给一个推荐动作。
- demo 与 E2E 覆盖 desktop / mobile。

### P0 不做

- 不修改 Reflection worker 行为。
- 不自动关闭线程。
- 不自动合并数据库记录。
- 不做全局 Memory Trust Console。
- 不做多 agent 调度。
- 不做外部网页定时抓取。

### P1 必做

- 人工批准的 pause / merge / close。
- confirm request grouping。
- Action Queue 中展示 `由反思巡航台合并` 的来源。
- ReflectionThread detail 显示 budget state。

### P2 必做

- Reflection worker 前置 budget gate。
- 避免重复创建 proposed actions。
- 低价值问题自动 weekly digest。
- 高影响问题保留即时提醒。

## 用户真实场景

### 场景 1：用户问“那个 BE ready 了吗？”

现在的体验：

1. 用户反复问短问题。
2. Ask / reflection / TruthMaintainer 各自生成近似结论。
3. Decision Center 里出现多条“BE status may have changed...”。
4. 用户需要判断这些是不是同一件事。

有巡航台后：

1. 系统把 `MTR-141852 / BE readiness` 聚合成一个 watch cluster。
2. 卡片显示：8 条近似确认、4 条 proposed actions、当前主结论仍是“未就绪，等待新 RCV BE design”。
3. 推荐动作：`合并为 1 张决策卡，并升级为活答案`。
4. 用户点一下后，以后问“那个 BE ready 了吗？”先返回当前活答案，并注明“等新 RCV BE design 出现前不再重复确认”。

用户感受：不再被系统要求判断 8 个几乎一样的问题，Personal AI 更像在帮忙收敛，而不是制造待办。

### 场景 2：AI 工具和模型变化监控

现在的体验：

1. Reflection thread 追踪 `Augment default_model`、`Anthropic Claude Mythos release_time`、`ChatGPT availability`、`Codex status` 等。
2. 每条都可能创建外部核实动作。
3. 有些外部来源不是官方确认，有些问题短期没有答案。

有巡航台后：

1. 系统把“AI 工具状态变化”分成高影响和低影响两类。
2. 影响用户今天工具选择的，如 Codex availability，继续巡航并进入 Today Pilot / Ask。
3. 纯新闻式或官方尚未确认的，如某模型发布日期猜测，降级周报或暂停到有官方来源。
4. 如果来源是网页/产品页变化，转交 Freshness Radar，而不是继续开放式追问。

用户感受：仍能得到关键 AI 工具变化，但不会被不确定新闻和重复外部核实淹没。

## 亮点

1. **把 Personal AI 的“自我反思”产品化，而不是藏在日志里**
   用户看到的是巡航对象和治理策略，不是几十条 reflection thread。

2. **保护用户注意力**
   系统学习“不该继续问”和“该合并再问”，这比单纯更积极更重要。

3. **直接解决真实数据里的队列债**
   本次抽样中的 50 个 pending confirm requests 和 448 个 proposed actions 可以成为第一批 eval/fixture。

4. **让长期记忆系统更可信**
   一个能暂停、合并、解释自己后台行为的 AI，比一个只会无限追问的 AI 更像私人助理。

5. **与现有架构贴合**
   不需要先引入新平台。第一版只消费现有 ReflectionThreadService、ActionRepository、ConfirmRequestRepository 和 Memory Exploring。

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 误暂停重要追踪 | P0 只读建议；P2 自动暂停必须保留 resume triggers 和用户可见原因 |
| 变成又一个治理后台 | 首屏按“需要你决策 / 建议暂停 / 重复待合并”组织，不展示底层全量日志 |
| 和 Action Queue 重复 | Action Queue 管单条动作执行；巡航台管跨动作的预算、合并和停损 |
| 和 Answer Tracker 重复 | 只有用户反复问的问题才升级为活答案；后台反思问题默认仍留在巡航台 |
| 低价值规则过多 | 所有规则用 eval cases 固化，先覆盖真实重复债最高的三类 |
| 用户不想维护 | 默认只给 Top 3 决策，其余进入 weekly digest |

## 成功指标

### 产品指标

- pending confirm requests 中重复问题比例下降。
- queued reflection actions 中工具阻塞类重复下降。
- 用户每周需要处理的内部确认卡数量下降。
- Ask / Today Pilot 中的长期追踪问题仍能正确出现，不因降噪丢失高价值事项。

### 质量指标

- `be-readiness-duplicate-confirm` eval：重复确认合并率 >= 80%。
- `blocked-tool-stop-loss` eval：工具缺失后不继续创建同类 action。
- `high-impact-retention` eval：高影响项目状态不会被误暂停。
- `visible-reason` eval：每个建议动作都有可读 reason 和 evidence refs。

### 体验指标

- 用户能在 30 秒内判断某个 watch 为什么还在追。
- 用户能一键暂停/合并/升级，不需要打开多个线程逐条比对。
- 移动端能看清 Top 3 需要决策，不要求复杂表格操作。

## 如果未来继续做，应该怎么落地

1. **先把用户决策入口做进现有交互面**
   把高信号问题直接送到聊天、提醒、推送、Today Pilot 或 Confirm Request，而不是只挂在一个新总览页里。

2. **只保留聚合层作为内部辅助**
   如果仍需要巡航视图，就把它限制成内部诊断或周报，不作为主入口。

3. **治理动作仍然要可审计**
   合并、暂停、升级为活答案、降级周报都要留下原因和证据链。

4. **不要让治理页替代用户互动**
   任何需要用户拍板的内容，都应通过交互式提示完成，而不是埋在后台总览里。

5. **如果后续要实现，再考虑 worker 级别门禁**
   只有当交互入口已经稳定、且确实还存在重复债时，才考虑在 Reflection worker 前加 gate。

## Demo

本次 demo 放在：

[`docs/progressing/memory-reflection-governor-demo.html`](./memory-reflection-governor-demo.html)

Demo 模拟 Memory Exploring 里的新页面，使用了本次远端抽样的典型对象：

- `MTR-141852 / BE readiness` 重复确认债。
- `OpenClaw 当前缺少能力` 的 blocked action。
- `Augment default_model` 和 `Anthropic Claude Mythos release_time` 这类 AI 工具/模型变化追踪。
- `Nova Core Team demo_update_link` 这类长期无新证据的开放问题。

## 结论补充

这次不是否定问题本身，而是否定“单独建一个总览页来承接用户决策”的做法。真正值得保留的是原则：**用户需要决策时，系统应该把问题推到用户当下能互动的通道里，而不是让用户去翻一个后台汇总页。**

如果以后要复活这个方向，建议优先把它拆成三类能力：

- 聊天式追问
- 提醒 / 推送式决策卡
- Today Pilot / Confirm Request 里的高信号聚合

这样更贴近真实使用，也更容易和现有能力边界保持一致。
