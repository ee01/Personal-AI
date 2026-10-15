# 任务中心（Task Center）

> 一个账本、两条调度 lane。定时推送、Agent 任务、提醒我、开发委派、帮我问、反思候选共用同一张队列表、同一套幂等、同一套人工节点。

- 设计决策与调研过程：[`docs/progressing/agent-task-ledger-plan.md`](../progressing/agent-task-ledger-plan.md)
- 交互原型：[`docs/progressing/agent-task-ledger-demo.html`](../progressing/agent-task-ledger-demo.html)
- ☁️ lane 子文档：[`scheduled_messages_manager.md`](scheduled_messages_manager.md)
- 执行器运行时：[`agent_executor_runtime.md`](agent_executor_runtime.md)

> ⚠️ 勿与 [`background_jobs.md`](background_jobs.md) 混淆：那是 Chrome 扩展后台的 `background_job_*` alarm 调度器（memory_sync 之类的插件内务作业），与本文的任务中心是两套完全不同的东西。

---

## 功能概述

任务中心把用户和 AI 产生的所有"待办执行单"收敛到 memory-service 的 `proposed_actions` 队列上：

| 任务类型 | 谁创建 | 调度器 | 特有能力 |
|---|---|---|---|
| ⏰ 定时推送 | 用户 | 🏠 / ☁️ 可选 | 内容/JQL、通知通道、Timeline 里程碑触发 |
| 🤖 Agent 任务 | 用户 | 🏠 / ☁️ 可选（执行恒在 🏠） | read/write 边界、执行器选择、结果通知模板、Timeline 里程碑触发 |
| ⏳ 提醒我 | 用户（Glip 消息 / 网页） | 🏠 固定 | 来源引用、快捷时间 |
| 📣 帮我问 | 用户 | 🏠 固定 | OutreachEngine 会话、RingCentral 凭据 |
| 🛠 开发委派 | 用户 / 会话交接 | 🏠 固定 | 验收标准、plan gate、依赖、文件产物 |
| 🌙 反思候选 | AI（ReflectionWorker） | 🏠 固定 | 主题聚合、必须人工转正才入队 |

## 大白话运行逻辑

1. 不管从哪个入口创建（Glip 输入框、提醒我、Jira 规则导入、反思转正、会话交接），都只写**一个** API：`POST /task-center/tasks`。
2. 账本按任务类型和用户配置决定 **lane**：🏠 `memory_cron`（memory-service 到期队列）或 ☁️ `jira_sheet`（Jira Automation 云端触发 + Sheet 镜像行）。
3. 🏠 任务由 memory-service 的到期扫描直接执行；☁️ 任务由扩展同步器写一行 Sheet，Jira rule 每分钟领取，走原有链路。
4. 执行结果、artifact、失败原因**统一记在账本**，不管是哪条 lane 触发的。
5. 需要人拍板的（write 审批、plan gate、产物 review、执行失败）进**收件箱**；其余安静躺在时间轴里。

## 分层激活（初始化）

不是"二选一向导"，而是能力分层。用户装完插件即处于 L0。

| Level | 内容 | 配置成本 | 解锁 |
|---|---|---|---|
| **L0 账本** | memory-service 本地账本 + `memory_cron` | 零配置，默认开启 | 四类任务全可创建（🏠 调度）、插件通知 |
| **L1 推送通道** | Bot（SM AI）**或** AsMe（RingCentral 凭据，本人身份） | 中 | Glip 私发 / 群组通知目标；两条通道相互独立，配任一即部分解锁 |
| **L2 云端 lane** | Google Sheet + App Script + Jira Automation | 高（需 Google 授权 + Jira 项目 admin） | ☁️ `jira_sheet` 调度器、Timeline 里程碑触发、Drive 附件、AsMe 邮件 |

- **存量用户**：探测本机 `chrome.storage.local.scheduledMessagesConfig.sheetId`（与定时消息页同一份缓存）即判定 L2 已激活，原 Sheet / Jira 规则**照常运行、无需迁移**。L2 的 Jira 执行规则 / Sheet AsMe **不必、也不该**复制进 memory-service 才能点亮抽屉——Google token 只在扩展手里。
- **Sheet 双向镜像**：任务中心选 ☁️ 保存时，账本先落库；扩展再用 Google token 写 / 更新 Sheet 行，并把 `mirrorRef.sheetMessageId` 回写账本。暂停 / 恢复 / 删除 / 标记完成同样回写 Sheet，避免 Jira 规则继续领取已停掉的行。定时消息页、Glip 发送框、AR 绑定新建的 Sheet 行会按幂等键 `jira_sheet:<Sheet ID>` 登记到任务中心（`listDueAutoActions` **排除** `jira_sheet`，本地不会再跑一遍）。没有 L2 时，Glip「定时发送」改为写入 🏠 账本，不再挡住。
- **L2 受阻**：受管 Google 账号的域策略可能禁止匿名 Web App 部署（见 [scheduled_messages_manager.md § App Script 自动更新](scheduled_messages_manager.md#11-app-script-自动更新)）。向导明示逃生舱（个人 Google 账号部署）并标注数据治理风险，不作为推荐路径。
- UI 上未解锁的能力一律**置灰 + 说明 + 直达配置入口**，不隐藏——用户要能看见"还有这个能力，缺什么才能用"。

## 核心设计

### 1. 两条 lane 是任务的属性，不是系统的分叉

```
所有入口 ──▶ POST /task-center/tasks ──┬─▶ lane=memory_cron ─▶ 到期队列（本地执行）
                                       └─▶ lane=jira_sheet  ─▶ 扩展同步器写 Sheet 行 ─▶ Jira rule 领取
```

- lane 可在任务编辑器里切换：切换 = 改账本属性 + 增删 Sheet 镜像行。
- **Sheet 镜像由扩展写，不是 memory-service**：Google OAuth token 在扩展手里，memory-service 无 Google 凭据。同步器在保存时即时写，离线时由后台对账补写。
- 固定 🏠 的类型（提醒 / 开发委派 / 反思候选）在编辑器里 lane 锁定并说明原因——它们需要 gate / 依赖 / 产物能力，Sheet 表达不了。

### 2. 任务类型决定编辑器形态

每类任务的编辑器字段不同，但共享底部三件套：**通知通道 / 推送目标 → 执行时间与重复规则 → 调度器**。字段对齐定时消息新建弹窗：Bot / AsMe 要选私发还是群组，并填写接收人或群组 ID；循环要能选每周几、每月几号、结束日期和次数。

- **定时推送**：形态（文本 / AI Report）、标题、内容或 JQL、通知通道（插件 / Bot / AsMe）、推送目标（私发人名或群组 ID）、**触发方式（时间 / Timeline）**、执行日期时间或项目 Milestone + 偏移、日历重复规则（仅时间触发：每隔 N 天/周/月/年、每周几、每月几号、结束日期、次数）、调度器。Timeline 触发强制 ☁️ `jira_sheet`，每个新版本的该 Milestone 都会再推一次，不走日历 `Repeat_Every`，需要 Level 2 的 Timeline Sync Rule。
- **Agent 任务**：任务描述（必填）、执行边界（只读/写入，写入需审批）、结果通知通道与目标、成功回执开关、**0 匹配是否仍推结果通知**（默认不推，只留 run 账本）、**触发方式（时间 / Timeline）**、执行日期时间或项目 Milestone + 偏移、日历重复规则（仅时间触发）、调度器。Timeline 触发强制 ☁️ `jira_sheet`，每个新版本的该 Milestone 都会再执行一次，不走日历 `Repeat_Every`，需要 Level 2 的 Timeline Sync Rule（与定时消息页「帮我做」相同）。
- **提醒我**：标题、快捷时间（1 小时后 / 今晚 / 明早 / 下周一）或自定义日期时间、通知通道（Glip 时可填接收人，空则发给自己）。
- **开发委派**：标题、任务说明、**验收标准（必填）**、执行器 + 工作目录、plan gate 开关、依赖任务。
- **帮我问**：问题、询问对象（私发人名或群组 ID）、追问次数 / 间隔；固定 🏠，走 OutreachEngine。

### 3. 执行器：就地展开配置，不跳出编辑器

执行器下拉不只是选择，而是**执行器的轻量管理面**——避免"去 Options 配置 → 回来草稿丢了"的往返：

- 下拉项 = 已启用执行器 + 末尾「⚙ 管理执行器」「＋ 新建执行器」。
- 选中项右侧 `⚙` 展开**内联配置气泡**，字段随 `type` 变化：
  - 全部：`label`、`enabled`
  - `openclaw-*`：`baseUrl`、`apiKey`
  - `acp-*`：`cwd`、`runtime`（local / remote）；`runtime=remote` 时必填 `workerId`（下拉列出已配对 worker 及其在线状态）
- **apiKey 不回传**：GET 只返回 `apiKeyConfigured`，气泡显示"已配置 ••••"+「更换」，不显示原值。
- 气泡内提供「探活」按钮，复用既有 `executorProbe`，就地显示连通性与版本。
- 保存写 `runtimeConfig`（与 Options 同一后端），并就地刷新下拉，不关闭任务编辑器。
- Options 的 [`AgentExecutorsSettings`](../../src/components/AgentExecutorsSettings.tsx) 保留为完整管理面（增删、默认用途绑定），气泡只覆盖高频字段。

### 4. 通知通道也分级

| 通道 | 需要 | 未解锁表现 |
|---|---|---|
| 🔔 插件通知（Chrome notification） | L0 · **仅 🏠 `memory_cron`** | 🏠 始终可用，L0 默认。☁️ `jira_sheet` / Timeline / 定时消息 Sheet **不能**走插件通知：Jira Automation 和 GAS 写不了 Chrome `notification_records`，选 ☁️ 时该通道置灰并落到 Bot（有 Jira 内嵌 Bot）或 AsMe |
| 🤖 Glip Bot | L1（Bot 凭据） | 置灰 + "需 Level 1"；选中后还需选私发 / 群组并填写接收人或群组 ID |
| 👥 Glip 群组 | L1（Bot 或 AsMe）+ 目标类型=群组 | 与 Bot/AsMe 通道组合，不再作为独立通道 |
| 👤 AsMe 本人身份 | L1（RingCentral 凭据） | 同上；可私发多人（AsMe）或群组 |

**L1 配置入口**：任务中心「分层设置」与 Options（`#outreach-config`）写入同一份 memory-service runtime config（`PUT /config`）。服务端 `.env` 默认值经 `GET /config` 的 `*Configured` 字段体现，扩展不直接读 `.env` 文件。进入任务中心时，若 MS 尚无 RingCentral JWT 而本机 L2 Sheet 缓存里已有 `ringCentralSender`，会**一次性静默收编**（不覆盖已有 MS 值）；L2 的 Jira 内嵌 Bot **不会**收编为 🏠 Bot。任务中心保存 AsMe 后，若 L2 已配置，扩展会把同一份凭据**下发到 Sheet Config**；不会自动重部署 Jira 规则。

**AsMe 的凭据来源**：`getUserRuntimeConfig()` 里的 `ringCentralClientId/Secret/Jwt`，与 OutreachEngine 的「追问」是同一份，`GET /config` 已按 `*Configured` 布尔脱敏、不回传明文。☁️ lane 由 Sheet 临时传入的 `asmeSender` 仍然优先，没有时回落这份——与 notify-config 的「body 优先、表兜底」同构。

**凭据的单一真源**：memory-service 是真源（L0 就存在，Sheet 只有 L2 才有）。Sheet 侧那份是**派生副本**，用途是让 Sheet + Giraffe 脱离 memory-service 独立跑推送。同步是单向下发 + 一次性收编，**不是双向同步**（双向会在两边都改过时产生 split-brain，而凭据取到旧值的失败是静默的）。

> ⚠️ Sheet 侧凭据被 `JiraRuleUpdater` **明文烤进 Jira 规则 payload**（部署时替换占位符），所以改凭据必须**重新部署 Jira 规则**才对 ☁️ lane 生效；域策略禁止部署时，☁️ lane 的 AsMe 凭据事实上是冻结的。🏠 lane 不受此限制——它直接读 runtime config。详见 [plan § 12.1](../progressing/agent-task-ledger-plan.md)。

🏠 lane 的 `push` / `agent` 到期执行走 `ActionExecutor`，完成后调用与 `POST /agent-tasks/execute` 同一套投递规划（`planAgentTaskNotifications` + `deliverAgentTaskRunNotifications`）。身份支持 `bot` / `asme` / `plugin`；`plugin` **只对 🏠 有效**。`asme` 优先用请求里的临时凭据，否则回落 `getUserRuntimeConfig()`。投递失败写入 `params.metadata.notifyDeliveryError` 并私发 owner，**不改 run 状态**。

动作类型按任务形态分流：纯文本推送 / 提醒落 `notify_user`；AI Report 落 `run_http_push`（默认 `POST https://dify.int.rclabenv.com/v1/chat-messages`，鉴权用 env `DIFY_API_KEY` 或任务 `aiHeaders`，不复制 Sheet 侧硬编码 Bearer）；帮我问落 `ask_external_user`；Agent / 开发委派落 `delegate_agent`。`notify_user` / `ask_external_user` 自己负责投递，执行器终态不再二次扇出。

投递失败**不再静默**：Bot 分支检查 `deliverNoticeToGlip` 返回的 `.sent`，失败写入 `params.metadata.notifyDeliveryError` 并私发提示给 owner（不改 run 状态，保持"执行与通知独立"的边界）。

### 5. 人工节点是一等公民

四种人机交接统一进收件箱，共用 `confirm_requests` + `resume_action_id` 续跑机制：

| 场景 | 触发 | 批准后 |
|---|---|---|
| write 审批 | Agent 任务 `mode=write` 首次执行 | 入队执行 |
| plan gate | 开发委派默认开启 | agent 按计划动代码 |
| 产物 review | 文件型 artifact 产出 | 任务标记完成，解锁下游 |
| 执行失败 | 就绪门禁 / 网关鉴权 / dead_letter | 重试或改配置 |

红线：**空闲执行只排干已批准的 backlog，永不投机生成任务**；write 动作必经人工放行；注入防御闸门保留。

### 6. 反思候选必须聚合后才上账本

真实数据（本机 `esone.qiu` 库）：queued 205 条 → 去重后仅 83 个主题，其中 `update_truth_property` 35 条只对应 5 个主题。**主题聚合去重 + TTL 过期是账本 UI 的前置门槛项**，否则原始候选会淹没一切。候选卡的动作：批准一个代表候选入队 / 整批清理 / 降低该主题反思频率。

## 数据模型

全部落在既有 `proposed_actions` 表，新增字段：

| 字段 | 用途 |
|---|---|
| `parent_action_id` | 子任务树；父任务在全部子任务 succeeded 时聚合完成 |
| `recurrence_spec` | 重复调度。日历重复复用 OutreachEngine 的 scheduleSpec（`repeatEvery` / `repeatUnit`）；Timeline 触发写 `{ trigger:'timeline', timelineProject, timelineMilestone, timelineOffset, scheduleTime }`。日历完成时按 spec 克隆下一次；Timeline 不克隆，由 ☁️ Sheet 行保持 Active，每个新版本 Milestone 再命中 |
| `lane` | `memory_cron` / `jira_sheet` |
| `task_kind` | `push` / `agent` / `remind` / `dev` / `outreach` / `reflection` |
| `mirror_ref` | ☁️ 任务对应的 Sheet 行 id（`msg_*`）与同步状态 |

已有但需通电的字段：`depends_on_json`（持久化多年、零消费方）——`listDueAutoActions` 增加"依赖未完成则不出队"，并定义失败传播策略与环检测。

## 与其他系统的边界

- **Jira / roadmap-service 仍是团队事实源**。账本只管个人执行层，用 `externalRef` 指向 `(teamId, itemKey)`，完成走既有 resolve intent 回写，不复制任何排期字段。
- **不做**：通用 workflow DSL / BPMN 引擎、PPT/文档渲染管线、多人协作编辑 UI、在 `ScheduledMessagesManager` 里新增 UI（它已 12,874 行，账本 UI 在 memory-exploring 独立生长）。

## 入口

**任务中心页面**：扩展的 memory-exploring 页 → 侧边栏「🗂 任务中心」，或直接 `memory-exploring.html#/task-center`。

页面提供：分层激活状态条（L0/L1/L2 各自是否就绪）、按执行顺序分组的任务列表（需要处理 / 待执行 / 已暂停 / 已完成）、类型筛选（含「需要处理」收件箱 chip）、同标题反思候选折叠、任务详情（含子任务树、产物、Sheet 镜像状态）、新建 / 编辑共用同一弹窗（开发委派可开 plan gate、选依赖与父任务；字段随类型变化，调度器按 L2 是否就绪置灰）。详情里 `input_required` 提供「批准继续」（`retry`）。编辑走 `PATCH /task-center/tasks/:id`，载荷与新建相同，不会另建一条。

行级操作对齐定时消息页：暂停 / 恢复、编辑、删除；详情里额外提供立即执行、失败重试、标记完成、复制。暂停把 `queue_status` 设为 `paused`，到期扫描会跳过；恢复不改原 `scheduledAt`。删除走 `DELETE /task-center/tasks/:id`（先清关联 session / result / attempt，再删账本行）。页头「清理已完成」对应定时消息页同名动作，走 `POST /task-center/cleanup-completed`。

**会话交接（MCP）**：Claude Code / Codex 等 MCP 客户端可调用 `create_ledger_task`，把定稿工作单写入账本（开发委派默认 `planGate=true`，验收标准必填）。不写 Google Sheet；☁️ 镜像仍由扩展做。不做 OpenClaw 记忆笔 / `save_intent_fragment`。

端到端验证：

```bash
npm run verify:task-center-ui
```

## 实施阶段

| Phase | 内容 | 验收 |
|---|---|---|
| **1 通电** ✅ | `recurrence_spec` + `memory_cron` 调度、`parent_action_id`、depends_on 消费、`resume_action_id` 通用续跑、drain 短 interval、`POST /task-center/tasks` 统一入口、任务中心 UI | 两条 lane 的任务共用同一账本/幂等/runtime-status |
| **1b L0 投递与能力面** ✅ | 🏠 执行后投递、AI Report `run_http_push`、帮我问、L1 认 AsMe、「提醒我」文案 | 没配 L2 也能用文本推送 / AI Report / Agent / 帮我问；投递失败可见 |
| **2 执行承载** ✅ | worker lease 续租、公共池 claim + 空闲判定、file artifact 契约 | lease 心跳续租；未绑定任务进共享池按 capabilities 领取；`kind:'file'` 收据（路径强制相对、禁 `..`） |
| **3 人工节点** ✅ | `input_required` 通用停靠、plan gate UI、依赖/父任务编辑、产物展示、反思挂树、MCP `create_ledger_task` | 开发委派可先停在批准；详情可见产物；反思候选带 `taskKind` |
| **4 收敛** ⏸ | Sheet 降只读镜像、GAS access 降 `DOMAIN`、升级通道解冻 | **暂缓**：现网无法发新 App Script；切断 Jira→GAS 会停 ☁️ 24/7 |

每期独立可验收、独立可停；Phase 1 与"方案 B 最小化"完全重合，最坏情况零浪费。


## 从消息到待办提案（Attention Triage）

### 大白话运行逻辑

分诊认为消息重要时只写 `attention_items`，没有用户动作就没有任务。用户在原消息旁点「创建待办」或「只创建提醒」，才会创建一条 `task_kind=remind`、`source_kind=attention` 的 `proposed_actions`；两者均保留来源，后者的 `params.reminderOnly=true` 明确提醒意图。创建动作具有稳定幂等键，重复点击不会产生多个任务。

### 提醒与闭环

这类任务由 Heartbeat 单独读关注项账本，任务队列行保持 manual/paused，避免 ActionExecutor 再发一次。`recurrence_spec` 保存三次计划：到期前两天、前一天、当天的当地早晨 9 点。所有通知先经 ProactivityPolicy；只有通知成功写入 `notification_records` 才在同一事务扣一次预算。每项两次间隔至少 24 小时、最多 3 次；每日 attention 通知上限 3 条，晚恢复时不补发一串已错过的提醒。

- 状态：candidate → proposed → armed（点击接受）→ done（提醒预算耗尽）；也可以 completed、dismissed、cancelled、expired。到期后 7 天 expired；到期当天结束后不再发送提醒。
- 「不相关」和取消均为持久状态；重入库和重复点击不会重新激活。Task Center 的取消/完成用数据库 trigger 立即同步关注项，Heartbeat 再维护过期项。
- 夜间 E 阶段只核对同群、显式关联原消息的后续证据：deadline/commitment 需要 owner 回复明确完成词；request 需要 owner 回复，waiting 需要对方回复。无关联的 done、别人的 done、否定完成和聊天里的取消都不改变状态。完成保留 `completed_evidence_id` 并停止剩余提醒。
- 接受、完成、不相关等写 `attention_feedback` 和 `memory_feedback_events`；同一事项的负反馈会阻止再次出卡。没有外发、WD 提交、日历或 Jira 写回。

表结构：`078_attention_triage.sql`；逻辑：`AttentionService`、`HeartbeatLoop`、`SleepReconciliation.attention`。本地验证：`npm --prefix memory-service test -- --run src/__tests__/attentionTriage.test.ts src/__tests__/api-attention.test.ts`。


## Attention Triage 验证与阶段验收（2026-10-15 复核）

**不必往真实工作群造数据。** 仓库提供隔离测试，自动构造请求、确认、完成和取消消息，并推进测试时钟；不会向 RingCentral 发消息、修改系统时间或写入线上记忆。已有实现和原计划的验收门槛要分别记录：

| 阶段 | 已实现 / 已验证 | 尚未满足的原计划验收 |
|---|---|---|
| Phase 0 | 近 90 天只读统计、60 条代理审阅的脱敏语义种子 | 尚无独立人工标注；仅 4 个正例，不能宣称已证明线上召回与误报质量 |
| Phase 1 | 表、纯函数、ingest/v3 挂钩和 shadow | shadow 真实命中质量仍需用人工标签复核 |
| Phase 2 | 四按钮、上级/角色确认、视口门槛、fresh-dist Glip fixture E2E | 当前线上 shadow 不出卡；fixture 不是用户已安装 Chrome / 真实 Glip 的验收证据 |
| Phase 3 | 真实策略筛选与通知落库；三次提醒、冷却、预算、取消和过期自动测试 | 当前线上 shadow 不发提醒；模拟时钟不是 cron 按真实时间运行的证明 |
| Phase 4 | 去重、夜间 E 方法按关联回复完成、Day Pilot 接线、隔离 open-loops API | 独立常驻一页纸的消费端尚未落地；不能把供数 API 写成已完成的一页纸接线 |

因此在这些验收项仍未满足时，整卡应保留 `in_review`，不能据“测试通过”标记全部 phase 完成。

### 最快复现：无需真人对话或等待三天

在仓库根目录运行：

```bash
npm run verify:attention-triage
npm run eval:validate
npm run eval:run -- --suite attention-triage --no-repair
```

第一条同时覆盖纯函数、用户隔离 API 和 `attentionScenario.test.ts`。完整场景经过真实 `/ingest` 入库和 `/attention` 决策 API，再走 `ProactivityPolicy` 和 Heartbeat 的通知落库方法，最后调用夜间 E 阶段方法核对 owner 的同线程 `done`。模拟 10/11、10/12、10/13 三个早晨，检查恰好三条通知；另一个场景在第一次提醒后回复 `done`，检查第二次提醒被停止。取消场景检查再次接受也不能重启。均使用内存数据库，跳过无关后台 LLM 作业。

要看真实扩展代码的卡片点击效果，先 `npm start`，待首次编译成功后 Ctrl-C 停止 watch，再运行：

```bash
npm run verify:attention-triage:e2e
```

它启动一份全新的 Chromium 扩展实例，加载 `dist/`，用本地 Glip 页面和 HTTP fixture 验证四按钮、失败重试、取消、一次性身份 chip 与 Lens 开关。成功后截图为 `test-results/attention-triage.png`。它证明 UI 交互，后台业务链由上一组独立场景证明。

### 可选的真实体验验证

线上 `ATTENTION_TRIAGE_ENABLED=shadow` 时，造消息也不会出现卡片。先完成上述质量复核，并在服务端选择 `lens`（只看卡片）或 `remind`（同时验证用户接受后的提醒）；身份 chip 还需 `ATTENTION_MANAGER_CHIP_ENABLED=true`。扩展 Options 要开启 Memory Lens，重新加载最新扩展后刷新 Glip。

选择允许个人验收的私聊或测试群，使用一个未来日期，且消息必须通过现有捕获/分析路径入库。别人发送请求可以用：

> @Team 请大家在 2026-10-19 前提交 AT-E77 验收目标。Deadline 10/19/2026

如果是自己发送，改成承诺，避免把发给别人的请求误认成自己的任务：

> 我会在 2026-10-19 前提交 AT-E77 验收目标。Deadline 10/19/2026

日期过了就换成未来日期。确认消息至少一半可见并停留 1.5 秒，查询每 5 秒执行一次，等一个查询周期；原消息下方应显示截止日和四按钮。点击前 Task Center 没有新任务；点击「创建待办」后只有一个 `remind` 账本记录。分别用不同标题测试「只创建提醒」「不相关」「已完成」，避免幂等去重影响观察。

完成证据必须是**账号本人对原消息的关联回复** `done`，不是在群里任意新发一条 `done`。此证据入库后由夜间 E 阶段处理，不能承诺点击发送后立即变 completed；单纯打开 `remind` 也不会绕过 `MEMORY_CONSOLIDATION_V3` 原有 A→E 门禁，不要为体验测试跳过其他阶段的质量门。短时人工体验可以直接点「已完成」验证停提醒；三次提醒和 E 阶段逻辑优先用隔离测试，不必真实等数天。
