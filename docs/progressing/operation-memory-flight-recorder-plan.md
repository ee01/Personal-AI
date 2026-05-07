# Operation Memory Flight Recorder：操作记忆飞行记录器

> 生成日期：2026-05-06  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[operation-memory-flight-recorder-demo.html](./operation-memory-flight-recorder-demo.html)

## 结论

建议设计并实现一个新的 Personal AI 一级能力：**操作记忆飞行记录器**。

它不是再做一个搜索页，也不是普通的屏幕录制，而是在用户主动允许的工作窗口内，把“我是怎么把一件事做成的”保存成可追溯的操作 episode：网页、Jira 查询、聊天上下文、复制/导出、AI 对话、命令行/Codex 步骤、产物文件、关键分叉和最终结论都在同一条时间线上。

> 用户下次不再问“我上次怎么弄出来的？”或重新从聊天、Jira、浏览器、AI 工具里拼线索；Personal AI 可以直接回放操作路径、解释每一步依据，并把成熟路径提炼成可复用 skill 或交给下一个 AI agent 执行。

## 为什么要做

Personal AI 的目标是保存“所有记忆”，其中很关键但目前最容易丢失的是**操作记忆**：

- 消息记忆能回答“别人说了什么”。
- 浏览记忆能回答“我看过什么”。
- 会议记忆能回答“会议里发生了什么”。
- AI 对话记忆能回答“AI 给过什么建议”。
- 但真实工作里最值钱的问题常常是：**“我当时到底怎么把它做出来的？”**

这类记忆跨多个表面：RingCentral 消息、Jira、Google Sheets、浏览器、Codex、ChatGPT/Doubao、终端、文件系统。只存最终答案会丢掉中间的判断、过滤条件、复制来源、失败重试和可复用动作。对用户来说，这正是重复劳动、交接困难和 agent 不可靠的来源。

## 本次输入信号

### Reminders 检查

本机 Reminders 可见列表中没有 `Personal AI` 清单，因此没有从 Reminder 里选取全新 idea。当前可见列表包括 `We`、`Next actions`、`Tasks`、`Reading` 等，但未发现目标清单。

### 真实记忆信号

通过 SSH 只读查询 `10.32.56.212` 上 `esone.qiu` 的 memory 数据；HTTP memory-service 端口可连接但请求无响应，因此没有调用写接口。

观察到的用户场景：

- 用户身份为 Scrum Master，时区 `Asia/Shanghai`，记忆库里主要来源是 RingCentral/Glip、会议、Doubao/ChatGPT。
- 近期高频场景集中在 AI coding tools、Codex、Factory.ai、OpenClaw/RingClaw、Jira 数据、会议和团队协作。
- 有真实记忆显示：用 AI 帮同事捞 Jira 数据、去重 assignee、统计季度 Dev 人数、画表格和趋势图，能节省大量手工时间。
- 也有信号显示用户在反思“上个月没用 automation 亏大了”，当前自我改进和自动化机会更像随机抽卡，缺少把有效操作固化下来的机制。
- Meeting Pilot 已经能存会议，但会议 transcript 有噪声；如果能把会前资料、会中决议、会后 Jira/聊天跟进串成操作 episode，会比单条会议摘要更有复用价值。

### 重要限制：Concerned Items 不是完整上下文

当前 `concernedItems` 更像“用户显式关注/系统筛出的工作集”，不是完整 Glip/RingCentral 消息历史。它适合做触发器和线索入口，但不能作为沉淀操作记忆的唯一证据源。

因此本功能必须把消息上下文分成三层：

1. **Seed layer**：来自 `concernedItems`、网页记忆提示、Meeting Pilot、搜索结果或用户手动选择的起点。
2. **Hydration layer**：基于 seed 中的 `chatId` / `groupId` / `postId` / 时间窗口，调用 RingCentral Team Messaging / Glip 消息检索 API 拉取完整 thread/burst/context。
3. **Episode layer**：只在补齐上下文后，才把“任务目标、关键步骤、输入参数、输出产物、依据消息”固化为 operation episode。

换句话说，`concernedItems` 只能回答“哪里可能有事”，不能回答“这件事完整发生了什么”。如果只依赖它，确实会漏掉前置讨论、口径确认、后续修正和实际沉淀步骤。

### 已有方案避让

`docs/progressing` 已有以下方向：

- Cross-AI Memory Capsule Studio：把上下文交给其他 AI。
- Decision Time Machine：回放决策证据。
- Memory Rehearsal Studio：重要沟通前演练。
- Memory Trust Console：管理记忆可信度。
- Personal Skill Foundry：把做事方法沉淀成 skill。
- Proactive Notification System：主动预警和提醒。

本方案不重复这些方向。它补的是更底层的**操作证据层**：先把真实操作过程结构化保存下来，再支持决策回放、技能提炼、跨 AI 上下文包和主动提醒。

## 行业观察

### 平台记忆正在从“记住偏好”走向“记住上下文”

- [ChatGPT Memory](https://help.openai.com/en/articles/8983136-what-is-memory) 已区分 saved memories 和 chat history，并强调用户可查看、删除、关闭记忆。
- [Claude Memory](https://www.anthropic.com/news/memory) 强调 work context、project-scoped memory、可查看编辑和 incognito chat。
- [Gemini personal context](https://blog.google/products-and-platforms/products/gemini/gemini-personalization/) 会在用户授权后使用 Search history，并显示哪些数据源参与了个性化；[Temporary Chats](https://blog.google/products-and-platforms/products/gemini/temporary-chats-privacy-controls/) 说明隐私模式已经成为记忆产品的基础交互。

这些产品解决了“AI 记得我是谁和过去聊过什么”，但大多没有把用户跨工具完成任务的**操作链路**变成可复用资产。

### 屏幕时间线产品证明了“回到某个瞬间”的需求

[Microsoft Recall](https://support.microsoft.com/en-us/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c) 的核心体验是时间线和语义搜索屏幕快照，证明用户需要“找回我看到过的东西”。但 Recall 更像视觉快照索引，缺少“这一步为什么做、数据从哪来、能否复用为流程”的操作语义。

Personal AI 的机会不是复制 Recall，而是做一层更窄、更可信的**工作 episode 记录**：少截屏、多结构化；少被动全量、多主动授权；少找截图、多还原步骤。

### 工作工具在抢“跨工具上下文入口”

[Notion AI Meeting Notes / Enterprise Search](https://www.notion.com/nl/releases/2025-05-13) 把会议记录、统一搜索和多工具连接放在一起。它面向团队知识库，优势是连接器和协作；Personal AI 面向私人使用，优势应该是本地/个人所有、跨 AI、跨浏览器/桌面、带隐私控制。

### Agent 技术需要“可学习的操作轨迹”

- [OpenAI Computer-Using Agent](https://openai.com/index/computer-using-agent/) 说明通用屏幕、鼠标、键盘接口已经可行，但复杂任务仍与人类有差距。
- [UI-Evol](https://arxiv.org/abs/2505.21964) 提出从真实 agent-environment interaction 中抽取 faithful action sequences，再用 critique stage 提炼知识，这直接支持“从操作轨迹生成可复用经验”。
- [Task Memory Engine](https://arxiv.org/abs/2505.19436) 指出扁平上下文会导致多步任务幻觉、重复和误解，图状任务记忆能更好跟踪目标和依赖。
- [MemMachine](https://arxiv.org/abs/2604.04853) 强调保存完整 episodic ground truth，再做自适应检索，优于只存 LLM 抽取摘要。
- [Anthropic Economic Index](https://www.anthropic.com/news/anthropic-economic-index-insights-from-claude-sonnet-3-7) 显示 AI 使用仍以 augmentation 为主，而非完全自动化。这意味着产品不该一开始追求全自动接管，而应先做“记住、解释、辅助复用”。

## 功能定义

### 一句话

在用户允许的任务窗口里，Personal AI 自动保存跨工具操作 episode，并把它们变成可回放、可搜索、可验证、可提炼为 skill 的个人工作记忆。

### 不是

- 不是全天候屏幕录制。
- 不是无差别 keylogger。
- 不是替代 Meeting Pilot / Webpage Memory / Skill Foundry。
- 不是一开始就让 agent 自动重放所有操作。

### 是

- 有边界的工作捕获 session。
- 结构化事件 + 关键截图 + 文本证据 + 产物链接。
- 可解释的“任务路径图”。
- 对下次相似任务的上下文提示。
- Skill Foundry 的高质量原料。

## 目标用户需求

### 1. 找回操作路径

用户问：

- “上次 Sophia 要的那个 Jira 趋势图我是怎么跑的？”
- “我上次为了让 Codex 接 Jira/Confluence，看了哪些配置？”
- “这个 RingClaw harness 当时为什么这么设计？”

Personal AI 返回：

- 任务 episode；
- 时间线；
- 每一步的来源页面、参数、复制内容、生成文件；
- 关键分叉和失败重试；
- 可重新执行的步骤清单。

### 2. 把成功流程变成 skill

当某个 episode 复用价值高，系统提示：

- “这条流程已重复 3 次，是否提炼为 Jira 数据分析 skill？”
- “是否保存为 Codex context recipe？”
- “是否把敏感字段打码后导出给其他 AI？”

### 3. 给当前场景提供操作提示

用户打开 Jira 或 RingCentral 某个会话时，Personal AI 不只提示相关消息，而是提示：

- “你上次处理类似问题时先查了这些 JQL。”
- “这类数据报告通常要先确认统计口径。”
- “已有一个可复用操作 episode，可回放或交给 Codex。”

## 核心体验

### 入口 1：Capture Chip

在浏览器/桌面低打扰显示：

- 当前是否在捕获；
- 捕获范围：当前 tab / 当前 app / 选定窗口 / 当前任务；
- 隐私状态：截图开关、敏感页自动跳过、站点黑名单；
- 一键暂停、一键结束并保存。

自动建议只在高信号时出现，例如：

- 连续打开 Jira、Google Sheets、RingCentral 同一项目上下文；
- 复制 JQL、导出 CSV、生成图表；
- AI 对话里出现“帮我统计/画趋势/生成报告/按这个口径”等任务词；
- 当前任务跨越 3 个以上工具，且持续超过 5 分钟。

### 提示策略：主动提示 + 用户主动查阅并存

不要只做一个用户主动来查的页面。操作记忆的价值很大一部分来自“当前场景刚好需要时提醒”。

建议分三级提示：

1. **During work：捕获建议**
   - 当系统检测到跨 Jira / RingCentral / Sheets / AI 的高信号工作流时，提示“是否保存这次操作过程？”
   - 默认不自动保存敏感内容，用户点击后才开始 session。
2. **After work：保存前复核**
   - capture 结束后展示草稿 episode。
   - 用户确认 title、目标、证据、敏感字段，再保存。
3. **Future work：相似场景提醒**
   - 用户再次打开类似 Jira project、RingCentral thread、AI prompt 场景时，右下角提示“你有一个相似操作记忆”。
   - 提供 `打开回放`、`复制 checklist`、`发给 Codex` 三个动作。

主动提示必须可控：

- 同一 episode 对同一页面 30 分钟内只提示一次。
- 可对站点/app 关闭操作记忆提示。
- 低置信度只进入 `#/operations` 待复核，不弹出打扰。

### 入口 2：Work Replay Studio

一个新的 `memory-exploring` 子页或独立页面，用来查看操作 episode。

页面结构：

- 左侧：任务列表、来源、风险等级、可复用分数。
- 中间：操作时间线，按“目标变化/证据采集/转换/输出/验证”分组。
- 右侧：当前步骤证据、参数、关联记忆、可执行建议。

核心操作：

- 回放：按步骤查看。
- 搜索：自然语言找 episode。
- 提炼：发送到 Skill Foundry。
- 导出：生成 Cross-AI Memory Capsule。
- 复核：编辑错误步骤、标记敏感内容、合并重复 episode。
- 再做一次：生成 agent plan，但默认需要用户逐步确认。

### 入口 3：Context Action Card

在当前网页或聊天里，沿用现有网页记忆提示的低打扰方式，但展示的是操作型建议：

- “发现相似操作 episode：Jira 季度人力趋势分析。”
- “上次用了 4 条 JQL 和一个 Google Sheets pivot。”
- “可复制步骤 / 打开 episode / 发送给 Codex。”

## 信息架构

### Operation Episode

```ts
interface OperationEpisode {
  id: string;
  title: string;
  intent: string;
  status: 'capturing' | 'draft' | 'reviewed' | 'skill_candidate' | 'archived';
  scope: 'personal' | 'work' | 'both';
  startedAt: number;
  endedAt?: number;
  surfaces: Array<'browser' | 'desktop' | 'meeting' | 'chat_ai' | 'terminal' | 'file'>;
  sourceRefs: EvidenceRef[];
  artifactRefs: ArtifactRef[];
  riskLevel: 'low' | 'medium' | 'high';
  reuseScore: number;
  summary: string;
  openQuestions: string[];
}
```

### Operation Step

```ts
interface OperationStep {
  id: string;
  episodeId: string;
  sequence: number;
  timestamp: number;
  kind:
    | 'open'
    | 'search'
    | 'filter'
    | 'copy'
    | 'paste'
    | 'export'
    | 'ai_prompt'
    | 'ai_response'
    | 'command'
    | 'file_change'
    | 'decision'
    | 'validation';
  surface: string;
  appOrDomain: string;
  label: string;
  normalizedAction: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  evidence: EvidenceRef[];
  redactionState: 'clean' | 'redacted' | 'needs_review';
}
```

### EvidenceRef

```ts
interface EvidenceRef {
  sourceType: 'message' | 'webpage' | 'meeting' | 'ai_chat' | 'screenshot' | 'file' | 'command';
  sourceId: string;
  title: string;
  url?: string;
  timestamp?: number;
  excerpt?: string;
  thumbnailPath?: string;
}
```

## 捕获与处理流水线

### 1. Capture

先做浏览器 MVP：

- URL、title、domain、selected text、visible heading。
- 输入框只记录字段语义，不默认记录完整内容。
- 对 Jira / RingCentral / Google Docs / Google Sheets 做站点 adapter。
- 对 AI 聊天页面只记录 prompt/response 摘要和消息 id，原文按用户设置保存。
- 截图默认关闭；只有用户开启或点击“保存当前画面”才存。

再扩展到桌面 app：

- 活跃窗口标题和 bundle id。
- 文件打开/保存事件。
- Codex/terminal 命令摘要。
- 剪贴板事件只保存来源和类型，内容需命中白名单或用户确认。

### 1.5. Context Hydration

每次 operation episode 保存前都应做一次上下文补齐。

#### RingCentral / Glip 补齐

已有 `RingCentralClient.listPosts(chatId, sinceAt)` 封装了 `/team-messaging/v1/chats/{chatId}/posts` 读取能力，可作为第一版 hydration 基础。

建议新增一个专用服务：

```ts
interface OperationContextHydrationRequest {
  seedKind: 'concerned_item' | 'message' | 'follow_thread' | 'manual_selection';
  chatId?: string;
  postId?: string;
  groupId?: string;
  timestamp?: number;
  beforeMinutes?: number;
  afterMinutes?: number;
}
```

输出：

- anchor post：触发本次任务的消息。
- preceding context：前置口径、背景、约束。
- following context：后续确认、修正、结果反馈。
- nearby participants：参与人和相关实体。
- deduped thread：按 reply/quote/时间窗口整理后的 thread。

#### 补齐窗口

MVP 建议：

- 有 `postId`：围绕该消息前后各 24 小时，最多 100 条。
- 有 `chatId` 但无 `postId`：从 seed 时间起前后各 2 小时，最多 80 条。
- 手动 capture：从 capture 开始时间前 15 分钟到结束后 15 分钟。
- 后续用户可点“补更多上下文”，再扩到 7 天或整个 thread。

#### 证据可信度

episode 中每个步骤必须标记证据完整度：

- `complete`：已从完整 API thread 补齐。
- `partial`：只有 concerned item / 本地可见 DOM / 搜索结果。
- `manual`：用户手动补充。
- `unverified`：LLM 推断但缺少可验证来源。

UI 上不能把 `partial` 或 `unverified` 的步骤当作可复用流程直接导出给 agent。

### 2. Segment

把低层事件切成任务 episode：

- 显式 start/stop 优先。
- 没有显式 session 时，用时间间隔、项目实体、URL 群、复制链路、AI prompt 目标做候选聚类。
- 用户结束工作时弹出“保存为操作记忆？”轻提示。

### 3. Distill

LLM 不直接替代 ground truth，只生成派生层：

- 任务目标；
- 关键步骤；
- 参数和口径；
- 失败/重试；
- 可复用规则；
- 敏感字段候选；
- skill candidate。

原始 episode、step 和证据仍保留，避免摘要幻觉。

### 4. Recall

检索时同时走四类信号：

- 语义：任务描述相似。
- 结构：操作 step sequence 相似。
- 实体：项目、人、Jira key、AI 工具、文件名。
- 场景：当前 domain/app 与 episode surfaces 相同。

### 5. Reuse

复用分三级：

- `Explain`：只解释过去怎么做。
- `Guide`：生成逐步操作 checklist，用户执行。
- `Assist`：把步骤交给 Codex/OpenClaw/Computer Use agent，但每个外部写操作都需要确认。

## 隐私与信任设计

这个功能如果做错，会比普通记忆更危险，所以 MVP 必须把控制面做在第一天。

### 默认策略

- 默认不开启全局捕获。
- 首次只支持“手动开始一个 capture session”。
- 敏感 URL、密码/验证码/支付/银行/个人健康等页面自动跳过。
- 截图默认关闭。
- 每个 episode 保存前进入 review 状态。
- “临时捕获”可以只保留 24 小时。

### 用户可见控制

- 当前捕获状态常驻可见。
- 每一步都能删除、合并、改名、标记敏感。
- 可以按站点/app 永久关闭捕获。
- 可以把某个 episode 标记为“仅本地，不进入 AI 上下文”。
- 导出给其他 AI 前显示将包含的证据和 token 预算。

### 红线

- 不保存密码、OTP、信用卡、cookie、access token。
- 不把截图直接交给外部 LLM，除非用户明确确认。
- 不在隐身窗口捕获。
- 不把 private capture 用于自动化训练或外部同步。

## 与现有系统的关系

### Memory Service

新增表：

- `operation_episodes`
- `operation_steps`
- `operation_artifacts`
- `operation_evidence_links`
- `operation_redactions`

新增 source type：

- `operation`
- `operation_step`
- `operation_artifact`

召回：

- `/recall` 增加 `sourceTypes: ['operation']`。
- `/context-recall` 可以返回 `operation_episode` 类型 match。

新增服务：

- `OperationHydrationService`：从 seed 补齐完整消息/网页/会议/AI 对话上下文。
- `OperationEpisodeService`：保存 episode、step、evidence、artifact。
- `OperationDistillationWorker`：把完整证据蒸馏成可读步骤和 skill candidate。

### Chrome Extension

复用：

- `contentScriptWebIntelligence.ts` 的页面上下文提取、敏感页跳过、bubble 交互。
- `MemoryServiceClient`。
- `memory-exploring` 路由。

新增：

- `operation-capture/` 事件采集与站点 adapter。
- `operation-replay.html` 或 `memory-exploring.html#/operations`。

### UI 页面落点

沉淀后的操作记忆应该放进 `memory-exploring.vue` 这条主记忆入口，而不是单独再做一个孤岛页面。

推荐路由：

- `memory-exploring.html#/operations`：操作记忆列表、筛选、搜索。
- `memory-exploring.html#/operations/:id`：单个 operation episode 的 replay/detail。

原因：

- `memory-exploring.vue` 已经是所有记忆查询、会议记录、关注后续、自我反思、动作队列和主动询问的统一入口。
- 操作记忆本质上是新的 memory source，不是纯工具页。
- 顶部全局搜索可以把 operation episode 和消息、会议、网页、实体放在同一套检索体验里。
- 侧边栏可以显示“操作记忆”计数、待复核数、skill candidate 数。

但捕获中的轻量状态不应该塞进 `memory-exploring.vue`。捕获状态应该在当前工作表面显示：

- 浏览器页面右下角 capture chip。
- popup 里的当前 capture card。
- 必要时 desktop app menubar / quick panel。

`memory-exploring` 负责“查阅、复核、回放、导出”；当前页面负责“提示、开始、暂停、结束 capture”。

### Desktop App

复用：

- 现有 native helper、webpage-mcp、ChatGPT/Doubao source。

新增：

- 活跃窗口采样。
- 本地截图/缩略图存储。
- terminal/Codex session 摘要接入。

### Skill Foundry

Flight Recorder 不负责维护 skill 生命周期；它只把高质量 episode 推给 Skill Foundry：

- `skill_candidate`
- `evidence_bundle`
- `steps`
- `preconditions`
- `failure_modes`
- `validation`

## MVP 范围

### P0：浏览器手动捕获 + 回放

目标：证明操作记忆本身有价值。

- 手动开始/停止 capture。
- 支持 Jira、RingCentral、普通网页、ChatGPT/Doubao/Codex Web 基础事件。
- 保存 URL/title/selected text/copy/export/AI prompt 摘要。
- 保存到 memory-service。
- 新增 `Operations` 页面，能按 episode 查看时间线。
- 支持“生成复用 checklist”。

不做：

- 自动全局捕获。
- 桌面截图。
- 自动重放。

### P1：自动分段 + Skill 候选

目标：让它从“记录器”变成“复用发现器”。

- 高信号任务自动建议 capture。
- 相似 episode 聚类。
- 复用分数。
- 一键发送到 Skill Foundry。
- Context Action Card 在 Jira/RingCentral 页面提示类似 episode。

### P2：桌面/Agent 复用

目标：进入“操作记忆驱动 agent”的阶段。

- Desktop active window + 文件/命令摘要。
- 截图 opt-in。
- 生成 Codex/OpenClaw/Computer Use 可执行 plan。
- 每一步外部写操作 HITL 确认。
- 结果回写为新的 episode。

## 用户体验亮点

### 1. 不是“搜索截图”，而是“回放一次工作”

用户看到的不是一堆页面快照，而是一条有目标、有证据、有参数、有结果的任务故事。

### 2. 可先解释，再自动化

行业 agent 还没有稳定到能处理所有复杂 GUI 工作流。这个产品先做 augmentation：帮用户看清、复制、复用，再逐步让 agent 执行。

### 3. 操作记忆天然连接 skill

Skill 不应该凭空写。真实操作 episode 提供了 preconditions、steps、edge cases、validation，能显著降低 skill 幻觉。

### 4. 私人优先

企业搜索产品通常以团队知识库为中心。这个能力以“我的工作路径”为中心，既能保存私有操作，也能在需要时脱敏导出给其他 AI。

### 5. 能解释“为什么这样做”

每个步骤都有证据，不是只有最终答案。用户可以检查 AI 是否误解，也可以发现流程中哪些步骤其实可以省掉。

## 竞品对比

| 产品/方向 | 做得好的地方 | 对 Personal AI 的启发 | 缺口 |
|---|---|---|---|
| ChatGPT Memory | 易用、能记偏好和历史对话 | 控制权、Temporary Chat、可删除 | 不保存跨工具操作链 |
| Claude Memory | 工作/项目记忆、项目隔离 | project-scoped memory 很适合 workstream | 仍主要在 Claude 内 |
| Gemini Personalization | 能连接 Search history 且显示数据源 | 数据源透明度必须做到 UI 里 | 不做用户操作过程回放 |
| Microsoft Recall | 时间线和语义找回很直观 | timeline 是强心智 | 偏截图，不懂任务语义和可复用流程 |
| Notion AI Enterprise Search | 跨工具搜索、会议和工作知识整合 | 连接器 + 快速摘要 | 面向 workspace，不是个人操作 episode |
| OpenAI/Anthropic Computer Use | 能通过 GUI 执行任务 | P2 可以接入 agent replay | 没有用户自己的长期操作记忆会很脆 |

## Demo 说明

Demo 文件：

```text
docs/progressing/operation-memory-flight-recorder-demo.html
```

Demo 展示一个“Jira 季度人力趋势分析”的操作 episode：

- 左侧 episode 列表与筛选。
- 中间操作时间线。
- 右侧证据、复用 checklist、隐私状态。
- 顶部捕获状态与操作按钮。

这是静态 HTML 原型，主要用于判断信息架构和交互密度，不代表最终技术实现。

## 成功指标

### 早期定性

- 用户能在 30 秒内理解一个 episode 的目标、步骤和结果。
- 用户愿意保存至少 3 个真实工作 episode。
- 用户能从历史 episode 复制步骤并完成一次相似任务。

### MVP 量化

- `capture_started -> episode_saved` 转化率。
- episode 被再次打开/搜索/导出的次数。
- `generate checklist` 后用户标记“有用”的比例。
- 相似任务中平均节省时间。
- 被用户删除/标敏/投诉的捕获步骤比例。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 隐私压力太大 | 默认手动 session、截图 opt-in、保存前 review、敏感页跳过 |
| 事件太碎看不懂 | LLM 只做派生摘要，UI 按目标/证据/转换/输出分组 |
| 误捕敏感内容 | 本地规则先行 + LLM redaction candidate + 用户复核 |
| 和 Skill Foundry 重叠 | Flight Recorder 管 episode ground truth；Skill Foundry 管可复用 skill 生命周期 |
| 实现面太大 | P0 只做浏览器手动捕获，不碰桌面全局录制 |
| Agent 自动重放危险 | P2 才做 assist，所有外部写操作 HITL |

## 推荐实现路径

### 第 1 周：P0 骨架

- 建表和 API。
- Chrome 手动 capture chip。
- Generic/Jira/RingCentral adapter 的最小事件。
- Operations 页面静态数据打通。

### 第 2 周：可用 episode

- step 合并和 session 结束 review。
- 派生摘要与复用 checklist。
- evidence link 到原 message/webpage/meeting/AI chat。
- 基础搜索。

### 第 3 周：真实场景试用

- 选 3 个真实任务：
  - Jira 数据统计；
  - Codex/AI 工具配置；
  - 会议后行动项跟进。
- 每个任务录 2 条 episode。
- 调整 UI 密度和 redaction 规则。

### 第 4 周：P1 入口

- 相似 episode 提示。
- Skill candidate。
- Cross-AI Context Package 导出。

## 决策建议

值得做，因为它把 Personal AI 从“记住内容”推进到“记住做事过程”。这会成为后续 skill、agent replay、跨 AI 上下文、决策回放的共同原料层。

建议先做 P0，不做全局屏幕录制。用 2-3 个真实 Jira/AI 工具任务证明：用户是否愿意保存操作 episode，以及下次能否靠它少重复半天工作。
