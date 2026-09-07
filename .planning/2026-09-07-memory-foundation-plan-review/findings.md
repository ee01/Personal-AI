# Findings: Memory Foundation Rearchitecture Review

## Requirements

- 审查现有 plan 有哪些值得改进。
- 调研该修改方向中业内热门开源项目、相关论文和专业人士讨论。
- 将研究结论转化为对原 plan 的具体改进建议。
- 保持只读审查范围，不修改运行时代码或原 plan。

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

## External Research Findings

- 待补充。

## Gap Analysis

- 初步最高优先级：把“P0 生产止血”从“P1+ 架构迁移”拆为独立 incident RFC；先恢复供给、修复事故写入和建立 shadow metrics，再讨论新表/新 embedder。
- 初步文档改进：正文不能要求执行者自行判断哪一段已被后文推翻；需要单一 canonical spec + 逐项 ADR 状态（proposed/accepted/superseded）。
- 初步评测改进：任何影响排序的 `hit_count`、stability、density、authority 权重都需要离线 replay + shadow traffic + counterfactual logging；单纯 A/B 最终点击会被现有排序曝光偏差污染。
- 检索验收必须把 `precision@k` 拆成 surface-specific 风险：passive 重点是错误打扰率和 no-result 质量，Ask 重点是 answer evidence recall/faithfulness，Compose 重点是最终采用且未误导；不能共用一个 aggregate score。
- 迁移必须采用 shadow tables + dual-read comparison + reversible cutover，不应在同阶段删除旧向量/表。只有在完整性、质量、延迟、成本、恢复演练全部通过并稳定观察后才停止旧写，最后再异步清理。
- P0 前应新增“证据账本”：每个生产事实记录查询、时间、样本范围、可复现脚本和置信级别；否则长文里 observed 与 inferred 混排，多执行者很难知道哪些结论需要先复验。

## Resources

- 待补充。

## Issues Encountered

| Issue | Resolution |
|---|---|
| 初始命令输出截断 | 将 2200 行 plan 分段读取，并用标题/术语索引辅助定位 |
