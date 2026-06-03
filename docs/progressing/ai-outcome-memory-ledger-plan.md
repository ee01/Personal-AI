# 新能力：AI Outcome Memory Ledger / AI 成效记忆账本（Ambient Calibration P1）

> 生成日期：2026-05-31 CST
> 定位修正：2026-06-02 CST
> Codex 会话标题建议：新能力：AI 成效记忆账本
> Demo：[`ai-outcome-memory-ledger-demo.html`](./ai-outcome-memory-ledger-demo.html)
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有可随机选择或标记完成的全新功能 idea。本方案来自真实 `esone.qiu` 记忆抽样、`docs/progressing` 去重和 2026 年 AI eval / feedback / agent memory 资料。

## 结论

建议设计一个新能力：**AI Outcome Memory Ledger / AI 成效记忆账本**。但它的定位需要修正清楚：

> 它不是另一个 feedback 系统，也不是替代 Compose Assist / Memory Lens 的独立打分入口。它是现有 **Ambient Calibration / 无感记忆校准层** 的 P1 聚合与可见化能力，把已经发生在真实页面里的插入、发送、改写、删除、thumb-down、done、ignore、copy、confirm 等自然动作，整理成可追溯的 outcome receipt，并反哺下一次召回、生成、skill patch 和 eval seed。

一句话：

> Personal AI 不只记住“AI 当时输出了什么”，还要记住“用户最后有没有采用、改了哪里、为什么改、这个结果有没有在真实工作中生效”；其中原始反馈仍由 `ambient_calibration_traces`、`/feedback`、`/rehearsals/:id/feedback` 等已有入口写入，成效账本负责把这些信号合成长期学习对象。

它要解决的不是“再做一个 trace 平台”，而是用户真实使用 AI 时最缺的一层私人闭环：

- AI 先跑一遍以后，用户通常还会修改、删掉、补证据、转发、发布到 Jira / RingCentral / Docs。
- 现在 Personal AI 能保存原始消息、网页、AI 对话、source memory、ambient calibration trace，但缺少一个用户可见的“这次 AI 帮忙到底有没有用”的长期账本。
- 没有成效记忆，系统只能知道用户看过什么、插入过什么、问过什么，却很难学习哪些上下文、skill、工具路线、输出格式真的减少了返工。

推荐 MVP 做成“轻量回执 + 成效账本 + 自动沉淀 eval/skill patch”，不要做成需要用户每天手工打分的后台。

## 2026-06-02 定位修正：这是现有无感反馈的扩展

用户指出得对：Compose Assist 已经能知道“用户插入了建议、后来大改、最后发送了”，Memory Lens 也已经有 thumb up/down。这意味着本方案不能被描述成“Personal AI 首次拥有 feedback”。更准确的边界是：

- **已有层：无感反馈采集。** Compose Assist、Memory Lens、Rehearsal、Today Pilot、Meeting Pilot、Memory Capture 等 surface 已经或应该把自然动作写入各自反馈入口。
- **新增层：outcome receipt 聚合。** 成效账本把同一次 AI 输出的多条低层 trace 合成一张“结果回执”，回答“这次 AI 产物最后怎么样”。
- **新增层：长期学习编排。** 多张 receipt 再聚合成 pattern，驱动 recall weight、写作风格记忆、prompt constraint、skill patch、eval seed。单次 diff 不直接覆盖 confirmed profile；稳定偏好应该进入可迁移的用户写作画像，并保留证据、scope、置信度和衰减策略。
- **用户体验边界：不增加日常 review 成本。** 用户只有在高学习价值、高风险或系统需要解释长期改变时，才看到很小的确认卡；普通采用、轻微编辑、忽略都应静默进入校准。

因此这个 plan 的 MVP 不应优先新建一套 raw feedback endpoint。P0 应先复用：

- `POST /api/v1/ambient-calibration/traces`
- `POST /feedback`
- `POST /api/v1/rehearsals/:id/feedback`
- 未来各 surface 的 `source_memory_events`、Today Pilot card feedback、Meeting action item feedback

`ai_outcome_receipts` 可以是物化聚合表，也可以先是查询层视图。只有 UI、eval seed、skill patch 需要稳定引用一条 outcome 时，才把它落成 receipt。

## 为什么值得做

Personal AI 的目标是保存用户和 AI、网页、会议、消息、操作、偏好、skill、其他平台 AI 对话等全部记忆，并在真实场景里提示相关记忆。现在系统已经在做很多“输入侧”和“召回侧”的事情：

- 保存网页、会议、Jira、RingCentral、Google Docs、AI 对话。
- 用 Memory Lens / Compose Assist / Today Pilot / Ask 把记忆带回当前场景。
- 用 Ambient Calibration 记录插入、改写、发送、thumb-down 等脱敏 trace。
- 用 Personal Skill Foundry 管理个人 skill 真源和平台同步。
- 用 Relevance Trainer 把召回错误变成 eval case。

但真实用户体验里还有一个空位：**输出后的结果是否真的变成价值**。

用户的日常信号很明确：

- 多次日历和消息里出现“凡事先让 AI 跑一遍”“Bug - AI 先修一遍我再看”。
- Story Points estimation 真实工作里，用户拿 AI 估算结果和人工估点 diff 最大的 5 张票反看 skill 设计，发现有些差异来自“ticket 中技术细节未展开，开发人员私下已沟通细节”，有些来自 leftover 难以识别。这正是 outcome feedback。
- 近期 Jira `MTR-141911` 上出现多条 `Esone's AI: I will help...` 的字段写回评论，说明 AI 已经在帮助生成可发布的工作结果，但系统需要知道这些结果最后是否正确、是否被用户改过、是否造成重复/噪声。
- WhatsApp / Channel Adapter 讨论里，用户让 AI 合并多个 RingCentral 群信息后输出 David / Barry 的需求点。这类 output 是否被采用、是否缺漏，是未来召回和 skill 改进的高价值反馈。
- 当前有 50 个 pending confirm requests，其中多条围绕 BE readiness 的重复确认，说明系统已经能提出确认，但缺少把“用户最后怎么处理这些 AI 结论”压缩成长期学习信号的统一层。

如果不做成效记忆，Personal AI 会越来越像一个“很会保存资料的系统”；做了之后，它才会逐步知道：

- 哪类 AI 建议用户会直接采用。
- 哪类建议必须先补证据。
- 哪些 skill 在真实任务里反复被修改。
- 哪些工具/模型/上下文包在某类任务里经常失败。
- 哪些用户编辑习惯应该变成下次输出约束。
- 哪些语言习惯能迁移到未来不同 compose 场景，让输出更像“用户本人会写的话”，而不是只在同一个 issue / 同一个问题里生效。

这比简单 thumbs-up/down 更有价值，因为它连接的是**工作结果**，不是单次主观评价。

## 已有能力避让

| 已有方向 | 解决什么 | 本方案边界 |
| --- | --- | --- |
| Ambient Calibration / 无感记忆校准层 | 记录插入、改写、发送、hover 未用等脱敏行为 trace | 成效账本消费这些 trace，但提供用户可见的 outcome receipt、结果分类、影响范围和长期学习对象 |
| Compose Assist | 生成可插入/可发送草稿，并记录插入反馈 | 成效账本不生成草稿，只追踪草稿被采用、编辑、拒绝和后续效果 |
| Memory Relevance Trainer | 召回不相关时生成 scene-aware patch + eval case | 成效账本覆盖所有 AI 输出成效，不只召回错误；其中召回错误仍交给 Trainer |
| Personal Skill Foundry | 管理个人技能真源、平台绑定、同步状态 | 成效账本不管理 skill；它把“某次 skill 输出被大改/成功采用”转成 skill patch 建议 |
| Operation Memory Flight Recorder | 保存操作 episode 和可复用流程 | 成效账本关注 AI 输出的最终成效，不保存完整操作录像；可引用 episode 作为证据 |
| Artifact Memory Lineage（搁置） | 解释成果物从哪些来源产生 | Lineage 回答“从哪里来”；Outcome Ledger 回答“有没有用、被怎么改、以后怎么改进” |
| AI Tool Compass（搁置） | 推荐当前任务用哪个 AI 工具 | 成效账本不推荐工具；它给未来工具选择提供历史成功/失败信号 |
| Answer Memory Tracker | 追踪反复问的问题当前答案 | 成效账本追踪 AI 输出的采用结果；反复问题的答案是否被用户接受可写入 Answer Tracker |
| Agent Workflow / Agent Thinking trace | 展示 Personal AI 内部 agent 判断链路 | 成效账本面向用户跨工具 AI 输出，包括 ChatGPT/Gemini/Codex/RingCentral/Jira/Docs，不局限内部 agent trace |

最重要的边界：**本功能的主对象是“AI 输出成效 receipt”，不是“原始 trace 平台”或“新一套 skill 系统”。**

## 竞品与行业观察

### OpenAI Agent evals / trace grading

OpenAI 的 Agent evals 文档把 traces、graders、datasets、eval runs 作为改进 agent quality 的核心工具；trace grading 用于检查工具选择、handoff、instruction / safety policy 违规和 prompt/routing 改动效果。

对 Personal AI 的启发：

- trace 不是为了好看，而是为了把失败定位成可复跑、可比较的样本。
- Personal AI 不需要照搬企业 eval dashboard；它需要把用户真实操作后的结果转成私人 eval seed。
- 对用户来说，最自然的反馈不是去打分页面，而是在发布、发送、复制、修改、撤销的时刻自动生成 receipt。

参考：

- <https://developers.openai.com/api/docs/guides/agent-evals>
- <https://developers.openai.com/api/docs/guides/trace-grading>

### LangSmith / Langfuse / Humanloop / Braintrust

LangSmith 支持把用户反馈挂到 trace 或 child run 上；Langfuse 把 human annotation、LLM judge、programmatic check、end-user feedback 都统一为 score；Humanloop 把 evaluator 用于在线监控和离线评测；Braintrust 强调把生产失败变成永久 eval case，并在 trace 的各步骤上附反馈。

这些产品共同说明一件事：

> 真正成熟的 AI 系统不会只保存对话。它会保存输入、输出、trace、反馈、评测和回归样本。

Personal AI 的机会是：把这套企业级 AI observability 语言翻译成个人用户能接受的 UX。

- 不要求用户懂 trace / score / evaluator。
- 不要求每次都手工评价。
- 默认从“编辑幅度、是否发送、是否撤销、是否再次追问、是否生成 downstream artifact”推断成效。
- 用户只在有高价值学习时确认一张很小的卡。

参考：

- LangSmith user feedback：<https://docs.langchain.com/langsmith/attach-user-feedback>
- Langfuse Scores：<https://langfuse.com/docs/evaluation/scores/overview>
- Humanloop Evaluators：<https://humanloop.com/docs/explanation/evaluators>
- Braintrust human-in-the-loop eval platforms：<https://www.braintrust.dev/articles/best-human-in-the-loop-llm-evaluation-platforms-2026>

### Anthropic Claude Code 质量事件的启发

2026 年 5 月 InfoQ 总结 Anthropic Claude Code 质量投诉调查：多个产品层改动叠加导致用户感知质量下降，内部 eval 和 dogfooding 没能提前捕获。文章中特别提到，自动化场景中的质量下降可能比交互式场景更难发现。

对 Personal AI 的启发：

- 用户会同时用 Codex、Claude Code、Cursor、Gemini、OpenClaw 等工具，但工具质量、系统 prompt、默认 reasoning、缓存策略会变化。
- 如果 Personal AI 只记“我用过 Claude/Codex”，无法判断“最近某工具在我这里的结果变差了”。
- 成效账本可以从用户的私人成效数据里发现漂移：同一类任务最近编辑幅度上升、撤销增加、需要二次追问增多。

参考：<https://www.infoq.com/news/2026/05/anthropic-claude-code-postmortem/>

### 研究参考

#### Personalized Agents from Human Feedback (PAHF, 2026)

PAHF 提出 agent 应通过显式 per-user memory 在线学习用户偏好，并用 pre-action clarification、memory-grounded action、post-action feedback 三段式闭环适应偏好变化。

本方案对应第三段：post-action feedback。Personal AI 已经有大量 action/memory/context 输入，缺的是把 action 后的用户处理结果写成可检索、可治理、可演化的个人 memory。

参考：<https://arxiv.org/abs/2602.16173>

#### PLUS / personalized RLHF (Microsoft Research, ICLR 2026)

PLUS 用用户信息摘要来个性化 reward model，强调单一 reward model 不适合所有用户，用户偏好和历史上下文应该参与“什么是好答案”的判断。

本方案不做 RL 训练，但借鉴结论：Personal AI 应该把“这个用户对好结果的判断”沉淀下来。比如用户在 Jira comment 里偏好短、直接、可执行；在分享材料里偏好有真实 outcome 数字；在 Codex 任务里偏好验证证据明确。

参考：<https://www.microsoft.com/en-us/research/publication/learning-to-summarize-user-information-for-personalized-reinforcement-learning-from-human-feedback/>

#### Personal Agents and Conversational Memory (IBM Research, ESWC 2026)

IBM 讨论个人 agent 需要对 conversational memory 做结构化、更新、provenance tracing 和 inference-time 使用。成效账本把 conversational memory 的 provenance 再往前推一步：不仅知道某条偏好/结论从哪来，还知道它在真实输出中是否奏效。

参考：<https://research.ibm.com/publications/personal-agents-and-conversational-memory>

## 产品定义

### 功能名

推荐：**AI Outcome Memory Ledger / AI 成效记忆账本**

可选中文名：

- AI 成效记忆
- AI 结果回执
- 成效账本
- AI 工作回执

推荐用“成效记忆账本”，因为它既强调 outcome，也强调长期可追溯，不会被误解成一次性反馈按钮。

### 目标用户

第一目标用户就是当前 Personal AI 用户：

- 每天在 RingCentral、Jira、Google Docs/Sheets、会议、Codex、Gemini、ChatGPT、豆包、OpenClaw 之间切换。
- 已经有“先让 AI 跑一遍，再自己复核”的工作习惯。
- 关心 AI 输出是否真实可用，而不是只看生成速度。
- 希望自己的改动和判断能反哺下一次 AI 输出，但不想维护复杂后台。

### 核心对象

#### AI Outcome Receipt

一条 receipt 代表一次 AI 输出从生成到最终处理的成效记录。

```ts
interface AiOutcomeReceipt {
  id: string;
  userId: string;
  sourceSurface:
    | 'ringcentral_composer'
    | 'jira_comment'
    | 'google_docs'
    | 'google_sheets'
    | 'meeting_pilot'
    | 'ask'
    | 'codex_session'
    | 'gemini_chat'
    | 'chatgpt_chat'
    | 'manual';
  outputKind:
    | 'reply_draft'
    | 'jira_comment'
    | 'doc_section'
    | 'analysis'
    | 'code_patch'
    | 'meeting_summary'
    | 'story_points'
    | 'context_pack'
    | 'skill_output';
  toolProvider?: 'personal_ai' | 'codex' | 'claude' | 'gemini' | 'chatgpt' | 'doubao' | 'openclaw' | 'other';
  skillId?: string;
  contextRefs: Array<{
    type: 'message' | 'source_memory' | 'meeting' | 'jira' | 'doc' | 'artifact' | 'answer_memory';
    id: string;
    role: 'input' | 'evidence' | 'constraint' | 'output' | 'final';
  }>;
  artifactRef?: {
    type: 'jira' | 'ringcentral_message' | 'google_doc' | 'file' | 'meeting_note' | 'none';
    url?: string;
    title?: string;
  };
  outputHash: string;
  finalHash?: string;
  redactedDiffSummary?: {
    editDistanceBucket: 'none' | 'minor' | 'medium' | 'major' | 'rewrite';
    changedSections: string[];
    removedRisk?: string[];
    addedEvidence?: string[];
  };
  outcome:
    | 'used_as_is'
    | 'edited_and_used'
    | 'edited_or_used_with_style_issue'
    | 'rejected'
    | 'deferred'
    | 'blocked'
    | 'unknown';
  outcomeReason?: string;
  confidence: number;
  privacyClass: 'hash_only' | 'redacted_summary' | 'internal_excerpt' | 'full_private';
  createdAt: number;
  resolvedAt?: number;
}
```

#### Outcome Pattern

系统从多条 receipt 中总结出的长期学习信号。

```ts
interface AiOutcomePattern {
  id: string;
  patternType:
    | 'skill_patch'
    | 'prompt_constraint'
    | 'writing_style_memory'
    | 'recall_weight'
    | 'tool_fit'
    | 'format_preference'
    | 'missing_evidence'
    | 'quality_drift';
  title: string;
  evidenceReceiptIds: string[];
  suggestedChange: string;
  target:
    | { kind: 'skill'; skillId: string }
    | { kind: 'compose_assist' }
    | { kind: 'context_recall' }
    | { kind: 'tool_compass_signal' }
    | { kind: 'eval_suite'; suiteId: string };
  status: 'suggested' | 'accepted' | 'dismissed' | 'auto_applied_low_risk';
  createdAt: number;
}
```

#### User Writing Style Memory

Compose Assist 特别需要一个独立的写作风格记忆对象。它不是单条场景 constraint，也不等于“用户画像里一句永久事实”。更合适的语义是：

> 用户在某类关系、渠道、任务和语言环境中，稳定表现出的表达习惯。

单次发送后的 diff 只是证据；多次相似 diff、用户最终发送文本的语言特征、对方后续反应、用户显式反馈共同形成 style memory。它可以进入 user profile / `user.md` 的写作风格区，但必须带 scope、confidence、evidence 和更新策略，不能把一次偶然编辑写成永久偏好。

```ts
interface UserWritingStyleMemory {
  id: string;
  userId: string;
  scope: {
    level: 'global' | 'surface' | 'audience' | 'relationship' | 'thread' | 'task';
    surface?: 'ringcentral' | 'jira' | 'docs' | 'ai_chat' | 'email';
    audienceType?: 'peer' | 'manager' | 'direct_report' | 'external' | 'public';
    personIds?: string[];
    groupIds?: string[];
    taskKind?: 'casual_reply' | 'status_update' | 'technical_explanation' | 'meeting_followup' | 'jira_comment';
    language?: 'zh' | 'en' | 'mixed';
  };
  preference: {
    kind:
      | 'punctuation'
      | 'tone'
      | 'structure'
      | 'length'
      | 'emoji'
      | 'phrase'
      | 'anti_ai_style'
      | 'relationship_voice';
    positiveRules: string[];
    negativeRules: string[];
    examplesRedacted?: string[];
  };
  evidence: Array<{
    receiptId: string;
    traceId?: string;
    signal: 'edited_before_send' | 'sent_as_is' | 'recipient_reaction' | 'thumb_down' | 'manual_feedback';
    strength: number;
    observedAt: number;
  }>;
  confidence: number;
  halfLifeDays: number;
  status: 'candidate' | 'active' | 'needs_review' | 'retired';
  createdAt: number;
  updatedAt: number;
}
```

示例：

```ts
{
  scope: {
    level: 'relationship',
    surface: 'ringcentral',
    audienceType: 'peer',
    personIds: ['person:esther_pan'],
    taskKind: 'casual_reply',
    language: 'zh'
  },
  preference: {
    kind: 'relationship_voice',
    positiveRules: [
      '可以用轻松的“哈哈”开头',
      '句尾偶尔使用“~”表达轻松感',
      '回答同事求助时直接给可执行下一步'
    ],
    negativeRules: [
      '避免“我最喜欢聊了”“咱们一起捣鼓下”这类过度热情的 AI 式套话',
      '避免连续感叹号和排比式客套',
      '不要为了显得友好而补一长句泛泛承诺'
    ]
  },
  confidence: 0.72,
  halfLifeDays: 45,
  status: 'active'
}
```

这类对象回答的是“用户本人怎么写”，而不是“这个 issue 下次怎么回”。它应该能跨不同 compose 被使用：只要当前输入框的 surface、聊天对象、关系类型、任务类型和语言环境相近，就能参与生成。

#### Eval Seed

从真实 outcome 中抽出的可复跑样本。

```ts
interface AiOutcomeEvalSeed {
  id: string;
  receiptId: string;
  suiteId:
    | 'compose-assist'
    | 'context-recall'
    | 'personal-skill-foundry'
    | 'ask'
    | 'meeting-pilot'
    | 'tool-routing';
  inputFixtureRefs: string[];
  expectedBehavior: string;
  failureMode?: string;
  privacyClass: 'synthetic' | 'redacted' | 'local_only';
  status: 'draft' | 'approved' | 'rejected';
}
```

## 用户体验

### 1. 输出后轻量回执

用户在真实 surface 完成动作后，出现一个低打扰 receipt。

例子：

- Jira comment 发布后：`这次 AI 评论是否可用？` 默认推断 `已发布，轻微编辑`，用户可点 `正确` / `有问题` / `稍后`。
- RingCentral 回复发送后：`已记录成效：改写后发送`，用户可展开选择“少了证据 / 语气不对 / 内容过长 / 关联错记忆”。
- Google Docs 中 AI 输出被用户保留并继续编辑：系统只保存 hash + redacted diff，不保存全文，除非用户主动选择“保存片段”。
- Codex session 结束后：根据 final answer、git diff、测试结果和用户后续反馈生成 `code_patch outcome` receipt。

设计原则：

- 默认不要求用户打分。
- 能从行为推断的就自动推断。
- 只在高学习价值时询问用户，例如大幅改写、撤销、重复失败、涉及 active skill。
- 所有自动推断都能在账本里撤销或改标签。

### 2. 成效账本页面

入口建议放在 `memory-exploring.html#/outcomes`，也可以先作为 Personal Skill Foundry / Memory System 的二级 tab。

页面首屏回答四个问题：

1. 最近 AI 帮我做了哪些真实工作？
2. 哪些直接可用，哪些被大改，哪些失败？
3. 哪些失败已经变成 skill patch / eval case？
4. 这些 outcome 正在如何影响未来召回和输出？

页面结构：

- 顶部：7 天成效摘要，采用率、编辑率、拒绝率、待确认数、已生成 eval seed。
- 左列：receipt 列表，按 `待回执 / 已采用 / 大改后采用 / 失败 / 已沉淀` 过滤。
- 中间：选中 receipt 的输入、输出、最终结果、redacted diff、证据来源。
- 右列：系统建议的长期动作，例如“给 Story Points skill 增加 leftover 检查”“Compose Assist 对 Jira 字段写回默认加可人工确认语句”。

### 3. 无感反馈矩阵：其他方向如何自然获得 feedback

成效账本不要求每个能力新增显式按钮。更好的方式是沿用每个 surface 已经存在或自然会发生的用户动作，把它们统一解释成 calibration trace，再在后台聚合。

| Surface | 已有 / 应有的自然动作 | 原始反馈入口 | 对记忆的调整 | 对下一次体验的影响 |
| --- | --- | --- | --- | --- |
| Compose Assist | 插入建议、发送、发送前改写、删除插入内容、hover 后未插入、thumb-down、对方后续吐槽“AI 味” | `ambient_calibration_traces`、`/rehearsals/:id/feedback`、downstream reaction trace | 调整 evidence 权重、场景阈值、用户写作风格记忆、关系/渠道语气偏好、Rehearsal 触发质量 | 下一次相似关系/渠道/任务的输入框里，优先召回更有用的证据，并生成更像用户本人会写的表达 |
| Memory Lens | hover、展开、打开来源、mute、wrong、thumb up/down | `/feedback`、`ambient_calibration_traces` | 调整 memory/chunk/entity/source 的显著性和同场景降噪 | 下次在相同网页、会话、issue 里少出现噪音卡，多出现被打开/认可的来源 |
| Rehearsal | 命中后被使用、dismissed、irrelevant、Compose 插入/拒绝预演提示 | `/rehearsals/:id/feedback`、activation history | 降低无关触发，提升稳定场景 cue，识别过期预演 | 下次只在更精准的人、群、会议、issue 场景里提示 |
| Memory Capture / Source Memory | save、resave、duplicate、dismiss、open source、reference later | `source_memory_events`、`ambient_calibration_traces` | 调整哪些资料值得保存、source capsule 的触发线索和召回强度 | 下次划词/浏览/AI 对话时，入库建议更少误报，已保存资料更容易在正确场景被带回 |
| Today Pilot | done、later、mute、wrong、copy context pack、跳转处理 | card feedback、`ambient_calibration_traces` | 调整 mission 排序、提醒预算、任务粒度、context pack 结构 | 下一天的首页更像注意力筛选器，不重复推已经处理或长期低价值的卡 |
| Meeting Pilot | 确认行动项、编辑 owner/deadline、忽略摘要、人工新增行动项 | meeting action feedback、`ambient_calibration_traces` | 调整行动项抽取、owner/deadline 解析、会前证据权重 | 下次同类会议里，cue card 和 action item 更贴近用户实际会后处理 |
| Ask / Search | 打开结果、复制答案、继续追问、改写 query、标记无关 | search/answer feedback、`ambient_calibration_traces` | 调整 recall ranking、query expansion、拒答边界和答案格式 | 下次搜索或问答更快命中用户会继续使用的证据 |
| Personal Skill Foundry | 采用 skill 输出、大改后采用、拒绝 patch、接受 patch | outcome receipt、skill suggestion review | 提高/降低 skill confidence，生成 patch suggestion 或 eval seed | 下次运行 skill 时带上更稳定的私人约束，但不静默改 skill 真源 |

这张表的关键点是：**feedback 已经发生在用户真实动作里，成效账本只负责把它们变成可解释、可复用、可回滚的学习对象。**

### 4. 与现有 surface 的集成

#### Compose Assist

已有 Ambient Calibration trace 可以成为 receipt 的原始信号：

- `inserted` + 未撤销 + send = `used_as_is` 或 `edited_and_used`
- `edited_before_send` = `edited_and_used`，生成 redacted diff
- `sent_without_insert` = 可能是“不需要这个建议”或“建议时机不对”
- thumb-down = `rejected`，并进入 Relevance Trainer 或 prompt constraint

##### 语气被用户改掉后，下一次 Compose 如何变好

这里需要修正一个关键点：**不能只把偏好绑死在 `sceneKey` 上。** 用户很少会再次回复一模一样的问题；真正有价值的是从用户最终发送文本和 AI 草稿的 diff 中提取可迁移的写作习惯，例如：

- 用户在中文 peer 聊天里会用“哈哈”开头，但不喜欢过度热情的 AI 套话。
- 用户可能习惯在轻松关系里用句尾 `~`，但不是每句话都用。
- 用户对同事直接聊天时，不会写排比句、长铺垫和泛泛承诺。
- 用户在 Jira / 状态同步里偏好先给结论，再给必要证据。
- 某些习惯和聊天对象相关，比如对 Esther 可以轻松一点，对 manager 可能更克制。

因此 Compose Assist 的学习对象应该分层：

| 层级 | 保存什么 | 是否可迁移 | 例子 |
| --- | --- | --- | --- |
| Event trace | 单次插入、编辑、发送、thumb-down、对方反馈 | 不直接迁移，只作证据 | `edited_before_send`，`recipient_reaction=ai_tone_called_out` |
| Style feature | 从 diff 提取的语言特征 | 可聚合 | `removed_preamble`、`uses_tilde_suffix`、`avoids_parallel_politeness` |
| Style memory candidate | 多个 feature 合成的候选偏好 | 可跨相似范围迁移 | “中文 peer 聊天里更自然、短、具体，少用 AI 式热情句” |
| Active writing profile | 稳定候选进入用户写作画像 / `user.md` 写作风格区 | 可用于未来 compose | “和 peer 同事中文私聊：轻松直接，可用哈哈/句尾~，避免排比和泛泛承诺” |

单次微调不应该直接写进用户画像；但稳定出现的语言偏好应该进入用户写作风格记忆，而不是只存成某个场景的临时 constraint。

以你截图里的场景为例：

```text
AI/Compose 建议并被发送：
哈哈，随时来找我，工具类的事儿我最喜欢聊了！到时候看你具体想了解哪块，咱们一起捣鼓下~~

对方后续反馈：
感觉有点 AI 味儿..
确实有AI味
```

这次 outcome 不应只被记成“已发送，所以正向”。更准确的判断是：

- `sent_after_insert` 是采用信号。
- 对方后续明确说“AI 味”，这是 downstream negative feedback。
- 文案中可能保留了用户可接受的轻松元素：`哈哈`、`随时来找我`、句尾 `~`。
- 文案中应降权的 AI 味元素：过度热情的“我最喜欢聊了！”，泛泛的“到时候看你具体想了解哪块”，表演式协作句“咱们一起捣鼓下~~”，以及整体过长。

trace 写入可以是：

```json
{
  "surface": "ringcentral_composer",
  "sceneKey": "ringcentral:dm:esther-pan",
  "action": "edited_before_send",
  "polarity": "positive_with_possible_style_issue",
  "strength": 0.58,
  "evidenceRefs": [
    { "type": "message", "id": "msg_abc", "role": "evidence" },
    { "type": "message", "id": "msg_reaction_1", "role": "downstream_reaction" }
  ],
  "redactedDiff": {
    "rawTextStored": false,
    "suggestionHash": "sha256:...",
    "finalHash": "sha256:...",
    "editDistanceBucket": "minor",
    "semanticRelation": "same_intent",
    "styleFeatureTags": [
      "casual_opening_haha",
      "tilde_suffix",
      "over_enthusiastic_claim",
      "generic_future_promise",
      "performative_collaboration_phrase"
    ],
    "recipientReactionTags": ["ai_tone_called_out"]
  },
  "metadata": {
    "outputKind": "reply_draft",
    "audienceType": "peer",
    "relationshipKey": "person:esther_pan",
    "draftStyleSignature": {
      "tone": "cheerful_casual",
      "length": "medium",
      "structure": "friendly_preamble_then_offer"
    }
  },
  "privacyClass": "sensitive_redacted"
}
```

如果对方在后续消息里出现“AI 味”“像 AI 写的”“太官方”“太客套”这类反馈，Compose Assist 可以生成一条 downstream reaction trace。它不是监听所有社交评价，而是只在很近的时间窗口、同一 thread、明确指向用户刚发送内容时，作为 style outcome 证据。默认保存标签，不保存对方原文。

```ts
{
  action: 'downstream_reaction',
  polarity: 'negative',
  strength: 0.8,
  metadata: {
    reactionKind: 'ai_tone_called_out',
    linkedSentTraceId: 'trace_sent_123',
    reactionWindowMinutes: 90,
    rawTextStored: false
  }
}
```

聚合时不要只看同一个 `sceneKey`，而要按层级泛化：

1. `relationship`：用户和 Esther 的中文 peer 聊天。
2. `audience`：用户和 peer 同事的中文聊天。
3. `surface`：RingCentral 聊天。
4. `taskKind`：casual help / tool support reply。
5. `global`：用户整体写作里的稳定倾向。

如果多个证据都指向“用户接受轻松开头和 `~`，但被 AI 味评价时常来自过度热情、泛泛承诺和排比式客套”，系统应沉淀成 `UserWritingStyleMemory`，而不是只生成一次性的 prompt constraint：

```ts
{
  scope: {
    level: 'audience',
    surface: 'ringcentral',
    audienceType: 'peer',
    taskKind: 'casual_reply',
    language: 'zh'
  },
  preference: {
    kind: 'anti_ai_style',
    positiveRules: [
      '轻松关系里可以用“哈哈”和句尾“~”',
      '优先具体回答下一步，不要先铺情绪价值',
      '表达帮助意愿时短一点'
    ],
    negativeRules: [
      '避免“我最喜欢聊了”这类夸张自我表态',
      '避免“咱们一起捣鼓下”这类泛泛协作套话',
      '避免连续感叹号、排比句和过长友好铺垫'
    ]
  },
  confidence: 0.72,
  status: 'active'
}
```

下一次用户在不同但相似的 compose 场景里触发建议时，比如又有 peer 同事问工具问题，后端先做 style retrieval：

1. 识别当前输入框：`surface=ringcentral`、`audienceType=peer`、`taskKind=casual_reply/tool_support`、`language=zh`、可能有 `personId=esther_pan`。
2. 拉取风格记忆：global writing style + RingCentral style + peer audience style + relationship-specific style。
3. 按 scope overlap、confidence、recency、downstream feedback 加权。
4. 只取 3-6 条最高价值规则进入 prompt，避免把风格提示塞成新噪音。
5. 生成后继续用用户编辑和对方反馈校准这些规则。

进入生成 prompt 的不是“这个 scene 下次更短”，而是更像：

```text
Write in Esone's style for this relationship:
- Chinese peer chat can be relaxed and direct.
- "哈哈" and a light "~" are acceptable when the relationship is casual.
- Avoid AI-flavored enthusiasm: no exaggerated self-claims, no generic future promises, no performative collaboration phrases.
- Keep the reply specific to the next action.
```

同一含义下，下次 Compose 应避免：

```text
哈哈，工具类的事儿我最喜欢聊了！到时候看你具体想了解哪块，咱们一起捣鼓下~~
```

更应该生成：

```text
哈哈可以，下午你直接找我，我给你过一下 PAT 怎么用~
```

或者：

```text
哈哈随时，下午我看你想弄哪块，直接一起看~
```

这才是这个能力的重点：**不是记住“这条消息下次怎么回”，而是从用户改稿和真实社交反馈里学习用户的私人 voice。**

这类写作风格记忆可以进入 `user.md` 或用户画像的写作风格章节，但进入条件要比普通 trace 更高：

- 至少多条证据，或一次强显式反馈。
- 必须带 scope，不能把“对 peer 轻松”泛化成“所有场景都轻松”。
- 必须保留 provenance，用户能看到它来自哪些 receipt / trace。
- 必须可衰减，因为人的表达习惯、关系亲疏和工作语境会变化。
- 必须可被后续 outcome 反证；如果用户之后频繁改掉 `~` 或对 manager 改得更正式，规则要自动收窄。

#### Memory Capture / Source Memory

当用户把 ChatGPT/Gemini/Codex 的输出保存为 source memory，账本需要问一个额外问题：

> 这段 AI 输出是最终答案、草稿、参考资料，还是失败尝试？

这能避免把 AI 草稿当成事实长期记忆。

#### Personal Skill Foundry

当 receipt 关联某个 skill：

- 连续 `used_as_is`：增加 skill confidence。
- 连续 `edited_and_used` 且 diff 原因相似：生成 skill patch。
- `rejected`：进入 skill suggestion review，而不是直接覆盖 skill。

#### Ask / Answer Memory Tracker

Ask 的回答被复制、发送、再次追问、或用户标记“解决了”，都应成为 outcome。Answer Memory Tracker 可读取这些 receipt 判断某个活答案是否真的帮用户解决了问题。

#### Today Pilot / Meeting Pilot

会前 brief、会议总结、storyline draft 的后续采用情况，应该写入 outcome。下次同类会议时，Personal AI 就知道哪些 brief 结构真的帮用户开会，哪些只是噪音。

## MVP 范围

### P0：复用现有 trace，生成 receipt candidate 和低打扰 UI

目标：不改大架构、不新增 raw feedback 平台，先让 Personal AI 能从已有无感反馈中保存和展示 AI 输出成效。

范围：

- 复用 `ambient_calibration_traces`、`/feedback`、`/rehearsals/:id/feedback`、`source_memory_events` 等入口。
- 从已有 trace 生成 receipt candidate；只有需要 UI 稳定引用、转 eval seed 或转 skill patch 时，才落成 `ai_outcome_receipts`。
- Compose Assist 先抽取 redacted style feature：`casual_opening_haha`、`tilde_suffix`、`removed_preamble`、`over_enthusiastic_claim`、`generic_future_promise`、`ai_tone_called_out` 等。
- 支持把近邻下游反馈识别为 style outcome，例如同一 thread 后续出现“AI 味”“太官方”“太客套”，只保存 reaction tag 和关联 sent trace。
- 手动/半自动 receipt API 只处理聚合对象，不接收原始文本：
  - `POST /api/v1/outcomes/receipts`
  - `GET /api/v1/outcomes/receipts?state=...`
  - `POST /api/v1/outcomes/receipts/:id/resolve`
  - `POST /api/v1/outcomes/receipts/:id/create-eval-seed`
- 在 Compose Assist / Jira comment / Ask copy 这些最容易捕捉的 surface 上先做 receipt toast 或小卡；toast 读取已有 trace 的推断结果，不要求用户补打一遍分。
- 新页面或二级 tab 展示 receipt 列表和详情。

验收：

- 用户发送/插入一个 AI 建议后，系统能从既有 trace 推断 receipt。
- receipt 不保存完整最终文本，默认只有 hash + redacted diff summary。
- Compose Assist 能把“用户采用但对方反馈 AI 味”的场景标成 mixed outcome，而不是只算成功采用。
- 用户能把一条失败 receipt 转成 eval seed draft。
- 用户能把一条反复大改的 skill output 转成 Skill Foundry patch suggestion。

### P1：Writing Style Memory 和 Outcome Pattern 聚合

目标：从单条 receipt 走向长期学习。

范围：

- 聚合 Compose Assist 的 style feature，形成 `UserWritingStyleMemory` candidate。
- 支持 scope 泛化：从 relationship-specific 到 audience / surface / task / global，不只按 `sceneKey`。
- 稳定偏好可以进入用户画像 / `user.md` 的写作风格区，但必须保留证据、置信度、scope 和半衰期。
- 聚合同类失败：例如 Jira 字段写回评论总是太啰嗦、Story Points skill 总是漏 leftover、Meeting summary 总是把 UI shell 当内容。
- 生成 `ai_outcome_patterns`。
- Pattern 可进入：
  - Personal Skill Foundry patch inbox
  - Context Recall Experience Eval
  - Compose Assist prompt constraint
  - Compose Assist writing style retrieval
  - Tool fit signal
- 给用户一键接受/丢弃/静音。

验收：

- 3 条相似 style outcome 能合成一条写作风格候选，例如“中文 peer 聊天避免 AI 式过度热情”。
- 这条候选能在不同但相似的 compose 场景中被检索到，而不是只对同一个 thread 生效。
- 3 条相似失败 receipt 能合成一个 pattern。
- 接受 pattern 后会写入对应模块的 suggestion，而不是直接静默改行为。

### P2：跨 AI 工具成效画像

目标：让 Personal AI 逐步知道不同 AI 工具在用户私人工作里的真实表现。

范围：

- Codex / Gemini / ChatGPT / Claude / OpenClaw / 豆包 输出保存为 source memory 时可挂 outcome。
- 从 artifact / file / Jira / Docs 后续修改推断最终成效。
- 统计“某工具某任务类型最近质量是否漂移”。
- 给 AI Context Passport / Tool Compass 类 future 能力提供历史成功率信号。

验收：

- 用户能看到“过去 30 天 Codex 在 repo patch 类任务采用率高，但会议材料类输出常被大改”。
- 工具质量漂移只作为提示，不自动判定某工具不可用。

## 数据模型草案

这里的数据模型主要描述聚合后的 outcome 对象，以及由 outcome 进一步沉淀的写作风格记忆。原始用户动作仍优先保存在各 surface 已有的 trace / feedback / event 表里。实现时有两种选择：

- **查询层视图。** P0 先从 `ambient_calibration_traces` 等表实时拼出 receipt candidate，不新增持久表。
- **物化聚合表。** 当 receipt 需要被用户改标签、转 eval seed、转 skill patch 或跨天审计时，再写入 `ai_outcome_receipts`。

因此 `ai_outcome_receipts` 不是新的 feedback source of truth，而是 outcome 的稳定引用层。

```sql
CREATE TABLE ai_outcome_receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_surface TEXT NOT NULL,
  output_kind TEXT NOT NULL,
  tool_provider TEXT,
  skill_id TEXT,
  artifact_type TEXT,
  artifact_url TEXT,
  artifact_title TEXT,
  context_refs_json TEXT NOT NULL DEFAULT '[]',
  output_hash TEXT NOT NULL,
  final_hash TEXT,
  redacted_diff_json TEXT NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL DEFAULT 'unknown',
  outcome_reason TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  privacy_class TEXT NOT NULL DEFAULT 'redacted_summary',
  state TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_outcome_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_receipt_ids_json TEXT NOT NULL DEFAULT '[]',
  suggested_change TEXT NOT NULL,
  target_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_outcome_eval_seeds (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  input_fixture_refs_json TEXT NOT NULL DEFAULT '[]',
  expected_behavior TEXT NOT NULL,
  failure_mode TEXT,
  privacy_class TEXT NOT NULL DEFAULT 'redacted',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES ai_outcome_receipts(id)
);

CREATE TABLE user_writing_style_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope_level TEXT NOT NULL,
  surface TEXT,
  audience_type TEXT,
  person_ids_json TEXT NOT NULL DEFAULT '[]',
  group_ids_json TEXT NOT NULL DEFAULT '[]',
  task_kind TEXT,
  language TEXT,
  preference_kind TEXT NOT NULL,
  positive_rules_json TEXT NOT NULL DEFAULT '[]',
  negative_rules_json TEXT NOT NULL DEFAULT '[]',
  examples_redacted_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  half_life_days INTEGER NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## 判断逻辑

### Outcome 推断

```text
if user_clicked_send and downstream_reaction == ai_tone_called_out:
  outcome = edited_or_used_with_style_issue
elif user_clicked_send and no_undo and edit_distance <= small:
  outcome = used_as_is
elif user_clicked_send and edit_distance > small:
  outcome = edited_and_used
elif user_undo or thumb_down or close_without_send_after_preview:
  outcome = rejected
elif tool_error or missing_permission or blocked_external_action:
  outcome = blocked
else:
  outcome = unknown
```

### Writing Style Memory 晋升

单次 compose diff 的默认状态是 evidence，不是 profile。晋升规则：

```text
if explicit_user_feedback_about_style:
  create_or_update_style_memory_candidate(strength=high)
elif repeated_style_features >= 3 and scope_overlap_is_clear:
  create_or_update_style_memory_candidate(strength=medium)
elif downstream_reaction_ai_tone_called_out and linked_to_recent_ai_suggestion:
  create_or_update_anti_ai_style_candidate(strength=medium_high)
else:
  keep_as_event_evidence_only

if candidate.confidence >= active_threshold and evidence_diversity_ok:
  promote_to_active_writing_style_memory

if active_memory_used_in_next_compose and user_edits_against_it:
  narrow_scope_or_reduce_confidence
```

写入用户画像 / `user.md` 的条件应该更高：

- `status='active'` 且置信度稳定。
- 有两个以上不同 thread / task / day 的证据，或者用户显式确认。
- 文案是规则和反规则，不是原始聊天文本。
- 带 provenance：能追到 receipt / trace。
- 带 scope：例如 `peer + RingCentral + zh + casual_reply`，而不是泛化成“用户永远喜欢轻松风格”。

### 学习价值评分

一条 receipt 只有在学习价值足够高时才打扰用户。

```text
learning_value =
  0.30 * edit_distance_signal +
  0.20 * repeated_pattern_signal +
  0.15 * skill_link_signal +
  0.15 * artifact_importance_signal +
  0.10 * user_manual_feedback_signal +
  0.10 * downstream_reuse_signal
```

打扰策略：

- `< 0.35`：静默写入，只用于聚合。
- `0.35 - 0.65`：账本里出现，不弹窗。
- `>= 0.65`：显示轻量 receipt 卡，让用户确认原因。
- `>= 0.8` 且关联 active skill / eval suite：建议转成 patch 或 eval seed。

### 隐私策略

默认不保存完整 AI 输出或最终发送文本。

| 隐私级别 | 保存内容 | 用途 |
| --- | --- | --- |
| `hash_only` | output hash、final hash、surface、outcome | 高敏消息、私聊 |
| `redacted_summary` | hash + 编辑幅度 + 改动类别 | 默认 |
| `internal_excerpt` | 用户允许的小片段 | Jira/Docs 工作内容 |
| `full_private` | 完整私有文本 | 只在用户明确选择“保存完整样本”时 |

红线：

- 不把私聊原文、Jira restricted comment、meeting transcript 原文默认复制进 eval case。
- 不把 outcome 自动写成 confirmed user profile。
- 不因为一次失败自动贬低某个工具或 skill；必须看 pattern。
- 不自动把 skill patch 合入真源；必须走 Foundry review。

## Demo 说明

Demo 模拟两个场景混合：

1. 用户在 Jira `MTR-141911` 上发布 AI 生成字段写回评论后，Personal AI 右侧弹出成效回执。
2. 用户在 Personal AI 成效账本中查看近 7 天 AI 输出采用情况，并把“Story Points skill 漏 leftover 检查”转成 skill patch/eval seed。

Demo 交互：

- 点击左侧 receipt，右侧详情和建议动作会变化。
- 点击 `标记为大改后采用`、`生成 skill patch`、`生成 eval seed` 会出现 toast。
- 移动端会变成单列的工作台。

## 真实用户场景

### 场景 1：Story Points estimation skill 真的变聪明

用户让 AI 先跑一遍 Story Points estimation，然后和人工估点对比 diff 最大的 5 张票。

旧体验：

1. 用户自己看出原因：技术细节在线下沟通过、ticket 有 leftover、AI 难识别剩余工作。
2. 这些发现可能被保存成一条消息记忆，但不一定反哺 skill。
3. 下次 AI 估点仍可能犯同样错误。

新体验：

1. Personal AI 识别这是一次 `story_points` outcome。
2. 用户只需在 receipt 上选择原因：`私下技术细节缺失`、`leftover 未显式识别`。
3. 系统生成两个长期动作：
   - Skill patch：估点前检查 linked PR / unresolved subtasks / leftover wording；证据不足时输出 `needs human context`。
   - Eval seed：用脱敏 ticket fixture 复跑，预期行为是“不要自信给点数，先标缺少线下细节”。
4. 下次用户再跑同类估点，AI 不只是“记得之前有过 diff”，而是把这个 diff 当成 skill 质量约束。

### 场景 2：Jira AI 写回不再重复制造噪音

用户在 `MTR-141911` 上使用 AI 生成多个字段写回评论，例如 Team、Vertical Track、Component、Story Point copied from parent。

旧体验：

1. Personal AI 保存了多条 Jira comment 和 source memory。
2. 后续召回可能只看到一堆重复评论。
3. 系统不知道哪些评论是正确字段初始化，哪些只是模板噪音。

新体验：

1. 每条发布后的 AI comment 生成 receipt。
2. 如果用户没有修改并保持 Jira 状态，系统标记为 `used_as_is`。
3. 如果用户随后删除/编辑某类评论，系统把它标记为 `edited_and_used` 或 `rejected`。
4. 多条相似 receipt 聚合成 pattern：
   - `字段复制类评论可用，但需要合并为一个 receipt，避免四条重复记忆污染召回。`
   - `Story Point copied from parent 需要加“请人工确认”语句。`
5. Memory Intake Quality Gate 可以消费这个 pattern，把重复评论归并为一个成效 receipt，而不是四条同权重记忆。

### 场景 3：AI 工具质量漂移变得可感知

用户一段时间内用 Codex 修 bug、用 Gemini 做会议室反馈总结、用 ChatGPT/豆包整理材料。

旧体验：

1. 用户主观感觉“最近某工具不太行”，但 Personal AI 没有量化证据。
2. 工具选择只能靠记忆里的零散评价。

新体验：

1. 成效账本统计每类任务的采用率和大改率。
2. 如果某工具在同类任务里的 `edited_and_used` 突然上升，系统只提示：
   > 最近 5 次会议材料类输出平均大改幅度升高，建议下次先要求列证据再生成正文。
3. 这不是 Tool Compass，不自动换工具；它只是给未来 Context Passport / skill / prompt 约束提供私人证据。

## 亮点

1. **把“AI 有没有用”变成一等记忆。** 不是只保存 prompt/output，而是保存真实采用结果。
2. **低打扰。** 默认从用户行为推断 outcome，只在高价值学习时询问。
3. **隐私友好。** 默认 hash + redacted diff，不保存完整最终文本。
4. **连接现有系统。** Ambient Calibration 提供原始信号，Foundry 消费 skill patch，Experience Eval 消费失败样本，Memory Lens/Ask 消费成效偏好。
5. **真正个人化。** 企业 eval 平台评估的是应用质量；成效账本评估的是“这个 AI 输出对我这个用户有没有用”。
6. **避免重复污染记忆。** Jira 字段写回、会议 UI chrome、AI 草稿都可以被归并成 outcome receipt，而不是一堆同权重原始记忆。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 用户不想每天评价 AI 输出 | 默认自动推断；只在高学习价值场景显示一张小卡；支持全局静默 |
| 误判 outcome | 所有自动 receipt 都可改；低置信只进账本不影响长期行为 |
| 保存敏感文本 | 默认 hash/redacted summary；高敏 surface 只允许 hash_only |
| 与现有 ambient calibration 重叠 | Ambient 是底层 trace；Outcome Ledger 是用户可见的成效对象和聚合层 |
| 过早自动改 skill / prompt | 只生成建议，不自动合入；Foundry / feature docs 仍是真源 |
| 账本变成又一个后台 | MVP 嵌入真实 surface，页面只用于回看和批量处理 |

## 实施拆解

### Phase 0：文档和 demo

- 本计划。
- 静态 HTML demo。
- 只做 docs/progressing，不改 runtime。

### Phase 1：数据层

- 先写 receipt candidate mapper：把 `ambient_calibration_traces`、`/feedback`、`/rehearsals/:id/feedback`、`source_memory_events` 映射成统一 outcome 视图。
- 需要稳定引用时再加 Migration：`ai_outcome_receipts`、`ai_outcome_patterns`、`ai_outcome_eval_seeds`。
- Repository + API 只处理聚合后的 receipt / pattern / eval seed。
- 单元测试覆盖隐私级别、hash-only、重复 trace 去重、重复 receipt 去重。

### Phase 2：Compose Assist / Ask / Jira 三个入口

- Compose Assist send/undo/edit trace 生成 receipt。
- Ask copy / answer feedback 生成 receipt。
- Jira comment publish 或 Memory Capture 的 AI output 标记生成 receipt。
- 前端 toast + detail drawer。

### Phase 3：账本页面

- `memory-exploring.html#/outcomes` 或 Memory System 二级 tab。
- Receipt list / detail / pattern suggestions。
- 一键生成 eval seed draft / skill patch suggestion。

### Phase 4：体验评估

- 增加 `evals/cases/ai-outcome-ledger` 或复用现有 compose/context-recall eval。
- 验证：
  - 不保存 raw final text。
  - receipt 去重。
  - 大改后采用能进入 pattern。
  - pattern 不自动改 skill 真源。

## 验收指标

### 定性

- 用户能从一个 AI 输出回到“当时为什么采用/改掉”。
- 用户不觉得被迫打分。
- 用户能看到某条 skill patch 来自真实 outcome，而不是系统空想。

### 量化

- 7 天内 AI output receipt 捕捉率 >= 60%（在已支持 surface 内）。
- 自动推断 outcome 后用户手动纠正率 < 20%。
- 大改/失败 receipt 中至少 30% 能生成有用 pattern 或 eval seed。
- Compose Assist / Skill Foundry 相关失败重复出现率下降。

## 推荐实现路径

建议先做 P0/P1 的窄切口：

1. 从 Compose Assist 的现有 ambient calibration trace 入手，因为已有 `inserted / edited_before_send / sent_without_insert / wrong` 信号。
2. 做一个轻量账本页，只展示 receipt 和 pattern，不做复杂图表。
3. 先支持“生成 eval seed draft”和“生成 skill patch suggestion”两个动作，不自动应用。
4. 用 Story Points estimation 和 Jira AI writeback 两类真实样本验证是否能减少重复错误。

如果用户决策要实现，我建议把这个能力作为 **Personal AI 的横切学习层**，不是独立大产品。它的价值在于把已有记忆系统从“保存与召回”推进到“知道什么真的帮到了用户”。
