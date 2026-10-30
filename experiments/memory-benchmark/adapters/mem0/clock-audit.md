# Scheme C 虚拟时钟审计

## 原则

Harness 回放只推进 **`observed_at` 虚拟时间**；不修改系统时钟。Mem0 Python SDK 的 LLM/embedding 调用在 **真实 wall-clock** 上完成，计入 **`native_mem0_api`**。

## 分组

| 操作 | 时钟组 | 说明 |
|---|---|---|
| `ingest` sidecar 写入 / 幂等 | `virtual_harness` | `observed_at_ms` 来自 event |
| `ingest` → `mem0.add()` | `native_mem0_api` | Mem0 抽取 + Qdrant + Ollama embed |
| `consolidate(virtualNow)` | `virtual_harness` | 按虚拟 UTC 日一次；harness `main` 摘要 |
| `recall` `as_of` 过滤 | `virtual_harness` | sidecar `observed_at ≤ as_of` |
| `recall` → `mem0.search()` | `native_mem0_api` | 向量检索；结果再经 harness 过滤 |
| `decide` | `virtual_harness` | 仅使用已通过 `as_of` 的 recall hits |
| `delete` / `revoke` | 混合 | sidecar tombstone / ACL（virtual）+ Mem0 delete API（native） |

## export 字段

`export().clock_audit` 按操作追加 `{ op, group }` 条目，便于报告区分「原生 API / 真实耗时」与 harness 虚拟层。

## 与 Platform 差异

OSS **`add(timestamp=...)` 不可用**；不得用 Mem0 托管版 Dream/Decay 代替 harness 整理。见 `CAPABILITY_GAPS.md`。
