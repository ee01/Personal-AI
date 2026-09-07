# 检索索引断供回填 / Memory Index Backfill Plan

> 生成时间：2026-09-03 CST
> Canonical 对齐：2026-09-07
> 状态：待执行（独立任务，可由单独的执行者/模型承接）
> 上游诊断：[memory-foundation-rearchitecture-plan.md §2.2](./memory-foundation-rearchitecture-plan.md)（观测基线）、§11.2（P0a）、§11.4（P0c）
> 目标读者：接手执行这项修复的工程师或模型。本文自带全部必要事实，不需要回读上游文档也能执行。

---

## 0. 一句话

2026-09-03 观测到生产库有 **15,109 条消息，其中约 11,467 条（76%）从未进入完整检索索引**（无 chunk ⇒ 无 FTS ⇒ 无 chunk 向量）。这些消息的**原文 100% 完好地存在 `messages_raw.content` 里**，因此可从库内离线恢复，不需要重新拉取 Glip。Canonical P0c 只立即执行 **Tier 0：分块 + FTS**；历史全量向量要等 P0.5 完成 embedding/量化裁决，实体图谱与画像则等 P1 v3 抽取管线，避免重复建设和重复付费。

---

## 1. 现状实测（2026-09-03，生产库 `esone.qiu`）

连接方式：`ssh rcadmin@10.32.56.212` → `/usr/local/bin/docker exec memory-service node <script>`，库路径 `/app/data/users/esone.qiu/memory.db`（容器内），宿主是 OrbStack + docker named volume `personal-ai_memory-data`。

### 1.1 覆盖率断崖（按月）

| 月份 | 消息数 | 已分块 | 覆盖率 |
|---|---:|---:|---:|
| 2025-08 | 797 | 0 | 0% |
| 2025-09 | 526 | 0 | 0% |
| 2025-10 | 325 | 1 | 0.3% |
| 2025-11 | 115 | 0 | 0% |
| 2025-12 | 593 | 0 | 0% |
| 2026-01 | 654 | 0 | 0% |
| 2026-02 | 559 | 0 | 0% |
| **2026-03** | 594 | 515 | **87%** |
| **2026-04** | 1404 | 1155 | **82%** |
| 2026-05 | 349 | 129 | 37% |
| **2026-06** | 1691 | 1307 | **77%** |
| **2026-07** | 905 | **16** | **1.8%** ← 断崖 |
| **2026-08** | 2444 | **3** | **0.1%** |
| **2026-09** | 403 | **0** | **0%** |

⇒ 索引管线**只在 2026-03 ~ 2026-06 真正工作过**，7 月起彻底停摆，且 2026-02 之前也从未覆盖。

### 1.2 数据完整度（决定能否回填）

断供期（`timestamp >= 2026-07-01`，3,752 条）：

| 字段 | 覆盖 | 含义 |
|---|---:|---|
| `content` | **3752 / 3752（100%）** | ✅ 原文完好——这是回填可行的根本前提 |
| `metadata_json` 是合法 JSON | 2702 / 3752（72%） | 1,050 条 metadata 损坏，解析时必须 `json_valid()` 保护 |
| `metadata_json.$.entities` | **107 / 3752（2.8%）** | ❌ 浏览器抽取的实体在断供期几乎不存在 |
| `metadata_json.$.summary` | 126 / 3752（3.4%） | ❌ |
| `messages_raw.summary` 列 | 1405 / 3752（37%） | 部分有 |

对照断供前（2026-01 ~ 06，5,251 条）：`has_chunk` 3,106、`$.entities` 2,368（45%）。

⇒ **结论：断供期无法靠 `metadata.entities` 免费恢复实体图谱**（只有 2.8% 有），必须交给 P1 的 canonical extraction pipeline 重新生成候选；该管线可组合规则、本地模型和受预算控制的 LLM。**分块/FTS/向量只依赖 `content`，可以离线重建，但向量模型仍要先经 P0.5 裁决。**

### 1.3 相关 schema 事实

- `chunks`：消息类 chunk 的 `file_path = 'messages/' || messages_raw.id`，`related_entity_id` 也等于该 id，`source_type='glip'`。当前 `chunks` 共 10,938 行，其中 `messages/` 前缀 3,642 行，其余为 `source-memory/`(3048)、`reflection-threads/`(1800)、`calendar/`(928)、`daily/`(892)、`data/`(534)。
- `chunks_fts`：FTS5 external-content 表，**由 `chunks` 上的 AFTER INSERT/UPDATE/DELETE 触发器自动同步**（`memory-service/src/storage/migrations/001_initial.sql:54-72`）。⇒ **正常触发器存在且通过 integrity check 时，写入 chunk 会同步 FTS；执行者仍必须验证触发器未缺失并在必要时 rebuild。**
- `chunks_vec`：`vec0(chunk_id INTEGER PRIMARY KEY, embedding float[384])`。
- `messages_vec`：`vec0(message_id TEXT PRIMARY KEY, embedding float[384])`，影子表 `messages_vec_rowids` 列为 `rowid,id,chunk_id,chunk_offset`（`id` 即 message_id）。当前 10,826 行——**比已分块消息还多**，说明整条消息级嵌入曾在更长时间段内工作过。
- 嵌入模型：`EmbeddingClient`，`Xenova/all-MiniLM-L6-v2`，384 维，**本地 ONNX 推理，无 API 费用**。
- 分块参数：消息走 `chunkText(content, 400, 80)`（400 token / 80 overlap，`IngestionPipeline.ts:1445-1488`）。
- 数据库当前 `journal_mode = delete`（**非 WAL**，无 `-wal`/`-shm` 伴生文件）⇒ 写事务与读互斥，批量写会阻塞前台召回。
- 活库 1.3 GB，其中 `rehearsal_activations` 及其索引占 850 MB（64%）——见上游 §2.2 与 §9.2；它与本任务独立，但会影响备份、迁移和 VACUUM 时长。

---

## 2. 前置条件（**不满足就不要开始**）

| # | 前置 | 为什么 | 检查方式 |
|---|---|---|---|
| B1 | **先修 `IngestionPipeline.ts:304` 的 salience/抽取/索引 admission 耦合** | 否则回填完成后，抽取关闭或低 salience 消息仍不进索引，断供会重开 | policy-eligible 非空 episode 无论 extraction/salience 都写 legacy chunk+FTS；salience 只影响 rank/priority；排除项有 typed receipt |
| B2 | **Tier 0 不等待 embedding 裁决** | chunk + FTS 与模型无关，先恢复 lexical 可检索性；Tier 1 才等待 P0.5 | Tier 0 不写新向量；Tier 1 有 P0.5 model/quantization decision id |
| B3 | **一次经校验且完成恢复演练的完整备份** | 本任务是生产库写操作 | 按上游 §9.5：quick/FK/FTS/projection invariants + manifest + restore smoke；不用简单行数单调断言 |
| B4 | 磁盘余量 ≥ 6 GB | 回填新增 chunk/FTS，且后续 VACUUM 需要约 2× 活库空间；若 P0.5 后另做向量回填还要重新估算 | `df -h` + 按候选模型维度生成容量 manifest |

> Tier 0 与模型无关，应先执行。Tier 1 不得凭“中文模型应该更好”直接开始；必须引用 P0.5 的模型、量化、阈值和 recall-loss 裁决，并把 model/version 写入投影 metadata。

---

## 3. 回填分层（按依赖门执行；每层可单独停止和回滚）

### Preflight Q — 数据质量归一（零 API 成本，必须先于 Tier 0）

- **922 行坏时间戳**（`timestamp < 946684800`，多为 epoch 0）：只从可验证 source timestamp/message id/file metadata 恢复；无法证明时保留 `observed_at=null, time_quality='unknown'`，禁止用 `created_at` 冒充事件时间。
- **1,050 行非法 `metadata_json`**：先统计损坏形态；可逆修复写 revision/manifest。不能修的保留原值并在隔离状态标 invalid，不能直接覆盖成 `{}` 丢失证据。
- Q 阶段必须在 P0b 的独立备份和 dry-run 后执行；其输出 manifest 是 Tier 0 输入。Q 未完成时不得开始 Tier 0。

### Tier 0 — 分块 + 全文索引（零 LLM、零 API 成本，**收益最大**）

**做什么**：对所有 `messages_raw` 中缺少对应 chunk 的消息，按 `chunkText(content, 400, 80)` 生成 chunk 并写入 `chunks`；`chunks_fts` 由触发器自动同步。

**为什么收益最大**：被动 Lens 与 Compose Assist 用 `lifecycleMode='passive_surface'/'composer_surface'`，被排除在 `RecallEngine` 的 `rawMessageLexicalSearch` LIKE 兜底之外（`RecallEngine.ts:1065-1084`）。所以对它们而言，**没有 chunk ⇒ 没有 FTS ⇒ 连词法命中都没有**。仅这一层就能把 1.1 万条消息从"完全检索不到"变成"词法可检索"。

**目标行数**：约 11,467 条消息 → 预计 1.5 万~2.5 万条 chunk（多数 Glip 消息 < 400 token，即 1 条消息 1 个 chunk）。

**注意**：
- 必须按 `file_path = 'messages/'||id` 判断是否已存在，**幂等**：`INSERT` 前先 `DELETE FROM chunks WHERE file_path = ?`（与 `MarkdownManager.reindexFile` 同款做法），避免重复跑产生重复 chunk。
- `content_hash` 字段要填，用于后续去重。
- `scope`/`source`/`source_type`/`trust_class` 从 `messages_raw` 同名字段继承，不要留空——它们参与召回过滤。
- 跳过 `content` 为空或纯空白的行。
- Tier 0 只消费 Preflight Q 已归一的时间字段；发现未处理的 epoch-0 行立即停止该批，不能在 chunk 写入时临时猜时间。
- Canonical P0c 另建 `chunks_fts_tri` shadow 作为中文/混合文本消融；它不替换现有 FTS，必须有 triggers/rebuild/integrity test。

### Tier 1 — 向量嵌入（P0.5 后再决定是否执行）

**P0c 默认不做历史全量向量回填。** P0c 只可重建已有 `chunks_vec` 以修复碎片并维持可比较的旧栈 dense baseline。等 P0.5 选定 model/quantization 后，历史向量直接写入最终选定的隔离投影，避免 MiniLM 和新模型各跑一次。

**成本**：纯本地 CPU。MiniLM 在普通 x86 上约每秒数十条，2 万条约 10~30 分钟（需实测）。

**注意**：
- P0c 可处理 `chunks_vec` 的碎片，但只能对当前已有覆盖建影子表、校验、切换；不得借机扩成历史全量回填。
- 不再扩大 `messages_vec`；v3 将由版本化 `unit_views_vec` 承担最终投影。
- 嵌入失败的 chunk 要记录并可重试，不能静默丢失（现有代码 `embedChunkAsync` 是 fire-and-forget + warn，回填脚本必须比它严格）。

### Tier 2 — 实体图谱 / 画像（移交 P1，不在 P0c 执行）

不要为旧 schema 单独实现一次 LLM backfill。P1 的 v3 ExtractionWorker 就绪后，从同一批 episode 生成 normalized units/sources/edges/profile proposals，并在 dual-write 窗口按 canonical TruthMaintainer 处理。

**成本估算**：上限约 11,467 条 episode × 1 次抽取调用；prompt 模板约 700–800 token + 消息全文（**当前 `IngestionPipeline.ts:772` 对 `payload.content` 是裸插值无截断，必须先加上限**）。粗算 1,000 万~2,000 万输入 token 量级；具体模型由 §6.5 tier router 与当期价格清单决定。**执行前必须先配日预算、样本命中率和告警，不能把上限当实际调用量。**

**P1 必须采用的候选策略**（不要无差别全量跑）：
1. **按价值筛选**：优先跑有 `matched_rule`（命中关注规则）、有 `summary`、来自活跃群组/watched project、或 `importance` 较高的消息。
2. **分批 + 可中断 + 记游标**，每批提交后写 checkpoint。
3. **走便宜档模型**，并遵循上游 §6.5 的 tier 路由；只有允许延迟超过 24 小时的批次才使用 Batch。
4. 输出写 v3 normalized lineage；浏览器 metadata 只作 client hint，不再作为 canonical entity 真源。

P0c 的可用性目标由 Tier 0 达成。Tier 2 属于 P1 质量与真值迁移，不是事故止血。

## 4. 执行约束（生产库，必须遵守）

1. **只读校验先行**：每个 Tier 开始前先跑一次只读统计，记录基线行数；结束后再跑一次，比对增量是否符合预期。
2. **幂等可重跑**：优先使用 deterministic natural key + UPSERT/IGNORE；必须替换 chunk 时在单事务内完成并验证 FTS trigger，脚本中断后重跑不得产生重复数据。
3. **分批 + 游标**：初始每批 200 条，批间提交并写 `backfill_progress(tier, last_message_id, done_count, updated_at)`；只有连续三批锁等待与前台 p95 都在门内才可逐级升至 500，任一超门立即降批或暂停。
4. **维护窗 + 自动停止**：执行前重测 journal mode。若仍为 `delete`，只在已声明的低峰维护窗运行；foreground p95 超出 §7.6 SLO、lock timeout 或 health 非 ready 时自动停止，不靠固定 sleep 猜测安全间隙。
5. **不要在回填期间做 VACUUM**；P0b/P0c 的已授权作业全部通过后，按上游 §9.5 的 quiesce/validate/fsync/replace/rollback 流程统一执行。
6. **不要触碰** `lost_and_found` / `lost_and_found_0` / `lost_and_found_1`；它们由上游 §9.4 的 fingerprint 规则单独处理。
7. **失败不推进游标**，保留原始数据，不做破坏性覆盖。

---

## 5. 验收标准

| # | 判据 | 目标 |
|---|---|---|
| A1 | `SELECT COUNT(*) FROM chunks WHERE file_path LIKE 'messages/%'` | 从 3,642 升至约 1.5 万+ |
| A2 | 按月覆盖率（§1.1 同款查询） | 对 `content` 非空且未被 policy 排除的 eligible 消息，2026-07/08/09 三个月均为 100%；总消息口径单独报告，不能用 >90% 掩盖静默漏写 |
| A3 | `chunks_fts` 与 `chunks_fts_tri` | 旧 `porter unicode61` 用英文、数字、票号 fixture 验证可用；trigram shadow 用中文/中英混合 fixture 验证 recall，并运行 trigger/rebuild/integrity 三类测试。两者结果分开报告 |
| A4 | `chunks_vec` 完整性 | P0c 只要求已有 dense baseline 可解释且无 orphan；历史全覆盖等待 P0.5/P1 |
| A5 | **端到端**：打开一个 2026-08 之后才讨论过的 Jira/群聊 fixture，被动 Lens 能召回该时段记忆 | 2026-09-03 基线为空；执行前重测，结束后 lexical 候选与展示 gate 均有回执 |
| A6 | eval 不回退 | `npm run eval:run -- --suite context-recall` + 指向当前分支 endpoint 的 `npm run eval:memory-abilities -- --endpoint ...` |
| A7 | 库体积可解释 | P0c 增量只解释 chunk、两套 FTS、checkpoint 与页碎片；未来向量容量必须按 P0.5 选定的维度、dtype、索引开销实测，不能沿用 384 维的固定估算 |

---

## 6. 与上游方案的关系

本任务是上游 [memory-foundation-rearchitecture-plan.md](./memory-foundation-rearchitecture-plan.md) **§11.4 P0c** 的展开。

- 它**不引入**上游方案的新数据模型（`memory_units` / `unit_views` / `edges`）——那是 P1 的事。本任务只在**现有 schema** 上恢复索引覆盖。
- Tier 0 产物作为 P0.5/P1 的 evidence baseline 复用；旧 chunk 不是 v3 unit 真源。
- Tier 1 历史全量向量等待 P0.5，且不再扩 `messages_vec`。
- Tier 2 固定由 P1 ExtractionWorker 统一处理，避免重复实现旧 schema 抽取逻辑。
