# 新能力：Ask/Recall Memory Context Match

> 生成日期：2026-05-19 CST  
> 更新日期：2026-05-28 CST
> 状态：已收敛为 Ask / Context Recall 的通用记忆话题锁定能力，不标记搁置。
> Demo：[`memory-gap-radar-demo.html`](./memory-gap-radar-demo.html)  
> Codex 会话标题建议：新能力：Ask/Recall 记忆话题锁定

## 为什么要做

用户在真实工作里不会每次都贴完整 ticket、sheet、slide、thread 和会议摘要。尤其在 RingCentral、会议、Personal AI Ask 中，经常只会问：

- “那个 BE ready 了吗？”
- “那个新 design 定了吗？”
- “这个 blocker 后来解决了吗？”
- “XMN 那边现在什么状态？”
- “最近那个 MR 合了吗？”

这些问句的核心问题不是 `BE` 或某个关键词，而是缺失“用户脑子里的当前话题”。Personal AI 需要先用近期高频、强互动、强锚点记忆判断用户最可能在问哪个项目 / thread / ticket，再进入证据检索；如果候选接近，应先提示歧义，而不是静默选择一个项目。

外发到豆包 / ChatGPT 前的 prompt enrichment 不属于本能力，已放入 [`docs/features/compose_assist.md`](../features/compose_assist.md) 的下一阶段。

## 产品定义

Ask 和 Context Recall 共享一层 `MemoryContextMatchService`，在正式 recall 前运行。

输入：

- `query`
- `scope`
- 可选 `surface`、`sourceContext`、`currentContext`
- 可选当前页面标题、可见消息、source anchor hints、entity hints、source types

输出：

```ts
{
  state: 'locked' | 'ambiguous' | 'none',
  selectedTopic?: {
    label: string;
    score: number;
    confidence: number;
    reasons: string[];
    anchors: string[];
    roleTerms: string[];
  },
  candidates: Array<{
    label: string;
    score: number;
    confidence: number;
    reasons: string[];
    anchors: string[];
  }>,
  expandedQuery?: string,
  userFacingSummary: string
}
```

用户可见行为：

- `locked`：Ask 开头说明“Memory service 先把这个问题锁定到：xxx”，并列出最近高频、互动、source anchor、角色词等原因。
- `ambiguous`：Ask 不直接编答案，而是列出候选让用户确认；Context Recall 默认不强弹确定结论。
- `none`：走普通 recall，并说明没有足够记忆话题可锁定。

## 检索与打分设计

候选话题来自：

- `conversation_context_frames`
- 最近消息聚合
- watched projects
- entities
- source anchors
- 用户最近参与、回复、被 mention、打开或主动询问过的 thread

通用评分特征：

- query compatibility：词面、alias、角色词、状态意图和 source anchor 是否匹配。
- salience：最近窗口频次、跨来源出现、重要性、是否有 Jira/thread/title anchor。
- interaction：用户发送、回复、被 mention、最近打开或主动询问过。
- recency：按时间衰减。
- penalties：Google Docs UI shell、日历/participant list、泛 backend/team label、无项目锚点的低信号内容。

默认决策：

- `locked`：top score >= 0.72，confidence >= 0.65，且 top-second gap >= 0.18。
- `ambiguous`：top score >= 0.55，但前两名 gap < 0.18。
- `none`：没有足够兼容候选。

锁定后再做证据检索：把 selected topic 的 aliases、source anchors、role terms、source ids 作为 boost/filter。状态类问题只泛化提升“同一话题锚点 + 状态谓词”的句子，不写 BE / VBG 专项规则。

## 存储与提取

第一版不新建第二套事实库，而是把 `conversation_context_frames` 作为轻量 topic frame 来源，并在运行时从最近消息、项目、实体中补齐候选。

长期应把派生索引演进成 `memory_topic_frames` 或扩展 `conversation_context_frames`，每个 topic frame 只存轻量结构：

- label、aliases、roleTerms
- sourceAnchors、sourceIds、recentEvidenceIds
- mentionCount、interactionCount、lastSeenAt、salience
- summary

原始证据仍来自 `messages_raw` / chunks / episodes。topic frame 只负责“先猜用户在问什么”，不能当最终事实来源。

## 已落地实现

- 新增 `MemoryContextMatchService`：
  - 从 `conversation_context_frames`、最近消息、watched projects、entities 生成候选。
  - 支持指代词、角色词、状态意图、source anchor 和当前 context override。
  - 合并同 label 候选，避免 frame/message 重复造成伪歧义。
  - 对 Google Docs UI 噪音、泛 role/team label、低信号来源做通用惩罚。
- `RecallContextExpansionService`：
  - 在原 expansion 前调用 `MemoryContextMatchService`。
  - `locked` 时把 selected topic 变成 expansion candidate。
  - `ambiguous` 时保留歧义并透传 debug。
- `/ask`：
  - 返回 `contextMatch`。
  - `locked` 时在回答开头说明锁定话题，并用 aliases/source anchors/role terms/source ids 强化 evidence recall。
  - `ambiguous` 时返回候选澄清，不继续生成确定答案。
  - 移除了 BE/backend 专项检索路径。
- `/context-recall`：
  - debug 中返回 `contextExpansion.contextMatch`。
  - ambiguous 时不强行展示确定结论。
- `ask-context-gap` eval：
  - 报告展示 query、contextMatch 决策、候选话题、分数、原因、最终 evidence 和评估结论。
  - 样本覆盖 BE readiness 和非 BE 的 `new design` 状态短问句。

## 验证场景

- Unit：无当前 context 的“那个 BE ready 了吗”能锁定近期最强项目话题。
- Unit：两个相近候选时返回 `ambiguous`。
- Unit：Google Docs UI shell 被降权。
- Unit：显式 current context 能覆盖更近但无关的全局话题。
- API：`/ask` 返回 `contextMatch`，并在删除 BE 专项路径后仍能回答“那个 BE ready 了吗？”。
- API：`/context-recall` 对同类短指代 query 使用同一服务。
- Eval：`ask-context-gap` 报告必须能看见提问、候选、分数、锁定/澄清决策、最终证据和结论。

## 参考

- [Generative Agents](https://arxiv.org/abs/2304.03442)：用当前情境动态检索记忆流。
- [MemoryBank](https://arxiv.org/abs/2305.10250)：强调长期记忆的更新、遗忘和重要性。
- [MemGPT](https://arxiv.org/abs/2310.08560)、[Zep Episodes](https://help.getzep.com/v3/episodes)、[Mem0](https://arxiv.org/abs/2504.19413)：长期记忆先作为上下文层，再进入生成。
- [Qulac clarification](https://arxiv.org/abs/1907.06554)、[Microsoft MIMICS](https://www.microsoft.com/en-us/research/publication/mimics-a-large-scale-data-collection-for-search-clarification/)：候选接近时主动澄清能提升检索体验。

## 后续改进

- ingest 时更新更稳定的 `memory_topic_frames` 派生索引，支持 30/90 天 backfill。
- 用用户点击、复制、追问、wrong feedback 校准 contextMatch 权重。
- 等 eval 稳定后再考虑 cross-encoder 或 LLM rerank。
- Ask UI 可以把锁定话题和候选做成更轻量的可展开诊断卡片。
