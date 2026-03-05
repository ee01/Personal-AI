# 人脑式记忆与自我思考系统 结合 openclaw

我已经用 **OpenClaw 官方文档** + **代码级 DeepWiki 索引**把 `memory-core`（默认内存插件）的实现机制查清楚，并能和你上面要做的“人脑式记忆系统”逐条对比。

---

## 1) OpenClaw 的 memory-core 插件到底做什么

OpenClaw 的“长期记忆”核心理念是 **文件即记忆**：记忆不是模型参数里的隐式状态，而是写入磁盘的可审计内容。

官方文档一句话概括（原文）：

> “The files are the source of truth; the model only ‘remembers’ what gets written to disk.” ([OpenClaw][1])

对应到插件层面：

* `memory-core` 是 **默认的 memory 插件槽位实现**（`plugins.slots.memory` 默认指向它）；你也可以把 memory 插件关掉：`plugins.slots.memory = "none"`。 ([OpenClaw][1])
* 它提供给 agent 的核心工具是：

  * `memory_search`：对“记忆文件”做检索，返回带**文件路径 + 行号范围**的 snippet；
  * `memory_get`：按路径（可选行范围）读取具体 Markdown。 ([OpenClaw][1])

---

## 2) memory-core 的实现原理（工程视角拆解）

下面按“写入→索引→检索→证据返回→更新”来讲它的工作流。

### 2.1 记忆的“规范存储层”：Markdown 文件分层

OpenClaw 默认把记忆分两层 Markdown：

* `memory/YYYY-MM-DD.md`：**日记式 append-only**（每天一份），会在 session 启动时读“今天+昨天”。 ([OpenClaw][1])
* `MEMORY.md`：可选的“长期、整理后的记忆”，只在主私聊会话里加载（不在群里）。 ([OpenClaw][1])

写入指导也很明确：决策/偏好/耐久事实写 `MEMORY.md`，日常上下文写 daily log；如果用户说“记住这个”，不要留在“RAM”，要写入文件。 ([OpenClaw][1])

### 2.2 “自动写入”机制：pre-compaction memory flush（很关键）

它并不是“看到什么都自动入库”，而是用一个非常工程化的触发点做“强制落盘提醒”：

* 当 session 接近自动压缩（context 快满）时，会触发一个**静默的 agentic turn**，提醒模型把“耐久信息”写入 `memory/YYYY-MM-DD.md`；默认提示模型没东西写就回 `NO_REPLY`，用户看不到。 ([OpenClaw][1])
* 触发条件由 token 阈值计算（`contextWindow - reserveTokensFloor - softThresholdTokens`），并且一个 compaction 周期只触发一次；如果 workspace 只读/不可写则跳过。 ([OpenClaw][1])

> 这点和你要的“在线反思/巩固触发器”非常像：OpenClaw 把它绑定在 **上下文溢出风险**这个天然事件上。

### 2.3 “派生索引层”：SQLite + FTS5 + 向量表（sqlite-vec）

memory-core 的“记忆检索”不是直接扫文件，而是构建一个可重建的派生索引：

* **索引来源**：默认索引 `MEMORY.md` + `memory/**/*.md`（仅 Markdown；忽略 symlink）；还支持 `extraPaths` 把别的目录/文件纳入索引。 ([OpenClaw][1])
* **chunking**：把 Markdown 切成约 **400 tokens** 的 chunk，**80 tokens overlap**，并记录 chunk 对应的行号范围（方便引用）。 ([OpenClaw][1])
* **embedding provider**：OpenAI/Gemini/本地 GGUF 三选一（未配置 provider 时有自动选择顺序：本地→OpenAI→Gemini→Voyage→否则禁用）。 ([OpenClaw][1])
* **存储**：每个 agent 一个 SQLite 索引库（默认在 `~/.openclaw/memory/<agentId>.sqlite`，可配置）；并包含 embedding 缓存避免重复计算。 ([OpenClaw][1])

DeepWiki（代码级摘要）把核心表结构说得很清楚：`chunks`（文本+行号+hash+source）、`chunks_fts`（FTS5）、`chunks_vec`（sqlite-vec 向量表）、`embedding_cache`（LRU 逻辑）。 ([DeepWiki][2])

### 2.4 检索：Hybrid Search（向量 + BM25）+ 加权融合

检索路径是典型“多路召回→融合”：

1. 对 query 做 embedding（远端默认 60s 超时、本地更长）。 ([DeepWiki][3])
2. 并行执行：

   * 向量检索：余弦相似度（sqlite-vec）；
   * 关键词检索：FTS5 / BM25。 ([DeepWiki][3])
3. 候选集扩大：默认取 `candidateMultiplier × maxResults`（默认 4×）。 ([DeepWiki][3])
4. 融合打分（当前默认设计）：

   * `finalScore = vectorScore*vectorWeight + textScore*textWeight`
   * 默认权重：`vectorWeight=0.7, textWeight=0.3`
   * 再按 `minScore`（默认 0.35）过滤、截断 topK（默认 6）。 ([DeepWiki][3])

输出还会做 token 预算控制：每条 snippet 默认截断到约 **700 chars**，并返回 path + line range。 ([OpenClaw][1])

### 2.5 “回忆证据链”的工程实现：路径/行号 + memory_get

* `memory_search` 返回包含 **文件路径 + 行号范围**的信息，支持后续 `memory_get` 精读。 ([OpenClaw][1])
* `memory_get` 会做路径校验：只能读 workspace/extraPaths 内的 `.md`，越界路径会被拒绝。 ([DeepWiki][3])

这套设计对你们要做的“可追溯引用/证据引用率”评测非常友好。

---

## 3) 用一张“实现结构图”总结 memory-core（类 Mermaid）

（我用文字版 Mermaid 描述，便于你直接贴进方案文档）

```mermaid
flowchart LR
  A[Markdown Canonical Store\nMEMORY.md + memory/YYYY-MM-DD.md] --> B[Watcher + Dirty Flag\n(chokidar, debounce)]
  B --> C[Chunker\n~400 tokens, 80 overlap\n+ line ranges]
  C --> D[Embedder\n(OpenAI/Gemini/Local GGUF)\n+ embedding_cache]
  D --> E[SQLite Index\nchunks + FTS5 + sqlite-vec]
  Q[Query] --> F[Query Embedding]
  F --> G1[Vector Search\nchunks_vec]
  F --> G2[BM25 Search\nchunks_fts]
  G1 --> H[Hybrid Merge\n0.7 vec + 0.3 text\ncandidateMultiplier=4]
  G2 --> H
  H --> I[Filter & TopK\nminScore=0.35\nmaxResults=6]
  I --> J[memory_search Result\nsnippet<=700 chars\npath + line range]
  J --> K[memory_get\nread .md slice]
```

（对应实现细节与默认参数来源见官方 docs 与 DeepWiki。([OpenClaw][1])）

---

## 4) 和你上面要做的“人脑式记忆与自我思考系统”相比：异同点

我按你需求里最关键的能力逐条对齐。

### 4.1 相同点（可以直接复用/借鉴的设计点）

1. **“海马索引式”的设计：外部可重建索引 + 线索召回**

   * Markdown 是“皮层长期存储”（可读可审计），SQLite/向量/FTS 是“海马索引”。
   * 这和你要的“线索→整体回想（cue→pattern completion）”非常一致：先 `memory_search` 找线索 chunk，再 `memory_get` 回读上下文。 ([OpenClaw][1])

2. **多路召回（向量 + 关键词）与融合**

   * 你方案里要“向量+关键词+时间窗优先”的多路召回，OpenClaw 已经落地了向量+BM25 这两路，并且有明确权重与阈值参数可调。 ([DeepWiki][3])

3. **在线“反思/巩固”的触发器雏形**

   * pre-compaction 的 memory flush，本质是“在线反思：快要遗忘（压缩）时先写下”。 ([OpenClaw][1])

4. **证据可追溯（文件路径 + 行号）**

   * 这直接支持你要的“证据引用率”“可解释删除/审计”。 ([OpenClaw][1])

### 4.2 不同点（对你目标来说的关键缺口）

1. **“自动写入”范围更窄：不是从网页/消息流自动入库**

   * OpenClaw 明确强调“模型只记得写入磁盘的内容”；写入更多依赖用户提示或 compaction flush，而不是默认“阅读/浏览即入库”。 ([OpenClaw][1])
   * 你要做的 Chrome Extension 场景，核心是“自动从网页/消息提取→入库”，这需要在 OpenClaw 体系上再加一层 ingestion pipeline（解析/脱敏/显著性/写入策略）。

2. **缺少你要的“显著性打分 S”与“回忆即强化”机制（强化/遗忘曲线）**

   * OpenClaw 的排序主要由“相关性（hybrid score）”决定，文档/实现中没有看到“命中次数强化”“半衰期延长”等显式机制。 ([DeepWiki][3])

3. **缺少“真值维护（事件溯源 + 双时间 + TMS 依赖）”的结构化层**

   * memory-core 以 Markdown + chunk 检索为主，**没有**内建“同一事实多次变更→投影出 current truth→可回溯历史”的确定性算法与依赖维护。
   * 更关键的是：OpenClaw 自己在研究文档里也承认现状对“时间约束与冲突解决”较弱。 ([OpenClaw][4])

4. **缺少“做梦/生成式重放”与离线巩固流水线**

   * memory-core 没有“生成式重放采样→梦境推演→规则/技能沉淀”的离线链路。它的离线部分更多是“索引同步/缓存/批量 embedding”。 ([DeepWiki][5])

5. **语义层更偏“文件检索”，缺少 KG/实体图谱多跳扩散**

   * OpenClaw v2 研究里提出了 `bank/entities/*.md`、typed pages、opinion confidence 等“半结构化语义层”设想，但那是研究笔记，不等于 memory-core 已经实现 KG。 ([OpenClaw][4])

### 4.3 一个很重要的“潜在收敛点”：OpenClaw 的 Workspace Memory v2 研究方向

OpenClaw 自己的 Workspace Memory Research（v2）其实已经在往你要的方向走：
它提出把 daily log 继续保持 Markdown（可审计），但增加：

* “Retain / Recall / Reflect”闭环；
* 区分 observed / believed / summarized；
* 产出 `bank/` typed pages（world/experience/opinions/entities）；
* opinion 带 confidence + evidence links；
* 支持 temporal queries 和 conflict resolution（至少作为目标）。 ([OpenClaw][4])

这和你要的：

* “后台持续自我整理（做梦式思考）”（≈ reflect job + offline loop）
* “关键事实变更的当前真值 + 历史回溯”（≈ temporal/conflict）
  是同方向的，只是你要求更工程化、更确定性（需要 bitemporal/TMS）。

---

## 5) 结论：OpenClaw memory-core 能复用什么，不能替代什么

### 可以直接复用（或作为你方案 P0 的“可落地底座”）

* **Markdown canonical store + derived index** 的整体范式（审计友好、可手工修订、可 Git 版本化）。 ([OpenClaw][1])
* **SQLite + FTS5 + sqlite-vec** 这种“本地可部署、成本低”的检索栈（尤其适合你提到的“私有后端服务”或单机/家庭 NAS）。 ([DeepWiki][2])
* **hybrid 检索融合与可调参**（权重、候选倍数、minScore、topK）。 ([DeepWiki][3])
* **证据引用（path+line range）** 的工具接口形态。 ([DeepWiki][3])

### 不能替代（你要做“人脑式记忆系统”必须补的层）

* **显著性 S + 强化/遗忘曲线**（人的“近因/情绪/意外性”权重）；
* **真值维护层（事件溯源 + bitemporal + TMS）**；
* **自动采集与脱敏写入**（Chrome Extension / 消息流 ingestion）；
* **离线巩固/做梦式重放**（生成式 replay + 规则/技能沉淀）；
* **主动提醒/确认队列**（当“事实变更”影响用户任务时）。

---

## 6) 工程落地要点（对你们方案怎么用 OpenClaw 的启发）

1. **把 OpenClaw 的“Markdown+索引”当作你们的“情节库（episodic）”实现参考**

   * 你们可以把“原始事实/事件”落为日志（可审计），把“投影后的当前真值/稳定偏好”落为更小的 core memory（类似 `MEMORY.md`）。 ([OpenClaw][1])

2. **在它的基础上加一层“结构化真值层”**

   * 仍保留 Markdown 作为证据源，但把“项目发布时间”这类字段维护到你们的 bitemporal/event-sourcing 表里；检索时同时召回“证据 chunk”+“current truth 投影结果”。

3. **Chrome Extension 方向：OpenClaw 的 extension 思路可参考，但用途不同**

   * OpenClaw 的 Chrome Extension 是“浏览器控制 relay”（通过 `chrome.debugger` + CDP 中继），不是“记忆采集器”。 ([OpenClaw][6])
   * 你们要的是“采集+摘要+脱敏+入库+通知”，这更像“采集端/通知端”，后端 API 才是核心（与你们原设想一致）。

---

如果你希望我更进一步“对齐到你们的总方案”，我建议你下一步给我两样信息（任选其一也行）：

* 你们最终产品名/组织名（方便我把“复用点”写进你们的主方案叙述中）；
* 你们更偏向的存储形态：**(A) Markdown 为主**（审计+可编辑）还是 **(B) 结构化 DB/KG 为主**（更强真值维护），我可以给出一套“OpenClaw memory-core → 你们目标架构”的迁移/增强路线图（P0/P1/P2）。

[1]: https://docs.openclaw.ai/concepts/memory "Memory - OpenClaw"
[2]: https://deepwiki.com/openclaw/openclaw/7-memory-system "Memory System | openclaw/openclaw | DeepWiki"
[3]: https://deepwiki.com/openclaw/openclaw/7.3-memory-search "Memory Search | openclaw/openclaw | DeepWiki"
[4]: https://docs.openclaw.ai/experiments/research/memory "Workspace Memory Research - OpenClaw"
[5]: https://deepwiki.com/openclaw/openclaw/7.2-memory-indexing "Memory Indexing | openclaw/openclaw | DeepWiki"
[6]: https://docs.openclaw.ai/tools/chrome-extension "Chrome Extension - OpenClaw"
