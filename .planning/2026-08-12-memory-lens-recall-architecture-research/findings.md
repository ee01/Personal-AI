# Findings

## Local Findings

- `AI 结果总结` 不在 Memory Lens 悬浮卡里，而在独立的 Memory Exploring 搜索结果页 `SearchResultPage.vue`；只有 `searchContext.mode === 'entity'` 才显示。用户路径是打开 Memory Exploring，在实体/记忆搜索框执行普通搜索，进入 `#/search?q=...` 后，在结果列表上方点击“总结这些结果”。直接 URL 形态是 `chrome-extension://<extension-id>/memory-exploring.html#/search?q=<query>&scope=<scope>`，但必须由实体搜索建立对应 search context 才是完整产品路径。
- Memory Lens 是注入页面右下角的 Rest → Hover Peek → Expanded Card，没有独立页面；主链为 content script → background → `/context-recall` → `ContextRecallService`。
- `memory_lens.md` 明确记录：页面打开时 `/context-recall` 只匹配已准备好的 Keystone Brief，不调用 LLM；Context Recall 被设计为低延迟、被动、无 LLM 路径。
- Lens 已有 Scene Memory Autopilot、scene frame、over-fetch、重复合并、锚点加权、弱语义隐藏、`lensPresentation` 等展示前机制；文档也记录真实缺陷曾是纯语义 p1 虚高、跨群广播噪声、真正有价值记忆被压后。这说明用户现在感受到的“有关但不是此刻想要”很可能不是单纯缺少 LLM 摘要，而是 query/scene intent 与排序目标仍偏“相关对象”而非“当前信息需求”。
- `AI 结果总结` 的显式请求位于 `memory-exploring-messageHandler.ts`：balanced retrieval + evidence list + summary synthesis，最少 3 条证据、500 token；这与被动 Lens 是两条不同链路。
- 当前 Lens query 主要由页面 `title + primaryText`、secondary texts、entity hints 和 source anchors 经 `RecallContextExpansion` 扩展，再以 vector/FTS 查找“相似/重叠的记忆”。`SceneFrameService` 与 InteractionScene 能识别 `jira_issue_reading` 等场景，但目前没有独立的“用户此刻可能想知道什么/下一步决策是什么”query-planning 阶段。
- Context Recall 明确禁用访问强化、embedding 冷启动，并有 5 分钟 background cache/single-flight；这适合被动低延迟，但也意味着它有意牺牲复杂推理式 query rewrite。
- Browser background 为未收窄的 Context Recall 提供了很宽的默认来源集合：除消息/Jira/Web 等原始来源外，还包括 `daily_log`、`project_summary`、`reflection`、`reflection_thread`、`dream`、`entity_profile`、通用 `markdown`、`source_memory` 和 `user_core`；只有 `rehearsal` 受单独开关控制。因此，只要场景 adapter 没有进一步收窄，MD 派生摘要会实际参与 Lens 的候选竞争。
- `/context-recall` 明确以 evidence-only 方式直接调用 `RecallEngine`，参数为 `reinforceAccess:false`、`allowEmbeddingColdStart:false`；它本身不做实时生成。通常通道是 vector + FTS；passive-fast 模式还可由环境开关降到仅 FTS 或直接保持安静。
- 这带来一个比“MD 是否检索”更重要的架构点：reflection、dream、project summary 与原始 Jira/消息证据的事实权威性和用途不同，若放在同一候选池里只靠相关度排序，派生记忆很容易成为语义很像、但不适合作为此刻答案的噪声。

## External Research

- 用户提到的项目名称可以较可靠地映射为：`jackwener/llm-wiki`（Karpathy LLM Wiki pattern 的 CLI/skill 实现）、LangChain 的 OpenWiki Brains、`garrytan/gbrain`、`NousResearch/hermes-agent`。其中 `hermens` 应是 Hermes Agent。
- LLM Wiki 的主张是 raw source 不变、LLM 将知识编译成互联 Markdown wiki、query 后把新价值写回，搜索采用 BM25 + 可选 vector/RRF；它优化的是“反复重算同一知识”和人/agent 可读维护，不是被动页面上的即时意图判断。
- GBrain 明确区分 world knowledge（GBrain）、agent operational memory、session context；自身用页面 + hybrid search + typed knowledge graph，并在 query 层做带引用的 synthesis 与 gap analysis。这个分层思想与本项目区分事实、用户规则、当前页面上下文高度相关。
- Hermes Agent 是 agent harness：会话 FTS5 搜索后由 LLM 总结、周期性 memory nudges、技能自生长和用户模型。它解决跨会话代理连续性，不等价于面向任意网页 surface 的低延迟 Recall 服务。
- OpenWiki Brains 被定位为 proactive/general-purpose wiki memory，需进一步核对其写入/检索/刷新机制和官方仓库。
- OpenWiki Brains 的“proactive”发生在采集/编译侧：先配置 brain focus prompt，connector 按目标主动抓取，定时把信息刷新成 Markdown wiki。官方同时承认当前 retrieval 仍只是文件系统 wiki，FTS/MCP/semantic/agentic search 还在探索。因此它能改善“记住什么”，不能直接证明能改善 Lens 的“此刻展示什么”。
- OpenWiki 当前仓库比首发博文更进一步：connector 先落 raw data/manifests，再由 source-specific agent 合成 `~/.openwiki/wiki`；wiki 为 Markdown/OKF，可视化为节点图，增量运行只在实际变化时更新。值得借鉴的是 raw→compiled projection、brief/focus prompt 和 no-op update，不是把 Markdown 升为唯一事实库。
- GBrain 的官方说明显示其核心差异是 query-time synthesis + gap analysis，以及写入时零 LLM 抽取 typed edges 的 self-wiring graph；它也公开了自己的合成语料 BrainBench，但该指标不能直接外推到真实用户的被动 Lens useful@1。
- Hermes 官方将 memory 描述为 FTS5 session search + LLM summarization，再叠加周期性 nudge、自主 skill 学习和用户模型。优势是 agent 会主动使用/沉淀；代价是强依赖 agent loop 和 LLM 时延，不适合作为所有被动 surface 的统一底层替代。
- OpenClaw 以 Markdown 为真源：daily logs 是 append-only，`MEMORY.md` 是人工/agent 精选的长期记忆；`memory_search` 把这些文件切成约 400-token、80-overlap 的块，使用 per-agent SQLite、vector + BM25，可选时间衰减与 MMR，文件变更 debounce 后异步重建索引。它的优点是透明、可移植、可由 agent 直接维护；弱点是它本质仍是“由 agent 决定何时写、何时搜”的 harness memory，缺少本项目已有的多源事实表、权限/场景适配和页面级被动展示治理。
- OpenClaw 的 QMD sidecar进一步加入本地 BM25 + vector + reranking/query expansion，但首查可能下载/预热模型；这类深搜索适合作为主动查询 tier，不宜直接放进 Lens 每次被动请求。
- 高热度通用 memory layer 中，Mem0 采用 LLM 提取 memory、实体链接、semantic + BM25 + entity 多信号融合和时间推理；它更像“把对话压成可检索事实”的服务。Letta/MemGPT 则以 OS 虚拟内存类比组织 always-in-context、recall/archival tiers，让 agent 自己搬运/改写记忆。这两类方案都不自动解决被动网页的预期信息需求。
- LongMemEval 将长期记忆能力拆为信息抽取、多会话推理、时间推理、知识更新、拒答，并发现 session decomposition、fact-augmented key expansion、time-aware query expansion 都有帮助；这与本项目应从“单个页面文本 query”升级为有任务/时间槽的 retrieval plan 相吻合。
- EverMemBench 进一步报告：在多群组、跨主题、时变信息里，当前 similarity-based retrieval 难以跨过 query 与隐含相关记忆间的 semantic gap。这个问题与用户对 Lens 的主观描述几乎同构。
- HippoRAG 证明 LLM 抽图 + Personalized PageRank 能在多跳 QA 上提升且比迭代检索便宜；适合关系/跨事件问题，不等于所有页面都要开启图检索。
- Query2doc/HyDE 说明 LLM 生成的伪文档或扩展查询能改善 sparse/dense retrieval，但 HyDE 明确承认伪文档可含错误，必须只用于定位真实证据，不能作为 Lens 展示事实。Self-RAG 也指出固定地、不加判断地检索若干 passage 会降低效用，支持“需要先判断是否召回/是否展示”。
- Graphiti/Zep 的关键结构是 episode/raw provenance → temporal entities/facts（带 valid/invalid window）→ hybrid semantic/keyword/graph retrieval；它特别适合“现在是什么、过去是什么、关系如何变化”。本项目已经有 raw evidence、实体图和 bitemporal property 的相似基元，没必要整体迁移，但应把这些基元更明确地用于 retrieval plan 和 source authority。
- RAPTOR 与 wiki/community-summary 类方案擅长跨长文档、全局主题与多层抽象；它们应作为“global/overview query”的单独检索投影，而不是让 summary chunk 与原始 evidence 在所有场景中平权竞争。
- Generative Agents 的 observation → reflection → planning 与 relevance/recency/importance 思路解释了反思层的价值，但 Memory Lens 当前缺的恰恰是 planning/goal 对 retrieval 的约束；只有 reflection 产物并不能自动产生“此刻有用”。
- 2026 年 WiCER 对 LLM Wiki 的实证结果给出重要反例：blind compilation 会过度压缩并丢事实；用真实/诊断 query 的失败来迭代保留关键事实，才恢复大部分损失。这直接支持本项目继续保留 raw DB，并把真实 Lens/Ask query 与负反馈变成 summary/wiki refinement 的 probe，而不是相信一次性 MD 总结。
- 2026 `Agent Memory` 系统论文将成本分为 construction、retrieval、generation，并强调 write/read cost 的转移、freshness-latency tradeoff 与 query-volume amortization。对本项目的含义是：可以把昂贵 LLM 主要放在后台构建与稳定 scene hash 的按需 planner 上，让高频被动 read path 保持轻量。

## Architecture Assessment

- 当前系统的底座其实比“SQLite + vector”更丰富：raw messages、chunk FTS/vector、message vector、实体/关系、双时态属性、显著性/衰减、反思线程、Source Memory distillation、Keystone brief、change ledger 都已存在。核心问题不是缺一个新数据库，而是这些投影没有按 surface 的信息需求被正确路由。
- `docs/memory_system.md` 现有“与业界记忆系统对比”已明显过时：它把 OpenClaw 写成没有 MMR/时间处理、把 Mem0 写成只有向量检索；而当前 OpenClaw 已有 hybrid + optional MMR/temporal decay，Mem0 已有 entity/temporal multi-signal retrieval。建议后续单独更新文档，避免用旧表支持重构决策。
- 不建议把 DB 真源换成 Markdown/wiki 真源。更合理的是保留 SQLite/raw evidence 为 canonical truth，把 Markdown/wiki/brief 当有 lineage、authority、freshness、适用 query class 的 derived projection，并分别建索引/候选池。
- Lens-first 是合理试点，但接口要架构化：新增可复用的 `SceneInformationNeedPlanner` / `RetrievalPlan`，先在 Memory Lens 启用；不要直接改变所有 Recall surface，因为会议弹幕、Compose、Ask、显式搜索的延迟/准确率目标不同。
- 仓库其实已有 `AnticipationService`，但目前只服务夜间 `/ask` prior，不进入 Memory Lens。它从未来 36h 日历标题和开放 reflection thread 标题收集 subject，然后把**只有标题的 prompt**交给 LLM；写入时 `evidence_refs_json` 固定为 `[]`，`findPrior()` 只做 subject substring 命中并消费一次。这个实现可以复用 TTL/预算/后台预计算思路，但不能直接接到 Lens：当前预答缺 grounding，既不是可靠事实层，也不是页面 scene 的即时信息需求 planner。
- 因此建议不是再新造一个完全独立服务，而是把 Anticipation 的“预计算主题”与 Lens 的 SceneFrame 统一到一个 `RetrievalPlan` contract：先产生可审计的 need slots，再召回真实 evidence，最后才允许生成 brief；没有 evidence 的 LLM 推测只能作为 query expansion，不可展示。
