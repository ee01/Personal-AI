# 新能力：Artifact Memory Lineage / 成果记忆链（搁置）

> Codex 会话标题建议：新能力：成果记忆链（搁置）  
> 生成日期：2026-05-27  
> Demo：[artifact-memory-lineage-demo.html](./artifact-memory-lineage-demo.html)  
> Idea 来源：未使用 Reminder。本机 Reminders 当前可见列表没有 `Personal AI` 清单，因此没有可随机选择的新功能 idea，也没有需要标记 done 的事项。本方案来自项目目标、`esone.qiu` 真实记忆只读查询、现有 `docs/progressing` 去重，以及近期 AI 产品和 provenance / source attribution 研究。

## 搁置原因

本方案先记录为搁置方向。

关键判断是：大部分用户日常打开的 Google Docs、Sheets、Jira、Slides、PR 等成果资料并不是用户本人维护的成果物，用户多数情况下只是阅读、引用或信任这些资料。对这类“他人维护的成果资料”，Personal AI 不需要维护一套成果来源链；它更应该把它们作为可信来源资料消费，进入 Memory Capture / Source Memory / Memory Lens / Ask / Context Passport 等已有链路。

`Artifact Memory Lineage` 真正可能有价值的范围，是**用户本人维护或由 Personal AI 帮用户生成、写回、持续更新的成果**，例如用户主导的估算文档、用户用 AI 写回的 Jira comment、用户维护的个人报告、用户自己的分享稿或未来明确归属到 Personal AI 的输出物。这个范围比原计划窄很多，且需要先明确“我维护的成果”的判定方式、归属边界、用户是否愿意承担维护成本，以及它应如何复用 Lens / Source Memory / Freshness Radar，而不是新建一套成果管理台。

因此短期不建议进入实现。未来如果重新评估，应先从“我维护的成果”这个限定范围出发，并优先作为 Memory Lens 的 artifact 模式或 Source Memory 的补充能力，而不是独立一级产品。

## 一句话

把用户产出的 Google Docs、Sheets、Jira comment、Slides、PR、AI report 等“成果物”变成 Personal AI 的一等记忆对象，并保存它们从哪些会议、消息、网页、Jira、AI prompt、Context Pack、人工修改而来。下次用户打开成果物或相关场景时，Personal AI 能直接回答：**这份东西为什么存在、依据是什么、哪些假设还有效、哪些来源变化会影响它、怎么安全复用给下一个 AI 或同事。**

## 为什么要做

Personal AI 已经在记“我看过什么”“别人说过什么”“会议里发生什么”“AI 给过什么建议”。但真实工作中还有一个很容易丢失的对象：**我最后产出的东西**。

用户近期真实记忆里有明显信号：

- `messages_raw` 当前约 10015 条，主要来源为 `glip 8727`、`web 440`、`meeting 361`、`system 246`、`calendar 210`、`jira 20`。
- 2026-05-26 有网页记忆捕获到 Google Docs：`Story Points estimation by AI Service`、`Task Estimate / Nova Epic Estimate 使用说明与改进分析`。
- Jira 记忆里出现多条 `Esone's AI` 写回 comment，例如更新 Dev estimate、Story Points、Vertical Track、Team 等。
- 日历里有 `CoP - 基于AI的个人发展和工具`、`Bug - AI 先修一遍我再看`、`Estimating projects for 26Q3 (Q Planning)` 等真实场景。
- 用户长期偏好是“凡事先让 AI 跑一遍”，这会产生越来越多 AI 辅助生成的文档、表格、评论、报告和代码改动。

目前的问题是：这些产物被保存为网页记忆、Jira 记忆、AI 对话 artifact 或会议摘要时，**来源链是断开的**。用户以后打开一份估算文档，只能看到文档本身或相关记忆，不能稳定回答：

- 这份文档是基于哪几条 Jira / RingCentral / Google Sheet / 会议记忆生成的？
- 里面哪些数值是 AI 算的，哪些是人改过的？
- 当 Story Points 或 Q planning 规则变了，哪些文档、Jira comment、Context Pack 会被影响？
- 我要把这份文档继续交给 Codex / ChatGPT / 豆包时，应该带哪些最小上下文？
- 这份成果后来有没有被会议、Jira 或其他文档引用？

`Artifact Memory Lineage` 的目标不是让用户多维护一个台账，而是在现有产出动作旁边轻轻补一条“成果来源链”，让成果物成为可追溯、可更新、可复用的私人记忆节点。

## 已有能力避让

| 已有/搁置方向 | 解决什么 | 本方案边界 |
|---|---|---|
| `Operation Memory Flight Recorder` | 记录完整跨工具操作 episode | 成果记忆链不录全流程，不记录每个点击，聚焦最终产物及其来源、假设、后续影响 |
| `Memory Reality Check`（搁置） | 输出后逐 claim 核验事实 | 本方案不先做事实审稿，只保存来源和影响链；高风险 claim 可转给未来核验器 |
| `Memory Freshness Radar` | 来源变化后生成 memory patch | 本方案消费 source delta，把“哪些成果受影响”展示给用户 |
| `Source Memory Distiller` | 把长资料变成 source memory capsule | Distiller 是 source 到 memory；本方案是 artifact 到 source / memory / prompt 的反向链 |
| `AI Context Passport` | 把当前任务上下文打包给外部 AI | 成果记忆链可以为某个 artifact 生成 Passport，但不替代 Passport |
| `Memory Storyline Builder` | 生成面向分享/汇报的故事线 | Storyline 产出的稿件也可以被本方案记录 lineage；本方案不负责写故事 |
| `Memory Trust Console`（搁置） | 全局质量治理 | 本方案只治理具体成果物的来源链和影响链，范围更小 |
| `Personal Skill Foundry` | 把反复做事方法沉淀成 skill | 本方案可为 skill 提供成功 artifact 证据，但不做 skill marketplace |

## 行业产品观察

### Google Workspace Gemini

[Google Workspace Gemini 2026 更新](https://blog.google/products-and-platforms/products/workspace/gemini-workspace-updates-march-2026/)强调，Gemini in Docs 可以根据用户相关文件、邮件、会议记录生成初稿，并能匹配写作风格和文档格式。启发是：AI 正在直接参与产出文档，但产品更强调“生成”，较少把“这个文档后来由哪些来源影响、哪些假设变了”做成长期私人记忆。

### NotebookLM

[NotebookLM source help](https://support.google.com/notebooklm/answer/16215270)显示它以 sources 为中心组织材料，也说明部分来源是静态拷贝，某些 Google 文件内容如 footnotes/comments 不会被导入。启发是：source-grounded notebook 很适合研究，但它的来源是 notebook 内的资料集合，不天然覆盖用户产出的 Jira comment、会议后 Google Sheet、AI 生成报告和后续修改链。

### Notion Enterprise Search

[Notion Enterprise Search](https://www.notion.com/en-gb/help/enterprise-search)可以连接 Slack、Teams、Google Drive、Jira 等来源，并让用户缩小搜索范围。启发是：企业知识搜索正在变成多来源聚合入口。Personal AI 的差异应是私人、跨工具、证据到成果的双向链，而不是只回答“在哪个源里找到”。

### ChatGPT Deep Research / connected apps

[ChatGPT deep research](https://help-lb.openai.com/en/articles/10500283-deep-research-in-chatgpt)支持连接 Google Drive / SharePoint 等数据源，输出带 citations / source links 的报告，并展示 activity history。启发是：复杂研究报告需要可复核来源和过程记录。Personal AI 可以把同样的“来源和过程”保存在用户自己的成果物旁，而不是只留在一次 ChatGPT report 里。

### Granola MCP

[Granola MCP](https://docs.granola.ai/help-center/sharing/integrations/mcp)允许 Claude、ChatGPT 等工具查询会议笔记、行动项和决策。启发是：会议记忆会越来越多地被外部 AI 复用。Personal AI 需要知道哪些成果物引用过哪些会议笔记，避免会议记忆只变成散落的查询结果。

## 研究参考

### PROV / provenance 标准

[W3C PROV](https://www.w3.org/TR/prov-overview/)把 provenance 抽象为 entity、activity、agent 以及它们之间的 derived / generated / used 等关系。成果记忆链可以借这个模型，但不需要暴露复杂 RDF/OWL 给用户，只要在底层保持可交换、可扩展的数据结构。

### PROV-AGENT

[PROV-AGENT](https://arxiv.org/abs/2508.02866)指出 agentic workflows 中，prompts、responses、decisions 和下游结果需要与更大的 workflow context 关联起来，才能透明、可追溯、可复现。Personal AI 的成果物恰好是用户私人工作流的下游结果。

### Prompt Provenance Model

[Prompt Provenance](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5682942)把 prompt、completion、dialogue history、user intent、retrieval sources、system messages 和 generated artifacts 都视为 provenance 对象。启发是：AI 对话不是“聊天记录”，而是生成成果物的来源活动。

### Large Language Model Sourcing Survey

[Large Language Model Sourcing: A Survey](https://arxiv.org/abs/2510.10161)把 LLM sourcing 分为 model、structure、training data、external data 等维度，并区分 proactive traceability 和 retrospective inference。对 Personal AI 来说，成果链应该优先做 proactive traceability：在用户产出时就保存最小 receipt，而不是几个月后猜测来源。

### Source Attribution in RAG

[Source Attribution in Retrieval-Augmented Generation](https://arxiv.org/abs/2507.04480)讨论用 Shapley 等方法估计哪些 retrieved documents 真正影响了生成结果。启发是：成果链不应该只保存“相关来源列表”，还应该保存来源贡献度和是否只是背景材料。

### MultiRAG 与 FACTUM

[MultiRAG](https://arxiv.org/abs/2508.03553)指出多来源 RAG 会因为来源稀疏和互相不一致引入幻觉风险；[FACTUM](https://arxiv.org/abs/2601.05866)关注长文 RAG 中 citation 指向不支持 claim 的问题。成果记忆链不承担完整核验，但要把“不确定假设”“冲突来源”“只作为背景的引用”明确记录，避免后续 Ask / Compose / Passport 把它们误当强事实。

## 产品形态

### 1. 成果物旁边的轻量入口

在 Google Docs、Google Sheets、Jira、GitHub PR、Google Slides、RingCentral message thread 等页面，如果 Personal AI 能识别当前页面是一个成果物，右侧出现一个小入口：

- `成果记忆链`
- `已连接 8 个来源`
- `2 个假设需要复核`
- `1 个来源最近变化`

入口只在有足够证据时出现。弱匹配不弹出，最多进入 Memory Exploring 的待补链列表。

### 2. Artifact Lineage Panel

点击入口后打开侧边面板，首屏回答四件事：

1. **这是什么成果**：标题、类型、来源 URL、最近更新时间、当前状态。
2. **为什么产生**：用户意图、触发场景、关联会议/消息/Jira。
3. **依据什么**：来源栈、AI prompt、关键字段、人工修改。
4. **现在是否还可靠**：过期来源、冲突假设、缺失来源、下游影响。

面板不是审计台，不要求用户逐条确认；默认是只读解释。只有缺失来源、高影响更新、敏感外发、冲突假设时才给用户动作。

### 3. Artifact Detail Route

在 `memory-exploring.html` 增加深链详情页，例如：

```text
memory-exploring.html#/artifact/<artifactId>
```

用于从搜索结果、Today Pilot、Freshness Radar、Context Passport receipt、Jira comment、Meeting Pilot 回跳查看完整 lineage。P0 不需要新建一个大型“成果中心”首页，避免变成又一个平台。

### 4. Context Pack for Artifact

对任意成果物，可以生成一个最小 context pack：

- 这个成果的目标；
- 关键来源和证据；
- 当前假设；
- 最近变化；
- 不要外发的内容；
- 建议交给下一个 AI 的任务说明。

这可以直接复用 `AI Context Passport` 的导出格式。

## 核心对象模型

### Artifact

```ts
type ArtifactMemory = {
  id: string;
  artifactType:
    | 'google_doc'
    | 'google_sheet'
    | 'google_slide'
    | 'jira_issue'
    | 'jira_comment'
    | 'github_pr'
    | 'meeting_note'
    | 'ai_report'
    | 'code_diff'
    | 'other';
  title: string;
  canonicalUrl?: string;
  sourceHost?: string;
  ownerHint?: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  status: 'active' | 'stale' | 'superseded' | 'archived';
  sensitivity: 'normal' | 'internal' | 'restricted' | 'private';
  summary: string;
};
```

### Lineage Node

```ts
type ArtifactLineageNode = {
  id: string;
  artifactId: string;
  nodeType:
    | 'user_intent'
    | 'memory_source'
    | 'meeting'
    | 'message_thread'
    | 'jira'
    | 'web_source'
    | 'ai_prompt'
    | 'ai_completion'
    | 'manual_edit'
    | 'derived_artifact'
    | 'decision'
    | 'assumption';
  title: string;
  sourceRef?: {
    type: 'message' | 'chunk' | 'source_memory' | 'calendar' | 'meeting' | 'jira' | 'web' | 'ai_chat';
    id: string;
    url?: string;
    timestamp?: number;
  };
  confidence: number;
  contribution: 'primary' | 'supporting' | 'background' | 'conflicting' | 'unknown';
  preview: string;
  sensitive: boolean;
};
```

### Lineage Edge

```ts
type ArtifactLineageEdge = {
  id: string;
  artifactId: string;
  fromNodeId: string;
  toNodeId: string;
  relation:
    | 'created_from'
    | 'cited_by'
    | 'transformed_by'
    | 'reviewed_by'
    | 'supersedes'
    | 'depends_on'
    | 'influenced'
    | 'contradicts'
    | 'impacted_by';
  weight: number;
  evidenceText?: string;
};
```

### Artifact Receipt

Receipt 是 P0 的关键。它不是保存全文，而是保存可回溯的最小事实：

```ts
type ArtifactReceipt = {
  id: string;
  artifactId: string;
  receiptType: 'created' | 'updated' | 'context_exported' | 'source_attached' | 'impact_detected';
  contentHash?: string;
  titleSnapshot: string;
  sourceRefCount: number;
  primarySourceRefs: string[];
  assumptionCount: number;
  generatedBy?: 'user' | 'personal_ai' | 'codex' | 'chatgpt' | 'doubao' | 'openclaw' | 'unknown';
  reviewState: 'auto' | 'user_confirmed' | 'needs_review' | 'dismissed';
  createdAt: number;
};
```

## 数据来源

P0 可以复用现有数据，不需要先做大规模爬虫：

- `messages_raw`：RingCentral/Glip、web、meeting、calendar、jira、system 等原始记忆。
- `chunks` / `chunks_fts` / `messages_vec`：可召回文本证据。
- `source_memory_capsules` / `source_memory_anchors` / `source_memory_links`：用户主动保存的资料记忆。
- Desktop App explorer 的 conversation artifacts：ChatGPT / Doubao / local agent session 等 AI 对话提炼结果。
- `day_missions` / `today_meeting_preps`：Today Pilot 识别出的任务和会议准备上下文。
- `relationship_context_cards` / `relationship_event_index`：人物和会议里的关系证据。
- `memory_metadata`：salience、consolidation、archive/forgotten 状态，用于判断哪些证据还能影响当前成果。
- `watched_projects` / Project Dashboard 数据：项目、Jira、milestone 相关成果的上下文。

## 生成和匹配逻辑

### Artifact 识别

按可靠度从高到低：

1. 用户显式点击 `绑定当前成果` 或从 Personal AI 生成/复制 context pack 后自动写 receipt。
2. URL 可稳定识别：Google Docs/Sheets/Slides document id、Jira issue key、GitHub PR URL、RingCentral message thread。
3. 当前页面标题和已捕获 web memory 完全匹配。
4. 近期 AI 对话 artifact、Memory Capture、Compose Assist 插入、Jira Automation 写回和当前页面在时间窗口内强相关。
5. 弱匹配只进入建议，不显示强入口。

### Source 绑定

按可靠度从高到低：

1. 生成动作显式携带 `evidenceRefs`，例如 Ask answer、Context Passport、Compose Assist、Storyline、Source Memory Distiller。
2. 用户手动 attach source。
3. 当前 artifact 页面包含来源链接，例如 Jira、Google Sheet、会议链接、PR、Docs link。
4. 时间接近且同一 project/person/topic/thread 的消息或会议。
5. LLM 推断的弱关联，必须标记为 `unknown` 或 `background`，不能作为 primary。

### Contribution 计算

P0 不需要复杂 Shapley 计算，但需要区分：

- `primary`：直接输入、引用、字段来源、用户明确选择。
- `supporting`：与主要结论有关，但没有被直接复制。
- `background`：帮助理解上下文，不能当事实来源。
- `conflicting`：与 artifact 当前内容冲突。
- `unknown`：系统怀疑有关，但证据不足。

### 何时打扰用户

只在以下情况提示：

- 当前 artifact 被多次打开，但没有任何来源链。
- artifact 已被 Today Pilot / Ask / Context Passport 引用过，但来源链缺失。
- 主要来源被 Freshness Radar 标记为 changed/stale。
- 主要假设来自 archived/forgotten memory，但仍在影响当前 artifact。
- 用户准备把 artifact context 外发给外部 AI，且含 restricted/source-private 内容。

否则只保留一个静默入口。

## 用户体验细节

### 首屏文案

首屏不说“我们发现了复杂 provenance graph”。用户只需要看到：

- `这份估算文档来自 8 个来源`
- `主要依据：Jira Story Points 字段、Nova Weekly Q planning sheet、Sophia 的口径确认`
- `需要注意：1 个 Story Points 来源在 2026-05-25 后发生变化`
- `可复制给 AI：最小上下文包，不含 Restricted manager comment 原文`

### 来源栈

来源栈每条只展示三行：

1. 来源标题和类型。
2. 为什么影响这个成果。
3. 可打开证据 / 复制引用 / 标记不是来源。

### 假设账本

把隐含假设从正文里抽出来：

- `Story Points 字段使用 customfield_10422`
- `Dev estimate = Epic 下 child issues sum`
- `QA estimate 不再由 SDK 人月承载`
- `26Q3 planning 使用新 estimation process`

每条都有状态：`仍有效`、`需复核`、`来源过期`、`仅历史背景`。

### 影响提示

当来源变化：

- 不直接改文档；
- 不自动写 Jira comment；
- 只提示“这份成果可能受影响”，并生成更新上下文。

## 真实使用场景

### 场景 1：Story Points estimation 文档

用户打开 Google Docs `Story Points estimation by AI Service`。

Personal AI 右侧显示：

- 这份文档来自 `AI Service` 与 Sophia 的 RingCentral 讨论、Jira `customfield_10422` 口径、Q planning 会议、若干 Google Sheet。
- `NOVA-10893 Story Points = 34` 是 primary source，不是普通背景。
- `Dev estimate as sum of child issues` 有 Jira comment receipt，但 2026-05-25 后 Story Points 有变化，需要检查。

用户点击 `复制给 Codex`，得到一个最小 context pack：目标、字段口径、关键来源、不可外发内容、要 Codex 重新校验的步骤。

### 场景 2：Jira estimate comment 回看

用户打开 Jira `MTR-145087`，页面里有 `Esone's AI: I will help to update the Dev estimate...` 的历史 comment。

Personal AI 显示：

- 这条 comment 是 AI 写回的成果物；
- 它引用了 Epic 下所有 issue 的 Story Points 和当时的 planning rule；
- 该 comment 是 restricted manager context，不默认外发；
- 最近相关 Story Points 变化会影响 Dev/QA estimate，建议生成一条复查包，而不是直接改 Jira。

用户可以打开 `来源链`，看到每个字段来自哪个 Jira child issue、哪个 AI run receipt、哪个 RingCentral 口径确认。

## P0 范围

### P0.1 数据结构

新增迁移：

```sql
CREATE TABLE artifact_memories (
  id TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  canonical_url TEXT,
  source_host TEXT,
  owner_hint TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  summary TEXT,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE artifact_lineage_nodes (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  title TEXT NOT NULL,
  source_ref_type TEXT,
  source_ref_id TEXT,
  source_url TEXT,
  source_timestamp INTEGER,
  contribution TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0.5,
  preview TEXT,
  sensitive INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE artifact_lineage_edges (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0.5,
  evidence_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE artifact_receipts (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  content_hash TEXT,
  source_ref_count INTEGER NOT NULL DEFAULT 0,
  primary_source_refs_json TEXT,
  assumption_count INTEGER NOT NULL DEFAULT 0,
  generated_by TEXT,
  review_state TEXT NOT NULL DEFAULT 'auto',
  payload_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE artifact_lineage_impacts (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  impact_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### P0.2 后端服务

新增 `ArtifactLineageService`：

- `identifyArtifact(scene)`：从 URL/title/source host 识别 artifact。
- `upsertArtifact(receipt)`：写入或更新 artifact memory。
- `attachSources(artifactId, sourceRefs)`：绑定来源节点和边。
- `inferCandidateSources(artifactId, scene)`：只给建议，不直接提升为 primary。
- `getLineage(artifactId)`：返回 artifact、nodes、edges、assumptions、impacts。
- `renderContextPack(artifactId, target)`：生成给 Codex / ChatGPT / 豆包 / OpenClaw 的最小上下文。
- `markSourceNotRelevant(...)`：用户纠错，进入 Ambient Calibration。

### P0.3 API

```text
POST /api/v1/artifact-lineage/identify
GET  /api/v1/artifact-lineage/:artifactId
POST /api/v1/artifact-lineage/:artifactId/sources
POST /api/v1/artifact-lineage/:artifactId/receipts
POST /api/v1/artifact-lineage/:artifactId/context-pack
POST /api/v1/artifact-lineage/:artifactId/feedback
```

所有接口都需要 `X-User-Id`，不带 header 时继续沿用当前 multi-user fallback warning 规则。

### P0.4 前端入口

优先接入：

1. Google Docs / Sheets / Slides 页面：识别 document id 和 title。
2. Jira issue/comment 页面：识别 issue key、comment id、restricted 状态。
3. Ask / Context Passport / Compose Assist / Storyline Builder 产生的 context pack 或 draft：写入 receipt。
4. Memory Capture 保存当前页面时：如果是 artifact 页面，附加 artifact receipt。

P0 不做：

- 不全量抓取 Google Drive；
- 不自动修改 Google Docs/Jira；
- 不做完整事实核验；
- 不做大型成果中心；
- 不从截图/键盘记录推断完整操作链。

## P1 范围

- 接入 `Memory Freshness Radar`：source changed 时生成 artifact impact。
- 在 Today Pilot mission 里显示“你今天要用的成果物有来源变化”。
- 在 Project Dashboard 中按项目聚合 artifact lineage。
- 支持 Google Docs comment / suggestion 的轻量解析。
- 支持 AI 对话 artifact 到成果物的自动绑定，例如 Codex session final answer 对应一个 plan/demo 文件。

## P2 范围

- Artifact graph search：问“哪些文档依赖这个 Q planning 口径？”
- 影响模拟：source 改变后列出可能受影响的 Jira comments、Docs、Slides、Context Packs。
- 团队分享前的安全 context pack：只导出来源摘要和 hash，不带 restricted 原文。
- 与 Skill Foundry 联动：反复成功的 artifact lineage 可以成为 skill evidence。

## 验证计划

### 文档/demo 阶段

- `git diff --check -- docs/progressing/artifact-memory-lineage-plan.md docs/progressing/artifact-memory-lineage-demo.html`
- HTML inline JS syntax check。
- 桌面宽度与移动宽度无横向溢出。

### 后端阶段

- `ArtifactLineageService` 单元测试：
  - Google Docs/Jira/GitHub URL 识别；
  - explicit evidenceRefs 高于弱推断；
  - archived/forgotten memory 不作为 primary；
  - restricted source 不进入外发 context pack 原文。
- API 测试：
  - identify/upsert/get/attach/context-pack/feedback；
  - multi-user isolation；
  - invalid source URL 安全展示。

### 前端阶段

- Google Docs fixture：显示右侧入口、来源栈、假设账本、复制 context pack。
- Jira fixture：restricted comment 不外发原文，影响提示可见。
- Memory Exploring deep link：`#/artifact/:id` 可打开完整 lineage。
- `npm start` 首次 webpack compile。

### 真实数据验证

只读查询 `10.32.56.212`：

- 用 `Story Points estimation by AI Service`、`Task Estimate / Nova Epic Estimate`、`MTR-145087`、`MTR-144800` 作为真实候选。
- 检查是否能绑定 Google Docs / Jira / Glip / AI Service 证据。
- 检查生成 context pack 是否列出 restricted source handling。

## 风险和对策

| 风险 | 表现 | 对策 |
|---|---|---|
| 弱关联误判 | 普通相关消息被当成来源 | 只把 explicit refs / direct links / user attach 设为 primary；弱关联显示为 suggestion |
| 变成又一个重平台 | 用户要维护大量成果物 | P0 只做当前页面轻入口和深链详情，不做中心首页 |
| 与 Flight Recorder 重叠 | 记录太多操作细节 | 不记录点击/窗口切换，只记录 artifact/source/prompt/receipt |
| 与 Reality Check 重叠 | 开始逐句审稿 | P0 只记录来源和假设，不判定每个 claim 真伪 |
| 泄露 restricted 内容 | context pack 把 manager comment 原文带出去 | 默认 hash/summary，外发时只给来源标签和用户可审阅摘要 |
| 来源后续变更太吵 | 每次 Docs/Jira 小变动都提示 | 只在 primary source、被频繁引用 artifact、或 high severity impact 时提示 |

## 亮点

1. **补齐 Personal AI 记忆闭环。** 不是只记输入和对话，而是把最终成果也纳入记忆系统。
2. **比搜索更接近真实用户问题。** 用户常问的不是“哪里有这个词”，而是“这份东西为什么这么写”。
3. **天然服务 AI 协作。** 给 Codex/ChatGPT/豆包的是成果物最小上下文，而不是整段聊天粘贴。
4. **为 Freshness/Forgetting/Calibration 提供落点。** 来源过期、记忆降权、用户反馈都可以影响具体成果，而不是停留在抽象记忆质量。
5. **可渐进落地。** P0 从 receipt 和当前页面侧边栏开始，不依赖全量桌面录屏或跨平台自动执行。

## 推荐结论

建议进入下一步评审。它和最近被用户关心的准确率、来源可解释、AI 生成成果复用高度相关，且不需要先解决跨 AI 自动调度或全局记忆治理。最适合的第一切片是：

1. `ArtifactLineageService` + schema；
2. Google Docs / Jira 当前页面识别；
3. 从现有 `evidenceRefs` 和 Memory Capture 写入 artifact receipt；
4. 右侧轻面板 demo 化落地；
5. 用真实 `Story Points estimation` 和 `MTR-145087` 数据做 read-only 验证。
