# Letta 能力缺口（方案 E）

固定 upstream：`../personal-ai-letta`（letta-code **0.34.33**，commit `ebc496e532f1a34da9ac8d7e2da41c5920ea77e6`）；App Server `ws://127.0.0.1:4500` + MemFS（见 `envs/README.md`）。

| 能力 | Letta 产品面 | 本 adapter（App Server + MemFS） | Harness 自建 / 标注 |
|---|---|---|---|
| 持续身份 | 每用户/Agent 长期 MemFS git 历史 | **每 scope 一个 unpinned local agent** + sidecar SQLite | run 结束 `agent_delete`；跨 run 不复用 |
| 可编辑记忆 | MemFS 文件读写 + commit | `write_memory_file` / `delete_memory_file` | 修改 = 新 `source_version` 行 + MemFS 覆写 |
| Dreaming / 后台整理 | `/dream`（execute_command） | `consolidate()` **best-effort** 调用；失败记入 `dream_audit` | 日级主题摘要仍用 OpenRouter **`main`**（与 C/D 同 harness 整理） |
| 语义检索 | Agent 工具 + MemFS grep | **无**向量检索 API；recall = `list_memory` + harness 词面打分 + `observed_at` 过滤 | 与 Mem0/Supermemory 的 embedding 检索不可直接比 |
| 严格时序事实 | 会话时间线 + 工具 | MemFS commit 用 **墙钟**；可见性靠 sidecar `observed_at` | 见 `clock-audit.md` |
| 高频事件 | 会话 message 流 | **每条 event 一次 MemFS write+commit**（native 墙钟） | 大批量 replay 需单独测延迟；本任务只保证协议映射 |
| 费用暴露 | Cloud 账单 | App Server **不**回传 token；dream 若触发远端则另计 | `cost_ledger` 记 harness **`main`**；`dream_audit` + OpenRouter 活动查 Letta 多轮整理 |

## 虚拟时钟分组（`clock-audit.md`）

- **`virtual_harness`**：`consolidate` 日界、harness 摘要、`recall` 的 `as_of` / ACL、sidecar 幂等。
- **`native_letta_api`**：`create_agent`、`write_memory_file`、`list_memory`、`delete_memory_file`、`execute_command` dream — **真实耗时**；不受虚拟时钟控制。

## 模型档位（E-160）

| 用途 | 档位 | 模型 |
|---|---|---|
| Local agent（Letta runtime 默认） | `main` | `openrouter/z-ai/glm-5.3` |
| Harness 日级整理 | `main` | `z-ai/glm-5.3` |
| Embedding | 本方案 | MemFS 无独立 embedding 服务 |

`config/models.json` 为 canonical；key 仅 `.env`（不提交）。

## 与 Graphiti 候补

Letta 槽位失败类型若是 **关系/时间图** 而非 **Agent 身份/可编辑 MemFS**，应按 E-141 提前 Graphiti；本 adapter 不自动改接 Letta Cloud V1 API。
