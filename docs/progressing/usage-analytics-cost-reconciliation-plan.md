# Usage Analytics 成本计价 & 平台账单对账 Plan

_创建: 2026-08-24 · 更新: 2026-08-25 v7（心跳零 token 原则 + 反思烧钱铁证定案 + radar-poc 已删）· 状态: gap 已结案；方案 C 已确认；Phase 3 不做_

> 执行进展：37 个测试账号 + radar-poc 已移入服务器 `data/deleted-users/`（两个时间戳目录，可回滚，观察后手动清空）；网页分析迁移细案见 [webpage-analysis-frontend-migration-plan.md](webpage-analysis-frontend-migration-plan.md)；心跳烧钱根因见 §6.6。

关联文档：[docs/features/usage_analytics.md](../features/usage_analytics.md) · [docs/self-hosting-memory-service.md](../self-hosting-memory-service.md)

---

## 0. 结论（TL;DR）

1. **成本 $0 根因**：线上模型全部不在 `MODEL_PRICING`（源码常量，已过时）。**决策：方案 C——DB 价目表 + Admin API + skill（只查本实例实际出现过的模型）**，见 §3。
2. **与 platform $200 的 gap：已结案。** Console 按 key 分组确认 $200.04 全在 memory-service key；admin 全局视图折算 claude-sonnet-4-6 30d = $204.63 ≈ 账单 list $210.57（**偏差 2.8%**）。打点是准的；此前差异来自 self token 只显示 esone.qiu 一人（36%），实际是 40 个 userId 的多用户服务。
3. **⚠️ Run-rate 警报**：工作日（8/18–8/21）全局每天烧 6.5–7.8M tok ≈ **$42–50/天**，周末回落。若维持现状，**月化 ≈ $900–1000**——MTD $200 只是新链路上线（~8/17）后的第一周。降本（§6）比对账更紧急。
4. **网页分析确认烧服务 key**（本次评审新问题）：链路为 contentScript → background.ts（缓存/退避）→ `MemoryServiceClient` → 后端 `/source-memory/webpage-analysis` → `PassiveWebpageAnalysisService` → `getLLMClient()`（.env 服务 key + Sonnet 4.6）。**options.tsx 的 OPENAI_API_KEY 只用于前端 `handleLLMRequest` 路径**（消息分析 5.63M tok/7d 等确实烧用户自己的 key）。历史前端直连版网页分析已迁到后端——现状与"用户触发的内容分析应该用用户 key"的期望相反，且它占后端量 55%，是头号烧钱方。
5. **Lens 读记忆不烧钱**（担心不成立）：`/context-recall` 7d 只有 17 次后端 LLM（0.01M tok）；passive 召回被 env 关闭，走 FTS/向量，无 LLM。

## 1. 对账数据（2026-08-24 实拉，admin 全局）

| 口径 | 数值 |
|---|---|
| Console key "Personal AI - memory service" MTD | billed $200.04 / list $210.57 |
| analytics 全局 30d Sonnet-4-6 | 31.55M tok → **$204.63**（偏差 2.8%，方向与 B4–B6 隐形计费一致） |
| analytics 全局 7d Sonnet-4-6 | 29.62M tok → $189.02（≈平台 8/17–8/22） |
| 7d 总量 / 失败 | 38.35M tok，19,668 次调用，失败 4,863（25%） |
| 全局逐日 | 8/17: 1.25M → 8/18–21: 6.5–7.8M/天 → 8/22–23(周末): 1.5M/0.12M → 8/24: 3.1M |

7d byUser：esone.qiu 13.94M（36%）> radar-poc 3.12M > Quintin.Xiao 2.94M > Swain.Zheng 2.29M > janice.zhang 1.98M > Karen.Ding 1.94M > …（~15 个真实用户 + 十余测试账号）

## 2. LLM 使用结构分析（7d 全局后端 32.1M 拆解）

| 消耗方 | tok | 份额 | 触发方式 | 定位判断 |
|---|---|---|---|---|
| `/source-memory/webpage-analysis` | 17.49M | **55%** | 用户浏览触发（前端发起、后端执行、服务 key、Sonnet 4.6） | ⚠️ 与"用户内容分析用用户 key"哲学冲突；模型档位过高 |
| `heartbeat` | 9.83M | 31% | 后台 15min × 全部注册用户 | 定位合理（沉淀加工），但 **31% 失败率**且对僵尸用户照跑 |
| keystone composer（记为 `unknown`） | ~0.57M | 2% | 后台 15min × 全部用户 | **B8**：无归因（见下） |
| `daily_consolidation` | 0.17M | 0.5% | 每日 cron | ✔ 合理 |
| `/composer/assist` | 0.08M | — | 用户触发 | 用户 key 候选 |
| `meeting_prep` / weekly_report / glip-markers / concerned-items | <0.15M 合计 | — | 混合 | 量小可忽略 |
| `/context-recall`（Lens） | 0.01M（17 次） | — | 用户触发 | ✔ 几乎无 LLM |
| `weekly_dreaming` | 0 | — | 每周 cron | ⚠️ **100% 失败**（5/5），功能实际死了 |

**B8（新 bug）**：`ProactiveScheduler.runKeystoneBriefComposer()`（ProactiveScheduler.ts:454）遍历用户调用 `KeystoneBriefComposerService.run()` 时**没有像 heartbeat 那样包 `runWithUsageContext`**，其 `generateJSON`（KeystoneBriefComposerService.ts:288）全部记成 `userId:unknown / capability:unknown`——正是报表里 unknown 用户 0.6M + unknown 能力 0.57M/889 次的来源。修复 = 包一层 context，XS。

**僵尸用户后台燃烧**（结构性问题）：调度器按 `${DATA_DIR}/users/` 目录枚举（`getRegisteredUserIds`），heartbeat/keystone（各 15min）+ daily + weekly 四个循环对**全部 40 个目录**跑：
- 空数据账号近零成本（heartbeat 早退，codex.* 每个仅 ~5 次/1.2k tok 每周）
- **有数据但零前台活动**的账号照样大烧：zong.zheng 0.96M/7d、webpage-memory-e2e 0.82M/7d（两者 apiCallCount=0，纯后台）→ 仅这两个账号 ≈ **$45–50/月**
- radar-poc 3.12M/7d 是活跃 POC 流量（`radar-poc.int.rclabenv.com` 部署），是否继续由 Esone 决定

## 3. 价目表：方案 C（已确认，同 v3）

`model_pricing` 表（input/output/cache 四价 + note + updated_at）→ 合并内置 seed；Admin API：`GET/PUT /usage/pricing` + `GET /usage/pricing/unpriced?range=30d`；skill `update-model-pricing` 只处理 unpriced 返回的模型（联网查牌价 → diff 确认 → PUT → 回读验证）；文档更新 usage_analytics.md + self-hosting README；dashboard：byModel flagged 高亮 + **self 链接页头明示"仅本人用量"**（本次误判直接原因）。

## 4. 打点盲区（B1–B8 汇总）

| # | 问题 | 修复 | 规模 |
|---|---|---|---|
| B1 | reprice 饿死（`est_cost_usd=0` + LIMIT 5000 被 0-token 行占坑） | 改 `cost_flagged=1` + 分页穷尽 | XS |
| B2 | byModel 无 flagged | 报表加字段 + dashboard 高亮 | S |
| B3 | pricing.ts 注释过时 | 随方案 C 删除 | — |
| B4 | generateJSON 解析失败：已足额计费却记 0-token | 记真实 usage + `errorKind:'json_parse'` | XS |
| B5 | 同 target 重试的失败 attempt 隐形 | attempt 级打点或 meta.attempts | S |
| B6 | 60s 超时 client abort 但服务端全额计费 | error 事件记估算 prompt + `billedEstimate` | S |
| B7 | backend 估算 fallback 无标记 | meta.tokensEstimated | XS |
| B8 | keystone composer 无 usage context → unknown | scheduler 循环包 `runWithUsageContext` | XS |

（cache 采集已砍：对账闭环证明 compat 端无 cache 计费差。）

## 5. 测试用户治理与删除副作用（本次评审新增）

**会持续烧吗？** 会，见 §2 僵尸用户段。空账号近零、有数据僵尸账号 ~0.5–1M/周/个，且 codex.* 一次性时间戳账号会无限累积目录。

**删除机制**：目前**没有删除 API**，删除 = 停服后移除 `${DATA_DIR}/users/<id>` 目录。副作用清单：

| 影响面 | 结论 |
|---|---|
| analytics 历史 | ✔ 保留（独立 usage.db，字符串 userId，无外键），报表不受影响 |
| 该用户记忆/dreams/reflections/reports | ✘ 全丢（目录即全部状态）——测试账号无所谓，真实用户需导出 |
| tier-2 pak key | ✔ 一并吊销（key hash 存在用户自己的 DB 里，`pak.<userId>.<secret>` 校验需查该库） |
| 自动重建 | ⚠️ tier-1 service key + `X-User-Id` 的请求会自动重建目录（`getContext` 建库）；bootstrap 对清空后的 namespace 可重新 claim。**删除只对"客户端已停用"的账号是永久的**；活跃 e2e 下次 run 会从零重建（反而干净） |
| e2e/evals 数据保留需求 | codex.\*：一次性 run id，无保留需求，直接删；webpage-memory-e2e：`desktop-app/scripts/webpage-memory-detection-check.mjs` 用的固定账号，每次 run 自 ingest 自检测，不依赖历史，可删除重建 |

**建议机制**（进改动清单）：
1. 测试账号命名约定（`e2e-` / `test-` / `codex.` 前缀），e2e run 结束自清理
2. `SCHEDULER_EXCLUDE_USER_PREFIXES` env：调度器四个循环跳过匹配前缀的用户（立刻止血僵尸燃烧）
3. `tools/cleanup-test-users.mjs`：列出候选（前缀 + N 天无 API 调用）→ dry-run 默认 → 确认后删目录
4. dashboard byUser 增加"疑似测试账号"分桶（按前缀），成本归因排除测试噪音

## 6. 网页分析前/后端职责拆解与迁移评估（v5 新增，回答评审问题）

**现状分工**（7d 数据佐证）：

| 端 | LLM 做什么 | 数据处理 | 量 |
|---|---|---|---|
| 前端（用户 key） | `entity_extraction`（`src/services/entityExtraction.ts`）：从 **Glip 消息**中抽实体/情感/优先级/动作——注意它服务的是消息捕捉，**与网页无关** | 消息文本 → 实体 JSON | 43 次 / 0.15M |
| 后端（服务 key） | `/source-memory/webpage-analysis` → `PassiveWebpageAnalysisService`：网页快照的**全部** LLM 分析——值得入库判定（skip/remember/update_existing）+ durableFacts + entities + actionItems + enrichmentHints + shouldNotify | 前端截取正文（≤12k 字符）→ 单次 `generateJSON` | 5,963 次 / 17.49M |
| 前端（无 LLM） | 编排：去重缓存、失败退避（`background.ts`）、候选提交（`/candidates/score`、`/candidates/selection`——后端纯打分，无 LLM） | — | — |

即：**网页内容的 LLM 分析 100% 在后端服务 key 上**，前端只做编排；前端 LLM 只负责消息类抽取。

**能全迁前端吗？能，且比 v4 预想的干净**——关键发现：`/source-memory/webpage-analysis` 路由是**无状态的**（跑完 LLM 直接把结果返回前端，不落库；候选入库由前端后续调用驱动），prompt builder（`buildPassiveWebpageAnalysisPrompt`）自包含，前端已有 `callLLMJsonAPI` + 退避/缓存全套设施。迁移 = 前端引入同款 prompt + 直调用户 key，后端路由保留。

**Side effects 清单**：

| # | 影响 | 评估 |
|---|---|---|
| 1 | 模型质量：用户 key 多为 gpt-5-nano 档 vs Sonnet 4.6 | 筛选+短抽取任务 nano 大概率够用（消息分析已在 nano 上跑）；建议迁移前用同一批页面 A/B 抽查 durableFacts 质量 |
| 2 | 未配置前端 key 的用户 | 网页分析对其停摆。两种处理：Options 引导配 key（推荐，符合"用户内容用户付费"），或保留后端降档模型兜底（又回服务 key，不推荐默认开） |
| 3 | Prompt 迭代速度 | `PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION` 从服务端热更变成扩展发版节奏 |
| 4 | desktop-app 依赖 | `webpage-memory-detection-check.mjs`（e2e）与未来 desktop 捕捉走后端路由——**路由保留**（降档模型），仅供 desktop/测试 |
| 5 | 安全 | 注入防护 prompt 原样带走；网页内容改发用户自选 LLM endpoint（用户自己配置，可接受） |
| 6 | Analytics | side 从 backend 变 frontend，telemetry 已覆盖，报表继续可见（capability 仍是 memory_capture） |

**v5 修订推荐**（替代 v4 的"短期 C"）：**主方案 = 迁前端用户 key**（v4 对选项 A 的"架构回退"判断被路由无状态的事实推翻，且 Esone 已明确"用户触发的内容分析应该用用户 key"的哲学）；后端路由保留 + 降档模型，仅供 desktop/e2e。该项迁移直接把 ~55% 后端量从服务 key 上移走（≈$120+/月按 workday run-rate）。

## 6.5 其他降本议题

1. **僵尸/测试用户止血 ✅ 已执行（2026-08-25）**：服务器实际有 **61 个用户目录**（远超 analytics 可见的 40），已用 `tools/cleanup-test-users.mjs` 移除 **37 个测试账号**（webpage-memory-e2e、codex.* ×13、memory-capture-* ×10、demo/tester/deploy-probe/e2e.user/surface.verify/verify.lock.user/empty.export.verify/eval-* /meeting-pilot/current.user/default/ai-bear-selftest），全部移入 `deleted-users/2026-08-25T06-59-32-826Z/` 可回滚。佐证：这些目录 last modified 全是当天——后台循环每天都在碰它们。保留：全部真实用户 + Esone（疑似本人别名）+ radar-poc（$85/月，是否停待 Esone 决定）
2. **zong.zheng 心跳烧钱根因查实（v6 修正 v5 的蒸馏假设）**：服务器 DB 取证——蒸馏队列干净（2 个 job 全 succeeded），真凶是 **2 条 `status=active` 的 `reflection_threads`**：ReflectionPlanner 每拍为活跃线程跑 LLM（~150 次/天、~1.3k tok/次），**用户零前台活动也永不休眠**。改进方案（新 #18）：⑴ reflection 线程 idle 休眠——用户 N 天（建议 7）无前台 API 活动时自动 pause 线程，用户回来时 resume；⑵ 每线程每日 LLM run 上限；⑶ heartbeat 级别的 idle 用户降频（15min → 1h+）作为兜底
3. **8/22–23 断供窗口 + 8/24 起的 bad_request 新故障（v6 更新）**：errorKind 取证——8/23 的 1,663 次失败中 1,434 次是 heartbeat（errorKind=unknown，跨所有用户的 provider 级故障或 JSON 风暴）；**8/24 起新增 `bad_request` 且持续中（458 次集中在 webpage-analysis，今天仍在发生）**——分布不均匀（heartbeat 仅 22 次、其他调用成功），**不符合撞限特征**（撞限会全灭），疑似特定页面 payload 触发 400。$200 撞限假设弱化但仍需 Console 确认限额设置。**阻塞点：失败打点没存 provider 错误文本，无法定位 400 根因**——新 **B9**：`recordBackendFailure` 的 meta 存错误消息前 200 字符
4. **weekly dreaming 复诊（v5 结论保持）**：只运行过一次（8/23）恰在断供窗口；调度器 ~8/17 才上线。已加固 `timeoutMs: 120_000`（构建通过）；8/30 验证
5. **fallback 风暴复盘**：30d 内 deepseek-r1 12,005 次 + ringcentral-deepseek-v3.2:8b 5,057 次 0-token 失败（8 月上旬），确认 `LLM_FALLBACKS` 已修，考虑连续失败熔断告警

## 6.6 心跳零 token 原则（v7 新增，Esone 指令：所有心跳程序不应消耗 token）

### 烧钱根因定案（服务器取证，证据链完整）

心跳历史烧钱（8/18–8/22 每天 **1.7–2.8M tok**，约 $11–18/天）的主犯是**反思链**：`ReflectionPlanner → ReflectionThreadService → ReflectionWorker/ReflectionResearcher`。铁证：

- zong.zheng 的 `reflection_research_attempts` 表有 **595 条**，时间窗 **8/18 08:10 → 8/24 04:31**，与其心跳 LLM 事件（~150 次/天，8/24 04:31 后归零）完全重合
- 当前部署 `.env` 为 `REFLECTION_ENABLED=false`，但 `.env` mtime = 8/25 12:40——**旧部署反思是开启的**，8/24–25 的重新部署关闭后，心跳 token 从 1.7M+/天骤降至 ~120k/天（**-94%**）
- HeartbeatLoop 代码 8 月无改动——下降来自 env 变更，不是代码修复；这意味着**只要 env 再打开，烧钱立即复燃**（zong 的 2 条 active 线程还在）

### 现行代码心跳 LLM 出口全量审计

| 步骤 | LLM？ | 说明 |
|---|---|---|
| microConsolidate（实体 mention/去重） | ✔ 零 token | 纯 SQL |
| checkProfileDirty → ProfileManager | ✔ 零 token | 模板生成 USER_CORE.md，无 LLM |
| 冲突检查 / watched projects / checkUpcomingDeadlines / dream digest 候选 | ✔ 零 token | 纯 DB 查询 |
| ProactivityPolicy.filterNotifications / 通知投递 | ✔ 零 token | 规则过滤 + Bot 发送 |
| ActionExecutor.runDueActions | ✔ 零 token（服务 key 视角） | 委派 OpenClaw，烧 OpenClaw 账户 |
| **反思链（Planner→Worker/Researcher）** | ⚠️ **LLM** | env 已关；历史主犯；特例决策 ① |
| **蒸馏链（DistillationWorker.runDueJobs(2)）** | ⚠️ **LLM** | 事件驱动（捕捉时 enqueue、同 hash 去重、成功不重跑），闲置用户零消耗；当前 ~120k tok/天（约 $0.8/天，全部来自活跃用户新捕捉）；特例决策 ② |

### 特例决策（待 Esone 定频次）

**① 反思链——已决策（2026-08-25 Esone）：保持默认禁用（env），用户在 Options 自行开启，开启后按 D 档（15 分钟）运行**；Options 开关旁标注预估月成本（#21）。原选项表留档：

| 选项 | 频次 | 成本估算（每条 active 线程） | 说明 |
|---|---|---|---|
| A 保持关闭 | — | $0 | 现状 |
| B 事件驱动 + 日上限 | 新证据到达才 step，每线程每日 ≤4 次 | ~$1/月 | 推荐：贴合"反思由新信息触发"的语义 |
| C 每日一批 | 随 daily consolidation（23:00）跑一轮 | ~$0.5/月 | 最省，反思时效差 |
| D 恢复 15min 心跳步进 | 96 拍/天 | **~$16/月/线程**（zong 实测口径） | 旧行为，不建议 |

配套（无论选哪个）：线程 idle 休眠——用户 N 天无前台活动自动 pause 全部线程（zong 的 2 条 active 遗留线程属清理对象）。

**② 蒸馏链——已决策（2026-08-25 Esone）：保留现状，不搬家。** 原则放宽为"心跳内的 LLM 必须是事件驱动、有归因、有守卫的显式 job"而非严格零 token。蒸馏符合：捕捉才产生 job、同 hash 去重、闲置用户零消耗、~$0.8/天且全部可归因到捕捉行为。原"移独立 worker"方案删除。

**反思开启现状（2026-08-25 服务器核实）：0 个用户开启。** 5 个有 config.json 的用户中 esone.qiu / patricia.li / zora.zheng 显式 false，Alison.Lan / Swain.Zheng 未设置（走 env 默认 false），其余 18 人无 config.json 同走默认——**反思当前实际消耗 $0**，下方 D 档成本表是"若用户自行开启"的预估值。

### 反思配置语义与 D 档成本推算（v8 新增，回答 Esone 评审问题）

**`REFLECTION_ENABLED` 的语义 = 未配置用户的默认值，不是全局硬开关**（`runtimeConfig.ts`: `persisted.reflectionEnabled ?? appConfig.reflectionEnabled`，用户 config.json 可覆盖）。Options 页面已有 `SELF_REFLECTION_ENABLED` + `SELF_REFLECTION_HEARTBEAT_MINUTES` 用户级配置并通过 `/config` 持久化——**"全局默认禁用 + 用户 Options 自行开启"正是现状设计**，8/18–8/24 的事故是部署 env 把默认值设成了 true（等于全员开启）。改进（#21）：env 改名 `REFLECTION_DEFAULT_ENABLED`（旧名保留 alias + 启动 warning），消除"看起来像硬开关"的歧义。

**D 档（15min 心跳步进）按用户实测成本**——基础数据取 8/18–8/22 五天全员开启窗口的真实 heartbeat token（Sonnet $3/$15 折算，×6 换算为月；含少量蒸馏份额，zong 为纯反思参考值）：

| 用户 | active 线程 | 消息量 | 5d tokens | **月成本 @D** |
|---|---|---|---|---|
| esone.qiu | 899 | 14,339 | 1.96M | **~$105** |
| Quintin.Xiao | 2 | 33 | 1.30M | ~$49 |
| Swain.Zheng | 3 | 43 | 1.07M | ~$37 |
| zong.zheng（零活跃参照） | 2 | 779 | 0.93M | **~$38** |
| Alison.Lan | 3 | 38 | 0.70M | ~$27 |
| sophia.lin | 2 | 446 | 0.70M | ~$26 |
| eden.qu | 2 | 4 | 0.63M | ~$26 |
| janice.zhang | 2 | 22 | 0.45M | ~$18 |
| Karen.Ding | 2 | 73 | 0.21M | ~$12 |
| patricia.li | 25 | 2,392 | 0.05M | ~$3（线程多但几乎没轮到，lease/晚创建） |
| 其余 13 人 | 0 | <110 | ≈0 | ≈$0（无线程可反思） |

解读：**成本由"有无 active 线程"决定，与线程数量近似无关**（`reflectionActiveTopicLimit=6` 封顶每拍处理量；esone 899 线程 vs Quintin 2 线程调用量同量级），每个开启用户约 **$12–50/月**，esone 本人因 prompt/completion 更长约 $105/月；**全员开启 ≈ $350/月**（这就是事故周的 run-rate 主成分）。默认关 + 自主开启下成本可控，配合方案 C 落地后 byUser 成本排行可直接归因到人。

### 防回归守卫（本次事故一周烧掉 ~$100 才被发现，必须做）

1. **打点标记**：LLMClient 检测 usage context `feature='heartbeat'`（及未来的 worker loop feature）时给事件打 `meta.backgroundLlm: true`
2. **dashboard 告警**：心跳（或任何后台 feature）单日 token 超阈值（建议 200k）时报表顶部高亮警示
3. **部署 checklist**：env diff 审查进部署流程——本次根因是部署 env 与预期不符（反思被开着跑了一周没人知道）

## 7. 改动清单（v4）

| # | 改动 | 文件 | 规模 | 优先级 |
|---|---|---|---|---|
| 1–3 | 方案 C：pricing 表 + Admin API + skill | analytics/, routes/usage.ts, .claude/skills/ | M+S+S | **P0** |
| 4 | byModel flagged + 未计价提示 + self scope 页头 | routes/usage.ts, dashboard.ts | S | P1 |
| 5 | B4 json_parse 记真实 usage | llm/LLMClient.ts | XS | P1 |
| 6 | B5/B6/B7 attempt/timeout/估算标记 | llm/LLMClient.ts | S | P2 |
| 7 | B1 reprice 饿死 | AnalyticsStore.ts | XS | P1 |
| 9 | errorKind 暴露到报表 | routes/usage.ts, dashboard | S | P1 |
| 10 | executor 运行可见性 | executors | M | P3 |
| 11 | 文档更新 | docs | S | P0 |
| 12 | **B8 keystone composer 归因** | ProactiveScheduler.ts | XS | **P1** |
| 13 | 测试账号清理 **✅ 已执行**（37 个目录移入 deleted-users/，观察后手动清空）；调度器排除前缀（防新测试账号再烧）待做 | ProactiveScheduler.ts | S | P2（余项） |
| 14 | **webpage-analysis 迁前端用户 key**——细案见 [webpage-analysis-frontend-migration-plan.md](webpage-analysis-frontend-migration-plan.md)（Phase A 前端直连 / B 后端降档+配额 / C 收尾） | src/（扩展）+ PassiveWebpageAnalysisService | M | **P0（最大降本）** |
| 15 | heartbeat idle 降频（兜底） | ProactiveScheduler.ts | S | P2 |
| 16 | weekly dreaming：**✅ 已加固**（timeoutMs 120s，构建通过）；8/30 验证 | GenerativeReplay.ts | XS | 已做 |
| 17 | Console 确认 workspace spend limit 设置（bad_request 取证后撞限假设已弱化，仍需排除） | 运维 | — | P1 |
| 18 | **心跳 LLM 治理**（§6.6，范围已收窄）：防回归守卫（backgroundLlm 标记 + dashboard 单日阈值告警）+ 线程 idle 休眠（用户 N 天无活动 pause 线程）。蒸馏保留现状（已决策）；反思保持默认关、用户 Options 自开 @15min（已决策，配合 #21 成本标注） | LLMClient, dashboard, ReflectionPlanner | S | **P1** |
| 19 | **B9：失败打点存 provider 错误文本前 200 字符**（定位 8/24 起 webpage-analysis bad_request 的前置条件） | LLMClient.ts recordBackendFailure | XS | **P0（当前故障排查被阻塞）** |
| 20 | radar-poc 删除 **✅ 已执行**（8/25 移入 `deleted-users/2026-08-25T07-11-48-205Z/`，19.7MB） | — | — | 已做 |
| 21 | env 改名 `REFLECTION_ENABLED` → `REFLECTION_DEFAULT_ENABLED`（旧名 alias + 启动 warning）；Options 反思开关旁标注预估月成本（~$12–50/月 @15min） | config.ts, .env.example, options.tsx | XS | P1 |

顺序：**19（解锁 bad_request 排查）→ 14 Phase B（后端降档，立即降烧钱速度）→ 14 Phase A（迁前端）→ 1+2+3+11（成本可见）→ 18 + 12 + 5 + 7 → 4+9 → 15 → 6 → 10**。

## 8. 明确不做

- Phase 3 对账面板；账单级自动对账；全网价格库；cache 采集；替 OpenClaw/CLI 记账
- webpage-analysis 选项 A（回前端直连）——架构回退
