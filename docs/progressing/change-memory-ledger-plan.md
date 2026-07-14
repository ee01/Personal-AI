# 新能力：Change Memory Ledger / 变更记忆账本

> 生成日期：2026-07-08 CST
> Codex 会话标题：新能力：变更记忆账本
> 状态：待决策，仅规划与 demo，不做代码实现
> Demo：[`change-memory-ledger-demo.html`](./change-memory-ledger-demo.html)

## 真实场景 1：Jira 估时反复改动，Ask 不再把旧值当当前值

用户在 Quick Ask 里问：

> MTR-147866 的 DEV Estimate 现在到底是多少？最初是多少？

现在容易发生的坏体验：

1. Source Memory 已经自动保存了多条 Jira comment 或字段变更片段，例如 `DEV Estimate Original: 0.2 New: 0.1` 和 `DEV Estimate Original: 0.1 New: 0.2`。
2. 这些片段都很相关，但它们是同一字段的不同时间状态。如果只按相似度召回，Ask 可能把其中一条当“事实”，却没有说明它是历史值、当前值，还是一次反转。
3. 用户得到一个看似有证据的答案，但后续写 Jira comment、给 AI agent 下任务或回顾估时变化时，仍要自己去翻 Jira history。

有变更记忆账本之后：

1. Source Memory 保存 Jira comment 后，后台把 old/new 片段解析成 `MemoryChangeEvent`：subject=`MTR-147866`，property=`DEV Estimate`，old=`0.2`，new=`0.1`，source=`Jira comment capsule`。
2. 如果稍后又捕获 `0.1 -> 0.2`，账本不会覆盖上一条，而是把它们串成一条事件链：`0.2 -> 0.1 -> 0.2`，并标记 `reverted_to_prior_value`。
3. Ask 回答时优先读账本投影视图：
   - `当前保存链最后观测值：0.2`
   - `历史曾短暂改为：0.1`
   - `当前 Jira 字段未直接复核，若要写回或对外承诺，应触发 Evidence Watch / Jira 权威读取`
4. Memory Lens 或 Compose Assist 只显示一条紧凑回执：`估时链：0.2 -> 0.1 -> 0.2；当前值来自保存片段，未复核 Jira 字段`。

用户感受：Personal AI 不只是找到了“相关估时记忆”，而是知道这些记忆是一次属性变化的历史，并且把“当前值”和“历史值”分开。

## 真实场景 2：打开 Jira issue 时，右侧直接看到字段变化链

用户打开 `MTR-148115`，准备判断 Story Points 和 QA/DEV Estimate 是否曾经被 AI 改坏。

现在的体验：

1. Jira 页面有 Activity / History，但用户要自己滚动筛选。
2. Personal AI 可能已经保存了 `Story Points Original: 0 New: 14`、`Story Points Original: 14 New: 0`、`Story Points Original: 13 New: 14`、`DEV Estimate Original: 0.3 New: 0.4` 等片段。
3. Memory Lens 如果逐条显示这些片段，用户看到的是一堆碎片，而不是可判断的事件链。

有变更记忆账本之后：

1. 用户打开该 Jira issue，右侧 Memory Lens 集成卡只显示 2-3 条高价值字段链：
   - Story Points：`0 -> 14 -> 0 -> 14`，当前保存链有冲突，建议以 Jira field 为准。
   - DEV Estimate：`0.3 -> 0.4`，来源为 owner-authored Jira comment。
2. 点击某一条链，展开事件时间线、来源 capsule、被过滤的 UI 噪声和相邻 ticket 排除说明。
3. 如果用户在 Jira comment 输入框中起草回复，Compose Assist 可插入一句谨慎口径：
   - `我看到保存的变更链显示 Story Points 曾在 0 和 14 之间反转，当前值请以 Jira 字段为准。`
4. 如果用户选择“查当前权威值”，系统创建或复用 Evidence Watch contract，而不是把历史片段直接升级成当前事实。

Before：用户要在 raw Jira history、source-memory capsule 和 Ask 结果之间来回核对。
After：用户看到的是“字段发生了什么变化、哪些值是历史、哪个当前值还需要权威复核”。

## 结论

建议设计新能力：**Change Memory Ledger / 变更记忆账本**。

一句话：

> 把用户已经捕获到的 Jira、消息、网页、外部 AI 和操作记忆中的 old/new、撤回、反转、状态变化片段，整理成可回放、可投影、可被 Ask/Memory Lens/Compose Assist 消费的属性变更事件链。

它解决的不是“来源后来变了没有”（这是 Memory Freshness Radar），也不是“以后要不要再查”（这是 Evidence Watch），而是：

> 这个变化其实已经被用户看见或保存过了，Personal AI 应该把它记成一次有时间、有旧值、有新值、有来源、有反转关系的事件，而不是一条孤立文本记忆。

P0 推荐做成后台抽取 + 现有界面嵌入，不新增 review queue，不新增独立管理页。只有当用户正在 Ask、打开相关 Jira、查看 source-memory 详情、写回复或生成 context pack 时，才展示紧凑变化链。

## Idea 来源

本次没有使用 Reminder 选题。本机 Reminders 通过 EventKit 可读，且存在 `Personal AI` 列表；读取到的该列表条目均为已完成项，未发现新的未完成“全新功能 idea”。因此没有随机选择 Reminder，也没有标记 done 或写备注。Reminders App 的 AppleScript 接口没有暴露同名 list，本轮以 EventKit 读取结果为准。

本方案来自：

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 自动化记忆和 `docs/progressing` 去重，避开 Evidence Cohesion Gate、Keystone Memory Briefs、Memory Change Simulator、Prompt Context Compiler、Source Memory Distiller、Memory Outcome Loop、Memory Active Recall Coach、Memory Freshness Radar、Merge/Evolution/TTL 等已有方向。
- `10.32.56.212` 上 `esone.qiu` memory-service 数据盘的只读 SQLite 聚合。
- 当前 AI memory / agent memory 产品与研究趋势。

## 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`：

- HTTP `10.32.56.212:3210` 的 health、stats、confirm、actions、reflection API 本轮均超时；没有把 HTTP 结果当作可读证据。
- SSH 只读访问远端 SQLite 成功，使用 `file:...memory.db?mode=ro&immutable=1` 查询，没有写入线上数据。
- 当前聚合：
  - `messages_raw = 11158`
  - `chunks = 10022`
  - `memory_metadata = 14849`
  - `entities = 14186`
  - `relationships = 54683`
  - `confirm_requests pending = 29`
  - `proposed_actions queued/pending = 291`
  - `reflection_threads active = 885`
  - `source_memory_capsules = 566`
  - `conversation_context_frames = 146`
  - `personal_skills = 10`
- Source Memory 分布：445 个 saved webpage capsule、115 个 saved Jira comment capsule、4 个 visual memory、1 个 selection。
- 565 个 saved capsule 中，简单规则命中：
  - 31 条类似 old/new 变更片段。
  - 68 条带 `Press Enter`、`Collapse comment` 等 UI 噪声。
- Jira comment capsule 样本里，同一 issue 下存在相反或多跳变更：
  - `MTR-147866`：`DEV Estimate Original: 0.2 New: 0.1` 与 `DEV Estimate Original: 0.1 New: 0.2`。
  - `MTR-148115`：`Story Points Original: 0 New: 14`、`14 New: 0`、`13 New: 14`，以及 `DEV Estimate Original: 0.3 New: 0.4`。
  - `MTR-144186`：DEV Estimate 在 `0.6 / 0.81 / 0.8 / 0.4` 之间多次变化。
- 运行库已有 `entity_properties` 双时态字段，但当前数据侧显示：
  - `entity_properties = 1885`
  - `superseded_by` 链接仅 11 条
  - `action_type='update'` 仅 13 条
  - `valid_from / valid_to` 标记为 0 条
  - `chunk_revisions = 0`

这些信号说明：系统已经有表达事实变化的底层字段，但真实捕获到的 Jira/source old-new 片段没有稳定进入可消费的“变更事件链”。这正是本能力要补的桥。

## 为什么值得做

### 1. 它直接服务“重要记忆提取准确度”

用户近期已经明确把优先级从安全/secret 分类拉回“重要记忆提取的准确度”。Jira estimate、Story Points、assignee、fixVersion、status、deadline、owner 这些字段变化，是工作记忆里最容易被问、最容易写错、也最需要解释“当前 vs 历史”的对象。

把 old/new 片段只当普通文本，会带来三类错：

- **当前值错**：只召回历史片段，却回答成现在仍然如此。
- **历史值丢**：只保留最新摘要，用户问“最初是多少”时找不到。
- **反转关系丢**：`0.2 -> 0.1 -> 0.2` 被看成两条互相矛盾的记忆，而不是一次回滚。

### 2. 它复用现有系统，而不是另起治理台

本能力不替代现有 `entity_properties`，而是给它提供更干净的事件输入和投影视图：

- Source Memory Capture 继续负责保存 source capsule。
- Source Memory Distiller 继续负责 `oneLineCue / compactMemo / policyReceipt`。
- Change Memory Ledger 只抽取“属性变化事件”并生成事件链。
- Entity Property / TruthMaintainer 可从高置信事件链里更新 active/superseded 投影。
- Evidence Watch 只在当前值需要权威复核时介入。

### 3. 它减少用户核对成本

P0 不要求用户多做任何日常操作。用户只在已有场景中看到更准确的回执：

- Ask：回答前说明“当前保存链最后观测值”和“是否已复核权威来源”。
- Memory Lens：在当前 Jira/网页/消息旁显示字段变化链。
- Compose Assist：插入谨慎口径，不把历史片段说成当前事实。
- Source Memory 详情：把 raw old/new 片段折叠成事件链，同时保留原 capsule。

## 和已有功能 / progressing 的边界

| 已有方向 | 解决什么 | 本方案增加什么 |
| --- | --- | --- |
| `Source Memory Distiller` | 单个 source capsule 的 cue、memo、trigger、policy receipt。 | 从 source capsule 内抽取结构化 old/new 事件，并跨 capsule 串成同一属性链。 |
| `Memory Freshness Radar` | 用户曾保存/引用的来源在未来再次变化时，生成 source delta 和 affected-memory patch。 | 处理“变化片段已经在本地记忆里了”的场景，不抓新来源、不比较两次页面 snapshot。 |
| `Evidence Watch Contracts` | 对不确定或会变化的事实建立未来复核契约，抑制重复查证。 | 先把已知变化整理成历史链；只有当前值仍不确定时才创建或复用 Watch。 |
| `Evidence Cohesion Gate` | 使用证据前判断是不是同一个 subject/property/problem frame。 | 给 Gate 提供 canonical `subject.property` 事件链，减少 raw 片段混场。 |
| `Merge / Evolution / TTL` | chunk 级合并、summary 演化、低置信 TTL、向量清理。 | 更高层的属性变更事件，不改 raw chunk 原文，不把变更链等同于 chunk merge。 |
| `entity_properties` / TruthMaintainer | 当前事实投影、superseded/retracted、双时态字段。 | 从 Jira/source old-new 片段生成可审计输入；P0 可只做只读 ledger，不直接写 active truth。 |
| `Keystone Memory Briefs` | 跨来源沉淀高信号工作简报。 | Keystone 可以消费 ledger 的“最终值 + 历史变化”，但不负责解析字段变更。 |
| `Memory Change Simulator` | 启用新规则前 dry-run 真实 traces。 | 本方案实施前后可交给 Simulator 回放，但它本身不是配置变更预览层。 |
| `Prompt Context Compiler` | 发送前补齐 prompt 缺失槽位。 | Compiler 可引用 ledger 的当前/历史口径，避免 prompt 带错旧值。 |

## 竞品和行业对照

| 产品 / 研究 | 参考价值 | Personal AI 的机会 |
| --- | --- | --- |
| [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) | ChatGPT 区分 saved memories 与 reference chat history，并允许用户管理记忆。 | Personal AI 可以进一步把“这条记忆是历史状态还是当前状态”做成来源可审计的事件链。 |
| [ChatGPT Pulse](https://help.openai.com/en/articles/12293630-chatgpt-pulse) | OpenAI Help Center 当前显示 Pulse 正在退役，但它仍是“基于 memory / chat history 做异步个性化卡片”的参考案例。 | Ledger 可服务 Personal AI 自己的 Today / Notification 模式：只推真正影响当前任务的字段变化，不依赖 Pulse 这个具体产品继续存在。 |
| [ChatGPT Atlas Browser Memories](https://help.openai.com/en/articles/12574142-chatgpt-atlas-data-controls-and-privacy) | 浏览记忆强调 opt-in、可查看、可删除、可归档，不保存完整页面。 | Personal AI 的 browser/source memory 已在做 capsule；Ledger 让被保存的页面事实可以带时间状态。 |
| [Mem0 V3 memory algorithm](https://docs.mem0.ai/migration/platform-v2-to-v3) | 新算法强调 ADD-only：信息变化时旧事实和新事实都保留，并靠检索处理时间上下文。 | Personal AI 可采用同样“保留历史”的原则，但额外提供面向用户工作的字段链投影。 |
| [Mem0 Memory Evaluation](https://docs.mem0.ai/core-concepts/memory-evaluation) | 三层存储：vector/entity/SQL history log，并强调 ADD 事件审计。 | Ledger 可以落在 SQL event log + entity projection 中，既不丢历史，也不污染当前答案。 |
| [Zep / Graphiti](https://arxiv.org/abs/2501.13956) | Temporal knowledge graph 用来动态综合 conversation 与 business data，并维护历史关系。 | Personal AI 已经有 graph/entity 基础；需要把 Jira/消息中的变化事件结构化，形成真正可用的 temporal business memory。 |
| [LongMemEval](https://arxiv.org/abs/2410.10813) | 长期记忆能力包括 knowledge updates、temporal reasoning、abstention。 | Ledger 可直接生成针对“当前值/历史值/不知道时拒答”的 eval case。 |
| [STALE](https://arxiv.org/abs/2605.06527) | 指出 agents 常能检索到新证据，却无法判断旧记忆失效；最好模型整体准确率仍有明显缺口。 | Ledger 用显式 state adjudication 降低“旧前提被接受”的风险。 |
| [Linear issue history / releases](https://linear.app/changelog/2025-04-03-collapsed-issue-history) | Linear 折叠 issue history，减少 activity feed 噪声。 | Personal AI 不替代 Jira/Linear 原生 history，而是跨 Jira、消息、AI comment 和 source memory 提炼用户需要的变化链。 |

## 产品定义

### 核心对象

**MemoryChangeEvent**

```ts
type MemoryChangeEvent = {
  id: string;
  subjectKey: string;          // jira:MTR-147866, project:nova, skill:task-estimate
  subjectLabel: string;
  propertyKey: string;         // dev_estimate, story_points, assignee, status
  propertyLabel: string;
  oldValue?: string;
  newValue?: string;
  eventKind: 'set' | 'update' | 'clear' | 'revert' | 'same_value' | 'ambiguous';
  observedAt?: number;         // 从来源解析到的事件时间
  capturedAt: number;          // Personal AI 保存时间
  sourceRef: {
    type: 'source_memory_capsule' | 'message' | 'chunk' | 'entity_property';
    id: string;
    title?: string;
    url?: string;
  };
  actor?: string;
  authorityRole: 'jira_field' | 'owner_authored_comment' | 'team_message' | 'ai_generated_comment' | 'inferred';
  confidence: number;
  noiseFlags?: string[];       // collapse_comment, press_enter, ui_shell, duplicate_snippet
  parseReceipt: string;
};
```

**MemoryChangeChain**

同一 `subjectKey + propertyKey` 的事件链：

```ts
type MemoryChangeChain = {
  chainKey: string;
  subjectKey: string;
  propertyKey: string;
  currentProjection: {
    value?: string;
    status: 'projected_current' | 'historical_only' | 'conflicted' | 'needs_authority_check';
    sourceEventId?: string;
    caveat: string;
  };
  events: MemoryChangeEvent[];
  reversals: Array<{ fromEventId: string; toEventId: string; value: string }>;
  excludedNoiseCount: number;
  adjacentExcludedCount: number;
  lastBuiltAt: number;
};
```

**ChangeProjectionReceipt**

给 UI / Ask / Compose 使用的紧凑回执：

```ts
type ChangeProjectionReceipt = {
  label: string;       // 估时链：0.2 -> 0.1 -> 0.2
  boundary: string;    // 当前值来自保存片段，未复核 Jira 字段
  historyHint: string; // 曾反转 1 次；问“最初值”时可回溯
  actionHint?: 'use_as_historical' | 'verify_authority' | 'safe_to_quote';
};
```

### 不做什么

- 不物理删除 raw message、chunk、capsule。
- 不把低置信 old/new 片段直接写成 confirmed profile 或 final entity property。
- 不替代 Jira / Linear / GitHub 的原生 history。
- 不默认创建外部查证动作；只有用户当前场景需要 current truth 且链路不确定时才交给 Evidence Watch。
- 不新增每日 review queue。

## UX 设计

### 入口 1：Jira 页面 / Memory Lens 集成卡

当前页面命中 `subjectKey` 时，Memory Lens footer 或 Expanded Card 增加一条 `变更链`：

- `DEV Estimate：0.2 -> 0.1 -> 0.2`
- `来源：3 条 Jira comment capsule；过滤 2 条 UI 壳文本`
- `边界：当前值来自保存片段，未复核 Jira 字段`

点击展开：

- 事件时间线：old/new、来源、actor、置信度。
- 噪声过滤：`Collapse comment` / `Press Enter` 等被折叠。
- 相邻排除：同项目但不同 issue 的 estimate 不进入本链。
- 操作：复制谨慎口径、查当前权威值、打开 source-memory 详情。

### 入口 2：Ask / Quick Ask

当问题包含 `现在 / 当前 / 最初 / 之前 / 改过 / history / original` 等时间意图时，Ask 调用 ledger projection：

- 问当前值：优先 current projection，若 `needs_authority_check`，答案首行说明未复核权威来源。
- 问历史值：沿事件链回溯 first known / previous known。
- 问为什么变化：只有有原因 evidence 时才回答；否则明确“只保存到字段变化，没有保存变更原因”。
- 问错误前提：如果用户假设“还是 0.1”，但链最后是 0.2，Ask 抵抗 false premise。

### 入口 3：Compose Assist

输入框附近如果检测到用户正在写 Jira comment / AI prompt / status update，Compose Assist 可以生成 `change_context_patch`：

```text
补一句口径：
保存的变更链显示 DEV Estimate 曾从 0.2 改到 0.1，后又回到 0.2；如果要写当前值，请以 Jira 字段为准。
```

它不自动发送，不自动写回 Jira，只是插入前预览。

### 入口 4：Source Memory 详情

Source Memory capsule 详情页增加 `字段变化` section：

- 如果 capsule 可解析：显示从该 capsule 提取的 `MemoryChangeEvent`。
- 如果不可解析：显示 `未形成变更事件` 和原因，例如 `只有 UI 壳文本`、`缺少新值`、`字段名不稳定`。
- 如果同一 chain 里有后续事件：提示“这条资料是历史节点，不是当前值”。

## 实现轮廓

### P0：Jira old/new deterministic parser + projection

目标：先覆盖当前真实数据里最明显的 Jira field-change 片段。

1. 新增 `MemoryChangeLedgerService`
   - 输入：source-memory capsule、messages_raw、chunks。
   - 输出：`MemoryChangeEvent[]` 和 `MemoryChangeChain` projection。
   - P0 deterministic parser 支持：
     - `Field Original: A New: B`
     - `Field Original: A`
     - `Field New: B`
     - Jira issue key from `metadata.issueKey` / title。
     - 字段 alias：`DEV Estimate`、`QA Estimate`、`Story Points`、`Assignee`、`Team`、`Sprint`、`Component/s`。
   - P0 noise filter：
     - `Collapse comment`
     - repeated `Esone Qiu added a comment`
     - `Press Enter to open panel`
     - long UI shell before actual field line。

2. 新增表或复用事件表

推荐新表，避免把 source-memory event 和 property truth 混在一起：

```sql
CREATE TABLE memory_change_events (
  id TEXT PRIMARY KEY,
  chain_key TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  property_key TEXT NOT NULL,
  property_label TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  event_kind TEXT NOT NULL,
  authority_role TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  source_title TEXT,
  actor TEXT,
  observed_at INTEGER,
  captured_at INTEGER NOT NULL,
  noise_flags_json TEXT NOT NULL DEFAULT '[]',
  parse_receipt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(chain_key, source_ref_id, property_key, old_value, new_value)
);

CREATE TABLE memory_change_chains (
  chain_key TEXT PRIMARY KEY,
  subject_key TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  property_key TEXT NOT NULL,
  property_label TEXT NOT NULL,
  current_value TEXT,
  projection_status TEXT NOT NULL,
  current_event_id TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  reversal_count INTEGER NOT NULL DEFAULT 0,
  excluded_noise_count INTEGER NOT NULL DEFAULT 0,
  adjacent_excluded_count INTEGER NOT NULL DEFAULT 0,
  projection_receipt_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
```

3. Source Memory integration
   - 保存 / 补备注 / 重复刷新备注后，若 source kind 是 `jira_comment` 或标题含 Jira key，尝试解析。
   - 在 capsule metadata 加低副作用字段：`changeLedger: { eventIds, chainKeys, status, receipt }`。
   - 不阻塞入库；解析失败只是 `no_change_event` receipt。

4. Ask / Context Recall integration
   - `/ask` 的 evidence preflight 读取 matching chain。
   - `/context-recall` 对当前 Jira issue 返回 `changeProjection`。
   - Compose Assist 可读 `change_context_patch`。

### P1：Authority projection + entity_properties feeding

P1 才考虑把高置信链路写入或修正 `entity_properties`：

- `authority_role='jira_field'` 且来自真实 Jira field / REST，而不是 comment body：可以成为 current projection。
- `owner_authored_comment`：可作为 high-confidence historical event，但不直接盖过 Jira field。
- `ai_generated_comment`：低一档，用作候选或解释，不作为 final truth。
- 若链路出现反转或 missing authority：生成 `projection_status='needs_authority_check'`，交给 Evidence Watch。

写入 `entity_properties` 时：

- 使用现有 `superseded_by`、`status`、`action_type='update'`。
- 尽量补 `valid_from / valid_to` 或至少 `tx_start / tx_end`。
- 保留 source refs，避免把多个 old/new 片段压成一条不可追溯 profile。

### P2：跨来源变更链

支持更多来源：

- Glip / RingCentral：`X is now Y`、`changed from A to B`、中文“从 A 改成 B”。
- Meeting transcript：会议中决定 owner/deadline/status 改动。
- Web docs / release notes：版本、API、policy 的旧值/新值。
- External AI conversations：AI agent 执行后声明“我已把 X 改成 Y”。

P2 需要 LLM structured extraction，但必须：

- 输出 JSON schema。
- 带 evidence anchors。
- 不从单条模糊文本直接写 current truth。
- 使用 eval gate 验证 false positives。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 把 UI 壳文本当字段值 | P0 explicit noise filters；demo 和 eval 覆盖 `Collapse comment` / `Press Enter`。 |
| 把历史变更当当前事实 | `projection_status` 默认保守；非权威来源只给 `projected_current` 或 `needs_authority_check`。 |
| 同名 issue / 同项目混场 | chain key 必须包含 issue key 或稳定 subject id；Evidence Cohesion Gate 再次过滤。 |
| 过度打扰用户 | 不建新页面/队列；只在 Ask、Jira、Compose、Source detail 等自然场景显示。 |
| 和 entity_properties 重复 | Ledger 是 event log；entity_properties 是 current projection。P0 可完全只读，不写 truth。 |
| LLM 抽取成本和误判 | P0 deterministic；P2 LLM 只处理无法正则解析但影响高的候选。 |

## Eval 计划

需要 eval。原因：功能价值依赖解析准确率、当前/历史投影、时间推理、false premise 抵抗，以及 UI 噪声过滤。

实施时新增 suite：`change-memory-ledger`。

建议真实场景 case：

1. `jira-dev-estimate-reversal`
   - 输入：`MTR-147866` 两条相反 DEV Estimate capsule。
   - 期望：事件链 `0.2 -> 0.1 -> 0.2`，`reversal_count=1`，Ask 当前值回答带未复核 caveat。
2. `jira-story-points-conflict`
   - 输入：`MTR-148115` 多条 Story Points old/new。
   - 期望：链路状态 `conflicted` 或 `needs_authority_check`，不武断回答当前值。
3. `ui-noise-filter`
   - 输入：带 `Collapse comment`、`Press Enter` 的 source capsule。
   - 期望：噪声不进入 old/new value；parse receipt 说明过滤。
4. `original-vs-current-question`
   - 输入：同一字段三跳变化。
   - 期望：Ask 能分别回答“最初值”和“保存链最后观测值”。
5. `adjacent-ticket-isolation`
   - 输入：两个 MTR ticket 的 estimate 片段。
   - 期望：chain key 分离，不跨 ticket 合并。

验收要求：

- `npm run eval:validate`
- `npm run eval:run -- --suite change-memory-ledger --no-repair`
- 生成 Reader Contract report，明确“已证明 / 未证明”。
- 如果修改 recall/write path，还要按 `AGENT.md` 跑 `npm run eval:memory-abilities`，重点看 knowledge updates、temporal reasoning、abstention 不回退。
- 使用真实 `esone.qiu` memory-service 数据补 eval fixture 时，只保存必要片段和脱敏字段，不复制不必要的完整消息正文。

## 文档维护要求

如果后续决定实现，完成代码后必须把关键行为和逻辑迁入正式 feature docs：

- `docs/features/memory_capture.md`：Source Memory 保存后如何生成 change events，以及不阻塞入库的 receipt。
- `docs/features/memory_system.md`：`MemoryChangeLedgerService`、event log、projection、entity_properties feeding、Ask/recall consumption。
- `docs/features/ask.md`：当前值 / 历史值 / false premise 的回答边界。
- `docs/features/compose_assist.md`：`change_context_patch` 只插入谨慎口径，不自动发送或写回。
- `docs/features/index.md`：新增“小功能点：变更记忆账本”。

如果实现后形成独立 route/table/verify suite，建议新增 `docs/features/change_memory_ledger.md` 作为 source of truth，并在上述文档只保留接入摘要。

## 推荐切片

| 阶段 | 内容 | 价值 | 验收 |
| --- | --- | --- | --- |
| P0 | Jira deterministic parser + `memory_change_events/chains` + Source detail/Jira Memory Lens demo integration | 解决当前真实 old/new capsule 的准确消费 | eval 通过；不写 current truth；不新增 review queue |
| P1 | Ask/Compose consumption + Evidence Watch handoff + entity_properties 高置信 feeding | 当前/历史问答更准，写回复更谨慎 | Ask cases、Compose patch cases、memory-abilities 不回退 |
| P2 | Glip/meeting/web/external AI structured extraction | 跨来源字段变化链 | LLM schema eval、false-positive rate 门槛 |

## 最终建议

推荐进入实现评审，但 P0 范围要窄：

- 只做 Jira old/new deterministic extraction。
- 只读投影，不直接确认 current truth。
- 不做新页面，不做 review queue。
- 先把真实 source capsule 中的相反估时/Story Points 片段变成可解释链路。

这比再做一个全局记忆质量页面更贴近用户日常：用户打开 Jira、问 Ask、写回复时，Personal AI 直接告诉他“这个字段怎么变过，现在能不能安全引用”。
