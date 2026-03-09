下面我先把“你现在两套系统的记忆形态”校准一下，然后给出**可互动的典型架构**、**具体场景/例子（含交互方式）**，最后把我检索到的**类似系统/资料、论文与关键作者**列出来，方便你后续对标与深化。

---

## 1) 你对“都用 MD 作为记忆”的理解：一半对，一半需要补充

**你的 Memory Service（Chrome Extension 的新后端）**
它的“事实与索引层”主存储是 **per-user SQLite（WAL）+ FTS5 + sqlite-vec 向量**，并带有摄入、召回、问答、画像、巩固、做梦等完整生命周期引擎；**Markdown 更像是导出/日报/可读视图**而不是唯一真源。

**OpenClaw 的 memory**
OpenClaw 的“真源”确实是 **workspace 里的 Markdown 文件**（例如 `memory/YYYY-MM-DD.md`、`MEMORY.md`），然后通过 memory plugin 提供 `memory_search / memory_get`，并且官方文档里明确提到：**hybrid search（BM25+vector）+ MMR 去冗余重排 + recency/temporal decay + sqlite-vec 加速**等。([OpenClaw][1])

> 所以：**OpenClaw 是“MD 为真源，索引是附属”**；你的 Memory Service 是**“DB 为真源，MD 可作为导出与呈现层”**。这决定了两者互动时，建议尽量把“真源”统一，否则会遇到一致性/冲突/重复写入问题。

---

## 2) 两套系统互动的 3 种“高性价比架构”

### 架构 A（推荐）：Memory Service 做“共享长期记忆中台”，OpenClaw/Extension 都当客户端

* Extension 负责**感知层**：网页/聊天/邮件等信息摄入、轻分析、触发任务（你文档里的“感知→认知→记忆→决策”分层很契合）。
* Memory Service 负责**记忆层**：/ingest、/recall、/ask、/profile、巩固、遗忘、真值维护等。
* OpenClaw 负责**决策/行动层**：当作 agent runtime（写报告、做计划、生成代码/草稿、跑工具链），并把行动结果回写到 Memory Service。

**交互方式（最直）：**给 OpenClaw 写一个 memory plugin / tool adapter，把 Memory Service 的 `/recall` `/ask` `/ingest` 包装成 OpenClaw 可调用工具。OpenClaw 本身就支持 memory plugins slot。([OpenClaw][1])

---

### 架构 B（快速原型）：用“共享 MD 文件夹”做交换层（文件同步）

* Extension 把关键摘要/结论写入 OpenClaw workspace 的 `memory/YYYY-MM-DD.md` 或 `MEMORY.md`
* OpenClaw 按它的原生方式搜索/读写
* 你的 Memory Service 定时把这些 MD **batch ingest** 进 DB（或反向 `/export` 到 workspace）

**优点：**最快，不改 OpenClaw 内核；**缺点：**会遇到重复、冲突、并发写、版本追踪麻烦（尤其你有 TruthMaintainer 双时态/冲突队列时）。

---

### 架构 C（中长期）：把 Memory Service 变成 MCP Server，让 OpenClaw/其他 AI 客户端都用同一协议接入

你文档里已经把 “MCP 协议适配”列为最先落地方向之一。
MCP 的定位就是：标准化把“外部数据源/工具”接到 LLM 应用里。([modelcontextprotocol.io][2])

**交互方式：**

* Memory Service 暴露成 MCP server（tools: recall/ask/ingest/profile/notifications…）
* OpenClaw 或其他 host（Claude/Cursor/IDE）作为 MCP client 统一调用

---

## 3) 可让两套系统“互动起来”的场景库（每个都给到交互方式）

下面我用“触发 → 数据流 → 产出 → 回写记忆”的格式写，方便你挑 MVP。

### 场景 1：阅读增强（浏览网页时自动“串起旧知识 + 生成行动建议”）

**触发**：你打开技术文档/PRD/论文网页
**数据流**：

1. Extension 做 Web Intelligence 抽取（实体/主题/版本号/日期）→ `POST /recall` 拉历史相关记忆
2. 侧边栏展示“你之前结论/相关讨论/相关人”
3. 你点“Ask OpenClaw”：把【网页摘要 + recall 结果】交给 OpenClaw 生成“对比/风险/下一步”
4. OpenClaw 的最终结论/决策 → `POST /ingest` 回写到 Memory Service

**为什么两套系统都参与**：Extension 擅长感知与 UI；OpenClaw 擅长 agentic 推理与工具链；Memory Service 擅长长期记忆与去重/衰减/巩固。

---

### 场景 2：会议前/中/后“会议记忆”（自动议程、实时背景、会后行动项）

OpenClaw 的 memory 文档里强调“该写入 durable memory 的要写到 MD”，并且有 pre-compaction memory flush 的机制。([OpenClaw][1])
你的未来愿景文档也把“会议记忆”作为重点增强项。

**触发**：打开 Google Meet/Zoom 页面或日历事件
**数据流**：

1. Extension 识别参会人/主题 → `/recall` 拉“人际关系摘要/未完成承诺/相关项目上下文”
2. OpenClaw 生成：议程、你该问的问题、风险点
3. 会后：OpenClaw 生成会议纪要+行动项 → `/ingest`（并可同步写一份 `memory/YYYY-MM-DD.md` 做可读日志）

---

### 场景 3：邮件/IM 回复助手（“基于关系史 + 画像”自动调语气与内容密度）

你的 Memory Service 有 ProfileManager（用户画像 + 社交边 + 态度），很适合驱动“对不同人不同写法”。

**触发**：打开 Gmail/Slack Web 对话
**数据流**：

1. Extension 识别发件人实体 → `/recall` 拉“历史互动摘要 + 对方偏好/敏感点”
2. OpenClaw 根据画像生成 2-3 个版本（简短/正式/强势推进）
3. 你选定后发送，同时把“最终版本 + 结果反馈（对方是否接受）”回写 `/ingest`，用于后续风格学习

---

### 场景 4：项目推进/风险雷达（把“浏览到的信息”直接转成“项目态势与提醒”）

你的“类人脑项目分析系统”明确有主动通知、项目仪表盘、风险预警路线。

**触发**：你浏览 Jira/GitHub/文档
**数据流**：

1. Extension 抽取任务/截止期/依赖 → `/ingest`
2. OpenClaw 每天固定跑一次“项目态势总结”：用 `/ask` 生成“阻塞点、最短路径依赖、明天三件事”
3. Memory Service 的 Heartbeat/Notifications 输出提醒（你已经设计了心跳循环）。
4. Extension 用非侵入式 toast/侧边栏推送

---

### 场景 5：研究/文献管理（自动形成“可追溯的知识链 + 反思/做梦挖关联”）

你的 Memory Service 有 nightly consolidation、weekly “做梦” generative replay，用来发现隐含关联。
这和 “Generative Agents” 论文里的 memory→reflection→planning 模式高度同构。([arXiv][3])

**触发**：你读论文/博客/标准
**数据流**：

1. Extension 抽取摘要、关键术语、引用 → `/ingest`
2. 晚上 consolidation 压缩成结构化要点
3. 周日“做梦”产出“可能的跨文献关联/类比”
4. OpenClaw 把关联变成可执行：阅读清单、实验计划、写作提纲

---

### 场景 6：架构决策记录（ADR）与“真值维护/冲突确认”

你 Memory Service 的 TruthMaintainer（双时态、冲突确认队列）非常适合管理“不断变化的事实”（比如 API endpoint、owner、deadline）。

**触发**：你在网页/聊天中看到“信息变更”
**交互方式**：

* Extension 检测到冲突候选（新旧不一致）→ 写入“确认队列”
* OpenClaw 生成一条“向你提问的澄清卡片”：到底以哪个为准？一旦你确认 → 更新 memory，并自动写一份 ADR（MD）

---

### 场景 7：遗忘提醒 → 复习卡片/小测（把“遗忘引擎”变成真正的学习闭环）

你有 ForgettingEngine（指数衰减、半衰期）。
遗忘曲线（Ebbinghaus）本身就是指数衰减的经典心理学基线。([Wikipedia][4])

**触发**：记忆快衰减到阈值
**交互方式**：

* Memory Service 生成“复习建议条目”
* OpenClaw 把条目变成：3 道选择题/1 道开放题/1 个实际应用任务
* Extension 弹出复习卡；你的答题表现再回写强化显著性

---

### 场景 8：日报/周报与“数字孪生”的第一步

你的未来愿景文档把“自动化日报/周报”“个人 FAQ”“委托决策”都列为可落地形态。

**交互方式**：

1. Memory Service consolidation 输出当天结构化摘要（可 `/export`）
2. OpenClaw 读取摘要，生成：日报、明日计划、风险与需要澄清的问题
3. 写回 `/ingest`，形成可追溯的“计划→执行→复盘”链条

---

## 4) 你要对标/借鉴的“类似系统 & 论文/作者（专家）”

### 工程系统（直接可抄交互模式）

* **OpenClaw Memory**：MD 为真源；memory plugin 提供 hybrid search、MMR、temporal decay、sqlite-vec 等实现细节，非常适合作为你对接点。([OpenClaw][1])
* **Mem0 ↔ OpenClaw 插件**：展示了“watch conversation → extract → persist → retrieve inject”这套典型闭环，你可以把 Memory Service 做成同类插件（或直接替换）。([Mem0][5])
* **LangGraph Persistence（checkpointer）**：强调“把 agent state 持久化为可恢复线程”的工程范式，可对照你 Heartbeat/巩固的调度层设计。([LangChain Docs][6])
* **LlamaIndex Memory**：明确区分短期 FIFO + 可选长期抽取式记忆，适合对照你“工作/短期/长期”的分层。([LlamaIndex OSS Documentation][7])
* **Letta（MemGPT 系谱）Memory Blocks**：提供“可编辑的持久记忆块”抽象，适合你把 Profile/Identity/Soul/Policy 做成可版本化“块”。([Letta][8])

### 协议/生态（用于“让多客户端共享一份记忆”）

* **MCP（Model Context Protocol）**：标准化外部工具/数据源接入；你文档里提到的“MCP 适配”方向可以直接对齐。([modelcontextprotocol.io][2])

### 论文（你系统里好几项设计都能找到学术锚点）

* **MemGPT: Towards LLMs as Operating Systems**（Charles Packer, Sarah Wooders, Kevin Lin, Vivian Fang, Shishir Patil, Ion Stoica, Joseph Gonzalez）— 分层记忆/虚拟上下文管理的代表作。([arXiv][9])
* **Generative Agents**（Joon Sung Park 等）— 经典的 memory stream + reflection + planning 架构，对应你“巩固/反思/主动洞察”。([arXiv][10])
* **Complementary Learning Systems**（McClelland, McNaughton, O’Reilly, 1995）— “海马体快速学习 + 新皮层慢速整合”的理论基础，对应你 nightly consolidation / replay（做梦）。([Stanford University][11])
* **MMR（Maximal Marginal Relevance）**（Carbonell/Goldstein 系列）— 对应你召回后的“去冗余、多样性重排”。([aclanthology.org][12])

---

## 5) 我建议你先做的“MVP 结合点”（最可能很快看到效果）

**MVP-1：OpenClaw 侧做一个 `memory-service` plugin（替代/并行 memory-core）**

* `memory_search` → 调用 Memory Service `/recall`
* “写记忆” → 调用 `/ingest`（同时可选写一份 MD 到 workspace 作为 human-readable log）
* “画像/人格块” → 对接 `/profile/*`（你已经有 ProfileManager 结构）

**MVP-2：Extension 增加一个“Ask OpenClaw”按钮（用 recall 结果做上下文）**

* 这能立刻把“浏览感知”转成“agent 行动”，并形成闭环回写记忆。

**MVP-3：把 nightly consolidation 的输出变成 OpenClaw 的每日启动上下文**

* OpenClaw session start 默认会读“今天+昨天”的日志（OpenClaw 默认行为）。([OpenClaw][1])
* 你可以让它改为读“consolidation 摘要 + 今日重点”，直接提升每天的可控性。

---

如果你愿意把讨论推进到“更完美结合”，下一步我建议你先选一个主战场：

1. **浏览增强**（最贴合 Chrome Extension），或 2) **会议记忆**（ROI 极高），或 3) **项目风险雷达**（最能体现你类人脑分层架构）。

[1]: https://docs.openclaw.ai/concepts/memory "Memory - OpenClaw"
[2]: https://modelcontextprotocol.io/specification/2025-03-26?utm_source=chatgpt.com "Specification - Model Context Protocol"
[3]: https://arxiv.org/abs/2304.03442?utm_source=chatgpt.com "Generative Agents: Interactive Simulacra of Human Behavior"
[4]: https://en.wikipedia.org/wiki/Forgetting_curve?utm_source=chatgpt.com "Forgetting curve - Wikipedia"
[5]: https://docs.mem0.ai/integrations/openclaw?utm_source=chatgpt.com "OpenClaw - Mem0"
[6]: https://docs.langchain.com/oss/python/langgraph/persistence?utm_source=chatgpt.com "Persistence - Docs by LangChain"
[7]: https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/?utm_source=chatgpt.com "Memory | LlamaIndex OSS Documentation"
[8]: https://www.letta.com/blog/memory-blocks?utm_source=chatgpt.com "Memory Blocks: The Key to Agentic Context Management - Letta"
[9]: https://arxiv.org/abs/2310.08560 "[2310.08560] MemGPT: Towards LLMs as Operating Systems"
[10]: https://arxiv.org/abs/2304.03442 "[2304.03442] Generative Agents: Interactive Simulacra of Human Behavior"
[11]: https://web.stanford.edu/~jlmcc////papers/McCMcNaughtonOReilly95.pdf?utm_source=chatgpt.com "Why There Are Complementary Learning Systems in the Hippocampus and ..."
[12]: https://aclanthology.org/X98-1025/?utm_source=chatgpt.com "Summarization: (1) Using MMR for Diversity- Based Reranking and (2 ..."
