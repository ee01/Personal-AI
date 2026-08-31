# Usage Analytics / 用量与 Token 分析

_最后更新: 2026-08-25_

Usage Analytics 是一套**本地打点**的系统级用量观测能力：把 Chrome 扩展（前端）和 memory-service（后端）每一次 LLM 调用的真实 token 用量，按 [docs/index.md](../index.md) 的「所属能力」归类，写入一个独立的集中式 analytics 库，最终以鉴权的 HTTP 报表页呈现。报表默认是**使用/运营视角**：功能总览（一功能一行，行内拆前端/后端）、用户活跃度（DAU + 排行）、用户×功能偏好矩阵，并支持中文功能名、30 天窗口、全体/单用户与**端过滤（全部 / 仅前端 / 仅后端）**。

它解决的问题是：oneapi 后台只能看到 token / 模型级别的账单，无法回答“**哪个用户、用哪个功能、烧了多少 token**”。本系统在前后端各自的 LLM 出口处打点，把用量归因到 `user × capability × model × side`。

普通用户通过 **HMAC 签名的个人链接**（`scope=self`）只能看自己的用量；管理员可用 `ANALYTICS_ADMIN_TOKEN` 或 `scope=all` 签名链接看全体。

## 大白话运行逻辑

系统要为运维回答四个问题：**谁**（user）、用**什么功能**（capability）、走**前端还是后端**（side）、花了**多少 token / 多少钱**（model + cost）。

- **后端**：memory-service 每次经过 `LLMClient.generate()` 的调用，都会读取当前请求的异步上下文（用户 + 由 route 推断的能力），把响应里的真实 `usage` 记成一条 `side:'backend'` 事件。非 LLM 的 `/api/v1/*` 接口调用则单独计入接口频率表。
- **前端**：扩展每次经过 `handleLLMRequest`（含 OpenAI / Groq / Dify / Ollama）的调用，在**统一 try/catch**里打点：成功记真实/估算 token，失败记 `status:'error'` + `errorKind`（如 `http_401` / `timeout`）与 0 token。事件暂存到 `chrome.storage.local` 环形缓冲，由后台 `chrome.alarms` 定时（每 5 分钟）+ 缓冲达阈值即刷，**分批（100 条）**上报到 `POST /api/v1/usage/telemetry`，记成 `side:'frontend'` 事件。会议 OCR 旁路也已接入同一套打点。
- **成本**：入库和报表层都按**当前价目表**估算美元成本；价目表 = `model_pricing` DB 表（管理员可写）覆盖源码内编译的 seed 表，未知模型记 0 并打 `flagged` 标记，报表据此暴露“未计价用量”（见下方「成本估算」）。
- **报表**：读取每小时/每日 rollup 缓存，并合并“今天尚未 rollup”的原始事件；`byCapability` 默认按 **usageCount** 排序，并注入中文 `label`、`apiCallCount`、`userCount`、`bySide`（前端/后端分桶）、`failCount`、`features` 下钻、`errorBreakdown`（失败按 errorKind/side/capability 分桶）。全体视图额外返回 `byUser`、`userCapabilityMatrix`、`dailyActivity`。`backgroundLlmAlerts` 标出今天单日 token 超阈值的后台 feature（见「后台 LLM 燃烧告警」）。成本在报表层按当前价目表重算。

关键边界：**打点永远是 best-effort 副作用**——analytics 任何异常都被吞掉，绝不影响 LLM 主链路或 API 响应；成本是本地估算，不做 oneapi 对账。

后端 LLM 失败记一条 `status:'error'` 事件，错误归为 `auth / rate_limit / timeout / network / server / bad_request / unknown`；`meta.errorText` 保留 provider 原始错误文本前 200 字符，用于定位如“某天起某功能突然大量 bad_request”这类问题，不必现场加日志。以下三类失败**不再记 0 token**：
- 重试但最终成功／换到 fallback：每个被重试的 attempt 单独记一条 error（`meta.attempt` / `meta.willRetry:true`），不会被重复计成多次“功能调用”（`usageCount` 仍只算最终一次），但 token 层面能看出重试烧了多少
- `LLM_FALLBACK_ON_JSON_PARSE=true` 时 JSON 解析失败：调用本身已成功并被计费，记录真实（或估算并标 `tokensEstimated`）token，而不是 0
- 客户端超时（`errorKind:'timeout'`）：provider 端可能已经在生成甚至已计费，按发送的 prompt 估算 `promptTokens` 并标 `meta.billedEstimate:true`

若配置了 `LLM_FALLBACKS`，成功打点记**实际服务**的 model/provider。

后台（`ProactiveScheduler` 各循环）打的点会额外带 `meta.backgroundLlm:true`（对应 `usage_events.is_background` 列），使 `backgroundLlmAlerts` 能单独盯着这类流量。网页聚焦分析**只有一条路径、没有服务 key 兜底**（2026-08-25 决策，架构细节见 [memory_capture.md](memory_capture.md) 的「网页分析的 LLM 路径」）：

- 前端 `memory_capture` / feature `passive_webpage_memory_analysis`：唯一路径，用 Options「LLM」区块配置的 key（和消息分析共用同一份配置）。没有开关——没配置 LLM 时功能直接不可用（Options 在消息分析和网页分析两处都有引导提示，跳转到 LLM 配置区块），不会静默打后端账单
- 后端 `memory_capture` / route `/source-memory/webpage-analysis`：**扩展不再调用**，代码保留供自托管者直连这个 API 使用（`WEBPAGE_ANALYSIS_MODEL` 降档 / `WEBPAGE_ANALYSIS_DAILY_LIMIT` 配额只对直连这个 API 的调用方有意义）；官方扩展产生的这条 route 用量应趋近于 0，非零基本等于有人在直连测试或自建集成

## 个人链接（HMAC）

Token 格式：`base64url({u,s,exp}).HMAC-SHA256`，密钥为 `ANALYTICS_TOKEN_SECRET`（未设则回退 `ANALYTICS_ADMIN_TOKEN`）。

| scope | 谁能签发 | 报表行为 |
|-------|----------|----------|
| `self` | 任意已认证用户 `POST /usage/my-link`（用 `X-User-Id`） | 强制 `user=token.u`；`byUser`/`matrix` 为空；隐藏跨用户面板 |
| `all` | 仅携带 `ANALYTICS_ADMIN_TOKEN` 时签发 | 与 admin break-glass 相同：可看全体/下钻 |

默认有效期约 180 天。撤销方式：轮换 `ANALYTICS_TOKEN_SECRET`。既有 `ANALYTICS_ADMIN_TOKEN` 仍可作为全体报表入口。

扩展入口：

- Options / 记忆探索侧栏：「打开我的用量报表」→ `POST /usage/my-link` → 打开签名 dashboard
- esone.qiu Options 底部「管理入口」：全体用量报表 + 设备 key 批准页；Admin Token 配置同区

## 前后端如何看

前后端 capability **命名重叠**（如 `notification_center`、`meeting_pilot`），因此主表保持**一个功能一行**，行内分列：

- LLM 调用：前端 / 后端
- Token 前端 / Token 后端
- 失败调用（含失败率 tooltip）
- 堆叠条形图（前端色 + 后端色）

顶部「端」过滤器：`全部 / 仅前端 / 仅后端`。仅前端时接口调用列显示 `—`，使用频度改为纯 LLM 调用。点击功能行可下钻 `feature`（前端）或 `route`（后端）。`unknown` 行高亮，作为打点覆盖率健康指标。

### 如何查看网页分析与审计表的对应数据

- 迁移后（默认路径）网页分析走前端用户 key：切到「仅前端」，展开「记忆捕捉」，看 `passive_webpage_memory_analysis` 的调用/失败/token——计的是用户自己配置的 LLM，不是服务 key。
- 后端 `/source-memory/webpage-analysis` 应该几乎没有量：切到「仅后端」，展开「记忆捕捉」——官方扩展已不调用这条路由，非零说明有人在直连这个 API（自建集成/手动测试），不是"还没迁移的用户"。
- 消息分析可展开「消息分析」能力查看 feature 调用与 token。
- Dashboard 当前没有把 `feature/route × model × status × errorKind` 四个维度合成一张交叉表；`errorBreakdown` 只到 capability 粒度。需要精确复现某次审计里“某 feature 使用某 model、其中多少是 network 失败”的单表时，应查询 `${DATA_DIR}/analytics/usage.db` 的 `usage_events`；Markdown 文档是口径说明，不是历史数据文件。

### 后台 LLM 燃烧告警

`GET /usage/report` 的 `backgroundLlmAlerts` 字段列出**今天**（UTC，与请求的 range 无关）token 超过 `BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS`（默认 200,000）的后台 feature（heartbeat / weekly_dreaming / daily_consolidation / keystone_composer 等）。Dashboard 顶部会用红色横条渲染。这是为了在下一次“某个后台功能被默认打开一周烧掉几百美元”重演之前先被发现——见下节事故复盘。

## 成本治理与 2026-08 事故复盘

2026-08-17～25 的一轮成本排查（详细过程曾记录在 docs/progressing 的两份 plan，已随落地删除，git 历史可查）留下了以下**长期有效的口径与机制**，本节是代码注释与 guardrails 工具的引用落点：

**事故本体**：部署 env 把 `REFLECTION_ENABLED` 设成了 true（当时该变量 unset 默认还是 true），等于给全部 ~23 个注册用户强制开启自我反思。ReflectionResearcher 对每条 active 反思线程每 15 分钟心跳跑一次 LLM 研究，一个**零前台活动**的用户（2 条遗留 active 线程）实测烧 0.93M tok/周 ≈ $38/月；全员开启的 run-rate 约 **$350/月**。烧了一周（≈$100+）才被人工翻 Anthropic 账单发现。次要误判：用 self-scope dashboard 链接看数据，把单人 36% 的份额当成了全局，一度误诊为"打点缺了 $137"——实际全局口径对账后与平台账单**偏差仅 2.8%**，打点是准的。

**由此落地的机制**（哪个坏了先查哪个）：

1. **反思默认关**：env 改名 `REFLECTION_DEFAULT_ENABLED`（语义=未配置用户的默认值，不是硬开关；旧名 `REFLECTION_ENABLED` 兼容但打启动警告），unset 默认 **false**；前端 `defaultEnvConfig` 同步修掉了同一个"unset 默认 true"隐患。用户在 Options 自行开启，开启后 @15min 档每人约 $12–50/月（成本主要取决于有无 active 线程，与线程数量近似无关——`reflectionActiveTopicLimit` 封顶每拍处理量）。
2. **反思闲置安全网**：`REFLECTION_IDLE_PAUSE_DAYS`（默认 7）——用户连续 N 天无新消息时跳过（有 LLM 成本的）研究步骤，blocking/defer 等零成本簿记照常。防的就是"开了反思然后人走了，线程永远烧下去"。
3. **后台打点标记 + 单日告警**：上文 `backgroundLlmAlerts`。
4. **失败不再记 0 token**：重试 attempt、超时、JSON 解析失败都按真实/估算 usage 入账并带 `meta.errorText`（provider 错误原文前 200 字符）——事故期间 8/24 起 webpage-analysis 曾有一波 400 风暴因为没存错误文本而无法定位。
5. **生产 guardrails**：`node tools/eval-usage-analytics-guardrails.mjs`（见验证指引）。

**平台侧硬限额（已确认存在）**：Anthropic Console 上该 workspace 设有 **$200/月 spend limit**。撞限后 API 请求会被平台直接拒绝——2026-08-22～23 全平台大面积 0-token 失败、账单恰好冻结在 $200.04，与撞限行为吻合（当时 `errorText` 还没上线无法从打点确证；部署后如再撞限，失败事件的 `meta.errorText` 会直接给出平台的限额报错原文）。运维含义：月中看到"所有后端 LLM 突然全失败 + Console 账单不再增长"，先查限额；上调限额或等月初重置。

**测试账号治理**：调度器按 `${DATA_DIR}/users/` 目录枚举用户，废弃测试账号会被 heartbeat/keystone/daily/weekly 四个循环永久空转（有历史数据的账号哪怕零活跃也可能烧 ~$25-40/月）。清理工具：`node memory-service/tools/cleanup-test-users.mjs`（dry-run 默认，apply 移入 `deleted-users/` 可回滚；analytics 历史保留，tier-2 key 随目录吊销，但 service key + `X-User-Id` 的请求会自动重建目录）。2026-08-25 已清理 38 个（37 测试账号 + radar-poc）。

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

价目表分两层，DB 覆盖源码 seed：

1. **DB 层（`model_pricing` 表，管理员可写，实时生效）**——`memory-service/src/analytics/pricing.ts` 的 `setPricingOverrides()` 在启动时和每次写入后从这张表重新加载。写入后立即触发 `repriceFlaggedEvents()`，把该模型历史上所有被打了 `cost_flagged` 的行按新价重算，**不需要等下一次 rollup 或重启**。
2. **源码 seed（`MODEL_PRICING` 常量，随发版才更新）**——只有 DB 里没有该模型时才生效，含 `qwen3.6:latest`、`gpt-5.5`、`gpt-4o-mini`、`deepseek-*`、`llama3`、`claude-sonnet-4-6` 等。这层必然滞后于实际部署（历史上已经因为 oneapi 换模型而全员显示 $0 一次），是 DB 层存在的原因。

管理入口（均需 `ANALYTICS_ADMIN_TOKEN`）：

- `GET /usage/pricing`：合并后的完整价目表，每行标 `source: 'db' | 'builtin'`
- `PUT /usage/pricing`：批量 upsert，body 为 `{ "<model>": { inputPer1M, outputPer1M, cacheReadPer1M?, cacheWritePer1M?, note? } }`
- `GET /usage/pricing/unpriced?range=30d`：本实例窗口内**实际产生过用量、但仍无价格**的模型清单（含 token 量）——这是 `update-model-pricing` skill（`.claude/skills/update-model-pricing/`）唯一的输入源，只处理这个清单，不做全网模型价格库

## 数据与 API

集中式独立库：`${DATA_DIR}/analytics/usage.db`。

- `POST /usage/telemetry`：字段含 `status` / `errorKind`；用 `request.userId`。
- `POST /usage/my-link`：签发 HMAC 链接；`scope=self`（默认，需有效 `X-User-Id`）或 `scope=all`（需 Admin Token）。
- `GET /usage/report?range=24h|7d|30d&user=<id|all>&side=all|frontend|backend`（Admin Token 或签名 token）；响应含 `byModel[].flagged`、`errorBreakdown`、`backgroundLlmAlerts`
- `GET /usage/users`、`GET /usage/dashboard`（同上；self 强制只看本人；dashboard 页头会明确标注“此链接仅显示你个人的用量”，避免误当成全局口径）
- `GET /usage/pricing`、`PUT /usage/pricing`、`GET /usage/pricing/unpriced`（仅 Admin Token，见上）

这三个 GET 是自认证入口：带 `?token=` 或 `X-Analytics-Token` 时跳过全局 Bearer 鉴权（浏览器直接打开链接时没有 Authorization 头），token 校验仍在路由内完成。不带 token 时照旧走全局鉴权，返回 `authentication_required`；`POST /usage/telemetry`、`POST /usage/my-link` 不在豁免范围内。

环境变量：

- `ANALYTICS_ADMIN_TOKEN`：全体报表 break-glass
- `ANALYTICS_TOKEN_SECRET`：HMAC 密钥（空则回退 Admin Token）
- `ANALYTICS_RETENTION_DAYS`（默认 90）/ `ANALYTICS_API_RETENTION_DAYS`（默认 30）：原始事件保留期，`0` 表示不清理。启动时和每次 rollup 后各清一次；`usage_rollup_daily` 永久保留，报表最长只看 30 天
- `ANALYTICS_SQLITE_JOURNAL_MODE` / `ANALYTICS_SQLITE_SYNCHRONOUS`：只作用于 analytics 库，留空则继承服务级 `SQLITE_JOURNAL_MODE` / `SQLITE_SYNCHRONOUS`。线上（macOS Docker bind mount）设为 `DELETE` + `FULL`，让打点库牺牲并发换持久性，记忆库仍走 WAL
- `BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS`（默认 200000）：单日后台 feature token 告警阈值
- `WEBPAGE_ANALYSIS_MODEL`（默认空 = 继承主 provider 模型）/ `WEBPAGE_ANALYSIS_DAILY_LIMIT`（默认 300，`0` 不限）：`/source-memory/webpage-analysis` 后端兜底路径的降档模型与每用户每日配额，见迁移计划
- `REFLECTION_DEFAULT_ENABLED`（默认 `false`；旧名 `REFLECTION_ENABLED` 仍兼容，启动时打 deprecation 警告）/ `REFLECTION_IDLE_PAUSE_DAYS`（默认 7）：用户自我反思的默认开关与闲置安全网——用户开启后若连续 N 天无新消息活动，跳过（有 LLM 成本的）研究运行步骤

## 库损坏与修复

`api_call_events` 每天新增数万行，是全服务写入最频繁的表；放在 bind mount 上的 `usage.db` 一旦有页损坏，报表接口会整体不可用。

- 运行时行为：读到 `SQLITE_CORRUPT` 时 store 自锁，`/usage/report`、`/usage/users` 返回 503 `analytics_store_corrupt`（不再是裸 500），打点写入静默跳过，不影响被记录的业务请求
- 修复（在服务主机上，先停服）：`node memory-service/tools/repair-analytics-db.mjs`
  - 只依赖 node + `sqlite3` CLI，原文件先备份进 `analytics/quarantine/`
  - 默认用 `sqlite3 .recover` 抢救可读行；`--reset` 直接弃档重建；`--vacuum` 压缩健康库
- 无参数运行等于体检：打印 `quick_check` 与三张表行数

## 验证指引

- `npm --prefix memory-service run build` / `npm --prefix memory-service test`
- self token：`user=` 查询参数被忽略；无 byUser/matrix；看不到他人；页头显示“仅本人用量”提示
- all / admin token：全体视图正常；`GET /usage/pricing` 可读；self token 访问 `/usage/pricing*` 应 401
- 篡改/过期 token → 401
- Options「立即上报并自检」→ dashboard 切「仅前端」看分功能 Token / 失败列
- 前端打点上线依赖重新构建并发布扩展；历史用量无法回溯
- 补价验证：`PUT /usage/pricing` 后立刻查 `GET /usage/report`，之前 `flagged` 的模型应变成非零成本，无需重启/等 rollup
- 有些效果需要生产数据沉淀才能验证（例如后台燃烧告警要等真的有一天超阈值、反思闲置安全网要等一个真实闲置用户）——用 `node tools/eval-usage-analytics-guardrails.mjs` 定期复核，它对"还没到时间"的检查报 `pending` 而不是 `fail`；待验证清单见 `docs/progressing/to-verify.md`
