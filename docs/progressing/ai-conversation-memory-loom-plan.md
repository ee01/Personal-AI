# 新能力：AI Conversation Memory Loom / 多 AI 对话织机（搁置）

> 生成时间：2026-05-19 CST  
> Codex 会话标题建议：新能力：多 AI 对话织机（搁置）  
> Demo：[`ai-conversation-memory-loom-demo.html`](./ai-conversation-memory-loom-demo.html)

## 搁置原因

当前暂不建议把 **AI Conversation Memory Loom / 多 AI 对话织机** 作为独立能力推进。

核心原因是使用频率假设不成立：用户目前大概率会在一个话题上持续使用同一个 AI 工具，而不是频繁在 ChatGPT、豆包、Claude、Gemini、Codex、OpenClaw 等多个 AI 之间来回切换。同一话题跨多个 AI 工具形成多份可聚合对话的场景会存在，但不是足够高频的默认工作流。

在这个前提下，Loom 的独立产品面会偏重：

- 检测多个 AI 对话是否属于同一主题；
- 合并多来源 AI 结论；
- 对比共识和分歧；
- 生成记忆补丁和 skill/prompt 候选。

这些能力的工程复杂度、审阅成本和 UI 心智都不低，但日常触发频率可能有限。做成独立页面容易变成“偶尔有用的整理台”，而不是 Personal AI 当前更需要的高频记忆提示能力。

更合理的处理方式是：暂时搁置独立 Loom，只保留其中可复用的局部思路：

- 在 **单个 AI 工具内**继续增强 AI 对话记忆沉淀，例如 ChatGPT/豆包 explorer 抽取更好的 prompt recipe、项目结论和待确认事实。
- 在 **Compose Assist / AI Context Passport** 中保留“相关 AI 对话”来源，但默认按同一 provider / 同一会话延续，而不是假设跨 AI 聚合。
- 当未来真实数据证明用户会围绕同一 topic 在多个 AI 工具之间频繁切换时，再重新评估跨 AI cluster、consensus/divergence 和 memory patch queue。

结论：**这个方向概念成立，但当前用户行为不支持作为近期独立能力投入。**

## 结论

本次没有从 Reminders 随机抽取 idea：本机 Reminders 可见列表中没有名为 `Personal AI` 的列表，因此也没有需要标记 done 或写备注的 Reminder item。

本方案记录为搁置方向：**AI Conversation Memory Loom / 多 AI 对话织机**。

它的核心不是再做一个聊天机器人，也不是调度多个 AI agent 执行任务，而是把用户散落在 ChatGPT、豆包、Claude、Gemini、Codex、OpenClaw、Cursor 等平台里的同主题 AI 对话自动归并成一个“对话织片”：

- 哪些结论多个 AI 都同意；
- 哪些地方互相矛盾；
- 哪些建议只适合某个平台；
- 哪些信息应该沉淀为 Personal AI 记忆；
- 哪些 prompt、操作方法、项目口径或 skill 候选应该回流到现有能力；
- 下次在任一 AI 平台继续这个主题时，Personal AI 应该补什么上下文。

一句话：**让 Personal AI 不只保存“我和某个 AI 聊过什么”，而是能把多个 AI 的零散讨论织成用户自己的可追溯工作记忆。**

## 原始价值假设

Personal AI 的长期目标明确包含“用户和其他 AI 的对话记忆”。现在项目已经具备不少基础：

- Desktop App 的 explorer 输入链路已经支持 `doubao` 和 `chatgpt` 来源，能抓取、缓存、提炼并写回 Memory Service。
- Compose Assist 已经能在 ChatGPT、豆包、Claude、Gemini 这类 Web AI 输入框旁提供 context pack。
- AI Context Passport 解决“把一个任务上下文交给另一个 AI”。
- Operation Memory Flight Recorder 解决“我怎么把这件事做成”的操作 episode。
- Personal Skill Foundry 解决“从真实流程沉淀 skill”。

这个方案最初基于一个假设：**用户会经常把同一个问题拿到多个 AI 工具里继续问，最后需要把多个 AI 的输出合并。**

同一个问题可能先问豆包做中文脑暴，再问 ChatGPT 查资料，再让 Claude 做结构化分析，再让 Codex 进入代码仓库落地。每个平台都产生了局部结论，但这些结论不会自然汇合。用户最后要靠脑子记住：

- 哪个 AI 提过什么好点子；
- 哪个结论后来被另一个 AI 反驳；
- 哪个 prompt 特别好，下次应该复用；
- 哪些建议只是模型猜测，不能写进长期记忆；
- 哪些东西应该变成项目口径、用户偏好、skill 或决策依据。

但用户反馈后，这个假设需要下调：**当前更常见的行为是一个话题留在一个 AI 工具里持续聊，因为跨工具切换本身麻烦。** 因此，AI Conversation Memory Loom 把多 AI 整理过程产品化的想法虽然成立，但不适合作为近期独立能力。

更应该优先做的是：在单个 AI 工具内，把长期对话提炼得更好，并在用户仍处于同一个 provider / 同一会话时提供低打扰的相关记忆提示。

## 本次输入信号

### Reminders 检查

通过 AppleScript 读取到的 Reminders 列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。

没有发现名为 `Personal AI` 的列表。一次全库模糊扫描因 Reminders 响应过慢已中止；本次按“没有明确新 idea”处理。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次使用只读 HTTP API 和 SSH/SQLite 查询，未写入远端数据。

关键观察：

- Memory Service 中有 `9335` 条 messages、`13648` 个 entities、`4582` 个 chunks、`49021` 条 relationships。
- 主要来源是 `glip` `8693` 条、`meeting` `316` 条、`calendar` `146` 条、`jira` `9` 条，说明真实记忆主要来自聊天、会议、日历和少量 Jira。
- 近期高频群组包括 `AI Tools for Engineering - Workgroup`、`AI Relevant Scrum Masters`、`Milo -- Video AI发源地`、`RingCentral Video`、`[CN] Nova Core Team`，用户日常显著关注 AI 工具、视频 AI、项目管理和团队协作。
- 用户身份为 Scrum Master，时区 `Asia/Shanghai`。`USER_CORE` 当前稳定呈现的内容仍很简短，主要是身份、姓名、时区；但 profile items 和消息里已经有大量“AI 辅助项目管理、Jira/sprint/fixVersion、直接实用沟通、分析型工作方式”等信号。
- Concerned Items 明确包含 `AI相关讨论话题,了解下是否有新工具,或者效率提升之类`，以及 `Personal AI 讨论`，说明用户本来就希望系统持续捕获 AI 工具和效率提升话题。
- 真实消息里出现 Codex、Claude Code、Cursor、OpenAI quota、Factory.ai、OpenClaw/RingClaw、Thinking Machines interaction models、Codex Chrome 插件、webpage-mcp 等讨论。
- `confirm_requests` 中仍有 `41` 条 pending，其中一批来自 OpenClaw delegation 能力缺口和 evidence resolution。这说明用户已经在让 AI/自动化接近真实执行链路，但“结果怎么归档、谁可信、哪些需要确认”仍有认知负担。

这些信号共同指向一个空位：**用户已经进入多 AI 工具并行使用阶段，但 Personal AI 对“多个 AI 对话之间的归并、冲突和长期沉淀”还没有一个清晰产品面。**

## 与已有 progressing 方案的边界

| 已有方案 | 解决什么 | 本方案避让点 |
|---|---|---|
| AI Context Passport | 把当前任务上下文打包交给另一个 AI | Loom 更关注“多个 AI 对话结束后如何合并和沉淀”，不是一次 handoff 包 |
| Agent Memory Control Tower（搁置） | 多 agent 分派、监控、合并执行结果 | Loom 不自动调度 agent，不做任务塔台，只整理已经发生或用户手动导入的 AI 对话 |
| AI Session Context Drift Radar（搁置） | 监听 AI 会话上下文是否过期、变错、变敏感 | Loom 不做实时漂移告警，先做离线/半实时聚合和合成 |
| Memory Reality Check（搁置） | 校验外部 AI 输出是否与事实/证据冲突 | Loom 会标记分歧，但不作为事实核验器；高风险事实可转给未来 Reality Check 或 confirm request |
| Memory Trust Console（搁置） | 全局记忆质量债和可信治理 | Loom 的治理对象只限 AI conversation clusters 和它们产生的 memory patches |
| Operation Memory Flight Recorder | 记录跨工具操作 episode | Loom 记录“AI 对话观点和产物”，只有当对话伴随真实操作时才链接到 Flight Recorder |
| Personal Skill Foundry | 管理和同步个人 skill | Loom 只把重复出现的 prompt/workflow 提交为 skill suggestion，不管理 skill 生命周期 |
| Compose Assist | 当前输入框旁的低打扰建议 | Loom 的输出可供 Compose Assist 使用，但自身是一个合成/审阅工作台 |

## 产品定义

### 核心对象

**AI Thread**

来自某个 AI 平台的一段对话，例如 ChatGPT conversation、豆包线程、Claude chat、Gemini chat、Codex session summary、OpenClaw result thread。

**Loom Cluster**

系统判断“围绕同一主题或任务”的一组 AI threads。聚类依据包括：

- Jira key、URL、文档链接、repo path、meeting id、RingCentral group/thread id；
- 用户 prompt 指纹；
- 标题和实体 overlap；
- 时间窗口；
- 相关 Personal AI memory refs；
- 生成物相似性，例如代码 diff、表格口径、会议 agenda、Jira comment。

**Claim**

从 AI thread 中抽出的可比较断言：

- factual claim：事实、状态、日期、owner、依赖；
- recommendation：建议、方案、优先级；
- method：操作步骤、prompt pattern、代码/查询方法；
- preference inference：对用户偏好或团队习惯的推断；
- risk / caveat：限制、风险、不确定性；
- artifact：prompt、JQL、Jira comment、邮件草稿、代码片段、表格结构。

**Synthesis**

对一个 Loom Cluster 的合成结果：

- Consensus：多个来源一致或互相支持的结论；
- Divergence：互相冲突或适用范围不同的结论；
- Useful Artifacts：可复用 prompt、草稿、checklist、脚本片段；
- Open Questions：需要用户或外部证据确认的问题；
- Next Prompt：下一次丢给某个 AI 的最小上下文；
- Memory Patch：建议写入 Personal AI 的结构化记忆补丁。

**Memory Patch**

可审阅、可拒绝、可降级写入的候选记忆：

- `project_note`
- `user_preference`
- `relationship_note`
- `decision_note`
- `skill_suggestion`
- `operation_hint`
- `prompt_recipe`
- `do_not_remember`

每条 patch 必须带 evidence refs、来源 AI、生成时间、置信度、风险级别和推荐作用域。

## 用户体验设计

### 入口 1：Desktop App Explorer 的“对话织片”

当前 Desktop App 已有 explorer 输入链路。新增一个 `AI Loom` tab：

- 左侧显示最近自动聚类的 topics；
- 每个 topic 显示来源平台、最近更新时间、是否有冲突、是否有待确认 memory patch；
- 点击后进入合成视图。

适合日常整理 ChatGPT/豆包/Claude/Gemini 对话。

### 入口 2：Web AI 页面旁的 Loom chip

用户在 ChatGPT、豆包、Claude、Gemini 页面时，扩展检测到当前对话与已有 Loom Cluster 相关，右下角展示一个小 chip：

- `3 个相关 AI 对话`
- `有 2 条可沉淀记忆`
- `Claude 与 ChatGPT 对方案 A 有分歧`

点击后打开侧栏，不打断当前输入。

### 入口 3：Memory Exploring 的 `AI 对话` 页面

在 `memory-exploring.vue` 增加一个 `AI 对话` tab：

- 按 project / topic / provider / conflict / unreviewed patch 筛选；
- 支持搜索“某个 AI 以前怎么建议过这个问题”；
- 支持把 cluster 导出为 Context Passport。

这让 AI 对话成为正式 memory source，而不是藏在 Desktop App 内部缓存。

### 入口 4：Compose Assist / Context Passport 的 source picker

当用户在任一 Web AI 输入框里需要 context pack 时，source picker 里可以选择：

- `相关 AI 对话共识`
- `只带我的确认结论`
- `带分歧和开放问题`
- `只带 prompt recipe`

这样用户不用把整段旧 AI 对话复制给新 AI。

## Demo

Demo 文件：[`ai-conversation-memory-loom-demo.html`](./ai-conversation-memory-loom-demo.html)

它模拟一个真实场景：用户围绕 `AI Notes long polling migration` 同时问了 ChatGPT、Claude、豆包和 Codex。Loom 自动聚合后给出：

- 4 个来源的证据条；
- 共识结论；
- 分歧点；
- 可沉淀的 memory patches；
- 下一次发给 Codex / Claude 的最小 context pack；
- “提交为记忆”“导出为 Context Passport”“转成 Skill Suggestion”动作。

## 竞品与行业参考

### ChatGPT Memory / Memory Sources

[OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 说明 ChatGPT 可以使用 saved memories、past chats、files、Gmail 等来源进行个性化，并通过 Memory Sources 展示哪些来源影响了回答。它的启发是：记忆产品必须让用户看到来源、管理来源，并能关闭或删除。

Personal AI 可以进一步做的是：ChatGPT 主要在 ChatGPT 内部个性化；Loom 把多个 AI 平台的对话结果统一变成用户自己的记忆资产。

### Claude Memory

[Claude Memory](https://claude.com/blog/memory) 强调 work context、project-scoped memory、可查看编辑的 memory summary，以及 incognito chat。它还明确支持用户把 memory 从其他 AI 工具迁移或导出备份。

Personal AI 可以进一步做的是：不是把所有外部 AI 对话迁到一个新的聊天产品，而是把它们作为 Personal AI 的多源证据，形成可选择、可追溯、可转交的 memory patch。

### Gemini Personalization

[Gemini personalization](https://blog.google/products-and-platforms/products/gemini/gemini-personalization/) 从 Search history 开始，强调只有在用户授权且模型判断有帮助时才使用个人数据，并提供数据源透明度。

Personal AI 可以借鉴其“按需使用个人上下文”的原则：Loom 不应该每次都把所有 AI 对话塞进 prompt，而应把相关共识和分歧压缩成可审阅上下文。

### ChatHub / 多模型并排比较工具

[ChatHub](https://github.com/chathub-dev/chathub) 支持同时向多个 chatbot 提问并比较回答。它证明用户确实需要横向比较模型输出。

Personal AI 的机会是补上 ChatHub 没做的后半段：比较之后，哪些结论进入长期记忆？哪些 prompt 变成技能？哪些分歧下次要提醒？

### Moss / Supermemory 类跨对话记忆

[Moss](https://mossmemory.com/) 主打导入 ChatGPT、Claude、Gemini 历史并做跨对话持久记忆。[Supermemory](https://supermemory.ai/) 强调 connectors、memory graph、profiles、MCP 和个人 app。

这些产品说明“跨 AI / 跨 app 记忆层”正在变成独立赛道。Personal AI 的差异点应是：它不只做问答记忆，还连接用户真实工作现场：RingCentral、Jira、会议、浏览器、Codex、OpenClaw 和本机操作。

## 论文与技术依据

### 记忆系统需要 write-manage-read，而不是只检索

2026 年 survey [Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670) 把 agent memory 形式化为 `write-manage-read` loop，并指出长期系统需要处理 contradiction、latency、privacy governance、continual consolidation、learned forgetting 等问题。

Loom 对应其中的 manage 阶段：AI 对话先被聚类、抽 claim、合成，再由用户确认是否写入长期层。

### Mem0：长期对话记忆要动态抽取、巩固和检索

[Mem0](https://arxiv.org/abs/2504.19413) 提出从持续对话中动态抽取、巩固和检索 salient information，并在 LOCOMO 上报告相比 full-context 大幅降低延迟和 token 成本。

Loom 的设计不走“把全部 AI 对话塞进上下文”，而是先抽 claim 和 artifacts，再合成可用 memory patch。

### A-MEM：新记忆加入时应更新旧记忆网络

[A-MEM](https://arxiv.org/abs/2502.12110) 使用类似 Zettelkasten 的动态索引和链接，让新记忆加入时自动建立连接，并可能更新历史记忆表征。

Loom 可以把一个新 AI thread 与既有项目、人物、skill、决策和旧 AI 对话建立链接，避免 AI 对话成为孤立 transcript。

### Portable Agent Memory：跨异构 agent 的记忆转移需要 provenance 和 scoped disclosure

2026 年 [Portable Agent Memory](https://arxiv.org/abs/2605.11032) 提出在不同 AI agent 间转移持久记忆，并强调 content-addressable entries、Merkle-DAG provenance、capability-based access control、injection-resistant rehydration 等机制。

Loom 的 Memory Patch 和 Source Receipt 可以借鉴这个方向：每条合成结论都有来源、hash、作用域和外发边界，不让外部 AI 输出无痕污染个人记忆。

### Multiagent Debate：多个模型输出可用于发现分歧，但不等于真相

[Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) 说明多个模型实例互相辩论可以改善推理和事实有效性。

Loom 可以借鉴“多来源观点比较”的价值，但产品上必须更谨慎：多个 AI 一致不代表事实成立，只代表“值得保存为候选结论”；涉及事实变更、外部状态和承诺时仍进入 confirm request 或 future Reality Check。

## 核心工作流

### 1. 收集 AI Thread

P0 先复用现有来源：

- `chatgpt`：Desktop App `ChatGPTSource` 已有 conversation list/detail 抓取能力。
- `doubao`：Desktop App `DoubaoChatSource` 和 webpage-mcp / managed Chromium fallback 已有抓取能力。

P0 的补充来源：

- Claude / Gemini：先支持用户粘贴分享链接、导出文件或页面选中内容。
- Codex / OpenClaw：先支持把 session summary、final answer、run receipt、docs/progressing 文件链接作为 thread artifact 导入。

P1 再做 Web AI 页面 adapter：

- Claude / Gemini 页面 DOM snapshot；
- Codex Web / ChatGPT / 豆包当前会话 chip；
- 支持用户点击“加入 Loom”而不是默认抓全量。

### 2. 归一化

所有来源转成统一结构：

```ts
interface AIConversationTurn {
  id: string;
  source: 'chatgpt' | 'doubao' | 'claude' | 'gemini' | 'codex' | 'openclaw' | 'cursor' | 'manual';
  conversationId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text: string;
  createdAt: number;
  title?: string;
  url?: string;
  model?: string;
  artifacts?: Array<{
    type: 'prompt' | 'code' | 'link' | 'file' | 'table' | 'image_ref' | 'diff' | 'command';
    label: string;
    value: string;
  }>;
}
```

### 3. 聚类

`AIConversationClusterer` 使用轻重两层策略：

- 快速规则：Jira key、URL、repo path、meeting id、RingCentral group id、project name；
- 语义聚类：embedding + MMR 去重；
- 时间约束：默认 14 天窗口，同一个项目可延长；
- 用户反馈：用户手动合并/拆分后记录 cluster rule。

### 4. Claim 抽取

`AIClaimExtractor` 从每个 thread 中抽结构化 claims：

```ts
interface AIConversationClaim {
  id: string;
  clusterId: string;
  sourceThreadId: string;
  claimType:
    | 'fact'
    | 'recommendation'
    | 'method'
    | 'risk'
    | 'preference'
    | 'artifact'
    | 'open_question';
  normalizedText: string;
  originalQuotePreview: string;
  stanceKey?: string;
  confidence: number;
  evidenceRefs: string[];
  sourceModel?: string;
  createdAt: number;
}
```

### 5. 合成

`CrossAISynthesisService` 输出：

- `consensus`: 相同 stanceKey 或互相支持的 claims；
- `divergence`: stanceKey 相同但结论冲突，或 recommendation 条件不同；
- `artifact_candidates`: prompt/JQL/checklist/code diff；
- `memory_patches`: 可写入 Memory Service 的候选；
- `next_context_pack`: 下次继续给某个 AI 的最小上下文；
- `blocked_questions`: 需要用户确认或外部系统查询的问题。

### 6. 用户审阅

首屏只让用户做轻决策：

- `保存为项目记忆`
- `保存为 prompt recipe`
- `转成 Skill Suggestion`
- `只保留为 AI 对话证据`
- `不要记住`
- `拆分 cluster`
- `合并到另一个 cluster`

高风险事实默认不直接写长期层，而是创建 confirm request。

### 7. 回流

回流目标：

- Memory Service：写入 `messages_raw` / `chunks` / `memory_metadata`，source_type 可为 `ai_conversation_synthesis`。
- ProfileManager：确认后的偏好写入 `user_profile_items`。
- Project Dashboard：项目口径和 open questions 进入对应 project detail。
- Context Passport：生成可外发的精简上下文包。
- Skill Foundry：重复 prompt/method 进入 skill suggestion。
- Compose Assist：在 Web AI 输入框旁优先使用已确认 synthesis。

## 数据模型建议

```sql
CREATE TABLE ai_conversation_threads (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_conversation_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  model TEXT,
  scope TEXT NOT NULL DEFAULT 'work',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  ingest_status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE ai_conversation_clusters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_id TEXT,
  topic_key TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  source_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  patch_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE ai_conversation_claims (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  stance_key TEXT,
  normalized_text TEXT NOT NULL,
  original_preview TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  risk_level TEXT NOT NULL DEFAULT 'low',
  evidence_refs_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(cluster_id) REFERENCES ai_conversation_clusters(id),
  FOREIGN KEY(thread_id) REFERENCES ai_conversation_threads(id)
);

CREATE TABLE ai_memory_patches (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  patch_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  proposed_text TEXT NOT NULL,
  before_preview TEXT,
  after_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'low',
  evidence_refs_json TEXT,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY(cluster_id) REFERENCES ai_conversation_clusters(id)
);

CREATE TABLE ai_source_receipts (
  id TEXT PRIMARY KEY,
  patch_id TEXT,
  source_provider TEXT NOT NULL,
  source_thread_id TEXT NOT NULL,
  source_claim_id TEXT,
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## API 草案

```http
GET  /api/v1/ai-loom/clusters?status=open&provider=&projectId=&hasConflict=
GET  /api/v1/ai-loom/clusters/:id
POST /api/v1/ai-loom/clusters/:id/synthesize
POST /api/v1/ai-loom/clusters/:id/split
POST /api/v1/ai-loom/clusters/merge

GET  /api/v1/ai-loom/patches?status=pending
POST /api/v1/ai-loom/patches/:id/apply
POST /api/v1/ai-loom/patches/:id/dismiss
POST /api/v1/ai-loom/patches/:id/defer

POST /api/v1/ai-loom/import/manual
POST /api/v1/ai-loom/export/context-passport
POST /api/v1/ai-loom/export/skill-suggestion
```

## 前端 UX 细节

### 列表页

默认按“需要我处理”的 cluster 排序：

1. 有冲突且影响项目/决策；
2. 有高置信 memory patch；
3. 有可复用 prompt / skill suggestion；
4. 最近活跃；
5. 来源多且相似度高。

Cluster item 展示：

- 标题；
- 来源平台 chips；
- 结论数 / 分歧数 / patch 数；
- 最近一次 AI 对话时间；
- 关联项目或 Jira key；
- 推荐动作。

### 详情页

三列结构：

- 左列：source threads，展示 provider、model、时间、用户问题摘要、AI 输出摘要；
- 中列：synthesis，包含 Consensus / Divergence / Artifacts / Next Prompt；
- 右列：Memory Patch Queue，逐条展示 before/after、来源、风险和动作。

### 低打扰原则

- 默认不弹通知；只有高价值 patch 或明确冲突才进 Notification Center。
- 对同一 topic 每天最多提示一次。
- 用户 dismiss 某类 cluster 后，记录 provider/topic rule，降低同类打扰。

### 视觉语言

这个页面应该像“审阅台”，不是 AI 聊天窗口：

- 来源用紧凑 chips，而不是大块聊天气泡；
- 合成结果用对照表和 evidence strip；
- 动作按钮聚焦保存、忽略、导出；
- 分歧点要明确显示“为什么不同”，避免把 AI 输出当事实。

## 安全与隐私

1. **AI 输出不是事实源**
   - 多个 AI 一致也只代表共识候选；
   - 涉及日期、owner、政策、客户、权限、外部状态时，默认进入 confirm request。

2. **不跨平台静默外发**
   - 从 Claude 对话提炼出的上下文，不自动发给 ChatGPT；
   - 用户点击 `导出给 ChatGPT` 时，未来应走 Memory Egress Firewall 的 preflight。

3. **保存证据但少存原文**
   - Source receipt 默认保存 hash、provider、thread id、短 preview；
   - 是否保存完整 transcript 遵循 explorer source 设置。

4. **敏感 prompt 和 secret 过滤**
   - 代码、API key、内部链接、客户信息进入 high risk；
   - high risk patch 只能保存为 local-only 或 confirm request。

5. **可撤回**
   - 复用 Desktop App 已有 revoke ingested memory 思路；
   - 用户可按 provider / cluster 撤回 Loom 生成记忆。

## 实现计划

### P0：ChatGPT + 豆包离线合成

范围：

- 复用 Desktop App explorer 已有 `chatgpt` / `doubao` raw cache 和 artifacts。
- 新增 memory-service `ai-loom` 表和 routes。
- 后端实现 clusterer、claim extractor、synthesis service 的最小版。
- UI 做 Desktop App 或 `memory-exploring` 的 `AI 对话` tab。
- 支持 manual import，用于 Claude/Gemini/Codex 文本。
- 只允许用户确认后写入 Memory Service。

通过标准：

- 导入同一主题的 2-4 段 AI 对话后能自动聚类；
- 能生成 consensus、divergence、open questions；
- 能生成至少三类 patch：project note、prompt recipe、skill suggestion；
- patch 应用后 evidence refs 可追溯；
- 用户可以 dismiss cluster 且后续不重复提示。

### P1：Web AI 页面 chip + Context Passport 回流

范围：

- 扩展支持 ChatGPT/豆包/Claude/Gemini 当前页面 detection；
- 当前对话匹配已有 cluster 时显示 Loom chip；
- 允许把 cluster 导出为 Context Passport；
- Compose Assist source picker 可选择 `AI 对话共识`；
- 高风险导出先接一个简化 egress preview。

通过标准：

- 在 ChatGPT 页面打开相关 topic 时，chip 能提示已有 Claude/豆包/Codex 讨论；
- 用户点击后看到最小 synthesis，而不是完整旧 transcript；
- 导出的 Context Passport 不包含未确认或 high risk 原文。

### P2：多平台稳定化和自动沉淀

范围：

- 增加 Claude/Gemini/Codex/OpenClaw adapters；
- 基于用户反馈训练/调整 clustering 和 patch ranking；
- 重复出现的 prompt recipe 自动送 Skill Foundry；
- 与 Project Dashboard / Relationship Radar / Day Pilot 建立回流；
- 加入 source freshness，旧 AI 结论被新网页/Jira/会议更新时显示 stale。

通过标准：

- 用户能在一个工作日内看到“今天多个 AI 给过的关键建议”；
- 用户接受的 patch 在后续 Compose Assist / Passport / Day Pilot 中被使用；
- 同类重复 prompt 能被聚合成 skill suggestion，而不是散落在多个 AI thread。

## 技术风险与缓解

| 风险 | 表现 | 缓解 |
|---|---|---|
| 聚类错误 | 不相关 AI 对话被织在一起 | P0 只做建议聚类，用户可拆分；强依赖 Jira key/URL/project anchor |
| 幻觉入库 | AI 编造事实被保存成记忆 | AI 输出默认是候选，事实类 patch 进 confirm request；来源显示 provider 和风险 |
| 信息过载 | 每天产生太多 cluster | 只推多来源、高复用、高影响 cluster；低价值只在列表沉默显示 |
| 隐私外泄 | 把一个 AI 的敏感内容发给另一个 AI | 不自动跨平台外发；导出前做 preview 和 future Egress Firewall |
| 成本过高 | 每段对话都跑 LLM | 先规则/embedding 聚类，只有候选 cluster 进入 claim extraction；缓存 source hash |
| 与已有能力重叠 | 用户不理解该去哪看 | 入口文案固定为“AI 对话织片”；只处理 AI conversations，不处理普通会议/消息 |

## 成功指标

- `cluster_precision`：用户手动拆分率低于 15%。
- `patch_accept_rate`：生成 patch 的接受率高于 35%。
- `repeat_context_savings`：用户在 Web AI 输入框中插入 Loom context pack 后，平均少复制旧对话次数。
- `skill_suggestion_yield`：被转成 Skill Suggestion 并最终 active 的比例。
- `conflict_resolution_rate`：带 divergence 的 cluster 中，用户标记“已处理/确认”的比例。
- `source_trace_click_rate`：用户点击 evidence refs 的比例，判断来源是否足够可理解。

## 如果未来恢复，亮点在哪里

1. **它直接命中“多 AI 时代”的新问题**

现在每个 AI 都在做自己的 memory，但人类的工作不是存在某一个 AI 里。Personal AI 如果要成为私人记忆中枢，就必须能处理“多个 AI 都参与过同一件事”的现实。

2. **它把 AI 对话从 transcript 变成资产**

普通导入 ChatGPT/Claude 历史只能搜索旧聊天。Loom 会进一步抽取共识、分歧、prompt recipe、skill candidate 和 memory patch。

3. **它和现有系统是互补关系**

Loom 的输出可以喂给 Context Passport、Compose Assist、Skill Foundry、Project Dashboard、Day Pilot，而不是另起孤岛。

4. **它可从现有代码渐进落地**

P0 不需要新浏览器权限，也不需要自动控制 Claude/Gemini。现有 Desktop App explorer 已经有 ChatGPT/豆包输入链路，只要补 synthesis 和审阅 UI。

5. **它天然增强用户信任**

用户看到的不再是“AI 记住了你什么”，而是“这些 AI 对话产生了哪些候选记忆，来源是什么，是否要保存”。这比后台静默入库更可控。

## 推荐决策

当前推荐：**搁置，不进入近期实现评审**。

可保留为未来观察方向，但不要先做独立页面、跨 AI cluster 或 consensus/divergence 工作台。近期更应该把投入放在单个 AI 工具内的对话沉淀质量，以及 Compose Assist / Context Passport 对“同一 provider 历史对话”的低打扰引用。

未来重新评估的触发条件：

- 真实 telemetry 显示同一 topic 在多个 AI provider 间迁移的比例明显上升；
- 用户开始主动把多个 AI 的回答拿来对比；
- ChatGPT/豆包/Claude/Gemini/Codex 的 explorer 来源都稳定后，跨来源聚类成本显著下降；
- 已有 Context Passport / Compose Assist 中出现足够多“需要跨 AI 对话合成”的用户动作。

若未来恢复，P0 的最小产品面应收敛为：

- ChatGPT + 豆包 + manual import；
- cluster 列表；
- consensus / divergence / patches；
- 一键保存为 project note / prompt recipe / skill suggestion；
- 不自动外发、不自动写长期画像。

如果 P0 的 patch accept rate 和 cluster precision 达标，再接 Web AI chip 和 Context Passport 回流。
