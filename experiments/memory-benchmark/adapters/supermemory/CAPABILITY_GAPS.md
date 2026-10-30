# Supermemory Local 能力缺口（方案 D）

固定 upstream：公开 SDK/docs checkout @ `a619e2727d9118607cde5cc1a407d84f223ff022`；Local server **0.0.9**（见 `envs/README.md`）。

| 能力 | Supermemory Cloud / 托管 | Supermemory Local（本 adapter） | Harness 自建 / 标注 |
|---|---|---|---|
| URL / hosted reader ingestion | 有 | **本任务禁用** | 仅 `content` 文本直写 `POST /ns/{ns}/document` |
| Dreaming / 跨记忆合成 | Cloud 可选 | Local server 可选；**未**接 harness 主动 dreaming 循环 | `consolidate()` 用 OpenRouter **`main`** 做日级主题摘要 → `derived_snippets` |
| 画像 / profile API | 有 | Local 0.0.9 smoke 以 document + search 为主 | `decide()` 与 C 相同启发式 sidecar / discovery |
| 费用 / token 暴露 | Console | Local API **不**回传 billed usage | 费用看 OpenRouter 活动；harness `cost_ledger` 仅记 **`main`** 整理调用 |
| 导出完整性 | 托管导出 | 需 sidecar SQLite + `GET document?include=memories` 才能还原来源链 | `export()` 含 **full sidecar `evidence_events`**（正文 + provenance 字段） |
| 权限 / namespace | 平台 ACL | **每 scope 独立 namespace** + sidecar `revoke` | 跨 scope 检索由 harness 过滤 |
| 删除传播 | API delete | `DELETE /document` + sidecar tombstone | `runDeleteRevokeGate` 覆盖 derived + recall cache |
| 中文检索 | 依赖 embedding | Local **`Xenova/bge-m3`** 1024d | 可移植性门单独验收（阈值 ≥ 0.5） |
| 相对日期抽取 | LLM 依赖 | smoke 已知相对日期质量问题 | 与 Mem0 一样单独标注，不阻塞 adapter 交付 |

## 虚拟时钟分组（`clock-audit.md`）

- **`virtual_harness`**：`consolidate` 日界、harness 摘要、`recall` 的 `as_of` 过滤、sidecar 幂等 / ACL。
- **`native_supermemory_api`**：`add` / `patch` / `search` / `delete` — wall-clock 与 server 排队 `queued→done`；**不受**虚拟时钟控制。

## 模型档位（E-160）

| 用途 | 档位 | 模型 |
|---|---|---|
| Supermemory server 入库抽取 | `fast`（server 环境 `OPENAI_MODEL`） | `z-ai/glm-5.3-flash` |
| Harness 日级整理 | `main` | `z-ai/glm-5.3` |
| Embedding | local | `Xenova/bge-m3` 1024d（server 进程内） |

`config/models.json` 为 canonical；key 仅 `.env`（不提交）。

## 可移植性门未通过时

按 E-141 约定：**槽位 D 换 Graphiti**，不在本 adapter 内自动改接 Supermemory Cloud。
