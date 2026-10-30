# Mem0 OSS 能力缺口（方案 C）

固定 upstream：`mem0ai` @ `26cdefb46600c0fa5953c4b5ee5003c125539fc4`（见 `envs/README.md`）。

| 能力 | Mem0 Platform / 托管 | Mem0 OSS（本 adapter 使用） | Harness 自建 / 标注 |
|---|---|---|---|
| Dream（跨记忆合成 / Supersede / Merge） | 有（Pro+ opt-in） | **无** | `consolidate()` 用 OpenRouter **`main`** 档做日级主题摘要，写入 `derived_snippets`（`harness_consolidation:*`）；**不**写回 Mem0 向量库 |
| Memory Decay | 有 | **无** | 未模拟；报告仅标注缺口 |
| Temporal `timestamp` on `add()` | Platform | OSS **拒绝**（源码抛 `ValueError`） | 可见性由 sidecar `observed_at` + harness `as_of` 过滤 |
| Memory expiration | Platform | OSS 仅 `expiration_date` 元数据 |  benchmark 未启用 |
| Graph Memory | Platform | **无** | 未建图；recall 走 Mem0 `search` + sidecar 映射 |
| 入库抽取 | Platform Dream + 管线 | OSS **`add(infer=True)`** 内联 LLM（**`fast`** 档 via OpenRouter） | 费用计入 Mem0 原生路径；与 B 的 `consolidate_extract` 分离 |
| BM25 / fastembed 可选件 | 可选 | 未装（smoke 非致命 notice） | 检索依赖 Qdrant + Ollama `bge-m3` |
| Telemetry | 默认 PostHog | 可关 | `MEM0_TELEMETRY=false` |
| Dashboard | Platform | 文档不一致；本任务用 Python SDK | — |

## 虚拟时钟分组（`clock-audit.md`）

- **`virtual_harness`**：`consolidate` 日界、harness 摘要、`recall` 的 `as_of` 过滤、sidecar 幂等 / ACL。
- **`native_mem0_api`**：`mem0.add` / `mem0.search` / `delete` — wall-clock 延迟与 Mem0 内部 LLM/embedding 调用；**不受**虚拟时钟控制。

## 模型档位（E-160）

| 用途 | 档位 | 模型 |
|---|---|---|
| Mem0 `add()` 抽取 | `fast` | `z-ai/glm-5.3-flash`（worker 环境 `OPENAI_MODEL`） |
| Harness 日级整理 | `main` | `z-ai/glm-5.3` |
| Embedding | local | Ollama `bge-m3` 1024d |

`config/models.json` 为 canonical；key 仅 `.env`（不提交）。
