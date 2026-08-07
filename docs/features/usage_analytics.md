# Usage Analytics / 用量与 Token 分析

_最后更新: 2026-07-31_

Usage Analytics 是一套**本地打点**的系统级用量观测能力：把 Chrome 扩展（前端）和 memory-service（后端）每一次 LLM 调用的真实 token 用量，按 [docs/index.md](../index.md) 的「所属能力」归类，写入一个独立的集中式 analytics 库，最终以鉴权的 HTTP 报表页呈现。报表默认是**使用/运营视角**：功能总览（一功能一行，行内拆前端/后端）、用户活跃度（DAU + 排行）、用户×功能偏好矩阵，并支持中文功能名、30 天窗口、全体/单用户与**端过滤（全部 / 仅前端 / 仅后端）**。

它解决的问题是：oneapi 后台只能看到 token / 模型级别的账单，无法回答“**哪个用户、用哪个功能、烧了多少 token**”。本系统在前后端各自的 LLM 出口处打点，把用量归因到 `user × capability × model × side`。

普通用户通过 **HMAC 签名的个人链接**（`scope=self`）只能看自己的用量；管理员可用 `ANALYTICS_ADMIN_TOKEN` 或 `scope=all` 签名链接看全体。

## 大白话运行逻辑

系统要为运维回答四个问题：**谁**（user）、用**什么功能**（capability）、走**前端还是后端**（side）、花了**多少 token / 多少钱**（model + cost）。

- **后端**：memory-service 每次经过 `LLMClient.generate()` 的调用，都会读取当前请求的异步上下文（用户 + 由 route 推断的能力），把响应里的真实 `usage` 记成一条 `side:'backend'` 事件。非 LLM 的 `/api/v1/*` 接口调用则单独计入接口频率表。
- **前端**：扩展每次经过 `handleLLMRequest`（含 OpenAI / Groq / Dify / Ollama）的调用，在**统一 try/catch**里打点：成功记真实/估算 token，失败记 `status:'error'` + `errorKind`（如 `http_401` / `timeout`）与 0 token。事件暂存到 `chrome.storage.local` 环形缓冲，由后台 `chrome.alarms` 定时（每 5 分钟）+ 缓冲达阈值即刷，**分批（100 条）**上报到 `POST /api/v1/usage/telemetry`，记成 `side:'frontend'` 事件。会议 OCR 旁路也已接入同一套打点。
- **成本**：入库时按本地价格表估算美元成本；未知模型记 0 并打 `flagged` 标记，报表可据此暴露“未计价用量”。
- **报表**：读取每小时/每日 rollup 缓存，并合并“今天尚未 rollup”的原始事件；`byCapability` 默认按 **usageCount** 排序，并注入中文 `label`、`apiCallCount`、`userCount`、`bySide`（前端/后端分桶）、`failCount`、`features` 下钻。全体视图额外返回 `byUser`、`userCapabilityMatrix`、`dailyActivity`。成本在报表层按当前 `MODEL_PRICING` 重算。

关键边界：**打点永远是 best-effort 副作用**——analytics 任何异常都被吞掉，绝不影响 LLM 主链路或 API 响应；成本是本地估算，不做 oneapi 对账。

## 个人链接（HMAC）

Token 格式：`base64url({u,s,exp}).HMAC-SHA256`，密钥为 `ANALYTICS_TOKEN_SECRET`（未设则回退 `ANALYTICS_ADMIN_TOKEN`）。

| scope | 谁能签发 | 报表行为 |
|-------|----------|----------|
| `self` | 任意已认证用户 `POST /usage/my-link`（用 `X-User-Id`） | 强制 `user=token.u`；`byUser`/`matrix` 为空；隐藏跨用户面板 |
| `all` | 仅携带 `ANALYTICS_ADMIN_TOKEN` 时签发 | 与 admin break-glass 相同：可看全体/下钻 |

默认有效期约 180 天。撤销方式：轮换 `ANALYTICS_TOKEN_SECRET`。既有 `ANALYTICS_ADMIN_TOKEN` 仍可作为全体报表入口。

扩展入口：

- Options / 记忆探索侧栏：「打开我的用量报表」→ `POST /usage/my-link` → 打开签名 dashboard
- esone.qiu Options 仍保留「全体用量报表（Admin）」与 Admin Token 配置

## 前后端如何看

前后端 capability **命名重叠**（如 `notification_center`、`meeting_pilot`），因此主表保持**一个功能一行**，行内分列：

- LLM 调用：前端 / 后端
- Token 前端 / Token 后端
- 失败调用（含失败率 tooltip）
- 堆叠条形图（前端色 + 后端色）

顶部「端」过滤器：`全部 / 仅前端 / 仅后端`。仅前端时接口调用列显示 `—`，使用频度改为纯 LLM 调用。点击功能行可下钻 `feature`（前端）或 `route`（后端）。`unknown` 行高亮，作为打点覆盖率健康指标。

## `memory_service`（记忆服务）是什么？

报表里「记忆服务 / `memory_service`」**不是** others 垃圾桶，也**不是**「除下面功能以外的剩余项」。`unknown` 才是未映射路由的兜底。

它是 [index.md](../index.md) 里的一个正式「所属能力」：**Memory Service 核心平台能力**——记忆摄入/召回/生命周期、反思线程、动作队列、主动询问、证据守望、Keystone Brief 等后端主链路。route → capability 映射见 `capabilityMap.ts`。

解读建议：看「记忆服务」时优先切换排序到 **Token / 成本**，并展开报表底部的**接口调用明细**；若 `/stats` 占比过大，说明的是平台心跳/轮询。真正未归类的流量在 **`unknown`（未归类）**。

## 关键实现逻辑

### 能力归类（前后端共用口径）

前后端使用**完全一致**的 31 个 capability key（含兜底 `unknown`），对齐 index.md「所属能力」：

- 前端：`src/analytics/capabilities.ts`
- 后端：`memory-service/src/analytics/capabilityMap.ts`

前端事件的 `capability` 由调用方显式标注；未标注默认 `unknown`（开发期 `console.warn`）。覆盖扫描：`node tools/check-llm-capability-coverage.mjs`。

### 前端打点与上报

- `src/llm.ts`：`handleLLMRequest` 统一 try/catch 打点；provider 返回 `{content, model, usage}`；尊重 `body.model`（使 `OPENAI_REVIEW_MODEL` 生效）；usage 缺失时按字符估算并标 `tokensEstimated`。
- `src/analytics/UsageTracker.ts`：缓冲 + 分批 flush；记录 `lastFlushAt` / `lastFlushError` / `lastFlushIngested`。
- `src/background.ts`：每 5 分钟 flush；支持 `FLUSH_USAGE_TELEMETRY` / `GET_USAGE_TELEMETRY_STATUS` 消息。
- Options（`esone.qiu`）：「立即上报并自检」按钮。

### 后端打点

- `usage_events` 含 `status` / `error_kind`；`usage_rollup_daily` 含 `fail_count`。
- 既有库通过 `AnalyticsStore.ensureSchemaMigrations()` 加列。

### 成本估算

`MODEL_PRICING` 含 `qwen3.6:latest`、`gpt-5.5`、`gpt-4o-mini`、`deepseek-*`、`llama3` 等。

## 数据与 API

集中式独立库：`${DATA_DIR}/analytics/usage.db`。

- `POST /usage/telemetry`：字段含 `status` / `errorKind`；用 `request.userId`。
- `POST /usage/my-link`：签发 HMAC 链接；`scope=self`（默认，需有效 `X-User-Id`）或 `scope=all`（需 Admin Token）。
- `GET /usage/report?range=24h|7d|30d&user=<id|all>&side=all|frontend|backend`（Admin Token 或签名 token）
- `GET /usage/users`、`GET /usage/dashboard`（同上；self 强制只看本人）

环境变量：

- `ANALYTICS_ADMIN_TOKEN`：全体报表 break-glass
- `ANALYTICS_TOKEN_SECRET`：HMAC 密钥（空则回退 Admin Token）

## 验证指引

- `npm --prefix memory-service run build`
- self token：`user=` 查询参数被忽略；无 byUser/matrix；看不到他人
- all / admin token：全体视图正常
- 篡改/过期 token → 401
- Options「立即上报并自检」→ dashboard 切「仅前端」看分功能 Token / 失败列
- 前端打点上线依赖重新构建并发布扩展；历史用量无法回溯
