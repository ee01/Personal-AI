# 新能力：Memory Change Ledger / 记忆变更账本

> 生成时间：2026-07-02 CST
> Codex 会话标题：新能力：记忆变更账本
> 状态：待决策，仅规划与 demo，不做运行时代码实现
> Demo：[`memory-change-ledger-demo.html`](./memory-change-ledger-demo.html)

## 真实场景 1：Ask 回答当前值时，先解释它为什么变了

用户在 Quick Ask 里问：

> MTR-147866 / MTR-148115 这些 estimate 现在到底是什么值？之前我记得有 0.2、0.1、0.3、0.4 来回变过，别把旧值当当前值。

现在的坏体验：

1. Personal AI 可以召回多条 Jira comment、source-memory、reflection 和 `entity_properties`。
2. 这些证据里有旧值、新值、反转、系统推断和 Jira 页面 UI 噪音，例如 `Collapse comment`。
3. Ask 最终可能只给一个当前值，用户却不知道它为什么采用这个值，旧值为什么没被用，是否只是某次 AI comment 的推断。
4. 如果用户继续把答案复制给 Codex / Claude / Jira 评论，旧值可能被重新传播。

有记忆变更账本后：

1. Ask 在生成答案前先请求 `MemoryChangeLedgerService`。
2. 系统把同一 subject/property 的变化合成 `ChangeChain`：
   - 当前值是什么。
   - 旧值是什么。
   - 哪些来源让旧值被 supersede。
   - 是否发生过反转或冲突。
   - 当前值的 source-as-of 和 authority role。
3. Ask 答案第一屏显示简短回执：
   - `变更账本：当前采用 DEV Estimate New=0.4；已隔离 2 条旧 estimate 片段；来源截至 2026-06-30；本轮未写入/未确认事实。`
4. 用户点开账本抽屉，看到一条时间线，而不是一堆搜索结果。
5. 如果链路不足，Ask 不把旧值包装成当前事实，而是说 `当前值链不完整，建议只作为待查证线索`。

用户感受：Personal AI 不是只告诉我“现在是 X”，而是告诉我“为什么现在采用 X、为什么不是之前的 Y、这次有没有写入或确认”。

## 真实场景 2：把上下文给外部 AI 前，自动带上变化边界

用户准备把 Jira estimate 场景发给 Codex 或 Claude：

> 帮我检查这批 estimate 规则是否正确，不要回写 Jira，只写 Sheet。

现在的风险：

1. Prompt Context Compiler / Compose Assist 能找到相关记忆，但可能混入旧 estimate 或旧状态。
2. 外部 AI 看不到“这个字段刚刚被替换过”或“旧值已经 superseded”，会把旧值当同等证据。
3. 用户要自己补一句“注意这个值已经变过”，否则第一轮输出就容易跑偏。

有记忆变更账本后：

1. Prompt Context Compiler 在编译 prompt patch 前拿到 `externalSafeChangeSummary`。
2. 写入草稿的是短摘要：
   - `DEV Estimate 口径存在变更链；当前值优先使用 2026-06-30 后的 source-as-of；旧 0.2/0.1 片段只作为历史，不作为当前事实。`
3. 外部摘要隐藏内部链接、受限评论和原始 UI 噪音。
4. 回执显示：`已加入变更边界到草稿，未发送，未修改记忆，未创建 Jira 写回。`

Before：用户每次都要人工解释旧值为什么不能用。
After：Personal AI 把“当前值 + 变化链 + 外发边界”作为上下文的一部分，减少旧事实反复污染。

## 结论

建议设计新能力：**Memory Change Ledger / 记忆变更账本**。

一句话：

> 当 Personal AI 使用一个会变化的事实时，不只返回当前值，还返回它从哪些旧说法演化而来、哪些证据被取代、当前值是否可外发/可写回/可确认。

它不是新 dashboard，也不是让用户审每条变化。P0 应作为 Ask、Memory Lens、Prompt Context Compiler、Evidence Watch 和 Source Memory detail 的嵌入式账本/回执层。只有当系统准备消费一个可能变化的事实时，才显示短回执；展开后才看完整时间线。

## Idea 来源

本次没有使用 Reminder 选题。

- AppleScript 可读本机 Reminders，但没有列出 `Personal AI`。
- EventKit 可读并确认存在 `Personal AI` 列表。
- 当前 `Personal AI` 未完成条目数为 `0`，因此没有可随机选择的新功能 idea，也没有标记 done 或写备注的 Reminder item。

本方案来自：

- 上次 automation-2 已经把方向缩小到 `Change Memory Ledger / 变更记忆账本`，但可见记录显示没有完成 `docs/progressing` plan/demo。
- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 对 `docs/progressing/` 和 `docs/features/index.md` 的去重。
- 对 `10.32.56.212` 上 `esone.qiu` 记忆库的只读采样。
- 当前 AI memory、temporal knowledge graph、context engineering、trace/eval 产品和论文趋势。

## 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`。

HTTP memory-service 入口 `http://10.32.56.212:3210` 本轮 `/health` 和 `/api/v1/stats` 均超时，所以没有假装 API 可读。随后使用 SSH + immutable SQLite URI 只读查询线上 DB，没有写入线上数据。

当前只读聚合：

| 表 / 信号 | 数量 |
|---|---:|
| `messages_raw` | 11192 |
| `chunks` | 10040 |
| `entities` | 14186 |
| `entity_properties` | 1885 |
| `chunk_revisions` | 0 |
| `source_memory_capsules` | 578 |
| `source_memory_takeaways` | 1524 |
| `confirm_requests` | 161 |
| `reflection_threads` | 887 |
| `proposed_actions` | 2638 |
| `memory_outcome_events` | 0 |

关键结构信号：

- `entity_properties` 已经有 `valid_from`、`valid_to`、`tx_start`、`tx_end`、`superseded_by`、`supersede_reason`、`status`、`action_type`，说明底层已经能表达事实演化。
- `entity_properties` 中 `status` 是最高频 property，且有 10 条 `status=superseded` 记录。
- `confirm_requests` 里有 13 条 answered `property_change`，还有大量 `evidence_resolution` 的 pending/expired 请求，说明“事实是否改变”已经真实存在于用户工作流。
- `chunk_revisions` 表存在但当前为 0 行，说明 summary/chunk 级 revision 还没有形成可消费的链路。
- `source_memory_capsules` 当前分布为 `webpage=446`、`jira_comment=127`、`visual_memory=4`、`selection=1`。
- 当前 source-memory 里按 preview 命中 75 条 UI 噪音片段，例如 `Press Enter`、`Collapse comment`、`Add a comment`、`Copy link`，说明不能把原始 capsule 文本直接当变化账本。

真实样本方向：

- `BE.status` 出现连续 supersede 链，旧值包括 `waiting for new design, not ready`、`not ready, waiting for new RCV BE design`，supersede reason 多为用户确认 replacement。
- `MTR-141852: AI Custom VBG` 有 `BE readiness = Not ready, waiting for new RCV BE design` 的 active update。
- 多个 Jira estimate / fixVersion / deadline / repository_url property 近期开启或更新，例如 `MTR-144446`、`MTR-148115`、`Claude Code Migration`、`rc-ai-learning` 等。

这些信号说明：系统不是缺少变化存储字段，而是缺少一层把变化链变成用户能读懂、消费侧能安全使用的 `ChangeChain`。

## 为什么要做

### 1. 解决“旧事实反复污染当前答案”

Personal AI 的记忆量已经足够大，很多事实会随着 Jira、会议、AI 工具、项目状态、日程和用户判断变化。只靠召回相似内容，无法保证回答使用的是当前值。

记忆变更账本让 Ask / Lens / Prompt 在消费事实时知道：

- 这是不是当前值。
- 旧值为什么被替换。
- 变化是否来自用户确认、Jira、source-memory、反思推断或弱证据。
- 这次能不能当事实外发。

### 2. 补上现有时态 schema 到用户体验之间的缺口

`entity_properties` 已经像一个 bi-temporal fact store，但用户看不到变化链。P0 不需要先发明新的大存储，而是复用已有字段生成 `ChangeChain`。

这比再做一个“记忆历史页”更有用：账本要出现在消费现场，例如 Ask 答案上方、Memory Lens 卡片里、Prompt patch 预览里。

### 3. 提升重要记忆提取准确度

用户近期已经明确把优先级拉回“重要记忆提取的准确度”。变更账本聚焦的正是高价值事实的准确消费：

- 项目状态。
- Jira estimate / story point / fixVersion。
- 外部 AI / Codex / Claude / MCP 工具版本和认证方式。
- 用户流程约束，例如只写 Sheet、不写 Jira。
- 会议/项目里反复出现的结论变化。

### 4. 不增加日常 review 队列

P0 不建“变化待审中心”。系统仍然自动整理，只有在要用到变化事实时显示回执。高责任边界仍交给原有 confirm request、Evidence Watch、AuthorityGate 或写回确认流程。

## 行业产品和研究参考

### OpenAI Memory / Dreaming

[OpenAI Dreaming: Better memory for a more helpful ChatGPT](https://openai.com/index/chatgpt-memory-dreaming/) 说明 ChatGPT 正在从显式 saved memory 走向后台持续整理，让跨对话上下文保持 fresh/relevant。另见 [OpenAI Memory FAQ](https://help.openai.com/articles/8590148-memory-faq) 对用户控制、查看、删除 memory 的说明。

启发：长期记忆不应只靠用户手动维护。但 Personal AI 还需要比普通个性化更强的“变化解释”：当系统更新一个事实时，用户要知道旧说法为什么被取代。

### Zep / Graphiti temporal knowledge graph

[Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956) 把 Graphiti 定义为 temporally-aware knowledge graph，可以综合会话和业务数据并保留历史关系。Zep 官方也把 Graphiti 定位为面向 agent memory 的 temporal context graph。

启发：Personal AI 里的 `entity_properties` 已经在走 temporal fact store 方向。变更账本应把这种 temporal chain 暴露到 Ask/Lens/Prompt 的消费边界，而不是只做后端字段。

### A-MEM

[A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) 强调新记忆加入时会动态组织、链接并更新历史记忆表示。

启发：变化不是孤立事件。新证据进入后，系统应该 patch 旧事实、标记 superseded、保留可回放路径，而不是生成另一条平行摘要。

### Anthropic context engineering

[Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 将 context engineering 定义为在推理时策展和维护最合适的信息集合。

启发：如果上下文里混着当前值和旧值，模型容易把它们当并列证据。变更账本提供的是更高质量的上下文：当前值、旧值角色、有效时间和外发边界。

### Microsoft Recall

[Microsoft Recall](https://support.microsoft.com/en-us/windows/ai/ai-features/retrace-your-steps-with-recall) 和 [Recall privacy/security architecture](https://blogs.windows.com/windowsexperience/2024/09/27/update-on-recall-security-and-privacy-architecture/) 强调本地控制、认证、加密、删除和过滤。

启发：时间线式个人记忆必须给用户控制和可解释边界。Personal AI 的变化账本不应只给“发生过什么”，还要说“这条变化是否影响当前答案/外发/写回”。

### OpenAI Agents tracing / evals 与 LangSmith evaluation

[OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/) 记录 agent 运行里的 LLM、tool call、handoff、guardrail 和 custom events；[OpenAI agent evals](https://developers.openai.com/api/docs/guides/agent-evals) 强调用 traces、graders、datasets 和 eval runs 改善 agent 质量。[LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation) 区分上线前 offline evaluation 和上线后 online evaluation。

启发：变更账本要产出可追踪 event 和可固化 eval case。否则用户看到一次正确答案，不代表系统之后不会又把旧值带回来。

## 与已有能力和 progressing 方案的边界

| 已有能力 / 方案 | 已解决什么 | 记忆变更账本新增什么 |
|---|---|---|
| Source Memory Distiller | 单个 source capsule 保存后生成 cue、memo、trigger | Change Ledger 跨 source / entity / confirm request 重建 property 变化链，不替代 capsule 蒸馏 |
| Evidence Watch Contracts | 对未来可能变化的事实建立复核契约和 stop condition | Watch 管“还要不要继续查”；Ledger 管“已经发生/已被采用的变化如何解释和消费” |
| Evidence Cohesion Gate | 消费前判断证据是否属于同一个 problem frame | Cohesion 管“是不是同一问题”；Ledger 管“同一 property 的当前值与旧值如何演化” |
| Memory Change Simulator | 启用新策略前 dry-run 近期 trace | Simulator 可以回放 Ledger 效果；Ledger 是实际消费时的事实变化解释层 |
| Keystone Memory Briefs | 多来源高信号工作记忆简报 | Brief 可引用 Ledger 的 current value / change summary；Ledger 不是跨主题简报 |
| Memory Freshness Radar | source 或事实的新鲜度、过期风险 | Ledger 保留可回放 old/new/supersede 链，不只是标 stale |
| Memory Outcome Loop | 学习 cue/draft/action 是否被采用 | Outcome 可记录 Ledger 展示是否有用；Ledger 不新增 thumbs-down/review UI |
| AuthorityGate / Answer Memory | 控制 prior 和权威 evidence 对答案事实的影响 | Ledger 给 AuthorityGate 提供变化链和旧值角色；AuthorityGate 决定是否可更新答案 |
| Prompt Context Compiler | 发送前补齐 prompt 槽位 | Compiler 消费 Ledger 的 external-safe change summary，避免旧事实进入 prompt |

## 产品定义

### MemoryChangeEvent

`MemoryChangeEvent` 是一个可追踪的事实变化事件。它可以来自现有 `entity_properties`、confirm request、source-memory distillation、Jira comment、reflection result 或后续人工确认。

```ts
type MemoryChangeEvent = {
  id: string;
  userId: string;
  subject: {
    entityId?: string;
    label: string;
    type: 'project' | 'jira_issue' | 'topic' | 'person' | 'tool' | 'document' | 'unknown';
  };
  propertyKey: string;
  oldValue?: string;
  newValue: string;
  valueRole: 'current' | 'superseded' | 'candidate' | 'retracted' | 'conflict';
  authorityRole: 'user_confirmed' | 'jira' | 'source_memory' | 'direct_message' | 'reflection' | 'inferred';
  sourceRefs: MemoryChangeSourceRef[];
  validFrom?: number;
  validTo?: number;
  txStart: number;
  txEnd?: number;
  confidence: number;
  supersedes?: string[];
  supersededBy?: string;
  reason: string;
  risk: {
    reversal: boolean;
    conflict: boolean;
    weakSource: boolean;
    uiNoiseFiltered: boolean;
  };
};
```

### ChangeChain

`ChangeChain` 是消费侧真正使用的对象。

```ts
type ChangeChain = {
  chainId: string;
  subjectKey: string;
  propertyKey: string;
  current?: MemoryChangeEvent;
  previous: MemoryChangeEvent[];
  candidates: MemoryChangeEvent[];
  conflicts: MemoryChangeEvent[];
  sourceAsOf: number;
  completeness: 'complete' | 'partial' | 'weak' | 'blocked';
  consumerReceipt: {
    label: string;
    detail: string;
    currentValue?: string;
    oldValueCount: number;
    conflictCount: number;
    sourceAsOf: number;
    writesMemory: false;
    confirmsFact: false;
    sendsExternal: false;
  };
  externalSafeSummary: string;
};
```

### P0 原则

P0 先做“读得准、解释得清”，不急着覆盖所有变化来源：

- 从 `entity_properties` 重建 active / superseded chain。
- 从 `confirm_requests(category='property_change')` 补充用户确认节点。
- 从 source-memory 只读取已经 distill 或高置信的字段，不直接信任带 UI 噪音的 raw preview。
- `chunk_revisions` 当前为空，P0 只预留接口，不把它当已有事实来源。
- 没有足够链路时返回 `partial/weak`，不生成强当前值。

## UX 设计

### 入口 1：Ask 答案前的变化回执

Ask 回答正文前显示一行：

```text
变更账本：当前采用 BE.status = not ready；已隔离 7 条旧状态；来源截至 2026-05-28；本轮未写入/未确认。
```

点击 `查看变化链` 打开抽屉：

- 当前值。
- 旧值时间线。
- 哪些证据 superseded。
- 哪些来源被过滤为 UI 噪音。
- 可复制的外部安全摘要。

### 入口 2：Memory Lens / Jira 页面卡片

用户打开 Jira issue，Memory Lens 展示：

```text
变更账本 · DEV Estimate
当前值优先使用最近一次 source-as-of；旧值只作为历史。
```

默认只显示 chip，不抢占页面。展开后才显示链路。

### 入口 3：Prompt Context Compiler / Compose Assist

当用户准备把上下文给外部 AI：

- Compiler 只拿 `externalSafeSummary`。
- 内部 source links、restricted comments、UI 噪音不会进入外部 prompt。
- 草稿旁显示：`已加入变化边界到草稿，未发送，未写入。`

### 入口 4：Source Memory detail

如果某个 Jira comment capsule 被蒸馏出可能的 old/new 变化：

- 详情页显示 `可形成变更事件候选`。
- P0 不要求用户审核；只显示 status。
- 只有用户明确点击 `作为事实更新复核`，才进入已有 confirm/AuthorityGate 流程。

## 信息架构

第一屏必须明确四件事：

1. 当前采用的值。
2. 旧值是否被隔离、被取代或仍有冲突。
3. 来源截至时间和权威角色。
4. 本轮是否写入、确认、发送、同步。

不要让用户从 timeline 里自己推断“当前值到底是什么”。

## 技术方案草案

### 新服务

```ts
class MemoryChangeLedgerService {
  getChain(input: {
    userId: string;
    subjectKey?: string;
    entityId?: string;
    propertyKey: string;
    scene?: 'ask' | 'memory_lens' | 'prompt_compiler' | 'source_detail' | 'evidence_watch';
    includeExternalSummary?: boolean;
  }): Promise<ChangeChain>;

  extractCandidatesFromSourceMemory(input: {
    capsuleId: string;
    mode: 'dry_run' | 'commit_candidate';
  }): Promise<MemoryChangeEvent[]>;
}
```

### 数据来源

| 来源 | P0 用法 | 边界 |
|---|---|---|
| `entity_properties` | 主链路，读取 active/superseded/retracted/update/confirm | 只读，不自动修改 |
| `confirm_requests` | 补 property_change 的用户确认节点 | pending 不能当已确认 |
| `source_memory_capsules` | 只作为来源引用和候选上下文 | raw preview 可能有 UI 噪音，不能直接作为变化事实 |
| `source_memory_takeaways` | 读取 ready/partial takeaways 里可结构化的事实 | 没 sourceRef 的 slot 不能进 current |
| `chunk_revisions` | P0 预留，当前为空 | 不能把空表当能力已存在 |
| `memory_outcome_events` | 未来用于学习 Ledger 是否被采用 | 当前为空，P0 不依赖 |

### 当前值选择规则

1. 优先 `entity_properties.status='active' AND tx_end IS NULL`。
2. 同一 subject/property 多个 active 候选时按 authority、source freshness、confidence、explicit user confirmation 排序。
3. 如果存在 close conflict，返回 `completeness='partial'`，Ask 只能输出“候选当前值”，不能输出强事实。
4. `superseded` 节点全部进入 previous，不参与 current。
5. pending confirm request 只能增加 `needsConfirmation`，不能提升为 current。
6. UI 噪音命中的 source-memory 只能作为 filtered source，不进 event value。

### 消费侧返回

Ask / Lens / Prompt Compiler 不应该拿原始 `entity_properties` 自己拼文案，而是使用统一 receipt：

```json
{
  "label": "变更账本",
  "detail": "当前采用 BE.status = not ready；已隔离 7 条旧状态；来源截至 2026-05-28。",
  "currentValue": "not ready",
  "oldValueCount": 7,
  "conflictCount": 0,
  "writesMemory": false,
  "confirmsFact": false,
  "sendsExternal": false
}
```

## 实现阶段

### Phase 0：计划确认与样例集

- 确认是否采用 `Memory Change Ledger / 记忆变更账本` 命名。
- 从 `10.32.56.212` 抽取 5-10 个真实 subject/property 样例并脱敏。
- 梳理现有 `entity_properties` 写入路径，确认哪些 action_type / status 语义稳定。

### Phase 1：P0 只读 ChangeChain

- 新增 `MemoryChangeLedgerService`。
- 为 `entity_properties` chain 写 repository helper。
- 为 `confirm_requests(property_change)` 写确认节点 adapter。
- 输出 `ChangeChain` 和 `consumerReceipt`。
- 不改写原始事实，不创建新 confirm request。

### Phase 2：Ask / Memory Lens 嵌入

- Ask：当问题命中会变化 property 时，答案前显示变化回执。
- Memory Lens：Jira / project / source detail 卡片显示 ledger chip。
- Search Result：如果用户打开 entity/property，可查看变化链。

### Phase 3：Prompt Context Compiler 外发摘要

- Compiler 请求 `externalSafeSummary`。
- 草稿只插入当前值、旧值角色和 source-as-of，不插入内部 raw source。
- 显示未发送/未写入回执。

### Phase 4：Source Memory 变更候选抽取

- 从 Jira comment / webpage capsule 里识别 structured old/new 候选。
- 明确过滤 `Press Enter`、`Collapse comment`、`Copy link` 等 UI 噪音。
- 候选先进入 `candidate`，不自动改 active property。

### Phase 5：Outcome 与 dry-run 联动

- Outcome Loop 记录用户是否打开/复制/忽略/标记不准 Ledger。
- Memory Change Simulator 可回放 Ledger 上线后会在哪些 Ask/Lens/Prompt 出现。

## Evals 设计要求

如果后续决定实现，必须在 `evals/` 创建 suite 并跑出 report。原因：该能力价值依赖当前值重建、旧值隔离、来源权威、外发摘要和 UI 边界，不是普通单元测试足够覆盖。

建议 suite：

- `evals/cases/memory-change-ledger/cases.jsonl`
- `evals/workflows/memory-change-ledger/experience.md`
- `evals/registry.yaml` 注册，建议 weekly 或 pre-merge。

必测场景：

1. `be_status_supersede_chain`
   - 输入：真实 `BE.status` 多节点 supersede 链。
   - 期望：只输出 active current，旧值进入 previous，receipt 显示 oldValueCount。

2. `jira_estimate_reversal`
   - 输入：Jira estimate 出现反转或多个 old/new 候选。
   - 期望：不能把两个方向都当当前值；必须标 conflict 或 partial。

3. `pending_confirm_not_current`
   - 输入：pending property_change confirm request。
   - 期望：只能显示待确认，不能升级为 current。

4. `ui_noise_no_change_event`
   - 输入：包含 `Collapse comment`、`Press Enter` 的 source-memory preview。
   - 期望：不生成 MemoryChangeEvent，receipt 标 `uiNoiseFiltered`。

5. `external_summary_redaction`
   - 输入：含内部 URL / restricted comment / raw UI 噪音的链路。
   - 期望：externalSafeSummary 保留变化边界，隐藏内部原文。

6. `ask_answer_uses_ledger`
   - 输入：Ask 问当前值。
   - 期望：答案引用 ledger current，不引用 superseded old value，并显示不写入/不确认回执。

通过标准：

- 当前值选择错误率为 0。
- pending confirm 误当 confirmed 的数量为 0。
- UI 噪音生成变更事件数量为 0。
- 外发摘要不包含 restricted raw source 或噪音文本。
- Reader Contract report 第一屏能清楚显示“证明了什么/没证明什么”。
- 若真实样例不足，可补 synthetic case，但 report 必须标注真实/合成来源。

实现时建议运行：

```bash
npm run eval:validate
npm run eval:run -- --suite memory-change-ledger --no-repair
```

如果改动触碰 recall/write path，还要按 `AGENT.md` 跑：

```bash
npm run eval:memory-abilities
```

## 文档维护要求

如果后续决定实现，完成功能代码后必须把关键点维护进正式 feature docs：

- `docs/features/memory_system.md`：补 Change Ledger 在 Memory Service 中的位置、数据来源、current value 选择规则。
- `docs/features/ask.md`：补 Ask 如何展示变化回执、何时降级为 partial/weak。
- `docs/features/memory_lens.md`：补 Ledger chip 和展开抽屉的用户边界。
- `docs/features/compose_assist.md`：如果 Prompt Context Compiler 消费 Ledger，补 external-safe change summary。
- `docs/features/memory_capture.md`：如果 Source Memory 开始抽取变化候选，补 UI 噪音过滤和 candidate 边界。
- `docs/features/evidence_watch_contracts.md`：补 Watch 如何引用 Ledger 的 current/previous，而不是重复查同一旧值。
- `docs/features/index.md`：新增“记忆变更账本”小功能点。
- 如果 desktop Quick Ask/desktop app 是主入口，也应在 `desktop-app/docs/features/` 下的对应文档补充本地 UI 行为；没有合适文档时再考虑新建。

当该能力实现并迁入 `docs/features/` 后，应删除或归档本 `docs/progressing/memory-change-ledger-plan.md` 和 demo，避免长期双源。

## Demo

本次 demo 是集成式页面，不是独立后台。它模拟 Ask / Jira / Prompt Context Compiler 现场展示变更账本：

- 文件：[`memory-change-ledger-demo.html`](./memory-change-ledger-demo.html)
- 语言：中文为主，保留 Jira / AI tool 的原始英文术语。
- 交互：可切换 `Jira Estimate`、`BE readiness`、`外部 AI prompt` 三个场景；可切换当前值、变化链、证据、外发摘要。
- 边界：demo 数据为本地示例，不读写 memory service，不创建确认请求，不发送消息。

## 推荐决策

建议进入实现评审，但优先级应放在“提高重要记忆消费准确度”这条线上，而不是做成新页面。

推荐 P0：

1. `entity_properties` -> `ChangeChain` 只读服务。
2. Ask 和 Memory Lens 的短回执。
3. Prompt Context Compiler 的 external-safe change summary。
4. `memory-change-ledger` eval suite。

这能让 Personal AI 从“我找到了相关记忆”进化到“我知道当前事实为什么是这样，并且不会把旧事实当当前事实传给你或外部 AI”。
