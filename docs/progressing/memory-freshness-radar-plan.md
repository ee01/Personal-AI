# 新能力：Memory Freshness Radar / 记忆保鲜雷达

> 生成日期：2026-05-18 CST  
> Codex 会话标题建议：新能力：记忆保鲜雷达  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-freshness-radar-demo.html`](./memory-freshness-radar-demo.html)  
> Idea 来源：未使用 Reminder。Apple Reminders 当前未发现名为 `Personal AI` 的清单；因此本方案来自项目目标、真实记忆查询、现有 progressing 边界和近期 AI memory / RAG 研究。

## 结论

建议设计一个新的 Personal AI 能力：**Memory Freshness Radar / 记忆保鲜雷达**。

它不是新的搜索页，也不是全局“记忆可信治理台”。它解决一个更具体、更容易影响真实使用体验的问题：

> Personal AI 记住了一篇网页、一份 AI 工具公告、一个 Jira/文档状态、一次产品说明或一段外部 AI 结论之后，如果源头后来变了，系统应该知道旧记忆可能已经过期，并把“发生了什么变化、影响哪些记忆、是否要更新上下文”推到用户眼前。

一句话价值：

> Personal AI 不只记住“我当时看到了什么”，还要知道“这个来源后来变了没有”，避免把旧网页、旧政策、旧 API、旧价格、旧 owner、旧 deadline 继续当成今天的事实。

## 为什么值得做

Personal AI 的长期目标是保留用户与 AI、网页、会议、消息、操作、偏好、skill 和其他平台 AI 对话的记忆，并在不同场景里做关联提示。这个目标里有一个隐性风险：**记得越多，旧信息越多**。

真实记忆查询里有几个强信号：

- 用户经常处理会变化的 AI 工具与授权信息，例如 Codex、Claude Code、Cursor、OpenClaw/RingClaw、MCP、agent memory framework。
- 用户在工作里依赖 Jira、RingCentral、会议、AI Service 通知、项目报表和 release 信息，这些状态会频繁变化。
- 现有记忆里已经有 `reflection_thread` 在跟踪“AWS DevOps Agent 功能是否还会继续变化”这类事实，说明系统已经开始感知“事实会变”，但缺少面向用户的来源变化体验。
- 用户偏好直接、实用、可追溯的分析方式，单纯“我猜这条记忆可能过期”不够，需要展示源头、差异、影响和可批准 patch。

从研究上看，RAG 和长期记忆系统的核心难题之一已经从“怎么找得到”转向“怎么知道找到的是不是仍然有效”。ACL 2025 的 HoH benchmark 明确指出，知识库里旧信息会干扰 RAG 准确性，甚至在新信息存在时也可能误导生成；Streaming RAG 的研究也把动态来源、增量索引和低延迟更新作为重要问题。

## 和已有 progressing 方案的边界

本方案已经核查 `docs/progressing`，和已有能力的边界如下：

| 已有方案 | 本方案如何避免重复 |
| --- | --- |
| `Memory Trust Console`（已搁置） | Trust Console 是全局记忆质量、隐私、证据治理台，范围太大。本方案只处理“被用户看过/引用过/纳入记忆的来源发生变化”这一条链路。 |
| `Memory Reality Check`（已搁置） | Reality Check 是用户或 AI 输出后的事实核验。本方案是源头变化的前置监测和记忆 patch，不等输出错误后再审稿。 |
| `Memory Lens` | Memory Lens 是当前页面旁的相关记忆提示。本方案可以嵌入 Lens，但主对象是 source snapshot、semantic diff 和 affected memories。 |
| `AI Context Passport` | Context Passport 是跨 AI 交接包。本方案给 Passport 加 freshness badge 和 stale warning，但不负责打包上下文。 |
| `Context Gap Radar` | Gap Radar 检查任务执行前缺什么上下文。本方案检查已有上下文是否来自过期来源。 |
| `Memory Egress Firewall` | Egress Firewall 管理记忆外发前的隐私/脱敏。本方案管理外发内容是否引用旧来源。 |
| `Memory Day Pilot` | Day Pilot 做当天 mission。本方案只在变化影响足够高时投递“需要今天知道的来源变化”。 |
| `Operation Memory Flight Recorder` / `Personal Skill Foundry` | Flight Recorder/Skill Foundry沉淀操作与 skill。本方案可以发现 skill 来源文档或工具 API 改了，但不负责生成 skill。 |

## 产品定义

### 核心对象

**Source**：用户看过、保存过、被召回过、被 AI Context Passport 引用过、被 ask answer 引用过，或被用户手动标记为需要关注的来源。

来源类型包括：

- Web URL：AI 文档、产品公告、博客、论文、GitHub release、pricing page、API docs。
- Google Docs / Sheets / Slides：项目表、会议材料、计划文档。
- Jira issue / project board：owner、状态、deadline、scope、fixVersion。
- RingCentral thread / message：长期跟进的消息、公告、决策。
- AI conversation export：ChatGPT/豆包/Codex/Claude 的关键输出或项目指令。
- Local file：`AGENT.md`、skill、配置文档、操作手册。

**Snapshot**：某个来源在某个时间点的可追溯快照，不一定保存完整页面。MVP 只需要保存提取后的主文本、标题、关键 DOM anchors、hash、etag、last-modified、captured_at 和 source trust metadata。

**Semantic Delta**：两次 snapshot 的语义差异，不是纯文本 diff。重点识别：

- 版本、价格、权限、owner、deadline、status、API endpoint、policy、security requirement 的变化。
- 关键段落新增/删除。
- 旧 claim 被撤回或被新 claim 替代。
- 来源不可访问、重定向、需要登录、内容变为空。

**Memory Patch**：把 delta 映射到 Personal AI 已有记忆，生成可审阅更新：

- 哪些 memory item / entity / profile item / reflection thread / context package 受影响。
- 旧事实是什么，新事实是什么，证据来自哪里。
- 建议动作：更新、标记过期、保留历史、创建 confirm request、静默。

### 用户体验

#### 1. 当前页面侧栏：你看过的来源变了

当用户再次打开一个被 Personal AI 记住过的页面，右下角 Memory Lens 或侧栏显示：

- “上次记住：2026-04-15；来源已在 2026-05-18 发生关键变化”
- 变化等级：low / medium / high / breaking
- 影响对象：3 条记忆、1 个 Context Passport、2 个 ask answer 引用、1 个 skill candidate
- 两栏 diff：旧 claim / 新 claim / impact
- 操作：更新记忆、只标记来源变更、静默此来源、打开原始快照

#### 2. Ask / Recall：回答引用旧来源时先提醒

当 `/ask` 或 `/recall` 需要用到一个 stale source 的 memory item，不直接把它当正常证据，而是在证据卡上显示：

- `stale source` badge
- “这条记忆来自 33 天前的文档；源文档后来更新过”
- 可以展开看 delta
- 用户仍可选择“用旧版本回答”，但默认把回答措辞改成“截至当时”。

#### 3. Day Pilot / Notification Center：只推高影响变化

系统不应该把所有页面更新都推给用户。只有符合以下条件才进 Day Pilot 或 Notification Center：

- 影响正在进行的项目、今天的会议、近期 AI 任务、待回复消息或已导出的 Context Passport。
- delta 类型是 breaking / policy / deadline / owner / permission / pricing / API contract。
- 旧记忆最近被召回或被外发给过其他 AI。

#### 4. Watchlist 管理

用户可以看到“正在保鲜的来源”：

- 自动关注：最近被频繁引用的 AI docs、Jira、Google Docs、GitHub release、RingCentral follow thread。
- 手动关注：用户在页面上点“关注来源变化”。
- 自动降级：30 天未引用、变化多但影响低、登录失败过多。
- 每个来源有频率策略：hourly / daily / weekly / on revisit only。

## 竞品和行业对照

| 产品/方向 | 已有价值 | Personal AI 的机会 |
| --- | --- | --- |
| [ChatGPT Memory](https://help.openai.com/en/articles/11146739-how-does-reference-saved-memories-work) | 能引用 saved memories 和 past chats 做个性化。 | 用户很难看到“这条记忆来自哪个外部来源、是否已过期、影响哪些回答”。Personal AI 可以把来源、时间和 patch 做成一等对象。 |
| [NotebookLM sources](https://support.google.com/notebooklm/answer/16215270) | source-first，回答基于用户上传/导入的来源。Google Drive 文件更新后可手动 sync。 | NotebookLM 更像项目 notebook，source 多数是静态副本；Personal AI 可以跨网页、Jira、聊天、AI 会话和本机文件自动映射到长期记忆。 |
| [Google Alerts](https://www.google.com/alerts) | 监控 web 上的新结果。 | Alerts 监控关键词，不知道用户记忆里哪些 claim 会受影响。Personal AI 监控的是“我曾经相信/引用/交给 AI 的来源”。 |
| [Mem](https://help.mem.ai/) | Capture、Heads Up、Deep Search，把 notes 在需要时带回来。 | Mem 重点是捕获和召回，未把来源变化到记忆 patch 的闭环作为核心体验。 |
| [Limitless](https://www.limitless.ai/) / Rewind 类产品 | 记录用户见过、说过、听过的信息，强调个人回忆。 | 它们解决“我经历过什么”；本方案解决“我经历过的信息后来是否失效”。 |
| [Zep / Graphiti](https://arxiv.org/abs/2501.13956) | Temporal knowledge graph，把动态 conversation 和 business data 纳入 agent memory。 | Personal AI 可以借鉴双时态和 provenance，但产品上更面向用户审阅 source delta。 |
| [Mem0](https://arxiv.org/abs/2504.19413) | 从对话中动态抽取、巩固和检索长期记忆。 | Mem0 强调 memory extraction/retrieval；本方案强调 source revalidation 和 stale memory patch。 |
| [MIRIX](https://arxiv.org/abs/2507.07957) | 多类型、多 agent、跨文本/视觉的长期记忆架构。 | MIRIX 的 Resource Memory / Knowledge Vault 思路适合支撑本方案，但 Personal AI 需要更轻量的浏览器/工作流 UI。 |

## 研究依据

1. [HoH: A Dynamic Benchmark for Evaluating the Impact of Outdated Information on Retrieval-Augmented Generation](https://aclanthology.org/2025.acl-long.301/)（ACL 2025）  
   关键启发：RAG 知识库里旧信息会显著降低答案准确率，并可能在当前信息存在时仍误导生成。Personal AI 的记忆库本质上也是长期 RAG，因此必须把“来源时间”和“旧信息影响”显式化。

2. [From Static to Dynamic: A Streaming RAG Approach to Real-time Knowledge Base](https://arxiv.org/abs/2508.05662)（arXiv 2025）  
   关键启发：动态流数据下，周期性全量重建索引会带来延迟和成本；更合理的是增量筛选、聚类、upsert。本方案不需要全量重抓互联网，只维护用户相关来源的 compact prototype / semantic anchors。

3. [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)（arXiv 2025）  
   关键启发：企业 agent memory 需要动态整合 ongoing conversations 和 business data，而不是静态 document retrieval。Personal AI 的 memory patch 应该保留 valid_from / valid_to 和 source provenance。

4. [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413)（arXiv 2025）  
   关键启发：长期多会话一致性需要动态抽取、巩固和检索 salient information。本方案在巩固后增加“来源再验证”。

5. [MIRIX: Multi-Agent Memory System for LLM-Based Agents](https://arxiv.org/abs/2507.07957)（arXiv 2025）  
   关键启发：真实个人记忆不只文本，还包含 episodic、procedural、resource、knowledge vault 等不同 memory type。Source freshness 应该按 memory type 差异化处理：网页事实、操作流程、skill、AI 对话结论的更新策略不同。

## MVP 场景

### 场景 A：AI 工具政策变化

用户之前记住“Codex trial 到 Apr 12 结束”“Claude Code 采购流程混乱”“Cursor license 要回收”。后来相关公告或内部文档更新。系统发现：

- trial 延长 / 变成正式付费 / 权限范围变化；
- 旧 daily log、ask answer、Context Passport 里仍在引用旧时间；
- Day Pilot 今天有 AI 工具申请相关任务。

系统输出：

- “AI 工具授权来源发生变化，影响 5 条记忆和 1 个今天的任务”
- 默认不自动改写所有记忆，而是创建 patch：旧事实保留为历史，新事实作为 current fact，相关提醒重排。

### 场景 B：Jira/Google Doc 项目计划变更

用户保存过某项目 owner、ETA、scope、design dependency。Google Doc 或 Jira issue 后来被更新。系统发现：

- owner 改了；
- ETA 延迟；
- requirement 增加；
- 用户今天要开会。

系统输出：

- 会前弹出：这份 plan 在你上次生成 context pack 后更新过；
- 一键生成“变化后会前上下文 patch”。

### 场景 C：技术文档/API 变化

用户问 Personal AI “上次那个 MCP/agent memory framework 应该怎么接”。Recall 命中一篇旧文档。系统发现该 source 有 breaking change。

系统输出：

- ask answer 顶部提示：旧记忆来自 2026-03-31，源文档 2026-05-12 更新；
- 回答默认用新 source，同时引用旧 source 作为历史背景。

## 信息架构

### 核心表

```sql
CREATE TABLE source_watch_rules (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  title TEXT,
  scope TEXT DEFAULT 'work',
  watch_reason TEXT,
  watch_level TEXT DEFAULT 'smart',
  cadence TEXT DEFAULT 'daily',
  status TEXT DEFAULT 'active',
  last_checked_at INTEGER,
  last_success_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE source_snapshots (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  title TEXT,
  canonical_url TEXT,
  captured_at INTEGER NOT NULL,
  etag TEXT,
  last_modified TEXT,
  extracted_text_path TEXT,
  anchors_json TEXT,
  metadata_json TEXT,
  FOREIGN KEY (watch_id) REFERENCES source_watch_rules(id)
);

CREATE TABLE source_deltas (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  old_snapshot_id TEXT,
  new_snapshot_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  delta_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  claims_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  dismissed_at INTEGER,
  action_taken TEXT,
  FOREIGN KEY (watch_id) REFERENCES source_watch_rules(id)
);

CREATE TABLE source_impact_edges (
  id TEXT PRIMARY KEY,
  delta_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  impact_score REAL NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE memory_patch_candidates (
  id TEXT PRIMARY KEY,
  delta_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  patch_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  evidence_refs_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  applied_at INTEGER
);
```

### API 轮廓

```text
GET  /api/v1/source-freshness/watchlist
POST /api/v1/source-freshness/watchlist
GET  /api/v1/source-freshness/deltas?severity=&status=&limit=
GET  /api/v1/source-freshness/deltas/:id
POST /api/v1/source-freshness/deltas/:id/action
POST /api/v1/source-freshness/check
POST /api/v1/source-freshness/patches/:id/apply
POST /api/v1/source-freshness/patches/:id/dismiss
```

### 与现有能力的接入点

- `/recall`：RecallItem 增加 `sourceFreshness` 字段，前端展示 freshness badge。
- `/ask`：构建 prompt 前对 evidence refs 做 freshness preflight；过期来源默认降权或用“截至当时”措辞。
- `/context-recall`：Memory Lens 展示当前页面的 source delta。
- `/providers/context-packages/render`：生成 Context Passport 前检查 stale sources。
- Day Pilot：只拉取高影响 `source_deltas`，变成 mission card 或 warning line。
- Notification Center：承接 high/breaking delta 的通知，但不让所有页面变化进通知流。
- Confirm Requests：当 patch 会覆盖 current fact、profile item 或 entity property 时，进入用户确认。

## 语义 diff 设计

### 1. 快速变更检测

优先使用低成本信号：

- HTTP `ETag` / `Last-Modified`
- normalized text hash
- DOM anchor hash
- sitemap / RSS / GitHub release feed
- Google Drive revision metadata
- Jira updated timestamp

只有 hash 变化且来源重要时，才进入 LLM semantic diff。

### 2. Delta 分类

```ts
type DeltaType =
  | 'breaking_change'
  | 'policy_change'
  | 'pricing_change'
  | 'deadline_change'
  | 'owner_change'
  | 'status_change'
  | 'api_contract_change'
  | 'claim_retracted'
  | 'new_evidence'
  | 'source_unavailable'
  | 'minor_edit';
```

### 3. Impact scoring

建议初版使用可解释线性模型：

```text
impact =
  0.30 * source_importance
  + 0.25 * semantic_severity
  + 0.20 * recent_usage
  + 0.15 * active_project_overlap
  + 0.10 * external_ai_export_overlap
```

其中：

- `source_importance`：用户手动 watch、被引用次数、来源类型、可信度。
- `semantic_severity`：delta 类型和 LLM 判断。
- `recent_usage`：近 7/30 天是否被 recall/ask/Passport/Day Pilot 使用。
- `active_project_overlap`：是否命中 today mission、upcoming meeting、watched project。
- `external_ai_export_overlap`：是否曾进入 ChatGPT/Codex/豆包/Claude 的上下文包。

## UX 原则

1. **只提醒有影响的变化**  
   页面更新不等于用户需要知道。默认把 minor copy edit 静默记录。

2. **先解释影响，再给 diff**  
   用户不想先读长 diff，而是先知道“这会影响我什么”。

3. **旧事实不删除，变成历史**  
   旧公告、旧价格、旧 owner 在当时可能是真的。系统应该加 `valid_to`，而不是抹掉历史。

4. **所有自动 patch 都可撤销**  
   MVP 默认 pending，用户批准后应用。低风险 patch 可让用户开启自动应用。

5. **来源失败要安静**  
   登录失效、403、网络失败不应该频繁弹窗；只在用户打开相关页面或问相关问题时提示。

## Demo 说明

Demo 模拟在一个 AI docs / Jira / release 页面上，Personal AI 侧栏提示“该来源自上次记忆后发生关键变化”。可切换三类 delta：

- AI docs 变化：旧 Context Passport 引用了过期的 provider binding。
- Jira 计划变化：owner 和 ETA 发生变化，影响即将到来的会议。
- Release note 变化：RingClaw 版本升级，旧 skill 指令需要 patch。

交互重点：

- 右侧侧栏显示 severity、impact、affected memories。
- 中间两栏 diff 显示 old/new claim。
- 用户可以点击 `Apply patch`、`Mute source`、`Open snapshot`。
- 顶部模拟当前网页，不做独立 landing page。

## 分阶段落地

### P0：Recall freshness badge + 手动 watch

目标：用最少工程成本证明“旧来源提醒”有用。

- 新增 source watch / snapshot / delta 表。
- 浏览器页面上支持手动 `Watch this source`。
- 对 URL source 做文本 hash 和主内容提取。
- 每天对 active watchlist 跑一次轻量检查。
- `/recall` 返回 source freshness badge。
- 前端 Memory Exploring / Ask evidence 卡展示 stale source。
- 不做自动 patch，只生成 pending patch。

验收：

- 用户打开一个 demo source，修改 fixture 后能产生 delta。
- 被 delta 影响的 recall item 显示 stale badge。
- 用户批准 patch 后，entity/property 或 memory metadata 标记 valid_to / current_value。

### P1：自动关注高价值来源 + Day Pilot 接入

- 当网页/ask/Passport 引用某 source 超过阈值，自动建议 watch。
- 支持 Google Drive revision、Jira updated、GitHub release feed。
- Day Pilot 只展示 high impact deltas。
- Context Passport 渲染前做 freshness preflight。
- 支持“on revisit only”低成本策略。

验收：

- 今天会议相关 Google Doc 更新后，Day Pilot 出现一张具体 mission。
- 旧 Context Passport 重新打开时显示 source delta patch。

### P2：跨 AI 会话和 skill 的来源保鲜

- AI conversation export 中识别外部来源引用。
- Skill Foundry 中记录 skill 的 source docs 和 API dependency。
- 外部 AI context package 使用过的来源进入 `external_ai_export_overlap`。
- 对 breaking changes 自动生成 skill patch candidate。

验收：

- 某 API docs 更新后，相关 skill 显示 `needs refresh`。
- 用户可一键生成“给 Codex 的更新后 context patch”。

## 风险和约束

| 风险 | 应对 |
| --- | --- |
| 页面变化太多，通知噪音大 | 默认只记录，不通知；只有 active project / recent usage / high severity 才进入通知。 |
| 登录页面或动态 app 难抓取 | 优先 on-revisit snapshot；用户打开页面时由 content script 提取当前主文本。 |
| 版权和隐私 | 保存抽取后的主文本和 anchors，敏感站点可只保存 hash + user-approved excerpt。 |
| LLM diff 成本 | 先 hash/anchor/regex 判定；只有重要 source 变化才调用 LLM。 |
| 误判 breaking change | 所有影响 current memory 的 patch 默认 pending，并附 old/new/source evidence。 |
| 和 Trust Console 重叠 | 不做全局质量评分，不做隐私审计，只做 source delta -> affected memory -> patch。 |

## 成功指标

- `freshness_warning_precision`：被用户认为有用的 freshness warning 比例，目标 P0 >= 60%。
- `stale_recall_prevented`：用户因为 badge 没有采用旧证据的次数。
- `patch_accept_rate`：pending patch 被接受比例，目标 P0 >= 40%。
- `silent_delta_ratio`：静默记录但不打扰的 delta 比例，目标 >= 80%。
- `source_check_cost`：每日 watchlist 检查耗时和 token 成本。
- `reopen_value`：用户点击 source delta 后继续 ask / context pack 的比例。

## 为什么现在可以做

Personal AI 已经有这些基础：

- memory-service per-user DB、recall、ask、context-recall、Day Pilot、Notification Center。
- 记忆里已经有 sourceUrl/sourceTitle/timestamp/metadata。
- Webpage memory detection 和 content script 已经能在浏览器页面里抽取上下文。
- Confirm Requests 可以承接需要用户判断的冲突。
- Provider context packages、AI Context Passport、Personal Skill Foundry 都会受益于 freshness badge。

因此 MVP 不需要先做一个“大型爬虫系统”。从用户已打开页面、已引用 URL、已导入 Google/Jira/RingCentral 来源开始，做一个小而准的 source freshness layer 就能产生价值。

## 最小推荐版本

如果只选一个最小可做版本，我建议做：

1. 手动 watch 当前网页。
2. 每日 hash + semantic anchor diff。
3. Recall/Ask evidence freshness badge。
4. Pending memory patch，不自动写 current fact。
5. 一个 `Source Freshness` 页查看 watchlist 和 deltas。

这个版本的亮点足够清楚：**当 Personal AI 引用一条旧记忆时，它会告诉你源头后来变了，并给出可审阅 patch。**
