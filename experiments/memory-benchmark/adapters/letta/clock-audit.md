# Letta adapter 时钟审计（方案 E）

## 映射原则

| Harness 操作 | 时钟组 | 说明 |
|---|---|---|
| `ingest` → sidecar 写入 `observed_at_ms` | virtual_harness | 回放顺序由 harness 虚拟时间驱动 |
| `ingest` → `write_memory_file` | native_letta_api | Git commit 时间戳为墙钟 |
| `consolidate(virtualNow)` 日界 / 批处理窗口 | virtual_harness | 与 C/D 相同 `virtualDayKey` |
| `consolidate` → OpenRouter 日摘要 | virtual_harness | `at_virtual` 传入 ledger |
| `consolidate` → `/dream` | native_letta_api | 可能触发 Letta 远端 reflection；**单独**记入 `dream_audit` |
| `recall(..., asOf)` 过滤 | virtual_harness | `isVisibleAt` 只读 sidecar |
| `recall` → `list_memory` | native_letta_api | 读取当前 MemFS 工作树（非历史 ref） |

## 高频事件

生产 replay 每条 `PersonalMemoryEvent` 映射为：

1. sidecar 行（含 `observed_at`、`source_version`）
2. 一次 MemFS 文件 write+commit（路径 `benchmark/ev/{event_id}.md`）

无批量 ingest API；虚拟时钟**不能**加速 MemFS commit。

## 严格时序事实

Letta 原生不接收 harness `observed_at` 作为 MemFS 排序键；时序正确性依赖 sidecar + recall 过滤。需要 git-ref 级「as-of 记忆」时，应扩展为 `memory_file_at_ref`（未在本轮实现）。
