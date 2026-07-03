# 新能力：Evidence Cohesion Gate / 证据同场门

> 生成时间：2026-06-29 CST  
> Codex 会话标题：新能力：证据同场门  
> 状态：待决策，仅规划与 demo，不做代码实现  
> Demo：[`evidence-cohesion-gate-demo.html`](./evidence-cohesion-gate-demo.html)

## 真实场景 1：Ask 不再把相邻 Jira 证据混成一个结论

用户在 Quick Ask 里问：

> MTR-145975 的 story point 现在还是 68 吗？如果不确定，帮我留一个 OpenClaw 查证。

现在容易发生的坏体验：

1. Ask 先锁定 `MTR-145975`，但 recall 同时捞出 `MTR-144266 DEV Estimate Original = 3`、`MTR-148115 DEV Estimate New = 0.4`、`Q3 initiatives must have estimate` 等相邻 estimate 证据。
2. 这些证据都带有 `estimate / story point / DEV Estimate` 词，LLM 很容易把“另一个 ticket 的估算口径”写进本 ticket 的答案。
3. 如果 Evidence Watch / Reflection 继续把这个混合上下文交给 OpenClaw，外部查证动作会带着错误 problem frame，后续又产生更多“事实跟进”债务。

有证据同场门之后：

1. Ask 召回后、LLM 生成前，`EvidenceCohesionGate` 先建立 `problemFrame = {subject: MTR-145975, property: story_points_new, intent: status/fact_followup}`。
2. Gate 把候选证据按 subject / property / source anchor / time / authority role 分组：
   - A 组：`MTR-145975 story_points_new = 68`，同场。
   - B 组：`MTR-144266 DEV Estimate Original = 3`，同类但不同 issue。
   - C 组：`MTR-148115 DEV Estimate New = 0.4`，同类但不同 issue。
3. Gate 只允许 A 组进入答案生成；B/C 组进入 `quarantinedEvidence`，只能作为“相邻经验，不可作为本 ticket 证据”。
4. 如果 A 组证据不足，Ask 的第一行回执显示：`证据同场不足：已排除 2 组相邻 estimate，建议只查 MTR-145975 权威来源`。
5. 创建 OpenClaw action 时只带 A 组 anchor 和要查的 property，不把别的 ticket estimate 混进去。

用户感受：Personal AI 不是“找到了很多相似记忆”，而是先确认这些记忆是不是同一个问题。它宁可说“只够查证，不够下结论”，也不把相邻项目的证据包装成当前答案。

## 真实场景 2：Reflection 不再把同名项目、人、仓库线索串错

远端真实数据里有很多 queued `delegate_openclaw` action，例如：

- `事实跟进: Nova CA - Brandy · mailing_group_email`
- `事实跟进: NOVA-13780 · assignee`
- `事实跟进: rc-ai-learning · repository_url`
- `事实跟进: nikita-karatun-shinobi · repository_url`

现在的风险是：Reflection 看到 `NOVA`、`rc-ai-learning`、`repository_url`、`AI Notes`、`Brandy` 这些词都和当前工作有关，就把不同对象的证据放进同一轮外部核实，生成一个看似完整但其实混场的查证任务。

有证据同场门之后：

1. Reflection run 生成 proposal 前先调用 Gate。
2. Gate 发现 `Nova CA - Brandy mailing_group_email` 和 `NOVA-13780 assignee` 都属于 NOVA 生态，但一个是 mailing group，一个是 Jira assignee，不是同一 property。
3. 如果同一轮要查多个 property，Gate 要求拆成两个 `cohesionGroup` 或两个 action；如果只是要回答一个 property，则排除另一个。
4. Reflection detail 里只显示一个低打扰回执：`已拆分 2 个同名 NOVA 线索，未创建混合查证`。

Before：系统很勤奋地追很多“可能有关”的事实，但用户后来很难判断某个 OpenClaw action 到底在查什么。  
After：每个答案、查证动作、context pack 都带一个更窄的 problem frame，减少错误上下文扩散。

## 结论

建议设计新能力：**Evidence Cohesion Gate / 证据同场门**。

一句话：

> 在 Ask、Reflection、OpenClaw 委派、Context Pack 或 Prompt Patch 使用记忆之前，先判断候选证据是否属于同一个问题；不属于同场的证据要被缩窄、拆分、澄清或隔离。

它解决的不是“召回不到”，而是“召回到了很多看似相关、实际不该一起使用的证据”。Personal AI 越积累消息、Jira、会议、网页、AI 对话和操作记忆，这个问题越重要。

推荐 P0 做成底层消费前 gate，不新增用户 review queue，不新增独立管理页：

- Ask：在 Active Recall 后、EvidenceResolutionPlanner / LLM 前运行。
- Reflection：在生成外部查证 action 前运行。
- Action Queue / Evidence Watch：复用同一个 `problemFrame` 和 `cohesionReceipt`。
- UI：只在发生缩窄、拆分、阻断或澄清时显示简短回执。

## Idea 来源

本次没有使用 Reminder 选题。本机 Reminders 可读，当前列表为 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`，没有名为 `Personal AI` 的列表，因此没有可随机选择的新功能 idea，也没有需要标记 done 或写备注的 Reminder item。

本方案来自：

- 上轮 automation-2 已经完成概念筛选并定名 `Evidence Cohesion Gate / 证据同场门`，但没有写出 `docs/progressing` plan/demo；本轮补齐产物。
- `docs/progressing/to-verify.md` 当前为 `暂无。`
- `docs/features/index.md`、`docs/features/ask.md`、`docs/features/compose_assist.md`、`docs/features/evidence_watch_contracts.md` 与相邻 `docs/progressing` 方案去重。
- `10.32.56.212` 上 `esone.qiu` 当前 memory-service 数据盘的只读 SQLite 聚合。
- 当前 RAG / agent context / tracing / eval 的产品和研究趋势。

## 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`：

- HTTP memory-service 入口 `10.32.56.212:3210` 当前连接失败或超时，本轮不假装 API 可读。
- SSH 只读访问远端 SQLite 成功，使用 `file:...memory.db?mode=ro&immutable=1` 查询，没有写入线上数据。
- 当前聚合：
  - `messages_total = 10933`
  - `chunks_total = 9622`
  - `entities_total = 14012`
  - `relationships_total = 53013`
  - `confirm_pending = 29`
  - `reflection_active = 817`
  - `actions_queued = 104`
  - `actions_failed = 178`
  - `source_capsules = 558`
  - `conversation_frames = 127`
- queued action 样本大量是 `delegate_openclaw` / `reflection_run`，标题形态为 `继续外部核实: 事实跟进: <subject> · <property>`，包括 `MTR-145975 story_points_new = 68`、`MTR-144266 DEV Estimate Original = 3`、`NOVA-13780 assignee`、`Gemma 4 license`、`rc-ai-learning repository_url` 等。
- active reflection thread 样本显示多个事实已经反思 100+ 次，例如 `RingClaw.security_review_status`、`RCV AI Notes - post GA 1.status`、`MTR-148115 DEV Estimate Original/New`、`Codex.update_status`。
- `messages_raw` 来源分布以 `glip = 9900` 为主，其次有 `calendar = 369`、`meeting = 317`、`jira = 93`、`web = 81`。

这些信号说明：

1. 系统不是缺少记忆，而是已经有很多跨来源、跨时间、相邻主题的证据。
2. Reflection / OpenClaw 已经形成大量“事实是否变化”的持续跟进，错误 problem frame 会放大成本。
3. Ask、Reflection 和外部委派都需要在使用证据前做一次“同场检查”，否则再好的 Evidence Watch、Keystone Brief 或 Prompt Compiler 也可能消费了混场证据。

## 为什么值得做

### 1. 它补的是召回系统最危险的一类错：相似但不同场

普通 recall 排名通常能找到相似内容，但相似不等于可以一起作为证据。`estimate`、`AI Notes`、`NOVA`、`repository_url`、`license` 这类词在用户工作记忆里会大量复用。一个回答或外部 action 只要混进另一个 ticket / 项目 / property 的证据，就会造成两类后果：

- 答案看起来有来源，实际来源不支持当前结论。
- 外部查证动作带着混合上下文运行，后续反思和确认请求继续积累债务。

### 2. 它符合用户当前优先级：重要记忆提取准确度

用户近期已经把方向从密码/secret 存储拉回“重要记忆提取的准确度”。证据同场门不做新 UI 娱乐，也不要求用户审核每条记忆，而是把“高信号记忆能否被正确消费”做成底层门控。

### 3. 它减少用户操作，而不是新增 review queue

P0 不建“证据审核中心”。只有在系统本来要回答、生成 context pack、创建外部查证或进入高影响写入时，才显示一行回执：

- `证据已缩窄`
- `证据被拆成 2 个候选问题`
- `证据同场不足，等待澄清`
- `已阻断混场查证`

用户不会每天多一个待办列表。正常同场时保持静默。

### 4. 它能让现有能力更可信

- Ask 的答案更少混入相邻 project/ticket。
- Reflection 的 fact-following action 更窄。
- Evidence Watch 的 contract 不会绑定错误 subject/property。
- Keystone Memory Briefs 可以引用同场证据，而不是把相似工作经验当同一个结论。
- Prompt Context Compiler 可以在外发给其他 AI 前排除不该带出的相邻证据。

## 行业产品和研究参考

### OpenAI Agents tracing / guardrails / evals

[OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/) 把 agent 运行拆成 trace / span，适合定位哪一步用了哪些工具和上下文；[Guardrails](https://openai.github.io/openai-agents-python/guardrails/) 强调在 agent 执行前后加校验；[OpenAI Evals](https://platform.openai.com/docs/guides/evals) 用来把真实失败样本固化成回归测试。

启发：证据同场门应该产出可追踪的 `cohesionReceipt` 和 eval case，而不是只在 prompt 里写一句“请注意相关性”。

### Anthropic context engineering

[Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 agent 的上下文管理不是把所有信息塞进去，而是选择、压缩、隔离与清理。

启发：Personal AI 的记忆很多，关键不是“给更多上下文”，而是先决定哪些上下文可以同场使用。

### Microsoft Copilot grounding

[Microsoft 365 Copilot architecture and grounding](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-architecture) 强调 grounding 会把用户 prompt 与组织数据结合，并依赖 Graph / search / permission 等边界。

启发：grounding 需要权限和来源，也需要 problem frame；有权限的数据如果不属于同一个问题，仍然不应该进入答案。

### NotebookLM sources

[NotebookLM](https://notebooklm.google/) 的产品心智是以用户选定 sources 为基础生成摘要和回答。

启发：源集合本身就是边界。Personal AI 的难点是 sources 来自消息、Jira、会议、网页、AI 对话和反思线程，因此需要自动判断“这些 source 是否属于同一个问题集合”。

### Lost in the Middle

[Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) 指出模型在长上下文中对中间信息利用不稳定，更多上下文不必然带来更好回答。

启发：混入更多相邻证据会增加模型误用概率。Gate 应该缩窄上下文，而不是把相似内容都交给 LLM 自己判断。

### Corrective RAG / Self-RAG / RAGChecker

- [Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884) 引入 retrieval evaluator 来评估检索文档质量，并对不可靠检索做纠正。
- [Self-RAG](https://arxiv.org/abs/2310.11511) 让模型对检索和生成进行自我反思与 critique。
- [RAGChecker](https://arxiv.org/abs/2408.08067) 提出细粒度诊断框架，关注 retrieval 与 generation 的不同错误来源。

启发：证据同场门是 Personal AI 里的 retrieval evaluator，但判断对象不是“文档质量”本身，而是“这些证据能否服务同一个用户问题、同一个 subject/property 和同一个场景动作”。

## 与已有能力和 progressing 方案的边界

| 能力 / 方案 | 已解决什么 | 证据同场门新增什么 |
|---|---|---|
| Ask topic lock / Active Recall | 先判断用户在问哪个话题，再多通道召回 | topic lock 解决“问哪个话题”，Cohesion Gate 解决“召回来的证据是否真的属于同一个 problem frame” |
| Answer Memory AuthorityGate | 旧 prior 不能当新事实，只有 authority evidence 能更新活答案 | AuthorityGate 判断证据角色和更新授权；Cohesion Gate 先判断这些 authority / supporting evidence 是否同场 |
| Evidence Watch Contracts | 可变化事实进入持续复核 contract，去重外部查证 | Watch 管“何时复核/是否变化”；Cohesion Gate 管“创建或复用 contract 前，subject/property 是否混场” |
| Prompt Context Compiler | 用户发外部 AI prompt 前补齐缺失槽位 | Compiler 消费上下文；Cohesion Gate 防止不属于同一问题的上下文被编进 prompt |
| Keystone Memory Briefs | 把跨来源高信号记忆整理成可复用 brief | Brief 是可复用摘要对象；Cohesion Gate 是每次消费前的边界检查，可阻止 brief/证据被错用 |
| Memory Change Simulator | 上线前 dry-run 新策略影响 | Simulator 可以回放 Cohesion Gate 的影响；Gate 是实际运行时的门控 |
| Source Memory Distiller | 单个 source-memory capsule 保存后蒸馏成 cue/memo | Distiller 处理单 source；Cohesion Gate 处理多 source 候选是否能一起用 |
| Memory Outcome Loop | 学习 cue / draft / action 是否有效 | Outcome Loop 可学习 Gate 的错误放行/过度阻断；Gate 不新增反馈表单 |
| Memory Egress Firewall / Persona Projection | 外发/身份投影边界 | Egress/Projection 管是否可外发或代表用户；Cohesion Gate 管内容是否同场，发生在更早一步 |

## 产品定义

### EvidenceCohesionGate

`EvidenceCohesionGate` 是一个 consumption-time service。它不替代 recall，也不改写原始记忆。它只在某个能力准备消费一组 evidence 时，输出“允许、缩窄、拆分、澄清、阻断”的决定。

核心判断：

```ts
type CohesionDecisionState =
  | 'cohesive'          // 证据同场，可直接消费
  | 'narrowed'          // 排除部分相邻证据后可消费
  | 'split_required'    // 候选证据分属多个问题，需要拆成多个 action / answer branch
  | 'clarify_required'  // 用户问题或 scene anchor 不足，需澄清
  | 'insufficient'      // 只有相邻证据，没有当前 subject/property 的证据
  | 'blocked_mixed';    // 高风险混场，禁止生成结论或外部 action
```

### Problem Frame

每次 Gate 调用先建立 `problemFrame`：

```ts
interface EvidenceProblemFrame {
  frameId: string;
  userIntent:
    | 'ask_answer'
    | 'fact_followup'
    | 'reflection_proposal'
    | 'context_pack'
    | 'prompt_patch'
    | 'delegation_action';
  subjectKey?: string;       // issue / project / person / repo / meeting / conversation
  subjectLabel?: string;
  propertyKey?: string;      // status / estimate / assignee / url / license / mailing_group
  sceneKey?: string;         // jira issue, glip thread, ask session, reflection thread
  timeframe?: {
    asOf?: number;
    recencyWindowDays?: number;
  };
  explicitConstraints: {
    scope?: 'work' | 'personal' | 'both' | 'all';
    sourceTypes?: string[];
    groupIds?: string[];
    projectIds?: string[];
  };
}
```

P0 不要求完美语义解析。可以先用已有 `contextMatch`、issue key、source anchor、entity id、property role terms 和 scene key 生成 frame。

### Evidence Feature

每个候选 evidence 先抽取轻量 feature：

```ts
interface EvidenceCohesionFeature {
  evidenceId: string;
  sourceType: string;
  sourceRefId?: string;
  title?: string;
  subjectHints: string[];
  propertyHints: string[];
  sceneHints: string[];
  authorityRole: 'authority' | 'supporting' | 'derived' | 'prior' | 'query';
  timestamp?: number;
  recallScore?: number;
  lexicalOverlap: number;
  entityOverlap: number;
  propertyOverlap: number;
  contradictionRisk?: 'low' | 'medium' | 'high';
}
```

P0 先做 deterministic features：issue key exact match、entity id、source anchor、property keyword、source type、time freshness、authority role。后续再引入 LLM/cross-encoder 判断。

### Cohesion Result

```ts
interface EvidenceCohesionResult {
  decision: CohesionDecisionState;
  frame: EvidenceProblemFrame;
  primaryGroup?: {
    groupId: string;
    subjectKey?: string;
    propertyKey?: string;
    evidenceIds: string[];
    confidence: number;
    reason: string;
  };
  splitGroups: Array<{
    groupId: string;
    label: string;
    evidenceIds: string[];
    suggestedAction: 'answer_branch' | 'separate_watch' | 'ask_clarification' | 'drop';
  }>;
  quarantinedEvidenceIds: string[];
  allowedEvidenceIds: string[];
  blockedReason?: string;
  receipt: {
    label: string;
    detail: string;
    tone: 'muted' | 'info' | 'warning' | 'danger';
    hiddenAdjacentCount: number;
    splitGroupCount: number;
    sourceAsOf?: number;
    userActionRequired: boolean;
  };
  trace: {
    featureVersion: string;
    gateVersion: string;
    thresholds: Record<string, number>;
  };
}
```

## UX 设计

### 展示原则

1. 默认静默：`decision='cohesive'` 且没有排除证据时，不增加 UI。
2. 发生排除或拆分时，在当前 surface 的第一屏显示短回执。
3. 回执只说明“本轮证据消费边界”，不建新管理页。
4. 用户可展开看 `为什么排除`，但默认不要求用户处理。
5. 如果需要用户澄清，只给 2-4 个候选 problem frame，而不是原始 evidence 列表。

### Ask 中的体验

Ask 答案正文前显示：

```text
证据同场门：已排除 2 组相邻 estimate，只使用 MTR-145975 / story_points_new 的 3 条证据。未确认当前 Jira 权威值，已准备单一查证目标。
```

如果拆分：

```text
这个问题命中了 2 个不同对象：MTR-145975 story point、MTR-144266 DEV Estimate。请选择要继续哪个。
```

### Reflection / Action Queue 中的体验

Reflection detail 中显示：

```text
证据同场门：NOVA mailing group 和 NOVA-13780 assignee 已拆分为两个查证目标，本轮没有创建混合 OpenClaw action。
```

Action Queue item 中显示：

```text
查证目标已缩窄：subject=MTR-145975, property=story_points_new。相邻 issue estimate 已隔离。
```

### Context Pack / Prompt Patch 中的体验

当用户准备把上下文给外部 AI：

```text
上下文已缩窄：只包含当前 Jira issue 的 estimate 证据；相邻 ticket 的 estimate 经验只保留为“通用注意事项”，不作为事实来源。
```

这比“敏感内容是否可外发”更早：即使内容不敏感，也可能因为不同场而不该外发。

## 实现计划

### P0：deterministic gate

目标：不依赖 LLM，先覆盖最常见的混场风险。

改动范围：

- 新增 `memory-service/src/core/EvidenceCohesionGateService.ts`
- 新增轻量类型到 `memory-service/src/types/index.ts`
- Ask route / service：Active Recall 后调用 gate，再进入 EvidenceResolutionPlanner / LLM。
- ReflectionWorker / ReflectionThreadService：创建 action proposal 前调用 gate。
- ActionExecutor / EvidenceWatchContractService：接受 `problemFrame` 和 `cohesionReceipt`，用于 action idempotency 和 UI receipt。
- Search Result / Reflection Detail / Action Queue UI：显示短回执。

P0 特征：

- exact issue key / source anchor / entity id match
- property keyword map：`estimate/story point/DEV Estimate`、`assignee/owner`、`status/ready`、`repository_url/url`、`license`、`mailing_group`
- authority role：Jira field / source memory / raw message / prior answer / reflection summary
- same-scene bonus：same Jira issue、same Glip thread、same source capsule、same reflection thread
- adjacent penalty：same project but different issue、same property but different subject、same subject but different property

P0 门槛示例：

- `primaryGroup.confidence >= 0.72` 且 top-second gap >= 0.18：`cohesive` 或 `narrowed`
- top two groups close 且 subject/property 不同：`split_required`
- allowed evidence < 2 且 only adjacent evidence：`insufficient`
- high-risk writeback/delegation with mixed groups：`blocked_mixed`

### P1：semantic cohesion and contradiction handling

目标：处理没有明确 issue key 的会议、AI 对话、网页资料、同名项目。

新增能力：

- LLM structured classifier：输出 subject/property/scene/freshness，不生成答案。
- contradiction detector：同一 property 出现不同值时，不直接取新值，交给 Evidence Watch / AuthorityGate。
- source family policy：meeting transcript / source memory / Jira field / raw Glip 的角色不同。
- prompt pack compiler：把 `allowedEvidenceIds` 传给 Prompt Context Compiler，禁止它消费 quarantined evidence。

### P2：outcome learning

目标：从用户行为和 eval 里学习 gate 是否过严或过松。

新增能力：

- `cohesion_gate_events`：记录 `narrowed/split/blocked/overridden/user_selected_frame`。
- Outcome Loop 消费：用户选择某个 split option、手动恢复被隔离 evidence、或标记答案混场，都写低副作用 trace。
- Memory Change Simulator 支持回放：启用 Gate 前后，多少答案会被缩窄/拆分/阻断。

## 风险与对策

| 风险 | 表现 | 对策 |
|---|---|---|
| Gate 过严 | 明明可用的相邻经验被排除，答案变空 | P0 只在高影响消费前强阻断；普通 Ask 可以降级为“相邻经验仅供参考” |
| Gate 过松 | 仍然把别的 ticket / project 证据放进答案 | eval 加入真实混场 case；高风险 writeback/delegation 默认宁可 split |
| 用户被澄清打断 | Ask 经常要求选择候选 | 只有 top groups 接近且会影响结论/外部 action 时才澄清；其他情况自动 shrink |
| UI 又变成复杂证据面板 | 用户需要读很多 evidence | 默认只显示一行 receipt；展开才看证据分组 |
| 与 AuthorityGate 重复 | 两个 gate 都说证据问题 | CohesionGate 在前，管 same problem；AuthorityGate 在后，管 evidence role / stance update |
| 无法从弱资料抽 subject/property | 网页、会议语义模糊 | P0 不强行处理全部场景；P1 引入 structured classifier 和 source-specific parser |

## 验证与 evals

需要新增 eval suite。原因：功能价值依赖召回后证据选择、拆分、阻断和 LLM 答案质量，不是简单单元测试能覆盖。

实施完成后必须：

1. 新建 `evals/cases/evidence-cohesion-gate/cases.jsonl`。
2. 新建 `evals/workflows/evidence-cohesion-gate/experience.md`。
3. 在 `evals/registry.yaml` 注册，建议 weekly 或 manual+pre-merge。
4. 先用真实 `esone.qiu` memory-service 数据抽样，再脱敏固化成 case。
5. 跑：

```bash
npm run eval:validate
npm run eval:run -- --suite evidence-cohesion-gate --no-repair
```

6. 输出 Reader Contract report；如果任一关键 case fail，继续改 gate 直到通过。

建议首批真实场景：

- `MTR-145975 story_points_new=68` vs `MTR-144266 DEV Estimate Original=3`：应只允许当前 issue 证据。
- `MTR-148115 DEV Estimate Original=0.3` vs `DEV Estimate New=0.4`：应识别同 subject 不同 property，不可混写。
- `Nova CA - Brandy mailing_group_email` vs `NOVA-13780 assignee/cc`：应拆分不同 property。
- `rc-ai-learning repository_url` vs `nikita-karatun-shinobi repository_url`：应识别不同 repo subject。
- `Codex update_status` vs AI model recommendation：应阻断同为 AI 工具但不同 subject 的混场。

评估指标：

- `allowedEvidencePrecision`: allowed evidence 中同 subject/property 的比例。
- `adjacentEvidenceQuarantined`: 相邻但不同场证据是否被隔离。
- `answerUnsupportedClaimRate`: 答案是否引用了 quarantined evidence。
- `unnecessaryClarificationRate`: 是否过度要求用户选择。
- `delegationFramePurity`: OpenClaw action 是否只携带一个 subject/property。

同时保留普通验证：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-ask.test.ts src/__tests__/api-context-recall.test.ts
npm --prefix memory-service run build
npm start # 等首个 webpack successful compile 后停止
git diff --check -- docs/progressing/evidence-cohesion-gate-plan.md docs/progressing/evidence-cohesion-gate-demo.html
```

如果改动触碰 memory recall/write path，按 `AGENT.md` 还要跑：

```bash
npm run eval:memory-abilities
```

## 文档维护要求

如果后续决定实现，完成功能代码后必须把关键点维护进正式 feature docs：

- `docs/features/ask.md`：补 Ask 链路中的 Cohesion Gate、返回 receipt、澄清边界。
- `docs/features/memory_system.md`：补核心引擎图、数据契约、与 RecallEngine / EvidenceResolutionPlanner / Outcome Loop 的关系。
- `docs/features/evidence_watch_contracts.md`：补创建 contract/action 前的 `problemFrame` 和 `cohesionReceipt`。
- `docs/features/compose_assist.md`：如果 Prompt Context Compiler 消费 Gate，补 prompt patch/context pack 边界。
- `docs/features/index.md`：新增“证据同场门”小功能点。

如果该功能实现并迁入 `docs/features/`，应删除本 `docs/progressing/evidence-cohesion-gate-plan.md` 和 demo，或将 demo 移到合适的 `docs/demo/` 目录，避免长期双源。

## Demo

本次 demo 是集成式页面，不是独立新后台。它模拟 Personal AI 的 Ask / Reflection / Action Queue 现场，并展示同场门如何在生成答案或创建 OpenClaw action 前缩窄证据。

- 文件：[`evidence-cohesion-gate-demo.html`](./evidence-cohesion-gate-demo.html)
- 语言：中文为主，保留真实记忆里的英文技术词。
- 交互：可切换 `Ask`、`Reflection`、`Context Pack` 三个场景；可查看 allowed/quarantined evidence 和 first-screen receipt。
- 边界：demo 所有数据都是本地示例，不读写 memory service，不创建 action，不发送消息。

## 推荐决策

建议进入实现评审，优先级高于再开一个新页面型能力。

原因：

1. 当前真实数据里 fact-following、Reflection、OpenClaw action 已经很多，混场成本会被后台循环放大。
2. 该功能是底层质量门，不增加用户日常操作。
3. 它能直接提高 Ask、Reflection、Evidence Watch、Prompt Compiler、Keystone Briefs 的可靠性。
4. P0 可以用 deterministic 规则先落地，风险可控，eval 可明确证明是否减少混场。
