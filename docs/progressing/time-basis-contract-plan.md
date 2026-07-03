# 新能力：Time Basis Contract / 时间口径合约

> 生成时间：2026-07-03 CST  
> Codex 会话标题：新能力：时间口径合约  
> 状态：待决策，仅规划与 demo，不做运行时代码实现  
> Demo：[`time-basis-contract-demo.html`](./time-basis-contract-demo.html)

## 真实场景 1：跑 Nova RMI skill 时，先锁住模拟日期

用户在 Codex / ChatGPT / Personal AI Quick Ask 里写：

> 你帮我跑一遍 nova-capdev-rmi-sync，但是不要用当前日期，模拟 7/1，用 2026-Q3 来跑一遍。

现在的坏体验：

1. AI 或 skill 很容易默认使用“今天”，尤其当当前系统日期和用户要求的模拟日期不同。
2. 相关 JQL 里还会出现 `Target Delivery Quarter in (2026-Q3)`、`status not in (Cancelled, Closed)`、`Committed in (...)` 等业务口径。
3. 如果执行链只把这些看成普通 prompt 文本，后续脚本、Jira 查询、Sheet 写回和结果说明可能各用各的时间基准。
4. 用户只能在 prompt 里反复强调“不要用当前日期”，但无法确认系统实际锁定了什么。

有时间口径合约后：

1. Personal AI 在发送/运行前识别出 `simulationDate=2026-07-01`、`targetQuarter=2026-Q3`、`timezone=Asia/Shanghai`、`forbidCurrentDate=true`。
2. 输入框旁显示一个低打扰 chip：`时间口径已锁定：按 2026-07-01 模拟，不使用当前日期`。
3. 展开后看到：
   - 这个合约会传给 Ask / Prompt Context Compiler / skill runner / Action Queue。
   - 本轮是 dry-run、只读查询还是允许写回。
   - 哪些相对时间词会被改写，例如 `今天`、`本季度`、`next release`。
4. 用户点 `写入草稿边界` 后，prompt 中自动加入一段短合约：
   - `Time basis: simulate as 2026-07-01 in Asia/Shanghai; target quarter = 2026-Q3; do not use current date; output JQL and dry-run result before any writeback.`
5. 如果系统准备执行外部动作，Action Queue 也会显示同一份合约，避免审批页和 prompt 页口径漂移。

用户感受：Personal AI 不只是“记得我说过 Q3”，而是能在真正执行前把时间前提变成可检查、可传递、可恢复的合约。

## 真实场景 2：问“现在/当时/季度”时，答案不会偷偷混用时间

用户在 Quick Ask 里问：

> 这些 INIT 现在是不是都还在 2026-Q3？如果我是按 7/1 做报表，应该查哪些 theme？

现在的坏体验：

1. `现在`、`按 7/1`、`2026-Q3` 同时出现，Personal AI 可能把当前数据库、历史 source-memory 和用户的模拟日期混在一起。
2. Change Ledger 能解释某个事实如何变更，Freshness Radar 能提醒来源是否过期，但它们不一定告诉执行链“这轮到底按哪个时间回答”。
3. 外部 AI 收到上下文后也可能继续使用它自己的当前日期。

有时间口径合约后：

1. Ask 先生成 `TimeBasisFrame`，把问题拆成两层：
   - `answerAsOf=current`：回答“现在是不是还在 2026-Q3”。
   - `simulationAsOf=2026-07-01`：回答“如果按 7/1 做报表”。
2. 结果首屏先显示：
   - `本轮含双时间口径：当前状态 + 2026-07-01 模拟报表。两者分开引用证据。`
3. 答案正文按小节分开，不把当前 Jira/source-memory 结果直接覆盖到 7/1 模拟。
4. 如果证据不够回放 7/1 状态，系统直接说明 `缺少 7/1 当时快照，只能按当前可读数据模拟，不作为历史事实证明`。

Before：用户要人工怀疑“AI 是按现在查的，还是按我说的 7/1 查的”。  
After：每个答案、prompt patch、skill action 都带同一份时间合约，口径错了能一眼看出来。

## 结论

建议设计新能力：**Time Basis Contract / 时间口径合约**。

一句话：

> 当 Personal AI 要回答、编译 prompt、运行 skill 或创建外部 action 时，先把“用哪个时间”变成结构化合约：当前、历史 as-of、模拟日期、季度/冲刺窗口、时区、来源快照、写回边界都必须可见且可传递。

它不是新的 dashboard，也不是普通日期格式化。P0 应作为 Ask、Prompt Context Compiler、Skill Foundry / skill runner、Action Queue、Today Pilot / Meeting Prep 的嵌入式前置合约层。用户日常只看到一个短 chip 和必要时的展开说明，不新增 review 队列。

## Idea 来源

本次没有使用 Reminder 选题。

- AppleScript 可读本机 Reminders，但未列出 `Personal AI`。
- Swift/EventKit 可读并确认存在 `Personal AI` 列表，未完成条目数为 `0`。
- 因此没有可随机选择的新功能 idea，也没有标记 done 或写备注的 Reminder item。

本方案来自：

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 对 `docs/progressing/`、`docs/features/index.md`、automation memory 和近邻计划的去重。
- 对 `10.32.56.212` 上 `esone.qiu` 记忆库的只读 SSH/SQLite 采样；HTTP memory-service 本轮超时，没有假装 API 可读。
- 当前 AI agent、scheduled task、context engineering、temporal RAG 和 temporal reasoning 研究趋势。

## 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`。HTTP `/health`、`/api/v1/stats`、reflection/actions API 均超时，因此改用 SSH + immutable SQLite URI 只读查询线上 DB，没有写入线上数据。

当前只读聚合：

| 表 / 信号 | 数量 |
|---|---:|
| `messages_raw` | 11192 |
| `chunks` | 10040 |
| `entities` | 14186 |
| `relationships` | 54683 |
| `entity_properties` | 1885 |
| `source_memory_capsules` | 578 |
| `source_memory_takeaways` | 1524 |
| `confirm_requests` | 161 |
| `reflection_threads` | 887 |
| `proposed_actions` | 2638 |
| `memory_outcome_events` | 0 |
| `anticipation_briefs` | 0 |

时间相关强信号：

| 查询方向 | 命中数量 |
|---|---:|
| 包含 `日期` / `当前日期` / `模拟` / `季度` / `Q3` / `2026-Q3` / `7/1` / `today` / `current date` / `Target Delivery Quarter` 的消息 | 507 |
| 包含 `estimate` / `release` / `版本` / `sprint` / `fixVersion` 的消息 | 877 |

代表性样本方向：

- 用户明确要求 `nova-capdev-rmi-sync` 不要用当前日期，要模拟 `7/1`，并按 `2026-Q3` 运行。
- 用户让系统根据当前日期识别 `Target Delivery Quarter`，但又会在后续请求里要求改成指定季度。
- 多条 Jira/source-memory 里出现 `Target Delivery Quarter Original/New`、`QStartDate/QEndDate`、Sprint Planning、release/fixVersion、estimate 变化。
- `proposed_actions` 里还有 113 个 queued action、178 个 failed `delegate_openclaw`，说明外部 action 执行链已经存在，时间前提一旦错，会放大到队列和审批页。

这些信号说明：Personal AI 不只是需要知道事实是否新鲜，还需要在每次使用事实、跑 skill、生成 prompt 前，把当前/历史/模拟/季度窗口区别清楚。

## 为什么要做

### 1. 解决 AI/skill 的隐式 today 漂移

很多真实任务依赖“今天”“当前季度”“下个 release”“按某天模拟”。LLM 和自动化脚本如果没有结构化时间合约，往往会偷偷用运行当天，或把当前事实和历史场景混用。

时间口径合约把隐式 today 变成显式输入：

- `asOf`：按哪个时间回答事实。
- `simulationAsOf`：按哪个历史/未来日期模拟。
- `businessWindow`：季度、sprint、release、工作周。
- `timezone`：默认 `Asia/Shanghai`，但每个合约可覆盖。
- `relativeTerms`：把 `今天`、`本季度`、`next sprint` 改写成绝对窗口。
- `writeBoundary`：只读、dry-run、允许写 Sheet、禁止写 Jira 等。

### 2. 补齐已有时态能力到执行现场的缺口

项目里已经有很多时态相关能力：

- Freshness Radar 处理来源是否过期。
- Change Ledger 处理同一事实的变化链。
- Evidence Watch 处理事实未来是否需要继续查。
- Operation Flight Recorder 记录操作 episode。
- Prompt Context Compiler 补齐 prompt 缺失槽位。

但这些能力都没有把“本轮执行到底按哪个时间”作为一个可传递的一等对象。Time Basis Contract 是执行前的合约层，给它们统一入口。

### 3. 降低高责任外部动作的误执行风险

Jira/Sheet/Google Doc/Glip/OpenClaw 这类外部 action，时间错了通常不是小错误：

- 查错季度会漏掉 INIT。
- 用当前日期跑历史模拟会错误回填 Sheet。
- 当前 release 不存在时，脚本可能错误创建或跳过。
- 审批页如果不显示时间口径，用户无法判断这次 action 是否应该批准。

P0 不自动执行任何更高风险动作，只在执行前让合约可见，并把合约写入 action params / approval receipt。

### 4. 提升外部 AI handoff 的可靠性

用户经常把上下文交给 Codex、ChatGPT、Claude、豆包、Cursor、Milo skill。外部 AI 自己不知道 Personal AI 当前是按“现在”还是“7/1 模拟”组织上下文。

时间口径合约可以被 Prompt Context Compiler / AI Context Passport 作为固定 header：

```text
Time basis:
- Simulate as 2026-07-01, timezone Asia/Shanghai.
- Target quarter: 2026-Q3.
- Do not use current date except when explicitly comparing current state.
- Dry-run first; do not write Jira.
```

这比在 prompt 里散落一句“不要用当前日期”可靠得多。

## 行业产品和研究参考

### ChatGPT Scheduled Tasks / Pulse

[OpenAI ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt) 把提醒、递归任务、每日简报和监控变成 ChatGPT 的 proactive 工作；[ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) 在 2026-06-17 说明 Scheduled Tasks 有独立页面、可查看下次运行、暂停/恢复/编辑/删除；[ChatGPT Pulse Help](https://help.openai.com/en/articles/12293630-chatgpt-pulse) 也建议用 scheduled tasks 承接 daily briefing。

启发：AI 正在从单次对话进入定时/监控/自动运行。越是自动运行，越需要“运行时间”和“业务时间”分开。Personal AI 的时间口径合约应告诉用户：这次任务是在什么时候运行、按哪个业务日期推理、何时过期。

### Gemini Scheduled Actions

[Gemini Scheduled Actions](https://blog.google/products-and-platforms/products/gemini/scheduled-actions-gemini-app/) 和 [Google Help](https://support.google.com/gemini/answer/16316416) 都强调用户可以在设置里创建、编辑、管理定时动作。

启发：产品开始把 AI actions 做成可管理对象，但 schedule 只是“什么时候运行”。Personal AI 还需要补充“按哪个业务时间解释记忆和来源”。

### Atlassian JQL date functions

[Atlassian JQL functions](https://support.atlassian.com/jira-software-cloud/docs/jql-functions/) 和 [JQL fields](https://support.atlassian.com/jira-software-cloud/docs/jql-fields/) 说明 date fields 支持绝对日期和相对日期语法。Atlassian 还记录过 `worklogDate` 这类日期函数可能因为时区/日期边界造成用户看到一日偏差的情况。

启发：Jira 这样的工作系统本来就把日期当成一等查询条件。Personal AI 在生成 JQL 或运行 Jira skill 时，不能把时间词留在自然语言里，必须显式转换和展示。

### Anthropic Context Engineering

[Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调上下文要被策展、裁剪和维护，避免工具/上下文集合过大导致 agent 决策点模糊。

启发：时间口径是 context engineering 的最小必要上下文之一。没有它，模型会在当前事实、历史事实、模拟要求和外部工具时间之间自行猜测。

### OpenAI Agents guardrails / tracing

[OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents)、[Guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) 和 [Agents SDK tracing](https://github.com/openai/openai-agents-python/blob/main/docs/tracing.md) 都把工具执行、审批、guardrail 和 trace 建成可观察的运行对象。

启发：时间口径应作为 tool-call guardrail 和 trace metadata，出现在执行前、审批中、执行后 report，而不是只存在用户 prompt 原文里。

### Temporal RAG / Temporal reasoning 研究

- [HoH: A Dynamic Benchmark for Evaluating the Impact of Outdated Information on Retrieval-Augmented Generation](https://aclanthology.org/2025.acl-long.301/) 指出 RAG 在处理过时信息时，retrieval 和 generation 都会退化。
- [Reading Between the Timelines: RAG for Answering Diachronic Questions](https://arxiv.org/html/2507.22917v1) 聚焦 diachronic questions，说明同一实体在不同时间点有不同答案。
- [TimE: A Multi-level Benchmark for Temporal Reasoning of LLMs](https://arxiv.org/html/2505.12891v1) 强调 LLM 要处理历史数据和实时进展，需要有效 temporal reasoning。
- [ChronoQA](https://arxiv.org/html/2508.12282v1) 是中文时序问答 RAG benchmark，覆盖显式和隐式时间表达。
- [Test of Time](https://openreview.net/forum?id=44CoQe6VCq) 评估 LLM 的时间推理能力，说明时间点和持续时间计算仍是独立难点。

启发：长期个人记忆天然是 temporal RAG。Personal AI 不应只优化“找得到哪条记忆”，还要明确“这条记忆是在什么时间口径下被使用”。

## 与现有能力和 progressing 方案的边界

| 已有能力 / 方案 | 已解决什么 | 时间口径合约新增什么 |
|---|---|---|
| Memory Freshness Radar | 来源/事实是否过期、是否需要 patch | 不判断来源是否更新，而是锁定本轮回答/执行使用哪个时间口径 |
| Memory Change Ledger | 当前值、旧值、supersede 链 | Ledger 解释事实如何变；Time Basis 决定这轮要问当前、历史还是模拟 |
| Evidence Watch Contracts | 未来是否继续查证事实变化 | Watch 是后台契约；Time Basis 是每次消费/执行前的输入合约 |
| Memory Change Simulator | 新策略上线前 dry-run 历史轨迹 | Simulator 预演能力影响；Time Basis 约束单次问答/skill/action 的业务时间 |
| Operation Memory Flight Recorder | 记录用户如何完成一件跨工具操作 | Recorder 保存 episode；Time Basis 是 episode/skill 重跑时必须带上的时间参数 |
| Prompt Context Compiler | 补齐 prompt 缺失槽位 | Compiler 可消费 TimeBasisFrame，但 Time Basis 是独立 typed contract，不只是 prompt 文案 |
| AI Context Passport | 跨 AI handoff context package | Passport 可把合约写进 header；Time Basis 不负责整包上下文 |
| Skill Experience Quality Gate | skill 成功/失败健康度、降级退役 | Time Basis 防止 skill 因时间前提错误失败，不评价 skill 生命周期 |
| Memory Lifecycle Gardener | archive/historical evidence 分层 | Lifecycle 控制记忆可用性；Time Basis 控制本轮 query 是否允许 historical/as-of evidence |
| Today Pilot / Meeting Prep | 今日任务和会前准备 | Time Basis 可给会议/任务生成 as-of/date-window chip，不替代排序 |

## 产品定义

### TimeBasisFrame

`TimeBasisFrame` 是一次问答、prompt 编译、skill 运行或 action 创建前的结构化时间合约。

```ts
type TimeBasisMode =
  | 'current'
  | 'as_of'
  | 'simulation'
  | 'business_window'
  | 'compare_current_to_as_of'
  | 'unknown';

interface TimeBasisFrame {
  id: string;
  mode: TimeBasisMode;
  timezone: string;
  userLocale?: string;
  currentNow: string; // generated at runtime, for audit only
  asOf?: string; // ISO date/time for historical/current fact answer
  simulationAsOf?: string; // ISO date/time for simulated run
  businessWindow?: {
    kind: 'quarter' | 'sprint' | 'release' | 'week' | 'custom';
    label: string; // 2026-Q3, Nova26 sprint, release version
    start?: string;
    end?: string;
    source?: 'user_explicit' | 'calendar' | 'jira' | 'memory' | 'derived';
  };
  relativeTermResolutions: Array<{
    raw: string;
    resolved: string;
    basis: 'currentNow' | 'asOf' | 'simulationAsOf' | 'businessWindow';
    confidence: number;
  }>;
  writeBoundary: {
    mode: 'read_only' | 'dry_run' | 'draft_only' | 'sheet_only' | 'external_write_requires_approval';
    forbiddenTargets?: string[];
    approvalRequired?: boolean;
  };
  evidencePolicy: {
    allowHistoricalEvidence: boolean;
    requireSourceAsOf: boolean;
    staleEvidenceBehavior: 'label_as_historical' | 'downrank' | 'block' | 'ask_clarification';
  };
  confidence: number;
  blockers?: Array<{
    code: 'missing_date' | 'conflicting_dates' | 'ambiguous_quarter' | 'missing_timezone' | 'insufficient_snapshot';
    message: string;
  }>;
}
```

### TimeBasisReceipt

UI 不直接展示完整 JSON，而是展示短 receipt：

```ts
interface TimeBasisReceipt {
  tone: 'locked' | 'needs_clarification' | 'warning' | 'blocked' | 'silent';
  headline: string;
  detail: string;
  chips: string[];
  safePromptHeader?: string;
  recoveryActions: Array<'edit_time' | 'use_current' | 'split_current_and_as_of' | 'dry_run_only' | 'open_sources'>;
}
```

## UX 设计

### 入口 1：AI / Codex / ChatGPT 输入框旁的时间 chip

当用户在外部 AI 或 Quick Ask 输入框里写出明显时间词：

- `模拟 7/1`
- `不要用当前日期`
- `2026-Q3`
- `本季度`
- `上次 sprint`
- `现在还是否`
- `按当时的状态`

Personal AI 显示 chip：

```text
时间口径已锁定：按 2026-07-01 模拟 · 2026-Q3 · 不用当前日期
```

点开后展示三栏：

1. **合约**：as-of / simulation / business window。
2. **将如何改写**：相对时间词解析成绝对日期/JQL/window。
3. **边界**：未发送、未执行、dry-run、禁止写 Jira、需要审批。

### 入口 2：Ask 答案首屏回执

Ask 如果识别到时间口径，答案顶部显示：

```text
时间口径：当前状态 + 2026-07-01 模拟分开回答；历史证据必须标 source-as-of；本轮未写入或确认事实。
```

如果缺口明显：

```text
时间口径不完整：你问“当时”，但没有给日期，也没有足够来源快照。本轮只按当前可读记忆回答，不能证明历史状态。
```

### 入口 3：Action Queue 审批前合约

任何外部 action 尤其是 Jira/Sheet/OpenClaw，审批卡第一屏显示：

- 运行时间：任务实际何时创建/运行。
- 业务时间：按哪个日期/季度/sprint 推理。
- 写回边界：dry-run / sheet only / requires approval。
- 恢复路径：时间不对时可 `改时间口径后重新生成 action`，不是直接批准。

### 入口 4：Skill Foundry / local skill runner 参数锁

skill 定义里可以声明：

```yaml
requires_time_basis:
  - target_quarter
  - as_of_date
  - timezone
default_write_boundary: dry_run
relative_date_policy: forbid_current_when_simulation_present
```

运行前 Personal AI 自动生成参数面板。用户不必每次把“不要用当前日期”写进 prompt，也能确认当前 skill 不会偷偷读取今天。

## 隐私、权威、恢复与写回边界

### 来源边界

- 合约可以引用来源，例如日历、Jira query、用户 prompt、source-memory，但不会把原始私人消息默认外发。
- 给外部 AI 的 header 只包含必要时间参数和业务窗口，不包含内部 source URL 或受限评论，除非用户打开 full context package。

### 新鲜度边界

- Time Basis 不负责判断 source 是否最新；如果证据 stale，交给 Freshness Radar / Change Ledger 标注。
- 但 Time Basis 必须要求消费端说明：这是 `current`、`as_of` 还是 `simulation`，不能裸用旧证据回答当前问题。

### 权威边界

- 用户显式写出的日期优先级最高。
- Jira/Calendar/Sheet 推导出的日期只能作为 derived，低于用户显式输入。
- 如果用户输入和来源推导冲突，例如 `模拟 7/1` 但 JQL 写 `2026-Q2`，系统进入 `needs_clarification`，不能静默选一个。

### 写回边界

- 默认 P0 是 `dry_run` 或 `draft_only`。
- 任何 Jira/Sheet/Glip 外部写入仍走原有审批或 action gate。
- 时间口径合约本身不授权执行，只是执行前提。

### 恢复边界

- 如果用户发现口径错了，恢复动作是 `改合约 -> 重新生成答案/prompt/action`。
- 不修改已经发出的外部消息，不回滚已执行动作；已执行动作的纠偏走对应功能的恢复路径。

## 实现方案

### 1. TimeBasisExtractor

位置建议：

```text
memory-service/src/core/TimeBasisExtractor.ts
```

输入：

- Ask query。
- ContextRecall / Compose Assist scene。
- Prompt Context Compiler draft。
- Skill run request。
- Proposed action params。

输出 `TimeBasisFrame` + `TimeBasisReceipt`。

P0 先做确定性 + 小 LLM schema 双层：

1. Deterministic parser：
   - ISO dates、`7/1`、`2026-Q3`、`QStartDate/QEndDate`、Sprint/Release label。
   - `不要用当前日期`、`按当时`、`模拟`、`现在`、`current` 等显式模式词。
2. Schema LLM fallback：
   - 仅在确定性 parser 无法区分 current/as-of/simulation 时调用。
   - 输出严格 JSON schema，不生成答案。

### 2. TimeBasisResolver

职责：

- 解析 business window：
  - quarter -> start/end。
  - sprint -> 从 Jira/Calendar/Memory source 查窗口。
  - release -> 从 project/release memory 查窗口。
- 处理 timezone。
- 检查冲突。
- 将相对词映射成 `relativeTermResolutions`。

### 3. TimeBasisGuard

职责：

- 在 Ask / Prompt / Action 前执行。
- 如果 `blockers` 存在且 action 有外部写风险，必须阻断或要求澄清。
- 如果只是 read-only Ask，可以继续但必须显示 warning。

### 4. 消费端集成

| 消费端 | P0 行为 |
|---|---|
| `/api/v1/ask` | request 进入前提取 TimeBasisFrame；answer prompt 分离 current/as-of/simulation evidence |
| `/context-recall` / Memory Lens | 对输入框/网页 scene 生成 chip；不直接展示完整合约 |
| Prompt Context Compiler / Compose Assist | 把 `safePromptHeader` 插入 prompt patch；不发送 |
| Action Queue / proposed_actions | action params 写入 `time_basis_json`；审批卡展示 |
| Skill Foundry / skill runner | skill manifest 可声明 required time fields；缺失则 preflight blocked |
| Today Pilot / Meeting Prep | 会前/今日任务卡可带 `time basis` chip，尤其是报表、sprint、release |

### 5. 数据模型

P0 可以先不建重表，只在 trace/action/outcome 里附带 JSON；如果要长期审计，再加：

```sql
CREATE TABLE time_basis_frames (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL,
  scene_key TEXT,
  mode TEXT NOT NULL,
  timezone TEXT NOT NULL,
  as_of TEXT,
  simulation_as_of TEXT,
  business_window_json TEXT,
  relative_terms_json TEXT,
  write_boundary_json TEXT,
  evidence_policy_json TEXT,
  confidence REAL NOT NULL,
  blockers_json TEXT,
  source_refs_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE time_basis_events (
  id TEXT PRIMARY KEY,
  frame_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail_json TEXT,
  created_at INTEGER NOT NULL
);
```

`proposed_actions` 建议增加或复用 metadata：

```ts
params.timeBasisFrameId
params.timeBasis
audit.timeBasisReceipt
```

## MVP 范围

### P0 做

- 识别用户显式日期、模拟日期、季度、当前/历史/模拟模式。
- 为 Ask、Prompt Context Compiler、Action Queue、skill runner 生成同一份 `TimeBasisFrame`。
- UI 展示时间 chip、展开抽屉和 action 审批回执。
- 给外部 AI prompt patch 生成 `Time basis` header。
- 对外部写风险 action 做 preflight guard：时间冲突时阻断。
- 创建 eval suite 并使用真实 `esone.qiu` 时间口径场景。

### P0 不做

- 不自动写 Jira/Sheet。
- 不做大型历史快照回放。
- 不替代 Freshness Radar / Change Ledger。
- 不为所有自然语言日期做完美解析；低置信就澄清或降级。
- 不创建独立 dashboard。

### P1

- 支持 sprint/release 从 Jira/Calendar/Project Dashboard 补 window。
- 支持双口径答案：current vs as-of/simulation 同屏对比。
- 支持 skill manifest 的 `requires_time_basis`。
- 支持 action 执行后 report 显示实际运行时间 vs 业务时间。

### P2

- 与 Operation Flight Recorder 合并：episode 重跑时自动恢复原 time basis。
- 与 Memory Change Simulator 合并：新能力 dry-run 可选择 replay as-of date。
- 与 Evidence Watch 合并：watch run 按 contract 的 cadence/time window 运行。
- 与 AI Context Passport 合并：context package 强制带 time header 和 expiry。

## 风险与对策

| 风险 | 用户坏体验 | 对策 |
|---|---|---|
| 过度提示 | 每次看到日期都弹窗 | 只在执行/发送/外部 action 前显示；纯阅读低置信静默 |
| 错误解析 7/1 | 7 月 1 日 vs 1 月 7 日 | 使用 locale/timezone、业务上下文和显式确认；低置信 blocked |
| 当前与模拟混用 | 答案看似准确但口径错 | 双口径问题必须分栏；prompt header 禁止合并 |
| 与 Freshness/Change 重叠 | 用户不知道看哪个 | Time Basis 只说“按哪个时间用”；Freshness/Change 说“来源/事实是否变了” |
| 增加用户操作 | 每次都要确认日期 | 用户显式日期 + 低风险 read-only 直接 locked；仅冲突/写风险澄清 |
| 外部 AI 忽略 header | 仍按当前日期答 | Header 短、前置、机器可读；必要时 prompt compiler 在 output contract 重复一次 |

## Eval 决策

需要新增 evals。原因：这个能力的核心价值依赖时间表达理解、业务窗口解析、prompt/header 编译、guardrail 阻断和答案分栏，不是普通 UI 单测能证明。

实现时应新增 suite：

```text
evals/cases/time-basis-contract/
evals/workflows/time-basis-contract/experience.md
```

建议首批真实场景 case：

1. `nova-rmi-sync-simulate-2026-07-01`
   - 输入来自真实记忆样本：`不要用当前日期，模拟7/1，用 2026-Q3`。
   - 期望：`mode=simulation`、`simulationAsOf=2026-07-01`、`businessWindow=2026-Q3`、`forbidCurrentDate=true`、`writeBoundary=dry_run`。
2. `init-theme-query-current-q3`
   - 输入包含 `Target Delivery Quarter in (2026-Q3)`，无模拟日期。
   - 期望：`business_window` locked，但 `asOf=current`；不要求历史快照。
3. `current-vs-asof-split`
   - 用户同时问“现在是否还在 Q3”和“按 7/1 报表”。
   - 期望：答案分成 current 和 simulation 两个 section，不能混用证据。
4. `conflicting-quarter-blocked`
   - prompt 写 `模拟 7/1` 但 JQL 是 `2026-Q2`。
   - 期望：外部写 action blocked，read-only Ask warning。
5. `relative-today-forbidden`
   - skill prompt 里出现 `today`，同时用户说 `不要用当前日期`。
   - 期望：prompt header 明确替换或禁止 `today`。

实现后必须：

1. `npm run eval:validate`
2. `npm run eval:run -- --suite time-basis-contract --no-repair`
3. 生成 report。
4. 如果 frame extraction、header 编译、blocked/warning 策略任一 case 不达标，继续改进直到全部通过。
5. 如果真实场景不足，从 `10.32.56.212` 上 `esone.qiu` 的 messages/source-memory/action 样本补充，但不能把敏感原文无必要暴露在报告里。

## 验证计划

Docs/demo 阶段：

- `git diff --check -- docs/progressing/time-basis-contract-plan.md docs/progressing/time-basis-contract-demo.html`
- `rg` 检查必备章节：真实场景、Idea 来源、竞品/研究、边界、实现方案、Eval、文档维护。
- Demo inline JS 用 Node 解析。
- 用 Playwright 打开 demo，检查桌面和 390px mobile 无横向溢出，场景切换和按钮回执可用。

实现阶段：

- 后端单测：parser、resolver、guard。
- API 测试：Ask / context-recall / proposed action。
- 前端 E2E：Prompt patch 插入、Action Queue 审批回执、skill runner preflight。
- eval suite：`time-basis-contract`。
- 如果触及 memory recall/write path，再按 `AGENT.md` 执行 memory abilities regression gate。

## 文档维护要求

功能实现完成后，需要把关键点精简维护进正式 features 文档：

- [`docs/features/memory_system.md`](../features/memory_system.md)：补 `TimeBasisFrame` 在 Ask、Recall、Action Queue 前的横切合约。
- [`docs/features/ask.md`](../features/ask.md)：补 current/as-of/simulation 分栏回答和不足时的 warning。
- [`docs/features/compose_assist.md`](../features/compose_assist.md)：补 Prompt Context Compiler 插入 time header 的边界。
- [`docs/features/task_scheduler_api.md`](../features/task_scheduler_api.md)：如果 scheduled/task runner 消费 time basis，补运行时间 vs 业务时间。
- [`docs/features/personal_skill_foundry.md`](../features/personal_skill_foundry.md)：如果 skill manifest 增加 `requires_time_basis`，补 skill runner preflight。
- 如果 Desktop Quick Ask / Doubao Bridge 直接展示时间 chip，也应维护 [`desktop-app/docs/features/doubao_bridge.md`](../../desktop-app/docs/features/doubao_bridge.md) 或新建一个更合适的 desktop feature doc。

只有当 Time Basis Contract 成为独立可感知主能力时，才考虑新建 `docs/features/time_basis_contract.md`；否则优先并入上述横切功能文档，避免正式 features 目录碎片化。

## Demo

本次 demo 是集成式页面，不是独立产品页：

- 文件：[`time-basis-contract-demo.html`](./time-basis-contract-demo.html)
- 它模拟用户正在 Codex/ChatGPT 式任务输入框里准备运行 Nova RMI sync / Ask / 外部 AI prompt。
- 右侧 Personal AI 面板展示时间 chip、合约抽屉、冲突检查、prompt header 插入和 action 审批边界。
- Demo 数据使用本次真实记忆方向改写而来，中文为主，保留 `Target Delivery Quarter`、`2026-Q3`、`nova-capdev-rmi-sync` 等原始业务词。

## 决策建议

建议把 **Time Basis Contract / 时间口径合约** 作为一个 P0 横切能力推进，但不要做独立页面。

最小可行切片是：

1. 只覆盖 `Ask + Prompt Context Compiler + Action Queue + 一个 skill runner 场景`。
2. 只解析用户显式日期/季度/模拟指令。
3. 只在外部写风险或冲突时阻断。
4. 默认不增加日常操作成本。

它的亮点不是多一个日期选择器，而是把长期记忆系统里最容易被忽视的前提变成可传递的执行合约：

> Personal AI 以后不只会说“我记得这件事”，还会先说明“我按哪个时间来记得和执行这件事”。
