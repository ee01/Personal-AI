# 新能力：Evidence Cohesion Gate / 证据同场门

> 生成时间：2026-07-08 CST
> Codex 会话标题：新能力：证据同场门  
> Demo：[`evidence-cohesion-gate-demo.html`](./evidence-cohesion-gate-demo.html)
> 状态：待决策，仅计划与 demo，不做代码实现

## 真实场景 1：Ask 不再把相似项目混成一个答案

用户在 Quick Ask 里问：

> UMW 的 repo 和 purpose 现在到底是什么？

没有证据同场门时，Personal AI 可能召回到这些看起来都相关的线索：

1. Unified Messaging Workspace 的群消息里有 repo 和 purpose。
2. 另一个 `rc-ai-learning` game repo 的 ownership / counting 问题。
3. RCV Project Review、AI Notes、meeting note 等也出现了 `workspace`、`AI-assisted engineering`、`repo`。
4. 旧 reflection thread 里还有“repository_url 是否会变”的外部查证动作。

如果这些证据直接进入 Ask 或 delegation prompt，模型会很容易把“同样是 repo / AI / project”的不同问题拼成一个貌似完整的答案。

有证据同场门之后：

1. Ask 先锁定 subject：`Unified Messaging Workspace`。
2. 召回候选进入 `EvidenceCohesionGate`，按 `subjectKey`、`sceneAnchor`、`evidenceRefs`、时间窗口、source type、claim slot 分组。
3. 门控发现 5 条候选里只有 2 条和 UMW 的 `purpose/repository_url` 同场；2 条属于 `rc-ai-learning` game repo，1 条只是 AI Notes 群背景。
4. Ask 第一行显示：`证据同场：通过 · 使用 2 条同场证据，排除 3 条跨题线索`。
5. 用户点开详情，可以看到被排除线索的理由：`subject mismatch`、`project anchor conflict`、`only shares generic token: repo`。

体验变化：用户看到的是“这个回答只用了同一个问题的证据”，而不是只能事后从引用里猜有没有混入别的项目。

## 真实场景 2：Action Queue 委派前先拦住串题外部核实

线上真实样本里，`actions?status=queued&limit=8` 返回的前几条 `delegate_openclaw` 都是事实跟进类任务，其中一条围绕 `artem-petrenkov1-oathbound-arena · attachment_id` 的 action，`evidenceRefs` 同时带了：

- `entity_property:1735`
- 一条 repo ownership 消息
- `document-teams-direct-routing...`
- `document-recording...`
- `project-be-uss-value-change-optimization`

这些 evidence 可能都来自同一段系统历史，但未必都属于“这个 repo 的 attachment_id 是否继续变化”这个问题。现在如果直接委派给 OpenClaw，外部核实 prompt 会带着多余项目和文档线索，增加错误查证和重复动作。

有证据同场门之后：

1. Reflection Worker 准备创建 `delegate_openclaw` action 前，先把候选 evidence 送进 Gate。
2. Gate 判断主问题是 `repo:artem-petrenkov1-oathbound-arena / claim:attachment_id stability`。
3. `project-be-uss-value-change-optimization`、`document-teams-direct-routing` 与主 subject 不同场，只能作为 `background_excluded`，不能进入外部委派 prompt。
4. Action Queue 显示：`委派前已拦截 3 条跨题证据；本次只带 repo property + 原始 repo message`。
5. 如果剩余同场证据不足，action 不会被创建成 pending delegation，而是回到 `needs_evidence` 或复用 Evidence Watch 的 blocked receipt。

体验变化：减少“看起来很勤奋但其实查错方向”的外部任务，用户不需要手动清理错误 action。

## 为什么要做

Personal AI 已经有大量记忆能力：Memory Lens、Ask、Source Memory Distiller、Keystone Memory Briefs、Evidence Watch Contracts、Prompt Context Compiler、Outcome Loop。下一阶段的风险不是“没有找到记忆”，而是“找到了太多相似但不同场的记忆”。

证据同场门解决的问题是：

> 在记忆被回答、反思、外部委派、context pack 或 prompt patch 消费之前，先判断这些证据是否真的属于同一个问题。

它不是摘要器，也不是新的页面；它是一层消费前的契约。它能让 Personal AI 更像可靠的私人记忆伙伴：宁可说“这些证据不是同一件事，需要先分开”，也不要把相似词拼成一个自信答案。

## Idea 来源

本次没有使用 Reminder 选题。本机 Reminders 可读，列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`，没有名为 `Personal AI` 的列表，因此没有可随机选择的新功能 idea，也没有需要标记 done 或写备注的 Reminder item。

本方案来自：

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- `docs/progressing/` 与 `docs/features/` 排重。
- automation-2 近期记忆：已覆盖 Source Memory Distiller、Keystone Memory Briefs、Memory Change Simulator、Prompt Context Compiler、Evidence Watch Contracts 等方向；本轮不能再产出“更好摘要”或“更多资料蒸馏”的近似方案。
- 当前线上 `10.32.56.212` 的 `esone.qiu` memory-service 只读信号。
- 2025-2026 年 context engineering、RAG 诊断、source-grounded AI 和 agent guardrails 的产品/论文趋势。

## 当前真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`，只做只读检查：

- `GET /health` 可达，但返回 `degraded`，全局 database connected 为 false。
- `GET /api/v1/stats` with `X-User-Id: esone.qiu` 可读，返回：
  - `messages.total = 10877`
  - `messages.today = 58`
  - `messages.thisWeek = 432`
  - `messages.last90Days = 3530`
  - `chunks.total = 9443`
  - `relationships.total = 51279`
  - `confirmRequests.pending = 28`
  - retrieval tiers：`active = 1230`、`archive_only = 7238`、`forgotten = 4055`、`weak = 1090`
- `GET /api/v1/reflection-threads?status=active&limit=8` 返回 active total `740`。样本里多个 fact-following thread 已反思 100-300 次，常见 `continueReason = waiting_for_delegation` 或 `waiting_for_confirm_request`。
- `GET /api/v1/actions?status=queued&limit=8` 的样本里，前 8 条都是 `delegate_openclaw` / `evidence_watch` 相关事实核实。它们说明当前系统已经在积极查证变化事实，但 action prompt 里可能混入同词不同场证据。

这些信号说明：系统已经很会召回、反思和继续查证，但还缺少一个横切判断：“这些证据能不能放在同一个答案/动作里使用？”

## 业内产品和研究参考

### Drew Breunig / Context Failure

Drew Breunig 的 [How Long Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html) 和 [How to Fix Your Context](https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html) 把长上下文失败拆成 context poisoning、distraction、confusion、clash 等模式。

启发：Personal AI 的问题不是 context window 不够大，而是必须在进入 context 前先做选择、隔离和冲突处理。同场门就是 Personal AI 版本的 context isolation guard。

### Anthropic Context Engineering

[Anthropic - Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context engineering 是在推理时策划和维护最优 token 集合，而不是把所有相关材料都塞进去。

启发：同场门应是运行时能力，不是一次性离线清洗。它要在 Ask、Reflection、Action Queue、Compose/Web AI 不同入口按当前任务裁剪证据。

### OpenAI Agents guardrails / traces / evals

OpenAI Agents SDK 文档里的 [Guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) 说明 guardrails 可自动验证输入、输出或工具行为，并决定继续、暂停或停止；[Agents SDK guide](https://developers.openai.com/api/docs/guides/agents) 也强调 tracing、evaluation loops 和 human review。

启发：证据同场门不应该只是一段 prompt 提示，而应产出可 trace、可 eval、可被 UI 解释的 gate result。高责任动作才需要用户批准；普通跨题噪声应该自动剔除。

### NotebookLM / Microsoft Copilot / ChatGPT Memory Sources

[NotebookLM Help](https://support.google.com/notebooklm/answer/16215270) 说明 NotebookLM 使用用户上传或发现的 sources 来回答；[NotebookLM product page](https://notebooklm.google/) 把 source-grounded 作为核心优势。Microsoft Copilot Studio 的 [knowledge sources](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio) 强调企业数据、网站和外部系统来源，并要求按用户权限访问。OpenAI [Memory FAQ](https://help.openai.com/articles/8590148-memory-faq) 里的 Memory Sources 让用户查看哪些信息影响了个性化回答。

启发：现代 AI 产品都在把 sources 变成用户可见对象。但 Personal AI 还需要比“引用来源”更早一步：引用前先确认这些 sources 是否属于同一个问题。

### RAGChecker

[RAGChecker](https://arxiv.org/abs/2408.08067) 提出细粒度诊断 RAG 检索和生成模块，说明只看最终答案分数不够，需要拆开 retrieval 和 generation 的错误。

启发：实现同场门后，eval 不能只看“答案对不对”，还要单独衡量 retrieval candidates 是否被正确分群、跨题 evidence 是否被排除、缺证时是否拒绝继续。

### LangChain context engineering

[LangChain - Context Engineering for Agents](https://www.langchain.com/blog/context-engineering-for-agents) 把 agent context 策略归纳为 write、select、compress、isolate。

启发：Personal AI 已经在做 write、select、compress；证据同场门补的是 isolate：把相似但不同场的证据隔离开，不让它们共同驱动一个结论。

## 与已有能力和 progressing 方案的边界

| 已有能力 / 方案 | 已经解决什么 | 证据同场门新增什么 |
|---|---|---|
| Ask topic lock / Answer Memory AuthorityGate | 先锁定短问句话题；判断本轮证据是否有权威角色、是否可更新活答案 | Authority 管“证据是否能改变事实”；Cohesion 管“这些证据是否属于同一个问题”。同一 answer 可能权威但不同场，仍需挡住 |
| Evidence Watch Contracts | 对会变化事实建立 source-bound verifier、cadence、stop condition 和重复动作抑制 | Watch 管“这个事实之后还要不要查”；Cohesion 管“本次查证/回答带的证据是否串题” |
| Keystone Memory Briefs | 把跨来源高信号记忆压缩成可复用 brief | Brief 是材料对象；Cohesion 是消费前门控。Brief 也必须经过 Cohesion，避免把相似主题证据合进同一 brief |
| Source Memory Distiller | 单个 source capsule 保存后蒸馏 ready cue、compact memo、trigger matcher | Distiller 不判断多来源候选是否同题；Cohesion 横跨消息、Jira、meeting、source-memory、reflection |
| Prompt Context Compiler | 用户发送外部 AI prompt 前补齐缺失槽位 | Compiler 需要 Cohesion 作为前置输入过滤，避免 prompt patch 混入相似项目 |
| Memory Change Simulator | 启用策略前用历史 trace dry-run 预测影响 | Simulator 可回放 Cohesion Gate 的 would-include / would-exclude；但不替代运行时 gate |
| Compose Assist evidence gate | RingCentral/Jira 输入框场景下过滤低相关 evidence | 现有 gate 是 Compose 专属；Cohesion Gate 是跨 Ask、Reflection、Action Queue、Context Pack、Web AI 的共享服务 |
| Memory Relevance Trainer / Outcome Loop | 从用户反馈和自然行为学习 suppress / boost | Outcome 可以学习 gate 是否过严或过松，但不负责每次实时分群 |
| Memory Trust Console / Authority Contracts | 可信度、来源权威、事实成立边界 | Cohesion 不做全局 trust dashboard，也不让用户每天 review；只在消费前给出同场/跨场/缺锚点结论 |

## 产品定义

### EvidenceCohesionGate

`EvidenceCohesionGate` 是一个后端横切服务，输入是“某个入口准备使用的一组候选证据”，输出是“可以共同使用的同场 evidence set、应排除的跨场 evidence、是否需要拆成多个问题、是否因证据不足而停止”。

```ts
interface EvidenceCohesionGateRequest {
  userId: string;
  entrypoint:
    | 'ask'
    | 'context_recall'
    | 'composer_assist'
    | 'reflection_worker'
    | 'action_queue'
    | 'context_pack'
    | 'keystone_brief';
  intent:
    | 'answer_question'
    | 'generate_draft'
    | 'delegate_external_check'
    | 'build_context_pack'
    | 'distill_brief'
    | 'reflect_fact';
  questionOrTask: string;
  sceneFrame?: SceneFrame;
  selectedTopic?: {
    id?: string;
    label: string;
    aliases?: string[];
    sourceAnchors?: string[];
  };
  claimSlots?: Array<{
    key: string;
    label: string;
    expectedSubject?: string;
    propertyKey?: string;
  }>;
  candidates: EvidenceCandidate[];
  policy?: {
    minPrimaryClusterSize?: number;
    allowBackground?: boolean;
    requireAuthorityForMutation?: boolean;
    maxExcludedInPrompt?: number;
  };
}
```

### EvidenceCandidate

```ts
interface EvidenceCandidate {
  evidenceRef: string;
  sourceType: string;
  title?: string;
  snippet: string;
  sourceAnchor?: string;
  createdAt?: number;
  updatedAt?: number;
  entities?: Array<{ id: string; label: string; type: string }>;
  relations?: Array<{ from: string; to: string; predicate: string }>;
  claimHints?: Array<{
    subject: string;
    propertyKey?: string;
    value?: string;
    stance?: 'supports' | 'contradicts' | 'asks' | 'background';
  }>;
  scores?: {
    recall?: number;
    salience?: number;
    recency?: number;
    authority?: number;
  };
}
```

### Gate result

```ts
interface EvidenceCohesionGateResult {
  state:
    | 'cohesive'
    | 'cohesive_with_background'
    | 'split_required'
    | 'insufficient_anchor'
    | 'conflict_needs_authority'
    | 'blocked_cross_scene';
  primaryCluster: EvidenceCluster;
  secondaryClusters: EvidenceCluster[];
  excluded: Array<{
    evidenceRef: string;
    reason:
      | 'subject_mismatch'
      | 'project_anchor_conflict'
      | 'conversation_anchor_conflict'
      | 'time_window_conflict'
      | 'claim_slot_mismatch'
      | 'source_echo'
      | 'generic_token_only'
      | 'privacy_or_scope_boundary';
    visibleLabel: string;
    debug?: Record<string, unknown>;
  }>;
  receipts: Array<{
    label: string;
    detail: string;
    tone: 'success' | 'info' | 'warning' | 'blocked';
  }>;
  promptPolicy: {
    mayAnswer: boolean;
    mayGenerateDraft: boolean;
    mayDelegateExternalCheck: boolean;
    mayWriteLongTermFact: boolean;
    includeEvidenceRefs: string[];
    backgroundEvidenceRefs: string[];
    requireUserChoice?: Array<{ clusterId: string; label: string }>;
  };
  metrics: {
    candidateCount: number;
    includedCount: number;
    excludedCount: number;
    clusterCount: number;
    topClusterMargin: number;
  };
}
```

## UX 设计

### 入口 1：Ask / Quick Ask 第一行状态

当 Gate 通过时，Ask 答案正文前显示一行紧凑状态：

> 证据同场：通过 · 使用 2 条 UMW 同场证据，排除 3 条跨题线索

当 Gate 发现 split_required：

> 证据同场：需要先拆开 · 这次召回混在了 UMW、rc-ai-learning repo、AI Notes 三个问题里

用户可以点候选：

- `只回答 UMW purpose/repo`
- `回答 rc-ai-learning repo ownership`
- `重新提问`

选择候选只会重新跑 Ask，不会确认事实、不创建外部查证、不写长期记忆。

### 入口 2：Memory Lens / Compose Assist 的轻提示

Memory Lens 卡片底部显示：

> 同场检查：已排除 4 条仅关键词相似的记忆

Compose Assist 只有在同场证据足够时才显示可插入建议。如果 Gate 失败，输入框旁只显示低打扰静默原因，不显示 icon：

> 已静默：召回候选分成 3 个不同项目，未生成草稿。

这比“完全没出现”更容易排障，但不会打断用户。

### 入口 3：Action Queue / Reflection Worker

外部委派前，如果 Gate 发现候选 evidence 跨题：

- 低风险：自动剔除跨题 evidence，只带 primary cluster 创建 action。
- 中风险：action 进入 `needs_evidence`，显示被拦截 evidence 和原因。
- 高责任：需要用户选择 cluster，才允许继续查证。

Action Queue 里的文案必须避免说“已核实”：

> 委派前检查：暂未创建外部核实任务。5 条候选证据分成 3 个问题；请选择要查哪一个，或让系统继续收集同场证据。

### 入口 4：Context Pack / Web AI prompt patch

当用户准备把 Personal AI 记忆带给 ChatGPT / Claude / Gemini / 豆包时，context pack 顶部显示：

> Context Pack 已同场裁剪：只包含 `Task Estimate field rules`，未包含 `Jira import secret` 和 `MTR original estimate`。

这能减少把内部错题、旧事实、相似项目塞给外部 AI 的概率。

## 判断逻辑

### Cohesion signals

Gate 不应该只靠 LLM 判断。P0 建议先做确定性 + 小模型/LLM 复核的混合：

1. **Subject anchor**：issue key、repo slug、project id、conversation id、person id、meeting id。
2. **Claim slot**：这条证据是在说 `repository_url`、`attachment_id`、`purpose`、`deadline`、`owner_eta`，还是只是背景。
3. **Scene anchor**：当前页面/输入框/Ask topic 的 group、thread、Jira、URL、source anchor。
4. **Time compatibility**：同一个事实是否存在新旧变更；旧证据不能和新证据无说明地合并。
5. **Source role**：authority / supporting / background / query / prior。
6. **Generic-token penalty**：只共享 `AI`、`repo`、`meeting`、`status`、`project` 这类泛词时降权。
7. **Contradiction grouping**：矛盾证据可同场，但必须标成 conflict；不同 subject 的证据不能因为矛盾而被硬合并。

### Cluster states

| State | 用户含义 | 系统行为 |
|---|---|---|
| `cohesive` | 证据在讲同一个问题 | 正常回答 / 生成 / 委派 |
| `cohesive_with_background` | 主证据同场，少量背景可解释 | prompt 中背景限量且降权 |
| `split_required` | 召回分成多个问题 | Ask 返回候选；Action 不创建 pending 外部任务 |
| `insufficient_anchor` | 没有足够锚点判断 | 请求更多上下文或静默，不编答案 |
| `conflict_needs_authority` | 同场但事实冲突 | 进入 AuthorityGate / Evidence Watch |
| `blocked_cross_scene` | 跨隐私/范围/外发边界 | 阻止进入 context pack / draft / delegation |

## 集成点

### P0 建议集成

1. `AskService` / `/ask`：在 final answer prompt assembly 前调用 Gate。
2. `ReflectionWorker`：创建 `delegate_openclaw` 或 `confirm_request` 前调用 Gate。
3. `ContextRecallService`：在 Scene Memory Autopilot 之后、返回 cards 前写入 `cohesionReceipt`。
4. `ContextAssistService` / `/composer/assist`：在可插入 draft 生成前过滤 evidence；Web AI context pack 必须通过 Gate。
5. `ActionQueue.vue`：展示 `needs_evidence` / `split_required` 回执。

### P1 再集成

- Keystone Memory Briefs：brief build 前必须 Gate；ready brief 输出保留 cluster proof。
- Memory Change Simulator：回放候选 gate policy 对过去 7/30 天影响。
- Eval report reader：新增 `cohesion` suite 的 proved / not proved sections。
- Outcome Loop：收集 gate 的 false positive / false negative signals。

## 数据表建议

P0 可以先不新增大表，只把 gate result 作为 response debug / trace event 保存。若要持久化，建议新增：

```sql
CREATE TABLE evidence_cohesion_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entrypoint TEXT NOT NULL,
  intent TEXT NOT NULL,
  subject_key TEXT,
  state TEXT NOT NULL,
  candidate_count INTEGER NOT NULL,
  included_count INTEGER NOT NULL,
  excluded_count INTEGER NOT NULL,
  cluster_count INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_evidence_cohesion_runs_user_time
ON evidence_cohesion_runs(user_id, created_at DESC);
```

不要把完整原文重复存一遍；只存 evidence refs、hash、聚类结果、可显示摘要和排除原因。

## 风险和防护

| 风险 | 具体表现 | 防护 |
|---|---|---|
| 过严导致有用证据被排除 | 用户问跨项目比较时 Gate 误判 split | intent 支持 `compare` / `multi_subject_summary`，允许多个 primary clusters 但必须分别标注 |
| 过松导致仍然串题 | 泛词 overlap 过高 | 泛词惩罚、subject/claim slot 硬锚点优先、eval 覆盖错题 |
| UI 增加噪音 | 每次都显示一大段 gate 解释 | 默认只显示一行 receipt；详情折叠 |
| 变成新 review queue | 用户要处理大量 split | P0 不做队列。只有高责任 action 才要求选择，普通 Ask 直接返回候选按钮 |
| LLM 判断不稳定 | 同一候选多次 gate 结果不同 | P0 用确定性 feature 作为主判断；LLM 只做 difficult case tie-break，并把 feature trace 写入 eval |
| 与 AuthorityGate 混淆 | 开发者把“可信”当“同场” | 文档和类型明确：cohesion before authority；只有同场证据才进入 authority 判断 |

## Rollout phases

### P0：Ask + Reflection Worker 的消费前同场门

- 实现 `EvidenceCohesionGateService`。
- Ask prompt assembly 前过滤 evidence，返回 `cohesionReceipt`。
- Reflection Worker 创建 external delegation 前过滤 evidence；split 时不创建 pending action。
- Action Queue 支持 `needs_evidence` 状态回执。
- 新增 `evidence-cohesion-gate` eval suite。

### P1：Compose / Web AI / Context Pack

- Web AI context pack 和 prompt patch 必须通过 Gate。
- Compose Assist 的 strict evidence filter 改为调用共享 Gate。
- Memory Lens card 显示轻量同场排除回执。

### P2：Brief / Simulator / Outcome learning

- Keystone Memory Briefs 构建前接入 Gate。
- Memory Change Simulator 能预演 Gate 对历史 trace 的 include/exclude 影响。
- Outcome Loop 学习 gate 是否过严/过松，并生成可撤销 policy patch。

## Eval 决策

需要创建 eval。这个能力的价值依赖召回候选分群、跨题剔除、LLM/规则判断、Ask 答案质量和委派行为边界，不能只靠单元测试。

实现后必须新增：

- `evals/cases/evidence-cohesion-gate/cases.jsonl`
- `evals/workflows/evidence-cohesion-gate/experience.md`
- `tools/eval-evidence-cohesion-gate.ts`
- `evals/registry.yaml` 注册，建议 weekly 或 14 天一次

首批真实场景应来自 `10.32.56.212` 的 `esone.qiu` 数据：

1. UMW purpose / repository_url：同场证据应保留，rc-ai-learning repo 证据应排除。
2. `artem-petrenkov1-oathbound-arena · attachment_id`：repo property/message 保留，BE USS / Teams Direct Routing 等跨题背景排除。
3. AppSheet status：同场但证据不足，应进入 `conflict_needs_authority` 或 Evidence Watch，而不是合并无关 project。
4. Task Estimate 口径：跨消息/Jira/Sheet 但同一个 workflow，可通过 `cohesive_with_background`，验证 Gate 不会把合法跨来源合成误杀。
5. 多项目比较问句：intent 为 compare 时允许多个 clusters，但答案必须分段，不能把结论合并。

报告必须回答：

- 哪些 evidence 被保留，为什么。
- 哪些 evidence 被排除，为什么。
- Gate 是通过、拆分、证据不足还是冲突。
- Ask / Action Queue 是否遵守了 gate result。
- 不证明什么：不证明外部系统已经查证、不证明事实已更新、不证明所有未来主题泛化。

实现完成后必须运行：

```bash
npm run eval:validate
npm run eval:run -- --suite evidence-cohesion-gate --no-repair
```

如果结果不达标，应继续改进 feature extraction / clustering / prompt policy，直到 eval 全部通过。

## 文档交接

如果用户批准实现，完成代码后要把关键行为维护进正式文档：

- `docs/features/ask.md`：补 `cohesionReceipt`、Ask 第一行状态、split 候选选择边界。
- `docs/features/memory_system.md`：在 Memory Service 横切能力里新增 Evidence Cohesion Gate，说明它在 recall/answer/action 前的位置。
- `docs/features/compose_assist.md`：若 P1 接入，更新 Compose 专属 evidence gate 为共享 Gate 调用。
- `docs/features/evidence_watch_contracts.md`：说明 Watch 前会先做 Cohesion，避免 external verifier 串题。
- `docs/features/index.md`：若有独立可感知 receipt / route / eval，新增“小功能点：证据同场门”。

没有必要新建独立 `docs/features/evidence_cohesion_gate.md`，除非 P0 后它有独立 API route、独立页面或多个功能文档无法承载的复杂决策逻辑。

## 决策建议

建议推进 P0，但前提是限定范围：先做 Ask + Reflection Worker，不要一口气改所有召回入口。

原因：

1. 当前真实数据已经出现跨题 evidence 进入外部核实 prompt 的风险。
2. Ask 和 Reflection Worker 是高收益入口：一个影响用户答案，一个影响外部委派成本。
3. 它补的是 Personal AI 记忆系统的底层可靠性，不是又一个 dashboard。
4. 它能直接提升后续 Keystone Briefs、Prompt Context Compiler、Evidence Watch、Memory Change Simulator 的输入质量。

第一版成功标准很简单：

> Personal AI 可以明确说出“这次我用了哪些同场证据、排除了哪些跨题证据、为什么暂时不能把它们合成一个回答或外部任务”。
