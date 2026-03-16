---
name: continuous-reflection-redesign
overview: 将当前一次性 dream/reflection 体系改造成“主题线程式持续反思 + 离线梦境重放 + 高阈值主动打扰”的分层架构，复用现有记忆、真值维护与通知能力，同时补齐 action 执行闭环。
todos:
  - id: normalize-runtime-primitives
    content: 先统一 notification / checkpoint / runtime config 等基础运行时原语
    status: pending
  - id: wire-online-reflection
    content: 把现有 OnlineReflection 真正接入 /ask 后台链路，并产出线程候选信号
    status: pending
  - id: design-thread-model
    content: 定义 reflection thread / run / evidence link / worker checkpoint 数据模型
    status: pending
  - id: upgrade-action-runtime
    content: 基于现有 proposed_actions 升级 action runtime，并接入 TruthMaintainer / OpenClaw
    status: pending
  - id: ui-surface-plan
    content: 在复用现有 Dreams / Decisions 页面前提下补齐 reflection threads 与 actions 视图
    status: pending
isProject: false
---

# 持续反思与梦境系统改造计划

## 目标

把当前以 `dreams/*.md` 和 `reflections/*.md` 为主的一次性产物，升级为“围绕主题持续迭代”的长期思考系统：

- 默认低打扰，把思考结果沉淀到特定目录的 Markdown
- 只在高紧急/高置信 action 时主动 Bot 打扰用户
- 下一轮思考显式继承上一轮结果，而不是每次从零开始

## 架构结论

采用“分层共享”而不是完全分开或完全共用：

- 共享底层：记忆库、`TruthMaintainer`、主题证据检索、通知策略、决策中心
- 分开上层：
  - `Reflection Worker`：分钟级/事件触发，持续推进同一主题
  - `Dream Worker`：日/周级，做跨主题重放、关联发现、低置信推演
- 分开产物：
  - `reflection-threads/`：长期线程式反思文档
  - `dreams/`：离线梦境/重放产物，默认不直接作为真值依据
  - `actions/` 或 action 队列表：给程序/用户的动作闭环

### 两套上层系统的职责划分

- `思考反思`：分钟级或事件驱动，围绕单一主题持续推进，显式继承上一轮思考结果，负责把主题逐步想清楚并产出 action / open questions / hypothesis。
- `梦境重放`：日级或周级离线任务，从高显著主题或线程池中做跨主题重放、联想和模式发现，负责提供新的视角、潜在关系、风险和待验证假设。
- 两者不是完全独立系统，而是共享同一套底层：记忆库、真值层、决策中心、通知策略、ActionExecutor。
- 梦境重放的产出可以反向喂给思考反思，作为“新主题候选”或“已有主题的新证据/新假设来源”。

### 梦境重放在引入反思系统后的定位

- 梦境重放保留原本的核心职责，即对高显著主题做离线重放和关联发现；这部分是现有 `[memory-service/src/core/GenerativeReplay.ts](memory-service/src/core/GenerativeReplay.ts)` 的自然演进。
- 在有了主题线程式反思后，梦境重放不再承担“长期推进某个主题直到收敛”的职责，而是承担：
  - 给反思线程提供新的关联线索
  - 发现跨主题模式
  - 提供低置信度候选关系与潜在风险
  - 作为未来 recall / context-match / ask 的辅助上下文来源
- 梦境产物应继续带 `dream / inferred / low-confidence` 标记，允许影响未来查询召回，但不应与已确认事实同权。

```mermaid
flowchart TD
  ingest[IngestAndRecall] --> topicThreads[TopicThreads]
  topicThreads --> reflectionWorker[ReflectionWorker]
  topicThreads --> dreamWorker[DreamWorker]
  reflectionWorker --> reflectionMd[reflection_threads_md]
  dreamWorker --> dreamMd[dreams_md]
  reflectionWorker --> actionQueue[ActionQueue]
  dreamWorker --> actionQueue
  actionQueue --> actionPolicy[ActionPolicy]
  actionPolicy --> silentStore[SilentArtifacts]
  actionPolicy --> decisionCenter[DecisionCenter]
  actionPolicy --> botPush[BotPushHighThreshold]
  decisionCenter --> truthMaintainer[TruthMaintainer]
  truthMaintainer --> topicThreads
```



## 基于当前代码的校正结论

这份 redesign 不应该从零新造一套系统，而应该建立在现有 `memory-service` 与扩展侧已经落地的能力上做“线程化 + 动作闭环”升级。当前代码里已经存在并应直接复用的能力有：

- 后端 Bot 推送：
  - `[memory-service/src/utils/botSender.ts](memory-service/src/utils/botSender.ts)`
- 梦境重放与周报：
  - `[memory-service/src/core/GenerativeReplay.ts](memory-service/src/core/GenerativeReplay.ts)`
  - `[memory-service/src/core/WeeklyReporter.ts](memory-service/src/core/WeeklyReporter.ts)`
  - `[memory-service/src/routes/dreamDigest.ts](memory-service/src/routes/dreamDigest.ts)`
  - `[memory-service/src/routes/weeklyReport.ts](memory-service/src/routes/weeklyReport.ts)`
- 决策中心与待确认请求：
  - `[memory-service/src/routes/confirmRequests.ts](memory-service/src/routes/confirmRequests.ts)`
  - `[src/modals/components/DecisionCenter.vue](src/modals/components/DecisionCenter.vue)`
- 梦境洞察与上下文命中：
  - `[src/modals/components/DreamInsights.vue](src/modals/components/DreamInsights.vue)`
  - `[memory-service/src/routes/contextMatch.ts](memory-service/src/routes/contextMatch.ts)`
  - `[src/contentScriptWebIntelligence.ts](src/contentScriptWebIntelligence.ts)`
- `/ask` 偏好注入：
  - `[memory-service/src/routes/ask.ts](memory-service/src/routes/ask.ts)` 已经把 `USER_CORE.md` 和 `user_profile_items` 中的 active preference 注入 system prompt

因此，本计划需要明确以下校正点，避免和现有实现冲突：

### 校正 1：连续反思的入口不是重写 `/ask`，而是补齐现有 `OnlineReflection` 的调用

- `[memory-service/src/core/OnlineReflection.ts](memory-service/src/core/OnlineReflection.ts)` 已存在，但当前仓库里没有实际调用点。
- 连续反思的第一步不是再设计一个“新的 ask 后处理能力”，而是把现有 `OnlineReflection` 接到 `/ask` 响应后，作为线程规划器的信号源。

### 校正 2：所有分钟级 worker 都不能依赖进程内字段保存游标

- 当前 `[memory-service/src/core/ProactiveScheduler.ts](memory-service/src/core/ProactiveScheduler.ts)` 每个 heartbeat 周期都会重新 `new HeartbeatLoop(...)`。
- 而 `[memory-service/src/core/HeartbeatLoop.ts](memory-service/src/core/HeartbeatLoop.ts)` 里的 `lastHeartbeat` 是实例字段，不会跨周期持久化。
- 这说明后续的 `ReflectionPlanner` / `ActionExecutor` / `Dream callback scanner` 都不能把 checkpoint 放在 class 实例里，必须持久化到 DB。

### 校正 3：通知链路必须先统一存储，再谈新的 action UX

- 生产侧现在写的是 `notification_records`：
  - `[memory-service/src/core/HeartbeatLoop.ts](memory-service/src/core/HeartbeatLoop.ts)`
  - `[memory-service/src/core/WeeklyReporter.ts](memory-service/src/core/WeeklyReporter.ts)`
  - `[memory-service/src/core/TruthMaintainer.ts](memory-service/src/core/TruthMaintainer.ts)`
- 但消费侧 `[memory-service/src/routes/notifications.ts](memory-service/src/routes/notifications.ts)` 读的是 `notifications` 表，和现有 migration 不一致。
- 连续反思要引入更多主动提醒、待处理 action、Bot push，这个不一致必须先解决，否则新设计会建立在不稳定的通知基础上。

### 校正 4：不要再并存第二套动作表

- 现有 schema 已经有 `proposed_actions`，但基本未被消费：
  - `[memory-service/src/storage/migrations/001_initial.sql](memory-service/src/storage/migrations/001_initial.sql)`
- 这次 redesign 不建议同时保留“旧 `proposed_actions` + 新 `action_queue`”两套平行表。
- 更合理的方向是：实现层升级 `proposed_actions` 为统一 action runtime；概念层仍可称为 action queue。

### 校正 5：前端已有 Dreams / Decisions 页面，应在其上增量扩展

- `[src/modals/memory-exploring-entry.ts](src/modals/memory-exploring-entry.ts)` 已经有 `/dreams` 与 `/decisions` 路由。
- redesign 的前端部分不应再把这两个能力当成“待新建”，而应新增：
  - `/reflection-threads`
  - `/reflection-threads/:id`
  - 可选 `/actions`
- 并把现有 `DreamInsights.vue` 定位为 `Dream Replay` 浏览页，而不是连续反思页。

## P0 基础改造

在进入线程化反思、梦境回流和动作执行之前，建议先补齐以下基础运行时原语。

### P0.1 持久化 worker checkpoint / lease

新增两个底层表：

- `worker_checkpoints`
  - `worker_key`
  - `cursor_value`
  - `cursor_type(timestamp|id|json)`
  - `updated_at`
- `worker_leases`
  - `worker_key`
  - `owner_id`
  - `lease_until`
  - `updated_at`

用途：

- `HeartbeatLoop` / `ReflectionPlanner` / `ActionExecutor` / `Dream callback scanner` 都从这里读取和更新游标
- 后续即使保留单实例部署，也能避免当前“实例字段丢失状态”的问题
- 如果未来进入多实例，这两张表也可作为最小分布式锁 / 选主能力

### P0.2 统一 notification repository

建议新增：

- `memory-service/src/repositories/NotificationRepository.ts`

职责：

- 统一对 `notification_records` 做增删改查
- 替换 `[memory-service/src/routes/notifications.ts](memory-service/src/routes/notifications.ts)` 中对 `notifications` 表的直接访问
- 让 `HeartbeatLoop` / `WeeklyReporter` / `TruthMaintainer` 也走同一个 repository

过渡策略：

- 短期可以保留 `/notifications` API 路径不变，只改底层表
- 如需兼容老逻辑，可临时提供一个 `notifications` view 映射到 `notification_records`，但最终应只保留一个真实来源

### P0.3 把 `OnlineReflection` 接入 `/ask`

建议在 `[memory-service/src/routes/ask.ts](memory-service/src/routes/ask.ts)` 中采用 fire-and-forget 方式触发：

- 主响应返回后异步调用 `OnlineReflection.reflect(...)`
- 第一阶段 `usedItemIds` 可先取 top-N recalled items（例如前 5 条），后续再升级为基于 answer grounding/citation 的精确集合
- `OnlineReflection` 除了继续做 memory reinforce / preference extraction / fact extraction，还要新增可选产物：
  - `reflectionSignal`
  - `candidateTopicKeys`
  - `proposedFollowups`

### P0.4 扩展目录、索引分类与配置链路

连续反思需要先补齐这些基础设施：

- `[memory-service/src/storage/UserDataManager.ts](memory-service/src/storage/UserDataManager.ts)`
  - 增加 `reflection-threads/`
  - 可选增加 `reflection-threads/runs/`
- `[memory-service/src/routes/userFiles.ts](memory-service/src/routes/userFiles.ts)`
  - 允许读取 `reflection-threads`
- `[memory-service/src/core/MarkdownManager.ts](memory-service/src/core/MarkdownManager.ts)`
  - `inferSourceType()` 识别 `reflection-threads/`
- `[memory-service/src/routes/contextMatch.ts](memory-service/src/routes/contextMatch.ts)`
  - 搜索范围从 `reflections/` + `dreams/` 扩展到 `reflection-threads/` + `dreams/`
- `[memory-service/src/routes/config.ts](memory-service/src/routes/config.ts)` / `[memory-service/src/config.ts](memory-service/src/config.ts)`
  - 扩展 reflection / OpenClaw 相关配置
  - 同时把 `openClawApiKey` 列入敏感字段，不在前端回显

## 设计重点

### 1. 主题线程替代一次性反思

新增主题线程状态层，而不是只写按日期/按主题+日期的单次文档。
核心建议新增：

- `reflection_threads`：主题主表
- `reflection_runs`：每次思考的迭代记录
- `topic_memory_links`：把 message/chunk/entity/property/dream/action 统一挂到同一主题

建议 `reflection_threads` 至少包含：

- `id`, `topic_key`, `title`, `status(active|paused|closed|dropped)`
- `priority`, `salience`, `reflection_count`
- `current_hypothesis`, `open_questions_json`
- `next_reflection_at`, `last_reflected_at`
- `continue_reason`, `closure_reason`

### 1.1 思考反思如何产生新主题

建议新主题来源至少分为 5 类，而不是只来自消息：

- `new_evidence`：新消息、反思、实体变化、项目更新触发新的主题候选
- `dream_callback`：梦境重放提出了新的关系、风险、模式，创建新主题或唤醒旧主题
- `conflict_callback`：`TruthMaintainer` 发现事实冲突，自动生成“待确认主题”或挂靠到已有主题
- `user_triggered`：用户手动标记“值得继续想”的内容
- `scheduler_revisit`：已有主题到了 `next_reflection_at`，即使没有新消息也继续推进

建议新增 `ReflectionPlanner` 统一做主题归并与去重：

- 如果新证据命中已有主题，则追加为该主题的新一轮输入
- 如果只是相关但不完全重合，则创建子主题或 sibling topic
- 如果是显著且独立的新问题，则创建新的 `reflection_thread`
- 如果超出 active topic 上限，则低优先级主题不进入 active，而是 `paused` 或直接丢弃

### 1.2 思考反思的上下文配比

建议不要让每轮反思从零开始，也不要让上一轮内容无限压倒新证据，而是做分层上下文：

- `上一轮线程摘要`：最高优先级，作为本轮 continuity backbone
- `最近几轮关键 run 摘要`：补充演化轨迹
- `本轮新增证据`：决定为什么现在要继续想
- `主题级长期证据`：包括历史 message / reflection / dream / property / relationship
- `全局背景/用户画像/项目上下文`：只在相关时加入

建议的初始权重策略：

- 40%：上一轮线程摘要 + 当前 hypothesis + open questions
- 30%：本轮新增证据
- 20%：主题历史高价值证据（最近几轮 + 关键转折）
- 10%：全局背景（用户画像、项目约束、长期规则）

具体实现不必做成固定数值权重，而是做成 prompt budget 配额：

- 必带：上一轮摘要、当前状态、未解决问题
- 强优先：本轮新增证据
- 选择性：梦境回调、长期背景、较旧 run

关键原则：

- 上一轮内容要足够重，保证“延续性”
- 新证据也必须有足够占比，避免一直原地复读
- 梦境产物默认是辅助上下文，不直接压过真实证据和已确认真值

### 2. Markdown 产物改成“持续更新的主题文档”

你提出的方向是对的，建议每个主题有一个长期 Markdown 主文档，而不是每轮都只新建独立文件。
建议目录：

- `[memory-service/data/users/<user>/reflection-threads/](memory-service/data/users/default/)` 下按 `topic-slug.md`

每个主题文档建议结构：

- Topic 概览
- 当前假设
- 已确认结论
- 未解决问题
- 最新证据
- 历次思考记录（追加）
- 下一轮要继续思考什么
- 当前状态：`continue / waiting / closed / dropped`
- 产出的 action：`for_system / for_user / for_later`

同时保留 `reflection_runs` 做结构化 run 记录，Markdown 只作为人可读视图。

### 3. 限制同时反思话题数

需要有“工作记忆容量”概念，避免无限并发主题。
建议：

- `active topics` 设上限，例如 5-10 个
- 按 `priority + salience + recency + unresolvedness` 排序
- 低优先级主题进入 `paused`
- 长时间无新证据且无 action 的主题进入 `dropped` 或 `archived`

这部分可复用：

- `[memory-service/src/core/HeartbeatLoop.ts](memory-service/src/core/HeartbeatLoop.ts)` 作为分钟级调度入口
- `[memory-service/src/core/ProactivityPolicy.ts](memory-service/src/core/ProactivityPolicy.ts)` 的评分思路扩展成 topic 排队策略

但要注意：

- 不要复用 `HeartbeatLoop.lastHeartbeat` 这种实例内状态
- `ReflectionPlanner` 需要通过 `worker_checkpoints` 自己维护“上次扫描到哪里”
- `ProactiveScheduler` 可以继续当总调度器，但具体 topic scan / action scan / dream callback scan 的 cursor 必须持久化

### 4. 定义“思考结束”条件

建议不是单一条件，而是满足任一闭环：

- 核心问题已被验证/证伪
- 连续 N 轮没有新增证据/新假设
- 没有 action、且 utility 低于阈值
- 依赖外部信息，转成 `waiting`
- 被更高优先级主题挤出，转成 `paused` 或 `dropped`

`closed` 主题仍可被新证据重新打开。

### 5. Action 分流成三层

把“思考产出”与“是否打扰用户”分开。
建议统一 action 模型：

- `record_only`：仅沉淀到 md，不打扰
- `system_action`：程序自己执行
- `user_action`：需要用户处理
- `user_urgent_action`：高阈值立即 Bot 推送

判断流程：

- 低风险高置信：进入程序自动执行队列
- 中风险或事实冲突：进 `Decision Center`
- 高紧急高置信高收益：直接 Bot 推送
- 其他全部静默落盘

### 5.1 反思产出的 action 如何影响项目真值

对于“修改某个项目的真值属性”这类 action，不建议直接让反思 worker 改库，而应走统一的真值执行路径：

- `Reflection Worker` / `Dream Worker` 只产出结构化 action 提案，例如：
  - `update_truth_property`
  - `create_confirm_request`
  - `query_external_tool`
  - `notify_user`
- `ActionExecutor` 负责真正执行 action
- 涉及事实真值变更时，一律通过 `[memory-service/src/core/TruthMaintainer.ts](memory-service/src/core/TruthMaintainer.ts)` 落地，而不是直接写表

建议真值类 action 的执行策略：

- `high confidence + low risk`：
  - 进入 `ActionExecutor`
  - 调用 `TruthMaintainer.processPropertyChange()` 或同层封装接口
  - 自动写入审计轨迹、事实版本、来源与置信度
- `medium confidence` 或影响较大的事实：
  - 不直接改真值
  - 自动创建 `confirm_requests`
  - 由 `Decision Center` 人审后再经 `TruthMaintainer` 落地
- `low confidence / dream-derived`：
  - 默认不改真值
  - 仅沉淀为 hypothesis、open question，或降级成待确认项

也就是说：反思系统可以“提出改真值的 action”，但真正让项目真值变化的执行器必须是 `TruthMaintainer` 这条统一链路。

### 6. 给程序自己的 action 要独立执行层

不要放在反思 worker 里直接做完，建议新增独立执行层：

- `ActionExecutor` 负责拉取升级后的 `proposed_actions`（概念上即 action queue）
- `Reflection Worker` 只负责“提出 action”
- `ActionExecutor` 负责“执行、重试、记录结果、失败回流”

第一阶段只支持安全动作：

- 触发下一轮反思
- 生成/刷新主题文档
- 创建 `confirm_requests`
- 发送 Bot
- 生成 report/dream
- 标记 watched project / reminder

后续再考虑接更广泛外部 API。

### 6.1 外部工具执行：引入 OpenClaw 作为工具运行时

该方案可行，且和现有文档里“Memory Service 做长期记忆中台，OpenClaw 做 agent runtime / 工具调用层”的方向一致。

但建议明确边界：

- `Memory Service`：仍然是记忆、真值、主题线程、通知策略的主系统
- `OpenClaw`：作为外部工具执行器 / agent runtime，负责：
  - 查询 Jira / 外部系统
  - 运行复杂工具链
  - 产出结果再回写给 Memory Service

关键原则：

- OpenClaw 不应成为真值源
- OpenClaw 的查询结果、分析结果、action 执行结果，都应回写到 Memory Service，再由真值层决定是否更新事实

### 6.2 OpenClaw 配置入口

你提的“在 `[src/options.tsx](src/options.tsx)` 里新增 OpenClaw base url 和 key”是可行的，但前提是后端 action 执行层也能拿到这份配置。

建议配置项：

- `OPENCLAW_BASE_URL`
- `OPENCLAW_API_KEY`
- `OPENCLAW_ENABLED`
- 可选：`OPENCLAW_TIMEOUT`

建议配置流：

- 在 `[src/options.tsx](src/options.tsx)` 增加输入项，供用户在扩展端填写
- 与 Dream Digest / Weekly Report 配置类似，同步到 `memory-service` 的运行时配置接口
- `memory-service` 持久化到 per-user `config.json`
- `ActionExecutor` / `OpenClawClient` 从后端配置读取，不依赖扩展在线

不建议只把配置保存在扩展侧，因为：

- 未来的 `ActionExecutor` 更适合跑在后端
- 后端定时反思、梦境重放、action 重试都不应依赖浏览器页面是否打开

### 6.3 OpenClaw 在系统中的角色

建议新增一个轻量的 `OpenClawClient` / `ToolRuntimeClient` 抽象层，统一封装：

- Jira 查询
- 外部信息补充
- 复杂 agent 调用
- 执行结果回写

建议动作链路：

- 反思线程产出 `query_external_tool` action
- `ActionExecutor` 判断该 action 是否允许自动执行
- 调用 `OpenClawClient`
- 把结果回写成：
  - 新 evidence
  - 新 reflection run 输入
  - 必要时新的 `confirm_request`
  - 必要时 `TruthMaintainer` 的 property change

这样 OpenClaw 是“外脑工具手”，不是“事实最终裁决者”。

### 6.4 ActionExecutor 与 OpenClaw 的关系

- 对于“后台反思 / 定时反思 / 梦境回调”产生的外部工具调用，建议统一通过 `ActionExecutor` 发起。
- 也就是说，`OpenClaw` 不是被 `Reflection Worker` 直接调用，而是作为 `ActionExecutor` 可用的一种外部执行器。
- 推荐调用链：
  - `Reflection Worker` 产出 `query_external_tool` action
  - `ActionExecutor` 取出 action 并检查风险、频率、依赖、幂等键
  - `ActionExecutor` 调用 `OpenClawClient`
  - `OpenClawClient` 返回结构化结果
  - `ActionExecutor` 再决定：
    - 写入新 evidence
    - 触发下一轮 reflection run
    - 创建 confirm request
    - 或通过 `TruthMaintainer` 更新真值
- 对于未来可能存在的“用户手动点按钮立刻调用 OpenClaw”场景，可允许同步直调 `OpenClawClient`；但后台系统默认仍建议走 `ActionExecutor`，保持审计、重试、限流和安全策略一致。

### 6.5 ActionExecutor 是否是新增模块

是的。当前代码里没有通用的 `ActionExecutor`，也没有真正被跑起来的 action runtime；只有一个尚未充分使用的 `proposed_actions` schema，以及尚不存在的 `OpenClawClient` / `ToolRuntimeClient`。

当前最接近它的只有：

- `[memory-service/src/core/ProactiveScheduler.ts](memory-service/src/core/ProactiveScheduler.ts)`：负责定时调度 heartbeat / daily / weekly / report
- `[memory-service/src/core/TruthMaintainer.ts](memory-service/src/core/TruthMaintainer.ts)`：负责事实冲突处理和真值落地
- 若干“各自直接执行”的点状逻辑，例如 dream digest / weekly report / bot push

所以 `ActionExecutor` 不是对现有模块改名，而是这次架构改造中新增的“统一动作执行层”。

## 工程化细化

### 7. 模块拆分

建议新增或改造的核心模块：

- `ReflectionPlanner`
  - 输入：新证据、主题状态、dream callback、冲突事件
  - 输出：创建主题 / 挂靠主题 / 唤醒主题 / 放弃主题
- `ReflectionWorker`
  - 输入：某个 `reflection_thread`
  - 输出：新的 `reflection_run`、更新主题状态、产出 action 提案
- `DreamWorker`
  - 输入：高显著主题池 + 可选线程池
  - 输出：dream run、dream artifact、dream callback
- `ActionExecutor`
  - 输入：升级后的 `proposed_actions`
  - 输出：执行结果、重试、回写、失败记录
- `OpenClawClient`
  - 输入：标准化工具调用请求
  - 输出：标准化外部结果
- `ThreadRepository` / `ActionRepository`
  - 统一数据库读写，避免 worker 直接散写 SQL

建议的文件落点：

- `memory-service/src/core/reflection/ReflectionPlanner.ts`
- `memory-service/src/core/reflection/ReflectionWorker.ts`
- `memory-service/src/core/reflection/ReflectionThreadService.ts`
- `memory-service/src/core/dream/DreamWorker.ts`
- `memory-service/src/core/actions/ActionExecutor.ts`
- `memory-service/src/core/actions/handlers/TruthActionHandler.ts`
- `memory-service/src/core/actions/handlers/DecisionActionHandler.ts`
- `memory-service/src/core/actions/handlers/NotifyActionHandler.ts`
- `memory-service/src/core/actions/handlers/ExternalToolActionHandler.ts`
- `memory-service/src/integrations/OpenClawClient.ts`
- `memory-service/src/repositories/ReflectionThreadRepository.ts`
- `memory-service/src/repositories/ActionRepository.ts`
- `memory-service/src/repositories/WorkerCheckpointRepository.ts`

### 8. 线程状态机

建议 `reflection_threads.status` 状态机：

- `active`
  - 正在持续思考
- `waiting`
  - 当前缺外部信息或等待 action 结果
- `paused`
  - 因容量/优先级暂时挂起
- `closed`
  - 已达成结论或无需继续
- `dropped`
  - 价值过低被放弃
- `archived`
  - 仅保留历史，不再进入调度

状态流转建议：

- `active -> waiting`：需要外部查询、用户确认或异步 action 结果
- `active -> closed`：问题收敛或明确结束
- `active -> paused`：被更高优先级主题挤出
- `paused -> active`：有新证据或被重新唤醒
- `closed -> active`：出现强新证据时重开
- `dropped/closed -> archived`：长期冷却后归档

### 9. 动作队列状态机（实现上升级 `proposed_actions`）

概念上仍然叫 `action queue`，但实现上建议直接升级现有 `proposed_actions`，避免并存两套动作表。

建议 `queue_status`：

- `queued`
- `running`
- `waiting_dependency`
- `waiting_confirmation`
- `succeeded`
- `failed`
- `cancelled`
- `dead_letter`

建议新增/补充字段：

- `thread_id`
- `run_id`
- `action_type`（可直接复用/替换现有 `type`）
- `execution_mode(auto|manual|assisted)`
- `priority`
- `idempotency_key`
- `depends_on_json`
- `scheduled_at`
- `started_at`
- `finished_at`
- `retry_count`
- `last_error`
- `result_json`
- `source_kind(reflection|dream|manual|system)`
- `source_ref_id`

保留并继续使用的现有字段：

- `risk_level`
- `confidence`
- `params_json`
- `evidence_refs_json`
- `requires_approval`
- `expires_at`
- `created_at`

如需更细审计，可新增 `proposed_action_attempts` 子表记录每次执行。

### 10. 数据表建议

建议最小新增/升级表：

#### `reflection_threads`

- `id`
- `topic_key`
- `title`
- `status`
- `priority`
- `salience`
- `source_type`
- `source_ref_id`
- `current_hypothesis`
- `open_questions_json`
- `latest_summary`
- `latest_markdown_path`
- `next_reflection_at`
- `last_reflected_at`
- `reflection_count`
- `continue_reason`
- `closure_reason`
- `created_at`
- `updated_at`

#### `reflection_runs`

- `id`
- `thread_id`
- `run_type(reflection|dream_callback|manual_revisit|scheduler_revisit)`
- `trigger_type`
- `input_refs_json`
- `previous_run_id`
- `summary`
- `hypothesis_before`
- `hypothesis_after`
- `discoveries_json`
- `open_questions_json`
- `actions_json`
- `markdown_snapshot_path`
- `created_at`

说明：

- 现有 `reflection_artifacts` 继续保留给 daily / weekly summary 使用
- `reflection_runs` 只承载线程化连续反思，不去覆盖 `ConsolidationEngine.phaseReflect()` 现有产物

#### `dream_runs`

- `id`
- `source_type(entity_salience|thread_pool|manual)`
- `source_ref_id`
- `thread_ids_json`
- `summary`
- `insights_json`
- `risks_json`
- `relationships_json`
- `markdown_path`
- `created_at`

说明：

- 当前 `[memory-service/src/core/GenerativeReplay.ts](memory-service/src/core/GenerativeReplay.ts)` 只有 Markdown 产物和 relationship side effect
- redesign 后需要结构化 `dream_runs`，这样才能做 dream callback -> reflection thread 的回流

#### `topic_memory_links`

- `id`
- `thread_id`
- `source_kind(message|chunk|entity|property|dream|reflection|report|action)`
- `source_id`
- `weight`
- `role(evidence|context|hypothesis|outcome)`
- `created_at`

#### `worker_checkpoints`

- `worker_key`
- `cursor_value`
- `cursor_type`
- `updated_at`

#### `worker_leases`

- `worker_key`
- `owner_id`
- `lease_until`
- `updated_at`

#### 升级后的 `proposed_actions`

- 见上文动作队列状态机字段

### 10.1 推荐 migration 拆分

建议不要继续把所有 schema 堆进 `001_initial.sql`，而是显式新增 migration：

- `003_notification_runtime.sql`
  - 修正 notification runtime 相关 schema
  - 可选提供 `notifications` compatibility view
  - 建 `worker_checkpoints` / `worker_leases`
- `004_reflection_threads.sql`
  - 新建 `reflection_threads`
  - 新建 `reflection_runs`
  - 新建 `topic_memory_links`
  - 新建 `dream_runs`
- `005_action_runtime.sql`
  - 对 `proposed_actions` 增列升级
  - 新建 `proposed_action_attempts`

### 11. Prompt / 上下文装配策略

建议 `ReflectionWorker` 的 prompt 组装顺序：

1. 线程头信息
  - title / status / objective / current hypothesis
2. 上一轮 run 摘要
3. 未解决问题
4. 本轮新增证据
5. 历史关键证据（压缩后）
6. 可选 dream callback
7. 可选全局用户/项目背景

建议输出 JSON 结构：

- `summary`
- `updatedHypothesis`
- `confidenceDelta`
- `newEvidenceNeeds`
- `openQuestions`
- `proposedActions`
- `statusSuggestion(continue|waiting|closed|paused)`
- `continueReason`

### 11.1 ReflectionPlanner 的实际扫描输入

第一阶段不要把 topic discovery 做得过度复杂，建议直接扫描以下几类增量信号：

- `messages_raw.created_at > checkpoint`
- `confirm_requests.created_at > checkpoint`
- `entity_properties.tx_start > checkpoint` 且 `status in ('active', 'superseded')`
- `dream_runs.created_at > checkpoint`
- `proposed_actions.finished_at > checkpoint` 且结果会改变线程状态

主题归并顺序建议：

1. 先按结构化锚点归并：
  - `entity_id`
  - `property_key`
  - `confirm_request.id`
  - `watched_project.id`
2. 若没有结构化锚点，再按 `topic_key` 规则归并：
  - `project:<id>`
  - `entity:<id>`
  - `conflict:<entity_id>:<property_key>`
  - `dream-risk:<slug>`
3. 最后才做轻量语义匹配：
  - 对 `reflection_threads.latest_summary` 做向量召回 / 文本相似度匹配

这样可以先用确定性信号稳定收敛，减少“一个主题拆成多条线程”的噪音。

### 11.2 ReflectionWorker 的一次完整执行

建议执行步骤：

1. 锁定一个 `reflection_thread`
2. 读取：
  - thread 当前状态
  - 上一轮 run
  - 最近 N 条 evidence links
  - 相关 dream callback
  - `USER_CORE.md`
3. 组 prompt，调用 LLM
4. 持久化 `reflection_run`
5. 更新 `reflection_threads`：
  - `latest_summary`
  - `current_hypothesis`
  - `open_questions_json`
  - `status`
  - `next_reflection_at`
6. 追加/重写 `reflection-threads/<topic-slug>.md`
7. 为 `proposedActions` 入队
8. 更新 thread 对应 evidence link

建议输出 JSON 增加两个字段，方便动作与调度直接消费：

- `nextReflectionSuggestionSec`
- `evidenceToLink`

### 11.3 DreamWorker 对现有 `GenerativeReplay` 的改造方式

不建议推翻 `[memory-service/src/core/GenerativeReplay.ts](memory-service/src/core/GenerativeReplay.ts)`，而建议分两步演进：

- 第一步：
  - 保留现有实体显著性选题逻辑
  - 额外允许输入 `reflection_threads` 中 top-N active topics
  - 把输出落一份 `dream_runs`
- 第二步：
  - dream output 不只写 relationship side effect
  - 还要显式生成 `dream callbacks`
  - 再由 `ReflectionPlanner` 消费回流

### 12. ActionExecutor 的执行器注册表

建议做成可扩展 dispatcher，而不是一个大 if-else：

- `update_truth_property` -> `TruthActionHandler`
- `create_confirm_request` -> `DecisionActionHandler`
- `query_external_tool` -> `ExternalToolActionHandler`
- `notify_user` -> `NotifyActionHandler`
- `schedule_revisit` -> `SchedulerActionHandler`

其中 `ExternalToolActionHandler` 内部再按 provider 分发：

- `openclaw`
- 未来可扩展 `jira-direct`、`mcp-tool`、`internal-http`

### 12.1 动作分流阈值

建议把“是否自动执行 / 是否打扰用户”做成显式策略函数，而不是散落在 worker prompt 或 handler 内部。

建议最小判定维度：

- `confidence`
- `risk_level`
- `source_kind`
- `requires_approval`
- `utility_score`
- `urgency_score`

初版规则建议：

- `source_kind = dream`：
  - 默认不能直接 `update_truth_property`
  - 只能 `record_only` / `create_confirm_request` / `query_external_tool`
- `risk_level = high` 或 `requires_approval = true`：
  - 不自动执行，进入 `Decision Center`
- `confidence >= autoExecuteThreshold` 且 `risk_level in (low, medium)`：
  - 自动执行
- `urgency_score >= urgentNotifyThreshold` 且 `confidence >= urgentConfidenceThreshold`：
  - 自动执行后再走 Bot push
- 其余：
  - 静默沉淀或排队等待人工触发

### 13. OpenClawClient 接口建议

建议请求模型：

- `toolName`
- `intent`
- `input`
- `context`
- `timeoutMs`
- `idempotencyKey`

建议返回模型：

- `status`
- `provider`
- `rawOutput`
- `structuredOutput`
- `evidenceRefs`
- `suggestedPropertyChanges`
- `suggestedActions`
- `costInfo`
- `startedAt`
- `finishedAt`

关键要求：

- 必须支持结构化输出，避免反思线程解析自由文本
- 必须带原始输出，方便审计
- 必须能把 Jira 查询结果转成 evidence，而不是直接改真值

### 14. API 设计建议

建议新增后端 API：

- `GET /reflection-threads`
  - 支持 `status`, `limit`, `offset`
- `GET /reflection-threads/:id`
  - 返回 thread 详情 + 最近 runs + actions
- `GET /reflection-threads/:id/runs`
- `POST /reflection-threads/:id/revisit`
  - 手动触发继续思考
- `POST /reflection-threads/:id/close`
- `POST /reflection-threads/:id/pause`
- `GET /actions`
  - 支持 `status`, `threadId`, `executionMode`
- `POST /actions/:id/retry`
- `POST /actions/:id/cancel`

建议继续复用、不重造的现有 API：

- `GET /confirm-requests`
- `POST /confirm-requests/:id/answer`
- `POST /dream-digest/push-now`
- `POST /weekly-report/push-now`
- `POST /context-match`
- `POST /ask`

建议扩展现有配置 API：

- `GET /config`
- `PUT /config`

新增配置字段：

- `openClawEnabled`
- `openClawBaseUrl`
- `openClawApiKey`
- `openClawTimeoutMs`
- `reflectionActiveTopicLimit`
- `reflectionHeartbeatMinutes`
- `reflectionUrgentNotifyThreshold`
- `reflectionAutoExecuteThreshold`

如果要做实时更新，建议顺手补齐 `[memory-service/src/routes/events.ts](memory-service/src/routes/events.ts)` 的真实发射点：

- 新 thread 创建时发 `reflection_thread`
- action 入队/完成时发 `action_queue`
- 新 confirm request 创建时发 `confirm_request`

### 15. 前端信息架构建议

在 `[src/modals/memory-exploring.vue](src/modals/memory-exploring.vue)` 中建议增加：

- `梦境反思`
  - `进行中`
  - `等待中`
  - `已归档`
- `梦境重放`
- `决策中心`
- `动作队列`

建议基于现有页面增量演进：

- 保留 `[src/modals/components/DreamInsights.vue](src/modals/components/DreamInsights.vue)`，但产品语义改为 `Dream Replay`
- 继续复用 `[src/modals/components/DecisionCenter.vue](src/modals/components/DecisionCenter.vue)` 作为 confirm request 入口
- 新增：
  - `src/modals/components/ReflectionThreads.vue`
  - `src/modals/components/ReflectionThreadDetail.vue`
  - 可选 `src/modals/components/ActionQueue.vue`

推荐路由：

- `/reflection-threads`
- `/reflection-threads/:id`
- `/dreams` 或显式别名 `/dream-replays`
- `/actions`

单主题详情页建议区块：

- 当前摘要
- 当前 hypothesis
- open questions
- 本轮/历史 run timeline
- 证据列表
- action 列表
- 状态流转记录

### 16. 实施顺序再细化

#### P0：基础设施

- 修正通知读写统一到 `notification_records`
- 新增 `worker_checkpoints` / `worker_leases`
- 新增配置项
- 把 `OnlineReflection` 接入 `/ask`
- 新增 `ReflectionPlanner` 最小实现

#### P1：主题线程可运行

- `ReflectionWorker`
- `reflection-threads` Markdown 产物
- 基本前端浏览页

#### P2：动作闭环

- 升级 `proposed_actions`
- `ActionExecutor`
- 真值 action 统一接 `TruthMaintainer`
- `Decision Center` 联动

#### P3：OpenClaw 工具接入

- `OpenClawClient`
- 配置链路
- `query_external_tool` action handler
- 回写 evidence / new actions / confirm requests

#### P4：梦境重放回流

- `DreamWorker` 接线程池
- dream callback -> reflection thread
- dream 结果参与 recall / ask / context-match

## 推荐实施顺序

### 阶段 1：建立主题线程层

先修 runtime 断点，再新增后端数据结构和最小 worker，不改现有 dream/report 主链路：

- 修正 `/notifications` -> `notification_records`
- 新增 `003_notification_runtime.sql`
- 新增 `004_reflection_threads.sql`
- 新增 `005_action_runtime.sql`
- 新增 `reflection_threads` / `reflection_runs` / `dream_runs`
- 新增 `ReflectionPlanner` 决定下一轮想什么
- 让新一轮思考显式读取上一轮 run 结果
- 输出到新的主题 Markdown 文档

重点文件：

- `[memory-service/src/core/HeartbeatLoop.ts](memory-service/src/core/HeartbeatLoop.ts)`
- `[memory-service/src/core/OnlineReflection.ts](memory-service/src/core/OnlineReflection.ts)`
- `[memory-service/src/core/GenerativeReplay.ts](memory-service/src/core/GenerativeReplay.ts)`
- `[memory-service/src/core/TruthMaintainer.ts](memory-service/src/core/TruthMaintainer.ts)`
- `[memory-service/src/routes/notifications.ts](memory-service/src/routes/notifications.ts)`
- `[memory-service/src/storage/migrations/003_notification_runtime.sql](memory-service/src/storage/migrations/003_notification_runtime.sql)`
- `[memory-service/src/storage/migrations/004_reflection_threads.sql](memory-service/src/storage/migrations/004_reflection_threads.sql)`
- `[memory-service/src/storage/migrations/005_action_runtime.sql](memory-service/src/storage/migrations/005_action_runtime.sql)`

### 阶段 2：把现有反思接入线程化

把现有一次性反思产物接入新线程：

- `OnlineReflection` 真正接到 `/ask` 后链路中
- daily reflection 产物关联到主题线程
- dream 的输入增加“上一轮反思/线程状态”作为额外上下文

关键点：梦境下一轮应读取上一轮 dream/reflection run，而不只是原始消息。

### 阶段 3：动作与打扰分流

建立统一策略层：

- 静默沉淀：写入 Markdown + reindex
- 待确认：进入 `Decision Center`
- 自动执行：进入 `ActionExecutor`
- 高阈值紧急：Bot 推送

关键文件：

- `[memory-service/src/core/ProactivityPolicy.ts](memory-service/src/core/ProactivityPolicy.ts)`
- `[memory-service/src/core/HeartbeatLoop.ts](memory-service/src/core/HeartbeatLoop.ts)`
- `[memory-service/src/routes/confirmRequests.ts](memory-service/src/routes/confirmRequests.ts)`
- `[src/modals/components/DecisionCenter.vue](src/modals/components/DecisionCenter.vue)`

### 阶段 3.1：接入真值执行与 OpenClaw 工具运行时

- 为升级后的 `proposed_actions` 增加 action type 约定，至少包含：
  - `update_truth_property`
  - `query_external_tool`
  - `create_confirm_request`
  - `notify_user`
- 新增 `ActionExecutor`，把事实变更统一路由到 `TruthMaintainer`
- 新增 `OpenClawClient`，让外部 Jira / agent 工具查询走 OpenClaw
- 执行结果必须回写 Memory Service，成为后续反思/梦境的输入
- 对 dream-derived action 增加更严格阈值，默认不可直接改真值

### 阶段 3.2：补充 OpenClaw 配置链路

- 扩展端 `[src/options.tsx](src/options.tsx)` 新增 OpenClaw Base URL / API Key / Enabled 配置
- 后端 `[memory-service/src/routes/config.ts](memory-service/src/routes/config.ts)` 扩展运行时配置读写
- 后端 `[memory-service/src/config.ts](memory-service/src/config.ts)` 与 per-user `config.json` 增加 OpenClaw 配置项
- `ActionExecutor` / `OpenClawClient` 统一从后端配置读取
- 如需更安全，可进一步把 API key 只保存在后端环境或受保护配置中，扩展端仅传引用/用户态配置

### 阶段 4：前端展示改名与信息分区

把“梦境洞察”逐步演进成两块：

- `梦境反思`：长期主题线程，低打扰、可追踪延续性
- `梦境重放` 或保留 `dreams`：离线跨主题联想结果

并在界面上明确区分：

- 静默整理结果
- 待用户处理 action
- 紧急已推送 action

前端重点文件：

- `[src/modals/memory-exploring-entry.ts](src/modals/memory-exploring-entry.ts)`
- `[src/modals/memory-exploring.vue](src/modals/memory-exploring.vue)`
- `[src/modals/components/DreamInsights.vue](src/modals/components/DreamInsights.vue)`

### 阶段 4.1：在 `memory-exploring.vue` 中同时展示 active / archive 主题

当前 `[src/modals/memory-exploring.vue](src/modals/memory-exploring.vue)` 和 `[src/modals/memory-exploring-entry.ts](src/modals/memory-exploring-entry.ts)` 已有 `/dreams`、`/decisions` 等导航，因此建议新增：

- `/reflection-threads`：主题反思总览页
- `/reflection-threads/:id`：单主题详情页
- 可选 `/dream-replays`：若要与“梦境反思”视觉上彻底区分

建议在总览页同时展示：

- `进行中话题 (active)`：主题名、当前状态、最近一次思考时间、当前 hypothesis、未解决问题数、是否有 action、下一次计划思考时间
- `等待中话题 (waiting/paused)`：等待原因、依赖外部信息、预计回看时间
- `归档话题 (closed/archived/dropped)`：最终结论、关闭原因、最终 action 结果

建议单主题详情页展示：

- 主题主文档
- 每一步思考 run timeline
- 每步输入证据
- 每步输出摘要 / hypothesis 变化
- action 列表（for_system / for_user / urgent）
- 当前状态与“是否继续思考”的判定依据

## 最小验收标准

连续反思改造至少要满足以下验收条件，才算真正落地：

- `/ask` 返回路径不被阻塞，但响应后能异步产出 `OnlineReflection` 信号
- 同一批消息不会因为 scheduler 重建实例而被重复规划成多个 thread
- `/notifications`、Chrome 轮询、Bot push 基于同一套 `notification_records` 数据
- `GenerativeReplay` 产生的新 dream run 能够回流到 `ReflectionPlanner`
- dream-derived action 不会直接污染真值层，必须经过 `ActionExecutor` 策略判定
- `Decision Center` 继续可用，并且能处理 reflection / dream 产出的 confirm request
- 前端可以浏览：
  - active / waiting / archived threads
  - 某线程的 run timeline
  - action 执行结果

## 关键取舍建议

- 梦境系统和反思系统：不要合并成单一 worker，建议“分层共享、上层分工”
- 思考反思的新主题来源：不只来自消息，也应接受 dream callback / conflict callback / revisit callback
- 主题文档：建议“每主题一个长期 md + 每轮一个结构化 run”
- 上下文策略：建议以上一轮线程摘要为 backbone，新证据为主增量，梦境作为辅助上下文
- 真值修改：建议由反思产出 action 提案，统一通过 `ActionExecutor -> TruthMaintainer` 落地
- 外部工具：建议 OpenClaw 作为工具运行时，而不是事实真源
- OpenClaw 配置：可在 `options.tsx` 提供填写入口，但必须同步到后端配置供定时任务与 ActionExecutor 使用
- 继续思考标记：建议线程状态机，而不是只靠文档尾部一句话
- 最大同时反思话题：建议必须有，上限是稳定性的关键
- 思考结束：建议显式 `closed/paused/dropped/waiting`
- 程序 action：建议独立 `ActionExecutor`，不要混进反思生成逻辑
- 紧急 Bot：阈值要显著高于普通整理和待确认

## 风险与注意点

- 现有 `WeeklyReporter` 和 `Dream Digest` 对时间窗口的读取还比较粗，需要后续一起校正，避免线程化后输入范围继续失真。
- 现有 `HeartbeatLoop` 的游标是实例内状态，而 `ProactiveScheduler` 每轮会重新 new 实例；如果不先上 `worker_checkpoints`，连续反思会重复扫描历史数据。
- 现有通知链路里 `notification_records` 与旧 `notifications` 读写不完全一致，后续若要强化即时打扰，需要统一。
- `context-match`、`user-files`、`MarkdownManager.inferSourceType()` 目前只认识 `reflections/` / `dreams/` 等旧目录；如果引入 `reflection-threads/` 但不补这些边界，前端体验会割裂。
- `dream` 产物应持续保留 `low-confidence / inferred / dream` 来源标识，避免梦境推演污染真值层。
