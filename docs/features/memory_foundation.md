# Memory Foundation 架构（v1 → v2 → v3 数据模型）

> 所属能力：记忆服务（核心平台）
> 更新日期：2026-09-08
> Canonical 方案：[memory-foundation-rearchitecture-plan.md](../progressing/memory-foundation-rearchitecture-plan.md)

## 大白话运行逻辑

这个系统要把用户的记忆存好、找准、管住。它现在同时跑三代数据模型：旧的 v1/v2 负责"把消息存下来能搜到"，新的 v3 负责"把消息变成原子事实、管好真值、管住权限"。三代并行运行，v3 以 shadow（影子）模式验证质量后再切换。

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
4. **争议不自动覆盖**：不同文本 → `disputed` 状态，永不自动 supersede
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
