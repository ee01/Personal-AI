# 检索索引断供回填 / Memory Index Backfill Plan

> 生成时间：2026-09-03 CST
> 状态：待执行（独立任务，可由单独的执行者/模型承接）
> 上游诊断：[memory-foundation-rearchitecture-plan.md §2.12.1](./memory-foundation-rearchitecture-plan.md)（根因）、§2.8（存储实测）、§12.1（P0 清单）
> 目标读者：接手执行这项修复的工程师或模型。本文自带全部必要事实，不需要回读上游文档也能执行。

---

## 0. 一句话

生产库里有 **15,109 条消息，其中约 11,467 条（76%）从未进入任何检索索引**（无 chunk ⇒ 无 FTS ⇒ 无 chunk 向量）。这些消息的**原文 100% 完好地存在 `messages_raw.content` 里**，因此**可以纯靠库内数据离线回填，不需要重新跑 `messageDealing`、不需要回 Glip 重新拉取、不需要重新付浏览器 LLM 的钱**。其中"分块 + 全文索引 + 向量"这条链路**完全不需要 LLM**（本地 MiniLM 嵌入，零 API 成本）；只有"实体图谱 / 画像"的回填需要 LLM。

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

⇒ **结论：断供期无法靠 `metadata.entities` 免费重建实体图谱**（只有 2.8% 有），实体回填必须走 LLM。但**分块/FTS/向量只依赖 `content`，可以零成本全量重建**。

### 1.3 相关 schema 事实

- `chunks`：消息类 chunk 的 `file_path = 'messages/' || messages_raw.id`，`related_entity_id` 也等于该 id，`source_type='glip'`。当前 `chunks` 共 10,938 行，其中 `messages/` 前缀 3,642 行，其余为 `source-memory/`(3048)、`reflection-threads/`(1800)、`calendar/`(928)、`daily/`(892)、`data/`(534)。
- `chunks_fts`：FTS5 external-content 表，**由 `chunks` 上的 AFTER INSERT/UPDATE/DELETE 触发器自动同步**（`migrations/001_initial.sql:54-72`）。⇒ **只要把 chunk 写进去，FTS 自动就有了，不需要单独处理。**
- `chunks_vec`：`vec0(chunk_id INTEGER PRIMARY KEY, embedding float[384])`。
- `messages_vec`：`vec0(message_id TEXT PRIMARY KEY, embedding float[384])`，影子表 `messages_vec_rowids` 列为 `rowid,id,chunk_id,chunk_offset`（`id` 即 message_id）。当前 10,826 行——**比已分块消息还多**，说明整条消息级嵌入曾在更长时间段内工作过。
- 嵌入模型：`EmbeddingClient`，`Xenova/all-MiniLM-L6-v2`，384 维，**本地 ONNX 推理，无 API 费用**。
- 分块参数：消息走 `chunkText(content, 400, 80)`（400 token / 80 overlap，`IngestionPipeline.ts:1445-1488`）。
- 数据库当前 `journal_mode = delete`（**非 WAL**，无 `-wal`/`-shm` 伴生文件）⇒ 写事务与读互斥，批量写会阻塞前台召回。
- 活库 1.3 GB，其中 `rehearsal_activations` 及其索引占 850 MB（64%）——见上游 §10.4b(1)，与本任务independent但会影响 VACUUM 时长。

---

## 2. 前置条件（**不满足就不要开始**）

| # | 前置 | 为什么 | 检查方式 |
|---|---|---|---|
| P1 | **先修 `IngestionPipeline.ts:304` 的 salience/抽取耦合** | 否则回填完成后，新消息仍然不进索引，断供立刻重开，这次回填变成一次性消耗品 | 代码里 `if (!skip \|\| scoreSkippedArtifact)` 已拆开，抽取关闭时 `shouldIndex` 仍可为 true |
| P2 | **确定嵌入模型** | 上游方案建议把 `EMBEDDING_MODEL` 换成 `Xenova/multilingual-e5-small`（同为 384 维，中文语料更合适）。**如果先用 MiniLM 回填 1.1 万条、之后再换模型，这批向量要全部重做。** | 明确决策：本次回填用哪个模型；若决定换，先换再回填 |
| P3 | **一次经校验的完整备份** | 本任务是生产库写操作 | `VACUUM INTO` 产出副本 + `PRAGMA quick_check` 通过 + 关键表行数断言 |
| P4 | 磁盘余量 ≥ 6 GB | 回填新增 chunk/FTS/向量，且后续 VACUUM 需要约 2× 活库空间 | `df -h` |

> ⚠️ **P2 是最容易被忽略、代价最大的一条。** 建议在开工前明确写下结论：本次回填使用 `______` 模型，并在回填脚本里把模型名写进 `chunks` 或旁表的标记字段，便于日后识别哪些向量来自哪个模型。

---

## 3. 回填分层（按成本与风险从低到高，可分别独立执行）

### Tier 0 — 分块 + 全文索引（零 LLM、零 API 成本，**收益最大**）

**做什么**：对所有 `messages_raw` 中缺少对应 chunk 的消息，按 `chunkText(content, 400, 80)` 生成 chunk 并写入 `chunks`；`chunks_fts` 由触发器自动同步。

**为什么收益最大**：被动 Lens 与 Compose Assist 用 `lifecycleMode='passive_surface'/'composer_surface'`，被排除在 `RecallEngine` 的 `rawMessageLexicalSearch` LIKE 兜底之外（`RecallEngine.ts:1065-1084`）。所以对它们而言，**没有 chunk ⇒ 没有 FTS ⇒ 连词法命中都没有**。仅这一层就能把 1.1 万条消息从"完全检索不到"变成"词法可检索"。

**目标行数**：约 11,467 条消息 → 预计 1.5 万~2.5 万条 chunk（多数 Glip 消息 < 400 token，即 1 条消息 1 个 chunk）。

**注意**：
- 必须按 `file_path = 'messages/'||id` 判断是否已存在，**幂等**：`INSERT` 前先 `DELETE FROM chunks WHERE file_path = ?`（与 `MarkdownManager.reindexFile` 同款做法），避免重复跑产生重复 chunk。
- `content_hash` 字段要填，用于后续去重。
- `scope`/`source`/`source_type`/`trust_class` 从 `messages_raw` 同名字段继承，不要留空——它们参与召回过滤。
- 跳过 `content` 为空或纯空白的行。
- 922 行坏时间戳（`timestamp < 946684800`）建议**先修时间戳再回填**（见 Tier 3），否则这些 chunk 的时间通道行为异常。

### Tier 1 — 向量嵌入（零 API 成本，CPU 密集）

**做什么**：为 Tier 0 新产生的 chunk 生成 384 维嵌入写入 `chunks_vec`；可选地为缺失的消息补 `messages_vec`。

**成本**：纯本地 CPU。MiniLM 在普通 x86 上约每秒数十条，2 万条约 10~30 分钟（需实测）。

**注意**：
- **强烈建议顺便处理 `chunks_vec` 的碎片**：当前 235 MB 只装 3,799 行（vec0 分块碎片化，利用率 < 5%）。与其往碎片表里追加，不如**建新表 → 全量写入 → DROP 旧表 → RENAME**，一次解决碎片和回填。
- `messages_vec` 与 `chunks_vec` 对同一文本存两份向量，是上游方案计划要消除的重复（§5.3）。**本次回填建议只补 `chunks_vec`，不再扩大 `messages_vec`**，避免为即将废弃的表做功。
- 嵌入失败的 chunk 要记录并可重试，不能静默丢失（现有代码 `embedChunkAsync` 是 fire-and-forget + warn，回填脚本必须比它严格）。

### Tier 2 — 实体图谱 / 画像（需要 LLM，有真金白银成本）

**做什么**：对断供期消息跑服务端 LLM 抽取，回填 `entities` / `relationships` / `entity_properties` / `user_profile_items` / `opinion_items`。

**成本估算**：约 11,467 条消息 × 1 次 `gpt-4o-mini` 调用；prompt 模板约 700–800 token + 消息全文（**当前 `IngestionPipeline.ts:772` 对 `payload.content` 是裸插值无截断，必须先加上限**）。粗算 1,000 万~2,000 万输入 token 量级。**执行前必须先配日预算与告警。**

**建议策略**（不要无差别全量跑）：
1. **按价值筛选**：优先跑有 `matched_rule`（命中关注规则）、有 `summary`、来自活跃群组/watched project、或 `importance` 较高的消息。
2. **分批 + 可中断 + 记游标**，每批提交后写 checkpoint。
3. **走便宜档模型**，并遵循上游 §6.5 的 tier 路由；夜间跑可用 Batch API 省 50%。
4. 抽取结果同时写回 `metadata_json.entities`（或改 `ContextRecallService` 读 `entities_json`），否则召回锚点仍取不到——见上游 §6.3.4。

**可以不做**：如果只求"能检索到"，Tier 0+1 已经达成。Tier 2 是为了恢复图谱召回（PPR 通道）与画像供给，属于质量提升而非可用性修复。

### Tier 3 — 数据质量修补（零成本，建议在 Tier 0 之前做）

- **922 行坏时间戳**（`timestamp < 946684800`，多为 epoch 0）：按 `metadata_json` 里的原始时间字段或 `created_at` 回填；无法恢复的置为 `created_at` 并标 `metadata_json.timestamp_recovered=true`。
- **1,050 行非法 `metadata_json`**：先统计损坏形态（截断？双重编码？），能修则修，不能修则置为 `{}` 并标记，避免后续所有 `json_extract` 静默失败。

---

## 4. 执行约束（生产库，必须遵守）

1. **只读校验先行**：每个 Tier 开始前先跑一次只读统计，记录基线行数；结束后再跑一次，比对增量是否符合预期。
2. **幂等可重跑**：所有写入按自然键先删后插或 `INSERT OR IGNORE`；脚本中断后重跑不得产生重复数据。
3. **分批 + 游标**：建议每批 200~500 条消息，批间提交并写 checkpoint（可用一张临时表 `backfill_progress(tier, last_message_id, done_count, updated_at)`）。
4. **避开前台高峰**：`journal_mode=delete` 意味着写事务阻塞读。建议在低峰期执行，或每批之间留出间隙。
5. **不要在回填期间做 VACUUM**；全部 Tier 完成后再统一做一次（且最好与上游 §10.4b(1) 的 `rehearsal_activations` 清理合并，一次 VACUUM 回收所有空间）。
6. **不要触碰** `lost_and_found` / `lost_and_found_0` / `lost_and_found_1`（155,133 行 SQLite `.recover` 孤儿数据）——那是独立任务，见上游 §10.4b(2)。
7. **失败不推进游标**，保留原始数据，不做破坏性覆盖。

---

## 5. 验收标准

| # | 判据 | 目标 |
|---|---|---|
| A1 | `SELECT COUNT(*) FROM chunks WHERE file_path LIKE 'messages/%'` | 从 3,642 升至约 1.5 万+ |
| A2 | 按月覆盖率（§1.1 同款查询） | 2026-07/08/09 三个月从 1.8%/0.1%/0% 升至 > 90% |
| A3 | `chunks_fts` 中文检索 | 对断供期某条已知消息的关键词能 `MATCH` 命中（注意：当前 FTS tokenizer 是 `porter unicode61`，**中文分词本身有缺陷**，见上游 §10.3——本任务不负责修分词，但验收时要意识到中文短语可能仍搜不到，应用英文/数字/票号类关键词验证） |
| A4 | `chunks_vec` 行数与 `messages/` chunk 数匹配 | 差值 < 1% |
| A5 | **端到端**：打开一个 2026-08 之后才讨论过的 Jira/群聊页面，被动 Lens 能召回该时段记忆 | 当前必然为空——这是最直接的"修好了没有"判据 |
| A6 | eval 不回退 | `npm run eval:run -- --suite context-recall`、`--suite memory-abilities` 与回填前基线对比 |
| A7 | 库体积可解释 | 增量符合预期（chunk 正文 + FTS 索引约正文 45% + 向量 1.54 KB/条，若用 int8 则 386 B/条） |

---

## 6. 与上游方案的关系

本任务是上游 [memory-foundation-rearchitecture-plan.md](./memory-foundation-rearchitecture-plan.md) **§12.1 第 3 组第 3.5 项**的展开，属于 P0 止血范畴。

- 它**不引入**上游方案的新数据模型（`memory_units` / `unit_views` / `edges`）——那是 P1 的事。本任务只在**现有 schema** 上恢复索引覆盖。
- 但它的产物**会被 P1 迁移复用**：Tier 0/1 产生的 chunk 与向量，在迁到 `memory_units` 时是现成的输入。
- **如果 P1 会在 3 个月内启动**，可以考虑跳过 Tier 1 的 `messages_vec` 部分（该表计划废弃），只做 `chunks_vec`。
- Tier 2 的实体回填与 P1 的 `ExtractionBatchWorker` 目标一致，若 P1 临近，可等 P1 的批处理管线就绪后由它统一处理，避免重复实现抽取逻辑。
