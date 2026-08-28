# Agent Task Ledger（任务账本）— 定时任务迁移与任务系统合并决策

日期：2026-08-27
状态：方案定稿，待排期
配套 demo：[agent-task-ledger-demo.html](agent-task-ledger-demo.html)
前置背景：[定时消息管理 § App Script 自动更新](../features/scheduled_messages_manager.md#11-app-script-自动更新)（GAS 域策略封锁匿名 Web App 的具体行为）→ 方案 B 调度下沉 memory-service

---

## 〇、结论先行

**建议合并，但合并的正确形态不是"把 todo list 塞进定时消息"，而是反过来：让定时任务成为 memory-service 现有任务账本（proposed_actions 队列）的一种触发器。**

这个二选一（"保持简单定时任务" vs "合并 todo 系统"）是伪命题，因为调研证实了一个决定性事实：

> **方案 B 最小化必须做的四件事——schedule 解释、执行账本、幂等、触发——在 memory-service 里全部已有生产级实现**（OutreachEngine 的 scheduleSpec 解释器、proposed_actions 八态队列、双兜底幂等键、node-cron/HeartbeatLoop）。如果为"简单定时任务"另建一张 scheduled_messages 表、另写一套触发循环，那才是在同一个服务里重复建设第二套账本。

所以合并路线的第一步与不合并路线**完全重合、沉没成本为零**；差别只在后续每一步是否在同一账本上复利。

同时，采纳反方（保守派）三条成立的约束，作为**硬边界**写入方案：

1. **人拍板红线原样保留**——本仓库已用文档形式否决过"调度器中枢"方向（agent-memory-control-tower-plan.md 搁置理由："会把产品重心从个人记忆系统推向调度器"）。本方案的措辞是"**人是流程中的一等节点（gate）**"，不是"人被降级为可编排资源"：write 模式审批、注入防御闸门、"AI 备菜、人拍板"全部保留，空闲执行只排干**已批准**的 backlog，永不投机生成任务。
2. **不牺牲 24/7 独立性**——Sheet+GAS+Jira 通道在 memory-service 宕机时完全不受影响，这是结构性优势。迁移采用"真源切换、通道保留"：Jira 公网 GET 会合点、AsMe 免凭据邮件、Drive 附件长期留在 GAS 侧。
3. **UI 不进 ScheduledMessagesManager**——它已 12,874 行（scheduled-messages 前端总面 20,439 行）。账本 UI 作为 memory-exploring 页的新视图独立生长，定时消息管理页只做入口跳转。

---

## 一、Google Sheet 当数据库 vs memory-service 当数据库

| 维度 | Google Sheet + GAS | memory-service (SQLite) |
|---|---|---|
| Schema 演进 | 38 列 v2.12，每次加列要 SheetSchemaUpdater + GAS 升级双同步；**GAS 升级通道已被域策略冻结**（这正是 Case 2a 的根因） | 正式 migration 体系（已 60+ 个），加字段一次到位 |
| 调度粒度 | GAS 分钟触发器（云端 24/7）+ 三段到期匹配 + Script Properties 幂等锁 | HeartbeatLoop 15 分钟粒度（需为消息调度加更细 interval）；宕机即停摆 |
| 幂等/账本 | executionKey + claim≠confirm 两段领取 + 2h TTL 对账（4,673 行 GAS 里最精巧也最难维护的部分） | idempotency_key UNIQUE + attempts 表 + dead_letter，生产验证过 |
| 查询/关联 | 无法 join；Logs 与 Messages 靠约定关联 | SQL 任意查询、与记忆/反思/委派同库同事务 |
| 人工直接编辑 | ✅ 独有优势：多人共享、随手改、版本历史、无需装扩展 | 需要 UI；无多人协作 |
| 附件/邮件 | ✅ DriveApp 附件、MailApp 免凭据 AsMe 邮件 | 无 Drive 能力；AsMe 需 RingCentral JWT |
| Jira 可达性 | ✅ 公网 GET 会合点（Jira 出站限制下唯一稳定端点） | Jira 不能直连（需 Dify 跳板） |
| 依赖/子任务/优先级 | 无法表达 | dependsOn/priority 字段已存在 |
| 与 AI 生态的距离 | 隔着 GAS 版本这堵墙（Case 2a 的教训） | 反思、委派、确认、通知全在场内 |

**结论**：计划真源应迁 memory-service（可演进、可关联、可被 AI 消费）；Sheet 保留其不可替代的三样东西（Jira 会合点、AsMe 邮件、人工协作编辑），先双向镜像、执行领取端迁走后降为只读镜像。

**关于"个人 Google 账号绕过域策略"**：技术上成立——域策略只约束受管账号，个人 gmail 部署的 GAS Web App 仍可 `ANYONE_ANONYMOUS`。但它把公司 Sheet 数据和调度端点搬进个人账号，治理上不可取，且消费者账号的 GAS 配额更低。定位为**存量用户的逃生舱**（初始化向导里可见但标注风险），不作为主线方案。

---

## 二、事实基础：骨架已建成约七成（全部经 file:line 核实）

### 已有（不是愿景，是在线代码）

| 能力 | 证据 |
|---|---|
| 八态任务队列（queued/awaiting_claim/running/succeeded/failed/cancelled/dead_letter/input_required） | `ActionRepository.ts:6-14` |
| priority 1-10 且真实参与排序 | `ActionRepository.ts:106-109, 445` |
| 幂等键双兜底 + 按 attempt 区分的重试幂等 | `ActionRepository.ts:210-283` |
| **depends_on_json 已持久化**（但零消费方） | `ActionRepository.ts:38, 194, 249` |
| 失败 3 次进 dead_letter、stale 回收 | `ActionExecutor.ts:479-484` |
| 远程 worker claim/lease/fence/report 拉取协议 | `routes/agentWorkers.ts:109-180` |
| 5 类执行器统一契约（openclaw×2 + acp-codex/claude-code/cursor） | `executorRegistry.ts` |
| worker 今天就能在指定 cwd 以 write 模式跑 codex/claude/cursor | `worker/src/runner.ts:86-145` |
| 事前审批 + 事中决策（need_human_decision→confirm_request）+ 答复续跑 | `ActionExecutor.ts:377-388, 1236-1293`；`confirmRequests.ts:220-257` |
| 注入防御闸门（可疑记忆 evidence 强制人工确认） | `ActionExecutor.ts:315-330` |
| **AI 自反思产任务→人确认→执行 的闭环** | `ReflectionWorker.ts:540-617` |
| 服务端 scheduleSpec 解释器（repeatEvery/Unit/Days/endDate/时区） | `OutreachEngine.ts:877-1083` |
| 文件型产物先例（transcript 落盘、DB 存路径） | `OpenClawDelegationService.ts:746-753` |
| `memory_cron` 触发源枚举已预留 | `src/scheduled-messages/types.ts:94` |
| roadmap→AgentTask→artifact→写回 的外部系统闭环 | `contentScriptRoadmap.ts:1678-1878` |

### 缺口（真正要做的 20%，也是难的部分）

| 缺口 | 最小改动 |
|---|---|
| 无 parent_action_id（子任务树） | 一次迁移加列 + 索引 + 父任务聚合完成 |
| depends_on 不通电 | listDueAutoActions WHERE 加 NOT EXISTS(json_each 关联未 succeeded 依赖)；需定失败传播策略（阻塞 vs 级联取消）+ 环检测 |
| 无重复调度（scheduled_at 一次性） | 加 recurrence_spec 列，完成时按 spec 克隆下一次（幂等键加时间片后缀），复用 OutreachEngine 解释器 |
| 心跳 15 分钟粒度、worker 只领预绑定任务 | 消息调度单设短 interval；claim 支持公共池（target_worker_id IS NULL）+ capabilities 过滤 + currentTaskCount 空闲判定 |
| 审批续跑硬编码 openclaw_delegation | confirm_requests 加 resume_action_id，任意 category 通用续跑；need_human_decision 停 input_required 而非 failed |
| **worker lease 5 分钟无续租**（>5 分钟任务 report 撞 409）、ACP 单轮、auto-approve、无进度流、transcript 截断 4000 字符 | lease 心跳续租；这是承载长时开发任务的硬前提，也是全方案最贵的部分 |
| artifacts 是文本收据，无 deliverable 通道 | artifacts 加 kind:'file'（UserDataManager 路径，沿 transcript 先例），不做渲染/预览/blob |

---

## 三、愿景裁决

支持合并的愿景依据：future-vision 明确写了「异步代理」「委托决策」「数字孪生分身代理」；reflection→proposed_actions→confirm 的"AI 自产任务候选"已是现状；Day Pilot 已把定位从"记忆仓库"升级为"个人工作领航员"。

约束合并的愿景红线（全部保留）：
- Control Tower 因"偏离个人记忆系统主题"被正式搁置——本方案不做"调度其他 AI 的中枢"，只做"记忆驱动的候选生成 + 人审编排 + 已批准 backlog 排干"。
- sleep-time-compute 的"责任迁移红线"、Day Pilot 的"不做任务管理器"——账本不接管工作入口（Jira/roadmap 仍是团队事实源），只管**个人执行层**。
- 对用户原提案"彻底把人当做 AI 流程中的一个小环节"的修正：**人是流程中的一等节点（gate），且是唯一能让 write 动作通行的节点**。demo 里这一点被做成了字面事实：模拟流程走到人工节点会真的停下来，等你点按钮。

---

## 四、方案：六个最小原语 + 四阶段

### 六原语（五个是"补齐半成品"，一个是新建）

1. `parent_action_id`（子任务树）
2. depends_on 通电（一条 NOT EXISTS SQL + 失败传播策略）
3. `recurrence_spec`（重复调度 = 方案 B 本身）
4. 公共池 claim + 空闲判定（空闲即执行 = 更快排干已批准 backlog）
5. `confirm_requests.resume_action_id`（通用人工节点）
6. file artifact 通道 + worker lease 续租（唯一偏"新建"的一条）

### 四阶段（每期独立可验收、独立可停）

**Phase 1 —— 通电（= 方案 B）**
recurrence_spec + memory_cron 调度循环；定时任务真源迁入 proposed_actions；depends_on 消费；parent_action_id；resume_action_id 通用续跑；本地 drain 短 interval。
验收：GAS/Jira 触发与 memory_cron 触发的任务共用同一账本/幂等/runtime-status；停在这里也已完成方案 B，零浪费。

**Phase 2 —— 执行承载**
lease 心跳续租；公共池 claim + capabilities + 空闲判定；GatewayExecutor.poll() 接线 reconcile；file artifact。
验收：一个 30 分钟调研任务在远程 worker 跑完，交回 research/*.md 路径。

**Phase 3 —— 人工节点与反思接入**
need_human_decision → input_required 通用停靠；反思产出的确认请求挂到任务树（人工确认 = 阻塞子节点的 gate）；产物目录规范（reports/、research/，沿 dreams/、reflections/ 结构）。
验收：反思产出的调研任务，经人批准 → 执行 → md 产物 → 人 review → 下游子任务解锁，全程在账本可见。

**Phase 4 —— 外部触发收敛**
Sheet 降只读镜像（前提：执行领取端已迁走）；评估 Jira→Dify 跳板改 memory-service 出站直发；AsMe 邮件与 Drive 附件长期留在 GAS；GAS Web App 不再被 Jira 调用后 access 降 `DOMAIN`，**升级通道随之解冻**（Case 4 的最终解）。

### 明确不建清单（范围防失控）

- ❌ 通用 workflow DSL / BPMN 引擎——DAG 只用 parent + depends_on 两字段表达
- ❌ PPT/文档渲染管线——产物 = 文件路径，生成归执行器 agent，账本只收路径
- ❌ 替代 roadmap-service / Jira——账本任务用 externalRef 指向 (teamId, itemKey)，完成走既有 resolve intent 回写，一个排期字段都不复制
- ❌ 全自主"人被编排"——人拍板红线、注入闸门、write 审批原样保留
- ❌ 投机性任务生成——空闲 ≠ 造任务；反思对 idle 用户暂停的节流保留
- ❌ 多人协作编辑 UI；❌ 在 ScheduledMessagesManager 里长任何新 UI

---

## 五、与 roadmap-service 的边界

roadmap-service 管"团队季度排期镜像"（Epic 粒度、Gantt、presence、dep 仅可视标注）；任务账本管"个人执行层"（步骤树、可阻塞依赖、人工 gate、完成证据）。两者已有成熟协作通道（roadmap→executeAgentTask→resolve_item 写回），账本不复制排期字段，只经 externalRef 引用。已知待接缝：dep marker 与 dependsOn 互不感知、任务完成不回写 roadmap、身份模型（team+actor vs userId）需映射约定——留给 Phase 3 之后按需处理。

---

## 六、风险与对策

| 风险 | 对策 |
|---|---|
| 单人维护带宽（仓库有"预留电线不通电"史：depends_on 三年零消费、poll() 零调用方、memory_cron 枚举预留未实现） | 四阶段每期独立可停；Phase 1 与方案 B 重合保证最坏情况零浪费 |
| memory-service 成单点（今天 Sheet+GAS+Jira 在其宕机时不受影响） | Phase 1-3 期间 Jira 触发通道保留为兜底；Phase 4 才收敛，且 AsMe/Drive 永久留 GAS |
| 安全放大器（ACP auto-approve × 7x24 无人执行 × 反思自产任务） | 空闲执行只排干已批准任务；write 模式必经审批；ACP 承载真实写任务前先解决逐操作审批/沙箱（Phase 2 门槛项） |
| UI 复杂度重蹈 12,874 行覆辙 | 账本 UI 进 memory-exploring 独立视图；DAG 可视化推迟，先用树 + 依赖 chip |

---

## 七、清单规模与信息架构（真实数据实测，2026-08-28）

用真实数据回答"列表会不会非常大"：**会，而且已经很大**。

| 来源 | 真实规模 | 特征 |
|---|---|---|
| 定时任务（Sheet 全量） | **37 条**（Bot 3 / AsMe 1 / AI-Dify 19 / JiraAutomation 11 / AgentTask 5；Active 31、Paused 6） | 安静的 recurring，大多数时候不需要看 |
| 反思产出（本机 esone.qiu 库 queued） | **205 条，去重后仅 ~83 个标题** | 高度重复：`update_truth_property` 35 条只有 5 个主题（"部署检查不稳定判定标准"一个主题堆了 30+ 条）；MTR-144628 查证在 delegate_openclaw 里堆了 ~10 个变体 |
| 开发委派（模拟） | 5-6 条 | 低频、高价值、需要 review |

平铺 = ~250 行，不可用。信息架构结论（demo 已按此重写）：

1. **默认视图 = 执行时间轴**（按执行顺序排列，用户直觉）：今天已执行 → 今天待执行 → 明天 → 本周后续 → Timeline 待命（FF/CF 里程碑触发无固定时间）→ 已暂停。recurring 任务在时间轴上只出现"下一次"。
2. **收件箱与账本分离**：需要人处理的（人工 gate / review / 失败）进收件箱，小而急，带角标；routine recurring 留在账本，大而静。这与业内一致（Devin 的 Action Required、Linear 复用 Inbox 的 awaitingInput）。
3. **类型入口 tabs**：⏰ 定时推送 / 🤖 Agent 任务 / 🌙 反思候选 / 🛠 开发委派——每类列表形态不同（定时=紧凑表、反思=聚合卡、开发=session 卡）。
4. **反思候选必须聚合去重后才能上账本**：按主题聚合成"候选卡 ×N"，同主题重复自动折叠（Echo Dampener 思路）；否则 205 条原始行会淹没一切。这是真实数据直接暴露的前置需求，列为账本 UI 的门槛项。

## 八、开发委派：业内实践调研结论与设计裁决

调研对象：Devin、OpenAI Codex cloud、Google Jules、GitHub Copilot coding agent、Cursor、Claude Code、Windsurf 2.0、Amp、Linear agents、Factory.ai、GitHub spec-kit、Amazon Kiro（来源 URL 见调研记录）。三条高度收敛的行业共识：

1. **委派的单位是 well-scoped 工作单，不是对话**。四家异步 agent 官方口径一致：Devin "Write clear prompts with explicit completion criteria / Make tasks easy to verify"；Copilot "clear, well-scoped tasks + complete acceptance criteria"；Codex "names the behavior you want … and says how to verify the change"；Jules 同。判据可以直接借用：**能一句话说清验收标准的 → 委派；预期中途会改方向的 → 留在对话里**（Devin 官方明说"不擅长中途改需求"）。
2. **"聊方案"与"委派执行"是两种模式，但不是两个产品**——用"计划工件"桥接：Cursor plan mode → "Build in Cloud"；Claude Code 官方 "Plan locally, execute remotely"（SPEC.md 定稿 → 新会话执行）+ `--teleport` 反向拉回；Windsurf 2.0 "本地 agent 做计划，一键 send to Devin"；Amp handoff 把讨论线程萃取成新任务 prompt。spec-kit/Kiro 把这个桥接工件化（spec.md/plan.md/tasks.md，逐阶段人工审批）。
3. **任务中心组织的是 session/工作单，讨论不进任务中心**。GitHub Agent HQ、Devin sessions、Cursor agents 面板管理的都是已委派的运行单元；Linear 甚至不建新列表，复用 issue + Inbox。

**对本方案的裁决**：分开两件事，融合一个账本。

- 你现有的 Codex/Claude Code 多轮对话开发模式**不改变、不搬进账本**——那是探索/结对面，业内没有任何产品把它塞进任务列表。
- 账本只收"定稿后的工作单"：标题 + spec 摘要 + 验收标准 + 目标 cwd/repo + 执行器。表单强制"验收标准"字段（借 Copilot 的 acceptance criteria 实践）。
- 提供两个桥接口（对齐业内）：**交接入口**——在对话里讨论定稿后，把结论萃取成账本任务（Amp handoff 模式；落地形态可以是 memory-service MCP 工具 `create_ledger_task`，在 Claude Code/Codex 会话里直接调用）；**拉回出口**——账本里的开发任务可以"转回对话"继续多轮（teleport 模式；v1 先做成复制 spec + 上下文到剪贴板/新会话提示）。
- 开发任务默认带 **plan gate**（Jules/Factory 模式）：agent 先出 plan 停在人工节点，批准后才动代码——与账本已有的 confirm_request 人工节点是同一机制，零新概念。

## 九、双引擎并存与注入路由（回答"二选一还是并存"）

**裁决：并存，且不是"两套任务中心"，而是"一个账本、两条调度 lane"。** 二选一会逼用户在"云端 24/7 可靠性（Jira+Sheet）"和"新能力（依赖/人工节点/agent）"之间弃一个，没有必要——lane 是任务的属性，不是系统的分叉。

- `lane: jira_sheet`（☁️）：Jira Automation 每分钟触发 + Sheet 镜像。适合：必须 24/7 可靠的团队推送（Bot/AI-Dify 报表）、Jira Automation 导入的规则。memory-service 宕机不影响。
- `lane: memory_cron`（🏠）：memory-service 到期队列。适合：AgentTask、反思候选、开发委派、依赖/子任务/人工节点类任务、个人提醒。

**注入功能统一设计原则：所有入口只写账本这一个 API，路由是账本的事，入口不感知两套系统。**

| 注入入口 | 写入 | 默认 lane | 理由 |
|---|---|---|---|
| Glip 添加定时消息（消息 → 定时提醒/推送） | 账本 API | 已初始化 Jira+Sheet 且是群推送 → `jira_sheet`（同步器镜像写 Sheet）；否则 `memory_cron` | 群推送要 24/7 可靠；镜像写由账本侧同步器完成，入口零感知 |
| 稍后处理提醒 | 账本 API | `memory_cron` | 个人提醒，低配置成本、要支持依赖到"处理完成"语义 |
| Jira Automation 规则导入/关联 | 账本 API（登记行）| `jira_sheet` | 规则本体就在 Jira，触发天然在云端 |
| 反思候选 / AgentTask / 开发委派 | 账本 API | `memory_cron` | 需要账本的 gate/依赖/artifact 能力 |

初始化不做"二选一向导"，做**分层激活**：
- **Level 0 账本**（默认开启，零配置）：memory-service 本地任务账本 + memory_cron。装完即可用稍后提醒、反思候选、开发委派。
- **Level 1 推送通道**（可选）：Bot / AsMe 凭据，解锁 Glip 推送目标。
- **Level 2 云端可靠 lane**（可选，重配置）：Google Sheet + Jira Automation（提示需要 Jira 项目 admin 权限 + Google 授权；域策略下新部署受限，个人 Google 账号是带治理风险的逃生舱——见第一节）。已有存量用户自动识别为 Level 2 已激活。
- 每个任务编辑器里 lane 显示为可切换属性（带"为什么推荐这条 lane"的说明），切 lane = 账本改属性 + 同步器增删 Sheet 镜像行。

---

## 十、意图收集箱（Intent Inbox）——"零散输入 → AI 合成 scope"的裁决与设计

### 问题

用户设想的未来协作：随时随地（手机）丢一两句零散需求，AI 持续积累、聚类、架构思考、补全依赖，攒到"足够完整"时合成可 review 的方案/demo，人看一眼确认即拆任务执行。这与第八节"账本只收 well-scoped 任务"是否自相矛盾？

### 裁决：不矛盾——它们是同一条流水线的上下游，且这条链正是业界的明确空白

四路调研（论文/产品/专家/风险，2024-2026，来源见下）结论一致：**业界正把"scoping 本身"从人的前置重活变成 AI 的后台工作，人从"写 scope"变成"审 scope"。账本的 well-scoped 门槛原样保留——变的只是 well-scoped 任务的生产方式。**

正面证据链（每一环都有实证）：
- **碎片聚类可行**：Dial-In LLM（arXiv:2412.09049）LLM-in-the-loop 意图聚类与人类判断对齐率 >95%（10 万+真实对话验证）。
- **后台整理可行**：Sleep-time Compute（Letta+Berkeley, arXiv:2504.13171）空闲期离线整理上下文，同等准确率省 5 倍算力；Letta sleep-time agents 已产品化。
- **合成需求可行**：LENS（arXiv:2606.25867）从零散人话提取显式需求 F1 84.4%，推断隐性需求 75% 被专家认可；ProAct（arXiv:2605.25971）后台补全依赖使用户负担降 11.7%、幻觉降 28.1%。
- **模式已被产品化验证**：LangChain ambient agents + Agent Inbox（Notify/Question/Review 三类轻决策）；ChatGPT Pulse（记忆→夜间合成→晨间卡片）；Linear Intake/Triage Intelligence（多源碎片→聚类→收件箱人审，减 70% triage 时间）；Kiro/spec-kit（AI 起草 spec、人只审批）。
- **专家共识**：Karpathy（生成-验证回路 + autonomy slider + "keep AI on a leash"）；Harrison Chase（"human on the loop" 而非 in the loop）；Andrew Ng（瓶颈移到"决定做什么"）；Cognition 实证（执行 agent 不擅长中途改需求→碎片应在执行前的合成层消化）。
- **空白确认**：「碎片持续积累→自动聚类→阈值→合成可 review 方案」的完整闭环，2026 年中无成熟开源或商业实现（Linear 止步于 issue 生成、Pulse 面向生活资讯、ambient agents 是框架非产品）。

### 但"人看一眼"是全链最脆弱环节——实证反对天真版本

- CHI 2025（319 人实证）：对 AI 信心越高，批判性思维投入越少——**方案越完整，人越不会真审**。
- METR RCT（arXiv:2507.09089）：开发者用 AI 实际慢 19% 却自评快 20%——主观"看着没问题"系统性失准。
- MSR 2026（arXiv:2601.21276）：AI 产出的表面完整性让 reviewer 更宽松，冗余与技术债静默累积。
- LadderTeam（arXiv:2608.17029）：LLM 需求引导表面收敛率 99.1%，真实需求命中仅 81%——**AI 会把模糊碎片脑补成"已确认"**。
- arXiv:2606.05391（17 名资深开发者访谈）："把 plan 审过当作执行没问题"是被点名的危险启发式。
- Scott Logic 实测 spec-kit：单功能生成 2500+ 行 markdown，人审 2 小时仍看不完——**长文档必然导致扫一眼放行**。

### 设计：账本的前厅，三车道入口 + 六条确认设计规则

**形态**：账本增加一个前厅视图「💡 意图收集箱」。三车道并存：
- **快车道**：能一句话说清验收标准 → 直接进账本（第八节判据原样保留）。
- **慢车道**：说不全的碎片 → 意图收集箱攒着（手机/Glip/会话一句话即可，零门槛）。
- **深水道**：需要真正来回讨论的架构问题 → 会话结对，定稿后 handoff（第八节桥接原样保留）。

**慢车道机制**（全部复用现有组件）：
1. 碎片 = 新的记忆信号源（复用 memory capture 通道 + Glip/手机入口），带时间与来源。
2. 聚类 = 反思引擎新增意图聚类 pass（Dial-In LLM 模式），产出主题卡：碎片数、覆盖度、**缺什么**（验收标准？边界？优先级？）。
3. 阈值 = 保守设计（ProactiveBench 的"何时该提出"F1 仅 66%）：够完整时只**点亮卡片 + 通知**，不自动合成重方案；人随时可手动"现在整理"；AI 可在你下次提到相关话题时追问缺口（LLMREI 模式）。
4. 合成 = sleep-time 夜间执行（复用反思调度），产物进 confirm_requests（复用人工节点）。

**确认产物的六条设计规则**（逐条对应风险实证）：
1. **一页摘要 + 假设清单**，不是长文档（对 Scott Logic 2500 行教训）。
2. **每个需求点带溯源**——链接回你的原话碎片（对 CHI 2025："让人的自信有抓手"；LENS 的溯源设计）。
3. **AI 推断的点显式标记**，与"你说过的"视觉区分（对 LadderTeam 的脑补收敛：AI 补的必须可见）。
4. **确认是结构化动作**：逐条勾选假设、对 AI 标记的取舍点做选择，全部完成才能批准——不是一个放行按钮（对 rubber-stamping / approval churning：认知强制函数）。
5. **能出 demo 就出 demo**（Willison："preview 让 review 高效"；本仓库已有 demo html 文化，合成产物默认附一个静态 demo）。
6. **验收标准落为可执行验证**，方案文档只是生成源不是长期真相源（对 spec 漂移："prose 是 claim，test 是 receipt"）。
7. （补充）确认后新碎片**回流合成层重新出方案**，永不塞给执行中的任务（Devin 实证："中途追加需求反而更差"）。

### 边界裁决：应该做在这个系统里

这是全仓库最"命中定位"的候选功能，与被搁置的 Control Tower 性质完全不同：
- Control Tower 被搁置是因为"调度其他 AI 的中枢"偏离记忆系统主题；意图收集箱恰恰相反——**"持续理解一个人"应用在他的开发意图上**，是 future-vision「异步代理/委托决策」的直接实现。
- 组件全部现成：记忆捕获（输入端）、反思引擎（合成端）、confirm_requests（确认端）、账本（执行端）。新增的只是：意图碎片信号源 + 聚类 pass + 主题卡 UI + 合成产物模板。成本中低，且 v1 可以纯手动触发（碎片攒着，人点"现在整理"），把最不可靠的"阈值自动判断"留到 v2。
- 排期建议：位于账本 Phase 3（人工节点与反思接入）之后，作为 Phase 5 立项；它依赖账本的任务树 + gate + artifact 全部就位。

来源（关键）：arXiv 2410.12361 / 2505.14668 / 2504.13171 / 2605.25971 / 2606.25867 / 2507.02564 / 2412.09049 / 2502.13069 / 2507.09089 / 2605.02273 / 2601.21276 / 2606.05391 / 2608.17029；langchain.com/blog/introducing-ambient-agents；openai.com/index/introducing-chatgpt-pulse；docs.letta.com sleeptime；linear.app/intake；kiro.dev；cognition.com Devin 2025 performance review；simonwillison.net vibe-engineering；latent.space Software 3.0。

### 9.1 存储指向与代码改动面（按注入入口）

| 入口 | 现状存储 | 目标存储 | 改动面 |
|---|---|---|---|
| Jira Automation 规则导入/关联 | Sheet 行 + Jira rule | **不变**（Sheet 行照写，Jira rule 照常领取），账本只做只读镜像登记（读同步，让它出现在统一列表） | **接近零**：GAS/Jira rule 链路一行不改 |
| Glip 添加定时消息 | 经 background 写 Sheet | 写账本 API；若任务选 ☁️ lane，由**扩展侧同步器**镜像写 Sheet 行 | 中：入口改调用目标；Sheet 写入代码复用（从入口直写改为账本驱动） |
| 稍后处理提醒 | 经 background 写 Sheet | 写账本 API，固定 🏠 lane，不再碰 Sheet | 中：入口改调用目标 |
| 反思候选 / 开发委派 | memory-service 内部 | 本来就在账本 | 零 |

两个关键细节：
1. **Sheet 镜像由扩展执行，不是 memory-service**——Google OAuth token 在扩展手里，memory-service 无 Google 凭据。同步器 = 扩展 background 的账本驱动写 Sheet（在线保存时即时写，离线时后台对账补写），复用现有 Sheet 写入代码。
2. **通知通道也分级**：L0 无 Bot 凭据时，推送目标只有"插件通知"（notification_records → 扩展轮询 → Chrome 通知）；Glip Bot 私发/群发需 Level 1。编辑器里 L1 未配置的通道置灰，与 ☁️ lane 置灰同一交互模式。

### 9.2 编辑器的 lane 规则（具象 UI 契约）

- **可选 ☁️ 的类型**：定时推送、AgentTask（触发 lane 可选；AgentTask 的执行永远在 memory-service）。L2 未启用时 ☁️ 置灰，附"去启用 Level 2"链接。
- **固定 🏠 的类型**：稍后提醒、开发委派、反思候选（需要账本的 gate/依赖/artifact 能力，Sheet 表达不了）。
- 选 ☁️ 保存 = 账本写入 + 扩展同步器写 Sheet 行（显示镜像行 msg_id 与同步状态）；切 lane = 改属性 + 增删镜像行。

---

## 十一、碎片入口的实现：瘦管道、厚服务（journey demo 里"手机界面"是什么）

Journey demo 左侧的手机聊天界面**不需要新建任何 App——它就是 OpenClaw**。用户已经在手机上通过 OpenClaw 的聊天渠道和自己的助手说话；缺的只是让这些话流进 memory-service。仓库里三条通道全部现成：

| 现成设施 | 证据 | 在本方案中的角色 |
|---|---|---|
| A2A JSON-RPC 入口（taskId ↔ proposed_actions.id） | `memory-service/src/routes/a2a.ts:1-9` | 外部 agent 提交任务/消息进账本的标准协议入口 |
| OpenClaw skill 同步（upsert skill 包到 OpenClaw） | `OpenClawSkillSyncService.ts`（list/upsert 完整契约） | 从 memory-service 直接发布「记一笔」skill，无需手工安装 |
| OpenClaw 设备身份/凭据 | `data/openclaw-gateway-device.json` + `openclawDeviceIdentity.ts` | 鉴权复用，零新配置 |
| 共享记忆中台架构（架构 A：OpenClaw 当客户端） | `docs/progressing/memory-share-with-openclaw.md` | 本章是该架构在"意图碎片"上的实例化 |

### 核心架构原则：入口是哑管道，车道判定只在服务端实现一次

所有入口（OpenClaw / MCP / 扩展 / desktop）只做一件事：把原始文本 + 来源 + 时间发给 memory-service；**车道判定（快/慢/深）、结构化回显卡、主题聚类全部在服务端**（复用 LLMClient）。这样 N 个入口零成本保持一致，新入口的成本 = 一个 HTTP 调用。

```
POST /api/v1/intent-fragments   { text, source: openclaw|mcp|extension|desktop, ts }
→ 返回 { lane: fast|slow|deep, echoCard, actions: [confirm|stash|discuss], themeId? }
POST /api/v1/intent-fragments/:id/confirm   （快车道确认 → 建账本任务；纯文本渠道回复"确认"即触发）
```

### 入口分期（按性价比排序）

1. **v1 · OpenClaw skill「记一笔」**（首选，= demo 手机界面）：skill 指导 OpenClaw 把用户随手输入转发到上述 API，并把 echo 卡文本渲染回聊天；确认动作降级为文本协议（回复"确认"→入账，"改 …"→修正，不回复→默认攒着）。经 OpenClawSkillSyncService 发布，鉴权走现有设备身份。**红线：纯文本渠道里快车道任务同样停在"待确认"，不因渠道简陋跳过确认。**
2. **v1 · personal-memory MCP 加两个工具**：`save_intent_fragment`（会话里随手攒）+ `create_ledger_task`（深水道 handoff 的实现——journey demo 第 7 步那颗按钮就是它）。ACP 系统提示词里已引用 personal-memory MCP，顺路挂上。
3. **v1.5 · 扩展划词/Glip 消息「存为意图碎片」**：复用现有 memory capture 通道加一个动作，成本最低的桌面浏览入口。
4. **v2 · Desktop App quick-ask 加「攒一笔」模式**：复用 quick-ask 面板 + 全局快捷键，在电脑边时的最低摩擦入口。
5. **v2 · Glip Bot 私聊收碎片**：SM AI 双向化需要 inbound webhook 订阅（可复用 OutreachEngine 的回复处理机制），成本高于 OpenClaw 且手机场景已被覆盖——缓做。

### 为什么不自建手机 App / 不先做 Desktop

碎片输入的本质是"在别的事情间隙随手一句话"，入口必须寄生在用户已经打开的界面里（聊天/编辑器/浏览器），独立 App 的打开成本会杀死这个行为。OpenClaw 恰好是用户手机上已有的常驻聊天入口；Desktop App 覆盖不了咖啡厅场景，作为 v2 补充而非主线。

---

## 十、实施进度（Phase 1）

> 功能正式命名为**任务中心（Task Center）**。特性文档：[`docs/features/task_center.md`](../features/task_center.md)；
> `scheduled_messages_manager.md` 保留并重定位为任务中心的 **L2 / ☁️ jira_sheet lane** 子文档（998 行 GAS/幂等/Timeline 运维细节全部仍然有效，且都只属于这条 lane）。
> 注意 `task_scheduler_api.md` 是扩展的 Chrome alarm 调度器，与任务中心无关，已在两处文档点明区别。

### ✅ 1.1 数据模型 + depends_on 通电（已完成）

- `065_task_center.sql`：`parent_action_id` / `recurrence_spec` / `lane` / `task_kind` / `mirror_ref_json` + 三个索引。
- `ActionRepository`：新增 `TaskLane` / `TaskKind` 类型与 normalizer（非法枚举回落 undefined，不外泄脏值）；字段贯通 row→record、create、list filters。
- **`listDueAutoActions` 两条新约束**：
  1. `lane <> 'jira_sheet'` —— ☁️ 任务由 Jira Automation 经 Sheet 镜像行触发，本地到期扫描必须跳过，否则**双重执行**。
  2. `depends_on_json` 通电（持久化多年零消费方的字段终于有了读者）：依赖未全部 succeeded 则不出队。**失败传播策略定为"阻塞"**——依赖 cancelled/dead_letter 或 id 不存在时永久阻塞，让断链浮现，而不是拿缺失前置去跑下游。
- 测试 `taskCenterLedger.test.ts` 10 passed，覆盖三种 lane 语义、五种依赖场景、字段往返、非法枚举。

**顺带修掉一个测试脚手架缺陷**：`__tests__/setup.ts` 用朴素 `split(';')` 切迁移语句，而生产的 `Database.splitStatements` 是注释感知的。**注释里含分号的迁移在生产正常、在测试里被截断且被 catch 静默吞掉**——测试跑在一个生产不存在的 schema 上。已改为先剥离 `--` 注释行再切分。全仓库受此影响的历史迁移只有 `033`。

**回归验证**：改动前后基线一致（均 94 failed / 21 files，全部源自仓库其它在途改动），我的改动净增 10 个通过、零回归；`src/` tsc 干净。

### 下一步（Phase 1 续）

- 1.2 `recurrence_spec` 滚动：run 结束按 spec 计算下一次并克隆（幂等键加时间片后缀），复用 OutreachEngine 的 scheduleSpec 解释器
- 1.3 `parent_action_id` 聚合完成 + 环检测
- 1.4 `confirm_requests.resume_action_id` 通用续跑（解除 `openclaw_delegation` 硬编码）
- 1.5 `POST /task-center/tasks` 统一入口 + lane 路由
- 1.6 本地 drain 短 interval（当前 15 分钟心跳对消息调度太粗）
