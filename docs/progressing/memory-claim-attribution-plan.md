# 新能力：Memory Claim Attribution / 记忆主张归属

> 状态：待决策，仅完成方案与交互 Demo，尚未实现运行时代码
> 规划日期：2026-07-22
> 建议复制标题：`新能力：记忆主张归属`
> 中文 Demo：[memory-claim-attribution-demo.html](./memory-claim-attribution-demo.html)

## 结论先行

Personal AI 现在已经知道一条消息是不是“用户本人发出的”，但仍不知道这条消息里的**每一句主张是谁的、处于什么认识状态、允许变成哪一类长期记忆**。

例如，用户写下：

> “另一位 AI 建议改成 React；Alice 说年底必须上 Angular；我的决定是先保留 Vue，等性能测试；先假设 7 月 1 日上线。”

整条消息虽然由用户发出，但其中同时存在 AI 建议、同事转述、用户决定和待验证假设。若它们一起继承 `ownerAuthored=true`，Personal AI 可能把“Angular 是我的偏好”“7 月 1 日已确定上线”写进画像、事实或行动层。

本方案建议加入一个跨摄入、抽取、写入和消费的底层能力：**把消息切成 claim span，为每个主张记录归属、表达方式和验证状态，并据此执行失败关闭的写入门禁**。它正常时安静运行，只在混用证据、高责任写入或用户主动查看时显示一句可理解的回执。

亮点不是“又多一个 AI 分类器”，而是：

1. **Personal AI 不只记得内容，还记得这句话是谁的立场。**
2. **AI 的建议不会自动变成用户的偏好；假设不会悄悄变成当前事实。**
3. **用户的接受、编辑、发送和真实完成可以让一条主张沿着可审计状态逐步升级。**
4. **纠正只修派生归属，不篡改原始消息。**

本轮没有从 Reminder 选题：EventKit 实时读取到唯一 `Personal AI` 列表，共 4 条、未完成 0 条；因此没有随机候选，也不应修改任何 Reminder。

---

## 用户真实场景一：跨 AI 对话里的“我的决定”

### 场景

用户经常把另一个 AI 的建议、同事的反馈和自己的判断放在同一段话里继续追问。线上只读样本也显示，长期库中已经存在外部 AI 导入、引用块、多人 mention、条件语句、模拟/假设等混合表达；单靠 message sender 无法可靠代表每个句子的主张人。

用户在一个 Web AI 对话中输入：

> “另一位 AI 建议把前端迁到 React；Alice 觉得年底必须 Angular；我的决定是这轮保留 Vue，等性能测试再评估。先假设 7 月 1 日上线，帮我列风险。”

### 用户逐步体验

1. 用户照常发送消息，不需要先选择“这是引用/这是决定”。
2. Personal AI 在后台切出 4 个主张：AI 建议、Alice 转述、用户明确决定、待验证假设。
3. 用户点“记住这段”后，页面边缘出现低打扰回执：
   - `已分清 4 类：你的决定 1 · 他人观点 1 · AI 建议 1 · 待验证假设 1`
   - `只有你的明确决定可进入事实/画像候选。`
4. 一周后用户问：“我最后决定用什么？”
5. Ask 回答“这轮保留 Vue，等性能测试后再评估”，并在证据下显示：
   - `你明确说过`
   - `Alice 的 Angular 建议仅作背景`
   - `AI 的 React 建议尚未被你采纳`
   - `7 月 1 日是假设，不当作已确认日期`
6. 如果系统把某句归错，用户点证据标签并选择“这不是我的观点”或“这是我的决定”。系统保留原文，只改派生归属与后续消费权限。

### Before / After

| | Before | After |
| --- | --- | --- |
| 画像 | 可能把 React / Angular 当成用户偏好 | 只有用户明确自述可成为画像候选 |
| 当前事实 | “假设 7 月 1 日”可能被摘要成确定日期 | `hypothesis + unverified` 永远不能写当前事实 |
| Ask | 混合引用后给出模糊或错误的“你的决定” | 先按归属过滤，再回答并给一句回执 |
| 用户负担 | 发现错记后去多个页面排查 | 在使用当下直接纠正，不维护新队列 |

---

## 用户真实场景二：会议里“提到、指派、接受、完成”不是一回事

### 场景

会议转录里常出现这些相邻句子：

- 负责人：“Esone，下周一前补完迁移清单。”
- 用户：“可以，我接这个，周五先发草稿。”
- AI 会议摘要：“Esone 将于周五完成迁移。”
- Jira 两天后出现已提交的草稿链接。

如果系统只识别人名、action item 和积极措辞，它可能把“被指派”直接当成用户承诺，把 AI 总结当成事实，甚至把“发草稿”升级成“完成迁移”。

### 用户逐步体验

1. 会议结束后，Meeting Outcome Binder 继续做原本的目标—结果核对。
2. 记忆主张归属先标出：负责人指派、用户明确接受、AI 推测摘要、Jira 可验证结果。
3. Personal AI 在会后卡片里显示一行：
   - `你已接受：周五发草稿；下周一完成仍未验证。`
4. AI 摘要不会独自完成任务；只有 Jira、done action、明确 decision 或其他独立 receipt 才能把状态升级为 `verified_completion`。
5. 当用户在 Today Pilot 看见这项行动时，来源不是笼统的“会议记忆”，而是：
   - `负责人指派 → 你明确接受 → Jira 草稿已出现`
6. 若用户只是在会议里问“我来做吗？”，系统因问句和低置信而保持 `unknown / unverified`，不会制造承诺。

### Before / After

| 指标 | Before | After |
| --- | --- | --- |
| 被指派即承诺的误写 | 整条 transcript / summary 粒度难以阻断 | 必须有用户接受 claim 才形成 owner commitment |
| “提到 done”即完成 | 依赖下游能力各自补规则 | 统一要求独立验证 receipt |
| 用户理解 | 只看到一个 action item | 看见指派、接受、验证的简短链路 |

---

## 为什么现在做

### 1. 真实数据已经出现结构性风险

本轮对 `10.32.56.212` 上 `esone.qiu` 的 memory-service 做了只读、不可变快照查询，未改任何线上数据。查询时数据库主文件更新时间为 2026-07-22 03:29（+08:00），WAL 更新到约 03:59，因此量化结果可能比在线状态滞后约 30 分钟，只用于发现产品模式，不作为精确运营报表。

样本概况：

- 11,472 条消息、10,261 个 chunk、14,186 个 entity。
- 用户本人语料约 1,645 条，来自 Glip、Jira 与日历。
- 至少 91 条 owner-authored 文本命中引用、多人 mention、外部 AI、条件/假设、转述等一种或多种高风险信号。
- `authorRole / isSelf` 只存在于 1,632 / 11,472 条消息；其余 9,840 条缺少这类角色字段。
- 161 条 ChatGPT / 豆包导入记忆没有 sender、`authorRole` 或 `isSelf`，却已被分成 fact、task、preference、decision 等长期类型。
- 1,887 条派生 entity property 都标为 `inferred` 且 source author 为空；1,780 条能连回原始消息，其中 1,693 条来自非用户消息。793 条对应证据命中引用、多人、AI 名称、模拟或转述等至少一种归属风险信号。

这些数字不证明线上已经产生某个具体错误，但证明“整条消息的 sender 或 source type”不足以支撑长期画像、事实、承诺和行动的归属判断。

### 2. 当前代码的边界停在 message level

`memory-service/src/core/IngestionPipeline.ts` 当前通过 `isSelf / authorRole=user / ownerAuthored` 等 metadata 判断整条 payload 是否为用户所写，并只在 `ownerAuthored=yes` 时允许 LLM 提取 `profile_candidates`。这比完全无门禁安全，但抽取 schema 没有 claim span、主张人、引述/转述、假设、采纳或完成状态。

`memory-service/src/core/MemoryChangeLedgerService.ts` 又会把整个 source 的 `ownerAuthored=true` 推成 event-level `authorityRole='owner_authored'`。因此，混合消息里的非用户主张可能沿着 source authority 被放大。

此外，opinion candidate 路径仍主要依赖 sentiment 与 Person entity；即使结果先进入 `pending_confirm`，引用或 AI 文案仍可能制造噪声候选。

### 3. AI 产品正在补“来源”，但还没解决“句内主张归属”

- [OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 已支持在回答下查看 Memory Sources、纠正来源与修改 memory summary。它证明“为什么这次这样个性化”值得在消费时低打扰展示；但 source 仍不等于同一段话里每个 claim 的 owner。
- [Mem0 V3 Add Memories](https://docs.mem0.ai/api-reference/memory/add-memories) 保留 user / assistant role；其[公开 extraction prompt](https://github.com/mem0ai/mem0/blob/main/mem0/configs/prompts.py) 强调正确归属和避免把 assistant 的回声重复抽成记忆；[Group Chat](https://docs.mem0.ai/platform/features/group-chat) 进一步要求参与者 `name + role`。这是竞品最低基线，但 user 自己转述同事、引用 AI 或做假设时，message role 仍然不够。
- [Graphiti](https://github.com/getzep/graphiti/blob/main/README.md) 强调 entity / relationship 对 raw episode 的 provenance。它回答“来自哪一段”，没有完整回答“段内是谁在主张、以什么认知状态主张”。
- [Granola speaker identification](https://docs.granola.ai/help-center/taking-notes/transcription) 展示了会议 speaker 标签的价值，但 speaker diarization 仍无法区分“这位 speaker 在直接承诺、转述别人，还是复述 AI 摘要”。

### 4. 研究已经说明“谁说的”与“合理但无证据的推断”是独立难题

- [M3-SLU](https://arxiv.org/abs/2510.19358) 在 12k+ 多说话人样本中发现，模型可能理解“说了什么”，却仍会在“谁在何时说的”上失败。
- [Attribution and the discourse structure of reports](https://aclanthology.org/2023.dnd-14.6/) 把直接、间接与混合转述建模为 frame segment 与 report 之间的 attribution relation，支持先切分 claim，再判断归属。
- [Evaluating and Categorizing Factual Errors in Dialogue Summarization](https://aclanthology.org/2024.acl-long.677/) 单列了 contextual inference：内容听起来合理，却没有对话中的直接证据。长期记忆若把这种摘要直接当事实，影响会跨会话持续。
- 2026 年的 [Hidden in Memory](https://arxiv.org/abs/2605.15338) 与 [From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329) 说明外部材料可被错误持久化为“关于用户的记忆”，且单靠传统 prompt-injection 防护不能覆盖 instruction/data 边界混淆。记忆主张归属不替代安全扫描，而是补齐 benign content 的 owner / stance 轴。

### 5. 专家视角支持把它做成 harness contract，而不是一句 prompt

- Lilian Weng 在 2026 年的 [Harness Engineering for Self-Improvement](https://lilianweng.github.io/posts/2026-07-04-harness/) 中把 persistent state、permission control、evaluation 和 failure observability 放进模型外的 harness 层。对本能力的直接启示是：归属不能只靠 extraction prompt 自觉遵守，必须落成可审计 schema、纯函数 policy、权限门禁和真实 eval。
- Simon Willison 在 [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) 中强调，prompt injection 的根问题是把 trusted 与 untrusted content 混到同一上下文。记忆主张归属处理的是相邻但更广的边界：即使内容完全良性，也不能把“别人/AI/假设”继承成用户本人权威。因此产品应保留 `trustClass × claim attribution` 两条独立轴。

---

## 产品定义

### 一句话

**为进入长期记忆的每个关键主张保留“谁说的、怎么说的、验证到哪一步、允许被哪里使用”的可审计契约。**

### 目标

1. 降低把他人观点、AI 建议、假设、计划或摘要推断写成用户事实/偏好的概率。
2. 让 Ask、Lens、Compose、Meeting、Today 在需要时能说明采用了哪类主张。
3. 让“AI 建议 → 用户采纳 → 实际执行 → 独立验证”成为可追踪状态，而不是一次性标签。
4. 不增加日常维护负担；默认静默，失败关闭，可撤销。

### 非目标

- 不做新的“记忆审查台”、全局治理中心或逐条 inbox。
- 不替代 Injection Defense：后者判断来源/内容是否可能有恶意指令，本能力判断主张归属与认识状态。
- 不替代 Evidence Cohesion：后者判断证据是否在回答同一问题，本能力先判断这条证据是谁的、能否被当作哪种事实。
- 不替代 Change Ledger：后者维护值的时间变化链，本能力为每个候选变化提供更细的 authority 输入。
- 不替代 speaker diarization：音频 speaker 是输入信号，不等于 claim 的 epistemic owner。
- 不自动裁决事实真伪；`corroborated / verified_completion` 必须依赖独立证据。

---

## 与现有及搁置能力的去重

| 能力 | 它解决什么 | 本能力新增什么 | 必须复用 / 禁止重复 |
| --- | --- | --- | --- |
| Memory Intake Quality Gate（搁置） | 低信息、重复、壳文本、错源、弱推断的质检 | 高质量文本内部的 claim owner / stance / verification | 不能复活 review queue；自动运行 |
| Injection Defense | source trust、恶意指令打标、中性框架、动作隔离 | 即使内容无恶意，也分清引用、转述、AI 建议与用户自述 | 两条轴并存：`trustClass × attribution` |
| Source Memory Distiller | 资料来源的 evidence span 与 source-only candidate | span 内谁在主张、能否升格为用户事实 | 复用 source-only / needs-confirmation，不写 confirmed profile |
| Persona Projection | 输出端按场景决定哪些画像可代表用户 | 写入端先阻止错误内容进入画像/事实 | 顺序必须是 Attribution → Profile → Projection |
| Evidence Cohesion | 使用前判断是不是同题证据 | 使用前判断证据属于谁、是哪种语气 | 顺序建议 Attribution → Authority → Cohesion |
| Change Ledger | 稳定对象/字段的来源、时间、当前值与冲突链 | source/event 级 authority 之前的 claim 级净化 | 不另造时间账本 |
| Meeting Outcome Binder | 会前目标与会后结果是否闭环 | 普通消息/AI 对话/会议中的指派、接受、推测和验证 | 复用 verified completion 证据规则 |
| AI Conversation Loom（搁置） | 比较跨 AI 对话里的 claims | 单条对话内部的主张归属与写入权限 | 不做跨平台工作台 |
| Time Basis Contract（不独立） | current / as-of / simulation 的请求时间口径 | claim 自己是否是 hypothesis / simulation | 复用词汇，不另建时间 UI |

去重结论：该方向与相邻能力有接口重合，但没有功能重合。它应作为底层公共数据合约进入既有路径，若最终演化成独立页面，就偏离本方案。

---

## 核心数据契约

不要用一个过载枚举同时表达“谁说的、怎么说的、是否可靠”。同一句可以是“AI 的建议，但后来被用户采纳并由独立证据验证”，所以 owner、speech mode、polarity、time basis 与 verification 必须正交表达。

```ts
type ClaimOwnerKind =
  | 'self'
  | 'named_person'
  | 'organization_or_source'
  | 'ai_agent'
  | 'system_observation'
  | 'unknown';

type SpeechMode =
  | 'direct_assertion'
  | 'quote'
  | 'reported_speech'
  | 'suggestion'
  | 'question'
  | 'hypothesis'
  | 'simulation'
  | 'intent_or_plan'
  | 'commitment'
  | 'correction';

type VerificationState =
  | 'unverified'
  | 'source_only'
  | 'corroborated'
  | 'verified_completion'
  | 'contradicted';

type ClaimPolarity = 'affirmed' | 'negated' | 'uncertain';

type ClaimTimeBasis =
  | 'current'
  | 'as_of_source_time'
  | 'future_intent'
  | 'hypothetical'
  | 'counterfactual'
  | 'unknown';

interface MemoryClaimEnvelope {
  id: string;
  sourceMessageId: string;
  sourceSpan: { start: number; end: number; textHash: string };
  normalizedClaim: string;
  owner: {
    kind: ClaimOwnerKind;
    entityId?: string;
    displayName?: string;
  };
  speechMode: SpeechMode;
  polarity: ClaimPolarity;
  timeBasis: ClaimTimeBasis;
  verification: VerificationState;
  commitment: 'none' | 'proposed' | 'assigned' | 'accepted';
  confidence: number;
  signals: Array<
    | 'message_role'
    | 'speaker_label'
    | 'reply_target'
    | 'quote_boundary'
    | 'mention'
    | 'linguistic_marker'
    | 'connector_receipt'
    | 'llm_resolution'
    | 'user_correction'
  >;
  policy: {
    profileCandidate: boolean;
    currentTruthCandidate: boolean;
    actionCandidate: boolean;
    passiveRecall: 'allow' | 'background_only' | 'block';
  };
  supersedesClaimId?: string;
  createdAt: string;
}
```

### 原始数据与派生数据边界

- `messages_raw.content`、原始 transcript、导入文件永不因归属纠正而改写。
- claim span 以 offset + hash 绑定来源；来源更新后旧 span 标 stale，不能静默漂移到新文本。
- 用户纠正创建新的 attribution revision，旧判断保留审计但不再被消费。
- 删除源消息时，沿用现有 cascade deletion 清除其 claim envelope、派生 candidate 与 evidence shadow。
- 导出/备份必须包含 schema version、claim revisions 与用户纠正，但默认不导出内部模型 prompt。

---

## 写入政策矩阵

| Claim 类型 | 画像候选 | 当前事实 | Action / 承诺 | 被动提示 | 默认回执 |
| --- | --- | --- | --- | --- | --- |
| 用户直接自述偏好/约束 | 允许，敏感/高影响仍走现有确认 | 视字段 authority 规则 | 仅明确 commitment | 允许 | 正常静默 |
| 用户直接陈述某事实 | 不等于画像 | 可作 owner-authored candidate，不自动视为外部真相 | 否 | 允许 | 冲突时显示 |
| 他人原话 / 用户转述 | 禁止 | source-only / background | 被指派不等于接受 | 仅背景 | 混用时显示 |
| AI 建议 / AI 摘要 | 禁止 | 禁止成为用户当前事实 | proposed，不能 accepted | 仅背景 | `AI 建议·未采纳` |
| 假设 / 模拟 / 反事实 | 禁止 | 禁止 | 禁止完成任务 | 只在对应模拟场景 | `假设·不当事实` |
| 用户明确计划 | 不是稳定画像 | 不是已完成事实 | intent / proposed | 可用于 Today，但显示未完成 | 必要时显示 |
| 用户明确接受指派 | 不适用 | 可记录 commitment event | accepted | 允许 | `你已接受` |
| 独立 connector / done receipt | 不适用 | 可升级 corroborated | 可升级 verified completion | 允许 | `已由 X 验证` |
| owner 不明或置信不足 | 禁止 | 禁止 | 禁止 | background-only 或 block | 只在高责任路径询问 |

### 三条不可破坏的硬规则

1. **整条消息是 owner-authored，不代表其中每个 claim 都是 `self`。**
2. **措辞分类器永远不能单独产出 `verified_completion`。**
3. **ambiguous 默认 `unknown`，不能为了召回率把未知升级成用户事实。**

---

## 判定流水线

### Stage 0：保留上游角色证据

Smart Import、MCP、Web AI、Glip、Jira、Calendar、meeting transcript 等入口统一保留：

- message role / sender / participant / speaker label；
- reply-to / quote / mention / thread relation；
- 原始 source type、trust class 与 connector receipt；
- AI provider / model 仅在来源明确时记录，未知就保持 generic AI；
- 用户编辑、发送、accept、done、Jira transition 等可验证交互。

不能在导入早期把多角色对话压成 sender 为空的单一 summary。

### Stage 1：确定性 claim segmentation

优先使用低成本、可解释信号：

- 引号、引用块、邮件/聊天 reply header；
- `X 说 / according to / AI suggested / 假设 / 如果 / 我决定 / 我来做` 等中英 marker；
- meeting speaker turn、ASR segment、mention 和 thread target；
- 句界、分号、项目符号、代码块与粘贴边界。

先切 span，再做归属；不能让一个 message-level 标签覆盖全部子句。

### Stage 2：严格的 LLM resolution

只对确定性规则无法解释的 span 使用结构化 LLM，输入必须包含有限邻接上下文与上游 role signals，输出受 JSON schema 约束。temperature 低；不允许生成来源中不存在的人名或验证 receipt。

LLM 可判断 `reported_speech / hypothesis / suggestion`，但不能单独赋予：

- `self`（当上游 sender / linguistic evidence 都不足）；
- `accepted`（缺少明确接受语句或交互）；
- `corroborated / verified_completion`（缺少独立证据）。

### Stage 3：Policy compilation

用纯函数把 owner、speech mode、polarity、time basis 与 verification 编译成 `profileCandidate / currentTruthCandidate / actionCandidate / passiveRecall`。所有写路径消费同一 policy，不允许 User Profile、Opinion、Change Ledger、Action Queue 各自猜一遍。

### Stage 4：消费端组合

推荐固定顺序：

```text
Claim Attribution
  → trust / authority gate
  → time / freshness gate
  → evidence cohesion
  → scene relevance / budget
  → Ask / Lens / Compose / Meeting / Today
```

Attribution 先过滤“这是谁的、是什么状态”；后续 gate 再决定是否可信、是否当前、是否同题和是否值得打扰。

### Stage 5：学习与修正

- 用户点“这不是我的观点”：写 attribution revision，相关 profile/fact/action candidate 立即失效；不删原文。
- 用户点“这是我的决定”：把 owner / mode 修成 `self + direct_assertion`，但仍不自动升级为 verified external fact。
- 用户采用 AI 建议：只有明确接受、编辑后发送、真实动作或外部 outcome 才建立 adoption edge；仅点击“复制”不足以代表采纳。
- 多次同类纠正可用于改进分类器，但不能反向生成新的用户画像条目。

---

## UX 设计

### 设计原则

1. **正常时不打扰。** 单一、清楚的用户自述不出现额外 UI。
2. **在后果发生的控制点显示。** 保存、写画像、回答、代用户措辞、创建行动之前才需要回执。
3. **先说后果，再说技术标签。** 显示“AI 建议未写入你的偏好”，不要只显示 `ai_agent / suggestion`。
4. **纠正离证据最近。** 用户不应跳到另一个管理页找这条记忆。
5. **原文和系统判断视觉分层。** 原文保持原样，标签明确是 Personal AI 的派生判断。

### 嵌入式回执层级

#### L0：静默

单一 owner、低责任、无冲突时不展示。

#### L1：一句总结

保存混合内容后：

> 已分清 4 类：你的决定 1 · 他人观点 1 · AI 建议 1 · 待验证假设 1。只有明确决定可进入事实/画像候选。

#### L2：证据 chip

Ask / Lens / Compose 使用混合证据时显示：

- `你明确说过`
- `Alice 转述·仅作背景`
- `AI 建议·未采纳`
- `假设·不当事实`
- `Jira 已验证`

#### L3：就地详情与纠正

用户点 chip 后看到：原文 span、归属依据、允许进入的记忆层、影响过的派生对象，以及两个动作：

- `这不是我的观点`
- `这是我的决定`

动作提交前文案必须说明：**只修正 Personal AI 的派生归属；不会改原聊天、会议或 Jira。**

### 各现有 surface 的接入

| Surface | 用户看见什么 | 不做什么 |
| --- | --- | --- |
| Memory Capture | 保存后一句混合归属回执 | 不弹新审查页 |
| Source Memory 详情 | evidence span 的 owner/mode/verification | 不把 source-only 候选升格 |
| Ask | 答案使用了哪些主张，哪些只作背景 | 不暴露全部内部 chain-of-thought |
| Memory Lens | 只有混用/降级时显示小标签 | 不为每条记忆堆徽章 |
| Compose Assist | “代表你”的句子只使用 self/adopted claims | 不把 AI 建议伪装成用户立场 |
| Meeting Outcome Binder | 指派 → 接受 → 验证链 | 不把 transcript mention 当 done |
| Today / Action Queue | “你已接受”与“别人指派”分开 | 不自动接受任务 |
| User Profile | 高影响候选显示主张证据与纠正入口 | 不新增逐条质检 inbox |

### Demo 说明

同目录 HTML 模拟了真实 Web AI / 会议 / Ask 宿主中的嵌入效果，而不是独立管理页。建议依次体验三个场景：

1. “混合 AI 对话”：点不同高亮主张，看写入权限差异，再点“记住这段”。
2. “会议承诺”：比较被指派、明确接受、AI 推测和 Jira 已验证。
3. “Ask 召回”：查看系统为何只回答用户最后决定的 Vue，并尝试就地纠正归属。

---

## 技术实现范围

### 后端建议

1. 新 migration：`memory_claims`、`memory_claim_revisions`、`memory_claim_links`。
2. 新核心模块：
   - `ClaimSegmenter`：确定性 span 切分；
   - `ClaimAttributionResolver`：规则 + 严格 LLM；
   - `ClaimPolicyCompiler`：纯函数写入/消费政策；
   - `ClaimCorrectionService`：revision、失效与审计。
3. `IngestionPipeline` 在 entity/profile/opinion/action/ledger candidate 之前生成 claim envelope。
4. `SourceMemoryDistiller` 复用 claim span，不再单独生成无法关联 owner 的 evidence span。
5. `MemoryChangeLedgerService` 从 claim policy 读取 authority；禁止只因 parent message `ownerAuthored` 就升级整个事件。
6. Ask / context-recall 返回 compact `attributionReceipt`；正常单一 owner 时字段可省略，避免 response inflation。
7. 导入器保留 provider message role / participant；旧数据用 backfill shadow 模式处理，不改 raw。

### API 草案

```json
{
  "attributionReceipt": {
    "used": [{"kind": "self", "count": 1}],
    "backgroundOnly": [
      {"kind": "named_person", "count": 1},
      {"kind": "ai_agent", "count": 1}
    ],
    "blocked": [{"kind": "hypothesis", "count": 1}],
    "summary": "本轮使用 1 条你的明确决定；2 条外部观点仅作背景；1 条假设未当作事实。"
  }
}
```

纠正端点：

```http
POST /memory-claims/:claimId/corrections
{
  "correction": "not_my_view | my_decision",
  "expectedRevision": 3,
  "source": "ask_receipt"
}
```

响应必须返回：旧/新 attribution、失效的派生对象数量、是否需要异步重算，以及 `rawSourceChanged=false`。

### 旧数据兼容

- Phase 0 只 shadow 分类最近 90 天和高责任候选的 evidence source，不改变现有结果。
- 先对 profile / current truth / accepted commitment 做高精度 backfill；普通 episodic memory 不需要一次性全量重算。
- 缺原文、sender 或 role 时保留 `unknown`；不利用 summary 反推确定归属。
- 老 candidate 只有在 claim envelope 重新通过 policy 后才可获得新的 owner authority；不能批量默认 self。

### 性能预算

- 确定性分段 P95 < 10ms / message。
- LLM 只处理 ambiguous span；目标调用率 < 20%，并支持 batch。
- 入库异步时先保存 raw，再以 `attribution_pending` 阻断高责任派生写入；不能因超时回退到“全是 self”。
- Ask 只读取预计算 claim，不在查询热路径重新判定。
- `attributionReceipt` 只在 mixed / downgraded / corrected 时返回。

---

## 安全、隐私与权责边界

- 归属推断本身是派生数据，可能错误；UI 必须叫“系统判断”，不能伪装成原始来源事实。
- 人名只在源里明确出现或由 participant mapping 确定时赋值；否则 `named_person/unknown`，不猜身份。
- 外部 AI provider 不明确时统一为 `ai_agent`，不要从文风猜 Claude / ChatGPT / 豆包。
- 会议音频 speaker mapping 的生物识别/声纹不在本能力范围；只消费用户已授权的 speaker label。
- 敏感 profile 写入继续沿用现有确认/排除政策；正确归属并不等于可以无限使用。
- 不向第三方连接器回写纠正，除非用户在对应动作上再次明确授权。
- 纠正、自动升级、降级都写 audit；用户可撤销最近一次纠正。
- raw deletion、用户删除与 retention 继续服从现有生命周期/级联删除约定。

---

## 分期计划

### Phase 0：离线基线与 shadow contract（1–2 周）

- 建 claim schema、deterministic segmenter 与 policy compiler。
- 从经过脱敏的真实 owner-authored / AI import / meeting / Jira 样本建立基线集。
- 只 shadow 运行，不影响画像、事实、Action 或回答。
- 量化现有 message-level gate 会放行哪些 mixed claims。

**退出条件：** 人工复核样本定义稳定；不能把未知默认成 self；可追到原 span。

### Phase 1：保护高责任写入（2–3 周）

- 接入 User Profile、opinion candidate、Change Ledger、accepted commitment。
- AI suggestion / reported speech / hypothesis 默认禁止升格。
- 为 correction 建 revision、derived invalidation 和审计。
- 先对新入库流量生效，旧数据只处理被实际消费到的候选。

**退出条件：** 画像/当前事实/承诺的 false-owner 写入率达到门槛；失败路径 fail-closed。

### Phase 2：消费回执与采用链（2 周）

- 接 Ask、Lens、Compose、Memory Capture、Meeting Binder。
- 上线 L1/L2 回执与就地纠正。
- 建 AI suggestion → accepted → acted → verified 状态边。

**退出条件：** 回执只在 mixed / downgraded 场景出现；用户能理解后果；无徽章泛滥。

### Phase 3：渐进 backfill 与跨入口统一（持续）

- 覆盖 Smart Import、MCP、外部 AI、Glip、Jira、Calendar、meeting transcript。
- 按高责任、近期、常用顺序惰性 backfill。
- 观察纠正数据与 drift，不自动把它沉淀成用户性格画像。

---

## Eval 决策：必须建立真实场景 eval

### 为什么必须

这项能力核心依赖 claim segmentation、角色/转述判断、假设识别、承诺状态和消费门禁；单元测试只能证明规则执行，无法证明真实中英混合消息里“谁说了什么”判断够可靠。实现后必须创建 eval，并持续改进直到所有门槛通过。

### 实现时要新增

- `evals/cases/memory-claim-attribution/`：真实场景、脱敏的 JSONL fixture。
- `evals/workflows/memory-claim-attribution.json`：摄入 → 归属 → 写入政策 → Ask/Compose/Meeting 消费。
- registry entry + `readerProof`：结果必须从真实 service response / DB 派生，不允许 grader 读取 fixture 里的 expected 伪装成 runtime output。
- report 必须包含 per-category confusion matrix、abstention、policy violation 与典型失败样本。

### 真实样本来源

优先从 `10.32.56.212` 的 `esone.qiu` 记忆服务中只读抽取并脱敏：

- 同一条消息混合“我决定 / 他人说 / AI 建议 / 假设”；
- ChatGPT / 豆包导入的 user/assistant role；
- Jira comment 中引用他人、mention 多人、owner-authored 的场景；
- meeting transcript 的多 speaker、问句、指派、接受和 done receipt；
- 中英夹杂、嵌套引用、反问、否定、讽刺、ASR 错词、`done?` 与 `done`。

若线上没有某个安全边界样本，再人工构造红队 case；不能为了方便只测规整英文句子。

### 指标与门槛

| 指标 | P0 门槛 | P1 上线门槛 |
| --- | ---: | ---: |
| 非 self claim 被错误判成 self | ≤ 3% | ≤ 1% |
| quote / reported speech 隔离 recall | ≥ 92% | ≥ 97% |
| hypothesis / simulation 不写 current truth | 100% | 100% |
| AI suggestion 不写 user profile（无采纳证据） | 100% | 100% |
| assigned 与 accepted commitment 区分准确率 | ≥ 92% | ≥ 97% |
| verified completion 无独立 receipt 的违规升级 | 0 | 0 |
| ambiguous 样本 abstain 而非猜 self | ≥ 95% | ≥ 98% |
| 中文 / 英文关键类别差距 | < 8pp | < 5pp |

实现后的标准命令建议：

```bash
npm run eval:validate
npm run eval:run -- --suite memory-claim-attribution --no-repair
npm run eval:memory-abilities
```

若任一安全门槛未达标，继续改进规则、prompt 或 policy，并重新跑完整 report；不能用“整体平均分高”掩盖 false-owner 或 false-completion。

### 确定性测试

- segment offset/hash、unicode、中文引号、嵌套 quote、reply header；
- policy matrix 全组合；
- unknown / timeout / malformed LLM output fail-closed；
- correction revision、并发 expectedRevision、撤销、派生失效；
- cascade delete、export/import、schema version；
- API schema 在无 mixed claim 时省略 receipt；
- migration 与 restart-safe worker；
- 性能与批量 backfill budget。

### E2E

- Web AI 混合消息 → 保存回执 → Ask 只回答用户决定。
- 会议指派 → 用户接受 → AI summary → Jira receipt，逐步升级不越级。
- Compose 只能使用 self/adopted claim 代表用户措辞。
- 用户点“这不是我的观点”后，原文不变、画像/事实候选失效、Ask 下一次不再误用。

---

## 成功指标与监控

### 质量指标

- `false_self_attribution_rate`
- `false_profile_write_rate_from_quote_or_ai`
- `false_completion_rate`
- `unknown_abstention_rate`
- `user_correction_rate`，按来源 / 语言 / speech mode 分桶
- `correction_recurrence_rate`：同类错误是否重复发生

### 体验指标

- 混合证据回答的用户“不相关/错误”反馈下降。
- “这不是我的观点”纠正后 7/30 天内不再误用。
- 回执展开率只作为诊断，不能以低展开率判定无价值。
- L1 receipt 在普通场景展示率应低，避免 Personal AI 变成标签机器。
- Ask/Compose 延迟不因热路径重新分类而明显上升。

### 运行告警

- attribution worker backlog / failure / timeout；
- high-responsibility candidate 在 attribution pending 时被错误放行；
- source hash mismatch；
- LLM output unknown 比例突然下降（可能意味着过度猜测）；
- correction invalidation 未覆盖的 orphan candidate。

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 语言歧义、讽刺、嵌套引用 | 归错 owner / mode | 高责任默认 unknown；真实多语言 eval；允许就地纠正 |
| 标签过多破坏体验 | 用户感觉被系统审稿 | 正常静默；只在 mixed / downgraded / high-impact 显示 |
| 规则与 LLM 不一致 | 不同入口结论漂移 | 单一 contract + policy compiler；规则优先；版本化 |
| AI 建议“被复制”误当采纳 | 伪造用户偏好 | copy 不等于 accept；需要发送、明确接受或 outcome |
| 旧数据 sender 缺失 | backfill 误归属 | unknown，不从摘要反推；惰性高责任 backfill |
| 增加写入延迟 | 捕捉失败或积压 | raw 先存、派生 pending；异步 worker；规则优先 |
| 与 injection / authority 混成一个分数 | 安全语义不可解释 | 独立正交字段，固定 gate 顺序 |
| 用户纠正造成外部副作用误解 | 信任受损 | 提交前/后明确“只改 Personal AI 派生归属” |

---

## 验收清单

### 功能

- [ ] 同一 message 能生成多个独立 claim span。
- [ ] claim owner、speech mode、polarity、time basis、verification 正交分离。
- [ ] owner-authored parent 不再自动把全部 span 升成 self。
- [ ] AI 建议、转述、quote、hypothesis 无法进入用户画像/当前事实。
- [ ] assigned 与 accepted 分离；verified completion 需要独立 receipt。
- [ ] Ask / Compose / Meeting 可消费统一 policy。
- [ ] 用户纠正不改 raw，能失效所有相关派生对象并可撤销。

### 体验

- [ ] 普通明确消息保持静默。
- [ ] mixed message 保存后只出现一句清晰回执。
- [ ] Ask 能解释用了什么、屏蔽了什么，但不暴露内部推理链。
- [ ] 就地纠正明确实际写入范围与无外部副作用。
- [ ] 390px 宽度下回执与纠正动作可用，无横向滚动。

### 证据

- [ ] 真实脱敏 eval 全部安全门槛通过并生成 report。
- [ ] `npm run eval:memory-abilities` 六能力无回归。
- [ ] deterministic tests、API/E2E、migration/restart proof 通过。
- [ ] shadow report 能量化旧 message-level gate 的风险下降。

---

## 实现完成后的文档维护

功能代码最终完成、验证通过后，必须把关键点和关键逻辑精简维护进 canonical docs，不能让本 plan 成为长期 source of truth。

建议：

1. 以 [`docs/features/memory_system.md`](../features/memory_system.md) 为主文档，写入 claim schema、gate 顺序、写入政策、迁移/删除/审计边界和 verifier。
2. 在 [`docs/features/memory_capture.md`](../features/memory_capture.md) 记录保存后的归属回执与 Source Memory span 复用。
3. 在 Ask、Compose Assist、Meeting Pilot、User Profile 对应文档中只补各自消费契约和用户回执，不复制完整算法。
4. 更新 [`docs/features/index.md`](../features/index.md)，增加一个“记忆主张归属”小功能点并链接主文档。
5. 只有当 claim contract 将来拥有独立生命周期、公开 API 和多个维护者，才考虑新建 `memory_claim_attribution.md`；P0/P1 默认并入 `memory_system.md`，避免文档碎片化。
6. 把真实 verifier 名称、eval suite、关键失败关闭语义和最近验收日期写进 canonical docs。

---

## 需要你决策的点

### 建议直接采用的默认项

- 产品名：**记忆主张归属**；技术名：`Memory Claim Attribution`。
- 形态：底层 contract + 嵌入式 receipt，不做独立页面。
- 首期范围：画像、当前事实、承诺/完成三类高责任写入。
- 歧义策略：默认 unknown / fail-closed。
- 修正策略：只改派生归属，保留 raw 与 revision audit。
- Eval：必须，且 false-owner / false-completion 为硬门槛。

### 仍可调整

1. 用户界面是否把“主张”改成更口语的“谁的观点”；建议内部用 claim，UI 用自然语言。
2. L1 回执是仅在“记住这段”后展示，还是 Ask 混用证据时也展示；建议两处都展示，但普通单一 owner 场景静默。
3. 用户选择“这是我的决定”后是否立即建立 profile/fact candidate；建议只更新归属，仍通过各目标层自己的 authority / sensitivity gate。

---

## 最终建议

建议进入实现评审。

Personal AI 的长期价值不是“记得更多”，而是能长期保持**谁说过什么、用户真正采纳了什么、什么还只是一个假设**。现有系统已经有来源、信任、时间、证据对齐和输出身份边界；记忆主张归属正好补上它们之间最容易被忽略、也最伤信任的一层。它对用户几乎不增加操作，却能同时改善画像、Ask、Compose、会议、行动和跨 AI 记忆，是一个适合做成平台机制的能力。
