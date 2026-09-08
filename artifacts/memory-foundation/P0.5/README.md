# P0.5 薄切实验报告 — 2026-09-08

> 运行环境：生产容器内（10.32.56.212），只读检索通道 + 独立 shadow 向量表；不影响线上行为。
> 工具：`memory-service/scripts/p05-gold-sampler.mjs`、`p05-ablation.mjs`、`p05-e5-backfill.mjs`

## 数据

- **154 个 scene-query probes**（≥ plan §11.5 的 150 下限）：按 source_type(glip/jira/web/calendar) × recency(recent/older) 分层，语言配平后 en=111 / mixed=39 / zh=4 + 3 个 no-result 探针。
- **seed 标注，非人工标注**：每条 probe 由一条已知消息派生（query 取自该消息关键词，gold=该 message id），provenance 完整、judge 完全确定性（gold-id 命中，无 LLM judge），可复现。plan 要求的「人工标注」升级 pass 未做——本报告结论为 **provisional**，人工审核 gold 后复跑可固化。
- 判据：hit@k = gold 消息出现在 RRF 融合 top-k 的 message chunk 中（derived chunk 不算命中，各变体同口径）；abstention = no-result 探针 top-10 全部 score < 0.5。

## 消融结果（154 probes，paired bootstrap CI95，1000 次重采样）

| Variant | hit@1 | hit@5 | MRR@10 | abstention | hit@5 差值 CI95 vs A |
|---|---:|---:|---:|---:|---|
| A：porter FTS + MiniLM dense RRF（旧栈基线） | 0.175 | 0.312 | 0.225 | 3/3 | — |
| A_TRI：A + trigram 通道入 RRF | 0.175 | 0.364 | 0.262 | 3/3 | **+5.2pp [+2.0, +9.1]** |
| D：porter FTS + multilingual-e5-small dense（query:/passage: 前缀齐全，独立 e5 shadow 表 15,774 行全覆盖） | 0.253 | 0.481 | 0.345 | 3/3 | **+16.9pp [+10.4, +24.0]** |

## 裁决（按 plan §11.5 规则）

1. **multilingual-e5-small**：hit@5 +16.9pp，CI 排除零 → 质量门通过；延迟 ~35ms/查询（本地 ONNX，608s 全量嵌入 15,774 段 ≈ 26/s）；存储 384 维 ≈ +24MB。**建议进入 P1/P2 默认向量模型候选**（正式采用仍需 P2 dual-read 非劣门 + 表面级标定，plan §5.5：不同 embedding 配置永不共享阈值）。
2. **trigram 通道**：hit@5 +5.2pp，CI 排除零 → **支持作为 P2 lexical 补充通道**（生产侧已有 chunks_fts_tri shadow 与 MEMORY_FTS_TRI_SHADOW 计数）。
3. **int8（variant E）**：未跑。理由：当前 384 维 float 全量仅 ~24MB，容量不构成约束；int8 只在容量或成本受压时再标定（plan「int8 只有在 recall loss 通过门后采用」——推迟无损）。
4. **BGE-M3（capacity upper bound）**：本轮未跑。plan 本身要求 doctor 证明可加载且 pilot 延迟/内存过门才进入消融；生产容器有 OOM 史（batch embedding 事故一次），大模型加载实验应单独窗口执行。报告 `deferred` 而非替换模型。
5. **needSlots / trigger-question views（variant B/C）**：依赖 v3 unit views（P1 基础设施），pre-P1 无法诚实测量。按 plan「增益不明确不进默认路径」原则，维持非默认；P1 落地后补测，若需推翻本安排则立 ADR。

## 误召回与 no-result

3 个 no-result 探针在所有变体下均正确弃权（abstention 3/3）——OR-tokenization 的词法通道没有把无关内容强推进 top-10（因为 RRF score 门 0.5）。

## 局限（诚实记录）

- gold 为机器种子（见上）；zh 纯中文探针仅 4 条——语料本身中文短消息为主，跨语言结论主要由 mixed 探针（39 条）与 P0c baseline 的 meeting-room fixture 共同支撑。
- 消融 harness 是裸通道 RRF（top 50/channel, k=60），无生产 ranking 的 tier 过滤/salience/MMR——绝对值低于生产体验，变体间相对比较有效。
- e5 结论基于 Xenova ONNX quantized 权重；正式采用时需 pin exact revision（plan §5.5 metadata 要求）。

## 复现

```bash
# 采样（容器内）
node scripts/p05-gold-sampler.mjs --db-path ... --out /tmp/p05-gold-seed.jsonl --per-stratum 21
# e5 语料（12 分钟）
node scripts/p05-e5-backfill.mjs --db-path ...
# 消融
node scripts/p05-ablation.mjs --db-path ... --gold /tmp/p05-gold-seed.jsonl --variants A,A_TRI,D --out /tmp/p05-report.json
```
