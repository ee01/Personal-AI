# 打分升级：行为亲密度因子 / Behavioral Intimacy in Salience & Recall

> 生成时间：2026-06-11 CST
> 来源：《置身钉内》ONE 消息排序配方（组织关系/信息性质/行为亲密度）+ 既有 Ambient Calibration 数据
> 优先级：P0（数据已在收集，缺聚合与回写）
> 预估规模：后端 3-4 天（1 张新表 + 1 个巩固阶段 + 2 个打分接入点）

## 结论

把已经在落库的用户真实行为信号（ambient_calibration_traces、memory_outcome_events、notification 点击/忽略、rehearsal 反馈）**离线聚合成 per-实体/来源/会话 的"行为亲密度"因子**，回写进 SalienceScorer 与 RecallEngine 的主排序。这是书中 ONE 排序三信号（组织关系/信息性质/行为亲密度）里本系统唯一缺失的一维——数据管线已有，缺的只是聚合表和打分接入。

它不是：
- 不是新的反馈采集（不动 Ambient Calibration 的采集面和隐私边界）
- 不是替代 query-time 的 outcome policy / relevance patch（那两条线管"这条 cue 该不该出现"，本 plan 管"这个实体/来源对用户多重要"的长期权重）
- 不是用户画像事实（亲密度是排序信号，永不进 confirmed profile）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**人物与背景**：过去 30 天你的真实行为（系统已在 ambient_calibration_traces / memory_outcome_events 里记录，但今天不影响任何排序）：

| 行为流水（已脱敏） | 次数 | 进 rollup 的贡献 |
| --- | --- | --- |
| 与 Harpreet 的 estimate 讨论 cue：插入建议后原样发送（sent_after_insert）| 5 | +1.0 × 5 |
| 「企业周报 bot」来源的提示：直接划掉（dismissed）| 9/12 | −0.3 × 9 |
| 「设计评审」群的 Lens 卡片：展开看过（expanded）| 3 | +0.2 × 3 |

**夜间 rollup 之后（behavior_affinity 表）**：

```
person:harpreet                affinity = +0.62   (5 正 / 0 负)
source:ringcentral:weekly-bot  affinity = −0.31   (0 正 / 9 负，tanh 饱和 + 下限保护)
conversation:design-review     affinity = +0.11
```

**第二天你搜「estimate 口径」**

| 排名 | Before（现状） | After（relevance + 0.08×affinity） |
| --- | --- | --- |
| 1 | 周报 bot 的月度汇总（字面命中 "estimate" ×4） | **Harpreet 5/28 的结论「口径是人天，3h 也可」** |
| 2 | Harpreet 5/28 的结论 | 设计评审群的估时讨论 |
| 3 | 设计评审群的估时讨论 | 周报 bot 月度汇总（降而不消失：负向下限 −0.5）|

`channelDiagnostics` 里能看到每条的 affinity 贡献值——可解释、可排查。同样的 affinity 在 P1 接入通知侧后：周报 bot 的推送 utility 下降、Harpreet 相关冲突的 benefit 上升。

**书的对照**：这就是 ONE 排序配方里「行为亲密度（会话曝光点击、停留时长）」的本系统版——且严守红线：亲密度只改排序，bot 消息不会被自动已读、不会被静默删除。

## 依据

- 书：ONE 的 IM 排序信号 = 组织关系（直属上级/重要联系人）+ 信息性质（@我/DING）+ **行为亲密度（会话曝光点击、发言长度、停留时长）**，"让系统理解对一个用户个性化的真实重要性评估"。本系统前两类已有对应（Relationship Radar / importance），第三类缺位。
- 书："要做个性化，就要有记忆、偏好和反馈闭环"——反馈闭环已有两条 query-time 线，但**不回写主排序**，长期权重学不到。
- Cognee memify（评分回写边权）、Generative Agents 三因子检索（recency+importance+relevance）均验证行为强化是标配。

## 现状（代码事实）

- `SalienceScorer.ts:62-69`：`S = 0.35*importance + 0.20*frequency + 0.15*recency + 0.10*surprise − 0.05*max(0,redundancy−0.7) + 0.15*userInterestBoost`。行为信号仅 userInterestBoost（画像关键词匹配），无点击/hover/停留/回复。
- `RecallEngine.ts:1516-1519`：`relevance = (score + 0.15*recency + 0.1*effectiveSalience) * lifecycleWeight`；召回后 fire-and-forget +0.02 salience 强化（:1593-1646）——只有"被召回过"一种行为。
- 反馈两条线均 query-time、不回写主排序：outcome policy（037 migration，suppress TTL7d/boost TTL14d，作用于 cue 编译）；recall_relevance_patches（036，hide/demote −0.35 scene-scoped）。
- 数据源已齐：`ambient_calibration_traces`（surface、scene key、行为类型、强度、极性）、`memory_outcome_events`（sent_after_insert +1.0 / inserted +0.55 / expanded +0.2 / marked_irrelevant −1.0 / deleted_before_send −0.8）、`notification_records(clicked_at, dismissed_at)`、rehearsal feedback（used/dismissed/irrelevant）。
- `ProactivityPolicy.ts:158-159` benefit 公式中 importance 来源未含行为权重。

## 方案

### 数据模型（migration 03x_behavior_affinity.sql）

```sql
CREATE TABLE behavior_affinity (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,        -- 'entity' | 'person' | 'source' | 'conversation'
  subject_key TEXT NOT NULL,         -- entity_id / person 实体 id / source_type:source / conversationId
  affinity REAL NOT NULL DEFAULT 0,  -- [-1, 1]，正=多互动正反馈，负=反复忽略/标错
  positive_events INTEGER NOT NULL DEFAULT 0,
  negative_events INTEGER NOT NULL DEFAULT 0,
  last_event_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(subject_type, subject_key)
);
```

### 聚合（夜间巩固新增 Phase 3.6：Behavior Affinity Rollup）

```
对窗口内（默认 90 天）每条行为事件：
  contribution = actionWeight * strength * exp(-ageDays/30)   // 30 天半衰
actionWeight 映射（与 MemoryOutcomeLoopService:735-752 对齐）：
  sent_after_insert +1.0 / inserted +0.55 / clicked +0.4 / expanded +0.2 /
  hover_only +0.05 / dismissed −0.3 / marked_irrelevant −1.0 / wrong −1.0
归并到 subject（事件 → 关联实体/来源/会话，经 sceneKey 与 evidence refs 解析）：
  affinity = clamp(tanh(Σ contribution / 5), −0.5, 1)   // 负向下限 −0.5：防误杀
全量重算（窗口数据量小），不做增量状态。
```

### 打分接入（两点，各带开关）

1. **RecallEngine 相关性**（P0）：
   `relevance = (score + 0.15*recency + 0.1*effectiveSalience + 0.08*affinity(subject)) * lifecycleWeight`
   subject 取 item 关联实体的 max affinity 与来源 affinity 的均值；`channelDiagnostics` 暴露 affinity 贡献。
2. **SalienceScorer 摄入打分**（P1）：
   新增项 `+ 0.10 * max(0, entityAffinity)`，同时把 userInterestBoost 权重 0.15→0.10（总权重守恒，重跑 eval 校准）。仅正向进摄入（负向不阻止入库——遗忘交给 ForgettingEngine）。
3. **ProactivityPolicy benefit**（P1）：importance 输入乘 `(1 + 0.2*affinity)`，与 cost-asymmetry plan 协同。

### 书的边界约束（写进实现注释与测试）

- 亲密度**只调排序，不产生副作用**：不自动已读、不自动订阅、不写画像（书：已读恐怖主义）。
- 负向亲密度下限 −0.5：用户某段时间忽略某项目 ≠ 永久静默（区别于 outcome policy 的显式 suppress）。
- 可检视：memory-exploring 诊断页可列 top/bottom affinity（复用现有 outcomes 诊断入口，不新建维护页）。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | 表 + 夜间 rollup + RecallEngine 接入（开关 `recall.affinityEnabled`）+ diagnostics | rollup 单测；召回 eval 不回退、目标 case 提升 |
| P1 | SalienceScorer 接入 + ProactivityPolicy benefit 接入 + 权重再校准 | salience eval（memory-lifecycle suite）回归 |
| P2 | sceneKey 维度细分（同实体在 Jira vs 群聊亲密度分开） | scene 维度 case |

## 验证

- 单测：`behaviorAffinity.test.ts`——衰减、tanh 饱和、负向下限、subject 解析（sceneKey→conversation、evidence→entity）。
- Eval：`evals/cases/memory-search/` 增加"高互动实体应排前"对照 case；`eval-memory-lifecycle.ts` 确认衰减语义不冲突。
- 回归：api-recall / api-ask / quick checks 全绿；关闭开关时输出与现状逐字节一致（快照测试）。

## 与既有 plan 的关系

- `memory-outcome-loop-plan.md`（已 P0 落地）：本 plan 是其"成效账本"的**长期权重消费端**——outcome 管单条 cue 的 suppress/boost（短 TTL），本 plan 管主排序的慢变量；同一数据源，不重复采集。
- `memory-relevance-trainer-plan.md`（候选）：其 patch 仍是 scene-scoped 显式纠错；本 plan 的隐式聚合与其互补，patch 命中时优先（显式 > 隐式）。
- `memory-day-pilot-plan.md`：今日 mission 排序可直接读 affinity。

## 风险与边界

- 反馈稀疏期 affinity≈0，行为不改变——冷启动安全。
- 防自激励循环：affinity 提升排序 → 曝光更多 → affinity 更高。缓解：曝光本身（hover_only/expanded）权重极低，强权重只给"发送/点击/明确标记"等终态行为。
- 隐私：rollup 只读已脱敏 trace（hash/长度/标签），不接触原文，遵守 Ambient Calibration API 既有边界（memory_system.md:109-114）。
