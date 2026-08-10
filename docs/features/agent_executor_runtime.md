# Agent Executor Runtime

*最后更新: 2026-08-09*

Personal AI 的 Agent 执行控制面：把「入队、选执行器、证据契约、记忆工具、对外被调用」拆成稳定分层。Sheet / Jira 只负责计划与触发；执行账本在 memory-service。

## 分层一句话

- **MCP**：别人带着 Personal AI 的记忆干活（stdio + Streamable HTTP）
- **OpenClaw Gateway / ACP**：Personal AI 派活的两条胳膊
- **A2A**：Personal AI 自己作为 Agent 被外界调用的门面
- **Registry + Options**：按用途显式选择执行器实例（不做隐式自动路由）

## 控制面（Block A）

- `POST /api/v1/agent-tasks/execute`：**入队即返回**（202/accepted），后台执行与通知解耦
- `proposed_actions.idempotency_key`：**UNIQUE**；幂等键确定性（无 `Date.now()` 兜底）
- 队列态含 `input_required` / `running`；Gateway 断连后可停在可恢复态，不把网络层失败直接等同业务失败
- Readiness：缺 artifact → 短 TTL degraded，**不做**整 scope `blocked_proof` 连坐

## 执行器抽象（Block B/H）

- 接口：`memory-service/src/integrations/executors/AgentExecutor.ts`
- 动作类型：`delegate_agent`（兼容旧 `delegate_openclaw`）
- 配置：`agentExecutors[]` + `executorDefaults.{agent_task,reflection_research}`
- Options UI：「Agent 执行器」；空列表时用 legacy `openClaw*` **合成** `{id:'openclaw', type:'openclaw-responses'}`
- 请求级覆盖：`/agent-tasks/execute` 的 `executor` 字段 > 用途默认

支持类型：

| type | 实现 | 用途 |
|---|---|---|
| `openclaw-responses` | `OpenClawResponsesExecutor` | legacy HTTP `/v1/responses` |
| `openclaw-gateway` | `OpenClawGatewayExecutor` | WS `agent` + `agent.wait` + `sessions.*` reconcile |
| `acp-codex` / `acp-claude-code` | `AcpExecutor` | stdio 驱动官方 ACP adapter；注入 Personal AI MCP |

共享契约：`agentResultContract.ts` — success 必须带可验证 artifact；`observedFields` 接受 **array 或 object**。

## OpenClaw Gateway（Block C）

- 持久化 `remoteRunId` / `sessionKey` / cursor 到 `result_json`（running 期间 `patchRunningResult`）
- 断连 reconcile：仍在跑 → `queue_status=running`；确认无 run → `failed`；不确定 → `input_required`
- **不做**：OpenClaw/Codex 侧 `cleanup retired shared client` 根治（协作事项）

## MCP（Block F）

- stdio：`memory-service/mcp-server.mjs`
- Streamable HTTP：`POST/GET /mcp`（Bearer + 可选 Origin allowlist）
- 工具：`memory_search` / `memory_ask` / `memory_evidence_get` / `memory_save` / `memory_context_brief` / `memory_profile_hint`
- 证据级：稳定 `evidenceId`、通道回执、时间可信度；`memory_evidence_get` 需 oauth scope `evidence.raw.read`
- 检索 mode：`qa` | `investigation` | `audit`

环境变量：`MCP_HTTP_ENABLED`、`MCP_BEARER_TOKEN`/`API_KEY`、`MCP_ALLOWED_ORIGINS`、`MCP_ALLOWED_SCOPES`、`MCP_OAUTH_SCOPES`

## ACP Codex（Block D）

- `AcpExecutor` 默认 `npx -y @agentclientprotocol/codex-acp`
- `session/new` 注入 Streamable HTTP + stdio 两份 personal-memory MCP（按需检索，不复制记忆库）
- `cwd` 来自执行器实例配置；`sessionId` 写入结果 payload 便于续聊

## A2A（Block G）

- Agent Card：`/.well-known/agent-card.json`（兼 `/.well-known/agent.json`）
- JSON-RPC：`POST /a2a` — `message/send` / `tasks/send` / `tasks/get` / `tasks/cancel`
- 映射：`taskId` ↔ `proposed_actions.id`（agent_run_id）；`contextId` ↔ `metadata.a2aContextId`
- TaskStore = 现有动作队列账本

## Sheet 触发（Block 0）

- Apps Script **claim ≠ confirm**；AgentTask at-least-once；自定义 API at-most-once + TTL
- 线上模板需在定时消息管理页**手动升级** Apps Script / Jira Rule 后才对真实 Sheet 生效

## 明确不做

- **Block E**（反向 Worker / 出站领取）
- Outreach 主状态机不并入 agent 队列
- Google Sheet 不做可靠任务总线

## 验证

```bash
npm --prefix memory-service test -- --run \
  src/__tests__/openClawGatewayExecutor.test.ts \
  src/__tests__/acpExecutor.test.ts \
  src/__tests__/mcpTools.test.ts \
  src/__tests__/a2aRoutes.test.ts \
  src/__tests__/executorRegistry.test.ts

npm run eval:validate
npm run eval:run -- --suite agent-executor-runtime --no-repair
```

## 相关文档

- [定时消息管理](./scheduled_messages_manager.md)（AgentTask 触发）
- [Action Readiness Contracts](./action_readiness_contracts.md)（dispatch 前门禁）
- [Personal Roadmap](./personal_roadmap.md)（Agent 创建 Jira 路径）
