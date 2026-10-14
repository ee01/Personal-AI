# Memory Foundation 架构（v1 → v2 → v3 数据模型）

> 所属能力：记忆服务（核心平台）
> 更新日期：2026-10-13
> Canonical 方案：[memory-foundation-rearchitecture-plan.md](../progressing/memory-foundation-rearchitecture-plan.md)

## 大白话运行逻辑

这个系统要把用户的记忆存好、找准、管住。它现在同时跑三代数据模型：旧的 v1/v2 负责"把消息存下来能搜到"，新的 v3 负责"把消息变成原子事实、管好真值、管住权限"。三代并行运行，v3 以 shadow（影子）模式验证质量后再切换。

## 写入来源与晋升硬门

写入先保存确定性来源，再决定是否可成为长期事实。`messages_raw` 与 `memory_unit_sources` 的 origin_class 是 owner / observed / agent / untrusted / system 闭集；session_kind、promotion_eligible、derived_from_json 与原文血缘一起保存。来源分类不调用 LLM，模型不能改变来源权限。

- interactive/import 中的 owner/observed 才可进入 durable 候选，仍须通过 claim attribution 与 ACL。heartbeat/cron/subagent/reflection/dream 只保留任务产物。v3 在 enqueue、历史队列重放及 truth 整合入口都检查来源资格；旧 truth 与 profile 写入也受 claim 门控。
- 日摘要、项目摘要、reflection、dream、报告 markdown 保留为产物，`MarkdownManager.reindexFile` 不再把这些派生目录重新切成事实 chunks。现有索引不删除。
- salience 频次统计只认可晋升的不同 origin_family（来源渠道 + 作者），并排除当前作者族；同作者重复、同族派生物没有多来源增益。v3 提取从持久化源取得 family，使用 MemoryClaimEnvelope 确认是否可以表示 self_statement。
- 整理、反思证据与 Keystone 简报的源读取过滤 promotion_eligible。睡眠协调已复用此视图；后续 resident one-pager 与 attention 投递工作流应复用 `promotion_eligible_units` 视图及 `listPromotionEligibleUnitIds`，而不是另造宽松来源门。`canAutoPromoteProfile` 必须显式提供 promotionEligible。
- Ask/Compose 内部 prompt 的 recalled 标记支持回灌只记 exposure、不新增 unit；exposure 不更新置信度或稳定性。外发 Context Pack 剥离内部标记。声明网络工具后的 session taint 持久化，用户新消息清除。

迁移 074 保守回填全部历史行，用户上下文初始化追加用户身份精确映射；无效 metadata JSON 视为空对象。它只更新来源和资格，不删原文。回填可重入，并且忽略当前后台调度上下文，避免将历史 owner 消息整批误标为 cron。

2026-10-12 上线前只读审计：181 条系统/AI 来源原文，1,763 条关联或派生目录 chunks；按 evidence_refs/episode 血缘可追溯到的 profile/truth 为 0。历史会话未普遍带 session_kind，不能把已声明后台回灌次数 0 解释为历史没有回灌。生产 owner 去内容抽样为 99 条 Glip + 1 条 manual；完整数字保留在 `memory-service/evals/write-provenance-gate/phase0.json`。

三个 flag 默认开启：WRITE_ORIGIN_GATE_ENABLED、RECALL_LOOP_GUARD_ENABLED、TURN_TAINT_ENABLED。关闭 flag 可恢复对应旧路径，新增来源列与 audit 记录保留。排查可按 raw 的 origin/session/promotion 分组、按 memory_exposures.surface 统计回路命中、读取 memory_turn_taint 检查当前污染状态；不将 exposure 当确认。

实现与验证：`WriteProvenanceGate.ts`、migration 074、`SystemWriteContext`、`ConsolidationPhases.ts`；`npm run eval:write-provenance-gate` 和 `npm run eval:memory-abilities`。后者的端点必须运行当前部署代码。

## 三代数据模型演进

| 代 | 核心概念 | 物理表 | 状态 |
|---|---|---|---|
| **v1** | 原始消息 + 分块索引 | `messages_raw`、`chunks`、`chunks_fts`、`chunks_vec`、`entities`、`relationships` | 运行中（主要读路径） |
| **v2** | 元数据层 + 生命周期 | `memory_metadata`、`profile`、`rehearsals`、`rehearsal_activations`、`confirm_requests` | 运行中（ranking/治理层） |
| **v3** | 原子记忆单元 + 真值体系 | `memory_units`、`memory_unit_sources`、`memory_unit_revisions`、`memory_unit_views`、`truth_integrations`、`projection_outbox`、`ingest_jobs`、`profile_slots`、`memory_exposures`、`memory_outcomes`、`unit_lifecycle` | shadow 写入 + shadow 读取验证中 |

### v3 为什么存在

v1/v2 的核心问题：一条消息被当成一个整体存入索引，检索靠的是"这条消息的某些 chunk 碰巧包含你要的词"。这导致：

1. **跨语言检索缺口**：中文提问搜不到英文原文（FTS 词法无重叠，MiniLM 跨语言弱）
2. **无真值管理**：同一事实被说了五次就存五份，没有"这是同一件事"的概念
3. **无权限矩阵**：所有记忆同等待遇，没有 sensitivity/egress 分级

v3 把每条消息拆成**原子记忆单元**（atomic memory units），每个 unit 带完整血缘（→哪条消息的哪个 span）、修订历史（append-only revisions）、幂等回执（truth_integrations）、投影输出（views → FTS/vec）。

## 关键决策逻辑（v3 真值体系）

**TruthMaintainer**（`core/v3/UnitTruthMaintainer.ts`）是所有 unit 状态变化的唯一入口：

1. **冲突判定范围**：`tenant + owner + subject_key + predicate_key + scope + 有效期`
2. **同 evidence_key 重放不加固**（I5）：同一证据源的重播只返回已有回执
3. **独立来源加权**（I6）：confidence 只因新增独立 provenance family 而提升（每 family +0.08，上限 0.95）
4. **写入不做模型裁决**：不同文本暂记 `disputed`，保留独立候选；夜间通过 shadow 资格门的 B/C 才可调用带回执的真值裁决。更新必须是同槽、已知时间更晚、来源权威不低且不是纯推断；用户确认过的事实不能被自动替代。
5. **CAS 并发安全**：`BEGIN IMMEDIATE` + `current_revision` compare-and-swap

## v3 供给管线（P1 shadow dual-write）

```
新 episode 入库 → ingest_jobs 排队 → ExtractionWorker 领取
  → cheap 档 LLM 抽取（MEMORY_EXTRACTION_LLM_FALLBACKS）
  → 冻结候选批次（ingest_extraction_results）
  → 逐条经 TruthMaintainer propose()
  → unit + sources + revision + views + outbox 原子提交
```

- 抽取用 `strict contract`（additionalProperties=false、byte-span、零候选=成功态）
- 冻结批次重放不重采样（§6.4）
- 失败退避 60/300/900 秒后进 dead_letter（可见，不静默）
- 心跳每 15 分钟排水最多 5 个 job/用户

## v3 检索管线（P2 dual-read shadow）

```
/recall 或 /ask 或 /context-recall → legacy 检索
  → 同时 fire-and-forget 跑 v3 UnitRecallReader
  → 结构化日志 [v3-read-shadow:*] 记录 diff
  → 不展示、不强化、不改 lifecycle（I11）
```

**UnitRecallReader** 三通道 RRF 融合：
1. `lexical_seg`：porter tokenizer 分词索引（unit_views_fts_seg）
2. `lexical_tri`：CJK 四字滑窗索引（unit_views_fts_tri，P0.5 裁决 +5.2pp）
3. `vector_e5`：multilingual-e5-small 384 维向量（P0.5 裁决 +16.9pp，MEMORY_READ_V3_VECTOR=e5 开启）

所有通道都做 SQL 层 + hydration 层双重状态门（I6：retracted/archived/deletion_pending 永不出）。

## 预算与成本治理

- `LLM_DAILY_BUDGET_USD`：全局每日 LLM 硬顶（所有用户 × 所有能力）
- `LLM_DAILY_BUDGET_<CAPABILITY>_USD`：按能力单独设帽
- 超限拒绝发生在 provider 调用之前（零费用、零熔断伤害），记录可见的 `budget_rejected` 事件
- 模型定价从 OpenRouter 公开 API 按精确 id 匹配（`update-model-pricing` skill）

## 网页分析客户端优先策略

- `WEBPAGE_ANALYSIS_VIA_LOCAL_KEY=true`（默认）：后端网页分析路由返回 403，分析只在浏览器本地用用户配置的 LLM key 执行
- `=false`：显式开启服务端兜底（受 300 次/用户/天配额 + 预算帽约束），可用 `WEBPAGE_ANALYSIS_MODEL` 指定降档模型

## 切面与观察（P2 → P5 路线）

1. v3 shadow 数据积累 24-48 小时 → paired bootstrap 非劣裁决（2pp margin）
2. `MEMORY_READ_V3_ASK` → `MEMORY_READ_V3_COMPOSE` → `MEMORY_READ_V3_PASSIVE` 依次切换
3. 切换后稳定观察 30 天 → P5 停旧写、清旧表

## 安全与隐私硬门（P4）

每次读取通过 `EgressPolicyEngine.checkRead()` 计算：

```
tenant × owner × requesting_agent × scope
× destination × provider × purpose × sensitivity
```

- 跨租户拒绝、非 owner 拒绝（claimed agent 除外）、sandbox 零数据
- `local_only` 永不外发、`private/restricted` 阻断外部 destination
- 字段缺失 fail-closed（I10）
- adapter 不能设置 `user_confirmed`（只有 user_ui / user_token 可以）

## 关键文件

| 文件 | 职责 |
|---|---|
| `core/v3/UnitTruthMaintainer.ts` | 真值唯一入口：propose/裁决/CAS |
| `core/v3/ExtractionWorker.ts` | shadow 抽取：claim/freeze/integrate/DLQ |
| `core/v3/UnitRecallReader.ts` | v3 读取：三通道 RRF + I6 状态门 |
| `core/v3/UnitEmbeddingWorker.ts` | e5 向量投影排水 |
| `core/v3/EgressPolicyEngine.ts` | ACL/egress 全矩阵 |
| `core/v3/ExposureOutcomeService.ts` | 曝光/结果记录 + FSRS-lite |
| `core/v3/SurfaceCutover.ts` | 切面 flag + 非劣门统计 |
| `analytics/BudgetGuard.ts` | 日预算硬顶 |
| `storage/migrations/070-072_*.sql` | v3 schema |

## 睡眠期整理与两车道读取

白天先把来源和原文存好；夜里把新线索与旧事实逐条比较。原文、反对意见与旧版本始终可追溯。朋友多年以前的偏好降低被动展示频率，但用户主动问到这个人时仍可找回。确定性实体/alias、lexical 和单一 dense 通道先找证据；用户明确深问，或深问而快车道没有强命中时，才做有界的拆问与时间词扩展。

### Nightly A–E

`ConsolidationEngine` 在既有日巩固任务的 synonym 阶段之后调用 `SleepReconciliation`，不新建调度器。开关 `MEMORY_CONSOLIDATION_V3=A,B,C,D,E` 必须包含前序阶段；未配置时保持旧路径。

| 阶段 | 判决与产物 | 成本与安全边界 |
|---|---|---|
| A | 按 form/kind 降低可访问性；evidence-key/family 独立来源去重统计；synonym 连通组写可逆 canonical alias 映射 | 0 LLM；只合并相同类型、相同 owner/tenant/scope/sensitivity/egress 组合；歧义别名不归一 |
| B | 当天新 unit 对旧真值逐对判 `corroborate/refine/supersede/dispute/noop`；停机期间的新 unit 由扫描水位补齐，超预算留 deferred 次日优先 | 默认 shadow；同 key 候选穷尽，并集 lexical 两通道与同模型 dense 各自 Top-10，不用 recall RRF Top-K 做真值候选 |
| C | 同实体同 key 多值与高相似异义对，以 LLM judge 判断是否真矛盾 | 14 天 pair 冷却；不同值不直接判矛盾；仅 durable 自身偏好、已确认事实或 restricted 争议生成现有确认请求 |
| D | 各权限组确定性 one-pager（24h），最多 5 个低权威 insight（7d）；自身偏好进入 `profile_slots.pending_confirmation` | one-pager 即使无模型预算也生成；insight 不回灌 durable 真值；来源 id 必须来自同权限组；local_only 与未明确选源的 user_selected 不发到外部模型 |
| E | action_item/open_question 形成 attention 候选（7d），明确日期的未来 event 保留至事件日结束 | 只落候选，不发消息或执行动作；实际 attention 产品投递由后续工作流消费 |

B 默认每用户每晚最多 120 调用、120,000 token 预留上界；C 为 60 调用、60,000 token；D 最多 5 次 insight、12,000 token。A–E 新阶段的合计默认上界 192,000；按 B→C 顺序分配，A 永不停。`reconcile_nightly_budgets` 的预留先于调用且持久化，失败调用不返还，禁用 provider fallback/重试以免跨预算放大。预留按 prompt UTF-8 字节数加输出上限计算，是保守上界；真实调用由 `usage_events` 的 `reconcile_b/c/d` feature 归属统计。

预算参数为 `RECONCILE_LLM_BUDGET_PER_NIGHT`、`RECONCILE_C_PAIRS_PER_NIGHT`、`RECONCILE_B_TOKEN_CAP`、`RECONCILE_C_TOKEN_CAP`、`RECONCILE_TOTAL_TOKEN_CAP`。B/C 优先使用 `RECONCILE_CHEAP_TARGET=provider/model`，否则复用 `MEMORY_EXTRACTION_LLM_FALLBACKS` 首个已配置目标；无低成本配置时才使用主模型。`RECONCILE_CHEAP_MODEL` 保留为当前 provider 的显式模型覆盖。模型资格包含 provider/model，更换任何一项均需重新人工验证。要求推理的既有 GLM/Kimi 目标使用 minimal 与 2048 输出上限，其他目标使用 none 与 768，预留包含完整上限；禁用重试和 fallback。D 使用现有主模型。

### Shadow → live 与回滚

`RECONCILE_B_MODE=live` / `RECONCILE_C_MODE=live` 本身不能跳过资格门：同 owner/tenant、当前模型须有至少 50 对不同 pair 的人工 shadow 标签，一致率 >=.85；C 还须至少 15 对 both-valid，误判 <=.1。更换模型后重新资格验证。使用 `memory-service/tools/review-sleep-reconciliation.ts review <db> <labels.json> <reviewer>` 导入人工标签，labels 格式为 `[{"decisionId":"...","expectedDecision":"noop"}]`。合成 eval 标签绝不写入生产。

所有 status 变更经 `UnitTruthMaintainer` 的 `BEGIN IMMEDIATE`/revision 校验，原子提交决策、before/after snapshot、revision 与 projection outbox；证据资格/ACL 改变或 revision 过期则标 stale。`supersede` 不改原文，推断不能覆盖一手来源，用户确认事实不会自动被替代。`refine` 保留互补双方；`corroborate` 仅对新增 evidence 且独立 family 加固，重复作者不加置信度。重要争议的确认请求有 `keep_old/keep_new/both_valid` 三种回答，用户选择写入可审计的新 revision。

关闭阶段开关停止后续工作；`review-sleep-reconciliation.ts revert <db> <decision-id>` 可在后续 revision 未变时恢复状态、confidence、有效期和派生来源拷贝；revision 仍单调递增，原始 source 与 episode 不删除。

Memory Explorer 的“梦境重放”页展示夜间整理回执：较早/较新值、来源数量和原文时间线入口；shadow 明确标为“未改真值”。已应用且没有后续修订的判决可“撤销这次整理”，版本变更返回 409。这里是操作记录，不要求用户逐条审核内部整理。长期自身偏好单独显示待确认提案，确认后才激活 profile slot、产生用户修订并进入同 scope 的回答偏好；拒绝不会每晚重建同一提案。

上线人工验收可在同页导出当前模型的更新/矛盾样本。每组最多 50 个不同 pair，隐藏模型判决、`expectedDecision` 留空，附支持片段和有效来源分类。文件含私人内容，只在本地保管，不提交仓库或作为公开附件。填完由操作员通过上述 CLI 导入，导入不会自动切 live。`GET /api/v1/reconciliation`、`/samples?phase=B|C`、`/profiles` 按当前用户隔离，restricted 来源不从该普通面显示。profile 确认与 receipt 回滚均使用版本检查的 POST 端点。

### 遗忘与读取

A 开启后，实体锚定 semantic preference/fact 的 metadata salience 最低 .15，只归档为 `archive_only`；procedural 不按时间衰减。关联的原始 message/chunk 也受到保护。其他 episodic 保持原策略；不自动复活历史软删条目，不覆盖 privacy_delete。`FORGETTING_KIND_POLICY=off` 可恢复旧衰减。

`MEMORY_READ_TWO_LANES=true` 接入 ActiveRecallService（Ask/主动 recall）与 ContextRecallService（Lens/被动面）。主动快车道为实体+alias、lexical、最多一个 e5 dense 和 RRF，无在线 LLM；e5 冷启动/读取有 400ms 降级期限，按进程 single-flight 加载。v3 无命中时 legacy 也仅补 FTS，不启动第二 dense 模型。Passive 的 v3 补充只用确定性实体/lexical，不启动模型、不升级深车道，也不展示 archived 生命周期 unit。当前面过滤关联已 superseded/retracted 等 unit 的原文；完整执行 owner、scope、sensitivity、evidence-class、有效期及状态门，再截断 Top-K。明确问女儿时不混入已知儿子的偏好。

深车道进行有界拆问/时间词扩展，最多两跳、每跳 20 个实体、最多 100 个 unit；中间实体必须具有同策略下可读证据。对已批准发往模型的最多 20 个候选做一次低成本重排，3s 超时、无重试/目标 fallback；输出必须是原候选的唯一完整排列，异常保留确定性顺序。`MEMORY_DEEP_RERANKER=false` 关闭重排，`MEMORY_DEEP_RERANK_MODEL` 可覆盖模型。

A 开启后 OnlineReflection 持久计数每 5 次交互抽样 1 次，并关闭 ingestion 内联 merge；D 开启后偏好候选交给 nightly profile proposal。反思研究循环不在本任务恢复。

### 证据与验证

2026-10-13 生产只读基线：2,571 units、142 组同 key 多值（legacy property 73 组）、近 24h 新旧配对 18 组。统计中三年以上 preference unit metadata 软删为 0；这不能证明旧 episode 没被软删，或真实三年偏好存量充足。基线见 `memory-service/evals/sleep-time-reconciliation/phase0.json`。

确定性 suite 位于 `memory-service/src/__tests__/sleepReconciliation.test.ts` 和 `evals/cases/sleep-time-reconciliation/`；真实配置模型的 50 对匿名场景结果见 `memory-service/evals/sleep-time-reconciliation/quality-report.json`，覆盖最新值、互补和来源权威。六能力报告的本地服务将回答超时预算设为 60s，线上默认 9s 的延迟表现未由该报告证明。生产 50 对人工资格、Passive p95 <500ms、Ask 深车道率 <20% 与实际 /ask p95、每日 token 降幅需随真实 rollout 观测，不能由合成压力条件证明。源码：`SleepReconciliation.ts`、`TruthCandidatePlan.ts`、`ReconcileTruth.ts`、migration 075。执行 `npm run eval:validate`、`npm run eval:run -- --suite sleep-time-reconciliation --no-repair`、`quality.ts`，以及指向本分支的 `npm run eval:memory-abilities`。

两车道回答阶段关闭额外推理开销。同步/流式模型若返回空文本，使用现有确定性证据摘要，并明确说明模型未返回有效回答；不把空字符串作为成功答案。

`ASK_ANSWER_MODEL_TARGET=provider/model` 可显式配置回答目标，未配置仍使用原主模型。2026-10-14 rollout 使用既有 Flash 目标，未提高默认 9s 回答预算；该参数只影响回答调用。

### Rollout 可观测性

`GET /api/v1/reconciliation/metrics` 返回近七日生产读取样本、active/passive p95、深车道率、预算预留、判决状态和执行日期。read_only 评测不写生产统计；升级前 unknown 记录不用于当前 p95。Passive 记录整个 Context Recall service 链路，active 记录读取链路，不代表整个 Ask 回答耗时；最多使用最新 10,000 样本。空样本返回 null，不能用合成成绩填充。

`reconcile_nightly_runs.trigger_kind` 区分 nightly 与 manual，手动首轮不能充当七晚证据。候选扫描小批事务落库、批次间让出事件循环；统计失败不影响召回。真实人工资格、七晚成本与生产性能门槛仍须真实 rollout 观测。

当前两车道读取同时检查 message 与关联 chunk 的 unit 状态；被替代来源的旧 chunk 不会混入当前答案，历史读取仍保留。unit 回执提供原 episode 的 timeline 跳转。来源权威按实际支持 span 复核：owner/observed 消息中已标为 AI 作者的片段只能作为 system_inference，不能继承消息容器的一手权威，也不能成为 profile/attention 的唯一来源或独立来源加固。
