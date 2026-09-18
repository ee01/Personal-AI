# 记忆基础架构审查与改进方案

本文建议保留原方案的证据、真值、投影分离与渐进迁移方向，将首要交付收敛为：**先用可信评测定位并修复 recall，再根据实测收益扩展记忆能力。** 最重要的架构调整，是让原文片段始终可检索，原子事实成为增强层；最紧急的工程前置，是纠正已有实验和切换门中的指标错误。

审查日期：2026-09-10。审查对象：[原 v3 方案](./memory-foundation-rearchitecture-plan.md)，以及当前工作区的 memory-service、相关评测和相邻计划。代码基点为 `ed2047c0971146cf8fe7a4428f3e7365dd1f7e9f`，**另含未提交改动**；下文代码结论描述本次工作区快照，不等于该 commit 或线上版本已具有相同行为。

状态：**供决策的替代计划草案，文档交付；未授权实施、切换、部署或数据作业。** 原文件保持不变。本文件不自动成为第二份 canonical；若决定采纳，应先统一原方案和相邻执行文档的指向，再进入实施。文中的 Q0–Q3、E1–E2 是拟议工作包，不是完成状态。

## 1. 审查结论与边界

原方案的总体方向合理，但还不适合直接按全文继续实施。它同时承担了事故恢复、数据模型重构、召回实验、自治巩固和多宿主平台建设；这些工作的成本与完成条件不同，不应共同阻塞“近期 recall 不准”的修复验收。

建议保留以下设计：每用户 SQLite；不可被摘要覆盖的原始证据；正规化 lineage；后台抽取与确定性索引解耦；投影可重建；幂等裁决；时间有效性；按 Ask、Compose、Passive 分别评测；合法拒答；既有 Lens 展示契约；权限与删除硬门；不把 exposure 当用户确认。

必须调整的核心事项：

1. **先修验收依据。** 现有 P0.5 拒答分数门失效，待接入的 surface gate 使用候选数量代替命中率，无法据此批准切换。
2. **从 atomic-only 改为 source-backed 双层检索。** 成功抽取也会漏信息，不能仅为抽取失败保留一个审计 fallback。
3. **将权限、删除和恢复前置。** 抽取、embedding、reranking、评测 judge 也可能外发；不能等 Adapter 阶段才治理。
4. **补齐事实更新后的失效传播。** 旧结论被替代后，依赖它的 brief、profile、projection、context cache 必须同步失效或待重核。
5. **按现有实现的缺口推进。** 仓库已有 P0/v3 代码和报告，不能把计划当全新工程，也不能把文件存在当过门。
6. **把图、needSlots、trigger views、画像、learned ranker 变成可否决实验。** 没有独立质量收益就不进入默认路径。

本次没有重新采样线上用户数据，没有验证容器版本、当前开关或真实故障请求，也没有运行部署、生产评测或数据修复。因此不确认“今天的 recall 不准仍由 9 月 3 日索引断供引起”。该事故只作为待复核的历史根因；当前工作区发现的问题分别标记如下。

| 证据等级 | 本文含义 |
|---|---|
| 工作区事实 | 当前文件直接可核对；可能尚未提交或接入调用链 |
| 历史记录 | 仓库文档或实验报告记录，未在本次重跑 |
| 外部证据 | 已核查的一手论文、官方工程文章或固定版本开源代码 |
| 设计判断 | 根据证据作出的本项目取舍，需要后续实验验证 |

## 2. 两个应当首先解决的用户场景

以下为合成验收场景，不代表真实 Jira、群聊或用户资料。

### 2.1 最近讨论过的结论找不到，或者找到另一个项目

上午，用户在群聊讨论 `DEMO-123` 的估算口径，随后在 Jira 补充“只有接口变更才重估”。同一群还有 `DEMO-456`，也使用“估算、下周、确认”等词。下午用户打开 `DEMO-123`，问“最后确认的口径是什么”。

预期步骤：先用可信工单标识定位候选，读取该工单对应的原始片段及后续补充，再判断当前有效结论。抽取服务关闭、零事实、失败或漏掉“只有接口变更”时，原文 lexical 路径仍可找到证据。若只找到另一个工单，Passive 保持安静，Ask 说明证据不足；不得靠同群、词相似或“最新一条”补答案。

验收同时检查：数据是否进入索引、目标片段是否被召回、是否遗漏必要条件、是否误用另一个工单、Lens 是否增加了页面尚未显示的信息。只测最终答案或只测 chunk 数量都不够。

### 2.2 旧记忆曾经正确，现在不能再作为当前结论

周一来源记录“负责人是 A”；周三权威来源更正为 B；一条周报还引用旧负责人。用户周四问“现在找谁”，又问“周一为什么找 A”。

前一个问题应使用当前有效的 B；后一个问题可以引用周一有效的 A，并清楚区分历史与现在。周报不能因为生成时间更新就覆盖权威事实。纠错后，旧周报、派生画像和缓存必须失效；如果来源后来被隐私删除，恢复旧备份也不能让它重新出现。

再加入一个条件变化：旧流程真实且相关，但本次明确要求采用另一种流程。系统应检查适用前提，不能把相关旧经验自动当作当前指令。

## 3. 原方案与现有工作区的关键问题

### 3.1 直接影响验收与切换的工作区事实

| ID / 优先级 | 证据与问题 | 对计划的修订要求 |
|---|---|---|
| F1 / 阻塞切换 | [p05-ablation.mjs](../../memory-service/scripts/p05-ablation.mjs) 第 30–32、170–181、232 行：`RRF_K=60`，每通道最多贡献 `1/61`，当前最多三通道的理论上界约 `0.0492`，却用 `0.5` 判 no-result。拒答探针会机械地通过。 | [P0.5 报告](../../artifacts/memory-foundation/P0.5/README.md) 中“abstention 3/3”不得作为拒答质量证据。必须使用实际展示/回答决策评估拒答，并验证评分器能拒绝一个已知坏系统。 |
| F2 / 阻塞切换 | 未跟踪文件 [SurfaceCutover.ts](../../memory-service/src/core/v3/SurfaceCutover.ts) 第 68–82 行，以 `v3Count - legacyCount` 计算 CI，却描述为 hit@5 非劣。数量不是正确率，也没有独立安全结果输入。 | 数量、重叠只作诊断；切换门输入必须是带 gold 的逐例结果、实际 surface 输出和单独安全报告。该模块当前未接入生产路由，不能把它说成线上已错误放量。 |
| F3 / 证据不足 | P0.5 报告明确 gold 是消息关键词生成的机器种子，纯中文仅 4 条，no-result 3 条；e5 的覆盖与旧 dense 覆盖也需对齐。 | e5 和 trigram 保留为有希望的候选；现有增益不足以证明中英混合真实场景或默认上线收益。报告中的“质量门通过”需在实施前重新裁决。 |
| F4 / 阻塞 v3 接入 | [070_v3_units.sql](../../memory-service/src/storage/migrations/070_v3_units.sql) 第 103–148 行：FTS external-content 列名是 `content`，被指向的表只有 `raw_text` / `segmented_text`，没有同名列。 | 将“能 MATCH”与“可 rebuild、可读回内容、外部内容一致”分开验收；设计列名对应的 backing table/view，固定 rebuild 与 `integrity-check(rank=1)` 用例。不能只靠 triggers 证明可重建。[^12] |
| F5 / 阻塞 v3 接入 | [UnitRecallReader.ts](../../memory-service/src/core/v3/UnitRecallReader.ts) 第 51–142 行：接口主要接收 query/limit，当前过滤以 status 为主；segment 与 trigram 分别进入 RRF。 | 接入用户可见路径前接收完整服务端策略上下文；补来源、scope、sensitivity、egress、有效时间与版本 gate；将两种 lexical 表折为一个逻辑 lexical 通道，单独评估改变权重的收益。 |
| F6 / 阻塞可靠供给 | [ExtractionWorker.ts](../../memory-service/src/core/v3/ExtractionWorker.ts) 第 193–217 行仅 claim queued/failed_retryable，未回收已过期 claimed；第 286–325 行 integration 异常未进入该 worker 的 retry 分支。 | 增加 expired-lease 接管、fencing、heartbeat 与整段处理的异常分类；从冻结 batch 重放 integration，不重新采样模型。恢复演练须包含 worker 在各提交点崩溃。 |
| F7 / 阻塞 provenance 信任 | [EpisodeRepository.ts](../../memory-service/src/core/v3/EpisodeRepository.ts) 第 28–36 行把 snake_case SQL 行直接断言为 camelCase；worker 读取 `sourceType` / `trustClass` 等字段。 | 定义显式 DTO mapper，逐字段验证 source identity、信任与权限继承；类型断言不能代替运行时映射。 |
| F8 / 时间契约不完整 | [ExtractionContract.ts](../../memory-service/src/core/v3/ExtractionContract.ts) 第 96–112 行只检查 observedAt 是否整数；worker 第 298 行用 `candidate.observedAt ?? episode.timestamp` 替换 unknown。 | 拒绝未规范化毫秒、0 和无效时间；区分 omitted、unknown、源明确给出的时间；不能用摄入时间或 envelope 时间覆盖抽取结果的明确 unknown。此处不宣称已发现线上脏数据。 |
| F9 / 阻塞真值更新 | [UnitTruthMaintainer.ts](../../memory-service/src/core/v3/UnitTruthMaintainer.ts) 第 321–362 行把不同文本的来源附加到旧 unit 并标 disputed，但没有独立保存相反陈述；第 423–426 行在更新后读取同一个 id 作为 before。 | 分别保存双方 claim，通过 dispute/supersede 关系关联；不能让支持 B 的 source 被当作支持 A。修改前冻结完整 before snapshot，之后记录 after，含正规化关系快照。 |
| F10 / 幂等边界过窄 | 同文件第 118–132 行 digest 未覆盖 scope、sensitivity、confirmation、provenanceFamily、origin、tenant/user 等裁决字段；第 160–185 行在事务外查 receipt。 | canonical digest 覆盖完整候选、来源与策略契约；事务内重查 work key；从 source rows 重算所有 cached 属性，不能用部分 hash 证明完整幂等。 |
| F11 / 归属体系旁路 | [IngestionPipeline.ts](../../memory-service/src/core/IngestionPipeline.ts) 第 467–487 行先 dispatch v3，随后第 495–525 行才执行既有 claim attribution；worker 第 337–342 行又按 sourceType/sender 简化判断。 | 复用 [MemoryClaimAttributionService.ts](../../memory-service/src/core/MemoryClaimAttributionService.ts) 与 MemoryClaimEnvelope 的本人/他人、引用/转述/假设/模拟边界。v3 不新造“有 sender 就 self_statement”的第二套归属规则。 |
| F12 / 优先验证的旧路径缺口 | [RecallEngine.ts](../../memory-service/src/core/RecallEngine.ts) 第 1206–1254 行先取全局 FTS top-N 再过滤 scope/project/source，合法候选可能提前被挤出；第 713–754 行等待 embedding 后才启动通道。 | Q1/Q2 先实验 predicate pushdown、合法候选补取、query 规范化与有界并行。它们可能比更换整套架构更快改善召回；是否造成当前线上故障仍需样例验证。 |

工作区已存在 [IngestionPipeline.ts](../../memory-service/src/core/IngestionPipeline.ts) 第 386–414 行的 `MEMORY_SUPPLY_DECOUPLED` 分支，以及 v3 migration、抽取、投影和 shadow 代码。Ask、Compose、Passive 的新增 v3 调用目前用于 shadow；切换函数未形成生产 caller。**实施起点应是验收现有代码和报告、确认真实生效路径，而不是重做 P0 或直接宣布完成 P2。**

此外，[UnitEmbeddingWorker.ts](../../memory-service/src/core/v3/UnitEmbeddingWorker.ts) 第 39–51 行将初始化失败缓存为 null，后续因 `!== undefined` 直接返回，并不会按注释自动重试；模型加载也未 pin revision。当前 shadow 中 Compose/Passive 的简化 query 和 `legacyCount=0` 不能视为公平对照。以上一并纳入 Q1 可靠性与 Q2 测量输入审计。

### 3.2 方案本身仍需闭合的设计问题

| ID | 原文位置 / 缺口 | 统一裁决 |
|---|---|---|
| D1 | §6.2 保证 legacy lexical 供给，但 §6.4 抽取失败只可 raw audit；§7 主要检索 unit，§11.10 又退役旧投影。 | 长期保留 source-segment 检索。零事实、失败及成功但遗漏细节的 episode 都不能因此失去原文可检索性。 |
| D2 | §5.3 允许“至少一个来源被授权”即返回 unit，尚未区分独立佐证与多来源共同推导。 | 独立充分佐证可择一；共同推导必须授权全部必要依赖。正文、标题、别名、摘要与引用本身都要满足相同边界。 |
| D3 | §10 的 egress 原则强，但阶段表把 adapter/egress 放在 P4；更早已有抽取和 embedding provider。 | 最小 PolicyEngine 在任何模型外发及新读接入前交付；P4/E2 只扩宿主协议，不首次建立安全边界。 |
| D4 | 双时态字段存在，但缺 query-time `asOfValid` / `asOfKnown`、迟到修正与下游失效的完整协议。 | 定义有效时间、系统知晓时间与依赖版本；纠错时同事务更新权威失效账本与 outbox，读取先检查版本，缓存清除可异步。 |
| D5 | §5.3 支持日期/月精度，§6.4 又要求完整 timestamp 或 null。 | 保留 precision/原始时间表达；部分日期表示区间或部分时间，不伪造秒级时刻，也不丢为完全未知。 |
| D6 | §7.6 的 Ask 2.5 秒未清楚区分检索与生成；shadow 同时运行新旧可能影响线上延迟。 | 单独测 retrieval、first evidence、TTFT、full answer；shadow 抽样并设资源预算、取消与背压。 |
| D7 | §11.10 停旧写后直接回 old-store；旧库无法包含停写后的新数据、纠错和删除。 | 增加停写水位、可重放变更日志、兼容恢复读路径与删除防复活机制。无法做到就继续旧投影维护，不得宣称可回滚。 |
| D8 | P0.5 的 gold/view 实验可能等待 P1 才有基础设施，实际报告也已据此推迟 B/C。 | 用一次性离线 segment/事实候选文件做薄切，先验证 representation，再决定生产 schema；不建两套生产写栈解决实验依赖。 |
| D9 | 30 天、1→5→25、150 条样本可能被机械当作充分证明。 | 时间是观察下限，样本量由风险、覆盖与统计精度决定；用户总数与 cohort 以执行日为准。 |
| D10 | “shadow 无副作用”只写到展示、profile 和强化，未明确生成缓存、日志、预算与后台任务。 | 为 shadow/eval 定义副作用白名单：仅允许隔离、限额的诊断；禁止业务写、反馈和真值更新，所有模型调用仍过 policy 与预算。 |

### 3.3 相邻文档的冲突

- [memory-cascade-deletion-plan.md](./memory-cascade-deletion-plan.md) 第 51 行要求剩余来源完整重建，否则撤回；第 91–92 行仍允许替换引用文本且仅在全部证据删除时撤回。实施前统一为“无法证明残留已清除则先不可读，再重建”，不可仅改引用占位符。
- [memory-service-migration-plan.md](./memory-service-migration-plan.md) 仍保留早期“无真实认证”的描述；当前 [auth.ts](../../memory-service/src/middleware/auth.ts) 已有服务 key、绑定用户 key 和 worker key。认证现状应以当前代码和部署配置核对，不能根据旧文档重建认证，也不能将 per-user DB 等同于完整授权。
- [memory-scene-boundary-plan.md](./memory-scene-boundary-plan.md) 已负责跨来源事件分段。本方案的 segment 只是稳定来源片段，不能复用其名义另造第二套事件边界；事件聚类属于可选候选范围信号。
- [time-basis-contract-plan.md](./time-basis-contract-plan.md) 当前已搁置，只作为时间前提设计参考。foundation 吸收必要的 as-of、timezone、timeBasisSource 字段，不把该计划复活或设为前置依赖，也不在两侧各猜一次“现在”。
- [memory-index-backfill-plan.md](./memory-index-backfill-plan.md)、[memory-longmemeval-benchmark-plan.md](./memory-longmemeval-benchmark-plan.md)、egress / outcome / echo 等计划是专项展开，不独立拥有真值、评分门或权限默认值。

## 4. 论文、专家观点与采用边界

### 4.1 研究结论如何影响本项目

| 来源 | 已核查的启发 | 本项目决定与限制 |
|---|---|---|
| LongMemEval，v2，2025-03-04，§5.2–5.3 [^1] | 在其对话任务上，进一步把 round 压缩为 facts 会损失信息；事实增强索引 key、保留原始 value 是有用组合。 | source-segment + enriched key 必须作为主对照；原子事实不能替代原文。论文结果不证明同样收益必然出现在 Jira/中文被动召回。 |
| MemoryAgentBench，v4，2026-06-28 [^2] | 增量摄入下的准确检索、长期理解、学习与选择性遗忘应分开测。 | 测新增、纠错、重放和删除后的行为；不只在静态干净库测一次。 |
| LongMemEval-V2，v1，2026-05-12 [^3] | 将 web-agent 经验区分为静态知识、动态状态、流程、陷阱和前提感知。 | 用于 Deep/流程经验测试；该工作仍标注 Work in Progress，不能直接作为 Passive 的延迟或质量标准。 |
| AMemGym，v1，2026-03-02 [^4] | 用户状态与交互会演化，需要观察记忆如何影响后续行为。 | E1 做多轮状态演化测试；Q 阶段先用可复现的本地事件回放。 |
| MemEvoBench，v2，2026-05-21；EvoMemBench，v2，2026-06-15 [^5][^6] | 演化过程会受噪声、反馈和更新机制影响；记忆表示与使用策略应拆开比较。 | no-memory、long-context、retrieval、procedural 设独立对照；采用与点击不等于事实正确。 |
| StateMem / StateMemBench，v1，2026-08-20 [^7] | 当前状态解析与下游依赖失效，不能被“找到了相关历史”替代；其设计传播 `needs_recheck`。 | 引入确定性依赖版本检查与待重核状态。基准和方法同源、合成任务及调用成本限制明显，不照搬整套在线模型循环。 |
| MemTrapBench，v1，2026-08-20 [^8] | 真实且相关的历史经验也可能造成策略固着、推理偏差。 | 增加“事实正确但本次不适用”“当前明确意图覆盖旧习惯”的测试，与恶意注入分开计分。相关性 gate 后仍检查适用前提。 |
| MemSecBench、Hidden in Memory、Origin-Bound Authority，2026 [^9][^10][^11] | 写入污染、跨会话触发、转述后的权威漂移需要链式测试。 | authority 随来源传播；memory 内容不授予工具权限。采用攻击/修复场景，不把论文防御当完备保证。 |

原方案引用的这些 2026 论文均能对应到真实页面，并非发现了伪造引用。修订点主要是**版本、适用任务、预印本成熟度与本项目裁决之间的边界**；新近结果应优先补充测试假设，而不是自动升级为生产默认机制。

### 4.2 专家与工程团队的一手观点

| 作者 / 日期 | 观点的转述 | 采用与保留意见 |
|---|---|---|
| Daniel Ford，Anthropic，2024-09-19 [^14] | chunk 脱离公司、时间、文档等上下文会难以检索；可为 chunk 增加简短上下文，并结合 BM25、dense、reranking。 | 先添加确定性的来源/工单/标题/时间上下文，LLM 上下文化作为可选 view。文章的 49%/67% 是特定配置下 top-20 检索失败率的相对降低，不是本项目准确率承诺。 |
| Prithvi Rajasekaran、Ethan Dixon、Carly Ryan、Jeremy Hadfield，Anthropic Applied AI，2025-09-29 [^15] | 上下文是有限资源；预计算检索与按需探索可结合；过度压缩会丢失后来才重要的细节。 | 默认短 context pack + 可重新授权的 open_sources；Deep 才用有预算的进一步探索。无需先建设完整图谱才能获得收益。 |
| Letta 团队，2026-07-28 [^16] | 记忆生成的泛化/清理，与记忆使用的检索/遵循是不同能力。 | 分开评测 extraction、maintenance、retrieval、reader。其 Context-Bench V2 是私有基准，不用模型排名或私有分数代替本项目可复现实验；历史记忆中的“规则”仍须服从当前用户意图和来源权限。 |
| Harrison Chase，2026-04-11 [^17] | 记忆效果与宿主如何加载、保留和更新上下文密切相关；只提供 memory API 不能完成整合。 | 中央服务统一事实和 policy，Adapter 验收同时检查宿主实际使用。其关于 harness 的观点带有产品立场，不据此否定独立 memory-service。 |

以上为观点转述，不是专家对本项目的背书。共同支持的是“保留证据、按任务选择上下文、分别测试写入与使用”，并不存在“所有应用都应使用图数据库/自治记忆/更大 embedding”的统一结论。

## 5. 热门开源项目与代码借鉴

### 5.1 项目快照

GitHub 页面热度快照：2026-09-10 07:45 UTC 左右，显示值有四舍五入；默认分支 SHA 于同日核对。Stars 只用于挑选有生态关注的样本，不代表质量或部署适配。许可证指所读仓库顶层 LICENSE，不延伸到托管服务、依赖或全部模型权重。

| 项目 | Stars 约数 / 许可证 | 已核对默认分支提交 |
|---|---|---|
| [Mem0](https://github.com/mem0ai/mem0) | 65k / Apache-2.0 | `02f7a9b2c4fe38dedb96631e48c85c74ad58b605` |
| [Graphiti](https://github.com/getzep/graphiti) | 30.8k / Apache-2.0 | `4bd728790e836950c3922e84f6f989f1380f54f2` |
| [Cognee](https://github.com/topoteretes/cognee) | 30.6k / Apache-2.0 | `c0d18c80e24b7b78918e7642c03f6f128fdd2aee` |
| [Supermemory](https://github.com/supermemoryai/supermemory) | 29.6k / MIT | `958ae8b61960fe2ade495b095a01667cf44c5706` |
| [TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | 26.3k / MIT | `906b5823b5106eed8f842b62f16d23228838149a`，`feat/server_team` |
| [Letta](https://github.com/letta-ai/letta) | 24.7k / Apache-2.0 | `4511fa0bc91f68fbab32b91f694617271ea9012b` |
| [Hindsight](https://github.com/vectorize-io/hindsight) | 23.4k / MIT | `11e624325b130210dc9b8fc7c5a0ae6cbd94077f` |
| [memU](https://github.com/NevaMind-AI/memU) | 14.4k / Apache-2.0 | `db8584c28f10798b2dc6b411dc835f911fb1d9bf` |

### 5.2 采用策略

不整体替换 memory-service。它与用户现有 Lens、Compose、Ask、权限、存储和删除契约已经深度连接，搬迁到另一个框架会同时改变太多变量。优先移植小机制，并用相同 corpus、gold、模型和 token budget 比较；直接复制代码前单独检查相应文件及依赖许可证。

原方案的若干引用需要限定版本：Mem0 当前主路径已演变，不能把旧论文的 UPDATE/DELETE 冲突动作概括成当前默认实现；[Supermemory #1208](https://github.com/supermemoryai/supermemory/issues/1208) 与 [Tencent #890](https://github.com/TencentCloud/TencentDB-Agent-Memory/issues/890) 当前已关闭，应作为历史故障模式。Tencent 的问题主要是共享语义未生效导致过度隔离，不能描述成已证实跨租户泄漏。

Hindsight 的 [correct/forget 讨论](https://github.com/vectorize-io/hindsight/issues/2696)、[CJK secret 问题](https://github.com/vectorize-io/hindsight/issues/3566)、[共享 bank 讨论](https://github.com/vectorize-io/hindsight/discussions/1576) 支持补充语义、语言和 provenance 测试，但 issue 报告不等于对项目最新版本完成了独立安全审计。

### 5.3 实际代码支持的设计取舍

下列为固定 SHA 的静态代码检查，未运行这些项目，也未复现它们的自报 benchmark。深读范围为 Mem0、Graphiti、Hindsight、Cognee；memU 抽查 adapter，Letta/Supermemory/Tencent 以入口、文档和 issue 核对为主。

| 项目 / 固定代码来源 | 已核实的实现 | 本项目采用或不采用 |
|---|---|---|
| Mem0：[主写路径](https://github.com/mem0ai/mem0/blob/02f7a9b2c4fe38dedb96631e48c85c74ad58b605/mem0/memory/main.py#L916-L1074)、[关联提示](https://github.com/mem0ai/mem0/blob/02f7a9b2c4fe38dedb96631e48c85c74ad58b605/mem0/configs/prompts.py#L692-L701) | 当前 V3 是分阶段 ADD-only：检索已有记忆、抽取、批量 embedding、去重、保存与链接。 | 借鉴追加陈述及显式关联，不能用当前 Mem0 证明 LLM 应直接 UPDATE/DELETE 真源。 |
| Mem0：[搜索候选](https://github.com/mem0ai/mem0/blob/02f7a9b2c4fe38dedb96631e48c85c74ad58b605/mem0/memory/main.py#L1628-L1687)、[错误分支](https://github.com/mem0ai/mem0/blob/02f7a9b2c4fe38dedb96631e48c85c74ad58b605/mem0/memory/main.py#L955-L989) | 搜索的最终 candidate 从 semantic_results 构造，keyword 主要加分；parse error 可转为 `[]`。 | 不照搬：本项目保留独立 lexical 并集以救回 exact ID；parse_failed 不能与 zero_fact 混同。 |
| Graphiti：[并发候选](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/search/search.py#L282-L324)、[重排截断](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/search/search.py#L395-L411)、[rrf 函数](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/search/search_utils.py#L1775-L1789) | 各通道取有界候选，再融合；cross-encoder 前再次截断；`rrf()` 默认 `rank_const=1`。 | 采用分阶段预算；`2*limit`、rank constant 等数字只作候选，不搬成生产阈值。 |
| Graphiti：[时态边](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/edges.py#L263-L284)、[矛盾处理](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/utils/maintenance/edge_operations.py#L538-L573) | 边持有 episode、有效/失效时间；矛盾处理考虑时间重叠。 | 借鉴时态语义，不把更晚摄入等于更权威；episode ID 还不足以替代本项目精确 span。 |
| Graphiti：[删除 episode](https://github.com/getzep/graphiti/blob/4bd728790e836950c3922e84f6f989f1380f54f2/graphiti_core/graphiti.py#L1824-L1852) | 按 edge 首个 episode 等规则处理关联清理。 | 不直接照搬：多来源陈述仍需逐来源撤回、剩余证据重算和派生闭包。 |
| Hindsight：[fusion](https://github.com/vectorize-io/hindsight/blob/11e624325b130210dc9b8fc7c5a0ae6cbd94077f/hindsight-api-slim/hindsight_api/engine/search/fusion.py#L8-L175)、[巩固实际调用](https://github.com/vectorize-io/hindsight/blob/11e624325b130210dc9b8fc7c5a0ae6cbd94077f/hindsight-api-slim/hindsight_api/engine/consolidation/consolidator.py#L2945-L2968) | 支持可配置的每通道候选 cap（配置值大于零时启用）；consolidation 使用 interleave 保留各通道重要的近重复候选。 | **分离用户 recall 和写入冲突候选检索**，避免只在一个通道排名很高的矛盾事实被 RRF 共识挤掉。 |
| Hindsight：[提交时 source 检查](https://github.com/vectorize-io/hindsight/blob/11e624325b130210dc9b8fc7c5a0ae6cbd94077f/hindsight-api-slim/hindsight_api/engine/consolidation/consolidator.py#L730-L754)、[tag 语义](https://github.com/vectorize-io/hindsight/blob/11e624325b130210dc9b8fc7c5a0ae6cbd94077f/hindsight-api-slim/hindsight_api/engine/search/tags.py#L40-L89) | 写事务内再次核对来源存活；部分 tag mode 包含 untagged。 | 采用来源生存/revision 再检查，SQLite 使用自己的事务语义；tags 不是 ACL，不把 bank/tag 配置当权限证明。 |
| Cognee：[增量水位](https://github.com/topoteretes/cognee/blob/c0d18c80e24b7b78918e7642c03f6f128fdd2aee/cognee/infrastructure/session/session_persist_watermark.py#L1-L46)、[成功后推进](https://github.com/topoteretes/cognee/blob/c0d18c80e24b7b78918e7642c03f6f128fdd2aee/cognee/tasks/memify/cognify_session.py#L63-L94) | 捕获处理窗口，add/cognify 成功后才推进 checkpoint。 | 采用增量窗口减少整段重复处理；本项目额外保留 revision/hash，计数水位不能处理编辑和重排。 |
| Cognee：[lesson 晋升](https://github.com/topoteretes/cognee/blob/c0d18c80e24b7b78918e7642c03f6f128fdd2aee/cognee/modules/session_distillation/distill.py#L349-L406) | 每条接受的 lesson 成为独立文档，模板控制外壳。 | 借鉴独立派生单元；仍需本地 lineage、低权威和适用前提，不能自动成为 profile 真值。 |
| memU：[TranscriptSource / cursor](https://github.com/NevaMind-AI/memU/blob/db8584c28f10798b2dc6b411dc835f911fb1d9bf/src/memu/hosts/base.py#L25-L82) | 统一宿主 transcript 读取、增量 cursor，区分 conversation 与含工具信息的 skill transcript。 | 借鉴来源适配与 cursor；不默认收集所有工具正文或对每次回答无条件外发。 |
| Letta：[当前入口 README](https://github.com/letta-ai/letta/blob/4511fa0bc91f68fbab32b91f694617271ea9012b/README.md)；Supermemory：[README](https://github.com/supermemoryai/supermemory/blob/958ae8b61960fe2ade495b095a01667cf44c5706/README.md#L297-L342) | Letta 当前仓库是指向 letta-code 的入口，旧 V1 已归档；Supermemory 本次未完整检查核心 Memory API。 | 作为产品/接口参考；不能把它们的能力描述标为本次已验证核心实现。若未来整体选型，另查实际运行核心的 SHA。 |

## 6. 改进后的目标架构

### 6.1 最小闭环

```text
Authenticated Source Envelope
  → 本地持久化/敏感内容策略
  → Episode + stable source segments + transactional jobs
       ├─ 确定性 lexical projection ────────────────────┐
       ├─ 可选 local/获准 provider embedding ───────────┤
       └─ 后台 extraction → validated units → projections│
                       → optional derived dependencies  │
                                                        ↓
Scene/query + server PolicyContext + TemporalQuery
  → candidate retrieval → fusion → evidence/eligibility recheck
  → current-state / applicability / context packing
  → Lens presentation 或 Ask/Compose reader
```

保留三个职责：证据保存、记忆组织、按场景交付；首轮不要求把六层概念分别实现为大型子系统。所有新表都须有一个本阶段读取者、写入者或恢复用途。已存在的表先审计兼容性，不为符合新名词而重命名。

### 6.2 Episode、Segment、Unit 的唯一职责

| 对象 | 真源与行为 | 不能承担的职责 |
|---|---|---|
| Episode | 保存 policy 允许的原文/脱敏正文与来源版本；用 `messages_raw` 作物理实现即可 | 不能由总结器改写；隐私删除例外 |
| Source segment | Episode 的稳定 UTF-8 span，携带 source revision、span hash、语言、标题/工单等可证明上下文 | 不是模型确认的事实；不是新的跨来源事件聚类 |
| Memory unit | 有来源的事实、决定、偏好、流程等解释，带状态、有效时间、revision | 不能决定原文是否值得存在于索引 |
| Projection / view | segment 或 unit 的 lexical/dense/contextual key，可重建，绑定配置及源版本 | 不能以生成文本冒充原始引用 |
| Derived / profile | 来源明确的推导，绑定所有必要父 revision，可过期、可撤回、可待重核 | 不能通过转述提升 authority 或放宽权限 |

`RetrievalObjectRef = { type: source_segment | memory_unit, id, revision }`。现有 chunk 如果满足 span、来源版本、删除和策略标签契约，可适配为 source segment；否则补映射/投影，不能假设旧 chunk 等价于原文真源。

**原文检索路径长期存在，但可检索不等于可自动展示。** 原文候选同样过来源、敏感信息、指令数据边界、时序、适用性和展示 gate；不会因为 unit 抽取失败就变成未经筛选的 prompt。当前状态查询不能通过原文 fallback 重新注入已知被更正的陈述；用已知失效 span/revision 标记过滤或明确作为历史引用。真正的隐私删除在所有模式均禁止返回。

同一来源的多个 segment、unit、view 合并到证据组，避免重复占满 context；多个独立来源仍可提供佐证。`provenance_family` 是保守的传播根标识，不是统计独立性的证明；转发和同源再加工继承根，未知独立性不增加 confidence。

### 6.3 写入协议与失败状态

1. 先校验 authenticated envelope，运行确定性本地策略；allow 保存原文，redact 保存脱敏正文，quarantine 加密隔离，block 只存无正文回执。凭证不得进入模型或错误日志。
2. Episode、source revision、确定性 segment-index job、extraction job（若适用）在同一事务登记。checkpoint 只在持久提交后推进。
3. Lexical 与 extraction 为独立任务。embedding / extraction 停机不阻塞 lexical；零事实不等于没有可检索证据。
4. 抽取输出严格验证结构、时间精度与可验证 source span。优先让 LLM 返回 segment ID、原文 exact quote 和必要的出现位置线索，再由确定性 resolver 计算 UTF-8 byte span；多处同文而无法唯一定位时拒绝该候选。不得依赖 LLM 自行计算中英混合字节偏移。结构合法不代表语义忠实；另测支持率、遗漏率、主体/否定/条件/时间正确性。
5. 冻结 batch 后用稳定 work key 集成。job identity 绑定 episode、source revision、extraction contract/config；同版本重复入队不产生新作业。`INSERT OR REPLACE` 不应修改已冻结结果；同 key 内容不同为硬错误。重跑新模型是新的 extraction run，与旧结果显式关联，不能因 run 不同就重复加固。
6. unit + sources + revision + integration receipt + projection/失效 outbox 同事务提交。projection worker 只消费已提交记录；旧 revision 任务不能覆盖新版本。
7. Claim 必须含 lease generation/fencing token；可回收过期任务。最终提交核对 lease、source revision、policy epoch 与 deletion epoch，防止迟到 worker 写回被删内容。

对外状态分开表达：`saved` 是证据已保存；`lexical_ready` 是原文可检索；`semantic_pending/failed/ready` 描述语义增强；`quarantined/blocked/failed` 有类型化原因。禁止用一个 `ready` 同时表示保存、抽取、向量与所有 surface 都已可用。

显式“记住”可以同步产生有来源的 note，但是否确认长期 profile 由当前用户意图决定。普通来源无需逐条用户审核；系统自己重试、降低权威或保持安静，高责任变更才请求用户控制。

### 6.4 真值、时态与依赖失效

继续使用统一 TruthMaintainer；所有 unit/edge/profile 的状态变更由它负责，索引 worker 无权决定事实状态。冲突键至少包含 subject、predicate、owner/tenant、scope、有效区间与 predicate 的基数语义；多值关系不能误按单值冲突。

先保留冲突双方的独立 claim 和 sources，再建立 dispute/supersede 关系；支持相反命题的来源不能合并成一个陈述的支持集合。完整 before snapshot 在修改前冻结；revision 包含 canonical 字段、sources 与必要关联。幂等 digest 覆盖所有影响裁决的字段，并在提交事务内验证；独立性与 evidence-class cache 从正规化来源重算。

写入时使用单独的 `TruthCandidatePlan`：在已授权范围内先查询 subject/predicate/有效区间的确定性候选，再补各 lexical/dense 通道的候选并集，保留单通道 Top-m。目标是找全重复与冲突，而不是挑最值得展示的记忆；不能复用用户 recall 的 RRF Top-K 后断言“没有冲突”。候选预算不足时标记 deferred/disputed，不能强行覆盖旧值。

- 时间明确区分 `observed_at`、`ingested_at`、`valid_from/to`、`tx_start/end`。整数使用规范化 UTC 秒；API 用带 offset 的时间或明确的 partial-date 结构。
- `TemporalQuery` 至少表达 `mode=current|historical|audit`、`asOfValid`、可选 `asOfKnown`、`timezone`、`timeBasisSource`。有效区间统一 `[from,to)`；开放端点、未知时间、日期/月精度分别建模。
- current 取指定有效时间内成立的事实，不按 `updated_at` 最近覆盖一切；迟到来源回填历史有效区间，保留何时才被系统知道。
- 确实是权威更正时 supersede；来源矛盾但不足裁决时 disputed；历史事件不被抹去。被撤回的错误断言不能充当当前证据；审计历史另走受控入口。
- 依赖关系保存 `parent_id + parent_revision + dependency_type`。上游 revision 改变时，同事务更新权威失效账本、dependency epoch 与 outbox；所有读取先比较依赖版本，立即阻断旧结果，后台再传播缓存删除和重算。不能要求进程外缓存也参与 SQLite 原子提交，或把整个依赖闭包同步遍历到请求超时。
- `dependency_validity=valid|needs_recheck|invalid` 是独立派生有效性字段，与 unit 生命周期 status、extraction 状态分开；读 gate 也可按 parent revision 不一致确定待重核。无须让用户审核每次内部重算。

### 6.5 PolicyContext 与全部外发路径

PolicyContext 由服务端根据认证生成，至少包含 principal、tenant/owner、agent、source scope、允许敏感度、目的、destination/provider、policy version。客户端不能自行声明拥有某用户。现有 auth 模式可复用，但服务 key 代用户操作与用户绑定 key 必须在审计中区分。

写入侧复用既有 MemoryClaimEnvelope：owner、speech mode、引用/转述根和其 policy 结论成为 v3 候选的受约束输入。来源归属失败时仍可保留合法 raw evidence，但派生晋升不得抢跑；不能依据 sender 非空推导“用户本人陈述”。

授权覆盖：原文、unit、entity alias、graph seed/edge、profile、FTS、vector、缓存、open_sources、导出、日志和 shadow。检索先限制允许范围，再取内容，返回及外发时重新校验当前版本。向量引擎无法下推完整过滤时，仅在本地读取有界候选 ID、批量回表验证与继续补候选；不得向未授权模型暴露候选正文，也不得为了凑数量放宽权限。

对多来源内容区分两种情况：

- **独立充分佐证**：若任一获准来源都独立支持完整陈述，可用获准来源生成本次返回文本与引用。
- **共同推导**：若结论需要 A 与 B 共同支持，必须 A、B 以及依赖闭包均获准；只允许 A 时不返回原结论。允许从 A 重算一个较窄、独立有证据的结果，但那是新的派生版本。

所有模型调用都算目的地边界，包括 ingest extraction、contextualization、embedding、rerank、Ask synthesis、consolidation 与 eval judge。`local_only` 内容使用符合策略的本地模型或保持 lexical；云 provider 不可用或未获准不能降级为偷偷外发。查询文字也应检查，不能只检查候选记忆。

确定性 secret 防护与 prompt-injection 分类分开。历史命令、代码和用户授权的 procedure 可以作为引用数据保存；分类器不能仅凭祈使句删除合法记忆。内容隔离和引用标签也不是完整防注入机制，工具执行仍由当前动作授权独立决定。对外仅给不泄露隐藏数据存在性的错误；详细拒绝原因限 owner/admin 诊断。

Origin-bound 设计依赖来源通道可认证、origin 标注正确和授权通道未被控制，不能只保存 lineage 就宣称防注入。外发在发送前核对最新策略；撤权发生前已被授权传出的内容，不能靠清空本地缓存承诺召回，需按真实目的地能力给出清楚边界。

### 6.6 检索、拒答和 context pack

首轮默认只有 lexical + 一个已验证 dense 通道；exact ID、明确时间约束是 query/scope 信号。graph/PPR、needSlots、trigger-question 是独立实验，不因规划过就自动启用。

1. 保留原始 query；确定性解析 Jira key、来源、语言和明确时间，不把自动扩展结果当事实。lexical 的索引与查询使用同版本 tokenizer；测试两字中文、混合词、URL、代码名和完整 Jira key。trigram 对很短词的边界用明确的 exact/alias 路径补足，不以任意 substring 扩大匹配。
2. 每逻辑通道按对象去重，再按 evidence group 限额。segment/trigram 的 lexical 合并只算一份通道证据；unit 多 view 也不反复加分。
3. 用 weighted RRF 等方法融合候选排名。RRF 值只代表排序支持，**既不是相关性概率，也不是真实性 confidence**；不能直接用 `0.5` 一类通用概率阈值拒答。
4. 用有标注的校准集评估证据相关性、主体一致、时间适用性、条件完整性和来源支持，形成 surface 准入决策。小型本地 reranker 可实验，Passive 不引入在线生成式 LLM。
5. MMR/去重保护 context 多样性，但不能挤掉多跳问题的必要证据；以 evidence coverage 约束最终选取。
6. pack 按预算装入必要片段，附来源 ID/span/revision、时间、冲突/待重核状态和作用：事实、历史引用或低权威推导。省略内容可用 open_sources 按需读取，读取时再次授权。
7. Ask/Compose reader 只消费 pack；引用必须指向实际支持陈述的 span。生成失败与检索无证据分别报告，不把 fallback 文本当成功回答。

对于“不该展示”“确无证据”“策略不允许”“索引还没准备好”“通道超时”保留不同内部诊断，前端沿用既有低打扰契约。不强制 `min_results`。已授权结果可 partial，但检索不完整时不能高置信断言“不存在相关记录”。

### 6.7 性能与运行成本

沿用原方案的 Passive 500 ms、Compose 700 ms 作为**待实测的首轮 retrieval p95 目标**；明确计时覆盖服务端收到请求到完整候选与 gate 结束，包括冷模型和排队。部署端到端延迟另报网络与展示部分。Ask 的 2.5 秒只作为首批可用证据目标候选，TTFT 与完整答案另设预算，不能要求任意第三方生成都在同一时限内完成。

每请求一个整体 deadline；通道并行、独立预算、AbortSignal 贯穿。超时任务不得继续占满池或写业务结果。记录 p50/p95/p99、cold/warm、timeout、partial、queue age、成本与事件循环/数据库竞争。每用户并发、日预算、后台预算和高水位暂停分别受控。

候选生成、rerank、context token 三个预算独立配置；记录 retrieved → dedup → policy-filtered → fused → rerank-cut → evidence-gated → token-packed 的计数和丢弃原因。候选上限在对象去重后计数，避免同一 unit 多 view 挤走其他证据；补测 lexical-only/dense-only 相关候选的保留率。

shadow 使用同 corpus/policy watermark 的成对请求；采样率由开销预算决定，记录选择概率供分析。优先隔离重放，线上 shadow 不阻塞主请求，不记录 exposure/outcome，不调用会修改生命周期的老 reader。原始真实内容不得进入入库报告或公共研究工具。

## 7. 评测设计：先证明量尺正确

### 7.1 将错误定位到具体环节

| 层 | 核心问题 / 指标 | 不能冒充的指标 |
|---|---|---|
| 供给 | 合规非空来源是否持久化、是否按期产生 lexical；分来源/时间/语言的 coverage 与 index lag | 只看总行数或 health 200 |
| 抽取 | 陈述是否由 span 支持，是否保留主体、否定、条件和时间；必要信息遗漏率 | parse 成功率、产出 unit 数 |
| 候选 | gold source/必要证据集合的 Recall@k、Hit@k；时间/实体 hard negatives | 候选数量、old/new overlap |
| 当前状态 | 正确选择有效事实；旧依赖是否失效；历史问题是否可解释 | 最新时间戳、相似度最高 |
| 展示 | useful-new@1、无价值打扰、应展示却安静、应拒答却强答 | 仅对已展示样本计算的精度 |
| Reader | claim-level 引用支持、条件忠实、current-intent 适用性、无证据断言 | 答案非空、引用 URL 存在 |
| 运行 | 延迟、超时、队列、成本、恢复、幂等和删除闭包 | scheduler 状态成功 |

必须设 oracle evidence pack：若给出完整正确证据仍答错，问题在 reading/state resolution；若 source 检索命中而 unit 路径失败，问题在表示/抽取；若两个都不命中，才进一步区分供给、候选和排名。no-memory 与权限/预算相同的 long-context 是有效对照，不允许给新方案更多上下文或更强模型而称为纯检索收益。

### 7.2 样本与评分

- 保留现有六能力 smoke，但明确它不是完整 LongMemEval，也不能替代统计 rollout gate。按 AGENT.md 用 branch-authoritative endpoint 运行。
- 建真实失败样例集与合成防回归集；场景至少包含 Ask、Compose、Passive × 中文/英文/混合 × Jira/群聊/Web，以及短标识、否定条件、同名实体、时区、迟到更正、多跳、无答案和合法历史指令。
- 开发、校准、冻结测试分离；按 source family / 会话 / 时间块拆分，禁止同一消息衍生 query 落入多个集合。真实失败例可进入开发集，但最终收益还要在未用于调参的 holdout 证明。
- 检索 gold 是必要 source span 集合和可接受替代证据；答案 gold 是可核验主张，不要求逐字匹配。机器关键词种子只用于 sanity test，至少经人工审阅才能作为质量 gold。
- 确定性 judge 负责 ID、边界、状态、时间、幂等；语义判断可采用固定版本 LLM judge，但必须经过一部分人工复核，报告一致性、分歧、judge/prompt 版本及预算。
- no-result 必须同时测错误接受与错误拒绝，按实际 surface 决策计分。增加“永远拒答”和“随机返回更多候选”两个坏基线，验证 gate 不会给它们通过。

### 7.3 消融顺序

| 变体 | 相对于上一对照唯一改变 | 决策用途 |
|---|---|---|
| B0 | 当前生效旧路径；冻结模型、语料水位与配置 | 重现真实问题 |
| B1 | 完整合规 source-segment lexical + 当前 dense | 先量化供给与原文路径收益 |
| B2a / B2b | 单独比较确定性上下文 key / fact-enriched key，原文 value 不变 | 判断补语境是否比大重构更划算 |
| B3 | atomic-only 与 source+unit 双层分别对照 B1/B2 | 量化抽取损失与多跳收益 |
| B4 | 换 multilingual-e5-small，其他变量固定且覆盖一致 | 判断模型贡献 |
| B5 | 加小型本地 reranker，候选/语料/模型固定 | 判断重排收益及延迟成本 |
| B6a / B6b / B6c | 分别加 needSlots、trigger views、graph/PPR | 各自可否决，不串成只能看总收益的组合 |
| B7 | 在胜出配置上单独改变量化/索引实现 | 只在容量有收益时做 |

模型 exact revision、ONNX artifact hash、tokenizer、prefix、pooling、normalization、dimension、dtype 都写入报告。**模型权重被量化**与**存入 SQLite 的向量 int8 量化**是两个实验变量，不能因使用量化 ONNX 就宣称验证了 int8 向量索引。

最开始用离线片段和候选文件即可完成 B2/B3，无须等待全套 v3 schema。BGE-M3 dense-only 可作为容量上限候选，但先过目标宿主加载/内存/许可检查；没有实际瓶颈时无需更换数据库或引入 ANN。

### 7.4 统计与上线门

质量门沿用预注册非劣思路：默认主指标允许的最大回退为 2pp，必须在看结果前锁定。指标统一为“越高越好”的方向后，各上线 surface 主指标 `new - control` 的 95% CI 下界必须 `>= -0.02`；声称改善要求预注册目标指标差值 CI 下界 `> 0`。保护指标分别预注册方向、阈值与裁决方式，不能与主指标混成平均数。

配对重采样按会话/证据 family 聚类，保持每个 old/new 配对，报告 95% CI；语言与 surface 关键分层样本不足就是 inconclusive。多变体筛选只在开发/校准集做，最终在冻结测试集确认，避免反复挑最好分数。

“至少 150 条”只够初始诊断，不能保证检测 2pp 差异。按预期配对不一致率、目标效应、置信精度与成本计算规模；不要事后放宽 margin。安全零失败是**已执行用例的 gate**，不应被描述为现实世界零风险的统计保证。

通过 Q3 必须同时满足：目标错误类别有可信改善；每个上线 surface 非劣；没有跨边界、删除复活、伪造引用、重复强化或恢复失败；供给与延迟/预算可接受。仅架构更整齐、平均得分更高、候选更多或观察够 30 天均不算通过。

## 8. 实施路线与回滚

### 8.1 质量主线与能力扩展分别交付

| 工作包 | 依赖 / 范围 | 可审核产物与退出门 | 回退方式 |
|---|---|---|---|
| Q0：事实与量尺 | 无；核实生效版本、开关、供给、故障样例；审计现有 P0.5/P2 harness | 新 evidence manifest；F1–F3 的指标修订与坏基线测试；按已实现/未接入/未验证重排任务 | 无生产写入 |
| Q1a：来源与旧路径可靠性 | Q0；确定性 segment 供给、当前 FTS 可恢复、来源/时间、最小 PolicyContext、删除阻断；F12 小范围验证 | LLM 全停仍 lexical 可用；来源与索引无静默缺口；范围/删除负向用例过门 | 保留当前生效 reader；停止新增增强 worker，证据与 lexical 继续服务 |
| Q1b：v3 完整性 | 复用 Q1a 契约，仅在启用 v3 unit 路径前要求；修 DTO/claim、job/truth、FTS、时间/span、policy | F4–F11 关闭；队列崩溃恢复、完整 revision、幂等与来源 gate 过门 | 继续隔离 v3，不阻塞 source-only 的质量修复 |
| Q2：有界质量实验 | Q1a；核心 B0–B4 分批比较，B5–B7 按收益/瓶颈触发；离线候选文件不依赖 Q1b 全部完成 | 完整分层报告、失败分析、模型/表示 ADR；无增益机制明确不采用 | 实验投影隔离，可直接停用 |
| Q3：最小生产闭环 | Q2；source evidence + 胜出的可选 unit/key/rerank + current-state/context pack；采用 v3 unit 时须 Q1b 通过 | Ask→Compose→Passive 分别过门；旧行为兼容；真实故障回放和端到端证据完整 | 每 surface 独立回退，但保留统一安全/删除 gate |
| E1：记忆演化 | Q3；低风险去重、derived/profile、生命周期、反馈 | 多轮纠错/依赖失效、噪声与误适用评测通过；成本有界 | 关闭相应生成阶段，保留证据和已确认当前状态 |
| E2：多宿主与退役 | 对外扩宿主依赖 Q3 策略与来源契约；遗留退役依赖所有迁移门 | adapter 合约、外发 receipt、撤权测试；数据覆盖、变更重放与恢复演练 | 撤销宿主权限；兼容 reader/投影可重建 |

Q0–Q3 达成后即可独立报告“召回质量主线完成”；E1/E2 是后续可选择的扩展，不能为了完成基础修复而先建设全量画像、agent onboarding 或 learned ranker。Adapter 也不必须等待全部巩固能力，只需其真实依赖已通过。

若 Q2 证明 source+enriched-key 已满足质量需求，Q3 可以先交付该路径；v3 unit 的未启用工作继续列为缺口，不冒充已完成，也不迫使为了上线原文检索而先完成整套事实治理。source-only 仍须处理已知纠错/删除标记与 reader 的当前状态解释，不能借此跳过安全或时间验收。

Adapter 的测试至少包括：服务返回正确 pack 后宿主是否真正读取、是否保留引用和限制、压缩后是否遗失当前要求、是否错误覆盖当前用户意图，以及 scope 撤销后的再次读取。只证明 HTTP/MCP 请求成功不能算跨宿主记忆体验完成。[^17]

旧阶段映射：R0/P0.5 的证据工作进入 Q0/Q2；P0a–P0c 的必要可靠性进入 Q1；P1/P2 的最小 schema/read 路径进入 Q1–Q3；P3 进入 E1；P4 和 P5 分属 E2 的宿主扩展与退役，分别验收。已有代码通过对应检查即可复用，不要求重复开发。

### 8.2 数据迁移规则

迁移 manifest 必须记录 source high-water mark、消息/segment/unit 映射、policy/deletion epoch、配置版本、已完成和未完成的投影。Coverage 的分母是合规且非空、应该可检索的来源；policy skip、quarantine、零事实、抽取失败与 missing projection 分开统计。

迁移期间只有一个 canonical writer；旧 chunk 和新 projection 都从该来源派生。若仍由旧入口写 episode，则在它的事务中登记后续 job，不能双入口各自创建“同一条记忆”。source id 不稳定时用 connector/import manifest 的稳定定位符与 keyed fingerprint；不以 content-only 合并两个不同事件。

历史回填按真实索引缺口选择范围，不盲目全量再 embedding。每批先 dry-run、独立备份/恢复验证，再幂等写入与读回；本文件不继承旧文档中“7 项作业预授权”作为本轮执行许可。后续实施时核对原始授权范围和当时状态，已存在且适用的授权无需重复索取。

### 8.3 旧写停止后的回滚不能丢数据

停止旧投影维护前，必须已具备一条通过演练的兼容路径：旧 reader 可由 canonical episode + correction/retraction/deletion 事件重建到指定水位，或者短期继续维护旧投影。仅保留停止时刻的 old-store 快照不满足回滚要求。

恢复顺序：进入维护/只读 → 恢复快照 → 回放快照后的已确认变更 → 重新应用最新 policy 和删除 tombstone → 重建受影响索引 → 验证覆盖/FK/FTS/版本 → 再接流量。恢复前不得提前暴露快照内容。

删除与撤权 journal 需要独立于被恢复快照的保留边界，可是最小无正文日志，不要求创建全局业务数据库。删除后迟到的 extraction、outbox、adapter 缓存与 connector 重导入都检查删除 epoch/source tombstone。清理含正文的 revision、冻结 candidates、hash、向量、日志、缓存、派生物与备份；只有不可恢复性完成后才报告永久删除。

隐私删除策略按真实产品保留约定确定备份到期/重建/crypto-shred，不由本文宣称满足某项法规。若采用 envelope encryption，必须验证密钥实际不在可恢复备份内。SQLite 内部行删除、`secure_delete` 或单次 VACUUM 都不能证明外部日志和全部备份已清除。[^12][^13]

### 8.4 本地运行与验证要求

后续实施遵守 AGENT.md：针对性测试与服务 build；影响 extension 才跑对应开发编译和必要 E2E；recall/write path 变更必须运行 `eval:memory-abilities`，endpoint 指向实现分支服务或已部署同版本服务。质量 suite 在 `evals/` 注册，执行 `eval:validate`、目标 `eval:run -- --suite <id> --no-repair` 并保存报告。

验证优先使用隔离的合规数据副本和真实 schema；eval 的逻辑只读不代表 HTTP GET，POST /ask 的权限应按操作语义明确。正式运行前确认 reader 不写 memory、profile、lifecycle、feedback、reflection 或后台 action；允许的 usage/诊断也须限额、脱敏并明确记录。

每个工作包保留：代码与依赖版本、schema/policy/model 配置、数据水位、样本/gold/judge hash、质量和安全报告、migration/shadow diff、恢复回执。只有聚合和 synthetic fixture 可以进入 Git；真实正文留在受控本地目录。

## 9. 关键不变量与验收清单

| 不变量 | 必须具备的负向/恢复验证 |
|---|---|
| 原文可检索不依赖语义抽取 | LLM 关闭/失败/零事实/成功漏条件，lexical 均存在并保留 span |
| 投影确实可重建 | 丢弃实验投影后 rebuild、外部内容一致检查、删除/更新后重建；不同模型版本不混用 |
| 来源不能被提升权限 | snake_case 映射、未知来源、第三方转述、跨来源联合派生和多语言 secrets |
| 当前事实与历史事实分开 | 迟到更正、相同主体多值、历史 as-of、未知/部分日期、旧 derived 待重核 |
| 删除与撤权立即阻断后续服务 | 老缓存、过期 lease、新旧 reader、open_sources、旧备份、connector 重放均不能复活 |
| 幂等不是只约束单次 retry | 同 episode 重入队、模型重跑、重复转发、并发 integration、投影迟到均不重复强化 |
| shadow/eval 不改变业务状态 | 前后业务状态 diff，只允许白名单 usage/隔离诊断变化 |
| 拒答门能识别坏系统 | 永远拒答不能过有答案集；随机堆候选不能过无答案集；RRF 分值上界 sanity |
| 记忆不替代当前授权与前提 | 历史合法 procedure、真实但不适用经验、当前用户改要求、恶意 dormant payload 分别测试 |
| 质量与平台进度分开报告 | Q3 可单独交付；E1/E2 未执行时不写“完整记忆平台重构完成” |

## 10. 采纳与文档交接

建议采纳本方案中的 Q0–Q3 主线、source-segment 长期检索、权限前置、依赖失效和恢复协议；保留原 v3 对 lineage、outbox、版本与审计的约束。暂缓无独立收益证据的图扩张、额外 query views、复杂衰减参数、固定数量 core slots、learned ranker 和数据库拆分。

正式实施前，用一份 ADR 确认最终 canonical 路径，并同步修正原方案、回填、级联删除、benchmark、adapter 的冲突条目。实现完成后，行为与决策逻辑沉淀到对应 `docs/features/` 文档并按 AGENT.md 更新索引；未完成的扩展继续保留计划状态，不能把本次审查写成已实现功能。

本次文档交付完成条件：新增一份可单独阅读的改进计划；区分现有事实与待验证推断；包含一手研究、开源代码依据、内部冲突、具体工作包和验收/回滚条件。**不以本文件的生成代替 recall 修复或生产验证。**

## 参考资料

资料访问日期均为 2026-09-10。论文版本固定如下；后续新版本可能改变结论，实施前只刷新会影响决策的来源。

[^1]: Di Wu 等，[LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/html/2410.10813v2)，v2，2025-03-04，重点 §5.2–5.5、Appendix E.3。
[^2]: [MemoryAgentBench](https://arxiv.org/abs/2507.05257v4)，v4，2026-06-28。
[^3]: [LongMemEval-V2](https://arxiv.org/abs/2605.12493v1)，v1，2026-05-12，Work in Progress。
[^4]: [AMemGym](https://arxiv.org/abs/2603.01966v1)，v1，2026-03-02。
[^5]: [MemEvoBench](https://arxiv.org/abs/2604.15774v2)，v2，2026-05-21。
[^6]: [EvoMemBench](https://arxiv.org/abs/2605.18421v2)，v2，2026-06-15。
[^7]: [StateMem / StateMemBench](https://arxiv.org/html/2608.19652v1)，v1，2026-08-20，重点 §5.2–5.3 与 Appendix H。
[^8]: [MemTrapBench](https://arxiv.org/html/2608.20202v1)，v1，2026-08-20，重点 §3.6 与讨论。
[^9]: [MemSecBench](https://arxiv.org/abs/2607.27080v1)，v1，2026-07-29。
[^10]: [Hidden in Memory](https://arxiv.org/abs/2605.15338v2)，v2，2026-05-18。
[^11]: [Origin-Bound Authority](https://arxiv.org/abs/2606.24322v1)，v1，2026-06-23。
[^12]: SQLite 官方，[FTS5 Extension](https://www.sqlite.org/fts5.html)，external content、rebuild、integrity-check 与 secure-delete 说明。
[^13]: SQLite 官方，[Online Backup API](https://www.sqlite.org/backup.html)、[VACUUM](https://www.sqlite.org/lang_vacuum.html)、[Write-Ahead Logging](https://www.sqlite.org/wal.html)；sqlite-vec 作者，[Versioning](https://alexgarcia.xyz/sqlite-vec/versioning.html)。
[^14]: Daniel Ford，Anthropic，[Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)，2024-09-19。
[^15]: Prithvi Rajasekaran、Ethan Dixon、Carly Ryan、Jeremy Hadfield，Anthropic，[Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)，2025-09-29。
[^16]: Letta，[Evaluating Memory in Production Agents](https://www.letta.com/blog/evaluating-memory-in-production-agents/)，2026-07-28，Context-Bench V2 为私有基准。
[^17]: Harrison Chase，[Your Harness, Your Memory](https://www.langchain.com/blog/your-harness-your-memory)，2026-04-11。
