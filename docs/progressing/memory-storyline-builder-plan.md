# 新能力：Memory Storyline Builder / 记忆故事线编排器

> Codex 会话标题建议：新能力：记忆故事线  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-storyline-builder-demo.html`](./memory-storyline-builder-demo.html)  
> 提示注入 Demo：[`memory-storyline-builder-entry-demo.html`](./memory-storyline-builder-entry-demo.html)  
> 生成时间：2026-05-25 08:07 CST

## 结论

建议评估一个新的 Personal AI 能力：**Memory Storyline Builder / 记忆故事线编排器**。

它解决的不是“帮我生成一个漂亮 PPT”，而是更贴近 Personal AI 核心目标的问题：

> 当用户要做分享、汇报、复盘、培训、周会 update 或对外解释时，Personal AI 能不能把过去散在聊天、会议、Jira、网页、AI 对话、操作记录、资料胶囊和 skill 里的真实经历，编排成一条有证据、有取舍、有受众感、可继续编辑的故事线？

一句话：**让用户不用临时翻聊天记录和会议纪要，也能把自己真实做过、看过、试过、踩过坑的东西讲清楚。**

这个能力的第一入口不应该是一个独立“写作平台”，而应该从真实场景触发：

- 日历里出现 `Sharing`、`CoP - 基于AI的个人发展和工具`、`course preparing`、workshop、weekly review。
- Day Pilot 生成“准备分享材料” mission。
- 用户在 ChatGPT / 豆包 / Google Slides / Docs / Gamma / NotebookLM 里输入“帮我准备分享 / 汇报 / 复盘”。
- 用户打开某个 Google Slides、会议 agenda 或 AI 工具分享准备表。

### 2026-05-25 触发方式修正：嵌入现有场景，由 LLM 判定是否提示

Storyline 不应该靠“日历标题里出现 sharing/workshop/review 就提示”的关键词规则。更合理的落地方式是：**在已经会做语义理解的现有功能里，顺手产出一个 Storyline opportunity**。

P0 推荐只接入 Today Pilot 会前准备：

1. Today Pilot 的 nightly/backfill meeting prep 本来就会读取日历事件、召回相关记忆，并调用 LLM 生成会前准备。
2. 在同一个 LLM 输出 JSON 中新增 `storylineOpportunity`。
3. `storylineOpportunity` 只决定是否在会前准备卡片里展示一个轻按钮，不生成完整故事线。
4. 用户点击按钮后，才调用 Storyline draft 生成接口。

这样用户不会被要求去一个平台输入项目名，也不会在后台自动生成一堆故事线草稿。用户只会在已经看会前准备、日历详情或会议列表时，看到一条“这里有足够素材，可以生成故事线”的低打扰提示。

MVP 交付的不是自动发出去的成品，而是一个**可审阅的故事线草稿**：

1. 主题主张：这次要讲的核心观点。
2. 受众和场景：给谁听、讲多久、要达成什么。
3. 证据片段：来自哪条消息、会议、资料、操作 episode 或 skill。
4. 故事段落：开场、现场案例、反差、经验、可复制清单、Q&A。
5. 风险边界：哪些只是个人经验、哪些不该外发、哪些证据不够。
6. 导出目标：Google Slides outline、speaker notes、Context Passport、NotebookLM/Gamma/Gemini/GDocs prompt。

## 为什么要做

### 真实用户问题

本轮先检查 Reminders。Apple Reminders 可见清单为 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`，没有可见的 `Personal AI` 清单，因此本轮没有从 Reminder 选题，也没有需要标记 done 的 item。

只读查询 `10.32.56.212` 上 `esone.qiu` 的真实记忆后，看到几个强信号：

- 数据规模：`9493` 条 messages、`4722` 个 chunks、`13665` 个 entities、`49298` 条 relationships，仍有 `37` 条 pending confirm requests。
- 来源结构：`glip 8697`、`meeting 349`、`calendar 210`、`doubao_chat 173`、`chatgpt 36`、`jira 17`、`outreach 11`。
- 未来日历有高相关事件：
  - `2026-05-26`：RingCentral <> Cursor Workshop，主题是 PRD to PR。
  - `2026-05-29`：`Sharing`。
  - `2026-06-02`：`course preparing`。
  - `2026-06-04`：`CoP - 基于AI的个人发展和工具`。
- 最近聊天和日历里反复出现 AI 工具实践：Codex、Cursor、Claude、OpenClaw、RingClaw、NotebookLM、Google AI Studio、Gemini Gems、AI Weekly Pulse、公司 AI 工具政策、AI 成本/额度、Jira 自动化和 “Bug - AI 先修一遍我再看”。

这些信号说明用户不只是“想查询记忆”，而是在真实工作里经常需要把记忆变成可讲、可交付、可影响团队的表达：

- 给团队讲“我最近怎么用 Codex / OpenClaw / NotebookLM / Cursor 提高效率”。
- 给 Scrum Master / 项目组讲“某个做法为什么值得试，限制是什么”。
- 准备 CoP、workshop、weekly review、course、AI 工具分享。
- 把一次 AI 先修 bug、Jira 数据分析、Google Sheet/Slides 汇报过程变成可复用经验。

现在 Personal AI 已经能保存和召回很多碎片，但用户真正要讲的时候，还需要自己完成最后一步：

> 从一堆记忆里找“哪几个例子最能说明问题”，按受众理解顺序组织，并决定哪些能讲、哪些不能讲。

这正是 Storyline Builder 应该补的层。

## 与现有 progressing 的边界

这个方向容易和已有计划混淆，需要先把边界收紧。

| 已有方向 | 已覆盖 | Storyline Builder 不重复的部分 |
|---|---|---|
| Memory Day Pilot | 今天有什么 mission、会前/当天提醒 | 只在“要表达给别人”时，把多源记忆编成可讲故事线 |
| Source Memory Distiller | 把网页、文档、视频、论文等资料变成 source memory capsule | Distiller 是输入层；Storyline Builder 把资料胶囊和个人经历组合成面向受众的叙事 |
| Operation Memory Flight Recorder | 记录用户怎么完成一个任务 | Flight Recorder 是证据源；Storyline Builder 把 episode 提炼成案例、教训和步骤 |
| Personal Skill Foundry | 把重复成功流程变成 skill | Skill 是可执行流程；Storyline 是解释、培训、汇报和传播 |
| AI Tool Compass | 给当前任务推荐用哪个 AI 工具 | Compass 帮用户选择工具；Storyline 帮用户讲清楚为什么、怎么用、哪里有限制 |
| AI Context Passport | 把上下文交给外部 AI | Passport 是上下文包；Storyline 可导出成 Passport，但目标是人类受众理解 |
| Memory Lens / Compose Assist | 当前页面/输入框的低打扰记忆提示 | Storyline 是较长表达的编排面板，不在输入框旁弹一堆卡 |
| Decision Time Machine | 决策 episode 回放 | Storyline 可以引用决策，但不会把所有决策做成管理台 |
| Memory Trust Console / Reality Check | 记忆可信治理或输出核验 | Storyline 只显示本故事线所需的证据边界，不做全局治理 |
| Google Slides Analyzer | 分析已有 Slides 并给字段建议 | Storyline 可以导出 outline/speaker notes 给 Slides，但不负责批量写回 deck |

最关键的产品边界：

- **不是 PPT 生成器**：Gamma、PowerPoint Copilot、Google Vids 已经能做视觉稿。Personal AI 的价值是“知道用户真实经历和证据”。
- **不是资料摘要器**：NotebookLM 很强，但它主要围绕用户上传的 sources；Personal AI 能跨消息、会议、操作、AI 对话、skill、关系和用户偏好。
- **不是自动发布器**：生成的故事线必须可审阅，不能自动发到群、Slides 或外部 AI。
- **不是新的校准平台**：反馈来自用户自然编辑、删除段落、替换证据、导出成稿，不要求用户维护标签集。

## 行业产品和研究信号

### 1. 资料工具正在从摘要走向“可消费媒体”

[NotebookLM Video Overviews](https://support.google.com/notebooklm/answer/16454555?hl=en) 已经可以把 notebook sources 转成 AI 讲解视频，并支持 Brief、Explainer、Cinematic 等格式、语言、视觉风格和 steering prompt。这说明用户不只想要摘要，还想把来源变成可听、可看、可分享的表达形态。

Personal AI 的机会：NotebookLM 依赖用户主动放进 notebook 的资料，通常不知道用户的 RingCentral 讨论、会议、Jira 操作、AI 工具试错和个人偏好。Storyline Builder 可以把这些私有记忆和资料源一起编排。

### 2. 工作视频和屏幕叙事正在被工具化

[Google Vids](https://blog.google/products-and-platforms/products/workspace/google-vids-updates-lyria-veo/) 在 2026-04 发布的新能力强调更轻量的视频创作、屏幕录制、Veo 生成、AI avatar 和音乐生成。它把“把想法变成 polished story”变成 Workspace 内的工作流。

Personal AI 的机会：Vids 解决“怎么制作视频”，不解决“用户过去哪几个真实例子值得讲、证据在哪、哪些不能对外讲”。Storyline Builder 可以输出给 Vids 的脚本和素材清单。

### 3. AI presentation 工具擅长排版，不擅长个人经历选择

[Gamma](https://gamma.app/products/presentations) 主打把文本快速转成 presentation、智能布局、视觉主题和导出。它对“把一段已有文本变好看”很强。

Personal AI 的机会：不要复制 Gamma，而是把 Personal AI 的多源记忆转成一份有结构、有证据、有受众约束的文本/outline，再交给 Gamma、Slides 或 PowerPoint。

### 4. 会议记忆正在变成外部 AI 可查询资产

[Granola MCP](https://docs.granola.ai/help-center/sharing/integrations/mcp) 允许 Claude、ChatGPT 等工具查询会议内容、notes 和 transcript。业内趋势是让会议记录进入 AI 工具链。

Personal AI 的机会：用户自己的会议只是故事线的一类证据。Storyline Builder 应该把会议、聊天、操作、资料、skill 统一成同一条 narrative，而不是只查询 meeting notes。

### 5. 研究侧也在反对“只做向量碎片召回”

[Amory: Building Coherent Narrative-Driven Agent Memory](https://arxiv.org/abs/2601.06282) 提出把对话碎片组织成 episodic narratives，而不是只做 embedding/graph 检索。它的核心启发是：长期记忆要保留“连贯事件”，否则用户拿到的是碎片。

[CAST: Character-and-Scene Episodic Memory for Agents](https://arxiv.org/abs/2602.06051) 强调 episodic memory 要能表达 who/when/where 的 coherent events，并用 character/scene 组织记忆。

[PlugMem](https://www.microsoft.com/en-us/research/publication/plugmem-a-task-agnostic-plugin-memory-module-for-llm-agents/) 提醒决策相关信息常常集中在抽象知识而不是原始轨迹里，需要更高信息密度的记忆结构。

[Human-Agent Co-Construction of Episodic Memories](https://journals.sagepub.com/doi/full/10.3233/FAIA250640) 讨论人和 AI 一起构建更完整的过去事件理解，尤其要区分重叠、补充和冲突的记忆。

[Contextual Agentic Memory is a Memo, Not True Memory](https://arxiv.org/abs/2604.27707) 也指出，单纯把 notes、向量库、scratchpad 当“记忆”会有上限。对 Personal AI 来说，Storyline Builder 是把碎片记忆向“可解释经验”推进的一步。

## 用户体验原则

### 1. 从场景触发，而不是让用户新建项目

用户不应该先想“我要去故事线页面”。入口应该是：

- Day Pilot card：`6/4 CoP 分享需要准备 AI 工具个人实践故事线`。
- 日历详情页：`生成 5 分钟分享故事线`。
- Google Slides / Docs：右侧出现 `用 Personal AI 生成证据故事线`。
- ChatGPT / 豆包 / NotebookLM 输入框：Compose Assist 识别“准备分享/汇报/复盘”意图后，给一个 `插入故事线上下文` 的轻入口。

触发判断不应由每个 surface 各自维护关键词列表，而应遵守同一套 LLM 判定协议：

```ts
interface StorylineOpportunity {
  available: boolean;
  confidence: number;
  storyType?: 'sharing' | 'status_report' | 'retro' | 'training' | 'proposal' | 'weekly_update';
  buttonLabel?: string;
  oneLineReason?: string;
  audienceHint?: string;
  estimatedLengthMinutes?: number;
  evidenceClusters?: Array<{
    label: string;
    sourceKinds: string[];
    evidenceCount: number;
  }>;
  blockedReasons?: string[];
  suggestedArtifact?: 'speaker_notes' | 'slides_outline' | 'ringcentral_post' | 'docs_brief';
}
```

`available=true` 需要同时满足：

1. **表达意图成立**：当前场景需要给别人讲、汇报、培训、复盘、同步进展或解释方案；普通查资料、普通 1:1、普通 daily sync 不算。
2. **素材规模足够**：至少能形成 3 个 story segment，且 evidence 不只来自日历标题本身。
3. **受众可判断**：能推断目标受众是团队、社区、项目干系人、会议参与者或文档读者；如果完全不知道给谁看，只给 Ask/Compose 普通回答，不提示 Storyline。
4. **边界可控**：可以生成内部版或打码版；如果主要证据来自私聊、meeting URL、敏感 Jira、未确认人物判断，则不提示或只提示“需先审阅素材”。
5. **输出物明确**：能落到 speaker notes、Slides outline、复盘稿、RingCentral post、Docs brief 等可编辑 artifact；如果只是一个简短回复，继续走 Compose Assist。

关键词只能作为“是否值得调用 LLM”的弱 prefilter，不作为展示理由。最终 UI 必须展示 LLM 的 `oneLineReason` 和 evidence cluster，而不是说“命中了 sharing 关键词”。

### 1.1 P0：会前准备内的提示注入

Today Pilot 会前准备是最适合的首个入口，因为它已经有 nightly/backfill 预生成链路，且用户打开 Video Home / 日历详情时本来就在看会议上下文。

推荐 UI：

```text
Today Pilot 会前准备
┌──────────────────────────────────────────────┐
│ CoP - 基于AI的个人发展和工具                   │
│ 已准备：背景摘要、4 张 cue cards、6 条证据       │
│                                              │
│ 这场会可能需要一条故事线                       │
│ 可用素材：Cursor workshop / Codex-Jira /      │
│ NotebookLM 资料 / OpenClaw skill              │
│ [生成 8 分钟分享故事线] [不需要]                │
│                                              │
│ Cue cards...                                  │
└──────────────────────────────────────────────┘
```

注意：

- 条幅位于 meeting prep 摘要和 cue cards 之间，不新增一个大型独立卡片。
- 按钮文案说明生成目标，例如 `生成 8 分钟分享故事线`、`生成 Slides 提纲`、`整理复盘故事线`。
- 点击后才调用 Storyline draft API；未点击前只保存 opportunity metadata。
- `不需要` / 关闭 / 忽略应写入反馈，降低同类会议提示。

### 1.2 Compose Assist 内的提示注入

Compose Assist 不应该在普通回复、Jira comment 或短消息里提示 Storyline。只有当用户正在输入的内容被 LLM 判定为“要准备较长表达材料”时才提示，例如：

- 用户正在写“帮我准备给团队的 AI 工具分享提纲”。
- 当前页面是 ChatGPT / 豆包 / Claude / Google Docs，输入框内容要求整理复盘、speaker notes、Slides outline 或培训材料。
- 当前页面上下文能召回至少 2 类 evidence cluster。

Compose Assist 的 UI 也不应该直接展开 Storyline 卡片，而是显示一个 secondary action：

```text
Personal AI 可以先生成故事线，再交给当前 AI 润色。
[生成故事线草稿] [只插入普通上下文]
```

这里的判定同样走 `StorylineOpportunity`，但输入上下文换成当前 draft、页面标题、选中文本、可见线程和 context recall evidence。普通“帮我回复这句话”仍由 Compose Assist 处理，不进入 Storyline。

### 1.3 其他入口如何融合

| 入口 | 是否 P0 | 触发方式 | UI 形态 |
|---|---:|---|---|
| Today Pilot / 会前准备 | 是 | meeting prep LLM 生成 `storylineOpportunity` | 会前准备卡片内条幅 |
| RingCentral Video Home 日历详情 | 是 | 消费 Today Pilot meeting prep cache | 同一条幅，不单独判定 |
| Meeting Pilot 会中 | 否 | 只消费已有 handoff，不现场生成 | 可显示“会后整理复盘故事线”作为会后入口 |
| Compose Assist | P1 | LLM intent 判定当前 draft 是长表达准备 | 输入框旁 secondary action |
| Google Slides Analyzer | P1 | 用户打开/分析 deck 后，LLM 判断需要 personal evidence story | 分析结果页按钮：补个人证据故事线 |
| Source Memory Distiller | P1 | 用户保存资料胶囊时选择“用于某次分享/汇报” | capsule 详情中的 action |
| Memory Lens | P2 | 当前页面强相关且用户打开 expanded card | action：把这些记忆加入某条故事线 |
| Ask | P1 | 用户直接问“帮我准备分享/复盘/汇报” | Ask 结果返回 Storyline draft offer |

## 文档归属建议

如果 P0 只做“会前准备内的生成提示”，实现后的 feature 文档不应该先新建独立 `docs/features/memory_storyline_builder.md`。正确归属是：

- 主文档：[`docs/features/today_pilot.md`](../features/today_pilot.md) 的 `会前准备 / Storyline 生成提示` 小节。
- features 索引：在 `Today Pilot` 下新增小功能点 `Storyline 生成提示`。
- 规划文档：继续保留本文件，直到它从 P0 提示演进为真正独立能力。

只有当 Storyline 具备以下任一条件时，才值得迁入独立 feature 文档：

- 有独立页面，例如 `memory-exploring.html#/storylines`。
- 有独立后端 route，例如 `/api/v1/storylines/*`，并能管理草稿、artifact、feedback。
- 有多 surface 共同消费的 Storyline 数据模型，而不再只是 Today Pilot 的衍生按钮。
- 有独立验证脚本或 E2E 覆盖 Storyline draft/edit/export。

到那时再创建 `docs/features/memory_storyline_builder.md`，并在 `today_pilot.md`、`compose_assist.md`、`google_slides_analyzer.md` 中只保留各自入口如何调用 Storyline。


### 2. 默认给一个可以立刻讲的结构

不要只列资料。用户打开后应该直接看到：

- 标题：这次讲什么。
- 开场钩子：为什么现在讲。
- 三个真实案例：每个案例都有场景、动作、结果、限制。
- 可复制清单：听众能照着做什么。
- Q&A 预判：听众可能问什么，哪些需要承认不确定。

### 3. 所有段落都有证据和边界

每个 story segment 右侧都要显示：

- 证据来源：消息、会议、Jira、资料、AI 对话、operation episode、skill。
- 证据状态：confirmed / inferred / stale / private / low coverage。
- 外发表达建议：可公开讲、内部可讲、只给自己看、需要打码。
- 缺口：缺少数字、缺少 outcome、缺少对方确认、只是一条聊天提到。

### 4. 用户编辑就是反馈

用户删掉一个案例、换一个证据、把“Codex 提效很多”改成“某些场景很有效但要配 harness”，系统要学习：

- 哪类案例更适合这个受众。
- 用户喜欢的表达密度和诚实程度。
- 哪些来源不适合外发。
- 哪些个人经验可以沉淀成 skill 或 future rehearsal。

不要弹校准问卷；记录最小必要 diff 和 evidence selection。

### 5. 输出要和工具生态兼容

Storyline Builder 不直接做所有形式。它应该输出结构化 artifact：

- Google Slides outline + speaker notes。
- Gamma / PowerPoint prompt。
- NotebookLM source bundle 说明。
- Google Vids / screen-recording script。
- ChatGPT / 豆包 / Claude prompt。
- Internal wiki / RingCentral post draft。
- Context Passport for external AI refinement。

## 产品形态

### 信息架构

建议放在 Memory Exploring / Day Pilot 体系里，不做一级大而全入口。

推荐入口：

1. `Today Pilot` / Day Pilot mission card：`准备 AI 工具分享故事线`。
2. `Calendar event detail`：识别 sharing / workshop / presentation / review / course。
3. `Source Memory Distiller` capsule：用户点 `用于某次分享`。
4. `Flight Recorder episode`：用户点 `做成案例`。
5. `Google Slides Analyzer` 结果页：用户点 `补一段 Personal AI 证据故事`。
6. `Ask`：用户问“帮我准备关于 X 的分享”时返回 `storyline draft` block。

### 核心界面

界面分三列：

1. **左侧：场景和素材**
   - 目标事件：标题、日期、受众、时长、输出目标。
   - 素材 cluster：AI 工具实践、Codex/Cursor 讨论、NotebookLM/Google AI Studio 资料、Jira 自动化案例、OpenClaw/skill 经验。
   - Coverage：每个 cluster 的证据数、最近更新时间、风险。

2. **中间：故事线 canvas**
   - Hook。
   - Scene 1：真实问题。
   - Scene 2：尝试和分叉。
   - Scene 3：结果和限制。
   - Takeaways。
   - Playbook。
   - Q&A。
   - 每段可重排、折叠、替换证据、改语气。

3. **右侧：证据和导出**
   - 当前段落的 evidence list。
   - 缺口/冲突/敏感提醒。
   - 导出格式选择。
   - 生成 speaker notes / prompt / slides outline。

## Demo 说明

Demo 模拟一个真实工作场景：

- 用户即将准备 `CoP - 基于AI的个人发展和工具` 分享。
- Personal AI 从日历、AI 工具群、Cursor workshop、NotebookLM/Google AI Studio refresh、OpenClaw skill、Codex/Jira 讨论里整理素材。
- 中间生成一条 7 段故事线。
- 右侧显示当前段落证据、缺口和导出方式。

Demo 文件：[`memory-storyline-builder-demo.html`](./memory-storyline-builder-demo.html)。

## 具体用户场景

### 场景 1：准备 6/4 AI CoP 分享

用户打开 Day Pilot，看到一张 mission：

> `CoP - 基于AI的个人发展和工具` 还有 10 天。你有 4 类可讲素材：Codex/Jira 自动化、Cursor workshop、NotebookLM/Gemini 资料理解、OpenClaw skill 沉淀。

用户点击 `生成故事线` 后，Personal AI 给出：

- 标题：`从“试用 AI”到“把 AI 纳入日常工作流”`。
- 开场：最近公司从 Cursor、Claude、Codex 到 Google AI Studio 都在密集更新，问题不再是“用不用”，而是“怎么可靠复用”。
- 案例 1：Codex 帮忙修 bug 或分析 Jira，但需要 harness 和证据边界。
- 案例 2：NotebookLM/Gemini 适合资料理解，但要把 source capsule 留在 Personal AI 里，方便未来场景召回。
- 案例 3：OpenClaw skill 可以把重复流程沉淀成个人技能，但平台能力和外发边界要讲清。
- 可复制清单：`明确任务边界 -> 让 AI 先跑 -> 要证据 -> 把成功流程沉淀为 skill -> 下次由 Day Pilot/Lens 触发`。

用户删掉一个公司内部敏感例子，改成匿名版。系统保存这次编辑偏好：AI 工具分享更偏“方法论 + 可复制步骤”，少讲内部 ticket 细节。

### 场景 2：给项目组做一次 AI bug 修复复盘

日历里有 `Bug - AI 先修一遍我再看`。用户需要讲清楚为什么这个流程有效、哪里还需要人 review。

Storyline Builder 自动组织：

- 当时输入给 AI 的约束是什么。
- Codex/OpenClaw 做了哪些尝试。
- 哪些步骤失败或缺 source anchor。
- 人类最终检查了什么。
- 下次可以变成哪个 Skill Foundry workflow。

最后导出成：

- 5 页 Slides outline。
- 一段 RingCentral 发给同事的复盘短文。
- 一个 `AI first-pass bug fix` skill 候选。

用户真正体验到的是：**不是又让 AI 写一篇泛泛文章，而是 Personal AI 能把“我具体经历过的事”变成可讲、可教、可复用的经验。**

## 数据模型草案

### Storyline Project

```ts
interface StorylineProject {
  id: string;
  userId: string;
  title: string;
  purpose: 'sharing' | 'status_report' | 'training' | 'retro' | 'proposal' | 'weekly_update';
  trigger:
    | { kind: 'calendar_event'; eventId: string }
    | { kind: 'day_pilot_card'; cardId: string }
    | { kind: 'source_capsule'; capsuleId: string }
    | { kind: 'flight_episode'; episodeId: string }
    | { kind: 'manual'; query: string };
  audience: StorylineAudience;
  constraints: StorylineConstraints;
  coverage: StorylineCoverage;
  segments: StorylineSegment[];
  artifactDrafts: StorylineArtifactDraft[];
  state: 'draft' | 'reviewed' | 'exported' | 'archived';
  createdAt: number;
  updatedAt: number;
}
```

### Audience

```ts
interface StorylineAudience {
  label: string; // e.g. Scrum Masters, AI CoP, project leads
  familiarity: 'low' | 'medium' | 'high';
  language: 'zh-CN' | 'en-US' | 'mixed';
  tone: 'practical' | 'executive' | 'teaching' | 'technical' | 'casual';
  timeBudgetMinutes: number;
  expectedOutcome:
    | 'inform'
    | 'teach'
    | 'align'
    | 'convince'
    | 'handoff'
    | 'document';
}
```

### Segment

```ts
interface StorylineSegment {
  id: string;
  role:
    | 'hook'
    | 'context'
    | 'case'
    | 'turning_point'
    | 'takeaway'
    | 'playbook'
    | 'risk'
    | 'qa';
  title: string;
  draftText: string;
  speakerNote?: string;
  evidenceRefs: StorylineEvidenceRef[];
  confidence: number;
  boundary: 'public_ok' | 'internal_only' | 'private_only' | 'needs_redaction';
  gaps: StorylineGap[];
  userEdits?: StorylineEditSignal[];
}
```

### Evidence Ref

```ts
interface StorylineEvidenceRef {
  sourceKind:
    | 'message'
    | 'meeting'
    | 'calendar'
    | 'jira'
    | 'ai_chat'
    | 'source_capsule'
    | 'flight_episode'
    | 'skill'
    | 'relationship_card'
    | 'decision';
  sourceId: string;
  sourceTitle: string;
  timestamp?: number;
  quote?: string;
  summary: string;
  trust: 'confirmed' | 'inferred' | 'stale' | 'low_coverage';
  sendability: 'shareable' | 'internal' | 'sensitive' | 'no_export';
}
```

### Artifact Draft

```ts
interface StorylineArtifactDraft {
  id: string;
  target:
    | 'google_slides_outline'
    | 'speaker_notes'
    | 'ringcentral_post'
    | 'google_docs_brief'
    | 'gamma_prompt'
    | 'notebooklm_source_guide'
    | 'google_vids_script'
    | 'context_passport';
  title: string;
  body: string;
  evidencePolicy: 'include_refs' | 'summary_only' | 'redacted' | 'none';
  generatedAt: number;
}
```

## 生成逻辑

### Step 1：识别目标场景

输入可以来自：

- calendar event title/description/attendees。
- Day Pilot mission。
- Ask query。
- 当前网页标题和输入框内容。
- 用户手动选择的 source capsule / operation episode / skill。

系统判断：

- 这是分享、汇报、培训、复盘、proposal 还是周报？
- 受众是谁？
- 时间预算是多少？
- 是否需要 slides、speaker notes、聊天短文还是外部 AI prompt？
- 是否有敏感/内部信息限制？

### Step 2：召回素材 cluster

召回不能只按 query similarity。建议组合：

- calendar event anchors：标题、时间、organizer、attendees、linked docs。
- topic anchors：AI tools、Codex、Cursor、NotebookLM、Jira、OpenClaw、Google AI Studio。
- episode anchors：最近做过的操作记录、AI 修 bug、Jira 数据分析、slides/report 生成。
- source capsule anchors：Distiller 保存的资料 takeaways。
- skill anchors：已安装或建议中的 skill，如 `CapDev 每月数据`、`Webinar Release Tracker`、`huashu-design`。
- relationship anchors：受众里的人或团队最近关心什么。
- freshness anchors：资料是否过期、事件是否临近。

### Step 3：构建故事骨架

推荐默认模板：

1. `Why now`：为什么这次值得讲。
2. `What changed`：外部产品/团队场景发生什么变化。
3. `Personal episode`：用户真实遇到的问题。
4. `Tried path`：AI / 工具 / 人的协作过程。
5. `Outcome`：节省时间、发现问题、失败教训或决策影响。
6. `Repeatable pattern`：别人可以怎么复制。
7. `Limits and next step`：不夸大，说明风险和下一步。

### Step 4：证据和风险标注

每段必须经过 boundary pass：

- 没有证据的强说法降级为 `个人观察 / 可以表达为假设`。
- 内部 Jira、meeting URL、1:1 私聊、人员评价默认 `internal_only` 或 `needs_redaction`。
- 来源过期时加 `截至当时`。
- 来自 AI 输出但未验证的内容不能当事实。
- 如果是公司内部分享，允许内部项目名但仍避免 token、meeting join URL、私聊原文。

### Step 5：导出

导出不是一次性覆盖，而是生成草稿：

- `Google Slides outline`：标题、每页 bullets、speaker notes、evidence refs。
- `Speaker notes`：适合照着讲的中文稿。
- `RingCentral post`：短消息版本，含 TL;DR 和 next step。
- `Gamma prompt`：给 Gamma 的结构化 prompt，包含受众、时长、风格、段落。
- `NotebookLM source guide`：告诉用户要把哪些 sources 放进 NotebookLM，以及 steering prompt。
- `Google Vids script`：视频脚本、镜头/屏幕录制清单。
- `Context Passport`：给外部 AI 做视觉润色或英文改写，但不包含敏感证据原文。

## API 草案

### 创建故事线草稿

`POST /api/v1/storylines/draft`

```json
{
  "trigger": {
    "kind": "calendar_event",
    "eventId": "calendar:cop-ai-personal-growth-2026-06-04"
  },
  "purpose": "sharing",
  "audience": {
    "label": "AI CoP",
    "language": "zh-CN",
    "tone": "practical",
    "timeBudgetMinutes": 8,
    "expectedOutcome": "teach"
  },
  "constraints": {
    "includeInternalExamples": true,
    "exportTarget": "google_slides_outline",
    "avoidPrivateMessages": true
  }
}
```

返回：

```json
{
  "projectId": "story_01",
  "title": "从试用 AI 到可复用工作流",
  "coverage": {
    "sourceClusters": 5,
    "evidenceCount": 18,
    "lowCoverageSegments": 1,
    "sensitiveRefs": 3
  },
  "segments": [],
  "nextActions": [
    {
      "kind": "review_gap",
      "label": "补充一个可公开讲的 outcome 数字"
    },
    {
      "kind": "export",
      "label": "生成 Google Slides outline"
    }
  ]
}
```

### 更新段落

`PATCH /api/v1/storylines/:id/segments/:segmentId`

用途：

- 用户编辑文本。
- 替换证据。
- 改 boundary。
- 删除 segment。
- 标记“这个例子不要再用于此类受众”。

### 生成导出草稿

`POST /api/v1/storylines/:id/artifacts`

```json
{
  "target": "google_slides_outline",
  "evidencePolicy": "include_refs",
  "style": {
    "slideCount": 6,
    "density": "medium",
    "language": "zh-CN"
  }
}
```

### 记录自然反馈

`POST /api/v1/storylines/:id/feedback`

```json
{
  "event": "segment_deleted",
  "segmentId": "case_internal_ticket",
  "reason": "too_sensitive",
  "implicit": true
}
```

## 存储草案

新增表：

- `storyline_projects`
- `storyline_segments`
- `storyline_evidence_refs`
- `storyline_artifacts`
- `storyline_feedback_events`

不要复制大量原文；只保存 source refs、hash、短摘要、boundary、用户编辑后的草稿。

## 与现有模块集成

### Day Pilot

Day Pilot 发现分享/汇报事件时生成 story mission：

> `6/4 CoP 需要 AI 工具分享材料；已有 4 类素材可编排。`

点击进入 Storyline Builder。

### Source Memory Distiller

Distiller 的 capsules 作为高质量资料输入：

- takeaways。
- source anchors。
- future triggers。
- sendability。

Storyline Builder 不重新做资料阅读。

### Operation Memory Flight Recorder

Flight Recorder episodes 可以变成“案例段落”：

- 问题。
- 操作路径。
- 分叉。
- 结果。
- 可复制步骤。

### Personal Skill Foundry

当 story 中出现重复模式，右侧提示：

> 这段可沉淀为 `AI first-pass bug fix` skill 候选。

但不自动创建 active skill。

### Memory Coverage Map

如果某个来源 stale/failing，Storyline Builder 的证据 coverage 要显示：

- `Google Slides source stale`。
- `RingCentral IndexedDB last sync 3 days ago`。
- `NotebookLM dump not imported`。

### Google Slides Analyzer

Storyline Builder 可以把 outline 和 speaker notes 交给 Slides 写作/分析链路，但不直接批量覆盖当前 deck。用户应该先预览。

### Context Passport / Compose Assist

如果用户要拿故事线去 ChatGPT/Gamma/NotebookLM/Gemini 继续润色：

- 生成一个 `storyline_context_passport`。
- 只包含 summary/evidence refs，不带敏感原文。
- 由用户复制或插入，不自动发送。

## 可落地实施方案

### Slice 1：Today Pilot meeting prep LLM 输出扩展

修改点：

- `memory-service/src/core/TodayPilotMeetingPrepService.ts`
  - 扩展 `TodayPilotMeetingPrepLlmResponse`，增加 `storylineOpportunity?: StorylineOpportunity`。
  - `buildLlmPrompt()` 增加一段判定任务：只基于提供的日历和 evidence 判断是否值得展示 Storyline 按钮。
  - `normalizeLlmResponse()` 校验 opportunity：低 confidence、无 evidence cluster、blocked reasons 过多时强制 `available=false`。
- `memory-service/src/types/index.ts`
  - 增加共享类型，供 Today Pilot API 和前端消费。
- `today_meeting_preps` 存储
  - P0 可先把 opportunity 放进现有 `llm_usage_json` 或新增 `metadata_json`；如果要长期稳定查询，再补 migration 增加 `storyline_opportunity_json`。

LLM prompt 需要明确：

```text
Do not generate a storyline.
Only decide whether the UI should show a small button that lets the user generate one.
Return available=false unless the meeting likely requires a share/report/retro/training/proposal/weekly-update artifact and the evidence can support at least 3 story segments.
```

### Slice 2：Today Pilot / Video Home 注入 UI

修改点：

- `src/contentScriptRingCentralVideoHome.ts`
  - 在 meeting prep summary 和 cue cards 之间渲染 `storylineOpportunity` 条幅。
  - 只在 `available=true` 且 `prepCurrent=true` 时展示。
  - 按钮点击发送 runtime message，例如 `STORYLINE_DRAFT_CREATE_REQUEST`；如果后端 draft API 未实现，P0 也可以先打开 Memory Exploring 的 Storyline preview route 或记录 toast。
  - `不需要` 写 Today Pilot feedback，action 可先用 `wrong`/`mute` 扩展 reason，后续再独立 `storyline_dismissed`。

条幅必须小于普通 cue card：

- 一行标题：`这场会可能需要一条故事线`。
- 一行原因：LLM 输出的 `oneLineReason`。
- 2-4 个 evidence cluster chip。
- 主按钮 + `不需要`。

### Slice 3：Storyline draft API 最小闭环

如果 P0 只评审提示，可以先不做；如果要完整点击生成，需要增加：

- `POST /api/v1/storylines/draft`
- 输入：
  - `sourceKind='today_meeting_prep'`
  - `prepId`
  - `artifactTarget`
  - `version='internal' | 'public' | 'private'`
- 输出：
  - 5-7 个 story segments。
  - evidence refs。
  - redaction warnings。
  - speaker notes / slides outline draft。

P0 不需要先做独立数据库表；可以用 deterministic response + optional in-memory/front-end preview。真正要保存草稿历史时，再引入 `storyline_projects` 等表。

### Slice 4：Compose Assist 后续接入

等 Today Pilot P0 验证提示体验后，再接 Compose Assist：

- `ComposerAssistService` 在生成普通建议前或后，基于 draft/page/evidence 调用同一套 opportunity classifier。
- 只有 `storyType` 明确且 `suggestedArtifact` 不是短回复时显示 secondary action。
- 点击后走同一个 `POST /api/v1/storylines/draft`，sourceKind 为 `compose_assist`，并保留当前 draft 作为 user intent evidence。

### Slice 5：验证

建议新增验证脚本：

- `tools/verify-storyline-opportunity.ts`
  - AI CoP / workshop 类 meeting prep 返回 `available=true`。
  - 普通 daily sync 返回 `available=false`。
  - 私聊证据过多时返回 `available=false` 或 `blockedReasons`。
  - evidenceClusters 少于 2 类时不展示。
- `tools/verify-storyline-opportunity-e2e.mjs`
  - mock Today Pilot meeting prep API。
  - Video Home 注入条幅显示。
  - `不需要` 后条幅消失并发送 feedback。
  - 点击生成按钮不会自动外发，只进入 draft flow / toast。

## MVP 范围

### P0：Today Pilot 会前准备内的 Storyline 提示

目标：先服务“即将分享/汇报”的真实高频场景，但第一步只做**提示机会**，不后台生成完整故事线。

范围：

- Today Pilot meeting prep nightly/backfill 读取 calendar + messages_raw + chunks + source capsules + skills。
- meeting prep LLM 同时输出 `storylineOpportunity`。
- 会前准备卡片内展示小条幅和生成按钮。
- 用户点击后才进入 draft flow；未点击前不生成 story segments。
- P0 可先只验证提示和点击流；如果要闭环，可生成 5-7 段 story segments 的临时预览。
- 不做真实 Google Slides 写回。
- 不做自动发布。

验收：

- `CoP - 基于AI的个人发展和工具` meeting prep 能显示 `生成 8 分钟分享故事线`。
- 普通 daily sync / 周会没有足够表达意图时不显示 Storyline 条幅。
- 条幅展示 LLM 的 one-line reason 和 evidence cluster，不展示“命中关键词”。
- 点击生成按钮不会自动发给外部 AI，也不会写 Google Slides。
- 私聊/meeting URL/Jira 内部链接不会直接进入条幅原因或公开版 artifact。

### P1：Artifact export + source bundle

- 支持 Gamma prompt、NotebookLM source guide、Google Vids script。
- 支持从 Source Memory Distiller capsule 选择资料。
- 支持从 Flight Recorder episode 生成案例段。
- 支持“公开版 / 内部版 / 自用版”三种输出。

### P2：自然反馈学习

- 从用户编辑后的 speaker notes 学习：
  - 受众偏好。
  - 过度细节删除。
  - 更适合公开讲的例子。
  - 用户喜欢的开场/结尾风格。
- 写入轻量 `storyline_feedback_events`，供 Ambient Recall Calibration 读取。

### P3：多模态输出辅助

- 对接 Google Slides Analyzer/creator。
- 可生成 demo recording checklist。
- 可导出给 Google Vids 或外部视频工具。
- 支持 Storyline rehearsal：用户讲一遍后保存“哪些讲法有效”。

## UX 细节

### Story segment 卡片

每个卡片显示：

- 段落角色：Hook / Case / Takeaway / Q&A。
- 一句话标题。
- 生成的讲稿草稿。
- evidence count。
- boundary chip。
- gap chip。
- 操作：替换证据、缩短、改正式、移除、做成 slide。

### Evidence drawer

只展示短摘要，不直接展示大量聊天原文。

字段：

- source kind。
- group/channel。
- person。
- timestamp。
- why relevant。
- sendability。
- open source link if available。

### Gap prompt

缺口提示要短：

- `缺少 outcome 数字：可手动补“节省约多少时间”`。
- `这段来自私聊：公开版会改成匿名描述`。
- `这个产品资料可能已更新：建议先过 Freshness Radar`。

### Export preview

导出前必须显示：

- 版本：公开版 / 内部版 / 自用版。
- 将包含哪些 source refs。
- 删除/打码了什么。
- 目标工具：Slides / Gamma / NotebookLM / Vids / ChatGPT。

## 质量评估

### 自动检查

- 每个 segment 是否有 `role/title/draftText/evidenceRefs/boundary`。
- 不允许直接导出 meeting join URL、token-like 字符串、1:1 私聊原文。
- `public_ok` artifact 不包含 internal Jira URL。
- `low_coverage` segment 数量超过阈值时显示 warning。
- 导出稿和 canvas segment 数保持一致。

### 人工/回归样本

建立 5 个 golden scenarios：

1. AI CoP 分享。
2. Bug - AI 先修一遍我再看。
3. Jira 数据分析复盘。
4. Cursor/Codex 工具选型分享。
5. NotebookLM/Gemini 资料学习汇报。

每个样本评估：

- 主题是否聚焦。
- 是否选择了真实可讲例子。
- 是否没有混入无关 AI 新闻。
- 是否能区分事实、经验、观点。
- 是否能生成可直接拿去改的 speaker notes。

## 主要风险

| 风险 | 表现 | 缓解 |
|---|---|---|
| 变成泛 PPT 生成器 | 用户只看到漂亮标题，没有真实证据 | 每段强制 evidence/gap/boundary；导出先文本 outline |
| 和 Source Distiller 重复 | 都能生成分享 brief | Distiller 只处理资料；Storyline 处理多源个人经历和受众叙事 |
| 过度外发敏感信息 | 把内部 Jira/私聊/meeting URL 放进公开稿 | 三种 artifact 版本 + boundary preflight |
| 幻觉式个人经历 | AI 编造用户没做过的事 | 没 evidence 的段落只能标 low coverage，不写成事实 |
| UI 太重 | 用户不想维护一个写作项目 | 只从真实事件触发，默认 5-7 段，一键导出文本 |
| 记忆召回噪音 | 混进泛 AI 工具新闻 | 使用 calendar/topic/source/person/time anchors；弱相关素材进候选不进故事线 |

## 为什么这个功能有亮点

1. **它把“记住”推进到“会讲述”**：用户不只是能搜索过去，还能把过去变成可传递的经验。
2. **它贴近用户真实工作**：Scrum Master、AI 工具分享、workshop、weekly review、项目复盘都需要这种能力。
3. **它复用已有记忆资产**：Day Pilot、Source Distiller、Flight Recorder、Skill Foundry、Relationship Radar、Context Passport 都能作为输入或输出。
4. **它不和成熟工具正面竞争**：Gamma/Google Vids/NotebookLM 负责生成媒体和排版，Personal AI 负责个人证据和故事结构。
5. **它能产生长期学习收益**：用户编辑故事线，会反向告诉系统哪些记忆真的可讲、哪些例子有价值、哪些表达更适合某类受众。

## 决策建议

推荐进入设计评审，但不要立刻做大范围实现。

建议先做一个很窄的 P0：

- 只支持 `calendar event -> story draft -> speaker notes / slides outline`。
- 只读真实记忆，不写外部系统。
- 先用 `CoP - 基于AI的个人发展和工具` / `Sharing` / `Bug - AI 先修一遍我再看` 做 3 个体验样本。

如果 P0 能做到“用户愿意拿生成稿作为分享底稿继续改”，这个能力就值得推进。否则它会退化成又一个泛写作工具，不应该做。
