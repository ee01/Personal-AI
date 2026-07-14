# 新能力：Action Readiness Contracts / 执行就绪契约

> 生成日期：2026-07-07 CST  
> Codex 会话标题：新能力：执行就绪契约  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`action-readiness-contracts-demo.html`](./action-readiness-contracts-demo.html)

## 结论

建议设计一个新的底层能力：**Action Readiness Contracts / 执行就绪契约**。

它不是新的 Action Queue，不是多 AI 调度塔台，也不是让用户多维护一个审核列表。它解决的是 Personal AI 现在已经反复出现的执行链路问题：

> 系统已经知道“应该去查 Jira / Drive / RingCentral / OpenClaw”，但直到真正执行后才发现 OpenClaw 未配置、鉴权失败、目标系统不匹配、规则文案缺少必要参数、写操作需要审批、或结果证明要求不完整。

执行就绪契约要把这些失败从**事后恢复债**前移成**执行前门禁**：

- 对每类 action family 建立可复用 readiness contract。
- 在 `delegate_openclaw`、消息联动、Reflection action、Action Queue 自动调度和手动批准前检查能力、凭据、目标系统、必填参数、审批、幂等、结果证明要求。
- 不就绪时不继续堆积同类外部动作，而是在原 action 卡片或来源规则旁显示明确阻断原因和修复入口。
- 修复后只重跑受影响的 contract，不把旧失败当成新事实、不自动确认外部系统完成。

一句话：

> Personal AI 不只要记住“要做什么”，还要在执行前知道“现在能不能做、缺什么、谁可以修、做完必须拿到什么证明”。

## 用户真实场景

### 场景 1：群消息触发视频上传规则，但 OpenClaw 鉴权已经坏了

1. RingCentral 群里有人发了 PoC / Demo 视频附件。
2. 用户之前配置过一条记忆入口规则：命中这种消息后，让 OpenClaw 下载附件、上传到指定 Google Drive 文件夹，并把 Drive 链接单独发给用户。
3. **Before**：系统创建 `delegate_openclaw` action，等执行后才返回 `auth_error` 或 `fetch failed`。Action Queue 里出现失败动作，Decision Center 又出现“OpenClaw 鉴权失败，配置好了是否重试”的确认项，规则改写建议又多一条。用户看到的是一堆事后补救卡片。
4. **After**：消息命中规则时先读取 `action_readiness_contract`：
   - `openclaw.connection=auth_error`
   - `google_drive.write=unknown`
   - `requiredInputs=[source attachment, target folder, naming suffix]`
   - `proofRequired=[uploaded file url, source message id, target folder id]`
5. UI 不再把这条规则显示成“已排队待执行”，而是在消息旁/Action Queue 顶部显示：`执行已拦住：OpenClaw 鉴权未通过；未下载、未上传、未发送 Drive 链接。`
6. 用户点 `修复后重测`。系统只跑一个轻量 readiness probe，不重跑原上传任务。
7. probe 通过后，原 action 才从 `blocked_readiness` 变成 `queued/manual` 或 `queued/auto`，并保留“上次没有外部副作用”的回执。

用户体验变化：用户不需要从失败动作、确认请求、规则建议三个地方拼原因；系统也不会在工具坏的时候继续创建同类失败动作。

### 场景 2：Reflection 想查 98 个 Jira / Google Workspace 事实，但同一个能力缺口已经确定

1. Self Reflection 发现很多事实跟进项：Jira story point、Google Sheet backlog、release version、attachment 是否变化。
2. **Before**：最近 100 条 actions 中 98 条是 `delegate_openclaw`，全部 `queued` 且需要 approval。Reflection threads 里大量 `waiting_for_delegation`。如果用户逐条批准，很多任务仍可能因为同一个 OpenClaw 配置或目标系统缺口失败。
3. **After**：ReflectionWorker 生成 action 前先询问 readiness registry：
   - `openclaw:global` 当前 `blocked_auth`，覆盖所有 OpenClaw 委派。
   - `jira:read` 需要 `jira_rest_pat` 或 `jira_mcp`，当前状态 `unknown`。
   - `google_workspace:read` 当前 `unknown`，需要 Drive/Sheets probe。
4. Reflection 只创建一条系统级 `readiness_repair` 确认项，后续同类事实跟进动作被合并成 `blocked_by_contract` links，不再单独打扰用户。
5. 用户修复后，系统按 contract scope 自动解锁相关 action，但不会自动执行高风险写操作。

用户体验变化：Action Queue 从“98 张等批准的外部查证卡”变成“1 张 OpenClaw 就绪问题 + 受影响动作数 + 修复后可恢复的清单”。

## 本次输入信号

### Reminders 检查

本机 Reminders 有 AppleScript / EventKit 差异：

- AppleScript 可见列表没有 `Personal AI`。
- EventKit 可以读取 `Personal AI` 列表。
- `Personal AI` 当前未完成事项数为 `0`。

因此本次没有从 Reminder item 随机抽取新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 线上记忆服务信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次只读 HTTP 查询，未写入远端数据。

当前状态：

- `/health` 可达但返回 `degraded`，`database.connected=false`。
- `/api/v1/stats` 仍返回用户聚合：`11204` messages、`10052` chunks、`14186` entities、`54683` relationships、`30` pending confirm requests。
- 记忆层级里 temporary / active / archive / forgotten 并存，说明系统已有大量长期运行状态和历史残留。
- 最近 100 条 action 样本中：
  - `98` 条是 `delegate_openclaw`。
  - `100` 条都是 `queued`。
  - `98` 条需要 approval。
  - 样本来源全部是 `reflection_worker`。
  - target system 覆盖 `google_workspace`、`jira`、`ringcentral`、`web`。
- 当前 30 个 confirm requests 中：
  - `28` 个是 `evidence_resolution`。
  - `1` 个是 `openclaw_delegation`，问题是 OpenClaw 鉴权失败后是否重试。
  - `1` 个是 `message_rule_improvement`，来自 OpenClaw 执行失败后建议改写联动规则。
- Reflection threads 样本中：
  - total `885`。
  - 最近 100 个里 `65` 个 `continueReason=waiting_for_delegation`。
  - `23` 个 `continueReason=waiting_for_confirm_request`。

这说明当前最强痛点不是“没有更多事实查证逻辑”，而是**外部执行能力不可用或不可证明时，系统仍在继续生成同类委派和确认债**。

### 当前代码与文档事实

本计划基于现有结构，不假设不存在的能力：

- `ActionExecutor` 已有 `delegate_openclaw`、`create_confirm_request`、`update_truth_property`、`query_external_tool`、`ask_external_user` 等 action type。
- `OpenClawDelegationService` 只有运行时 `isConfigured()` 和执行后的 outcome 分类：`success`、`capability_missing`、`auth_error`、`need_human_decision`、`timeout`、`error`。
- `delegateOpenClawPolicy` 已能按 read / write 决定 auto / manual 和 approval，但它不检查工具实际可用性。
- Message Rule planner 对未知联动会生成 `delegate_openclaw`，并明确写着 `Treat OpenClaw capability as unknown until execution`。
- Action Queue 文档已经补了很多事后 receipt：委派预检、证据校验、恢复路径、提交中、审批前边界等。但这些仍主要发生在 action 已经存在之后。
- Agent Workflow Options 有本地测试、trace、readiness、保存样例和批量回归；它服务消息处理配置，不是全局外部 action readiness registry。

因此新能力应该补的是：**可复用、跨 action source 的执行前 readiness contract**。

## 为什么值得做

Personal AI 的长期目标是保存用户和 AI、消息、浏览、操作、偏好、skill、其他 AI 对话等所有记忆，并在真实场景中提供记忆关联提示。系统已经从“记住信息”发展到“基于记忆产出动作”：

- Self Reflection 会创建事实跟进和外部查证动作。
- Message Reaction 会从消息旁保存 Snooze / Watch / Reply / Followup / OpenClaw 联动。
- Evidence Watch Contracts 会把变化事实转换为持续查证契约。
- Skill Foundry 会把可复用流程同步到 OpenClaw 等平台。
- Action Queue 承接通知、确认、OpenClaw 委派、Outreach、truth update 等动作。

但“能不能执行”现在还不是一等对象。结果是：

1. **失败发现太晚**  
   只有在执行 OpenClaw 后才知道鉴权、能力、目标系统、artifact 证明是否可用。

2. **恢复动作太分散**  
   同一次工具缺口会派生 notification、confirm request、message rule improvement、failed action，多入口解释同一个根因。

3. **同类失败会重复生产**  
   如果 `openclaw:auth` 已经失败，Reflection 仍可能继续产出很多 target-specific delegation。

4. **用户不知道“修好后会发生什么”**  
   当前确认项问“配置好后是否重试”，但用户需要先知道受影响动作有哪些、哪些只读、哪些写操作、哪些需要重新审批、哪些可能已发生外部副作用。

5. **规则质量无法在执行前改善**  
   Message Rule planner 只有执行失败后才建议补“如果 OpenClaw 缺能力/鉴权失败则停止外部写入”。更好的是规则保存或命中时就能知道这条规则缺少 source attachment、target folder、proof contract。

执行就绪契约的价值不是把执行变慢，而是减少无意义的执行和恢复债：

- 不就绪时静默阻断重复动作，只显示一个源头问题。
- 就绪时让用户更放心批准，因为目标、能力、证明和副作用边界已经可见。
- 修复后按 contract 解锁，不需要用户逐条找旧失败。
- eval 可以用真实 action/confirm/reflection 样本验证“失败是否前移、重复是否合并、边界是否清楚”。

## 与已有能力和搁置计划的边界

| 已有能力 / 计划 | 已解决什么 | 本计划新增什么 |
|---|---|---|
| Action Queue | 展示和执行已入队动作，含审批、失败、恢复路径回执 | 入队/调度前的可复用 readiness contract；不让明显不可执行动作继续堆积 |
| Evidence Watch Contracts | 管“事实是否需要持续查证、如何去重外部查证” | 管“用于查证的工具/凭据/目标/证明现在能不能工作” |
| Agent Workflow Options readiness | 管消息处理流水线本地测试和配置覆盖 | 管真实 action runtime 的外部工具就绪，不只服务 Options 测试 |
| Message Rule Automation Planner | 把消息规则转换成 RuntimeAction / OpenClaw 委派 | 在规则保存和命中时检查 action family 所需输入、能力和 proof contract |
| Skill Experience Quality Gate | 技能执行后的质量、降级、退役 | 工具/动作执行前的环境就绪，不评价技能长期表现 |
| Agent Memory Control Tower（搁置） | 多 AI 分派和合并执行结果 | 本计划不调度多个 AI，只给现有 action 执行链加门禁 |
| AI Session Context Drift Radar（搁置） | 外部 AI 会话拿到的上下文是否过期 | 本计划不观察外部 AI 会话，只检查 Personal AI 发起的 action 是否可执行 |
| Memory Egress Firewall（搁置） | 记忆外发安全预检 | 本计划不做通用 DLP；只检查 action 执行能力、输入和 proof |
| Memory Reflection Governor（搁置） | 限制重复反思、工具阻塞动作 | 本计划把其中“工具阻塞”抽成可实现的 runtime contract，而不是治理控制台 |

关键边界：

- 不新增用户日常 review 队列。
- 不自动修复 OpenClaw / Jira / Google Drive 配置。
- 不保证外部系统一定成功，只保证执行前状态、输入和证明要求被检查。
- 不把 `ready` 当成“外部已经执行成功”。
- 不把 `blocked` 当成“用户需要现在处理”；只有影响当前场景或高优先 action 时才展示。

## 行业和竞品参考

### OpenAI Agents SDK：敏感工具调用可暂停、审批、恢复，并支持 pre-approval guardrails

OpenAI Agents SDK 的 human-in-the-loop 文档把敏感 tool call 暂停为需要审批的 interruption，用户 approve / reject 后再 resume；运行配置还支持在审批前运行 tool input guardrails，并在审批后执行前再次检查。参考：

- [OpenAI Agents SDK Human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/)
- [OpenAI Agents SDK Running agents](https://openai.github.io/openai-agents-python/running_agents/)
- [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- [OpenAI Agents SDK MCP](https://openai.github.io/openai-agents-python/mcp/)

对本计划的启发：

- 审批不是执行成功；审批只是让 run 从 pending 恢复。
- guardrail 应该能在 pending approval 之前先检查输入，避免用户批准一个明显不可执行或不合规的 tool call。
- 本计划可把 `readiness_contract` 视为 Personal AI 自己的 pre-approval guardrail。

### LangGraph：持久化、interrupt 和 checkpoint 是长期执行的基础

LangGraph 文档把 durable execution、human-in-the-loop、persistence、interrupts 和 checkpoint 作为核心运行时能力。参考：

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)

对本计划的启发：

- 外部 action 不是一次 prompt，而是有状态执行单元。
- 暂停、恢复、重试和失败都需要可持久化状态。
- Readiness contract 应该能被 action、confirm request、reflection thread 重复引用，而不是只存在一次 UI toast。

### Microsoft Copilot Studio：agent flow 要区分确定性流程、AI 阶段和人工审批

Microsoft Copilot Studio 的 agent flows 强调 deterministic flow、trigger/action/automation steps；AI approvals 可让 AI 阶段做初始判断，再交给人类审批。参考：

- [Agent flows overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview)
- [Multistage and AI approvals in agent flows](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-advanced-approvals)
- [Request information from human review in agent flows](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information)

对本计划的启发：

- 真正可控的 agent workflow 不只靠自然语言执行，要有流程、审批和请求补信息的明确节点。
- Personal AI 的 Message Rule / Action Queue 也应该把“缺输入/缺凭据/缺审批”做成明确节点，而不是等 OpenClaw 黑盒返回失败。

### Zapier Agents：部署前要限制 scope、写清 instructions、配置 knowledge sources 和充分测试

Zapier Agents 官方帮助文档强调用清晰 instructions、有限 scope、knowledge sources 和测试来提高 agent 可靠性。参考：

- [Build an agent in Zapier Agents](https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents)
- [Best practices for working with Zapier Agents](https://help.zapier.com/hc/en-us/articles/24593355420429-Best-practices-for-working-with-Zapier-Agents)

对本计划的启发：

- Message Rule 的 `automationPrompt` 不能只是一段愿望；它需要 action family、scope、required inputs、target 和 test result。
- Readiness contract 可以成为“这条自动化规则是否能发布/运行”的轻量 test gate。

### MCP 与工具安全：工具暴露、授权和人类确认需要显式边界

Model Context Protocol 规范把工具定义为外部系统调用；安全最佳实践强调 authorization、scope minimization 和工具调用边界。参考：

- [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

对本计划的启发：

- 工具不是纯文本能力；每个工具都应有 schema、可见状态和权限边界。
- OpenClaw / future MCP connector 的 readiness 应按 tool scope 记录，不能只用一个全局“配置了/没配置”。

### Agent observability 与失败研究：生产 agent 需要完整 trace、工具失败归因和执行证明

相关研究和标准都指向同一个方向：agent 可靠性不是只看最终回答，而是要看工具调用、环境状态、失败归因和证明链。

- [ToolEmu](https://arxiv.org/abs/2309.15817) 用模拟工具环境评估 LM agents 风险，指出复杂工具场景下会出现隐私泄露和真实损失风险。
- [Evidence Tracing and Execution Provenance in LLM Agents](https://arxiv.org/html/2606.04990v1) 指出现有系统缺少统一 trace schema，工具调用、记忆读写、环境观察和错误事件常被不同格式记录。
- [A Benchmark for Failure Attribution in LLM-based Multi-Agent Systems](https://arxiv.org/html/2604.22708v1) 强调 failure attribution 需要完整 execution observability，而不是只看输出。
- [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) 已把 tool definitions、tool call arguments、tool result、retrieval documents、workflow name 等作为可观测字段。

对本计划的启发：

- Readiness contract 不是 UI 装饰，而是 execution provenance 的前置部分。
- 每个 `blocked_by_readiness` 都应有可记录的 reason、scope、probe result、expiry 和受影响 action links。
- 每个 `ready` 都应说明它证明了什么、没有证明什么。

## 产品定义

### 核心对象：Action Readiness Contract

`ActionReadinessContract` 是一条可复用的执行前能力契约。它绑定某类 action family、目标系统和能力 scope。

例子：

- `openclaw:global`
- `openclaw:jira:read`
- `openclaw:google_drive:write`
- `message_rule:n8h8kfybn:video_upload`
- `evidence_watch:jira_artifact_check`
- `outreach:ringcentral:send`

它回答五个问题：

1. **能不能执行？**  
   `ready`、`blocked`、`unknown`、`degraded`、`expired`。

2. **缺什么？**  
   凭据、连接、目标权限、必填参数、source attachment、target folder、proof schema、人工选择、审批。

3. **影响谁？**  
   受影响 action 数、来源规则、reflection threads、confirm requests、evidence watch contracts。

4. **修复后怎么恢复？**  
   重新 probe、解锁 queued actions、重新生成 rule prompt、保留旧失败、需要重新审批的 action 列表。

5. **这次就绪证明不代表什么？**  
   不代表外部事实已确认、不代表写操作已发生、不代表旧失败已撤销、不代表所有同类 action 都可自动跑。

### 建议状态

| 状态 | 含义 | UI 口径 |
|---|---|---|
| `ready` | 最近 probe 或成功执行证明该 capability 可用 | 可执行；仍需按 action risk 审批 |
| `unknown` | 没有近期 probe / 从未执行过 | 可手动执行，但不应自动调度高影响 action |
| `blocked_auth` | 鉴权或权限失败 | 阻断同 scope action；修复后只跑 readiness probe |
| `blocked_capability` | connector / tool / target system 缺能力 | 阻断同 scope action；提示替代手动路径或规则改写 |
| `blocked_input` | 缺 source attachment、target id、time basis、folder id 等必填输入 | 回到来源规则/动作补参数，不调用 OpenClaw |
| `blocked_proof` | 缺 verifiable artifact schema | 不把结果写入 action_results；需要改任务或 connector |
| `degraded` | 最近成功但失败率高或 probe 过期 | 允许手动，自动调度降级 |
| `expired` | 就绪证明超过 TTL | 自动动作先重测；手动动作显示 stale receipt |

### 不同入口的体验

#### 入口 1：Action Queue 顶部的 Readiness Strip

当队列里有同 scope 的阻断动作时，顶部展示一条聚合 strip：

`OpenClaw 鉴权未通过 · 阻断 98 条外部查证 · 未执行 Jira/Drive/RingCentral 写操作 · 修复后可重测`

点开看到：

- blocked contract；
- 受影响 action 按 read/write、target system、source thread 分组；
- 上次 probe 时间和错误；
- 修复入口：打开设置 / 复制诊断 / 重测就绪；
- 恢复边界：重测只检查连接和权限，不执行原动作。

#### 入口 2：Action 卡片内的 Readiness Receipt

每个 action 卡片保留当前执行前门禁：

- `ready`：显示最近通过的 contract 和 proof requirement。
- `blocked`：按钮从 `执行` 改成 `查看缺口` / `修复后重测`。
- `unknown`：写操作必须人工确认；读操作可自动 probe 后再执行。

#### 入口 3：Message Reaction 规则保存 / 命中时的 Preflight

用户保存联动操作规则时，系统不只保存 prompt，而是生成 action family preview：

- 规则族：`video_upload_to_drive`
- 目标：Google Drive folder
- 输入：source attachment、source message permalink、filename suffix date
- 执行器：OpenClaw
- proof：uploaded file URL、target folder id、source message id
- 当前 readiness：`OpenClaw auth blocked`

命中消息时，如果 readiness blocked，就只写一条规则命中 receipt，不创建实际上传 action：

`这条规则已命中，但上传执行被拦住：OpenClaw 鉴权未通过。本次没有下载、上传或发送链接。`

#### 入口 4：Reflection / Evidence Watch action creation gate

ReflectionWorker 创建 `delegate_openclaw` 前先调用 readiness service：

- `ready`：正常创建 action。
- `unknown`：创建 probe action 或手动 action，但不要批量自动调度。
- `blocked`：不创建重复 external action；记录 `blocked_by_readiness` link 到线程，并聚合到 contract。

线程详情页展示：

`本轮没有继续委派 OpenClaw：openclaw:global 当前 blocked_auth；已把 12 个事实跟进挂到同一就绪契约，修复后可恢复。`

#### 入口 5：Decision Center 的修复包

当用户打开 OpenClaw 配置失败的 confirm request，卡片不只问“是否重试”，而是显示：

- 当前 contract；
- 受影响动作数；
- 是否有写操作；
- 是否存在 stale running 或可能外部副作用；
- 修复后要先 probe，不直接重试原动作；
- 用户可以选择：`修复后只重测`、`重测通过后解锁只读动作`、`保持阻断`。

## 数据契约草案

### 表：`action_readiness_contracts`

```sql
CREATE TABLE action_readiness_contracts (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL UNIQUE,
  action_family TEXT NOT NULL,
  target_system TEXT,
  capability TEXT,
  status TEXT NOT NULL,
  status_reason TEXT,
  required_inputs_json TEXT,
  required_approvals_json TEXT,
  proof_requirements_json TEXT,
  last_probe_at INTEGER,
  last_probe_result_json TEXT,
  expires_at INTEGER,
  blocked_since INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 表：`action_readiness_links`

```sql
CREATE TABLE action_readiness_links (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,      -- proposed_action | reflection_thread | message_rule | evidence_watch | confirm_request
  source_ref_id TEXT NOT NULL,
  link_reason TEXT NOT NULL,      -- blocked_by_readiness | depends_on_readiness | proved_by_action_result
  created_at INTEGER NOT NULL,
  UNIQUE(contract_id, source_kind, source_ref_id, link_reason)
);
```

### Action metadata 增量

```ts
interface ReadinessReceipt {
  contractId: string;
  scopeKey: string;
  status: 'ready' | 'unknown' | 'blocked_auth' | 'blocked_capability' | 'blocked_input' | 'blocked_proof' | 'degraded' | 'expired';
  checkedAt: number;
  expiresAt?: number;
  reason?: string;
  affectedActionCount?: number;
  requiredInputs?: string[];
  requiredApprovals?: string[];
  proofRequirements?: string[];
  noExternalSideEffectYet: boolean;
  doesNotProve: string[];
}
```

### Readiness service API

```ts
interface CheckActionReadinessInput {
  actionType: string;
  actionFamily?: string;
  targetSystem?: string;
  mode?: 'read' | 'write';
  params: Record<string, unknown>;
  sourceKind?: string;
  sourceRefId?: string;
  evidenceRefs?: string[];
}

interface CheckActionReadinessResult {
  decision: 'allow' | 'allow_manual_only' | 'probe_first' | 'block';
  receipt: ReadinessReceipt;
  linksToCreate: Array<{
    sourceKind: string;
    sourceRefId: string;
    linkReason: string;
  }>;
}
```

## 实施方案

### P0：OpenClaw 全局 + target system read/write readiness

目标：先把当前真实痛点收住。

1. 新增 `ActionReadinessService`。
2. 为 `delegate_openclaw` 生成 scope key：
   - `openclaw:global`
   - `openclaw:<targetSystem>:<mode>`
3. 从以下信号更新 contract：
   - `OpenClawDelegationService` 未配置 -> `blocked_capability`。
   - HTTP 401 / 403 -> `blocked_auth`。
   - `capability_missing` -> `blocked_capability`。
   - `success + verifiable artifact` -> `ready`。
   - `success but missing verifiable artifact` -> `blocked_proof` 或 `degraded`。
   - timeout / fetch failed -> `degraded`，按连续失败阈值升级。
4. `ActionExecutor.runDueActions` 调度前检查 contract：
   - blocked: 不执行，写 `blocked_by_readiness` link，不增加 retryCount。
   - expired: 先创建或运行 probe。
   - ready: 原行为。
5. `Action Queue` API 返回 `readinessReceipt` 和顶部 `readinessSummary`。

P0 不做复杂 UI，只需要让用户看到：

- 为什么没执行；
- 影响多少动作；
- 修复后点什么；
- 哪些事情尚未发生。

### P1：Message Rule Automation readiness preview

1. 在 `MessageRuleAutomationPlanner.preview()` 增加 `readinessPreview`。
2. 规则保存前显示 action family、target system、required inputs、proof requirements。
3. 对 unknown fallback `openclaw_delegation` 强制要求：
   - 如果规则中有 Drive/Jira/RingCentral/attachment 语义，列出必填 input。
   - 如果不能识别 target 或 source，状态为 `blocked_input`。
4. 规则命中时如果 blocked，不创建真实 action，只写一条 local / memory receipt，避免重复失败。
5. 如果执行失败后产生 `message_rule_improvement`，把建议写回同一 contract，而不是孤立 confirm request。

### P2：Reflection / Evidence Watch 批量阻断和恢复

1. ReflectionWorker 产出 action proposal 前调用 readiness。
2. 对同 scope blocked 的 proposals 不入队，改为 link 到 contract。
3. Reflection thread 文档和页面显示“本轮被 readiness 阻断”的数量和原因。
4. 修复后 contract 触发恢复：
   - 只读 action 可以按原 idempotency key 重新创建或解锁。
   - 写 action 必须重新进入人工审批。
   - stale running / dead letter action 不自动重试，只显示恢复候选。

### P3：Readiness eval + shadow mode

1. Shadow mode：不改变执行，只记录如果启用 readiness 会阻断/合并多少动作。
2. 运行一周后比较：
   - failed delegate action 数；
   - delegation recovery confirm request 数；
   - duplicate actions per contract；
   - user-visible blocked summaries；
   - false block cases。
3. 稳定后开启 P0 contract gate。

## UX 文案原则

### 必须显示的边界

- `未执行`：只是阻断或 probe，不是原动作完成。
- `未外发`：没有上传、发送、写 Jira、写 Drive、改状态。
- `未确认事实`：readiness 只证明工具可用，不证明外部事实正确。
- `旧失败未撤销`：修复配置不会自动改变过去 action 的结果。
- `写操作仍需审批`：即使 contract ready，写操作也不自动跑。
- `本次快照`：readiness 有 `checkedAt` 和 `expiresAt`。

### 避免的文案

- 不说“OpenClaw 已修复”，除非 probe 真的通过。
- 不说“可以安全执行所有动作”，只说对应 scope ready。
- 不用“失败已解决”替代“已解锁可重试”。
- 不把 blocked action 从队列消失；要有可追溯 link。

## 风险与取舍

### 风险 1：阻断太多，用户觉得系统不主动

缓解：

- 只在同 scope 明确 blocked 时阻断。
- unknown 不等于 blocked；读操作可先 probe，写操作走 manual-only。
- Action Queue 顶部显示“被阻断动作数”和“为什么”，而不是静默消失。

### 风险 2：readiness 过期或误判

缓解：

- 每个 contract 有 TTL。
- 执行前对时间敏感检查重新验证。
- 最近成功执行可刷新 contract，但不无限期沿用。

### 风险 3：又变成一个配置面板

缓解：

- P0 不新建独立页面。
- 只在 Action Queue、规则编辑、Decision Center、Reflection thread 这些已有入口显示。
- Coverage Map 可以显示总体健康，但不是日常 review 入口。

### 风险 4：和 Evidence Watch 重叠

边界：

- Evidence Watch 问“事实是否需要查证、查证对象是什么”。
- Readiness Contract 问“查证工具现在能不能做、缺什么、结果需要什么证明”。

### 风险 5：OpenClaw 黑盒能力无法准确静态判断

缓解：

- P0 不假装知道所有 OpenClaw 工具。
- 先检查全局配置、鉴权、target scope、必填输入和 proof schema。
- 能力未知时执行小 probe，而不是跑真实 action。

## 验证与 eval 要求

这个功能价值依赖 action gating、错误归因、重复合并和用户可理解 receipts，因此实现后需要新增 evals。

建议新建 suite：`action-readiness-contracts`。

### eval 场景

1. **OpenClaw auth blocked**
   - 输入真实形态的 `delegate_openclaw` queued actions + 一个 auth_error outcome。
   - 期望：同 scope 后续 actions 被 `blocked_by_readiness`，不增加 retryCount，不创建重复 recovery confirm request。

2. **Message rule video upload lacks readiness**
   - 输入一条视频上传联动规则和 source attachment message。
   - OpenClaw auth blocked。
   - 期望：规则命中 receipt 说明未下载/未上传/未发送；不创建外部 write action。

3. **Readiness fixed then unlock read-only**
   - 先 blocked_auth，后 probe success。
   - 期望：read-only Jira / Drive actions 解锁为 queued；write actions 仍 manual approval。

4. **Missing verifiable artifact**
   - OpenClaw 返回 success 但缺 sourceSystem/entityKey/verification/observedFields。
   - 期望：contract 标为 `blocked_proof` 或 action failed with proof receipt；不写 `action_results`。

5. **Reflection bulk suppression**
   - 输入多个 waiting_for_delegation reflection threads。
   - 期望：同一 blocked contract 聚合受影响线程，不生成 50+ 个新 action。

### eval 数据

- 优先使用 `10.32.56.212` 的 `esone.qiu` 真实 action / confirm / reflection 样本脱敏成 fixtures。
- 不需要保留完整消息正文；保留 action type、target system、mode、status、reason、source kind、thread count、proof metadata 即可。
- 如果线上服务 degraded，可用 immutable SQLite 或当前 API 样本生成 fixture。

### 通过标准

- 所有 eval case 生成 reader report。
- 报告必须清楚写出：
  - proved：阻断/合并/解锁/证明检查是否生效；
  - not proved：没有证明外部系统实际成功、没有证明所有 OpenClaw capability；
  - side effect boundary：eval 不执行真实 OpenClaw/Jira/Drive。
- `npm run eval:validate` 通过。
- `npm run eval:run -- --suite action-readiness-contracts --no-repair` 通过。
- 如果 fail，继续迭代直到 suite 全部通过。

## 文档维护要求

如果后续决定实现，本功能关键点和关键逻辑必须迁入正式功能文档：

- `docs/features/memory_system.md`：新增 Action Readiness Contracts 作为 Action Queue / Reflection / Evidence Watch 的执行前门禁层。
- `docs/features/evidence_watch_contracts.md`：补充 Evidence Watch 只决定事实查证契约，执行能力由 readiness contract gate。
- `docs/features/message_reaction.md`：补充联动操作规则保存/命中时的 readiness preflight 和 blocked receipt。
- `docs/features/agent_workflow.md`：说明 Options readiness 是本地消息流水线测试；Action Readiness 是真实 runtime action gate。
- `docs/features/index.md`：新增一行小功能点。

如果实现完成，应删除或标记本 `docs/progressing` 计划为已迁移，避免 planning 与 canonical docs 双轨。

## P0 推荐范围

建议先做 P0，不做新页面、不做多平台全量能力注册。

P0 只覆盖：

- `delegate_openclaw`。
- `openclaw:global`。
- `openclaw:<targetSystem>:read/write`。
- Action Queue 顶部 readiness summary。
- Action card readiness receipt。
- auth_error / capability_missing / missing proof / success artifact 四类 contract 更新。
- ReflectionWorker 只在明确 blocked 时停止创建重复同 scope actions。

不建议 P0 做：

- 自动修复凭据。
- 自动重试所有旧 action。
- 全 MCP tool registry。
- 独立配置页面。
- 外部 AI 会话状态观察。
- 用户自定义复杂 readiness matrix。

## 最终建议

推荐进入下一轮实现评审，但要坚持一个窄切片：

> 先把 OpenClaw 委派失败从事后恢复债前移到执行前 readiness contract，证明它能减少重复 queued actions、重复 confirm requests 和模糊失败回执。

如果 P0 不能明显减少 `delegate_openclaw` 失败恢复债，就不要扩展到更多 action family。

