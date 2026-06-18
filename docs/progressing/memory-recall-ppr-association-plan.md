# 召回升级：PPR 联想检索 / Personalized PageRank Graph Recall

> 生成时间：2026-06-11 CST
> 来源：《置身钉内》"上下文网状逻辑缝合"杀手场景 + HippoRAG 2（arXiv:2502.14802，NeurIPS'24/ICML'25）
> 优先级：P0（低成本高收益）
> 预估规模：后端 2-3 天 + eval 1 天；无 schema 变更（P0）

## 结论

把 RecallEngine 的 graph 通道从"1 跳全量 + 2 跳 ×0.5 折扣"升级为 **Personalized PageRank（PPR）激活扩散**：以 query/场景中的实体为种子，在用户实体图上跑个性化 PageRank，让"提到 A 想起 B"的多跳联想在一次图计算内完成。这是书中"跨群聊、跨时间、跨文档缝合"场景的检索基础。

它不是：
- 不是换图数据库（继续用 SQLite relationships 表，内存建邻接表）
- 不是替换 vector/FTS/time 通道（只升级 graph 通道的打分逻辑）
- 不是实时重建图（邻接表按用户缓存，写入时失效）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**人物与背景**：你在跟进 MTR-148115。记忆库里有三条相关记忆：

| # | 时间 | 来源 | 内容摘要 | 关联实体 |
| --- | --- | --- | --- | --- |
| ① | 6/2 | 交付群消息 | 「MTR-148115 联调延后到下周」 | MTR-148115、延期 |
| ② | 5/21 | 客户需求群消息 | 「客户希望导出从 CSV 改成 XLSX，FE 需要重估」 | 导出格式变更、Harpreet |
| ③ | 5/28 | 会议纪要 | 估时讨论，MTR-148115 与导出变更同场出现 | → relationships: MTR-148115 —depends_on→ 导出格式变更（strength 0.7）|

你在 /ask 里问：**「MTR-148115 的延期到底和哪个需求变更有关？」**

**Before（现状：1 跳 + 2 跳 ×0.5）**

- vector 通道：query 与 ② 余弦 0.41（「延期」和「CSV 改 XLSX」没有词面/语义重叠）→ 排不进前 8
- FTS 通道：② 不含 issue key，不命中
- graph 通道：1 跳取到「延期」「MTR-148115」直连 chunk（即 ①③），② 在 2 跳之外的证据链上被 ×0.5 折扣后沉底
- 融合结果：② 排第 9，被 topK=8 截断
- 答案：「根据现有记忆，只能确认 6/2 联调延后，无法确定具体原因。」

**After（PPR）**

```json
// channelDiagnostics.graph
{ "algorithm": "ppr",
  "seeds": [{ "entity": "MTR-148115", "weight": 1.0 }],
  "topActivations": [
    { "entity": "延期", "ppr": 0.38 },
    { "entity": "导出格式变更", "ppr": 0.31 },   // 经 depends_on 边激活
    { "entity": "Harpreet", "ppr": 0.12 } ] }
```

- ② 的 memoryScore = ppr(导出格式变更) × evidenceWeight → 升至 top-3
- 答案：「延期源于 5/21 客户提出的导出格式变更（CSV→XLSX，需 FE 重估）——5/28 会议纪要确认了依赖关系，6/2 交付群宣布延后。」（三条证据全引用，weave 徽章显示「3 来源 × 12 天」）

这正是书中「生产群的延期 ↔ 销售群的需求变更」网状缝合场景的检索层答案。

## 依据

- HippoRAG：海马体索引理论——KG 当索引、PPR 模拟模式补全（pattern completion），单跳成本拿到多跳联想，比迭代式检索便宜 10-30 倍；HippoRAG 2 在联想任务上超最强 embedding 检索 +7%。
- 书中场景：「生产群里提到的延期，是因为销售群里昨天客户改了需求」——纯向量召回对这种"语义不相似但图上相连"的证据天然无力。
- LongMemEval 显示多跳/时序是纯向量系统集体短板；本项目已有图谱资产（entities/relationships），升级成本低。

## 现状（代码事实）

- `RecallEngine.ts:1055-1231` graph 通道：1 跳 `relationships WHERE from/to IN (seeds)` 全量；2 跳打分 `rel.strength * 0.5`；盘点标注"实验性、易超时"（2 跳是 SQL 自连接，行数大时慢）。
- 图表：`migrations/001_initial.sql:87-156`——`entities(id, type, name, aliases_json, importance, access_count, mention_count, status)`、`relationships(from_entity_id, to_entity_id, relation_type, strength, co_occurrence_count, evidence_message_ids_json)`。规模假设：单用户 ~100-10k 节点。
- 通道融合：`RecallEngine.ts:1310-1356` type:id 去重 + 多通道 bonus 0.05/通道；MMR `:1503-1583`。
- `/ask` 已返回 `channelDiagnostics`（ask.ts:117）——PPR 的种子与激活路径可以挂在这里做可解释性。

## 方案

### 算法

```
1. 加载邻接表（per-user 缓存）：
   adj[from][to] = w(rel) = strength * log(1 + co_occurrence_count)
   双向（无向图近似）；status != 'active' 的实体跳过。
2. 种子向量：
   - query 实体（QueryIntentParser 已抽取）权重 1.0
   - 场景锚点实体（SceneFrame anchors：people/projects/topics）权重 0.6
   - 实体名 ↔ query 关键词模糊匹配（aliases_json）权重 0.4
3. 节点特异性（HippoRAG 的 IDF 类比）：
   spec(e) = 1 / log(2 + mention_count)   // 高频泛化实体降权
   restart 向量 = normalize(seedWeight * spec)
4. PPR 幂迭代：
   p = (1-d) * restart + d * A^T p   // d=0.85，迭代 ≤20 或 L1 收敛 <1e-6
   5k 节点 × 20 迭代为毫秒级（纯 JS Float64Array）。
5. 实体分 → 记忆分：
   memoryScore(m) = Σ_{e ∈ entities(m)} ppr(e) * evidenceWeight
   evidence 路径：chunks.related_entity_id、relationships.evidence_message_ids_json、
   messages_raw.entities_json。取 top fetchLimit(=topK*3) 条进通道融合。
```

### 集成点

- `RecallEngine.graphChannel()` 内部按 config 分流：`graphAlgorithm: 'ppr' | 'hops'`（默认 hops，灰度切 ppr）。
- 邻接表缓存：`Map<userId, {adj, builtAt}>`，TTL 10 分钟 + relationships 写入路径（IngestionPipeline:1092-1146 UPSERT 处）失效。
- `channelDiagnostics` 增加 `graph: { algorithm, seeds: [{entity, weight}], topActivations: [{entity, ppr}] }`——同时服务"缝合可感知"plan 的解释链路。
- 失败回退：PPR 异常/超时（预算 80ms）→ 自动回退 hops 路径，diagnostics 记 `fallback_reason`。

### P1 增量：同义边

- 夜间巩固新阶段：实体名嵌入相似度 ≥0.85 的 active 实体对，写 `relationships(relation_type='synonym_of', strength=0.5, source='consolidation_synonym')`——解决实体名漂移（"MTR 项目"/"MTR-148115"/"地铁项目"）。
- 复用现有 384-dim 嵌入与 entities.aliases_json，先合并 alias 命中再算嵌入。

### P2 增量：时间衰减边权

- `w(rel) *= exp(-ageDays(lastEvidence)/180)`：旧关系自然减弱，呼应 ForgettingEngine 语义。
- 需要 relationships 增加 `last_evidence_at` 列（migration），由 ingest UPSERT 时维护。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | PPR 实现 + config 开关 + 邻接缓存 + diagnostics + 回退 | 单测（合成图收敛/种子定向）；eval 对比 hops vs ppr |
| P1 | 同义边夜间生成 + 种子接 SceneFrame 锚点 | 同义实体 case 召回率提升 |
| P2 | 时间衰减边权 + last_evidence_at migration | 旧关系 case 不再压过新关系 |

## 验证

- 单元测试：`memory-service/src/__tests__/recallEngine.ppr.test.ts`——合成 3 跳链图（A-B-C-D），断言种子 A 时 C 的 ppr 分 > 随机节点；收敛迭代数 ≤20。
- Eval：`evals/cases/memory-search/` 增加 multi-hop 联想 case（"X 项目的延期和哪个客户需求有关"型），跑 `tools/eval-run.mjs` 对比 `graphAlgorithm` 两档。
- 性能：5k 节点 / 20k 边图，PPR P95 < 50ms（含建邻接表 < 200ms，缓存命中 < 10ms）。
- 回归：`npm test`（api-recall.test.ts 全绿）；hops 默认路径行为不变。

## 与既有 plan 的关系

- `memory-architecture-analysis.md` / `GRAPH_VS_VECTOR_COMPARISON.md`：本 plan 是其"图谱价值"结论的落地，不引入外部图库。
- `memory-weave-provenance-visibility-plan.md`（同批新增）：消费本 plan 的 diagnostics 种子/激活路径做"为什么想到这个"。
- `context-recall-experience-eval-plan.md`：multi-hop case 沉淀进其协议。

## 风险与边界

- 图质量依赖实体抽取：垃圾实体（高 mention_count 泛词）会被 spec() 降权，但若实体合并质量差，PPR 会放大错连——P1 同义边要带 evidence 回执，可被 TruthMaintainer 冲突流程纠正。
- 不改变 Scene Memory Autopilot 的静默门控：PPR 只影响候选排序，展示决策不变（书：主动性边界）。
- 单用户图 >50k 节点时需换 push-based 近似 PPR（当前规模假设下不做）。
