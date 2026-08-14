# Action Readiness Contracts / 执行就绪契约

_最后更新: 2026-08-13_

执行就绪契约是 `delegate_agent` / `delegate_openclaw` 的 dispatch 前门禁。它回答的不是“这个动作值不值得做”，而是“当前连接、鉴权、目标能力、必填输入和结果证明是否足以安全开始执行”。执行器选型与 Gateway/ACP 运行时见 [Agent Executor Runtime](./agent_executor_runtime.md)。

## 大白话运行逻辑

就绪契约是熔断器，不是权限表。第一次动作在 `unknown` 时照常发给执行器；执行器的结果才成为证明。之后短期记住「Gateway 连不上 / Jira connector 不可用」，避免定时任务反复烧同一失败。

`targetSystem=agent_task` 的通用「帮我做」任务内容不可预知，因此**只检查 `openclaw:global` 连接层**（配对、鉴权、base URL）。浏览器插件缺失、缺 artifact 这类能力层失败写在该次 run 账本上，不写就绪合同，也不按 `triggerSource` 分区连坐后续任务。Jira / Drive 等已点名目标系统的动作仍走各自 scope。

## 用户体验

### 已知失败不再重复消耗

当一次 Jira 查询返回 401 后，系统把 `openclaw:global` 标成 `blocked_auth`。同一网关下的后续动作会停在 `queued` 或原失败状态，不创建 attempt、不增加 `retryCount`、不再次发送原任务，也不重复制造恢复请求。Action Queue 顶部显示受影响契约/动作数量，每张卡显示 scope、原因、输入、审批和证明要求。

### 修复后只重测能力

用户修复配置后点击“修复后重测”，Memory Service 发送专用 probe：只检查连接、鉴权和 capability，不携带原任务正文，也不执行 Jira / Drive 等业务读写。probe 成功只把 contract 改成 `ready`；原动作仍保持原 queue status，写操作仍需独立人工批准。

## Contract 模型

核心表：

- `action_readiness_contracts`: scope、状态、原因、必填输入、审批要求、证明要求、最近 probe、过期时间。
- `action_readiness_links`: contract 与 `proposed_action` / `reflection_thread` 的关系，以及 `blocked_by_readiness`、`depends_on_readiness`、`proved_by_action_result` 原因。

P0 scope：

- `openclaw:global`: OpenClaw gateway 连接或全局鉴权。`targetSystem=agent_task` 的通用委派只使用这一层。
- `openclaw:<targetSystem>:read`: 已点名目标系统的只读能力（jira、google_drive 等）。
- `openclaw:<targetSystem>:write`: 已点名目标系统的写能力。
- `openclaw:unscoped:write`: 没有明确目标系统的写操作。
- 不再使用 `openclaw:agent_task:<triggerSource>:*`。`triggerSource` 只说明谁入队，不能推断任务需要哪种 tool。

状态：

| 状态 | 含义 | Dispatch 处理 |
| --- | --- | --- |
| `ready` | 近期 probe 或可验证 action result 证明能力可用 | 保留原执行/审批流程 |
| `unknown` | 没有近期证明 | 首次动作可作为第一份证明，兼容已有队列 |
| `blocked_auth` | gateway 或目标权限失败 | 阻断原动作 |
| `blocked_capability` | OpenClaw/connector/tool 未配置或不可用 | 阻断原动作 |
| `blocked_input` | `readinessRequiredInputs` / `metadata.requiredInputs` 缺值 | 本地阻断，不访问 OpenClaw |
| `blocked_proof` | 结果缺少可验证 artifact | 阻断后续动作，不写成功 `action_result` |
| `degraded` | 最近连接/执行错误，证明暂不可靠 | 自动动作先 probe，手动动作只允许人工路径 |
| `expired` | `ready` / `degraded` 证明过期 | 自动动作先 probe，手动动作只允许人工路径 |

`ready` 默认有效 6 小时，`degraded` 默认有效 15 分钟。外部写操作的 readiness 与人工审批是两道独立门禁：能力可用不等于用户已批准，批准也不等于外部操作已完成。

## Dispatch 控制点

`ActionExecutor.executeAction()` 在 `markRunning()` 前调用 `prepareActionForDispatch()`：

1. 已知 blocking contract 直接返回 `blocked_by_readiness`。
2. queue status 保持不变，不创建 `proposed_action_attempts`，不增加 retry。
3. linked blocked action 不进入后续 `listDueAutoActions()`，避免它占据每轮 due-action 前排。
4. 首次 `unknown` 保留原兼容路径；原 action 的真实 outcome 会建立第一份 contract 证明。

列表读取使用纯读取检查。`GET /actions` 可以返回由当前配置/输入即时派生的临时 blocked receipt，但不会仅因打开 Action Queue 就持久化 contract、改变 action queue status 或调用外部系统。只有 dispatch、probe、Reflection 持久化门禁或真实 action outcome 才写 contract/link。

## Outcome 映射

- `success` 且 artifact 可验证：global 与目标 scope 进入 `ready`。`agent_task` 只刷新 global。
- `auth_error` + HTTP 401/403：`openclaw:global` 进入 `blocked_auth`；其他权限错误只阻断目标 scope。`agent_task` 的非 401/403 权限失败不写合同。
- `capability_missing` + `configured=false`（或 pairing / 网关不可达）：global 进入 `blocked_capability`。
- 已点名目标系统的 `capability_missing`：目标 scope 短 TTL `degraded`，不永久 `blocked_capability`。
- `agent_task` 执行中的 tool 缺失、缺 artifact、普通 error：**不写就绪合同**，能力判断留在执行器；结果仍记在该次 action run。
- 已点名目标系统的 `artifactValidation=missing_verifiable_artifact`: 目标 scope 短 TTL `degraded`，不 `blocked_proof` 连坐。
- timeout / 普通 error：目标 scope 进入 `degraded`（`agent_task` 除外）。
- `need_human_decision`: capability 可用，但审批/选择仍由独立人工流程处理。

## Probe 契约

API：`POST /api/v1/actions/:id/readiness/probe`。

probe request 固定带 `probeOnly=true`、原 action id、requested mode 和 scope key。prompt 明确禁止执行原动作或修改外部数据，并要求返回 synthetic verifiable artifact。响应固定包含：

- `originalActionExecuted=false`
- probe 的 scope/status/summary
- “未提交原动作，不代表外部业务读写已经发生”的 boundary

本地配置缺失或必填输入缺失时，probe 不访问网络；直接返回当前 blocker。

## Action Queue

`GET /actions` 在原分页响应中增加：

- 每条 `delegate_openclaw` 的 `readinessReceipt`
- 当前可见切片的 `readinessSummary`

UI 使用一条聚合摘要和卡内紧凑 receipt。每条 receipt 的 `dispatchState` 区分 `not_dispatched` 与 `dispatched`：前者可以明确说明本动作停在计次前，后者必须保留“历史 attempt 已发生，不能断言没有外部副作用”的复核边界。`blocked_*`、`degraded`、`expired` 隐藏普通执行/重试控件，改为“修复后重测 / 重测就绪”。按钮 hover 和读屏文案说明 probe 不提交原任务、不证明外部事实或写操作已完成。probe 成功刷新同一列表后，原执行/重试入口才恢复。

`POST /actions/:id/retry` 在 readiness 仍阻断或要求先 probe 时返回 `409 readiness_blocked`，不会先把动作重新排队。

## Reflection 与其他入口

Reflection 在把 `delegate_openclaw` proposal 写入 `proposed_actions` 前检查 readiness。已阻断或必须先 probe 时，不创建 action；只把 `reflection_thread` 链接到 contract，避免反思周期持续堆积注定失败的队列债务。

Ask、Agent Tasks、Message Reaction、Outreach 和 Evidence Watch 已经共用 `ActionExecutor`，因此它们创建的 `delegate_openclaw` action 在真正 dispatch 时继承同一门禁。P0 没有给每个 producer 增加独立设置页或能力矩阵。

## 与 Evidence Watch 的边界

- Evidence Watch Contract 决定“哪条可变化事实需要何时、向哪个来源复核”，并负责复用查证动作。
- Action Readiness Contract 决定“这次复核动作现在是否具备安全执行条件”。
- readiness probe 只证明执行能力，不算 Evidence Watch 的 `checked_no_change` / `checked_changed`，也不能更新权威事实的 `lastCheckedAt`。

## 验证

- Backend: `actionReadinessService`、`api-actions`、`actionExecutor`、`reflectionThreadService`，并覆盖 Ask、Agent Tasks、Message Rules、Evidence Watch、Outreach 回归。
- Extension E2E: `npm run verify:action-queue:e2e`，覆盖阻断摘要、卡片 scope、probe 空 body、无原动作回执、解锁和 390px 移动端无横向溢出。
- Eval: `npm run eval:run -- --suite action-readiness-contracts --no-repair`，5 个真实场景衍生 case 使用本地确定性 OpenClaw fixture；它证明门禁和状态流转，不证明线上 connector 当前可用。

## 当前边界

- P0 只为 `delegate_openclaw` 建立 scope contract；其他 action type 仍使用各自现有前置检查。
- 不自动修复凭据、不重放历史动作、不把 probe 当成业务成功。
- 不提供用户自定义 readiness matrix 或独立设置页。
- `ready` 是近期 capability 证明，不是外部事实、写操作或副作用完成证明。
