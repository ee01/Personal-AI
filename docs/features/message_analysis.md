# 记忆入口消息观察规则

_最后更新: 2026-05-30_

> 说明：旧引用里可能还会出现 `message_analysis_filter.md`；当前功能文档文件名是 `message_analysis.md`。本文档描述的已经不是旧版“消息过滤器”，而是当前的“记忆入口规则 + 系统观察规则”体系。

## 概述

消息分析现在承担两类职责：

1. 从聊天消息中识别哪些内容值得进入记忆系统。
2. 在命中规则后继续触发通知、关注后续、自动回复、摘要或联动操作。

因此，这个能力已经从“过滤消息”演进为“消息观察与记忆入口编排”。

用户在界面中看到的是 **记忆入口规则**。系统内部还会动态挂载 **系统观察规则**，用于帮我问、自我反思等功能的证据采集。这两类规则会一起参与消息分析，但只有用户手动配置的规则会出现在规则页中。

## 大白话运行逻辑

消息分析会先问“这条消息值不值得记住”，再问“命中了哪个规则，要不要通知、跟进、自动回复或触发联动操作”。手动规则服务用户通知，系统规则更多服务后台证据采集。

结果主要受这些因素影响：

1. 手动规则匹配：用户配置的关注项是通知、摘要和自动化动作的主要触发来源。
2. 系统观察规则：帮我问、自我反思等后台功能可以采集证据，但不应冒充用户手动规则发通知。
3. 群组/发送者范围：规则过滤范围决定消息是否有资格命中。
4. 匹配置信度和安全级别：低置信或带外部副作用的动作要降级、复核或等待确认。
5. 写入记忆质量：摘要、实体、matchedRuleRefs、动作 trace 越完整，后续检索和审计越可靠。

## 核心心智

当前产品心智不是“配置几个 topic filter”，而是：

`后台静默消息分析 -> 规则命中 -> 写入记忆 -> 分发附加能力`

附加能力包括：

- Glip / Chrome 通知
- 自动回复
- 关注后续消息
- 每日或每周摘要
- 联动操作

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
- `automationPrompt`: 联动操作描述（底层字段名保留）
- `automationRequiresApproval`: 联动操作是否需要批准（底层字段名保留）

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
- 系统观察规则的观察起点，旧消息不能倒灌成新证据

LLM 返回命中后，通知、自动回复、摘要、联动操作和入库分发前还会再次按消息上下文校验范围。这样可以避免一条只属于某个群组或某个发送人的规则，因为模型误判而在其他聊天里触发。

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

### 6. 联动操作

规则可用自然语言描述命中后要发生的自动化行为，例如：

- 从消息提取时间区间
- 生成一个或多个未来执行的动作
- 在指定时间调用外部执行器

用户看到的是自然语言动作描述，底层会先尝试映射到 Memory Service 已能确定规划的内部动作；无法内部确定但 prompt 非空的动作，不再因为动作族未知而跳过，而是带完整消息上下文委派给 OpenClaw。

## 联动操作与 OpenClaw

### 用户视角

在规则编辑界面里，这项能力以“联动操作”呈现给用户，底层仍然使用：

- `automationPrompt`
- `操作无需批准`

两个输入表达。

默认情况下，“操作无需批准”是勾选状态，意味着命中的联动操作会尽量直接进入自动执行链路；如果用户取消勾选，则对应动作会以待批准方式入队。

### 系统视角

联动操作的执行分为两层：

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

当前 planner 的分层规则是：

- Memory Service 自身确定能规划的动作优先内部处理，例如从请假 / PTO 消息中解析时间范围，并生成 1 个通知动作、1 个请假开始前动作、1 个请假结束后恢复动作。
- 已知外部目标族（转发、Jira comment、写入表格、Glip status、提醒 / 日程）会生成带目标系统说明的 `delegate_openclaw`。
- 其他非空自然语言联动操作会生成 `openclaw_delegation` fallback：Memory Service 不预判 OpenClaw 是否有能力，只把规则、原消息、消息链接、附件列表和安全要求打包给 OpenClaw，由执行结果返回 success / capability missing / auth error / need human decision。
- 空 prompt 或请假时间窗无法解析这类内部规划失败，仍会返回 `unsupported_or_unparseable_automation_prompt`。

这个能力证明了“规则命中 -> Memory Service 先做确定性规划 -> 可执行外部动作交给 OpenClaw 黑盒执行”的链路可行。

## 定时动作为什么放在 memory-service

对定时任务而言，memory-service 比扩展本地和 OpenClaw 更适合作为调度中心。

原因：

- 扩展本地不可靠，浏览器关闭或 service worker 回收都会影响长期计时
- OpenClaw 适合执行，不适合作为记忆系统的时间真相源
- 动作队列、执行状态、失败重试、审批状态、审计信息都更适合落在 memory-service

因此当前设计是：

- 扩展负责“发现消息命中规则”
- memory-service 负责“计划和调度动作”，并先处理自己能确定完成的内部规划
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

同一条消息可以同时命中多条手动规则。摘要分发会按所有启用摘要的命中规则分别入队；即时通知会选择第一条非摘要且配置了通知渠道的命中规则。因此“摘要-only”规则不会吞掉同一条消息上的其他即时通知规则。

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
- “命中后是否附加通知 / follow-thread / digest / 自动回复 / 联动操作”

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
- 联动操作状态
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

联动操作的风险控制现在遵循统一策略：

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
- 自动回复、通知、摘要、联动操作都依赖同一套范围边界，减少“某个能力单独用旧匹配逻辑”的分叉风险。

产品上继续建议把规则配置页呈现为“当/则”路径：先展示群组与发送人范围，再展示命中后的通知、摘要、自动回复和联动操作。这样更接近 Slack / Zapier 的触发器 + 条件 + 动作心智，也能缓解 IFTTT 研究里提到的上下文风险判断问题。

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

## 2026-05-10 更新：Agent Workflow 联动操作一致性

本轮代码复查发现，`agentWorkflow` 模式下的联动操作规划被放在“需要即时通知”的分支里。这样一条规则即使命中了、也配置了 `automationPrompt`，只要它不发即时通知（例如只写入记忆 + 创建联动操作），就不会生成 RuntimeAction。

当前实现已收敛为：

- 先统一解析命中的手动规则，再分别分发通知、摘要和联动操作。
- 联动操作只依赖“命中了带 `automationPrompt` 的手动规则”，不再依赖 `shouldNotify`。
- `agentWorkflow` 模式会统一处理 `posts`、`standalone` 和 thread root / replies，避免只看旧 `posts` 字段时漏掉当前消息结构里的命中消息。
- 规则卡片里的动作队列提示会跟随该规则的“需批准 / 免批准”设置，不再显示与规则不一致的默认审批文案。

产品上继续沿用“当 / 则”心智：先让用户看到触发范围，再看到命中后的写入记忆、推送、摘要、自动答复、关注后续和联动操作。Slack Workflow Builder 会把消息触发限定到指定 channel 与关键词条件，Zapier 也把 filter / paths 作为显式条件步骤；触发-动作编程研究也提示，用户需要更准确地理解触发条件、动作时机和上下文风险。因此记忆入口规则应继续优先暴露范围、审批状态和动作队列结果。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword)
- [Zapier：Filter & Paths](https://help.zapier.com/hc/en-us/sections/16074338520461)
- [Supporting mental model accuracy in trigger-action programming](https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/)
- [If This Context Then That Concern: Exploring users' concerns with IFTTT applets](https://arxiv.org/abs/2012.12518)
- [Data Privacy in Trigger-Action Systems](https://arxiv.org/abs/2012.05749)

## 2026-05-11 更新：新版消息结构的智能分析入口

本轮复查发现，普通 filter 与 `agentWorkflow` 已能处理 `posts`、`standalone`、thread root / replies，但 `agentThinking` 入口仍假设每个群组都有旧版 `posts` 数组。上游只传新版结构时，智能分析模式会在进入 LLM 前失败。

当前实现已调整为：

- 后台消息分析入口先把 `posts`、`standalone`、thread root / replies 归一化为统一消息列表。
- `IntelligentAgent` 自身也能识别只包含 `standalone` 或 `threads` 的消息组。
- group-by-group filter 模式构建上下文消息时同样复用归一化逻辑，避免新版结构下丢上下文或抛错。
- 验证脚本补充了 standalone-only 的 Agent Thinking 回归用例。

产品上继续建议保留“当 / 则”预览，并在规则页显性展示群组、发送人、审批状态和动作队列结果。Slack 的消息关键词 workflow 要先指定 channel 和关键词条件；Zapier filter/path 也把条件作为 workflow 中的明确步骤。结合 Trigger-Action Programming 研究和 attention-sensitive alerting 研究，记忆入口规则应优先降低误触发、解释触发范围，并把即时通知与摘要的打断成本放在同一路径里呈现。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword)
- [Zapier：Filter Actions](https://docs.zapier.com/powered-by-zapier/zap-creation/filter-actions)
- [Trigger-Action Programming in the Wild](https://www.blaseur.com/papers/chi16-ifttt.pdf)
- [Attention-Sensitive Alerting](https://erichorvitz.com/attend.htm)

## 2026-05-13 更新：最终规则校验与安全摘要

本轮代码复查发现，普通 filter 模式虽然会在 LLM 前按群组筛出候选规则，但合并批量分析时仍可能出现模型把某个群组外规则写进 `matched_rule_refs` 的情况。此前通知、摘要和联动操作会在分发前再次解析规则范围，但入库动作发生得更早，存在“无效命中也写入记忆”的污染风险。

当前实现已调整为：

- `reviewMessageByLLMAndSendToBot` 会先用 `matched_rule_refs` / `matched_rule_ids` / `matched_rule` 解析运行时规则，并按消息上下文做最终范围校验。
- 如果没有解析到有效用户规则或系统观察规则，也没有合法的 follow-thread 原消息关联，则跳过入库、通知、摘要、自动答复和联动操作。
- owner 发言学习也复用新版消息归一化入口，支持 `posts`、`standalone`、thread root / replies，避免只学习旧版扁平消息。
- 规则页和新建规则预览增加安全摘要：全局范围、过短范围词、即时通知、免批准联动操作会被汇总成状态标记，帮助用户在保存前看到规则风险。

产品依据：

- Slack 关键词 workflow 要先选 channel，再设置 include / exclude keyword conditions。
- Zapier 把 filter / paths 作为明确的条件步骤，只有满足条件才继续执行后续动作。
- Trigger-Action Programming 研究显示，用户会大量创建和复制规则，重复与上下文误判会削弱可理解性；因此系统需要在执行前保留确定性范围校验。
- Attention-sensitive alerting 研究强调通知应权衡信息价值与打断成本；规则页的安全摘要把即时通知、摘要和自动执行风险放到同一条路径里展示。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword)
- [Zapier：Filter & Paths](https://help.zapier.com/hc/en-us/sections/16074338520461)
- [Trigger-Action Programming in the Wild](https://www.blaseur.com/papers/chi16-ifttt.pdf)
- [Attention-Sensitive Alerting](https://erichorvitz.com/attend.htm)

## 2026-05-17 更新：Agent Thinking 最终校验与范围提示降噪

本轮复查发现，普通 filter 模式已经会在入库前做最终范围校验，但 `agentThinking` 模式仍可能直接相信模型返回的 `shouldStore=true`。如果模型输出了越界的 `matchedRuleRefs`，消息可能被错误写入记忆。

当前实现已收敛为：

- `agentThinking` 在每条消息完成思考后，会用统一的 `resolveMatchedWatchRules` 再解析 `matchedRuleRefs` / `matchedRuleIds` / `matchedRule`。
- 规则命中必须通过发送人、群组和系统观察规则的最终范围校验，才保留入库或通知决策。
- 未通过校验的命中会清空规则引用，并把 `shouldStore` / `shouldNotify` 置为 `false`，避免污染记忆和触发通知。
- 规则安全提示与运行时匹配策略对齐：两字中文范围名（例如 `研发`）不再被当成短范围风险；英文短词（例如 `AI`）仍会提醒用户复核。

产品依据继续沿用触发器 + 条件 + 动作的心智：Slack 的消息关键词 workflow 需要先指定 channel，再配置关键词条件；Zapier 的 filter / paths 会在条件不满足时停止后续动作。结合触发-动作编程和注意力感知通知研究，记忆入口规则应把范围校验作为执行前硬边界，同时减少误报式安全提示对用户配置路径的干扰。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811)
- [Zapier：Filter and path rules in Zaps](https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zaps)
- [Trigger-Action Programming in the Wild](https://www.blaseur.com/papers/chi16-ifttt.pdf)
- [Attention-Sensitive Alerting](https://erichorvitz.com/attend.htm)

## 2026-05-20 更新：编辑路径安全预览

本轮复查发现，新建规则已有“当 / 则 + 安全摘要”预览，但编辑已有规则时，用户调整群组、发送人、即时通知、摘要、自动答复、关注后续或联动操作后，要保存并回到规则卡片才会看到完整风险摘要。

当前规则页已补齐：

- 编辑表单底部会实时展示“当 / 则”预览，和新建规则路径一致。
- 预览会汇总写入记忆、Glip / Chrome、摘要、自动答复、关注后续、联动操作及审批状态。
- 安全摘要继续使用同一套判断：全局范围、短范围词、即时通知、免批准联动操作会在保存前提示。

产品依据继续沿用 Slack / Zapier 的显式条件步骤心智；TAP 安全研究也提示规则误解、冲突和意外链路会带来风险，所以范围与动作结果应在编辑提交前可见。

## 2026-05-21 更新：摘要-only 分发路径

本轮复查发现，定时摘要在运行时被绑在即时通知渠道下：规则即使保存了 `digestConfig.enabled=true`，只要没有勾选即时 Glip / Chrome 推送，就可能只写入记忆而不会进入摘要队列。规则卡片又会显示“每日/每周摘要”标记，造成界面承诺与后台分发不一致。

当前实现已收敛为：

- 摘要是一种独立的命中后动作，不再要求规则同时启用即时通知渠道。
- 普通 filter、Agent Workflow 和 Agent Thinking 三条路径都会先检查摘要配置；启用摘要时仍保留“替代即时通知”的语义，只入队摘要，不立即推送。
- 新建与编辑规则时，非关注后续规则都可以直接配置定时摘要，避免用户为了获得摘要而被迫打开即时 Glip 推送。

产品依据：

- Slack 关键词 workflow 把 channel、关键词和后续 step 拆成显式条件与动作。
- Zapier Filter 把条件作为 gatekeeper，只有满足条件才继续执行对应后续步骤。
- 注意力感知通知研究强调要平衡延后提醒成本和即时打断成本；摘要-only 路径就是把低打扰分发作为一等动作。
- TAP bug 研究显示，用户难以准确预测有 timing / control-flow 隐含条件的规则行为；因此“摘要”和“即时通知”不应有隐藏依赖。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/intl/en-gb/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword)
- [Zapier：Filter by Zapier](https://zapier.com/apps/filter/integrations)
- [Attention-Sensitive Alerting](https://arxiv.org/abs/1301.6707)
- [How Users Interpret Bugs in Trigger-Action Programming](https://par.nsf.gov/biblio/10106413-how-users-interpret-bugs-trigger-action-programming)

## 2026-05-21 更新：摘要替代即时通知的界面语义

本轮复查发现，运行时已经把摘要视为低打扰分发路径：启用摘要后，命中规则会进入摘要队列，不再同时发送 Glip / Chrome 即时通知。但规则卡片和部分当/则预览仍可能把即时通知一起展示，造成“会摘要，也会马上推送”的错觉。

当前界面已对齐运行时：

- 新建 / 编辑预览只把摘要显示为“每日/每周摘要（不即时推送）”。
- 规则卡片中启用摘要的规则不再展示被运行时抑制的 Glip / Chrome 即时通知标签。
- 安全摘要继续把摘要视为非即时打扰，不因为历史 notifyMethod 字段残留而误报即时通知。

产品依据仍然是触发器 + 条件 + 动作的可解释路径：Slack 关键词 workflow 与 Zapier filter/path 都把触发条件和后续步骤显式拆开；TAP bug 研究也说明，隐藏的控制流会削弱用户对规则结果的预测能力。这里的改动重点是让卡片承诺和运行时真实行为一致。

## 2026-05-22 更新：系统观察运行时摘要

本轮复查发现，规则页虽然说明“系统观察规则不会出现在这里”，但用户无法判断当前是否真的有内部观察在运行，也看不到它们为什么不计入手动规则列表。这会让帮我问 / 自我反思等内部能力看起来像黑盒，尤其是在用户打开规则页排查“为什么系统还在观察消息”时。

当前规则页已补齐：

- 顶部说明区会读取 Outreach runtime status，显示正在运行的内部观察总数。
- 摘要按 `发送前观察 / 等待回复 / 待批准 / 延后` 展示当前状态，区分“待发送”和“等别人答复”。
- 只展示前几条观察样例的目标、状态和问题摘要，帮助用户理解来源；这些系统规则仍不会写入 `concernedItems`，也不会进入手动规则的导入、导出、编辑和统计。
- 摘要区提供“查看主动询问证据”入口，让用户能从内部观察样例跳到 Outreach 的证据、状态变化和追问记录页。
- Memory Service 未配置或读取失败时，规则页会显示不可用状态，但手动规则管理不受阻塞。

产品依据仍然是显式条件与可审计自动化：Slack Workflow Builder 要求先选 channel 和关键词条件，Zapier filter/path 会把条件作为明确 gate；TAP 可理解性研究指出用户需要看到触发条件和动作后果，attention-sensitive alerting 研究也提醒内部观察不应伪装成即时通知。这里的改动重点是给系统观察一个只读运行时窗口，而不是把内部规则暴露成可编辑配置。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811)
- [Zapier：Filter and path rules in Zaps](https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zaps)
- [Making trigger-action rules more comprehensible](https://www.sciencedirect.com/science/article/pii/S1071581925001703)
- [Attention-Sensitive Alerting](https://arxiv.org/abs/1301.6707)

## 2026-05-27 更新：联动操作默认 OpenClaw 委派

本轮复查发现，旧 message-rule planner 会先把 `automationPrompt` 映射到少数动作族；无法映射时直接跳过，因此“下载消息视频、上传到 Drive、把链接发给我”这类自然语言联动操作即使命中了规则，也不会进入 OpenClaw。新的机制改为内部优先、外部兜底：Memory Service 能确定规划的动作先内部处理，其他非空 prompt 一律创建 `delegate_openclaw`，并用 `openclaw_delegation` 标记说明这是黑盒委派。

委派任务会携带原始联动描述、命中消息、RingCentral message URL、结构化附件列表、文件名、类型、大小和可用 source/message/download/preview link。OpenClaw 在执行后再返回真实能力状态；如果缺少附件源、Drive 权限、connector 或账号授权，必须返回明确 blocker，而不是假装完成。

产品依据是把“触发判断”和“执行能力”分开：Memory Service 负责确定性范围校验、去重、调度和审计；OpenClaw 负责外部系统执行。这样既不会因为 planner 白名单过窄丢任务，也保留了失败、缺能力、缺授权时可追踪的恢复路径。

## 2026-05-27 更新：系统观察证据跳转

本轮复查保留“系统观察只读、手动规则可编辑”的边界，但把排障路径补齐：当规则页显示内部观察正在运行时，用户可以直接跳到主动询问页查看证据、状态变化和追问记录。这样既不把系统规则混入手动规则列表，也不让“系统还在观察消息”停留在无法追溯的黑盒状态。

产品依据仍然是触发条件和动作后果必须可解释：Slack / Zapier 会把触发条件、范围和后续步骤拆开展示；触发-动作规则研究也说明，用户需要能检查规则为什么触发、为什么没有触发以及触发后会发生什么。

## 2026-05-28 更新：多规则命中的摘要与即时通知分发

本轮复查聚焦“消息入库与通知分发”。旧运行时在普通 filter、Agent Workflow 和 Agent Thinking 三条路径里，摘要与即时通知只看第一条命中的手动规则；如果第一条规则是摘要-only，后面另一条即时通知规则会被吞掉，界面上看起来“都命中了”，实际却只进摘要。

当前实现已收敛为：

- 摘要队列按所有命中的摘要规则分别入队，同一 `postId + ruleId` 仍保持去重。
- 即时通知选择第一条非摘要且配置了 `notifyMethod` 的命中规则。
- 关注后续通知仍优先于普通即时通知，保持“后续回复”场景的原消息上下文。
- 普通 filter、Agent Workflow 和 Agent Thinking 共用同一套分发选择逻辑。
- Agent Workflow 的测试结果也按同一逻辑解释：摘要-only 命中代表写入记忆和进入摘要队列，不再在 `shouldNotify` / 保存基线里显示成即时通知。

产品依据是触发条件与后续步骤需要显式、可预测：Slack 关键词 workflow 会先限制 channel 和 keyword，再执行后续 steps；Zapier filter/path 也把条件 gate 与分支步骤拆开。Trigger-action programming 研究指出，多规则和隐藏控制流会让用户误判自动化结果；attention-sensitive alerting 研究则提醒即时通知与延后摘要应分开权衡打断成本。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811)
- [Zapier：Filter & Paths](https://help.zapier.com/hc/en-us/sections/16074338520461)
- [Supporting mental model accuracy in trigger-action programming](https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/)
- [Attention-Sensitive Alerting](https://arxiv.org/abs/1301.6707)

## 2026-05-30 更新：系统观察时间边界

本轮复查聚焦“系统观察规则”。旧运行时已经会按目标群组 / 会话过滤 Outreach 观察规则，但没有使用规则自带的 `baselineAt`。如果消息分析批次里混入旧消息，模型仍可能把观察开始前的历史内容标成当前主动询问证据，导致系统以为“已经有人回答了”。

当前实现已收敛为：

- Outreach 系统观察规则继续按已发送会话、目标 chat 或目标标签做范围校验。
- 当消息时间可用时，候选规则筛选和最终 `matched_rule_refs` 解析都会要求消息时间不早于系统观察起点。
- 同一群组批次里只要有一条新消息在观察窗口内，就保留该系统规则给 LLM；最终单条消息入库前仍会再按该消息自己的时间校验。
- 缺少消息时间的旧调用保持兼容，不因为没有时间字段而直接屏蔽系统观察，但新版 filter、Agent Workflow 和 Agent Thinking 都会传入时间。

产品依据是触发范围不仅包括“哪里 / 谁”，也包括“从什么时候开始”：Slack 关键词 workflow 把 channel 和 keyword 条件显式化，Zapier filter 支持 date/time 条件；TAP 心智模型研究也提示，用户容易误判隐藏的状态与事件边界。因此系统观察需要只读可审计，同时避免旧证据倒灌成新结论。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811)
- [Zapier：Filter and path rules in Zap workflows](https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zap-workflows)
- [Supporting mental model accuracy in trigger-action programming](https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/)
- [Attention-Sensitive Alerting](https://arxiv.org/abs/1301.6707)

## 2026-05-24 更新：后台采集关闭时的保存后恢复路径

本轮复查发现，普通“写入记忆”的入口规则和自动答复 / 关注后续一样，都依赖后台静默消息分析。如果后台采集关闭，规则虽然能保存到列表里，但不会自动捕获新消息，也就不会写入记忆或触发摘要、通知、联动操作。此前页面提示只强调自动答复和关注后续，容易让用户误以为普通规则保存后已经生效。

当前规则页已对齐：

- 顶部关闭提示改为覆盖所有记忆入口规则，明确“先保存，但需要开启后台记忆采集后才会自动捕获新消息”。
- 新建、编辑或导入手动规则后，如果静默消息分析未开启，会提示用户立即启用，而不是只在自动答复 / 关注后续规则上提示。
- 规则页监听 `taskSchedulerStates` 的真实存储键，外部任务开关变化后状态条能同步更新。

产品依据：Slack 关键词 workflow 要先选 channel 与关键词条件，Zapier filter/path 会把条件 gate 与后续动作拆开；TAP 可理解性研究也说明，用户需要看到规则什么时候真正开始运行。因此记忆入口规则在“保存”和“开始观察消息”之间必须保留清晰恢复路径。

## 2026-05-24 更新：多个群组 / 发送人范围候选

本轮复查还发现，用户自然会把一个规则写成“这几个群都算”或“这几个人都算”，但旧运行时会把 `A, B` 当成一个完整长字符串匹配，容易让保存后的规则看起来有限定、实际却完全不触发。

当前规则范围已对齐：

- `filterGroup` / `filterSender` 支持逗号、中文逗号、顿号、分号或换行分隔多个候选。
- 运行时按 OR 语义校验：群组候选任一命中，且发送人候选任一命中，规则才继续交给 LLM 和后续分发。
- 规则页的卡片、当 / 则预览和提示会显示“或 / 任一候选命中”，避免用户误以为多个值需要同时命中。

这延续了 Slack channel scope + keyword condition、Zapier filter/path 的显式条件心智；用户能用一个规则覆盖几个明确上下文，但仍保留最终范围校验这条硬边界。

## 2026-05-26 更新：多个范围候选的 Prompt 语义

本轮复查发现，运行时和界面已经把 `filterGroup` / `filterSender` 的多个候选解释为 OR，但传给 LLM 的规则文本仍直接拼接原始字符串，例如 `Morgan Lee; Alice 在 Release Chat, SDK Updates 中发送的...`。这不会绕过最终确定性范围校验，但会让模型更容易把多个候选误读成一个完整名称，造成命中率不稳定。

当前实现已对齐：

- prompt 构建会把多个群组写成 `在任一群组（A 或 B）中`。
- prompt 构建会把多个发送人写成 `任一发送人（A 或 B）`。
- `[RULE_REF:manual:...]` 与 `[RULE_ID:N]` 提示保持不变，继续优先用稳定 ruleRef 解析。
- 运行时仍以确定性范围校验为硬边界；LLM prompt 只是让语义匹配更接近用户在规则页看到的“任一候选命中”。

产品依据：Slack 的消息关键词 workflow 会先选择 channel，再配置 include / exclude keyword conditions；Zapier filter/path 会把条件和 AND/OR 规则显式化。触发-动作编程研究也指出，非程序员容易在复杂触发条件上产生心智误差，界面和系统表示应使用更清晰的语言线索；注意力感知通知研究则提醒，规则触发通知时应同时考虑打断成本。因此手动规则的范围候选不仅要在 UI 显示 OR，也要在 LLM 解释层保持同样的 OR 语义。

参考资料：

- [Slack：Create a Slack workflow that starts with a keyword](https://slack.com/help/articles/43844341409811)
- [Zapier：Filter and path rules in Zaps](https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zaps)
- [Making trigger-action rules more comprehensible](https://www.sciencedirect.com/science/article/pii/S1071581925001703)
- [Attention-Sensitive Alerting](https://arxiv.org/abs/1301.6707)

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
