# 记忆基础架构重构方案 v3 / Memory Foundation Re-architecture

> 状态：Canonical implementation plan
>
> 更新日期：2026-09-07
>
> 范围：memory-service 的摄入、真值、检索、巩固、画像、权限、存储与适配器边界
>
> 配套示意：[memory-foundation-rearchitecture-demo.html](./memory-foundation-rearchitecture-demo.html)
>
> 相关执行文档：[memory-index-backfill-plan.md](./memory-index-backfill-plan.md)、[memory-longmemeval-benchmark-plan.md](./memory-longmemeval-benchmark-plan.md)、[memory-cascade-deletion-plan.md](./memory-cascade-deletion-plan.md)
>
> 历史产品输入（非实现真源）：[memory-mcp-server-plan.md](./memory-mcp-server-plan.md)、[ai-context-passport-plan.md](./ai-context-passport-plan.md)。其旧 schema/API/权限默认值已由本文 §10 与 §11.9 取代。

---

## 0. 文档规则：只允许一个有效答案

本文完整取代此前的增量式正文。旧讨论、被否决方案和历史数据仍可从 Git 历史追溯，但不再与执行说明混排。

执行者必须遵守以下规则：

1. 本文是本重构的唯一架构与阶段真源。配套文档只能展开某个步骤；发生冲突时以本文为准，并先修正文档再实施。
2. 新证据若推翻本文决策，必须新增 ADR，同时修改受影响的 schema、阶段、验收、回滚和相邻文档；禁止在文末追加“后文推翻前文”。
3. 文中的数字分三类：
   - 硬门：安全、隔离、幂等、数据完整性等不可妥协条件。
   - 初始配置：首轮实验值，必须通过标定后才能进入生产。
   - 观测基线：某个日期的快照，执行前必须重测，不能当作当前事实。
4. 本计划授权修改文档，不代表已经执行生产开关、部署、数据删除、迁移或外发。
5. 7 项既有数据修复作业保留仓库所有者的预授权；预授权不等于允许跳过备份、逐步 rollout、验收或回滚。

### 0.1 一页结论

当前最紧急问题不是缺少更强的向量模型，而是近期数据曾经停止进入被动 Lens 和 Compose Assist 能访问的索引。重构必须按以下顺序进行：

~~~text
R0   冻结事实与基线
P0a  恢复索引供给并停止事故写放大
P0b  建立预算、readiness、DLQ、备份与恢复能力
P0c  在旧 schema 上完成 FTS 回填和可比较的 hybrid baseline
P0.5 用原始 episode 构造 gold/shadow atomic-unit probe
P1   建 v3 schema，后台抽取并 dual-write
P2   dual-read shadow，标定后逐 surface 切换
P3   启用巩固、画像和长期反馈闭环
P4   启用 ACL/egress-aware adapter
P5   稳定观察后停旧写，最后清理旧表；存储拆分另立 ADR
~~~

任何阶段失败都退回上一阶段，不允许跨阶段“顺便”实施后续能力。

### 0.2 不可破坏的产品契约

- Personal AI 是用户的私有、自治、可反思的长期记忆系统，不是一个要求用户审核每次内部判断的队列。
- 外发、破坏性删除、隐私或 scope 跨越、长期 profile 定论等高责任动作必须有用户控制。
- Passive Memory Lens 保持现有的展示前过滤、novelty、visible-page echo 抑制和只读回执；本计划不重复实现 UI gate。
- No-result / abstention 是合法输出。被动面宁可安静，也不能强塞一条低证据记忆。
- Episode 的合规持久化正文是证据（allow 为原文，redact 为脱敏正文），不被反思、合并或 profile 归纳改写；block 不创建 episode。
- 召回出的历史内容始终是“数据”，不因此获得系统指令权或工具执行权。

---

## 1. 目标、非目标与成功定义

### 1.1 目标

1. 新 episode 永不因 LLM、embedding 或单个索引通道故障而静默丢失。
2. 把原始证据、原子记忆、关系、画像、索引视图和生命周期分开，但保留完整 lineage。
3. 对事实更新、冲突、时间有效性、纠错和删除提供唯一服务端语义。
4. 让 Ask、Compose 和 Passive Lens 按不同信息需求检索，并能安全 abstain。
5. 让派生记忆成为有来源、低权威、可过期、可撤回的产品，而不是散文文件堆积。
6. 支持多用户、多 agent、多宿主，但默认最小权限且可审计外发。
7. 用 branch-authoritative eval、shadow traffic 和恢复演练证明改进，而不是只证明代码可编译。

### 1.2 非目标

- 不在 P0-P3 更换 SQLite，也不因为表数量多就拆成多个数据库。
- 不在本计划中重做 Lens、Compose、Ask 的 UI。
- 不自动发送消息、创建 Jira、修改外部系统或把 memory 内容直接转成工具动作。
- 不把所有原文压成 profile，也不把所有来源都视为同等权威。
- 不把 GitHub star、自报 benchmark 或论文单点结果当作本项目的生产阈值。
- 不在 learned ranker 之前用未经去偏的点击反馈自我训练。

### 1.3 Definition of Done

本重构只有同时满足以下条件才算完成：

- P0a-P4 各自的硬门、回滚演练和评测全部通过。
- 新旧双读至少稳定观察 30 天，且没有未解释的跨用户、时序、删除、供给或延迟回归。
- 所有读取路径都通过 ACL、scope、sensitivity、egress 和 retracted 状态的负向测试。
- 新 schema 的每个 active unit、entity alias、edge 和 profile slot 都能回溯到 episode span 或明确的用户手工来源。
- 抽取失败、零事实、索引失败、预算拒绝和队列死信均有可见状态，不存在 silent success。
- Passive、Ask、Compose 分别达到自己的非劣门；安全与隐私指标零容忍。
- 旧写路径停止后仍能完成一次完整回滚；此后才允许 P5 物理清理。

---

## 2. 当前事实与证据等级

### 2.1 证据标签

| 标签 | 含义 | 可否直接驱动生产变更 |
|---|---|---|
| code-proven | 当前 checkout 的代码路径直接证明 | 可以，但仍需测试 |
| production-observed | 带日期、样本和查询的线上只读观测 | 可以作为基线，执行前重测 |
| inferred | 多项证据支持的因果推断 | 不可以；先做验证实验 |
| hypothesis | 研究类比或待测设计 | 不可以；只能进入 shadow/实验 |

### 2.2 2026-09-03 快照

下表是旧方案中最有价值的生产证据。它们是观测基线，不保证在执行日仍成立。

| 事实 | 等级 | 执行含义 |
|---|---|---|
| INGEST_LLM_EXTRACTION_ENABLED=false 与索引 shouldIndex 共用 skip，导致 chunk/FTS 供给停止 | code-proven + production-observed | P0a 首先解耦确定性索引与 LLM 抽取 |
| Passive/Compose 不走 raw LIKE fallback，因此近期 episode 对这两个 surface 实际不可见 | code-proven | P0a 必须用 surface fixture 验证 |
| messages_raw 约 15.1k，约 11.5k 未进入完整索引 | production-observed | 原文尚在，可离线回填 |
| 主用户活库约 1.3 GB，其中 rehearsal_activations 约 195 万行/850 MB | production-observed | 先阻止新放大，再清历史 |
| chunks_vec 约 235 MB 但只有约 3.8k 行 | production-observed | 有明显碎片或结构浪费，不能仅看文件大小推断容量 |
| 约 922 行时间戳为 epoch-0/异常值 | production-observed | 未知事件时间必须保持 unknown，不能改成 now |
| 一次 context-recall 观测到 23.8 秒离群值 | production-observed | 加阶段耗时、timeout 和 p99 指标 |
| 25 个用户中主用户占大部分数据量 | production-observed | rollout 仍按 1→5→25，避免把授权等同于同时切换 |

### 2.3 R0 执行前证据账本

实施者必须先生成带时间戳的 evidence manifest，至少包括：

- 当前 commit、容器版本、schema version、sqlite-vec 版本、embedding model。
- 25 个用户逐库的消息数、索引覆盖、FTS/vec 行数、异常时间、dead jobs 和 rehearsal 放大率。
- journal mode、数据库与备份大小、freelist、quick_check、FK check。
- 过去 7 天 units/chunks/entities/profile 的供给趋势。
- Passive/Ask/Compose 的 p50/p95/p99、timeout、no-result 和候选通道诊断。
- 所有结论标注 code-proven、production-observed、inferred 或 hypothesis。

证据账本只读；任何数据修改必须等 R0 review 完成。

---

## 3. 外部证据与采用边界

GitHub 热度仅表示生态关注。以下快照截至 2026-09-07：Mem0 64.8k、Graphiti 30.6k、Cognee 30.5k、Supermemory 29.2k、TencentDB-Agent-Memory 26.0k、Letta 24.6k、Hindsight 22.8k、memU 14.4k。

### 3.1 开源项目

| 项目 | 采用 | 不照搬 |
|---|---|---|
| [Mem0](https://github.com/mem0ai/mem0) | 原子事实、冲突动作、consolidation diff | 自报 benchmark；对高责任修改仍需本地证据与用户控制 |
| [Graphiti](https://github.com/getzep/graphiti) | episode lineage、双时态、边即事实 | 不把所有问题都图化；图是候选通道，不是真值替代品 |
| [Cognee](https://github.com/topoteretes/cognee) | session/provisional 到 durable graph 的晋升 | 不让 session cache 绕过统一 TruthMaintainer |
| [Supermemory](https://github.com/supermemoryai/supermemory) | 文档证据与个性化 memory 并存、矛盾与遗忘 | provider 初始化竞态说明必须有 readiness、retry 和 DLQ |
| [TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | L0-L3 分层、owner/version/status、agent loadout、ACL-first | 文档中的 visibility 不等于每个物理读路径已经实现；必须做负向测试 |
| [Hindsight](https://github.com/vectorize-io/hindsight) | bank 隔离、semantic+BM25+graph+temporal、Memory Defense | correct/forget 与多语言 secret detector 仍有现实边界，不能只信 feature 名称 |
| [Letta](https://github.com/letta-ai/letta) | context budget、后台重组前快照和 diff | 旧 V1 API 已归档，不作为生产依赖 |
| [memU](https://github.com/NevaMind-AI/memU) | TranscriptSource、HostSpec、doctor gate、procedural skill memory | 不把“每次回答前都 recall”变成无条件隐私外发 |
| [LangMem](https://github.com/langchain-ai/langmem) | semantic/episodic/procedural 正交分类、hot/background 分离 | 不认为通用默认值能替代应用级标定 |
| [A-MEM](https://github.com/agiresearch/A-mem) | 动态 association 候选与 Zettelkasten 式链接 | association 只能低权威进入 shadow，不能改写 episode |

### 3.2 论文与 benchmark

| 证据 | 本计划采用 |
|---|---|
| [LongMemEval](https://arxiv.org/abs/2410.10813) | 五能力：抽取、多会话、时序、更新、拒答；“前瞻”明确标为本项目自定义第六项 |
| [LongMemEval-V2](https://arxiv.org/abs/2605.12493) | static/dynamic/workflow/gotcha/premise 五类 web-agent 经验；explicit deep 可有 agentic 慢路径 |
| [MemoryAgentBench](https://arxiv.org/abs/2507.05257) | 增量摄入、长期理解、冲突处理 |
| [AMemGym](https://arxiv.org/abs/2603.01966) | on-policy 用户状态演化与纠错后行为 |
| [MemEvoBench](https://arxiv.org/abs/2604.15774) | 对抗注入、噪声工具、偏置反馈造成的长期 misevolution |
| [EvoMemBench](https://arxiv.org/abs/2605.18421) | no-memory、long-context、retrieval、procedural 分解；不假设一种 memory 形态全局最优 |
| [Unbiased Learning-to-Rank](https://arxiv.org/abs/1608.04468) | propensity/exposure、随机化或 interleaving 后才能学习隐式反馈 |
| [MemSecBench](https://arxiv.org/abs/2607.27080) | poisoning 的 persist→retrieve→execute→repair 全链评测 |
| [Hidden in Memory](https://arxiv.org/abs/2605.15338) | dormant memory payload 的跨会话触发 |
| [Origin-Bound Authority](https://arxiv.org/abs/2606.24322) | authority 与 origin 绑定，禁止通过总结或转述 laundering 提权 |

### 3.3 高信号工程讨论

- [Supermemory provider 初始化竞态](https://github.com/supermemoryai/supermemory/issues/1208)：worker 启动时失败后可能持续不可用，支持 readiness、retry、DLQ 和启动自愈门。
- [TencentDB-Agent-Memory visibility gap](https://github.com/TencentCloud/TencentDB-Agent-Memory/issues/890)：README 的 private/team/restricted 语义曾与 L0-L3 实际隔离不一致，支持“每个物理通道都做负向测试”。
- [Hindsight 多 agent shared bank 讨论](https://github.com/vectorize-io/hindsight/discussions/1576)：共享 bank 有利于跨工具连续性，但不能省略 writer/source provenance。
- [Hindsight correct/forget 讨论](https://github.com/vectorize-io/hindsight/issues/2696)：覆盖会丢历史、物理删除过重、客户端 tag 容易漏过滤，支持服务端统一 correction/retraction/forget/delete。
- [Hindsight CJK secret 边界问题](https://github.com/vectorize-io/hindsight/issues/3566)：ASCII secret 紧邻中文时可能逃过基于词边界的检测，支持中英混合对抗 fixture。

### 3.4 正反裁决

- 支持 memory 中台：一个服务能统一 truth、scope、审计和 adapter 行为。
- 反对 agent silo：同一用户事实不应因宿主不同复制成多个互相漂移的真值。
- 同时反对无边界共享：共享 bank 仍必须保留 tenant、user、writer_agent、source_host 和 destination policy。
- 支持后台抽取：降低 hot-path 延迟和任务干扰。
- 同时保留显式快路径：用户明确“记住”时必须同步落 episode、给 receipt，并尽快产生可用 unit。
- 支持 derived memory：它能回答主题和经验问题。
- 反对 derived 覆盖 evidence：派生物必须低权威、有来源、可过期、可撤回。

---

## 4. Canonical 架构

### 4.1 三个平面、六个逻辑层

~~~text
Evidence Plane
  L0 Episode        原始消息、网页、会议、日历、笔记、导入记录
  L1 Memory Unit    原子事实、事件、偏好、决定、流程、风险、洞见

Intelligence Plane
  L2 Graph          entity/unit 之间有来源的关系与 association
  L3 User Model     profile slots、contradictions、confirmed preferences
  L4 Projections    FTS、vector、keywords、summary、trigger-question views
  L5 Lifecycle/Ops  状态、衰减、exposure、outcome、jobs、DLQ、audit

Delivery Plane
  RetrievalPlan → ACL/egress gate → hybrid retrieval → evidence gate
  → existing Lens/Ask/Compose presentation contract → adapters
~~~

三平面是职责划分，不意味着三个物理数据库。P0-P3 继续使用每用户 SQLite。

### 4.2 强不变量

| ID | 不变量 |
|---|---|
| I1 | 每个 episode 以稳定 source id 或 content hash 幂等落地 |
| I2 | 每个 active unit 必须有至少一个 normalized source row；手工输入也产生 synthetic manual episode |
| I3 | LLM 不能修改 source-level evidence_class、scope、sensitivity 或 ACL 为更高权限 |
| I4 | projection 可重建，不能成为真源 |
| I5 | 同一 evidence_key 重放不增加 confidence/stability |
| I6 | retracted/quarantined/privacy-deleted 数据不会从任何 recall path 返回 |
| I7 | unknown observed_at 保持 null；ingested_at 与 observed_at 分开 |
| I8 | 同一物理检索通道内先按 unit 去重，再参与跨通道 RRF |
| I9 | exposure 不等于用户验证，不改变事实 confidence |
| I10 | 安全 gate 故障 fail-closed；相关性通道故障可安全降级 |
| I11 | shadow 结果不展示、不强化、不改 profile |
| I12 | 破坏性作业都有已验证备份、manifest、dry-run 与 rollback rehearsal |

### 4.3 正交分类

一个 memory unit 不再用单一 kind 承担所有语义：

| 轴 | 枚举 |
|---|---|
| memory_form | semantic / episodic / procedural |
| kind | note / fact / preference / decision / action_item / event / risk / open_question / opinion / procedure / insight / brief |
| status | provisional / active / disputed / superseded / retracted / archived / quarantined / deletion_pending |
| evidence_class（source row 轴） | self_statement / first_party_record / official_source / third_party_report / system_inference |
| confirmation_state | unconfirmed / user_confirmed / user_rejected |
| sensitivity | public / internal / private / restricted |
| scope | personal / work / mixed，并带 tenant/user/project/conversation locator |
| egress_policy | local_only / approved_destinations / user_selected |

core 是生命周期层级，不是 kind；vault 是 sensitivity/egress 策略，不是 kind。

---

## 5. 数据模型 v3

### 5.1 物理真源

现有 messages_raw 继续承担 Episode 物理表，避免一次大 rename。通过 EpisodeRepository 屏蔽物理名称，并新增：

- episode_kind、language；
- observed_at、observed_at_quality、observed_at_precision、observed_timezone_assumption、ingested_at；
- tenant_id、owner_user_id、scope_locator；
- sensitivity、egress_policy；
- writer_agent、source_host、origin_type；
- trust_class、injection_flags_json；
- extraction_status、extraction_attempts、last_extraction_error；
- idempotency_key、content_hash。

枚举和默认值必须由版本化 schema/migration 生成，禁止浏览器、服务端和 adapter 各维护一份。

### 5.2 逻辑表与投影清单

不再声称“新增 8 张表”。v3 明确包含以下新建或扩展的逻辑表和投影：

| 表 | 职责 |
|---|---|
| ingest_jobs | 后台抽取状态、claim、retry、DLQ |
| ingest_extraction_results | strict parse 后冻结的 candidate batch、result hash 与 contract version |
| ingest_quarantine | 加密、本地限定、永不投影的隔离记录 |
| memory_units | 原子记忆当前版本 |
| memory_unit_sources | unit→episode span、evidence key、provenance family |
| memory_unit_derivations | derived unit→parent unit 的正规化推理 lineage |
| memory_unit_revisions | 完整 append-only 版本快照 |
| memory_unit_views | body/summary/keywords/trigger_question 投影视图 |
| memory_unit_entities | unit→entity 正规化关系 |
| entities | canonical entity registry；身份节点，不直接承载事实 |
| entity_aliases | alias/locale→entity 与来源 |
| entity_revisions | merge/split/rename 的可逆审计 |
| memory_edges | entity/unit 关系当前版本 |
| memory_edge_sources | edge→unit/episode 来源 |
| memory_edge_revisions | edge 的 append-only 完整版本 |
| unit_lifecycle | 可及性、衰减、层级与显式强化 |
| memory_exposures | 展示位置、surface、propensity、request id |
| memory_outcomes | adopted/corrected/rejected/task_success 等结果 |
| profile_slots | 用户模型当前版本 |
| profile_slot_sources | profile→unit 来源 |
| profile_slot_revisions | profile 完整版本 |
| trigger_rules | 确定性 procedure/rehearsal 触发 |
| truth_policies | predicate 对应的来源适用性、冲突与确认策略 |
| truth_integrations | work_unit_key→裁决目标/revision 的幂等 integration receipt |
| memory_policy_bindings | principal/scope/destination/provider/purpose 的 ACL 与 egress 绑定 |
| scene_need_templates | 版本化 surface/scene needSlots 模板 |
| retrieval_calibrations | model/quantization/surface 对应的权重、阈值与 eval report |
| projection_outbox | FTS/vector/graph 投影的可重试任务 |
| privacy_delete_jobs | live/projection/archive/backup 删除状态与补偿，不含被删正文 |
| unit_views_fts_seg | 分词后的 lexical 投影 |
| unit_views_fts_tri | 中文/混合文本 trigram 兜底 |
| unit_views_vec | 版本化 embedding 投影 |

### 5.3 关键字段

memory_units 至少包含：

~~~text
id, tenant_id, owner_user_id
memory_form, kind, status
subject_key, predicate_key, text, normalized_text, language
observed_at, observed_at_quality, observed_at_precision, observed_timezone_assumption
valid_from, valid_to
tx_start, tx_end
confirmation_state, confidence
scope_locator, sensitivity, egress_policy
source_independence_count_cached, evidence_class_set_cached
superseded_by, current_revision
created_at, updated_at
~~~

所有 `*_at`/`valid_*`/`tx_*` 整数统一为 UTC epoch seconds，API 边界接受带 offset 的 ISO-8601 并由服务端转换；未知为 null，不使用 0。若源只提供日期或月份，另存 precision/timezone assumption，排序与问答不能伪装成秒级精度。

`source_independence_count_cached` 与 `evidence_class_set_cached` 只能由正规化 source rows 的服务端事务逻辑重算；调用方不能直接写。每日 invariant audit 比较缓存值与 source rows，发现漂移就阻止 confidence 更新并重算。

memory_unit_sources 至少包含：

~~~text
unit_id, episode_id
span_start_byte, span_end_byte, span_text_hash
source_role
evidence_key
provenance_family
origin_type, evidence_class
PRIMARY KEY(unit_id, episode_id, span_start_byte, span_end_byte, source_role)
~~~

span 使用该 episode **实际持久化正文**（allow 为原文，redact 为脱敏正文）的 UTF-8 byte half-open 区间 `[start, end)`；`span_text_hash` 用于迁移、显示和重放时验证偏移没有漂移。Derived unit 另外通过 `memory_unit_derivations(child_unit_id, parent_unit_id, source_role)` 指向 parent units，不能把 parent ids 塞入 JSON。

`evidence_key` 标识一条可独立核验的 source event；`provenance_family` 标识它的传播根。摘要、转发、reflection、跨 agent 转述和同一页面的不同 view 必须继承原 family；只有不同原始事件或明确用户确认才形成新 family。两者的生成算法与版本写入 migration/config，不能由 LLM 自由输出。

`evidence_class` 是每条来源的属性，不是整个 unit 的单值。TruthMaintainer 不能合并 policy-incompatible 的 scope/sensitivity/egress 来源；同一文本若横跨边界，保留为不同 unit。返回 unit 时至少要有一条通过 `allowedEvidenceClasses[]` 和当前 policy 的 source，并且只暴露本次允许的 lineage；缓存集合只用于 prefilter，不能代替 source-row gate。

memory_unit_revisions 保存完整 canonical snapshot，而不是只保存 old_text：

~~~text
unit_id, revision, operation
before_snapshot_json, after_snapshot_json
reason, actor_type, actor_id
request_id, created_at
PRIMARY KEY(unit_id, revision)
~~~

revision JSON 只承担审计快照；当前 lineage、ACL 与关联仍必须存在于正规化表。

“append-only revision”只约束普通 correction/merge/supersede，不能凌驾于 privacy deletion；隐私删除必须清除或通过外部 DEK 使相关 revision 不可恢复，只留下 body-free receipt。

所有连接必须启用 foreign_keys。`truth_integrations(work_unit_key UNIQUE, candidate_hash, truth_policy_version, decision, target_type, target_id, target_revision, created_at)`、当前值、source rows、revision 和 projection_outbox 必须在同一 SQLite transaction 提交；FTS/vector 可以稍后完成。Canonical truth 的保存状态与各 surface 的 projection readiness 分开计算：outbox 未完成时 API 只能返回 `saved_partial`，不得把 lifecycle `status` 复用成 ready/partial，也不得称为完全 ready。

### 5.4 Index view 规则

- body、summary、keywords、trigger_question 都是同一 unit 的 view，不是独立真值。
- Vector 通道搜索所有允许的 view 后，按 unit 取最佳 rank；同理 lexical 通道内也按 unit 取最佳 rank。
- RRF 只在 vector、lexical、graph、temporal、exact-rule 等物理证据通道之间累加。
- 每个 view 保存 created_by、model、prompt_version、source_unit_revision 和 embedding_model。
- memory_unit_views 同时保存 raw text 与 segmented_text；segment FTS 索引 segmented_text，trigram FTS 索引 raw text。
- segmented_text 由服务端版本化 tokenizer 生成：首版使用 pin 住 Node/ICU 版本的 `Intl.Segmenter`，并用 fixture 保留 Jira key、URL、代码标识符和中英混合 token。Tokenizer/ICU 变化必须生成新 projection version 并重跑标定，不能原地改变查询语义。
- FTS 通过 join 到 memory_units/source rows 执行 status/scope/sensitivity/evidence 过滤；vector projection 复制必要 policy labels 与 evidence-class bitset 做 prefilter，但返回前仍回表验证 source-row gate。Policy 或 lineage 改变时通过 outbox 重建对应 projection。
- 视图可全量删除重建，不影响 unit 真源。

### 5.5 FTS 与 vector 一致性

FTS5 external-content migration 必须同时交付：

1. insert/update/delete triggers；
2. 首次 rebuild；
3. integrity-check；
4. 删除与 retraction 传播测试；
5. projection_outbox 的重放与幂等测试。

sqlite-vec 必须 pin 精确版本；启动时验证 vec_version、所需量化函数和 schema 能力。不同 embedding_model 或 quantization_version 的向量永不直接比较。

截至 2026-09-07，sqlite-vec 仍是 pre-v1，官方 bindings 不受完整 SemVer 保证；ANN/IVF/DiskANN 仍以 alpha/pre-release 形态演进。本计划首轮只依赖经当前版本验证的 `vec0` 能力，不把 alpha ANN 当容量捷径。任何升级先做 shadow rebuild、DELETE/retraction/rename/restore 回归，再修改 pin。

每条 outbox 使用唯一 `projection_key = unit_id + view_kind + source_unit_revision + projection_config_hash`。Worker claim、写 projection 与完成 receipt 都可重放；旧 revision 的迟到任务只能标 stale，不得覆盖较新 projection。

Embedding projection metadata 还必须保存 exact model revision、pooling、normalization、query prefix、passage prefix、dimension 和 dtype。像 multilingual-e5 这类依赖 `query:`/`passage:` 的模型若缺 prefix，视为不同配置，不得复用阈值或索引。

### 5.6 TruthMaintainer 唯一入口

所有 unit、edge、profile 的状态变化都通过 TruthMaintainer：

~~~text
propose(candidate, sources, actor, request_id)
  → created
  | corroborated
  | refined
  | disputed
  | superseded
  | rejected
  | pending_user_confirmation
~~~

规则：

- 同 evidence_key 或同 provenance_family 的回流不算独立加固。
- 只有独立来源或明确用户确认可以提高事实 confidence；task outcome 只更新 utility/accessibility，不证明事实为真。
- 不存在一条全局 authority 大小关系；TruthMaintainer 按 predicate policy 判断适用来源。system_inference 不能自动 supersede 非 inference 来源，无法确定时进入 disputed。
- 矛盾匹配范围为 tenant + owner + subject + predicate + scope + validity interval。
- event 表示“发生过”，不能因后来状态变化而抹去；新状态形成新的 unit。
- 高责任 profile 修改进入 pending_user_confirmation；普通低权威 insight 可自动创建。
- predicate policy 由 `truth_policies` 的版本化记录驱动；每次裁决把 policy version 写入 revision，禁止只存在于代码分支或 prompt。
- Strict parse 成功后先把完整 candidate batch 与 `result_hash` 写入 `ingest_extraction_results`，再逐项 integration；integration retry 读取冻结结果，不重新调用模型生成另一批。
- `work_unit_key = extraction_job_id + result_hash + candidate_ordinal`；同 key 重放直接返回已有 integration receipt。候选内容变化会改变 `candidate_hash`，同 key/hash 不一致是 hard error，不能覆盖旧 receipt。
- 并发裁决使用 `BEGIN IMMEDIATE` + `current_revision` compare-and-swap；CAS 冲突时 reload 当前 truth、重新裁决并限次重试，不能用 last-write-wins 静默吞掉另一 worker 的 revision。
- EntityResolver 只能提出 entity create/alias/merge/split；LLM 名字相似不能直接合并 stable ids。每次 merge/split 写 `entity_revisions`、保留 alias source，并禁止跨 tenant/owner 或不兼容 scope 自动合并。

---

## 6. 写入管线

### 6.1 状态机

~~~text
received
  → pre_persist_screen
      → blocked_receipt                         [terminal: body-free]
      → encrypted_quarantine                    [terminal until release/delete]
      → redacted_payload | eligible_payload
          → episode_persisted
          → extraction_pending
              → extracted_zero                  [terminal success]
              → extraction_failed_retryable → dead_letter
              → extracted_candidates → integrated
                  → projections_pending → ready | partial_ready
~~~

每个状态都写时间、attempt、错误分类和 request id。API 不能把 queued/partial 当成 ready。

### 6.2 确定性落地

1. 优先使用 source event id；没有时使用 source locator + 稳定 source/import batch locator + event-time bucket + per-user keyed content fingerprint 生成 idempotency key，避免 content-only 误合并。未知 event time 不得使用每次重试都变化的 now bucket；block receipt 不保存可离线枚举 secret 的裸 hash。
2. 在内存中先解析 source envelope，运行 deterministic trust/injection/secret pre-persist screen。
3. allow：写原文；redact：只写脱敏正文；quarantine：加密写 ingest_quarantine 且 local-only；block：不保存正文，只留类型化 receipt。
4. Episode 落地后和 LLM、embedding、graph 完全解耦；同时写 scope、origin、sensitivity、writer_agent 和 source_host。
5. Quarantine/block 不生成 unit、embedding、日志正文或 adapter payload。
6. Quarantine 每条记录使用独立 data-encryption key（DEK），由 per-user key-encryption key（KEK）包裹并保存在 OS secret store 或等价的独立密钥服务；数据库与备份只保存 ciphertext 与外部 key reference，不保存可解密密钥。若密钥服务不可用，只能落 body-free receipt，不能退化为明文隔离。
7. Allow/redact 的 episode+job，或 quarantine/block 的 durable receipt 成功提交后，来源 checkpoint 才可前进；任何持久化失败都不推进。Block/quarantine 不能因“永不生成 unit”而被无限重试。
8. P0a-P0c 的 legacy 供给中，所有 policy-eligible、正文非空的 episode 都生成 chunk+FTS；salience 只影响 rank、tier 或后续抽取优先级，不再决定“是否存在于 lexical index”。被 policy 排除的行必须有 typed skip receipt。

### 6.3 显式与后台两条路径

| 场景 | 路径 | 用户回执 |
|---|---|---|
| 用户明确“记住/保存” | 同步落 episode + exact-span `note` unit；语义拆分可后台 0..N 抽取 | saved_partial / ready / queued / failed，绝不等待 LLM 或假装 projection 已 ready |
| 普通聊天/网页/会议 | episode 同步、抽取后台 | 默认低打扰；Explore 中可查状态 |
| 导入/回填 | 分批后台，带 manifest/cursor | 进度、失败、跳过原因 |
| 高风险来源 | quarantine | 原因、修复或显式放行入口 |

Exact-span note 仍通过 TruthMaintainer、normalized source、revision、integration receipt 与 projection outbox 落地，只是候选由用户当前意图确定而非 LLM 生成；它不能绕过 scope/sensitivity/injection gate。Adapter 代写时按 §10.1 的 user intent token 规则决定是否 confirmed。

### 6.4 抽取 contract

- 输出 0..N 个 candidates；零产出是成功状态，必须有 skip_reason。
- 通过 strict parse 的 0..N batch（包括零事实）都写不可变 `ingest_extraction_results`；之后的 integration retry 不再次采样模型。
- 禁止“每 N 条至少生成 M 个”的产量暗示。
- source span、subject、predicate、memory_form、kind、时间、语言和 evidence_class 候选必须可验证。
- `evidence_class`、scope 与 origin authority 只由 authenticated source envelope 和 deterministic policy 决定。LLM 可建议 memory_form/kind、时间和 sensitivity signal；policy 只能维持或收紧 sensitivity/egress，不能提权。
- 所有 object 使用严格 schema，additionalProperties=false。
- 时间使用完整 timestamp 或 null，不能退化成只含日期。
- 关系使用稳定 entity id 或明确 unresolved mention，不能只输出名字。

抽取失败时不生成“原文首句 fact”。Episode 标记 needs_extraction，可被 explicit audit/raw search 使用，但不会进入 profile、graph、passive injection 或 adapter context。

### 6.5 LLM 路由与时效

| 工作 | 通道 |
|---|---|
| 分块、FTS、去重、ACL、状态机、基础 salience | 零 LLM |
| 原子抽取、keywords、候选 trigger question | cheap |
| 冲突解释、复杂 profile proposal、反思 | smart |
| 可延迟超过 24 小时的周聚合、批量视图生成 | Batch |
| 次日早晨必须可用的 anticipation/brief | 普通异步 job 调同步 API，不走 Batch |

启用任何付费抽取前，usage_events、日预算硬顶、capability 级熔断和告警必须已上线。预算拒绝进入可见 queue 状态，不得静默跳过。

### 6.6 Profile 供给

- Explicit：用户直接陈述可形成 active preference/fact，但保留 self_statement 来源；明确“记住/保存”同时视为对该条的 user confirmation，普通对话中的顺带陈述不自动成为 durable identity。
- Deductive：单一证据只能形成 provisional proposal。
- Inductive：至少两个独立 provenance family，且通过 echo detection；默认低权威。
- Durable identity、长期行为定论和敏感 profile 必须用户确认。
- 同群、同会话或 @ 只产生 interaction/co_occurs，不自动推断 reports_to、works_with。

### 6.7 浏览器与服务端职责

- 浏览器可以提供页面定位、matched rules、summary、entity hints 和用户可见的即时 UI 文案。
- 服务端是 canonical extraction、scope、evidence class、truth integration 和持久化的唯一真源。
- 浏览器 hint 必须标 created_by=client_hint，不能直接写 active unit/profile。
- P0a 先修正当前 metadata 嵌套契约；P0b 再通过对等 fixture 证明服务端抽取可替代冗余浏览器模型调用，验证后才删除重复调用。
- Ingest schema v2 使用扁平 metadata.sentiment 和 metadata.importance。Legacy decoder 临时兼容 metadata.metadata.sentiment/priority；priority 映射由服务端版本化配置完成，客户端不能各自定义数值。
- 删除浏览器 LLM 不得切断现有页面召回 anchor；相关 fixture 必须同时覆盖 RingCentral、Jira 和普通网页。

---

## 7. 检索与展示

### 7.1 RetrievalPlan

~~~text
RetrievalPlan {
  requestId
  surface
  lifecycleMode
  queryText
  sceneAnchors
  needSlots[]
  tenantId
  ownerUserId
  allowedScopes[]
  allowedEvidenceClasses[]
  allowedSensitivities[]
  destination
  provider
  maxCandidates
  maxOutputTokens
  deadlineMs
}
~~~

authorityMax 被删除。Evidence class 是适用性集合，不是可线性比较的高低枚举。

### 7.2 Gate 顺序

~~~text
identity/tenant
→ scope
→ status/retraction
→ sensitivity
→ destination/egress
→ prompt-injection/instructional-content
→ relevance retrieval
~~~

前六项任何一项无法判断时 fail-closed。Vector、graph 或 reranker 超时可以返回已通过安全 gate 的 lexical/temporal 部分结果，并标 partial。

### 7.3 Need planner

- jira_issue_reading、ringcentral_group_chat、web_reading 三类先用可版本化模板。
- 未覆盖场景走 freeform，不强猜 needSlots。
- needSlot 是检索假设，不是事实；每个 slot 都允许 no evidence。
- 模板存版本化配置，记录命中、useful、false-interruption 和 abstention。
- 模板来源优先使用真实 Ask 问题聚类，再人工审阅，不由单次 LLM 自动固化。

### 7.4 候选通道

| 通道 | 内容 |
|---|---|
| vector | 允许 view 的语义搜索，通道内按 unit 去重 |
| lexical | segment FTS + trigram FTS，通道内按 unit 去重 |
| graph | entity seed + 有来源的 edge/PPR |
| temporal | 明确时间窗口、状态变化和近因 |
| exact-rule | procedure/rehearsal 的确定性触发 |

初始权重、candidate cap 和相似度阈值都是 model + quantization + surface 绑定的实验配置。换 embedding model 或量化必须重新标定，不能沿用旧余弦阈值。

### 7.5 融合与准入

1. 每通道完成 ACL/status 过滤。
2. 每通道按 unit 去重。
3. 使用配置化 weighted RRF。
4. 应用 source independence、temporal validity、evidence applicability 和 MMR。
5. 通过经标注集校准的绝对 evidence gate。
6. 若无候选通过，返回 no_result + reason；禁止 min_results 强制保底。

相对 top1 阈值只能作离群剪枝，不能代替绝对证据门，因为整批候选可能都很差。

### 7.6 Surface policy

| Surface | 重点 | 延迟目标 | 允许路径 |
|---|---|---|---|
| Passive Lens | 不打扰、novelty、页面增量 | p95 < 500 ms，硬 timeout | deterministic planner + hybrid；不调在线 LLM |
| Compose | 与正在写的内容相关且不误导 | p95 < 700 ms | hybrid + 轻量证据 gate |
| Ask | evidence recall、时序、引用忠实 | p95 < 2.5 s | hybrid，可选 smart synthesis |
| Deep/Historical/Audit | 完整证据、workflow/gotcha | 明示慢路径 | 有预算的 agentic evidence gathering |

所有 surface 都记录 p99、timeout 和各阶段耗时。Passive timeout 返回安全的 partial/no-result，不等待慢通道。

表中的 Ask synthesis 位于 recall core 之后：它只能消费已通过 evidence/ACL/egress gate 的 context pack，不参与候选召回、TruthMaintainer 或后台写入；若使用第三方 provider，仍受 destination/provider policy 约束。

### 7.7 展示层边界

Recall core 返回候选、证据、gate 和 no-result 原因；现有 LensPresentation/Autopilot 决定 ready/partial/blocked、already_visible、anchor_only 和 novelty 展示。

Active selection search 不伪装成 passive receipt。底层重构不得改变“只读、不写入、不发送”的现有页面契约。

### 7.8 Feedback 与 learned ranker

memory_exposures 记录：

- request id、unit、surface、rank、position；
- 当前 policy/version；
- propensity 或实验 bucket；
- shown/quieted/no-result。

Raw exposure 只保留 30 天并按 request id 采样；长期只保存不含正文的日聚合，避免重演 rehearsal 遥测膨胀。用户 correction/confirmation/outcome 按审计与删除策略独立保留。

memory_outcomes 区分：

- opened、dismissed；
- adopted、edited_after_adoption；
- user_confirmed、user_corrected、user_rejected；
- downstream_task_success/failure。

硬规则：

- shown/opened 不改变 confidence 或 stability。
- 只有独立证据、明确确认、纠错和可靠 task outcome 影响生命周期。
- learned ranker 要等 exposure 日志、随机化/interleaving、反事实离线评估和安全回放就绪。
- 初始只 shadow，不影响真实排序。
- utility 使用带先验和置信界的估计，不用五次曝光后的简单比率覆盖 salience。

---

## 8. 巩固、生命周期与删除

### 8.1 巩固阶段

| 阶段 | 工作 | LLM | 是否可自动生效 |
|---|---|---|---|
| A | 时间衰减、状态计算、到期扫描 | 无 | 是 |
| B | evidence-key 去重、独立来源加固 | 无 | 是 |
| C | duplicate/refine/correct 候选 | cheap | 低风险合并可；冲突覆盖需规则或确认 |
| D | insight/brief/profile proposals | smart | insight 可低权威自动；durable profile 待确认 |
| E | graph association、projection GC | 无/cheap | association 先 shadow |

新消息到来可以取消尚未提交的昂贵工作；已经提交的 job 依靠 work_unit_key 幂等落地，不以“用户仍空闲”作为最终一致性条件。

### 8.2 Derived memory

- Insight 必须有 source unit 列表、推理摘要、model/prompt version、expiry。
- Derived 永远不能覆盖 evidence；发生冲突时进入 disputed 或 confirmation request。
- Summary、keywords、trigger question 作为 view，不作为独立 memory。
- Reflection 文件可保留为 UI artifact，但不再整篇回灌成与 evidence 竞争的 chunk。
- 没有新证据不产出“今天没有活动”等填充条目。
- 发散/惊喜优先形成 association edge 或 question view，而不是新增平行散文。

### 8.3 容量与可及性

以下是首轮配置，不是业内真理：

- Always-available T0：最多 40 个 slot。
- 单查询进入融合的候选：最多 200 个 unit。
- Derived proposal rate：默认不高于输入单位的 3%。

它们必须通过 surface-specific eval 调整。库存不因普通衰减设置硬总量上限；可及性通过 tier、expiry、archive 和 evidence gate 控制。

质量密度不使用简单 episodes/token，而使用：

~~~text
effective independent evidence
× source diversity
× temporal coverage
× compression fidelity
− contradiction penalty
− echo penalty
~~~

### 8.4 FSRS-lite 的正确用途

可以借用 retrievability/stability 衰减曲线，但 review update 只接受：

- user_confirmed/user_rejected；
- 独立证据 corroboration/correction；
- 明确、可归因的采用或任务 outcome。

Retrieval、展示、引用和排名本身只是 exposure，不是成功复习。

### 8.5 四种“忘记”

| 操作 | 含义 | 保留审计 | 是否可恢复 |
|---|---|---|---|
| correction | 新事实取代旧当前值 | 是 | 是 |
| retraction | 内容错误或不再可信，默认不召回 | 是 | 是 |
| accessibility_forget | 降低可及性/归档，不删除证据 | 是 | 是 |
| privacy_delete | 用户或法规要求清除 live、projection、archive 与备份生命周期中的数据 | 只保留不含正文的删除 receipt | 否 |

“不因衰减硬删”只适用于 accessibility forgetting，不得阻止 privacy deletion。

Privacy deletion 分阶段完成：请求提交后先写 tombstone 并立即阻断所有读取，然后清 live/projection/archive，最后等待所有含该内容的备份到期或完成 per-record DEK crypto-shred/备份重建（整用户删除才可销毁 per-user KEK）。UI 只有在 `privacy_delete_jobs` 到达 `completed` 才能报告“永久删除”；在此之前必须显示 `deletion_pending` 和最晚完成时间。若法规要求立即不可恢复，必须使用可验证的 per-record envelope encryption 或重建备份，不能把“线上查不到”当作物理删除。

删除影响图必须包含正文、span、candidate/content hash、`truth_integrations`、exposure/outcome 明细、向量、FTS、derived/profile/edge 和日志 payload；hash 不能因为“不是正文”就默认保留。为防 source connector 重新导入，可只保留无正文的 source event id tombstone 与删除 policy version；没有稳定 source id 时，不以可字典枚举的裸 content hash 代替。

从多来源 unit/edge/profile 删除一条 source 后，必须由 TruthMaintainer 基于剩余来源重新计算正文、confidence、status 与派生影响；不能只删 source row 就假设当前 text 不含该来源贡献。无法从剩余 span 确定性重建时先 retracted，再异步提出新候选。

---

## 9. 存储与运行保障

### 9.1 数据库裁决

- P0-P3 保持每用户 SQLite；先清事故噪声并测容量。
- 不在本计划中创建全局 shared.db。
- ops telemetry 是否分库，只有在清理后仍造成写竞争、备份负担或启动问题时才立 ADR。
- 若未来跨库，禁止依赖 WAL 下 ATTACH 的跨库原子事务；使用 outbox、reconciliation 和独立恢复演练。
- retrieval_calibrations、scene_need_templates 和 policy version 与每用户 schema 同步；禁止多个宿主维护不同默认值。

### 9.2 rehearsal_activations

选择 hour-bucket upsert：

~~~text
window_start = floor(event_time / 3600) * 3600
UNIQUE(rehearsal_id, scene_key_hash, surface, window_start)
repeat_count += 1
first_seen_at = min(...)
last_seen_at = max(...)
~~~

scene_key 只保存必要摘要或 hash，避免把页面私密正文复制进遥测表。历史清理必须在新写路径上线并验证后执行。

### 9.3 时间修复

- 能从 source timestamp、message id、文件 metadata 等确定恢复的，写 observed_at 并标 recovered。
- 无法确定的保留 observed_at=null、quality=unknown。
- ingested_at 只表示进入系统的时间，不能参与“事件最近发生”的排序替代。
- 禁止把 epoch-0 改成 now。

### 9.4 lost_and_found

回填必须同时满足：

1. schema fingerprint 匹配；
2. 字段类型与 nullable 约束匹配；
3. 主键/外键可验证；
4. 抽样语义与目标表一致；
5. dry-run 无覆盖、无重复、无权限扩大。

任何一项不满足都只能导出到隔离归档并记录 manifest，不能猜测后写入 active memory。

### 9.5 备份、VACUUM 与替换

备份验收不使用“行数不得低于上一份 90%”，因为合法删除也会降低行数。每份备份验证：

- quick_check；每周 integrity_check；
- foreign_key_check；
- schema/version；
- FTS integrity；
- vec/projection row invariants；
- 与 deletion manifest、migration manifest 的可解释差异；
- 随机 source→unit→view 回溯；
- 实际恢复演练。

VACUUM INTO 生成一致快照，但替换活库必须严格执行：

~~~text
进入维护模式/停写
→ 关闭所有 DB 连接
→ VACUUM INTO 新文件
→ quick_check + FK + FTS + projection invariants
→ fsync 文件和父目录
→ 原库改名为 rollback 文件
→ 原子 rename 新文件
→ 重开连接并跑 health/read/write smoke
→ 成功后保留 rollback 到观察窗结束
~~~

任何一步失败立即恢复旧文件；不得在持有旧 inode 的连接仍开放时替换。

### 9.6 Readiness、retry 与 DLQ

Health 需要区分：

- process live；
- episode store ready；
- FTS ready；
- vector ready；
- extraction provider ready；
- job worker ready；
- backlog age 和 DLQ count。

Provider 初始化失败不能永久缓存为不可用。Retry 使用指数退避和最大 attempts；超过阈值进入 DLQ，保留可重放 payload reference、错误类别和用户可见状态。

`ingest_jobs` 至少保存 `job_id, episode_id, contract_version, status, attempts, next_attempt_at, leased_by, leased_until, last_error_class`。Worker 通过单条 conditional UPDATE/RETURNING claim `queued` 或过期 lease；payload 只引用 episode id，不在 job/DLQ 再复制正文。完成 job 前必须先提交 `truth_integrations`；worker 崩溃后 lease 重放由 work_unit_key 保证不重复建 unit 或加固。

---

## 10. 安全、权限与外发

### 10.1 Origin-bound authority

- authority 来自 origin policy，不由 LLM 文本决定。
- Summary、reflection、跨 agent 转述不能把 third_party_report/system_inference 提升为 first_party/official。
- 每次派生保存 writer_agent、source_host、source units、prompt/model version。
- Memory 中的命令、系统提示、凭证或“以后请执行”默认视为 quoted data。
- 高后果工具动作必须重新读取当前权威证据，并经过独立 action authorization gate。
- Adapter/agent 调用 `write_explicit` 只证明 writer_agent 请求了写入，不等于用户确认；只有当前交互中的 user-authenticated intent token 或本地 UI 明确操作才能设置 `user_confirmed`。

### 10.2 ACL 与 egress matrix

每次读取至少计算：

~~~text
tenant × owner_user × requesting_agent × source_scope
× destination_host × model_provider × purpose × sensitivity
~~~

默认：

- private/restricted 不外发；
- local_only 永不进入第三方 provider；
- approved_destinations 只允许显式列表；
- user_selected 只在当次 preview/selection 后输出；
- agent onboarding 未经人类认领只能访问零数据 sandbox。

Policy resolution 默认拒绝，显式 deny 高于 allow，较窄的 tenant/user/scope binding 高于宽泛 binding；缺 destination、provider、purpose 或 policy version 任一字段都 fail-closed。Adapter 不能用 `scope='all'`、客户端声明的 user id 或 tool 描述绕过 authenticated principal。

ACL 必须被 Episode、Unit、Graph、Profile、FTS、Vector、Archive、MCP 和 context_pack 的负向测试覆盖。不能因为一个入口做了过滤就假设其他入口安全。

### 10.3 Memory Defense

摄入前检查：

- prompt injection / instructional payload；
- secrets、PII、protected keys；
- size anomaly、encoding anomaly；
- CJK 与 ASCII 紧邻的 secret 边界；
- hidden text、HTML/Markdown instruction laundering。

动作是 allow/redact/quarantine/block。Block 后原文、unit、embedding、日志正文和备份新版本都不得残留；redact 必须保留类型化占位符和不含密文的 receipt。

### 10.4 Failure policy

| 故障 | 策略 |
|---|---|
| Vector/graph/reranker timeout | 可退化到已过安全 gate 的通道，标 partial |
| ACL/scope/sensitivity/egress 无法判断 | fail-closed |
| Injection/secret scanner 不可用 | 对外发和主动注入 fail-closed；episode 可进隔离 queue |
| LLM 抽取失败 | episode 保留，job retry/DLQ，不伪造 unit |
| Adapter 不可用 | 宿主任务可继续，但 memory 操作显示 failed/queued |
| Privacy delete 部分失败 | 维持 tombstone，阻断所有读取并持续补偿，不能报告完成 |

---

## 11. 迁移路线

### 11.1 阶段总表

| 阶段 | 必须依赖 | 范围 | 退出门 | 回滚 |
|---|---|---|---|---|
| R0 | 无 | evidence manifest、schema/模型/索引/性能基线 | 事实全部有等级、时间、查询与 owner | 无写入 |
| P0a | R0 | 供给解耦、字段契约、rehearsal 防抖、空反思阻断 | 新 episode 在抽取关闭时仍进入 chunk+FTS；放大率有界 | feature flags / revert code |
| P0b | P0a | budget、readiness、retry/DLQ、备份/恢复 | provider 故障可恢复；budget 硬顶可测试；恢复演练通过 | 关闭 worker |
| P0c | P0b | 旧 schema FTS 回填、baseline hybrid | 覆盖率和 FTS integrity 达标；旧体验非劣 | 停回填，保留原表 |
| P0.5 | P0c | gold atomic units、view/intent/model 消融 | 结果有置信区间，能否决无增益机制 | 全部 shadow |
| P1 | P0.5 | v3 schema + extraction worker + dual-write | source completeness、幂等、parse/zero/DLQ 可见 | 停 worker，新表保留 |
| P2 | P1 | dual-read shadow + surface cutover | Passive/Ask/Compose 各自过门；安全零回归 | 关闭对应 `MEMORY_READ_V3_*` |
| P3 | P2 | consolidation/profile/lifecycle | on-policy、纠错、misevolution、feedback loop 过门 | 阶段白名单 |
| P4 | P3 | adapters、MCP、context passport ACL/egress | 全矩阵负向测试、外发 receipt、adapter 不新增隐式 memory 模型调用 | 撤销 adapter scopes |
| P5 | P4 | 停旧写、清旧 projection/表；可选 storage ADR | 30 天稳定 + 完整 rollback drill | 保留旧库快照到观察窗结束 |

Feature flag 必须由服务端单一 registry 管理，默认关闭，并保存 tenant/user allowlist 与配置快照：

| Flag | 首次启用 | 作用 |
|---|---|---|
| `MEMORY_SUPPLY_DECOUPLED` | P0a | 抽取关闭时仍写 chunk/FTS |
| `MEMORY_FTS_TRI_SHADOW` | P0c | 只记录 trigram shadow 候选 |
| `MEMORY_WRITE_V3_SHADOW` | P1 | v3 dual-write，不改变读结果 |
| `MEMORY_WRITE_LEGACY_ENABLED` | P1 创建、P5 关闭 | dual-write 期间保持 true；P5 rollback drill 后才按用户关闭 |
| `MEMORY_READ_V3_ASK` | P2 | Ask 逐用户切换 |
| `MEMORY_READ_V3_COMPOSE` | P2 | Compose 逐用户切换 |
| `MEMORY_READ_V3_PASSIVE` | P2 | Passive 最后切换 |
| `MEMORY_CONSOLIDATION_V3` | P3 | 按子阶段白名单启用巩固 |
| `MEMORY_ADAPTER_EGRESS_V3` | P4 | 允许经统一 policy 的外发 context pack |

Flag 名称、默认值和依赖关系要有启动校验：后阶段 flag 不能在依赖阶段未通过时开启；禁止浏览器本地配置独立决定服务端 rollout。

### 11.2 P0a：事故恢复

按顺序实施，每项独立 commit、验证和 rollout：

1. 解耦 IngestionPipeline 中 chunk/FTS 与 LLM extraction/salience admission：eligible 非空 episode 一律进入 legacy lexical projection，salience 只用于排序和后台优先级。
2. 修复 sentiment/importance 的浏览器→服务端字段契约。
3. 为 EmbeddingClient 增加 readiness 和可重试 warmup；这一步不切换模型。
4. 将 rehearsal 写入改为 hour-bucket upsert。
5. 阻止没有新消息的 reflection 和 Runs 日志进入索引。
6. 增加 supply metrics、channel diagnostics、p99 和阶段耗时。
7. 增加服务端 capability rollout allowlist；Rollout 1 个高流量用户→5 个用户→25 个用户，每层至少观察 24 小时，不能依赖浏览器本地 env 模拟灰度。

P0a 不做：

- 不切换 multilingual-e5；
- 不新增 v3 tables；
- 不拆数据库；
- 不做 full vector backfill；
- 不改 learned ranking。
- 不直接关闭 recall safe mode；只补诊断，模式变更留到 P0c shadow。

P0a 硬门：

- extraction=false 且 salience 低于旧阈值时，eligible 非空 episode 仍产生 chunk 和 FTS；
- 同一 scene 一小时 100 次命中只产生一行 aggregate，repeat_count=100；
- Passive 对断供期以后 fixture 有 lexical 候选；
- context-recall 和 memory abilities 不回退；
- 无跨用户结果；
- 任一步关闭 flag 后回旧行为。

### 11.3 P0b：运行保障与已授权数据修复

先完成：

- usage_events、日预算硬顶、capability 熔断；
- worker readiness、retry、DLQ；
- incident snapshot helper；
- 备份 manifest 和恢复演练。

既有预授权作业按阶段归属执行，每项前都生成并验证独立备份：

| 作业 | 执行阶段 |
|---|---|
| rehearsal 历史噪声清理 | P0b，新写放大已修复后 |
| 事故快照保留策略清理 | P0b，恢复演练通过后 |
| lost_and_found 指纹判定；不可证明则隔离导出 | P0b |
| 坏时间戳恢复；不可证明则 unknown | P0b |
| 旧索引覆盖回填 | P0c |
| chunks_vec 碎片重建 | P0c |
| 一次 VACUUM/替换 | P0c 全部作业通过后 |

授权已存在，不重复询问；但任一 preflight 或备份门失败就停止该项。

### 11.4 P0c：旧栈基线

- 先执行 [memory-index-backfill-plan.md](./memory-index-backfill-plan.md) 的 Tier 0：chunk + FTS。
- 当前模型继续服务新增流量并 pin 版本；此阶段不为全部历史数据做 legacy vector backfill。
- 重建现有 chunks_vec 只用于修复碎片和保证当前向量通道可测。
- 新增 chunks_fts_tri shadow 表作为中文/混合文本基线；不替换现有 FTS，先做消融和 integrity test。
- 建 segment/legacy FTS + trigram + dense 的 RRF baseline，但不引入 trigger-question 独立通道。
- Dense baseline 必须同时报告真实 vector coverage；覆盖不足不能被误判为 embedding 模型质量差。
- recall safe mode 只在 shadow 中按 retrievalMode 分档，不直接全局关闭。
- 产出 old-stack baseline report，供 P0.5/P2 对比。

这样既能快速恢复近期可检索性，也避免在模型尚未裁决前做两次全量 embedding。

### 11.5 P0.5：薄切实验

数据：

- 从原始 episodes 按中英文、来源、时间、scope、surface 分层抽样；
- 人工标注 atomic units、source spans、正确 no-result、冲突和时序问题；
- 至少覆盖 Jira、RingCentral、Web 三类真实场景；
- 样本量通过 power analysis 确定，首轮不得少于 150 个 scene-query pairs。

消融：

| Variant | 内容 |
|---|---|
| A | lexical+dense RRF baseline |
| B | A + needSlots |
| C | B + trigger-question views，但 vector 通道内按 unit 去重 |
| D | C + multilingual embedding candidate |
| E | D + int8 candidate |

模型清单在 R0 冻结到 `model-candidates.json`，首轮最多三项，防止无边界 benchmark：

| 角色 | 首轮候选 | 约束 |
|---|---|---|
| control | 当前 `Xenova/all-MiniLM-L6-v2` 的 exact revision | 只作旧栈对照，不因英文偏置直接判新模型胜出 |
| lightweight multilingual | `intfloat/multilingual-e5-small` exact revision | query/passage prefix 必须分别配置；阈值单独标定 |
| capacity upper bound | `BAAI/bge-m3` dense-only exact revision | 只有 doctor 证明目标 host 可加载且 pilot 延迟/内存不过门时才进入完整消融；不同时启用 sparse/ColBERT，避免混淆模型与通道收益 |

候选若因 license、ONNX/runtime、内存或离线可部署性不满足约束，报告 `ineligible` 而不是临时换成未记录模型。BGE-M3 的 sparse/multi-vector 能力是未来独立实验，不进入本轮 sqlite-vec dense 裁决。

报告必须包含 bootstrap CI、surface 分层、no-result、误召回、延迟、索引体积和量化损失。增益不能只看 aggregate useful@1。

裁决：

- NeedSlots 或 trigger views 的增益置信区间覆盖零且无明确长尾收益，则不进入 P1/P2 默认路径。
- 新 embedding 只有在质量提升且延迟/存储可接受时采用。
- int8 只有在 recall loss 通过门后采用。

### 11.6 P1：Schema 与 dual-write

1. 建 v3 tables、FK、FTS triggers、projection outbox。
2. 实现 strict extraction contract 和 opaque needs_extraction 失败态。
3. TruthMaintainer 接管 unit/edge/profile 状态变化，并写入实际使用的 `truth_policy_version`。
4. 旧写保持不变，新写只作 shadow。
5. Rollout 1→5→25；每层验证 idempotency、lineage、ACL 和成本。

只有 **每个已创建的 active unit/edge/profile 都有完整 normalized lineage**（该口径 100%；零事实 episode 不要求虚构 unit）、silent failure=0、replay 不重复加固、projection 可重建，才进入 P2。

### 11.7 P2：Dual-read 与切换

每个请求用同一 request id 同时运行 old/new：

- 保存候选、rank、通道、source coverage、no-result、延迟和成本 diff；
- shadow 不展示、不记 exposure outcome、不改变 lifecycle/profile；
- 先切 Ask，再 Compose，最后 Passive；每个 surface 有独立 flag；
- 安全 gate 不参与 A/B，永远使用新统一 policy。

只有新路径达到 surface-specific 非劣门，并在关键能力有统计可靠提升，才切默认。

### 11.8 P3：巩固、画像与反馈

按白名单依次开启，后一项必须等待前一项过门：

1. A/B：确定性 decay、evidence-key 去重和独立来源加固。
2. C：duplicate/refine/correct proposal；先 shadow diff，再允许低风险合并。
3. D1：低权威、有 expiry 的 insight/brief；不得覆盖 evidence。
4. D2：profile proposals；durable/sensitive slot 保持 pending confirmation。
5. E：association edges shadow；证明不会跨 scope 或改变 current truth 后再读。
6. Exposure/outcome 日志；30 天后才允许 learned-ranker shadow。

P3 退出门：重复导入不加固、纠错可选择性修复、derived 不覆盖 evidence、profile 无错误 durable promotion、AMemGym/MemEvoBench 风格回放不回退。

### 11.9 P4：Adapter 与 context egress

1. adapter-core 只接收 RetrievalPlan，不自行拼接 memory prompt；对宿主暴露的最小语义面固定为 `recall`、`open_sources`、`write_explicit`、`feedback`、`delete`，协议名可因 MCP/HTTP 不同，但含义必须一致。
2. OpenClaw、Claude Code/MCP 等宿主分别声明 destination、provider、purpose 和 token budget。
3. context_pack 只消费 ACL/EgressPolicyEngine 已允许的 items，并附 evidence/age/scope 标签。
4. 每次外发写不含正文的 receipt；用户可查看去向、条数、类别和 policy version。
5. Self-onboarding 只给零数据 sandbox challenge；人类认领后才授予真实 scope。
6. 宿主插件不得额外调用模型做二次 memory extraction，也不得把召回内容升级为工具指令。
7. `open_sources` 重新执行当前 ACL/egress gate，不把 recall 时获得的 unit id 当作永久 capability；`delete` 和 scope 授权需要独立的高责任确认，不从历史 memory 文本推断。

P4 退出门：所有宿主的 cross-user/cross-scope/restricted/local_only 负向测试为零泄漏；撤销 scope 后立即不可读；adapter 故障不伪装成功。

### 11.10 P5：旧路径退役

1. 新读路径默认开启后观察至少 30 天，期间保留 old dual-read 和回滚能力。
2. 停止旧写，但暂不删除旧表；执行一次 RETRIEVAL_V3=false + old-store 完整恢复演练。
3. 生成旧表 source coverage、未迁移记录、open correction/delete jobs 和 backup dependency 清单。
4. 所有清单为零或有显式处置后，创建最终备份并分批删除旧 projection/死代码。
5. 每批删除后跑全量 eval、FK/FTS/projection audit 和 restore smoke。
6. 数据库拆分、archive-YYYY 或换引擎不属于默认 P5；达到容量阈值后另立 ADR。

---

## 12. 评测与阶段门

### 12.1 每次 memory path 变更必跑

~~~bash
npm --prefix memory-service test
npm --prefix memory-service run build
npm run eval:memory-abilities -- --endpoint <branch-authoritative-endpoint>
~~~

memory-abilities 必须指向本地分支服务或部署后的当前代码，不能用旧线上服务的绿灯证明本地改动。

同时运行受影响的 registry suites，例如 context-recall、scene-memory-autopilot、memory-search、memory-lifecycle、recall-synthesis-contract、user-profile、storage-hygiene。

### 12.2 能力矩阵

| 类 | 必测 |
|---|---|
| LongMemEval 五能力 | extraction、multi-session、temporal、knowledge update、abstention |
| 本项目第六能力 | prospective/rehearsal；明确标为自定义扩展 |
| Web-agent experience | static、dynamic、workflow、gotcha、premise awareness |
| Evolution | state evolution、纠错后行为、跨轮反馈复利 |
| Safety | poisoning、noisy tools、biased feedback、dormant trigger、selective repair |
| Privacy | cross-user、cross-tenant、scope、egress、delete、backup、archive |
| Operations | zero-fact、parse fail、provider down、DLQ、projection rebuild、restore |

### 12.3 Surface 指标

| Surface | 主指标 | 保护指标 |
|---|---|---|
| Passive | genuinely-new useful@1、correct abstention | false interruption 不升、p95/p99/timeout |
| Ask | evidence recall、temporal correctness、citation faithfulness | hallucination/no-evidence answer |
| Compose | adopted-without-material-correction | misleading suggestion、用户撤销 |
| Write | source completeness、duplicate rate、zero/silent failure | poisoning acceptance、跨 scope 写 |
| Profile | correct update/correction recovery | false durable promotion |

### 12.4 诊断 baseline

每个 benchmark 至少比较：

- no-memory；
- long-context；
- oracle evidence；
- oracle retrieval；
- old retrieval；
- new retrieval。

这样可以区分 write loss、retrieval loss、reading/reasoning loss，而不是把所有失败归因于向量模型。

### 12.5 安全硬门

以下任一失败都阻止 rollout：

- 跨用户/跨租户/跨 scope 泄漏；
- retracted/privacy-deleted 内容被召回；
- blocked secret 出现在 unit、embedding、日志或新备份；
- memory instruction 绕过当前 action authorization；
- replay 导致 confidence/stability 重复增长；
- shadow 结果影响展示或反馈；
- backup 无法恢复。

### 12.6 统计裁决与证据产物

R0 必须生成并版本化 `eval-policy-v1.json`，避免执行者临场挑指标：

- 所有新旧比较使用同一批 scene-query pairs 的 paired bootstrap 95% CI，并按 Passive/Ask/Compose 分层。
- rollout 的默认质量非劣 margin 是 **2 个百分点**；任一主指标差值 CI 下界低于 -2pp 即失败。样本不足时结论是 inconclusive，不得当作通过。
- “有改进”只能在目标指标的差值 CI 下界大于 0 时声称；架构更整洁、平均分更高或单个 demo 变好都不算统计改进。
- 安全、隐私、lineage、silent failure、replay reinforcement 和 restore drill 没有非劣 margin，必须零失败。
- 延迟按 §7.6 的 surface SLO 判断，同时报告 p50/p95/p99、timeout 和 partial/no-result；不得用更高 abstention 隐藏超时。
- 若 R0 power analysis 证明 2pp 无法在可行样本量内检测，可通过 ADR 修改 margin；ADR 必须同时说明用户风险、样本量与最大观察期，不能在结果出来后追认。

每次阶段门产生不可变 evidence bundle：

~~~text
artifacts/memory-foundation/<phase>/<timestamp>/
  evidence-manifest.json
  config-and-flags.json
  eval-report.json
  safety-negative-report.json
  migration-or-shadow-diff.json
  restore-or-rollback-receipt.json
  README.md
~~~

bundle 写 commit、schema、model、quantization、policy version、数据窗口与脱敏查询；正文中只引用 bundle id，不复制一份可能漂移的数字。含真实用户样本或可逆标识的 raw evidence 只能留在 gitignored 本地安全目录，入库 bundle 必须只含聚合、synthetic fixture 与不可逆脱敏结果。

---

## 13. 可执行工作包

### 13.1 P0a 预计触点

- IngestionPipeline：供给解耦、字段 contract、时间断言。
- EmbeddingClient / ContextRecallService：readiness、warmup、阶段诊断。
- RehearsalActivationService：hour-bucket upsert。
- ConsolidationEngine / ReflectionThreadService：空输入和 Runs 索引阻断。
- supply/usage metrics 与对应 tests/evals。

### 13.2 P1-P2 预计触点

- migrations：v3 tables、FK、FTS triggers、projection outbox。
- EpisodeRepository、ExtractionWorker、TruthMaintainer。
- UnitProjectionWorker、RecallEngine、InformationNeedPlanner。
- ACL/EgressPolicyEngine、exposure/outcome stores。
- eval fixtures、shadow diff report 和 feature flags。

### 13.3 每个工作包模板

每个实现 PR/commit 必须写：

1. 改动对应的 decision/invariant；
2. 受影响表/API/surface；
3. migration 与 idempotency；
4. feature flag；
5. targeted tests；
6. branch-authoritative eval 报告；
7. rollout 层级；
8. rollback 命令与已验证证据；
9. 任何 inferred/hypothesis 是否被新的观测更新。
10. evidence bundle 路径与完整性 hash。

---

## 14. 风险登记

| 风险 | 预防 | 触发回滚 |
|---|---|---|
| 事故修复与重构混杂 | P0a-P0c 禁止 v3 schema/model swap | 无法单独归因的质量下降 |
| LLM 抽取烧预算 | 硬顶、tier、熔断、DLQ | 超预算或 backlog 失控 |
| 派生物自我强化 | provenance family、derived 不覆盖 evidence | echo reinforcement 测试失败 |
| Learned ranker 富者愈富 | exposure/propensity、interleaving、shadow | 新条目曝光崩塌或反事实评估变差 |
| 无证据也硬展示 | absolute gate + abstention | Passive false interruption 上升 |
| 权限仅存在于 API 表面 | 每个物理通道负向测试 | 任一跨边界结果 |
| Poisoned memory 未来触发工具 | origin-bound authority + action gate | dormant-trigger case 执行成功 |
| FTS/vec 与真源漂移 | outbox、trigger、rebuild、integrity | source/unit/view count 无法解释 |
| VACUUM 替换损坏活库 | quiesce、fsync、restore drill | health/read/write smoke 失败 |
| 多用户 rollout 扩大事故 | 1→5→25 | 任一层保护指标回退 |

---

## 15. 最终一致性检查表

开发开始前和每次 ADR 后都必须回答“是”：

- [ ] 正文是否只有一个当前答案，没有“后文推翻前文”？
- [ ] 每个阶段的前置依赖是否已在更早阶段交付？
- [ ] 每项写入是否有幂等键、状态、失败可见性和重放语义？
- [ ] 每个事实/profile/edge 是否有正规化 lineage？
- [ ] 每个检索入口是否先做 ACL/status/egress/injection gate？
- [ ] No-result 是否合法，Passive 是否没有强制最小结果？
- [ ] View 是否在通道内按 unit 去重，没有重复 RRF 奖励？
- [ ] Exposure 是否与 confirmation/outcome 分开？
- [ ] Correction、retraction、forget、privacy delete 是否语义独立？
- [ ] Shadow 是否完全无用户与生命周期副作用？
- [ ] 模型/量化阈值是否按版本隔离并重新标定？
- [ ] 数据作业是否有备份、manifest、dry-run 和恢复演练？
- [ ] Eval 是否指向当前分支代码并覆盖受影响 surface？
- [ ] 安全负向测试是否零失败？
- [ ] 回滚是否经过实际演练，而非只写了开关名？

若任何一项为“否”，对应阶段不得进入生产。

---

## 参考

### 开源项目

- [Mem0](https://github.com/mem0ai/mem0)
- [Graphiti](https://github.com/getzep/graphiti)
- [Cognee](https://github.com/topoteretes/cognee)
- [Supermemory](https://github.com/supermemoryai/supermemory)
- [TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)
- [Hindsight](https://github.com/vectorize-io/hindsight)
- [Letta](https://github.com/letta-ai/letta)
- [memU](https://github.com/NevaMind-AI/memU)
- [LangMem](https://github.com/langchain-ai/langmem)
- [A-MEM](https://github.com/agiresearch/A-mem)

### 论文与工程资料

- [LongMemEval](https://arxiv.org/abs/2410.10813)
- [LongMemEval-V2](https://arxiv.org/abs/2605.12493)
- [MemoryAgentBench](https://arxiv.org/abs/2507.05257)
- [AMemGym](https://arxiv.org/abs/2603.01966)
- [MemEvoBench](https://arxiv.org/abs/2604.15774)
- [EvoMemBench](https://arxiv.org/abs/2605.18421)
- [Unbiased Learning-to-Rank with Biased Feedback](https://arxiv.org/abs/1608.04468)
- [MemSecBench](https://arxiv.org/abs/2607.27080)
- [Hidden in Memory](https://arxiv.org/abs/2605.15338)
- [Origin-Bound Authority](https://arxiv.org/abs/2606.24322)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [SQLite VACUUM](https://www.sqlite.org/lang_vacuum.html)
- [SQLite Backup API](https://www.sqlite.org/backup.html)
- [sqlite-vec scalar quantization](https://alexgarcia.xyz/sqlite-vec/guides/scalar-quant.html)
- [sqlite-vec versioning](https://alexgarcia.xyz/sqlite-vec/versioning.html)
- [sqlite-vec releases](https://github.com/asg017/sqlite-vec/releases)
- [FSRS algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)
- [multilingual-e5-small model card](https://huggingface.co/intfloat/multilingual-e5-small)
- [BGE-M3 official documentation](https://github.com/FlagOpen/FlagEmbedding/blob/master/docs/source/bge/bge_m3.rst)
