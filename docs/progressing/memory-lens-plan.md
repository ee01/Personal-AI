# 新能力：Memory Lens / 屏幕级记忆透镜

> 生成日期：2026-05-15 CST  
> Codex 会话标题建议：新能力：记忆透镜  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-lens-demo.html`](./memory-lens-demo.html)

## 结论

建议把现有网页右下角“相关记忆”悬浮 icon 升级为一个统一能力：**Memory Lens / 屏幕级记忆透镜**。

它不是新的聊天机器人，不是新的“记忆搜索页”，也不是替代 Compose Assist 的写作助手。它的核心是：

> 用户正在看什么、划选什么、开会聊什么、准备问哪个 AI，Personal AI 就在原页面旁边轻量提示“这里有哪些真正相关的记忆”。

现有系统已经有 `/context-recall`、网页 passive bubble、Meeting Pilot、Compose Assist、AI Context Passport、Relationship Radar、Day Pilot 等积木。Memory Lens 不应该重新做一个孤立入口，而应该把**现有右下角 icon 作为轻量态**，在同一套注入交互里逐步增强召回质量、场景判断、划词入口和反馈闭环。

- 在浏览器页面、RingCentral 消息、Jira、会议、ChatGPT/Claude/豆包/Codex web 等页面里，保持“注入式轻量提示”，不新建独立页面。
- 先识别当前页面、可见消息、会议状态、划选文本和实体锚点，再从 Personal AI 长期记忆里找真正相关的少量结果。
- 每张提示都说明：为什么此刻相关、命中了哪些当前实体/关键词/对象、证据来自哪里、为什么可以展示。
- 用户可以查看证据、打开记忆、标记不相关、站点/页面静默、划词查找关联记忆。
- `插入回复`、`生成可发送文本`、`改写草稿` 不属于 Memory Lens 主功能，继续归 Compose Assist。

一句话价值：

> 把现有“有点随机的相关记忆提醒”升级成“在当前页面旁边出现、足够准、足够轻、用户愿意保留的记忆透镜”。

### 与现有右下角 icon 的关系

两者是同一条产品线。

现有右下角 icon 是当前已经实现的 **Ambient Memory Bubble**：

- 注入在网页右下角。
- 通过 `contentScriptWebIntelligence.ts` 构造页面或 RingCentral 会话上下文。
- 通过 background 调用 `MemoryServiceClient.contextRecall()`。
- 后端进入 `memory-service/src/routes/contextRecall.ts` 和 `ContextRecallService`。
- 当前前端请求 `limit: 1`，只展示 top match。
- UI 展示标题、摘要、来源、分数、跳转、`这条有用`、`这条不相关`、`此网站今天不提示`、`此页面不提示`、`永久不提示此站点`。

Memory Lens 是它的升级名和长期收口方向：

- P0 不新增页面，只改进现有 icon 的触发、排序和展示质量。
- P0 仍以 `/context-recall` 为主，不引入 LLM 生成回复。
- P1 才把相同交互扩到划词、会议空态、Jira、AI chat 等更多 surface。
- 后续文档也应该把 `webpage_memory_detection` 归并进 Memory Lens，而不是维护两套概念。

## 为什么要做

Personal AI 的目标是留存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话中提供记忆关联提示。现在真正的体验断点不是“没有记忆”，而是：

1. **现有右下角提示的质量还不够稳定**
   - 截图 1 的当前页面是 `2026 Hackathon Project`，可见消息围绕 Colin、Michael、Codex、rust、mcp/skill/settings；但提示命中了 `Trip Itinerary — Gary Chevsky`。这说明召回可能只抓到了泛化的 AI/meeting 上下文，缺少当前 conversation、可见人员、近期消息和主题交集校验。
   - 截图 2 是刚进入 RingCentral Video，会议还没开始，页面只有 “You're the only one here” 和用户头像；但提示命中 `Colin Liu shared a message from AVA`。这说明会议空态/未开始状态不应触发普通 glip 记忆，至少要等会议标题、参会人、聊天内容、转录 topic 或 calendar event 足够明确。
   - 用户真实感受不是“召回系统给了一个也许相关的历史”，而是“它在我当前页面旁边说了个完全无关的人/事”，这会快速损害信任。

2. **记忆出现得太早或太泛**
   - 刚打开页面、SPA DOM 未稳定、会议未开始、RingCentral 虚拟列表仍有缓存消息时，系统可能用错上下文。
   - 当前前端 `limit: 1`，只展示 top match；一旦 top match 错，用户看不到系统还有没有更合理候选。

3. **当前场景不只是一段文本**
   - 真实上下文来自 URL、页面标题、选中文本、输入框草稿、Jira key、会议参会人、屏幕截图、当前 AI 工具、时间、最近操作。
   - 只靠用户输入一个 query，会丢掉大量场景信号。

4. **现有 bubble 太轻，搜索页又太重**
   - 右下角 bubble 适合“这里可能有相关记忆”。
   - 但用户需要进一步看到“为什么相关、命中了当前页面哪个锚点、它和当前人/群/会议/Jira 是否真的有交集”。

5. **多 AI 工作流需要一个共同的记忆入口**
   - 用户真实记忆中已经高频出现 Codex、Claude Code、Cursor、OpenClaw、RingClaw、ChatGPT、豆包、Gemini。
   - 这些 AI 各自有界面和记忆。用户需要一个自己的、跨工具的“看当前上下文再取记忆”的入口。

6. **隐私和 prompt injection 风险需要在 UI 层可见**
   - 现在行业正走向屏幕共享、MCP、agent 工具连接。
   - 当前屏幕可能同时含有私有记忆、外部网页里的不可信内容、以及可外发的输入框。Memory Lens 必须默认把“可看”和“可发送”分开。

## 本次输入信号

### Reminders 检查

本机 Reminders 当前可见列表为：

- `We`
- `Next actions`
- `Moives`
- `Shopping List`
- `家庭`
- `人名记忆`
- `宝宝需要办理`
- `吃吃看`
- `出门前检查`
- `装修待办`
- `Reading`
- `菜头`
- `Tasks`

没有发现名为 `Personal AI` 的列表，因此本次没有从 Reminder item 随机抽取全新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次使用只读 HTTP API，没有写入远端数据。

读到的关键轮廓：

- Memory Service 统计：`messages.total=9313`，今天 84 条，本周 292 条，近 90 天 2757 条；实体 13646 个，关系 48988 条。
- 用户画像核心仍很短：Esone Qiu，Scrum Master，时区 Asia/Shanghai。这说明很多个性化能力仍需要从真实场景临时召回，而不是靠静态 profile。
- 最近记忆高频覆盖 RingCentral/Glip、会议、Jira、日历、Codex、Claude Code、Cursor、RingClaw、OpenAI API、AI tool cost policy。
- 近期命中包含：
  - RingClaw 把 Claude/Codex/Gemini 等 agent 带进 RingCentral，并支持聊天总结、AI-driven actions、定时任务。
  - 团队讨论 Claude Code、Codex、Cursor 的成本、license 和使用场景。
  - 用户询问 `agents.md`、skill、MCP 管理在 Cursor/Codex/Claude Code 之间配置繁琐。
  - Nova / RCVSDK / Pluto daily 等会议和 Jira comment 记忆持续进入系统。
- 这类信号共同指向一个产品空位：用户不是缺少某个单独页面，而是缺少一个在任何工作现场都能立即调出 Personal AI 记忆的“透镜”。

## 已有 progressing 方案避让

| 已有方案 | 主对象 | Memory Lens 的边界 |
|---|---|---|
| AI Context Passport | 把任务上下文打包给外部 AI | Lens 是现场入口，只发现相关记忆；如果需要 context package，交给 Passport |
| AI Session Context Drift Radar | 监控已交付给外部 AI 的上下文是否变旧 | Lens 处理“此刻我正在看/写什么”的即时召回，不追踪会话账本 |
| Agent Memory Control Tower | 多 AI 分派、监控、合并，已搁置 | Lens 不调度 agent，只帮用户在当前工具旁拿到记忆 |
| Relationship Memory Radar | 以人为中心的人际上下文卡 | Lens 会在当前场景涉及某人时消费关系卡，但不做人际网络管理 |
| Memory Day Pilot | 全天 mission 编排 | Lens 是瞬时、现场、低打扰的 recall UI |
| Operation Memory Flight Recorder | 记录跨工具操作 episode | Lens 可召回过去操作 episode，但不负责录制全量操作 |
| Personal Skill Foundry | 挖掘和同步 skill | Lens 会提示“此处应套用哪个 skill”，但不管理 skill 版本 |
| Memory Trust Console / Reality Check | 记忆可信、事实核验、隐私治理 | Lens 使用其安全分和证据分，不做独立治理中心 |
| Webpage memory detection | 网页 passive bubble、右下角相关记忆提示 | Lens 应包含并升级它；后续文档应合并 |
| Compose Assist | 输入框旁生成可插入建议 | Lens 不生成回复、不插入正文；只可把当前场景和相关记忆交给 Compose Assist |

## 产品定义

### 功能名

**Memory Lens / 屏幕级记忆透镜**

备选中文名：

- 情境记忆镜
- 当前屏幕记忆助手
- Context Lens
- 记忆旁白

### 一句话产品承诺

> 你正在看的每个消息、会议、网页、Jira、AI 会话，都可以一键让 Personal AI 解释：这里有哪些相关记忆、我该注意什么、能安全带给哪个 AI。

### 核心体验

Memory Lens 提供一个统一入口：

- 浏览器内：现有右下角 bubble 升级为 Lens 轻量态；icon 仍使用 `static/icons/icon48.png`，不引入新的大按钮。
- 选中文本：用户划词后，在选区附近只露出一个很轻的小 icon 或一行短 action：`用 Personal AI 查找关联记忆`。默认不弹卡、不遮挡选择文本，点击后才召回。
- 输入框旁：不接管 Compose Assist。Lens 只负责“这段页面/草稿旁边有哪些相关记忆”；如果用户要生成可插入回复，交给 `docs/features/compose_assist.md` 里的 Compose Assist。
- 会议中：未开始、无参会人、无聊天、无转录 topic 时保持 dormant；有 meeting title/calendar event/topic/person/action item 后才召回。
- 桌面全局：Desktop App 提供快捷键，例如 `Option+Space`，抓取当前前台 App 名称、窗口标题、选中文本；截图/OCR 放到更后期且必须由用户显式触发。
- 外部 AI 会话：在 ChatGPT/Claude/豆包/RingClaw/Codex web 等页面识别当前 prompt 或回复，提示“这里可能有相关 Personal AI 记忆”，但不自动注入 prompt。

Lens 唤起后默认只显示 3 张卡：

1. **最相关记忆**：现在这段内容和哪条历史记忆相连。
2. **为什么相关**：当前页面中哪个人、项目、Jira key、会议标题、选中文本或可见消息触发了这条关联。
3. **证据与反馈**：来源、时间、分数、查看入口，以及 `有用` / `不相关` / `少提示`。

用户展开后可看完整证据、相关人物、项目、Jira、会议、网页、AI 对话来源。P0 不提供独立页面；所有体验都在目标页面注入完成，`memory-exploring.html` 只作为“在记忆中查看”的跳转目标。

## 典型场景

### 场景 1：RingCentral 里有人问 Codex / OpenAI API

用户看到 Lucas Liu 提到 `OPENAI_API_KEY` 配额和 Codex CLI。

Memory Lens 应该提示：

- 最近团队讨论过 Claude Code、Codex、Cursor 的 license 和成本策略。
- Fred Yang 提过 Cursor 比 Claude Code/Codex 约贵 30%，低频用户建议转 usage-based。
- Mercury Li 可能是工具政策咨询对象。
- 这条消息可以回复时引用 OpenAI API quota 和 Codex CLI 的边界，但不要把公司内部采购策略原文外发到公开 AI。

用户动作：

- `在记忆中查看`：打开证据。
- `这条有用` / `这条不相关`：训练后续召回。
- `交给 Compose Assist`：如果用户确实想生成回复，跳到 Compose Assist 逻辑，不由 Lens 自己生成。

### 场景 2：Nova 周会开始前

用户打开 Nova - Weekly Sync up。

Memory Lens 应该提示：

- 上次 Nova 会议的议题、action item 和 Jira dashboard 链接。
- Sophia Lin 是 organizer，近期和用户协作过 Jira 数据提取、开发人数去重和趋势图。
- 会议页面里的 dashboard 和 planning sheet 可能应该进入会前 context。
- 如果用户要让 AI 生成发言稿，优先使用 meeting_prep 模式，而不是把全部会议纪要丢给 AI。

用户动作：

- `在记忆中查看`：打开相关会议、日历或人物证据。
- `打开 Relationship Radar: Sophia`：如果人物卡已经生成。
- `这条不相关`：如果只是会议壳标题或错误人物。

### 场景 3：Codex / Claude Code 正在处理 Jira bug

用户在 AI 工具里写 prompt 或查看 agent 输出。

Memory Lens 应该提示：

- 当前仓库有 `AGENT.md` 验证策略，要优先读。
- 类似任务曾经需要 `npm start` 等 dev build 验证，而不是直接 `npm run build`。
- 如果 prompt 涉及 Jira / RingCentral / memory-service，外部 AI 需要最小化私有数据。
- 如果 agent 输出依赖旧会议结论，Drift Radar 可接手判断是否需要补丁。

用户动作：

- `查看相关 skill`
- `查看 AGENT.md 记忆证据`
- `复制关联记忆摘要`：只复制用户确认后的短摘要，不自动插入 prompt。

### 场景 4：网页阅读或研究

用户打开一篇 AI product / paper / docs 页面。

Memory Lens 应该提示：

- 这篇内容和用户过去保存/讨论过的哪些主题相关。
- 是否值得保存为 memory，还是只是短期 research。
- 和 Personal AI 当前 progressing 方案是否重复。
- 如果页面含有 prompt injection 风险，Lens 只做本地摘要，不允许自动带私有记忆发给外部工具。

用户动作：

- `保存为研究证据`
- `关联到某个 progressing plan`
- `查看相关历史研究`

### 场景 5：RingCentral Hackathon 页面误命中 Gary 行程

当前页面可见内容是 `2026 Hackathon Project`、Colin/Michael 关于 Codex、rust、mcp/skill/settings 的讨论。系统不应该提示 `Trip Itinerary — Gary Chevsky (Mar 31-Apr 12, 2026)`。

质量规则：

- 若结果人物 `Gary Chevsky` 没出现在当前可见消息、标题、participants、entity hints、近期 thread root 或 selected text 中，必须降权。
- 若结果主题是 `Trip Itinerary`，而当前场景强主题是 `Hackathon / Codex / coding agent / rust / mcp / settings`，主题交集为 0，必须过滤。
- 泛化关键词如 `AI`、`meeting`、`context`、`share` 不能单独支撑展示。
- 右上角显示 `100%` 这类置信度会误导用户。Ambient UI 应显示“强相关 / 可能相关 / 低置信不展示”，或只显示 internal debug 中可解释的 score，不把原始相似度当准确率。

### 场景 6：RingCentral Video 空会议误命中 Colin/AVA

当前页面只是新进入会议，右侧显示 `You're the only one here`，会议还没有开始聊，也没有会议聊天、转录、明确 topic。系统不应该提示 `Colin Liu shared a message from AVA`。

质量规则：

- 会议空态必须 dormant：没有 meeting title/calendar event/topic/chat/participant/activity 时，不做 ambient recall。
- 如果只有当前用户一个人，不应使用历史 glip 记忆作为会议提示。
- meeting surface 的召回应优先限定 meeting/calendar/participant/title/topic 相关证据；普通 glip 记忆必须和会议标题或参会人有强交集才可显示。
- 会议开始前只允许显示“会前准备可用”的显式入口，不自动弹历史记忆卡。

## 行业观察与竞品参考

### Microsoft Recall：证明“看过什么都能找回”是强需求，但也暴露隐私边界

Microsoft Recall 通过周期性 screen snapshots 帮用户自然语言找回在 PC 上看过的 apps、websites、images、documents；官方强调 opt-in、本地处理、可暂停、可过滤 app/website、可删除 snapshots，并默认过滤敏感信息。参考：[Microsoft Recall privacy and control](https://support.microsoft.com/en-us/windows/privacy-and-control-over-your-recall-experience-d404f672-7647-41e5-886c-a3c59680af15)。

对 Personal AI 的启发：

- “屏幕级记忆”是明确的产品趋势。
- 但 Personal AI 不应先做连续截图历史，而应先做显式唤起、短暂 scene snapshot、默认不存 raw screenshot。
- Lens 的差异点不是“回放所有屏幕”，而是“此刻告诉我相关记忆和可执行下一步”。

### Apple Siri onscreen awareness：系统级 AI 会理解屏幕，但平台封闭

Apple Developer 页面说明 Siri 的 personal context understanding、onscreen awareness、in-app actions 仍在开发中，将随未来软件更新提供。参考：[Siri for Developers](https://developer.apple.com/siri/)。

对 Personal AI 的启发：

- 未来系统级 assistant 会越来越知道“用户正在看什么”。
- Personal AI 的优势是用户自有记忆、跨 AI 对话、跨 RingCentral/Jira/会议/浏览器，不局限于单一平台生态。

### Google Gemini Live：实时看屏幕已经可用，但缺长期私人记忆

Gemini Live 支持分享摄像头或屏幕，用户可以边滚动边问问题；官方也说明可暂停/停止分享，并有隐私控制。参考：[Gemini Live camera and screen sharing](https://www.android.com/articles/gemini-on-android/)。

对 Personal AI 的启发：

- “让 AI 看见当前屏幕”已经成为主流交互。
- 但 Gemini Live 更像实时问答；Memory Lens 的重点是把当前屏幕与用户长期记忆、项目历史、AI 对话历史相连。

### ChatGPT / Claude Memory：平台内记忆增强，但仍是工具孤岛

OpenAI 说明 ChatGPT memory 包含 saved memories 和 chat history，用户可控制开关和删除。参考：[OpenAI Memory and new controls](https://openai.com/index/memory-and-new-controls-for-chatgpt/)。

Claude memory 说明项目可以有独立 memory，用户可查看和编辑，避免不同项目上下文混在一起。参考：[Claude Memory](https://claude.com/blog/memory?from_blog=true)。

对 Personal AI 的启发：

- AI 产品都在做记忆，但多发生在各自平台内部。
- Personal AI 应成为用户自己的跨平台记忆层，并在当前屏幕旁给出可审阅的 evidence。

### Supermemory：跨工具记忆层方向正确，但缺“现场透镜”UX

Supermemory 的产品定位是“一份记忆，所有工具都记得”，支持保存 links、chats、PDFs、images、videos、documents，并面向 Claude Code、Cursor、OpenClaw、OpenAI Codex 等插件。参考：[Supermemory](https://supermemory.ai/)。

对 Personal AI 的启发：

- 这直接证明“跨 AI 工具共享记忆”是独立赛道。
- Personal AI 应避免只做底层 memory API，要把价值落到真实现场：当前页面、当前输入框、当前会议、当前 AI 会话。

### Granola / Limitless / Rewind：会议和环境记忆正在成为 AI 工作底座

Granola 通过 calendar、notes、spaces、chat 让用户围绕会议记录进行 AI 查询，官方文档中也强调可以 chat with meeting notes。参考：[Granola 101](https://docs.granola.ai/help-center/getting-started/granola-101)。

Limitless/Rewind 类产品主张保存看过、说过、听过的内容，尤其强调会议和对话记忆。

对 Personal AI 的启发：

- 会议记忆只是其中一个场景。
- Memory Lens 应把会议、聊天、网页、Jira、AI 会话都纳入统一“当前场景 -> 相关记忆”的模型。

## 相关论文和专家观点

### Anthropic：Context 是有限资源，关键是高信号、低 token

Anthropic 的 context engineering 文章明确提出 context 是 AI agent 的关键且有限资源；随着 token 增加，模型会出现 attention budget 压力。它建议找到“最小但高信号”的 token 集合。参考：[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。

Memory Lens 的设计含义：

- 默认只显示 3 张卡，而不是铺满所有相关记忆。
- 如果用户从 Lens 跳转到 Passport / Compose Assist，传递的 selected memory refs 必须短、小、有证据边界。
- Lens 的排序目标不是召回最多，而是最少打扰下帮用户做对下一步。

### Anthropic Context Management：长任务需要记忆和清理旧上下文

Anthropic 的 context management 发布说明 context editing 会清除 stale tool calls/results，memory tool 能在 context window 外保存和查询信息；内部评测中 context editing 可降低 100-turn web search 的 token 消耗。参考：[Managing context on the Claude Developer Platform](https://claude.com/blog/context-management)。

Memory Lens 的设计含义：

- 当前屏幕上下文需要先做 compact scene，不把完整 DOM、截图、会议转录一股脑交给模型。
- Lens 卡片应保留“可展开证据”，默认只展示最必要事实，不生成外发 patch。

### ScreenAI：UI / infographics 理解让屏幕级 recall 可行

ScreenAI 研究把 screen UI 和 infographics 作为视觉语言来理解，支持 UI element 类型和位置识别、QA、导航和摘要。参考：[ScreenAI](https://arxiv.org/abs/2402.04615)。

Memory Lens 的设计含义：

- P1/P2 可以用 VLM/OCR 把屏幕转换成结构化 scene graph：app、window title、visible text、widgets、entity candidates。
- 对浏览器仍优先用 DOM/URL，而不是只靠截图。

### OSWorld：全自动电脑 agent 还弱，适合先做人机协作透镜

OSWorld 在真实 web/desktop apps 上评估多模态 agents，报告人类完成率远高于最佳模型，模型主要在 GUI grounding 和操作知识上吃亏。参考：[OSWorld](https://arxiv.org/abs/2404.07972)。

Memory Lens 的设计含义：

- MVP 不应追求全自动控制电脑。
- 更稳的路径是 human-in-the-loop：系统看懂当前场景、提出记忆卡、由用户决定查看、反馈或交给其他能力。

### MemGPT / H-MEM / MemInsight / Episodic Memory：长期 agent 需要分层、结构化、情景化记忆

- MemGPT 提出 virtual context management，把长期记忆看作类似操作系统虚拟内存的层级管理。参考：[MemGPT](https://arxiv.org/abs/2310.08560)。
- H-MEM 提出按语义抽象层级组织长期记忆，提高长对话推理效率。参考：[H-MEM](https://arxiv.org/abs/2507.22925)。
- MemInsight 强调随着记忆增长，需要语义结构化和自主增强来提升 retrieval。参考：[MemInsight](https://arxiv.org/abs/2503.21760)。
- 2025 年 episodic memory position paper 认为情景记忆是长期 LLM agents 的缺失环节。参考：[Episodic Memory is the Missing Piece](https://arxiv.org/abs/2502.06975)。

Memory Lens 的设计含义：

- 当前屏幕不是普通 query，而是一个 episode seed。
- 召回应该融合短期 scene、长期用户画像、项目/人物/skill/决策等多层记忆。
- 用户对 Lens card 的反馈应更新 scene-to-memory 的关联，而不是只做一次性 thumbs up/down。

### Simon Willison / Matt Webb：Agent 价值来自把 context 移到需要的地方

Simon Willison 记录 Matt Webb 的 “context plumbing” 观点：context 来自不同来源，AI 往往不在 context 产生的位置运行，关键工作是把 context 移到需要的位置。参考：[Context plumbing](https://simonwillison.net/2025/Nov/?page=6)。

Memory Lens 的设计含义：

- 当前屏幕就是“context 产生的位置”。
- Codex/Claude/ChatGPT/豆包/RingClaw 是“AI 运行的位置”。
- Lens 的价值就是把 Personal AI 的相关记忆用最小、可审阅、安全的方式搬过去。

### Simon Willison：私有数据、不可信内容、外部通信不能混在一起

Simon Willison 的 lethal trifecta 指出：私有数据、不可信内容、外部通信三者结合会产生 prompt injection / data exfiltration 风险。参考：[The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)。

Memory Lens 的设计含义：

- “看当前网页/屏幕”不等于“允许网页内容指挥 Personal AI 发送私有记忆”。
- Lens 必须把 raw page instructions 当作 untrusted content。
- 默认只有用户显式交给 Compose Assist / Context Passport 后，相关记忆摘要才可能离开 Lens。

### Tiago Forte：Personal Context Management 正在取代 Personal Knowledge Management

Tiago Forte 在 2026 年 AI Second Brain 文章中提出 Personal Context Management 正在替代 Personal Knowledge Management，新的瓶颈是把正确的信息在正确时间给 AI。参考：[Introducing The AI Second Brain](https://fortelabs.com/blog/introducing-the-ai-second-brain/)。

Memory Lens 的设计含义：

- Personal AI 不应只做长期知识库。
- 更关键的是在用户最需要的时刻，把正确记忆推到当前工作现场。

## 用户体验设计

### Lens 的四个状态

| 状态 | 触发 | UI |
|---|---|---|
| Dormant | 当前场景无强命中、会议空态、站点静默、页面敏感 | 仅保留或不显示小 icon，不闪烁 |
| Glance | 有 1-3 条强相关记忆 | 右下角 `icon48.png` 小 badge；不自动展开 |
| Selection | 用户划选文本 | 选区旁出现小 icon 或短 action：`用 Personal AI 查找关联记忆` |
| Peek | 用户点击 icon/划词 action | 浮层显示最多 3 条相关记忆 |
| Evidence | 用户点“在记忆中查看”或展开证据 | 跳转 memory-exploring 或在浮层内展示证据摘要 |

### 卡片类型

| 类型 | 示例 | 主动作 |
|---|---|---|
| Memory Fact | “Fred 提过 Cursor 对比 Codex/Claude Code 的成本策略” | 查看证据 / 标记有用 |
| Open Loop | “这条 thread 可能需要 follow-up” | 关注后续 / 稍后提醒 |
| Relationship | “Sophia 最近关注 Jira 数据去重和趋势图” | 打开人物卡 |
| Meeting | “上次 Nova 周会的 action item 是 weekly update” | 查看会议证据 |
| Skill | “这类 repo 任务应先读 AGENT.md 并跑 npm start dev build” | 查看 skill |
| Privacy Guard | “当前页面含外部内容，不建议自动附带私有记忆” | 仅本地查看 |
| Similar Episode | “你 4 月处理过类似 Jira fixVersion/sprint 更新” | 打开操作记录 |

### 低打扰原则

- 不自动弹大窗。
- 默认只显示 3 张卡，展开才显示完整列表。
- 每个 site/app 有独立静默设置。
- 反馈按钮必须非常轻：`有用`、`不相关`、`此站点少提示`、`不再引用这条记忆`。
- 不提供 `插入回复` 作为 Lens 主动作；需要写作/插入时交给 Compose Assist。
- 外部 AI 页面不自动注入 prompt；Lens 只提示相关记忆并可跳转查看。
- 会议中只在 topic 切换、有人提到用户、出现高相关 action item、或用户显式点击 Lens 时刷新。
- 会议未开始、只有自己一个人、没有标题/参会人/聊天/转录 topic 时，不主动显示记忆卡。

### 证据与安全

每张卡都要有：

- `whyNow`：为什么当前场景触发。
- `evidenceRefs`：消息/会议/Jira/网页/AI 对话来源。
- `confidence`：事实强度。
- `freshness`：记忆时间和是否可能过期。
- `sendability`：
  - `local_only`：只能本地看。
  - `safe_summary`：可以给外部 AI 的摘要。
  - `needs_redaction`：需要用户确认删改。
  - `blocked`：不建议外发。

## 信息架构

### 前端入口

1. `contentScriptWebIntelligence.ts`
   - 继续承载现有 `.pai-context-bubble` / `.pai-context-card`。
   - 升级为 Lens 轻量态：同一个 icon、更严格展示阈值、更清晰 whyMatched、更强反馈。
   - 复用 SiteContextAdapter 获取 DOM、URL、visible messages、meeting state、selected text。

2. `ComposerGuardController`
   - 不并入 Lens。
   - Compose Assist 继续负责输入框旁的写作建议、可插入文本和 preview-required 流程。
   - Lens 可以在输入框页面旁提示“有相关记忆”，但生成/插入回复属于 Compose Assist。

3. `Meeting Pilot`
   - 不新增独立 Lens 页面。
   - 复用会议页面右下角或侧边低打扰入口。
   - 当前 topic、speaker、action item 或 meeting chat 变化时才请求 Lens refresh；空会议保持 dormant。

4. Desktop App
   - P2 才考虑全局快捷键。
   - 显式获取前台 App、窗口标题、选中文本。
   - P3 才支持用户主动截图/OCR；不做后台连续录屏。

5. AI 页面 adapter
   - ChatGPT / Claude / 豆包 / RingClaw / Codex web。
   - 识别 prompt box、latest assistant answer、conversation title。
   - 只提示相关记忆，不自动插入 context patch。

### 后端 API

P0 不建议新增独立 `/memory-lens` API。原因：

- 当前右下角 icon 已经走 `/api/v1/context-recall`。
- 用户希望这个能力主要是“关联提示”，而不是生成回复或 context composer。
- 先把召回质量、场景 gating 和反馈做好，比先加新 API 更重要。

P0 API 仍然是：

```http
POST /api/v1/context-recall
```

需要扩展 `ContextRecallRequest` 的输入语义，而不是换端点：

```ts
interface ContextRecallRequest {
  surface: 'web_passive' | 'meeting_passive' | 'popup_passive' | 'composer_guard';
  contextType: 'webpage' | 'message_thread' | 'meeting' | 'selected_text' | 'ai_chat';
  title?: string;
  url?: string;
  primaryText?: string;
  secondaryTexts?: string[];
  entityHints?: Array<{ type: string; value: string; source?: string; weight?: number }>;
  sourceTypes?: string[];
  limit?: number;
  scope?: 'work' | 'personal' | 'all';

  // 建议新增：用于质量 gating，而不是生成回复。
  sceneState?: 'loading' | 'empty' | 'ready' | 'active' | 'stale';
  visibleEntityNames?: string[];
  visiblePeople?: string[];
  visibleObjectKeys?: string[]; // Jira key, meeting id, conversation id, project id
  requiredOverlap?: 'none' | 'entity_or_topic' | 'entity_and_topic' | 'source_scoped';
  allowSourceTypes?: string[];
  blockedSourceTypes?: string[];
  debug?: boolean;
}
```

响应仍以 `ContextRecallMatch` 为主，但需要补充可解释字段：

```ts
interface ContextRecallMatch {
  id: string;
  type: string;
  score: number;
  title: string;
  snippet: string;
  sourceLabel?: string;
  sourceTitle?: string;
  exploreLink?: string;
  whyMatched?: string;

  // 建议新增
  relevanceTier?: 'strong' | 'possible' | 'weak';
  overlapSignals?: Array<{
    kind: 'person' | 'project' | 'topic' | 'jira' | 'meeting' | 'conversation' | 'selected_text';
    value: string;
  }>;
  rejectReason?: string;
}
```

继续复用现有反馈接口：

- `recall_quality: positive`
- `recall_quality: negative`
- 负反馈需要带 `contextKey`、host、surface、match id、match source、overlap signals，便于后续调试类似误召回。

未来如果 Lens 需要多卡聚合、跨 surface 历史和独立设置，再考虑新增 `/api/v1/memory-lens/peek`。但这不应是 P0。

### 数据模型

P0 不新增 `memory_lens_*` 表。现有本地 storage 和 memory-service feedback 足够支撑：

- 站点/页面静默。
- 当前 contextKey dismiss。
- 正负反馈。
- 召回显著性调整。

如果后续需要调试质量，优先增加轻量 telemetry，而不是保存完整页面内容：

- scene hash
- surface
- trigger mode: `ambient | selection | manual`
- selected text length
- visible entity hints
- shown match id
- user feedback
- rejection reason

仍然不保存 raw screenshot。截图/OCR 属于 P3 显式用户动作，不进入当前 P0。

## 排序与生成策略

### Scene extraction

按成本从低到高：

1. URL/title/domain/appName。
2. Site adapter 结构化数据：RingCentral team/thread/message、Jira key、meeting id、meeting state、AI provider。
3. 用户选中文本和可见文本摘要。
4. P3 显式截图 OCR / VLM。

生成一个 `SceneSignature`：

```ts
{
  surface: 'ringcentral_thread',
  trigger: 'ambient',
  entities: ['Lucas Liu', 'Mercury Li', 'Codex', 'OpenAI API'],
  projects: ['AI Tools for Engineering'],
  temporalHints: ['this_week', 'recent_policy'],
  objectKeys: ['conversation:2026-hackathon-project'],
  sceneState: 'ready'
}
```

### P0 retrieval

P0 保持轻量，只走 `/context-recall`：

- `/context-recall`：快速 passive recall。
- `ContextRecallService` 继续使用 `vector + fts`，不跑 LLM。
- 前端 ambient 仍可请求 `limit: 1`，但后端应 over-fetch 后做强过滤；调试和手动 Lens 可请求 3 条。
- 不生成回复、不生成发言稿、不生成 AI prompt。

P1/P2 才考虑接入：

- Relationship Radar projection：只用于人物强交集场景。
- Skill Foundry：只展示“相关 skill”，不插入 prompt。
- Decision/Operation episode：只在当前页面有明确决策/操作对象时展示。

### 强相关 gating

Ambient 提示必须过“强相关门槛”。它不能只靠向量相似度。

建议规则：

1. **实体交集**
   - 当前可见人物、项目、Jira key、会议标题、conversation title、选中文本实体，至少一个必须和结果实体/metadata/title/snippet 有交集。
   - 人名是强锚点。当前页面没出现 Gary，就不应展示 Gary 行程类结果。

2. **主题交集**
   - 从当前场景提取 3-8 个主题词，例如 `Hackathon`、`Codex`、`rust`、`mcp`、`settings`。
   - 结果至少要命中一个强主题，或命中同一个 conversation/project。
   - `AI`、`meeting`、`share`、`context`、`message` 这类泛词不能算强主题。

3. **来源约束**
   - RingCentral message thread 优先召回同 group / same conversation / visible participants / recent related topic。
   - RingCentral Video 空会议不召回普通 glip；有 calendar title 或 meeting topic 后，才召回 meeting/calendar/participant 相关结果。
   - Jira issue 优先召回同 issue key、同 project key、同 assignee/reporter/commenter 的记忆。
   - Web AI 页面优先召回 AI 对话、当前 provider、当前 prompt 主题和用户显式选择的文本。

4. **状态 gating**
   - `loading` / `empty` / `only_self_in_meeting` / `no_visible_messages` 不展示 ambient card。
   - DOM 刚切换、RingCentral 虚拟列表还在复用缓存卡片时，等待稳定。
   - 当前页面只出现导航壳、会议壳、搜索框壳，不展示。

5. **负反馈降权**
   - 用户点 `这条不相关` 后，不只是当前 contextKey 静默，还要把“这个 surface + 当前实体/主题 + 这个 match/source”的组合写成降权信号。
   - 例如 Hackathon/Codex 场景误命中 Gary 行程，未来类似 AI/coding page 不应再被 travel itinerary 干扰。

6. **可解释性**
   - UI 里不要只写“向量命中会议上下文”。
   - 应显示具体重叠：`命中：Codex、Mercury Li、AI Tools group`。
   - 如果只有弱相关，就不展示。

### 选中文本召回

划词触发和 ambient 触发不同：

- 用户明确划选文本时，可以降低“页面整体相关”的要求，因为 selected text 本身就是 query。
- 选区旁只显示 `icon48.png` 或一行小 action：`用 Personal AI 查找关联记忆`。
- 不在用户刚划选时自动弹卡；点击 icon 后才请求 `/context-recall`。
- 请求的 `contextType='selected_text'`，`primaryText` 使用 selected text，`secondaryTexts` 带页面标题、URL、周边短文本。
- 结果仍要显示 whyMatched，且默认最多 3 条。
- 如果 selected text 过短、纯标点、纯按钮文字、密码/敏感输入区，不显示 icon。

### 注意力预算

建议第一版预算：

- Glance：最多 1 行提示。
- Ambient Peek：默认 1 条强相关；只有用户主动展开时才看最多 3 条。
- Selection Peek：最多 3 条。
- 不提供 Work/context composer。
- 不做 external patch。需要写作、插入或 AI prompt pack 时交给 Compose Assist / AI Context Passport。

## 与现有代码的落地路径

### 可复用的现有能力

- `src/contentScriptWebIntelligence.ts`
  - page context extraction
  - bubble/card injection
  - site mute
  - feedback

- `src/composer-guard/*`
  - 仅作为边界参考：输入框识别、写作建议和插入行为属于 Compose Assist，不属于 Lens P0。
  - Lens 可以复用 site adapter 的上下文提取能力，但不复用插入行为。

- `src/services/MemoryServiceClient.ts`
  - `contextRecall`
  - recall / feedback API client patterns

- `memory-service/src/routes/contextRecall.ts`
  - passive recall 基础。

- `memory-service/src/core/ContextRecallService.ts`
  - scene-to-memory fast matching。

- Relationship / Skill / DayPilot / Decision / Operation 相关服务
  - 作为 Lens 的 card source。

### 推荐实现阶段

#### P0：把现有右下角 icon 升级成高质量 Lens 轻量态，1-2 周

目标：

- 不新增独立页面。
- 不新增写作/插入功能。
- 继续使用现有右下角 icon 和 `/context-recall`。
- 重点修正误召回：Hackathon/Codex 页面误命中 Gary 行程、空会议误命中 Colin/AVA 这类问题。
- 在 RingCentral、Jira、普通网页、AI chat 页面做统一 scene gating。
- 不做截图，不做 Desktop 全局快捷键。
- 只使用 DOM/URL/visible messages/meeting state/selection。

交付：

- 现有 `.pai-context-bubble` 保留，命名和文档上升级为 Lens light state。
- `whyMatched` 从“向量命中网页上下文”升级为具体 overlap signals。
- 空态/低信号/弱交集不展示。
- `100%` 这类原始分数不再伪装成准确率；改为可解释的相关强度或 debug-only。
- 负反馈记录到可学习的 scene/match 组合。
- 回归 fixture 至少覆盖：
  - Hackathon/Codex/RingCentral 页面不展示 Gary trip。
  - RingCentral Video 空会议不展示 Colin/AVA。
  - 真正同 group / same topic / same person 的记忆可以展示。
  - 用户划选 `Codex subscription and OpenAI API quota` 后可以手动召回相关记忆。

#### P1：划词 Lens 和多 surface 注入，2-3 周

目标：

- 划词后轻量出现 `icon48.png` 或 `用 Personal AI 查找关联记忆`。
- RingCentral/Jira/Web AI/普通网页都支持 selected text recall。
- Meeting Pilot 当前 topic -> Lens cards，但空会议保持 dormant。
- Relationship / Skill / Operation 只作为相关记忆来源，不生成回复。

交付：

- Nova weekly / RCVSDK daily / Jira issue / RingCentral thread / Web AI prompt 五类场景 demo。
- 用户反馈影响同类 scene 排序。

#### P2：Desktop 全局 Lens，3-5 周

目标：

- Desktop App 快捷键唤起。
- 前台 App/window title/选中文本。
- 用户主动截图/OCR，短 TTL，不默认长期保存。

交付：

- macOS Desktop App prototype。
- 隐私权限说明和 allowlist/denylist。
- `local_only` / `safe_summary` / `blocked` 三档外发策略。

#### P3：与 Compose Assist / Context Passport 的协作，3-4 周

目标：

- 在 ChatGPT/Claude/豆包/Codex/RingClaw 页面识别 prompt 和 reply。
- Lens 只提示关联记忆。
- 用户点击“用于写作”时，把当前 scene + selected memory refs 交给 Compose Assist 或 AI Context Passport。
- 和 Context Passport / Drift Radar 形成边界：Lens 负责即时发现，Passport 负责任务上下文包，Drift Radar 负责持续跟踪。

#### P4：整理功能文档并合并旧文档，1 周

目标：

- 在 `docs/features` 目录新增关键功能文档，例如 `docs/features/memory_lens.md`。
- 这个文档作为右下角 icon、网页被动召回、划词查记忆、会议轻量记忆提示的 source of truth。
- 找出现有右下角 icon 的相关文档，至少包括 `docs/features/webpage_memory_detection.md`，把有效内容迁入 `memory_lens.md`。
- 旧文档不要继续维护两套概念：
  - 方案 A：把 `webpage_memory_detection.md` 改成很短的兼容指针，指向 `memory_lens.md`。
  - 方案 B：如果仓库文档允许删除，则删除旧文档并更新所有引用。
- 保留 `docs/features/compose_assist.md` 作为写作/插入建议的独立 source of truth。

判断：

`webpage_memory_detection` 的相关功能文档可以被 Lens 功能文档包含。它本质上就是 Memory Lens 的网页/右下角轻量态，不应该长期作为平行概念存在。

## UX Demo 说明

当前已有 Demo 文件：[`memory-lens-demo.html`](./memory-lens-demo.html)

但根据本轮边界修正，现有 demo 需要重做。新的 demo 不应该像一个独立产品页，而应该是**带集成页面的注入式 demo**：

- 左侧展示真实感的目标页面，例如 RingCentral thread、RingCentral Video 空会议、Jira issue、Web AI 输入框、普通网页。
- 右下角使用 `static/icons/icon48.png` 作为现有 icon 的升级态。
- 点击 icon 后展示 Lens light card。
- 划选文本后只出现轻量小 icon / `用 Personal AI 查找关联记忆`。
- demo 要展示“错误召回如何被过滤”：Hackathon/Codex 页面不再提示 Gary trip，空会议不再提示 Colin/AVA。
- demo 不展示 `插入回复`，不展示 context composer；如果要写作，旁边标注“交给 Compose Assist”。

建议下一步单独用更强设计/推演模式生成这个 demo：

> 接下来用 opus mode 来写一个带集成页面的 html demo。

## 成功指标

### 体验指标

- Ambient top 1 card 被用户认为有用的比例 >= 65%。
- Ambient `这条不相关` 反馈率 < 15%。
- 空态误提示率 < 2%，尤其是刚进入会议、只有自己一个人、页面壳未加载完成。
- 强实体误配率 < 5%，例如当前页面没有 Gary 时不展示 Gary 相关记忆。
- 用户手动去 memory search 的次数下降。
- 用户主动划词 Lens 后，至少 50% 的请求返回用户认为相关的记忆。

### 安全指标

- 不自动插入外部 AI prompt 或原生输入框。
- `blocked` / `local_only` 卡片必须有原因。
- 敏感页面默认不保存 raw capture。
- 所有截图/OCR 临时对象有 TTL 和审计。

### 业务指标

- RingCentral / Jira / meeting / AI chat 四类核心场景都能在强相关时稳定返回 Lens card，在弱相关或空态时稳定不提示。
- 真实用户每周至少主动唤起 10 次。
- 右下角提示被永久关闭站点的比例下降，说明用户觉得提示更可信。

## 主要风险和应对

### 风险 1：太像 Microsoft Recall，引发隐私焦虑

应对：

- MVP 不做连续截图。
- 默认只在用户点击/快捷键/明确场景触发时生成 scene。
- Raw screenshot 默认不持久化。
- UI 明确显示“本次看到了什么、保存了什么、发出了什么”。

### 风险 2：提示太多，打断工作

应对：

- 只在高置信时显示 badge。
- 默认 3 张卡。
- 支持 site/app/person/topic 级静默。
- 反馈直接影响同类场景。

### 风险 3：screen / webpage prompt injection

应对：

- 当前页面内容永远标记为 untrusted。
- `private memory + untrusted page + external communication` 三者不能自动闭环。
- Lens 本身不外发 context patch；如交给 Compose Assist / Passport，必须走 redaction 和用户确认。
- 所有外发动作必须在对应能力里由用户确认。

### 风险 4：召回相关但不可用

应对：

- Card 必须回答 `whyNow` 和 `overlapSignals`。
- 排序不只看相似度，还看当前实体、主题、来源、freshness 和 scene state。
- 对“只是看起来相关”的记忆降低排序。

### 风险 5：与 Context Assist 重叠

应对：

- Compose Assist 保持“输入框旁生成可插入建议”。
- Lens 保持“当前页面/选中文本/会议旁的关联记忆提示”。
- Lens 可以把 selected memory refs 交给 Compose Assist，但不自己生成或插入回复。

## 为什么现在值得做

1. Personal AI 已经有记忆数据：9313 条消息、13646 个实体、48988 条关系，不缺素材。
2. 现有代码已经有网页 context recall、bubble、composer guard、meeting pilot，P0 可以增量做。
3. 用户真实工作已经进入多 AI、多会议、多项目并行阶段，最缺的是“此刻该想起什么”。
4. 行业正在走向屏幕级 AI、上下文工程和跨工具记忆，但多数产品要么只做平台内记忆，要么只做回放搜索。
5. Memory Lens 的产品重心非常贴合 Personal AI：留存记忆之后，在真实场景里把记忆及时拿出来。

## 建议优先级

我建议把 Memory Lens 排在这些能力之后或并行：

1. 先把现有 `webpage_memory_detection` / `Context Assist` 的相关性和反馈闭环做稳。
2. P0 Lens 可以作为它们的统一 UI 升级，不必等 Desktop App。
3. Relationship Radar / Skill Foundry / Operation Flight Recorder 的数据越成熟，Lens 卡片越有价值。
4. Desktop 全局截图/OCR 等更敏感能力放到 P2，不抢 MVP。

最终判断：

> 这是一个值得推进的主线体验能力。它不替代已有 progressing 方案，而是把那些“记忆资产”真正带到用户每天工作的屏幕旁边。
