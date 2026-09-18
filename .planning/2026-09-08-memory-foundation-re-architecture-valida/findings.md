# Findings — Memory Foundation 验收与执行

## 2026-09-08 生产库只读验收（backfill plan / Cursor 会话成果）

连接：`ssh rcadmin@10.32.56.212` → `/usr/local/bin/docker exec memory-service node`（容器无 docker PATH，须绝对路径）。库 `/app/data/users/esone.qiu/memory.db`。

### 回填验收（backfill plan §5 判据）

| 判据 | 结果 | 证据 |
|---|---|---|
| A1 chunks 覆盖 | ✅ 达标 | `messages/` chunks 15,568（基线 3,642）；总消息 15,296 |
| A2 按月覆盖率 | ✅（历史） | 2025-02 ~ 2026-08 所有月份 eligible 消息 100% chunked；2026-09 = 1309/1482（88%） |
| Tier 1 向量 | ✅（超出 plan 范围） | chunks_vec 17,488，`messages/` chunk 缺向量 = 0 |
| Tier 2 实体 | ⚠️ 已执行（违反 plan 归属） | 2026-07 后 4,690/4,861 消息带 entities_json；plan 说 Tier 2 等 P1，Cursor 会话已跑 |
| A4 chunks_vec | ✅ 无 orphan 消息 chunk | 同上 |
| FTS integrity | ⏳ 未验证 | integrity-check 需写权限，只读连接报 SQLITE_READONLY；待部署/维护窗执行 |
| A5 端到端 passive 召回 | ⏳ 未验证 | 需要 Lens fixture 或 API 验证 2026-08 后记忆 |
| A6 evals | ⏳ 未跑 | context-recall / memory-abilities 待跑 |

### ❌ 关键缺口：B1 前置未修复，断供对新增消息仍在持续

- 生产 env：`INGEST_LLM_EXTRACTION_ENABLED=false`、`INGEST_EMBEDDING_ENABLED=false`。
- `IngestionPipeline.ts:322` `shouldIndex = salienceScore !== undefined && salienceScore >= STORAGE_THRESHOLD`；extraction skip 时 salienceScore=undefined ⇒ shouldIndex=false ⇒ 不写 chunk/FTS。
- 后果：回填后新增消息 173 条缺 chunk（2026-09-08 ~ 09-21 每天仍在产生），断供重开，且会持续扩大。
- backfill plan §2 B1 明确要求先修此耦合再回填；Cursor 会话跳过了。

### P0a 其余项状态（对照 canonical plan §11.2）

| P0a 项 | 状态 |
|---|---|
| 1. 供给解耦 | ❌ 未做（即 B1） |
| 2. sentiment/importance 字段契约 | ❌ 未做（IngestionPipeline 无 legacy metadata.metadata decoder） |
| 3. EmbeddingClient readiness/warmup | ❌ 未做（EmbeddingClient 无 readiness/retry 逻辑） |
| 4. rehearsal hour-bucket upsert | ❌ 未做（RehearsalService.ts:424 仍逐行 INSERT，无 UNIQUE 约束聚合） |
| 5. 空反思/Runs 索引阻断 | ❌ 未查到阻断逻辑 |
| 6. supply metrics / p99 | ❌ 未做 |
| 7. 服务端 rollout allowlist | ❌ 未做 |

### 其他生产事实

- `journal_mode = delete`（非 WAL）——批量写会阻塞前台，回填脚本靠 batch+pause 规避。
- `rehearsal_activations` 仍 ~195 万行（历史清理属 P0b 预授权作业，未执行）。
- Feature flag `MEMORY_SUPPLY_DECOUPLED` 尚不存在于代码。

### Plan 文档校验结论

- v3 canonical 文档由 2026-09-07 review 会话重写并做了 Phase 8 一致性审计（.planning/2026-09-07-memory-foundation-plan-review，全 complete）。
- 本次通读复核：阶段依赖闭合（R0→P5）、不变量/门/回滚完整、数字分类（硬门/初始配置/观测基线）明确，无"后文推翻前文"。
- 与现实的偏差：Cursor 会话实际执行顺序违反 plan §0.1（先 P0c 回填、未做 P0a），且 Tier 2 提前执行。历史数据已回填无需回滚，但必须立即补 P0a item 1 止血。

## 关键代码位置（当前 checkout）

- `memory-service/src/core/IngestionPipeline.ts`：line 126 extraction enabled env；line 322 shouldIndex 耦合；line 430 `if (shouldIndex)` 才建 chunk；line 1458 chunk INSERT；line 1501 chunks_vec INSERT。
- `memory-service/src/core/RehearsalService.ts:424` recordMatchedActivation 逐行 INSERT。
- `memory-service/src/llm/EmbeddingClient.ts`：无 readiness。
- 回填脚本：`memory-service/scripts/backfill-message-index.mjs`（支持 --tier tier3/tier0/tier1/all，幂等 DELETE-then-INSERT，checkpoint）。
