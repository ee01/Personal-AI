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

### ✅ 1.2–1.6 + 任务中心 UI（已完成）

**1.2 recurrence 滚动**
- 把 `parseNextDispatch` 及 12 个私有辅助函数从 `OutreachEngine.ts` 原样抽到 `core/scheduleSpec.ts` 并导出（OutreachEngine 改为 import，30 个既有测试全绿 = 零行为变化）。这样任务中心复用的是生产验证过的同一套语义（工作日 Day、Week+repeatDays 周次、endDate 闭区间、DST 安全的浮动时间），而不是第二套实现。
- `TaskCenterMaintenanceService.rollRecurringOccurrences()`：终态任务按 spec 克隆下一次。**做成扫描而非 markSucceeded 钩子**——`cancel()`、`recoverStaleRunningActions()`、worker report 三条终态路径都不走 markSucceeded，挂钩子会让这些情况下的重复任务**整条序列静默停掉**。
- `repeatCount` 终止由账本自己计数（解释器不管这个，OutreachRepository 才管），baseline 取 `scheduledAt` 而非 now——否则一次迟到的执行会跳过中间所有次。

**1.3 父任务聚合 + 环检测**
- `listParentsReadyToComplete()` + `markParentCompleted()`：全部子任务 succeeded 时父任务自动完成。**零子任务的任务永不自动完成**（EXISTS 守卫），否则会"完成"一个根本没人跑过的任务。
- 环检测放在 `POST /task-center/tasks` 的 create 时（`findDependencyCycle`）：due-scan 阶段的依赖门只会让成环任务**永久静默不执行**，创建时是唯一还能报错给人的时机。

**1.4 通用续跑**
- 迁移 066 给 `confirm_requests` 加 `resume_action_id`；answer 处理器不再只认 `category==='openclaw_delegation'`，任意 category 都能续跑；旧行回落到原来的 evidence_refs 扫描，向后兼容。

**1.5 统一入口 API**
- `POST /task-center/tasks`（+ GET 列表 / capabilities / 手动 sweep）。**lane 由服务端裁决**：`resolveLane()` 中 push/agent 可选 ☁️，remind/dev/reflection 固定 🏠；请求 ☁️ 但没 L2 时回落 🏠 并在响应里说明（`honoredRequest: false`），任务照跑不失败。
- 顺带修掉一个和 depends_on 同款的缺陷：`ActionListFilters` 早就声明了 `lane/taskKind/parentActionId`，但 `list()` 的 SQL **从未使用它们**——调用方拿到的是未过滤列表。已通电。

**1.6 短 drain**
- `config.taskDrainIntervalMs`（默认 60s，下限 15s）+ ProactiveScheduler 独立 interval。**刻意放在 `proactiveSchedulerEnabled` 门禁之前**：用户排的 09:00 任务，在关掉重型心跳（反思/摘要）的部署上也必须照常触发。15 分钟心跳对分钟级任务太粗（09:00 的任务会在 09:00–09:15 之间随机触发）。

**任务中心 UI**
- `src/modals/components/TaskCenterPage.vue`（721 行）+ 路由 `#/task-center` + 侧边栏「🗂 任务中心」+ i18n。技术栈与落点完全对齐现有视图（Vue 3 script setup、组件内直连 `getMemoryServiceClient()`、RehearsalsPage 式左列表右详情、PersonalSkillsPage 式模态）。
- 实现了 demo 的分层设计：L0/L1/L2 状态条、按执行顺序分组、类型筛选、每类不同的编辑器字段、**调度器按 L2 是否就绪置灰并说明缺什么**、开发委派强制验收标准。
- L2 检测在前端读 `chrome.storage.local`（Google/Jira 凭据在扩展侧，后端无从判断），随请求上报给 `cloudLaneAvailable`。
- 端到端验证 `npm run verify:task-center-ui`（7 项断言，真实加载扩展 + Playwright 驱动）。

**回归**：memory-service 全量 92 failed / 1082 passed（基线 94 failed / 1043 passed）——零回归，且顺带修好 2 个；`src/` 与 `memory-service/src/` tsc 均干净；webpack 构建通过。

### 下一步（Phase 2 起）

- 2.x worker lease 续租、公共池 claim、`poll()` 接线、file artifact
- 3.x `input_required` 通用停靠、反思候选聚合去重后接入账本、产物目录规范
- 4.x Sheet 降只读镜像、GAS access 降 `DOMAIN`
- 待接：Glip 定时消息 / 稍后提醒两个注入入口改写账本 API（见 9.1 改动面表）

---

## 十二、未完成项与 RingCentral 凭据统一（2026-08-30）

### 背景：三个来自实际使用的反馈

1. **L1 的定义漏了 AsMe**：文档写的是「Bot（SM AI）/ AsMe RingCentral 凭据」，但 UI 里的 L1 检测和引导只认 Bot，AsMe（本人身份推送）完全没体现。
2. **新建「定时推送」弹窗过于简陋**：没有推送身份选择（Bot / AsMe），也没有 AI Report 这种真实在用的推送形态（存量 37 条里 AI 报表占 19 条，是最大头）。
3. **L0 应当拥有 L2 的几乎全部能力**：没配 L2 的用户也应该能用上比较完整的定时消息 / Agent 任务（AI Report、帮我问、帮我做），而不是只能用一个残缺版。

### ⚠️ 已核实的根因：`push`/`agent` 任务在 🏠 lane 下**根本没有投递环节**

这是比 UI 缺字段更根本的问题，必须先修：

- `push` / `agent` 任务落到 `delegate_agent`，由 `ActionExecutor.delegateAgent()`（`ActionExecutor.ts:891`）执行。
- 这条路径**只做一件事**：跑执行器、把 envelope 结果写进 `result_json`。**没有任何一步把结果推给用户**。
- 对比：☁️ lane 的投递是在 `routes/agentTasks.ts` 的 `planAgentTaskNotifications` + `deliverNoticeToGlip` 里做的，而那段代码只在 `POST /agent-tasks/execute` 这条 HTTP 入口上，**到期扫描执行的任务走不到**。
- 结论：现在通过任务中心创建的 🏠 `push`/`agent` 任务，到点会执行，但**结果不会送到任何人手上**。这就是弹窗里连「通知目标」字段都没有的真实原因——底层还没有那个能力。

`notify_user` 已在本轮补上通道（`bot` / `auto` / `plugin`，见 § 十一），但 `delegate_agent` 这条路径还没有。

### ✅ 已核实：RingCentral 凭据早就在 memory-service 落库了，不需要新建

用户提示「设备池里应该有 RingCentral token 记录，追问功能要用」——核实属实，且比预想的更完整：

| 事实 | 证据 |
|---|---|
| 凭据字段已在 per-user runtime config | `runtimeConfig.ts:50-53` —— `ringCentralServerUrl` / `ringCentralClientId` / `ringCentralClientSecret` / `ringCentralJwt` |
| 持久化在 per-user `runtime-config.json` | `runtimeConfig.ts:91 readPersistedConfig(userDataManager)` |
| **`GET /config` 已按布尔脱敏，不回传明文** | `routes/config.ts:245-249` —— `ringCentralClientSecretConfigured` / `ringCentralJwtConfigured` |
| 「追问」正是用这份凭据 | `RingCentralClient` 默认从 `getUserRuntimeConfig()` 取（`RingCentralClient.ts:334`），OutreachEngine 用它发起/收取追问 |
| Sheet 侧凭据是**另一份**，且刻意不落库 | `agentTasks.ts` 的 `asmeSender` 每次请求临时传入，注释明写 "not persisted" |

**修正上一轮的判断**：我此前认为「AsMe 落库是新增的安全姿态改变」，这是错的——**后端本来就存着同一套 RingCentral 凭据，且脱敏机制已经就位**。所以 AsMe 推送要做的不是新建凭据表，而是：

1. 让 `delegate_agent` / `notify_user` 的投递层在 `via=asme` 时，**复用 `getUserRuntimeConfig()` 里已有的 RingCentral 凭据**构造 `RingCentralClient`（不传 `explicitCredentials` 即可，默认就走这份）。
2. `agentTasks.ts` 现有的 `asmeSender` 临时传入路径**保留不动**（☁️ lane 由 Sheet 传入的仍然优先），只在没有临时凭据时回落到 runtime config——与 notify-config 的「body 优先、表兜底」同构。

### 待决策：凭据要不要反向复制一份给 Google Sheet

用户提出的关键点：**Sheet + Giraffe 可以脱离 memory-service 独立跑定时推送**，所以 L2 用户的 Sheet 侧也需要这份凭据。

现状是「两份各存各的」：扩展在 Sheet Config 页存一份（`ringcentral_sender_*`），memory-service 在 runtime config 存一份。两边可能不一致，用户要配两次。

三个候选方向（**尚未实施，需要决策**）：

| 方案 | 做法 | 优点 | 风险 |
|---|---|---|---|
| A 单向下发（推荐候选） | memory-service 为真源；扩展在保存凭据时同时写 runtime config，并在 L2 已配置时**由扩展**镜像写一份到 Sheet Config | 用户只配一次；Sheet 侧保持独立运行能力 | 需要明确「谁是真源」，避免 Sheet 侧手改后被覆盖 |
| B 各存各的（现状） | 不动 | 零改动 | 用户配两次；两边不一致时难排查 |
| C Sheet 为真源 | memory-service 每次执行前从 Sheet 拉 | 单一真源 | memory-service 无 Google 凭据，做不到；且违背「Sheet 降只读镜像」的 Phase 4 方向 |

倾向 A，理由与 Sheet 镜像行同构：**写 Sheet 的动作必须由扩展执行**（Google token 只在扩展手里），memory-service 不可能反向写。但需要先确认一件事：Sheet Config 里的凭据被 Jira Rule 模板在部署时内联替换（`JiraRuleUpdater.ts:406 replaceRingCentralSenderPlaceholders`），**改凭据可能需要重新部署 Jira 规则**才生效——这决定了 A 方案的真实成本，实施前必须核实。

### 未完成清单（按优先级）

**P0 —— 让 🏠 lane 的 push/agent 真正能投递**（没有这个，弹窗加再多字段也是空的）
- [x] `delegateAgent()` 执行成功后接投递：复用 `planAgentTaskNotifications` 的分支表（result → 目标；success/failure receipt → owner），把它从 `routes/agentTasks.ts` 抽成可被 executor 复用的模块
- [x] 投递身份支持 `bot` / `asme` / `plugin`；`asme` 复用 runtime config 里已有的 RingCentral 凭据
- [x] 投递失败沿用已有的可见化约定（写 `metadata.notifyDeliveryError` + 私发 owner）

**P1 —— 补齐 L0 的能力面**（目标：没配 L2 也能用全套）
- [x] **AI Report**：🏠 lane 走 `run_http_push`（默认 Dify `POST /v1/chat-messages`）。鉴权用 env `DIFY_API_KEY` 或任务 `aiHeaders`，不复制 Sheet 侧硬编码 Bearer。memory-service 主机到 Dify 的网络可达性未在本轮对生产环境实测。
- [x] **帮我问（Outreach）**：`taskKind=outreach` → `ask_external_user`，接既有 OutreachEngine
- [x] **帮我做（AgentTask）**：已可用，投递见 P0
- [x] 新建弹窗按类型补齐字段：推送身份（Bot/AsMe/插件通知，未配置的置灰 + 说明）、通知目标（私发/群组 + 群组 ID）、AI Report 的 JQL / Team ID / 补充说明

**P2 —— L1 定义与 UI 对齐**
- [x] L1 检测同时认 Bot 与 AsMe（任一配置即部分解锁；两者都缺才是完全未解锁）
- [x] 引导抽屉的 L1 步骤列出两条通道各自的状态与配置入口
- [x] 文案：「稍后提醒」Tab 改名为「**提醒我**」（更贴近动作而非状态）

**P3 —— 凭据统一**（依赖上面的决策）
- [ ] 确认改 Sheet 凭据是否需要重新部署 Jira 规则
- [ ] 按决策实施 A 方案：扩展保存时双写，Sheet 侧作为 L2 的独立运行副本

**已完成（本轮）**
- [x] Phase 2 全部：worker lease 续租、公共池 claim + 空闲判定、file artifact 契约
- [x] 稍后提醒改写账本 API（不再需要 Google OAuth 和已初始化表格）
- [x] `notify_user` 支持投递通道（bot / auto / plugin）
- [x] 能力条压缩为一行 + 引导式初始化抽屉（直达真实配置页）

### 12.1 凭据同步方向的裁决：不是双向同步，是「单一真源 + 一次性收编 + 持续下发」

用户追问：「所以这个复制应该是双向的？L2 配置完也应该存一份 memory service？」

**问题成立，但答案不是「双向同步」**——双向同步同一份密钥有个经典且致命的失败模式：两边都改过时无法判断谁更新，而凭据一旦取到旧值，**失败是静默的**（推送不出去，或更糟：让一个已吊销的凭据复活）。所以正确形态是三段式：

```
                    ┌── 一次性收编（Sheet → MS）：仅在 MS 为空时
配置面（任一）──▶ memory-service（唯一真源）
                    └── 持续下发（MS → Sheet）：L2 已配置时，由扩展镜像写
```

| 方向 | 时机 | 触发者 | 语义 |
|---|---|---|---|
| **收编** Sheet → memory-service | 一次性：L2 检测到 / 存量用户接入时，且 **memory-service 侧为空** | 扩展 | 让存量用户不必重配。MS 已有值时**不覆盖**——避免旧 Sheet 值盖掉新配的 |
| **下发** memory-service → Sheet | 持续：每次凭据保存后，若 L2 已配置 | 扩展（Google token 只在扩展手里，MS 无法反向写） | Sheet 侧是**派生副本**，供 Sheet+Giraffe 脱离 MS 独立运行 |
| ~~Sheet → MS 持续同步~~ | ❌ 不做 | — | 这才是「双向」，会产生 split-brain |

### ⚠️ 已核实的硬成本：改凭据必须重新部署 Jira 规则

这是决定上述方案可行性的关键事实，已核实：

- `JiraRuleUpdater.ts:63-92` 的 `getRingCentralSenderReplacements()` 把 `clientId` / `clientSecret` / `jwt` **明文烤进 Jira 规则的 payload**（`{{RINGCENTRAL_SENDER_JWT}}` 等占位符在部署时被替换）。
- 也就是说 Sheet Config 里的那份凭据**不是 Jira 运行时读取的**——Jira 规则里存的是部署那一刻的快照。
- **推论**：「下发到 Sheet」只写 Config 格子是**不够的**，必须连带重新部署 Jira 规则，凭据才真正对 ☁️ lane 生效。而 [§ 二 Case 4](#) 已证实，**受管 Google 账号的域策略当前禁止重新部署**（`ANYONE access has been disabled`）。

**这带来一个必须正视的结论**：对于域策略受限的用户（也就是当前的你），☁️ lane 的 AsMe 凭据**事实上是冻结的**——改了也部署不上去。因此：

- 下发路径要**显式检查部署能力**，部署失败时明确告知「Sheet Config 已更新，但 Jira 规则仍持有旧凭据，☁️ lane 的 AsMe 推送不会用新值」，而不是静默地让用户以为改好了。
- 这反过来强化了 🏠 lane 的价值：**L0/L1 的 AsMe 推送不受此限制**（memory-service 直接用 runtime config 的凭据，不经 Jira 规则），所以域策略受阻的用户走 🏠 反而是更可靠的路径。

### 12.2 修订后的 P3（凭据统一）

- [x] 核实凭据存储现状：memory-service 已有（`runtimeConfig.ts:50-53`）且已脱敏（`config.ts:245-249`）
- [x] 核实两个配置面：Options 写 MS（`options.tsx:3504`）、定时消息页写 Sheet Config，互不相通
- [x] 核实改凭据是否需重新部署 Jira 规则：**需要**（`JiraRuleUpdater.ts:63-92` 明文内联），且域策略下可能部署失败
- [ ] **收编**：扩展在 L2 检测 / 存量接入时，若 MS 侧凭据为空则从 Sheet Config 导入一次（不覆盖已有值）
- [ ] **下发**：凭据保存后若 L2 已配置，由扩展镜像写 Sheet Config
- [ ] **下发后的部署提示**：尝试重新部署 Jira 规则；失败时给出明确回执（区分「MS 侧已生效」与「☁️ lane 仍是旧凭据」），复用 `AppScriptDomainPolicyAccessError` 的错误分类
- [ ] UI：凭据配置处标注「此凭据同时用于：追问、AsMe 推送（🏠 lane 即时生效；☁️ lane 需重新部署 Jira 规则）」
- [ ] 冲突可见化：若检测到 Sheet Config 与 MS 两侧凭据不一致，在能力条 / 引导抽屉里提示，而不是任其分叉

---

## 十二、宿主选型实测：OpenClaw vs Hermes（2026-09-01，全部一手证据）

### 三个实测点的结论

**① memory plugin 能否整体替换后端 → ✅ 能，两家都能**
- OpenClaw：官方文档明确 "Both tools (memory_search/memory_get) are provided by the **active memory plugin** (default: `memory-core`)"，且有官方替换先例 memory-lancedb；active plugin "owns recall, promotion, and dreaming"（`node_modules/openclaw/docs/concepts/memory.md`）。写一个 memory-service backed 插件是一等路径。
- Hermes：更成熟——`plugins/memory/` 下已有 **8 个官方 memory-provider**（honcho/mem0/supermemory/byterover/hindsight/holographic/openviking/retaindb），AGENTS.md 明文 ABC+orchestrator 设计哲学。

**② 主动发消息 → ✅ 存在且实测通过（差最后一步真发）**
- `openclaw message send --channel <ch> --target <t> --message` 是核心 CLI（10+ 渠道）；本机 dry-run 实测：`[dry-run] would run send via imessage` ✅。
- 意外发现 A：核心自带 `--presentation` JSON（text/context/divider/**buttons/select**，按渠道能力降级渲染）+ `poll`——出站结构化交互的抽象已内置。
- 意外发现 B：**BlueBubbles server（127.0.0.1:1234）实际未监听**——channels status 显示 connected 是陈旧状态，iMessage 通道当前是坏的，需重启 BlueBubbles server。
- 真发验证卡在：iMessage server down；RC dmPolicy=disabled 只能发白名单群（群里可能有他人，未擅自发）。恢复 BlueBubbles 后一条命令即可完成验证。

**③ 按钮/快捷回复 → ✅ 比预期好**
- 自研 openclaw-ringcentral 插件**已实现 Adaptive Card**（actions-adapter：create/get/update/delete-adaptive-card）——Glip 真按钮就绪。
- iMessage 无按钮（渠道天限），走文本回复协议降级。
- OpenClaw presentation 抽象天然承担"富渠道按钮、穷渠道降级"。

### "让 OpenClaw 不写自己的 MD、改写 memory-service"可行吗？

可行但要分层理解，OpenClaw 记忆有两层：
- **检索层**（memory_search/memory_get）：由 active memory plugin 提供 → 整体替换指向 memory-service /recall，干净。
- **注入层**（MEMORY.md + memory/YYYY-MM-DD.md，bootstrap 注入 + session-memory hook 写入）：这是 workspace 文件约定 + agent 行为习惯，**不能也不必完全禁掉**——务实做法是让 MD 层降级为"会话工作缓存"，蒸馏动作改为调 memory-service ingest（memory_save 走 salience/probation 管线）。

**Side effects（按严重度）**：
1. **双梦冲突（最重要）**：OpenClaw memory-core 有自己的 promotion/dreaming，memory-service 有反思/巩固/做梦——两套生命周期同时跑会演绎出两个分叉的"记忆人格"。**治理必须单归 memory-service**，替换插件时禁用 OpenClaw 侧 dreaming。
2. 在线依赖：memory-service 宕机 = OpenClaw 失忆（本地 memory-core 永远在线）。缓解：插件带本地只读缓存降级。
3. 多 agent scope：十一/小黑/小张三个 agent 各有 workspace，统一后端需定 agentId→scope 映射，防止代码 agent 的工作笔记污染主记忆。
4. 写入安全：OpenClaw 侧 auto-approve 的 agent 能写记忆 → 全部走 probation + 注入闸门（两者 memory-service 已有）。
5. 轻微延迟：本地 sqlite ~ms → HTTP ~几十 ms，可忽略。

### OpenClaw vs Hermes

| 维度 | OpenClaw 2026.7.1（在用） | Hermes（NousResearch，239k★，日更） |
|---|---|---|
| 语言 | TypeScript/Node | Python (uv) |
| 你的渠道 | ✅ BlueBubbles 在用 + 自研 RC 插件（Adaptive Card） | ✅ BlueBubbles 内置；❌ **RingCentral 没有**，你的 TS 插件得用 Python 重写 |
| memory 插件位 | ✅ active plugin 槽位 | ✅✅ provider ABC，8 个官方先例 |
| 学习闭环 | memory-core + dreaming + heartbeat | **自主 skill 创建 + skill 使用中自改进** + Honcho 用户建模 + FTS5 跨会话搜索（差异化最强点） |
| 部署 | 本机 gateway | 7 种 backend，含 Modal/Daytona **serverless 常驻**（不绑 Mac，空闲≈零成本） |
| 模型/token | BYO：你已配免费内网 OneAPI + model-router cheap/hard 分流——已是省钱型 | 同样 BYO + `hermes model` 切换；**token 成本两者无差**（由模型选择决定），Hermes 省的是基础设施费 |
| 与 memory-service 既有集成 | ✅ 四条：gateway executor / skill sync / 设备配对 / A2A | ❌ 零，全部重建（官方有 `hermes claw migrate` 但迁不了 TS 插件） |

**裁决**：就意图收集箱这个目标，**留在 OpenClaw**——渠道就绪（RC 插件是你的 TS 资产）、四条集成现成、memory 插件可行性两家等同（不构成换的理由）。Hermes 值得持续观察的两样：skill 自改进闭环、serverless 常驻（恰好回应 memory-service 单点顾虑）。（勘误：社区体量不是 Hermes 优势——GitHub API 实测 openclaw/openclaw ★388k > hermes-agent ★239k，两者都日更。）**保险策略已内置**：坚持"瘦管道厚服务"——车道判定/聚类/合成全在 memory-service，宿主侧只是转发+渲染；Hermes 有 a2a platform 插件、memory-service 有 A2A 路由，未来切换或双跑的成本被压到一个插件的厚度。

其他同类（训练知识，非本轮实测）：Letta 偏开发者框架无聊天渠道矩阵；khoj 偏个人知识检索；大厂托管（ChatGPT Pulse/Tasks）不可插自有记忆。"自托管+多渠道+可插记忆"交集里 OpenClaw 与 Hermes 即两强。

**token 性价比落点**：意图收集箱新增成本 = 每碎片一次车道判定（小模型）+ 夜间合成（中模型）。设计上直接把判定/聚类路由到你的免费内网 OneAPI（gpt-5.5/5.4 成本为 0），合成用 cheap 档——新功能的边际 token 成本可以压到近零，与宿主选择无关。

---

## 十三、宿主之外的方案、"替换整个记忆层"的真实风险、memory-service 的胜任度（2026-09-02）

### 1. 除了 OpenClaw / Hermes 还有什么（GitHub API 实测体量）

| 家族 | 产品 | 体量 | 与本方案的关系 |
|---|---|---|---|
| 自托管个人 agent 网关 | **openclaw/openclaw**（在用） | ★388k · TS · 日更 | 渠道就绪（BlueBubbles + 自研 RC），四条既有集成 |
| | NousResearch/hermes-agent | ★239k · Py · 日更 | 8 个 memory-provider，无 RC 渠道 |
| | HKUDS/nanobot | ★47.6k · Py · 日更 | 超轻量、MCP/cron/Dream 记忆、Telegram/Discord/Slack/微信/飞书/Teams/Email；**无 iMessage、无 RC** |
| | agent0ai/agent-zero | ★19k · Py | 通用 agent 框架，渠道网关不是重心 |
| 非网关（不适合当宿主） | khoj-ai/khoj ★36.9k | 第二大脑问答型 | 没有对话渠道矩阵 |
| | letta-ai/letta ★24.5k | 有状态 agent 平台（API 优先） | 是"记忆优先 agent 框架"，不是聊天宿主 |
| **外挂记忆层品类**（memory-service 的同类） | mem0ai/mem0 ★64.5k | "Drop-in memory infrastructure for AI agents"，README 列 LangGraph/CrewAI 集成，且**提供面向 OpenClaw 的 skill** | 证明"给 agent 外挂记忆服务"是有商业公司的成熟品类 |
| | getzep/graphiti ★30.5k、plastic-labs/honcho ★7k、supermemory | 同上 | Hermes 的 8 个 provider 里有 honcho/mem0/supermemory |
| **不用第三方宿主** | memory-service 自建专用小回路 | — | 意图收集箱只需"分类→存→回卡→确认"，不需要通用 agent 的浏览器/代码能力；OutreachEngine 已有"外呼+收回复分类"先例、BotSender 出站现成；**零真源冲突**。代价：这条线里没有"十一"的人格与工具生态，且 iMessage 仍依赖 BlueBubbles server |

结论：宿主选型是"两条腿"——**通用对话面**（留 OpenClaw）与**意图收集专线**（可以是 OpenClaw 插件，也可以是 memory-service 直连 bot）。取舍点只有一个：你想不想让"记一笔"和"跟十一聊天"是同一个对话线程。

### 2. "替换整个记忆存储层"是伪命题——OpenClaw 提供三档接入深度（本地 SDK 文档一手证据）

| 档位 | 接口 | 替换了什么 | 工作量 | 主要 side effect |
|---|---|---|---|---|
| **L1 附加式** | `registerMemoryCorpusSupplement({ search(query,maxResults), get(lookup,fromLine,lineCount) })` + `registerMemoryPromptSupplement/Section` | **什么都不替换**：memory-service 成为第二检索语料，并可注入一段 context brief；memory-core 照旧 | 两个方法，约一天 | 两个语料可能返回重复/矛盾条目 → 结果打来源标签；每次检索 +1 次 HTTP |
| **L2 旁路捕获** | 事件钩子 `agent_end`（最终消息）/ `llm_input`（完整 prompt+history）/ `before_prompt_build`（注入动态上下文） | 不替换，只**镜像**对话流进 memory-service | 一个 hook 插件 | 同一句话进两套记忆（OpenClaw session-memory hook 也在写每日 md）→ 明确 memory-service 为超集归档，靠其 merge/probation 去重 |
| **L3 独占替换** | manifest `kind: "memory"` + `registerMemoryCapability` + `plugins.slots.memory` | **整个记忆层**：recall / promotion / dreaming 全归你 | 最重 | 双梦冲突（必须关一边）；bootstrap MEMORY.md 要由 memory-service 渲染；离线即失忆；三 agent scope 映射 |

官方 memory-lancedb 就是 L3 的先例（`openclaw plugins install` 自动切 `plugins.slots.memory`，"only one plugin owns the active memory slot at a time"）；它的 autoCapture 就是 L2 的先例（`agent_end` 事件 + 触发短语 `remember/记住/覚えて` + 每轮最多 3 条 + 拒绝注入载荷/信封元数据）；OpenClaw 自带的 active-memory 插件（"a blocking memory recall sub-agent before the main reply"）则证明**环境式召回在 OpenClaw 里已是原生机制**，L1 的 supplement 会被它一并检索到。

**业内是否有人这么做**：是常规操作——Hermes 用户换 memory provider 是配置项；mem0 整个公司的定位就是给任意 agent 换/加记忆层；OpenClaw 官方自己发布替换插件。做法本身不冒险，冒险的是**一步到 L3**。

### 3. memory-service 能否胜任 OpenClaw 的记忆服务——分三个角色回答

| 角色 | 结论 | 证据 |
|---|---|---|
| 检索后端（memory_search/get） | **今天略逊，差一项** | 两边同代：都是关键词+向量 hybrid + MMR（RecallEngine `MMR_LAMBDA=0.7`、多通道合并）。差距：OpenClaw 有**查询时**时间衰减（dated 日记衰减、MEMORY.md 常青）；memory-service 的 recency 只在 SalienceScorer（写入显著性，`RECENCY_LAMBDA=0.01`）用，RecallEngine 排序没有时间维度。补上查询时衰减后持平。**（勘误：此前把这条差距说成"你在需求 C 里抱怨过"是错的——需求 C 是 journey demo 里我虚构的示例场景，不是用户反馈。差距本身经 grep 核实为真，但没有用户抱怨作为证据。）** |
| 长期记忆系统 | **远超** | probation / forgetting / consolidation / TruthMaintainer 双时态 / lineage / 注入筛查 / 多来源摄入（网页、Glip、会议）/ 反思→行动。OpenClaw memory-core 只是 agent 自己的笔记本 |
| bootstrap MD 供给方（仅 L3 需要） | **目前不胜任，但原因不是管线坏了** | 见 §13.5 的更正诊断：渲染代码健康，是数据源枯竭（本地库 `user_profile_items` 仅 3 行）+ "Current Focus" 要求 last_seen 在 7 天内 → 输出 "(no recent focus items)"。L3 前必须先让画像抽取跑起来 |

### 4. 落地路径（按风险递增，每步可停）

1. **L1 先上**：supplement 两个方法接 `/recall` + `memory_context_brief` 注入 → "十一"立刻能查到 memory-service 的记忆，零替换、零冲突。
2. **L2 加旁路**：`agent_end` hook 镜像对话进 memory-service（意图收集箱的写路径），显式触发短语走同步车道判定。
3. **A/B 召回质量**：同一批真实查询对比 memory-core vs memory-service 结果；同时补 RecallEngine 查询时时间衰减（需求 C）。
4. **再议 L3**：只有当 A/B 显示 memory-service 检索不差、且 MD 渲染管线复活后，才考虑接管 slot 并关掉 OpenClaw 侧 dreaming。

双梦冲突、离线失忆、bootstrap 供给——这三个最重的 side effect **只在 L3 出现**；前三步一个都碰不到。

---

## 十三补充（2026-09-02 复核）

### 13.5 数据来源勘误 + USER_CORE 的真实病因

**勘误：本仓库 `memory-service/data/` 是开发快照，不是线上生产库。**证据：`users/esone.qiu/memory.db` 里 chunks 最新 2026-04-10、proposed_actions 最新 2026-04-08、reflection_threads 最新 2026-04-08；`analytics/usage.db` 仅有 `user_id='test'` 的 87 条事件。而用户 8 月 27-28 日真实跑过的 AgentTask（Run `cae4731e…`/`51c8acab…`）在此库中不存在 → **线上实例在别处**（另一台机器或另一个 DATA_DIR）。

影响范围：
- 第七章的 **37 条定时任务是真实的**（直接从线上 Google Sheet 全量导出，不受影响）。
- 第七章的 **"205 条 queued 反思候选 / 去重 83 主题"是 4 月的开发快照**，不代表当前线上积压。结论方向（反思候选会重复堆积、上账本前必须聚类去重）仍然成立，但**数量级需要在线上库重新测量**。

**USER_CORE 的真实病因（推翻"渲染管线名存实亡"）**：渲染代码是健康的——`ConsolidationEngine` 有完整的 USER_CORE 重建逻辑（`:692-815`，写盘 + reindex），`HeartbeatLoop:214` 有 `checkProfileDirty()` 按需触发。真实原因是两层：

1. **数据源枯竭**：本地库 `user_profile_items` 全表**仅 3 行**（fact×2 最新 2026-03-17、preference×1 最新 2026-03-16）——画像抽取几乎从未积累。
2. **7 天窗口过滤**：`## Current Focus` 只收 `last_seen >= sevenDaysAgo` 的条目（`ConsolidationEngine:732`），3 条老数据全部落窗外 → 输出 `- (no recent focus items)`。

### 13.6 新增修复项：P0-4 复活用户画像供给（L3 的前置门槛）

**目标**：让 `USER_CORE.md` / `CORE_MEMORY.md` 有真实内容，从而具备给 OpenClaw 做 bootstrap 注入的资格。

1. **先在线上库测量**，不要基于开发快照下结论：`SELECT item_type, COUNT(*), MAX(last_seen) FROM user_profile_items GROUP BY 1` + `SELECT COUNT(*) FROM chunks WHERE created_at > <30天前>`。判断是"抽取没跑"还是"抽取跑了但不写画像"。
2. **按测量结果二选一**：
   - 若摄入本身停了（chunks 无新增）→ 属于摄入链路问题，先修摄入，画像自然恢复。
   - 若摄入正常但画像仍空 → 查 `IngestionPipeline`→`user_profile_items` 的写入条件（阈值过严 / 抽取 prompt 失效 / ProfileManager 未被调用）。
3. **放宽 Current Focus 的时间窗**：7 天对低频个人用户过窄。改为"优先 7 天内；不足 5 条则按 salience 回填 30/90 天内的条目，并标注 `(stale, last seen YYYY-MM-DD)`"——避免整节空白，也不假装是新鲜关注点。
4. **验收**：`USER_CORE.md` 体积 > 1KB 且 Current Focus 至少 3 条真实条目；`openclaw` 侧 L1 注入后能在会话里自然引用其中至少 1 条。

排期：**L3 的硬前置**；与 L1/L2 无依赖关系，可并行推进。

### 13.7 L1 / L2 / L3 的关系与改动形态（回答"是否替换性、要不要插件"）

**关系：L1 与 L2 是叠加的（正交、可共存）；L3 只替换 memory-core，不替换 L1/L2。**

| | 干什么 | 与其他档的关系 |
|---|---|---|
| L1 | 加一路检索语料 + 注入一段 brief（读路径） | 与 L2 正交；L3 之后仍可保留（但若 L3 已接管 recall，L1 就冗余了） |
| L2 | 镜像对话流进 memory-service（写路径） | 与 L1 正交；**L3 之后依然需要**——L3 换的是 recall/promotion，L2 是"把原始对话喂给意图收集箱"，职责不同 |
| L3 | 接管 `plugins.slots.memory`，memory-core 被禁用 | 只与 memory-core 互斥（"only one plugin owns the active memory slot"）。**不影响 L1/L2 的代码**，但会让 L1 变得多余 |

所以正确的心智模型不是"L1→L2→L3 逐步升级替换"，而是：**L2 是意图收集箱的必需项（写），L1 是低风险的读增强，L3 是可选的深度整合**。走完 L1+L2 就能完整支撑 journey demo，L3 只解决"让 OpenClaw 的原生记忆也统一到 memory-service"这个额外目标。

**都需要写插件，改配置不够。** `registerMemoryCorpusSupplement` / `registerMemoryPromptSupplement` / 事件钩子 / `registerMemoryCapability` 全部是插件 SDK 的 `api.register*` 调用（`docs/plugins/sdk-overview.md:178-179, 434-437`），必须打包成一个 OpenClaw 插件（manifest + JS）。纯配置能做的只有三件事：
- 在**已安装**的插件之间切槽位（`plugins.slots.memory`）；
- 切到 QMD 本地 sidecar（`memory: { backend: "qmd" }`）——但 QMD 索引的是**磁盘文件**，不是 HTTP 服务，指不到 memory-service；
- 配置嵌入 provider（你已经在用内网 `ringcentral-qwen3-embedding`）。

**唯一的"零插件"取巧路径**：memory-service 定期把摘要导出成 MD 写进 `~/.openclaw/workspace/memory/`，让 memory-core/QMD 自然索引到（即早期 memory-share 文档里的"架构 B 共享 MD 文件夹"）。代价：单向只读、有同步延迟、无法回写、无结构化回卡——只能当过渡验证，撑不起 journey demo。

**好消息**：你已经有插件开发资产——`~/git/openclaw-ringcentral` 是自研插件（含 Adaptive Card 全套），`plugins.load.paths` 已配置本地插件加载目录，所以"再加一个本地插件"是走通过的路，不是新流程。

### 13.8 外挂记忆层产品（mem0 / zep / honcho）能否移植使用

**结论：不移植、不采用，但值得抄两个设计。**

不采用的三个理由：
1. **定位重叠 95%**：mem0/zep/honcho 解决的正是 memory-service 已经解决的问题（存储、召回、去重、画像）。而 memory-service 多出来的部分恰恰是你的核心资产：TruthMaintainer 双时态、probation/forgetting 生命周期、注入防御闸门、反思→行动闭环、多来源摄入（网页/Glip/会议）、与任务账本同库同事务。引入它们等于用一个更弱的子集替换一个更强的超集。
2. **数据主权与部署**：mem0/supermemory 主推托管云（OSS 版功能滞后），把个人记忆搬出自托管边界与本项目"自托管个人记忆系统"的定位冲突。zep/graphiti 需要 Neo4j，honcho 需要独立服务——都是给单人维护再加一个运维目标。
3. **迁移成本无收益**：你的记忆已经在 sqlite-vec + FTS5 里，935 chunks（开发库）在线上更多，schema 有 60+ 迁移。搬库换不来任何新能力。

**值得抄的两个设计**：
- **mem0 的"drop-in adapter"分发方式**：它给 OpenClaw/Claude Code/Cursor 都提供了现成的接入 skill（`npx skills add … --skill mem0-integrate`）。这正是我们缺的东西——把"memory-service 接入 X 宿主"做成可分发的适配器（一个 OpenClaw 插件 + 一个 MCP server 已经在手），而不是每次手工接线。
- **honcho 的 dialectic user modeling**（Hermes 已内置采用）：它专门解决"从对话流里持续推断用户模型"——正是 §13.6 里 `user_profile_items` 枯竭要解决的同一个问题。可以参考它的抽取策略，但用自己的实现。

**唯一可能真正引入的场景**：如果将来想让 memory-service 支持"多种记忆后端"（像 Hermes 那样 8 个 provider），那时 mem0 可以作为**其中一个可选 provider** 存在。但那是 memory-service 长成平台以后的事，不是现在。

### 13.9 自建专线如何对接 RingCentral / 微信（回答"是否也要自建、有必要吗"）

先看你已有什么：
- **RingCentral 出站**：memory-service 已有 `BotSender`（Bot API 私发/群发）+ `RingCentralClient`（AsMe 身份发送）→ **零新建**。
- **RingCentral 入站**：`OutreachEngine` 已实现"主动外呼 + 收回复 + LLM 分类"的完整闭环 → 入站回复处理**有现成先例**，但需要接 webhook/订阅。
- **Adaptive Card**：`openclaw-ringcentral` 插件里有全套 create/update/delete → 但那是**在 OpenClaw 侧**，memory-service 自建专线要用得重新实现一遍 RC card API 调用（工作量小，RC API 是公开的）。
- **微信**：memory-service 侧**完全没有**。自建要处理个微协议（不稳定、有封号风险）或企业微信（需企业应用审批）。

所以答案是：
- **对接 RingCentral：不需要"自建"，只需要补入站 webhook**（出站/身份/分类全都现成）。这是自建专线里成本最低的一环。
- **对接微信：需要真自建，且不建议**。微信生态的对接成本和风险（个微封号 / 企微审批）远高于收益，而 OpenClaw/nanobot 已经把这块封装好了——如果微信是必需渠道，那答案就是"用宿主"而不是"自建"。
- **有必要自建吗**：只有当你希望"记一笔"与"跟十一聊天"是**两个独立入口**时才有必要。如果希望同一个对话线程既能闲聊又能记账，自建专线就是在重复造 OpenClaw 已有的对话面。

### 13.10 三家族综合评分与最终建议

评分维度（1-5，越高越好），针对"支撑 journey demo 的意图收集箱"这一具体目标：

| 维度 | ① OpenClaw 插件（L1+L2） | ② 换宿主（Hermes/nanobot） | ③ memory-service 自建专线 |
|---|---|---|---|
| 渠道就绪（iMessage+RC） | **5**（BlueBubbles + 自研 RC 插件在跑） | 2（Hermes 无 RC；nanobot 无 iMessage 无 RC） | 2（RC 出站现成、入站要补；微信要重造） |
| 落地工作量 | **4**（一个本地插件，已有插件开发资产） | 1（重写 RC 插件 + 重建四条集成） | 3（专线小回路，但入站/卡片要补） |
| 真源冲突风险 | 3（L1/L2 低；L3 才有双梦冲突） | 3（同 OpenClaw，且要重新验证） | **5**（零冲突） |
| 复用既有资产 | **5**（gateway executor / skill sync / 设备配对 / A2A 四条） | 1（全部归零） | 4（BotSender / OutreachEngine / LLMClient） |
| 对话体验（人格+工具生态） | **5**（十一/小黑/小张 + 全套 skill） | 4（Hermes 学习闭环更强，但要重建） | 2（只有一个记账 bot，无人格无工具） |
| 长期演进（不锁死） | 4（瘦管道设计使宿主可换） | 3 | **5**（不依赖任何宿主） |
| 单人维护负担 | **4**（插件薄，逻辑在服务端） | 2（跨语言重写 + 双栈维护） | 3（多一条入站链路要维护） |
| **加权总分** | **30/35** | 16/35 | 24/35 |

**建议：① OpenClaw 插件（L1 + L2），并保留 ③ 作为退路。**

理由：② 换宿主在当前目标下纯亏——Hermes 的两个真优势（skill 自改进、serverless 常驻）都不是意图收集箱需要的，代价却是渠道资产归零。③ 自建的唯一强项是零冲突，但 L1/L2 本身也不引入真源冲突（冲突只在 L3），所以这个优势被抵消，剩下的是"没有人格和工具生态"的体验损失。① 在渠道、工作量、资产复用三个关键维度上全面领先。

**并且方案里已内置了"选错的保险"**：坚持第十一章的"瘦管道厚服务"——车道判定、聚类、合成全在 memory-service，OpenClaw 插件只做转发和渲染。真要换宿主或转自建，重写的只是那层薄插件。
