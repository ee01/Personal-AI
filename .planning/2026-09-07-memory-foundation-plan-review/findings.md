# Findings: Memory Foundation Rearchitecture Review

## Requirements

- 审查现有 plan 有哪些值得改进。
- 调研该修改方向中业内热门开源项目、相关论文和专业人士讨论。
- 将研究结论转化为对原 plan 的具体改进建议。
- 保持只读审查范围，不修改运行时代码或原 plan。
- 后续用户已明确授权：直接修改原 plan，持续补充研究与正反分析，直到形成无相互矛盾且可执行的 canonical 方案。
- 本轮仍不实现运行时代码、不执行生产配置、数据库迁移或破坏性数据作业。

## Local Findings

- 原 plan 约 2217 行，已经包含架构现状、业内项目映射、数据模型 v2、迁移阶段、预算和评测；审查重点应是证据质量、可证伪性、阶段门和隐藏耦合，而不是补一份泛泛竞品列表。
- `AGENT.md` 将 Personal AI 定义为私有、自治、可反思的记忆系统，并要求召回/排序/LLM 质量变化必须有 `evals/` 和六能力回归门；审查建议必须保持这些产品边界。
- 当前 plan 自身识别到一个比大重构更紧急的事实：关闭 ingest extraction 会连带使 chunk、FTS、vector 供给停止，被动 Lens 又拿不到 raw LIKE fallback，导致近期开启的记忆无法进入主召回通道。
- 历史记忆显示被动 Memory Lens 已有后端过滤回执和 novelty/visible-echo 抑制契约；新架构不能把已经存在的展示层治理重复实现进检索核心。
- 原 plan 的结构已经远超普通设计稿：含 14 章、10 个冲突裁决、P0-P5 迁移、事故止血、评测指标和 S1-S7 自审。真正缺口更可能是阶段边界、证据分级、实验设计和物理 schema 可行性，而不是再增加概念。
- plan 在 §2.10、§10.4b 已发现当下生产事故根因，同时在 §5-§9 提出大规模逻辑重写；必须审查两者是否被放在同一个变更窗口，避免止血与重构相互污染。
- `AGENT.md` 明确 memory recall/write path 的交付必须运行 `eval:memory-abilities`，且要对准部署后或本地分支服务；plan 的阶段门应把这一条变成每一阶段的硬回归约束，而不只是最终评测说明。
- plan 明知有三处“后文推翻前文”却仍保留冲突性执行文本；例如 §0.5(5) 说数据修复需逐项授权，紧接着 §0.5(5b) 又说 7 项已预授权。对长周期、多执行者迁移，这是操作事故源，应把“历史讨论”移入 ADR/附录，正文只保留 canonical decision ledger。
- §5.2 的 lineage 使用 `sources_json`、实体引用使用 `entity_ids_json`，但 §10.5 又要求级联删除与可审计溯源；JSON 引用无法提供 FK、唯一性、增量删除或高效反向查找。应至少增加 `memory_unit_sources(unit_id, episode_id, span...)` 与 `memory_unit_entities` 连接表，JSON 只作缓存投影。
- `memory_unit_history` 只保存 `old_text`，不能还原 authority/status/validity/sources 等语义版本；若目标是双时态与可审计回滚，应采用 append-only revision 或记录完整 before/after payload，并明确 transaction time。
- “同值即 confidence +0.1 / times_derived++”没有区分同一 episode 重放、同一来源转述与独立证据，容易被重复导入/循环反思自我强化。加固计数必须以去重后的独立 evidence key 和 source-correlation 为边界。
- 外部内容 FTS 表的 schema 没在当前片段中说明 insert/update/delete triggers 或 rebuild 原子性；向量/FTS 多投影的同步一致性必须作为 schema contract 和迁移验收项。
- §6 的抽取失败兜底把“原文首句”直接标成 `kind=fact, authority=evidence, status=active`，这会把标题、寒暄、命令或未验证内容伪装成事实。更安全的形态是 `opaque_episode_stub/needs_extraction`，只允许原文 FTS/audit 召回，不进入事实图、画像和主动注入，待重试成功后再晋升。
- 抽取 prompt 用“10+ 条消息通常产 5–15 个 units”作为产量要求，容易诱发没有信息时也生成记忆；应改成 precision/abstention 优先，并用 `skip_reason`、coverage 与漏提率 eval 约束，而不是最低产量暗示。
- §4.4 C7 已裁决 GA reflection/anticipation 等需当夜闭环任务走同步 API，但 §6.5 和 §7.5 仍把反思写成 smart Batch；这是会直接改变产品时效的执行冲突，应在 canonical matrix 中只保留一个答案。
- §7.2 把“被检索且被回答/卡片引用”当作 FSRS 强化事件，会形成曝光-强化自循环：旧条目因为先被排上来而不断提高 S，新条目更难出头。FSRS 的复习成功信号不能等同于系统自选曝光；至少要做 propensity/exposure 校正，并优先以用户采用、纠错、后续任务成功作为 outcome。
- §7.9 从多个系统的 working/core 容量推出“常驻 25–50、按需 100–500 的业内共识”是不可比类推；这些数字对应字符块、画像条目、会话段、LongTermMemory 上限等不同对象。T0=40、query candidates=200 可做初始实验值，不能写成已证实最优值。
- `density=distinct source episodes/token` 会奖励把大量相关或重复 episode 绑定到一个短结论，且没有考虑来源独立性、矛盾、覆盖跨度和概括失真。应使用 effective independent evidence、source diversity、contradiction penalty 与 compression-fidelity eval。
- “库存永不硬删”与 §7.9 的 superseded 180 天物理删除、§10 的隐私/级联删除天然冲突。应区分产品遗忘（降可及性）、运维保留（归档/tombstone）和用户/法规删除（不可恢复清除）三种语义。
- §7.10 已裁决 summary/trigger question 应与源 unit 做“索引键增强”而不是独立候选竞争，但 §8.3 的 authoritative retrieval spec 仍定义独立 `V_body` 与 `V_trig` 通道，并让其跨通道 RRF 累加；这会给同一 unit 双重曝光加分，正好违背后文修正。必须选择一种物理实现并更新 schema、融合、消融三处。
- `RetrievalPlan.filters.authorityMax` 暗示 authority 可线性排序，但 evidence/self_confirmed/derived 更像类型与适用性策略，不是简单高低。应使用 `allowedAuthorities` + per-need policy，并把 privacy/scope/tenant ACL 设为检索前硬过滤，不能靠 authority 权重兜底。
- passive `min_results=1` 若意味着低于阈值也硬保一条，会破坏“应保持安静”的产品边界。无证据是合法且常见输出；必须有 no-result/abstain 路径，并单独评测 false positive rate 和 interruption cost。
- §8.5 的相对阈值（`0.40*top1`、`p75-1.5std`）在整批候选都差时仍会放行；需要经标注集校准的绝对证据门，或按 surface/slot 的 risk-coverage 曲线设阈值。
- §8.6 声称“只用 rank≤3”处理位置偏差，实际上会加重选择偏差，模型永远看不到被当前排序压低的反事实好结果。需要小流量随机化/交错实验或 inverse propensity weighting，并把 opened/dismissed 与真正任务采用、纠错、后续成功区分开。
- `utility=正向结局/(展示+1)` 在 5 次 hit 后就完全取代 salience，样本太少且方差极高；应用带先验的 Beta-Binomial/置信下界并保留 exploration，避免一次偶然点击永久塑形。
- §9 从同群互动频次/直接 @ 自动产生 `social` 边会把共现误写成关系事实；应保留 `co_occurs`/interaction signal 与 `reports_to/works_with` 这类语义关系的严格区别，并对推断关系标 authority、scope、expiry 和证据。
- 画像 induction 用“跨 ≥2 来源”不足以证明独立性；同一人重复转述、同一事件的多平台同步、AI 摘要回流都可能高度相关。应引入 provenance family / echo detection / independent-source count。
- §10.4b 的 rehearsal 去重设计在逻辑上不可执行：`UNIQUE(rehearsal_id, scene_key, surface)` 与“超过 1 小时再 INSERT 新行”冲突，第二个时间窗仍会违反唯一约束。应选择时间桶唯一键、单一累计行，或拆分 current aggregate 与 interaction event 两表。
- 坏时间戳无法恢复时回填 `created_at` 会把“时间未知的旧事实”伪装成当前事实，污染 `T_time` 和近期排序。应保留 unknown/low-quality time，分开 `observed_at` 与 `ingested_at`，查询侧明确降权或排除。
- `lost_and_found` 不能靠列数“猜原表”后回填生产表；需要可验证的 schema fingerprint、字段类型/主键/外键/抽样语义校验，无法证明的记录只能隔离归档，不能提升成活跃记忆。
- 备份的“关键表行数不得低于上一份 90%”会把合法 retention、用户删除和事故清理误判为坏备份。应校验事务一致性、schema version、FK/FTS/vec 语义不变量和有解释的 deletion manifest，而非简单单调行数。
- `VACUUM INTO` + 原子替换若进程仍持有旧 inode/连接，可能继续向被替换文件写入；plan 需要明确停写/关闭连接/fsync/rename/reopen/health check/rollback 顺序，而不是只写“reader-gap”。
- 全局 `shared.db` 装组织目录与平台绑定却未写 tenant/org 边界、并发连接和权限；“全局不按用户复制”不能以牺牲跨租户隔离为代价。
- 适配器 prompt 里 `ALWAYS call before answering anything that could depend on prior context` 会诱导过度召回与无关私密上下文外发。应由 host/surface policy 决定，默认最小检索、先 scope/egress gate、允许 abstain。
- `agent self-onboarding` 在人类“事后认领”前发放能访问私人记忆的 key 风险过高。若保留，只能是零数据 sandbox/短时 challenge，任何读写真实 memory scope 都必须先有人类同意。
- fail-open 要拆成两层：宿主任务可以继续，但记忆写入/外发不得静默降级为成功；必须有 durable queue、失败回执和幂等重放。
- S1 建议先单用户灰度，与 §0.5(5b)“25 用户全量一起开”的所有者决策冲突；S2 又把 context_pack 限为只输出 public，可能让私人助理核心用途失效。两处都需要目的地/用户级策略矩阵，而不是一刀切。
- P0.5 用“现有高 sal chunks”验证 trigger-question，但 plan 自己证明当前 chunks 99.9% 是派生散文污染；该探针无法代表未来 atomic units。应从原始 episodes 构造小规模 gold/shadow unit 集再做 A/B/C，否则可能因输入错误否决正确机制。
- 附录 strict schema 与正文不一致：正文声称 source span 必填，JSON Schema 只要求 `source_episode_ids`；DB 使用整数时间，Schema 用 date 字符串且丢失时分秒；edges 输出名称而非稳定实体 id；多层 object 未完整声明 `additionalProperties:false`。需要一个版本化、代码生成并可 round-trip 的唯一 schema。
- 设计原则 P7 把读路径一概定义为 fail-open 不够安全：向量/图通道超时可以退化，但 scope、tenant、sensitivity、egress 与 prompt-injection gate 失败必须 fail-closed。应写成分层 failure policy，并在回执标明 partial/stale/omitted 原因。
- §2.8 的 2026-09-03 实测极有价值，但多个结论仍是相关性推断（开关关闭时间与 profile 停更吻合，并非配置变更审计证据）。plan 应给每条主张标 `observed / code-proven / inferred / hypothesized`，避免把因果推断直接变成迁移依据。
- “114 张表”需区分业务表、FTS/vec shadow table、migration/meta 表；若不分类，表数不能直接证明概念复杂度或支持三库重构。架构债务应按职责重复、写读闭环、容量和一致性风险量化。
- 迁移路线 P0 严重超载：一周内同时做生产事故修复、破坏性清理、模型切换与全量重嵌、中文 FTS 两表、shared.db 拆库、RRF、hit 埋点和 safe-mode 重构；这不是“止血”，也不可能保持单一因果归因。
- P0 的依赖存在不可满足环：配置 2.2 要求“日预算硬顶 + tier 路由”先就位，但 LLMClient v2/tier 路由被排在 P1；P1 又要等 P0.5，而 P0.5 依赖被 P0 污染的 chunks。应把 budget/tier 最小子集前置，或延后打开 extraction。
- 路线表把 e5 模型切换列在 P0，运行时基建表却列 P1；P0 又称“无 schema 变更”，但同阶段要求 repeat_count/唯一索引、hit_count/last_hit_at、trigram FTS、embedding model 隔离与 shared.db。路线、schema、运行时三个清单不是同一个版本。
- P1 文本称“新增 8 张表”，实际列出至少 10 张逻辑表，另有 3 张虚表和多项 ALTER；这不是措辞小错，而是 migration/rollback 估算明显不足。
- P0 gate “rehearsal_activations 不再净增长”“派生 chunk 不再净增长”不符合合法业务：有新场景/真实交互时应增长。应改为 bounded amplification、重复率、每场景/每用户写入上限和用户动作保留率。
- 双写期只写“读 units，空时回 chunks”无法检测新旧质量差异；需要同请求 dual-read shadow、stable request id、候选与排序 diff、来源覆盖差、no-result 差、延迟/成本差，并禁止 shadow 结果影响用户或强化计数。
- §3 对热门项目已有较广覆盖，但混合了源码事实、商业版能力、issue/PR、论文结果与作者判断，且星数/维护状态会快速变化；最终建议要重做 current snapshot，并把 GitHub popularity 仅作生态信号，不作架构正确性证据。

## External Research Findings

- [LangMem](https://github.com/langchain-ai/langmem) 当前官方仓库约 1.6k★，明确把 semantic / episodic / procedural memory 分开，并把 hot-path 与 background formation 作为独立选择；其概念文档还强调最佳记忆系统通常是 application-specific。对本 plan 的启示：`kind` 不应同时承担认知类型、业务类型、生命周期和权限，应拆成正交轴；后台抽取方向正确。
- [Supermemory](https://github.com/supermemoryai/supermemory) 是 plan 漏掉的热门一线项目，官方仓库同时提供 memory extraction、静态/动态 profile、hybrid search、contradiction/forgetting 和本地 self-host。它的“RAG chunks + personalized memory 同一查询”值得作为 plan “证据层和 unit 层分离”的直接对照，但其 benchmark 排名是项目方自报，需用公开 harness 独立复跑。
- [Cognee](https://github.com/topoteretes/cognee) 也是 plan 漏掉的热门项目。官方 MCP 当前收敛为 `remember/recall/forget`，并区分快 session cache 与 permanent graph；官方集成又采用 session cache 后台 promote 到图的两层写入。它比当前 plan 的“一个 ingest queue 直接事实化”更适合作为 provisional→durable promotion 参考。
- [LangGraph/LangMem 概念文档](https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/memory.md) 明确指出 hot-path memory 会增加延迟、干扰 agent 主任务、通常还降低保存召回；background memory 的代价是调度与新会话可见性的延迟。这支持 plan 的后台抽取，但要求给 critical explicit memory 一条同步、可见、确定性的快路径。
- [MemoryAgentBench](https://arxiv.org/abs/2507.05257) 专门把持续到来的信息变成 incremental multi-turn memory-agent 评测；比只做一次性 LongMemEval QA 更接近本系统的摄入→更新→召回生命周期，应加入阶段门。
- [MemEvoBench](https://arxiv.org/abs/2604.15774) 评测 adversarial memory injection、noisy tool output 和 biased feedback 导致的长期 memory misevolution。它直接暴露本 plan 目前缺少的“错误证据/偏置反馈复利”安全评测，尤其适合验证重复加固、画像 induction 与 learned ranker。
- [LongMemEval-V2](https://arxiv.org/abs/2605.12493) 把长期记忆扩展到 web agent 的静态状态、动态变化、工作流、环境坑点和 premise awareness；与 Personal AI 的 Jira/浏览器/操作记忆高度契合，建议补在现有“六能力”之外。
- [Mem0 Dream 官方 skill](https://github.com/mem0ai/mem0/blob/main/integrations/mem0-plugin/.opencode-plugin/opencode-skills/mem0-dream/SKILL.md) 对 merge/prune/conflict 先产生 diff，再等待确认；这不是要求所有内部巩固都人工审核，但说明冲突覆盖、长期 profile 改写、物理删除应有 reversible proposal/receipt，而不是仅靠 LLM 自动 supersede。
- [Letta 当前 memory/dreaming 文档](https://github.com/letta-ai/letta-docs-md/blob/main/configuration/memory/index.md) 已转向 git-backed MemFS，并在重组前备份；它强化的不是“文件优于 SQLite”，而是 consolidation 前的版本快照、可审计 diff 和可恢复性。
- [Supermemory 自托管故障 issue #1208](https://github.com/supermemoryai/supermemory/issues/1208) 报告 provider 初始化竞态会让 ingest worker 在整个进程生命周期里永久失败且错误不可见。对本 plan 的直接补强：warmup 之外还要有 per-subsystem readiness、queue retry/backoff、dead-letter 可见性和启动自愈测试。
- [Hindsight](https://github.com/vectorize-io/hindsight) 是 plan 完全漏掉的热门项目；2026-09-07 官方 GitHub 页显示约 22.8k★。它用 world facts / experiences / observations / mental models 四层、并行 semantic+BM25+graph+temporal 的 TEMPR/RRF、per-bank 隔离、原语言保留与 Memory Defense。值得补入对比，尤其是“agent 自身经验”与“关于世界的事实”必须分开，以及 retain 前 secret/PII 防线。
- [Hindsight 维护者对多 agent shared memory 的答复](https://github.com/vectorize-io/hindsight/discussions/1576) 倾向一个共享 bank，而非每 agent 各自 silo；这支持 Personal AI 做唯一中台，但仍需保存 `writer_agent/source_host` provenance，防止不同 agent 的推断被误当成同一权威来源。
- GitHub 当前快照确认：[Mem0](https://github.com/mem0ai/mem0) 64.8k★、[Graphiti](https://github.com/getzep/graphiti) 30.6k★、[Cognee](https://github.com/topoteretes/cognee) 30.5k★、[Supermemory](https://github.com/supermemoryai/supermemory) 29.2k★、[TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) 26.0k★、[Letta](https://github.com/letta-ai/letta) 24.6k★、Hindsight 22.8k★、[memU](https://github.com/NevaMind-AI/memU) 14.4k★。星数只作为生态/维护关注信号，不作为质量排序。
- TencentDB-Agent-Memory 的官方设计比 plan 的 P4 更完整：L0 Conversation→L1 Atom→L2 Scenario→L3 Core/Persona；先按 team/user/agent/visibility ACL 缩小范围，再检索；资产有 owner/version/status/usage 和 agent loadout。对本 plan 的直接改进是把 `scope + egress_class` 提升成 first-class ACL/binding，而非召回后的过滤。
- Letta 官方仓库明确说明旧 V1 API 在 archive branch、无维护且不应用于生产。因此 plan 可继续引用其 sleep-time/Memory block 研究思想，但不能把 Letta 旧实现当作可跟随的生产依赖或当前 benchmark 基线。
- [memU](https://github.com/NevaMind-AI/memU) 的当前实现是跨 Codex/Claude Code/Cursor/OpenClaw 等宿主的 agent-driven Wiki/Skill memory：后台从会话日志准备 job，宿主 agent 决定 no-op/patch/create，再 commit/index；MemoryService 自身不调 LLM。它适合“可复用工作流/技能”而不是私人事实真值，但其 `TranscriptSource + HostSpec + doctor verify gate` 很适合改进 plan 的 adapter-core。
- [A-MEM](https://arxiv.org/abs/2502.12110) 用 Zettelkasten 风格的结构化 note、动态链接和 memory evolution。可吸收的是“动态关联候选”和上下文描述，不应照搬“新记忆改写历史记忆表示”到证据层；必须保留 immutable source + revision/lineage，且关联先以低 authority edge 进入 shadow。
- 原始 [LongMemEval](https://arxiv.org/abs/2410.10813) 明确是五项能力：information extraction、multi-session reasoning、temporal reasoning、knowledge updates、abstention；plan 的“LongMemEval 六能力”应标成项目自定义扩展，避免误归因。其最相关结果是 session decomposition、fact-augmented key expansion、time-aware query expansion，而不是只看最终 QA 分数。
- LongMemEval-V2 的 AgentRunbook-C（coding agent 在文件/沙箱中收集证据）平均 72.5%，高于最强 RAG 48.5%，但延迟高。这说明“被动在线零 LLM”应保留，但 explicit deep/historical/audit 可以增加一个有预算的 agentic evidence-gathering 慢路径；绝对排除文件/agent 检索会放弃重要 Pareto 点。
- [AMemGym](https://arxiv.org/abs/2603.01966) 直指静态 off-policy benchmark 的局限，提供状态演化和 on-policy 互动评测。plan 的 7 天真实页面 A/B 之外，应增加 state evolution、纠错后行为、跨轮反馈复利的 on-policy 测试，尤其在启用 learned ranker 前。
- [MemoryBench](https://github.com/THUIR/MemoryBench) 把 memory 与 service-time continual learning/用户反馈结合；可用于验证 Personal AI 的反馈是否只改善排序，还是会错误改变事实/profile。它比单纯 click/thumb A/B 更接近 planned self-evolution。
- SQLite 官方 FTS5 文档明确要求 external-content 表由应用维护一致性：需要 insert/update/delete trigger，建 trigger 不会自动回填旧行，还应提供 `rebuild` 与 `integrity-check`。因此 §5 不能只列 FTS 虚表，必须把同步触发器、初次回填、完整性检查和失败恢复写成同一 migration contract。
- sqlite-vec 当前官方文档确实支持 `vec_quantize_int8(..., 'unit')`，因此函数名本身不是问题；但项目仍处于 alpha，ANN/IVF/DiskANN 等能力也在快速演进。plan 应 pin 精确版本、在启动时验证 `vec_version()`/所需函数，并对量化召回损失做本仓库数据集评测，不能把“支持 int8”直接等同于质量可接受。
- SQLite 官方说明 `VACUUM INTO` 生成的是一致快照，但若执行中异常，目标文件可能不完整；完成后是否落盘还受 `synchronous` 设置影响。它也不会替应用完成“替换正在被连接持有的数据库文件”。因此 §10 的替换流程必须有连接 quiesce、目标文件 integrity/FK/FTS 检查、fsync/rename、重开和回滚演练。
- [Unbiased Learning-to-Rank with Biased Feedback](https://arxiv.org/abs/1608.04468) 证明点击等隐式反馈受展示位置影响，直接训练会产生次优排序，并给出 propensity-weighted/counterfactual 路径。因此 plan 的“只采 rank≤3”不能视为去偏；应记录曝光概率并用小流量随机化/交错来估计 propensity。
- FSRS 官方算法把一次 review 表示为带明确 `again/hard/good/easy` 评分的主动复习事件，再据此更新 stability/difficulty。系统自己把某条 memory 放到 top-3、用户未明确否定，并不等价于“用户成功回忆”。所以 §7.2 可借用衰减曲线，但不能原样借用 review update 语义。
- 2026 年的新安全证据要求把“来源绑定的权限”提升为 schema 核心，而不是 prompt 规则：[MemSecBench](https://arxiv.org/abs/2607.27080) 覆盖 poisoning 从持久化到执行与选择性修复，[Hidden in Memory](https://arxiv.org/abs/2605.15338) 展示跨会话 dormant payload，[Non-Malleable Origin-Bound Authority](https://arxiv.org/abs/2606.24322) 指出未绑定来源的 authority 可被 laundering。对本 plan 的裁决：episode/unit 必须保存 origin、trust、purpose、writer 与不可由 LLM 提权的 authority；召回后内容只能作为数据，不能携带可执行指令。
- [GhostWriter](https://arxiv.org/abs/2607.06595) 说明攻击可以先写入长期记忆，再在未来工具任务中触发。由此需要独立的 `instructional_content`/`prompt_injection` 检测、隔离态、下游 consequential-action gate，以及 selective repair 演练；仅在摄入 prompt 中写“忽略注入”不够。
- Hindsight 当前 Memory Defense 支持 allow/redact/quarantine/block 和 prompt-injection/sensitive-data detector，但其 2026-08 的 CJK secret 边界 bug 证明“有扫描器”不等于多语言安全。Personal AI 需要中英文/混合文本对抗 fixture，并要求原文、unit、embedding、日志和备份都不残留被 block 的 secret。
- TencentDB-Agent-Memory 的 2026 issue 显示 README 的 visibility 模型与 L0-L3 实际 per-agent isolation 曾不一致。对本 plan 的反面启示：ACL 不能只写概念表；必须有逐层 executable matrix 和跨用户/跨 agent negative tests，证明每个物理读路径都应用同一 policy。
- Hindsight 的 correct/forget 讨论暴露了另一个常见缺口：删除全文太重、覆盖又丢审计、只靠 tag 需每个客户端自律。plan 应把 `correct / retract / accessibility-forget / privacy-delete` 设计成服务端统一语义，并让所有召回入口默认排除 retracted/tombstoned 数据。
- [EvoMemBench](https://arxiv.org/abs/2605.18421) 比单一 QA benchmark 更适合裁决 memory 类型：其结果指出 long-context 仍很有竞争力、知识任务偏 retrieval、执行任务更受益于匹配的 procedural memory，且没有一种记忆形态在所有设置稳定占优。因此 plan 不应定一个全局最优通道组合；应按 surface/task family 保留 no-memory、long-context、retrieval 与 procedural 的分解基线。
- LongMemEval-V2 的 451 个问题覆盖 static state、dynamic state、workflow、environment gotcha、premise awareness；AgentRunbook-C 准确率更高但延迟昂贵。裁决保持双通道：被动 surface 使用预算内 deterministic/hybrid 快路径，explicit deep/historical/audit 才允许 agentic evidence-gathering 慢路径。

## Gap Analysis

- 初步最高优先级：把“P0 生产止血”从“P1+ 架构迁移”拆为独立 incident RFC；先恢复供给、修复事故写入和建立 shadow metrics，再讨论新表/新 embedder。
- 初步文档改进：正文不能要求执行者自行判断哪一段已被后文推翻；需要单一 canonical spec + 逐项 ADR 状态（proposed/accepted/superseded）。
- 初步评测改进：任何影响排序的 `hit_count`、stability、density、authority 权重都需要离线 replay + shadow traffic + counterfactual logging；单纯 A/B 最终点击会被现有排序曝光偏差污染。
- 检索验收必须把 `precision@k` 拆成 surface-specific 风险：passive 重点是错误打扰率和 no-result 质量，Ask 重点是 answer evidence recall/faithfulness，Compose 重点是最终采用且未误导；不能共用一个 aggregate score。
- 迁移必须采用 shadow tables + dual-read comparison + reversible cutover，不应在同阶段删除旧向量/表。只有在完整性、质量、延迟、成本、恢复演练全部通过并稳定观察后才停止旧写，最后再异步清理。
- P0 前应新增“证据账本”：每个生产事实记录查询、时间、样本范围、可复现脚本和置信级别；否则长文里 observed 与 inferred 混排，多执行者很难知道哪些结论需要先复验。
- 推荐重排为：P0a 只修断供与事故写放大；P0b 加观测/预算/备份恢复门；P0c 只做旧栈回填与 hybrid baseline；P0.5 用 gold/shadow atomic unit probe；P1 再做 schema/dual-write；P2 再切 read；P3 才清旧表/拆库。
- 建议把 2200 行单体 plan 拆为四个受控文档：canonical RFC（只保留当前决策）、ADR ledger（保存被取代结论）、incident runbook（P0a/P0b）和 migration/eval runbook（逐阶段门与回滚）。这样“保留研究过程”和“让执行者只看到一个答案”可以同时成立。

## Canonical Decision Freeze

| ID | Canonical decision | Rejected alternative |
|---|---|---|
| D01 | 正文只保留当前有效决策；历史推理由 Git 与 research appendix 追溯 | 在正文保留 superseded 段落并要求执行者自行判断 |
| D02 | 事故恢复与基础架构迁移分开：P0a/P0b/P0c 完成后才进入 v3 schema | 一周内同时止血、清库、换模型、拆库、改排序 |
| D03 | 授权与 rollout 分开：7 项数据修复沿用既有预授权，但生产开关采用 1→5→25 渐进 rollout | “已授权”直接解释为 25 用户同一时刻切换 |
| D04 | 保持每用户 SQLite 为 memory 真源；P0-P3 不拆 shared.db，ops/shared 分离仅在容量与 ACL 证据满足时另立 ADR | 以表数量或单用户噪声体积直接证明三库分离必要 |
| D05 | Episode 原文不可被 consolidation 改写；unit/edge/profile 都必须通过 normalized lineage 回指 episode span | `sources_json`/`entity_ids_json` 作为唯一溯源 |
| D06 | memory 属性使用正交轴：form、kind、status、evidence_class、confirmation、scope、sensitivity、egress | `kind` 同时表达事实类型、生命周期、敏感度与常驻层级 |
| D07 | 抽取可返回 0..N；失败保留 episode + `needs_extraction`，不伪造 active fact | 用原文首句兜底成事实，或用最低产量暗示逼模型生成 |
| D08 | 显式“记住”走同步确认快路径；普通流量后台抽取；允许延迟超过一天才用 Batch，当夜必用结果走同步异步 job | 所有抽取都 hot-path，或所有夜间任务都 Batch |
| D09 | trigger question/summary/keywords 是 unit 的索引视图；同一物理通道内先按 unit 去重，不能作为独立候选获得重复 RRF 奖励 | `V_body` 与 `V_trig` 对同 unit 跨通道重复加分 |
| D10 | 检索通道按 vector/lexical/graph/temporal/exact-rule 融合；权重和阈值按 model+surface 标定 | 把未标定常数写成永久架构参数 |
| D11 | ACL、scope、sensitivity、egress、injection gate 是检索前 fail-closed；相关性通道故障可 fail-open 到安全降级 | 所有读路径一律 fail-open |
| D12 | abstention/no-result 是一等结果；passive 永不强制至少返回一条 | passive `min_results=1` |
| D13 | exposure 只记观测，不增加 stability/confidence；加固仅来自独立证据、用户确认或明确 outcome | top-3/展示/引用自动当作 FSRS 成功复习 |
| D14 | learned ranker 必须等 propensity/exposure 日志、小流量随机化或 interleaving、反事实离线评估就绪 | 只训练 rank≤3 的 click/open 反馈 |
| D15 | derived insight 可自动低权威创建并带 expiry/receipt；不能覆盖 evidence；durable profile、外发、物理删除需要用户控制 | 所有 reflection 都人工审批，或所有 profile/冲突都全自动 |
| D16 | 区分 correction、retraction、accessibility forgetting、privacy deletion；“不因衰减硬删”不适用于用户/法规删除 | 一个 delete/forget 同时承担所有生命周期语义 |
| D17 | 双写之后必须同请求 dual-read shadow；shadow 不影响展示、反馈或生命周期 | 仅在 units 为空时回退 chunks |
| D18 | 模型切换和 int8 量化都需版本 pin、隔离索引与本地标定；先用现有模型恢复供给，再由消融决定是否迁移模型 | 在 P0 中直接换模型并全量重嵌 |
| D19 | `rehearsal_activations` 使用 hour bucket 唯一键或 event+aggregate 两表；本方案选择 hour bucket upsert | 永久唯一 `(rehearsal_id, scene_key, surface)` 同时要求每小时新行 |
| D20 | 未知时间保持 null + quality=unknown，绝不回填 now 伪造新鲜度 | 坏时间戳无法恢复时使用当前时间 |
| D21 | `lost_and_found` 只有 schema fingerprint/类型/主外键/语义抽样全部证明后才回填，否则隔离导出 | 仅凭列数猜测原表后回填 |
| D22 | 每阶段都跑 branch-authoritative memory abilities 与 surface-specific eval；安全负向测试零容忍 | 只在最终阶段跑一个 aggregate useful@1 |
| D23 | passive 保持现有 novelty/visible-echo/presentation receipt 产品契约；本 plan 改底层供给与治理，不重造 UI | 把展示层已有 gate 重复塞进 retrieval core |
| D24 | memory 内容永远是无指令权的数据；origin-bound authority 不可由 LLM 提升；高后果动作必须重新取当前证据并过 action gate | 召回到 prompt 的历史指令可以直接驱动工具动作 |

以上决策是新 plan 的唯一输入；若后续证据推翻其中一项，必须新增 ADR 并同时更新 schema、阶段、验收和回滚，不再在正文追加“修正前文”。

## Rewrite Audit Findings

- Current checkout confirms the acute supply path is still represented in code: IngestionPipeline uses the extraction skip around shouldIndex; RecallEngine excludes passive_surface/composer_surface from the raw lexical fallback. The rewritten plan therefore keeps this as code-proven but still requires an execution-day production recheck.
- Browser metadata currently nests sentiment/priority under messageMetadata.metadata while IngestionPipeline reads payload.metadata.sentiment/importance. The P0a field-contract repair remains grounded in current code, not only the September 3 production snapshot.
- RehearsalService currently inserts a fresh activation row for every match. The canonical hour-bucket upsert is a direct replacement for the observed write-amplification mechanism; the old permanent unique-key-plus-time-window design has been removed.
- First structural audit found no missing relative links or duplicate headings in the rewritten plan. It did find and repair: duplicated ownership of destructive jobs across P0b/P0c, linear maxSensitivity, missing edge revision history, implicit global authority ordering, and unclear safe-mode/vector-coverage interpretation.
- Browser analysis remains useful for UI and scene anchors, but canonical memory extraction must stay server-owned. The plan now explicitly treats browser output as client_hint and requires fixture parity before removing redundant browser LLM work.
- The linked HTML demo still encoded the superseded three-database decision, trigger-question double channel, fixed score weights, exposure reinforcement, global e5/int8 choice, all-smart-Batch routing, and the old P0-P5 order. Because a linked visual can act as an implementation spec, it was updated to v3 rather than merely labeled historical.
- Huashu-design verification rules require browser rendering, console-error capture and multi-viewport inspection for edited HTML. The demo is a static information visualization with no product-brand assets or interaction state, so the relevant path is Playwright render/console/multi-viewport QA rather than a new visual-direction exercise.
- Red-team audit found a security-order contradiction: persisting raw episode before screening conflicted with the guarantee that blocked secrets never reach storage or backups. Canonical flow now screens the in-memory envelope first: allow persists raw, redact persists sanitized text, quarantine uses encrypted local-only storage, and block stores only a body-free receipt.
- Added schema/execution gaps discovered in the second audit: edge revisions, quarantine store, scene template and retrieval calibration tables, policy labels on projections, same-transaction unit/source/revision/outbox, raw-vs-segmented FTS views, 30-day exposure TTL, server-owned ingest schema v2, and detailed P3/P4/P5 runbooks.
- Third red-team pass found that `memory_unit_sources` still lacked a cross-runtime span convention and derived units lacked a normalized unit-to-unit lineage table. The plan now uses UTF-8 half-open byte offsets plus a span hash and adds `memory_unit_derivations`.
- A quarantined ciphertext is not safe merely because it is local. The canonical contract now requires a per-user envelope key outside the database/backups and forbids plaintext fallback when the key service is unavailable.
- Explicit “remember this” cannot depend on a synchronous LLM while also promising durable immediate capture. It now creates an exact-span, user-confirmed `note` unit deterministically; semantic decomposition remains a 0..N background job.
- Facts and utility were still partially conflated: downstream task success may improve accessibility/utility but cannot increase factual confidence. Only independent evidence or explicit user confirmation can do that.
- P0.5 now has a bounded model bakeoff: legacy MiniLM control, multilingual-e5-small with required query/passage prefixes, and BGE-M3 dense-only only after a host doctor passes. BGE-M3 sparse/ColBERT would confound channel and model effects and is excluded from this phase.
- Related execution documents were a remaining source of contradiction. The benchmark and deletion runbooks now defer to canonical statistical/deletion semantics; old MCP and Context Passport schema/API sketches are explicitly non-executable historical inputs.
- Current sqlite-vec releases remain pre-v1 and the official versioning page excludes bindings from full SemVer guarantees; the plan now forbids adopting alpha ANN as an unmeasured shortcut and requires DELETE/rename/restore regression for any upgrade.
- Merely decoupling indexing from extraction still left low-salience episodes eligible for silent lexical exclusion. P0a-P0c now index every policy-eligible non-empty episode into legacy chunk+FTS; salience affects priority/rank, while noise is handled by gates and abstention.

## Resources

- https://github.com/langchain-ai/langmem
- https://github.com/supermemoryai/supermemory
- https://github.com/topoteretes/cognee
- https://arxiv.org/abs/2507.05257
- https://arxiv.org/abs/2604.15774
- https://arxiv.org/abs/2605.12493
- https://github.com/TencentCloud/TencentDB-Agent-Memory
- https://github.com/vectorize-io/hindsight
- https://github.com/NevaMind-AI/memU
- https://arxiv.org/abs/2502.12110
- https://arxiv.org/abs/2410.10813
- https://arxiv.org/abs/2603.01966
- https://www.sqlite.org/fts5.html
- https://www2.sqlite.org/lang_vacuum.html
- https://alexgarcia.xyz/sqlite-vec/guides/scalar-quant.html
- https://arxiv.org/abs/1608.04468
- https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm

## Issues Encountered

| Issue | Resolution |
|---|---|
| 初始命令输出截断 | 将 2200 行 plan 分段读取，并用标题/术语索引辅助定位 |
| GitHub 未认证 repo API 多次返回 403 | 不重试同一路径；改用官方仓库页面与 GitHub search/current org page 获取公开快照 |
