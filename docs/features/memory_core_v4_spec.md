# Memory Core v4：方案 B 实现规格

状态：**Stage 1 设计交付，尚未实现、未跑质量或性能验收**。版本 `B-spec-1`，2026-10-30；任务 E-145，父任务 E-141，实现接棒 E-149。文件名 v4 是实验方案名，不表示生产已升级。现有产品行为仍以 `memory_foundation.md` 为准。

## 1. 目标、约束与大白话运行逻辑

消息进来先保存原文、谁说的、什么时候说的和谁有权看，马上让它可搜；后台再整理成有出处的事实和小卡片。用户看消息时，快速找出相关旧承诺或变化，不等待大模型长思考。后台发现新情况时，先检查证据是否足够、是否已经提醒过，再决定提醒 E 还是保持安静。[U1, R1]

优先级是：**权限与当时可见性 > 来源与主体正确 > 证据足够 > 场景相关 > 新颖性和少打扰 > 排名分数**。模型摘要不是新增证据；同名不能自动合并；查不到权威状态不能宣布事情完成。内部可逆整理自主运行，长期自身画像、对外发送及跨 scope 操作另走责任边界。首轮全部行动写入记录型 sink，不真实发信。[R1, C1, J]

- 五条平行方案 A 现有 / B 本规格 / C Mem0 OSS / D Supermemory Local / E Letta；B 不迁移或覆盖生产库，只在隔离实验数据库实现 adapter。[U1]
- 用生产原文 T3、本地自托管；正文及含原文的 DB、向量、日志、导出、模型缓存不进远端 Git，也不上传任务附件。可提交本规格、合成样例、无正文配置与汇总。自选 LLM API 仍须逐项遵守来源 egress policy；自托管记忆不等于数据可任意外发。[U1, C1, J]
- 验收仅 `message_sidecar` 与 `proactive_discovery`；`meeting_transcript`、`proactive_ask` 只打标，不能以四场景总平均替代首轮结果。每方案全部评测累计 LLM 费用 ≤$50，包含三次建库、重试、整理、消融、embedding/rerank 的收费调用；不是每次运行重置 $50。[U1, J]
- SQLite + FTS + 本地向量索引 + 边表；无图数据库、无完整 UI、无 iOS、无生产 webhook 实现。Webhook/浏览器/回放适配为同一事件契约，本实验只消费冻结事件。[U1, R1]

## 2. 证据基线与来源标签

文中每节的标签适用于该节全部设计条款；`J` 表示本规格的工程判断/待测默认值，不是已有功能或行业实测结论。

| 标签 | 来源、作者、日期与位置 | 使用边界 |
|---|---|---|
| U1 | E 在 E-141 的 2026-10-30 决策；E-145 当前任务说明；[父任务](mention://issue/01a18b8f-6663-7c0e-8ec7-30236769f9c6) | 用户约束优先于早期三方案/T1 建议 |
| R1 | Memory 顾问 6-Astra，E-141「选型/架构/四场景评测」评论，2026-10-30，同上父任务 | 架构与预算原案；延迟、质量均是目标 |
| R2 | 查证员 composer，E-141 数据盘点/webhook 报告及 Phase 0 交付，2026-10-30；`memory-service/evals/personal-memory-dataset/phase0-prod-esone.qiu-2026-10-30.json` | 生产快照证据，不能等同当前在线服务状态 |
| R3 | 极致交互原型师 Opus，E-141 决策页，2026-10-30；`docs/progressing/e141-memory-core-decision-demo.html` | 信息展示，预算占位与早期选项由 U1 覆盖 |
| C1 | Personal AI 维护者，`docs/features/memory_foundation.md`、`memory-service/src/core/WriteProvenanceGate.ts`、`core/v3/ExtractionContract.ts`、`UnitTruthMaintainer.ts`、`SleepReconciliation.ts`、`UnitRecallReader.ts`（均在 memory-service/src 下） | 本轮读取仓库 HEAD `59adc4e`；实现存在不等于生产启用 |
| H1 | E-144 工作区草稿，`experiments/memory-benchmark/src/types.ts`、`scoring/probe-runner.ts`（位于同一 src）、README；E-143 `memory-service/evals/personal-memory-dataset/schema.json` | 并行任务中的可变接口，Stage 2 冻结实际 commit/hash |
| J | Memory 顾问，本规格，2026-10-30 | 为可实现性选定的默认上限、schema 与失败语义，开发集验证后冻结 |

以上材料访问日期均为 2026-10-30。本规格不重新宣称第三方产品现状或 webhook 权限细节，不依赖未经复核的厂商性能。R2 快照记录 raw 14,610、Glip 11,775、至少两条消息的 storyline 197、迁移 066 且无 v3 表；mtime 为 2026-09-11，不能用它证明今天的生产新鲜度。48 条 Glip 时间为零、历史空来源需要隔离或标记修复；不能补成“当前发生”。C1 的生产历史描述与 R2 快照不一致，实验以冻结导出 manifest 的实际表/列为准。

## 3. 数据模型与不变量

以下为逻辑 schema，Stage 2 可映射现有表，但必须通过相同不变量。时间对外 ISO UTC，内部 int64 epoch 毫秒；复用 v3 秒级 API 时显式转换并测试。缺失时间为 null，不用 0 伪造。所有表按 `owner_id + tenant_id` 隔离；初版独立 DB 加查询校验双保险。[C1, J]

### 3.1 最小记录

| 表/对象 | 必需字段与语义 |
|---|---|
| `evidence_events` 原始证据账本 | `event_id`（稳定源对象 ID）、`source_version`（不可变版本）、`source/source_type`、`op=upsert/delete`、`content_hash`、`body_ref`、`occurred_at`、`observed_at`、`ingest_seq`、`owner_id/tenant_id`、`speaker`、`subject`（未知可 null）、`scope`、`acl_id/acl_version`、`origin_class/session_kind/origin_family/promotion_eligible`、`parent_refs[]`、`model_version`（原文 null）、`timestamp_quality` |
| `fact_revisions` 版本化事实 | `fact_id/revision`、`subject/predicate/object`、`assertion_class`、`status=candidate/active/disputed/superseded/retracted`、`occurred_at/observed_at`、`valid_from/valid_to`、`known_from/known_to`、`scope/ACL`、`evidence_refs[]`、`parent_refs[]`、`model_version/prompt_version/policy_version`、`verified_by/verified_at`（未验证 null）、`confidence`（不得代替证据等级） |
| `artifacts` 派生产物 | `artifact_id/revision/type`（summary/insight/commitment_card/change_card/neighborhood）、`subject/entity_ids[]`、`text`、`occurred_at/observed_at`、`valid_from/to`、`known_from/to`、`scope/ACL`、`evidence_refs[]`、`parent_refs[]`、`model_version/prompt_version/policy_version`、`input_watermark/input_hash`、`expires_at`、`status` |
| `evidence_refs` | `ref_id`、目标 fact/artifact 与 revision、`event_id/source_version`、`span_start/span_end`、`span_hash`、`relation=supports/refutes/context`；偏移是持久化原文 UTF-8 字节半开区间，不是 JS 字符下标 |
| `entity_edges` | `edge_id`、`from/to`、`type`（member_of/about/mentions/commitment_for/synonym_of）、`scope/ACL`、`valid_from/to`、`known_from/to`、`evidence_refs[]`、`parent_refs[]`、`revision`、`model_version` |
| `jobs/receipts` | `job_key/kind/status`、`input_hash/watermark`、`policy/model/prompt_version`、`attempt`、真实时钟 lease/deadline、虚拟执行时点、费用预留/结算、输出 revisions、`reason/next_trigger` |
| `decision_outbox` | `decision_id/idempotency_key`、`scene/target`、`action/status`、`evidence_refs[]`、`reason_codes`、`value/novelty`、`created_at_virtual`、`expires_at`、`scope/acl_version`、`delivery_receipt` |

`parent_refs` 显式携带 `{kind,id,revision}`，形成可追踪 DAG；证据叶子只能是原始事件版本。派生物的 `observed_at` 是产物产生的虚拟时间，至少为所有父项 observed_at 的最大值；不得回填到最早证据时刻。`occurred_at` 可为所描述事件时间或 null，不能用作可见性门。[R1, J]

### 3.2 等级、时间与冲突

| 等级 | 允许用途 | 禁止晋升方式 |
|---|---|---|
| observation | “某来源在某时说/记录了 X”，可原文检索 | 第三人发言自动变成 E 的偏好 |
| self_statement 自述 | 已确认 speaker=subject=E 的直接表述；保留时间和语境 | 转述、引用 AI、发送者身份未知不得归为自述 |
| hypothesis | 系统推断的风险/联系；内部待查，可明确以疑问表达 | 重复思考、摘要复述、模型 confidence 高都不能变 verified |
| verified_fact | 有匹配命题/时点的授权权威读回或显式用户确认，记录验证者及 span | 单凭多个转述或同作者重复；把“Ticket 完成”扩展成“项目已交付” |

这些是证据类型，不是必须依次升级的阶梯。来源资格由确定性代码产生，LLM 不得写 ACL、owner 或 promotion_eligible。网页和 AI 产物可检索，但不自动成为长期自身事实。长期画像先写 pending proposal，等待显式确认；内部卡片不要求逐条人工批准。[C1, R1, J]

- 当前事实条件：`observed_at ≤ as_of` 且 `known_from ≤ as_of < known_to`，同时 `valid_from ≤ valid_at < valid_to`；null 上/下界分别为正/负无穷。默认 `valid_at=as_of`。原文是证据记录，不因其命题 valid_to 过去而删除，但输出必须注明历史。
- 修订追加，不覆盖证据；关闭旧 revision 的 known_to 并追加新 revision。已知旧状态在过去检查点仍可读。新证据不能按发生时间提前进入历史答案。
- 同槽为 owner/tenant/scope/subject/predicate；只有明确修正或合格来源支持才 supersede。互补时 refine 保留双方，矛盾未解则 disputed，用户已确认事实不得自动覆盖。同名异人保持分离。
- 删除/撤权优先于历史重建：当前已撤权的内容，即使 as_of 在撤权前也不得向当前调用者返回。评测过去状态使用当时隔离检查点，不能借时间参数绕过当前 ACL。

### 3.3 幂等、索引与删除

`UNIQUE(owner_id,source,event_id,source_version)`。同 key 同 hash 返回既有回执；同 key 不同 hash 报 `VERSION_CONFLICT`，不得静默覆盖。数据集无 source_version 时由冻结 `provenance.source_version` 优先、否则 `sha256(body+source metadata)` 生成；不要把 observed_at 纳入内容 hash。迟到版本按源版本顺序比较；无法确定顺序的不同内容并存 disputed，不用到达顺序假装修订顺序。[H1, J]

建立 `(owner,scope,observed_at,ingest_seq)`、`(subject,predicate,scope)`、事实双时间区间、`(event_id,source_version)` 反向依赖索引。FTS 使用按字/词确定性多语言预处理，向量模型及维度在 manifest 冻结。FTS 与向量只存可映射到证据的 ID；向量先按授权候选分区/过滤再排名，不能将越权正文交重排器。

删除事务先置不可见 tombstone，提升 ACL/source epoch、使全部后代 dirty，清近期缓存、FTS、向量和未发送 outbox。派生物多源支持时先隔离整个旧产物，再仅用剩余证据重算；不能只删引用而保留已泄露的摘要。物理清除异步可重试，`delete/revoke` 返回前必须完成逻辑屏障。进行中的任务提交前复查 epoch，过期结果丢弃。正文擦除与不可逆 hash 回执区分；不允许 export 从审计旧正文绕过删除。

## 4. 轻写入路径

路径：校验 envelope/授权 → 保存原文版本、tombstone 与 outbox 单事务 → 确定性 FTS 与近期索引 → 确认 durable 回执 → 异步 embedding/整理。接收事件不调用生成式模型；embedding 失败不阻塞原文检索。[R1, J]

近期缓存按 owner/scope 保存最近 24 虚拟小时、至多 1,000 个事件 ID（不复制无权限正文），底层索引可回查更老事件。容量是有界内存默认，不是数据保留期。未整理原文同时参与 FTS/近期召回，标 `unconsolidated`；可展示“某人说过”，不可冒充已核验事实。原文入库至可搜 p95 ≤5s、整理后事实至可搜目标 p95 ≤60s；每日批处理另报 backlog，不把等待到夜间的时间从新鲜度中扣掉。

`ingest()` await 至原文/FTS 可读屏障；向量与事实有独立水位。崩溃后靠 outbox 重放补索引，重复摄入不会新增事实或增加证据权重。实现必须导出 ingest/raw_index/vec_index/consolidated 四个水位和队列年龄。

## 5. 慢整理：固定流程与受限取证

固定阶段：增量选源 → v3 严格原子抽取 → 来源/主体/span 校验 → 确定性消歧 → 同槽冲突比较 → 必要时只读取证 → CAS 提交 revisions → 有界卡片/边计算 → 提醒候选。每批至多 100 条事件，CPU/事务分块，检索优先；无新增输入及无到期任务直接 no-op。[C1, R1, J]

- 去重键 `owner+scope+phase+sorted(input version IDs)+policy_version+model_version+prompt_version`。模型/策略变化可显式安排一次重建；不得每次 consolidate 都换随机键。
- 一道待解决问题最多 **3 次只读工具调用、总墙钟 ≤60s**，包含模型和工具等待。并行调用也逐次计数，重试也计数；问题指稳定 subject/predicate/evidence fingerprint，不得拆成新问题绕预算。共享全方案费用硬门。
- 工具 allowlist 为按 as_of 查询证据、实体、权威 fixture；禁止任意 shell、网络导航、写操作和真实 Ticket 当前状态。原文中的指令仅为数据，不可扩展工具权限。
- 工具返回必须重新作为 observation 入账，保存来源/查询时点/span；授权权威结果可支持 verified_fact，不能只凭工具名称升级。超时、not_found、forbidden、无证据分别记录，均不得视为否定事实。
- 预算/超时输出 unresolved + 缺口 + next_trigger；同输入失败不自动反复重跑。仅新证据、显式预算变更或已声明到期任务允许再试。到期任务先做确定性检查，不因“又过了一夜”无限调用 LLM。
- `consolidate(virtualNow)` 驱动虚拟日调度，每日最多一个日任务；增量步骤必须结束或显式标 incomplete 后建立探针屏障。三轮无新证据：fact 数、置信度、通知数不增，模型调用应为 0（不含显式到期取证）。
- 业务时间管 valid/known、衰减、冷却与期限；真实单调时钟管耗时、租约和超时。不得只缩短 cron 冒充七夜回放。

调用前预留最坏 token 费用，结算实际费用后释放差额；预留 + 已花费超出 B 剩余 $50 即拒绝调用，未知价格 fail closed。记录 provider/model、价格快照、tokens、缓存复播标签、每千事件/日整理/百查询成本。默认禁用隐式 provider fallback 与无限 retry。到上限停止重推理并报告未完成，允许无模型的 raw recall 继续，但不得据此宣布 B 验收完成。[U1, C1, J]

## 6. 预计算关联与缓存

实体键使用 `type + source namespace + stable ID`，四类：人、项目、Ticket、会议。没有稳定 ID 时只做 scope 内候选，不按名字全库合并。每实体一跳邻域最多 32 条边，优先未决承诺和最近变化、再按有效时间排序，ID 作稳定 tie-break；二跳仅显式 Ticket↔project/person 链，最多 16 个新增节点、合计 64 节点，禁止全库两两关联。[R1, J]

- 未决承诺卡：谁承诺什么、关联对象、原始 due_at、状态 open/done/cancelled/disputed/unknown、最近验证时点、证据 span；逾期不等于违约，未提到不等于完成。
- 最近变化卡：同槽 before/after、有效时点、获知时点、更正/反驳来源、待解冲突；只有更晚获知但内容相同不构成变化。
- 摘要与卡片只汇总有权看到的证据。混合 scope 产物取权限交集，初版直接禁止跨 scope 生成；公开来源不能洗白私密派生内容。

缓存键：`owner/tenant/scope + acl_epoch + entity_or_query_hash + as_of_checkpoint + source_watermark + artifact_revision + policy/prompt/model/embedding_version + retrieval_config_hash`。查询归一化不得删掉否定、主体、Ticket ID 与时间约束。TTL 默认 5 虚拟分钟且不得超过父事实有效期/卡片 expires_at；TTL 只管新鲜度，不管权限。

新增证据只令依赖该实体/槽的卡片 dirty；修改、删除、撤权、实体消歧、有效期到期、模型/策略升级同步提升对应 epoch 并失效。读时与返回前都复核 ACL/依赖版本；版本变化则丢弃结果或重取，不输出旧缓存。重算失败退回授权原文卡，不继续显示 stale 事实。缓存命中和未命中分别测量。

## 7. 快速提取：250ms 服务端预算

服务端计时从请求进入（含排队）至证据结果装配完成；目标 **p95 ≤250ms、p99 ≤500ms**，不是生成答案预算。本地已有卡可见 p95 ≤100ms、固定 LAN 消息事件至卡可见 p95 ≤500ms 由产品层另测，adapter 通过不能证明 UI 达标。[R1, J]

| 阶段 | 预算 | 失败/降级 |
|---|---:|---|
| 入队、身份/ACL、as_of 快照 | 20ms | 权限不明拒绝；队列满报 overload |
| query 解析、本地多语言 embedding | 40ms | 超时只走实体/词法，不等待云端 |
| 并行召回 | 80ms | 单支超时取消，保留其他授权候选 |
| RRF 融合、可选短列表重排 | 60ms | 默认关闭重排；超时回 RRF |
| 证据/时间/ACL 二次校验和装配 | 20ms | 校验失败删除候选，不以降级绕门 |
| 余量 | 30ms | 总 deadline 到即返回已完成部分/空结果和 reason |

四支并行：FTS top40、dense top40、实体邻域/卡 top32、近期相关原文 top20。近期通道也须实体/词法匹配，不能仅因新就上屏。各支先过滤 owner/scope/observed/valid/status，按同一证据或事实 revision 去重，`RRF(d)=Σ 1/(60+rank_i(d))`，rank 从 1 开始；返回 top5。相同原文的 chunk/摘要不多次计票，独立证据计数也不能用通道数代替。[J]

默认不使用生成式重排。开关 `rerank=off|local`；local 最多 top20、≤40ms（占上述60ms），保持权限与时序硬门，仅排序。模型/维度/文本切分/索引版本冻结。只有开发集 Recall@5 或提示 precision 改善且 p95 仍达标，才可冻结为开启，验收集不能调阈值。冷启动、热缓存、未命中、并发整理分别报告 1万/10万单元、并发1/5的 p50/p95/p99；生产约1.5万 raw 与检索单元数不可混称。

深解释可异步生成，目标 p95 ≤3s，失败保留证据卡；不属于 Stage 2 最低要求。旧场景请求使用 scene_id 取消/丢弃，不能将前一个 Ticket 的卡贴到新消息旁。

## 8. 提醒决策与行动出口

首轮采用可解释规则，不让 LLM 自定发信权。[R1, C1, J]

1. 硬门：当时可见且当前授权、span 有效、主体明确、命题未被撤销、场景匹配、证据等级适当；未知身份/高风险冲突转 unresolved，不断言。
2. 价值：`V=0.5 relevance+0.3 actionability+0.2 urgency`，各项范围0..1。relevance：稳定实体/明确同线程=1，获准邻域=.5，无匹配=0；actionability：有明确影响/待执行承诺=1，仅背景=.5，无影响=0；urgency：已到期或24虚拟小时内=1，7日内=.5，其他/未知=0。默认 sidecar V≥.5、discovery V≥.7；仅开发集可调。
3. 新颖性：规范化 subject/predicate/value/valid interval 与上次已发送版本比较。新增独立支持但无决策变化可刷新卡，不另发通知；新值、真实新风险或明确重新打开才是新发现。摘要改写、模型换版不是新发现。
4. 证据：在旁提示可引用 observation 并保留“某人说”；发现类确定断言需 verified_fact，或可逐字追踪到直接来源的明确事实。推断只能按假设表述，不能用模糊风险刷 discovery 正例；没充分证据默认沉默。
5. 冷却：键 `owner/scope/target/scene/subject/predicate/change_fingerprint`。同卡在同场景会话只展示一次；同语义提醒24虚拟小时不重发。实质反向变化可新建 fingerprint，但仍受每日最多3条主动提醒的初始上限约束。两阈值是待验证默认值。

每次输出 decision receipt：`show/silence/defer/ask`、reason（no_evidence/low_value/duplicate/cooldown/acl_denied/budget/expired 等）、证据版本、分项值、目标和策略版本。没有输出也要能解释。[J]

行动状态 `proposed → queued → recorded`（实验），生产未来才有 sent/failed；冷却只因有效展示/已记录送达更新，失败重试沿用同一幂等键。outbox 与决定原子提交，sink 去重；发送前再次检查版本/ACL/到期。默认目标 **E**，contact_peer 一律拒绝，proactive_ask 首轮只记录候选；不能把“允许用现有消息通道验证”理解为给同事自动发信授权。Stage 2 不持有真实发信凭证。[U1, R1, J]

## 9. 与现有实现的复用边界

| 模块 | 复用策略 | B 必须补齐/重写 |
|---|---|---|
| v3 `ExtractionContract.ts` | 直接复用原子候选类型、严格解析、0候选成功语义 | 外层加入等级/双时间/版本字段；不可向旧严格 parser 塞新字段；UTF-8 span 用实际持久化内容复核，截断偏移映射明确 |
| `WriteProvenanceGate.ts` | 直接复用 classifyWrite、origin family、来源资格门逻辑 | 以可信导入 metadata/sender 映射调用，不能让模型伪造 owner；不默认 importBatchId 的 untrusted 自动晋升 |
| `UnitTruthMaintainer.ts` | 复用同槽比较、CAS revision、来源验证、事务/outbox 语义 | 原有 schema 不直接满足 event version/双时间，实验存储 facade 补齐；不要复制一套放宽资格的 truth 入口 |
| `SleepReconciliation.ts`、`ReconcileTruth.ts` | 复用确定性消歧、冲突决策 vocabulary、来源独立性、阶段流程与资格保护 | 重写实验调度/clock/预算/账本适配；不原样调用其生产 attention 副作用；完成时间 Date.now 与业务时间拆开 |
| `EpisodeRepository.ts` | 复用 DTO 规范和 span 来源访问思路 | 当前按 raw id 读、无 source_version，改为实验版本化 EvidenceReader |
| `UnitRecallReader.ts`、现有 FTS/vec | 复用本地索引适配和权限判定思路 | 重写四支有界召回、RRF、快路径 deadline；current 分支 Date.now 改注入 as_of，不能只改参数名 |
| Attention / 通知 / profile | 可参考资格和去重规则 | B 独立决定/outbox/sink；禁止连接生产通知或自动激活画像 |

“直接复用”指满足契约的纯逻辑/API；带生产 SQL/副作用的类只能经隔离 facade 使用。若为 import 一个类需要启动整个生产服务，改提取适配或局部等价实现，并记录差异，不引入整套产品依赖。既有 shadow 人工资格门不能为了拿分静默跳过；未满足资格的裁决保持 shadow，报告实际激活能力。B 的新实验策略若独立评测，应显式版本化，与“复用了生产 live 裁决”区分。[C1, J]

## 10. Harness 接口清单与接棒约定

外部接口以 E-144 冻结的 `MemoryBenchmarkAdapter` 为准，本规格不另造必需 HTTP 服务。`schemeId='B'`；实例构造注入 `owner/tenant/run_id/db_path/clock/authorityFixture/costLedger/sink/config`；各 run DB 隔离，费用账本跨 B 的 run 共享。[H1, J]

| 接口（现有签名） | B 输入/输出义务 |
|---|---|
| `ingest(event): Promise<void>` | 按 PersonalMemoryEvent 接收，provenance 放版本/来源补充；scope 与 acl.scope 不一致拒绝；await 原文屏障，重复 no-op |
| `consolidate(virtualNow): Promise<ConsolidateResult>` | 只使用该虚拟时点可见输入；返回 virtual_day、真实 latency_ms、cached_replay；详情在 export.receipts，未完成不能伪造成功 |
| `recall(query,asOf,scope): Promise<RecallResult>` | query.scope 与 scope 不一致报 INVALID_SCOPE；hits≤5，含原始 event_id/text/observed_at/scope，派生命中映射证据叶子；latency_ms 实测 |
| `decide(input): Promise<DecideResult>` | scene/as_of/scope + 真实 context；返回 action/output_text/cited_event_ids/latency_ms；默认 silence，通知仅 sink；引用需可回溯 span |
| `export(): Promise<Record<string,unknown>>` | schema/config/version、原文版本/事实/产物/边/refs、各水位、receipts、成本和决策，可携带本地正文；当前删除/撤权内容不导出；只存本地受保护目录 |
| `delete(eventId): Promise<void>` | 删除该稳定事件全部版本及后代逻辑屏障；幂等、记录 tombstone、防止原事件重放复活 |
| `revoke(scope): Promise<void>` | 此 scope 本实例撤权屏障，幂等；无公开 regrant 接口，不隐式恢复 |

内部最少 seams：`EvidenceReader.at(as_of,scope)`、`FactStore.compareAndAppend(expectedRevision)`、`Clock.businessNow/monotonicNow`、`AuthorityReader.read(question,as_of)`、`Budget.reserve/settle`、`CardCache.invalidate(dependency)`、`ActionSink.record(idempotencyKey)`。不要求全部拆包，但必须可替换测试。[J]

### 10.1 现有 harness 草稿的接入风险

2026-10-30 读取 H1 工作区草稿时发现以下问题；是待冻结契约的核对项，不宣称 E-144 最终仍有这些缺陷。本任务不修改 harness。[H1, J]

- `probe-runner.ts` 将 expected_silence、required_facts、visible_evidence_ids 放入 decide.context，并用 required_facts 构造 query；stub 读取它们。这只适合 plumbing smoke。B 必须白名单仅读 `scene_id/text/entity_ids/thread_id` 等实际场景输入，严禁读取 golden；没有真实 scene payload 返回 INVALID_SCENE_CONTEXT，不用答案拼 query。正式验收必须由 harness 提供独立场景 fixture，golden 仅 scorer 可见。
- 草稿先完成全部 runVirtualReplay 再遍历 checkpoints；单纯 observed_at 过滤不能防止未来整理产物、冷却与撤权状态污染。正式运行须在每个检查点立刻 probe，或恢复完整 DB/索引/缓存/outbox snapshot；B 的 known_from/to 是第二道防线，不能替代正确回放顺序。
- 草稿成本默认按 run 计，B 必须共享累计账本且模型调用前预留；不能只在 probe 前检查已花费。`passed` 不可仅看 composite≥0；正式验收执行第11节场景门槛。
- 现有 RecallHit 不含 span/revision、DecideResult 不含 target/reason，补充信息可放 export 的按 request/decision ID traces，并保留实际 target=E；正式证据评分读取这些 traces，不能只检测 cited_event_ids 存在。

这些接缝未满足时，Stage 2 可以交付合成 contract smoke，但不得进入正式质量排名。Stage 2 实现者应在冻结版本中逐项确认，不能修改 golden 来适配 B。

## 11. 验收清单

以下是实现者需要运行的检查，不是本次已通过结果。合成安全门先行，随后真实数据经验评测；合成通过不等同真实质量。[U1, R1, J]

| 门 | 可操作验收与成功条件 |
|---|---|
| 事件幂等/版本 | 同事件重复3次只一版本/一次索引；同版本异文冲突；改文新版本可追溯，旧事实在当前查询不伪装最新 |
| 原文即时可搜 | 禁用抽取/embedding 仍能 FTS 召回刚摄入消息；新鲜度报告 p95 与索引水位，故障重启 outbox 可补齐 |
| 来源与主体 | AI复述、同作者转发、同名他人、不明 sender 不增长独立支持、不成为 E 的自述/画像；纯背景整理不晋升 |
| 双时间/未来泄漏 | 日2获知日1发生的事件，日1 probe 不可见；日3完成、日4重开在各检查点返回正确状态；卡片/边/缓存也不提前可见 |
| span 与冲突 | 中文/emoji UTF-8 span 精确匹配持久化源；错 span 拒绝；互补共存、矛盾 disputed；用户确认事实不自动覆盖 |
| 预算与空转 | 每问题≤3工具/≤60s墙钟；超时留 unresolved；三轮无新输入0模型调用/0新增提醒；预留使累计费用不越$50 |
| 有界关联 | 同名不同项目不连；候选数符合32/16/64上限；新增关联只失效相应依赖 |
| 撤权删除并发 | 预热缓存后删源/撤scope；recall/decide/export/outbox 全部无禁止内容；在途整理提交被epoch挡住；重放事件不复活 |
| 行动出口 | 所有动作只进 sink、target E；无 contact_peer/生产外发；相同fingerprint不重发；失败重试同一幂等键 |
| 性能 | 固定硬件/索引/模型记录冷热/并发/整理中 p50/p95/p99；服务器目标p95≤250ms/p99≤500ms，超时与失败计入分母 |
| Harness 公平性 | 不读 golden；当前检查点执行；raw-only 主赛，include-derived 单独消融；任何脚本/模型缓存复播另报，不冒充重新推理 |
| 可移植与复现 | export 保留 lineage/version/ACL/模型配置；新隔离实例恢复后同一确定性查询证据ID相同；三次建库使用相同manifest，实际推理波动报告 |

首轮真实验收采用冻结160判定点集中的两类（建议各40点、正负各20，其余80只打标）；如 golden 实际分布不同，预先冻结并报告。按 storyline 分开发/验收集，不把近重复线程拆两边；按 storyline bootstrap 报95%区间，不把小样本点估计当稳定线上指标。[R1, U1, J]

- 在旁提醒：precision≥90%、应提示 recall≥80%、证据 Recall@5≥85%；端到端可见 p95≤500ms 必须在产品壳测试，adapter-only 报未测。
- 主动发现：precision≥90%、机会 recall≥70%、重复通知≤5%，证据齐备后一个整理周期内作决定；无输出不能以0延迟或0重复算通过。
- 每场景 `S=100×(.30F+.25E+.25D+.10N+.10L)` ≥80 且同时满足以上门。F=事实precision/recall F1（含主体/时间），E=证据支持precision/覆盖recall F1，D=触发balanced accuracy，N=去重有效输出占比，L=满足窗口比例；正确沉默负例的F/E/N=1，正例无输出为0。不得用平均掩盖不达标场景。
- 硬失败：未来证据、越权、删除后泄露、未经授权外发；出现一次即失败。另做人工盲审语义支持、错误主体和遗漏证据，不能只有 substring 评分。
- 消融至少关闭预计算、关闭慢整理、关闭dense（可另加rerank），同一冻结开发配置与费用账本；不足预算就报告未完成，不挑最好一次作为最终结果。

## 12. 风险、停止条件与交付边界

推荐先按本规格做 B 的最小 adapter，置信度：架构边界高、250ms和提醒质量能否同时达到中低，必须实验验证。主要反对理由是版本/失效账本增加实现成本，且复用现有 SQL 类可能拖入生产依赖；因此不先迁移生产、不引入图数据库。[J]

若本地 embedding 或索引不能在实际数据量达到延迟预算，先保留词法/实体退路并如实报告召回损失；若预计算消融无收益则删去重预计算；若 B 对 A 的质量/成本无明确收益，维持 A，不以新架构名称决定替换。SQLite 写竞争、重建时间与索引规模必须实测，之后才讨论换底层。[J]

隐私风险在 T3 派生正文、模型外发和缓存日志，不只在 events.jsonl。验证 egress allowlist、独立实验身份及原文路径 gitignore；本规格附件不含生产正文。任何安全硬门失败先停正式评测，修复后重跑相关检查；预算耗尽/接口缺口标未完成。[U1, C1, J]

Stage 2 接棒交付：B adapter 与隔离存储、冻结版本manifest、合成门检查结果、实际启用/降级能力清单、调用及费用流水；只需跑通 harness，不做完整产品。完整五方案质量比较属于后续 E-155/E-156，本规格不预判赢家。
