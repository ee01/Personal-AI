# 任务中心（Task Center）

> 一个账本、两条调度 lane。定时推送、Agent 任务、稍后提醒、开发委派、反思候选共用同一张队列表、同一套幂等、同一套人工节点。

- 设计决策与调研过程：[`docs/progressing/agent-task-ledger-plan.md`](../progressing/agent-task-ledger-plan.md)
- 交互原型：[`docs/progressing/agent-task-ledger-demo.html`](../progressing/agent-task-ledger-demo.html)
- ☁️ lane 子文档：[`scheduled_messages_manager.md`](scheduled_messages_manager.md)
- 执行器运行时：[`agent_executor_runtime.md`](agent_executor_runtime.md)

> ⚠️ 勿与 [`task_scheduler_api.md`](task_scheduler_api.md) 混淆：那是 Chrome 扩展后台的 `scheduled_task_*` alarm 调度器（memory_sync 之类的插件内务任务），与本文的任务中心是两套完全不同的东西。

---

## 功能概述

任务中心把用户和 AI 产生的所有"待办执行单"收敛到 memory-service 的 `proposed_actions` 队列上：

| 任务类型 | 谁创建 | 调度器 | 特有能力 |
|---|---|---|---|
| ⏰ 定时推送 | 用户 | 🏠 / ☁️ 可选 | 内容/JQL、通知通道、Timeline 里程碑触发 |
| 🤖 Agent 任务 | 用户 | 🏠 / ☁️ 可选（执行恒在 🏠） | read/write 边界、执行器选择、结果通知模板 |
| ⏳ 稍后提醒 | 用户（Glip 消息 / 网页） | 🏠 固定 | 来源引用、快捷时间 |
| 🛠 开发委派 | 用户 / 会话交接 | 🏠 固定 | 验收标准、plan gate、依赖、文件产物 |
| 🌙 反思候选 | AI（ReflectionWorker） | 🏠 固定 | 主题聚合、必须人工转正才入队 |

## 大白话运行逻辑

1. 不管从哪个入口创建（Glip 输入框、稍后提醒、Jira 规则导入、反思转正、会话交接），都只写**一个** API：`POST /task-center/tasks`。
2. 账本按任务类型和用户配置决定 **lane**：🏠 `memory_cron`（memory-service 到期队列）或 ☁️ `jira_sheet`（Jira Automation 云端触发 + Sheet 镜像行）。
3. 🏠 任务由 memory-service 的到期扫描直接执行；☁️ 任务由扩展同步器写一行 Sheet，Jira rule 每分钟领取，走原有链路。
4. 执行结果、artifact、失败原因**统一记在账本**，不管是哪条 lane 触发的。
5. 需要人拍板的（write 审批、plan gate、产物 review、执行失败）进**收件箱**；其余安静躺在时间轴里。

## 分层激活（初始化）

不是"二选一向导"，而是能力分层。用户装完插件即处于 L0。

| Level | 内容 | 配置成本 | 解锁 |
|---|---|---|---|
| **L0 账本** | memory-service 本地账本 + `memory_cron` | 零配置，默认开启 | 四类任务全可创建（🏠 调度）、插件通知 |
| **L1 推送通道** | Bot（SM AI）/ AsMe RingCentral 凭据 | 中 | Glip 私发 / 群组通知目标 |
| **L2 云端 lane** | Google Sheet + App Script + Jira Automation | 高（需 Google 授权 + Jira 项目 admin） | ☁️ `jira_sheet` 调度器、Timeline 里程碑触发、Drive 附件、AsMe 邮件 |

- **存量用户**：检测到 `scheduledMessagesConfig` 即自动判定 L2 已激活，原 Sheet / Jira 规则**照常运行、无需迁移**；账本以只读镜像方式把存量任务纳入统一列表。
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

每类任务的编辑器字段不同，但共享底部三件套：**重复规则 → 通知通道 → 调度器**。

- **定时推送**：标题、内容/JQL、通知通道、重复规则（含 Timeline 里程碑：项目/里程碑/偏移天数）、调度器。Jira 规则关联的任务内容只读（规则本体在 Jira 侧维护），仅可改暂停/通知目标。
- **Agent 任务**：任务描述（必填）、执行边界（只读/写入，写入需审批）、执行器 + 结果通知群组、成功回执开关、重复规则、调度器。
- **稍后提醒**：来源引用（原消息/网页）、标题、快捷时间（1 小时后 / 今晚 / 明早 / 下周一）或自定义、通知通道。
- **开发委派**：标题、任务说明、**验收标准（必填）**、执行器 + 工作目录、plan gate 开关、依赖任务。

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
| 🔔 插件通知（Chrome notification） | L0 | 始终可用，L0 默认 |
| 🤖 Glip Bot 私发 | L1 | 置灰 + "需 Level 1" + 去配置链接 |
| 👥 Glip 群组 | L1 + Bot 在群 | 同上；投递失败要可见（见下） |

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
| `recurrence_spec` | 重复调度（复用 OutreachEngine 的 scheduleSpec 语义）；完成时按 spec 克隆下一次，幂等键加时间片后缀 |
| `lane` | `memory_cron` / `jira_sheet` |
| `task_kind` | `push` / `agent` / `remind` / `dev` / `reflection` |
| `mirror_ref` | ☁️ 任务对应的 Sheet 行 id（`msg_*`）与同步状态 |

已有但需通电的字段：`depends_on_json`（持久化多年、零消费方）——`listDueAutoActions` 增加"依赖未完成则不出队"，并定义失败传播策略与环检测。

## 与其他系统的边界

- **Jira / roadmap-service 仍是团队事实源**。账本只管个人执行层，用 `externalRef` 指向 `(teamId, itemKey)`，完成走既有 resolve intent 回写，不复制任何排期字段。
- **不做**：通用 workflow DSL / BPMN 引擎、PPT/文档渲染管线、多人协作编辑 UI、在 `ScheduledMessagesManager` 里新增 UI（它已 12,874 行，账本 UI 在 memory-exploring 独立生长）。

## 入口

**任务中心页面**：扩展的 memory-exploring 页 → 侧边栏「🗂 任务中心」，或直接 `memory-exploring.html#/task-center`。

页面提供：分层激活状态条（L0/L1/L2 各自是否就绪）、按执行顺序分组的任务列表（需要处理 / 待执行 / 已完成）、类型筛选、任务详情（含子任务树与 Sheet 镜像状态）、新建任务弹窗（字段随类型变化，调度器按 L2 是否就绪置灰）。

端到端验证：

```bash
npm run verify:task-center-ui
```

## 实施阶段

| Phase | 内容 | 验收 |
|---|---|---|
| **1 通电** ✅ | `recurrence_spec` + `memory_cron` 调度、`parent_action_id`、depends_on 消费、`resume_action_id` 通用续跑、drain 短 interval、`POST /task-center/tasks` 统一入口、任务中心 UI | 两条 lane 的任务共用同一账本/幂等/runtime-status |
| **2 执行承载** | worker lease 续租、公共池 claim + 空闲判定、`poll()` 接线、file artifact | 30 分钟调研任务在远程 worker 跑完并交回 md 路径 |
| **3 人工节点** | `input_required` 通用停靠、反思挂树、产物目录规范 | 反思→批准→执行→产物→review→解锁下游全程可见 |
| **4 收敛** | Sheet 降只读镜像、GAS access 降 `DOMAIN`、升级通道解冻 | 见 scheduled_messages_manager.md |

每期独立可验收、独立可停；Phase 1 与"方案 B 最小化"完全重合，最坏情况零浪费。
