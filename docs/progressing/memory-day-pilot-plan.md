# Memory Day Pilot：今日记忆领航台

> 生成日期：2026-05-11 CST  
> Codex 会话标题建议：新能力：今日记忆领航台  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-day-pilot-demo.html`](./memory-day-pilot-demo.html)

## 结论

建议设计一个新的 Personal AI 能力：**Memory Day Pilot / 今日记忆领航台**。

它不是另一个搜索页，也不是把通知堆成信息流，而是在每天开始前和工作切换时，把 Personal AI 已经保存的消息、会议、日历、网页、AI 对话、操作记忆、关系记忆、决策和 skill，整理成一张当天可执行的个人工作飞行计划：

- 今天有哪些真正值得注意的 mission。
- 每个 mission 为什么现在重要。
- 相关人、项目、会议、消息和 AI 线索是什么。
- 会议前需要问什么，会议后要闭环什么。
- 哪些上下文可以一键交给 Codex / ChatGPT / Claude / 豆包。
- 哪些提醒应该今天出现，哪些应该静默。

一句话价值：

> Personal AI 不只在你打开某个页面时“想起一条记忆”，而是在每天开始前帮你把分散记忆变成一份可执行的今日作战简报。

## 为什么值得做

Personal AI 的长期目标是保存用户与 AI、网页、消息、会议、操作、偏好和 skill 的全部记忆，并在真实场景中提供关联提示。现在已有能力方向覆盖了很多单点：

- `Context Assist`：单场会议或输入框旁的上下文提示。
- `Relationship Memory Radar`：以人为中心恢复关系上下文。
- `Decision Time Machine`：按需回放历史决策证据链。
- `Operation Memory Flight Recorder`：保存跨工具操作 episode。
- `Personal Skill Foundry`：把反复有效的做法沉淀成 skill。
- `Memory Trust Console`：治理记忆可信度、隐私和证据。

这些能力都很重要，但用户每天真正遇到的问题是：

1. 信息不是没有，而是散在 RingCentral、会议、日历、Jira、AI 对话、网页和本地操作里。
2. 用户早上或进入工作状态时不知道“今天最该看哪几件事”。
3. 单条提醒太碎，长期容易变成噪音。
4. 单场会前准备很好，但用户一天有多场会和多个异步 thread，需要跨全天排序。
5. 有些事不需要马上通知，但需要在合适时间放进今天的 attention budget。
6. 用户经常把上下文交给其他 AI，但每次手动拼装成本高。

Memory Day Pilot 解决的是“日级别的上下文编排”。它把所有已有记忆能力组织成当天的可执行 cockpit，而不是继续增加分散入口。

## 本次输入信号

### Reminders 检查

本机 Reminders 可枚举列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。当前没有名为 `Personal AI` 的列表。

因此本次没有从 Reminder 随机抽取全新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次 `http://10.32.56.212:3210/health` 返回 `degraded`，数据库状态显示未连接；随后通过 SSH 只读查询远端 `memory-service/data/users/esone.qiu/memory.db`，没有写入远端数据。

读到的关键统计和场景：

- `messages_raw` 主要来源为 `glip` 8638 条、`meeting` 239 条、`system/doubao_chat` 115 条、`calendar/ringcentral_indexeddb` 87 条、`system/chatgpt` 36 条。
- 用户身份已确认：Esone Qiu，Scrum Master，时区 Asia/Shanghai。
- 最近真实消息包含：别人询问 webpage-mcp 怎么配、Codex Chrome 插件与 webapp MCP 功能交叉、AI Notes 测试重试问题、HLS 版本 on hold、Capacity Management poster 未上传、Jira 数据统计协作、Codex / Claude Code / Cursor / Factory.ai / OpenAI deal 等 AI 工具讨论。
- 未来日历里已经有多场 recurring meeting 和 AI 相关会议，例如 `CoP - 基于AI的个人发展和工具`、`Agile Community Weekly`、`Bug - AI 先修一遍我再看`、`RCVSDK Daily Sync`、`Nova Brandy daily` 等。
- `notification_records` 里已经有大量 truth conflict 类待关注项，但时间戳显示为 1970 附近，说明已有“提醒候选”能力还缺少一个用户可理解、可排序、可复核的日级入口。
- `USER_CORE.md` 的偏好和关键人物仍很稀疏，但 messages 和 relationship tables 已经包含很多可用上下文，适合先做“当天任务编排”，同时反哺 profile 校准。

这些信号说明：用户不是缺少原始记忆，而是缺一个每天把“今天该关注什么、先做什么、用哪些上下文”讲清楚的入口。

### 已有方案避让

本方案刻意避开已有 progressing 方案的主对象：

| 已有方案 | 主对象 | Day Pilot 的边界 |
|---|---|---|
| Context Assist | 单场会议 / 单个输入框 | 消费其 cue cards，但按全天 mission 编排 |
| Relationship Radar | 人际上下文卡 | 消费 person cards，但不做人际 CRM |
| Decision Time Machine | 决策证据链 | 只在 mission 需要时引用，不管理决策 episode |
| Operation Flight Recorder | 操作过程 episode | 可把今日任务完成过程写回 episode，不负责捕获 |
| Skill Foundry | 技能资产库 | 可推荐今天可用的 skill，不管理 skill 真源 |
| Memory Trust Console | 记忆质量治理 | 消费 trust score，不做全量治理页面 |
| Proactive Notification System | 通知渠道与预警 | Day Pilot 是通知的日级编排和复核台，不是渠道层 |

## 行业观察

### ChatGPT Pulse：主动每日简报成为主流形态

[ChatGPT Pulse](https://help.openai.com/en/articles/12293630-chatgpt-pulse) 是 OpenAI 的每日主动体验，会基于 past chats、memory、feedback 和连接的 app 做异步研究，并在第二天以可扫读视觉摘要呈现。OpenAI 的发布说明也强调 Pulse 会基于 chats、feedback 和 connected apps such as calendar 生成个性化更新。

启发：

- 用户会接受“AI 在我没问的时候先准备好”的体验，但必须可控。
- 视觉摘要比长文更适合每日入口。
- 反馈和 curate 是关键，否则主动内容会变噪音。

Personal AI 的机会：

- ChatGPT Pulse 主要在 ChatGPT 内部。Personal AI 可以把 RingCentral、Jira、会议、日历、浏览、AI 对话和本机操作一起编排。
- Personal AI 可以显示每张卡的本地证据、隐私边界和一键外部 AI handoff。

### Gemini Scheduled Actions：用户开始期待可定时的 AI 工作

[Gemini Scheduled Actions](https://blog.google/products-and-platforms/products/gemini/scheduled-actions-gemini-app/) 支持让 Gemini 在特定时间或周期执行任务，例如早上总结 calendar 和 unread emails，或每周生成创意。

启发：

- “每天 8 点给我一份摘要”会成为自然交互。
- 定时任务要能在设置里管理、暂停和删除。
- 不应该只生成泛泛摘要，而要结合用户当天真实上下文。

Personal AI 的机会：

- 用户已有 memory-service、Chrome extension、desktop app 和真实工作数据，比单个 prompt 的 scheduled action 更能理解“今天的工作脉络”。

### Notion 3.0 Agents：工作空间里的 agent 正在从聊天变成行动

[Notion 3.0](https://www.notion.com/en-gb/blog/introducing-notion-3-0) 把 AI Agent 放到工作空间中心，强调 agent 能跨页面、数据库和工具执行多步工作，甚至把 meeting note 转成 proposal、task tracker 和 follow-up messages。

启发：

- AI 的下一步不是回答问题，而是组织和推进真实工作。
- 一个 agent 必须理解 workspace 和上下文，才能做出有用行动。

Personal AI 的机会：

- Notion 的上下文主要在 Notion workspace。Personal AI 的上下文源更私人、更跨工具、更接近用户真实一天。

### Granola MCP：会议上下文正在成为 AI 工具的数据源

[Granola MCP](https://www.granola.ai/blog/granola-mcp) 让用户把会议笔记接给 Claude、ChatGPT、Cursor、Claude Code 等 AI 工具，减少在会议记录和 AI 工具之间复制粘贴。

启发：

- 会议上下文应该跟着用户去别的 AI 工具，而不是留在会议产品里。
- MCP / connector 是跨 AI handoff 的现实路径。

Personal AI 的机会：

- Day Pilot 可以把“今天每个 mission 的最小上下文包”作为 MCP 或 Provider Context Package 暴露出去，不只暴露会议原文。

### Anthropic Context Management：长任务需要外部记忆和上下文修剪

[Claude Context Management](https://claude.com/blog/context-management) 发布了 context editing 和 memory tool，强调长任务会超出上下文窗口，memory tool 能把关键知识保存到上下文窗口之外，并在后续 agent session 中使用。Anthropic 报告 memory tool + context editing 在内部 agentic search 评测中相对 baseline 提升 39%。

启发：

- 不能把全天所有记忆塞进 prompt。
- 必须提前做 context curation，保留高信号，清掉旧工具结果和噪音。

Personal AI 的机会：

- Day Pilot 正是把“今天可能需要的上下文”提前策展出来，供用户和其他 AI 低成本使用。

### 研究方向：主动助手和前瞻式反思正在成熟

[ProAgent](https://arxiv.org/abs/2512.06721) 提出用 on-demand tiered perception 和 context-aware proactive reasoner 做日常生活中的主动帮助，强调低成本上下文线索先行、需要时再取更丰富感知。

[PreFlect](https://arxiv.org/abs/2602.07187) 提出从历史轨迹里总结常见计划错误，在执行前做 prospective reflection，避免只在失败后反思。

启发：

- Day Pilot 不应该全量深度分析所有记忆，而应先用低成本 delta scan 和日历/消息信号筛出候选。
- 真正高价值的是“执行前提醒可能踩坑”，而不是执行后写总结。

## 产品定位

### 功能名

**Memory Day Pilot / 今日记忆领航台**

备选中文名：

- 今日记忆驾驶舱
- 每日上下文领航
- Personal AI Daily Pilot
- Memory Pulse Board

推荐使用“今日记忆领航台”，原因：

- “今日”强调日级入口，不和单场会议或单个人页面冲突。
- “记忆”明确来自 Personal AI 的长期记忆。
- “领航”比“通知”更贴近用户需求：帮用户判断路线、优先级和注意力，而不是只推消息。

### 一句话产品承诺

> 每天开始工作前，Personal AI 自动整理今天最该关注的 mission、相关证据、会议准备、未闭环承诺和可交给其他 AI 的上下文包。

### 目标用户

第一目标用户就是当前 Personal AI 的真实使用者：

- Scrum Master / 项目协调者。
- 每天在 RingCentral、会议、Jira、Google Sheets、Codex、Claude、ChatGPT、豆包、网页之间切换。
- 有大量 recurring meeting 和异步 thread。
- 需要推动 AI 工具实践、项目协作、数据分析和团队同步。
- 不想每天从消息流里重新整理“今天该干什么”。

### 不做什么

- 不做新闻 feed。
- 不全天候弹通知。
- 不自动替用户承诺、回复、发消息。
- 不把所有日历会议都生成长摘要。
- 不把低置信推断伪装成事实。
- 不默认把私有记忆发给外部 AI。
- 不要求用户每天维护复杂任务系统。

### 做什么

- 在每天开始前生成 3 到 7 张高价值 mission cards。
- 把今天会议、消息、open loops、AI 工具变化、关键人、项目风险聚类到 mission。
- 给每张 card 标明 why now、next best action、证据、风险、可用 skill、可导出的 AI context pack。
- 把通知节流成 attention budget：今天最多打扰几次，哪些只进 board。
- 用户反馈后学习“哪些卡有用、哪些永远不要再提醒”。

## 核心体验

### 入口 1：早晨 Brief

用户每天第一次打开 Personal AI、Chrome popup、RingCentral 或电脑解锁后，看到一张简洁的今日 brief：

- 今日关键 mission：最多 5 张。
- 下一场重要会议：带参会人和 open loops。
- 昨天新变化：只显示会影响今天行动的变化。
- 等你确认：需要用户选择、确认或关闭的事项。
- 可交给 AI：今天已经准备好的 context pack。

卡片示例：

1. `Webpage-MCP / Codex 插件配置`  
   Why now：Fred 昨天问你怎么配，且提到 Codex Chrome 插件与 webapp MCP 功能交叉。  
   建议动作：整理一版“对所有 Agent 通用的网页控制方案”回复。  
   可用上下文：消息 2 条、已有 docs、当前 repo AGENT.md link inspection 规则。

2. `AI Notes retries on rcv.notes_lab01`  
   Why now：Elina 报告 GeneratedNotes 重复消费，可能需要 RIO 侧排查。  
   建议动作：准备 Kibana 线索、找 RIO owner、确认是否已有 incident。

3. `CoP - 基于AI的个人发展和工具`  
   Why now：未来日历中有 AI 分享会议，且最近团队在讨论 Codex、Factory.ai、MCP 和 AI 工具成本。  
   建议动作：提前准备 3 个 case：Jira 数据统计、webpage-mcp 配置、AI 先修 bug。

### 入口 2：今日 Timeline

不是普通日历，而是按 mission 组织的 timeline：

- 会议和消息会被合并到同一个 mission。
- 每个 mission 有状态：`Prepare`、`Now`、`Waiting`、`Done`、`Muted`。
- 同一个项目的 daily / weekly / 私聊 / Jira 会聚到一起。
- 用户可以把某张 card 拖到稍后、标记今天忽略、或生成 AI context pack。

### 入口 3：Attention Budget

用户不需要忍受无限主动提醒。Day Pilot 每天先声明自己的预算：

- 今天最多弹出 3 次打扰式提醒。
- 低置信卡只进 board，不弹窗。
- daily / recurring meeting 默认 compact，不逐场打扰。
- 同一 mission 2 小时内不重复提醒。
- 用户 dismiss 后会记录原因：不重要、已处理、时机不对、证据错、太频繁。

### 入口 4：Handoff To AI

每个 mission 可以生成一份最小上下文包：

- Mission goal。
- 当前状态。
- 已确认事实。
- 仍需确认的问题。
- 证据链接。
- 用户偏好和输出格式。
- 风险边界和可外发字段。

可用动作：

- `复制给 Codex`
- `发到 ChatGPT/Claude`
- `写入 Meeting Pilot handoff`
- `保存为 Context Passport`
- `转成 Skill Suggestion`

这不是重复 AI Context Passport。Passport 是跨 AI 交接对象；Day Pilot 是每天挑出哪些 passport/context pack 值得准备和使用。

### 入口 5：Evening Closeout

一天结束时，Day Pilot 只问 3 类问题：

- 哪些 mission 已完成。
- 哪些需要明天继续。
- 今天发现了哪些新事实要写回记忆。

它不会要求用户写日记，而是从当天消息、会议、操作 episode 和用户勾选里生成候选：

- 新 open loop。
- 已关闭承诺。
- 更新后的决策前提。
- 新的关系偏好。
- 可复用技能线索。

## 信息架构

### 2026-05-11 补充：与决策中心和首页的关系

Day Pilot 更适合成为 `memory-exploring` 的真实首页，而不是另起一个孤立 tab；但它不应该替代决策中心。

当前 `memory-exploring` 的路由结构已经有：

- `/`：首页概览，对应 `src/modals/components/OverviewPage.vue`。
- `/decisions`：决策中心，对应 `src/modals/components/DecisionCenter.vue`。

检查当前实现后，`OverviewPage.vue` 的首页定位是对的：它本来就想回答“今天先看什么”。但内容层混入了大量硬编码示例，例如 `Personal-AI 项目已进入测试阶段`、`Data Pipeline`、`张三 / 李四`、`Clean Architecture`、`Webpack 5` 等。这些不是来自真实记忆，会让首页看起来像 demo，而不是 Personal AI 的真实工作入口。

因此建议把 Day Pilot 作为 **`/` 首页的下一版实现**：

- 不新增 `/day-pilot` 作为长期一级入口，避免侧边栏继续膨胀。
- 用 Day Pilot 的真实 mission cards 替换当前首页假数据。
- 保留全局搜索头部，首页负责“系统建议你今天先看什么”，搜索负责“用户主动找什么”。
- 首页卡片点击后可跳转到已有详情页：决策中心、动作队列、主动询问、关系雷达、会议记录、技能库、搜索结果或具体记忆证据。

### 与决策中心的边界

Day Pilot 和决策中心的区别不是视觉样式，而是状态语义：

| 面板 | 核心问题 | 数据来源 | 用户动作 | 是否替代 |
|---|---|---|---|---|
| Day Pilot / 今日领航台 | 今天我该先关注什么？ | 日历、消息、会议、关系、skill、动作、决策候选、通知候选 | 看、准备、稍后、完成、静默、生成上下文包 | 首页入口 |
| 决策中心 | 哪些事项必须由我拍板或确认？ | `confirm_requests`，`queue=decision/watch` | 是/否/选项、审批、继续观察、结束追踪 | 保留独立页 |

决策中心不应该被并入首页，原因：

1. **它有严格状态机**
   - `queue=decision` 只展示真正待拍板项。
   - `queue=watch` 是待观察池，有 `pending / snoozed / expired` 等状态。
   - 用户回答会调用 `answerConfirmRequest` 或 `transitionConfirmRequestState`，这是强写操作。

2. **它是高责任操作区**
   - 用户在这里做的是“批准、拒绝、定夺、结束追踪”。
   - 首页只应该给出预览和跳转，避免用户在扫读时误操作。

3. **它不等于“今天重要”**
   - 有些决策项今天不急，应该安静留在决策中心。
   - 有些 Day Pilot mission 很重要，但不需要拍板，例如会前准备、别人求助、AI 工具分享素材、未闭环 follow-up。

正确关系是：

- Day Pilot 从决策中心读取 top decision/watch items。
- 如果某个待拍板项“今天需要处理”，Day Pilot 展示为一张 mission card。
- 用户点击 `处理决策` 后进入 `/decisions`，由决策中心完成强状态变更。
- 决策中心处理完后，Day Pilot 对应 card 自动变为 `Done` 或从今日列表移除。

### 建议后的首页结构

整理后的 `/` 首页应该长这样：

1. **今日 Brief Header**
   - 日期、时区、上次生成时间。
   - 数据源状态：消息、会议、日历、AI 对话、关系、技能。
   - Attention budget：今天最多打扰几次，已用几次，下一次允许提醒时间。

2. **今日 Mission Cards**
   - 默认 3 到 7 张。
   - 每张卡必须有：`为什么现在出现`、`下一步动作`、`证据数量`、`相关人 / 项目`、`状态`。
   - 状态包括：`Now`、`Prepare`、`Waiting`、`Done`、`Muted`。
   - 动作包括：`完成`、`稍后`、`静默同类`、`生成上下文包`、`打开来源页面`。

3. **需要你处理**
   - 决策中心：待拍板 N 个，只展示 top 1-2 个，点击进入 `/decisions`。
   - 动作队列：queued N 个，点击进入 `/actions`。
   - 主动询问：等待回复 / 待审批 / 已升级数量，点击进入 `/outreach`。
   - 个人技能：新萃取建议数量，点击进入 `/skills`。

4. **今日时间线**
   - 不是全量时间轴，而是今天 mission 相关的会议、thread、follow-up、deadline。
   - recurring meeting 默认合并，不逐条铺满首页。

5. **AI Handoff Preview**
   - 对选中的 mission 生成最小上下文包。
   - 外发前显示 token budget、证据、敏感字段和 redaction preview。

### 侧边栏建议

侧边栏保留现有“首页概览”入口，但改名可以更明确：

- `首页概览` -> `今日领航`

其他入口保持不变：

- `决策中心` 保留。
- `动作队列` 保留。
- `主动询问` 保留。
- `个人技能` 保留。
- `人物 / 关系雷达` 保留。

这样用户心智会更清楚：

- **首页**：今天我该关注什么。
- **决策中心**：哪些事需要我拍板。
- **动作队列**：哪些系统动作在排队或等待结果。
- **主动询问**：哪些外部询问在运行。
- **技能库**：我沉淀了哪些可复用能力。

### API 落地修正

原计划里建议新增：

- `GET /api/v1/day-pilot/today`
- `POST /api/v1/day-pilot/refresh`
- `POST /api/v1/day-pilot/cards/:id/feedback`

这些仍然成立，但前端挂载点建议改为：

- `memory-exploring.html#/`

如果需要开发期并行验证，可以临时保留：

- `memory-exploring.html#/day-pilot-lab`

但正式产品不应同时出现“首页概览”和“今日领航”两个相似入口。

同时提供两个轻量外部入口：

- Chrome popup 首屏：今日 3 张高价值卡。
- RingCentral Video Home：只显示和当前会议相关的 Day Pilot 卡。

页面结构：

1. 顶部状态条
   - 日期、时区、上次生成时间、数据源状态、刷新按钮。
2. 左侧 mission list
   - 按优先级排序，支持筛选 `Now` / `Prepare` / `Waiting` / `Muted`。
3. 中间 mission detail
   - why now、next action、timeline、evidence、open questions、related people。
4. 右侧 context handoff
   - token budget、redaction preview、目标 AI、copy/export。
5. 底部 feedback strip
   - 有用 / 不准 / 稍后 / 不再提醒同类。

## 核心对象

### Day Brief

```ts
interface DayBrief {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  generatedAt: number;
  horizon: {
    from: number;
    to: number;
  };
  status: 'draft' | 'ready' | 'stale' | 'archived';
  summary: string;
  attentionBudget: {
    maxInterruptions: number;
    usedInterruptions: number;
    quietWindows: TimeWindow[];
  };
  cards: DayBriefCard[];
  sourceStats: DaySourceStats;
}
```

### Day Brief Card

```ts
interface DayBriefCard {
  id: string;
  briefId: string;
  missionId: string;
  title: string;
  cardType:
    | 'meeting_prepare'
    | 'thread_followup'
    | 'decision_check'
    | 'ai_tool_shift'
    | 'project_risk'
    | 'relationship_ping'
    | 'skill_opportunity'
    | 'memory_quality';
  priority: 'critical' | 'high' | 'medium' | 'low';
  state: 'prepare' | 'now' | 'waiting' | 'done' | 'muted';
  whyNow: string;
  nextBestAction: string;
  dueAt?: number;
  people: EntityRef[];
  projects: EntityRef[];
  evidenceRefs: EvidenceRef[];
  openQuestions: string[];
  handoffPackId?: string;
  trust: {
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    staleEvidenceCount: number;
    sensitiveEvidenceCount: number;
  };
  feedback?: {
    rating: 'useful' | 'not_useful' | 'wrong' | 'too_frequent';
    note?: string;
    at: number;
  };
}
```

### Mission

```ts
interface DayMission {
  id: string;
  title: string;
  missionKey: string;
  status: 'active' | 'waiting' | 'done' | 'muted';
  sourceKinds: Array<'calendar' | 'glip' | 'meeting' | 'jira' | 'web' | 'ai_chat' | 'operation'>;
  timeWindow: TimeWindow;
  relatedEvents: string[];
  relatedMessages: string[];
  relatedPeople: string[];
  relatedProjects: string[];
  currentState: string;
  desiredOutcome: string;
  nextActions: MissionAction[];
}
```

## 后端设计

### 新服务

1. `DayPilotService`
   - 入口服务，生成和读取 daily brief。
   - 负责任务编排、缓存、刷新和反馈。

2. `MemoryDeltaScanner`
   - 只看上次 brief 后发生变化的数据。
   - 来源：`messages_raw`、`chunks`、`calendar_events`、`reflection_threads`、`notification_records`、`proposed_actions`、`relationships`、`personal_skills`。

3. `MissionClusterer`
   - 把日历事件、消息 thread、项目实体、人和 open loops 聚成 mission。
   - 先规则 + embedding 相似度，后续引入图算法。

4. `BriefCardRanker`
   - 计算 card 的 utility score。
   - 输入：紧急度、时间距离、用户角色、关系强度、项目 salience、未闭环程度、证据可信度、用户反馈历史。

5. `ContextPackCompiler`
   - 为高价值 mission 预生成 context pack。
   - 复用 `ContextAssistService`、`ProviderContextService`、`RelationshipRadarService`、`DecisionEvidenceChain`。

6. `AttentionBudgetService`
   - 管理今天能弹几次提醒、何时静默、哪些进 board。
   - 复用 `notification_records`，但把它们纳入 day-level budget。

### 新表

```sql
CREATE TABLE day_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  horizon_from INTEGER NOT NULL,
  horizon_to INTEGER NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  attention_budget_json TEXT,
  source_stats_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, local_date)
);

CREATE TABLE day_missions (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  mission_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source_kinds_json TEXT NOT NULL,
  time_window_json TEXT,
  current_state TEXT,
  desired_outcome TEXT,
  related_refs_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE day_brief_cards (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  mission_id TEXT,
  card_type TEXT NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL,
  state TEXT NOT NULL,
  why_now TEXT NOT NULL,
  next_best_action TEXT,
  due_at INTEGER,
  people_json TEXT,
  projects_json TEXT,
  evidence_refs_json TEXT NOT NULL,
  open_questions_json TEXT,
  trust_json TEXT,
  handoff_pack_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE day_brief_feedback (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  card_id TEXT,
  mission_id TEXT,
  rating TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
```

### API

```http
GET /api/v1/day-pilot/today
```

返回今天的 brief。若不存在且允许 autoGenerate，则生成。

```http
POST /api/v1/day-pilot/refresh
```

手动刷新。请求可带 `mode: light | full`。

```http
POST /api/v1/day-pilot/cards/:id/feedback
```

记录用户反馈和状态变更。

```http
POST /api/v1/day-pilot/missions/:id/context-pack
```

生成或刷新某个 mission 的 AI handoff context pack。

```http
POST /api/v1/day-pilot/evening-closeout
```

生成晚间 closeout 候选，写入 confirm queue，而不是直接污染长期记忆。

## 生成算法

### Step 1：低成本 delta scan

候选来源：

- 今天和未来 14 天日历，优先今天和明天。
- 最近 48 小时高重要度 Glip thread。
- 最近新增 meeting summaries 和 action items。
- active reflection threads 中 priority 高、next_reflection_at 到期的项。
- notification_records 中未处理且 utility 高的项。
- Relationship Radar 里有 open loops 的关键人。
- Skill Foundry 中 active skill 和 suggestion，匹配今天 mission。
- Memory Trust Console 中影响今天 context handoff 的高风险 issue。

### Step 2：聚类成 mission

聚类信号：

- 同一会议 series / 同一 project / 同一 group_id。
- 同一批 people。
- 相似实体：Codex、webpage-mcp、AI Notes、Nova、RCVSDK、HLS。
- 时间接近且内容互相引用。
- 用户手动 pin 的 mission。

### Step 3：计算优先级

基础公式：

```text
utility =
  urgency * 0.22
  + user_role_relevance * 0.18
  + relationship_salience * 0.14
  + project_salience * 0.14
  + open_loop_pressure * 0.14
  + novelty_since_last_brief * 0.08
  + evidence_confidence * 0.06
  - notification_fatigue_penalty * 0.10
  - privacy_risk_penalty * 0.08
```

规则：

- daily recurring meeting 默认降权，除非有新变化或用户目标。
- 单纯 FYI 消息不进前 5。
- 高隐私卡默认只进 board，不弹窗。
- 用户连续 dismiss 的类型进入冷却。
- 会议前 30 分钟会把相关 mission 提升到 `Now`。

### Step 4：生成卡片

每张卡必须包含：

- `why now`：为什么今天出现。
- `next best action`：用户下一步具体做什么。
- `evidence`：最少 1 条，最多 5 条。
- `confidence`：不能只给结论。
- `feedback actions`：done、later、mute、wrong。

### Step 5：预生成 context pack

只为高优先级 mission 或用户点击时生成深度 pack：

- 避免早晨生成太慢。
- 避免把敏感上下文预先交给外部 AI。
- pack 有 token budget 和 redaction preview。

## UX 设计原则

### 1. 少就是多

默认只展示 5 张卡。用户要的是“今天我该注意什么”，不是“你又总结了一堆我没空读的东西”。

### 2. 每张卡都要有动作

没有 next action 的卡，不应该进入前排。它可以进入 `FYI` 或 `Later`。

### 3. 先本地证据，后 AI 生成

卡片标题和 why now 可以由 LLM 润色，但 evidence refs 必须来自真实来源。没有证据就标为推断。

### 4. 不让用户管理另一个管理器

Day Pilot 的交互必须是轻量的：

- 一键 done。
- 一键 later。
- 一键 mute similar。
- 一键 copy context。

不要要求用户维护复杂字段。

### 5. 主动但不冒犯

每天先进入 board，只有明确重要且时机合适才通知。用户 dismiss 后要学习。

## Demo 说明

Demo 文件：

```text
docs/progressing/memory-day-pilot-demo.html
```

### V2 设计调整（2026-05-11）

V1 Demo 采用浅色三栏布局（mission list + detail + sidebar），信息密度高但存在以下问题：

1. **三栏同时展示信息过载**：用户早上进来的目的是快速扫读"今天先看什么"，不是立即查看每张卡的完整证据链。三栏让所有信息平铺，用户无法聚焦。
2. **脱离实际嵌入环境**：Day Pilot 最终要作为 `memory-exploring.vue` 的首页 `OverviewPage.vue` 替代品，应该继承暗色主题和单栏内容区布局，而不是独立浅色页面。
3. **缺少渐进式信息展开**：所有 mission 的 why now、evidence、timeline 一视同仁展开，用户必须自己做信息筛选。

V2 的核心设计变更：

**布局：从三栏改为单栏卡片流**
- 适配 memory-exploring.vue 主内容区（sidebar 已由父组件提供）。
- 垂直滚动，符合移动端和窄屏使用习惯。
- 每张 mission card 默认折叠，只显示标题 + why now 一句话 + 标签。

**视觉：从浅色改为暗色**
- 继承 memory-exploring.vue 的 CSS 变量：深蓝背景、毛玻璃面板、蓝紫渐变高亮。
- 优先级通过左侧色条和 badge 颜色区分，不依赖面积色块。

**交互：从"看板浏览"改为"渐进展开"**
- 默认只展示 mission 标题行 + 一句 why now + 状态/优先级 badge + 关键人标签。
- 点击展开后显示：证据、建议动作、开放问题、上下文包预览。
- 操作按钮（完成/稍后/静默）在展开区底部，避免首屏误触。

**首屏信息密度重新分配**
- 顶部 Brief Header：日期 + 数据源概览 + attention budget 进度条。
- 中部 Mission Cards：3-5 张折叠卡片，视觉重心。
- 底部 需要你处理：决策中心/动作队列/主动询问/个人技能的计数跳转条，不展开详情。
- 底部 今日时间线：按时间排列今天的会议和关键节点，紧凑格式。

**信息架构对比**

| 区域 | V1 | V2 |
|---|---|---|
| 布局 | 三栏并列 | 单栏卡片流 |
| Mission 默认状态 | 左侧 list 选中后右侧展开详情 | 折叠卡片，点击展开 |
| Attention Budget | 右侧独立面板 | 顶部 header 内嵌进度条 |
| Context Handoff | 右侧独立面板 + 代码预览 | 展开卡片内的折叠区 |
| 风险/静默规则 | 右侧独立面板 | 去掉独立面板，规则体现在 badge 和交互行为中 |
| 需要你处理 | 无 | 底部跳转条（决策/动作/询问/技能 + 计数） |
| 今日时间线 | 详情面板内部 section | 底部独立紧凑时间线 |

Demo V2 展示：

- 暗色主题，匹配 memory-exploring 主界面。
- 顶部 brief header 含数据源状态和 attention budget。
- 4 张可折叠 mission cards，默认展示标题和 why now。
- 展开后显示证据、建议动作、开放问题、上下文包和操作按钮。
- 底部"需要你处理"计数跳转条。
- 底部今日时间线。
- 用户可点击不同卡片展开/折叠。

## MVP 切法

### P0：Read-only Day Board

目标：证明“每天一张可执行记忆简报”有用。

范围：

- 新增 `day-pilot` API 和页面。
- 每天按规则生成 3 到 7 张卡。
- 只读 evidence links。
- 支持 done / later / wrong / mute feedback。
- 不主动弹桌面通知。
- 不自动写回长期记忆。

可复用：

- `messages_raw`、`chunks`、`calendar_events`。
- `ContextAssistService`。
- `RelationshipRadarService`。
- `notification_records`。

### P1：Attention Budget + Handoff

目标：让 Day Pilot 成为上下文交接入口。

范围：

- 每张 card 可生成 context pack。
- 支持复制给 Codex / ChatGPT / Claude / 豆包。
- 支持静默和通知预算。
- Chrome popup 展示前三张。
- RingCentral Video Home 会前卡消费 Day Pilot mission。

### P2：Nightly Research + Evening Closeout

目标：接近 Pulse，但更 Personal AI。

范围：

- 夜间异步研究今天重要主题。
- 结合网页搜索、内部记忆和日历，生成第二天准备材料。
- 晚间 closeout 生成记忆写回候选。
- 与 Skill Foundry 和 Decision Time Machine 互相回流。

### P3：MCP / External Agent Surface

目标：让任何 AI 工具都能问“我今天该关注什么”。

MCP tools：

- `get_today_brief`
- `list_day_missions`
- `render_mission_context_pack`
- `mark_day_card_done`
- `submit_day_card_feedback`

## 验证方案

### 离线单元测试

- delta scan 正确筛选最近变化。
- recurring meeting 降噪。
- dismiss feedback 降权。
- evidence refs 不为空。
- sensitive card 默认不外发。
- `day_briefs` 每天幂等生成。

### Fixture E2E

准备 fixtures：

- 一组日历 recurring meetings。
- 一组 Glip 消息：AI 工具讨论、别人求助、项目 follow-up。
- 一组 meeting summaries。
- 一组 notification_records。

验证：

- 首屏只显示 3 到 7 张卡。
- 高优先级卡排前。
- 点击 card 更新 detail 和 handoff preview。
- feedback 会改变 card 状态。
- context pack 不包含未允许的敏感字段。

### 真实环境验证

对 `10.32.56.212` 的 `esone.qiu` 数据只读运行：

- 生成今天 brief。
- 检查是否命中：webpage-mcp / Codex 插件配置、AI Notes retries、AI 工具分享、Jira/Capacity follow-up。
- 人工判断前 5 卡是否真的值得看。

### 成功指标

- 用户每天愿意打开一次。
- 前 5 卡至少 2 张被用户标记 useful。
- 用户从 brief 到准备某场会的时间减少。
- 用户漏掉 open loop 的次数下降。
- 用户主动复制 context pack 给其他 AI 的次数上升。
- dismiss/mute 后同类噪音减少。

## 竞品对比

| 产品 / 方向 | 做得好的地方 | Personal AI 可借鉴 | Personal AI 差异 |
|---|---|---|---|
| ChatGPT Pulse | 每日主动视觉摘要，基于 memory 和 connected apps | 异步准备、可反馈、可保存 | Personal AI 有 RingCentral/Jira/会议/本机操作和证据链接 |
| Gemini Scheduled Actions | 用户用自然语言创建周期任务 | 日常摘要和定时任务管理 | Day Pilot 自动从真实记忆生成 mission，而不是单条 recurring prompt |
| Notion 3.0 Agents | 在 workspace 内执行多步工作 | 从 brief 直接进入 action | Personal AI 跨多个 AI、浏览器、桌面和工作系统 |
| Granola MCP | 会议上下文进入其他 AI | context 通过 MCP 流动 | Day Pilot 输出 mission pack，不只是会议记录 |
| Microsoft Recall | 找回看过的东西 | 时间线和本地优先隐私 | Day Pilot 关注今天要做什么，不是屏幕快照搜索 |
| 传统任务管理器 | 清单和截止日期清晰 | done/later/snooze 交互 | Personal AI 自动从记忆和上下文生成候选，不靠手动录入 |

## 风险和约束

### 1. 变成噪音 feed

缓解：

- 默认 5 张卡。
- attention budget。
- 用户反馈直接降权。
- recurring meeting 默认 compact。

### 2. 误判优先级

缓解：

- 每张卡解释 why now。
- 支持快速 wrong feedback。
- 低置信只进 board。
- 保存 ranking 特征用于调试。

### 3. 泄露敏感上下文

缓解：

- context pack 默认本地预览。
- 外发前显示 redaction preview。
- 高风险字段默认只给 explore link，不给原文。
- 复用 Memory Trust Console 的敏感标记。

### 4. 生成太慢

缓解：

- 先规则和缓存生成 board。
- 深度 LLM 只给 top cards 或用户点击时运行。
- 夜间异步预计算。

### 5. 重复已有功能

缓解：

- Day Pilot 不替代 Relationship Radar / Context Assist / Passport。
- 它是日级编排层，只消费它们的结果。

## 推荐落地顺序

1. 先做 P0：`memory-exploring.html#/day-pilot` 只读 board。
2. 用真实 `esone.qiu` 数据每天生成 brief，连续试 5 天。
3. 观察哪些 card 用户真的会点。
4. 再接入 Context Pack 和 Chrome popup。
5. 最后才做主动通知和夜间研究。

## 为什么现在做

这个功能的时机很好：

- 真实 memory 已经有足够多的消息、会议、日历和 AI 对话。
- Context Assist、Relationship Radar、Provider Context Package 已经提供了底层积木。
- 用户当前工作正处在 AI 工具高频试用、团队分享、会议协调和项目跟进阶段。
- 行业正在从“用户问 AI”转向“AI 提前准备”，ChatGPT Pulse 和 Gemini Scheduled Actions 已经证明方向。
- 如果不做日级编排，Personal AI 后续能力越多，入口越分散，用户越难感受到“它每天真的帮我省心”。

建议先做 P0。只要它能每天早上给出 3 张用户真的会点开的卡，就说明 Personal AI 从“记忆仓库”升级成了“个人工作领航员”。
