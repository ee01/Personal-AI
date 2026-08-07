# Agent 执行架构改进 Plan（Agent Task / 反思查证 / 协议分层）

日期：2026-08-07
来源：ChatGPT 对话「Personal AI - Agent任务稳定性优化」结论 + 本仓库源码验证
状态：待决策（每个 Block 有独立的「采纳/不采纳」开关，Block 间依赖已标注）

---

## 0. 源码验证结论（ChatGPT 论断 vs 实际代码）

| 论断 | 验证结果 | 代码位置 |
|---|---|---|
| AgentTask 是同步长链路：创建 action → await 执行 → LLM 格式化 → 等通知投递 → 才返回 200 | ✅ 属实 | `memory-service/src/routes/agentTasks.ts:428-576` |
| executor 只允许 openclaw | ✅ 属实 | `agentTasks.ts:396-402` |
| 幂等键兜底用 `Date.now()`，重试即产生新任务 | ✅ 属实 | `agentTasks.ts:415-417` |
| OpenClaw 对接为单次非流式 `/v1/responses`，本地 AbortController 超时，未保存 remote run ID/事件 cursor | ✅ 属实 | `integrations/OpenClawDelegationService.ts`（`stream: false`、`buildResponsesUrl`、超时后无 reconcile 依据） |
| success 必须带可验证 artifact（好契约，应保留并通用化） | ✅ 属实 | `OpenClawDelegationService.ts`（`hasVerifiableArtifact`，缺 artifact 的 success 会降级为 error） |
| `proposed_actions` 有 queue_status/retry/idempotency_key，但 idempotency 只是普通索引（非 UNIQUE），create 是先查后插，无 lease/heartbeat/fencing | ✅ 属实 | `storage/migrations/005_action_runtime.sql:42-43`（`CREATE INDEX`，非 UNIQUE）、`repositories/ActionRepository.ts` |
| MCP 已有 stdio 雏形，5 个工具，但只返回截断 summary，非证据级接口 | ✅ 属实 | `mcp/tools.ts`（memory_search / memory_ask / memory_save / memory_context_brief / memory_profile_hint） |
| 反思线程已走同一动作队列产生 `delegate_openclaw`，有确定性幂等键 + readiness 门控 | ✅ 属实 | `core/ReflectionThreadService.ts:928-1030` |
| Sheet 只记录计划/领取，执行账本以 memory-service 为准 | ✅ 属实（已写进通知文案约定） | `agentTasks.ts:167`；触发入口 `src/scheduled-messages/agentTaskWebhookConfig.ts` |
| OpenClaw 配置已按用户持久化，可经 API 修改 | ✅ 属实 | `runtimeConfig.ts:26-29`、`routes/config.ts`（`PUT /config`，含 openClaw* 字段） |

结论：ChatGPT 那份分析与本仓库现状高度吻合，可以直接作为改造依据。

---

## 0.1 实战验证：Cursor 排查记录「排查定时消息未触发 OpenClaw」（2026-08-04 ~ 2026-08-07）

来源：本机 Cursor 对话 `1bdbc5f2-bb65-4b0b-be8e-a03b160b8587`（413 条消息，跨 3 天，抽样对照 Sheet / memory-service / OpenClaw gateway 日志）。这是本 plan 的**必须对照依据**——下面 3 个是实测故障，不是推测。

### 故障 #1｜Sheet 假成功：请求根本没到 memory-service（抽样 5/10，权重最大）
- **链路**：Sheet → Apps Script(`doGet` 领取) → 302→echo → Jira Rule → Dify → `/agent-tasks/execute`（memory-service）→ OpenClaw。
- **根因**：`app-script-template.gs` 的 `markMessageOnFetchIfRequested`（`autoMarkOnFetch=api`）在**返回 JSON 之前**就把 Sheet 行写成 `✅ AgentTask 已触发 memory-service`；随后 302→echo 交接给 Jira 这一跳偶发 Google Web App 404 / 30s 超时，Jira 拿不到 payload，**根本没调用 Dify，更没到 memory-service**。Sheet 已经"假成功"，`isPushedSuccessfullyToday` 锁死当天不再领取。
- **范围**：完全在 memory-service **之外**——`src/scheduled-messages/app-script-template.gs`、`src/scheduled-messages/jira-rule-template.json`。
- **对照 Block A-H**：**不覆盖**。Block A 只解决了 memory-service 内部 `/agent-tasks/execute` 的同步阻塞和幂等键，但如果请求从没到达 memory-service，内部改多好都无意义。
- **需要新增**：见下方 **Block 0**。
- **排查时已提的修复方向（尚未落地，只加了 audit log v1.6.1）**：AgentTask 分支禁止在 fetch/claim 时写最终成功；Jira 拿不到 body（404/超时）时回滚该行状态或标 `trigger_delivery_failed`；领取路径加 `ScriptLock` 防并发抢队与半成功写盘。

### 故障 #2｜Artifact 校验形状不一致：OpenClaw 真做完了，memory-service 判失败（抽样 2/10）
- **根因**：`OpenClawDelegationService.ts` 的 `hasVerifiableArtifact` 要求 `metadata.observedFields` 必须是**字符串数组**；OpenClaw 部分响应把它做成**对象**（`{"url":"...","tabId":...}`），校验直接拒绝，标记为"缺少可验证 artifact"，即使任务真的执行成功。
- **对照 Block B**：✅ **本应覆盖，但原文措辞不够具体** —— 之前只写"契约通用化"，未点名这个 shape 校验 bug。
- **补充**：Block B 落地时必须显式修复 —— `observedFields` 接受 array 或 object（object 用 `Object.keys`/`key=value` 规范化），不能因为形状不同就整体判失败。

### 故障 #3｜Readiness 全局熔断连坐：一条失败，拖死整条 scope（抽样 1/10，但影响所有后续任务）
- **根因**：`ActionReadinessService` 对 `openclaw:agent_task:read` 契约是**scope 级熔断**——一次 artifact 校验失败（即故障 #2）就把整个 scope 标 `blocked_proof`，后续所有同 scope 任务连派发都不会派发，一直卡在 `queued`，需要手动做 readiness probe 才能解锁。
- **对照 Block A-H**：**原文没覆盖**。Block A 的状态机补充只提到 `input_required` 应可恢复，没有涉及"单次失败是否该封死整个 scope"这个策略问题。
- **需要新增**：见下方 **Block A 补充项**。
- **2026-08-07 新增实例**：`msg_1786094912393`（新 Nova 任务）表面报错和故障 #2 一样的文案（"OpenClaw 返回了 success，但缺少可验证 artifact"），一度被误认为是"本机 OpenClaw 挂了不响应"。核对本机 OpenClaw 日志（`~/Library/Logs/openclaw/gateway.log`）该时段只有 RC WebSocket `401 Token not found`，**没有任何这条任务的痕迹**——`startedAt: null`，`dispatchState: not_dispatched`，`readinessReceipt.checkedAt` 对应的是**上一条**并发 baidu 任务（`msg_1786094355197`，17:21:30）的 artifact 校验失败。也就是：readiness 门禁在**派发之前**就拦截了，OpenClaw 本身完全没被调用，不是网关挂了，也不是新故障，是同一个 scope 级熔断（故障 #3）的又一次触发，报错文案是旧 reason 被原样带回。

### 故障 #4｜OpenClaw 长任务连接中断（`fetch failed`）：已接单执行中途断连，而非超时或网关故障
- **发现于**：`msg_1786094012149`（Nova 关 Epics，`complex`/`default-strong` 路径）。
- **实测时间线**：
  | 时间 | 事件 |
  |---|---|
  | 17:14:49 | Jira claim，随即 `POST` Dify；Jira 30s 后超时（`SOME ERRORS`，但 payload 已发出） |
  | 17:15:18 | memory-service 创建 action |
  | 17:15:56 | OpenClaw **readiness probe 成功**（网关可达、鉴权通过） |
  | 17:15:57 | OpenClaw **正式开始跑** Nova |
  | 17:16:04 | 本机日志出现 `codex app-server one-shot cleanup retired shared client` |
  | 17:15:57 → 17:20:21 | **run 悬空约 4-5 分钟，从未写完成日志/`stopReason`** |
  | 17:20:58 | memory-service 收到底层 `fetch failed`，判 `queueStatus: failed`（耗时约 302s，**未触达** `openClawTimeoutMs`=10 分钟的 AbortController 超时） |
  | 17:21:30 | 同期并发的 baidu 任务在 OpenClaw 正常跑完（证明网关本身没挂） |
- **根因判定**：`fetch failed` 是 Node `fetch` 在网络层报的连接失败（连接被重置/挂断），**不是**业务级 JSON 错误，**不是**触发了 10 分钟超时（302s < 600000ms），**不是**网关整体故障（同时段网关能正常跑别的任务）。结合 `codex ... cleanup retired shared client` 紧跟在 run 启动之后、且此后再无任何该 run 的日志，最可能的解释是：**OpenClaw 接单并启动了 Nova 这次 run，但底层 Codex/complex 路径的长连接在执行中途被清理/挂死**，memory-service 只能在约 5 分钟后收到连接层失败，既不知道 run 是否还在跑，也不知道它是否已经完成。
- **和故障 #1（Sheet 假成功）的区别**：这条**完整走通了** Sheet→Jira→Dify→memory-service→OpenClaw，是**目前唯一真正"打到 OpenClaw 且失败"**的样本，不是上游管道断裂。
- **对照 Block A-H**：这正是 Block C 描述的场景本身——原文写"当前链路没有保存 remote run ID/event cursor/心跳，超时后只能知道外部操作可能已完成，但拿不到结果"，当时是基于 ChatGPT 的理论分析写的；现在有了实测实例，证明这不是假设，是真实会发生、而且发生在"长任务/复杂路径"这个具体场景下。
  - Block A（异步接单）能**缓解**：让 Jira 的 30s 超时和 Dify 的长等待与 memory-service 的实际执行解耦，减少上游因为同步等待被打断的压力，但**不解决**连接中途断开本身。
  - Block C（Gateway + remote run ID + reconcile）是**直接对症**的修复：断连后凭 remote run ID 去 OpenClaw 侧查真实状态（run 还在跑 / 已完成带 artifact / 确实失败），而不是把"连接层失败"直接等同于"任务失败"。
  - **Block C 目前解决不了的部分**：如果 OpenClaw/Codex 侧的 session 真的被清理掉、永远不会再产出结果，reconcile 也只能查到"没有这个 run 的记录"，等价于失败——这部分需要**在 OpenClaw/Codex 侧单独排查**（`complex`/`default-strong` 路径为什面对长任务会出现 `cleanup retired shared client` 而不产出 `stopReason`），不是 Personal AI 这边代码能修的，属于 Block C 之外的协作事项。
- **需要新增**：见下方 **Block C 补充项**（提升优先级 + 明确 reconcile 语义 + 标注 OpenClaw 侧协作事项）。

**结论**：原 Block A-H 能解决 #2（需要补充措辞明确化）、能直接对症 #4 的"连接断开后无法判定真实状态"这一半（另一半是 OpenClaw/Codex 侧的问题，Block C 管不到）；**不能**解决 #1（超出 memory-service 范围，权重最大）；#3 和它的新实例都已被 **Block A 补充项**覆盖。

---

## 1. 改造 Block 清单（决策用）

### Block 0｜Sheet/Apps Script/Jira 假成功修复 —— 新增，优先级最高
- [ ] 采纳
- **现状**：`app-script-template.gs` 在**确认交付给 Jira 之前**就把 Sheet 行标记成功（`autoMarkOnFetch=api`），Google Web App 302→echo 交接偶发 404/超时导致 Jira 收不到 payload，任务从未到达 memory-service，但当天已被锁死不再重试。实测占抽样失败任务的 5/10，是当前最大的失败来源。
- **改造**（沿用 2026-08-04 排查中子 agent 已给出的方向，但尚未落地）：
  1. `app-script-template.gs`：拆分「领取（claim）」与「确认成功（confirm）」两步——claim 时最多写 `pending`/`claimed`，不写最终 `✅`；只有在 Jira 侧确认收到 payload 后（或收到 memory-service 的执行结果回调后）才写最终状态。
  2. Jira Rule（`jira-rule-template.json`）：调用 Apps Script webhook 遇 404 / 无 body / 超时时，回滚该行状态或显式标 `trigger_delivery_failed`，不能让"发出去了"和"对方确认收到了"共用一个 ✅。
  3. Apps Script 领取路径加 `ScriptLock`，避免并发触发下的半成功写盘和抢队。
  4. 至少一侧需要有「重新校验」能力：定期扫描"Sheet ✅ 但 memory-service 无 action"的行（Cursor 排查里已手动做过这个对账，应固化成脚本或看板）。
- **涉及**：`src/scheduled-messages/app-script-template.gs`、`src/scheduled-messages/jira-rule-template.json`；不涉及 memory-service 代码。
- **风险**：Apps Script 线上模板需要用户手动在定时消息管理页升级/同步才生效（历史上 v1.6.1 只加了 audit log，这次要加真正的行为修复，必须提醒用户升级）。
- **依赖**：无，且**独立于 Block A-H**——不做这一块，Block A-H 做得再完善，请求依然可能进不了 memory-service。

### Block A｜任务控制面异步化 + 队列加固 —— 基础，建议必做
- [ ] 采纳
- **现状**：`POST /agent-tasks/execute` 同步等全链路；幂等键可退化为 `Date.now()`；idempotency 非唯一约束，多实例可竞争。
- **改造**：
  1. `execute` 改为「入队即返回」：立即返回 `{accepted, runId, statusUrl}`，执行移入后台（复用现有 ActionExecutor，由 HeartbeatLoop 或独立 drain loop 驱动）。
  2. 执行状态与通知状态分离（result 与 notification 各自落库，互不阻塞）。
  3. `idempotency_key` 加 UNIQUE 约束（新 migration），create 改为原子 `INSERT ... ON CONFLICT`；删除 `Date.now()` 兜底，缺幂等键时用 `triggerSource:taskId:scheduleSpec` 派生确定性 key。
  4. 状态机补充：`input_required` 保持可恢复态而不是落 `failed`。
  5. **（新增，源自实测故障 #3）** Readiness 熔断粒度从 scope 级下调到 task/evidence 级：单次 artifact 校验失败不应把 `openclaw:agent_task:read` 整个 scope 封死，导致后续无关任务连派发都不派发。至少加自动 TTL 重测（例如 N 分钟后自动 probe 一次），避免必须人工介入解锁。
- **涉及**：`routes/agentTasks.ts`、`repositories/ActionRepository.ts`、新 migration、`core/actions/ActionExecutor.ts`、`core/ActionReadinessService.ts`（新增第 5 点）。
- **风险**：调用方（Sheet webhook、Jira rule）目前期待同步拿结果，需要同步适配 `runtime-status` 轮询（该接口已存在，改动小）。
- **依赖**：无。是 B/C/D/E 的前置。

### Block B｜执行器抽象层：`delegate_openclaw` → `delegate_agent` —— 建议必做
- [ ] 采纳
- **现状**：executor 硬编码 openclaw；Result Contract（可验证 artifact）写在 OpenClaw 专用服务里。
- **改造**：
  1. 新增 `integrations/executors/` 目录 + `AgentExecutor` 接口：`submit / poll / cancel / resume`，统一返回 Agent Result Envelope（status/summary/artifacts/transcript/payload）。
  2. `hasVerifiableArtifact` 等契约校验从 OpenClawDelegationService 提炼到共享模块，所有 executor 复用。**（实测故障 #2 的具体修复，必须包含）**：`observedFields` 校验要同时接受字符串数组和对象（对象形状用 `Object.keys`/`key=value` 规范化后再判断非空），不能因为 OpenClaw 返回对象就整体判「缺少可验证 artifact」——当前这条规则已经误杀过真正执行成功的任务。
  3. action 类型泛化为 `delegate_agent`（兼容旧 `delegate_openclaw`，映射为 `executor=openclaw`）。
  4. `agentTasks.ts:396` 的白名单校验改为「必须在已启用的 executor registry 中」。
- **收益**：反思线程（ReflectionThreadService 已走同一队列）自动获得多 executor 能力，无需单独改造。
- **依赖**：A。

### Block C｜OpenClaw 接入升级：/v1/responses → Gateway —— **优先级从"建议做"上调为"应尽快做"（实测已复现，非假设）**
- [ ] 采纳
- **现状**：单次非流式 HTTP，超时后不知道远端是否已完成（stale error 已自认此问题）。
- **实测证据（故障 #4）**：`msg_1786094012149` 完整走通全链路、OpenClaw 确认接单启动，但长任务执行中途连接断开，memory-service 约 5 分钟后收到 `fetch failed`，无法判断 run 到底是"还在跑"、"已完成有结果"还是"真的挂了"，只能一律判失败。这不是小概率边角情况，是当前架构下**长任务/复杂路径**必然会踩的坑。
- **改造**：
  1. 新 `OpenClawGatewayExecutor`（WebSocket RPC：`agent` + `agent.wait`，续接用 `sessions.*`），持久化 remote run ID、event cursor、session 归属。
  2. 明确 reconcile 语义：连接断开时，先按 remote run ID 向 OpenClaw 查真实状态（`sessions.*`/等价查询），只有查到"确实没有这个 run"或"已确认失败"才落 `failed`；查到"仍在运行"应转 `input_required`/`running` 之类可恢复态并重新订阅，不能像现在一样把网络层失败直接等同于任务失败。
  3. **明确不属于本 Block 范围、需要单独跟进的事项**：`codex app-server one-shot cleanup retired shared client` 紧跟在 run 启动后出现、且此后 run 再无任何日志的现象，指向 OpenClaw/Codex 侧 `complex`/`default-strong` 路径在长任务下的 session 处理问题——这是 OpenClaw/Codex 自身的稳定性缺陷，Gateway 化只能让 memory-service **更快更准确地知道"没结果"**，不能让那次真正丢失的 run 复活。需要单独在 OpenClaw/Codex 侧排查或升级版本。
- **保留**：现有 `/v1/responses` 路径作为 legacy executor 一段时间，灰度切换。
- **依赖**：B。

### Block D｜新执行器：ACP + Codex —— 可选（要不要 Codex 查代码证据）
- [ ] 采纳
- **改造**：新 `AcpExecutor`，通过 stdio 驱动官方 `codex-acp`；`session/new` 时传入 cwd、workspace roots、权限，以及 **Personal AI MCP Server**（记忆按需检索，不复制记忆库）。sessionId 持久化，支持续聊/追加要求。
- **适用**：仓库实现、git history、测试/构建日志、CLI 可达的内部系统等代码类查证。
- **不做**：不依赖 Codex App Server 的远程 WebSocket transport（官方仍 experimental）。
- **依赖**：B；软依赖 F（远程记忆访问）——同机部署时 stdio MCP 已够用。

### Block E｜反向领任务：中央队列 + 出站 Worker —— 有 NAT/本地主机需求才做
- [ ] 采纳
- **改造**：
  1. Memory Service 增加 worker 注册/领取 API：握手登记（worker id、能力、executor 支持），领取带 **lease + fencing token**，心跳续租，断联任务回收。
  2. `agent_commands` 表：续聊/取消指令下发，在线 worker 走 WebSocket/SSE，离线 worker 下次轮询取。
  3. OpenClaw automation cron 只做 worker 安装/拉起/健康自检（确定性命令，不跑 LLM prompt），job 幂等（deterministic job name，NOOP if 配置一致）。
  4. Google Sheet 保持「计划 + 用户编辑 + 到期触发」角色，不做任务总线（现状边界不变）。
- **依赖**：A（lease/fencing 字段随本 Block 的 migration 加入）、B。

### Block F｜MCP 升级：远程 + 证据级 —— 建议做（D/G 的配套）
- [ ] 采纳
- **改造**：
  1. 传输：stdio 之外新增 Streamable HTTP 远程 MCP（单 POST endpoint、Origin 校验、OAuth bearer token + scope）。
  2. 工具升级为证据级：`memory_search`/`memory_ask` 返回稳定 evidence ID、召回通道、时间可信度、通道失败标记；新增 `memory_evidence_get`（需 `evidence.raw.read` scope 才可取原文）。
  3. 检索三模式：普通问答（现状 /ask、/recall）；证据调查（返回证据束+来源说明）；穷举审计（明确过滤条件下全量扫描，作为 audit 型 agent task 异步跑）。
- **质量承诺改为**：找到说来源、没找到说查过哪些范围、通道失败不伪装成"没有"、冲突不武断、需要穷举切 audit、无法确认明确 abstain。
- **依赖**：无硬依赖；三模式可以后置到二期。

### Block G｜A2A：把 Personal AI 开放为 Agent —— 后置，外部调用需求出现再做
- [ ] 采纳
- **改造**：新 `routes/a2a.ts` + Agent Card；A2A `taskId` ↔ 内部 `agent_run_id`，`contextId` ↔ `agent_conversation_id`；TaskStore 直接落在 proposed_actions/runs 账本上（A 已提供持久化）。
- **定位**：A2A 管 Agent 间任务协作，MCP 管工具/数据访问，两者互补；**不用 ACP 作为对外主协议**（ACP 的 cwd/终端/文件语义不是 Personal AI 场景）。
- **依赖**：A、B。

### Block H｜Executor 可配置化（插件 Options 选择 agent）—— 建议与 B 同批做
- [ ] 采纳
- **答案：可以，且现有配置链路直接支持。** `runtimeConfig.ts` 已有按用户持久化的 openClaw* 字段，`PUT /config` 已可从插件写入。
- **配置模型（已定：三层，"registry 结构 + 按用途显式选择"，v1 不做自动路由）**：
  - 用户配置的对象是**执行器实例**，不是协议。协议（Gateway WS / ACP stdio / legacy HTTP）是实例类型的内部实现，Options 里不出现"协议"字眼。OpenClaw Gateway 与 ACP 不是二选一——它们到达的是不同的 agent 面（通用外联 vs 代码查证），且 Codex 两条路都能到（OpenClaw 的 Codex harness，或 ACP 直连 codex-acp），属于部署选择。
  1. **第一层｜执行器列表**（可添加多个实例）：每条 = label + 类型 + 连接参数 + enabled + 测试连接。类型：`openclaw-gateway`（baseUrl/apiKey）、`acp-codex`（cwd/权限）、`acp-claude-code`、`openclaw-responses`(legacy 过渡)。
  2. **第二层｜按用途的显式默认**：`executorDefaults.agent_task`、`executorDefaults.reflection_research` 两个下拉，选项 = 已启用实例。反思与 agent task 共用 `delegate_agent` 队列，这只是同一份配置的两个入口；未来用途（消息规则委派、evidence watch）直接加键。
  3. **第三层｜请求级覆盖**：`/agent-tasks/execute` 的 `executor` 字段（Sheet 行可指定）> 用途默认；未启用的 executor 拒绝并提示。
  4. **自动路由后置为 opt-in 档位**：v2 在用途下拉里加「自动（按任务类型路由）」——executor 类型声明 capabilities（code/web/jira/glip），按 taskKind/executionHints 匹配，路由决策写入 action metadata 可回溯，匹配不到回落显式默认。v1 不做的原因：任务来自 Sheet 自由文本，taskKind 信号不可靠，误路由是静默的；实测四个故障表明当前最缺可观测性而非聪明度；单用户系统可预测性优先。
  - runtimeConfig 形状示例：
    ```json
    {
      "agentExecutors": [
        {"id": "openclaw-main", "label": "我的 OpenClaw", "type": "openclaw-gateway", "baseUrl": "...", "apiKey": "...", "enabled": true},
        {"id": "codex-local", "label": "本机 Codex", "type": "acp-codex", "cwd": "...", "enabled": false}
      ],
      "executorDefaults": {"agent_task": "openclaw-main", "reflection_research": "openclaw-main"}
    }
    ```
  5. 插件 Options UI（memory-exploring 设置区）新增「Agent 执行器」分组承载以上两层；经现有 `PUT /config` 持久化。
- **依赖**：B（registry 本身就是 B 的一部分，H 只是加配置面和 UI）。

### 明确不改
- **Outreach**：保持独立的人际外联状态机；未来需要调查/起草时临时关联 agent_run_id，不改主状态机。
- **Google Sheet**：继续做计划/人工编辑/到期触发，不承担可靠任务总线（Apps Script 配额与原子性都不适合）。
- **记忆归属**：长期记忆只在 Memory Service；任何 executor 不自建长期记忆，按 scope 经 MCP 检索。

---

## 2. 协议分层：哪里用什么（本仓库模块映射）

**原则：不是三选一，而是按「关系」分层 —— MCP 管数据访问，执行协议管派活，A2A 管对外被调用。**

| 位置 | 用什么 | 角色 | 现状 → 目标 |
|---|---|---|---|
| `mcp/tools.ts`（stdio） | **MCP (stdio)** | 本机 coding agent（Codex/Claude Code）查记忆 | 已有 → 保留，工具升级到证据级（Block F） |
| 新 `mcp/httpServer.ts` | **MCP (Streamable HTTP + OAuth)** | 远程 executor 按 scope 查/写记忆、取证据 | 无 → 新增（Block F） |
| `integrations/OpenClawDelegationService.ts` | **OpenClaw Gateway（WS RPC）** | Personal AI → OpenClaw 派活（agent task、反思查证、Sheet 到期任务） | `/v1/responses` 单次 HTTP → GatewayExecutor（Block C） |
| 新 `integrations/executors/AcpExecutor.ts` | **ACP（stdio 子进程）** | Personal AI → 本机/worker 主机上的 codex-acp 等 coding harness，做代码类查证 | 无 → 新增（Block D） |
| 新 `routes/a2a.ts` | **A2A（Server 端）** | 外部 Agent → Personal AI（委派任务、跟进状态、取 artifact） | 无 → 新增（Block G） |
| （未来）远程通用 Agent 服务 | **A2A（Client 端）** | Personal AI → 跨厂商远程 Agent 服务 | 无 → 远期，同一 executor 接口再加 `A2aExecutor` |
| `scheduled-messages/agentTaskWebhookConfig.ts` → `/agent-tasks/execute` | **普通 HTTP webhook** | Sheet/Jira rule 触发入口 | 保留，语义从「同步执行」改为「入队」（Block A） |
| OpenClaw automation cron | **Gateway 的 automation RPC** | 仅做 worker 安装/拉起/健康检查（确定性命令） | Block E 时引入 |

一句话版：**MCP 让别人带着 Personal AI 的记忆干活；OpenClaw Gateway / ACP 是 Personal AI 派活的两种「胳膊」；A2A 是 Personal AI 自己作为 Agent 被外界调用的「门面」。** 反思查证和 agent task 共用同一个 delegate_agent 队列与 executor registry，因此协议选择对它们是同一份配置。

---

## 3. 落地顺序建议

0. **零期（先止血，最高优先级）**：Block 0 —— Sheet/Apps Script/Jira 假成功修复。这是实测里权重最大（5/10）的失败来源，且完全独立于 memory-service，不做这一步，后面所有期的改造都验证不了真实效果（因为请求可能根本没到）。
1. **一期（基础）**：Block A（含 readiness 熔断粒度修复）+ B（含 artifact 校验修复）+ H —— 异步控制面、队列加固、executor 抽象 + 可配置化。此后一切扩展都不再动业务语义。
2. **二期（升级 OpenClaw，优先级已上调）**：Block C —— GatewayExecutor + remote run reconcile，灰度替换 /v1/responses。原本排在"可选增强"位置，因故障 #4 已实测复现（长任务连接中断、5 分钟后才知道失败），应紧跟一期之后做，不要拖到"按需"阶段。
3. **三期（第二执行器）**：Block F（远程 MCP + 证据级工具）→ Block D（ACP/Codex）。
4. **四期（按需）**：Block E（反向 Worker，有本地/NAT 主机需求时）；Block G（A2A，对外开放需求出现时）；Block F 的穷举审计模式。

每期结束的验收锚点：
- 零期：故意让 Apps Script 侧 404/超时一次，确认 Sheet **不会**留下假 ✅，且该行第二天仍可被领取；对账脚本能扫出所有「Sheet ✅ 但 memory-service 无 action」的历史行并清零。
- 一期：重试同一 taskId 不产生重复 run；execute 接口 P99 < 500ms；通知失败不影响 run 结果；单条 artifact 校验失败不再连坐同 scope 的其他任务；OpenClaw 返回对象形 `observedFields` 时不再被误判失败。
- 二期：人为 kill 连接后，run 可通过 remote run ID reconcile 到终态，而不是直接判 `fetch failed`/`failed`。
- 三期：Codex 经 MCP 查记忆完成一次代码查证任务，全程无记忆复制。
- 四期：断网 worker 恢复后被 fencing token 拒绝提交旧结果。

---

## 4. 与 Cursor 排查记录的对照小结

| 实测故障 | 权重 | 原 Block A-H 是否覆盖 | 现在的覆盖方式 |
|---|---|---|---|
| #1 Sheet 假成功（Apps Script 提前写✅ + Google 404/超时） | 5/10，最大 | ❌ 不覆盖（超出 memory-service 范围） | 新增 **Block 0**，且设为零期最高优先级 |
| #2 Artifact 形状不一致（observedFields object vs string[]） | 2/10 | ✅ Block B 意图上覆盖，但原文没点名 | Block B 补充第 2 点，写清楚具体校验修复 |
| #3 Readiness scope 级熔断连坐（含 08-07 新实例 `msg_1786094912393`，一度被误判为"本机 OpenClaw 挂了"） | 1/10 起，但拖死后续所有同 scope 任务 | ❌ 原文未覆盖 | Block A 补充第 5 点：熔断粒度下调 + TTL 自动重测 |
| #4 OpenClaw 长任务连接中断 `fetch failed`（`msg_1786094012149`，唯一"真正打到 OpenClaw 且失败"的样本） | 目前 1 例，但长任务/复杂路径下会反复出现 | ⚠️ Block C 理论上对症，但当时基于假设、优先级偏低 | Block C 优先级上调 + 明确 reconcile 语义；OpenClaw/Codex 侧的 session 挂死问题标注为**需要单独协作排查**，不在 memory-service 修复范围内 |

一句话结论：**原 plan 能解决的问题，都是真实发生过的问题，但覆盖不全、优先级也需要重排——最大的失败来源（Sheet 假成功）在 memory-service 范围之外必须单独处理（Block 0）；readiness 连坐会把"OpenClaw 好像挂了"的假象反复制造出来（已被误判两次）；长任务连接中断（故障 #4）证明 Block C 不是锦上添花而是刚需，但即便做了 Block C，OpenClaw/Codex 侧真正的 session 挂死仍需要单独排查，不是靠 Personal AI 这边代码能根治的。**
