# 写入升级：合并决策 + 记忆演化 + TTL 缓冲 / Merge, Evolution & TTL Probation

> 生成时间：2026-06-11 CST
> 来源：Mem0 ADD/UPDATE/DELETE/NOOP（arXiv:2504.19413）+ A-MEM 记忆演化（arXiv:2502.12110，NeurIPS'25）+ Gemini Temporary Chats TTL 模式 + 六操作分类学（arXiv:2505.00675）
> 优先级：P1（中成本，写路径核心升级）
> 预估规模：6-8 天，分三个独立可交付的切片（合并 / 演化 / TTL+端点）

## 结论

把写路径从"仅 INSERT"升级为**有决策的写入**，分三件事：
1. **chunk 级合并决策**：新内容与近邻旧记忆高度相关时，由 LLM 决策 ADD / UPDATE / MERGE / NOOP，而不是无条件新增（解决同事实多版本堆积）。
2. **记忆演化**：夜间巩固时，新记忆可反向更新旧记忆的摘要/标签/链接（A-MEM 再巩固），让记忆网络自组织。
3. **TTL 试用期 + 生命周期端点补全**：低置信捕获先进 72h 试用期，巩固确认价值才转正式；同时补上 forgetting/compression 的显式 HTTP 端点与向量索引清理。

它不是：
- 不是重做 IngestionPipeline（决策器挂在现有步骤 7 之后，仅对"高相似近邻存在"的少数样本触发）
- 不是 review queue（全部自主决策 + decision 回执可查可撤销——遵守 intake-quality-gate 搁置时定下的"无感校准"原则）
- 不是改 entity_properties 真值层（TruthMaintainer 双时态已是更强的机制，继续负责事实冲突）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**场景 A：同一事实三次演变（合并决策链）**

同一条 BE 估时在三周里变了三次：

| 时间 | 消息 | 现状（仅 INSERT）| After（合并决策）|
| --- | --- | --- | --- |
| 5/20 | 「MTR-148115 BE 估 3 人天」 | chunk-A，salience 0.71 | chunk-A：ADD |
| 6/2 | 「XLSX 变更后改估 5 人天」 | chunk-B 并存 | chunk-B：**UPDATE** → A 标 superseded_by=B、tier 降 weak |
| 6/9 | 「BE 完成，实际 6 人天」 | chunk-C 并存 | chunk-C：**UPDATE** → B 标 superseded_by=C |

提问对比：

- 「BE 估时多少？」Before：chunk-A 入库早、被强化多次、salience 最高排第 1 → 答「3 人天」（**过时**）。After：active 链只剩 C → 答「已完成，实际 6 人天（5/20 曾估 3、6/2 改 5）」。
- 「最初估的是多少？」After 沿 superseded 链做点时回溯 → 「5/20 估 3 人天」。这正是体检 plan 里 knowledge-update 项的得分来源。

**场景 B：72h 试用期（TTL）**

| 事件 | 记忆状态 |
| --- | --- |
| 周一 11:00 随手打开一篇资讯页，自动入库 salience 0.34 | `probation_until = 周四 11:00`，tier 上限 weak：主动搜索能搜到，**不进**被动 Lens/通知 |
| 三天内无任何互动 | 周四夜间巩固：直接 archived（不再走数月的慢衰减）|
| —— 对照：另一条试用期记忆周二被你搜索点开 | 立即转正（probation 清空），开始正常生命周期 |

**场景 C：演化（夜间，原文永不动）**

6/9 完成消息入库当晚，演化阶段给 5/28 会议纪要 chunk 的 summary 追加一句「（后续：6/9 实际 6 人天完成）」并写 `chunk_revisions` 审计行 + `memory_links(6/9 → 5/28, reason: outcome_of)`。下次召回 5/28 纪要时不再误导。

**回执示例**（ingest 响应新增字段，可在 memory-exploring 查到并撤销）：

```json
"decision": { "mergeOp": { "op": "UPDATE", "neighborIds": ["chunk-B"],
  "reason": "同一 issue 同一字段的新值（6 人天 ← 5 人天）" } }
```

## 依据

- Mem0：extract→update 两阶段、LLM 四操作决策是 2026 生产主流范式；本系统在实体/关系/画像层已有 UPSERT，唯独 chunk/记忆条目层是裸 INSERT。
- A-MEM：「新记忆触发旧记忆 context/tags 改写」是大多数系统缺失的再巩固特性；本系统 profile 层已有 supersede 演化（ConsolidationEngine:546-606），chunk 层缺位。
- Gemini Temporary Chats：72h TTL 是"可遗忘性"的产品化标配；书的对应物：「不立刻点开消息，是给自己留处理的余地」——低置信入库也该有反悔窗口。
- 盘点 B 缺口清单：无记忆 TTL；forgotten/archived 的 chunk 仍留在向量索引；ForgettingEngine 无 HTTP 端点；六操作里 forgetting/compression 未显式暴露。

## 现状（代码事实）

- `IngestionPipeline.ts` 10 步，仅 INSERT；去重两层（postId / content_normalized）只拦完全重复，**近似重复直接进库**（Denoise 要等到当晚 embedding>0.92 才归档）。
- `ConsolidationEngine.ts:261-364` Denoise：hash + embedding>0.92 → status='archived'——是"事后去重"，无 UPDATE/MERGE 语义（信息互补的两条记录只能留双份或丢一份）。
- profile 层演化先例：`:546-617` superseded 迁移 + evidenceRefs 合并——本 plan 把同样语义下放到 chunk 层。
- `ForgettingEngine.ts`：S(t)=S0·exp(−t/(T·decay_rate))，<0.05 forgotten / <0.15 archived；**向量索引不清理**（forgotten chunk 仍可被 vector 通道召回，靠 lifecycleWeight 压低）。
- TTL 现状：仅 proposed_actions.expires_at / confirm_requests.expires_at。
- 路由面：无 `/forgetting`、无 `/compression`（盘点 C）。

## 方案

### 切片 A：chunk 级合并决策（ingest 内联）

```
IngestionPipeline 步骤 7.5（仅当 salience>=0.3 即将索引时）：
  近邻检索：chunks_vec top-3 within cos>=0.86（低于 Denoise 的 0.92，留决策空间）
  若无近邻 → ADD（现状路径，零额外成本——多数样本在此短路）
  若有近邻 → LLM 决策（单次调用，输入新旧内容+时间+来源）：
    ADD    : 信息独立，正常新增
    UPDATE : 新内容是旧内容的更新版（如同一 issue 的新状态）→ 新增 chunk，
             旧 chunk memory_metadata 标 superseded_by=新id、retrieval_tier 降为 weak
    MERGE  : 互补 → 新增合并 chunk（evidence 含双方 message id），双原件标 merged_into
    NOOP   : 纯冗余 → 不新增，旧 chunk access_count+1、salience 强化
  decision 回执扩展：ingest 响应 decision.mergeOp = {op, neighborIds, reason}
```
- 防误删红线：UPDATE/MERGE/NOOP **永不物理删除**原件（messages_raw 不动；只动 chunk 的检索层级），可经 memory-exploring 查回执撤销（写反向操作）。
- LLM 失败/超时 → 降级 ADD（与现状一致）。

### 切片 B：记忆演化（Consolidation Phase 2.5）

```
夜间，对当日新增 chunk（≤50 条预算）：
  取 top-5 旧近邻 → LLM 批量判定：
    link    : 写 memory_links(from_id, to_id, reason, created_at)（新表）
    evolve  : 旧 chunk 的 summary/tags 需更新 → 写 chunk_revisions(chunk_id, old_summary,
              new_summary, reason, evidence_chunk_id)（新表），chunks.summary 原地更新
  原文（content）永不改写——演化只动派生的 summary/tags/links（书：整理结果不替代原始证据）。
```
- memory_links 同时供 PPR plan 作图增强边（chunk 级联想）与 weave plan 作缝合证据。

### 切片 C：TTL 试用期 + 端点补全

1. migration：`memory_metadata` 增加 `probation_until INTEGER NULL`。
2. 写入规则：`salience ∈ [0.3, 0.45)` 或 trust_class='untrusted' 的自动捕获 → `probation_until = now + 72h`；试用期内 retrieval_tier 上限 weak（可被主动搜索召回，不进被动 Lens/通知）。
3. 夜间巩固"毕业/过期"：试用期内被召回/正反馈 → 转正（清 probation）；到期无互动 → 直接 archived（跳过漫长衰减）。
4. 端点补全（对应六操作分类学）：
   - `POST /lifecycle/forget` {scope?, source?, olderThanDays?, dryRun}：手动触发范围遗忘（降级，非删除）
   - `POST /lifecycle/compress` {topic|entityId, dryRun}：把某主题的 weak/archived chunks 压缩为一条 summary chunk（复用 Compress 阶段逻辑，按需触发）
   - 巩固 Phase 4.5：**清理向量索引**——forgotten/archived 的 chunk 从 chunks_vec 物理移除（修盘点 B 发现的索引残留）。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| A | 合并决策器 + decision 回执 + 撤销路径 | 合并测试集（同 issue 三版状态→1 active 链）；ingest P95 增量 <300ms（仅近邻命中样本） |
| B | memory_links/chunk_revisions 表 + 演化阶段 | 演化 case：新结论出现后旧 chunk summary 含更新标注；原文不变断言 |
| C | probation migration + 毕业/过期 + 2 端点 + 向量清理 | TTL 状态机单测；/lifecycle/* dryRun 契约；vec 行数 = active chunk 数 |

三切片独立可交付，推荐顺序 C → A → B（C 最小且独立修 bug，A 是核心价值，B 依赖 A 的近邻基建）。

## 验证

- eval：`eval-memory-lifecycle.ts` 扩展 probation 状态；memory-abilities 体检的 knowledge-update 项应因 UPDATE 链而提分（这是本 plan 的北极星指标）。
- 一致性巡检脚本：chunks_vec 与 chunks(active) 行数对账；superseded 链无环。
- 回归：api-ingest / api-recall / consolidation 测试全绿；关闭三开关时行为与现状一致。

## 与既有 plan 的关系

- `memory-intake-quality-gate-plan.md`（搁置）：其搁置理由是"会变成用户维护负担"——本 plan 的 TTL+自主决策+回执正是按"无感校准"原则的重做，可视为该 plan 的继任者。
- `memory-lifecycle-gardener-plan.md`（搁置→Ambient Forgetting 方向）：切片 C 的端点与向量清理实现其后台自动衰减愿景的基建部分。
- `source-memory-distiller-plan.md`（候选）：capsule 蒸馏包是"文档级"的多层产物；本 plan 是"chunk 级"的写入决策，互不替代。
- `memory-injection-defense-plan.md`：trust_class 是 TTL 触发条件之一（untrusted 自动进试用期）。

## 风险与边界

- LLM 决策成本：仅近邻 cos≥0.86 触发（经验上 <15% 样本）；批量演化每日 ≤50 条预算。
- 误合并风险：MERGE 保留双原件 + 回执可撤销；体检集设"不应合并"的对抗 case（同名异事）。
- 试用期不能误伤手动入库：user_manual 来源永不进 probation（用户显式动作 = 最高信任）。
