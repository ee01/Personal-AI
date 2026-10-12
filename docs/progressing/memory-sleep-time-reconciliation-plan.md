# 新能力：Sleep-time Reconciliation / 睡眠期记忆整理提纯

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支（`ce81fcd` 之后的未提交状态），审计引用均为 `path:line`。
> Demo：无。本方案是后台运行时改造，按 `memory-frontier-2026-index.md` 惯例用真实数据的 before/after 对比代替界面 demo。
> 来源：E-72 第二轮讨论。用户问「是不是应该把更大的整理放到做梦和自我反思的时候，让写入和提取都薄一些」，并要求先仔细检查现状。

## 1. 一句话结论

**现状是「厚写入、中等读取、薄巩固」，与 Instinct / OpenClaw 的「薄写入、厚睡眠期、薄读取」正好相反。** 夜间巩固今天做的是摘要、同日去重、profile 字符串去重、衰减、索引重建；它**不会**把当天新记忆与旧记忆做 merge / supersede / 矛盾判决，也**不会**从新记忆推导出需要行动或关注的事项。本方案把这两件事搬进睡眠期，同时把写入路径收薄到「确定性 + 一次抽取」，把读取路径收成「确定性快车道 + 按需深车道」。

## 2. 先回答用户的两个问题

### 2.1 Instinct 和 OpenClaw 的思路对不对？

对，但要把术语说准。两家的共同形态不是「写入时做重活」，而是：

- **写入时很薄**：Instinct 对话内 agent 对记忆只读，新信息先落 observations / journal；OpenClaw 回复路径只追加 daily note，并在 compaction 前做一次 memory flush。
- **睡眠期很厚**：Instinct 每 24h 一次 reconciliation（搬临时细节进 workstreams、缩短记录、泛化为特质、删除附带细节、用带日期的更正替换错误事实）；OpenClaw Dreaming 分 light / REM / deep 三阶段，只有 deep 阶段写 `MEMORY.md`，并且「durable memory 只有一个写者：dreaming consolidation」。
- **读取时很薄**：Instinct 用 grep / alias；OpenClaw 默认确定性召回，只有问到过去且确定性车道没命中时才升级到 Active Memory 的阻塞子代理。

OpenClaw 文档引用 LongMemEval（Wu et al., ICLR 2025, arXiv 2410.10813）得出「写什么比怎么索引更重要」。这句话要加限定：LongMemEval 自己的三阶段框架（indexing / retrieval / reading）里，round 粒度索引、fact-augmented key、time-aware query expansion 等**检索侧**优化同样带来显著提升。所以更准确的结论是：**写入侧决定上限，读取侧决定能否够到上限；两边都不能是零，但两边都应该便宜。**

### 2.2 写入侧重会不会丢掉「三年前的高匹配记忆」？

用户的例子：三年前听说朋友的女儿喜欢手办、提过一个动画公主角色；今天要送礼物，系统应该想起来。

这个场景**不是读取厚薄的问题，是「写入时有没有写成对的形状」和「有没有被遗忘引擎误删」的问题**：

1. 三年前那句话如果只是一条 episode（原始消息 + 摘要），三年后用「送礼物」去搜，向量相似度低、词面不重合，再厚的读取也很难命中。
2. 如果写入 / 睡眠期把它提纯成一条**挂在实体上的偏好 unit**（`entity: 朋友A的女儿`，`kind: preference`，`value: 喜欢手办、喜欢某公主角色`，`observed_at: 2023-xx`），那么今天的查询只要能解析出「朋友 A → 女儿」这个实体链，就是一次**实体锚定的确定性检索**，比向量还便宜。
3. 真正的风险在**遗忘**：`ForgettingEngine.ts:146` 对所有非 permanent 的 `memory_metadata` 做 `S(t)=S0·exp(-t/(T·decay_rate))`，低于 0.05 软删、低于 0.15 归档。一条三年没被访问的 episode 必然掉进去。所以**衰减必须按 kind 区分**：episodic 可衰减，挂在人身上的 preference / fact 走「可访问性遗忘」（从被动面消失、主动可搜）而不是软删。这正是 foundation plan §8.5 四种遗忘里 `accessibility_forget` 与 `privacy_delete` 的区别。

行业证据也支持「两边都便宜、结构在写入侧」：

| 系统 / 论文 | 写入侧做什么 | 读取侧做什么 | 对远期记忆的含义 |
|---|---|---|---|
| Mem0（Chhikara et al., 2025, arXiv 2504.19413） | 抽取、合并、更新决策，可选图 | 向量检索 | 相对全上下文 p95 延迟降 91%、token 省 90%+，LLM-as-judge 提升 26%（作者自报） |
| Zep / Graphiti（Rasmussen et al., 2025, arXiv 2501.13956） | 实体 / 边抽取、双时态有效期、旧事实失效 | 边与节点的混合检索 | LongMemEval 时间推理提升最多 18.5%，延迟降 90%（作者自报） |
| HippoRAG 2（Gutiérrez et al., 2025, arXiv 2502.14802） | 离线建 KG + passage 节点 + 同义边 | 查询时 PPR | 关联类任务比最强 embedding 高 7%，同时不再损失简单事实 QA |
| A-MEM（Xu et al., 2025, arXiv 2502.12110） | 新记忆生成结构化 note，并回头更新旧记忆的上下文 / 标签 | 常规检索 | 我们的 `MemoryEvolutionService` 即源于此，但目前只加边不改真值 |
| Sleep-time Compute（Lin et al., 2025, arXiv 2504.13171） | 离线预想问题、预算答案 | 命中即短路 | 测试时算力降约 5 倍；我们的 `AnticipationService` 即此思路 |
| MemoryAgentBench（Hu et al., 2025/2026, arXiv 2507.05257） | — | — | 没有单一方法同时覆盖「精确检索 / 测试时学习 / 长程理解 / 选择性遗忘」四项 |
| Generative Agents（Park et al., 2023, arXiv 2304.03442） | 周期性 reflection 生成高层记忆 | recency × importance × relevance 打分 | 反思在写入侧，打分在读取侧，两边都是便宜操作 |

把这些放在一起，得到本方案的设计原则：

- **写入时只做确定性 + 一次抽取**：dedup、信任分级、claim attribution、embedding、一次结构化抽取（已在 v3 shadow 中），不在写入路径做 merge 判决（取代 `memory-merge-evolution-ttl-plan.md` 切片 A 的内联位置）。
- **睡眠期做全部整理**：当天全部新 unit 对旧真值逐条判决（corroborate / refine / supersede / dispute / noop）、实体 alias 合并、矛盾扫描、kind 分级衰减、one-pager 重生成（见 `memory-resident-one-pager-plan.md`）、attention 候选推导（见 `memory-attention-triage-plan.md`）。
- **读取分两条车道**：快车道永远是确定性的（实体锚定 + lexical + 一个 dense 通道 + RRF，无 LLM），深车道（query 分解、时间感知扩展、小型 reranker、多跳）只在用户显式深问或快车道无强命中时启用，对应 OpenClaw Active Memory 的 `escalate` 模式与 foundation §7.6 的 Surface policy。

## 3. 现状（代码事实）

### 3.1 夜间巩固实际做了什么

| 阶段 | 读 | 写 | LLM | 覆盖 | 出处 |
|---|---|---|---|---|---|
| P1 Compress | 当天 `messages_raw` 全量 | `daily/<date>.md` | 1 次 | 当天全部，无 token 预算 | `ConsolidationEngine.ts:287-325` |
| P2 Denoise | 当天 `messages_raw` | `consolidation_level='archived'` | 否 | 哈希全量；向量 >0.92 仅当 ≤200 条；**只在当天内部两两比较** | `ConsolidationEngine.ts:343-427` |
| P2.5 Evolution | 近 24h chunks，`LIMIT 50` | `memory_links`、summary 追加一句、`chunk_revisions` | 否 | 每 chunk 5 邻居 sim≥0.8；**只建边不 merge / supersede** | `MemoryEvolutionService.ts:24-143` |
| P3 Structure | `watched_projects` 24h 消息 | `projects/<slug>.md` | 每项目 1 次 | 仅 watched projects；Markdown 不产生动作 | `ConsolidationEngine.ts:448-525` |
| P3.5 Profile | 全部 active `user_profile_items` | decay、同 key 全等合并、<0.1 归档、`USER_CORE.md` | 否 | 去重 = 小写字符串全等 | `ConsolidationEngine.ts:600-815` |
| P3.7 Synonym | entities top-800 by mention | `relationships(synonym_of)` | 否 | 只加边，不合并实体、不改 aliases | `SynonymEdgeService.ts:38-205` |
| P4 Clean | 全部非 permanent metadata | decay / archive | 否 | 全量，不分 kind | `ForgettingEngine.ts:146` |
| P6 Reflect | 当天消息数 + 日摘要前 2000 字 | `reflection_artifacts`、`reflections/<date>.md` | 1 次 | 摘要的摘要；openQuestions 只落盘 | `ConsolidationEngine.ts:956-1041` |
| v3 A–E | — | — | — | **未实现**：只有 `isConsolidationPhaseEnabled()` 读 `MEMORY_CONSOLIDATION_V3`，全仓库无调用方 | `v3/ConsolidationPhases.ts:18-23` |

### 3.2 为什么说「没有 reconcile」

- 跨期 merge 只有写入时的 `MergeDecisionService`（取 3 个 cos≥0.86 邻居，LLM 判 ADD/UPDATE/MERGE/NOOP），默认关：`MergeDecisionService.ts:42-196`，`config.ts:578-580`。
- 冲突逻辑 `TruthMaintainer.handleConflict`（`TruthMaintainer.ts:280-412`）的调用方只有 ActionExecutor、entities 路由、confirmRequests、feedback；`IngestionPipeline` 抽出的 property **直接 INSERT** `entity_properties`（`IngestionPipeline.ts:1240-1257`），绕过冲突。夜间没有 phase 遍历同 key 多值。
- v3 `UnitTruthMaintainer` 有 corroborated / disputed / superseded 语义（`v3/UnitTruthMaintainer.ts:18-22`），但只在 `ExtractionWorker` 写入时逐候选调用，且 reviewed plan F9 指出它把相反陈述并进旧 unit 标 disputed 而不独立保存。

### 3.3 写入路径有多厚

`IngestionPipeline.ingest()` 每条消息：dedup → 注入筛查 → LLM 抽取（`INGEST_LLM_EXTRACTION_ENABLED`，`.env` 为 false）→ Salience（embedding）→ 写 `messages_raw` → v3 shadow 抽取（`MEMORY_WRITE_V3_SHADOW` 为 true，LLM 1 次）→ claim attribution（规则）→ 消息 embedding → 实体 / chunk / FTS → merge decision（默认关）→ probation / profile / opinion 候选 → watched project 匹配 → focus project 时间线抽取（LLM，fire-and-forget）→ daily log。`IngestionPipeline.ts:261-777`。按 flag 组合 0–4 次 LLM / 消息。

### 3.4 读取路径有多厚

`RecallEngine.recall()`：query embedding → vector / fts / graph(PPR) / time 四通道并行、3× over-fetch → trigram shadow → 合并去重加分 → lifecycle 过滤 → MMR + affinity → RecallItem → 访问强化。`RecallEngine.ts:716-953`。**0 次 LLM**（LLM 在上层 /ask 与 OnlineReflection）。读取并不算厚；厚的是 /ask 之后每次都跑的 `OnlineReflection`（1 次 LLM）。

### 3.5 已登记的事故与数据

- `REFLECTION_ENABLED` 默认开曾导致心跳 1.7M tokens / 天，关闭后降 94%；撞 $200 / 月限额（`docs/progressing/to-verify.md`）。
- 2026-09 取证：`esone.qiu` 899 条 active reflection thread 中 665 条从未反思，单线程空转 419 次（`memory-reflection-governor-plan.md` 2026-09-11 更新）。
- 本轮生产服务（`10.32.56.212` / `memory.xmnup.com`）从本机不可达，未能取新数据；以上为既有取证。

## 4. 两个使用场景

### 场景 A：同一事实三天三个版本

周一 Glip 里同事说「MTR-141852 等新设计，not ready」；周三 Jira 评论写「design approved, ready for dev」；周四站会纪要写「BE 开始开发」。

- **Before**：三条都进 `entity_properties`，同 key 三个值并存；Lens 可能同时提示「not ready」与「开始开发」；TruthMaintainer 不会被触发（§3.2）。
- **After**：周三夜里 reconcile 发现同实体同 key 新值，`first_party_record`（Jira）权威高于 `third_party_report`（转述），旧值标 `superseded_by`，保留原文；周四再叠加 corroborate。周五早上 Lens 只提示最新状态，并带「3 个来源 × 4 天」回执。

### 场景 B：三年前的偏好

2023 年某次聊天提到「朋友 A 的女儿特别喜欢手办，房间里全是某公主角色」。2026-10 用户在 Compose 里打「给 A 女儿挑个生日礼物」。

- **Before**：那条消息三年没被访问，`ForgettingEngine` 早已软删；即便没删，向量相似度也不足以进 top-K。
- **After**：2023 年那晚的 reconcile 把它提纯成 `preference` unit 挂在实体「A 的女儿」上（`observed_at=2023-xx`，`evidence_class=third_party_report`）。preference kind 不走软删，只走 accessibility_forget。2026 年查询解析出实体「A → 女儿」，快车道实体锚定命中，Lens 提示「2023 年 A 提过她喜欢手办和某公主角色（来源：Glip，3 年前，可能已变化）」。

## 5. 方案

### 5.1 目标形态

```
写入（薄）  dedup → trust_class → claim attribution → 1 次结构化抽取（v3） → embedding → 落 episode + provisional unit
                                                                     │
睡眠期（厚） ┌── A 确定性：decay(按 kind) / evidence-key 去重 / alias 归一 / 独立来源加固
            ├── B 判决：当天全部 provisional unit × 旧真值候选 → corroborate | refine | supersede | dispute | noop（cheap LLM）
            ├── C 扫描：同实体同 key 多值 + 高相似异义对 → dispute / confirm_request（cheap LLM-as-judge，14 天冷却）
            ├── D 派生：insight / brief（带 expiry）、one-pager 重生成、profile proposal（durable 待确认）
            └── E 投递：action_item / open_question / event(date) kind → attention 候选（见 attention-triage plan）
                                                                     │
读取（薄）  快车道：实体锚定 + lexical + dense + RRF（无 LLM）──无强命中且用户在深问──▶ 深车道：时间感知扩展 / 多跳 / 小 reranker
```

### 5.2 与既有 plan 的关系

| plan | 关系 |
|---|---|
| `memory-foundation-rearchitecture-plan.md` §8.1–8.3 | **本方案是 A–E 五阶段的实施 plan**，不新增阶段，把 §11.8 的白名单顺序落成可运行的 nightly phase |
| `memory-foundation-rearchitecture-reviewed-plan.md` §6.4 | 候选集生成严格按 `TruthCandidatePlan`：确定性候选 + 各通道并集 + 单通道 Top-m，不复用 recall RRF Top-K；预算不足标 deferred |
| `memory-merge-evolution-ttl-plan.md` 切片 A | **取代其「写入时内联 merge」位置**，判决语义（ADD/UPDATE/MERGE/NOOP、原文永不动）保留并搬到阶段 B；切片 B（evolution 只改派生层）与切片 C（probation）不变 |
| `memory-sleep-time-compute-plan.md` | 复用其「挂现有 daily cron，不建新调度器」；Anticipation 继续在 6.5 |
| `memory-reflection-runtime-governance-plan.md` | 遵守「监控 ≠ 反思」：状态会不会变走 evidence watch，本方案不复活 reflection 研究 |
| `memory-lifecycle-gardener-plan.md` | 按 kind 分级衰减是其 `retrieval_tier` 与 `consolidation_level` 分离的具体化 |
| `memory-echo-dampener-plan.md` | 阶段 A 的「独立来源加固」只接受不同 `EvidenceOriginFamily` |
| `memory-recall-ppr-association-plan.md` P1 | synonym 边继续生成，但阶段 A 新增「alias 归一到 canonical entity」 |

### 5.3 明确不做

- 不改 SQLite 真源、不把 Markdown 变真源（I4）。
- 不做 review queue；dispute 只有在 durable / sensitive / 对外动作相关时才升为 confirm_request。
- 不删原文、不改写 episode；supersede 只改 unit 状态与关系。
- 不在写入路径做 LLM 判决；不在 Passive 面调在线 LLM。
- 不复活 reflection 研究循环；不新建调度器。

### 5.4 数据契约

- `memory_units.status` 新增使用 `superseded` / `disputed`（已在 v3 枚举）；新增表 `unit_reconcile_decisions(unit_id, candidate_unit_id, decision, evidence_keys_json, model_version, decided_at, cooldown_until)`，幂等键 `(unit_id, candidate_unit_id, evidence_digest)`。
- `memory_metadata` 衰减策略按 `memory_form × kind`：episodic 走现有曲线；semantic preference / fact 挂实体者 `floor=0.15`（只到 archive，不软删）；procedural 不衰减只按使用健康度。
- `entities.aliases_json` 由阶段 A 写入（来自 synonym 边 + 抽取 alias），`RecallEngine` lexical 通道扩展 alias。
- 阶段 B / C 的 LLM 契约复用 `MergeDecisionService` 的输出 schema，增加 `dispute` 与 `refine`。

### 5.5 成本制度（默认值就是制度）

| 阶段 | 模型档 | 预算帽 | 超帽行为 |
|---|---|---|---|
| A | 无 LLM | — | — |
| B | cheap（现有 `LLM_PROVIDER` 的小模型路由） | 每用户每晚 ≤ N 次（首轮 N=120，对应约 200 条新 unit 的候选对） | 剩余标 deferred，次日优先 |
| C | cheap LLM-as-judge | 每晚 ≤ 60 对，14 天冷却 | 同上 |
| D | smart | one-pager 1 次 + insight ≤ 5 次 | 跳过 insight，one-pager 必跑 |
| 读取深车道 | smart | 仅显式深问 / 快车道无强命中 | 回退快车道结果并标注 |

所有调用进 `usage_events`，dashboard 新增 `reconcile_*` job class；撞预算先停 C 再停 B，永不停 A。

## 6. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | 只读审计脚本：对 `esone.qiu` 快照统计同实体同 key 多值数、三年以上 preference 被软删数、当天 unit 与旧 unit 高相似对数；产出 before 基线 | 2 | 数字进本 plan §3 |
| Phase 1 | 阶段 A 上线（确定性，无 LLM）：按 kind 衰减、alias 归一、evidence-key 去重；`MEMORY_CONSOLIDATION_V3=A` | 3 | eval:memory-abilities 不退化；三年前 preference 场景可召回 |
| Phase 2 | 阶段 B shadow：只写 `unit_reconcile_decisions`，不改 status；对比人工抽样 50 对 | 4 | 判决一致率 ≥ 0.85 后切 live |
| Phase 3 | 阶段 C 矛盾扫描 shadow → live；confirm_request 只在 durable / sensitive | 3 | 误报（both-valid 被判 contradict）≤ 10% |
| Phase 4 | 写入路径收薄：关闭内联 merge（已默认关）与 OnlineReflection 的每次触发，改为采样 1/5 并把偏好候选交给阶段 D | 2 | /ask p95 下降；token / 天下降 |
| Phase 5 | 读取两车道：快车道加实体锚定；深车道只在 escalate 条件触发 | 4 | Passive p95 < 500ms；Ask 深车道触发率 < 20% |

## 7. Evals（上线门槛）

实现时必须新增 `memory-service/evals/sleep-time-reconciliation/`，用真实 `esone.qiu` 数据脱敏后构造：

| case 组 | 最少条数 | 量化门槛 |
|---|---|---|
| 同实体同 key 多版本（场景 A） | 20 | 最新值正确率 ≥ 0.9；旧值可追溯率 100% |
| 远期偏好（场景 B，≥ 1 年） | 15 | 实体锚定召回率 ≥ 0.8；无一条被软删 |
| both-valid 对（不应判矛盾） | 15 | 误判 ≤ 10% |
| 推断不得覆盖一手来源 | 10 | 违规 0 |
| 成本 | 7 晚 | 每用户每晚 token ≤ 预算帽；A 阶段 0 LLM |

跑一次出报告，迭代到全部通过；同时纳入 `eval:memory-abilities` 回归门。

## 8. 风险与缓解

- **判决错误把对的标成 superseded**：原文不动 + `unit_reconcile_decisions` 可回滚 + Lens 回执显示「已被 X 替代」可一键撤销。
- **cheap 模型质量不足**：Phase 2 shadow 先量一致率；不达标不切 live。
- **衰减分级让库体积增长**：preference / fact 只到 archive，被动面不展示，体积可接受；Phase 0 先量级。
- **与 v3 切换顺序冲突**：本方案只读写 v3 表，不触碰旧 `chunks` 真值；v3 reader 未切换前，结果通过 `memory_exposures` 观察。

## 9. 可观测性与回滚

- 指标：每晚 reconcile 处理 unit 数、判决分布、deferred 数、LLM 次数与 token、矛盾对数、confirm_request 新增数。
- Flag：`MEMORY_CONSOLIDATION_V3`（A/B/C/D/E 逐级）、`RECONCILE_LLM_BUDGET_PER_NIGHT`、`FORGETTING_KIND_POLICY`。
- 回滚：关 flag 即停；已写 decision 表保留，status 变更按 decision 表逆向恢复。

## 10. 文档交接

实现完成后，把睡眠期阶段、按 kind 衰减与两车道读取写入 `docs/features/memory_foundation.md`（巩固与检索章节）与 `docs/features/background_jobs.md`，更新 `docs/index.md`，删除本 plan。

## 11. 推荐决策

先做 Phase 0 + Phase 1（五天内，零 LLM），用数字确认「同 key 多值」与「远期偏好被删」两个问题的规模，再决定 B / C 的预算档。
