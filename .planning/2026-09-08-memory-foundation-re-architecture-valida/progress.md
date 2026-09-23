# Progress

## 2026-09-08 Session 1-2 — 见前次记录（P0a-1 实现、部署、backfill 173 条、A5 验证、OOM 事故与恢复）

## 2026-09-08 Session 3 — P0a-2/3/4/5/6 全部实现并部署

### 代码（commit e8910bf）

- **P0a-2**：`normalizeIngestMetadata` schema-v2 扁平契约 + legacy `metadata.metadata` decoder + 服务端版本化 `PRIORITY_TO_IMPORTANCE`（low 0.3 / medium 0.5 / high 0.75 / critical 0.9）。
- **P0a-3**：修复 EmbeddingClient「失败永久缓存为不可用」bug（rejected promise replay）；指数退避 5s→cap 5min；启动 bounded warmup（3 次）；`/health` 暴露 readiness 明细（loading/attempts/lastError/nextRetryInMs）。
- **P0a-4**：migration 068（新增 window_start/repeat_count/first_seen_at/last_seen_at/scene_key_hash + bucket 索引）；`recordMatchedActivation` 改为 hour-bucket 条件 upsert（sha256 scene key），100 次同场景命中 → 1 行 repeat_count=100。UNIQUE 重建推迟到 P0b 清理（表届时整体重写）。
- **P0a-5**：`phaseReflect` 无新消息当天跳过（不再产出填充反思）；`phaseReindex` 目录列表移除 reflections/dreams；`syncThreadDocument` 不再 reindexFile（反思文档保留为 UI artifact，§8.2）。
- **P0a-6**：`GET /api/v1/diagnostics/supply`：flags 读出（MEMORY_SUPPLY_DECOUPLED/extraction/embedding）+ 实时供给缺口 + rehearsal 放大计数。

### 测试

- 新测试 9 个全过（metadata 7 + embedding readiness 2）；全量 vitest 失败集与基线完全一致（89 个历史环境失败，零新增）；tsc 干净。
- 测试自身 bug 教训：Date.now spy 递归（先 bind real 再 mock）；spy 需要 restoreAllMocks。

### 生产验证（deploy 后）

- /health：embedding readiness 正常显示，warmup 生效 loaded=true。
- /diagnostics/supply 实测：flags {decoupled: true, extraction: false, embedding: false}；last24h 116 消息 → 180 chunks；**eligibleMissingChunks=0（含 last24h）——断供已止住**。
- migration 068 由 UserContextManager 启动时自动应用。

### 待用户决策

- ~~D4~~：已执行 ✅（见 Session 4）
- ~~D5~~：已执行 ✅（见 Session 4）
- ~~INGEST_EMBEDDING_ENABLED~~：已恢复 true ✅（用户裁决）
- rehearsal 放大验证：last24h 184 行是旧代码写入；新 upsert 生效后明日观察增量应接近 0。

## 2026-09-08 Session 4 — D4/D5 执行 + eval 回归分析 + 进入 P0b

用户裁决：向量供给恢复 true；D4/D5 直接执行；P0b 数据修复/验证类工作直接开始；大量代码改进前停下换 model。

### 已执行

- `INGEST_EMBEDDING_ENABLED=true`（远程 .env 第 87 行），容器重启健康。
- D5：FTS integrity-check **通过**；Tier 1 小批次（20）补齐 15 条向量；health 200。（注意：每次 deploy 重建容器会丢 /app/scripts，需重新 docker cp）
- D4：eval 脚本增加 Bearer 认证支持（--api-key / MEMORY_EVAL_API_KEY / API_KEY，commit 4d033df）。线上跑六能力：**overall 0.944，6/6 过阈值**；唯一回归门红：knowledge_update 1.00→0.67。

### knowledge_update 回归分析（已解释，非今日改动引起）

- 基线时间 2026-06-12（断供事故前，索引仅 ~3.1k chunks，约为当前 1/4）。
- case 证据存在且比基线时更全（2026-03-03 Cursor billing→Claude Code/codex 消息已回填索引）。
- 根因：**跨语言检索缺口** —— 中文 query（许可/政策/不活跃/按用量）vs 英文源文档（billing/token/credit usage），FTS 词法无重叠，MiniLM 跨语言弱；FTS 通道被中文 AI 资讯噪声（score 0.917）刷屏。英文关键词可以召回相关消息，证明可达。
- 基线 1.00 的得分来自当时的中文转述 artifact（reflection/daily 摘要），非源消息。
- 修复路径是 canonical plan 既定路线：P0c chunks_fts_tri shadow + RRF baseline、P0.5 multilingual-e5 裁决。按 §12.6 不静默改基线，保持红标可见。

### P0b 数据修复/验证（全部完成，commit d912ec4）

1. **备份 + §9.5 验证**（backup-validate.mjs）：VACUUM INTO 一致性快照 + quick/integrity/FK/FTS + 行数 parity + 随机 message→chunk→vec 恢复追踪。**首个快照抓出 9,715 条 FK 违规**（此前无任何检查发现）。
2. **rehearsal 历史清理**：1,954,209 → 1,519 行（删 1,952,692；99.8% 集中在 2026-06 事故月；30 天保留 + 2 条用户反馈行保留，与 §7.8 exposure 30 天保留一致）。
3. **孤儿行清理**：15 对 FK 关系，9,715 → 0 违规（含级联出的 memory_claim_links）。
4. **§9.5 VACUUM 替换**：1.62 GB → 612 MB（回收 ~1 GB）；fsync + rollback 文件保留至观察窗结束；重启后 smoke 全过（health 200、recall 正常、vec 无缺、supply 缺口 0）。
5. **坏时间戳**：backfill tier3 已确认 0 行。
6. **恢复演练**：快照副本 restore trace 通过 + 本次 live 替换本身即一次完整演练。

### P0b 收尾待办

- lost_and_found 三表（155k 行）：应用代码零引用、已隔离；§9.4 指纹判定需历史 schema 考古，禁止盲恢复，待专门处理。
- 事故快照保留策略清理：待定位具体所指。
- **P0b 代码项 + P0c 剩余（chunks_fts_tri shadow、RRF baseline）+ P1：大量代码改进，停在此处等用户切换 model。**

### P0b 后生产状态

- rehearsal last24h 增长待明日观察（新 upsert 应使其趋零）
- 向量供给已恢复（INGEST_EMBEDDING_ENABLED=true）
- 4 个 commit 已推送 develop（596e1bf / 5edf825 / e8910bf+4d033df / d912ec4）

## 2026-09-08 Session 5 — P0b 代码项 + P0c 完成 + P0.5 裁决 + P1 核心（用户授权直接执行）

### 完成（commit a17a3fa → c0ecac5，已推送）

- **P0b 代码**：BudgetGuard 日预算硬顶（LLM_DAILY_BUDGET_USD 全局 + per-capability 覆盖；拒绝先于 provider 调用、记录可见 budget_rejected 事件）；/health llmBudget 快照；incident-snapshot.mjs 取证 bundle + 30 份保留策略；worker retry/DLQ 由 v3 ingest_jobs 承接。
- **P0c**：migration 069 chunks_fts_tri（trigram shadow，触发器+rebuild）；RecallEngine MEMORY_FTS_TRI_SHADOW 探针（CJK 滑窗 n-gram）；old-stack baseline report（artifacts/memory-foundation/P0c/，meeting-room 查询 porter=0 vs tri=1 实证跨语言缺口）；**safe-mode shadow**（生产 /recall 强制 fts-only——recall 不准的又一根因，现按 §11.4 用 shadow 分档采集数据，I11 无强化由既有回归测试抓到并修复）。
- **P0.5**：154 probes seed gold（分层+语言配平+provenance）+ 消融 A/A_TRI/D + paired bootstrap CI：**trigram +5.2pp [2.0,9.1]**、**multilingual-e5-small +16.9pp [10.4,24.0]**（hit@5），双双重叠排除零 → e5-small 进入 P1/P2 向量模型候选路径、trigram 支持进 P2 通道；int8/bge-m3 deferred（容量不受限/doctor 窗口）；needSlots/trigger-views 维持非默认（待 P1 unit views）；e5 全量语料 15,774 段嵌入完成（chunks_vec_e5 shadow 表）。
- **P1 slice 1**（ac59d50）：migration 070 v3 truth core（memory_units/sources/revisions/views + seg/tri FTS 投影/outbox/ingest_jobs/extraction_results/truth_integrations/truth_policies）；core/v3/EpisodeRepository（span 校验+hash 漂移检测）；UnitTruthMaintainer.propose()（原子事务、I5 幂等回执、I6 evidence_key 去重+按独立 family 加权、policy v1 争议不自动覆盖、CAS）。
- **P1 slice 2**（53b6176）：strict ExtractionContract（additionalProperties=false、byte-span 校验、零候选=成功+skipReason）；ExtractionWorker（claim/lease/退避/dead_letter、冻结批次重放不重采样、evidence_class 由信封推导）；IngestionPipeline shadow enqueue（MEMORY_WRITE_V3_SHADOW 默认关）。

### 生产状态（deploy 后验证）

- v3 11 表就绪；v3_units=0（等 shadow flag 决策）；supply 缺口 0；embedding 供给 true。
- safe-mode shadow 实证：「Cursor billing policy」safe=fts-only 5 项 vs shadow 全通道有 2 个仅全通道才有的 entity 候选（数据持续采集中）。

### 待用户决策

1. **P1 rollout**（MEMORY_WRITE_V3_SHADOW=true 于 esone.qiu）：每条新消息一次 LLM 抽取调用；需要同时设定 LLM_DAILY_BUDGET_USD 预算值。plan §11.6 顺序：1 用户观察（幂等/lineage/成本）→ 5 → 25。
2. safe mode 分档策略：shadow 日志累积 1-2 天后按数据决定 RECALL_ROUTE_SAFE_MODE_ENABLED 是否按 retrievalMode 分档放开。
3. P2（dual-read + Ask/Compose/Passive 切换）开始时机。

## 2026-09-08 Session 6 — P1 全员 shadow 启用准备（网络中断挂起部署）

用户裁决：MEMORY_WRITE_V3_SHADOW 全员开启（非仅 esone.qiu）；确认 extraction LLM 消耗已入 Usage Analysis；2/3 观察期后再定。

### 完成（commit 37afa4d，本地待 push）

- **cheap 档**：`V3_EXTRACTION_LLM_FALLBACKS="provider/model,..."`——首 token 为 extraction 专属主链，其余 fallback；未设置则用默认 LLM。模块级缓存、启动日志。
- **Usage Analysis 归因**：processDueJobs 包在 usage context（capability=memory_service / feature=v3_extraction / side=backend / userId）——每次抽取调用都进 usage_events（此前会落成 user=unknown）。`v3_extraction` 加入 BACKGROUND_FEATURES 后台烧钱告警名单；可用 `LLM_DAILY_BUDGET_MEMORY_SERVICE_USD` 单独设帽。
- 测试 9/9；tsc 干净。

### 网络中断挂起项（恢复后执行）

1. `git push`（origin/develop 停在 c0ecac5，本地多 1 commit）
2. `npm run deploy:memory`
3. 远端 .env 追加：
   - `MEMORY_WRITE_V3_SHADOW=true`（全员）
   - `V3_EXTRACTION_LLM_FALLBACKS=<用户定的 cheap 档>`（待用户给值；不设则用默认 LLM）
   - `LLM_DAILY_BUDGET_USD=<用户定的硬顶>`（待用户给值）
4. 部署后验证：ingest_jobs 开始排队消化、memory_units 产生、usage dashboard 出现 v3_extraction、`/diagnostics/supply` 正常。

### 观察期检查点（答用户 2/3）

- **P1 shadow（先看 24-48h）**：ingest_jobs 无积压异常（dead_letter 率）、memory_units lineage 抽查、usage_events 中 v3_extraction 花费曲线、幂等重放测试（重跑批次不加固）。
- **safe-mode shadow（1-2 天日志）**：`docker logs | grep safe-mode-shadow` 统计 shadowOnlyCount 分布 → 决定 RECALL_ROUTE_SAFE_MODE_ENABLED 是否按 retrievalMode 分档。
- **P2 启动条件**：P1 观察数据过 §11.6 门（每个 active unit 有完整 normalized lineage、silent failure=0、replay 不加固、projection 可重建）后才开工。

## 2026-09-08 Session 7 — P1 shadow 全员上线 + 关键 NaN bug 修复

### 变量改名与配置（commit e2909a8）

- V3_EXTRACTION_LLM_FALLBACKS → **MEMORY_EXTRACTION_LLM_FALLBACKS**（用户指出：它是原子记忆抽取，非仅实体抽取）
- 修复复合模型名解析 bug：JS split('/') 会截断 `z-ai/glm-5.3-flash`，改为按首个 / 切分
- .env.example + 本地 .env 均已写入（MEMORY_EXTRACTION_LLM_FALLBACKS / MEMORY_WRITE_V3_SHADOW / LLM_DAILY_BUDGET_USD=5）
- 远端 .env 已配置并生效：shadow=true（全员）、chain=openai/z-ai/glm-5.3-flash、budget=$5

### 关键 bug：BudgetGuard NaN（部署后 30 分钟内发现并修复）

- sumBackendCostByCapabilitySince 的 SQL 行是蛇形 `est_cost_usd`，代码读驼峰 `estCostUsd` → undefined → NaN → NaN < cap 恒 false → **预算门拒绝一切 LLM 调用**且 /health 显示 spentTodayUsd=null
- 修复：store 方法内映射为驼峰；新增 budgetGuardRealStore.test.ts（真 store、无 mock，防列名漂移再次穿透 mock 测试）
- 修复后 /health：spentTodayUsd=14.7256, overBudget=true（正确且诚实）

### 端到端验证（生产实测）

- 测试消息 [p1-shadow-smoke-test] → job 创建 → claim → cheap 链 → 预算拒绝（先于 provider、不产生费用）→ job failed_retryable 且 last_error_class 可见。**整条 v3 shadow 链路已工作**。

### 运营发现（需用户知晓/决策）

1. **今天已花费 $14.7 > $5 帽**：所有 LLM 功能（ask/compose/网页被动分析）现在返回可见的预算拒绝，直到 UTC 午夜（明早 8 点 CST）或用户提高帽值。日志已见 PassiveWebpageAnalysisService 多次 500。
2. **成本异常**：memory_capture 今天 $11.4 / 570 次 backend 调用（PassiveWebpageAnalysis 网页被动分析是主力烧钱点）——建议单独设 LLM_DAILY_BUDGET_MEMORY_CAPTURE_USD 或调查该路径。
3. 已知限制：failed_retryable job 的重试目前只在下次新消息 ingest 时被驱动（piggyback）；周期性清扫循环是 P1 polish 项。

## 2026-09-08 Session 8 — 预算改 $10 + 全面降级审计 + 网页分析后端门（commit 7e8bdc8）

### 预算与降级审计（用户问题：超预算后各 LLM 功能是降级还是完全不可用）

| Surface | 超预算行为 | 评级 |
|---|---|---|
| Ask（/ask） | ✅ 优雅降级：200 + buildAskGenerationFallbackResponse（证据回执、无 LLM 合成） | 优 |
| Compose（composer-assist） | ✅ 优雅降级：buildUnavailableComposerAssistResponse（「回复助手暂未完成」） | 优 |
| Ingest 实体抽取 | ✅ extraction=null 继续；episode/chunk/FTS 照常入库 | 优 |
| v3 ExtractionWorker | ✅ job failed_retryable/dead_letter 可见；episode 完好 | 优 |
| 网页被动分析（后端路由） | ✅ 已默认关闭（403 typed）；fallback 模式下超预算=500，旧客户端按普通失败降级 | 已修复（本轮） |
| 后台任务（consolidation/weekly/reflection/storyline/anticipation/outreach 等 ~27 处） | ✅ ProactiveScheduler.safeRun 逐任务捕获记录，循环不中断，下轮重试；budget_rejected 事件全部进 usage dashboard | 可接受 |
| 嵌入（本地 ONNX） | ✅ 不走预算（零 API 费用） | N/A |

结论：**没有任何 surface 会"硬死"**；超预算 = 各自的优雅降级 + dashboard 里可见的 budget_rejected 记录。

### 网页分析（用户方向：默认禁后端，可配置 fallback）

- 前端现状确认（background.ts + docs/features/memory_capture.md 2026-08-25 决策）：**新版扩展已全部走用户本地 Key**；未配置 Key → `reason: 'llm_not_configured'` 优雅跳过（不是错误），确定性候选评分（无 LLM）照常工作，Options 显示引导条。旧版扩展仍在直连后端——$11.4/570 次的来源。
- `WEBPAGE_ANALYSIS_VIA_LOCAL_KEY`（此前从未实现，本轮落地，默认 true）：
  - true（默认）→ 后端路由 403 typed（webpage_analysis_backend_disabled + 指引），零服务端 LLM 费用
  - false → 显式重开兜底，仍受每用户 300/天配额 + 全局预算帽约束
- 生产已部署验证：403 响应实测正确；远端 .env LLM_DAILY_BUDGET_USD=10 + WEBPAGE_ANALYSIS_VIA_LOCAL_KEY=true。

## 2026-09-08 Session 9 — 三修复 + P2 slice 1 完成（commits df5f52c / e8ad913）

### 三修复（用户逐项指示）

1. **心跳排水**（用户建议方案）：HeartbeatLoop 每 15min 每用户排空 ≤5 个到期 v3 job（PROACTIVE_SCHEDULER 已在 prod 启用）。生产实证：integrated 58→69、units 96→110、队列 68→66 净降。附注：本地 .env 的 MEMORY_EXTRACTION_LLM_FALLBACKS 会经 dotenv 在动态 import 时回灌 process.env，测试需在 import 后清 env（已踩坑修复）。
2. **定价**：查清**无自动抓价程序**——设计即「model_pricing DB 表为运行时真源 + GET/PUT /api/v1/usage/pricing + update-model-pricing skill 手工维护」，MODEL_PRICING 仅为编译种子。已双保险：种子表 + 生产 DB（X-Analytics-Token 管理头）均加 z-ai/glm-5.3-flash=$2/$8 per 1M（**保守高估占位**，待用户给真实网关费率后一键更新）。
3. **JSON 加固**：prompt 显式要求裸 JSON；parseJsonLoose 剥 markdown 围栏/推理前缀；错误携带原始输出头部样本便于诊断。

### 网页分析专属模型

确认 `WEBPAGE_ANALYSIS_MODEL` **已存在且已接线**（resolveWebpageAnalysisLlmClient 构建专属降档 client，仅在 fallback 开启时使用）；.env.example 已在 gate 旁补文档。

### P2 slice 1 — v3 unit-plane reader + dual-read shadow

- `UnitRecallReader`：lexical-seg(porter) + lexical-trigram(CJK 4-gram) RRF；I6 状态门双保险（SQL JOIN + hydration 复核）；unit 级天然去重（I8）；e5 向量通道待 unit_views_vec
- `/recall` 双读 shadow（MEMORY_READ_V3_RECALL_SHADOW，生产已开）：fire-and-forget '[v3-read-shadow]' 结构化 diff
- **生产首条实测**：「CI 流水线迁移 GitHub Actions」legacy=5 chunks(fts-only) vs v3=2 units(seg 通道, **9ms**)、overlap=0、v3Only=2——dual-read 数据开始累积
- 测试 4/4；全量失败集与基线一致

### 遗留提醒

- glm-5.3-flash 定价是占位高估——待用户真实费率
- commit df5f52c 意外混入其他会话 7 个纯 rename 文件（task_scheduler→background_jobs，内容 100% 同）——已推送 develop，无行为变化，已向用户报告
- P2 后续：unit_views_vec(e5) 通道、MEMORY_READ_V3_ASK/COMPOSE/PASSIVE 逐面 flag、非劣门 eval（等 shadow 数据累积）

## 2026-09-08 Session 10 — P2/P3/P4 全实现 + 文档（commits ed2047c..8b20f2e）

- P2 三面 dual-read shadow（ask/compose/passive）+ SurfaceCutover 非劣门 harness
- P3 ConsolidationPhases A-E whitelist + ExposureOutcomeService（I9/FSRS-lite/30d retention）+ migration 072
- P4 EgressPolicyEngine 全矩阵 ACL/egress（fail-closed）+ 23 项负向测试
- docs/features/memory_foundation.md（v1/v2/v3 + 全部关键逻辑）+ index.md
- 全量部署生产：163 units、e5 投影排水中（20 done/143 pending）、今日 $6.28/$10
- 测试：P2+P3+P4 29/29 新增全过；全量 14 失败（4 个基线修复、零新增）

## 2026-09-10 Session 11 — Reviewed Plan 对比分析 + MEMORY_CONSOLIDATION_V3 回答

### Reviewed Plan 关键差异（对照已实现代码）

reviewed-plan（docs/progressing/memory-foundation-rearchitecture-reviewed-plan.md）审查日期 2026-09-10，
基点 commit ed2047c + 未提交改动。提出的 F1-F12 工作区事实与 D1-D10 设计问题全部对照核实。

#### 已实现的（不需要重做）：
- MEMORY_SUPPLY_DECOUPLED 供给解耦（F 前提）✅
- v3 migration + extraction worker + shadow 读取 ✅
- EmbeddingClient OOM 恢复 + 心跳排水 ✅
- e5 向量通道 + 三通道 RRF ✅
- ACL/egress 全矩阵 EgressPolicyEngine ✅
- BudgetGuard 硬顶 + budget_rejected 可见 ✅
- 网页分析客户端优先门 ✅
- incident snapshot + 备份 + VACUUM §9.5 ✅

#### 需要修复的（按 reviewed-plan 优先级）：

**F4（阻塞 v3 接入）**：unit_views_fts_seg/tri 的 external content 列名 `content` 指向
memory_unit_views 的 raw_text/segmented_text——列名不匹配导致 rebuild/integrity-check 可能失败。

**F5（阻塞 v3 接入）**：UnitRecallReader 缺 scope/sensitivity/egress/时间/版本 gate。
当前只有 status 过滤。

**F6（阻塞供给）**：ExtractionWorker 不回收过期 claimed；integration 异常
未进入 retry。需要 expired-lease 接管 + fencing token + 异常分类。

**F7（阻塞 provenance）**：EpisodeRepository snake_case→camelCase 类型断言无运行时映射。
Worker 读 sourceType/trustClass 字段名不正确。

**F8（时间契约）**：ExtractionContract 只检查整数；worker 用 episode.timestamp
替换 unknown observedAt——违反 I7（unknown 保持 null）。

**F9（真值更新）**：UnitTruthMaintainer 不同文本的争议来源被附加到旧 unit；
修改前后读取同一 id 做 snapshot。需要独立保存双方 claim + before/after snapshot。

**F10（幂等边界）**：digest 未覆盖 scope/sensitivity/confirmation/provenance 等字段。

**F11（归属体系）**：v3 worker 简化了 evidence_class 判断（有 sender 就 self_statement），
未复用既有 MemoryClaimAttributionService。

**F12（旧路径优化，优先验证）**：RecallEngine FTS 全局 top-N 后再过滤——
可能过早挤出合法候选。

**D3（安全前置）**：PolicyEngine 应在任何模型外发前交付，不是 P4 才建。

**D1（原文检索长期存在）**：不能因为 unit 抽取成功就让原文不可检索。

### 执行计划

按 reviewed-plan §8.1 Q0→Q1a→Q1b→Q2→Q3 路线：
1. 先修 F4-F11（v3 完整性缺陷）
2. F12（旧路径 predicate pushdown 实验）
3. Q1a 来源可靠性加固
4. Q2 有界质量实验
5. Q3 最小生产闭环

---

## 2026-09-22 召回缺失根因修复（B 方案 + F13 + 抽取管线三重修复）

### 用户报告的两个失败查询
- "sophia 最近问了我什么问题" / "delegate beta 需求这件事，谁在负责"
- 两个查询的 episode 都是 Sept 8 后的新消息，但 v3 units 为 0，抽取 job 不存在（NO_JOB）

### 根因（三层）
1. **抽取模型配置错**：`MEMORY_EXTRACTION_LLM_FALLBACKS` 被某次 env 同步覆盖回
   `openai/z-ai/glm-5.3`（应为 `openai/moonshotai/kimi-k3`）→ 修复 env
2. **旁路 ingest 路径**（F13）：calendar（calendarEvents.ts）和 web（SourceMemoryCaptureService）
   直接 INSERT messages_raw，绕过 IngestionPipeline → 318 条消息（128 calendar + 162 web +
   39 条 9/8 flag 启用前的 glip）从未入队 → 全部路径补 enqueue + enqueueEpisode 幂等化
3. **推理模型烧 token**（关键）：kimi-k3/glm-5.3 是推理模型，thinking tokens 在 JSON
   答案前输出。默认 maxTokens=2000 被 thinking 吃光 → content 空 →
   "no JSON object (head: )" 死信 483+14 条。修复：maxTokens 6000 +
   OpenRouter 统一 `reasoning.effort=low`（非 gpt-5 模型路径）

### 连带修复
- **预算锁死不再烧重试**：LLMBudgetExceededError 停在 next UTC midnight，不消耗 attempts
  （否则 790 job 的 drain 会在 $10 上限处被批量烧成 dead_letter）
- **capsule dismiss FK**：removeLinkedMemorySignal 删 episode 前先删 ingest_jobs；
  有 units 的 episode 保留（memory_unit_sources FK，影子期 lineage 不变式）
- **B 方案关键修正**：RecallEngine 搜 chunks_vec_e5 时查询向量必须用
  embedWithE5(query, 'query:') 重新嵌入（MiniLM 查询向量与 e5 passage 向量空间不兼容）

### B 方案（legacy e5 重嵌）完成
- `chunks_vec_e5`：16,609 chunks 全量重嵌（passage: 前缀，~26 分钟本地 CPU）
- RecallEngine 向量通道自动切换（表存在用 e5，否则回退 MiniLM）
- 生产进程 e5 加载 3 次成功 0 失败（docker exec 新进程会碰 wasm blob worker 问题，
  生产进程无此问题）
- Ask surface（retrievalMode=deep）走引擎默认通道含 vector → e5 直接生效
- /api/v1/recall 路由是 safe mode（FTS-only，RECALL_ROUTE_SAFE_MODE_ENABLED=true）——设计如此

### 结果（11:57 时点）
- units: 285 → 815（drain 进行中，608 job 队列，4 并行 drain ~110 job/10min）
- dead_letter: 仅剩 ~7 条 span out of range（LLM 算错 CJK byte 偏移，严格契约
  正确拒绝，~1% 损失率，影子期可接受）
- 今日 spend $0.99 / $10 上限
- 两个失败查询经生产 API 验证：FTS+graph 已返回相关结果（Daily Summary with
  Beta PRD、"AI, Sophia (Jinmei)" Memory Capture）

### 提交
- c28541b/9f684fe B-plan e5 切换（+分支误提交清理）
- 4e1f240 e5 查询向量 prefix 修正
- fbdb3b5 F13 calendar/web enqueue 旁路修复
- 3c98b94 预算锁死不烧重试
- 80308be 推理模型 token 上限修复

### 追加修复（drain 过程中发现）
- **89bc386 crash 容错**：单 job 异常不再杀死 drain 进程（并行 drain 碰撞时
  PK 冲突以 unhandled rejection 杀死了全部 worker）；LEASE_SECONDS 120→300
  （kimi-k3 推理调用可超 120s）
- **d3d6592 F14（关键）**：dispute 路径写 revisions(N+1) 但漏了
  memory_units.current_revision +1 → desync → 后续所有同 unit 写操作
  确定性撞 PK（68 个卡死 retryable 全是这个 bug，不是并发竞态）。
  修复 + 生产数据修复（70 个 desynced units）
- 最终状态：**1,637 units**；Sept 8 后全部 1,532 episodes 处理完
  （980 integrated + 539 extracted_zero + 13 dead_letter 全部为
  span-out-of-range 模型局限，~0.8%）
- 今日总 spend $1.03 / $10

### 验证结论
- "sophia 最近问了我什么问题"：Memory Capture (1529) AI, Sophia (Jinmei) 命中 top4
- "delegate beta 需求这件事，谁在负责"：Daily Summary Beta PRD "Esone Qiu confirmed"
  + Milo Beta planning 命中 top1/top4
- 两条查询在 FTS+graph 通道即返回相关结果；e5 向量通道在 Ask surface
  （deep retrievalMode）生效（生产进程 e5 加载 0 失败）
- 覆盖率：Sept 8 后 episodes v3 units 覆盖 22% → 64%（980/1532，
  其余为合法 extracted_zero——转发/元数据类消息无可提取记忆）
