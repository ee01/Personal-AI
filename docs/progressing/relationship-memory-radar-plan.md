# Relationship Memory Radar：关系记忆雷达

> 生成日期：2026-05-08  
> Codex 会话标题建议：新能力：关系记忆雷达  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[relationship-memory-radar-demo.html](./relationship-memory-radar-demo.html)

## 结论

建议设计一个新的 Personal AI 能力：**Relationship Memory Radar / 关系记忆雷达**。

它不是传统个人 CRM，也不是把会议纪要按人归档，而是在用户进入某个“与人有关”的工作场景时，自动生成一张可解释、可确认、可带给其他 AI 的**人际上下文卡**：

- 这个人最近和我在聊什么。
- 上次未闭环的承诺、问题、风险是什么。
- 我下次沟通前应该先知道什么。
- 这个人的沟通偏好、当前关注点、项目角色有哪些证据。
- 哪些内容只是推断，必须先问清楚，不能直接当事实。

一句话价值：

> Personal AI 不只记住信息，还帮用户在每次沟通前恢复“我和这个人的上下文”，让聊天、会议、Jira 跟进和跨 AI 求助都更像“接着上次说”。

## 为什么要做

Personal AI 的长期目标是留存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话中提供记忆关联提示。真实使用里，“人”是这些记忆最常见也最容易漏的索引：

- 会议是和人开的。
- RingCentral 消息是和人或群组发生的。
- Jira、项目、handover、AI 工具选型，最后都要落到“谁在推进、谁要确认、谁之前说过什么”。
- 用户作为 Scrum Master，经常需要在多人、多项目、多工具之间维持上下文连续性。

当前系统已经有网页记忆提示、Context Assist、Meeting Pilot、决策回放、技能炼金台、操作记录、记忆可信中枢等规划，但缺少一个用户每天都能直接感受到价值的切面：

> 打开某个人或某场会时，Personal AI 立刻告诉我：我和 TA 之间的工作上下文现在是什么。

这个能力会降低三类真实成本：

1. **沟通前重建上下文的成本**  
   用户不需要翻 RingCentral、会议纪要、Jira、AI 聊天记录，只为确认“上次 Sophia/Fred/Gary 到底说了什么”。

2. **漏掉承诺和微妙关系信号的成本**  
   传统 action item 只知道“做什么”，但 Scrum Master 更需要知道“谁关心什么、谁在等谁、现在适合怎么问”。

3. **把错误上下文交给 AI 的成本**  
   关系上下文卡会把事实、推断、敏感信息、证据来源分开，避免在 Codex、Claude、ChatGPT、豆包里粗暴粘贴整段聊天。

## 本次输入信号

### Reminders 检查

本机 Reminders 可以稳定枚举列表名，但没有发现名为 `Personal AI` 的列表。可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。

尝试通过 AppleScript 扫描全部未完成提醒时 Reminders 查询卡住；本地 `~/Library/Group Containers/group.com.apple.reminders` 也被 macOS 隐私权限拒绝。因此本轮没有从 Reminder 随机抽取全新 idea，也没有可标记 done 的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。HTTP memory-service 端口可连接但 `/health` 超时，本次通过 SSH 只读查询远端 `memory-service/data/users/esone.qiu`，没有写入远端数据。

可用信号：

- `USER_CORE.md` 只确认了基础身份：Esone Qiu、Scrum Master、时区 Asia/Shanghai。偏好、关键人物、重要关系仍很稀疏。
- `messages_raw` 中已有约 8630 条 `glip` 工作消息、239 条 `meeting` 记忆、108 条豆包个人记忆、36 条 ChatGPT 工作记忆。
- 最近消息高频集中在 AI 工具、Codex / Claude Code / Cursor、Jira 数据协作、Nova / Rooms / Coa、团队成本政策、项目 handover。
- 近期真实片段显示：
  - Gary Chevsky 请求团队尽快在 Claude Code 与 Codex 间投票，再签 OpenAI 大单。
  - Fred Yang 提到低活跃 Cursor 用户转向 usage-based AI tools 的成本策略。
  - Sophia Lin 与 Esone 协作 Jira 数据统计、开发人数去重和数据可视化。
  - Sophia 建议在推进 Rooms 前先确认和 Coa 的协作。
  - 用户自己在消息中反思“上个月没用 automation 亏大了”，现在更频繁依赖 automation 做自我改进。
- `entities` 已经识别大量 Person，但 user profile 里“Key People / Preferences”几乎为空，说明系统**能看到人，却还没有把人变成好用的关系上下文产品**。
- `provider_sync_jobs` 已经有豆包 `mobile_context_thread` 的同步记录，说明 Personal AI 已经在做跨 AI/跨渠道上下文投递；关系上下文卡可以成为更精准的 context package。

### 已有方案避让

`docs/progressing` 近期已有这些能力方向：

- `decision-time-machine-plan.md`：回答“当时为什么这么决定”。
- `operation-memory-flight-recorder-plan.md`：保存“我怎么把一件事做成”。
- `personal-skill-foundry-plan.md`：把成熟流程沉淀成 skill。
- `memory-trust-console-plan.md`：治理记忆可信度、隐私和证据。
- `context_assist.md`：会前准备与输入框旁上下文提示。

关系记忆雷达不重复这些能力。它的主对象是 **person context / relationship episode**，它补的是“人与人之间的连续性”。它可以消费 Memory Trust Console 的可信分，也可以把 Flight Recorder/Decision Time Machine 的证据挂到人身上，但它的用户入口更日常：聊天、会议、Jira、AI 问答前的几秒钟。

## 行业观察

### 1. AI 记忆正从单平台走向可迁移、跨模型、用户拥有

- [Claude memory import/export](https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude) 已在 2026-03-16 文档中说明可以从其他 AI provider 导入记忆，也能导出 Claude memory 做备份或迁移。
- [Anuma](https://www.anuma.ai/blog/introducing-anuma) 主打 private memory layer，让用户在多个模型间切换时不丢上下文，并强调加密、用户拥有和可导出。
- [Supermemory](https://supermemory.ai/) 把自己定位为 AI 的 memory/context layer，强调 profile、memory graph、retrieval、connectors，以及 Claude Code / Cursor / OpenClaw 等 agent 插件。

启发：Personal AI 不应该只做某个聊天工具里的记忆，而要成为用户自己的上下文真源。关系记忆雷达就是把“跨工具记忆”落到用户每天最自然的对象：人。

### 2. 关系智能产品证明“按人组织记忆”是强需求

- [Dex](https://getdex.com/product/) 是个人 CRM，核心是 keep-in-touch reminder、notes 和 timeline。
- [Bloks](https://www.bloks.app/product) 把会议、邮件、文档自动汇成 relationship intelligence，并支持问“谁需要 follow up”“我承诺了什么”。
- [Clay 被 Automattic 收购](https://automattic.com/2025/06/12/automattic-welcomes-clay/) 后，Automattic 强调 Clay 能跨消息、日历、社交和通讯录组织关系数据。

这些产品说明“人际上下文”不是边缘需求。但它们多面向销售、客户关系或通用个人网络。Personal AI 的机会在于更窄、更贴近真实工作：

- 不做公开社交资料聚合。
- 不做销售 CRM。
- 不要求用户手动维护联系人。
- 直接从用户已有的 RingCentral、会议、Jira、AI 对话和浏览记忆中生成上下文卡。

### 3. 会议产品正在从“记一场会”扩展为“可被 AI 调用的工作上下文”

[Granola 2026 年 TechCrunch 报道](https://techcrunch.com/2026/03/25/granola-raises-125m-hits-1-5b-valuation-as-it-expands-from-meeting-notetaker-to-enterprise-ai-app/) 提到 Granola 在 MCP server 之后推出 personal API / enterprise API，让会议 notes 能进入 AI workflow。

启发：Meeting Pilot 如果只沉淀会议纪要，会变成会议工具；如果把会议里的人、承诺、关系状态和后续上下文写进 Relationship Radar，就会成为 Personal AI 的长期关系记忆来源。

### 4. 研究方向支持“任务相关记忆、结构化关系、证据治理”

- [PlugMem](https://www.microsoft.com/en-us/research/publication/plugmem-a-task-agnostic-plugin-memory-module-for-llm-agents/) 强调用 task-relevant knowledge 做记忆访问单元，避免 raw trajectory 造成上下文爆炸。
- [Mem0](https://huggingface.co/papers/2504.19413) 的长时记忆实验显示，结构化、持久的记忆机制可以显著提升长期对话一致性并降低延迟和 token 成本。
- [Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670) 把现代 agent memory 的工程现实归纳为 write-path filtering、contradiction handling、latency budget、privacy governance 等问题。
- [OpenAI Context Engineering for Personalization](https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization) 明确区分 durable preference 与 volatile/context-dependent preference，并强调 distillation、consolidation、injection 的端到端评估。

关系记忆雷达的设计要遵守这些原则：不把所有人际消息塞进上下文，而是按场景生成小而准的 relationship card；事实、推断、过期、敏感和证据分开；每次注入外部 AI 都有 token 预算和预览。

## 产品定位

### 功能名

**Relationship Memory Radar / 关系记忆雷达**

备选中文名：

- 人际上下文雷达
- 关系记忆驾驶舱
- People Context Radar

### 一句话产品承诺

> 在你要和某个人沟通前，Personal AI 自动恢复你们之间的最近上下文、未闭环事项、协作偏好和可引用证据。

### 目标用户

第一目标用户就是 Personal AI 当前真实使用者：

- Scrum Master / 项目协调者。
- 每天在 RingCentral、会议、Jira、AI coding tools、Google Sheets、Codex/Claude/ChatGPT/豆包之间切换。
- 需要维持多人、多项目、多决策的上下文连续性。
- 不缺消息记录，缺“现在和这个人说话前，我应该知道什么”的可操作摘要。

### 不做什么

- 不做销售 CRM。
- 不自动替用户发消息。
- 不把人际关系打成绝对分数。
- 不把推断伪装成事实。
- 不把敏感私人信息默认注入外部 AI。
- 不要求用户手动维护一套联系人库。

### 2026-05-08 修正：它首先是后台关系网络，不只是一个页面

这个能力的核心不应该是“多做一个 People 页面”，而是让 memory-service 在后台持续沉淀一个 **person-centric memory projection**：

- 对所有原始记忆保留低成本的人物关联索引：消息、会议、Jira、AI 对话、网页、操作 episode 都能挂到 `personId`。
- 只对高频/高价值人物生成完整 Relationship Radar：open loops、collaboration notes、context cards、review queue、AI context package。
- 已确认的人物偏好、协作约定、当前关注点会反哺 `/recall`、`/context-recall`、`/ask`、Meeting Pilot、Composer Guard 和跨 AI context package。
- 页面只是这个后台 projection 的可视化和人工校准入口。

换句话说，Relationship Radar 的长期价值是：**所有与某个人相关的记忆检索都会变准**。用户搜索 Sophia、打开 Sophia 的聊天、参加有 Sophia 的会议、在 Codex 里让 AI 起草给 Sophia 的 follow-up，都会自动消费同一套关系上下文。

### 入口修正：升级现有“人物”tab，而不是新建孤岛

当前 `src/modals/memory-exploring.vue` 通过侧边栏实体类型进入 `Person`，具体列表和详情由 `EntityListPage.vue` / `PersonDetailPage.vue` 承载。这个方案应该替代/升级现有“人物”实体页：

- `memory-exploring.html#/entity/Person`：从普通人物实体列表升级成 Relationship Radar 总览。
- `memory-exploring.html#/entity/Person/:personId` 或现有 `PersonDetailPage.vue`：升级成单人 Relationship detail。
- 保留现有人物实体的基础能力：搜索、实体详情、相关消息、项目/技能/资源等。
- 新增关系雷达能力：Now relevant、Open loops、Collaboration notes、Review queue、AI context package、Evidence & Trust。

这样用户不会在“人物”和“关系雷达”之间困惑；关系雷达就是 Personal AI 人物记忆的下一版。

## 核心场景

### 场景 1：打开 RingCentral 私聊时，自动出现人际上下文卡

用户打开 `esone.qiu+sophia.lin`。

右侧或右下角出现轻量提示：

> Sophia 近 7 天与你有 6 条高相关工作记忆：Jira 数据统计、Rooms/Coa 协作、Nova E2E 配置、handover。  
> 未闭环：推进 Rooms 前先确认 Coa 协作；5 月前 settle 某部分。  
> 建议先问：Coa collaboration 是否已有 owner。

用户可以点开：

- 最近互动时间线。
- 未闭环事项。
- 当前相关项目。
- 证据来源。
- 可复制给 Codex/Claude/豆包的“关系上下文包”。

### 场景 2：开会前按参会人生成 “Who is in the room”

在 RingCentral Video Home 或 Meeting Pilot 会前准备里，Personal AI 根据日历 attendees 生成：

- 每位参会人的最近上下文。
- 你和 TA 的 open loops。
- TA 当前关心的项目/风险。
- 与本会议议题相关的历史证据。
- 需要避免误用或已过期的旧信息。

用户不是看到一篇大摘要，而是看到可扫读的关系矩阵：

| 参会人 | 最近主题 | 未闭环 | 建议问法 | 证据 |
|---|---|---|---|---|
| Sophia | Jira 数据、Rooms/Coa | Coa 协作确认 | “Coa 这块现在谁 owner？” | 4 条消息 + 1 场会 |
| Fred | AI 工具成本策略 | Cursor reclaim 例外 | “例外口径是否仍找 Mercury？” | 2 条消息 |
| Gary | Claude Code vs Codex 投票 | 投票截止/签约前反馈 | “团队投票结果要怎么汇总？” | 1 条消息 |

### 场景 3：Jira / 项目页面显示关键人视图

打开某个 Jira issue、project dashboard 或 Nova / Rooms 页面时，Personal AI 不只显示“相关记忆”，还显示“关键人上下文”：

- 谁最近讨论过这个 issue/project。
- 谁可能是 owner / blocker / reviewer。
- 和每个人沟通时上次说到哪。
- 哪些结论来自团队群，哪些只是 1:1 推断。

### 场景 4：跨 AI 提问前生成关系上下文包

用户想让 Codex/Claude 帮忙整理给某人的跟进消息时，不再粘贴一堆聊天记录，而是让 Personal AI 生成：

```text
Context package: Sophia Lin / Rooms-Coa collaboration
Purpose: draft a concise follow-up message
Known facts:
- Sophia asked whether collaboration on Video Mobile and Coa has started.
- Sophia suggested clarifying collaboration with Coa before proceeding with Rooms.
- Sophia is also collaborating with Esone on Jira data analysis.
Open questions:
- Who owns Coa collaboration now?
- What exactly needs to be settled by May?
Do not assume:
- Do not state that Sophia owns Rooms unless confirmed by evidence.
Tone:
- Direct, collaborative, no over-explaining.
Evidence:
- RingCentral message refs...
```

这样外部 AI 拿到的是可控、压缩、带边界的上下文，不是原始聊天 dump。

### 场景 5：关系维护与主动提醒

当某个重要协作者长时间没有互动，或某个 open loop 过了合理窗口，系统只推送高价值提醒：

- “你和 Sophia 的 Rooms/Coa open loop 已 5 天未更新，且下周有相关会议。”
- “Gary 需要 Claude Code vs Codex 投票反馈，距离签约讨论越来越近。”
- “Fred 的 Cursor license 政策可能影响团队 AI 工具使用，是否要在 AI Tools 群里确认例外口径？”

提醒必须可解释，并允许 `已处理 / 稍后 / 不再提醒这类关系`。

## 核心概念

### Person Canonical Profile

“一个人”的统一身份，不等于通讯录联系人。它要合并：

- RingCentral directory 用户。
- `entities` 中识别到的 Person。
- group chat 中的 sender。
- 会议 attendees。
- Jira assignee / reporter / reviewer。
- 用户手动 alias。

```ts
interface PersonCanonicalProfile {
  id: string;
  displayName: string;
  aliases: string[];
  directoryRefs: Array<{
    provider: 'ringcentral' | 'google' | 'jira' | 'manual';
    externalId: string;
    email?: string;
    confidence: number;
  }>;
  roleHints: string[];
  primaryTeams: string[];
  sourceStats: {
    messageCount: number;
    meetingCount: number;
    jiraMentionCount: number;
    aiConversationCount: number;
    lastSeenAt: number;
  };
  privacyScope: 'work' | 'personal' | 'mixed';
  updatedAt: number;
}
```

### Relationship Context Card

某个场景下动态生成的人际上下文卡。它不是永久画像，而是“当前我要和这个人沟通时”的工作记忆。

```ts
interface RelationshipContextCard {
  id: string;
  personId: string;
  generatedFor: {
    surface: 'ringcentral_thread' | 'meeting_prep' | 'jira' | 'ai_context_pack' | 'people_page';
    surfaceRef: string;
    userGoal?: string;
  };
  headline: string;
  relevanceScore: number;
  freshness: {
    lastInteractionAt?: number;
    windowDays: number;
    staleRisk: 'low' | 'medium' | 'high';
  };
  currentTopics: RelationshipTopic[];
  openLoops: RelationshipOpenLoop[];
  collaborationNotes: CollaborationNote[];
  suggestedMoves: SuggestedMove[];
  doNotAssume: string[];
  evidenceRefs: EvidenceRef[];
  sensitiveRefs: EvidenceRef[];
  confidence: number;
  expiresAt: number;
}
```

### Relationship Event

把消息、会议、Jira、AI 对话转成和“某个人”有关的事件。

```ts
type RelationshipEventKind =
  | 'message_exchange'
  | 'meeting_interaction'
  | 'commitment'
  | 'ask'
  | 'decision'
  | 'handover'
  | 'blocker'
  | 'preference_signal'
  | 'correction'
  | 'thanks'
  | 'sensitive_personal';

interface RelationshipEvent {
  id: string;
  personId: string;
  kind: RelationshipEventKind;
  title: string;
  summary: string;
  eventAt: number;
  projectRefs: string[];
  topicRefs: string[];
  sourceRefs: EvidenceRef[];
  extractionConfidence: number;
  status?: 'open' | 'resolved' | 'superseded' | 'ignored';
}
```

### Collaboration Note

关于“如何和这个人协作”的可确认记忆。必须区分事实和推断。

```ts
interface CollaborationNote {
  id: string;
  personId: string;
  type:
    | 'communication_style'
    | 'current_focus'
    | 'decision_preference'
    | 'availability_pattern'
    | 'risk_sensitivity'
    | 'working_agreement'
    | 'manual_note';
  statement: string;
  status: 'confirmed' | 'inferred' | 'needs_review' | 'rejected';
  confidence: number;
  ttlDays?: number;
  evidenceRefs: EvidenceRef[];
  lastConfirmedAt?: number;
}
```

### Suggested Move

给用户的下一步沟通建议，不自动发送。

```ts
interface SuggestedMove {
  id: string;
  type: 'ask_clarifying_question' | 'follow_up' | 'acknowledge' | 'share_context' | 'defer';
  label: string;
  draft?: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  evidenceRefs: EvidenceRef[];
}
```

## 体验设计

### 信息架构

新增入口不应变成一个独立孤岛。建议直接升级现有 `memory-exploring.html` 的人物实体入口：

- `#/entity/Person`：关系记忆总览，替代当前普通人物列表。
- `#/entity/Person/:personId`：单人关系详情，替代/升级当前 `PersonDetailPage.vue`。
- `#/entity/Person/:personId?surface=ringcentral_thread&ref=...`：从具体聊天、会议或 Jira 打开的上下文卡。

同时在现有工作表面做轻量嵌入：

- RingCentral 私聊 / 群聊：右下角 ambient chip + 可展开 sidecard。
- Meeting Prep / Meeting Pilot：参会人矩阵。
- Jira / Project dashboard：关键人上下文区。
- AI Web Agent / Codex context export：关系上下文包预览。

### 默认首屏

`#/entity/Person` 首屏不是联系人列表，而是一个“今天沟通前最有用”的关系工作台：

1. **Now relevant**：今天/本周最相关的人，按 upcoming meetings、recent mentions、open loops 排序。
2. **Open loops**：按人聚合的未闭环承诺/问题。
3. **People graph**：项目/话题与人的简化关系图。
4. **Review queue**：系统推断出的关系偏好或当前关注点，等用户确认。

底层仍然保留搜索和实体列表能力。对于未达到 Radar 阈值的人，页面可以显示普通实体卡：最近出现时间、相关消息、来源和基础检索入口，但不生成完整 open loop / collaboration note / AI package。

### 单人详情页

单人页建议四个 tab：

- **Brief**：当前上下文卡，给沟通前 30 秒扫读。
- **Timeline**：按事件聚合的消息、会议、Jira、AI 对话。
- **Open Loops**：未闭环事项，支持已处理/忽略/稍后。
- **Evidence & Trust**：事实、推断、敏感、过期、冲突。

### RingCentral 嵌入态

嵌入态必须非常轻，不要打断用户：

- 默认只显示 `与 Sophia 有 3 个近期上下文`。
- 点开后显示 3-5 条 brief。
- 不自动插入草稿，只提供“复制上下文包 / 生成回复草稿 / 标记已处理”。
- 草稿生成时必须显示依据和不可假设项。

### AI context package 预览

任何外部 AI 注入都必须有预览页：

- 将包含什么。
- 不包含什么。
- 敏感内容是否打码。
- token 预算。
- 证据数量。
- 目标 AI：Codex / Claude / ChatGPT / 豆包 / OpenClaw。

## 推荐 Demo 说明

配套 demo `relationship-memory-radar-demo.html` 展示一个三栏工作台：

- 左侧：升级后的“人物”tab，总览高频人物、Radar 覆盖阈值和 open loop 状态。
- 中间：选中人物的沟通前 brief、建议问法、上下文包。
- 右侧：证据、可信度、敏感/推断边界，以及需要人工确认的 collaboration note。

Demo 使用本轮通过 SSH 只读查询远端 `esone.qiu` 记忆得到的**概括信号**做样例，包括近期 RingCentral/Glip 摘要中出现的 Sophia、Fred、Gary、John、Zora 等人物和主题。因为 `10.32.56.212:3210` HTTP 接口本轮超时，demo 不是实时 API 数据，也不是完整原文回放，而是基于查询到的摘要信号手工整理出的静态产品样例。

## 技术方案

### 现有可复用基础

Memory Service 已有：

- `messages_raw`：RingCentral / meeting / ChatGPT / Doubao 等原始或摘要记忆。
- `chunks` / `chunks_fts` / `chunks_vec`：全文与向量检索。
- `entities` / `entity_properties` / `relationships`：实体图谱。
- `user_profile_items` / `social_edges` / `opinion_items`：画像和社交关系基础。
- `rc_directory_users` / `rc_directory_teams`：RingCentral directory cache。
- `calendar_events`：会议和事件基础。
- `notification_records` / `proposed_actions`：主动提醒和动作队列。
- `context-recall` / `context-assist`：当前页面和场景召回接口。
- Meeting Pilot：会议 transcript、行动项、会前 handoff。
- Composer Guard：输入框旁上下文提示。

所以 MVP 不需要重建记忆系统，只需要加一层 person-centric projection。

### 高频人物覆盖策略

不建议对所有人都生成完整雷达。原因是：

- 记忆库里会有大量低频 sender、会议室、bot、一次性提及的人名和 NER 误识别实体。
- 对所有人跑 open loop / collaboration note 会浪费算力，也会产生大量低价值确认项。
- “人物雷达”本身带有关系判断，越低频越容易误判。

推荐分三层：

| 层级 | 覆盖对象 | 系统行为 | 页面表现 |
|---|---|---|---|
| `indexed` | 所有可解析人物 | 只维护 `personId`、aliases、source refs、基础统计 | 普通人物实体，可搜索、可看相关消息 |
| `radar_candidate` | 达到高频阈值或被用户 pin 的人 | 生成 relationship events、open loop 候选、review queue | 出现在人物 tab 的 Now relevant / 待确认 |
| `radar_active` | 用户确认、长期高频或高价值协作者 | 持续维护 context cards、collaboration notes、主动提醒候选 | 完整关系雷达卡 |

#### 阈值建议

不要粗暴永久取前几名。可以冷启动用 `topK`，但稳定期应使用分数阈值 + topK 兜底：

```ts
relationshipRadarScore =
  0.30 * recentInteractionScore +    // 近 30 天互动次数，按 log 缩放
  0.18 * distinctActiveDaysScore +   // 近 30 天出现的不同天数
  0.18 * openLoopScore +             // ask / commitment / blocker / deadline
  0.14 * projectOverlapScore +       // 与 watched projects / Jira / meeting topic 的重叠
  0.10 * meetingCoPresenceScore +    // 共同会议、参会人、会前准备
  0.06 * aiContextMentionScore +     // Codex / ChatGPT / Doubao 中被用作上下文的人
  0.04 * userBoostScore;             // 用户 pin、手动关注、最近点击
```

默认门槛：

- `radar_candidate`：score >= 60，且近 30 天至少 5 个 relationship events，覆盖至少 2 个不同日期。
- `radar_active`：score >= 75，或用户手动 pin，或近 30 天有 2 个以上未闭环 open loops。
- 冷启动兜底：如果符合阈值的人太少，取近 30 天 top 10；页面最多默认展示 top 20，后台最多维护 active top 50。
- 降级：连续 60 天低于 score 40 且无 open loop 的人，从 `radar_active` 降到 `indexed`，保留历史事件但不再主动生成卡片。

这比“粗暴取前几名”更稳：高频协作者会进来，短期关键人也能因 open loop / meeting / project overlap 进入，低频噪音不会占用用户注意力。

### 新增存储

```sql
CREATE TABLE relationship_people (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  aliases_json TEXT,
  directory_refs_json TEXT,
  role_hints_json TEXT,
  primary_teams_json TEXT,
  radar_state TEXT NOT NULL DEFAULT 'indexed',
  radar_score REAL NOT NULL DEFAULT 0,
  radar_reason_json TEXT,
  privacy_scope TEXT NOT NULL DEFAULT 'work',
  source_stats_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE relationship_events (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  event_at INTEGER NOT NULL,
  project_refs_json TEXT,
  topic_refs_json TEXT,
  source_refs_json TEXT NOT NULL,
  extraction_confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES relationship_people(id)
);

CREATE INDEX idx_relationship_events_person_time
  ON relationship_events(person_id, event_at DESC);

CREATE TABLE relationship_open_loops (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  due_hint TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  source_refs_json TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES relationship_people(id)
);

CREATE TABLE collaboration_notes (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  type TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inferred',
  confidence REAL NOT NULL DEFAULT 0.5,
  ttl_days INTEGER,
  evidence_refs_json TEXT NOT NULL,
  last_confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES relationship_people(id)
);

CREATE TABLE relationship_review_items (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  proposed_statement TEXT NOT NULL,
  proposed_value_json TEXT,
  source_refs_json TEXT NOT NULL,
  reason TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at INTEGER,
  review_action TEXT,
  reviewer_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES relationship_people(id)
);

CREATE TABLE relationship_context_cards (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  surface_ref TEXT,
  user_goal TEXT,
  card_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES relationship_people(id)
);
```

### 存储形态：SQLite 为真源，Markdown 为可读投影

不建议直接只用 Markdown 存关系雷达。原因是关系雷达需要排序、过滤、TTL、确认状态、证据 refs、跨 surface 低延迟召回，这些更适合结构化表。

推荐混合存储：

- **SQLite 真源**：`relationship_people`、`relationship_events`、`relationship_open_loops`、`collaboration_notes`、`relationship_review_items`、`relationship_context_cards`。
- **Markdown 可读投影**：在现有 `UserDataManager` 的 `entities/people/<slug>.md` 下生成或更新“Relationship Radar”段落，用于人工阅读、导出、备份和跨 agent 安装时的可解释上下文。
- **不要把动态 context card 当长期事实**：`relationship_context_cards` 是带 `expires_at` 的缓存，服务当前页面和外部 AI package；长期事实必须来自 events / open loops / confirmed collaboration notes。
- **已确认偏好才进入高层画像**：只有 `collaboration_notes.status = confirmed` 且多次证据支持，才可以摘要进 `USER_CORE.md` 的 Key People / Preferences，避免把一次消息误写成长期人格假设。

示例 Markdown 投影：

```md
# Sophia (Jinmei) Lin

## Relationship Radar

- Radar state: active
- Radar score: 88
- Recent topics: Jira 数据统计, Rooms/Coa, Nova E2E
- Open loops:
  - 确认 Rooms 与 Coa 的协作边界
- Confirmed collaboration notes:
  - 暂无
- Inferred notes waiting review:
  - 可能偏好先澄清 owner 再推进 Rooms

## Evidence

- 2026-04-30 RingCentral: 建议推进 Rooms 前先确认 Coa collaboration.
```

### Identity Resolution

优先级：

1. RingCentral directory exact match：email / user id / extension。
2. Sender exact match：`messages_raw.sender`。
3. Entity alias match：`entities.aliases_json`。
4. Group name heuristic：`esone.qiu+sophia.lin` 这类 1:1 group。
5. LLM-assisted merge suggestion：只产生 review item，不自动 merge。

关键规则：

- `Sophia Lin`、`Sophia (Jinmei) Lin`、`sophia.lin` 可以建议合并，但第一次要可回滚。
- `Nova` 这种可能是项目也可能被 NER 误识别成人，必须降权。
- 会议室、服务账号、bot、群名不能被当成自然人。
- 合并后保留 source identity，不丢原始证据。

### Relationship Event Extraction

输入来源：

- 最近 N 天高显著消息。
- 与目标人相关的会议 transcript / action item。
- Jira mention / owner / assignee / reviewer。
- AI 对话中提到目标人的 prompt/response。
- 用户手动标注。

抽取方式：

1. 规则先行：commitment / ask / thanks / blocker / deadline / handover 等模式。
2. LLM 结构化补充：只处理候选片段，不扫全库。
3. Trust gate：低置信度关系偏好不进卡片，只进 review queue。
4. Temporal merge：同一 open loop 多次出现时合并，不重复轰炸。

### 人工确认工作流

需要人工确认的不是所有事实，而是会影响后续推荐和外部 AI 注入的内容：

- 身份合并：`Sophia Lin` 是否等于 `Sophia (Jinmei) Lin`。
- 长期协作偏好：例如“TA 偏好先澄清 owner 再推进”。
- 关系 open loop：系统不确定是否仍未闭环。
- 敏感或高影响 context：例如可能影响团队政策、成本、角色归因。

确认入口分四类：

1. **人物 tab 的 Review queue**  
   默认入口。用户打开 `#/entity/Person` 时看到 `待确认 N`，逐条点 `确认 / 编辑后确认 / 不对 / 稍后 / 不要再用这类推断`。

2. **上下文卡内的 inline confirmation**  
   用户正在看某人的 brief 时，如果卡片中有 inferred note，直接在右侧证据栏给确认按钮。这个路径最自然，因为用户正在使用这条信息。

3. **低频 digest 通知**  
   只在高价值或高风险时推送，不为每条推断弹通知。建议每天最多一条：
   > Personal AI 发现 3 条需要你确认的人际上下文：Sophia/Rooms、Fred/Cursor、Gary/Codex vote。

4. **场景触发确认**  
   会议前、给某人写消息前、导出 AI context package 前，如果正要使用一条未确认 note，则在发送/复制前要求确认或排除。

确认动作写回 `relationship_review_items`，并更新目标对象：

| 用户动作 | 写回结果 |
|---|---|
| 确认 | `collaboration_notes.status = confirmed` 或 `relationship_open_loops.status = open/resolved` |
| 编辑后确认 | 保存用户编辑后的 statement，保留原 proposed statement |
| 不对 | `relationship_review_items.status = rejected`，同类模式降权 |
| 稍后 | `status = snoozed`，设置 `next_review_at` |
| 不要再用这类推断 | 写入 per-user suppression rule，后续不再生成同类 note |

确认后的内容才会进入默认召回增强；未确认内容可以在页面显示为 inferred，但外部 AI context package 默认排除，除非用户在预览页显式勾选。

### Context Card Composer

卡片生成遵循五层：

1. **Situation**：当前 surface 和 user goal。
2. **Recent facts**：最近高置信事实。
3. **Open loops**：未闭环事项。
4. **Collaboration notes**：已确认或高置信协作偏好。
5. **Boundaries**：不可假设、敏感、过期、证据。

排序信号：

- 当前页面/会议/项目匹配。
- 时间新鲜度。
- 对方近期频繁提及。
- open loop 紧急度。
- 用户显式关注。
- 可信度和证据数量。

### 对记忆检索的反哺方式

Relationship Radar 不是只给页面看的，它应该反哺所有与“人”相关的召回：

1. **查询理解**  
   当 `/ask` 或 `/recall` 识别到人名、email、RingCentral sender、会议 attendee、Jira assignee 时，先解析到 canonical `personId`。

2. **召回扩展**  
   用 `personId` 扩展检索：
   - 原始消息：`messages_raw.sender` / `entities_json` / `group_name`。
   - 关系事件：`relationship_events`。
   - 未闭环：`relationship_open_loops`。
   - 已确认偏好：`collaboration_notes.status = confirmed`。
   - 当前场景卡：未过期 `relationship_context_cards`。

3. **排序加权**  
   与当前人相关、近期、已确认、有 open loop 的记忆加权；低置信 inferred note 不加权，只作为候选提示。

4. **答案边界**  
   回答里显式区分：
   - confirmed facts。
   - inferred notes。
   - stale / unconfirmed / do-not-assume。

5. **跨 AI 注入**  
   外部 AI context package 默认只包含 confirmed facts + 高置信 recent facts + open loops + do-not-assume；inferred notes 需要用户确认后才进入。

### API 设计

```http
GET /api/v1/relationships/people?query=&limit=50
GET /api/v1/relationships/people/:personId
GET /api/v1/relationships/people/:personId/timeline?limit=50
GET /api/v1/relationships/people/:personId/open-loops
GET /api/v1/relationships/review-items?status=pending
POST /api/v1/relationships/context-card
POST /api/v1/relationships/context-package
POST /api/v1/relationships/open-loops/:id/resolve
POST /api/v1/relationships/collaboration-notes/:id/review
POST /api/v1/relationships/review-items/:id/confirm
POST /api/v1/relationships/review-items/:id/reject
POST /api/v1/relationships/review-items/:id/snooze
POST /api/v1/relationships/merge-suggestions/:id/approve
POST /api/v1/relationships/merge-suggestions/:id/reject
```

`POST /relationships/context-card` 示例：

```json
{
  "personHint": {
    "name": "Sophia (Jinmei) Lin",
    "email": "sophia.lin@ringcentral.com"
  },
  "surface": "ringcentral_thread",
  "surfaceRef": "group:esone.qiu+sophia.lin",
  "userGoal": "prepare a concise follow-up about Rooms/Coa collaboration",
  "tokenBudget": 900,
  "includeSensitive": false
}
```

### 前端集成

#### `memory-exploring.html#/entity/Person`

升级现有 Person entity view：

- person list。
- relationship brief。
- timeline。
- open loop queue。
- review queue。
- context package preview。
- radar coverage policy：显示“只为高频人物生成完整雷达”，并展示当前阈值/覆盖人数。

#### RingCentral content script

复用 `siteContextAdapters.ts` 的 RingCentral thread snapshot：

- 从 URL / DOM 提取 conversation id、group title、visible senders。
- 调 `/relationships/context-card`。
- 展示 `.pai-relationship-chip`。
- 打开 sidecard 时才加载完整证据。

#### Meeting Prep / Meeting Pilot

在现有 `ContextAssistService` 或 meeting prep handoff 中新增 `peopleContext`：

```ts
interface MeetingPeopleContext {
  attendeeId: string;
  displayName: string;
  relationshipCard: RelationshipContextCard;
}
```

Meeting Pilot 只消费，不负责抽取关系。

#### AI Web Agent / Doubao / Codex

通过 context package export 接口生成：

- `brief`：给人读。
- `llmContext`：给 AI。
- `evidenceManifest`：可追溯来源。
- `redactions`：脱敏记录。

## 隐私与可信度

关系记忆比项目记忆更敏感，必须默认保守：

1. **只显示，不自动发送**  
   所有建议都是用户确认后才复制、插入或外发。

2. **事实和推断分栏**  
   “Sophia 提过 Coa 协作”是事实；“Sophia 可能关心 owner 清晰度”是推断，不能混写。

3. **敏感内容默认排除**  
   私人信息、健康、家庭、薪酬、冲突、情绪判断默认不进外部 AI context package。

4. **关系标签可撤回**  
   用户可以对 collaboration note 点 `不对 / 过期 / 不要再用`。

5. **证据优先**  
   每条 open loop 和建议至少要有 1 个 source ref；没有证据只能作为“问清楚”建议。

6. **过期策略**  
   当前关注点默认 TTL 14-30 天；长期协作偏好必须多次确认或人工确认。

7. **确认后才提升权重**  
   未确认 inferred note 可以帮助用户发现线索，但不应该默认影响全局召回排序，也不应该默认发给外部 AI。确认后再提升权重。

## MVP 范围

### P0：只读关系上下文卡

目标：在 2 周内证明用户愿意看、看得懂、能减少翻记录。

范围：

- 从 `messages_raw`、`entities`、`rc_directory_users` 生成 top people。
- 支持 1:1 RingCentral thread 的 context card。
- 升级 `#/entity/Person` 页面，展示最近人物、open loops、证据和待确认项。
- 只读，不自动写回消息，不生成主动提醒。
- 支持用户确认/否定 collaboration note。
- 支持复制给 AI 的脱敏 context package。
- 只对 `radar_candidate` / `radar_active` 生成完整卡；普通低频人物仍保留基础实体检索。

验收：

- 对 5 个真实高频协作者生成关系卡，并解释为什么进入 Radar。
- 每张卡至少 3 条 evidence refs。
- 用户能在 30 秒内判断这张卡是否有用。
- 低置信推断不进入“事实”区。
- 至少 3 类 review item 可被 `确认 / 编辑后确认 / 不对 / 稍后` 处理。

### P1：Meeting People Brief

范围：

- 从 `calendar_events` / Meeting Pilot attendees 生成参会人矩阵。
- 会前准备页展示 who-is-in-the-room。
- 会后把新 action/open loop 更新到 relationship events。
- 与 NotificationService 连接，但只推送用户确认过的人/项目。

### P2：Relationship Assistant

范围：

- Composer Guard 旁显示“生成跟进草稿”。
- 支持“给这个人发消息前检查是否漏掉关键上下文”。
- 支持关系维护提醒。
- 支持跨 AI session package。

### P3：关系图谱与团队动态

范围：

- 项目-人-议题图谱。
- 团队情绪/协作摩擦信号，必须非常谨慎，只做用户私人可见。
- 从关系雷达反哺 `USER_CORE.md` 的 Key People 和 Preferences。

## 竞品对比

| 产品/方向 | 做得好的地方 | Personal AI 可借鉴 | Personal AI 的差异化 |
|---|---|---|---|
| Dex | keep-in-touch、notes、timeline、浏览器扩展 | 低摩擦联系人提醒 | Dex 需要用户维护联系人；Personal AI 从工作记忆自动生成上下文 |
| Clay | 跨渠道联系人智能搜索、关系管理 | “人”作为统一索引 | Clay 更像网络/通讯录层；Personal AI 更懂用户工作证据和 AI 上下文 |
| Bloks | 自动从会议、邮件、文档形成关系智能和 follow-up | commitment/open-loop 抽取 | Bloks 面向客户/团队 CRM；Personal AI 面向私人记忆和跨 AI 注入 |
| Granola | 会议 notes 进入 API/MCP 工作流 | 会议上下文可被其他 AI 调用 | Granola 以会议为核心；Personal AI 以所有个人记忆为核心 |
| Supermemory / Anuma | 跨模型、跨工具 memory layer | 统一上下文真源 | 它们偏通用 memory；关系雷达把“人际上下文”产品化 |
| ChatGPT / Claude / Gemini memory | 平台内个性化、记忆迁移 | 用户越来越接受 AI 记忆 | 平台记忆不懂 RingCentral/Jira/会议里的具体人际 open loop |

## UX 亮点

1. **从“搜索记忆”变成“沟通前自动带回上下文”**  
   用户不需要想关键词。打开人或会议，系统先给高价值提示。

2. **关系不是标签，而是带证据的动态 brief**  
   每条建议都能回到原始消息/会议/Jira/AI 对话。

3. **小卡优先，不堆大篇摘要**  
   用户每天高频沟通，默认必须 30 秒扫完。

4. **明确告诉 AI 不该假设什么**  
   context package 里有 `Do not assume`，比普通摘要更适合给外部 AI。

5. **把 Key People 从空画像变成活工作台**  
   现在 `USER_CORE.md` 的 Key People 为空；关系雷达可以用真实互动逐步校准。

## 风险与对策

| 风险 | 表现 | 对策 |
|---|---|---|
| 身份合并错误 | 把项目 Nova 当成人，或把同名人合并 | directory exact match 优先；低置信 merge 进 review queue |
| 人际推断过度 | AI 判断“某人不喜欢某事” | 关系偏好必须显示为 inferred，默认 TTL，外发前排除 |
| 信息太多 | 卡片变成另一篇会议纪要 | 限制最多 5 条 brief、3 个 open loop、3 条建议 |
| 敏感信息泄露 | 把私人对话注入外部 AI | 默认 `includeSensitive=false`，敏感 refs 独立预览 |
| 提醒骚扰 | 每个人都推送 follow-up | 只对用户手动关注的人/项目启用主动提醒 |
| 过期上下文误导 | 上月的角色/政策继续被引用 | current focus TTL，stale risk 显示，过期只作为历史证据 |

## 验证计划

### 数据验证

- 取真实 top 20 people，人工检查 identity merge。
- 对最近 30 天消息抽取 open loops，计算重复率和误报率。
- 对每个人生成 relationship card，检查是否至少有 3 个证据来源。

### UX 验证

- 打开 5 个真实 RingCentral 1:1 thread，记录：
  - 是否在 2 秒内出现 chip。
  - 是否 30 秒内能读懂。
  - 是否有至少 1 条用户觉得有用的上下文。
  - 是否有冒犯/过度推断/不该显示的信息。

### A/B 验证

- A：只用现有 context recall。
- B：使用 relationship context card。
- 任务：准备一条给某位协作者的跟进消息。
- 指标：
  - 用户翻历史消息次数。
  - 草稿生成后需要改动的比例。
  - 是否漏掉 open loop。
  - 用户主观信任度。

### 安全验证

- 外部 AI context package 默认不含私人/敏感字段。
- 每个 package 有 evidence manifest。
- 用户点击 `不对` 后，相关 note 不再进入后续卡片。

## 开发拆解

### Phase 0：文档与 demo

- 完成本 plan。
- 完成静态 demo。
- 人工确认是否进入实现。

### Phase 1：后端 projection

- 新增 migrations。
- 实现 `RelationshipIdentityResolver`。
- 实现 `RelationshipEventExtractor`。
- 实现 `RelationshipCardComposer`。
- 实现只读 API。
- 单测覆盖：
  - directory exact match。
  - group name alias。
  - project/person 混淆。
  - open loop merge。
  - sensitive exclusion。

### Phase 2：升级人物实体页

- 替换 `memory-exploring.html#/entity/Person` 的默认内容。
- 展示 now relevant、open loops、review queue。
- 单人 detail tab。
- context package preview。

### Phase 3：RingCentral 嵌入

- 扩展 `siteContextAdapters.ts`。
- 新增 relationship chip。
- 点击打开 sidecard。
- 不自动插入消息。

### Phase 4：Meeting / AI 集成

- Meeting Prep 增加 people brief。
- Composer Guard 增加 relationship-aware draft。
- Doubao/Codex/Claude context package 增加人际上下文类型。

## 落地优先级建议

建议先做 P0 + 一条 RingCentral 1:1 thread 集成。

原因：

- 远端记忆中 RingCentral 消息量最大，且真实人物和 open loops 已经存在。
- 用户每天打开聊天，能最快感受到价值。
- 只读关系卡风险低，不会引入自动发消息等副作用。
- 如果 5 个高频协作者的卡片已经有用，再扩展到会议和 Jira。

## 最终判断

这个功能值得做，因为它把 Personal AI 从“记住很多东西”推进到“在和人协作时变聪明”。对当前用户来说，最常见的上下文切换不是抽象知识检索，而是：

> 我要和 Sophia / Fred / Gary / John / Zora 继续推进某件事，我应该先记起什么？

关系记忆雷达能把消息、会议、Jira、AI 对话和项目记忆汇成一个很小但高价值的沟通前 brief。它不替用户社交，不替用户发消息，而是让用户少翻记录、少漏承诺、少把错误上下文交给 AI。
