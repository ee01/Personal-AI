# 记忆基础架构重构方案 / Memory Foundation Re-architecture Plan

> 生成时间：2026-09-03 CST
> 范围：memory-service 记忆层（存储 · 摄入 · 巩固 · 检索 · 画像 · 接入分发）的底层重构设计。不以既有实现的沉没成本为前提，但保留已被验证正确的部件。
> 前置研究：`.planning/2026-08-06-recall-llm-routing-audit/`、`.planning/2026-08-12-memory-lens-recall-architecture-research/`、本文 §3 的 12 个开源项目源码/论文深读（Mem0 v3、Graphiti、HippoRAG 2、Letta、MemOS、ReMe/MemoryScope、memobase、Honcho、Hermes、MIRIX、MemoryOS、Generative Agents、MaiBot A_memorix、zenBrain、PowerContext、SillyTavern WI/qvink）、§2 的全库盘点与存储实测
> 相关计划：[memory-recall-ppr-association-plan.md](./memory-recall-ppr-association-plan.md)（已落地，保留）、[memory-sleep-time-compute-plan.md](./memory-sleep-time-compute-plan.md)（并入 §7）、[memory-longmemeval-benchmark-plan.md](./memory-longmemeval-benchmark-plan.md)（作为验收门）、[memory-cascade-deletion-plan.md](./memory-cascade-deletion-plan.md)（并入 §10.5）、[memory-mcp-server-plan.md](./memory-mcp-server-plan.md)（并入 §11）、[agent-task-ledger-plan.md §13.5-13.8](./agent-task-ledger-plan.md)（框架替换决策的前文）、[memory-share-with-openclaw.md](./memory-share-with-openclaw.md)
> 配套示意：[memory-foundation-rearchitecture-demo.html](./memory-foundation-rearchitecture-demo.html)

---

## 0. 一页结论（TL;DR）

**诊断（2026-09-03 线上实测后重排优先级）**：recall "有关联但不是此刻要的"是两个层次叠加，**而且第 0 层比原先判断的五层架构问题更致命、更容易修**：

- **第 0 层（急性、已实测确认）**：`INGEST_LLM_EXTRACTION_ENABLED=false` 把 salience 打分与 LLM 抽取耦合在同一个 `skip` 变量上，导致 `shouldIndex` 恒为 false ⇒ **不产生 chunk ⇒ 连 `chunks_fts` 词法索引都拿不到新行**；而被动 Lens 用 `lifecycleMode:'passive_surface'`，恰好被排除在 `rawMessageLexicalSearch` 兜底之外。⇒ **对 2026-07 之后进来的所有消息，被动 Lens 与 Compose Assist 既无向量、也无 FTS、还没有 LIKE 兜底，返回的是零结果**。线上证据：`entities` 月度新增 2026-07 起归零，画像 `last_seen` 停在 ~2026-07-23。用户感受到的"召回的不是此刻要的"，最近两个月的准确描述其实是"召回的全是 7 月以前的旧记忆"。详见 §2.10.1。
- **第 1 层（慢性、结构性，仍需解决）**：①没有"用户此刻需要什么"的意图层，被动召回拿页面文本当查询；②索引单元是原文 chunk，LLM 摘要多数不在索引里，派生记忆与原始证据同池无权威区分；③排序是十几个手调常数、通道融合没有 RRF、无 reranker、反馈闭环没接通；④英文 embedding 模型 + 对中文失效的 FTS 分词；⑤`messages_raw.importance` 因字段契约 bug 恒为 0.5，使显著性公式里权重最大的一项长期失效（§6.3.5）。

**关于"能不能无限派生"的最终裁决（§7.11）**：把派生记忆拆成三个独立决策后，正反方证据各自归位、并不冲突——**①生成：自由派生、永不硬删，只限产出率（每 ~100 条原始记忆 ≤3 条洞见）；②资格：严格限定谁能进默认候选集（T0 常驻 ≤40 定死、T1 每查询 ≤200、其余降 T2 仅深搜可达）；③注入：候选池:输出比 5:1~40:1**。反方证据攻击的全是"在①硬删"，正方证据攻击的全是"在②不设限"。**闸门设在准入质量上，数量上限只是兜底，且应当用成本/延迟/确定性论证而非质量。**

**修复方向的最终形态（§7.8 + §7.9）**：派生记忆要成为**精华而非冗余**，需要两件事同时做——①**单条够精**（原子化、主题键控、原地更新、六道质量门槛链）；②**总量够少**——但"少"指的是**进入默认检索与常驻上下文的量**，不是库存量：T0 常驻精华 ≤40 条（这个数值得慎重定死）/ T1 每次查询候选 ≤200（**池子本身不设总量硬顶**）/ T2 归档不进默认检索。判据用"证据密度 = 覆盖证据数 ÷ 自身 token"叠加实际命中数据。只做①会得到 500 条各自精致的 insight，那仍然不是精华。目标量级：**每次默认检索面对的派生候选**从现状 934 条散文 chunk 降到 ≤240 条原子结论，同一主题从最多 26 份副本降到 1 份。

**第 1 层里最反直觉的一条（2026-09-04 专项审计推翻原判断）**：`chunks` 表 **99.9% 是派生内容**（反思/做梦/日报散文），`messages/%` 的 chunk 数为 **0**。派生物不是"挤掉"了证据，而是填满了本该属于证据的整个索引；且同一张 Jira 单能裂成 26 个反思线程、单线程重复 1336 轮。**所以正确的解法是重构派生记忆的生产（原子化、主题键控、原地更新、质量门槛链），而不是在检索侧给派生物降权**——降权只会把 99.9% 的索引整体压低。详见 §7.8。

**另有两个与召回无关但更紧急的生产问题**：`rehearsal_activations` 失控写入（195 万行 / 850 MB / 活库 64%，根因已定位到代码，§10.4b(1)）；单用户目录 7.0 GB 中 5.7 GB 是脱管的事故快照残骸（§10.4c）。

**决策**：不换框架（[agent-task-ledger-plan.md](./agent-task-ledger-plan.md) §13.8 与本文 §3.9 论证）；**重构记忆层的"模型、写入、巩固、检索"四个内核，保留 per-user SQLite 真源、PPR 图召回、lifecycleMode、Scene Autopilot、Keystone/Rehearsal 等已验证部件**。

**新架构一句话**：以 **原子记忆单元（Memory Unit）** 取代"原文 chunk"作为检索与生命周期的一等公民；单元带归属、双时态、来源链、多视图索引（正文 / 触发问句 / 关键词）；实体与边统一为一张 **双时态事实边表**；用户画像走 **Honcho 式 deriver + memobase 式槽位**；写入侧一次结构化抽取（便宜模型）+ 睡眠期三重门巩固（便宜为主、聪明兜底）；在线检索 **零 LLM**，走 `RetrievalPlan`（信息需求规划）→ 多视图混合召回 → 加权 RRF → 生命周期/权威加权 → 可选 CPU reranker → 展示门控。

**LLM 用法**：写路径每批消息 1 次结构化调用（cheap 档），灰区去重 1 次（cheap），夜间反思/画像归纳（smart 档、Batch −50%），在线 0 次。模型按 `tier`（local / cheap / standard / smart）路由，每任务有日预算与用量回执。

**存储**：SQLite 继续当真源，但三分（`memory.db` 热库 / `ops.db` 运维库 / 全局 `shared.db`）+ 年份归档库；向量单份 + int8；中文分词修复；GC 与 VACUUM 常态化。实测天花板：float32 384 维 <50 ms 约 25 万向量，int8 约 75 万；超过后以 usearch sidecar 或 sqlite-vec 0.1.10 `rescore` 索引升级，200 万+/用户再考虑 LanceDB。1.4 GB 需先按 §10.1 脚本实测构成。

**画像**：供给链 7 个断点全部补齐，"重复观察 = 加固"而非丢弃，`extracted/reinforced/new/aborted/parse_failed` 五个日指标构成"枯竭探测器"。

**分发**：抄 Mem0 的适配器模式——宿主 hooks 做确定性捕获 → 缓冲 → memory-service 抽取；宿主 LLM 只拿一个只读 `memory_search` 工具 + token 预算的 `context_pack` 注入；OpenClaw 插件 / Claude Code 插件 / Cursor 规则 / Hermes provider 四个适配器包。

**路线**：P0 止血（开关、GC、embedding 换模型、分词）→ P1 记忆单元 + 写入管线 v2 + 画像供给链 → P2 检索 v2（RetrievalPlan / RRF / reranker / 反馈学习）→ P3 存储三分与归档 → P4 适配器分发。每阶段有 eval 门与回滚开关。

---

## 0.5 交给开发前必须知道的六件事（**执行者先读这一节**）

本方案篇幅长，但真正会让实现走偏的只有以下六条。**开工前请逐条确认。**

### (1) 本方案有三处"推翻前文"，只有最新结论有效

文档按调研推进增量书写，早期结论被后续证据推翻但**保留了原文以便追溯**。以下三处**只认后者**：

| 议题 | 早期结论（**已废弃**） | 最终结论 |
|---|---|---|
| 派生记忆怎么治 | §8.3 最初的"检索侧给 derived 降权到 0.6" | **§7.8 生产重构**（原子化/主题键控/原地更新）；降权只是重构完成前的临时护栏 |
| 派生记忆的量 | §7.9 早期读法"T1 库存 ≤200 条" | **§7.10.6b 细化 1 + §7.11**：≤200 是**每次查询候选**，**库存不设硬顶、永不硬删** |
| 表征升级 | §10.3 只当作"中文语言不匹配"问题 | **§8.4b**：语言与强度是两个问题，且**派生重构必须先于表征升级** |

### (2) 三个不可交换的执行顺序

1. **`hit_count` / `last_hit_at` 埋点 → 任何晋升/淘汰机制**。写入期 salience 被证明不预测未来效用（MemSIF），没有命中数据的晋升判据是空中楼阁。
2. **派生重构（§7.8/§7.9/§7.10 修正 A）→ 表征强度升级 / reranker**。在 99.9% 索引是派生散文时升级 embedder 或加 reranker，会**放大** source bias（强检索器偏置更重，r=−0.772）。
3. **`IngestionPipeline.ts:304` 解耦（P0 1.1）→ 开启 `INGEST_LLM_EXTRACTION_ENABLED`**。不解耦就开，等于把索引能力和 LLM 账单绑死。

### (3) 三个数字的口径不能混

| 数字 | 含义 | 不是什么 |
|---|---|---|
| **T0 ≤40 条** | 常驻上下文（always available），**这个值得定死** | 不是库存上限 |
| **每查询候选 ≤200** | 单次检索面对的候选集 | **不是**"库里只能存 200 条" |
| **产出率 ≤3%** | 每约 100 条原始记忆产出 ≤3 条洞见 | 不是总量帽 |

**库存永不硬删**（衰减降低可及性，不删除）。这三个数混淆是早期版本的主要错误。

### (4) 所有阈值都是 MiniLM float32 口径，换模型/量化必须重标定

`0.30`（准入）、`0.80/0.85/0.90/0.92`（去重阶梯）、`0.05`（PPR 段落种子权重）——见 §4.4 C6。改 `EMBEDDING_MODEL` 或上 int8 后必须跑标定作业，并用 `memory_units.embedding_model` 隔离新旧向量（**不同模型的向量永不比较相似度**）。

### (5) 生产环境的三条硬约束

- **不要在 10.32.56.212 上做全卷扫描**（`du -sh` 遍历 7 GB 数据卷）。该机同时跑 25+ 容器，2026-09-04 曾出现 load avg 83、`fseventsd` 128% CPU、memory-service 两次重启。只读查询请用轻量语句（`ls -l` 取文件大小，`dbstat` 要限 `LIMIT`）。
- **第 3 组数据修复作业每项都需仓库所有者逐项授权**（§12.1）。涉及 195 万行删除、5.7 GB 备份清理、`lost_and_found` 回填。
- **数据库当前是 `journal_mode=delete` 而非 WAL**。改 WAL 是需要在测试环境验证的决策（§10.4c），不是顺手改。

### (5b) 仓库所有者已做的四项决策（2026-09-04，**执行者据此行动，无需再问**）

| 议题 | 决策 | 对执行的影响 |
|---|---|---|
| **第 3 组数据修复的授权** | **全部预先授权，前提是先做一次经校验的完整备份** | 7 项数据作业（195 万行清理、5.7 GB 快照、`lost_and_found`、坏时间戳、存量回填、`chunks_vec` 重建、VACUUM）**不需要逐项再确认**；但**每项之前必须有一次 `VACUUM INTO` 副本 + `PRAGMA quick_check` 通过 + 关键表行数断言**，且结果记入 manifest。备份未通过校验则不得继续 |
| **抽取开关灰度** | **全量 25 个用户一起开** | `INGEST_LLM_EXTRACTION_ENABLED` 不需要改成 per-user 开关，用全局 env 即可（§12.1 第 2 组 2.2 简化）。⚠️ **但开启前日预算硬顶与 `usage_events` 告警必须已就位**，且 P0 1.1（解耦）、1.4（输入截断）必须已上线 |
| **P0.5 探针** | **要做，且 P1 必须等探针结果** | P1 的 8 张新表与抽取管线 v2 **在探针结论出来前不动工**。探针内容见 §13.3 S5：现有 chunks 上离线生成触发问句 + 加一路 `V_trig` 通道（feature flag）+ 跑 A/B/C 消融。**若触发问句相对意图模板的增量 < 5%，则否决触发问句设计**，P1 相应缩减 |
| **文档提交** | 只提交本文档、[memory-index-backfill-plan.md](./memory-index-backfill-plan.md)、配套 demo.html | 不触碰工作区其它在途改动 |

### (6) 交付边界

- 本方案**只重构记忆层**，不改 Memory Lens / Compose Assist / Ask 的产品边界与 UI 契约（§1.2）。
- 存量回填是**独立文档**：[memory-index-backfill-plan.md](./memory-index-backfill-plan.md)，可并行交给另一个执行者。
- 每阶段的验收门与回滚开关见 §12.1 / §12；**P0 全部不需要基建变更**（§12.2）。

---

## 1. 问题定义：为什么"recall 出来的东西不是我此刻要的"

用户的主观描述是："提取到的信息不是强关联的，并不能说毫无关联，只能说不是用户期望或此刻关注的事情。"

三轮审计把这个主观感受拆成了**五个可独立验证的根因**，按影响从大到小：

| # | 根因 | 层 | 证据 |
|---|---|---|---|
| R1 | **主管线关键开关关闭**（2026-09-03 线上 `docker exec memory-service env` 实测确认）：`INGEST_LLM_EXTRACTION_ENABLED=false`、`INGEST_EMBEDDING_ENABLED=false` ⇒ 新消息不进图谱/画像、不写向量。**但 `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED=true`**（原假设"被动 Lens 短路"不成立）；线上另有 `RECALL_ROUTE_SAFE_MODE_ENABLED=true`（原方案未提及）把 `/recall` 强制降级为纯 FTS，向量通道整体不参与在线检索——这才是更接近事实的"通道失效"根因。`PROACTIVE_SCHEDULER_ENABLED=true`、`REFLECTION_ENABLED=false`。线上证据链（entities 月度创建数 2026-07 归零、profile `last_seen` 最大值落在 ~2026-07-23）指向**抽取/嵌入开关很可能是 7 月前后被关闭的**，而非"一直默认关" | 配置 | `IngestionPipeline.ts:125-137, 299-323`；`ContextRecallService.ts:370`；`routes/contextRecall.ts:393-409`；`config.ts:291-302, 472`；线上实测见 §2.8/§9 |
| R2 | **没有意图层**：被动召回的 query 是 `title + primaryText` 拼接截断 600 字，找"和页面长得像的记忆"；`QueryIntentParser` / `AnticipationService` 只服务 `/ask`，`/context-recall` 零引用。学界称此为 query-free / proactive IR，共识是"拿情境直接当查询是反模式"，需要 when（该不该提示）与 what（此刻需要什么）两个独立子问题 | 检索 | `ContextRecallService.ts:1438-1480`；ProCIS arXiv:2405.06460 |
| R3 | **检索单元与索引视图错位**：被索引的是原文 400-token chunk；LLM 写出的高质量摘要（`messages_raw.summary`、`metadata.summary`、简报、反思 latest_summary、胶囊蒸馏）大多**不在索引里**；派生记忆（reflection/dream/project summary 的 .md）却和原始证据同池竞争、无权威性区分。结果是"命中靠原文、展示靠摘要、噪声来自派生物" | 索引 | `RecallEngine.ts:945-951`；`MarkdownManager.ts:243-349` |
| R4 | **排序是硬编码加减分**：`rankContextMatches` 十几个手调常数（+0.08/−0.28…），p1/p2/hidden 阈值 0.35/0.55/0.32；通道融合无 RRF（取最高分 + 每多一通道 +0.05）；无 reranker；反馈表 `recall_training_cases` 写后无人读 | 排序 | `ContextRecallService.ts:2605-2762`；`RecallEngine.ts:1813-1840` |
| R5 | **表征与语料语言不匹配**：默认 `Xenova/all-MiniLM-L6-v2` 是英文模型，记忆语料以中文群聊为主；FTS5 用 `porter unicode61`，中文整句被当成 **1 个 token**（本机实测 `MATCH '分片方案'` 命中 0） | 表征 | `config.ts:421`；`001_initial.sql:55-60` |

此外还有三类**不直接影响此刻召回、但决定这套系统能不能长期跑下去**的问题：

- **存储增长**（§10）：线上单用户库 1.4 GB；开发快照显示向量影子表约占 23%、通讯录同步 `rc_directory_users` 占 13%、35% 是碎片空闲页；`messages_vec` 与 `chunks_vec` 对同一文本存两套向量；仍有两处删除路径不清理向量。
- **画像枯竭**（§9，**2026-09-03 线上实测修正**）：`esone.qiu` 线上 `user_profile_items` 实际有 **34,043 行，99.5% 是 `active`**（33,873 active / 170 pending_confirm）——这与本地开发快照（仅 3 行）呈现的"从未积累"景象**完全不同**，§9 原有的"全部卡在 pending_confirm"诊断对这个账号不成立。真实问题是**供给在 ~2026-07-23 前后停止**：`entities` 按月创建数在 2025-10（6862，冷启动批量导入）后维持每月数百到两千的稳定增长，但 **2026-07 起归零**；`user_profile_items.last_seen` 的最大值落在 ~2026-07-23，此后 6 周（到本文写作的 2026-09-03）没有任何新增或更新。这个时间点与线上 `INGEST_LLM_EXTRACTION_ENABLED=false`、`INGEST_EMBEDDING_ENABLED=false` 的现状高度吻合——**最可能的根因是这两个开关在 7 月前后被关闭后未再打开**，而不是"抽取从未起作用"。§9 的供给链修复仍然成立，但优先级第一步应是**先确认这两个开关何时被关、为何被关**，而非直接推进画像 schema 改造。
- **接入分发**（§11）：已有 MCP（6 工具）、OpenClaw 出站客户端、provider bridge，但没有"把 memory-service 接入 X 宿主"的可分发适配器包。

### 1.1 目标

1. **解决 recall 不匹配**：被动/主动召回都经过"信息需求规划 → 多视图混合召回 → 融合重排 → 权威性/生命周期加权 → 展示门控"五段流水线；在线路径无 LLM、被动 p95 < 500 ms。
2. **一套可长大的记忆模型**：以"原子记忆单元 + 双时态实体边 + 证据 episode"为核心，消灭重复概念（2 套向量、7 处摘要、3 张边表、2 套生命周期词汇、2 套变化账本），所有派生物带 lineage / authority / freshness。
3. **LLM 用在该用的地方**：写入侧一次结构化抽取（便宜模型）+ 睡眠期巩固（便宜为主、聪明兜底）+ 在线零 LLM；按任务分层路由模型，token 有预算、有回执。
4. **存储可持续**：热库 / 运维库 / 全局库三分 + 年份归档；向量单份、int8 量化、GC；给出 1.4 GB 的测量脚本与 10× 增长的升级路径。
5. **画像不再枯竭**：Honcho 式持续推导 + memobase 式槽位 schema + 自动晋升 + 枯竭探测器。
6. **可分发接入**：memory-service 作为记忆中台，以 MCP + 宿主适配器包分发。

### 1.2 非目标

- 不替换为 Mem0 / Zep / MemOS 等外部记忆框架（§3.9）。
- 不引入 Neo4j / Postgres 等独立服务；单机、自托管、per-user 隔离是硬约束。
- 不改变 Memory Lens / Compose Assist / Ask 的产品边界与 UI 契约；本文只重构它们下面的记忆层。

---

## 2. 现状诊断（全库盘点摘要）

> 完整盘点见执行记录；这里只保留决定重构方向的事实。行号基于 `develop` 工作区。

### 2.1 数据模型：114 张表，概念重复严重

| 重复概念 | 现状 | 后果 |
|---|---|---|
| 同一文本两套向量 | `messages_vec`（整条消息，PK `message_id TEXT`）+ `chunks_vec`（同内容 400-tok 分块）；`vectorSearch` 两表都查，去重键 `type:id` | 同一消息以 message 与 chunk 两个候选竞争 topK；向量存储翻倍；每次查询扫两张表 |
| 摘要字段 ≥7 处 | `messages_raw.summary`、`conversation_context_frames.summary`、`source_memory_capsules.summary`、`keystone_briefs.summary`、`reflection_threads.latest_summary`、`day_briefs.summary`、`reflection_artifacts.summary` | 除写成 .md 再 reindex 的以外都**不进索引** |
| 三张边表 | `relationships`（实体-实体，`valid_from/valid_to` 从未写入）、`social_edges`（用户-人，仅手工 POST）、`memory_links`（块-块，**写后无人读**） | 图召回只能用 co_occurs / synonym_of，无时态、无事实文本 |
| 两套生命周期词汇 | `consolidation_level` 与 `retrieval_tier`；代码中无处赋值 `core/permanent` | 策略判断分裂 |
| 两套变化账本 + 句级 claims | `entity_properties`（双时态）vs `memory_change_events/chains`（11 个正则别名键，只由胶囊触发）；`memory_claims` 分别链接二者 | "当前值"没有单一读取 API |
| 四层去重 | 摄入 postId/内容 → 夜间 hash + cos>0.92 → MergeDecision cos≥0.86（默认关）→ Heartbeat 仅打日志 | 阈值互不一致 |
| 写后不读的表（11 张） | `chunk_revisions`、`memory_links`、`recall_training_cases`、`recall_patch_runs`、`keystone_brief_candidate_runs`、`keystone_brief_events`、`evidence_watch_links`、`notification_policy_audit`、`relationship_event_index`、`user_namespace_claims`、`ambient_calibration_traces` | 纯增长负担 |

### 2.2 真值维护：有双时态 schema，但摄入路径绕过它

- `entity_properties` 有 `valid_from/valid_to` + `tx_start/tx_end` + `status` + `superseded_by`；`TruthMaintainer.handleConflict` 有权威权重表（official 1.0 … inferred 0.4, dream 0.2）。
- 但 **`IngestionPipeline.processEntities` 直接 `INSERT … status='active'`，不结束旧行**（`:1092-1109`）；TruthMaintainer 的调用方只有 feedback 路由和 ActionExecutor。同一 (entity, key) 可累积多条 active 行。
- 边表 `relationships` 完全无时态、无事实文本。对照 Graphiti 的边（fact 文本 + `valid_at/invalid_at/expired_at` + 来源 episode + LLM 矛盾判定）：本项目在属性级有 schema 没走通，在边级完全缺失。

### 2.3 遗忘/显著性：公式在，但两套强化幅度差 250 倍

- 摄入显著性 `S = 0.35·importance + 0.20·min(freq,5)/5 + 0.15·e^(−0.01h) + 0.10·surprise − 0.05·max(0, redundancy−0.7) + boost`，索引阈值 0.3。
- 衰减 `S(t) = S0·exp(−t/(half_life·24·decay_rate))`，每日全表；**salience_score 被就地覆写为衰减值，S0 随每次运行复合缩小**（`ForgettingEngine.ts:222-232`）。
- 强化：`RecallEngine.reinforce` +0.02；`ForgettingEngine.reinforceMemory` `+5/(1+access_count)`——差 250 倍。
- Probation、lifecycleMode（passive_surface 只允许 core/active）是好设计，保留。

### 2.4 巩固与调度：形态完整，但 LLM 预算失控过、部分阶段无证据

- 日巩固 13 阶段、周 dreaming、15 min 心跳：骨架很好。
- `AnticipationService` 预答 prompt **只有问题本身、不带任何记忆证据**，`evidence_refs_json='[]'`——幻觉源。
- Reflection 默认开曾导致 ~$350/月；现在默认关 → 反思线程不再产生 → Keystone 简报没有输入。
- Phase 4.5 VecCleanup 只清 `chunks_vec`，不清 `messages_vec`。

### 2.5 LLM 使用：一个 provider 一个模型，没有分层路由

- `LLMOptions` 没有 `model` 字段；`scenario` 只映射 temperature；无 `response_format/json_schema`；无 prompt caching；Claude 走 OpenAI 兼容端点。
- 用量记账基建很好（`usage_events(capability, feature, model, tokens, cost, is_background)` + 日 rollup + 价目表）——缺的只是"路由"本身。

### 2.6 摄入：两条抽取路径互不相通

- 路径 A（浏览器）：中文 prompt 抽 `summary / entities / actions / replyAdvice` → 全部塞 `metadata_json`；**服务端不解析 `metadata.entities` 入图**。
- 路径 B（服务端）：英文 prompt 再抽一遍 → 进图、进画像；**默认关**。
- 结论：生产上很可能是"浏览器花了 token 抽实体，图谱和画像却没在积累"。

### 2.7 检索：通道齐全，融合与重排是短板

- 4 通道（vector 双表 / fts + LIKE 兜底 / graph PPR / time），over-fetch ×3，MMR λ=0.7，recency 0.15、salience 0.10。
- 融合 = 取最高分 + 每多一通道 +0.05，**无 RRF**；无 reranker；`ContextRecallService` 再叠十几个手调常数。
- PPR 已实装（damping 0.5，种子特异性 `1/ln(2+mention_count)`），领先多数开源方案，保留。

### 2.8 存储构成（**2026-09-03 线上实测**，`esone.qiu`，取代旧的开发快照推测）

对生产容器 `memory-service`（10.32.56.212，rcadmin，只读 `better-sqlite3` 连接）实测：`esone.qiu` 目录总占用 **7.0 GB**，其中活库 `memory.db` **1.3 GB**（page_size 4096 × page_count 339973，freelist=0，即无碎片空闲页）；其余 **5.7 GB 是六份历史备份/损坏/修复快照**（`.broken-20260820`、`.corrupt-20260825`、`.repair-bak-1787287792619`、`.pre-fts-rebuild-20260829` 等），文件名本身就是过去数月里多次数据库损坏与修复事件的记录。

活库按 `dbstat` 的构成，与旧假设（vector 影子表 20%、通讯录 13%）**完全不同**：

| 对象 | MB | 占比 | 备注 |
|---|---|---|---|
| **`rehearsal_activations` + 其 3 个索引** | **850.5**（580.5 + 94.5 + 94.4 + 81.2） | **64%** | **单表占了活库近三分之二**；见下方根因分析 |
| `chunks_vec_vector_chunks00` | 235.2 | 18% | 仅装 3799 行向量——sqlite-vec vec0 分块（chunk_size=1024）在反复插入/删除后严重碎片化，有效利用率 &lt;5% |
| `messages_raw` | 31.7 | 2.4% | 15031 行，真实记忆内容占比很小 |
| `lost_and_found` 系列（3 张） | ~15 | 1% | SQLite `.recover` 工具生成的孤儿数据，见下方 |
| `messages_vec_vector_chunks00` | 16.6 | 1.3% | 10826 行，与预期匹配（append-only，碎片少） |
| `reflection_runs`/`chunks`/`provider_sync_jobs`/`memory_claims`/`user_profile_items` 等 | ~55 合计 | 4% | |

**⚠️ 头号发现：`rehearsal_activations` 表有 1,953,876 行，是一个失控写入 bug，不是正常功能使用。**

- 根因（已定位到代码）：`RehearsalActivationService.getMatches()`（[RehearsalActivationService.ts:47-81](../../memory-service/src/core/RehearsalActivationService.ts)）在**每次** `/context-recall` 评估里，只要有预演命中展示门槛就调用 `this.rehearsalService.recordMatchedActivation(...)`；而 `RehearsalService.recordMatchedActivation`（[RehearsalService.ts:411-440](../../memory-service/src/core/RehearsalService.ts)）是无条件 `INSERT`（新 `randomUUID()`），**没有任何去重键、防抖或"本次场景已记录过"判断**。
- 实测分布：仅 2 个 `rehearsal_id`（`c7427d51…`、`22bc2cdc…`）就贡献了 528,694 + 528,370 = 105 万行（占全表 54%）；最集中的单日 2026-06-25 一天写入 346,381 行。这与本仓库此前网络审计里发现的"网页分析无 debounce/hash 去重导致重复重跑"是**同一类系统性缺陷**——只是这次发生在 Rehearsal 激活记录上。
- 修复方向（未实施，需评审）：`recordMatchedActivation` 应按 `(rehearsal_id, scene_key)` 做时间窗内去重（如 1 小时内重复命中只更新已有行的 `updated_at`/`score`，不新建行），并给该表加清理策略。**历史 195 万行的清理是对生产数据库的破坏性操作，本文档不代为决定，需要仓库所有者明确授权后再执行**（建议先按 `rehearsal_id` 分布抽样确认这些是否是纯噪声后再删）。

**次号发现：SQLite `.recover` 遗留的 `lost_and_found` / `lost_and_found_0` / `lost_and_found_1` 三张表**（合计 155,133 行，未被任何应用代码读取）实证了这个库确实经历过损坏并用官方 recover 工具抢救过数据，抢救出的孤儿行至今没有被回填进正确的表——即部分历史记忆可能在应用层面"事实上丢失"，即使字节仍躺在库里。回填需要逐行按 schema 重建，本文档同样不代为执行。

**存储引擎配置事实**：`journal_mode = delete`（非 WAL），活库无 `-wal`/`-shm` 伴生文件——大概率是此前损坏事件后主动改回滚动日志模式的稳定性妥协。这会让 §10.3 里基于 WAL checkpoint 的部分建议需要调整（`cache_size`/`mmap_size`/`VACUUM` 仍适用，`wal_checkpoint` 相关不适用）。

**次要数据质量问题**：`messages_raw` 有 922 行 `timestamp < 2000-01-01`（epoch 0 占位值），拖累了全表的时间范围统计。

### 2.9 接入面与评测

- 61 个路由文件；MCP 6 工具（回调自身 HTTP），三级鉴权（`pak.` / `awk.` / 服务 bearer）。OpenClaw 只有出站。
- 25 个 eval suites；`memory-abilities`（LongMemEval 六能力）有工具但 judge 是关键词启发式、未注册 registry；`recall_training_cases` 写后无人读。

---

### 2.10 配置开关的真实语义与依赖链（2026-09-03 线上实测 + 代码核对，**修正前文多处推测**）

| 开关 | 代码默认 | 线上实测 | 精确门控 | 作用域（含"不影响"清单） |
|---|---|---|---|---|
| `INGEST_LLM_EXTRACTION_ENABLED` | 生产 `false`（`isTestRuntime()`） | **`false`** | `IngestionPipeline.ts:268` `skip` ⇒ 决定 `salienceScore` 是否计算 ⇒ `shouldIndex` | **影响面远超"图谱/画像"**，见下方 2.10.1 |
| `INGEST_EMBEDDING_ENABLED`（别名 `MEMORY_INDEX_EMBEDDING_ENABLED`） | 生产 `false` | **`false`** | `:409-425`（`messages_vec`）、`:1494-1495`（`chunks_vec`） | 分块与 FTS 不受它影响；但它是"进程内是否有人加载 embedding 模型"的唯一 ingest 侧来源 |
| `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` | **未设置 = 开启**（`isEnvEnabledByDefault` 为 `!== false`，`ContextRecallService.ts:364`）——**原方案写"默认关"是错的** | **`true`** | 关闭时路由层 `routes/contextRecall.ts:513-526` 直接短路到 `buildKeystoneOnlyFallback` | 仅 4 个被动 surface：`web_passive`/`meeting_passive`/`popup_passive`/`follow_thread`（`ContextRecallService.ts:82-87`）。**不影响 Compose Assist**（`composer_guard`）、Today Pilot（`meeting_prep`）、`/ask`、`/recall` |
| `CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED` | 未设置 = 开启 | 未设置（=开） | `getContextRecallChannels()` `:376-383`：关则被动只用 `['fts']` | 被动 Lens 名义通道恒为 `['vector','fts']`，**从不含 graph/time** |
| `RECALL_ROUTE_SAFE_MODE_ENABLED` | 生产 `true`（`!isTestRuntime()`，`routes/recall.ts:206-212`，**不在 config.ts**） | **`true`** | `recall.ts:189-204` 改写请求体：`channels:['fts']` + `topK ≤ 10` | **作用域远比前文说的窄**：只影响 `POST /recall` 与经它转发的 MCP `memory_search`/`memory_context_brief`。**不影响** `/ask`（自建 ActiveRecallService、`retrievalMode:'deep'`、全通道）、`/context-recall`、Compose Assist、Today Pilot、ContextPack、Outreach、Reflection、GenerativeReplay（全部直接 `new RecallEngine`） |
| `RECALL_SLOW_CHANNELS_ENABLED` | 未设 | 未设 | 优先级高于 safe mode，为 true 时直接绕过 | 语义更清晰的"我接受慢通道" |
| `RECALL_EMBEDDING_COLD_START_ENABLED` | 未设 | 未设 | `RecallEngine.ts:317-325`；`/context-recall` 硬编码 `allowEmbeddingColdStart:false`（`ContextRecallService.ts:756`） | **最容易被漏掉的一环**，见 2.10.2 |
| `PROACTIVE_SCHEDULER_ENABLED` | `false`（严格 `=== 'true'`） | **`true`** | `ProactiveScheduler.ts:115` 之后：Heartbeat（含 Reflection Planner、micro-consolidation、deadline、通知投递）、daily/weekly cron、weekly report、Today Pilot prep | **不门控**（gate 之前启动）：usage rollup、Keystone Composer（15 min）、Outreach、Task drain、Auto backup——各有独立开关且默认开 |
| `REFLECTION_DEFAULT_ENABLED`（旧名 `REFLECTION_ENABLED` 已废弃但仍兼容） | `false` | `REFLECTION_ENABLED=false` | `config.ts:302-314`，命中旧名会 `console.warn` 要求改名 | **是 per-user 默认值，不是全局 kill switch**，见 2.10.3 |

#### 2.10.1 `INGEST_LLM_EXTRACTION_ENABLED=false` 的真实影响面（**这是"召回不匹配"的头号根因**）

`IngestionPipeline.ts:300-323` 把 salience 计算与 LLM 抽取耦合在同一个 `skip` 变量上：

```ts
const skip = payload.skipExtraction === true || !isIngestExtractionEnabled();   // :268
const scoreSkippedArtifact = skip && payload.metadata?.indexExtractedArtifact === true;
let salienceScore: number | undefined;
if (!skip || scoreSkippedArtifact) { salienceScore = 0.5; ...scoreMessage()... }  // :304
const shouldIndex = salienceScore !== undefined && salienceScore >= STORAGE_THRESHOLD;  // :322
```

⇒ 抽取关闭时 `salienceScore` 恒为 `undefined` ⇒ `shouldIndex === false` ⇒ `:430-509` 整块跳过。**`importance`/`sentiment`/`summary` 虽然能从 `metadata.*` 回退（`:290-294`），但救不回 `shouldIndex`。**

静默停止的东西（比前文记录的多两项关键的）：

| 停止的 | 后果 |
|---|---|
| `processEntities`（`:430-440`） | 实体图谱不再增长——实测 `entities` 2026-07 起归零 |
| **`processChunks`（`:442-453`）** | **不产生 chunk** |
| **`chunks_fts` 词法索引** | FTS 是 `chunks` 的触发器（`001_initial.sql:54-72`）——**没有 chunk 就没有 FTS 行** |
| `chunks_vec` | 无 chunk 可嵌入（与 embedding 开关无关，这一层先断了） |
| salience metadata、MergeDecision、profile candidates（`:511-529`）、opinion candidates、entity properties | 画像/观点/属性全线停供——实测 profile `last_seen` 停在 ~2026-07-23 |

**致命的一环**：`RecallEngine.ts:1065-1084` 有一个 `rawMessageLexicalSearch` 兜底（对 `messages_raw` 做 `LIKE` 暴力扫），但它**排除 `passive_surface` 与 `composer_surface`**：

```ts
const allowRawMessageFallback =
  query.lifecycleMode !== 'passive_surface' && query.lifecycleMode !== 'composer_surface';
```

而被动 Lens 恰好设 `lifecycleMode:'passive_surface'`（`ContextRecallService.ts:739-742`）。

⇒ **结论：对 2026-07 之后进来的所有消息，被动 Lens 与 Compose Assist 既没有向量、也没有 FTS、还拿不到 LIKE 兜底 —— 返回的是零结果。** 用户感受到的"召回的不是我此刻要的"，在最近两个月里的准确描述其实是"召回的全是 7 月以前的旧记忆"，因为新记忆根本没有进入任何检索索引。这比原方案 §1 的五层架构性根因（R1–R5）更直接、更致命，且修复成本低得多。

#### 2.10.2 被动 Lens 的向量为什么"双重失效"

1. `EmbeddingClient` **没有任何启动 warmup**（全仓无 preload 调用点）；`isLoaded()` 只有在别处先调过 `getInstance()` 后才为 true。
2. ingest 侧唯一会加载模型的两个点（`IngestionPipeline.ts:411` 与 `SalienceScorer.ts:370`）都在两个开关关闭后不再执行 ⇒ 模型永不加载。
3. `/context-recall` 硬编码 `allowEmbeddingColdStart:false` ⇒ `RecallEngine.ts:662-671` 直接把 vector 通道标 `embedding_unavailable` 并且**永不自愈**。

#### 2.10.3 `REFLECTION_ENABLED` 的命名与语义（用户判断正确，代码已改名）

- 代码里已重命名为 **`REFLECTION_DEFAULT_ENABLED`**；旧名 `REFLECTION_ENABLED` 是带启动告警的废弃别名（`config.ts:305-312`）。**线上 `.env` 用的还是旧名，应改。**
- 它是 **per-user 默认值**：`runtimeConfig.ts:148` `reflectionEnabled: normalizeBoolean(persisted.reflectionEnabled, appConfig.reflectionEnabled)`，`persisted` 来自 `data/users/<id>/config.json`（Options 面板经 `routes/config.ts:518-519` 写入）。所有消费点（`ReflectionPlanner.ts:41-56`、`OnlineReflection.ts:100-102`、`ActionExecutor.ts:1518`、`OutreachEngine.ts:3519`）**一律读 per-user runtime config，无一处直接读全局 config**。
- ⇒ env 设 `false` **不会**关掉已在 Options 里勾选过的用户；设 `true` 会打开所有未显式设置过的用户。
- 命名由来（`config.ts:290-301` 原注释）：旧实现未设置时默认 `true`，导致 2026-08-17/24 一次忘记设变量的部署给所有用户打开了反思，**满负荷烧掉约 $350/月**才被发现。`.env.example:186-199`：每个 opt-in 用户在 15 分钟节奏下约 **$12–50/月**。

#### 2.10.4 恢复向量与词法检索的依赖链（任何一环不改，都等于没开）

**第 0 步（数据层，必须最先做，且需要历史回填）**

1. `INGEST_LLM_EXTRACTION_ENABLED=true` —— **不是可选项**。不开它就没有 chunk、没有 FTS、没有向量。
   ⚠️ **但这一步有真金白银的代价**：每条非重复消息 1 次 `gpt-4o-mini` 调用（`temperature 0.2, maxTokens 1500`，prompt 模板约 700–800 token **+ 未截断的消息全文**——`:772` 是裸插值，粘贴长文/会议纪要会整段进 prompt）。粗算每 1000 条消息 ≈ 0.8–1.5M 输入 token。
   ⚠️ **本方案建议先改代码再开开关**：把 salience 打分与 LLM 抽取解耦（`:304` 的 `if (!skip || scoreSkippedArtifact)` 拆开），使"索引/分块/FTS"这条确定性链路**不依赖 LLM**；同时给 `payload.content` 加长度截断。这样即使抽取按预算限流或降级，词法索引也永远不断——这与 §6 写入管线 v2 的"① 同步零 LLM 落地 + ② 异步批抽取"分层是同一件事，属于 P1 的提前兑现。
2. `INGEST_EMBEDDING_ENABLED=true`。
3. **历史回填**：1、2 只对新消息生效。2026-07 至今的存量消息既无 chunk、无 FTS、也无向量，需要一次性重分块 + 重嵌作业（夜间分批、可中断、记游标）。

**第 1 步（运行时模型加载）**

4. `RECALL_EMBEDDING_COLD_START_ENABLED=true`，或给进程加显式 warmup。否则被动 Lens 的向量通道会因 `!isLoaded()` 永久 skip。

**第 2 步（按需恢复各检索面，彼此独立）**

5. `/recall` 与 MCP：**不要简单地把 `RECALL_ROUTE_SAFE_MODE_ENABLED` 设成 false**，改为按 `retrievalMode` 分档——见下方 2.10.5。
6. 被动 Lens：`CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` 与 `CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED` **都不需要动**（已是开启态）——它的向量失效根因全在第 0/1 步。
7. `/ask`、Compose Assist、Today Pilot、Outreach、Reflection、ContextPack、ProviderContext：**无需任何开关**，缺的只是第 0/1 步的数据与模型。

**不在这条链上的**：`PROACTIVE_SCHEDULER_ENABLED`（与检索无关）、`REFLECTION_DEFAULT_ENABLED`（与检索无关且是 per-user 默认）。

#### 2.10.5 `/recall` 的 retrievalMode 分档设计（取代"关掉 safe mode"）

`RECALL_ROUTE_SAFE_MODE_ENABLED` **不是 bug，是一个有意的延迟取舍**：`.env.example:150-151` 写明 "Set true only when full vector/time/graph recall latency is acceptable for the API process"。它保护的是 API 进程——向量通道要同步加载 MiniLM（`withRecallTimeout` 2.5 s 预算），graph/time 通道要额外扫表。但它现在的实现是**一刀切**：无视调用方声明的 `retrievalMode`，一律改写成 `channels:['fts']` + `topK ≤ 10`。

改成让**调用方声明的 `retrievalMode` 决定通道**，safe mode 退化为"上限约束"而非"强制覆盖"：

| retrievalMode | channels | topK 上限 | 目标延迟 | 典型调用方 |
|---|---|---|---|---|
| `fast` | `['fts']` | 10 | p95 < 120 ms | 会议弹幕、高频 agent 工具轮询 |
| `balanced`（**新默认**） | `['vector','fts']` | 30 | p95 < 400 ms | MCP `memory_search`、普通 API 调用 |
| `deep` | `['vector','fts','graph','time']` | 50 | p95 < 2.5 s | `/ask`、Memory Exploring 搜索、用户主动检索 |

**这不做成运维开关，而是代码里的调用方参数。** 每个调用方的行为类型已经决定了它该用哪一档，没有必要再让部署去配一遍——多一个 env 就多一处漂移源：

```ts
// routes/recall.ts —— 档位表内联在代码里，不读 env
const RETRIEVAL_TIERS = {
  fast:     { channels: ['fts'],                          topK: 10 },
  balanced: { channels: ['vector', 'fts'],                topK: 30 },
  deep:     { channels: ['vector', 'fts', 'graph', 'time'], topK: 50 },
} as const;
const DEFAULT_TIER = 'balanced';   // 调用方未声明时
```

调用方固定映射（同样写死在各自代码里）：`/ask` → `deep`；Memory Exploring 搜索 → `deep`；MCP `memory_search` → `balanced`；会议弹幕/高频轮询 → `fast`；被动 Lens 不走这条路（它有自己的 `ContextRecallService`，通道恒为 `['vector','fts']`）。

`RECALL_ROUTE_SAFE_MODE_ENABLED` 与 `RECALL_SLOW_CHANNELS_ENABLED` **两个 env 一并删除**——前者的保护意图由"未声明即 balanced"覆盖，后者的应急意图由"调用方显式传 fast"覆盖。`runtimePolicy` 回执改为如实回报实际生效的档位与通道（现在它只是个不参与逻辑的标签，`ActiveRecallService.ts:195`）。

**关于"默认能不能直接给 deep"**：检索本身**确实不耗 token**（`/recall` 只有显式 `synthesis.mode=summary` 才调 LLM），成本顾虑不成立。deep 的代价是**延迟与 CPU**：graph 要跑 PPR（建邻接表 + 幂迭代）、time 要扫 `messages_raw`、topK 放到 50 让下游 MMR/rerank 计算量线性上升。取 `balanced` 作默认的唯一理由是：`/recall` 同时是 MCP 工具面的后端，外部 agent 可能高频轮询它，而它们往往不会显式声明档位。真正需要 deep 的调用方都是我们自己的代码，显式传即可。

#### 2.10.6 配置默认值的单一真源（server runtime config 优先，扩展 .env 只作兜底）

**现状问题**：扩展的 `.env` 里存在一批被注释为"Memory Service 默认值"的键（`OPENCLAW_*` 标注"Memory Service 新用户默认执行器"、`OUTREACH_*` 标注"主动询问（Memory Service 默认值）"）——同一个默认值在**服务端 config 与扩展 .env 两处维护**，必然漂移。

**好消息：想要的机制已经存在**（`src/optionsRuntimeConfig.ts`，当前仍是未提交的新文件）：

```ts
// applyRuntimeConfigToEnvConfig：服务端值优先，本地仅作兜底
SELF_REFLECTION_ENABLED:
  serverConfig.reflectionEnabled !== undefined
    ? Boolean(serverConfig.reflectionEnabled)   // 服务端为准
    : localConfig.SELF_REFLECTION_ENABLED,      // 本地兜底
```

Options 打开时经 `getRuntimeConfigFromBackend()`（`options.tsx:2544`）拉 `GET /config`，再 `applyRuntimeConfigToEnvConfig()` 覆盖本地。`/config` 目前已暴露约 30 个 per-user 字段（`reflectionEnabled`、`dreamDigest*`、`decisionCenter*`、`weeklyReport*`、`openClaw*`、`outreach*`…），存 `data/users/<id>/config.json`。

**因此本方案确立三层契约**：

| 层 | 位置 | 角色 |
|---|---|---|
| 部署默认 | memory-service `.env` | 运维级 kill switch 与新用户默认值的**唯一真源** |
| 用户覆盖 | `data/users/<id>/config.json`，经 `GET/PUT /config` | 用户在 Options 里的选择 |
| 扩展本地 | 扩展 `.env` / `chrome.storage.envConfig` | **只保留"如何连接服务端"与纯前端行为**（baseUrl、api key、超时、分析间隔、LLM provider）。**不再保存任何服务端功能的默认值** |

**待办**：
1. 把扩展 `.env` 里带"Memory Service 默认值"注释的键（`OPENCLAW_ENABLED/BASE_URL/API_KEY/EXECUTOR_*`、`OUTREACH_*`）从"默认值来源"降级为"仅在服务端不可达时的兜底显示值"，并在 Options UI 上标注来源。
2. `applyRuntimeConfigToEnvConfig` 已覆盖的键补齐单测（`src/__tests__/optionsRuntimeConfig.test.ts` 已有雏形）。

#### 2.10.7 Memory Lens 开关的三处重复（**最典型的重复维护样本，需收敛**）

同一件事（"要不要做被动情境召回"）现在有**三个独立控制点**，且**门控范围完全相同**（`web_passive` / `meeting_passive` / `popup_passive` / `follow_thread` 四个 surface）：

| # | 控制点 | 位置 | 默认 | 作用 |
|---|---|---|---|---|
| 1 | **`CONTEXT_LENS_ENABLED`** —— Options 里的"启用 Memory Lens / 情境召回"总开关 | 扩展 `chrome.storage.envConfig`；构建期默认来自 `process.env.CONTEXT_LENS_ENABLED`（`utils.ts:685`，`.env.example` 里没有此键） | 开 | **客户端前置门**：4 个调用点（`background.ts:2691`、`WebIntelligenceAnalyzer.ts:909`、`FollowThreadHandler.ts:160`、`meeting-shell/background.ts:3585`）在发请求前就短路，返回空结果 |
| 2 | `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` | memory-service `.env` | 开 | **服务端运维 kill switch**：收到请求后短路到 keystone-only fallback |
| 3 | 站点控制（静默/屏蔽/白名单） | 扩展本地 5 个 storage key（`contextRecallGuards.ts:3-9`） | 无规则 | **按站点**决定要不要发请求 |

三者语义分层其实是合理的（用户总开关 / 运维 kill switch / 按站点例外），实现也都正确（`selected_text` 主动划词在 1、3 下都放行，与产品语义一致）。**真正的问题只有一个：#1 的默认值来自扩展构建期 env，而 #2 的默认值来自服务端 env，同一个"新用户默认开不开"被维护在两处，且 #1 只存在 Chrome 本地——换一台机器/换一个浏览器配置就丢失，不跟随用户。**

**收敛方案**：
1. 在 `/config` 新增 per-user 字段 `contextLensEnabled`（与 `reflectionEnabled` 同级），服务端 `config.json` 成为该偏好的**唯一真源**，跨设备同步。
2. Options 通过既有 `getRuntimeConfigFromBackend()` + `applyRuntimeConfigToEnvConfig()` 机制 hydrate 它——**机制现成，只需加一个字段映射**（`optionsRuntimeConfig.ts`）。
3. **客户端前置门（#1 的 4 个调用点）保留**——它是有价值的优化（省掉一次无用网络往返），只是把判断依据从"本地独立配置"换成"从服务端同步下来的值"。
4. 扩展构建期的 `process.env.CONTEXT_LENS_ENABLED` **删除**，不再作为默认值来源。
5. `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` 保留为部署级 kill switch（运维可一键停掉全部用户的被动召回），语义与用户偏好正交，不冲突。

这条同样适用于扩展 `.env` 里其它标注"Memory Service 默认值"的键（`OPENCLAW_*`、`OUTREACH_*`）。

## 3. 业内精华提取：取什么、弃什么

> 12 个项目全部按源码/论文实读（细节见执行记录）。表中"取"= 进入本方案；"弃"= 明确不做。

### 3.1 Mem0（v3，63.7k★）

| 取 | 弃 |
|---|---|
| **单次 LLM 的 ADD-only 抽取 + 上下文窗口**（最近 10 条消息 + top-10 已有记忆入 prompt，UUID→序号防幻觉）；抽取 prompt 的质量规则：自包含、去代词、以观察日期锚定相对时间、专有名词/数字不概化、无回声抽取、"宁多勿少交给去重" | ADD-only 但 OSS 没有 supersede/decay/`latest_only`（矛盾并存，#4956/#5867 open） |
| **多信号加法打分 + 自适应归一化 + `explain=true`**（语义门控 → semantic + BM25(sigmoid) + entity_boost/max_possible；实体加权带枢纽惩罚 `1/(1+0.001(n−1)²)`） | 候选只来自语义 top-k，BM25/实体不能"救回"（#5742） |
| **用第二个向量集合当图**（实体去重 = 规范化精确 ∪ 0.95 语义；`linked_memory_ids` 倒排）——他们已用这条路替掉 Neo4j（v3 删 4000 行图库代码） | spaCy 写死 `en_core_web_sm`，中文 BM25/实体加权静默失效；v3 prompt 无保留输入语言指令 |
| **Scope 优先契约**（读写必带 user/agent/run id，metadata 不能夹带 identity） | 静默失败面广（embedding 失败丢记忆 #5245；JSON 失败返回空） |
| **可分发适配器模式**（§11 详述）：宿主 hooks 做确定性重活、只给 LLM 一个只读 `search_memories`、`additionalContext` 限字符注入、`PreToolUse updatedInput` 强制补 scope、fail-open + 脱离进程 flush worker + 本地证据库 | 共享编辑器插件仍在"每 3 条消息催 LLM 存记忆"，与 Claude Code 插件 0.3 的"只读工具 + 后台抽取"两套路线并存 |
| Platform 概念：supersede/merge 非破坏链接、写入时抽时间元数据、decay 为 0.3–1.5× 软乘子 | OSS 与 Platform 差距持续扩大；benchmark 争议 |

### 3.2 Zep / Graphiti（30.1k★，arXiv:2501.13956）

| 取 | 弃 |
|---|---|
| **边即事实**：`EntityEdge{fact, fact_embedding, valid_at, invalid_at, created_at, expired_at, reference_time, episodes[]}`，四时间戳分两条时间线（世界何时为真 / 系统何时知道）；矛盾 = 旧边 `invalid_at/expired_at` 置值，不删除 | Neo4j/FalkorDB 依赖；多租户在商业版 |
| **失效算法全是纯代码**（`resolve_edge_contradictions`）：LLM 只判"重复 or 矛盾"；区间不重叠不动；只关掉 `valid_at` 更早的一方；新事实也可能被更晚的旧事实判旧；`expired_at` 只写一次。**前提：双方都有 `valid_at`**——所以 prompt 强制"现在时事实 → `valid_at` = episode 时间" | 若抽取不落日期，失效机制静默失效（对话事实多数无日期）——本方案 §6.2 规则 2 直接吸收 |
| **抽取受上下文条件化**：`add_episode` 带前 10 个 episode（按事件时间取，支持回填）；"Exclude entities mentioned only in PREVIOUS MESSAGES"；main 分支已有 **combined 抽取**（实体+边一次 LLM）+ **批量日期抽取**（一次小模型） | separate 路径每条边一次小模型 resolve、每条新边一次日期抽取，调用数随边数线性涨 |
| **实体两阶段去重**：精确归一名 → 熵门（名长≥6、≥2 token）→ 3-gram MinHash/LSH + Jaccard≥0.9 → 才交 LLM（候选来自 cosine≥0.6 top-15）；"NEVER mark related-but-distinct as duplicates" | |
| **检索 recipe**：cosine + BM25 + 图 BFS 三路候选（每路 2×limit）→ RRF / MMR / node_distance / episode_mentions / cross_encoder 可组合 reranker，查询期零 LLM；`SearchFilters` 支持**时间点过滤**（`valid_at ≤ T AND (invalid_at IS NULL OR invalid_at > T)`），输出给 LLM 的 fact 带 `valid_at/invalid_at('Present')` | `node_distance_reranker` 实际只查 1 跳；community 的两两 map-reduce 摘要成本高且漂移 |
| **Saga 双水位线增量摘要**：`last_summarized_at`（墙钟，作过滤，回填不漏）+ `last_summarized_episode_valid_at`（事件时间，作语义）；"无新持久事实则返回原摘要" | |

### 3.3 HippoRAG 2（arXiv:2502.14802）

取：短语节点 + **段落节点**双节点图（所有段落都作 seed，权重 `0.05 × 归一化 DPR 分`——消融显示去掉段落节点 recall@5 从 87.1 掉到 81.0）、query→**fact**（三元组）链接而非 query→entity、同义边（embedding ≥0.8）、种子权重 `Σsim / df` 抑制高频实体、PPR damping 0.5、无关系命中退化为纯 DPR。**recognition memory 的 LLM 过滤只贡献 +0.7 recall@5，且 18% 查询过滤为空**——因此本方案在线路径去掉它，零 LLM 版 PPR 几乎无损。本项目 PPR（damping 0.5）已实装，补"单元节点参与 PPR 作 seed"与"query→edge.fact 匹配作种子"两点即可。弃：OpenIE 全量三元组抽取的离线成本（本方案由抽取管线顺带产出边）；在线 LLM 过滤。

### 3.4 Letta / MemGPT（sleep-time arXiv:2504.13171）

取：**memory blocks**（`label / description / value / limit / read_only`，可共享）作为"常驻上下文"的形态——对应本方案的 peer card 与 context_pack；**读写分离**：主 agent 没有任何记忆编辑工具，编辑全在睡眠 agent（`memory_replace/insert/rethink/finish_edits`）；**睡眠期提示纪律**——"不写 today/recently，写具体日期"、"无有意义更新直接 finish"、"≤10 次 rethink"、每次只喂 `last_processed_message_id` 之后的增量；睡眠 agent 可配更强模型，测试时 token 需求 ~5×↓、多查询摊销 2.5×（问题少时反而不划算——预算要按消费率回流）；LoCoMo 74% 的数据布局（按 session 切文件、时间戳进首行、夜间生成一行 Topics 索引）。弃：Letta 已把 blocks 标为 legacy 转 MemFS，主仓转产品，不作为可嵌入层；74% 的真正来源是**在线多轮工具搜索 + LLM 改写查询**，与零 LLM 在线路径不兼容，只能借"离线预生成 Topics/别名/查询扩展"来补单次检索的召回；`memory_rethink` 整块替换是 last-writer-wins，多写者会丢更新。

### 3.5 MemOS（10.9k★，arXiv:2507.03724）

| 取 | 弃 |
|---|---|
| **记忆项自带 `status/version/history[update_type]/sources`**：冲突处理 = 归档 + `MERGED_TO` 边，可回溯 | 四路召回"并集 + cosine rerank"无融合打分；BM25 只索引 key+tags |
| **fast/fine 两阶段写入**：先零 LLM 落 raw 节点保证"永不丢"，异步小模型精炼，通用模型做过滤/合并 | reorganizer 每 100 s 不看是否有变化就跑；五个模型槽配置面过大 |
| 意图门控 + 定时兜底的检索触发；`k_per_evidence` 按缺失证据分配预算 | Neo4j/PolarDB 依赖 |
| **本地插件（TS+SQLite）的配方**：FTS5 trigram + CJK bigram LIKE 兜底、每通道 RRF(k=60) → MMR λ0.7 → 相对阈值 0.4·top → 优先级 `max(V,0)·0.5^(Δt/30d)`，LLM 过滤失败 fail-closed 到 `0.7·topScore` | Dream 默认关闭 |

### 3.6 ReMe / MemoryScope（3.3k★，ACL 2026）

取：**extract 作为"值不值得记"的单一门，integrate 才做贵的逐节点合并**；动作词表 `CREATE / CORROBORATE / REFINE / CORRECT`——"重复看到"是加固信号；mtime/catalog 差分 + 失败不 checkpoint + 全局锁的幂等夜间循环；MemoryScope 的 `memorized` 标志 + 后台线程轮询（前台零 LLM）、`type_ratio`（insight ×2.0 压过 raw）。弃：文件作真源无版本；每 turn 一次 30 轮 agent 调用。

### 3.7 memobase（2.9k★）

取：**槽位 schema**（topic/sub_topic + `description` + `update_description`）、**一次调用合并所有 slot 的 APPEND/UPDATE/ABORT 协议**、`update_hits` 计数、`profile_delta` 把画像变更绑定到事件、两级容量控制（15 子主题 → organize；128 token → re-summary）、`entry_chat_summary` 先把对话压成带时间戳日志再抽取、读路径零 LLM + `profile_event_ratio` 预算切分。弃：**idle flush 在 OSS 里根本没实现**（短会话永远攒不满 1024 token——一种枯竭路径）；UPDATE 直接覆盖无历史；已停更 7 个月。

### 3.8 Honcho（Plastic Labs）+ Hermes

取：**三段式模型分层**——写入端只做"explicit 原子事实"的单次结构化调用（小模型），贵的推理推到空闲期 Dream（deduction / induction / card refresh）和查询时 Dialectic；`times_derived` 让重复观察成为加固；`source_ids/premises` 保留推理链，contradiction 是一等层级；**Dream 三重门**（≥50 新结论 & ≥8h & 空闲 60 min，新消息即取消）+ per-representation 单飞；peer card ≤40 条、"六个月稳定"规则；Hermes 侧节拍（context 每轮、dialectic 每两轮、首轮硬超时、陈旧结果复用）与 Provider 钩子面（prefetch / sync_turn / on_session_end / on_memory_write / on_pre_compress）；Hermes 的"预算逼迫合并（IF FULL → ONE batch）"与"换便宜模型就喂摘要补偿缓存失效"。弃：Dialectic 高档位极贵；Postgres + 独立 worker 运维面。

### 3.9 类脑/陪伴项目的算法层（MIRIX / MemoryOS / Generative Agents / MaiBot A_memorix / zenBrain / PowerContext / SillyTavern）

| 算法 | 来源 | 取用形态 |
|---|---|---|
| 三项加权检索 `recency × importance × relevance` + Σimportance≥150 触发反思（3 焦点问题 → 各检索 top-30 → 5 条 insight 带 evidence ids，30 天过期） | Generative Agents（UIST'23，被大量复现） | §8.4 / §7.5 |
| 半衰期遗忘 `R = 2^(−Δh/half_life)` + 有界强化 `r += α(1−r)` + **1 h 冷却** + **滞回阈值**（0.10 冻结 / 0.15 复活）+ 惰性求值 | MaiBot A_memorix（三家独立收敛到同形状：PowerMem、zenBrain 亦然） | §7.2 |
| FSRS-lite 强化（低 R 时复习收益更大）、词典法情绪显著性（在线零 LLM）、回放优先级 | zenBrain（22★，只抄公式不信 benchmark） | §7.2 / §6.4 |
| heat = N_visit + L_interaction + e^(−Δh/24) ≥ 5 → 触发画像更新与晋升 | MemoryOS（EMNLP'25） | §7.3 |
| 六类记忆类型学、**主动检索**（先抽"当前话题 + 时间短语"再检索）、Auto-Dream"宁合并不删除、冲突写进 details" | MIRIX | §5.1 / §8.2 |
| 加权 RRF(k=60) + 准入门槛（cos≥0.3；FTS distinct 词数）+ 动态阈值（percentile 75 / std×1.5 / min_results 4） | PowerContext / A_memorix | §8.3 |
| **确定性触发条目**（关键词/正则 + scanDepth + probability + sticky/cooldown + 预算 ≤25% ctx）；**长期记忆由人标、短期规则轮换、LLM 只压一句** | SillyTavern World Info / qvink | §5.6 / §8.5 |
| L0 原始 → L1 自然语言记忆（聚类 → 兴趣域 → 传记）→ L2 参数 | Second-Me（只取分层） | §5 |

**明确弃用**：PowerMem 的拍脑袋阈值衰减（原团队在 PowerContext 重写时整体放弃）；MaiBot 旧海马体的随机采样遗忘；MIRIX 的"完全无数值衰减、靠 LLM 整理"；zenBrain 的 benchmark 声明；文件/wiki 派（OpenClaw、openwiki、llm-wiki）的"MD 为真源"。

### 3.10 为什么不整层替换（重申，含新证据）

前文 [agent-task-ledger-plan.md §13.8](./agent-task-ledger-plan.md) 已给出三条理由（定位重叠 95%、数据主权、迁移无收益）。本轮深读追加三条：

1. **没有任何框架解决"被动场景召回的意图层"**——Mem0/Zep/MemOS 都是"对话记忆抽取 + 相似度检索"范式，MIRIX active retrieval 是研究级产品。换框架后 R2 原样复现。
2. **本项目的组合无人完整覆盖**：per-user SQLite 隔离 + 混合检索 + PPR + 双时态 + 夜间巩固 + 反馈闭环。最像的 MemOS 才一年、需 Neo4j。
3. **赛道地基仍在晃**：12 个月内 Letta 转产品、MemoryScope 改名转向、Second-Me 弃更、memobase 停更、MemU 定位漂移、Mem0 推翻自家论文核心算法、OpenMemory sunset。押注单一框架的存活与跟随成本不可控。

---

## 4. 目标架构总览

### 4.1 三个平面、六层数据

```
                    ┌─────────────────────── 读平面（在线，零 LLM，p95<500ms）───────────────────────┐
  Surfaces/Hosts →  │ InformationNeedPlanner → RetrievalPlan → 多视图混合召回 → 加权RRF → 生命周期/权威加权 │
  Lens/Ask/Compose  │ → (可选 CPU reranker) → 展示门控(Autopilot) → context_pack(token 预算) → 回执      │
  MCP/OpenClaw/CC   └──────────────────────────────────────────────────────────────────────────────────┘
                                   ▲ 读                                  ▲ 读
 ┌──────────────────────────────── 数据层（per-user SQLite 真源）────────────────────────────────────┐
 │ L5 Lifecycle & Feedback   lifecycle(S,D,R,sal,heat,tier) · feedback_events · outcome_events · ranker │
 │ L4 Derived Views          reflections · dreams · keystone/anticipation/day briefs（同时投影为 unit）│
 │ L3 User Model             profile_slots(+history) · peer_card · writing_style · affinity · opinions │
 │ L2 Entities & Edges       entities(+aliases) · edges{fact, valid_at, invalid_at, expired_at}        │
 │                           entity_properties（唯一真值 API：TruthMaintainer）                        │
 │ L1 Memory Units ★         memory_units（原子、归属、双时态、来源链）· unit_views(trigger_q/keywords) │
 │                           units_fts(中文分词) · units_vec(单份, int8, partition)                    │
 │ L0 Evidence               episodes(messages_raw) · source_memory 内容 · calendar · claims 归属       │
 └────────────────────────────────────────────────────────────────────────────────────────────────────┘
        ▲ 写（同步，零 LLM）                       ▲ 写（异步批，cheap LLM）          ▲ 写（睡眠期，cheap→smart）
 ┌──────────────── 写平面 ────────────────┐  ┌──────── 抽取批处理 ────────┐  ┌──────────── 睡眠平面 ────────────┐
 │ ingest: episode 落地 + claim 归属      │  │ 三触发门 → 单飞锁 → 1 次     │  │ 三重门 → 生命周期算术 → 去重合并  │
 │ + ingest_queue 入队（永不阻塞）        │  │ 结构化抽取 → 零LLM去重/加固   │  │ → deriver 画像 → 触发问句生成      │
 │ 浏览器侧预分析降级为 hint              │  │ → 矛盾 supersede → 索引       │  │ → GA 反思 → dreaming → GC → 回执   │
 └────────────────────────────────────────┘  └──────────────────────────────┘  └────────────────────────────────────┘
 ┌──── Ops（独立库）────┐  ┌──── Shared（全局库）────┐  ┌──── Archive（年份库）────┐
 │ workers·notifications│  │ rc_directory·pricing    │  │ episodes > 18 个月        │
 │ agent_tasks·runs·log │  │ usage analytics(已有)   │  │ ATTACH 仅 historical 模式 │
 └──────────────────────┘  └─────────────────────────┘  └───────────────────────────┘
```

### 4.2 十条设计原则（每条对应一个业内验证）

| # | 原则 | 出处 |
|---|---|---|
| P1 | **真源 = SQLite 的 episodes + units；Markdown 只是投影**（可读、可导出给 OpenClaw、可重建，不被索引） | 本项目既有结论 + WiCER 对 LLM Wiki 的实证（盲编译丢事实） |
| P2 | **记忆单元是一等公民，原文 chunk 是证据**——检索、生命周期、反馈都作用在 unit 上，chunk 只用于引用与精确查证 | Mem0 / Honcho / MemOS 的记忆项；GA 的 memory stream |
| P3 | **一切派生物带 lineage / authority / freshness**，检索按权威加权，派生物默认压过原始证据是 bug | ReMe `## Sources`、Honcho `source_ids/premises`、MemoryScope `type_ratio` |
| P4 | **在线零 LLM；LLM 只在写入批与睡眠期，且按 tier 路由** | Letta sleep-time、memobase、MemoryScope、本项目 ContextRecall 边界 |
| P5 | **重复 = 加固，不是噪音**（`times_derived++`、`last_confirmed_at`） | Honcho、memobase `update_hits`、ReMe CORROBORATE |
| P6 | **更新 = 归档 + 指针，不是覆盖**（`superseded_by`、`valid_to/expired_at`、history 表） | Graphiti 边失效、MemOS `history[update_type]` |
| P7 | **写路径 fail-safe（raw 永不丢，解析失败保底落地）；读路径 fail-open（任何环节故障退回上一档结果）** | MemOS fast 模式、Mem0 插件 fail-open |
| P8 | **增量游标 + 单飞锁 + 三重门触发**，失败不推进游标 | Honcho `work_unit_key`、ReMe catalog、MemoryScope `memorized` |
| P9 | **处处有预算**：token（每任务/日）、容量（slot 15 子主题/128 token、card 40 条、**派生 insight 常驻 T0 ≤40 / 每查询候选 ≤200；库存不设硬顶，见 §7.9 与 §7.10.6b**）、上下文（context_pack ≤7% 窗口） | memobase、Hermes、Mem0、MemOS |
| P10 | **供给健康、召回质量、存储构成是一等指标**，连续 N 天为零即报警 | 五家皆无内建，本项目补上 |

### 4.3 与现有部件的关系

| 保留（原样或小改） | 重构 | 淘汰 |
|---|---|---|
| per-user SQLite + better-sqlite3 + sqlite-vec + FTS5 | IngestionPipeline → **ExtractionBatchWorker**（§6） | `messages_vec`、`memory_links`、`chunk_revisions`、`social_edges`、`relationships`（并入 edges） |
| PPR 图召回（`graphPpr.ts`）、lifecycleMode 词表、Probation | RecallEngine 融合层 → **加权 RRF + 权威/生命周期加权**（§8.3） | `memory_change_events/chains`（→ `entity_properties` 历史视图） |
| Scene Autopilot / SceneFrame / Cue Compiler / LensPresentationCompiler | ContextRecallService 的手调打分 → **RetrievalPlan + 自适应阈值**（§8） | `consolidation_level` 词汇；11 张写后不读表 |
| Keystone Brief / Rehearsal / Change Ledger 的 UI 契约 | ForgettingEngine + SalienceScorer → **Lifecycle v2**（§7.2） | 浏览器侧实体抽取入库路径（降级为 hint） |
| TruthMaintainer 权威权重表 | 摄入路径全部改走 TruthMaintainer（§5.4） | `AnticipationService` 无证据预答（→ 有证据的 anticipation，§7.5） |
| UsageAnalytics / model_pricing | LLMClient → **tier 路由 + 结构化输出 + 缓存 + Batch**（§6.5） | 三份 prompt 副本（扩展中文 / 服务端英文 / PassiveWebpage 双实现） |
| MCP 6 工具、三级鉴权、A2A | MCP 工具面收敛为"一读一写 + context_pack"（§11） | |
| evals 基建、`memory-abilities` 工具 | `recall_training_cases` 接通 learned ranker（§8.6） | |

### 4.4 改进点之间的冲突与重叠消解

把 §3 的业内改进点全部落地时，有 10 处会互相干扰。**不消解的话，它们会在运行时互相抵消**（最典型：夜间合并会把"重复加固"的计数抹掉）。以下是逐条裁决，实现时必须遵守。

#### C1 三套"重要性"信号的职责边界（**最容易重复计数的地方**）

`times_derived`（Honcho）、`access_count`+`stability`（FSRS/半衰期）、`heat`（MemoryOS）三者都在表达"这条记忆重要"，但来源完全不同。**必须严格分工，不得互相灌入**：

| 信号 | 语义 | 由什么驱动 | 允许影响 | **禁止影响** |
|---|---|---|---|---|
| `times_derived` | 这个**事实**被反复观察到 | 写入侧去重命中 | `confidence`、`sal` | 不得直接进检索打分，不得影响 `S` |
| `access_count` / `stability` `S` / `retention` `R` | 这条**记忆**被反复用到 | 读取侧命中且被引用（1 h 冷却） | 检索打分的 `R` 项、遗忘/冻结 | 不得影响 `confidence` |
| `heat` | 这个**主题簇**最近活跃 | 簇内命中数 + 交互长度 + 时间衰减 | **仅用于触发**巩固/晋升 | **绝不进检索打分**（否则热门话题会永久霸屏，压掉当下真正相关的冷记忆） |

§8.3 的 `score` 里只有 `rel + R + sal` 三项，`heat` 与 `times_derived` 都不在其中——这是**有意的**，不要"顺手加进去"。

#### C2 "重复 = 加固" 与 "去重合并" 的优先级（**不消解会互相抵消**）

P5 说重复观察要 `times_derived++`，§7.4 说夜间对 cos ≥ 0.90 的对做 LLM 合并。如果夜间合并把两条各自 `times_derived=3` 的记忆合成一条 `times_derived=1`，加固信号就被抹掉了。

统一阈值阶梯（**全局唯一一份，任何地方不得另设**）：

| 相似度 | 时机 | 动作 | `times_derived` |
|---|---|---|---|
| 精确 hash 命中 | 写入侧 | 加固，不建新 unit | `+1` |
| `cos ≥ 0.92` 且同 kind 同 scope | 写入侧 | 加固，不建新 unit | `+1` |
| `0.80 ≤ cos < 0.92` | 写入侧，本批合并为 1 次 cheap 调用 | `APPEND` / `UPDATE` / `ABORT` / `CONTRADICT` | UPDATE 时**累加**双方 |
| `cos ≥ 0.90`（写入期漏网的异构表述） | 夜间阶段 C | `MERGE` / `KEEP_BOTH` / `CONTRADICT` | **MERGE 必须求和，不得重置** |
| `cos ≥ 0.85`（实体名） | 夜间 | 建 `synonym_of` 边 | 不适用 |
| `cos ≥ 0.80`（unit 间） | 夜间 | 建 `association` 边（不合并） | 不适用 |

夜间合并只处理"写入期没抓到的异构表述"，因此它的阈值（0.90）必须**低于**写入侧的加固阈值（0.92），否则两者抢同一批数据。

#### C3 矛盾失效的作用域（**防过度失效**）

§6.2 规则 2 要求所有现在时事实都落 `valid_from = episode 时间`。副作用：**每条事实都有了 `valid_at`，Graphiti 的失效算法会变得非常激进**——只要区间重叠就关掉早的那条。

但"X 负责 A 项目"（6 月）与"X 负责 B 项目"（7 月）并不矛盾，两者可以同时为真。

**裁决：矛盾判定必须被限制在同一"断言槽位"内**，即：
- 属性级：同一 `(entity_id, property_key)`；
- 边级：同一 `(from_id, to_id, name)`；
- unit 级：同一 `(topic_key, kind)` 且被 ⑤ 的 LLM 显式判定为 `CONTRADICT`。

**跨槽位的事实永不自动失效。** 另外只有 `kind ∈ {fact, decision, procedure, preference}` 参与失效；`event` 是时间点事实（发生过就永远发生过），`insight` 有自己的 30 天过期，都不参与。

#### C4 权威加权的方向要按"问题类型"翻转（**与业内做法相反的地方**）

MemoryScope 用 `type_ratio` 让 insight（派生物）×2.0 压过原始证据；§8.3 的 `w_authority` 反过来在被动面把 derived 降到 0.6。这不是抄错，是针对本项目"派生噪声挤掉真证据"的痛点。

但 RAPTOR / GraphRAG 的结论同样成立：**主题性/聚合性问题上，摘要确实胜过原文 chunk**。所以权威权重不能只按 surface，还要按 needSlot 类型翻转：

```
w_authority(surface, authority, needSlotKind):
  base = { evidence: 1.0, self_confirmed: 1.15,
           derived: { passive: 0.6, compose: 0.7, ask: 0.85 }[surface] }
  # 聚合/概览型需求时，派生物反超
  if needSlotKind in {overview, aggregate, history}:
      base.derived *= 1.8      # passive 0.6→1.08, ask 0.85→1.53
      base.evidence *= 0.9
```

即：问"这张票的估算口径"时原始证据优先；问"我对这个方向的整体想法"时反思结论优先。

#### C5 多视图与 RRF 的计数口径

一条 unit 可能同时命中 `V_body`、`V_trig`、`F_seg` 三个通道。RRF 的设计本意就是"多通道命中 = 更可信"，所以**跨通道要累加**；但**同一通道内**若一条 unit 有多个 view 命中（例如两条 trigger_question 都中了），只取最好的 rank。

顺序固定为：① 通道内按 unit 去重取最优 rank → ② 跨通道 RRF 累加 → ③ minmax 归一 → ④ 加权 → ⑤ MMR。§8.3 的"同 unit 多视图取最高"指的是①，不要理解成④之后再压平。

#### C6 阈值与模型的耦合（**换模型必须重标定**）

`0.30`（准入）、`0.80/0.85/0.90/0.92`（去重阶梯）、`0.05`（PPR 段落种子权重）全部是在 **float32 + MiniLM** 上标定的。以下两个变更会让它们全部失真：
- `EMBEDDING_MODEL` 换成 multilingual-e5-small（§10.3）——e5 的余弦分布与 MiniLM 显著不同，且需要 `query:`/`passage:` 前缀；
- 向量量化到 int8（§10.3）——距离有量化误差。

**裁决**：① 这些阈值一律从常量改为**配置项**（可按 `embedding_model` 分组）；② 换模型或换量化后，必须跑一次**标定作业**：在已知的正/负样本对上重新扫阈值，产出新的一组值；③ `memory_units.embedding_model` 字段（§5.2 已有）用于隔离新旧向量，**不同模型的向量之间永不比较相似度**。

#### C7 Batch API 与"三重门"的时效冲突

§6.5 让夜间任务走 Batch（−50%），§7.1 的 Dream 三重门要求"用户空闲 ≥ 60 min 才开工，新消息到达即取消"。但 Batch 是 24 h 窗口——提交后等结果回来时，"空闲"条件早就不成立了。

**裁决：按时效把睡眠期任务分两类**：

| 类 | 任务 | 通道 |
|---|---|---|
| 可延迟（结果晚一天也无所谓） | 触发问句生成、画像 induction、周 dreaming、去重合并 | **Batch，−50%** |
| 需当夜闭环（次日早上要用） | GA 反思、anticipation brief、peer card 刷新 | **同步 API**，走 smart 档但控 token 预算 |

三重门只作为"**是否发起本轮巩固**"的判据；一旦发起，Batch 部分提交后即释放锁，结果回来时按 `work_unit_key` 幂等落库，不再校验空闲条件。

#### C8 跨库引用与级联删除

三库分离（§10.2）后，`ops.db` 里的 `recall_training_cases` / `memory_outcome_events` 会引用 `memory.db` 里的 `unit_id`，而 **WAL 下跨库事务不是原子的**。

**裁决**：ops.db 的引用一律是**软引用**——不建外键，容忍悬空 id；读取时 join 不到就跳过并计数。级联删除（§10.5）只保证 `memory.db` 内部一致，ops 侧由夜间 GC 清理悬空行。反过来，**任何影响记忆语义的表都不允许放进 ops.db**。

#### C9 归档库与"打开原文"

episodes 归档到 `archive-YYYY.db` 后，units 仍在热库、`sources_json` 指向已归档的 episode。**裁决**：archive 只在 `lifecycleMode ∈ {historical, explicit_search, audit}` 时 ATTACH；被动 Lens 与 Compose 永不 ATTACH。UI 上"查看原文"若指向归档 episode，走一条单独的、允许更高延迟的读取路径，并在卡片上标注"历史归档"。

#### C10 浏览器 LLM#1 的 summary 与服务端 unit 文本

两者都在生成"这条消息说了什么"。**裁决**：职责不重叠——
- LLM#1 的 `summary` 服务于**浏览器即时 UI**（通知卡片、自动答复上下文），并作为 `messages_raw.summary` 的兜底；
- 服务端抽取产出的是**结构化 units**，是检索与图谱的真源；
- 两者都保留，但 `memory_units` 的正文**永远来自服务端抽取**，不从 `metadata.summary` 提升；仅当服务端抽取失败（`needs_extraction`）时，才用 `metadata.summary` 生成一条降级 unit 并标记。

---
## 5. 数据模型 v2

### 5.1 记忆类型学（最小集）

| kind | 含义 | 衰减 | 典型来源 |
|---|---|---|---|
| `fact` | 关于人/项目/事物的可验证陈述 | 慢（S₀=30d） | 抽取 |
| `preference` | 用户/他人偏好、习惯、约束 | 慢（30d），用户确认后 core | 抽取 → 画像 |
| `decision` | 已做出的决定及其理由 | 慢（60d） | 抽取 |
| `action_item` | 待办/承诺/截止 | 随 due 过期 | 抽取 |
| `event` | 发生过的事（带时间） | 中（7d）+ heat 晋升 | 抽取 |
| `risk` / `open_question` | 风险、未决问题 | 中（14d） | 抽取、反思 |
| `opinion` | 某人对某对象的评价（valence） | 慢 | 抽取（self 直述） |
| `procedure` | 做法、口径、流程规则（如"估算单位是人天"） | 不衰减（rule） | 抽取、反思 |
| `insight` | 反思/dreaming 推出的高层结论 | 30d 过期（GA） | 睡眠期 |
| `brief` | Keystone / anticipation / day brief 的可检索投影 | 随 valid_until | 睡眠期 |
| `core` | 钉住的身份/基本盘（peer card 条目） | 不衰减 | 用户确认、归纳 |
| `vault` | 敏感字段（只精确匹配、不进向量） | 不衰减 | 显式保存 |

`authority ∈ {evidence（来自原始 episode 的抽取）, self_confirmed（用户确认/手工）, derived（反思/dreaming/brief 推出）}`——检索时 passive 面 derived 权重 0.6，ask 面 0.85，用户确认 1.15。

### 5.2 核心表（逻辑模型 → 物理表）

```sql
-- L0 证据：物理表沿用 messages_raw（列已足够：content, source_type, scope, source, sender, group_id,
--          timestamp, trust_class, injection_flags_json, claim_attribution_*），新增：
ALTER TABLE messages_raw ADD COLUMN episode_kind TEXT;        -- message|page|meeting|calendar|note|import
ALTER TABLE messages_raw ADD COLUMN language TEXT;            -- zh|en|mixed，抽取时判定
ALTER TABLE messages_raw ADD COLUMN extraction_status TEXT;   -- pending|extracted|skipped|failed
ALTER TABLE messages_raw ADD COLUMN extraction_batch_id TEXT;

-- 抽取队列（P8：增量游标 + 单飞）
CREATE TABLE ingest_queue (
  episode_id TEXT PRIMARY KEY, work_unit_key TEXT NOT NULL,    -- scope|conversation 维度分批
  token_size INTEGER, status TEXT NOT NULL DEFAULT 'idle',      -- idle|processing|done|failed
  attempts INTEGER DEFAULT 0, claimed_at INTEGER, created_at INTEGER NOT NULL);

-- L1 记忆单元 ★
CREATE TABLE memory_units (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, kind TEXT NOT NULL,
  text TEXT NOT NULL, text_norm TEXT NOT NULL, hash TEXT NOT NULL, language TEXT,
  owner_kind TEXT, speech_mode TEXT, time_basis TEXT,         -- 复用 memory_claims 词表
  observed_at INTEGER, captured_at INTEGER NOT NULL,           -- 事件时间 / 事务时间
  valid_from INTEGER, valid_to INTEGER, expired_at INTEGER,    -- Graphiti 语义：失效不删除
  authority TEXT NOT NULL, confidence REAL, poignancy INTEGER, -- 1-10（GA）
  status TEXT NOT NULL DEFAULT 'active',                       -- active|superseded|frozen|archived|retracted
  superseded_by TEXT, version INTEGER DEFAULT 1,
  times_derived INTEGER DEFAULT 1, last_confirmed_at INTEGER,  -- P5 重复=加固
  sources_json TEXT NOT NULL,        -- [{episode_id, span_start, span_end}]  ← 来源链
  entity_ids_json TEXT, topic_key TEXT, source_type TEXT, trust_class TEXT,
  embedding_model TEXT,              -- 换模型后不跨模型比较
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX idx_units_scope_status ON memory_units(scope, status, kind);
CREATE INDEX idx_units_hash ON memory_units(hash);

CREATE TABLE memory_unit_history (unit_id TEXT, version INTEGER, old_text TEXT,
  update_type TEXT,                  -- conflict|duplicate|extract|feedback|consolidate（MemOS 词表）
  reason TEXT, actor TEXT, at INTEGER, PRIMARY KEY(unit_id, version));

-- 多视图索引（R3 的解药）：正文 / 触发问句 / 关键词 各自可检索
CREATE TABLE memory_unit_views (id INTEGER PRIMARY KEY, unit_id TEXT NOT NULL,
  view_kind TEXT NOT NULL,           -- body|trigger_question|keywords|summary
  text TEXT NOT NULL, created_by TEXT, model TEXT, created_at INTEGER);
CREATE VIRTUAL TABLE unit_views_fts USING fts5(text, content='memory_unit_views', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2');   -- 写入前用 Intl.Segmenter 预分词（§10.3）
CREATE VIRTUAL TABLE unit_views_fts_tri USING fts5(text, content='memory_unit_views', content_rowid='id',
  tokenize='trigram');                          -- 中文 ≥3 字短语兜底
CREATE VIRTUAL TABLE unit_views_vec USING vec0(view_id INTEGER PRIMARY KEY,
  scope TEXT PARTITION KEY, view_kind TEXT, status TEXT, embedding int8[384]);   -- 单份向量

-- L2 实体与边（三张边表 → 一张）
CREATE TABLE edges (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,        -- relation|co_occurs|synonym_of|association|social
  from_id TEXT NOT NULL, to_id TEXT NOT NULL, from_type TEXT NOT NULL, to_type TEXT NOT NULL, -- entity|unit
  name TEXT,                                      -- depends_on / works_with / owns / …
  fact TEXT,                                      -- 边即事实（Graphiti）
  strength REAL DEFAULT 0.5, co_occurrence_count INTEGER DEFAULT 1,
  valid_at INTEGER, invalid_at INTEGER, created_at INTEGER NOT NULL, expired_at INTEGER,
  reference_time INTEGER,                         -- 产生该边的 episode 时间（Graphiti）
  invalidated_by TEXT,                            -- 被哪条边判旧
  source_unit_ids_json TEXT, status TEXT DEFAULT 'active');
CREATE TABLE edge_episodes (edge_id TEXT, episode_id TEXT, PRIMARY KEY(edge_id, episode_id));  -- 溯源用连接表，episode_mentions 重排 = COUNT(*)
CREATE VIRTUAL TABLE edges_fts USING fts5(fact, content='edges', content_rowid='rowid', tokenize='unicode61');  -- 边即检索单元
CREATE INDEX idx_edges_from ON edges(from_id, status); CREATE INDEX idx_edges_to ON edges(to_id, status);
-- 时间点查询："T 时刻为真" = valid_at <= T AND (invalid_at IS NULL OR invalid_at > T) AND expired_at IS NULL

-- entity_properties：物理表保留，新增 fact_text / source_unit_id；所有写入经 TruthMaintainer.propose()
-- memory_change_events/chains → 由 entity_properties 的 (tx_start, superseded_by) 链派生为 VIEW

-- L3 用户模型（§9）
CREATE TABLE profile_slots (id TEXT PRIMARY KEY, topic TEXT NOT NULL, sub_topic TEXT NOT NULL,
  content TEXT NOT NULL, kind TEXT NOT NULL,      -- explicit|deductive|inductive|contradiction|card
  status TEXT NOT NULL DEFAULT 'active', version INTEGER DEFAULT 1,
  times_derived INTEGER DEFAULT 1, update_hits INTEGER DEFAULT 0, confidence REAL,
  first_seen_at INTEGER, last_confirmed_at INTEGER, source_unit_ids_json TEXT, premises_json TEXT,
  superseded_by TEXT, user_confirmed INTEGER DEFAULT 0);
CREATE TABLE profile_slot_history (...);          -- 同 memory_unit_history
CREATE TABLE profile_slot_schema (topic, sub_topic, description, update_description, strictness);

-- L5 生命周期（替代 memory_metadata 对 unit 的职责；chunk 不再有生命周期）
CREATE TABLE unit_lifecycle (unit_id TEXT PRIMARY KEY,
  stability REAL NOT NULL, difficulty REAL NOT NULL DEFAULT 5.0,   -- FSRS-lite（§7.2）
  retention REAL NOT NULL DEFAULT 1.0, sal REAL NOT NULL, heat REAL DEFAULT 0,
  access_count INTEGER DEFAULT 0, last_access_at INTEGER, last_reinforce_at INTEGER,
  tier TEXT NOT NULL,                              -- core|active|weak|historical|archive_only|forgotten（沿用）
  frozen_at INTEGER, next_check_at INTEGER);

-- 确定性触发条目（SillyTavern WI 语义，用于 procedure/persona 规则）
CREATE TABLE trigger_rules (id TEXT PRIMARY KEY, unit_id TEXT, keys_json TEXT, secondary_keys_json TEXT,
  logic TEXT, scan_depth INTEGER, probability REAL DEFAULT 1.0, sticky INTEGER, cooldown INTEGER,
  surfaces_json TEXT, budget_priority INTEGER, enabled INTEGER DEFAULT 1);
```

### 5.3 旧表 → 新表映射

| 旧 | 新 | 迁移方式 |
|---|---|---|
| `chunks`（消息分块） | 保留为证据层（`file_path=messages/<id>`）；**不再有向量、不再是检索主候选**；长文档（source-memory）的 chunk 继续 FTS 用于精确查证 | 停止为消息写 chunks_vec；历史 chunks_vec 清空 |
| `messages_vec` | 删除 | 一次性 `DROP`；向量重建到 `unit_views_vec` |
| `messages_raw.summary` / `metadata.summary` | `memory_units(kind=fact…, authority=evidence)` 的正文由抽取产生；旧 summary 作为 `view_kind='summary'` 回填一次 | 回填任务 |
| `relationships` / `social_edges` / `memory_links` | `edges(kind=relation|co_occurs|synonym_of|social|association)` | 脚本迁移，`valid_at=first_seen` |
| `memory_change_events/chains` | `entity_properties` 历史 + `VIEW memory_change_timeline` | 回填 `fact_text`，删表 |
| `user_profile_items` | `profile_slots`（kind=explicit，`times_derived=mention_count`） | 脚本迁移 |
| `memory_metadata`（message/chunk 级） | `unit_lifecycle`（unit 级）；entity 级保留在 `memory_metadata` | 按 unit 来源 episode 继承 sal/access |
| `consolidation_level` | 删除；只用 `tier` | |
| `reflection_artifacts` / `dreams/*.md` / `keystone_briefs` | 表保留（UI）；每条同时投影为 `memory_units(kind=insight|brief, authority=derived)` | 派生投影任务 |
| 11 张写后不读表 | `DROP` 或迁入 ops.db（`ambient_calibration_traces`、`recall_training_cases` 迁 ops 并接通消费） | |

### 5.4 "当前值"的唯一 API

```ts
TruthMaintainer.propose({ entityId, key, value, factText, sourceUnitId, authority, observedAt })
  → { outcome: 'inserted'|'reinforced'|'superseded'|'disputed'|'pending_confirm', currentRow }
TruthMaintainer.current(entityId, key, asOf?)   // 双时态查询；asOf 缺省=now
TruthMaintainer.timeline(entityId, key)         // 替代 memory_change_chains
```

规则：同值 → `reinforced`（confidence+0.1, times_derived++）；异值且来者权重 ≥ 现值 → 旧行 `valid_to=observedAt, tx_end=now, status=superseded`；异值且来者权重低 → `disputed` + confirm_request（沿用）；`is_final` 仅 official/self_confirmed 可覆盖。`IngestionPipeline` 直插路径删除。

### 5.5 Markdown 的新角色

`daily/*.md`、`projects/*.md`、`reflections/*.md`、`dreams/*.md`、`USER_CORE.md` 全部保留为**投影**：由 units / slots / briefs 渲染，可随时重建，可导出到 `~/.openclaw/workspace/memory/` 供 OpenClaw memory-core 索引（[memory-share-with-openclaw.md](./memory-share-with-openclaw.md) 架构 B 的零插件过渡）。**`MarkdownManager.reindexFile` 不再把 .md 切块入索引**——同一内容只以 unit 形态被检索一次，消除派生物与证据的同池竞争。

### 5.6 确定性触发条目

`procedure` / `persona rule` 类记忆（"MTR 项目估算口径是人天"、"给 Harpreet 的邮件用英文"）除向量/FTS 外，额外编译成 `trigger_rules`：关键词/正则主键 + 副键逻辑 + `scan_depth`（看最近几条消息/页面字段）+ `sticky/cooldown` + surface 白名单 + 预算优先级。被动 Lens 的 Cue Compiler 目前只硬编码 `jira_estimate` 一个场景；改为读 `trigger_rules`，抽取阶段可自动提议规则（`status=candidate`），用户确认或 `times_derived≥3` 后启用。

---

## 6. 写入管线 v2 与 LLM 分层

### 6.1 流程

```
① /ingest（同步，零 LLM，<20ms）
   episode 落地(messages_raw) → 去重(postId/内容hash) → 信任分级/注入筛查 → claim 归属(确定性)
   → ingest_queue(idle) → 返回 receipt {episodeId, queued:true}
   浏览器侧 metadata.summary/entities 只作 hint 落 metadata_json，不再是抽取真源

② ExtractionBatchWorker（异步，每用户单飞）
   触发（任一）：同 work_unit_key 的 idle token ≥ 512（上限 1024/批）｜最老 idle ≥ 30 min｜会话结束事件｜手动
   claim：BEGIN IMMEDIATE; UPDATE ingest_queue SET status='processing', claimed_at=now WHERE ... ; COMMIT
   僵死回收：processing > 15 min → idle, attempts++ ；attempts > 3 → failed（保留原文，不推进游标）

③ 上下文装配（零 LLM）
   本批 episodes（按时间排序，带 sender/时间/来源）
   + 同 conversation 前 6 条 episode（Graphiti 的 previous episodes）
   + 与本批向量最近的 top-10 已有 units（Mem0 的 existing memories，序号化防幻觉）
   + peer card（≤40 条，让模型知道基本盘，避免重复抽"用户是 PM"）
   + 观察日期锚点（Observation Date，用于相对时间→绝对时间）

④ 一次结构化抽取（tier=cheap；json_schema strict；prompt 双语、"PRESERVE LANGUAGE"）
   输出 {
     units:[{text, kind, owner_kind, speech_mode, time_basis, observed_at?, valid_from?, valid_to?,
             poignancy 1-10, entities:[{name,type}], source_episode_ids:[...], span?, is_procedure_rule?,
             trigger_question?: string  // 仅 poignancy≥6 的单元现场生成 1 条，其余夜间批量补
            }],
     edges:[{from,to,name,fact,valid_at?}],
     properties:[{entity,key,value,fact_text,action_type}],
     profile_candidates:[{topic,sub_topic,content,kind:'explicit'}],
     language, summary_one_line
   }
   失败：重试 1 次（同 tier）→ 仍失败则 units=[{text:原文首句(≤200字), kind:'fact', authority:'evidence',
        status:'active', needs_extraction:1}]（MemOS 保底），episode.extraction_status='failed'，绝不空手返回

⑤ 去重与加固（零 LLM）
   hash(text_norm) 精确命中 → times_derived++, last_confirmed_at=now（不新建）
   cos ≥ 0.92（同 scope、同 kind）→ 同上加固
   0.80 ≤ cos < 0.92 → 进 merge 候选（本批合并为 1 次 cheap 调用：APPEND|UPDATE|ABORT|CONTRADICT）
   cos < 0.80 → 新建

⑥ 真值与矛盾
   properties → TruthMaintainer.propose()（§5.4）
   CONTRADICT 判定 → 旧 unit valid_to=new.observed_at, expired_at=now, status=superseded, superseded_by=new
     · 若旧 unit authority=self_confirmed 且新 unit 为 inferred → 不自动覆盖，改 disputed + confirm_request
     · 高影响（decision/action_item 的截止/负责人变更）→ 升级 tier=standard 复核一次（FrugalGPT 级联）

⑦ 索引（零 LLM）
   unit_views(body) + unit_views(trigger_question 若有) + unit_views(keywords: 实体名/票号/数字)
   FTS：Intl.Segmenter 预分词写 unicode61 表 + 原文写 trigram 表；VEC：int8 单份，partition=scope
   entities upsert：两阶段去重（Graphiti）——精确归一名 → 熵门（名长≥6 且 ≥2 token 才进模糊匹配）→ 3-gram MinHash/Jaccard≥0.9 → 仍不确定且候选 cos≥0.6 的长尾才进 ⑤ 的 cheap 调用；"related but distinct 不合并"
   edges upsert（co_occurs 自动 + relation 显式，`reference_time`=episode 时间；同 (from,to,fact_norm) 命中 → 追加 edge_episodes 而非新建）
   边矛盾失效（纯代码，Graphiti resolve_edge_contradictions）：同端点、被 ⑤ 判 CONTRADICT 且区间重叠 → valid_at 更早的一方 invalid_at=另一方.valid_at, expired_at=now, invalidated_by=…
   unit_lifecycle 初始化（§7.2 D2）
   conversation_context_frames 更新（沿用）；daily/*.md 追加一行（投影）

⑧ 回执与指标
   extraction_receipt {batch_id, episodes, units_new, units_reinforced, merged, contradicted, properties,
     profile_candidates, parse_failed, tokens_in/out, model, tier, ms}
   日聚合 → supply_metrics；连续 24h units_new+reinforced=0 而 episodes>0 → 报警（枯竭探测器）
```

### 6.2 抽取 prompt 的硬规则（从 Mem0 v3 / Honcho / MemOS 提炼）

1. 每条 unit 只含一个原子事实，15–80 词，自包含、无指代（"User"/具体人名代替"他"）。
2. 相对时间只用 Observation Date 解析为绝对日期；解析不了就不写时间，不猜。**但现在时的持续事实（"X 负责 Y"、"估算单位是人天"）必须把 `valid_from` 落到 episode 时间**——Graphiti 的教训：失效算法要求新旧双方都有 `valid_at`，对话事实多数无显式日期，不落 episode 时间则矛盾失效永不触发。表达"变化/终止"的句子写 `valid_to`。
3. 专有名词、票号、数字、URL 原样保留；不概化（"416 页"不能写成"很多页"）。
4. 不从 assistant/AI 复述用户话的消息里抽（无回声抽取）；已有 units 只用于去重/链接，不得把其细节混进新 unit。
5. 必须记录"转变"（"X 从 CSV 改为 XLSX"），因为这是 supersede 的信号。
6. **保留输入语言**：中文输入产中文 unit；实体名保留原文；不翻译。
7. 宁多勿少（"a slightly redundant memory is far less costly than a missing one"），去重交给 ⑤。
8. `profile_candidates` 只从 owner 自述（claim owner_kind=self & speech_mode=direct_assertion）抽；他人转述降为 fact。
9. 10+ 条消息的批通常应产出 5–15 条 units；产出 0 条必须给 `skip_reason`。

### 6.3 浏览器侧预分析的去向（**方案 1：浏览器只做过滤与命中定位，抽取真源归服务端**）

#### 6.3.1 先修正职责划分的事实（2026-09-03 代码审计）

原先的两阶段描述（"浏览器①读取过滤 ②拆解实体"）需要一处关键修正：**过滤本身就是 LLM#1 做的，不是确定性规则做的**。LLM 之前只有"取数范围"级别的确定性裁剪，没有任何基于关注项内容的预过滤——规则原文是拼进 prompt 交给模型判的。

| 阶段 | 性质 | 说明 |
|---|---|---|
| 1–4 取数 / 规范化 / 线程重组 / 二次裁剪 | 确定性 | 时间窗、群白名单、文件夹白名单、按 id 去重、`EXCLUDED_PUSH_GROUP_IDS`（`metadata/message.ts:1077-1151`、`messageDealing.ts:890-913`） |
| 5 Owner 发言学习 ingest | 确定性，无 LLM | 自己发的消息全量上传（`messageDealing.ts:553-607`），与规则无关 |
| 6–8 规则装配 / scope 预筛 / XML 序列化 | 确定性 | 注意 scope 预筛筛掉的是**规则**，不是消息（`watchRules.ts:455-470`） |
| **9 LLM#1 消息分析** | **LLM** | 同时承担"过滤"与"规则命中定位"，输出 `matched_rule_refs`/`summary`/`reply_advice`/`follow_thread_info`/`confidence` |
| 10–11 硬编码剔除 + 规则范围复核 | 确定性 | 模型说命中但发送人/群不在规则 scope 内的会被丢弃（`messageDealing.ts:1800-1873`） |
| **12 LLM#2 实体抽取** | **LLM** | 每条命中消息 1 次（`:1876`），输出 100% 只进 `/ingest` 的 metadata |
| 13–14 ingest / 自动答复 / 通知 / 摘要队列 | 确定性 | |

另外三条支线不同：`agentThinking` 模式**不调用 LLM#2**（实体来自 LLM#1 的 `analysis.entities`）；`agentWorkflow` 模式把实体抽取做成 agent 可选工具；`filter` 是默认模式（`utils.ts:537`）。

#### 6.3.2 最大的冗余：LLM#1 已经产出实体，却被丢弃

`src/prompts/messageAnalysis.ts:86,125-134` **已经要求 LLM#1 输出 `entities`**（people/projects/topics/actions/documents/technologies/sentiment/category），但 `filter` 模式在 `messageDealing.ts:1909` 用 LLM#2 的结果**整个覆盖**了它。即：花了一次调用要来的实体扔掉，再花第二次调用去问几乎同样的东西。而且 LLM#2 发生在**去重之前**，重复消息照样付钱。

#### 6.3.3 目标形态

**浏览器保留**（这些不能也不该搬走）：

- 阶段 1–8 全部确定性逻辑。
- **LLM#1 必须留在浏览器**：它的规则集来自 `chrome.storage.local`（manual 规则）与本地 `followConfig`，且其输出直接驱动浏览器侧的即时动作——通知卡片、自动答复、关注后续、RuntimeAction、摘要队列。这些都要求本地同步拿到结果。
- 阶段 10–14 的确定性复核与分发。

**移交服务端**：实体、属性、画像候选、观点、边、触发问句——统一由 §6 ④ 的 `ExtractionBatchWorker` 产出。浏览器不再承担任何"知识抽取"职责。

**过渡期的两步走**（顺序不能颠倒）：

| 步骤 | 动作 | 收益 | 风险 |
|---|---|---|---|
| **步骤 A（可立即做，零风险止血）** | 删掉 LLM#2 调用，改用 LLM#1 已经输出的 `json.entities` 填 `metadata.entities` | 每条命中消息立省 1–1.7K token，且去重前不再浪费调用 | 无——LLM#1 的 entities schema 已包含所需字段；无任何 UI 消费 LLM#2 输出 |
| **步骤 B（与服务端抽取同批上线）** | 服务端 `INGEST_LLM_EXTRACTION_ENABLED=true` + §6 抽取管线 v2 就位后，浏览器 `metadata.entities` 降级为**可选 hint**（服务端优先用自己的抽取结果，hint 仅在服务端抽取失败/降级时兜底） | 抽取真源唯一化，三份 prompt 副本减到一份 | **必须同批**，见下方 6.3.4 |

#### 6.3.4 唯一的真实回归风险：召回锚点断供

`ContextRecallService` 目前**确实在读** `metadata.entities`：`:3069-3075` `addAnchorsFromMetadata`（people/projects/topics 锚点）、`:2237-2258`（检索文本拼装）、`:1179`（cohesion 主题键）。此外 `metadata.contextMessages`/`actions`/`replyAdvice` 被 `MemoryCueFactService`、`LensPresentationCompiler` 消费。

⇒ **硬约束：关掉浏览器实体抽取 ⟺ 打开服务端抽取，必须同一次上线。** 且服务端抽取结果要么同时写回 `metadata_json.entities`，要么改 `ContextRecallService` 读 `entities_json` / §5.2 的 `memory_units.entity_ids_json`。迁移期还需兼容两种 schema：LLM#2 产出的是带 `relevanceScore` 的对象数组，服务端 `flattenEntities` 产出的是 `{name,type}`——`addEntityAnchorArray`（`:3097+`）要能吃两种形状。

#### 6.3.5 顺带必须修的两个数据面 bug（一直在静默生效）

审计发现浏览器与服务端的字段契约有两处错位，导致两个一等列长期是常量：

1. **`metadata.sentiment` 永远送不到**：浏览器写 `messageMetadata.metadata.sentiment`（`messageDealing.ts:1910-1915`，agentThinking 路径 `:1294-1299` 同样），服务端读 `payload.metadata?.sentiment`（`IngestionPipeline.ts:293`）——**差一层嵌套**，`messages_raw.sentiment` 因此恒为 `'neutral'`。
2. **`metadata.importance` 从未被发送**：浏览器送的是 `metadata.metadata.priority`（字符串 low/medium/high），服务端要顶层 `metadata.importance`（0–1 数值，`:291`）——`messages_raw.importance` 恒为 `0.5`。

第 2 条的后果尤其严重：§2.3 的显著性公式里 `0.35 · importance` 是权重最大的一项，**它一直在用默认值 0.5 参与计算**，等于显著性排序丢掉了最重要的输入。修复这两个字段契约是 P0 里成本最低、收益最直接的改动之一，且与本节的抽取迁移天然属于同一次改动。

### 6.4 显著性初值（在线零 LLM）

```
sal0 = clamp(0.4·arousal + 0.6·significance, 0, 1)      # 词典法（zenBrain 形态；自建中文词典：情绪/人生事件/健康/关系/紧急/决策词）
     + 显式标记词("记住/别忘/以后都/我喜欢/我讨厌/决定/deadline") +0.15
     + 实体密度 > 阈值 +0.10 ；问号/感叹 +0.05 ；trusted 来源 +0.05
poignancy（1-10，抽取 ④ 顺带输出）到位后：sal = 0.5·sal0 + 0.5·(poignancy−1)/9
S0 = base_S[kind] × (1 + 2·sal)                           # base_S: event 7d, fact/preference 30d, decision 60d, procedure/core ∞
```

### 6.5 LLM 分层路由（LLMClient v2）

```ts
type LLMTier = 'local' | 'cheap' | 'standard' | 'smart';
interface LLMCall { task: LLMTask; tier?: LLMTier /* 默认由 task 决定 */; schema?: JSONSchema;
  cacheablePrefix?: string; batch?: boolean; budgetKey?: string; }
// config
LLM_TIER_MODELS = {
  local:    ['ollama/qwen3:8b'],                              // 可选；无则回落 cheap
  cheap:    ['openai/gpt-5-nano', 'claude/haiku-4-5', 'gemini/flash-lite'],
  standard: ['claude/sonnet-5', 'openai/gpt-5.6-terra'],
  smart:    ['claude/opus-5', 'openai/gpt-5.6-sol'],
}
```

| 任务 | tier | 频次 | 输出 | 备注 |
|---|---|---|---|---|
| ④ 结构化抽取 | cheap（可 local） | 每批 1 次 | strict JSON | 系统提示 ≥1024 tokens 冻结在前以命中缓存；Batch API 不适用（需分钟级） |
| ⑤ 灰区合并判定 | cheap | 每批 ≤1 次 | `N. APPEND|UPDATE|ABORT|CONTRADICT` | memobase merge_yolo 形态 |
| ⑥ 高影响矛盾复核 | standard | 少量 | 判定 + 理由 | FrugalGPT 级联 |
| 触发问句 / 关键词补齐（§7.4） | cheap，Batch | 夜间 | 每 unit 2–3 问句 | doc2query 记忆版 |
| 画像 slot 合并 | cheap | 每批 1 次 | APPEND/UPDATE/ABORT | |
| 画像 organize / re-summary | cheap | 触发式 | | |
| 反思（GA 焦点问题 → insight） | smart，Batch −50% | 夜间 ≤2 次/日 | insight + evidence ids | 睡眠期用强模型（Letta） |
| Dreaming | smart，Batch | 周 ≤5 | | |
| peer card 刷新 / 归纳（induction） | standard | 触发式 | | Honcho card refresh |
| Keystone 本地化 | cheap | 15 min ≤2 | 等义翻译 | 沿用 |
| Brief 组合（day/anticipation） | standard | 日 ≤8 | 有证据引用 | 替代无证据预答 |
| /ask 答案生成 | standard（用户可选 smart） | 按需 | | 沿用 ask 自己的生成器 |
| Compose Assist 生成 | standard | 按需 | | 沿用 |
| Recall synthesis（用户点击） | standard | 按需 | grounded summary | 沿用 |

基础设施改动：`LLMOptions.model/tier` 覆盖；`response_format: json_schema(strict)`（OpenAI / Anthropic `output_config` / Gemini 均支持，Ollama 回退 grammar 或 parse 校验）；`cache_control` 前缀缓存（Anthropic ≥1024/4096 tokens 门槛，OpenAI 自动）；Batch 客户端（夜间任务统一走 24h 窗口 −50%）；`usage_events` 增 `tier/task/budget_key` 列；每 `budget_key` 日预算（tokens 与 USD 双阈值），超预算降 tier 或跳过并写回执。

---

## 7. 睡眠期巩固 v2（Sleep-time Consolidation）

### 7.1 调度与门

- **三重门**（Honcho）：自上次巩固新增 units ≥ 50 **且** ≥ 8 h **且** 用户空闲 ≥ 60 min（新 episode 到达即取消重排）；23:00 cron 只作兜底；每用户单飞（`consolidation_runs` 租约），全局并发 ≤ 2。
- **增量游标**：每阶段记 `processed_upto(unit.created_at / lifecycle.next_check_at)`，失败不推进。
- **预算**：每阶段 token 与时长预算（`budget_key=consolidation.<phase>`），超预算写 `skipped_budget` 回执，下夜续跑。
- **杀开关**：`CONSOLIDATION_PHASES=...` 白名单；任一阶段异常不影响其它阶段。

### 7.2 阶段 A：生命周期算术（零 LLM，惰性）

```
R(t) = exp(−Δdays / S)                                  # 保持率（三家收敛形状）
访问命中且被最终回答/卡片引用（冷却 1 h）：
   S ← S · max(1, 1 + 0.2·(11−D)·S^(−0.2)·(e^(0.3·(1−R)) − 1)) ; access_count++        # FSRS-lite
用户确认/正反馈：R ← 1（EVIDENCE）；用户"不相关"：S ← 0.5·S（WEAKEN）；用户"错误"：status=retracted
滞回状态机：R ≤ 0.10 → frozen（不进候选，可复活）；frozen 且被显式引用使 R ≥ 0.15 → 复活
夜间：frozen 且 age > 30d 且 access_count = 0 且 sal < 0.3 → tier=archive_only（向量删除，FTS 保留）
core / vault / procedure 不衰减；action_item 过 due 7d 未完成 → weak
next_check_at = last_anchor + S·ln(R_now/0.10)（只在到期时重算——A_memorix 惰性策略）
```

**替换现状的两处 bug**：不再就地覆写 `salience_score`（S0 复合缩小）；强化只此一套幅度。

### 7.3 阶段 B：热度与晋升（零 LLM）

```
每 topic 簇（conversation_context_frames.topic_key 或实体簇）：heat = N_visit + L_interaction + e^(−Δh/24)
heat ≥ 5 → 标记簇为"画像更新候选"（进 §9 deriver）并 N_visit=L_interaction=0
event → fact 晋升：access_count ≥ 3 OR heat ≥ 5 OR sal ≥ 0.8
```

### 7.4 阶段 C：去重合并 + 触发问句补齐（cheap，Batch）

- 同 kind、同 scope、cos ≥ 0.90 的 unit 对 → 一次 cheap 调用批量判定 `MERGE|KEEP_BOTH|CONTRADICT`（"宁合并不删除；冲突不明时保留分歧写进 details"——MIRIX）；合并结果走 history。
- 为 `sal ≥ 0.5` 或 `heat ≥ 3` 且无 trigger_question 的 units 批量生成 2–3 条"什么情境/问题会需要我"（doc2query 记忆版），写 `unit_views(view_kind=trigger_question)` 并嵌入。这是 R2（意图层）的**写入侧解法**：查询时匹配"用户会问的问题"而非"记忆原文"，零在线延迟。
- 为 `procedure` 单元提议 `trigger_rules`（candidate）。

### 7.5 阶段 D：反思与有证据的预答（smart，Batch）

- **GA 反思**：Σ(poignancy of new units since last reflection) ≥ 150 或每晚兜底 → 生成 3 个焦点问题 → 各走 §8 检索 top-30 → 每问 ≤5 条 insight（必须引用 evidence unit ids，无引用即丢弃）→ `memory_units(kind=insight, authority=derived, valid_to=+30d)`；insight 可再被反思（反思树）。替代现有 ReflectionWorker 的自由生成，并成为 Keystone 简报的稳定输入。
- **有证据的 anticipation**：明日日历 + 开放 open_question + 近 7 天 ask 高频主题 → 每主题先跑 RetrievalPlan（§8）取证据 → 有 ≥3 条证据才生成 brief（standard）；`evidence_refs_json` 必非空。取代无证据预答。
- **Dreaming**（周）：沿用 GenerativeReplay，但主题池改为 heat/sal 驱动而非依赖"recall 强化写出的 entity 级 metadata"（冷启动无主题的 bug）；产物投影为 `insight` units；"动机驱动、不是日报"（MemOS MOTIVE 定位）。
- **线程/项目增量摘要（Saga 双水位线）**：`conversation_context_frames` 与 `projects/*.md` 投影的摘要改为增量：只喂 `created_at > last_summarized_at` 的新 units（墙钟水位，回填不漏）连同旧摘要，事件时间水位 `last_summarized_unit_observed_at` 只前进；"无新持久事实则返回原摘要不写"。
- **睡眠期提示纪律**（Letta sleep-time）：所有夜间 LLM prompt 注入 `reference_time`，禁止输出"今天/最近"这类相对时间；"没有有意义的更新就直接结束"；单次任务 ≤10 轮迭代；主路径（在线）没有任何记忆编辑能力，编辑全在这里。

### 7.6 阶段 E：图维护与 GC（零 LLM）

- 边 Hebbian 衰减 `w ← 0.98·w`，`w < 0.1` 剪除；同义边（cos ≥ 0.85）沿用 SynonymEdgeService；被引用 units 两两实体边 `w ← w + 0.1·(1 − w/10)`。
- GC：孤儿向量（views 无 unit / unit 无 episode）、`expired_at` 超 180 d 的 superseded units 降 archive、trigger_question 随 unit 归档、ops 事件表 TTL 90 d、`PRAGMA wal_checkpoint(TRUNCATE)`、FTS `merge`。
- 投影刷新：daily/projects/USER_CORE/reflections .md 重渲染（不入索引）。

### 7.7 与现有 ConsolidationEngine 的对照

| 现有阶段 | v2 去向 |
|---|---|
| 1 Compress（日总结 LLM） | 保留为投影渲染（daily.md），但输入改为当日 units 而非 raw；tier=cheap |
| 2 Denoise / 2.5 Evolution | 并入阶段 C |
| 3 Structure（项目 md） | 投影渲染，输入为 units + TruthMaintainer.timeline |
| 3.5 Profile | → §9 deriver（阶段 B 触发） |
| 3.6 Affinity / 3.7 Synonym | 保留 |
| 4 Clean / 4.5 VecCleanup / 4.6 Probation | → 阶段 A + E（含 messages_vec 遗留清理） |
| 5 Reindex（md 切块入索引） | **删除** |
| 6 Reflect / 6.5 Anticipation | → 阶段 D |

---

### 7.8 派生记忆的生产重构（**推翻"降权派生物"的原判断**）

> 本节是 2026-09-04 专项审计的结论，**修正了 §8.3 最初"派生物降权到 0.6"的设计理由**。原判断把症状当成了病因。

#### 7.8.1 实测：问题不是"派生记忆天然嘈杂"，是生产逻辑结构性缺陷

对 `esone.qiu` 库的实测：

| 事实 | 数据 |
|---|---|
| `chunks` 表里派生内容占比 | **99.9%（934/935）**；`file_path LIKE 'messages/%'` 的 chunk 数 = **0** |
| 索引总表面积 | 派生 **1,774,860 字符** vs 原始消息 **2,189 字符** |
| 单 chunk 平均长度 | `daily_log` 2350、`reflection_thread` 1335、`dream` 1073、`reflection` 757 vs **原始消息 104** |
| 放大倍数 | `reflection_thread` 12.8×、`daily_log` 22.6× |
| 反思线程文件切块数 | 5.87 chunk/文件；其中 **60%（214/358）落在 `## Runs` 区**，是最近 20 轮 heartbeat 的逐字堆放 |
| 主题裂变 | 同一张 Jira 单 MTR-144628 → **26 个线程 / 19 份 md 文件**；单线程 `reflection_count` 高达 **1336** |
| 空转产出 | 20 个 `reflections/*.md` 里 **11 个（55%）是"今天无活动"的编造填充**，且已进索引 |
| 检索侧权重 | `RecallEngine` / `ContextRecallService` 里 **grep 不到任何 `reflection`/`dream`/`daily_log` 的加权或惩罚常量**——既没有业内的 ×2.0 boost，也没有降权，是**纯余弦裸竞争** |

⇒ **在这个库里，"派生噪声挤掉真证据"这个描述本身就不准确——原始证据根本不在索引里**（§2.10.1 的 `shouldIndex` 断供）。派生物不是挤掉了证据，而是**填满了本该属于证据的整个索引**。

**因此"检索侧降权"是错的解法**：降权只会把 99.9% 的索引整体压低，既不解决同一主题 26 份副本，也不解决单线程 1336 轮重复。

#### 7.8.2 MemoryScope 的 ×2.0 是"挣来的"：对比生产链路

| 维度 | MemoryScope（insight ×2.0） | 本项目现状 |
|---|---|---|
| 记忆单元 | `MemoryNode`：conversation / observation / obs_customized / **insight**，带 `obs_reflected`/`obs_updated` 标志 | 自由散文 md 文件 |
| 入口门槛 | `info_filter` 给每条消息打 0/1/2/3 分，**过滤闲聊** | `phaseReflect` **无任何输入门槛** |
| 原子化 | `get_observation` 输出 `<idx> <time> <info\|无> <keywords>`，一条一事 | 整篇 500 词散文 |
| 去重/矛盾 | `contra_repeat` 判 `<矛盾\|被包含\|无>` 后才入库 | 仅 `content_hash` 精确去重（近似重复抓不到） |
| 反思触发 | 累计 **6 条新观察**才触发（`reflect_obs_cnt_threshold`） | 每日无条件跑 |
| 主题键 | `get_reflection_subject` **显式抽取"属性名"** 作为 insight 的键 | `topic_key` 取值是 `message:<msgid>` / `confirm_request:<id>`——**按消息 ID 而非主题** |
| 更新语义 | `update_insight` **以新信息为准整合进同一条 insight**（原地更新） | 每次生成新文件/新行，**永久累积** |
| 长度 | insight 是短句 | 15–21 KB 文档 |
| 只处理增量 | 消息带 `memorized` 标志 | `## Runs` 每次重渲染最近 20 轮全文 |

**结论：MemoryScope 的 insight 值 ×2.0，是因为它经过了"过滤 → 原子化 → 去重去矛盾 → 阈值触发 → 主题键控 → 原地整合"六道工序。本项目的派生物一道都没有。** 权重不是原因，是结果。

#### 7.8.3 六项修复（按性价比排序）

| # | 缺陷 | 修复 | 成本 |
|---|---|---|---|
| **F1** | `phaseReflect` 无输入门槛，产出 55% 空日填充并索引（`ConsolidationEngine.ts:953-960` 查了 `messageCount` 却不用） | `if (messageCount.count === 0) return 0;` —— `phaseCompress:296` 已有同款门槛可直接抄 | **一行** |
| **F2** | `## Runs` 逐字堆放最近 20 轮，占线程 chunk 的 60% | 渲染时 `## Runs` 段不进索引（或只保留"相对上一轮的 delta"）。md 仍可给人读 | 小 |
| **F3** | **结构化字段与索引载体倒挂**：`current_hypothesis`(均 104 字符) / `latest_summary`(均 155 字符) 是现成的原子节点却**不进索引**，20 KB 散文反而进 | **把这两列本身作为 chunk 索引**，md 文档降级为纯人类可读产物、不索引 | 中 |
| **F4** | `topic_key` 按消息 ID 取值，同一 Jira 单裂成 26 个线程 | 归一到实体/工单键（`jira:MTR-144628`）。`reflection_threads.topic_key` 已有 `UNIQUE` 约束，**改键取值后自动合并** | 中（需回填合并历史线程） |
| **F5** | dreams 按 `topic+日期` 每次开新文件，同主题旧梦永久留在索引；grounding receipt 只是提示不是门禁（`memories.length===0` 时只改文案照写） | 路径改 `dreams/{slug}.md` **覆盖式**（对齐 `updateProjectSummary` 已有的正确做法）；receipt 变**硬门槛**：无证据不产出 | 中 |
| **F6** | 门槛最严的 Keystone（≥2 独立源 + 非 derived 权威）**不进索引**；无门槛的全进索引 | 派生记忆统一收敛为 `memory_units(kind=insight\|brief, authority=derived)`（§5.1），**共用 §7.4 的质量门槛链**：入口过滤 → 原子化 → 语义去重 → 阈值触发 → 主题键控 → 原地更新 | 大（并入 P1） |

补充小缺陷：`MarkdownManager.inferSourceType` 无 `reports/` 分支，周报落到默认 `'markdown'`，检索侧无法按类型过滤或加权——顺手补上。

#### 7.8.4 修复后，检索侧权重要反转

**F1–F6 完成前**：派生物是低信噪比的散文洪水，`w_authority` 的 derived 降权（passive 0.6）是**必要的临时护栏**。

**F1–F6 完成后**：派生物变成"原子、主题键控、有证据链、原地更新"的 insight，此时应当**对齐 MemoryScope 的方向反转权重**：

```
w_authority(derived) 分三级（⚠️ 适用范围见下）：
  derived_prose  （未经重构的历史散文 chunk）        → 0.5，并随迁移逐步清退
  derived_atomic （主题级 insight/brief，有 premises）→ passive 1.0 / compose 1.2 / ask 1.6
  derived_inline （某条源记忆的摘要/触发问句）       → 不参与独立打分（见下）
```

⚠️ **这里必须区分两类派生物，否则与 §7.10 修正 A 直接冲突**：

| 类别 | 例子 | 形态 | 是否独立参与检索打分 |
|---|---|---|---|
| **derived_inline**（依附型） | 某条消息的摘要、某条 unit 的触发问句 | **拼接进源条目的索引键**（LongMemEval：+4% 检索 / +5% 准确率；单独作 key 无提升，替换原文则下降） | **否**——它没有独立身份，只是让源条目更好被找到 |
| **derived_atomic**（主题型） | "MTR 项目估算单位是人天"、跨多条证据归纳出的 insight | 独立 unit，有自己的 `topic_key` 与 `premises` | **是**——它跨多个来源，没有唯一的"源条目"可依附 |

判定规则很简单：**能唯一指向一条源记忆的派生物 → inline；跨多条来源归纳的 → atomic。** 前者走索引键增强，后者走独立单元加权。这样 §7.8.4 的权重反转与 §7.10 修正 A 各自适用于不同类别，不再矛盾。

即：**insight 之所以能压过原始证据，前提是它本身是被严格生产出来的、且它确实无源可依附。**§4.4 C4 的"按 needSlot 类型翻转"仍然适用，两者叠加。

#### 7.8.5 与 §12.1 的关系

F1（一行）与 F2 应并入 **P0 第 1 组**——它们能立刻止住索引污染的增量，且零风险。F3/F4/F5 属于 **P1**。F6 随 `memory_units` 迁移落地。

**注意执行顺序**：F1–F5 只阻止**新增**污染，历史的 934 条派生 chunk（含 26 份 MTR-144628 副本）需要一次清理——这应与 [memory-index-backfill-plan.md](./memory-index-backfill-plan.md) 的 Tier 0 **同批做**：先清退历史派生 chunk，再回填原始消息 chunk，一次 VACUUM 收尾。否则回填进来的证据仍要和旧散文竞争。

---

### 7.9 派生记忆的总量控制：三层精华模型（**补 §7.8 缺失的另一半**）

> §7.8 解决的是"每一条派生物是否够精"，本节解决"派生物总共该有多少条"。**两者缺一不可**——只做 §7.8 会得到 500 条各自都很精致的 insight，那仍然不是精华。

#### 7.9.1 现方案的自相矛盾

§4.2 的 P9 原则明写"**处处有预算**：token、容量（slot 15 子主题 / 128 token、card 40 条）、上下文（context_pack ≤7%）"，但落到具体设计时：

| 机制 | 用户画像（§9） | 派生 insight（§7） |
|---|---|---|
| 数量硬上限 | ✅ peer card ≤ 40 条 | ❌ **无** |
| 单条长度上限 | ✅ slot > 128 token → re-summary 到 ≤64 | ❌ **无** |
| 超限触发重组 | ✅ 子主题 > 15 → organize | ❌ **无** |
| 常驻层 / 按需层分离 | ✅ card 常驻，slot 按需 | ❌ **无** |
| 时间衰变 | ✅ | ⚠️ 只有 `valid_to=+30d`，**只影响检索权重，不影响存在与总量** |

**画像走了"少而精"路线，派生 insight 没走。** 这是方案的一处内部不一致。

#### 7.9.2 业内共识：几乎所有成熟系统都是"常驻小层 + 按需大层"，且常驻层有硬上限

| 项目 | 常驻层（小、always available） | 按需层（大、检索可达） | 容量机制 |
|---|---|---|---|
| Hermes | `MEMORY.md` **2200 字符** + `USER.md` 1375 字符 | SQLite FTS5 全量会话 | **写入超限直接报错**，强制 agent 自己合并后重试 |
| Honcho | peer card **≤ 40 条**（"六个月稳定"规则） | documents（explicit/deductive/inductive） | 条数上限 + 稳定性筛选 |
| Letta | memory blocks（`limit` 字符上限，可共享） | archival（向量，无限） | 块上限 + sleep-time agent 重写 |
| memobase | profile slots（**15 子主题/topic，128 token/slot**） | event 时间线 | 两级容量 → organize / re-summary |
| MemOS | WorkingMemory **20** | LongTermMemory 1500 / UserMemory 480 | `cleanup_threshold 0.8` + FIFO |
| MemoryOS | 短期 10 QA / 中期 2000 段 | 长期知识 deque(**100**) | LFU 淘汰 + heat 晋升 |
| MemoryScope | insight（键 = 属性名，数量 = 属性空间） | observation | 无显式上限，但属性名空间天然有界 |

**共识非常一致：常驻层 25–50 条量级，按需层 100–500 条量级。** 没有任何一个成熟系统让派生物无限增长。

对照本项目现状：**单用户 934 条派生 chunk**（且是散文碎片，不是原子 insight）。即使全部原子化，量级也比业内常驻+按需层的总和高一个数量级。

#### 7.9.3 三层精华模型

```
T0 常驻精华（Core Digest）        ≤ 40 条 / ≤ 4000 字符    零检索成本，always available
   └─ 内容：最稳定的身份、口径、长期结论（"MTR 项目估算单位是人天"）
   └─ 判据：高覆盖 + 高稳定（≥90 天未被推翻）+ 被实际使用过
   └─ 载体：peer card 的兄弟结构，同样注入 context_pack

T1 主题层（Subject Insights）      每活跃主题 ≤ 1 条；**每次查询候选 ≤200**（池子不设总量硬顶，见 §7.10.6b 细化 1）    默认检索范围
   └─ 内容：按主题键控、原地更新的当前结论（§7.8 F4 的产物）
   └─ 判据：主题近 90 天有活动，且 density 达标
   └─ 超限：按 density × heat 排序，末位降级到 T2

T2 归档层（Archived Derivations）  无上限                    默认不进检索
   └─ 内容：过期、被取代、低密度、长期未命中的派生物
   └─ 可达：仅 lifecycleMode ∈ {explicit_search, historical, audit}
   └─ 清理：superseded 超 180 天且零命中 → 物理删除（保留 history 指针）
```

**检索时默认只查 T0 + T1**，**单次查询面对的候选** ≤ 240 条——这就是你要的"第一层的量不会那么多"。相比现状每次都要在 934 条散文 chunk 里竞争，量级降一个档，且每条都是原子结论。

⚠️ **注意这里限制的是"每次查询的候选集"，不是"库里能存多少"**。库存永不硬删（§7.10.6b 细化 4），只是失去进入默认候选集的资格。这两件事被混为一谈是本方案早期版本的一个错误。

#### 7.9.4 分层判据：用"密度"而不是只用热度

业内用 heat（MemoryOS）、LFU（MemOS）、稳定性（Honcho）做晋升淘汰。这些都是**使用信号**，衡量的是"有没有被用到"，不是"这条本身多精华"。

本项目已有 `sources_json`（覆盖了哪些证据）与 `times_derived`，可以直接算一个更本质的量：

```
coverage(u)  = |distinct source episodes|          # 这条 insight 概括了多少条独立证据
span(u)      = max(observed_at) − min(observed_at) # 覆盖的时间跨度（天）
cost(u)      = token_length(u.text)                # 自身占多少上下文

density(u)   = coverage(u) / cost(u)               # 每 token 承载的证据数 ← 核心指标
stability(u) = days_since_last_contradiction(u)    # 多久没被推翻
```

**分层规则**：

| 动作 | 条件 |
|---|---|
| T1 → **T0 晋升** | `coverage ≥ 5` 且 `stability ≥ 90d` 且 `access_count ≥ 3`，按 `density` 排序取前 40 |
| 留在 **T1** | 主题近 90 天有活动，且 `density ≥ p25`（同期派生物的第 25 百分位） |
| T1 → **T2 降级** | 主题 90 天无活动 ∥ `density < p25` ∥ 被 supersede ∥ T1 超 200 条时按 `density × heat` 末位淘汰 |
| T2 → **物理删除** | superseded 且 > 180 天且 `access_count = 0`（保留 `memory_unit_history` 指针） |

用 `density` 做主判据的理由：**一条覆盖 50 条证据、跨 3 个月、只有 30 token 的结论，比一条覆盖 2 条证据的 200 token 长文更有资格常驻**——这正是"精华"的可度量定义。业内没有项目这么做（他们只用使用频次），但本项目因为已经强制了 `sources_json` 证据链（§4.2 P3），这个量是免费的。

#### 7.9.5 预算逼迫合并（借 Hermes，从画像层推广到 insight 层）

Hermes 的设计很值得抄：**写入超限不是静默丢弃，而是直接报错并回显当前内容，强迫 agent 自己合并压缩后重试**。容量压力反过来驱动质量。

落到本项目的睡眠期巩固：

```
夜间生成 insight 时：
  若 T0 已满（40 条 / 4000 字符）且新结论够格晋升
    → 不是简单挤掉末位，而是把「末位 3 条 + 新结论」一起交给 smart 档模型
      要求：合并成 ≤3 条，或明确说明新结论不如现有的、放弃晋升
  若 T1 超 200 条
    → 把同一主题簇内 density 最低的若干条打包，要求合并成 1 条或降级
```

这比"按分数硬截断"好在：**淘汰过程本身在产出更精华的东西**，而不是单纯丢信息。

#### 7.9.6 时间衰变作用于"存在"，而不只是"权重"

现方案的 §7.2 衰减只改检索权重（`R` 项），§7.5 给 insight 一个 30 天 TTL。补强：**衰变要驱动分层迁移**——

- `insight` 的 30 天 TTL 到期后不是直接消失，而是**触发一次再评估**：若其覆盖的证据仍然有效且主题仍活跃 → 重新推导并续期；否则降级到 T2。这对齐 GA 的 reflection 可再被反思，也避免"到期即丢"导致的知识断层。
- T1 的"主题近 90 天有活动"本身就是时间衰变的体现——**不活跃的主题自动腾出常驻名额**，无需人工清理。

#### 7.9.7 目标量级对照

| | 现状（单用户实测） | 三层模型目标 |
|---|---|---|
| **单次查询面对的**派生候选数 | **934 条散文 chunk**（全部同池竞争） | **≤ 240 条原子 insight**（T0 40 + T1 每查询 200） |
| 派生物**库存**上限 | 无（无限累积散文） | **不设硬顶**，但超出资格的降级到 T2，不进默认候选 |
| 单条平均长度 | 757–2350 字符 | ≤ 200 字符（T0 ≤ 100） |
| 同一主题的副本数 | 最多 26 份 | **1 份**（主题键控 + 原地更新） |
| 派生物占索引比例 | 99.9% | 目标 &lt; 30%（回填原始证据后自然稀释，§ backfill plan） |
| 常驻上下文成本 | 无常驻层 | ≤ 4000 字符 ≈ 1000 token |

#### 7.9.8 与既有章节的关系

- §7.8（单条质量）+ §7.9（总量控制）**必须一起做**，只做一半都得不到"精华"。
- T0 与 §9.2 的 peer card 是**兄弟结构**（一个装用户模型，一个装工作结论），共用容量控制与晋升机制的实现。
- §7.8.4 的权重反转在此基础上更合理：`derived_atomic` 能拿到 1.0–1.6 的权重，是因为它已经通过了 T0/T1 的密度筛选；T2 的派生物权重直接为 0（不进默认检索）。
- 实施顺序：F1–F5（止血）→ F4 主题键控（这是 T1 成立的前提）→ 三层分层与 density 计算 → 预算逼迫合并。前两步在 P0/P1，后两步随 `memory_units` 迁移落地。

---

### 7.10 "无限派生 + 检索侧过滤"可行吗？（证据裁决，**修正 §7.9 的两处设计**）

> 反向假设：**可不可以无限派生（发散思维），不做总量控制，纯靠分层/衰变/重排在检索时兜底？**
> 结论：**字面意义的"无限派生"被证据驳倒；但"自由生成 + 永不硬删 + 严格限定可检索层"是可行的，而且正是证据支持的方案。** 这个修正版与 §7.9 只差三处，但那三处很关键。

#### 7.10.1 为什么字面意义的"无限"对**本项目**不成立——三条独立链条

**链条一：本项目的检索栈恰好是最脆弱的那一类。**

| 研究 | 设定 | 稠密向量检索的表现 |
|---|---|---|
| `arXiv:2607.26497`（BM25 Wins at Scale） | 28 层嵌套语料，1,144 → 511,959 文档，**问题与相关文档固定不变** | DenseRAG **58.1 → 29.9**；BM25 74.7 → 50.5；HippoRAG2 66.2 → 41.0 |
| `arXiv:2608.12888`（ReFind，LongMemEval S→M） | 50 → 500 会话 | **纯向量 RAG 80.0 → 26.7（−53.3）**；GraphRAG −17.3；HippoRAG2 −13.3；纯 BM25+agent 迭代 −3.9 |
| `arXiv:2605.07313`（Scale-Conditioned Eval） | **证据固定**，阶梯加入 0→400 条无关会话 | HippoRAG Pass@B 掉 16–20 个百分点；而层级式检索接口配强 agent（LiCoMemory）**78.6→78.5**，几乎持平 |

规律一致：**派生结构越重、越依赖纯向量，规模退化越陡。** 而本项目用的是 384 维 MiniLM——比这些研究里的 embedder 都弱，且 `arXiv:2311.18364` 直接测过 `all-MiniLM-L12-v2` 这一族，k-skewness **8.79–20.98**（hubness 严重）。

⚠️ 需要澄清一个常被误引的反例：经典 IR（Hawking & Robertson 2003）确实发现 **P@n 随语料变大而上升**。但那是"相关文档密度恒定"的 regime。派生记忆若只是复述已有内容，属于**纯稀释**（相关密度下降）；只有当它真产生了新的可回答内容，才是密度保持型。**这个区分是整个问题的关键。**

**链条二：派生内容恰好是最有害的那类干扰物，而检索侧的两个主要兜底手段会让它更糟。**

- `arXiv:2401.14887`（Cuconasu, SIGIR'24）：**语义相似但不含答案**的干扰段落，**仅一条**即造成最高 **−25%**，累进最多 −67%。这正是派生记忆相对原始证据的关系。
- ⚠️ 广为流传的"随机噪声反而有帮助"**已被推翻**：`arXiv:2607.03615`（SIGIR 2026 复现研究）证明该效应换 instruct 模板/现代模型后即消失，"无法被稳健确认"。**不要用它论证保留噪声。**
- **Source bias 有因果证据**：`arXiv:2310.20501`（SIGIR'24）在语义等价的人写/LLM改写配对上，神经检索器系统性把 LLM 文本排更高（ANCE Relative Δ **−47.0**）；`arXiv:2503.08684`（ICLR 2025）用工具变量识别证明"**语义等价时低困惑度文档因果性地获得更高相关性分数**"。
- **致命的两条推论**：① 该偏置在 **reranker 阶段更严重**；② `arXiv:2405.16546`（Cocktail, ACL'24）1000+ 实验测得**检索器越强、source bias 越重（Pearson r = −0.772）**。
  ⇒ **Philosophy B 的三个兜底机制里，"上更强的 reranker"和"换更强的 embedder"这两个会让问题变糟，不是变好。**
- 动态版本更糟：`arXiv:2404.10496`（Spiral of Silence, ACL'24）显示 LLM 文本在迭代中持续挤占排名、逐步边缘化人写内容——**这正是本项目随时间会发生的事**（现状 99.9% 派生 chunk 就是终局形态）。

**链条三：主要瓶颈根本不在检索时。** `arXiv:2605.24579`（WhenLoss）四条件诊断：**6 个基线中 4 个是"写入侧损失 > 检索侧损失"**。Philosophy B 把赌注押在较小的那个瓶颈上。`arXiv:2608.30508`（UtilMem）进一步显示：即使正确证据被成功检索，系统仍频繁无法区分有用证据与"貌似合理的干扰项"——**读取时再筛也救不了**。

**没有任何生产系统跑通过字面意义的 B**：
- 微软 GraphRAG 社区摘要数**随语料近似线性增长**（C3 层 token 量达源语料 67–74%，根本不是压缩）→ 动态社区选择（token 降 77%）→ **LazyGraphRAG（干脆不生成摘要**，索引成本降至 0.1%）。三步都在往回退。
- **Mem0 v3 是最有力的反例**：它公开宣称"UPDATE/DELETE 改在检索时用多信号排序处理"（Philosophy B 的原话，出自厂商），**约半年后上线了 "Dream" 后台整合**，理由正是它当初说不要紧的那个退化——"陈旧和重复记忆**占据检索槽位**"、"中位活跃项目携带数百条重复或矛盾的记忆"、"**写入路径结构上看不到全局，所以写时过滤无法解决**"。其 issue #4573 的生产审计更触目：32 天、**10,134 条记忆、97.8% 是垃圾**；"User prefers Vim" 有 **808 条（191 条完全相同）——而没有人用 Vim**（2B 模型幻觉一次 → 进召回上下文 → 抽取器当 ground truth 再抽 → 每轮放大）。**换更强模型没救**（垃圾率 97.6%→89.6%）。
- **Generative Agents 在自己的局限性章节里就报告了退化**（§7.2 原文："synthesizing an increasingly larger set of memory... potentially making their behavior **less believable over time**"）。且其真实规模仅 25 agent × 2 游戏日、单 agent 单日约 912 节点，检索是 **O(N) 全量打分**，从未报告任何规模曲线。Park 后续的 1,052 人研究**直接放弃了 memory stream**。
- **Honcho 从无界改成 40 条硬上限**，代码注释原文：`# Hard cap to prevent unbounded peer card growth from repeated agent updates.`
- **Letta 的反向教训**：PR #621 加了 15–25 个记忆文件的硬目标，**五周后 PR #1123 整个删掉**；但其生产 agent（约 **39K 消息**，与本项目同量级）退化到每轮 46 个 pin 文件 / 73KB，整理后降到 4.3KB/4 文件（**−94%**），结论是**最高价值的操作是把条目降级出常驻层**。

**关于"投机性派生日后会派上用场"——这个论点几乎没有实证支持，相邻文献都指向相反方向：**
- **Serendipity 是重排序属性，不是语料属性。** Kotkov 2018 的方法自称就是 "serendipity-oriented **reranking**"；阿里 PURS（RecSys 2020）把 unexpectedness 注入**排序阶段**。**找不到任何 serendipity 方法是靠扩大候选池实现的。**
- **Zettelkasten"积累更多笔记会产生意外连接"没有任何受控实证验证**（跨 OpenAlex/arXiv/PubMed 检索）。只有定性的 information-encountering 文献描述 serendipity 发生，不检验"存更多投机材料是否导致更多 serendipity"。
- **Append-only 可以差于没有记忆**：TEPA（`arXiv:2608.07429`）受控漂移实验——append-only **0.210**，**无记忆 0.309**，带撤销 0.950。CTIM-Rover（REALM'25）在 SWE-bench Verified 上仅用洞见蒸馏**降了 11 个点**。
- **所有经典 reflection 系统都是有界且主动删除的**：Reflexion 上限 Ω "**usually set to 1–3**"；ExpeL 洞见重要度归零即删；Voyager 只在自验证成功后入库。
- **唯一测量过"派生知识后来真被用上"的工作**（AWM，`arXiv:2409.07429`）utility rate 0.94/0.91，但工作流只有 **7.3–7.4 条**，且其质量准则明写"**fewer workflows is better**"。**这就是"有效派生记忆"的实证画像：小、去重、无冗余。**
- **Sleep-time compute 有饱和点**：Letta 论文实测"**5 个并行生成通常优于 10 个**"——更多投机性离线生成反而更差。
- ⚠️ **生成式重放（DGR）被误读**：它生成的是**逼近已经历数据分布**的样本，是有损压缩重建，**不是新颖的投机内容**。用它论证"发散联想"是范畴错误。
- **生物学同样不支持"全部保留"**：Richards & Frankland 2017（*Neuron*）逐字："**the goal of memory is not the transmission of information through time, per se. Rather, the goal of memory is to optimize decision-making. As such, transience is as important as persistence.**"

#### 7.10.2 修正版可行，且这才是证据支持的形态

**"自由生成、永不硬删除、但严格限定常驻层与默认可检索层，其余靠衰减降低可及性 + 显式深搜可达。"**

支撑：`arXiv:2604.00131`（Oblivion, EMNLP 2026 主会）把遗忘建模为**衰减驱动的可及性下降而非显式删除**，在 120K 交互跨度上 token 成本降最多 73% 且优于基线；以及 **Ntoulas & Cho, SIGIR 2007** 的双层索引——小的剪枝索引处理多数查询，处理不了时下沉全量索引，实测在 **1.3 亿网页**上"**约 73% 的查询可用 30% 的索引回答**"且结果质量无退化。

#### 7.10.3 这对 §7.9 的三处修正

**修正 A（最重要）：派生文本不应作为独立条目与原文竞争同一检索池，而应"拼接进源条目的索引键"。**

LongMemEval 的消融给出了非常精确的规则：

| 做法 | 效果 |
|---|---|
| 用摘要/事实**替换**原始条目作为可检索值 | **QA 性能下降**（信息损失），唯一例外是跨会话推理题 |
| 派生的浓缩形式**单独**作为索引 key | **无提升** |
| **派生文本拼接到原始值上共同构成索引 key** | **检索 +4%、准确率 +5%** |
| 索引期合并 vs 检索期 rank fusion | **索引期合并更优** |

`arXiv:2502.05589`（SeCom, ICLR 2025）独立佐证：摘要式记忆在检索准确率与语义质量上都受限；对原始记录做主题分段优于摘要。

⇒ **§5.2 的 `memory_unit_views` 设计要改**：`view_kind='summary'` / `trigger_question` 不应作为**独立可检索单元**与 body 并列，而应作为**同一 unit 的索引键增强**（拼接进同一个 view 的文本，或在融合时按 unit 归并而非按 view 竞争）。这一条同时化解三个问题：source bias（派生文本不再单独参与排序）、fan effect（见下）、以及"派生物挤占检索槽位"。

**修正 B：我的 T1 ≤200 太紧了，比任何已发布系统都紧。**

| 系统 | 常驻层 | 可检索层 |
|---|---|---|
| MemOS | 20 | **10⁶** |
| Honcho | 40 | 无界 |
| Letta | 约 10% 上下文 | 整个 repo |
| **§7.9 原设计** | 40 | **200** ← 过紧 |

⇒ **放宽可检索层上限，把严格性放在常驻层与准入策略上。** 理由：Honcho 的 40 条上限从没人抱怨（真实部署约 7 条），因为**结构化准入过滤先于上限生效**；Hermes 的 2,200 字符总被撞满，因为它没有准入过滤。**准入策略比上限数值重要得多。**

且**界限应当用成本、延迟、确定性论证，不是质量**（这一点被上述 git 考古独立佐证：两个项目改动上限时都没给出质量理由，MemOS 唯一的相关消融还指向反面）——证据不支持剪枝带来质量提升：MemRefine 存储 70%→30% F1 大致中性；Experience-following 删除 65–77% 只损失 0.5–4pp（EHRAgents 反而 +0.74pp）；Selective Forgetting 在 27,021 节点图上剪 9.8% 节点，token F1 变化 **+0.001**（CI 跨零）。**而"只换检索器就让准确率从 58.1% 跳到 75.5%"（`arXiv:2607.29104`）——检索器的影响远大于记忆表示。**

**修正 C：晋升要靠"观察到的使用"，不是写入时的显著性。**

MemSIF（`arXiv:2608.01742`）把这命名为 **"Delayed Utility Manifestation"**——写入时的显著性不预测未来查询效用。Letta 正因如此杀掉了数量目标。

⇒ §7.9.4 的 `density` 判据要**加上使用信号**，且**最低成本的第一步是：给每个 unit 记录 `hit_count` / `last_hit_at`**。整个文献缺的就是这份利用率数据，而本项目可以免费拿到——这也是 §13.3 S3 消融实验的天然输入。

#### 7.10.4 一个被证据支持的额外洞察：伤害来自"未整合的平行堆积"，不是原始数量

认知科学的 fan effect（Anderson 1974）说每概念关联数越多、再认越慢。但 Radvansky & Zacks 1991 / Radvansky 2017 发现一个关键调节变量：**当事实能整合进单一情境模型时，"there was NO fan effect"——尽管关联数相同**。检索诱发遗忘也有同样调节：材料整合良好时反而出现 9–11% 的**促进**。

⇒ **这正是 §7.8 F4（主题键控 + 原地更新）的认知科学依据**：同一张 Jira 单的 26 份平行副本是"未整合堆积"（有害）；合并成 1 条持续更新的主题结论是"整合进单一情境模型"（无害甚至有益）。**所以要削的是"平行副本"，不是"派生总量"本身。**

#### 7.10.5 发散思维的正确形态：产出"边"和"问句"，而不是"文档"

如果目标是发散联想，**产物形态的选择比数量控制更重要**：

| 形态 | 检索成本 | 是否参与相似度竞争 | 适合发散 |
|---|---|---|---|
| 散文 insight（当前） | 高（占 chunk、占向量、占 RRF 槽位） | **是**，且因 source bias 系统性占优 | ❌ |
| **图上的边**（`edges`，带 fact 文本） | 极低（PPR 只在被种子激活时遍历） | 否 | ✅ |
| **触发问句**（`unit_views(trigger_question)`） | 低（只与 needSlot 意图匹配，不进 body 池） | 否（前提是按修正 A 归并） | ✅ |
| 假设/待验证问题（`open_question` unit，不进默认池） | 低 | 否 | ✅ |

⇒ **可以放开"发散"，但让它产出边与问句，而不是更多可检索文档。** 这与 §7.10.1 的 serendipity 证据一致（serendipity 是重排序/关联属性，不是语料规模属性），也与本项目已实装的 PPR 图召回天然契合。

#### 7.10.5b 发散/惊喜的实证基础（专项深挖，**给出可直接用的校准数字**）

对 serendipity / diversity 推荐系统文献做了一轮专项检索。结论**强化**了 §7.10.5，并补上三个可直接落地的数字。

**（1）整个领域的架构是"有界候选集上的重排序"——零例外。**

| 方法 | 候选池 → 输出 | 说明 |
|---|---|---|
| MMR（Carbonell 1998） | 检索结果 R → S | **构造上无法选出 R 之外的文档** |
| Topic diversification（Ziegler 2005） | **50 → 10** | 原文："top-50 input lists for eventual top-10" |
| **SOG**（Kotkov 2018） | **10 → 10** | 输出"contains the same items… in a (possibly) different order"——**纯排列，零新条目** |
| DPP（Hulu, NeurIPS'18） | 中位 **735–811 → 20** | |
| xQuAD/SPAD/CAD（2019） | **100 → 10** | |
| Taobao MPAD / Kuaishou CDM | 数百 → 一页 | 工业管线：Retrieval 百万 → Pre-rank 万 → Rank 千 → **Re-rank 百（多样化在这一层）** |

⇒ **业界的候选池:输出比集中在 5:1 ~ 40:1。** 对照本项目：若 Lens 展示 3 张卡，候选池应在 15–120 量级；§7.9 的"每查询候选 ≤200"配 top-10 输出是 20:1，**正落在区间内**；但配 top-3 输出就是 67:1，偏高。

**（2）文献明确说"池子更大是有害的"——这是对反向假设最直接的一击。**

Kotkov 2018 原文两处：

> "we expect n to be relatively small (**in our experiments n = 10**), as **by increasing n, one increases the chance of suggesting irrelevant (and therefore non-serendipitous) items to the user**."

> "with the increase of n, our algorithm is likely to pick items irrelevant to the user, **which is likely to repulse him/her**."

他们只允许一个例外：**用户显式发起的 "surprise me" 模式**，并注明它"会显著增加生成时间"且需要换基础算法。⇒ **无界探索是 opt-in 模式，不是默认架构**——这与 §8.1 把 deep 档留给用户显式发起是同一个道理。

**（3）"意外性"本身不是好东西，只在相关的前提下才有价值。**

Chen et al. WWW'19（淘宝，**2,348 份有效响应**，SEM 路径模型）的关键反直觉结果：**popularity 基线 HOT 被评为"最意外、与既往推荐最不同"，却在满意度与购买意愿上垫底**。原文："unexpectedness can reflect **unpleasant surprise**"。且多样性变量只喂给 unexpectedness（R²=0.14），**与 serendipity 没有直接关系**。

同源发现：Kotkov 的 8 种 serendipity 变体里，**"unexpectedness (relevant)"——即"用户不预期会喜欢"——是有害变体，被明确排除出优化目标**。

**（4）"意外连接有价值"最好的实验证据来自设计类比研究，而它是一条倒 U 曲线。**

这是"给你看一个意想不到的关联，能否帮你想得更好"最接近的受控实验：

- **Chan et al. 2011（J. Mech. Design，N=153）**：远距离类比 → 新颖度高于近距离（d=0.56），**但与"不给任何例子"的对照组无显著差异**；**对质量均值无影响**，只增加方差；且**减少产出数量**（d=−0.30）。
- **Fu et al. 2013（同范式）**：**近距离 > 远距离，质量 d=0.76（p=0.02）**；远距离甚至差于对照组。摘要原文：**"there is such a thing as too far… if the stimuli are too distant, they then can become harmful to the design process."**

⇒ **存在一个"甜区"，过远的联想会以可测量的幅度损害产出质量。** 这与 Ziegler 的满意度弧、Kotkov 的 serendipity-多样性非单调曲线完全吻合。

**（5）Zettelkasten / 双链笔记的"意外连接"——确认是民间智慧。**

对 OpenAlex / arXiv / PubMed 做了标题级与全文级检索：`"note-taking" AND ("serendipity" OR "unexpected connections")` **零结果**；`serendipity AND "personal knowledge"` **零结果**。而两份最相关的近期定性研究——Zhu et al. 2024（16 位 Roam/Tana 用户）与 Ferreira et al. 2025（IBM，Obsidian）——**"serendip" 与 "unexpect" 各出现 0 次**。存在的只有 LIS 的 information-encountering 文献（Erdelez 1999 等），**纯描述性、无对照、无结果度量**。

**（6）诚实标注：一个真正的反例，以及一个常被误引的引用。**

- **PURS（阿里优酷，RecSys'20）是唯一"意外性不以准确率为代价"的线上 A/B**：VV **+3.74%**、时长 **+4.63%**、意外性 **+9.74%**，而 **CTR 反而 +0.80%**。但它是**排序阶段的打分器，不是生成器**，仍在既有漏斗内。
- **Spotify WWW'20 常被误引**：diversity→留存的发现是**观察性的**（非因果，作者自己明确拒绝因果解读）；其**随机实验根本不是多样性干预**，且结果相反——**纯相关性排序完胜**（对 specialist 用户 +25.66% streams）。
- **Ziegler 2005 的"多样化提升满意度"也弱于通常引用**：user-based CF **无显著效应**；item-based 只在 ΘF=0.4 处有个 **p&lt;0.1** 的弧；ΘF=0.9 时满意度**低于**不做多样化的基线。
- 线上多样性干预的效应量普遍在 **+0.4% ~ +4%**，没有阶跃式收益。

**（7）对本方案的净影响**

不改变 §7.10.5 的结论（发散应产出"边"和"问句"而非文档），但补三条可执行约束：

| # | 约束 | 依据 |
|---|---|---|
| a | 候选池:输出比控制在 **5:1 ~ 40:1**；Lens 展示 3 张卡时候选池不应超过约 120 | 全领域一致的管线设计 |
| b | **发散/深挖必须是用户显式发起的 opt-in 模式**，不能是默认路径 | Kotkov 的 "surprise me" 例外 + 增大 n 有害的两处原文 |
| c | 任何"意外性"信号都必须**乘以相关性**，不能独立加分 | HOT 基线最意外却满意度垫底；"unexpectedness (relevant)" 是有害变体 |

#### 7.10.6 由此产生的待办（并入路线）

| # | 动作 | 依据 | 阶段 |
|---|---|---|---|
| 1 | **混合检索（BM25 + 稠密）优先级提到最高**——这是唯一同时解决规模退化与 source bias 的单项改动（词项检索无固有 source bias） | `arXiv:2607.16848`、`2607.26497`、`2508.17715` | **P0**（§8.3 加权 RRF 已在方案内，提前并单独验收） |
| 2 | 派生文本改为**索引键增强**而非独立条目（修正 A） | LongMemEval 消融 +4%/+5% | P1（改 §5.2 `unit_views` 融合口径） |
| 3 | 放宽 T1 上限，强化准入策略（修正 B） | Honcho vs Hermes 对照 | P1 |
| 4 | **给每个 unit 记录 `hit_count` / `last_hit_at`**（修正 C，最低成本） | MemSIF Delayed Utility Manifestation | **P0**（一列 + 一次 UPDATE） |
| 5 | 压实而非硬拒绝：超限时触发重摘要/合并，带 50% 迟滞 | memobase 15→8 / 128→64；Hermes 硬拒绝导致重试抖动与静默丢失 | P1 |
| 6 | 派生条目**保留溯源、丢结论不如丢依据**："keep the recomputable source, drop the re-derivable conclusion" | `arXiv:2606.25449`——保留结论而丢依据会让模型自信复述陈旧值，**空记忆至少会让它弃权** | P1 |
| 7 | 未验证的 reflection 设过期 + 必须引用具体 episodic 证据；来源排序 **user statement > agent inference** | `arXiv:2603.07670` 综述 | P1（§7.5 已部分具备） |
| 8 | （低成本可选）对 MiniLM 空间做 hubness 缩减：f-norm + Mutual Proximity | `arXiv:2311.18364` 在**同款模型**上降 hubness 69–83%、kNN 错误率 7–9%；scikit-hubness 有实现 | P2 |
| 9 | （进阶，无人做过）实现 Ntoulas & Cho 的**正确性指标**：从晋升池判断 top-k 是否可能与全量池不同，自动升级深搜 | SIGIR 2007 | P3 |

#### 7.10.6b 三处关键细化（补充调研后）

**细化 1：§7.9 的"≤200"有歧义，两种读法证据完全不同。**

| 读法 | 证据 | 裁决 |
|---|---|---|
| **每次查询返回的条数上限（top-k）** | Honcho 实际是 **40 常驻 / 每查询 100 条** working representation（`WORKING_REPRESENTATION_MAX_OBSERVATIONS = 100`，`search_memory` top_k 20、上限 40）；MemOS 20 常驻 / 每查询重建（rerank → LLM 过滤 → 30 槽缓冲 → top-20） | **保持**。40/200 与 Honcho 的 40/100 几乎重合，校准良好 |
| **整个可检索索引的总量上限** | **没有任何生产系统这样限制**：Honcho conclusion store 无界、Zep 无界、MemOS 生产配置 LongTermMemory = **10⁶** | **放宽**。严格性移到常驻层 + 准入策略 |

⇒ §7.9.3 的 T1 "全局 ≤200 条"应改为 **"每次查询的候选上限 ≤200，池子本身不设总量硬顶"**。

**细化 1b（git 历史考古验证，比横向对比更硬的证据）：真正被慎重设定的是"常驻层"，可检索层的上限被当作调参旋钮。**

对两个项目做了全历史 pickaxe（memobase 467 commits、MemOS 2,152 commits）：

| 事实 | 证据 |
|---|---|
| **memobase 确实是从无界起步的** | 首个上限之前的 `Config` 类**完全没有容量约束**，只有 `buffer_flush_interval` 与 `max_chat_blob_buffer_token_size`（写入批处理旋钮，不是容量帽） |
| memobase 的 slot 上限是**收紧**过的 | `max_pre_profile_token_size`：256（2025-01-14）→ 512（同日）→ **128**（2025-03-22），此后再未改动 |
| **MemOS 的 `WorkingMemory: 20` 在全部 2,152 个 commit 中只出现过一次**——初始公开提交（2025-07-06），**20 个月未变** | 这是两个项目里最强的 revealed-preference 信号 |
| 而**可检索层的上限被自由改动** | `LongTermMemory`/`UserMemory` 10000 → 1500/480（一次改动，**commit 与 PR 都没给理由**）；`APIConfig` 路径给 **10⁶**；官方示例配置给 20000/30000 |

⇒ **这个不对称本身就是结论**：常驻层的界限稳定、被慎重对待；可检索层的界限在 480 / 1500 / 20000 / 10⁶ 之间随部署路径浮动三个数量级，**MemTensor 自己都把它当调参旋钮而非原则性上限**。

**对本方案的直接含义**：
1. §7.9 的 **T0 ≤40 是值得慎重设定的那个数**（对齐 MemOS 20 / Honcho 40 的稳定区间）；
2. **T1 的池子上限不值得当作原则来定**——它应当由成本、延迟、确定性来论证，而不是质量；
3. 再次确认："**可检索池 200**"比任何已发布的实现都紧（最紧的 shipped 默认是 480）。

另注：MemOS 的 `MOS_ENABLE_REORGANIZE` **自引入起在两个调用点都默认 `"false"`**——层级重组默认不开。引用其"分层组织"能力时要注意这一点。

**细化 2：限制"产出率"而不只是"库存"——唯一有生产系统在跑的折中。**

MemOS 的 `dream` 模块不限存量，限**产出速率**：`trigger_threshold = 100`（每约 100 条原始记忆触发一次）、`max_motives = 3` ⇒ **每 ~100 条原始记忆产出 ≤3 条洞见（约 3%）**。对照 Generative Agents：reflection+thought 占记忆流 **16%**（且它自己报告了退化）。

⇒ 给出具体校准锚点：本项目 1.5 万条消息，按 **3%** 计约 **450 条**派生洞见（仍在运行的生产配置），按 16% 计约 2,400 条（自报退化的研究原型）。**建议采用 3% 的产出率上限作为 §7.4/§7.5 睡眠期巩固的硬预算**，比事后剪枝更自然。

**细化 3（最重要的策略修正）：设界的收益大小取决于检索器有多弱——所以"上混合检索"和"设界"必须联合决策。**

NPQE（SIGIR 2024, `arXiv:2407.12170`）的分层结果：
- 对**强检索管线**：剪枝只达到**统计等价**（TOST 检验）
- 对**弱／跨域检索器**（BM25、TAS-B on TREC-COVID）：剪枝**实质性提升质量**

机制：**移除干扰物只在排序器本身弱到无法过滤它们时才有大收益。**

⇒ 本项目现在是 384 维 MiniLM 的纯 top-k 余弦扫描，属"弱检索器"档，**设界收益明显大于文献平均**；但**一旦上了混合检索 + reranking，设界的边际收益会大幅缩水**。因此：

| 阶段 | 严格性放在哪 |
|---|---|
| 混合检索上线**前**（现在） | 可检索池要收紧——这是当前唯一能对抗弱排序器的手段 |
| 混合检索 + rerank 上线**后** | 严格性**转移**到常驻层与准入策略，可检索池放宽到 Honcho/MemOS 量级 |

**⇒ §7.10.6 待办表的第 1 条（混合检索）与第 3 条（放宽 T1）应作为一个联合决策执行，不要分开排期。**

**细化 4：证据其实比我前面写的更偏向 B 一侧。**

MemSIF 的 **"Delayed Utility Manifestation"**（写入时显著性不预测未来查询效用）是一个**反对写入时硬剪枝、支持"全都留着按需晋升"**的论点；配合 Mem0 "Dream" 博文的同向观察（写入路径看不到全局，写时过滤解决不了）与 `arXiv:2606.25449`（保留可重算的源、丢弃可重导的结论）：

> **证据实际支持的是"永不硬删除派生内容，但严格限制它进入默认检索路径的资格"**，而不是"生成时就少生成"或"生成后删掉"。

AMV-L（`arXiv:2603.04443`）把这个区分讲得最清楚——**eligibility control（哪些条目有资格参与检索）** 与 **injection control（多少条进入 prompt）** 是两回事，且**光有 prompt 上限不能阻止在大候选池上的昂贵检索**。§7.9 的三层模型正是 eligibility control；§8 的 topK/context_pack 预算是 injection control，两者都要有。

**细化 5：风险在"坏条目的复利"，不在体量——所以闸门要设在质量上。**

MemEvoBench（`arXiv:2604.15774`）记录了 **"memory misevolution"**：有偏记忆累积导致安全性实质退化，且**静态 prompt 防御无法修复**。配合 Mem0 issue #4573 的反馈放大链（幻觉一次 → 进召回上下文 → 抽取器当 ground truth 再抽 → 每轮放大 → 808 条"User prefers Vim"）：

⇒ **按质量设闸（准入过滤、证据接地、矛盾检测），而不是按数量设闸。** 数量上限只是兜底。

**细化 6：第三方产品的公开建议（可作对照，非硬证据）**

Anthropic 官方 memory tool 指南虽不设硬上限，但明确建议 "Track memory file sizes and cap how large a file can grow" 与 "Periodically delete memory files that haven't been accessed in a long time"，整体框架是 **just-in-time 检索**（不预加载、按需读取，`view` 在 16,000 字符处截断）。Cursor 的对应规则是 "Keep rules under 500 lines"、"Add rules only when you notice Agent making the same mistake repeatedly"。ChatGPT 的记忆上限**无法核实**（帮助页 JS 门控），属证据缺口而非"不存在上限"。

**⚠️ 引用 MemOS 时的告诫**：其**论文不给任何数值上限**，反而把容量限制列为 ChatGPT/Claude 记忆的**缺陷**；但代码里 WorkingMemory 硬编码为 20，且淘汰是 FIFO + `DETACH DELETE`（**永久删除**），并非论文所称的"归档到冷存储"。论文与代码矛盾，引用时以代码为准。

#### 7.10.7 证据薄弱处（**这些地方是类比推理，不是数据**）

1. **"摘要提高 hubness"零证据。** 链条前两环（LLM 文本低困惑度 / 低困惑度因果性提高分数）有扎实文献；第三环（因此派生记忆在本库里过度占据 top-k）是近距离类比。且 source bias 实验用的是**语义等价改写对**，而 reflection 与原始消息**不语义等价**（更抽象）。方向大概率对，**量级未知**。
2. **没有任何对派生记忆界限的大小/数量做过受控消融**——MemGPT、Zep、MemOS、memobase 全都没有。**§7.9 的 40/200 没有可对标的已发表先例**；最接近的锚点是 memobase 的 900 轮→28 槽，与 Governed Memory 的饱和曲线（0→3 条拿走全部增益，之后平坦且非单调）。
3. **没有实验证明"投机生成、当时无用"的条目后来被检索并帮上忙。** AWM 的 0.91–0.94 最接近，但那些 workflow 归纳自**已实际解决的任务**，不是投机产物。
4. LongMemEval-M 子集**只有 15 题**，那个 −53.3 虽远超噪声但 CI 宽。
5. 2026 年的 `26xx.xxxxx` 系列多数**未经同行评审**（已在文中标注哪些是 SIGIR/EMNLP/ICML/KDD 2026 录用）。

---

### 7.11 正反方综合裁决：三个决策要分开做（**全部调研的收敛点**）

前面几轮调研在两个方向上都攒了硬证据。把它们摆在一起会显得互相打架，但**一旦把"派生记忆"拆成三个独立决策，两边的证据各自归位、完全不冲突**。这是整个 §7 的收敛结论。

#### 7.11.1 两边的证据

| 正方（该收敛：有界、策展） | 反方（该放开：无界、按需晋升） |
|---|---|
| 纯稠密检索规模退化最陡：**58.1→29.9**、**80.0→26.7** | **剪枝的质量收益很弱**：存储 70%→30% F1 中性；删 65–77% 只损 0.5–4pp；剪 9.8% 节点 F1 **+0.001**（CI 跨零） |
| 语义相似但不含答案的干扰物**一条即 −25%** | **"只换检索器就把准确率从 58.1% 拉到 75.5%"**——检索器影响远大于记忆表示 |
| source bias 有因果证据（−47.0），且 **reranker 更严重、强检索器更严重（r=−0.772）** | **MemSIF "Delayed Utility Manifestation"**：写入期显著性不预测未来效用 ⇒ 反对写入时硬剪枝 |
| 无生产系统跑通无界：微软退到 LazyGraphRAG；Mem0 半年后上线 Dream 压实；GA 自报退化；Honcho 加了 40 硬顶 | **git 考古**：两个项目改可检索层上限时**都没给质量理由**；MemOS 可检索层在 480/1500/20000/10⁶ 间随路径浮动 |
| append-only 可差于无记忆（0.210 vs 0.309）；经典 reflection 系统全部有界（Reflexion Ω=1–3） | **Oblivion（EMNLP 2026）**：衰减驱动的可及性下降 **优于**显式删除，token 成本降 73% |
| 增大候选池被明文指为有害（Kotkov 两处原文）；serendipity 稀有（≤12.9%）且单纯意外性有害 | **"保留可重算的源、丢弃可重导的结论"**：丢依据留结论会让模型自信复述陈旧值，**空记忆至少会弃权** |

#### 7.11.2 收敛：拆成三个决策，两边各自正确

| 决策 | 谁赢 | 具体做法 |
|---|---|---|
| **① 生成（generate）** | **反方** | 自由派生、**永不硬删除**。唯一约束是**产出率**：每约 100 条原始记忆 ≤3 条洞见（MemOS 生产配置的 3%；GA 的 16% 自报退化）。1.5 万条消息 ⇒ 约 450 条洞见 |
| **② 资格（eligibility）** | **正方** | 严格限定**谁有资格进默认候选集**：T0 常驻 ≤40（这个数定死）、T1 每查询候选 ≤200、其余降级 T2 仅显式深搜可达。**这是 §7.9 三层模型的真正含义** |
| **③ 注入（injection）** | **正方** | 候选池:输出比 **5:1 ~ 40:1**；context_pack ≤7% 窗口；Lens 展示 3 张卡时候选不超过约 120 |

AMV-L 把 ②③ 的区分讲得最清楚：**光有 prompt 上限（③）不能阻止在大候选池上的昂贵检索（②）——两者都要有。** 而反方的所有证据攻击的都是"在 ① 阶段硬删"，正方的所有证据攻击的都是"在 ② 阶段不设限"。**两边从来没有真正冲突过。**

#### 7.11.3 一条贯穿始终的判据：按质量设闸，不按数量设闸

- 数量上限**只是兜底**，且应当用**成本、延迟、确定性**论证——git 考古确认两个项目改上限时都没给质量理由，MemOS 唯一相关消融还指向反面。
- 真正的风险是**坏条目的复利**（MemEvoBench 的 "memory misevolution"；Mem0 那 808 条"User prefers Vim"）。**闸门要设在准入质量上**：入口过滤、证据接地、矛盾检测、主题键控。
- 且设界的收益**与检索器强度反相关**（NPQE：强管线下剪枝只达统计等价，弱/跨域检索器下剪枝实质提升）。⇒ **现在（纯 MiniLM 余弦扫描）设界收益大；上了混合检索+rerank 之后收益缩水，届时严格性从"池子大小"转移到"准入策略"。**

#### 7.11.4 由此确定的执行顺序（**与 §12.1 联动**）

```
P0  混合检索(BM25+稠密) + 中文分词 + multilingual-e5-small   ← 单项收益最大，且不涨维度
    ＋ 给每个 unit 记 hit_count / last_hit_at                ← 一列，是后续一切晋升判据的输入
    ＋ §7.8 F1/F2 止血（一行门槛 + Runs 不进索引）
        ↓
P1  派生重构：主题键控、原地更新、依附型派生物改索引键增强
    ＋ 产出率上限 3%
    ＋ 三层资格分层（T0 定死 40；T1 每查询 200；T2 深搜可达）
        ↓
P2  条件触发：eval 显示表征仍是瓶颈 → 才考虑 bge-m3 / MRL 截断
    ＋ hubness 缩减（与模型正交，可提前）
    ＋ reranker（已降级为可选，且它会放大 source bias，必须在派生重构之后）
```

**顺序中的两处不可交换**：① 派生重构必须在表征升级之前（否则给最强干扰物配更好的眼镜）；② `hit_count` 埋点必须在任何晋升机制之前（否则晋升只能靠写入期显著性，而那被证明不预测效用）。

---

## 8. 检索 v2：从"页面像什么"到"用户此刻需要什么"

### 8.1 RetrievalPlan 契约（所有 surface 共用）

```ts
interface RetrievalPlan {
  surface: 'lens_passive' | 'lens_selection' | 'compose' | 'ask' | 'meeting_fast' | 'context_pack' | 'mcp_search';
  mode: 'fast' | 'balanced' | 'deep';          // 决定通道、over-fetch、是否 rerank、延迟预算
  needSlots: NeedSlot[];                        // 信息需求槽位（what）
  queries: { text: string; weight: number; source: 'page'|'selection'|'need_template'|'user'|'rewrite' }[];
  anchors: { entities: string[]; issueKeys: string[]; people: string[]; projects: string[]; timeRange?: [number, number] };
  filters: { scope?: string; kinds?: Kind[]; authorityMax?: Authority; lifecycleMode: LifecycleMode; exclude: string[];
             asOf?: number /* 时间点查询："T 时刻为真"（Graphiti SearchFilters 语义），缺省 now */ };
  budget: { ms: number; topK: number; contextTokens?: number };
  rerank: 'none' | 'cross_encoder' | 'llm_listwise';
  explain: boolean;
}
interface NeedSlot { kind: 'caliber'|'decision'|'blocker'|'owner'|'deadline'|'history'|'preference'|'procedure'|'open_question'|'freeform';
  question: string; anchors?: string[]; weight: number; }
```

### 8.2 InformationNeedPlanner（when 与 what 分离）

- **when** 沿用现有 admission gate + Scene Autopilot（做得好，不动）。
- **what** 新增 planner，按 surface 生成 needSlots：
  - `lens_passive`：按 `SceneFrame.sceneType` 查**需求模板**（确定性、可配置）。例：`jira_issue_reading` → [caliber("这张票的估算/口径是什么"), decision("关于 <issueKey> 做过什么决定"), blocker("<issueKey> 有什么阻塞或风险"), owner("谁负责 <issueKey>")]；`ringcentral_group_chat` → [history("这个群最近在讨论什么"), open_question("有什么在等我回"), procedure("在这个群里的沟通口径")]；`web_reading` → [freeform(页面标题+前 2 句), preference("我对 <topic> 的立场")]。模板项自带 anchors 占位，由 SceneFrame 的 issueKey/people/projects 填充。
  - `lens_selection`：queries=[选中文本]；needSlots=[freeform]；背景只作过滤不作查询（沿用产品语义）。
  - `ask`：QueryIntentParser（沿用）+ **可选 cheap 改写**：仅当 `MemoryContextMatchService` 返回 ambiguous 或 query 含指代时，1 次 cheap 调用产出 2–4 条"第三人称存储语言"关键词查询（Mem0 recall-protocol 的四步重写），超时 300 ms 放弃。
  - `meeting_fast`：mode=fast，只 FTS + trigger_rules，无向量、无 rerank（弹幕场景）。
  - `context_pack`（宿主注入）：needSlots=[preference, procedure, history(今日)], budget.contextTokens ≤ 1500。
- 每个 needSlot 的 `question` 同时作为**触发问句通道**的查询（§8.3），这就是"先探测用户会问什么再检索"落到零 LLM 的实现。

### 8.3 多视图混合召回与融合

```
候选（并行，over-fetch = max(4·topK, 32)）：
  V_body   : unit_views_vec(view_kind=body)              ← queries
  V_trig   : unit_views_vec(view_kind=trigger_question)  ← needSlot.question（意图对齐通道）
  F_seg    : unit_views_fts (Intl.Segmenter 分词)        ← queries + anchors
  F_tri    : unit_views_fts_tri（≥3 字短语）              ← 票号/项目名/人名
  G_ppr    : edges 上 PPR（damping 0.5 沿用现状；种子 = anchors 实体 + query→edges_fts/边向量命中的 fact 两端实体，
             种子权 = Σsim/df（HippoRAG 2 特异性）；unit 节点入图并全部作弱 seed（0.05×归一化相似度）；取 unit 节点的 PPR 值）
  T_time   : timeRange 命中的 units
  R_rules  : trigger_rules 关键词/正则命中（确定性，直接进入候选并标 rule_hit）
准入：cos ≥ 0.30；FTS 需 ≥1 个 distinct 词（≤2 词查询）或 ≥2 个
融合：rrf(u) = Σ_c w_c / (60 + rank_c(u))     w = {V_body .35, V_trig .25, F_seg .15, F_tri .10, G_ppr .15}
      关系型/多跳问句（"和哪个需求变更有关"）：G_ppr .40, V_body .25, 其它按比例
rel(u) = minmax(rrf) 同查询归一化
score(u) = w_authority(surface, u.authority) · w_lifecycle(mode, u.tier) · w_kind(needSlot, u.kind)
         · [0.55·rel + 0.25·R_u(t) + 0.20·prior_u] · (1 + 0.3·ctx_sim)

# prior_u：冷启动用写入期 salience，随实际命中数据累积而让位（见下）
prior_u = (1 − λ_u)·sal_u + λ_u·utility_u ,  λ_u = min(1, hit_count_u / 5)
utility_u = 正向结局数 ÷ (展示数 + 1)      # 由 §8.6 的反馈埋点提供      # ctx_sim: 同群/同项目/同时段的编码特异性
去重：同 unit 多视图取最高；同 episode 来源多 unit 取前 2；MMR λ=0.7
反馈：recall_quality 负反馈 ×0.3（沿用）；场景负反馈 patch（沿用 RecallRelevancePatchService）
```

`prior` 项的设计依据 MemSIF 的 **"Delayed Utility Manifestation"**——写入期 salience 不可靠地预测未来查询效用，因此它只作**冷启动先验**，命中 5 次后完全让位给实测 utility。这也解决了 §7.10 修正 C 与本公式原先固定用 `sal` 的冲突。

`w_authority`：evidence 1.0 / self_confirmed 1.15 / derived {passive .6, compose .7, ask .85}——**这是 §7.8 生产重构完成前的临时护栏**；重构完成后 `derived_atomic` 反转为 passive 1.0 / compose 1.2 / ask 1.6，详见 §7.8.4。`w_lifecycle` 沿用 `MemoryLifecyclePolicy`。`w_kind`：needSlot=caliber 时 procedure ×1.5、decision 时 decision ×1.5 等（需求模板自带）。

### 8.4 重排策略（按 surface）

| surface | mode | rerank | 延迟预算 |
|---|---|---|---|
| `meeting_fast` | fast | none | p95 < 120 ms |
| `lens_passive` / `lens_selection` | balanced | **none**（reranker 已降级为 P2.5 可选项，见 §12.2） | p95 < 500 ms |
| `compose` | balanced | none（可选 cross_encoder） | p95 < 800 ms |
| `ask` | deep | 可选 cross_encoder / `llm_listwise`（cheap，只回位置整数，temp 0）——低 QPS，是最值得先试 reranker 的面 | p95 < 2.5 s |
| `context_pack` / `mcp_search` | balanced | none | p95 < 400 ms |

cross-encoder 输入可拼入情境特征（域名 / 群名 / 活跃项目 / needSlot.kind），使其从"相关性"变成"此刻有用性"排序。

### 8.4b 表征层升级路线：384 维 MiniLM 到底该怎么换（**回应"比这些研究里的 embedder 都弱"**）

原方案只把 `all-MiniLM-L6-v2` 当作**语言不匹配**问题处理（§10.3「多语言 embedding」），**没有当作检索强度问题处理**。但 §7.10.1 的证据显示这是两个独立的问题：

| 问题 | 症状 | 解法 |
|---|---|---|
| **语言不匹配** | 英文模型编码中文群聊；FTS5 `porter unicode61` 把整句当 1 个 token | 换多语言模型 + 中文分词（已在 §10.3） |
| **检索强度弱** | 纯稠密在规模研究里退化最陡（58.1→29.9 / 80.0→26.7）；`all-MiniLM-L12-v2` 一族 k-skewness **8.79–20.98** | 见下 |

#### 8.4b.1 一个必须先讲清的悖论

§7.10.1 的证据说"**换更强的 embedder 会让 source bias 更糟**"（Cocktail 1000+ 实验，检索器越强偏置越重，r = −0.772），而这里又说"MiniLM 太弱要换"。**这两句不矛盾，但顺序绝不能反**：

> source bias 度量的是"**在同一个池子里，LLM 文本 vs 人写文本谁排前面**"。
> 只有当派生文本仍以**独立条目**身份与原始证据同池竞争时，这个偏置才有伤害面。
> §7.10 修正 A 把依附型派生物改成**索引键增强**之后，池子里不再有"LLM 文本 vs 人写文本"的对抗——**偏置的作用面被结构性消除了**，此时升级 embedder 只剩收益。

⇒ **硬顺序：先做 §7.8/§7.9/§7.10 修正 A 的派生重构，再考虑升级表征强度。** 在 99.9% 索引是派生散文的现状下升级 embedder，等于给最强的干扰物配一副更好的眼镜。

#### 8.4b.2 候选方案与约束

关键约束来自 sqlite-vec 是**暴力扫描**：维度直接线性影响每次查询的扫描成本，实测 384 维 float32 在 <50 ms 下的天花板约 25 万条向量（§10.4）。升维不是免费的。

| 方案 | 维度 | 相对 MiniLM | 存储/延迟代价 | 建议 |
|---|---|---|---|---|
| **multilingual-e5-small** | **384** | 中文显著改善；英文相当 | **零**（同维，不改表） | **P0 采纳**——它解决的是"语言不匹配"这个当前最大误差源，且无成本 |
| bge-m3 | 1024 | 中文与跨语言明显更强 | 向量体积与扫描成本 **×2.7**；int8 量化后 ≈ ×0.67 | **P2 条件采纳**：仅当派生重构完成后 eval 仍显示表征是瓶颈 |
| Qwen3-Embedding-0.6B | 1024 | 规模研究里用的档次 | 同上 + 推理成本高（0.6B 参数本地推理） | 单机 + 25 个用户库的部署下**不建议** |
| 强模型 + Matryoshka 截断到 384 | 384 | 介于两者 | 零额外存储 | **P2 优选**——若 bge-m3 之类支持 MRL，截到 384 可保住大部分收益而不涨成本 |
| **hubness 缩减**（f-norm + Mutual Proximity） | 不变 | 同款模型上降 hubness **69–83%**、kNN 错误率 **7–9%** | 近零（一次性预处理 + 查询期轻量变换） | **与模型选择正交，任何阶段都可做**；scikit-hubness 有实现 |
| **混合检索（BM25 + 稠密）** | — | 两个规模研究里 BM25 退化最慢；**词项检索无固有 source bias** | 已在 §8.3 | **单项收益最大，P0 优先于任何模型升级** |

#### 8.4b.3 结论：三步走，且顺序不可交换

1. **P0：混合检索 + 中文分词 + multilingual-e5-small。** 这三件事都不增加维度、不增加扫描成本，且混合检索是唯一同时缓解"规模退化"与"source bias"的单项改动。**先做这一步，再谈模型强度。**
2. **P1：完成派生重构**（§7.8/§7.9 + 修正 A）。这一步把 source bias 的作用面结构性消除，是升级表征的前置条件。
3. **P2（条件触发）：只有当 §13.3 S3 的消融实验显示"表征仍是瓶颈"时**，才考虑 bge-m3 或 MRL 截断方案，并同步做 int8 量化抵消体积。**hubness 缩减可以随时插入，与模型无关。**

⚠️ 任何一次模型或量化变更都必须触发 §4.4 C6 的**阈值重标定**（0.30 准入、0.80/0.85/0.90/0.92 去重阶梯全是 MiniLM float32 口径），并用 `memory_units.embedding_model` 隔离新旧向量——**不同模型的向量之间永不比较相似度**。

---

### 8.5 展示门控与自适应阈值

- 用**相对阈值**替代硬编码：候选 `score < 0.40·top1` 丢弃；`percentile(75) − 1.5·std` 为地板；`min_results=1`（passive）/4（ask）。p1/p2 由 `whyRelevant` 锚点 + `rrf` 通道数决定（≥2 通道且有锚点 → p1），不再看绝对 0.35/0.55。
- `trigger_rules` 命中的 `procedure` 走 SillyTavern WI 语义：sticky/cooldown 防重复弹、预算 ≤ 15% 卡片位、同组只留一条。
- Autopilot 的 silent/chip/card/context_pack 语义、Compose 互斥、敏感页拦截全部沿用。

### 8.6 反馈学习（learned ranker）

- 每次展示写 `recall_training_cases(features_json, shown, action)`——features 就是 §8.3 的各分量（rel、R、sal、authority、lifecycle、通道命中位图、needSlot.kind、scene anchors 重合数、age、source_type）约 15 维。
- 夜间用逻辑回归拟合"thumb up / opened / used_in_ask" 为正、"irrelevant / dismissed" 为负（处理位置偏差：只用 rank ≤3 的样本）；产出线性权重覆盖 §8.3 的 0.55/0.25/0.20 与 `w_c`；样本 < 200 时不启用；权重变化 > 30% 时先灰度。
- 这条闭环让 `recall_training_cases` 从"写后不读"变成排序的输入。

### 8.7 延迟预算核算（被动 Lens，balanced，本机实测系数）

| 步骤 | 预算 |
|---|---|
| planner（模板 + SceneFrame） | < 5 ms |
| embedding 查询（1–3 条，本地 ONNX） | 20–40 ms |
| V_body + V_trig（int8，≤ 30 万向量/表） | 2 × ≤ 12 ms |
| F_seg + F_tri | 2 × ≤ 10 ms |
| G_ppr（邻接缓存） | ≤ 20 ms |
| 融合 + MMR + 门控 | < 10 ms |
| 合计（无 rerank） | ≈ 100 ms；加 cross-encoder ≈ 300–400 ms |

---

## 9. 用户画像供给链：让 `user_profile_items` 不再枯竭

### 9.1 现状的 7 个断点与对策

| # | 断点（代码事实） | 对策 |
|---|---|---|
| 1 | 供给源默认关（`INGEST_LLM_EXTRACTION_ENABLED`、`REFLECTION_DEFAULT_ENABLED` 默认 false） | 抽取成为主管线（§6），无开关；反思改为预算制而非开关制 |
| 2 | Glip 主流量不带 owner 信号 → `profile_candidates` 门永远关闭 | 服务端用 claim 归属判定 owner（`owner_kind=self`），不依赖前端 `authorRole` |
| 3 | 全部落 `pending_confirm`，消费方只吃 `active+confirmed`，无自动晋升 | explicit 自述 → 直接 `active`（Honcho）；inferred → `candidate`，`times_derived ≥ 2` 或用户任一正反馈 → `active`；仅 `kind=inductive` 需要确认 |
| 4 | ×0.96/日衰减，约 50 天归档 | slot 不按日衰减；按 `last_confirmed_at` 分层展示（fresh / stable / stale），180 天无确认才 `stale`，不归档 |
| 5 | USER_CORE "Current Focus" 7 天窗口 | 优先 7 天；不足 5 条按 sal 回填 30/90 天并标 `(stale, last seen …)` |
| 6 | `social_edges` 无自动来源 | 由 `edges(kind=social)` 自动产生：同群互动频次 + 直接 @ + 抽取的 works_with/reports_to 关系 |
| 7 | 抽取 JSON 失败静默丢弃；无供给指标 | 失败保底落 raw unit（§6 ④）；`supply_metrics` 日报 + 枯竭报警 |

### 9.2 Deriver 流程（借 Honcho deriver + memobase 槽位）

```
§6 ④ 的 profile_candidates（explicit 原子事实，来自 owner 自述）
  → 精确/语义去重（cos ≤ 0.05 距离 → times_derived++，last_confirmed_at=now）
  → 本批一次 cheap 调用：把候选与目标 slot 现值打包 → N. APPEND|UPDATE::memo|ABORT
      · UPDATE 写 history(update_type=conflict|extract)，version++
      · 允许集外 topic → misc/unsorted 溢出桶（不丢弃），夜间归类
  → 容量控制：topic 子主题 > 15 → organize（1 次 cheap）；slot > 128 token → re-summary 到 ≤ 64 token
  → 夜间（§7.3 heat ≥ 5 的簇 或 三重门）：
      deduction（standard）：知识更新（旧 slot superseded_by 新）、矛盾成对标 contradiction、必然结论（带 premises）
      induction（standard）：跨 ≥2 来源的模式/偏好，confidence 2→low, 3-4→medium, 5+→high
      card refresh（standard，≤ 每周 1 次）："六个月稳定"规则筛入 peer card（≤40 条，前缀 IDENTITY:/ATTRIBUTE:/RELATIONSHIP:/INSTRUCTION:）
```

### 9.3 槽位 schema（面向工作助理，可配置）

| topic | sub_topics（示例） | update_description |
|---|---|---|
| `identity` | role, team, manager, timezone, languages | 变化即 UPDATE，保留旧值到 history |
| `work_focus` | active_projects, current_priorities, recurring_meetings | 以最新为准，APPEND 新项目，超 8 项 organize |
| `communication` | tone_by_audience, preferred_channel, reply_style, language_by_person | 一人一格；矛盾时以 user_confirmed 为准 |
| `tools_process` | jira_conventions, estimate_caliber, release_process, ai_tools | 口径类同时编译为 `trigger_rules` |
| `relationships` | collaborators, stakeholders, reports | 由 edges(social) 投影，不由 LLM 自由写 |
| `preferences` | likes, dislikes, constraints | Honcho explicit 直进 active |
| `opinions` | stance_on_<topic>, trust_in_<person> | 复用 `opinion_items` 语义，valence 可变 |
| `misc/unsorted` | — | 溢出桶，夜间归类 |

### 9.4 读路径与投影

- `ProfileContext.build(budget)`：peer card 全量 → 按 `profile_event_ratio`（默认 0.6/0.4）分配 slot 与近期 event units → slot 按 `times_derived desc, last_confirmed_at desc, cos(query)` 混排（Honcho working representation 的 1/3 语义 + 最常 derived + 最近）。零 LLM，Redis 无则用进程内 20 min 缓存。
- `USER_CORE.md` / `CORE_MEMORY.md` 由 slots + card 渲染（投影），供 OpenClaw bootstrap 注入（[agent-task-ledger-plan.md §13.6](./agent-task-ledger-plan.md) 的验收：>1 KB 且 Current Focus ≥ 3 条真实条目）。
- 供给指标：`profile_extracted / reinforced / new / aborted / parse_failed / superseded` 日计数；连续 3 天 `new+reinforced=0` 且 `episodes>0` → 报警到 notification lane `notice`。

---

## 10. 存储：能不能撑住 1.4 GB 与 10× 增长

### 10.1 先测再改：线上构成脚本

```bash
# 在线上 DATA_DIR 执行（sqlite3 CLI 需带 DBSTAT；better-sqlite3 已编译 SQLITE_ENABLE_DBSTAT_VTAB，可用 node 跑同 SQL）
f=$DATA_DIR/users/esone.qiu/memory.db
ls -lh $f $f-wal
sqlite3 $f "PRAGMA page_size; PRAGMA page_count; PRAGMA freelist_count;"
sqlite3 $f "SELECT name, ROUND(SUM(pgsize)/1048576.0,1) mb FROM dbstat GROUP BY name ORDER BY mb DESC LIMIT 40;"
# 向量孤儿率
sqlite3 $f "SELECT (SELECT COUNT(*) FROM messages_vec_rowids) vec_rows, (SELECT COUNT(*) FROM messages_raw) msgs,
            (SELECT COUNT(*) FROM chunks_vec_rowids) chunk_vecs, (SELECT COUNT(*) FROM chunks) chunks;"
# 事件/遥测类体量
sqlite3 $f "SELECT 'notification_records',COUNT(*) FROM notification_records UNION ALL SELECT 'proposed_actions',COUNT(*) FROM proposed_actions
  UNION ALL SELECT 'reflection_runs',COUNT(*) FROM reflection_runs UNION ALL SELECT 'rc_directory_users',COUNT(*) FROM rc_directory_users
  UNION ALL SELECT 'memory_change_events',COUNT(*) FROM memory_change_events UNION ALL SELECT 'source_memory_events',COUNT(*) FROM source_memory_events;"
```

**预期构成假设**（按实测系数：float32 384 维 ≈ 1.54 KB/向量；正文存 ~2.5 份 = `messages_raw.content` + `chunks.content` + FTS ≈45%）：若 1.4 GB 中一半是向量 ⇒ ≈ 45 万向量——这已经站在 float32 <50 ms 天花板（≈25 万）之上，**与 R5/性能感受吻合**。开发快照另提示：`rc_directory_users`（非记忆）、运维事件表、35% 碎片页都是可立即回收的部分。

### 10.2 三库分离 + 年份归档

| 库 | 内容 | 理由 |
|---|---|---|
| `users/<id>/memory.db`（热） | L0–L5：episodes（≤18 个月）、units、views、fts、vec、entities、edges、properties、slots、lifecycle、feedback、briefs | 记忆真源；备份/导出/删除边界清晰 |
| `users/<id>/ops.db` | notifications、proposed_actions、reflection_runs/attempts、workers/leases、agent_*、provider_sync_jobs、outreach_*、ambient traces、recall_training_cases | 高写入、可 TTL、与记忆语义无关；崩了不丢记忆 |
| `shared.db`（全局） | rc_directory_*、model_pricing、skill 平台绑定 | 组织级数据不该按用户复制（开发快照里占 13%） |
| `users/<id>/archive-YYYY.db` | 18 个月以上的 episodes + 对应 chunks/fts（只读） | 仅 `lifecycleMode=historical|explicit_search|audit` 时 ATTACH；**不跨库事务**（WAL 下非原子） |

units 不归档（它们是压缩后的知识，量级比 episodes 小 1–2 个数量级）；被 archive 的 episode 在 unit.sources_json 里保留指针，需要原文时按年份库回查。

### 10.3 向量与全文的具体整改

| 项 | 做法 | 收益 |
|---|---|---|
| 单份向量 | 只嵌 `unit_views`（body + trigger_question）；删除 `messages_vec`；消息 chunk 不再嵌入 | 向量字节 −50% 起（去重）|
| int8 量化 | `unit_views_vec ... embedding int8[384]`，`vec_quantize_int8(v,'unit')`；换 multilingual-e5-small 后自测召回损失（MiniLM 未为量化训练） | −75%；查询 ×3 快 |
| partition key | `scope TEXT PARTITION KEY`；再按 `status`、`view_kind` metadata 预过滤（替代 JS 后过滤） | 扫描范围缩到 1/2–1/5 |
| 多语言 embedding | `EMBEDDING_MODEL=Xenova/multilingual-e5-small`（384 维，同维不改表；e5 需 `query:`/`passage:` 前缀）；`embedding_model` 列隔离新旧向量；全量重嵌为一次夜间 Batch 任务 | R5 的根治 |
| 中文全文 | 写入前 `Intl.Segmenter('zh',{granularity:'word'})` 预分词进 unicode61 表（查询同分词器）+ trigram 表兜底 ≥3 字短语；票号/项目名走 keywords 视图 | 词法通道对中文从"失效"到可用 |
| FTS 维护 | 夜间 `INSERT INTO fts(fts) VALUES('merge', N)` 分步；月度 `optimize` | 索引碎片 |
| 页缓存 | `PRAGMA cache_size=-262144; PRAGMA mmap_size=268435456; journal_size_limit=67108864` | 多 GB 库读性能 |
| VACUUM | 月度 `VACUUM INTO` 新文件后原子替换（复用 MemoryBackupService 的 reader-gap） | 回收 35% 碎片 |

### 10.4 容量天花板与升级路径（本机实测系数，云 vCPU 打 2–3 折）

| 每用户向量数（等效 float32） | 方案 |
|---|---|
| ≤ 25 万（int8 ≤ 75 万） | **留在 SQLite + sqlite-vec**：§10.3 整改 + partition。多数个人用户长期停在这一档 |
| 25 万–200 万，或 p95 > 100 ms | **SQLite 仍是真源 + 每用户一个 usearch 索引文件**（HNSW，i8/b1，`view()` mmap 零加载；用 unit_view id 作 key；过滤靠 SQLite 回表）；同时观察 sqlite-vec 0.1.10 `rescore`（bit 6×、无插入代价）转稳定后原地替换。DiskANN alpha 仅评测（插入慢 90–120×、DELETE 昂贵） |
| > 200 万，或需跨用户分析/多进程写 | LanceDB 每用户一目录（IVF_HNSW_SQ + ICU/jieba FTS + RRF）；Postgres+pgvector 仅在需要集中运维时 |
| 只读归档分析 | DuckDB 读 Parquet 化的年份库（vss 持久化不成熟，不做索引） |

结论：**不需要按用户再分片**（已是每用户一文件）；**不需要现在换引擎**；需要的是单份向量、量化、分区、三库分离、归档、GC 与维护常态化。

### 10.4b 事故止血：三个已确认缺陷的修复设计（2026-09-03 线上实测后新增）

#### (1) `rehearsal_activations` 失控写入（195 万行 / 850 MB / 活库 64%）

**这不只是空间问题，更是在线延迟问题**：该表有 3 个索引，每次 `INSERT` 要同步更新 3 棵 B-tree，而这个写入发生在**被动 `/context-recall` 的同步路径上**——每一次 Lens 召回都在为它付写放大的代价。

修复分三步，前两步可独立上线：

**① 写入侧去重（代码改动，无数据风险）**

```ts
// RehearsalService.recordMatchedActivation 改为 upsert 语义
// 新增唯一索引：UNIQUE(rehearsal_id, scene_key, surface)  ← scene_key 已存在且区分度足够
const DEDUP_WINDOW_SEC = 3600;   // 同场景 1 小时内重复命中不新建行
// 逻辑：
//   SELECT id, created_at FROM rehearsal_activations
//    WHERE rehearsal_id=? AND scene_key=? AND surface=? AND outcome='matched'
//    ORDER BY created_at DESC LIMIT 1
//   命中且 now - created_at < DEDUP_WINDOW_SEC
//     → UPDATE ... SET score=?, display_priority=?, matched_cues_json=?, updated_at=now,
//                      repeat_count = repeat_count + 1      ← 新增列，保留"重复命中"这个信号
//     → 返回既有 activation.id（调用方 toContextRecallMatch 仍能引用）
//   否则 → 原有 INSERT
```

关键点：**重复命中不该被丢弃，而应成为加固信号**（与 §4.2 P5 一致）——用 `repeat_count` 记录，而不是每次新建一行。`rehearsals.activation_count` 的自增逻辑保持不变，语义仍是"总命中次数"。

**② 按用途拆分写入频率（可选，进一步降压）**

`recordMatchedActivation` 当前同时承担两个职责：(a) 给本次返回的 match 提供一个可被反馈引用的 `activation_id`；(b) 留存激活遥测。(a) 是必需的、每次都要有；(b) 不需要每次落盘。建议 (b) 改为按 `(rehearsal_id, day)` 聚合到 `rehearsal_activation_daily(rehearsal_id, day, surface, matched_count, shown_count, p1_count, last_score)`，明细只保留有用户实际交互（`outcome != 'matched'`，即 opened/useful/irrelevant）的行。

**③ 历史数据清理（破坏性，需所有者明确授权后执行）**

```sql
-- 先取证：确认哪些是纯噪声（outcome 始终停留在 'matched'、无任何用户交互）
SELECT outcome, COUNT(*) FROM rehearsal_activations GROUP BY outcome;
-- 保留有交互价值的行 + 每个 (rehearsal_id, day) 的聚合，其余归档删除
CREATE TABLE rehearsal_activations_keep AS
  SELECT * FROM rehearsal_activations WHERE outcome != 'matched'          -- 有用户动作的
  UNION ALL
  SELECT * FROM rehearsal_activations WHERE id IN (                       -- 每天每个预演留一条代表
    SELECT id FROM (SELECT id, ROW_NUMBER() OVER (
      PARTITION BY rehearsal_id, date(created_at,'unixepoch') ORDER BY score DESC) rn
      FROM rehearsal_activations WHERE outcome = 'matched') WHERE rn = 1);
-- 校验行数与抽样后再 DROP/RENAME，最后 VACUUM 回收空间
```

预期效果：195 万行 → 数千行量级，活库从 1.3 GB 降到 ~450 MB（−65%）。**执行前必须先做一次可验证的完整备份**（§10.4c），且应在低峰期停写窗口内进行。

#### (2) `lost_and_found` 孤儿数据（155,133 行）

这是 SQLite `.recover` 的产物，列名是 `rootpgno/pgno/nfield/c0..cN` 这种通用形态，**应用代码永远不会读到它们**。处理原则：

1. **先判定价值**：按 `nfield`（列数）分组，对照 schema 猜测原表——`lost_and_found_1` 有 34 列，量级最接近 `messages_raw`（当前 34 列左右）；`lost_and_found_0` 有 19 列。抽样 `c0..c5` 的内容形态（UUID？时间戳？中文正文？）确认。
2. **能对上就回填**：写一次性脚本按列位映射回原表，`INSERT OR IGNORE`（靠主键去重），并给回填行打 `metadata_json.recovered_from='lost_and_found_N'` 标记以便追溯。回填后这些记忆才真正重新可检索。
3. **对不上就导出后删除**：导出为 JSONL 存档到备份卷，再 `DROP TABLE`，回收 ~15 MB 并消除误解风险。
4. **无论哪条路径都需要所有者授权**——这涉及往生产表写入历史数据。

#### (3) `messages_raw` 的 922 行坏时间戳

`timestamp < 946684800`（2000-01-01）的行基本是 epoch 0 占位值，会污染所有按时间的召回/统计（`T_time` 通道、时间范围过滤、`observed_at` 推断）。修复：一次性脚本按 `metadata_json` 里的原始时间字段或 `created_at` 回填；确实无法恢复的置为 `created_at` 并标 `metadata_json.timestamp_recovered=true`。同时在 `IngestionPipeline` 入口加断言：`timestamp <= 0 || timestamp < 946684800` 时用 `now` 兜底并记 warning，防止再产生。

### 10.4c 备份与性能设计（针对"单用户目录 7.0 GB"）

**现状分层**（实测）：

| 类别 | 现状 | 问题 |
|---|---|---|
| 活库 | `memory.db` 1.3 GB | 64% 是 §10.4b(1) 的噪声 |
| 托管例行备份 | `AutoBackupService`，15 min 一轮，`VACUUM INTO` + `liveDb.backup()` 兜底，默认保留 7 份并 `pruneRetention` | **机制健全**，无需改造 |
| **事故残骸** | 6 份 `.broken-` / `.corrupt-` / `.repair-bak-` / `.pre-fts-rebuild-` / `.pre-recover-`，合计 **5.7 GB** | **不在托管体系内**（只有 `.pre-fts-rebuild-` 来自 `tools/fts-rebuild.mjs:27`，其余是人工事故处置产物），无命名规范、无保留期、无完整性校验、与活库同卷同盘 |

**设计原则（新增，写入运维契约）**：

1. **事故快照必须进入托管体系**：统一命名 `incident-<YYYYMMDDTHHMMSS>-<reason>.db`，统一落到 `data/backups/incidents/`（与例行备份分目录），并写一条 `backup_manifest` 记录（原因、触发人/脚本、当时的 `integrity_check` 结果、活库大小）。所有维护脚本（含 `fts-rebuild.mjs`）改为调用同一个 `createIncidentSnapshot()` 帮助函数，而不是各自 `cp`。
2. **事故快照的保留期**：默认保留最近 2 份 + 90 天内的全部，超期自动清理；清理前校验"是否已有更新的、通过 integrity_check 的备份存在"。以当前 6 份为例，按此策略只需保留 2 份（约 2.6 GB → 可再压缩），立即释放约 3 GB。
3. **备份必须自证可用**：每次备份完成后跑 `PRAGMA quick_check`（全量 `integrity_check` 太慢，按周做一次）+ 关键表行数断言（`messages_raw`、`memory_units`、`entities` 非零且不低于上一份的 90%），结果写进 manifest。**对一个有反复损坏史的库，未经校验的备份等于没有备份**。
4. **压缩与去重**：事故快照与超过 7 天的例行备份用 zstd 压缩（SQLite 备份通常压到 25–40%）；多份高度相似的快照建议用 `restic`/`borg` 做去重仓库（6 份相似的 1.3 GB 快照去重后通常 &lt; 2 GB）。
5. **异盘/异地**：当前备份与活库在同一个 docker named volume（`personal-ai_memory-data`）——盘坏即全损。至少把每日一份推到不同卷或 NAS/对象存储。
6. **恢复演练**：每月自动把最新备份恢复到临时目录、跑 `quick_check` + 行数断言 + 一次真实 `/recall` 冒烟查询，结果记入 manifest。演练失败即告警。
7. **增量同步**：SQLite 3.47+ 的 `sqlite3_rsync` 可对在线库做增量同步，比每次全量 `VACUUM INTO` 省 I/O；作为 P3 可选优化。

**性能设计**：

1. **写放大是当前最痛的点**，不是库大小本身。修掉 §10.4b(1) 后，被动召回路径上每次请求少写 1 行 + 3 个索引更新，这是直接的在线延迟收益。
2. **`journal_mode=delete` 需要重新评估**：当前非 WAL（活库无 `-wal`/`-shm`），大概率是 virtiofs 时代损坏事件后的稳定性妥协。但**部署早已从 bind mount 换成 docker named volume**（`personal-ai_memory-data`），当初的理由可能已不成立。delete 模式的代价是：每次写事务创建/删除 journal 文件，且**读写互斥**——夜间巩固的批量写会阻塞前台被动召回的读。建议：在测试环境用相同卷类型验证 WAL 稳定性（跑一轮完整巩固 + 并发读，然后 `integrity_check`），确认无误后再切回 WAL，并配 `journal_size_limit` 防止 WAL 无限增长。**不要在没有验证的情况下直接改生产**。
3. **PRAGMA 调优**（两种模式下都适用）：`cache_size=-262144`（256 MB）、`mmap_size=268435456`。当前代码只设了 `journal_mode`/`synchronous`/`foreign_keys`。
4. **索引审计**：`rehearsal_activations` 的 3 个索引占 270 MB。修复后应重新评估 `idx_rehearsal_activations_scene`（81 MB）是否仍需要——去重后按 `(rehearsal_id, scene_key, surface)` 的唯一索引会覆盖大部分查询。
5. **`chunks_vec` 碎片重建**：235 MB 装 3799 行，vec0 分块碎片化导致利用率 &lt;5%。重建方式：`CREATE TABLE chunks_vec_new ... ; INSERT SELECT ... ; DROP; RENAME`（迁到 §5.2 的 `unit_views_vec` 时天然解决）。
6. **全表扫描类操作要有时间预算**：`dbstat` 在 1.3 GB 上跑了 &gt;120 s。任何进入夜间巩固的全表操作都必须分批 + 可中断 + 记录游标（§7.1 已有此原则）。

### 10.5 级联与 GC（吸收 memory-cascade-deletion-plan）

- 删除 episode：级联 units（sources 全部指向它的）→ views/fts/vec → edges 证据引用 → properties 证据 → briefs 引用重算队列（`recompute_queue`，现有计划里未实现的部分）。
- 删除 unit：history 保留（redaction），views/vec 立删，slots/properties 引用 retract。
- 夜间 GC 校验：`views 无 unit`、`vec 无 view`、`fts 与 content 行数一致`、`edges 端点存在`；不一致即修复并计数上报。

---

## 11. 接入分发：memory-service 作为记忆中台

### 11.1 适配器模式（抄 Mem0，改为指向自托管服务）

```
memory-adapters/
  adapter-core/        # TS：evidence buffer(SQLite/JSON) · 脱敏(SECRET_PATTERNS) · scope 注入 · flush worker(脱离进程) · fail-open · 回执
  openclaw-plugin/     # plugins.slots.memory 候选；before_prompt_build → /context-pack；agent_end → buffer → /ingest/batch；工具 memory_search(只读)+memory_save(显式)
  claude-code-plugin/  # hooks(SessionStart/UserPromptSubmit/Stop/PreCompact/SessionEnd) → buffer；.mcp.json 指向 memory-service MCP（只暴露 memory_search + memory_context_pack）；skills /memory:remember|search|forget（disable-model-invocation）
  cursor-codex-rules/  # MCP 配置 + rules 文本（recall protocol / triage protocol）
  hermes-provider/     # 实现 Provider ABC：prefetch(context_pack) · sync_turn(ingest/batch) · on_session_end · on_memory_write(镜像 USER.md 条目为 profile slot)
```

原则（每条都是 Mem0 插件 0.2→0.3 的教训）：宿主 hooks **不调模型**，只做捕获/脱敏/分批/重试；宿主 LLM 只拿**一个只读 `memory_search`**（描述命令式："ALWAYS call before answering anything that could depend on prior context"），写入交给服务端抽取；显式"记住"走 skill/工具 `memory_save(infer=false)`；召回通过 `additionalContext/prependContext` 注入，`context_pack ≤ 1500 tokens`、会话内已注入去重、identity/procedure 类始终包含；`PreToolUse updatedInput` 强制补 scope；fail-open（"memory must never prevent the host from continuing"）。

### 11.2 MCP 工具面收敛

| 工具 | 语义 | 变化 |
|---|---|---|
| `memory_search` | 只读，`readOnlyHint:true`，返回 units + 来源回执，≤ 500 字/条 | 沿用 `/recall`，默认 `mode=balanced` |
| `memory_context_pack` | 零 LLM 拼装（profile + procedure rules + 近期 focus），token 预算 | 新增；替代宿主自己拼 |
| `memory_save` | 显式保存（`infer=false` 原文 + 可选分类），进 ingest 队列 | 沿用 `/ingest`，sourceType 增 `openclaw`/`claude_code`/`hermes` |
| `memory_ask` / `memory_evidence_get` / `memory_profile_hint` | 沿用 | |

鉴权沿用 `pak.` 个人密钥与 OAuth scope；新增 `agent self-onboarding`（Mem0 `init --agent --json` 的思路：宿主 agent 申请受限评估 key，人类事后认领）作为可选项。修复：`'openclaw'` 来源类型加入 `/ingest` 枚举；`mcp_access_log` 在 HTTP 路径也写。

### 11.3 与 OpenClaw 三档（L1/L2/L3）的关系

沿用 [agent-task-ledger-plan.md §13.7](./agent-task-ledger-plan.md)：L1（读增强）= `openclaw-plugin` 的 `before_prompt_build → context_pack`；L2（写镜像）= `agent_end → ingest/batch`；L3（接管 memory slot）= 插件同时提供 `memory_search/memory_save` 工具并禁用 memory-core。本方案的 §5.5 投影导出保留为零插件过渡。

---

## 12. 迁移路线（每阶段可停、可回滚）

| 阶段 | 内容 | 门（进入下一阶段的条件） | 回滚 |
|---|---|---|---|
| **P0 止血（1 周）** | **⓪ 已实测确认（2026-09-03），本项最高优先级**：查清 `INGEST_LLM_EXTRACTION_ENABLED`/`INGEST_EMBEDDING_ENABLED` 何时被关闭并复核是否应重新开启；给 `RehearsalActivationService.recordMatchedActivation` 加 `(rehearsal_id, scene_key)` 去重/防抖（代码改动，可先做）；就 195 万行 `rehearsal_activations` 历史数据、5.7 GB 备份文件、`lost_and_found` 孤儿表的清理征得所有者授权后执行；① 线上按 §10.1 实测并记录基线（已完成，见 §2.8）；② `RECALL_ROUTE_SAFE_MODE_ENABLED` 是否应继续强制纯 FTS 需重新评估（关掉它 embedding 才有意义）；③ 向量 GC（孤儿、`messages_vec` 遗留、两处泄漏路径、`chunks_vec` 碎片重建）；④ `EMBEDDING_MODEL` 换 multilingual-e5-small + 全量重嵌（夜间）；⑤ FTS 预分词 + trigram 表；⑥ `rc_directory_*` 迁 shared.db；⑦ 确认 journal_mode 现状（delete，非 WAL）后再决定是否 VACUUM／改 WAL；⑧ 通道融合改加权 RRF（RecallEngine 一处） | `context-recall` eval 不回退；被动 Lens 有真实候选；`rehearsal_activations` 不再净增长；派生 chunk 不再净增长；DB 体积下降 ≥ 30% | 开关回退；embedding 列带 model 名可并存 |
| **P0.5 探针（3–5 天）** | 现有 chunks 上离线生成触发问句 + `V_trig` 通道（flag 控制）+ A/B/C 消融（§13.3 S3/S5） | **触发问句相对意图模板增量 ≥5%**；否则否决该设计并缩减 P1 | 关 flag |
| **P1 记忆单元 + 写入 v2（3–4 周）**（**须等 P0.5 结论**） | `memory_units/views/history/lifecycle/edges/profile_slots` 建表；ExtractionBatchWorker（§6）双写：新 units 入索引，旧 chunks 继续写但不再嵌入；TruthMaintainer 收口；浏览器抽取降级 hint；LLMClient tier 路由 + strict JSON + 缓存；供给指标 | `memory-abilities` 六能力不回退；units_new/日 > 0 且 parse_failed < 5%；抽取 token/日在预算内 | 停 worker 即回到旧路径（chunks 仍在） |
| **P2 检索 v2（3 周）** | RetrievalPlan + planner 模板（先 jira/ringcentral/web 三类场景）；多视图召回 + 触发问句通道；权威/生命周期加权；自适应阈值；`recall_training_cases` 接通；**表征强度升级为条件触发项**（仅当消融显示表征是瓶颈，见 §8.4b.3）；**cross-encoder 已降级为可选且必须在派生重构之后**（它会放大 source bias） | Lens thumb-up 率 / useful@1 ≥ 基线 +30%（eval + 线上 7 天）；p95 < 500 ms | `RETRIEVAL_V2=false` 回旧排序 |
| **P3 巩固 v2 + 存储三分（3 周）** | 阶段 A–E 替换 ConsolidationEngine 对应阶段；有证据 anticipation；ops.db 拆分；archive-YYYY；GC 常态化；.md 停止入索引 | 夜间 token 成本 ≤ 目标；召回不回退；存储月增速 ≤ 目标 | 阶段白名单逐个回退 |
| **P4 分发（2 周）** | adapter-core + openclaw-plugin（L1+L2）+ claude-code-plugin；MCP 收敛 | OpenClaw 会话能引用 ≥1 条 memory-service 记忆；宿主侧 0 次模型调用 | 卸插件 |
| **P5 清理** | 删旧表/旧列/死代码；文档（`docs/memory_system.md` 业界对比章节过时，一并更新） | 全量 eval 绿 | — |

双写期规则：读路径优先 units，units 为空时回退 chunks（fail-open）；所有新表带 `schema_version`；迁移脚本幂等可重跑。

### 12.1 P0 执行清单（按依赖顺序，每步可独立验证与回滚）

> 依据 2026-09-03 线上实测（§2.8、§2.10）与代码审计（§6.3）。**结论先行：当前"召回不匹配"的首要原因不是排序或表征，而是 2026-07 起新消息根本没有进入任何检索索引**（§2.10.1）。因此 P0 的目标是"让新记忆重新可被检索"，而不是优化排序。

#### 第 1 组：代码改动（不碰生产数据，可先合并、随时回滚）

| # | 改动 | 文件 | 验收 |
|---|---|---|---|
| 1.1 | **解耦 salience 与 LLM 抽取**：把 `IngestionPipeline.ts:304` 的 `if (!skip \|\| scoreSkippedArtifact)` 拆开，使分块/FTS/salience 这条确定性链路不依赖 LLM 抽取是否开启 | `IngestionPipeline.ts:268,300-323` | 抽取关闭时 `shouldIndex` 仍可为 true；`chunks`/`chunks_fts` 正常增长 |
| 1.2 | **修字段契约 bug**：`metadata.sentiment` 嵌套错位、`metadata.importance` 从未发送（§6.3.5） | `messageDealing.ts:1910-1915,1294-1299` + `IngestionPipeline.ts:291-293` | `messages_raw.importance` 不再恒为 0.5、`sentiment` 不再恒为 neutral |
| 1.3 | **删掉浏览器 LLM#2**，改用 LLM#1 已输出的 `json.entities`（§6.3.2 步骤 A） | `messageDealing.ts:1876,1909` | 每条命中消息省 1–1.7K token；`metadata.entities` 仍非空 |
| 1.4 | **抽取 prompt 加输入截断**：`payload.content` 目前是裸插值无上限 | `IngestionPipeline.ts:772` | 单次 prompt 输入有确定上界 |
| 1.5 | **`rehearsal_activations` 写入去重**（§10.4b(1) ①）：按 `(rehearsal_id, scene_key, surface)` + 1 小时窗口 upsert，新增 `repeat_count` 列 | `RehearsalService.ts:411-440`、新 migration | 压测：同场景连续 100 次召回只产生 1 行 |
| 1.6 | **`EmbeddingClient` 启动 warmup**，或给 `/context-recall` 一条可配置的冷启动路径 | `EmbeddingClient.ts`、`ContextRecallService.ts:756` | 服务重启后首个被动召回请求向量通道不再 `embedding_unavailable` |
| 1.7 | **事故快照统一入口** `createIncidentSnapshot()`（§10.4c 原则 1），`tools/fts-rebuild.mjs` 改为调用它 | `tools/fts-rebuild.mjs:27`、新 helper | 新产生的快照有规范命名、落 `data/backups/incidents/`、写 manifest |
| 1.8 | **坏时间戳入口断言**：`timestamp <= 0` 时用 `now` 兜底并 warning（§10.4b(3)） | `IngestionPipeline.ts` 入口 | 不再新增 epoch-0 行 |
| 1.9 | **`phaseReflect` 输入门槛**（§7.8 F1）：`if (messageCount.count === 0) return 0;` | `ConsolidationEngine.ts:953-960` | 不再产出"今天无活动"填充（当前占反思文件 55%） |
| 1.10 | **`## Runs` 段不进索引**（§7.8 F2） | `ReflectionThreadService.ts:2024-2054` | 反思线程 chunk 数下降约 60% |
| 1.11 | **给检索单元记 `hit_count` / `last_hit_at`**（§7.10 修正 C）——**这是后续一切晋升/淘汰判据的输入，必须最早做** | `chunks`/`memory_units` 加两列 + `RecallEngine` 命中时 UPDATE | 一周后能画出"派生 vs 原始"的实际命中分布 |
| 1.12 | **混合检索：加权 RRF 融合 BM25 + 稠密**（§8.3；§7.11.4 列为单项收益最大） | `RecallEngine.ts` 融合层一处 | `context-recall` eval 不回退且召回多样性上升 |

#### 第 2 组：配置变更（需先完成第 1 组，按顺序执行，每步观察 24h）

| # | 变更 | 前置 | 观察指标 | 回滚 |
|---|---|---|---|---|
| 2.1 | `INGEST_EMBEDDING_ENABLED=true` | 1.1 已上线 | `chunks_vec`/`messages_vec` 恢复增长；CPU 与写延迟 | 改回 false |
| 2.2 | `INGEST_LLM_EXTRACTION_ENABLED=true`，**全量 25 用户**（所有者已决策，无需 per-user 灰度） | 1.1/1.4 已上线；**日预算硬顶 + `usage_events` 告警必须先就位** | `entities`/`user_profile_items` 恢复增长；`usage_events` 中该 capability 的日 token 与成本 | 改回 false |
| 2.3 | `RECALL_EMBEDDING_COLD_START_ENABLED=true`（若 1.6 未采用 warmup 方案） | — | 被动召回 `channelDiagnostics.vector` 不再 skipped | 改回 |
| 2.4 | `.env` 里 `REFLECTION_ENABLED` 改名为 `REFLECTION_DEFAULT_ENABLED`（值保持 false） | — | 启动日志不再有 deprecation warning | — |
| 2.5 | `/recall` safe mode **不直接关闭**，改为按 `retrievalMode` 分档（§2.10.4 第 5 条） | §8.4 延迟预算表 | `/recall` p95 | 恢复强制 safe |

> ⚠️ 2.2 是唯一有直接金钱成本的变更。开启前必须确认：日预算硬顶已配置、`usage_events` 告警已接、且 §6.5 的 tier 路由至少让抽取走 cheap 档。历史教训：2026-08 一次忘配开关的部署烧掉约 $350/月（`config.ts:290-301`）。

#### 第 3 组：数据修复作业（破坏性；**所有者已预先授权全部 7 项**，但每项执行前必须有一次经 `quick_check` 校验的完整备份，校验未通过不得继续）

| # | 作业 | 预期效果 | 前置 |
|---|---|---|---|
| 3.1 | `rehearsal_activations` 历史清理（§10.4b(1) ③） | 195 万行 → 数千行；活库 1.3 GB → ~450 MB | 1.5 已上线（否则边清边长） |
| 3.2 | 事故快照按新保留策略清理（§10.4c 原则 2） | 释放约 3 GB | 1.7；且确认保留的快照通过 `quick_check` |
| 3.3 | `lost_and_found` 判定与回填/导出删除（§10.4b(2)） | 155,133 行孤儿数据要么回到可检索状态，要么归档后释放 ~15 MB | 需先完成价值判定 |
| 3.4 | 922 行坏时间戳回填（§10.4b(3)） | 时间通道与统计不再被污染 | 1.8 |
| 3.5 | **存量消息的重分块 + 重嵌回填** —— 已拆为独立文档：[memory-index-backfill-plan.md](./memory-index-backfill-plan.md) | 约 11,467 条从未进索引的消息恢复可检索（实测：仅 2026-03~06 有覆盖，7 月起归零） | 1.1 已上线（否则断供立刻重开）；**嵌入模型必须先定**（换模型 = 白做一次） |
| 3.6 | `chunks_vec` 碎片重建（235 MB / 3799 行） | 释放约 230 MB | 可与 3.5 合并为一次重建 |
| 3.7 | `VACUUM`（在 3.1–3.6 之后一次性做） | 回收前述所有释放的页 | 需停写窗口 |

#### 第 4 组：验证

- 每步之后跑 `npm run eval:run -- --suite context-recall` 与 `memory-abilities`，与执行前基线对比。
- 端到端人工验收：打开一个 2026-08 之后才发生过讨论的 Jira/群聊页面，被动 Lens 应能召回该时段的记忆（当前必然为空——这是最直接的"修好了没有"判据）。
- 存储：重跑 §10.1 脚本，确认活库构成中 `rehearsal_activations` 不再是首位、freelist 回落。

---

### 12.2 基建变更清单（数据库 / 运行时 / 部署）

回答"这些改进需要动基建吗"：**P0 完全不需要；P1 只是常规 migration + 一个异步作业表；P2 有一个真实的部署决策（reranker 模型体积）；P3 是唯一的结构性基建变更（三库分离）。**

#### 数据库

| 阶段 | 变更 | 性质 | 风险 |
|---|---|---|---|
| P0 | 无 schema 变更（除 `rehearsal_activations` 加 `repeat_count` + 唯一索引） | 常规 migration | 低 |
| P1 | 新增 8 张表（`memory_units` / `memory_unit_views` / `memory_unit_history` / `unit_lifecycle` / `edges` / `edge_episodes` / `profile_slots` / `profile_slot_history` / `trigger_rules` / `ingest_queue`）+ 若干 ALTER | 常规 migration，双写期与旧表并存 | 中（数据量大时 migration 时长） |
| P1 | 新增 FTS5 虚表 ×2（分词表 + trigram 表）与 vec0 表 ×1 | 常规 | 低 |
| P3 | **三库分离**：`memory.db` / `ops.db` / `shared.db` + `archive-YYYY.db` | **结构性变更**：影响 `UserContextManager`、全部 repository 的连接获取、备份脚本、导入导出、级联删除 | **高**——这是本方案唯一需要慎重排期的基建改动 |
| — | **不需要换数据库引擎** | 实测后的结论 | — |

关于引擎：实测活库仅 3,799 条 chunk 向量 + 10,826 条消息向量，回填后预计 2–3 万条——**远低于 sqlite-vec 在 384 维 float32 下 &lt;50 ms 的约 25 万条天花板**（§10.4）。1.3 GB 的体积里 64% 是 `rehearsal_activations` 噪声，清理后约 450 MB。**SQLite 完全够用，不需要 Postgres / LanceDB / 向量数据库。**

#### 服务端运行时

| 阶段 | 变更 | 性质 |
|---|---|---|
| P0 | `EmbeddingClient` 启动 warmup | 启动时间 +数秒，常驻内存 +~90 MB |
| P1 | **LLMClient v2**：tier 路由、`response_format: json_schema`、prompt caching、**Batch 客户端** | Batch 引入 **submit→poll→collect 的异步作业状态**，需要一张 `llm_batch_jobs` 表 + 一个轮询 worker。这是 P1 唯一的新运行时组件 |
| P1 | `ExtractionBatchWorker`（三触发门 + 单飞锁） | 复用现有 scheduler，无新进程 |
| P1 | 嵌入模型换 multilingual-e5-small | 镜像 +~130 MB，常驻内存 +~130 MB；需重标定阈值（C6） |
| P1 | 中文分词：`Intl.Segmenter('zh')` | **零新依赖**——Node 22 默认带 full-icu |
| P2 | **CPU cross-encoder reranker** | ⚠️ **唯一有实质部署代价的一项**，见下 |
| P3 | 三库连接管理 + archive ATTACH | 见上表 |

⚠️ **关于 reranker 的体积决策**：多语言 reranker 的事实标准 `bge-reranker-v2-m3` 是 568M 参数（fp32 ≈ 2.3 GB，ONNX int8 ≈ 600 MB），对一个跑在 Mac mini + OrbStack、同机还有 20+ 个容器的部署来说是显著负担。三个选项：
1. **P2 先不做 reranker**（推荐）——§8 的加权 RRF + 权威/生命周期加权 + 自适应阈值已经是主要收益来源，reranker 是边际优化；
2. 只给 `/ask` 用（低 QPS），被动 Lens 不用；
3. 换更小的多语言 reranker（如 `bge-reranker-base`，278M）并接受质量折损。
**裁决：P2 默认不引入 reranker，把它降级为 P2.5 的可选项，由 eval 数据决定是否值得。** §8.4 的表格里 `cross_encoder` 一律标注为"灰度/可选"。

#### 部署

| 项 | 变化 | 说明 |
|---|---|---|
| 容器镜像 | +130 MB（e5）；若引入 reranker 再 +600 MB | 当前基础镜像已含 MiniLM |
| 常驻内存 | +~130 MB（e5 warmup）；reranker 再 +~700 MB | Mac mini 上需确认余量 |
| 磁盘 | 清理后净**释放**约 3–4 GB（事故快照 3 GB + rehearsal 850 MB + chunks_vec 碎片 230 MB），回填新增约 100–200 MB | 净收益为正 |
| `journal_mode` | delete → WAL 是**需要验证的决策**，不是顺手改 | 当初改 delete 是 virtiofs 时代的止损；现已换 named volume，前提可能不成立。必须在测试环境跑完整巩固 + 并发读 + `integrity_check` 后再切 |
| 备份 | 事故快照统一入口、独立保留期、`quick_check` 校验、异盘 | §10.4c；**不改变现有 AutoBackupService 机制** |
| 环境变量 | **净减少**：删除 `RECALL_ROUTE_SAFE_MODE_ENABLED`、`RECALL_SLOW_CHANNELS_ENABLED`、扩展侧 `CONTEXT_LENS_ENABLED` 构建期默认 | §2.10.5 / §2.10.7 |
| 新增 per-user 配置字段 | `/config` 加 `contextLensEnabled` | §2.10.7 |

#### 一句话结论

**P0 是纯代码 + 配置 + 数据清理，零基建变更，且净释放 3–4 GB 磁盘。** 真正需要提前排期的基建项只有两个：**P1 的 Batch 异步作业表 + 嵌入模型切换**，和 **P3 的三库分离**。reranker 建议直接降级为可选项。

---

## 13. 验证与指标

### 13.1 评测

- 沿用并升级：`context-recall`（加 useful@1 / 意图命中率 judge）、`scene-memory-autopilot`、`memory-search`、`memory-lifecycle`、`recall-synthesis-contract`、`keystone-memory-briefs`、`user-profile`。
- `memory-abilities`（LongMemEval 六能力）：注册进 `registry.yaml`，judge 改为 pin 死的模型 + 提示词（按 [memory-longmemeval-benchmark-plan.md](./memory-longmemeval-benchmark-plan.md)），作为 P1/P2 的硬门。
- 新增确定性契约 suite：`extraction-contract`（结构化输出、语言保留、原子性、时间锚定、去重加固）、`retrieval-plan-contract`（模板→needSlots→通道→RRF 可复现）、`storage-hygiene`（孤儿率 0、fts/content 一致）。
- 线上 A/B：同一批真实页面并行跑旧/新 recall，记录 thumb 反馈 7 天。

### 13.2 指标看板（都已有落点：usage.db / ops.db / eval 报告）

| 类 | 指标 | 目标 |
|---|---|---|
| 召回质量 | Lens useful@1、thumb-up 率、silent 率、ask 引用命中率 | useful@1 +30%；silent 率不升 |
| 延迟 | 被动 p95、ask p95 | < 500 ms / < 2.5 s |
| 供给健康 | units_new/reinforced/日、profile new/reinforced/日、parse_failed 率 | 连续 3 天为零即报警 |
| 成本 | token/日 by tier & task；夜间占比；缓存命中率；Batch 占比 | 夜间 ≥ 70% 走 Batch；cheap 档 ≥ 80% 调用 |
| 存储 | 库体积、向量数、孤儿率、碎片率、月增速 | 孤儿 0；碎片 < 10%；月增速可预测 |

---

### 13.3 方案自身的薄弱点与补强（2026-09-04 自审）

以下 7 点是本方案写完后回看发现的缺口，按重要性排序。**它们不是新需求，是方案本身没写清楚、会让下一步开发卡住的地方。**

#### S1 多用户维度缺失（**方案通篇按单用户写的**）

线上实测：**25 个用户**，全部 `memory.db` 合计 **1.5 GB**，其中 `esone.qiu` 独占 1.3 GB（87%），其余 24 人平均约 8 MB。

含义与补强：
- **成本推算要按用户加总，但倍数远低于 25×**。抽取成本正比于消息量，而其余 24 人的数据量只有主用户的 1/6 左右——全量开启抽取的成本大约是主用户单独开启的 **1.2–1.5 倍**，不是 25 倍。这个结论让 §12.1 第 2 组的 `INGEST_LLM_EXTRACTION_ENABLED=true` 变得可接受得多。
- **但灰度顺序仍要定**：建议先只对 `esone.qiu` 开（改成 per-user 开关而非全局 env，复用 §2.10.6 的 `/config` 机制），观察 7 天的 `usage_events` 与召回质量，再全量。
- §12.1 第 3 组的所有数据修复作业目前只写了 `esone.qiu`；其余 24 个库是否也有 `rehearsal_activations` 膨胀、`lost_and_found`、坏时间戳，**需要先跑一遍 §10.1 的脚本做横向体检**（轻量，只读）。

#### S2 `context_pack` 外发给第三方宿主的隐私边界没写（**真实泄露风险**）

§11 的适配器会把 `context_pack`（peer card + profile slots + procedure rules + 近期 focus）注入 OpenClaw / Claude Code / Cursor / Hermes。这些是**第三方进程**，其中部分会把上下文发往它们自己的模型供应商。

方案目前只说了 token 预算，**没说哪些记忆不能出境**。补强：
- `memory_units.kind='vault'` 与 `profile_slots.topic='identity'` 中的敏感子项（联系方式、证件、薪酬）**永不进 context_pack**，无论预算多宽。
- 新增 `egress_class ∈ {public, internal, private}` 字段，`context_pack` 只输出 `public`；用户可在 Options 逐条提升/降级。
- 每次 `context_pack` 产出写一条外发回执（去向宿主、条数、类别分布），供用户在 Memory Exploring 里复核。
- 这与既有的 [ai-context-passport-plan.md](./ai-context-passport-plan.md) / egress firewall 设想同源，应合并设计而不是各写一套。

#### S3 意图层"是否真的有效"没有验证设计

§8 引入了 needSlots 与触发问句通道，但 §13 的指标只有笼统的 `useful@1`。**无法回答"这两个新机制各自贡献了多少"**。补强——三组可独立开关的消融实验：

| 实验 | 开关 | 判据 |
|---|---|---|
| A 基线 | 加权 RRF + 权威/生命周期加权，无 needSlots、无触发问句 | useful@1 基线 |
| B +意图模板 | 打开 needSlots（`V_trig` 用模板问句查 body 视图） | 相对 A 的增量 |
| C +触发问句 | 打开预生成的 `trigger_question` 视图 | 相对 B 的增量 |

三组共用同一批线上真实场景快照（可从 `ambient_calibration_traces` 与 Lens 反馈里抽），离线跑，不影响生产。**如果 C 相对 B 的增量 &lt; 5%，触发问句的离线生成成本（§7.4）就不值得**——这是个应当被数据否决的设计。

#### S4 needSlots 模板的维护成本与冷启动没写

§8.2 说"按 sceneType 查需求模板（确定性、可配置）"，但没说：模板有多少个、谁维护、未覆盖场景怎么办、模板写错了怎么发现。补强：
- **初期只做 3 个场景**（`jira_issue_reading` / `ringcentral_group_chat` / `web_reading`），其余一律走 `freeform` 兜底（等价于今天的行为，不会更差）。
- **模板应当从数据里长出来，而不是拍脑袋**：把用户在各场景下真实问过的 `/ask` 问题按 sceneType 聚类，人工挑高频意图固化成槽位。这条可以复用已有的 ask 历史，属于离线分析，成本极低。
- 模板存 DB（`scene_need_templates` 表）而非硬编码，改模板不需要发版；每个槽位记 `hit_count` / `useful_count`，长期无收益的槽位自动下线。

#### S5 P1 是大爆炸式改造，缺一个先验证的薄切片

§12 的 P1 一次性引入 8 张新表 + 抽取管线 v2 + tier 路由，3–4 周不出成果。但**意图层的有效性其实不依赖 `memory_units` 模型**——完全可以在现有 `chunks` 上先验证。补强，在 P1 前插入一个 **P0.5 探针（3–5 天）**：
1. 用现有 chunks，为其中 sal 较高的一批离线生成触发问句，写进一张临时表 + 一个 vec 表；
2. 在 `ContextRecallService` 里加一路 `V_trig` 通道（feature flag 控制）；
3. 跑 S3 的 A/B/C 消融。

如果这一步就能看到 useful@1 的明显提升，P1 的大改造才有依据；如果看不到，说明瓶颈另有其人，应当先改别的。**这是整个方案里性价比最高的一次"花小钱买确定性"。**

#### S6 启动时间随用户数线性增长（2026-09-04 事故中观察到）

服务重启时**逐个初始化 25 个用户的库**（日志可见 `[UserDataManager] Initialized data directory: ...` 逐条刷屏 + 每库 `All migrations already applied`），从容器启动到 `/health` 返回 200 约需 **60–75 秒**。

含义：
- §10.2 的**三库分离会让文件打开数 ×3**（memory + ops + shared，外加按需 archive），启动时间可能进一步拉长。补强：三库改为**懒加载**——只有 `memory.db` 在启动时打开，`ops.db` / `archive-*.db` 首次访问时才连接。
- 迁移期跑 25 个库的 migration 需要预留停机窗口，`docker-compose` 的 `stop_grace_period` 也要相应调整。

#### S7 一条 `/context-recall` 花了 23.8 秒（同一批日志中发现）

`2026-09-04T05:58:21` 的日志显示 `POST /api/v1/context-recall` `responseTime: 23810 ms`——而这条路径的产品目标是 **p50 &lt; 250 ms / p95 &lt; 500 ms**，实际出现了近 100 倍的离群值。

方案里只有目标值，**没有对离群值的观测与熔断设计**。补强：
- `/context-recall` 加**硬超时 + 分阶段耗时回执**（planner / 各通道 / 融合 / 门控），超时即返回已有的部分结果（fail-open，符合 §4.2 P7）。
- 把 p99 与超时率纳入 §13.2 指标表，而不只看 p95。
- 这个离群值本身值得单独定位：怀疑与 `rehearsal_activations` 的 195 万行同步写入（§10.4b(1)）或 `chunks_vec` 235 MB 碎片扫描有关——**两者都在 P0 的修复范围内，修完应复测**。

---

## 14. 风险与边界

- **抽取质量决定一切**：units 错、下游全错。缓解：strict schema、语言保留、来源 span 必填、`needs_extraction` 保底、抽取 eval 门、用户纠错写 history 并反哺 prompt few-shot。
- **成本反弹**：抽取成为主管线后 token 会上升（前审计里 Reflection 默认开曾 $350/月）。缓解：tier 路由、批处理（每批 1 次）、日预算硬顶、缓存、Batch −50%；预计写入侧 cheap 档每千条消息 < $0.5（估算，需 P1 实测）。
- **多语言 embedding 切换的召回漂移**：换模型 = 全量重嵌 + 阈值重标定（0.30/0.80/0.92 都是 MiniLM 口径）。缓解：`embedding_model` 列并存、eval 对比后切换。
- **中文分词一致性**：查询与写入必须同一分词器版本；ICU 词典对专业词（"分片"）切分不佳。缓解：keywords 视图存实体/票号原文 + trigram 兜底 + 自定义词典。
- **触发问句是猜测**：生成的"用户会问什么"可能偏。缓解：只对 sal≥0.5 单元生成、作为独立通道加权 .25 而非主通道、反馈学习可把权重压低。
- **派生记忆权重过低导致简报/反思不可见**：passive 面 derived ×0.6 可能压掉有价值 insight。缓解：Keystone/变化脉络仍走确定性匹配的独立首屏仲裁（UI 契约不变）。
- **跨库一致性**：ops.db / archive 与 memory.db 之间无原子事务。缓解：ops 数据允许最终一致；archive 只读、按年份整体迁移。
- **不做的事**：不引入 Neo4j/Postgres；不把 MD 升为真源；不让宿主 LLM 决定写什么；不在在线路径调用 LLM。

---

## 附录

### A. 抽取输出 JSON Schema（节选）

```json
{ "type":"object","additionalProperties":false,
  "required":["units","edges","properties","profile_candidates","language"],
  "properties":{
    "language":{"enum":["zh","en","mixed"]},
    "units":{"type":"array","maxItems":20,"items":{"type":"object","additionalProperties":false,
      "required":["text","kind","owner_kind","speech_mode","time_basis","poignancy","source_episode_ids"],
      "properties":{"text":{"type":"string","minLength":8,"maxLength":400},
        "kind":{"enum":["fact","preference","decision","action_item","event","risk","open_question","opinion","procedure"]},
        "owner_kind":{"enum":["self","ai_agent","named_person","organization_or_source","system_observation"]},
        "speech_mode":{"enum":["direct_assertion","quote","reported_speech","suggestion","question","hypothesis","intent_or_plan","commitment","correction"]},
        "time_basis":{"enum":["current","as_of_source_time","future_intent","past_event","unknown"]},
        "observed_at":{"type":["string","null"],"format":"date"},
        "valid_from":{"type":["string","null"],"format":"date"},"valid_to":{"type":["string","null"],"format":"date"},
        "poignancy":{"type":"integer","minimum":1,"maximum":10},
        "entities":{"type":"array","items":{"type":"object","required":["name","type"],"properties":{"name":{"type":"string"},"type":{"enum":["Person","Project","Topic","Technology","Organization","Ticket","Document"]}}}},
        "source_episode_ids":{"type":"array","minItems":1,"items":{"type":"string"}},
        "trigger_question":{"type":["string","null"]},
        "is_procedure_rule":{"type":"boolean"}}}},
    "edges":{"type":"array","items":{"type":"object","required":["from","to","name","fact"],"properties":{"from":{"type":"string"},"to":{"type":"string"},"name":{"type":"string"},"fact":{"type":"string"},"valid_at":{"type":["string","null"]}}}},
    "properties":{"type":"array","items":{"type":"object","required":["entity","key","value","fact_text","action_type"],"properties":{"entity":{"type":"string"},"key":{"type":"string"},"value":{"type":"string"},"fact_text":{"type":"string"},"action_type":{"enum":["set","update","unset"]}}}},
    "profile_candidates":{"type":"array","items":{"type":"object","required":["topic","sub_topic","content"],"properties":{"topic":{"type":"string"},"sub_topic":{"type":"string"},"content":{"type":"string"}}}},
    "skip_reason":{"type":["string","null"]}}}
```

### B. 需求模板示例（`lens_passive` / `jira_issue_reading`）

```yaml
scene: jira_issue_reading
slots:
  - kind: caliber      question: "{issueKey} 的估算口径、单位或历史估算是什么"   weight: 1.0  kinds: [procedure, decision, fact]
  - kind: decision     question: "关于 {issueKey} 或 {project} 做过哪些决定，为什么"  weight: 0.9  kinds: [decision]
  - kind: blocker      question: "{issueKey} 有什么阻塞、风险或依赖"               weight: 0.8  kinds: [risk, open_question, action_item]
  - kind: owner        question: "谁负责 {issueKey} 的开发/测试，谁在等它"          weight: 0.6  kinds: [fact, action_item]
suppress_if_visible: [estimate.dev, estimate.qa, story_points]   # 页面已显示的字段不再复述（沿用 visibleFacts）
```

### C. 模型 tier 配置示例（.env）

```
LLM_TIER_CHEAP=openai/gpt-5-nano,claude/claude-haiku-4-5,gemini/gemini-flash-lite
LLM_TIER_STANDARD=claude/claude-sonnet-5
LLM_TIER_SMART=claude/claude-opus-5
LLM_TIER_LOCAL=ollama/qwen3:8b            # 可选
LLM_BUDGET_extraction=200000tok/day       # 超预算 → 降 tier=local 或排队
LLM_BUDGET_consolidation.reflect=60000tok/day
LLM_BATCH_FOR=consolidation.*,views.trigger_question,profile.induction
EMBEDDING_MODEL=Xenova/multilingual-e5-small
EMBEDDING_QUANT=int8
```

### D. 参考（源码/论文均已实读）

Mem0 v3 源码与 PR #4805、#6530；docs.mem0.ai（mcp / claude-code / openclaw 集成）· Graphiti `graphiti_core/{edges,nodes,search}`，arXiv:2501.13956 · HippoRAG 2 arXiv:2502.14802 · Letta sleep-time arXiv:2504.13171，letta.com/blog/benchmarking-ai-agent-memory · MemOS `src/memos/*`，`apps/memos-local-plugin/core/*/ALGORITHMS.md`，arXiv:2507.03724 · ReMe `reme/steps/{evolve,index}`；MemoryScope `demo_config.yaml` · memobase `controllers/modal/chat/*`，`prompts/*` · Honcho `src/{deriver,dreamer,dialectic,crud}`，blog.plasticlabs.ai · Hermes `tools/memory_tool.py`，`agent/background_review.py`，`plugins/memory/honcho` · MIRIX arXiv:2507.07957 · MemoryOS arXiv:2506.06326 · Generative Agents arXiv:2304.03442 `retrieve.py/reflect.py` · MaiBot `src/A_memorix/core/utils/memory_lifecycle_policy.py`，LPMM `kg_manager.py` · zenBrain `packages/algorithms/src/{fsrs,ebbinghaus,emotional,sleep-consolidation}.ts`，arXiv:2604.23878 · PowerContext `builtin/artifacts/memory/fusion.py`，RFC 0080 · SillyTavern `world-info.js`，qvink MessageSummarize · sqlite-vec 文档与 v0.1.7–0.1.10 release notes；SQLite fts5/wal/attach 文档 · FrugalGPT arXiv:2305.05176 · RouteLLM arXiv:2406.18665 · ProCIS arXiv:2405.06460 · Remembrance Agent（Rhodes & Maes 2000）。

