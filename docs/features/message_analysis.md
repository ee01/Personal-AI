# 记忆入口消息观察规则

_最后更新: 2026-05-06_

> 说明：文件名沿用 `message_analysis_filter.md` 以兼容现有引用；本文档描述的已经不是旧版“消息过滤器”，而是当前的“记忆入口规则 + 系统观察规则”体系。

## 概述

消息分析现在承担两类职责：

1. 从聊天消息中识别哪些内容值得进入记忆系统。
2. 在命中规则后继续触发通知、关注后续、自动回复、摘要或关联操作。

因此，这个能力已经从“过滤消息”演进为“消息观察与记忆入口编排”。

用户在界面中看到的是 **记忆入口规则**。系统内部还会动态挂载 **系统观察规则**，用于帮我问、自我反思等功能的证据采集。这两类规则会一起参与消息分析，但只有用户手动配置的规则会出现在规则页中。

## 核心心智

当前产品心智不是“配置几个 topic filter”，而是：

`后台静默消息分析 -> 规则命中 -> 写入记忆 -> 分发附加能力`

附加能力包括：

- Glip / Chrome 通知
- 自动回复
- 关注后续消息
- 每日或每周摘要
- 关联操作

## 规则分层

### 1. 手动规则 `manualConcernRules`

这是用户在“记忆入口规则”页面中编辑的规则，持久化在 `chrome.storage.local.concernedItems` 中，并通过 snapshot 同步到 memory-service。

用户可配置的典型字段包括：

- `text`: 自然语言描述规则
- `filterGroup`: 群组范围
- `filterSender`: 发送者范围
- `notifyMethod`: 通知渠道
- `digestConfig`: 摘要配置
- `autoReplyConfig`: 自动回复配置
- `followThread`: 关注后续
- `automationPrompt`: 关联操作描述（底层字段名保留）
- `automationRequiresApproval`: 关联操作是否需要批准（底层字段名保留）

### 2. 系统规则 `systemWatchRules`

这是系统运行时动态生成的内部观察规则，用于业务能力的证据采集，不写入用户的 `concernedItems`，也不会显示在“记忆入口规则”页面中。

系统规则的典型来源：

- 帮我问 / Outreach 的答案检测
- 自我反思的临时观察点
- 未来可能扩展的 dream / reflection / resolution 场景

系统规则的目标是“帮助系统理解消息”，不是“让用户直接管理一条记忆入口规则”。

### 3. 统一运行时视图 `analysisRules`

消息分析阶段不会只看用户规则，而是把两层规则合并成统一的运行时规则集：

`analysisRules = manualConcernRules + systemWatchRules`

统一分析可以确保：

- 用户规则与系统规则共用同一条消息分析主链路
- 系统规则不会污染用户的规则列表与统计
- 帮我问 / 反思等能力可以复用现有消息过滤与结构化输出能力

## 范围校验

运行时现在会先做确定性的候选规则筛选，再把候选规则交给 LLM 做语义判断。

筛选依据包括：

- 手动规则的 `filterSender`
- 手动规则的 `filterGroup`
- 系统观察规则的目标群组、已发送会话或目标对象

LLM 返回命中后，通知、自动回复、摘要、关联操作和入库分发前还会再次按消息上下文校验范围。这样可以避免一条只属于某个群组或某个发送人的规则，因为模型误判而在其他聊天里触发。

## 用户可见能力

### 1. 写入记忆

命中规则的消息会进入 memory-service，成为后续 recall、摘要、自我反思和关联分析的输入。

这是所有手动规则的基础能力，也是“记忆入口”名称的核心原因。

### 2. 通知

规则可配置不同通知方式：

- Glip 推送
- Chrome 通知
- @提醒

通知能力基于规则命中结果和配置分发，不再只是简单的关键词提醒。

### 3. 关注后续

一条命中的消息可以继续演化为“关注后续讨论”任务。系统会在之后的消息分析中识别与该消息相关的后续回复、同线程消息和语义相关消息，并将结果沉淀到 follow-thread 能力中。

### 4. 自动回复

规则命中后可生成自动回复草稿，支持：

- 立即发送
- 延迟可拦截
- 手动审核

这部分仍属于消息交互能力，但入口已经统一收口在记忆入口规则中。

### 5. 摘要

规则可以声明对应消息进入每日或每周摘要队列。摘要是命中后的批处理能力，不影响单条消息是否入库。

### 6. 关联操作

规则可用自然语言描述命中后要发生的自动化行为，例如：

- 从消息提取时间区间
- 生成一个或多个未来执行的动作
- 在指定时间调用外部执行器

用户看到的是自然语言动作描述，底层再映射成 RuntimeAction 和 OpenClaw 委派。

## 关联操作与 OpenClaw

### 用户视角

在规则编辑界面里，这项能力以“关联操作”呈现给用户，底层仍然使用：

- `automationPrompt`
- `操作无需批准`

两个输入表达。

默认情况下，“操作无需批准”是勾选状态，意味着命中的关联操作会尽量直接进入自动执行链路；如果用户取消勾选，则对应动作会以待批准方式入队。

### 系统视角

关联操作的执行分为两层：

1. **message-rule planner**
   把规则描述和命中的消息转成 RuntimeAction。
2. **Action Runtime**
   负责排队、调度、执行、失败重试与动作状态记录。

其中：

- memory-service 负责“记住什么时候执行”
- OpenClaw 负责“到时执行什么”

这意味着定时任务的真相源在 memory-service，不在扩展本地，也不在 OpenClaw 侧。

### 当前机制

当前已经落地的自动化能力包括：

- 命中规则后调用 `/api/v1/message-rules/plan`
- 将结果转成一组 RuntimeAction
- 支持即时动作和未来动作
- 支持 `delegate_openclaw` 的 `requiresApproval=true|false`
- Action Queue 可查看对应规则产生的动作

当前 planner 已支持一个明确场景：

- 从请假 / PTO 消息中解析时间范围
- 生成 3 个 RuntimeAction：
  - 1 个立即通知动作
  - 1 个请假开始前动作
  - 1 个请假结束后恢复动作

这个能力证明了“规则命中 -> 提取结构化时间 -> 定时外部动作”的链路可行。

## 定时动作为什么放在 memory-service

对定时任务而言，memory-service 比扩展本地和 OpenClaw 更适合作为调度中心。

原因：

- 扩展本地不可靠，浏览器关闭或 service worker 回收都会影响长期计时
- OpenClaw 适合执行，不适合作为记忆系统的时间真相源
- 动作队列、执行状态、失败重试、审批状态、审计信息都更适合落在 memory-service

因此当前设计是：

- 扩展负责“发现消息命中规则”
- memory-service 负责“计划和调度动作”
- OpenClaw 负责“执行外部系统操作”

## 端到端链路

### 1. 消息进入后台分析

静默消息分析任务开启后，扩展会周期性抓取新消息并进入 `messageDealing`。

### 2. 构建运行时规则

扩展读取：

- 用户手动规则 `concernedItems`
- 运行时系统规则 `systemWatchRules`

然后合并成统一的 `analysisRules`。

### 3. 规则匹配

消息分析模型返回结构化结果，包括：

- `matched_rule_refs`
- `matched_rule_ids`
- `matched_rule`
- `summary`
- `entities`

这里的 `matched_rule_refs` 是稳定字符串引用，例如：

- `manual:<ruleId>`
- `outreach:<sessionId>`

这替代了过去纯数组下标式的脆弱规则编号。

`matched_rule_ids` 仍作为旧格式兼容层保留。当前 agentThinking、Agent Workflow 和普通 filter 模式都会把它归一化到同一套规则解析逻辑里，但新实现仍优先使用 `matched_rule_refs`。

### 4. 消息入库

命中的消息会写入 memory-service，成为可回忆、可摘要、可反思的记忆素材。

### 5. 附加能力分发

命中后的能力分发包括：

- 通知
- 自动回复
- follow-thread
- digest
- 自动化规划

### 6. 自动化规划

若规则包含 `automationPrompt`，扩展会调用 memory-service 的 message-rule planner 创建 RuntimeAction。

### 7. 动作执行

Heartbeat / Action Runtime 会执行已到期且可自动执行的动作。

对于 `delegate_openclaw`：

- `requiresApproval=false` 时，可走自动执行链路
- `requiresApproval=true` 时，动作保留为待批准状态

## 数据模型演进

虽然存储键名仍然是 `concernedItems`，但语义已经发生变化。

### 旧语义

- “关注的话题”
- “是否推送”
- “是否 @我”

### 新语义

- “记忆入口规则”
- “命中后是否写入记忆”
- “命中后是否附加通知 / follow-thread / digest / 自动回复 / 关联操作”

这也是为什么 UI 改名为“记忆入口规则”，而不是继续使用“关注项配置”。

## 界面与入口

### 1. Popup 入口

Popup 中的入口名称已改为：

- `管理记忆入口`

### 2. 规则页

规则页展示的是：

- 用户手动创建的记忆入口规则
- 每条规则的作用范围
- 命中后能力标签
- 关联操作状态
- 对应 RuntimeAction 状态摘要

### 3. 动作队列页

规则产生的 RuntimeAction 可以按 `sourceRefId` 过滤查看，便于从一条规则追到它实际创建的自动化任务。

### 4. Memory Exploring 引导

静默消息分析和规则配置的主引导放在记忆系统相关页面，而不是把“关注话题配置”孤立成一个独立功能区。

## 同步与持久化

手动规则会通过 concernedItems snapshot 同步到 memory-service，方便：

- 多端一致
- 远端 planner / provider 上下文使用
- follow-thread 和规则命中状态协同

同步时会保留：

- 用户规则本体
- 规则能力配置

但不会把系统规则伪装成用户规则写回 `concernedItems`。

## 安全与审批

关联操作的风险控制现在遵循统一策略：

- `delegate_openclaw` 支持 `requiresApproval: true | false`
- 需要审批的动作不能以 `auto` 模式执行
- 自动执行的动作必须显式满足 `requiresApproval=false`

这层约束由 Action Runtime 统一兜底，而不是让每个 planner 各自发明一套审批逻辑。

## 与自我反思 / 帮我问的关系

消息观察规则体系与自我反思、帮我问不是相互替代关系，而是共享底层运行时能力。

合理的复用层次是：

### 应该复用

- RuntimeAction schema
- OpenClaw 审批 / 执行策略
- 动作调度与执行器
- 稳定的 ruleRef / sourceRefId 追踪语义

### 不应过早硬合并

- message-rule planner
- reflection planner
- outreach / answer-resolution planner

原因是这些 planner 的输入、目标和判断逻辑仍然不同。当前更适合复用底层策略和运行时，而不是强行抽一个巨大的“统一 planner”。

## 当前限制

当前自动化 planner 还不是通用自然语言代理，已落地能力主要集中在“从请假 / PTO 类消息中提取时间并排程动作”的模式。

后续可以继续扩展：

- 更多时间表达解析
- 更多外部系统动作模板
- 更通用的自然语言到 RuntimeAction 规划
- 更多系统规则来源

## 2026-05-05 更新：范围匹配与误触发控制

本轮代码检查发现，运行时范围匹配已经有“LLM 前候选筛选 + 分发前二次校验”的设计，但旧的字符串包含匹配过于宽松：例如 `filterGroup=AI` 可能误命中 `Daily Standup`。这会削弱文档里强调的“范围校验”边界。

当前实现已改为更保守的范围匹配：

- 群组 / 发送人先做精确匹配和去空格/连字符后的紧凑匹配。
- 英文、数字、下划线、连字符等名称按完整 token 序列匹配，短词不会再命中其他单词内部。
- 中日韩等无空格名称仍保留安全的包含匹配，方便 `研发` 匹配 `研发群`。
- 新增 / 编辑规则保存时会 trim 群组与发送人条件，空白不会被保存成看似有限制、实际全局生效的条件。
- 规则页会对“所有群组 + 所有发送人”的全局规则、以及过短范围词给出可见提示，引导用户先收窄范围。

业内产品也采用类似心智：Slack Workflow Builder 的消息触发器要求先指定 channel，并用关键词条件控制触发；Zapier Filter step 明确把“只有满足条件才继续执行”作为工作流中的单独步骤。触发-动作系统研究也反复提醒，规则爆炸、重复规则和上下文风险会让用户更难判断自动化后果。因此本功能应继续把范围、审批、动作队列状态放在用户可见路径里，而不是只依赖模型语义判断。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/intl/en-gb/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword)
- [Zapier：Filter Actions](https://docs.zapier.com/powered-by-zapier/zap-creation/filter-actions)
- [Trigger-Action Programming in the Wild: An Analysis of 200,000 IFTTT Recipes](https://www.blaseur.com/papers/chi16-ifttt.pdf)
- [If This Context Then That Concern: Exploring users' concerns with IFTTT applets](https://arxiv.org/abs/2012.12518)
- [Data Privacy in Trigger-Action Systems](https://arxiv.org/abs/2012.05749)

## 2026-05-06 更新：自动回复范围一致性

本轮进一步检查发现，自动回复在统一规则解析后仍保留了一段旧的 `includes` 范围校验。它不会造成越权触发，但会误拦截已经通过新规则匹配器的合法命中，例如大小写不同、空格 / 连字符不同但实际指向同一群组或发送人的规则。

当前实现已收敛为：

- 自动回复先复用统一的 `ruleRef + messageContext` 解析结果。
- 定时消息初始化检查只在确实命中自动回复规则后发生，避免无关消息产生噪音。
- 自动回复、通知、摘要、关联操作都依赖同一套范围边界，减少“某个能力单独用旧匹配逻辑”的分叉风险。

产品上继续建议把规则配置页呈现为“当/则”路径：先展示群组与发送人范围，再展示命中后的通知、摘要、自动回复和关联操作。这样更接近 Slack / Zapier 的触发器 + 条件 + 动作心智，也能缓解 IFTTT 研究里提到的上下文风险判断问题。

## 2026-05-06 更新：联动操作事件上下文与新建路径预览

本轮代码检查发现，普通批量过滤模式下命中记忆入口规则后可以创建 RuntimeAction，但传给 message-rule planner 的 `message.event` 可能为空。原因是原始消息索引只覆盖了逐群处理里的 `messageData.posts`，没有覆盖批量模式的 `standalone` / `threads` 输入。这样会让已经由上游解析出的结构化日程、时间段或地点信息在联动操作阶段丢失。

当前实现已调整为：

- 原始消息索引统一覆盖 `posts`、`standalone`、thread root 和 thread replies。
- 批量过滤和逐群过滤都会把同一个 source post index 传入后续处理。
- planner 请求继续只透传安全归一化后的 `event` 字段，例如标题、起止日期、时间段、地点和毫秒时间戳。
- 新建规则表单加入“当 / 则”预览：左侧汇总消息模式与群组 / 发送人范围，右侧汇总写入记忆、推送、摘要、自动答复、关注后续和联动操作状态。

产品依据：

- Slack Workflow Builder 把 workflow 拆成 trigger、steps、variables 等组成部分，消息关键词也只是明确触发器之一。
- Zapier 的自然语言 builder 会生成步骤列表，并要求测试和批准会产生数据的测试动作。
- 触发-动作编程研究显示，用户容易误判规则行为，尤其是状态 / 事件、即时 / 持续动作之间的差异。
- 注意力感知通知研究提醒，通知系统需要同时考虑信息优先级和打断成本；记忆入口规则的摘要、通知与范围预览应继续显性化。

参考资料：

- [Slack：Build a workflow](https://slack.com/help/articles/17542172840595-Build-a-workflow--Create-a-workflow-in-Slack)
- [Zapier：Create Zaps by describing your workflow](https://help.zapier.com/hc/en-us/articles/44244146813453-Create-Zaps-by-describing-your-workflow)
- [Supporting mental model accuracy in trigger-action programming](https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/)
- [Attention-Sensitive Alerting](https://erichorvitz.com/attend.htm)

## 适用场景

### 1. 个人记忆入库

- 记录和自己相关的重要消息
- 记录项目、政策、人物、时间事件

### 2. 半自动消息治理

- 重要消息推送
- 后续讨论跟踪
- 需要时自动回复

### 3. 自动化编排

- 从聊天中解析结构化事件
- 将聊天消息转化为未来动作
- 定时触发 OpenClaw 对外部系统执行操作

### 4. 系统级观察

- 帮我问在发问前 / 追问前检测是否已经获得答案
- 自我反思临时挂载观察点收集证据

## 结论

当前“消息分析过滤”功能已经升级为：

**记忆入口规则 + 系统观察规则 + RuntimeAction / OpenClaw 自动化编排**

它的职责不再只是过滤消息，而是让聊天消息成为：

- 记忆系统的入口
- 通知与交互能力的触发器
- 自动化任务的结构化来源
