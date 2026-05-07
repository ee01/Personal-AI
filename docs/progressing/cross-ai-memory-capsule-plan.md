# Cross-AI Memory Capsule Studio

*创建: 2026-05-01*

## 结论

建议设计一个新的用户界面和后端能力：**Cross-AI Memory Capsule Studio（跨 AI 记忆胶囊交接台）**。

它不是再做一个“同步到某个平台”的桥接器，而是让 Personal AI 成为用户自己的上下文发行中心：当用户要在 ChatGPT、Claude、Gemini、Codex、Cursor、豆包、会议或其他 AI 工具里继续工作时，Personal AI 自动生成一份**有目标、有边界、有证据、有时效、有隐私控制**的上下文胶囊，一键注入目标 AI，并把目标 AI 的输出再沉淀回 Personal AI。

一句话产品价值：

> 用户不再反复向每个 AI 解释“我是谁、这个项目到哪了、上次结论是什么、现在要注意什么”；Personal AI 在每个场景开始前，把刚刚好的记忆交给正确的 AI。

## 本次输入信号

### Reminder 检查

本机 Reminders 中未发现名为 `Personal AI` 的列表。实际列表包括 `We`、`Next actions`、`Reading`、`Tasks` 等，因此本次按“没有全新功能 idea”分支推进。

### 真实记忆信号

连接 `http://10.32.56.212:3210`，使用 `X-User-Id: esone.qiu` 做了只读召回。可用信号：

- 用户身份是 Scrum Master，时区 Asia/Shanghai。
- 用户高频关注 AI 工具、Codex/Cursor、AI 工程实践、会议/项目上下文、RingCentral 消息沉淀。
- 真实记忆中出现过一个明确方向：把对用户有意义的记忆导出到别的系统，让 AI/工具成为稳定 input 和操作方。
- 当前项目已经有 `ProviderContextService`、豆包双线程模型、ChatGPT explorer 输入链路、Memory Service 作为唯一真源；所以新功能应当复用这些基础设施，重点补“用户可控的跨 AI 上下文交接体验”。

## 行业观察

### 平台级 AI 都在补记忆，但仍是平台中心

- OpenAI 的 ChatGPT Memory 已经从显式 saved memories 扩展到可引用历史对话，并强调用户可关闭、查看、删除记忆。参考：[OpenAI Memory and new controls](https://openai.com/index/memory-and-new-controls-for-chatgpt/)。
- Claude Memory 强调工作场景、项目隔离、可编辑 memory summary、Incognito chat，并支持从其他 AI 工具导入/导出记忆。参考：[Bringing memory to Claude](https://claude.com/blog/memory)。
- Google Gemini 在 2026-04 推出更强的个人化与迁移能力：可以把其他 AI app 的 memories、context、chat history 带入 Gemini，也能上传 ZIP 聊天历史。参考：[Gemini personalisation features](https://blog.google/company-news/inside-google/around-the-globe/google-europe/united-kingdom/gemini-launches-new-personalisation-features-in-the-uk/)。
- Gemini Notebooks 把 chats、files、custom instructions 组织成跨 Gemini 和 NotebookLM 的 personal knowledge base。参考：[Notebooks in Gemini](https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/)。

这些产品证明“AI 记忆迁移”和“项目级上下文空间”已经变成主流竞争点。但它们的问题也很明确：记忆仍然属于平台，迁移经常是单向的、手工的、摘要化的，不保证证据可追溯，也不保证每次任务注入的是“刚好够用”的上下文。

### 会议与个人记录产品在抢“上下文入口”

- Granola 从 AI meeting notes 扩展到 team context、API、MCP server，方向是把会议记录变成企业 AI 上下文层。
- Limitless/Rewind 类产品主打“记录你说过、听过、见过什么”，并通过 MCP 或 API 让其他 AI 读取记忆。参考：[Limitless](https://www.limitless.ai/new)、[Rewind](https://www.getrewind.app/)。

这说明 Personal AI 不应只做聊天记忆，还要把会议、网页、项目、AI 对话沉淀为跨场景可调用的记忆资产。

### 论文方向支持“动态、拓扑化、可追溯”的记忆胶囊

- MemGPT 把 LLM 记忆管理类比为操作系统的 virtual context management，用不同记忆层管理有限上下文窗口。参考：[MemGPT](https://arxiv.org/abs/2310.08560)。
- Generative Agents 使用 memory stream、reflection、planning，让代理能基于完整经历记录做动态行为。参考：[Generative Agents](https://arxiv.org/abs/2304.03442)。
- Mem0 强调从长对话中抽取、巩固、检索显著信息，并报告比 full-context 更低延迟和 token 成本。参考：[Mem0](https://arxiv.org/abs/2504.19413)。
- A-MEM 结合 Zettelkasten 和 agent-driven decision making，让新记忆触发历史记忆的上下文表达和属性更新。参考：[A-MEM](https://arxiv.org/abs/2502.12110)。
- All-Mem 强调 non-destructive consolidation，保留 immutable evidence，避免摘要压缩造成不可逆损失。参考：[All-Mem](https://arxiv.org/abs/2603.19595)。
- Context Engineering 2.0 把问题定义为机器如何更好理解用户的情境和目的。参考：[Context Engineering 2.0](https://arxiv.org/abs/2510.26493)。

对本功能的启发：胶囊不应只是“摘要 prompt”，而应是可追溯、可裁剪、可进化、可回写的上下文交付物。

## 要解决的用户问题

### 真实痛点

1. 用户在多个 AI 之间切换，每个 AI 都需要重新解释背景。
2. 平台记忆经常混淆工作/个人、项目 A/项目 B、长期偏好/临时上下文。
3. “导出给另一个 AI”通常是手工复制一大段文本，不知道是否过期、是否泄露隐私、是否超 token。
4. AI 使用完上下文后，新的结论、承诺和偏好没有稳定回写到 Personal AI。
5. 用户无法清楚看到“这次给目标 AI 的上下文到底包含了什么证据”。

### Personal AI 的机会

Personal AI 已有这些能力：

- SQLite + FTS + vector + graph 多通道召回。
- ProfileManager / USER_CORE / Identity / Soul / Policy。
- TruthMaintainer 和确认队列。
- ProviderContextService 可渲染 provider-facing context package。
- Desktop App 可管理豆包输出和 ChatGPT explorer 输入。
- Chrome Extension 可感知网页、消息、会议上下文。

因此新增价值不在底层存储，而在**把记忆变成用户可控的跨 AI 工作流产品**。

## 核心概念

### Memory Capsule

一份 Memory Capsule 是 Personal AI 为某个目标 AI、某个任务、某个时间点生成的上下文交接包。

它包含：

- `goal`: 这次要让目标 AI 帮用户完成什么。
- `targetProvider`: ChatGPT / Claude / Gemini / Codex / Cursor / Doubao / Generic MCP。
- `scenario`: coding / meeting / project_followup / research / reply / daily_briefing。
- `scope`: work / personal / both。
- `ttl`: 过期时间，避免临时上下文长期污染。
- `budget`: token 或字符预算。
- `contextBlocks`: 画像、项目状态、最近事件、历史结论、未完成承诺、相关人、风险、用户偏好。
- `evidenceRefs`: 每个 block 绑定 `message/chunk/entity/profile/action` 来源。
- `redactions`: 被隐藏的敏感信息和理由。
- `confidence`: 对每个 block 的可信度、更新时间、冲突状态。
- `deliveryPlan`: copy prompt / provider native memory / session injection / MCP / local bridge。
- `feedbackHooks`: 目标 AI 输出后的回写建议和确认项。

### Capsule Studio

一个用户可见的新页面，用来：

- 看当前可用的 AI 目标。
- 生成或刷新胶囊。
- 调整 token 预算、时间窗口、来源类型、隐私级别。
- 预览实际要注入的 prompt。
- 查看每条上下文的来源证据。
- 一键复制、注入、排队同步。
- 查看回写结果和学习收据。

### Handoff Receipt

每次交接都会留下回执：

- 交给了哪个 AI。
- 交了哪些 block。
- 为什么包含这些 block。
- 哪些内容被脱敏。
- 目标 AI 有没有使用、有没有产生可回写结论。

这让用户对记忆流动有信任感，也便于后续调试。

## 关键体验

### 体验 1：打开 ChatGPT/Claude/Gemini 时的轻量浮层

场景：

用户打开 ChatGPT，准备问“帮我继续做 Personal AI 的会议功能”。

Personal AI 浏览器扩展识别到目标 AI 页面，浮出一条窄提示：

- `Personal AI found context for this task`
- 项目：Personal AI / Meeting Pilot
- 可注入：项目现状、最近决策、相关风险、用户偏好
- 操作：`Inject`、`Preview`、`Ignore`

用户点 `Preview` 进入 Capsule Studio 小面板。点 `Inject` 后，输入框里出现结构化上下文，或通过 provider bridge/MCP 交给目标 AI。

### 体验 2：Capsule Studio 作为中控页

页面布局：

- 左侧：目标 AI 和场景列表。
- 中间：胶囊概要、上下文 block、证据来源。
- 右侧：注入预览、token budget、隐私控制、交付状态。

用户操作：

- 切换 ChatGPT / Claude / Gemini / Codex。
- 调整 `Brief / Balanced / Deep`。
- 关闭“个人偏好”或“人际关系”来源。
- 看到 prompt 实时变化。
- 点击 `Copy Prompt`、`Queue Sync`、`Inject via Extension`。

### 体验 3：AI 对话结束后的回写

当目标 AI 产生输出：

- Extension / Desktop App / explorer 抓取该轮 AI 对话。
- Personal AI 提炼：
  - 新结论
  - 用户认可的方案
  - 待办
  - 用户偏好变化
  - 冲突候选
- 生成确认卡：
  - “是否把这条架构决策写入长期记忆？”
  - “是否覆盖旧结论？”
  - “是否把这段写入项目胶囊模板？”

### 体验 4：临时上下文不过夜

很多上下文只对当前任务有用。胶囊默认带 TTL：

- `query_answer_card`: 30 分钟。
- `meeting_prep`: 到会议结束后 2 小时。
- `coding_session`: 到当前分支/任务结束。
- `daily_briefing`: 当天有效。

过期后不再自动注入，但证据仍保留在 Memory Service。

## 与竞品/业内产品对比

| 产品/能力 | 做得好的地方 | 不足 | Personal AI 胶囊的差异 |
|---|---|---|---|
| ChatGPT Memory | 自动跨会话个性化，用户可管理记忆 | 平台内使用，项目边界和证据追溯有限 | 用户拥有真源，按任务生成可审计胶囊 |
| Claude Memory | 项目级隔离、memory summary 可编辑、支持导入/导出 | 仍是 Claude 内部记忆，跨平台回写弱 | 每次交接有 receipt，可回写到统一记忆库 |
| Gemini Memory / Import | 支持导入其他 AI memories 和完整 chat history | 偏平台迁移，容易形成新的平台中心 | 不迁移所有记忆，只交付当前任务所需最小上下文 |
| Gemini Notebooks | 项目知识库、文件和 custom instructions 组织清晰 | 主要在 Google 生态 | 胶囊可面向任何 AI / MCP client |
| Granola | 会议上下文密度高，开始变成企业 context layer | 聚焦会议，个人跨 AI 记忆弱 | 将会议、网页、IM、AI 对话合并为个人上下文层 |
| Limitless/Rewind | 捕获生活和对话，强调个人搜索/回忆 | 捕获强，任务级交接和证据编排弱 | 面向“下一次 AI 协作”的上下文工程 |
| Mem0 / Letta / Zep | 长期记忆基础设施成熟 | 偏开发者 SDK，不是最终用户体验 | 直接面向用户可见、可控、可预览的交互 |

## 产品亮点

1. **从“记住我”升级到“替我带上下文上场”**
   - 不是让每个 AI 慢慢学用户，而是 Personal AI 统一理解用户，再按场景分发。

2. **胶囊是小而准的上下文，不是大而全的导出**
   - token budget、TTL、来源开关、隐私脱敏，避免把整个人生塞给目标 AI。

3. **证据可追溯**
   - 每条上下文都能打开 Memory Exploring 对应 chunk/entity/profile。

4. **可逆、可审计**
   - 用户能看到发出什么、发给谁、何时过期、是否回写。

5. **复用现有系统**
   - 基于 `ProviderContextService`、`/recall`、`/providers/context-packages/render`、Desktop App、extension explorer 扩展。

6. **和未来 AI 生态方向一致**
   - 平台都在做 memory import/export；MCP 和 context engineering 正在成为跨工具上下文标准。Personal AI 应该先成为用户自己的 context authority。

## 信息架构

### Capsule Studio 页面

路径建议：

- Extension 内页：`memory-exploring.html#/capsules`
- 或新页：`memory-capsules.html`

一级区域：

- `Targets`
  - ChatGPT
  - Claude
  - Gemini
  - Codex
  - Cursor
  - Doubao
  - MCP Client
- `Scenarios`
  - Continue coding
  - Meeting prep
  - Project follow-up
  - Research handoff
  - Reply drafting
  - Daily briefing
- `Capsule`
  - title
  - freshness
  - token budget
  - source coverage
  - confidence
  - privacy level
- `Blocks`
  - user profile
  - active project
  - recent decisions
  - pending actions
  - relevant memories
  - communication preference
  - risk and conflicts
- `Preview`
  - final prompt
  - provider-specific formatting
  - copy/inject/sync actions
- `Receipts`
  - delivery history
  - usage status
  - write-back candidates

## 推荐 MVP

### MVP 范围

做一个 **ChatGPT / Claude / Gemini / Generic Copy** 通用胶囊，不先做复杂自动发送。

MVP 包含：

1. 后端新增 `capsule` 渲染层。
2. 前端新增 Capsule Studio 页面。
3. 支持按 query 生成胶囊。
4. 支持 copy prompt。
5. 支持 source evidence 展示。
6. 支持 privacy toggles。
7. 支持生成 handoff receipt。
8. 支持把目标 AI 对话结果通过现有 explorer 回写。

暂不做：

- 全自动控制 ChatGPT/Claude/Gemini 发送。
- 复杂账号登录态管理。
- 平台原生 memory API 写入。
- 多人/团队共享。

### MVP 用户故事

1. 作为用户，我在任意 AI 页面想继续一个项目时，可以点 Personal AI 胶囊按钮生成上下文。
2. 作为用户，我能看到这次上下文来自哪些真实记忆，不满意可以关闭来源。
3. 作为用户，我能复制一段适合 ChatGPT/Claude/Gemini 的 prompt，而不是手工整理背景。
4. 作为用户，我能看到本次交接有回执，知道什么信息被发出。
5. 作为用户，我能在 AI 输出后把关键结论沉淀回 Personal AI。

## 后端设计

### 新增类型

```ts
type CapsuleTargetProvider =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'codex'
  | 'cursor'
  | 'doubao'
  | 'generic_mcp';

type CapsuleScenario =
  | 'continue_coding'
  | 'meeting_prep'
  | 'project_followup'
  | 'research_handoff'
  | 'reply_drafting'
  | 'daily_briefing';

interface MemoryCapsule {
  id: string;
  title: string;
  targetProvider: CapsuleTargetProvider;
  scenario: CapsuleScenario;
  query: string;
  scope: 'work' | 'personal' | 'both';
  tokenBudget: number;
  freshnessWindowDays: number;
  ttlSeconds: number;
  blocks: CapsuleBlock[];
  redactions: CapsuleRedaction[];
  previewPrompt: string;
  sourceRefs: string[];
  confidence: number;
  generatedAt: number;
  expiresAt: number;
}

interface CapsuleBlock {
  id: string;
  kind:
    | 'user_profile'
    | 'active_focus'
    | 'project_context'
    | 'recent_decision'
    | 'pending_action'
    | 'memory_evidence'
    | 'communication_style'
    | 'risk_or_conflict';
  title: string;
  bodyMd: string;
  sourceRefs: string[];
  confidence: number;
  updatedAt?: number;
  includeByDefault: boolean;
  sensitivity: 'low' | 'medium' | 'high';
}

interface HandoffReceipt {
  id: string;
  capsuleId: string;
  targetProvider: CapsuleTargetProvider;
  deliveryMode: 'copy' | 'extension_inject' | 'mcp' | 'local_bridge';
  deliveredAt: number;
  deliveredHash: string;
  includedBlockIds: string[];
  redactionSummary: string[];
  resultStatus: 'created' | 'copied' | 'queued' | 'delivered' | 'failed';
}
```

### API 草案

```http
POST /api/v1/capsules/render
```

Body:

```json
{
  "targetProvider": "claude",
  "scenario": "continue_coding",
  "query": "继续设计 Personal AI 的跨 AI 记忆交接",
  "scope": "both",
  "tokenBudget": 1800,
  "freshnessWindowDays": 14,
  "includeKinds": ["user_profile", "active_focus", "recent_decision", "pending_action"],
  "privacyLevel": "balanced"
}
```

Response:

```json
{
  "capsule": { "...": "..." },
  "warnings": [
    {
      "type": "stale_context",
      "message": "Project owner memory is older than 30 days."
    }
  ]
}
```

```http
POST /api/v1/capsules/:id/receipt
GET /api/v1/capsules
GET /api/v1/capsules/:id
POST /api/v1/capsules/:id/feedback
```

### 与现有 `ProviderContextService` 的关系

现有 `ProviderContextService` 负责把 profile、voice、active focus、todo、query answer 渲染成 provider-facing context package。

新功能不替代它，而是抽象出更上层的 `CapsuleComposer`：

```txt
CapsuleComposer
  -> RecallEngine
  -> ProfileManager
  -> ProviderContextService.renderProduct(...)
  -> TruthMaintainer conflict state
  -> NotificationCenter / Actions
  -> CapsuleFormatter(provider)
```

需要把现有 provider package 升级为：

- 支持更多 provider formatter。
- 支持证据 refs 全链路保留。
- 支持用户开关 block 后重算 prompt。
- 支持 receipt。

### 数据库表

```sql
CREATE TABLE memory_capsules (
  id TEXT PRIMARY KEY,
  target_provider TEXT NOT NULL,
  scenario TEXT NOT NULL,
  query TEXT NOT NULL,
  scope TEXT NOT NULL,
  token_budget INTEGER NOT NULL,
  freshness_window_days INTEGER NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  preview_prompt TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  redactions_json TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE capsule_receipts (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  target_provider TEXT NOT NULL,
  delivery_mode TEXT NOT NULL,
  delivered_hash TEXT NOT NULL,
  included_block_ids_json TEXT NOT NULL,
  redaction_summary_json TEXT NOT NULL,
  result_status TEXT NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (capsule_id) REFERENCES memory_capsules(id)
);
```

## 前端设计

### 状态

- `idle`: 选择目标和场景。
- `rendering`: 后端召回和编排中。
- `ready`: 可预览、复制、注入。
- `dirty`: 用户改变了 block/toggle，需要重算 prompt。
- `delivered`: 已创建 receipt。
- `writeback_pending`: 已捕获目标 AI 输出，等待确认。

### 交互细节

- 目标 AI 切换时，右侧 prompt formatter 变化。
- token budget 使用三段控件：Brief / Balanced / Deep。
- source kinds 使用 checkbox：
  - Profile
  - Projects
  - Decisions
  - Messages
  - Todos
  - Risks
- 隐私级别：
  - Strict: 默认隐藏人名、邮箱、私密关系。
  - Balanced: 隐藏高敏信息，保留项目和角色。
  - Full: 全量上下文，但仍提示敏感风险。
- 每个 block 有：
  - inclusion toggle
  - evidence count
  - freshness label
  - sensitivity label
  - open in Memory Exploring
- preview prompt 显示：
  - provider-specific header
  - task objective
  - context blocks
  - evidence note
  - instruction to not store if temporary

## Provider formatter 规则

### ChatGPT

- 强调“use this as task context, do not treat as permanent unless I ask”。
- 如果用户要写入 ChatGPT Memory，另生成 `Saved memory candidate`。

### Claude

- 利用 project-scoped memory 的心智模型。
- 如果胶囊属于某项目，提示用户放入对应 Claude Project。
- 对临时上下文使用“do not save to memory unless I explicitly ask”。

### Gemini

- 如果是长期迁移，适配 Gemini memory import prompt。
- 如果是项目任务，建议放入 Notebook 或当前 chat。

### Codex / Cursor

- 更工程化：
  - repo path
  - relevant files
  - current branch assumptions
  - validation policy
  - user preference
  - recent decisions
- 输出更像 `AGENT.md` 的临时上下文块。

### Doubao

- 复用现有 Desktop App local bridge。
- 长期偏好仍进 `memory_sync_thread`。
- 当前任务胶囊进 `mobile_context_thread`。

## 安全与隐私

### 最小披露

默认只给目标 AI 当前任务所需上下文，不全量导出。

### 敏感检测

高敏内容默认脱敏：

- 明确个人身份号、地址、手机号、邮箱。
- 未确认的健康、财务、家庭敏感信息。
- 私密关系或情绪判断。
- 公司内部敏感项目和客户信息。

### 用户控制

- 每个 block 可关闭。
- 每个 receipt 可查看。
- 每个 provider 可设置默认隐私级别。
- 可配置 `never send to external AI` 的来源或实体。

### 防污染

胶囊带 `ttl` 和 `stability`，并在 prompt 中明确说明临时上下文不要写入长期记忆。

## 评估指标

### 用户体验指标

- 首次生成胶囊 < 3 秒。
- 复制/注入前用户能看懂“为什么包含这些上下文”。
- 用户手动删 block 的比例下降，说明召回更准。
- 用户重复解释背景的字数减少 70%。

### 记忆质量指标

- 胶囊 block 被用户保留率。
- AI 输出中引用胶囊上下文的比例。
- 回写候选被用户确认率。
- 过期上下文误注入次数。
- 敏感信息被用户撤回次数。

### 技术指标

- p95 render latency。
- token budget 命中率。
- sourceRefs 覆盖率。
- capsule receipt 完整率。
- explorer 回写成功率。

## 实施计划

### Phase 0: 方案和原型

- 完成本文档。
- 完成 HTML 交互原型。
- 用 3 个真实场景试写胶囊：
  - 继续 Personal AI coding。
  - 准备一个项目会议。
  - 把 ChatGPT 的方案迁移到 Claude/Codex。

### Phase 1: 后端 Capsule MVP

文件建议：

- `memory-service/src/core/CapsuleComposer.ts`
- `memory-service/src/routes/capsules.ts`
- `memory-service/src/repositories/CapsuleRepository.ts`
- `memory-service/src/types/capsules.ts`
- `memory-service/src/storage/migrations/0xx_memory_capsules.sql`

工作：

- 实现 `/capsules/render`。
- 实现 provider formatter。
- 实现 block inclusion 和 prompt assembly。
- 实现 receipt 创建。
- 单测覆盖：
  - token budget clamp。
  - privacy redaction。
  - sourceRefs 保留。
  - target provider formatter。

### Phase 2: Capsule Studio UI

文件建议：

- `src/modals/memory-capsules.vue`
- `src/modals/capsule-store.ts`
- `src/services/CapsuleClient.ts`
- `src/popup.tsx` 增加入口。

工作：

- 目标 AI 选择。
- query 输入。
- block 列表与证据展示。
- prompt preview。
- copy prompt。
- receipt 历史。

### Phase 3: AI 页面轻量浮层

文件建议：

- `src/contentScriptAiChat.ts`
- `src/services/AiProviderDetector.ts`
- `src/services/CapsuleInjectionService.ts`

支持站点：

- `chatgpt.com`
- `claude.ai`
- `gemini.google.com`
- `cursor.com` / Cursor web if available
- generic text area fallback

工作：

- 检测 AI 页面。
- 显示 Personal AI capsule trigger。
- 预览或插入输入框。
- 创建 receipt。

### Phase 4: 回写闭环

复用 ChatGPT explorer / Doubao explorer 的输入链路。

工作：

- 为 receipt 关联目标 AI 输出。
- 提炼 writeback candidates。
- 接入 confirm requests。
- 用户确认后写入 Memory Service。

### Phase 5: MCP 和原生集成

- 暴露 `capsule_render`、`capsule_receipt` MCP tools。
- Codex/Cursor/Claude Code 可直接调用 Personal AI 胶囊。
- Granola/Limitless 类外部记忆源可作为 source adapter。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 召回太多导致 prompt 噪音 | 用户不信任 | token budget + block toggle + evidence rank |
| 隐私泄漏 | 高 | 默认 Balanced/Strict，敏感来源黑名单 |
| 目标 AI 把临时上下文写入长期记忆 | 中高 | formatter 明确 TTL 和 temporary instruction |
| 自动注入不稳定 | 中 | MVP 先 copy prompt，自动注入后置 |
| 与现有 provider package 重叠 | 中 | CapsuleComposer 复用 ProviderContextService，不复制逻辑 |
| 回写误存幻觉 | 高 | 只生成候选，进入 confirm requests |

## 为什么值得做

这个功能正好位于 Personal AI 的核心目标交汇点：

- 留存所有记忆。
- 为聊天、会议、浏览、其他 AI 对话提供关联提示。
- 让用户沉淀的偏好、skill、历史结论在不同 AI 工具里持续可用。

行业趋势已经明确：各大 AI 平台都在做 memory、import、notebooks、connectors。但真正站在用户角度，最缺的是一个**不依赖某个平台、由用户拥有、能按任务精准交付上下文的记忆控制台**。

这个功能做成后，Personal AI 会从“记忆库”升级成“跨 AI 工作流的上下文操作系统”。

## Demo

HTML 原型已放在同目录：

- [`docs/progressing/cross-ai-memory-capsule-demo.html`](/Users/Esone/git/personal-ai/docs/progressing/cross-ai-memory-capsule-demo.html)

