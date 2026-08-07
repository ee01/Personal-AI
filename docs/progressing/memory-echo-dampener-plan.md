# 新能力：Memory Echo Dampener / 记忆回声抑制器

> 状态：待决策；本轮只完成方案与交互 Demo，未改运行时代码
> 规划日期：2026-07-31
> 建议复制标题：`新能力：记忆回声抑制器`
> 中文 Demo：[memory-echo-dampener-demo.html](./memory-echo-dampener-demo.html)

## 结论先行

Personal AI 已经会去掉完全重复的消息、隔离不同问题的证据、维护字段变化，也能要求关键简报至少有两个 `sourceType:sourceId`。但它还缺少一个更接近人类判断的能力：

> **同一句事实出现了四次，不代表得到了四次独立确认。**

一条 Jira 变更可能先被复制到 RingCentral，随后进入会议纪要，再被 ChatGPT / 豆包总结。四条记录来自四个 surface，却都沿用同一个原始事实。如果按记录数、来源类型数或相似文本次数累加置信度，系统会制造“伪共识”：旧值被转发得越多，反而越可能压过最新的权威值。

本方案建议加入一个默认静默的底层能力：为关键 claim 建立**来源家族（origin family）**与**派生边（derivation edge）**，把复制、引用、转述、摘要、AI 改写和当前页回声折叠为一个有效证据组；只有真正独立形成的来源才增加确认强度。

它的亮点不是多一个管理页，而是三个准确率变化：

1. `4 条提及` 可以被识别为 `1 个独立来源 + 3 条派生回声`。
2. 旧值的多次转发不能压过 Change Ledger 中更新、更权威的原始事件。
3. 两位不同的人独立判断出同一结论时，系统仍会保留真正的 corroboration，不把一切相似内容都粗暴合并。

默认没有新增用户操作。正常证据干净时完全静默；只有回声折叠改变了答案、草稿、简报资格或高责任写入时，才在现有 Ask / Memory Lens / Compose / Source Memory 证据区显示一句低噪回执。

本轮没有从 Reminder 选题：2026-07-31 通过 EventKit 重新读取到唯一 `Personal AI` 清单，共 4 条、未完成 0 条，因此没有随机候选，也不应修改 Reminder。

---

## 用户真实场景一：旧 Jira 值被“转发多数”淹没

### 场景

用户经常在 Jira、RingCentral、会议、AI 对话之间处理 estimate、Story Point、季度计划与状态变化。以下体验使用真实工作流形态和脱敏重组数据；其中 `0.1d → 0.2d` 用来演示多跳变化，不声明为当前 Jira 真值。

一条 estimate 经历了这些记录：

1. 周一 Jira 字段还是 `0.1d`。
2. 同事把它复制到 RingCentral：`MTR-147866 is 0.1d now.`
3. 会议纪要复述这条群聊；会后 AI 又把纪要摘要成“estimate 为 0.1d”。
4. 周二 Jira 原始字段更新为 `0.2d`，但只有一条最新记录。

### 用户逐步体验

1. 用户像平时一样打开 Quick Ask，问：“MTR-147866 现在的 DEV Estimate 是多少？”
2. **Before**：如果系统按命中数量累加，三条旧 `0.1d` 可能看起来比一条新 `0.2d` 更有“共识”。答案要么选错，要么给出模糊冲突。
3. **After**：记忆回声抑制器先把 RingCentral、会议纪要和 AI 摘要折叠到同一个 origin family；它们保留为来源链，但只贡献一次支持强度。
4. Change Ledger 的当前 Jira 事件仍是权威当前值，Ask 回答 `0.2d`，并在答案下显示：
   - `4 条提及 → 2 个来源家族`
   - `3 条旧提及来自同一条 Jira 快照，未重复计票`
   - `当前值以更新后的 Jira 事件为准`
5. 用户不需要确认或清理。只有点“为什么”才展开完整派生链。
6. 本次查看不会改 Jira、不会删除原始记忆、不会创建 Action，也不会把系统判断写回外部来源。

### Before / After

| | Before | After |
| --- | --- | --- |
| 支持强度 | 4 条记录近似 4 票 | 先按 origin family 折叠，再计算有效支持 |
| 新旧值 | 旧值可能因转发多而占优 | 最新权威事件优先，旧回声只保留历史解释 |
| 用户理解 | 只看见“多个来源冲突” | 看见“记录很多，但独立来源很少” |
| 用户操作 | 需要自己打开多处辨认 | 默认自动处理，详情仅按需展开 |

---

## 用户真实场景二：真正独立的确认不能被误删

### 场景

另一次估算里，Jira 记录为 `0.2d`。在没有引用 Jira 或转发他人措辞的情况下，用户根据代码范围重新估算，也明确说“我重新拆了一遍，仍然是 0.2d”；QA owner 又从测试矩阵独立得出相同结论。

### 用户逐步体验

1. 三条信息虽然文字相似，但没有 quote / reply / source URL / summary lineage，也来自不同时间、不同责任人和不同推导依据。
2. 系统不因“值一样”就合并；它识别为三个独立 origin family。
3. Memory Lens 在相关 RingCentral composer 场景中仍可高置信提示：`Jira 当前值与两次独立复核一致。`
4. 如果其中一条只是 AI 把用户原话改写成英文，它会被折叠到用户那条原始判断，不制造第四次确认。
5. 用户展开证据时能区分：
   - `Jira 当前字段 · 原始事件`
   - `你的重新估算 · 独立判断`
   - `QA owner 测试矩阵 · 独立判断`
   - `AI summary · 派生回声，不重复计票`
6. 普通使用中没有新 badge 洪水；只有当“独立来源数”影响结论时显示回执。

### Before / After

| | Before | After |
| --- | --- | --- |
| 相似文本 | 可能全部合并，损失真实 corroboration | 只在有派生证据时折叠 |
| AI 摘要 | 可能和原话各算一次 | 摘要链接到原话，只保留解释价值 |
| 独立判断 | 仅凭 source type 粗略估计 | 结合责任人、来源、时间、引用链和推导依据 |
| 失败策略 | 不确定时随模型猜 | 不确定时保留为 `unknown`，不强行合并 |

---

## 为什么现在做

### 1. 线上真实数据已经出现“内容不重复，但来源并不独立”的结构

2026-07-31 对 `10.32.56.212` 上 `esone.qiu` memory service 做了只读 API 与 SQLite `readonly + immutable=1` 检查；没有调用会更新 access count、恢复 stale action 或产生分析写入的接口。当前快照约有 11,631 条 messages、10,463 个 chunks；快照仍可能漏掉尚未 checkpoint 的 WAL，因此只作为结构证据，不当生产审计结论。

- 非空 raw message 精确重复为 195 组、416 条 duplicate excess；长度 ≥ 8 的实质内容跨 source 精确重复为 0。也就是说，普通 exact dedup 不是主要答案。
- 1,281 条 issue 候选里只发现两个高相似跨 surface 传播候选：一条 Jira 记录 4 秒后被 Web Source Memory 再包装保存；另一条 Glip issue 标题被完整嵌入后续 Calendar agenda。
- 更关键的真实形态是**语义派生回声**：某条脱敏后的 `MTR-148***` DEV Estimate `0.3 → 0.4` 变化链，后来出现在 Web 1 条、Daily Log 3 条、Reflection Thread 28 条 chunks 中；32 条内容 hash 全不同。这不是字节重复，而是同一证据被持续改写、反思和再投影。
- 全表跨 source-label 的 chunk hash 重复主要来自 `unknown ↔ daily_log` 旧标签或派生投影，也不能当作独立来源相互佐证。
- `source_type` 不是严格 provenance；正式判链仍必须结合 `source_url`、`source_memory_links`、`file_path`、显式 parent ref 与时间。重复 issue / value 也可能只是合法历史，不能只凭相似度强行折叠。

这些检查证明真实库里已经存在“一个原始来源 → 多个不同 hash 派生记录”的结构，但**仍不能单独证明某个具体 Ask 已经因此答错**。因此本方案要求先 shadow eval，再影响生产排序。

更重要的是，当前代码存在可验证的结构暴露：

- `IngestionPipeline` 的主要去重键是 `post_id`，或 `content + source_type + sender`；一段内容换 surface、换 sender、被摘要或轻微改写后就可能成为新记录。
- `ContextRecallService` 会合并同一个 `sourceClusterKey`，主要解决同一 source capsule / meeting cluster 的 UI 重复，不建立跨 Jira → Glip → meeting → AI summary 的派生关系。
- `KeystoneBriefService.evaluateStatus()` 当前把唯一的 `${sourceType}:${sourceId}` 数量当作 `independentSourceCount`。四个派生记录只要 source id 不同，就可能被当成四个独立来源。
- `EvidenceCohesionGate` 判断证据是不是同一问题、同一 subject、同一 claim slot；它不会判断同一 cluster 内的多条 evidence 是否都来自同一个原始 claim。

### 2. 产品已经进入“多 surface 记忆互相引用”的阶段

Personal AI 已覆盖 Glip、Jira、meeting、calendar、web、Source Memory、外部 AI 历史、Codex / OpenClaw agent session、Quick Ask、Compose Assist 和 Skill Foundry。来源越多，单纯“来源数量越多越可信”越危险，因为不同 surface 经常只是同一信息的传播路径。

### 3. 当前优先级正是核心准确度，而不是新治理页面

已有搁置决策明确要求近期优先高价值抽取、召回质量、证据 grounding、场景有用性和现有能力可靠性。回声抑制直接改善这些核心路径；P0 可以后端 shadow 运行，不需要新页面、用户队列或桌面深度能力。

---

## 产品定义

### 一句话

**让 Personal AI 记得一条证据从哪里“出生”、如何被复制与改写，并只让真正独立的来源增加置信度。**

### 目标

1. 阻止复制、引用、转述和 AI 摘要制造伪共识。
2. 阻止旧事实因传播次数多而压过更新、更权威的当前事实。
3. 保留真正独立 corroboration，不能把所有相似文本粗暴去重。
4. 减少送进 LLM 的重复 token，把 attention budget 留给补充、冲突与独立判断。
5. 正常时静默；仅在决策后果变化或用户主动展开时给出可理解回执。

### 非目标

- 不删除、合并或改写 `messages_raw`、transcript、source capsule 或外部原文。
- 不做新的 Memory Trust Console、全局来源图谱页面或人工 review queue。
- 不判断事实一定为真；来源独立不等于来源可靠。
- 不替代 Change Ledger 的当前/历史值判断。
- 不替代 Claim Attribution 的“谁说的、什么语气”；本能力关心多个 claim 是否来自同一信息源。
- 不替代 Evidence Cohesion 的“是不是在回答同一问题”。
- 不复活已搁置的 Artifact Memory Lineage；P0 不要求用户定义“我的成果”或维护完整 artifact 影响链。

---

## 与现有及搁置能力的去重

| 能力 | 已解决什么 | 本能力新增什么 | 必须复用 / 禁止重复 |
| --- | --- | --- | --- |
| Ingestion dedup | 同 post 或同 `content + source_type + sender` 的重复写入 | 跨 source、轻改写、引用、摘要和 AI 改写的派生家族 | 不改变 raw 去重语义；在派生层建关系 |
| Merge / Evolution / TTL | 对已经进入系统的高相似 chunk 做 ADD / UPDATE / MERGE / NOOP 与生命周期处理 | 允许多份合法投影继续存在，但不把它们误算为独立佐证 | 不触发二次合并，不覆写 raw episode |
| Scene Memory Autopilot | 低信息、当前页 echo、同 source cluster 的展示过滤 | 消费前的 claim-level 独立来源计数 | 复用 quiet reason；不另建 attention 页面 |
| Evidence Cohesion Gate | 把同题 evidence 留在一起，隔离跨题证据 | 在同题 cluster 内判断哪些只是同一个 origin 的回声 | 固定顺序：Cohesion → Echo Dampener |
| Change Memory Ledger | 保存字段 old/new/current/historical 链 | 防止旧 event 的派生副本累加成多数票 | 当前值仍由 Ledger/authority 决定 |
| Keystone Memory Brief | 多来源高信号简报 | 把“两个 source id”升级为“两个 independent origin family” | 不新增第二种简报 |
| Source Memory Distiller | source capsule 内的 evidence spans、takeaways、triggers、fact candidates | 把多个 capsule / message / summary 连接到同一个原始 claim | 复用 evidence span hash 与 cluster metadata |
| Memory Weave Provenance | 告诉用户答案跨了多少 source kind、时间与实体 | 防止派生 surface 虚增“跨来源”统计，额外输出 independent family count | 继续复用 weave 展示，不增加第二枚常驻 badge |
| Memory Claim Attribution（待决策） | owner、reported speech、AI suggestion、hypothesis、commitment | 证据之间的 derivation / independence | 可消费 attribution，但 P0 不依赖其 UI 或落地 |
| Artifact Memory Lineage（搁置） | 用户维护成果物的完整来源与影响链 | 只为 claim 置信度做最小派生边，无 artifact 工作台 | 不能增加“成果中心”或维护成本 |
| Memory Intake Quality Gate（搁置） | 以 review queue 处理已入库内容的噪声、重复与合并 | 后台自动计算证据独立性，用户只在后果变化时看回执 | 不复活人工质检台，不要求逐条清理 |
| Memory Trust Console（搁置） | 全局可信、隐私、过期与修复控制台 | 热路径自动降权同源回声 | 不建全局治理页或新的维护责任 |
| Memory Outcome Loop | 提示/草稿被使用后的效果反馈 | 使用前证据是否重复计票 | 不重复 outcome event 与反馈入口 |

去重结论：这是一个**证据独立性层**，位于“同题聚类”与“置信度 / 生成 / 写入”之间。现有系统已经知道“这些证据相关”，但还不知道“它们是否只是互相抄来的”。

---

## 竞品与行业对比

### ChatGPT Memory / Dreaming

- [OpenAI Dreaming（2026-06-04）](https://openai.com/index/chatgpt-memory-dreaming/)明确把长期记忆的 freshness、correctness、relevance 和多年规模作为新架构要解决的问题，并在后台合成跨会话记忆。
- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq)提供回答下的 Memory Sources，用户可以查看或纠正影响回答的记忆来源。

启发：消费时显示“这次为什么个性化”已成为主流体验；但“显示两个来源”仍不等于“证明它们互相独立”。Personal AI 的差异是把来源传播关系用于排序和写入，而不是只展示引用列表。

### NotebookLM

- [NotebookLM chat grounding](https://support.google.com/notebooklm/answer/16179559?hl=en)强调回答基于用户选中的 notebook sources，并以 inline citations 回到原文；[管理 sources](https://support.google.com/notebooklm/answer/16164461?hl=en)允许逐源纳入或排除。

启发：严格 source grounding 很重要，但用户可能把同一原文、复制件和 AI 摘要一起放入 sources。回声抑制解决的是 source set 内的独立性，而不是“有没有来源”。

### Mem0

- [Mem0 Group Chat](https://docs.mem0.ai/platform/features/group-chat)要求 `role + name`，以正确归属多人对话中的记忆。
- [Mem0 Direct Import](https://docs.mem0.ai/platform/features/direct-import)明确说明 `infer=False` 会跳过 duplicate detection，混合导入模式可能保存第二份相同事实。

启发：角色归属和单管线 dedup 是必要基线；Personal AI 还需要处理跨平台、跨导入模式和 summary 链的派生关系。

### 研究与专家信号

- Anthropic Applied AI 团队在 [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 中建议寻找“最小的高信号 context”；重复回声会消耗 attention budget，却不增加新信息。
- EMNLP 2025 的 [RA-RAG](https://aclanthology.org/2025.emnlp-main.1738/)显示多来源 RAG 不能只看相关性，还需要估计 source reliability。
- NAACL 2025 的 [IMRRF](https://aclanthology.org/2025.naacl-long.461/)把冗余 evidence 明确列为会干扰 LLM 判断的问题，并加入 redundancy filtering。
- 2026 预印本 [Useful Memories Become Faulty When Continuously Updated by LLMs](https://arxiv.org/abs/2605.12978)发现反复 consolidation 可能让原本有用的记忆退化，建议保留 raw episodes 并显式门控 consolidation。
- 2026 预印本 [Agents Don't Just Agree, They Remember](https://arxiv.org/abs/2607.10526)观察到 repeated reinforcement 会放大持久化后的 status promotion、attribution removal 和 scope broadening；这直接支持“重复出现不能自动升级权威”。
- ICLR 2026 的 [Counterfactual Reasoning for RAG](https://openreview.net/forum?id=9U51rOnGko)提出 Correlation Trap：表面高度相关的 evidence 不一定真正决定答案。回声抑制器可在 Personal AI 中把这条原则落到来源家族与排序上。

### 竞品差异表

| 产品 / 研究方向 | 来源可见 | 角色归属 | 普通 dedup | 跨 surface 派生家族 | 独立来源影响置信度 |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Memory Sources | 是，显示部分来源 | 部分 | 内部未公开 | 未公开 | 未公开 |
| NotebookLM | 是，source-first | 不是重点 | 文件级 | 未公开 | 未公开 |
| Mem0 | metadata / history | group chat 支持 | infer 管线内支持 | 未见公开契约 | 未见公开契约 |
| Personal AI 现状 | evidence refs / weave | message level；claim plan 待决策 | source 内支持 | 否 | `sourceType:sourceId` 近似 |
| 本方案 | 复用现有 evidence UI | 可复用 attribution | 保留现状 | **是** | **是，且失败关闭** |

---

## UX 设计

### 核心原则

1. **自动，不新增旅程。** 用户继续正常聊天、开会、问 Ask、使用 Lens / Compose。
2. **结果优先。** 回执先说“4 次提及实际来自 1 个源”，不先展示内部 graph 名词。
3. **只在后果变化时出现。** 若折叠前后答案、简报资格和置信度都不变，默认静默。
4. **原始记录永远可追。** 折叠只影响计票和 context 预算，不删除证据。
5. **不确定不乱合并。** `unknown` 不被强制并入某个 origin family。

### 三层呈现

#### L0：完全静默

证据没有可疑回声，或回声折叠不影响结果。Ask / Lens / Compose UI 不增加任何 badge。

#### L1：一句回执

当折叠改变答案、降级简报或阻止高责任写入时：

> `证据回声已折叠：4 条提及来自 1 个独立源；当前值以 7 月 29 日 Jira 更新为准。`

#### L2：按需来源链

用户点“为什么”后看到：

```text
Jira change event · 原始来源 · 09:42
  ├─ RingCentral repost · 明确引用 · 09:48
  ├─ Meeting recap · 转述 RingCentral · 10:16
  └─ ChatGPT summary · 摘要 meeting recap · 10:22
```

每条仍可打开原来源；“折叠”只表示不重复增加置信度。

### 现有 surface 接入

| Surface | 用户看见什么 | 默认不做什么 |
| --- | --- | --- |
| Quick Ask / Ask | 答案下的一句独立来源回执；按需展开 | 不要求确认、不写 answer 之外的新事实 |
| Memory Lens | 只有首屏 cue 因回声降级时显示小标签 | 不新增第二个 Lens 卡或入口 |
| Compose Assist | 草稿依据中显示“同源回声未重复采用” | 不把来源链插入用户草稿正文 |
| Keystone Brief | candidate / partial 原因显示“独立来源不足” | 不创建新的简报队列 |
| Source Memory detail | evidence span 旁显示 origin family 和 derived relation | 不改 source 原文 |
| Change Ledger | 当前事件显示有多少旧回声被降权 | 不改变字段 current/historical 规则 |
| Reflection / Action | prompt 只收到每个 family 的代表证据与冲突补充 | 不因“多条回声”创建 confirm/action |

### Demo 说明

同目录 Demo 不是新产品页；它模拟现有 RingCentral 工作场景和 Personal AI Quick Ask 浮窗。顶部深色条是**原型控制台，不属于生产 UI**。可体验三种状态：

1. `旧值回声`：切换 Before / After，看三条派生旧值如何从多数票变成一条来源家族。
2. `独立确认`：相同结论来自三条独立推导，系统保留 corroboration；AI summary 被折叠。
3. `正常静默`：回声不影响结果时，没有额外产品 UI。

---

## 核心数据契约

### Evidence Origin Family

```ts
type EvidenceDerivationRelation =
  | 'exact_copy'
  | 'quote'
  | 'reply_reference'
  | 'forward'
  | 'summary_of'
  | 'translation_of'
  | 'ai_rewrite_of'
  | 'same_connector_artifact'
  | 'unknown';

interface EvidenceOriginFamily {
  id: string;
  claimKey: string; // subject + property + normalized value + time bucket/version
  canonicalOriginRef: string;
  memberRefs: string[];
  effectiveSupportCount: number;
  independenceState: 'single_origin' | 'multi_origin' | 'unknown';
  authority: 'canonical' | 'owner_observation' | 'independent_observer' | 'derived' | 'unknown';
  confidence: number;
  policyVersion: string;
  computedAt: number;
}
```

### Derivation Edge

```ts
interface EvidenceDerivationEdge {
  id: string;
  fromEvidenceRef: string; // parent / origin
  toEvidenceRef: string;   // derived child
  relation: EvidenceDerivationRelation;
  confidence: number;
  signals: Array<
    | 'explicit_source_ref'
    | 'quote_id'
    | 'reply_id'
    | 'canonical_url'
    | 'content_hash'
    | 'near_copy_fingerprint'
    | 'temporal_precedence'
    | 'speaker_or_role'
    | 'llm_ambiguous_resolution'
  >;
  sourceSpanHashes: string[];
  createdAt: number;
}
```

### 回执

```ts
interface EvidenceIndependenceReceipt {
  mentionCount: number;
  originFamilyCount: number;
  collapsedEchoCount: number;
  independentConfirmationCount: number;
  changedOutcome: boolean;
  currentAuthorityRef?: string;
  summary: string;
  writesRawMemory: false;
  writesExternal: false;
}
```

### 存储建议

P0 建议新增两张小表，而不是把 lineage JSON 重复塞进每条 memory：

```sql
CREATE TABLE evidence_origin_families (
  id TEXT PRIMARY KEY,
  claim_key TEXT NOT NULL,
  canonical_origin_ref TEXT NOT NULL,
  independence_state TEXT NOT NULL,
  effective_support_count REAL NOT NULL,
  confidence REAL NOT NULL,
  policy_version TEXT NOT NULL,
  computed_at INTEGER NOT NULL
);

CREATE TABLE evidence_derivation_edges (
  id TEXT PRIMARY KEY,
  from_evidence_ref TEXT NOT NULL,
  to_evidence_ref TEXT NOT NULL,
  relation TEXT NOT NULL,
  confidence REAL NOT NULL,
  signals_json TEXT NOT NULL,
  span_hashes_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(from_evidence_ref, to_evidence_ref, relation)
);
```

原始文本仍只留在现有 source；新表保存 refs、关系、hash、判定信号和版本。

---

## 判定流水线

### Stage 0：保留明确 provenance

优先消费不需要模型猜的信号：

- Jira changelog / issue / comment id；
- RingCentral post id、quote id、reply-to、forward metadata；
- meeting agenda / transcript / recap source refs；
- Source Memory canonical URL、capsule id、evidence spans；
- AI conversation import 的 parent message、attachment、source URL；
- Codex / OpenClaw artifact refs 与 tool result ids。

连接器若知道 parent，就必须传 parent；不要等入库后再从文字猜。

### Stage 1：确定性派生检测

按高精度顺序建立 edge：

1. 显式 quote / reply / forward / sourceRef；
2. 相同 canonical artifact + 相同 field/change id；
3. 相同内容 hash；
4. 高阈值 near-copy fingerprint（规范化数字、issue key、实体、n-gram）；
5. 时间方向：child 必须晚于 parent，不能让未来记录成为过去记录的来源。

这些规则命中时，不需要 LLM。

### Stage 2：claim 对齐

不能只因两段文字相似就合并。至少同时满足：

- 同 subject / entity / Jira key；
- 同 property / claim slot；
- 同 polarity；
- 同值或明确 summary containment；
- 时间口径兼容。

若 Claim Attribution 已实现，再加入 owner / speech mode：AI summary 可链接到 user claim，但不能反向成为 user claim 的来源。

### Stage 3：严格 LLM fallback

只有规则无法判断、且候选会影响高责任结果时才调用结构化 LLM。LLM 只能返回：

- `likely_derived`
- `likely_independent`
- `unknown`

没有显式或强确定性信号时，LLM **不能单独创建高置信 derivation edge**。`unknown` 保留为独立候选，但只获得有限 diversity bonus，避免误合并。

### Stage 4：来源家族构建

- 对高置信 edge 求 connected components。
- family 的 canonical origin 优先：current canonical connector event → owner direct observation → earliest explicit parent → unknown。
- 若出现循环引用，保留所有节点，选最早且 authority 最高的节点作为代表，并标 `cycle_detected`。
- source 删除或更正时只重算受影响 family，不改 raw memory。

### Stage 5：有效支持计算

不要再按 member 数量线性累加：

```text
memberWeight = relevance × freshness × authority × attribution × trust
familyWeight = max(memberWeight) + boundedComplementBonus
claimSupport = combine(distinct familyWeight)
```

- 同 family 内最强 member 提供主要 support。
- 其他 members 只提供很小、封顶的“传播 / 补充细节” bonus，不能制造多数票。
- 不同 family 才能增加 `independentConfirmationCount`。
- Change Ledger current event 的时态/authority gate 先于回声数量；旧 family 无论 members 多，都不能覆盖当前 canonical event。

### Stage 6：消费端顺序

```text
Claim / raw evidence
  → trust & attribution
  → time / Change Ledger projection
  → Evidence Cohesion（是不是同题）
  → Echo Dampener（是否同源回声）
  → scene relevance / token budget
  → Ask / Lens / Compose / Brief / Reflection / Action
```

---

## 技术实现范围

### 新服务

1. `EvidenceOriginService`
   - 解析 connector provenance；
   - 生成/更新 derivation edges；
   - 构建 origin families；
   - 处理删除、源刷新和 policy version 重算。
2. `EvidenceIndependenceGate`
   - 接收 Cohesion 之后的候选；
   - 返回 family representatives、independent confirmations 与 receipt；
   - 纯函数部分应可脱离数据库测试。
3. `EvidenceOriginBackfillWorker`
   - 只处理最近 90 天、高责任 claim、Keystone candidate、Change Ledger 冲突和实际被 Ask 使用的 evidence；
   - 不建议一次性对全库跑 LLM lineage。

### 现有模块改动点

| 模块 | 改动 |
| --- | --- |
| `IngestionPipeline` | 保留 explicit parent refs；写后异步排 origin，不阻塞 raw 保存 |
| `SourceMemoryCaptureService` / deep worker | 复用 evidence span hash；输出 source-to-source derivation hints |
| `EvidenceCohesionGateService` | 输出同题候选后交给 independence gate；自身职责不扩大 |
| `KeystoneBriefService` | readiness 从 unique source id 改为 independent origin family ≥ 2 |
| `ContextRecallService` | 每个 family 默认只给 LLM / UI 一个代表 + 必要冲突成员 |
| `MemoryChangeLedgerService` | current/historical event 作为 canonical origin 输入；旧 echo 不改变 current projection |
| `/ask` / Compose | 使用 compact receipt；只有 `changedOutcome=true` 时首屏显示 |
| Reflection / Action | prompt 和 action evidence refs 记录 family representative，保留完整 lineage link |

### API 草案

内部消费：

```http
POST /internal/evidence-independence/evaluate
```

```json
{
  "intent": "answer_question",
  "claimSlot": "estimate",
  "candidates": ["jira:event:1", "glip:post:2", "meeting:span:3"]
}
```

响应：

```json
{
  "includedRepresentatives": ["jira:event:1"],
  "preservedContext": ["meeting:span:3"],
  "families": [
    {
      "id": "origin:estimate:mtr-147866:v1",
      "canonicalOriginRef": "jira:event:1",
      "members": 3,
      "effectiveSupportCount": 1
    }
  ],
  "receipt": {
    "mentionCount": 3,
    "originFamilyCount": 1,
    "collapsedEchoCount": 2,
    "changedOutcome": true,
    "writesRawMemory": false,
    "writesExternal": false
  }
}
```

P0 不建议开放新的用户 CRUD API；详情可通过现有 evidence endpoint 按 refs 读取。

### 性能预算

- 显式 provenance / hash 路径 P95 < 15ms / new evidence。
- near-copy 检测只在同 subject / claim slot / 时间窗内运行，不做全库 O(n²)。
- Ask 热路径只读取预计算 family；若缺失，保守返回原候选并标 `independence=unknown`，不现场跑重 LLM。
- 每个 family 送入生成上下文的默认成员：1 个代表 + 1 个必要冲突 / 补充，避免 context 膨胀。

---

## 失败策略、隐私与恢复

### 误合并风险

最危险的错误不是漏折叠，而是把两次真正独立确认合成一次。措施：

- 文本相似不是充分条件；需要 subject、claim slot、time、role / source relation 共同支持。
- 只有 explicit / deterministic 高置信 edge 才影响高责任写入。
- ambiguous LLM 结果默认 `unknown`。
- 独立确认 recall 必须是 hard eval gate。

### 漏折叠风险

- 低置信回声可先只减少 context token，不改变事实结论。
- 后续 connector 补齐 parent refs 后可重算 family。
- 用户打开完整证据时仍能看到所有 members，不会因漏折叠丢失来源。

### 来源可靠性边界

- independent 不等于 correct；familyWeight 仍要乘 authority / freshness / trust。
- 三个独立但低可信来源不能覆盖一个高权威 canonical current event。
- 同一组织的三个自动镜像也可能不独立，connector metadata 要允许 `same_upstream_system`。

### 隐私

- 新表只存 refs、hash、relation、confidence、signals、policy version；不复制 raw text。
- source span 只存 hash；详情通过现有权限边界回读原来源。
- 不向外部 AI 或第三方服务发送全库内容做 lineage 分类。

### 删除与恢复

- 删除源 evidence 时沿用 cascade deletion，移除相关 edge，重算受影响 family。
- 用户可在 debug / evidence detail 中执行“解除错误关联”；它只删派生 edge，不改原消息或外部系统。
- policy version 升级支持 shadow rebuild；旧 family 保留到新版本验证完成再切换。

---

## Evals 决策：必须创建并跑真实报告

### 为什么必须

本能力的价值依赖：

- 是否正确识别同源回声；
- 是否保留真正独立确认；
- 是否改变 Ask / Lens / Brief 的排名与答案；
- LLM fallback 是否在模糊文本上保持保守。

普通单元测试不足以证明用户体验。因此实现时必须新增 `evals/` suite，使用真实场景并至少跑一份 Reader Contract report；达不到门槛就继续改，直到所有测试通过。

### Suite 建议

```text
suite id: memory-echo-dampener
cases: evals/cases/memory-echo-dampener/
workflow: evals/workflows/memory-echo-dampener/experience.md
judge: deterministic first; ambiguous relation 才使用 pinned LLM judge
schedule: weekly
```

### 必测真实场景

1. **Jira 旧值回声**：Jira → Glip → meeting → AI summary，旧值多次出现；最新 canonical event 必须胜出。
2. **真正独立确认**：不同人、不同依据得到相同值；不得误合并。
3. **AI 改写回声**：user 原话与 AI translation / summary；effective support 只能加一次。
4. **循环引用**：A 引 B，B 又在后续 recap 引 A；不能形成无限权重。
5. **同文不同 subject**：模板句相同但 issue key 不同；不得跨 subject 合并。
6. **未知来源**：无 parent metadata 的相似文本；保持 unknown，不因模型自信强并。
7. **Keystone readiness**：两个 source id 但一个 origin family 时仍是 candidate；两个独立 family 才 ready。
8. **正常静默**：折叠不改变结果时 UI 不显示新回执。

若缺少足够 fixture，应从 `10.32.56.212` 的 `esone.qiu` 数据中只读抽取、脱敏并冻结真实样本，重点覆盖 Jira key、estimate、meeting recap、Glip quote 与外部 AI summary 的传播链。

### 关键指标与 hard gates

| 指标 | 目标 |
| --- | --- |
| `false_corroboration_rate` | golden cases = 0 |
| `stale_echo_override_rate` | golden cases = 0 |
| `independent_confirmation_recall` | 100% hard cases 保留 |
| `false_merge_rate` | 0 on hard negatives |
| `keystone_independence_gate_accuracy` | 100% fixture cases |
| `receipt_precision` | 只在 changed outcome / explicit open 出现 |
| Ask token reduction | echo-heavy cases ≥ 30%，且 evidence coverage 不降 |

实现涉及 recall / write path，因此还必须：

```bash
npm run eval:validate
npm run eval:run -- --suite memory-echo-dampener --no-repair
npm run eval:memory-abilities
```

报告必须明确区分“证明了什么 / 没证明什么”，并列出每个 case 的 origin families、被折叠 members、保留的独立确认和最终消费证据。

---

## 分期计划

### Phase 0：真实基线 + shadow family（1–2 周）

- migration、refs、edge / family schema；
- 明确 provenance 与 hash 检测；
- 对近 90 天、高责任 claim 和 Keystone candidate shadow 计算；
- 不改 Ask / Lens / Brief 结果，只记录 before / after diff；
- 建真实 eval suite 与报告。

**退出条件：** 能量化伪共识暴露；hard negative 无误合并；所有 edge 可追到原 source。

### Phase 1：Ask + Keystone Brief 高精度接入（1–2 周）

- 只启用 explicit / deterministic 高置信 family；
- Ask context 与答案证据先折叠；
- Keystone readiness 改用 independent origin family；
- changed outcome 时显示一句回执；
- 六能力 benchmark 无回归。

**退出条件：** stale echo 不再覆盖 current authority；正常 Ask 无新 UI 噪音。

### Phase 2：Memory Lens + Compose + Source detail（1–2 周）

- Lens / Compose 消费 family representatives；
- Source detail 展示按需派生链；
- 支持解除错误 edge；
- near-copy 高阈值 detector 上线。

**退出条件：** 回声场景 token 明显下降，独立确认 recall 不降。

### Phase 3：Reflection / Action / Skill / backfill（后续）

- Reflection 和外部 action 不再用多条回声制造“证据充分”；
- Skill suggestion 的重复证据必须来自独立 episode / family；
- 按实际消费热度渐进 backfill，不全库盲跑 LLM。

---

## 验收标准

### 产品验收

- 用户继续正常使用 Ask / Lens / Compose，没有新增必做步骤。
- `4 mentions / 1 origin` 能用一句自然中文说明。
- 原始来源都保留且可打开；折叠不等于删除。
- 正常场景无新 badge；changed outcome 才有回执。
- UI 明确“只读 / 未写回 / 未删除 / 未外发”。

### 技术验收

- `KeystoneBriefService` 不再用 source id 数量直接近似独立来源。
- 高置信 derivation edge 可重算、可删除、带 policy version。
- source 删除 / 更新后 family 正确重建。
- Ask 热路径不运行重 LLM。
- target tests、memory-service build、相关 extension / Quick Ask E2E 通过。
- `memory-echo-dampener` eval 全部通过并生成 report。
- `eval:memory-abilities` 六能力无 > 0.05 回归。

### 体验验收

- 1440px 与 390px 视口无横向溢出。
- 键盘可展开/收起来源链，焦点可见。
- Screen reader 能读出 mention count、origin family count 和 write boundary。
- Before / After 用户测试中，用户能在 10 秒内解释为什么“4 条记录不是 4 次确认”。

---

## 实现后的正式文档维护

完成功能代码的最后一步，必须把关键点和关键逻辑精简维护进正式 feature docs：

1. 建议新建 `docs/features/evidence_independence.md` 作为跨 surface 唯一完整契约；如果实现最终只限 Ask + Keystone，也可以并入 `docs/features/evidence_cohesion_gate.md`，不要为很小切片过度拆文档。
2. 在 `docs/memory_system.md` 说明 ingestion dedup、cohesion 与 independence 的顺序和差异。
3. 在 `docs/features/ask.md`、`docs/features/memory_lens.md`、`docs/features/memory_capture.md`、`docs/features/change_memory_ledger.md` 只记录各 surface 的接入和回执，不复制整套算法。
4. 若 Claim Attribution 已实现，双方文档明确 `owner / speech mode` 与 `origin / derivation` 是两个正交轴。
5. 更新 `docs/index.md` 的小功能行和最后更新日期。
6. 功能落地后删除本 plan；将 demo 移到 `docs/demo/`，保持 `docs/progressing/` 只放未完成规划。

---

## 风险与待决策点

1. **P0 是否只做 Ask + Keystone？** 推荐是。它们最容易证明准确率收益，且没有新入口。
2. **是否依赖 Claim Attribution？** 不依赖。P0 用 connector refs、hash、subject / claim slot；未来再把 owner / speech mode 加入判定。
3. **是否允许 LLM 建 edge？** 只允许低责任、可撤销的 `likely_*` shadow；高责任结果只消费 explicit / deterministic edge。
4. **是否显示来源图？** 不建独立图谱页。只在现有 evidence detail 里展示当前答案涉及的小型树。
5. **是否全库 backfill？** 不建议。按近 90 天、高责任候选和实际被消费的 evidence 渐进处理。

---

## 最终建议

建议进入实现评审，并从 **Phase 0 shadow + Phase 1 Ask / Keystone** 开始。

它直接服务 Personal AI 的核心价值：记忆不只是“搜到更多”，而是知道哪些记录真正提供了新证据。对拥有大量聊天、会议、Jira、网页和外部 AI 记忆的用户来说，这能避免一个会随数据规模恶化的问题——**信息传播得越广，错误就看起来越像共识。**

这个方向比再做一个治理页、迁移工具或特定场景流程更值得当前优先：用户不需要学新入口，却会在最重要的时刻得到更少噪音、更准的当前事实和更诚实的置信度。
