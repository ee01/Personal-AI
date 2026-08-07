# 新能力：Routine Delta Memory / 例行差分记忆

> 状态：待决策，仅完成方案与交互 Demo，尚未修改功能代码  
> 规划日期：2026-08-05  
> 建议复制标题：`新能力：例行差分记忆`  
> 交互预览：[routine-delta-memory-demo.html](./routine-delta-memory-demo.html)  
> Idea 来源：本轮 Personal AI Reminder 未完成条目为 0，因此不是 Reminder idea；无需标记完成。

## 一句话结论

Personal AI 不应把第 30 次日会当成第 30 份互不相关的新记忆。它应该学会一个例行场景的“平常是什么”，每次只在 Today Pilot、Meeting Pilot 和 Ask 中带来三类高信号内容：**这一次变了什么、上一次还有什么没收口、哪些结论仍只是暂定**；所有原始 occurrence 仍完整保留并可回跳。

这是一种新的记忆原语，而不是新的总结页、通知队列或去重按钮：

`原始发生记录 → 例行系列 → 版本化基线 → 本次差分 + 延续事项 → 场景化提示`

## 先看两个真实使用场景

### 场景 1：早上 09:58，用户要进第 30 次 Nova Brandy Daily

现在的体验可能是：Today Pilot 再次看到会议标题、固定会议链接、常驻参会人，以及一批“看起来相关”但每天都差不多的记忆。用户真正想知道的不是这场会是什么，而是**今天和昨天相比有什么值得开口**。

启用例行差分记忆后，体验如下：

1. 用户照常打开 Personal AI 的 Today Pilot / Video Home，不进入新的管理页面。
2. `Nova Brandy Daily` 卡片顶部只出现一条克制的回执：`第 30 次同系列 · 本次 2 项变化 · 1 条延续`。
3. 卡片首先展示变化，而不是完整摘要：
   - `RCV Native Meeting SDK` 的 Team 字段刚补齐，今天可确认影响范围；
   - 会议议题首次出现 `DEV / QA Estimate 汇总规则`，与过去 7 次例行议题不同。
4. 下方展示一条从上次会议带来的延续事项：`确认 DEV 与 QA Estimate 是覆盖还是求和`，并标明它来自哪一次 occurrence。
5. 固定会议链接、常驻参会人、固定 daily board 等 5 条基线信息默认安静折叠；用户点“查看例行基线”才展开。
6. 用户若觉得系统把两场同名会合错了，可点“不是同一例行”，看到明确回执：只修正 Personal AI 的系列关系，不改日历、不删原始记忆。
7. 用户仍可点“查看 3 次原始记录”逐条回到原始 Calendar、会议结果或消息证据。

这时 AI 的价值不是替用户重读一遍邀请，而是把进入会议前的注意力压缩到真正的变化。

### 场景 2：会中有人问“这周和上周相比，卡在哪里？”

1. Meeting Pilot 侧栏沿用当前会议界面，在顶部显示一个小型“本场不同点”模块。
2. 它把本周 occurrence 与稳定基线、最近一次有效 occurrence 对照，而不是对全部历史做一次无边界总结。
3. 用户看到：`风险从无 → 出现 release 依赖`、`owner 从未定 → Mobile SDK`、`上周行动项仍未收口`。
4. 用户点某一变化，侧栏显示 before / after 与两边证据；模型生成的解释不能脱离这两个来源片段。
5. 用户追问 Ask：“Nova Brandy 最近三次日会真正变了什么？”Ask 直接读取已验证的 occurrence delta；回答后附 `3 次 occurrence / 6 条原始证据`，不把差分摘要当成新的独立事实。
6. 如果本次没有可证明的变化，侧栏不显示一张“无变化”大卡，只在会议标题旁提供低对比度状态：`与例行一致 · 5 条基线已安静折叠`。

## 为什么值得做

### 线上真实使用信号

本轮对 `10.32.56.212` 上 `esone.qiu` 的 memory service 做了只读抽样：

- 共有约 `11,706` 条消息、`10,540` 个 chunks、`54,683` 条 relationships；这已经不是“能不能存下来”的规模，而是“如何在需要时只取高信号”的规模。
- 最近 30 天抽样到 `227` 条 Calendar 记录；其中 `RCVSDK Daily Sync 33`、`Nova Brandy Daily 30`、`Pluto daily 22`、`RCV & RCW mobile daily 22`，仅这四个系列就占 `107 / 227 = 47.1%`。
- Today Pilot 的 catch-up 返回中，仍能看到 Nova Brandy Daily、RCV & RCW mobile daily、Application Video Weekly Sync Up 等周期邀请进入等待或高优先列表。

这不意味着这些会议“不重要”；恰恰相反，它们很重要、出现频繁，但**固定部分不该每次重新争夺用户注意力**。系统需要把“频繁”与“新鲜”分开。

> 数据边界：上述数字是 2026-08-05 的线上只读快照，只用于验证问题规模。Demo 使用脱敏重组数据，不包含会议链接、密码、私人消息或完整参会人信息。

### Before / After

| | Before | After |
|---|---|---|
| 会前 | 第 30 次仍展示标题、链接、参会人和泛相关记忆 | 只突出 2 个变化、1 个延续，基线默认折叠 |
| 会中 | 再搜多次会议记录，人工对照 | 点变化直接看 before / after 与证据 |
| Ask | 模型临时读取多段近似文本后概括，容易漏变化或过度归纳 | 读取已落证据的 series / baseline / delta 结构 |
| 无变化时 | 仍生成摘要，制造“有新东西”的错觉 | 默认静默，只留可审计的折叠回执 |
| 出错恢复 | 用户难判断是检索错、总结错还是系列合错 | 可以拆分系列；原始 occurrence 不变，差分可重算 |

## 用户需求与亮点

### 满足的需求

1. **我不想重复读已经知道的东西**：固定部分变成基线，不再每次抢占注意力。
2. **我怕错过真正变化**：时间、owner、deadline、decision、risk、scope 等变化优先浮现。
3. **我想知道上次没收口的事**：carryover 与本次差分并列，但不会擅自创建 Jira、Reminder 或行动项。
4. **我需要相信 AI 不是编的**：每条差分有 before / after、occurrence 时间和原始来源。
5. **我不想被系统的错误归类绑住**：可以拆系列，所有派生结果可重算，原始记忆不可被差分层覆盖。

### 惊艳但实用的点

- 从“搜到更多”转向“只告诉我和平常不同的部分”。
- 同一个能力同时服务会议、聊天追问和未来的周期 agent run，却不要求用户先整理文件夹或写规则。
- 默认安静：真正没有变化时，最好的 UI 就是少出现一张卡。
- 差分不是模型的一段自由发挥文本，而是有版本、范围、来源和恢复路径的正式记忆结构。

## 能力定义：不是摘要，而是四层记忆结构

### 1. Routine Series（例行系列）

对一组“同一例行场景的多次真实发生”建立稳定身份。P0 只支持：

- Calendar 原生 recurrence / series ID 明确的周期会议；
- 已经与 Calendar occurrence 绑定的 Meeting Pilot prep / outcome binder。

P1 再支持有稳定 schedule ID 的周期 agent task、自动化和例行报表。标题相似但没有稳定 identity 的记录，不应为了覆盖率强行合并。

### 2. Baseline Version（版本化例行基线）

基线表示“最近一段时间内稳定成立的部分”，例如固定目的、常驻参会角色、稳定议题、常用来源。它不是全局真相，也不是覆盖原始记录的新摘要。

- 每次 baseline 更新都生成新版本；旧版本保留。
- 基线只能由至少 3 次同系列 occurrence 支撑。
- 时间、owner、deadline、risk、decision 等高风险字段不得仅因重复出现两次就成为稳定事实。
- 用户纠正系列关系后，baseline 和 delta 异步重算；原始 occurrence 保持不变。

### 3. Occurrence Delta（本次差分）

每次发生记录与“生成时使用的 baselineVersionId + 最近一次有效 occurrence”对照，输出结构化变化：

- `added`：本次新增；
- `changed`：字段或语义从 A 变到 B；
- `removed`：过去稳定存在、本次明确移除；
- `resolved`：上次开放问题已关闭；
- `unchanged_hidden`：确认是基线但不进入默认视图；
- `unknown`：证据不足，不能把“没提到”误判为“已删除”。

### 4. Carryover（延续事项）

把上一 occurrence 中有明确来源、尚未关闭的 decision / risk / question / commitment 带到本次。它只是一条**记忆提示**：

- 不自动创建 Reminder、Jira、任务或外部消息；
- 不因为模型没找到 closing evidence 就永久保持 open；
- 必须展示 originating occurrence 与最后一次确认时间；
- 用户可以标为“本场无关”或“已处理”，但这是 Personal AI 内部状态，不冒充外部写回。

## 为什么不与已有方案重复

| 已有能力 / 被搁置方向 | 它解决什么 | 本方案明确边界 |
|---|---|---|
| Ambient Memory Forgetting | 降低弱、旧、重复记忆的影响或归档 | 不靠遗忘周期会议；为真实多次 occurrence 学 baseline 和 delta |
| Memory Echo Dampener | 防止同一来源的派生副本被当成多份独立证据 | 处理的是同一例行系列中**不同时间真实发生**的多次事件；仍复用 echo 的 origin-family 计权 |
| Memory Freshness Radar | 监控外部来源快照是否变化 | 比较的是个人情境内的一连串 occurrence，不是网站 / 文档源监控 |
| Today Pilot | 编排今天 mission、会议 prep、catch-up | 本方案提供更高信号的系列记忆给 Today Pilot，不重建首页和任务队列 |
| Meeting Outcome Binder | 把一场会议的目标、transcript、决议和行动项装订起来 | 本方案跨 occurrence 比较多个 binder，不替代单场装订 |
| Memory Storyline Builder | 把跨时间证据组织成可理解的故事线 | 本方案是严格 series identity 下的基线 / 差分机制，不做主题叙事 |
| Working Memory Return Stack（已搁置） | 恢复中断前的工作现场 | 不做“回到哪里”；解决反复现场中“哪里不同” |
| Memory Reflection Governor（已搁置） | 治理主动反思与通知 | 不引入新的反思队列或通知治理 |
| Agent Run Profile（已搁置） | 给 agent run 固化上下文 / 权限配置 | P1 只对既有周期 run 做结果差分，不设计 run profile |

结论：若实现，应作为 Today Pilot / Meeting Pilot / Ask 的底层高信号机制，不新增“例行记忆中心”大页面。

## 竞品对照

| 产品 / 资料 | 已有做法 | 仍留下的机会 |
|---|---|---|
| [Microsoft Copilot：Prepare for your meeting](https://support.microsoft.com/en-US/Outlook/prepare-for-your-meeting-with-copilot) | 从邮件、文档、任务等关联内容生成会前准备 | 强在当场准备，但不是面向 recurring series 的显式 baseline / delta 模型 |
| [Microsoft Teams Copilot：Catch up on meetings](https://support.microsoft.com/en-us/teams/copilot/catch-up-on-meetings-with-microsoft-365-copilot-in-teams) | 用 transcript / chat 回顾会议 | 官方说明 recurring meeting 的先前 Copilot conversation history 在后续转录会议中不可用，跨 occurrence 连续性仍有缺口 |
| [Teams meeting recap](https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams) | 按 occurrence 查看 recap、transcript、attendance 等 | 可以逐场切换，但没有“平常基线 + 本场差分 + 延续事项”的高信号视图 |
| [Granola Spaces & Folders](https://docs.granola.ai/help-center/sharing/folders/spaces-and-folders) | 可把未来 recurring meeting notes 自动加入同一 folder | 用户仍需进入 folder / chat 跨笔记询问；Personal AI 可在真实场景到来时主动、安静地呈现差分 |
| [Granola：Chat across meetings](https://docs.granola.ai/help-center/getting-more-from-your-notes/chatting-with-your-meetings) | 支持跨 meetings 查模式、比较讨论 | 强在用户主动 query；本方案把“和例行相比变了什么”变成可复用记忆原语，并对无变化保持静默 |
| [Notion AI Meeting Notes](https://www.notion.com/en-US/product/ai-meeting-notes) | transcript、summary、decisions、action items 可搜索并连接 workspace | 强在记录与组织；本方案更重视 series identity、差分证据与场景内 attention budget |

Personal AI 不需要复制一个会议笔记产品。优势应来自：它同时拥有 Calendar、消息、操作、浏览、Meeting Pilot 和 Ask 的个人记忆，可以在场景到来时把跨来源变化接起来，并明确说明哪些只是内部派生提示。

## 研究依据与设计推论

1. [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调有限 attention 下应寻找最小的高信号 token 集合。设计推论：消费者默认拿 delta + carryover，不拿整段系列历史。
2. [EM-LLM: Human-Inspired Episodic Memory for Infinite Context LLMs](https://arxiv.org/abs/2407.09450) 使用 Bayesian surprise 帮助在线事件分段。设计推论：语义 surprise 可辅助排序，但不能单独决定 series 合并或关键事实变化。
3. [HiMem: Hierarchical Long-Term Memory for LLM Long-Horizon Agents](https://arxiv.org/abs/2601.06377) 区分 episode memory 与更稳定的 note memory，并用 event surprise 组织边界。设计推论：原始 occurrence 与稳定 baseline 必须分层保存。
4. [All-Mem: Agentic Lifelong Memory with Non-Destructive Transformations](https://arxiv.org/abs/2603.19595) 把 consolidation 设计为非破坏性过程。设计推论：baseline / delta 永远是可重算派生层，不能覆盖证据。

这些论文支持的是机制方向，不直接证明本功能在 Personal AI 中有效；是否有效仍需真实系列数据的 precision、漏报和注意力节省 eval。

## P0 产品范围

### 做什么

- 识别有可靠 recurrence identity 的 Calendar / Meeting Pilot 系列。
- 为至少 3 次 occurrence 的系列建立版本化 baseline。
- 对结构化字段与有证据文本生成 occurrence delta。
- 从 Meeting Outcome Binder 带出有限 carryover。
- 在 Today Pilot / Video Home 会议卡和 Meeting Pilot 侧栏集成低打扰视图。
- 让 Ask 能按 series / occurrence / delta 查询，并引用原始证据。
- 提供“不是同一例行”的 Personal AI 内部纠正与重算回执。

### 不做什么

- 不新增独立“例行记忆管理”首页。
- 不自动创建 Jira、Reminder、Calendar、行动项或对外消息。
- 不把“本次没提到”默认判定为 removed / resolved。
- 不依赖标题相似度强行合并同名会议。
- 不把 delta 作为新的独立证据重复计权。
- 不在 P0 支持所有周期任务、习惯追踪或健康行为。
- 不删除、不压缩掉、也不改写原始 occurrence。

## 交互设计

### 入口 1：Today Pilot / Video Home 会议卡

卡片标题下新增一个小型 series receipt：

`第 30 次同系列 · 基线 7/29 更新 · 2 项变化 · 1 条延续`

默认顺序：

1. 关键变化：decision、risk、scope、owner、deadline、time / cancellation；
2. 延续事项：最多 2 条，超过后折叠；
3. 可选的例行基线与来源；
4. 纠正入口与只读边界回执。

无变化时不生成大卡；只显示 `与例行一致` 的 1 行状态。匹配不确定时不展示 delta，而是显示 `可能属于同一例行 · 暂未合并`，让错误以少做而不是错做结束。

### 入口 2：Meeting Pilot 侧栏

- 侧栏顶部“本场不同点”，不遮挡 transcript / cue 主流程。
- 每条变化点击后展开 before / after、来源 occurrence、更新时间。
- `查看原始记录` 是只读导航；`不是同一例行` 是 Personal AI 内部写操作，必须二次确认 exact scope。
- 会议进行中如果出现新的明确 decision / owner / deadline，先标 `本场新出现 · 会后待 transcript 固化`，不能提前写入 stable baseline。

### 入口 3：Ask

推荐支持：

- “Nova Brandy 最近三次真正变了什么？”
- “这个日会一直没收口的事情有哪些？”
- “今天这场和上次的风险有什么不同？”

回答 receipt 示例：

`基于 1 个例行系列、3 次 occurrence、6 条原始证据；2 条变化来自结构化字段，1 条为模型归纳。未读取被排除的同名会议。`

### 状态设计

| 状态 | UI | 行为 |
|---|---|---|
| `cold_start` | `已识别例行 · 还需 1 次形成基线` | 展示单场 prep，不做差分承诺 |
| `quiet` | `与例行一致 · 基线已折叠` | 不占高优先卡位、不发通知 |
| `changed` | `2 项变化 · 1 条延续` | 变化优先，基线按需展开 |
| `uncertain_series` | `可能属于同一例行 · 暂未合并` | 不计算跨场差分 |
| `stale_baseline` | `基线超过 30 天未校准` | 降低确定性，先按 occurrence 展示 |
| `source_gap` | `缺少上次 transcript，仅比较日历字段` | 不把来源缺失误判为“无变化” |
| `recomputing` | `系列关系已修正，差分正在重算` | 继续保留原始记录；旧 delta 标 stale |

### 信任、隐私与动作边界

- 每个卡片控制必须有 `title` / `aria-label` 说明它是只读导航、内部修正还是外部动作。
- 会议链接、dial-in code、密码、token、private attendee details 在 baseline / delta 生成前走 secret redaction；Demo 和 eval 不存原文。
- 内部 correction 写回只能改 `routine_series_membership`；不能改 Calendar source。
- baseline 与 delta 记录生成时间、算法版本、source IDs 和权限范围。
- Ask / Today Pilot 只消费当前 user scope；不得跨用户或从共享标题推断身份关系。

## Demo 说明

[打开交互 Demo](./routine-delta-memory-demo.html)。它不是独立新页面，而是在 Personal AI 的 Today Pilot / Video Home 与 Meeting Pilot 侧栏中模拟集成效果。

建议按以下路径体验：

1. 顶部切换 `有变化 / 与例行一致 / 匹配不确定`，观察无变化时卡片如何退回安静状态。
2. 在 `有变化` 中点任意差分，查看 before / after 与来源。
3. 点 `查看例行基线`，确认固定内容被折叠但没有删除。
4. 点 `查看 3 次原始记录`，确认每个 occurrence 独立存在。
5. 切换到 `会中侧栏`，确认同一结构可以在现有 Meeting Pilot 场景复用。
6. 点 `不是同一例行`，观察明确的内部修正 scope 和恢复回执。

Demo 内的 `Nova Brandy Daily`、Team 字段、estimate 规则等来自真实工作形态的脱敏重组，不代表线上 Jira 或会议当前真值。

## 数据契约草案

```ts
type RoutineSourceKind = 'calendar_series' | 'meeting_series' | 'scheduled_agent_run';

interface RoutineSeries {
  id: string;
  userId: string;
  sourceKind: RoutineSourceKind;
  externalSeriesKey?: string;      // P0 首选的确定性 identity
  label: string;
  identityConfidence: number;
  identityBasis: Array<'external_id' | 'organizer' | 'cadence' | 'manual_correction'>;
  status: 'learning' | 'active' | 'split' | 'archived';
  currentBaselineVersionId?: string;
  createdAt: number;
  updatedAt: number;
}

interface RoutineOccurrenceRef {
  seriesId: string;
  occurrenceId: string;
  occurredAt: number;
  sourceKind: 'calendar_event' | 'meeting_prep' | 'meeting_outcome';
  sourceId: string;
  membershipState: 'confirmed' | 'candidate' | 'excluded';
  membershipBasis: string[];
}

interface RoutineBaselineVersion {
  id: string;
  seriesId: string;
  version: number;
  supportOccurrenceIds: string[];
  stableClaims: RoutineClaim[];
  validFrom: number;
  generatedAt: number;
  generatorVersion: string;
}

interface RoutineOccurrenceDelta {
  id: string;
  seriesId: string;
  occurrenceId: string;
  baselineVersionId: string;
  comparisonOccurrenceId?: string;
  changes: RoutineChange[];
  carryovers: RoutineCarryover[];
  quietBaselineClaimIds: string[];
  sourceIds: string[];
  status: 'ready' | 'partial' | 'stale' | 'recomputing';
  generatedAt: number;
}

interface RoutineChange {
  id: string;
  kind: 'added' | 'changed' | 'removed' | 'resolved' | 'unknown';
  field: 'decision' | 'risk' | 'scope' | 'owner' | 'deadline' | 'time' | 'participant' | 'topic';
  before?: { value: string; sourceId: string };
  after?: { value: string; sourceId: string };
  importance: 'critical' | 'notable' | 'minor';
  confidence: number;
  explanation?: string;
}
```

派生 claim 必须继续使用现有 source / lineage 机制，并与 Memory Echo Dampener 共享 `origin family`：`delta` 可以被召回，但不能与它引用的 before / after 再计成三份独立证据。

## 系列识别：先保证不误合并

### P0 硬门槛

按以下优先级识别：

1. Calendar provider 的稳定 recurrence / series identifier；
2. 同一个 external series 下的 occurrence ID；
3. 已经通过 eventExternalId 绑定的 Meeting Prep / Outcome Binder；
4. 用户显式 correction。

只有全部缺失时，才允许进入 `candidate`：标题归一化 + organizer identity + cadence window + participant overlap。候选只用于提示“可能同系列”，不允许生成确定性 delta。

以下任一条件触发 `do_not_merge`：

- organizer 不同且无同一 external series key；
- 同名会议时间重叠；
- scope / workspace / user 权限不同；
- one-off event 与 recurring master 关系无法证明；
- occurrence 被用户排除。

### 取消、改期和拆分

- `cancelled` / `moved` 是高优先结构化 delta，不能靠 transcript 判断。
- 单次改期仍属于原 series，但显示 `本次时间变化`。
- Calendar provider 明确产生新 series 时旧 series 不自动拼接；可显示“可能是延续系列”但不跨系合并。
- 用户拆分 series 后，所有关联 delta 标 `stale`，排队重算；历史生成结果仍保留审计状态。

## 差分生成管线

1. **Capture**：原始 Calendar / prep / binder 正常摄入，不为本功能复制原文。
2. **Identity gate**：建立 confirmed / candidate / excluded membership。
3. **Structured normalize**：抽取开始时间、取消状态、明确 owner / deadline / Jira key 等可确定字段。
4. **Baseline learn**：至少 3 次 confirmed occurrences，稳定 claim 达支持阈值才入新 baseline version。
5. **Deterministic diff**：先计算 time、status、participant、linked issue fields 等结构化变化。
6. **Evidence-bound semantic diff**：模型只能在给定 before / after spans 上判断 topic / decision / risk 变化，并返回 source IDs；不能凭系列标题补事实。
7. **Carryover resolve**：寻找明确 closing evidence；缺少证据时使用 `unknown`，而不是自动 resolved。
8. **Rank + attention budget**：critical 永远保留；notable 最多 3 条；minor 默认折叠。
9. **Consumer projection**：Today Pilot、Meeting Pilot、Ask 按各自 scene 取同一 delta 的不同投影。
10. **Receipt**：记录被展示、折叠和排除的理由，但查看行为不反向创造新业务事实。

### 排序建议

先过硬门槛，再在同级内排序：

```text
deltaScore =
  0.30 * decisionRiskImpact +
  0.20 * ownerDeadlineImpact +
  0.15 * scopeImpact +
  0.10 * timeOrCancellationImpact +
  0.10 * contentSurprise +
  0.10 * explicitUserInterest +
  0.05 * sourceFreshness -
  boilerplatePenalty - ambiguityPenalty
```

`contentSurprise` 只能影响排序，不能把低证据文本升级为事实。取消、改期、明确 owner / deadline / decision 变化通过结构化规则直达 critical / notable。

## 服务与接口建议

### 新增内部模块

- `RoutineSeriesRepository`：series、membership、baseline version、delta 索引。
- `RoutineDeltaService`：身份门槛、基线、结构化 / 语义差分、重算。
- `RoutineDeltaProjectionService`：为 Today Pilot、Meeting Pilot、Ask 编译最小投影。

### 复用现有链路

- `TodayPilotMeetingPrepService` / `TodayPilotMeetingPrepRepository`：会议前 prep 与 event identity。
- `MeetingOutcomeBinderService` / `MeetingOutcomeBinderRepository`：单场 outcome 和 Ask 证据。
- `DayPilotService`：只在排序前读取 delta receipt，不在这里生成 baseline。
- `/ask`：通过只读 projection 获取 series delta，禁止 Ask 写 series / carryover。
- Proactive Scheduler：只做增量重算调度；默认不发新的主动通知。

### API 草案

```text
GET  /api/v1/routine-series/:seriesId/brief?occurrenceId=...
GET  /api/v1/routine-series/:seriesId/occurrences?limit=...
GET  /api/v1/routine-series/:seriesId/baselines
POST /api/v1/routine-series/:seriesId/corrections/split
POST /api/v1/routine-series/:seriesId/carryovers/:id/resolve
```

- 三个 GET 是只读导航。
- 两个 POST 只改 Personal AI 内部状态，响应必须返回 affected occurrences、recompute status 和 `externalWrite=false`。
- P0 不提供 delete raw occurrence 接口。

## 实施计划

### Phase 0：离线审计与影子模式（2–3 天）

- 对脱敏后的线上 Calendar / Meeting Binder 数据抽样建立 series truth set。
- 先只做 deterministic external ID 链接，统计 coverage、false merge 和每系列 occurrence 分布。
- 输出 baseline / delta 到 debug artifact，不进入 UI / Ask。
- 检查 secret redaction、跨 scope 泄漏和 origin-family 计权。

退出条件：confirmed series 零误合并；任何 identity 不确定样本都停在 candidate。

### Phase 1：P0 数据层与 Today Pilot 投影（4–6 天）

- migration：series、membership、baseline versions、occurrence deltas、corrections。
- 实现结构化字段 diff、baseline versioning、stale / recomputing 状态。
- Calendar recurrence + Today Pilot meeting prep 接入。
- 卡片集成 changed / quiet / uncertain / source gap 状态。
- correction scope、回执、keyboard / screen reader 语义。

退出条件：无变化 recurring invite 不再进入高优先内容；关键变化可回跳 before / after。

### Phase 2：Meeting Outcome Binder + 语义差分（4–5 天）

- binder 跨 occurrence 对齐 decision / risk / owner / deadline。
- evidence-bound semantic diff 和 carryover resolve。
- Meeting Pilot 侧栏投影与会中 provisional / 会后 fixed 状态。
- 用户拆分后异步重算、旧 delta stale 标记和失败恢复。

退出条件：每条语义变化都有双边证据；缺 transcript 时不声称“无变化”。

### Phase 3：Ask 与反馈闭环（3–4 天）

- series intent detection：最近几次、与上次、一直没收口。
- Ask receipt、被排除 occurrence、source gap 说明。
- 内部 correction telemetry：false merge、false delta、quiet override。
- 不把查看 / 展开行为直接当成用户赞同或新记忆真值。

### Phase 4：周期 agent run（后续独立决策）

只有 Calendar / Meeting P0 通过 eval 后才考虑：对有稳定 schedule ID 的 agent run 比较输入范围、工具结果、产物与异常。不要把这一阶段混入 MVP。

## Evals：需要，而且是上线门槛

这是召回、派生记忆和注意力排序的共同变更，仅靠单元测试不够。功能实现时必须创建 `routine-delta-memory` eval suite 并跑 report；达不到门槛就继续调整，直到所有 required tests 通过。不能只在 plan 阶段写合成样例后宣称有效。

### 需要新增

- `evals/cases/routine-delta-memory/cases.jsonl`
- `evals/workflows/routine-delta-memory/experience.md`
- `evals/registry.yaml` 中的 suite、中文 description、`readerProof.claims`、`readerProof.boundaries`
- 必要时增加 deterministic runner / adapter，统一输出 Reader Contract，不单独造一套 HTML report。

### 真实场景来源

优先使用 `10.32.56.212` 中 `esone.qiu` 的 recurring Calendar / Meeting 数据做**脱敏 snapshot**：保留 series identity、cadence、字段变化和来源关系，移除会议链接、密码、私聊正文和不必要的人名。若要跑 live，只允许只读接口，run artifacts 保持 git ignored。

### 最少测试集

| Case | 必须证明 |
|---|---|
| 30 次相同邀请、无业务变化 | `quiet`；不进入高优先，不生成伪变化 |
| 单次改期 / 取消 | 结构化 critical delta；仍属于正确 series |
| owner / deadline / decision 明确变化 | 100% 召回，并有 before / after 双边证据 |
| 本次没提旧议题 | 输出 `unknown`，不得判 removed / resolved |
| 同标题、不同 organizer | 不合并；停在 separate / candidate |
| 缺上次 transcript | 标 source gap，只比较 Calendar 字段 |
| 用户拆分错误系列 | raw occurrence 不变；旧 delta stale；重算后不串线 |
| recurring invite 含 join secret | baseline / delta / report 不出现 secret |
| Ask 查询最近三次变化 | occurrence 范围正确、每条 claim 有 lineage、不重复计权 |
| 与 Echo Dampener 联合 | delta + 两侧原文不能被算成三份独立证据 |

### 量化门槛

- confirmed series false merge：`0`；关键 identity precision：`100%`。
- critical delta recall：`100%`；critical factual precision：`100%`。
- quiet 样例 false alert：`<= 5%`，且不进入 Today Pilot high priority。
- 所有 surfaced delta 的 before / after source coverage：`100%`。
- secret leakage / cross-user leakage：`0`。
- 与“最近 3 次原文全量送入”相比，消费者默认上下文 token 中位数下降 `>= 60%`，同时关键变化 recall 不回退。
- correction 后 stale / recompute / recovery receipt：`100%` 符合契约。

### 实现后的命令与报告

```bash
npm run eval:validate
npm run eval:run -- --suite routine-delta-memory --no-repair
npm run eval:run -- --suite today-pilot --no-repair
npm run eval:run -- --suite meeting-outcome-binder --no-repair
memory-service/node_modules/.bin/tsx tools/eval-memory-abilities.ts \
  --endpoint http://10.32.56.212:3210/api/v1/ask --user esone.qiu
npm run eval:report
```

最后一个 live benchmark 只有在目标服务已经部署本实现且用户确认允许时运行；否则使用本地服务与脱敏 snapshot，不把旧线上结果冒充新实现证明。

Report 必须第一屏说清：证明了什么、没证明什么、用了 snapshot 还是 live、覆盖多少 series / occurrences、false merge / missed critical delta / secret leakage 的结果，以及失败样例下一步。所有 required case 全绿之前不得标记完成。

## 风险与保护

| 风险 | 用户后果 | 保护 |
|---|---|---|
| 同名会议误合并 | 把 A 项目的变化带进 B 项目 | external series ID 优先；模糊匹配只 candidate；confirmed false merge 门槛为 0 |
| “没提到”被当成“已删除” | 错报风险消失 / action 已完成 | `unknown` 独立状态；resolved 必须有 closing evidence |
| baseline 固化过时 | 系统把新常态当异常或忽略真变化 | versioned baseline、30 天 stale、变化率触发重学 |
| 模型制造差分 | 用户会前被错误提示 | 结构化先行；语义 diff 必须双边 source span；低置信不 surface |
| 重复证据膨胀 | Ask 误以为多个来源一致 | origin-family 去重，delta 不成为独立票数 |
| secret 进入基线 | 长期泄漏会议凭证 | 派生前 redaction；eval 扫描；secret 字段永不入 baseline |
| 卡片过多 | “降噪功能”反而制造新噪音 | quiet 默认静默；notable 最多 3 条；不新增通知 |
| 修正不可恢复 | 用户担心一点就改坏历史 | correction 只改 membership，baseline/delta 可重算，raw 不变 |

## 可观测性与回滚

### 需要记录的内部指标

- series confirmed / candidate / split 数量；
- 每 series occurrence 数、baseline version 数；
- changed / quiet / uncertain / source gap 分布；
- surfaced delta 类型、证据覆盖、用户展开 / correction；
- false merge correction rate、false alert rate、critical miss review；
- consumer token before / after；
- recompute latency、失败数、stale delta backlog。

查看行为只用于产品质量统计，不自动晋升为“用户认同该事实”。

### Feature flag 与回滚

- `routineDeltaMemory.capture`：只建 series / shadow delta；
- `routineDeltaMemory.todayPilotProjection`：控制 Today Pilot 展示；
- `routineDeltaMemory.meetingPilotProjection`：控制会中展示；
- `routineDeltaMemory.askProjection`：控制 Ask 消费。

回滚顺序：先关闭消费者投影，再停止增量生成；保留 raw occurrence 和审计数据。必要时可删除派生表并从 raw sources 重建，但任何回滚都不删除 Calendar、meeting、message 原始记忆。

## 成功标准

### 用户体验成功

- 用户进入高频会议前，3 秒内能说出“今天与平常最不同的 1–3 件事”。
- 无变化时不再被重复 invitation / boilerplate 占据 high-priority 位置。
- 用户能在两步内从差分回到原始 occurrence，理解它为何出现。
- 用户修正系列错误后清楚知道“改了 Personal AI 什么、没改外部什么、何时重算完成”。

### 系统成功

- confirmed series zero false merge；
- critical delta 无漏报、无无来源断言；
- 默认 context token 中位数下降至少 60%；
- 不新增 secret / cross-user / duplicate-evidence 回归；
- Today Pilot、Meeting Pilot、Ask 使用同一数据契约而不是三份独立总结逻辑。

## 完成实现后的正式文档维护

功能真正实现并通过 eval 后，必须把关键点和关键逻辑精简维护进正式文档，而不是让本 progressing plan 成为唯一真相：

1. 在 [`docs/features/today_pilot.md`](../features/today_pilot.md) 记录 changed / quiet / uncertain 的消费与排序边界；
2. 在 [`docs/features/meeting_pilot.md`](../features/meeting_pilot.md) 记录会中 provisional、会后 fixed、原始 occurrence 回跳；
3. 在 [`docs/features/ask.md`](../features/ask.md) 记录 series query、lineage 和只读边界；
4. 若数据原语足够独立，在 [`docs/features/`](../features/) 新建精简的 `routine_delta_memory.md`，否则并入现有三份文档，避免为了文档数量拆得过碎；
5. 如 desktop app 出现独立 renderer 契约，再同步维护 [`desktop-app/docs/features/`](/Users/Esone/git/personal-ai/desktop-app/docs/features/)；
6. 更新 [`docs/index.md`](../index.md) 的能力归属，并让实现代码、API、eval suite 和文档名称一致。

## 推荐决策

推荐进入 **P0 影子模式**，但暂不批准 P1 周期 agent run。理由是：线上 recurring Calendar 已证明问题密度足够高，且 P0 可以在不新建大页面、不执行外部写回、不删除原始记忆的前提下验证；真正风险集中在 series false merge 与语义伪差分，恰好可以先通过 deterministic identity、shadow 输出和真实脱敏 eval 把门槛做硬。

如果只批准一个最小切片，建议是：

> 只支持 Calendar 原生 recurrence ID + Today Pilot changed / quiet receipt；不做模糊系列合并，不做主动通知，不做 agent run。先证明第 30 次日会能安静隐藏基线，又不会错过改期、取消、owner、deadline 和 decision 变化。

