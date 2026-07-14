# 新能力：Open Question Exit Contract / 开放问题退场契约

> 生成日期：2026-07-10 CST
> 建议 Codex 会话标题：`新能力：开放问题退场契约`
> Demo：[`open-question-exit-contract-demo.html`](./open-question-exit-contract-demo.html)
> Idea 来源：未使用 Reminder。EventKit 确认本机 `Personal AI` Reminders 列表存在，`PERSONAL_AI_TOTAL 4`，但 `PERSONAL_AI_INCOMPLETE_COUNT 0`，没有未完成的全新能力 idea 可随机选择或标记完成。

## 结论

建议设计一个新的底层能力：**Open Question Exit Contract / 开放问题退场契约**。

一句话：

> Personal AI 不只要会提出开放问题、继续反思和派生外部核实，还要能判断一个问题什么时候应该退场、等待、合并、交给证据守望，或只在新证据出现后再恢复。

这个能力不新建一个用户每天维护的“反思治理台”。它是一层嵌入 `ReflectionThreadService`、`Evidence Watch Contracts`、`Action Queue`、`Confirm Requests`、Ask 和 Today/Quick Ask 收据里的生命周期协议。用户日常看到的是更少重复问题、更少重复 OpenClaw 委派、更清楚的“为什么现在不再追问”，而不是又多一个 inbox。

## 两个真实使用场景

### 场景一：早上打开 Quick Ask，不再被老问题追着跑

1. 早上 09:05，用户打开 Quick Ask，想问：“今天有什么需要先处理？”
2. 过去系统会把很多长期反思线程都当成仍需推进：`ChatGPT availability`、某个 Jira ticket 是否还会改、某个项目 delivery version 是否会变化。它们里面有些已经反思 100 多次，只是在等待外部委派或确认请求。
3. 新能力上线后，Quick Ask 顶部只显示一条轻量回执：
   - `开放问题已自动退场 17 条`
   - `等待外部委派 65 条，不再重复创建动作`
   - `等待用户决策 23 条，保留在 Decision Center`
   - `新证据恢复 2 条`
4. 用户不会被要求处理退场列表。只有真正影响今天工作的“新证据恢复”会进入 Today/Quick Ask。
5. 点击详情时，用户看到：`ChatGPT availability` 不是被删除，而是进入 `parked_until_new_evidence`；只有出现官方来源、新的用户询问，或已有委派回流时才恢复。

**Before**：同一个开放问题长期反思，生成重复外部核实动作，用户看到的是队列压力。
**After**：问题仍可追溯，但默认静默；系统把注意力还给今天真正变化的事。

### 场景二：Reflection 发现事实可能变了，但不再重复派同一个外部核实

1. Reflection heartbeat 发现 `impactful Engineering projects · backlog_requirement` 有新消息，提出“是否还会继续变化？”
2. 系统先读取 `OpenQuestionExitContract`：
   - 这个问题已经有 Evidence Watch contract。
   - 已有一个 `delegate_openclaw` 动作在队列中。
   - 最近 7 天没有新权威来源读数。
3. Reflection 不再创建新的 OpenClaw action，也不再新增 confirm request。它只写一条退场 run：
   - `state = waiting_on_existing_action`
   - `duplicateSuppressed = true`
   - `nextEligibleTrigger = action_result | authority_changed | user_asks_again`
4. Action Queue 卡片上显示：`复用已有核实：本轮没有重新触达来源，也没有新建动作。`
5. 如果后续外部核实返回 `checked_changed`，这个问题会自动恢复；如果 30 天无新证据，它会降级到历史问题，不再进入 Today/Ask 主流。

**Before**：相同事实缺口反复被“继续核实”。
**After**：外部核实是 source-bound 的，开放问题本身有退出和恢复条件。

## 为什么值得做

Personal AI 的目标是保存用户与 AI、消息、网页、会议、操作、偏好、skill 等全部记忆，并在真实场景中把合适记忆带回来。这个系统越会反思，越容易出现第二层问题：它会不停发现“这个事实会不会再变”“这个 ticket 是否还会调整”“这个工具状态是否继续变化”，然后把这些不确定性转成开放问题、确认请求和外部委派。

本轮真实只读数据说明问题已经很具体：

- `GET /api/v1/stats` with `X-User-Id: esone.qiu`：`11299` messages、`10120` chunks、`54683` relationships、`30` pending confirm requests。
- `GET /api/v1/coverage/pressure`：`113` queued actions、`885` active reflection threads、`1028` total pressure items。
- 对前 100 条 actions 的摘要：`98/100` 是 `delegate_openclaw`，`98/100` require approval，`53/100` 是 `artifact_gap`。
- 对前 100 条 reflection threads 的摘要：`65` 条在 `waiting_for_delegation`，`23` 条在 `waiting_for_confirm_request`，平均 `reflectionCount = 132.98`，最高样本 `376`。
- 样例线程包含 `ChatGPT availability` 反思 `148` 次、`Codex recommendation_status` 反思 `149` 次、`RingClaw author` 反思 `311` 次。

这些数字不是“系统坏了”，而是长期记忆系统的自然副作用：只要它持续追踪变化，就必须有一种机制知道什么时候应该停止、等待、合并，或者转交给更合适的契约。

## 产品亮点

1. **让 Personal AI 学会“不要继续问”**
   这不是减少能力，而是把好奇心变成有预算、有证据、有恢复条件的能力。

2. **不增加用户 review 成本**
   P0 不新增页面、不新增 daily inbox、不要求用户逐条批准退场。用户只在 Ask、Today、Action Queue、Reflection detail 看到局部收据。

3. **把等待状态讲清楚**
   `waiting_for_delegation`、`waiting_for_confirm_request`、`source_blocked`、`quiet_no_change` 不再只是一串内部状态，而是用户能理解的“本轮为什么不继续推进”。

4. **把重复动作挡在生成前**
   Evidence Watch 已经能复用外部核实动作；Exit Contract 更早地判断“这个开放问题是否还有资格生成动作或确认请求”。

5. **支持新证据恢复**
   退场不是删除。每个 contract 都有 `resumeTriggers`，例如新来源、用户再次主动询问、action result、confirm request resolved、time basis changed。

## 与已有功能和 progressing 方案的边界

| 已有能力 / 方案 | 已解决什么 | 开放问题退场契约新增什么 |
|---|---|---|
| Evidence Watch Contracts | 对会变化事实建立 source-bound verifier、cadence、stop conditions、去重 runs | Watch 管“事实如何复核”；Exit Contract 管“开放问题是否还该继续生成反思/动作/确认” |
| Reflection Threads | 记录反思线程、开放问题、本地研究、动作、等待原因 | 给每个开放问题独立生命周期，决定关闭、等待、合并、恢复，而不是让线程无限循环 |
| Action Readiness Contracts | 动作执行前检查 capability/auth/target/approval/proof | Exit Contract 更早：先判断这个问题是否还该创建动作 |
| Change Memory Ledger | 解析 old/new 事实变化，区分 current / historical / reversal | Exit Contract 可以消费 Ledger 判断问题是否已由变更链解决，但不解析字段变化 |
| Memory Outcome Loop | 记录记忆提示后是否有效，反向校准召回/提示 | Exit Contract 管开放问题和反思债；Outcome Loop 管提示后的用户结果 |
| Memory Reflection Governor（搁置） | 原方案是跨页巡航总览和治理后台 | 本方案刻意不建巡航台，只做嵌入式生命周期协议和局部 receipt |
| Memory Intake Quality Gate（搁置） | 录入前噪声/重复/低质量分流 | Exit Contract 处理反思阶段的开放问题，不处理原始记忆入库 |
| Ask / Answer Memory | 记录用户反复追问的活答案 | Exit Contract 可以把“已退场但用户又问起”的问题恢复给 Ask，但不替代活答案 |

一句边界：

> Evidence Watch 让事实查证不重复；Open Question Exit Contract 让问题本身不无限活着。

## 行业和研究参考

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 把 context 描述为有限资源，并强调 agent loop 产生的信息必须反复策展。Exit Contract 把同样原则用于 Personal AI 的反思问题池：不是所有开放问题都配继续占用下一轮上下文。
- [Claude Cookbook: Context engineering, memory, compaction, and tool clearing](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools) 把 compaction、tool-result clearing、memory 分成不同上下文管理手段。Exit Contract 类似 tool-result clearing 的精神：保留“发生过”和恢复条件，但不把旧问题继续塞进活跃反思上下文。
- [Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670) 将 agent memory 形式化为 `write-manage-read` loop，并把 trustworthy reflection、learned forgetting、latency budgets、privacy governance 列为挑战。Exit Contract 正是 `manage` 层：治理 reflection 产生的开放问题和动作债。
- [STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?](https://arxiv.org/abs/2605.06527) 指出长期记忆系统不仅要检索更新证据，还要能处理隐式冲突、拒绝过期前提并把新状态用于后续行为。Exit Contract 的 `resumeTriggers` 和 `retirementReason` 可直接生成这种 stale / premise-resistance eval。
- [LongMemEval](https://arxiv.org/abs/2410.10813) 把长期记忆能力拆成 extraction、multi-session reasoning、temporal reasoning、knowledge updates、abstention。Exit Contract 明确把“问题已退场/等待新证据”作为 abstention 的产品形态，而不是让系统为了回答而继续猜。
- [Chroma Context Rot](https://www.trychroma.com/research/context-rot) 和 2026 的 [Diagnosing and Mitigating Context Rot in Long-horizon Search](https://arxiv.org/abs/2606.29718) 都说明更多上下文不一定更好，旧信息和 distractors 会降低表现。Exit Contract 通过问题退场减少旧开放问题对 Ask / Reflection / Action planning 的上下文污染。
- [LangGraph Memory overview](https://docs.langchain.com/oss/python/concepts/memory) 区分短期线程记忆和跨线程长期记忆，并提醒长对话会被 stale/off-topic content 分散注意。Exit Contract 把这个问题投射到 Personal AI 的 reflection threads：线程可以保留审计，但不必一直保持活跃。
- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents) 和 [Human-in-the-loop docs](https://openai.github.io/openai-agents-python/human_in_the_loop/) 把 run state、approval interruption、resume 作为一等对象。Exit Contract 借鉴这种 lifecycle 设计：等待用户决策时暂停，不把暂停误当成失败或新任务。

## 产品定义

### 核心对象：OpenQuestionExitContract

每个反思开放问题、Answer Memory unresolved question、Evidence Watch question 或 action-derived follow-up 都可以挂一个 contract。

```ts
type OpenQuestionExitContract = {
  id: string;
  questionKey: string;
  questionText: string;
  sourceKind: 'reflection_thread' | 'ask' | 'evidence_watch' | 'action_result' | 'source_memory';
  sourceRefId: string;
  subjectKey?: string;
  claimSlot?: string;
  state:
    | 'active'
    | 'waiting_on_existing_action'
    | 'waiting_on_confirm_request'
    | 'handoff_to_evidence_watch'
    | 'parked_until_new_evidence'
    | 'merged'
    | 'answered'
    | 'expired_low_value'
    | 'closed_user_dismissed';
  reasonCode:
    | 'duplicate_action_pending'
    | 'confirm_pending'
    | 'evidence_watch_owns_verification'
    | 'no_new_evidence'
    | 'low_user_impact'
    | 'answered_by_current_evidence'
    | 'superseded_by_change_ledger'
    | 'user_reasked'
    | 'new_authority_signal';
  userImpact: 'blocking_today' | 'useful_later' | 'background_only' | 'unknown';
  noveltyScore: number;
  actionabilityScore: number;
  evidenceGainScore: number;
  repeatDebtScore: number;
  reflectionCount: number;
  duplicateSuppressedCount: number;
  lastNewEvidenceAt?: number;
  nextEligibleAt?: number;
  resumeTriggers: Array<
    | 'new_source_memory'
    | 'authority_changed'
    | 'action_result'
    | 'confirm_resolved'
    | 'user_asks_again'
    | 'time_basis_changed'
  >;
  receipt: {
    label: string;
    summary: string;
    boundary: string;
    nextStep: string;
  };
};
```

### 状态机

```text
active
  -> waiting_on_existing_action       // 已有 action，不再重复创建
  -> waiting_on_confirm_request       // 等用户决策，不再生成新 confirm
  -> handoff_to_evidence_watch        // 后续由 source-bound verifier 管
  -> parked_until_new_evidence        // 无新证据，静默等待恢复触发器
  -> merged                           // 与同一 subject/claim/open question 合并
  -> answered                         // 当前证据足够，转成 Answer Memory / summary
  -> expired_low_value                // 低影响、长期无新证据，只保留历史审计
  -> closed_user_dismissed            // 用户明确关闭
```

任何 closed / parked 状态都不是删除。它们仍然可在 Reflection detail、Debug/Evals、Source Memory 或 Memory Timeline 中追溯。

### 退场判断因子

1. **新证据增益**：最近一次反思是否真的引入了新 evidence ref、authority source 或 source-memory distillation。
2. **重复债**：同一 subject/claim 已经有多少 reflection run、confirm request、OpenClaw action、Evidence Watch run。
3. **用户影响**：是否影响今天会议、正在编辑的 Jira/comment、待发送消息、Ask 当前问题、Action Queue 高风险动作。
4. **可执行性**：下一步是否明确，还是只是泛泛“未来可能会变”。
5. **已有 owner**：是否已有 Evidence Watch、Confirm Request、Action Queue action 或 Outreach session 承接。
6. **恢复条件是否可定义**：不能定义恢复条件的问题不应无限 active；应降为 background-only 或 expired。

## 用户体验设计

### 不新建一级页面

P0 不添加独立导航入口。Demo 只是模拟它嵌入现有 surfaces：

- Reflection Threads 列表：每行显示 `退场判断` chip。
- Reflection detail：显示 `为什么本轮不继续推进`、`恢复条件`、`上次新证据`。
- Action Queue：重复委派卡片显示 `已有问题契约复用`，说明没有新建 action。
- Ask / Quick Ask：回答底部显示 `开放问题退场回执`，解释哪些旧问题没有被拿来当作当前证据。
- Today Pilot：只展示 `new_authority_signal` 或 `blocking_today` 的恢复项，不展示 parked 列表。

### 可见文案原则

- `已退场` 不说成 `已解决`。
- `等待外部委派` 不说成 `已复核`。
- `Evidence Watch quiet_no_change` 不说成 `本轮已重新查过`。
- `parked_until_new_evidence` 不说成 `已忘记`。
- `expired_low_value` 不删除原始 evidence，只是不再主动消耗反思预算。

## 实施方案

### P0：退场服务与只读收据

新增 `OpenQuestionExitContractService`：

1. 在 `ReflectionThreadService.runReflection()` 写入开放问题之前调用。
2. 对每个 open question 计算稳定 `questionKey`：`subjectKey + claimSlot + normalized question`。
3. 查找已有 actions、confirm requests、Evidence Watch contracts、action results、reflection run history。
4. 输出 `OpenQuestionExitDecision`：
   - `allowProceed`
   - `suppressNewAction`
   - `mergeIntoContractId`
   - `state`
   - `receipt`
5. 对 suppressed / waiting / parked 写 run record，但不创建新的 action / confirm request。

P0 先不改变外部执行器，只减少重复生成和增加收据。

### P1：Ask / Action Queue / Reflection detail 集成

- Reflection detail 展示 contract receipt、恢复条件、合并对象。
- Action Queue 卡片展示 `openQuestionContractId` 和 `duplicateSuppressedCount`。
- Ask response 返回可选 `openQuestionExitReceipts`，只显示与本轮答案有关的 1-3 条。
- Today / Quick Ask 只消费 `active + blocking_today + new_authority_signal`，不消费 parked 全量。

### P2：恢复和清理

- 新 evidence 写入、Evidence Watch changed、action_result、confirm resolved、用户再次 Ask 时，调用 `resumeOpenQuestionContracts()`。
- 对 `parked_until_new_evidence` 超过阈值且低影响的问题转 `expired_low_value`。
- 将高频恢复/退场指标写入 coverage pressure，不新增用户待办。

## 数据模型建议

```sql
CREATE TABLE open_question_exit_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  subject_key TEXT,
  claim_slot TEXT,
  state TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  user_impact TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  resume_triggers_json TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  duplicate_suppressed_count INTEGER NOT NULL DEFAULT 0,
  last_new_evidence_at INTEGER,
  next_eligible_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, question_key)
);

CREATE TABLE open_question_exit_runs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  run_kind TEXT NOT NULL, -- evaluated | suppressed_duplicate | parked | resumed | merged | closed
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  linked_action_id TEXT,
  linked_confirm_request_id TEXT,
  linked_evidence_watch_contract_id TEXT,
  receipt_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## 风险与边界

- **误退场风险**：真正重要的问题被静默。缓解：`blocking_today`、用户再次问、权威来源变化、action_result、confirm resolved 都能恢复；P0 先不自动关闭高影响问题。
- **假装解决风险**：退场被用户误读为答案。缓解：所有 receipt 明确写 `未解决，只等待...` 或 `不再重复创建动作`。
- **过度依赖 LLM 判断**：P0 以确定性规则为主；LLM 只辅助 `questionKey` 归一和 `userImpact` 分类，且必须可回放。
- **与 Evidence Watch 重叠**：Exit Contract 不触达外部来源，不更新 `lastCheckedAt`，只决定开放问题是否继续消耗反思/action 预算。
- **历史审计不能丢**：退场不删除 reflection runs、actions、evidence refs，只改变未来默认推进资格。

## Eval 决策

需要创建 eval。这个能力的价值依赖 LLM/规则判断、排序、退场与恢复质量，必须在实现后新增 `evals/` suite。

建议 suite：`open-question-exit-contracts`

真实场景样本优先来自 `10.32.56.212` 的 `esone.qiu` 数据：

1. `waiting_for_delegation` 重复问题：已有 `delegate_openclaw` 时不再新建 action，receipt 说明“复用已有核实，本轮未触达来源”。
2. `waiting_for_confirm_request`：已有 pending confirm request 时不再生成新的确认请求。
3. 长期无新证据：`ChatGPT availability` 类反思次数 >100 且无新 authority signal，应 `parked_until_new_evidence`，不能进 Today 主流。
4. 新证据恢复：同一 subject 出现新的 source-memory / Evidence Watch changed 后，contract 从 parked 恢复 active。
5. 反向红队：`blocking_today` 的会议/Jira deadline 问题不能因为旧 action pending 被完全静默，应保留 Today/Quick Ask 高信号提示。

实现后必须：

```bash
npm run eval:validate
npm run eval:run -- --suite open-question-exit-contracts --no-repair
```

如果修改 Reflection / Ask / ActionQueue / Evidence Watch 的 recall/write 路径，还要按 `AGENT.md` 跑：

```bash
npm run eval:memory-abilities
```

验收报告需要明确：

- duplicate action suppression 是否命中；
- false retirement 是否为 0；
- parked 问题是否在新证据后恢复；
- receipt 是否没有把“等待/退场”说成“已解决/已复核”。

## 文档交接

如果将来实现，最后要把关键逻辑维护进正式文档：

- `docs/features/memory_system.md`：新增 Reflection / open question lifecycle、状态机、退场/恢复边界。
- `docs/features/evidence_watch_contracts.md`：补充与 Exit Contract 的分工：Watch 负责 source-bound verifier，Exit 负责 question lifecycle。
- `docs/features/ask.md`：补充 Ask 如何展示 open-question 退场回执，以及哪些 parked 问题不会当作当前证据。
- `docs/features/index.md`：如果有独立 API 或用户可感知子能力，新增“小功能点”索引行；否则挂到 Memory Service / Reflection 现有行下。

## 推荐 P0 范围

不要先做治理页面。推荐第一个实现切片：

1. `OpenQuestionExitContractService`
2. `open_question_exit_contracts` / `open_question_exit_runs`
3. Reflection 生成动作前的 suppression
4. Action Queue / Reflection detail 的只读 receipt
5. `open-question-exit-contracts` eval suite

成功标准很具体：

- 前 100 条 reflection-derived action 样本里，重复 `delegate_openclaw` 不再继续增长。
- `waiting_for_delegation` 和 `waiting_for_confirm_request` 不再触发新的同义开放问题。
- 用户在 UI 上能分清：等待、复用、已退场、新证据恢复、真正已解决。
