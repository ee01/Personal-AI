# Progress

## 2026-08-12

- 读取 planning skill、AGENT.md 和相关 memory registry。
- 建立独立研究计划；不切换仓库现有 active plan，不修改运行时代码。
- 读取完整 `memory_lens.md` 并定位 Memory Exploring 搜索路由、总结按钮和消息处理器。
- 审阅 Context Recall 主流程：Context Expansion、SceneFrame、vector/FTS、锚点重排、cohesion/attribution/autopilot 均为确定性或 embedding 路径，没有生成式 LLM 调用。
- 确认 MarkdownManager 会把 daily/project/reflection/dream/entity 等 MD 重新切块写入 SQLite FTS/vector；`CORE_MEMORY.md` 默认例外，但 USER_CORE 可显式 reindex。
- 核对 OpenWiki、LLM Wiki、GBrain、OpenClaw、Hermes、Mem0、Letta、Graphiti 官方仓库和当前架构。
- 核对 LongMemEval、EverMemBench、HippoRAG、RAPTOR、HyDE、Query2doc、Self-RAG、WiCER 与 2026 Agent Memory 系统论文。
- 完成判断：保留 DB/raw truth；先在 Lens 引入可复用的 scene information-need planning 和分层检索 policy，再按实测决定是否扩到其他 Recall surface。
- 补查已有 `AnticipationService`：确认它当前仅为 `/ask` 夜间 prior，LLM 输入只有 subject 标题、持久化 evidence refs 为空；可借用后台预算/TTL，但必须先补 grounded retrieval plan，不能直接成为 Lens 内容源。
- 本轮没有修改运行时代码，也没有运行产品测试；结论来自静态代码审计和外部一手资料。

## Errors

| Error | Resolution |
|---|---|
| 搜索 MD 使用链路时 shell 双引号与反引号组合导致 zsh `unmatched "` | 拆成单引号安全的 `rg` 查询，避免把反引号放入 shell pattern |
