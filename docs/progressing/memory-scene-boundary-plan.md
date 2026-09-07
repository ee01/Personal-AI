# 新能力：Memory Scene Boundary / 记忆分镜

> 生成时间：2026-09-07 CST
>
> 状态：仅规划，等待用户决策；本轮不实现运行时代码
>
> Demo：[`memory-scene-boundary-demo.html`](./memory-scene-boundary-demo.html)
>
> Idea 来源：Reminders 的 `Personal AI` 当前显示 0 个未完成提醒，因此本方案来自现有能力去重、线上只读聚合证据与外部研究；本轮不修改 Reminder。

## 结论

我建议 Personal AI 增加 **记忆分镜**：先把已经采集的消息、Jira、会议、网页和 AI 对话，持续切成可解释、可撤回的“事件段”，召回时先判断用户说的是哪一件事，再只从该事件段取证据。

它解决的不是“记忆存得不够多”，而是一个更基础的问题：**同一个群聊、同一天、甚至同一批关键词里，可能已经发生了两三件不同的事；而同一件事也可能横跨群聊、Jira、会议和网页。** 如果没有事件边界，向量相似度越强，越可能把“词很像、其实不是同一件事”的历史一起塞给 AI。

一句话产品承诺：**Personal AI 不只记得内容，还知道哪几条记忆属于同一幕。**

第一版不增加独立管理页面，不录屏、不监听键盘、不要求用户整理记忆。它先作为后台记忆原语运行，只在 Memory Lens / Ask 的结果确实受到边界影响时，给出一条低打扰回执：

> 这次估算 · 09:12–09:41 · 5 条证据 / 4 个来源

用户可以点开“为什么是一段”，也可以一键“与上一段合并”或“从这里拆开”；修正只改变派生分镜，原始记忆不改，并立即提供撤销。

## 先看两个真实使用场景

以下场景是基于线上 `esone.qiu` 记忆的来源分布、跨来源密度和项目中的真实工作形态做的**脱敏组合**，不是线上消息逐字引用，也不代表当前 Jira 或群聊事实。

### 场景一：同一个群聊，一小时里其实有两件事

用户上午在一个长期项目群里处理 Jira 估算：先讨论口径、贴工单链接、确认谁补数据。二十分钟后，同一群开始聊 AI 工具许可。两个话题都有“上线”“owner”“下周”“确认”这些相似词。

没有记忆分镜时：

1. 用户下午回到 Jira 评论框，问 Personal AI：“上次最后确认的口径是什么？”
2. 召回先命中这个群的长期 context frame；它已经横跨多周并累积很多 topic。
3. AI 可能把后一个许可话题里的 owner / 下周安排混进估算回答；即使最终答案没错，用户也难以判断证据为什么出现。

有记忆分镜后：

1. Personal AI 从当前 Jira key、字段名和评论框 scene 锁定 `估算校准` 事件段。
2. Memory Lens 在评论框上方显示：`估算校准 · 09:12–09:41 · 5 条证据`。
3. 用户点开可看到一条明确边界：`09:43 话题切换：未再引用该工单，开始讨论 AI 工具许可`。
4. 生成提示只使用事件段里的 Jira、群聊和相关页面证据；后一个话题被隔离。
5. 如果切错，用户点“边界不对 → 与上一段合并”，页面立刻显示“已调整，只影响 Personal AI 的未来召回”，并可撤销。

### 场景二：换了三个工具，仍是同一件事

用户先在 Jira 看一张工单，随后参加评审会议，最后在群聊补充结论。工具切换了三次，但工单 key、会议标题、参会人和引用链接表明它们属于同一个事件。

没有记忆分镜时：

1. 每个来源各自形成检索片段。
2. 用户问“评审之后还差什么”，相似度可能只取到会议摘要，漏掉会后群聊补充；也可能把另一张同项目工单带进来。

有记忆分镜后：

1. 来源切换本身**不会**触发切段；确切 Jira key、会议引用与短时间连续性会把三段证据归到同一幕。
2. Ask 先返回事件级结论，再按 `Jira → 会议 → 群聊` 展示原始证据顺序。
3. 用户看到的不是“3 个来源都很像”，而是“这是同一件事的三个阶段”；任何证据仍可回到原始来源复核。

## 为什么现在值得做

### 线上只读证据：当前容器很长，跨来源很密

2026-09-07 对 `10.32.56.212` 上 `esone.qiu` SQLite 做了只读聚合检查，未读取或写出凭据，也未把原始私聊正文放入本文：

- `messages_raw` 共 14,610 条；主要来源包括 Glip 11,775、Calendar 822、Jira 339、Meeting 313、Web 285。
- 最近 180 天共有 334 个小时桶同时出现至少 2 类来源，76 个小时桶出现至少 3 类来源，单小时最多 6 类来源。
- 现有 316 个 `conversation_context_frames` 平均跨度 16.3 天，最长 111.4 天；110 个至少跨 7 天，68 个至少跨 30 天。
- 197 个 Glip frame 平均跨度 23.7 天，平均约 9.7 个 topic。
- 当前实现的 frame key 主要由 `sourceType + group/conversation` 构成；新消息会继续向同一 frame 追加 topic、project、role、anchor，并扩展时间窗。

这些数据不能证明某次召回已经出错，也不能证明同一小时的多来源必然属于同一事件；它们能证明一个结构机会：**会话容器不是事件，时间相近也不是事件。** Personal AI 已有足够多真实、密集、跨来源的记忆，值得在“召回前”增加一层事件定位。

### 用户需求

- 回忆“那一次”时，不再先得到一个横跨数周的群聊大包。
- 同项目、同人名、同类工单之间不互相污染。
- 一件事跨工具推进时，不因来源切换而丢失连续性。
- AI 能解释为什么这些证据属于一起，边界不对时可轻松修复。
- 用户不需要维护新 inbox，也不需要每天确认系统分段。

### 亮点

1. **先定位事件，再取证据**：把检索单元从“相似片段”提升为“有边界的经历”。
2. **会拆也会连**：能把同群聊的不同任务拆开，也能把跨来源的同一任务连起来。
3. **默认安静、受影响才解释**：不是新 dashboard；只有边界改变召回结果时才显示 receipt。
4. **可撤回但不打断**：系统自主形成 provisional boundary；用户修正派生关系即可，不改原文。
5. **隐私成本低**：只处理已经被 Personal AI 合法采集的证据，不新增全屏截图、键盘或麦克风采集。

## 与现有能力和搁置方案的边界

| 已有能力 / 方案 | 它解决什么 | 记忆分镜新增什么 | 明确不做 |
|---|---|---|---|
| `conversation_context_frames` | 按群聊、会议或 Jira 容器扩展上下文 | 在容器内部发现多次独立事件，也把跨容器证据连成同一事件 | 不删除或替代 frame；先并行 shadow |
| [Memory Lens Scene Context Contract](./memory-lens-scene-context-contract-plan.md) | 描述用户**此刻**在读、写、评论还是开会 | 描述历史证据**当时属于哪一段** | 不重复 DOM / active element / visible facts 采集 |
| [Evidence Cohesion Gate](../features/evidence_cohesion_gate.md) | query-time 按 subject、identifier、claim slot 排除混证 | ingestion / consolidation 时持续形成可复用事件边界，先缩小候选事件 | 不取消 Gate；它仍是事件内最后一道事实隔离 |
| [Operation Memory Flight Recorder](./operation-memory-flight-recorder-plan.md) | 用户授权后记录“怎样把事做成”的操作步骤，可回放、可沉淀 skill | 对所有已采集记忆做低成本事件分段，不要求录操作链 | 不录屏、不重建鼠标/命令步骤、不生成 skill |
| [AI Context Passport](./ai-context-passport-plan.md) | 把当前任务打包给另一个 AI；后期拼接跨 AI 工作片段 | 为所有来源提供通用的底层事件边界，既能合并也能拆分 | 不做跨 AI 投递、prompt 注入或 handoff UI |
| [Working Memory Return Stack](./working-memory-return-stack-plan.md) | 保存暂停点、下一步和最小继续上下文 | 只根据已发生证据划定历史事件 | 不推断下一步或用户未表达的意图 |
| [Research Trail Synthesizer](./research-trail-synthesizer-plan.md) | 把多网页研究过程归成研究轨迹 | 通用于群聊、Jira、会议、网页、AI 对话；研究轨迹可消费它 | 不生成研究摘要、引用报告或阅读清单 |
| [Routine Delta Memory](./routine-delta-memory-plan.md) | 比较周期性会议/流程的 baseline 与 delta | 区分单次经历的起止与成员证据 | 不学习 recurring series，也不判断“这次有何变化” |
| Memory Claim Attribution / 来源归属 | 判断某句话是谁说的、是否确认、何时成立 | 判断多条证据是否属于同一次事件 | 不改变 claim owner、truth 或时间口径 |

语义去重结论：相邻方案各自覆盖“当前场景、query-time 证据过滤、主动操作记录、跨 AI 交接、任务恢复、研究轨迹、周期差分”。没有一个把**通用、可解释、可纠正的事件边界**作为 memory-side 一等对象。

## 业内产品和研究启发

### 产品基线

| 产品 | 已有形态 | 借鉴 | Personal AI 的差异 |
|---|---|---|---|
| [Microsoft Recall](https://support.microsoft.com/en-us/windows/ai/ai-features/retrace-your-steps-with-recall) | 本地加密快照、语义搜索、按时间片浏览和恢复 | 时间线、来源过滤、可回到原位置、敏感应用排除 | 不持续截屏；目标是理解同一时间段里的语义事件边界 |
| [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 与 [Release Notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) | saved memory、聊天历史引用、memory sources、跨 chat/project/file 搜索 | 记忆来源可见、用户可控制、跨对象找回已经成为基线 | 不只跨对象搜索，而是先确定“哪一次经历”再召回 |
| Personal AI 现有 Memory Lens / Ask | 页面现场提示和自然语言问答 | 复用低打扰入口、来源链接、feedback 与 quiet policy | 不新增目的地，把事件边界作为这些入口共同消费的原语 |

### 论文与专家材料

- [EM-LLM（ICLR 2025）](https://em-llm.github.io/) 用 surprise 做初始分段、图方法细化边界，再进行两阶段检索。启发：边界检测必须和“事件级 → 事件内”召回一起设计。
- [CompassMem（ACL Findings 2026）](https://aclanthology.org/2026.findings-acl.1123/) 增量切分经验并构建显式 Event Graph。启发：事件不应只是 UI 分组，而应是可导航、可关联的记忆单元。
- [ES-Mem（2026）](https://arxiv.org/abs/2601.07582) 结合动态事件切分和分层记忆，用 boundary semantics 做 episodic localization。启发：先定位 episode，再精确取证。
- [ARTEM（AAAI 2026）](https://ojs.aaai.org/index.php/AAAI/article/view/39773) 联合时间、实体与语义组织事件，并覆盖 partial cue 和 uncertainty。启发：不能只靠文本相似度或固定时间间隔。
- [Memory Storyboard（CoLLAs 2026）](https://proceedings.mlr.press/v330/yang26a.html) 先在短期 buffer 形成 temporal segments，再转入长期记忆。启发：采用“在线 provisional → 睡眠期巩固”，不要当场永久定案。
- [Event boundaries: Costs and benefits for memory（Cognition 2025）](https://www.sciencedirect.com/science/article/pii/S0010027725001799) 表明事件边界也有认知成本。启发：tab change、来源切换或短暂停顿不能单独切段，必须有迟滞和最小段保护。
- [Switching task sets creates event boundaries（Cognition 2022）](https://www.sciencedirect.com/science/article/pii/S0010027721004157) 显示内在任务切换本身可以形成记忆边界。启发：业务锚点变化比页面 URL 变化更重要。
- [How Memory Management Impacts LLM Agents（ACL 2026）](https://aclanthology.org/2026.acl-long.27/) 讨论相似经验诱发的 experience-following、错误传播和 misaligned replay。启发：高相似不代表可复用，应先过事件边界 gate。
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context 是有限注意力预算，应保留最小高信号集合。事件内召回比整个长期群聊 frame 更接近这个原则。

## 产品原则

1. **原始证据不可变**：分镜是派生索引；分错不能改写消息、会议、Jira 或网页原文。
2. **硬 scope 先于相似度**：用户、组织、private/work、敏感来源的边界永远不能被事件模型跨越。
3. **强事实先于模型猜测**：确切 issue key、meeting id、thread reply、canonical URL、artifact id 优先；LLM 仅用于离线处理难例。
4. **来源切换不是边界，时间相近也不是归并证明**。
5. **默认自主、异常可解释**：高置信分镜自动工作；只有影响用户看到的内容或用户主动检查时显示 receipt。
6. **不确定就降级**：无法区分时保留两个 provisional 候选，Ask 可请用户澄清，Memory Lens 保持安静；绝不把两件事强行揉成确定答案。
7. **修正学习边界，不学习隐含人格**：用户的合并/拆分只校准 event policy，不变成 profile claim 或对外承诺。

## 事件模型：系统到底在切什么

### 核心对象

```ts
type EpisodeStatus = 'open' | 'provisional' | 'sealed' | 'superseded';

interface MemoryEpisode {
  id: string;
  userId: string;
  scopeKey: string;
  status: EpisodeStatus;
  startedAt: number;
  endedAt?: number;
  primaryAnchors: Array<{
    kind: 'issue' | 'meeting' | 'thread' | 'artifact' | 'url' | 'person' | 'topic';
    valueHash: string;
    displayLabel?: string;
    confidence: number;
  }>;
  sourceTypes: string[];
  memberCount: number;
  boundaryConfidence: number;
  summary?: string; // sealed 后按证据生成；不是 source of truth
  version: number;
}

interface MemoryEpisodeMember {
  episodeId: string;
  evidenceId: string;
  evidenceType: 'message' | 'meeting' | 'jira' | 'web' | 'ai_conversation' | 'source_memory';
  relation: 'core' | 'supporting' | 'mentioned' | 'excluded';
  confidence: number;
  reasonCodes: string[];
  observedAt: number;
}

interface EpisodeBoundary {
  beforeEpisodeId: string;
  afterEpisodeId: string;
  at: number;
  confidence: number;
  reasonCodes: Array<
    | 'anchor_changed'
    | 'semantic_surprise'
    | 'time_gap'
    | 'participant_shift'
    | 'explicit_topic_reset'
    | 'scope_boundary'
  >;
  evidenceRefs: string[];
  decidedBy: 'deterministic' | 'embedding' | 'offline_model' | 'user_patch';
}

interface EpisodeBoundaryPatch {
  id: string;
  userId: string;
  action: 'merge' | 'split' | 'move_member' | 'undo';
  targetEpisodeIds: string[];
  sourceEvidenceId?: string;
  previousVersion: number;
  createdAt: number;
  reversibleUntil?: number;
}
```

### 事件关系

事件之间只建立可证实的关系：

- `continues`：同一明确对象在短窗口内继续。
- `resumes`：较长时间后重新处理同一对象；保留两段，不把几周历史合成一段。
- `references`：新事件引用旧事件。
- `evidence_for`：某段为另一个已存在事件提供补充证据。
- `supersedes`：用户 patch 或离线巩固替代旧分镜版本。

不自动写 `caused_by`、`decided`、`user_intended` 等高推断关系；这些仍由 decision、claim 和 evidence 系统负责。

## 边界检测设计

### 在线阶段：低延迟 provisional boundary

每条已通过当前 ingestion / privacy policy 的记忆进入时：

1. 生成稳定锚点：exact Jira key、meeting id、thread/message reply、canonical URL、文件/产物 id、人物与标准化 topic。
2. 只在同一 `scopeKey` 内找最近的少量 open/provisional episode。
3. 计算两个互补分数：
   - `membershipScore`：这条证据属于候选事件的把握。
   - `boundaryScore`：它开启新事件的把握。
4. 强 continuation 信号可跨来源合并；强 anchor discontinuity + 语义突变可在同一群聊内切段。
5. 弱信号不立即永久切段：先进入 provisional buffer，等待后续 2–3 条证据或短暂静默确认。

初始特征建议：

| 特征 | 作用 | 约束 |
|---|---|---|
| exact object continuity | Jira key、meeting id、artifact id、reply chain 相同则强归并 | 同名 topic 不能等价替代 exact id |
| anchor discontinuity | 明确对象从 A 切到 B 时提高切段分 | 只有人名变化不够 |
| semantic surprise | 与事件最近高信号表示差异明显时提高切段分 | 使用时间窗校准，不能单独定案 |
| time gap | 长静默提高切段分 | 不能阻断次日继续同一明确工单 |
| source transition | 帮助解释跨工具路径 | 来源切换单独权重接近 0 |
| participant / role shift | 辅助会议、群聊边界 | 不能跨 privacy scope 合并 |
| explicit reset cue | “换个问题”“接下来讨论”等提高切段分 | 需保留原句证据引用 |

第一版不把权重写死为产品真理。用确定性 hard gate + 可配置阈值开始，再由 eval 标注集校准。建议提供两个阈值和迟滞：`open_threshold`、`seal_threshold`，并设最小成员数/最小时长保护，避免每条消息都变成一幕。

### 睡眠期阶段：巩固、迟到证据和修复

定时 consolidation 只处理新近 provisional episode：

1. 用双向上下文检查边界两侧，避免只看前文造成误切。
2. 允许 `merge`、`split`、`move_member`，产生新 version，不原地销毁审计历史。
3. 给跨天再次处理同一对象建立 `resumes`，不无限延长原 episode。
4. 来源删除、scope 改变或 claim 纠错后重新计算受影响 episode；其他 episode 不全库重算。
5. 只有 sealed episode 才生成短标题/摘要；摘要永远引用 member evidence，不能反过来决定原始事实。

### 召回阶段：Episode Gate

```text
InteractionScene / Ask query
  -> 提取当前强锚点与 scope
  -> 召回 top episode candidates
  -> 计算 episode-level relevance + freshness + ambiguity
  -> 只在选中 episode 内运行 vector / FTS / graph PPR
  -> Evidence Cohesion Gate 做 claim/subject/identifier 最终隔离
  -> Memory Lens / Ask / Compose Assist
```

降级策略：

- 没有 episode 数据：继续使用现有 recall，不阻断请求。
- 只有低置信 episode：Memory Lens 静默；Ask 返回两个明确候选让用户选，不生成混合答案。
- episode 命中但段内证据不足：显示“找到这次事件，但证据不足”，不从邻近 episode 借事实补齐。
- episode service 超时：跳过 gate，并在 debug receipt 标注 `episode_gate_timeout`；不能把 fallback 宣称为分镜成功。

## UX 设计

### P0/P1 不新增全局页面

最小入口嵌入现有 Memory Lens、Ask 和 Compose Assist：

- 收起态：`这次估算 · 5 条证据`。
- hover / focus：`09:12–09:41 · 群聊 / Jira / 网页 / 会议 · 只读提示，不会写入输入框或发送`。
- 展开态：按时间排列事件内证据，显示一条分界线和“为什么从这里分开”。
- 低置信态：`可能是两个话题`；不显示确定标题，不自动把内容用于生成。
- 修正入口：`边界不对` → `与上一段合并` / `从这里拆开` / `这条移到另一段`。
- 操作回执：`已调整 Personal AI 的分镜；原始消息未修改 · 撤销`。

### 只有边界影响结果时才增加视觉负担

如果候选证据本来就都在同一 episode，正常显示现有 Lens / Ask，用户无需知道后台分段。以下情形才展示分镜 receipt：

- 排除了一个高相似但属于相邻事件的候选。
- 把两个来源的证据归并为同一事件。
- 用户请求“这次 / 上次 / 刚才 / 之后”等 episodic query。
- 置信度不足，需要用户区分两个候选。

### Demo 的三个可切换状态

[`memory-scene-boundary-demo.html`](./memory-scene-boundary-demo.html) 模拟长期 RingCentral 群聊里的 Memory Lens：

1. `正确切开`：同群聊两个话题被分开，段内证据跨 Jira / 群聊 / 网页。
2. `暂不切`：只有来源切换和短暂停顿，没有足够边界，系统保持 provisional 且不强提示。
3. `切错可恢复`：用户合并两段，看到不改原文、只影响后续召回的 undo receipt。

Demo 数据是脱敏组合数据，不发网络请求、不修改记忆、不写输入框、不发送消息。

## Source、scope、freshness、authority 与恢复边界

### Source

- 每个 episode member 保留 `evidenceId`、source type、原始时间和可打开的安全来源。
- UI 不能只显示“AI 判断”；“为什么归在一起 / 为什么分开”必须列出确定性信号和少量 evidence refs。
- 标题和摘要是派生内容，必须明确标成“Personal AI 整理”，不能伪装成原始消息。

### Scope 与隐私

- `scopeKey` 是硬隔离：不同用户、workspace、private/work、incognito、blocked site 不跨边界合并。
- 私聊证据可以参与用户自己的本地 episode，但不能因群聊现场相关就对外显示正文；沿用 Common Ground / source policy 做 audience gate。
- 敏感 URL 先 canonicalize 并移除 token、OAuth code、session、meeting join 参数；无法安全展示时只保留不可逆 hash。
- 被 policy 排除的页面、临时密码、OTP、支付与 login 内容不进入分镜。
- 本能力不新增截图、音频、键盘、剪贴板或后台浏览采集权限。

### Freshness

- `open`：当前仍可能追加证据。
- `provisional`：检测到候选边界但仍允许短窗口纠正。
- `sealed`：经迟滞或睡眠期巩固后稳定，可生成标题并用于默认 episode gate。
- `resumes`：同一明确对象在较长间隔后继续，保留新旧两段和关系，避免一条 episode 无限长大。
- 当前场景优先使用最新 compatible episode；历史 episode 只在 query 明确指向“上次 / 之前”时提升。

### Authority / writeback

- 自动分段只写 Personal AI 内部派生索引，不代表用户做了决定，也不修改外部系统。
- 展开 Lens、打开来源、切换候选是只读动作；不会写输入框、发送消息、更新 Jira 或同步 AI。
- 用户 `merge/split/move` 是可逆的内部结构修正；立即应用并提供 undo，不需要高打扰确认框。
- 删除原始记忆时，membership 跟随 cascade；episode 为空则归档，不能保留无来源摘要。

### 恢复与审计

- patch 采用 append-only version，保留 `previousVersion` 和 reason，不直接覆盖旧结构。
- UI 的撤销窗口结束后仍可在 episode detail 里恢复上一版本；P0 可先只提供最近一次撤销。
- shadow 期发生问题时关闭 feature flag 即回到现有 recall；原始表未改，回滚不丢数据。
- rebuild 必须可按时间窗、source 或 episode id 重跑，不能要求全库销毁重建。

## 实现形态

### 存储

建议新增：

- `memory_episodes`
- `memory_episode_members`
- `memory_episode_boundaries`
- `memory_episode_edges`
- `memory_episode_boundary_patches`
- `memory_episode_runs`（算法版本、输入范围、耗时、失败原因）

索引重点：`(user_id, scope_key, status, ended_at)`、`evidence_id` 唯一成员查询、exact anchor hash、episode edge。所有表都带 user scope 和 schema / algorithm version。

### 服务

- `EpisodeBoundaryService`：在线候选、迟滞、强规则。
- `EpisodeConsolidationService`：离线 merge/split、迟到证据、版本化。
- `EpisodeRecallGate`：query → episode → member evidence。
- `EpisodeReceiptBuilder`：用户可读的归并/切分原因与 no-effect contract。
- `EpisodePatchService`：用户修正、undo、局部重建。

优先复用：

- `RecallContextExpansionService` 的 frame 与 source anchors。
- `SceneFrameService` / Interaction Scene Contract 的当前场景锚点。
- `Evidence Cohesion Gate` 的 hard identifier、scope 与排除 receipt。
- `GraphPpr` 的关系传播，但先在 episode candidate 内运行。
- 现有 Memory Lens feedback endpoint 与 source-link safety helper。

### API 草案

```text
POST /api/v1/context-recall
  response.metadata.episode = {
    id, title, status, confidence, timeRange,
    sourceTypes, memberCount, reasonCodes,
    excludedAdjacentCount, ambiguousCandidates
  }

GET  /api/v1/memory-episodes/:id
GET  /api/v1/memory-episodes/:id/evidence
POST /api/v1/memory-episodes/:id/patch
POST /api/v1/memory-episodes/patches/:patchId/undo
```

P0 不需要列表页 API；detail endpoint 只服务 Lens / Ask 展开与诊断。返回来源前继续执行现有 safe URL 和 scope policy。

### 可观测性

只记录派生质量和系统行为，不记录额外正文：

- `episode_boundary_created / merged / split / superseded`
- `episode_gate_applied / abstained / fallback`
- `adjacent_candidate_excluded`
- `user_patch_applied / undone`
- 算法版本、confidence bucket、source count、延迟、failure reason

不能把“用户没点开”自动解释为边界正确；这是 Outcome Loop 也应保持的因果边界。

## 分阶段实施

### Phase 0：离线基线与标注协议

1. 从线上库只读抽样多来源活跃小时和长 span frame，生成脱敏 fixture；不把原始正文提交到仓库。
2. 人工标注 `same episode / new episode / ambiguous`，同时标记 exact anchor、privacy scope 和边界理由。
3. 用当前 `conversation_context_frames` + recall 作为 baseline，先证明“事件边界”可测，不接生产请求。
4. 确定命名：用户侧统一叫“这次 / 上一段 / 分镜”，工程侧用 `episode`。

### Phase 1：Shadow episode

1. 加表、服务和增量 worker；只生成 provisional / sealed episode，不影响召回。
2. 运行至少 14 天，观察事件长度、单条 episode、无限增长、过度合并、跨 scope 尝试与计算成本。
3. 提供仅开发诊断的 episode receipt，不上线日常 UI。
4. 修复离线/线上差异，达到 eval 门槛后才能进入 Phase 2。

### Phase 2：Ask / Memory Lens 小流量 Episode Gate

1. 先对带 exact Jira key、meeting id、thread reply 的高置信 query 启用。
2. `episode_gate` 只缩小候选，不改变 raw ranking 分数含义；Evidence Cohesion Gate 继续运行。
3. Memory Lens 只在排除邻近高相似候选时显示分镜 receipt。
4. 加用户 merge/split/undo；patch 进入下一轮巩固训练/阈值分析。

### Phase 3：跨来源巩固与更多消费面

1. 扩展到 AI conversation、web source memory、meeting follow-up。
2. 为 Context Passport、Research Trail、Decision Episode 提供稳定 episode ids，但不把它们的产品职责搬进本服务。
3. 支持 `resumes/references/evidence_for` edge 和按影响范围局部重建。
4. 达到长期 drift gate 后再考虑 Memory Exploring 的 episode detail；仍不默认增加新导航项。

### Rollout / rollback

- flags：`EPISODE_SHADOW_ENABLED`、`EPISODE_RECALL_GATE_ENABLED`、`EPISODE_RECEIPT_ENABLED`、`EPISODE_PATCH_ENABLED`。
- 可按 user / source / exact-anchor query 分批开启。
- 关闭 gate 即恢复旧召回；保留 shadow 数据用于复盘，但不得继续影响答案。
- 任一跨 scope 合并、隐私来源泄露或 memory abilities 回归都属于立即关闭条件。

## Evals 决策：需要，而且是实现门槛

本能力的价值直接依赖分段、召回相关性、不确定性处理和长期漂移，普通单元测试不足以证明用户体验。**实现完成时必须新建 `evals/` suite，跑出一份 report；任何门槛未通过都继续修复和重跑，直到全套测试通过，才允许进入真实消费面。**

### Suite 结构

- suite id：`memory-scene-boundary`
- cases：`evals/cases/memory-scene-boundary/`
- workflow：`evals/workflows/memory-scene-boundary/experience.md`
- registry：在 `evals/registry.yaml` 声明 suite、weekly schedule、`readerProof.claims` 与 `readerProof.boundaries`
- report：保留每个 case 的 algorithm version、预测边界、gold boundary、episode members、gate 结果与 no-effect / privacy receipt

### 真实场景数据

从 `10.32.56.212` 的 `esone.qiu` memory service 只读提取并人工复核以下类型，提交前脱敏：

1. 同一群聊、短时间内两个不同 Jira / 业务话题。
2. 同一 Jira 在群聊、会议和网页间连续推进。
3. 只有 tab/source 切换、实际仍是同一件事。
4. 同项目、同人、相似词，但明确 issue key 不同。
5. 次日继续同一工单，应建 `resumes` 而非无限合并。
6. private/work、敏感网页、删除来源与迟到证据。
7. 用户 patch 后同一 query 的 before / after。

无法公开的正文不进入 fixture；保留结构、时间差、source、匿名 anchor 和人工 gold label。没有足够真实样本时不能用纯合成数据宣称完成。

### 评测层

| 层 | 指标 / 证明 | 建议门槛 |
|---|---|---|
| Boundary | strong boundary precision、recall、pairwise co-membership F1 | precision ≥ 0.92；pairwise F1 ≥ 0.82 |
| Contamination | 被 Episode Gate 排除的跨事件高相似证据比例；答案跨事件污染 | 相对 frame baseline 降低 ≥ 35% |
| Continuity | 同一事件跨来源证据的召回完整率 | 不低于 baseline 超过 3 个百分点 |
| Ambiguity | ambiguous case 是否 abstain / 给候选而非强合并 | 正确降级率 ≥ 0.90 |
| Explainability | reasonCodes 与原始可核对 anchor 是否一致 | hard-anchor case 100% 可解释 |
| Privacy | 跨 scope、blocked/sensitive source、safe URL | 0 越界；全部 hard fail |
| Recovery | merge/split/undo、删除 source、局部 rebuild | 结构和 receipt 全部确定性通过 |
| Performance | 在线 episode gate p95 增量 | 目标 < 40ms；超时可 fallback |

阈值是第一版建议，应在 Phase 0 看过 gold distribution 后冻结，不能为让报告变绿临时降低。

### Judge 策略

- boundary、membership、scope、recovery、latency 使用确定性 judge。
- “episode 标题是否帮助用户区分两次经历”可以增加 LLM judge，但必须展示证据引用，且不替代 hard metrics。
- 每个 reader-facing claim 绑定真实 case id；报告格式完整不等于功能通过。

### 实现后的必跑命令

```bash
npm run eval:validate
npm run eval:run -- --suite memory-scene-boundary --no-repair
npm run eval:memory-abilities
```

`eval:memory-abilities` 必须指向包含本分支代码的本地或已部署 memory service；不能拿旧线上服务的通过结果冒充本分支证明。任何能力相对 baseline 下降超过 0.05 都要解释并修复。

## 风险与缓解

| 风险 | 用户后果 | 缓解 |
|---|---|---|
| 过度切分 | 同一件事证据丢失，AI 只看到半段 | provisional buffer、最小段、exact anchor continuity、跨源完整率 gate |
| 过度合并 | 两件相似任务互相污染 | hard identifier、semantic surprise、Evidence Cohesion Gate、污染率 gate |
| episode 无限增长 | 又变成长 context frame | sealed + `resumes`，限制 open window，睡眠期巩固 |
| 模型生成边界理由 | 用户以为系统有原始证据 | reason code 必须绑定 evidence ref；模型只处理难例 |
| 用户被管理负担打扰 | 又多一个 inbox / dashboard | 默认后台运行，只在结果受影响时显示 receipt |
| 用户纠错失控 | 不知道改了什么或无法恢复 | patch version、即时 undo、原文不变、可局部 rebuild |
| 跨 scope 误合并 | 私密信息在工作现场泄露 | scope hard gate 先于所有分数，0 容忍 eval 和 kill switch |
| 计算成本过高 | ingestion / recall 变慢 | 最近 episode shortlist、锚点索引、离线难例、超时 fallback |
| 与现有方案职责漂移 | 重复建设、接口混乱 | Episode 只回答“属于哪次经历”，其他产品消费稳定 episode id |

## 完成定义

只有同时满足以下条件，才算功能实现完成：

- 真实脱敏场景的 `memory-scene-boundary` suite 全部通过并产出 report。
- Memory abilities 无超过 0.05 的回归。
- 同群聊能拆、跨来源能连、模糊时会 abstain。
- 每个展示中的 episode 都能打开原始证据并说明边界理由。
- scope / privacy / safe URL hard cases 0 失败。
- merge / split / undo 不改原始证据，且能从 receipt 复核影响。
- feature flag 关闭后能无损回到现有 recall。
- 浏览器真实场景验证 Memory Lens / Ask 的 low-disturbance 行为，不把 debug 状态当成用户可见证明。

## 实现后的正式文档移交

本计划获批并完成功能代码后，最后必须把功能关键点和关键逻辑精简维护进正式文档，而不是让 `docs/progressing` 成为长期 source of truth：

1. 新建 `docs/features/memory_scene_boundary.md`，因为这是跨 Ask、Memory Lens、Compose Assist 的 memory-system 原语；文档顶部写清“大白话运行逻辑”、何时切/连/静默、来源与恢复边界。
2. 在 `docs/memory_system.md` 补 episode layer、数据流和与 frame / Cohesion Gate 的顺序。
3. 在 `docs/features/memory_lens.md` 与 `docs/features/ask.md` 只写消费行为、receipt 和 ambiguous fallback，避免复制算法全文。
4. 如果 Desktop App 后续新增 episode detail，再更新 `desktop-app/docs/features/` 中对应的 Memory Exploring 文档；P0 没有桌面新页面就不虚构文档。
5. 同步 `docs/index.md` 的小能力索引与日期。
6. 功能落地并完成文档迁移后，删除本 plan；HTML demo 移入 `docs/demo/`。

## 需要用户决策

建议批准 **Phase 0 + Phase 1（离线基线与 shadow episode）**，先证明“事件边界”能在真实数据上稳定降低跨事件污染，再决定是否进入用户可见的 Memory Lens / Ask。

第一版建议坚持：

- 不新增全局页面。
- 不新增采集权限。
- 不用来源切换直接切段。
- 不让低置信 episode 进入生成上下文。
- 用户纠错只改派生边界，原始记忆永远不动。
