# 方案 B 与 `memory_core_v4_spec.md` 偏离清单

版本：`B-spec-1-preflight`（Stage 4 评测前补齐项，非正式质量验收）。

| 领域 | 规格要求 | 当前实现 | 对 Stage 5 评测的影响 |
|---|---|---|---|
| 存储 | 完整 jobs/receipts span、evidence_refs span 表 | `async_jobs` + `decision_outbox` 持久队列；无独立 receipts / evidence_refs 表 | 整理收据与 span 级审计仍弱；探针可依赖 outbox/jobs 恢复 |
| 向量 | 本地 bge-m3 1024 维 | Ollama `bge-m3` 1024d；不可达时 BoW 256d fallback（export.embedding.backend 可见） | fallback 时 dense 通道与其他方案不对齐，跑分前需确认 Ollama |
| 整理 | WriteProvenanceGate + 完整 v3 流水线 + 工具循环 ≤3 | OpenRouter fast 抽取 + main 卡片摘要；TruthMaintainer facade（同槽 supersede/retract）；未接 Gate/工具循环 | 来源资格与工具预算门未覆盖；合成 smoke 可记账 fast+main |
| 关联 | 32/16/64 有界邻域 | 仍仅 commitment/change 卡片，entity_edges 空 | graph 类探针仍劣于规格 |
| 快提取 | 250ms 硬 deadline + 可选 rerank | 四路 + RRF；无 monotonic deadline 截断 | 延迟门未验收；功能召回不受此补齐阻塞 |
| 决策 | verified_fact 门 + discovery 严格证据 | 规则 V 分 + outbox 记录；未接 authority verified 门 | discovery 精度可能偏乐观 |
| 费用 | 跨 run 共享 B 账本 | `.local/new-core-data/scheme-B-shared-ledger.json` 持久化 + reserve/settle | 三次建库可共享同一文件累计；合并见 `mergeLedgerReports()` |
| 复用 | SleepReconciliation 等 | 未接 | 夜间整理语义不在本轮 |

**已关闭（相对 MVP）**：占位 256d 主路径 → bge-m3；InMemory 单 run 账本 → 文件账本；无 outbox → decision_outbox + vec_embed jobs；appendFact 直写 → TruthMaintainer facade。

合成 contract smoke 仍为目标；**正式 E-141 质量排名需关闭上表剩余偏离后再跑**。
