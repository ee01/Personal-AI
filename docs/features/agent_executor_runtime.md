# Agent Executor Runtime

*最后更新: 2026-08-13*

Personal AI 的 Agent 执行控制面：把「入队、选执行器、证据契约、记忆工具、对外被调用」拆成稳定分层。Sheet / Jira 只负责计划与触发；执行账本在 memory-service。

## 分层一句话

- **MCP**：别人带着 Personal AI 的记忆干活（stdio + Streamable HTTP）
- **OpenClaw Gateway / ACP**：Personal AI 派活的两条胳膊
- **A2A**：Personal AI 自己作为 Agent 被外界调用的门面
- **Registry + Options**：按用途显式选择执行器实例（不做隐式自动路由）
- **Context Pack + 个人 key**：把记忆以 REST / MCP / A2A 接到外部 AI，外发凭证与扩展服务密钥分层

扩展帮助中心「记忆外接」条目用 REST / MCP / A2A 三 Tab：可复制片段注入真实 host + **个人 key** + user-id；黄底区实时拉取 `GET /api/v1/context-pack`。MCP / A2A 预览仍是演示样例，不在帮助页真连或入队。

## 控制面（Block A）

- `POST /api/v1/agent-tasks/execute`：**入队即返回**（202/accepted），后台执行与通知解耦
- 通知语义（结果通知 vs 回执）：
  - `notifyTarget` 存在 → **成功**时发结果到目标（可套用 `notifyTemplate`）；**失败不发目标**
  - `successReceipt`（默认 `true`）→ 成功时额外 Bot 私发本人；目标已是本人私发时去重合并
  - 失败回执始终 Bot 私发本人；仅 `notify: false`（API 级，如 AR）可完全静默
  - `notifyVia` 预留，v1 恒为 `bot`
- `proposed_actions.idempotency_key`：**UNIQUE**；幂等键确定性（无 `Date.now()` 兜底）
- 队列态含 `input_required` / `running`；Gateway 断连后可停在可恢复态，不把网络层失败直接等同业务失败
- Readiness：`agent_task` 只走 `openclaw:global` 连接层；点名目标系统的缺 artifact → 短 TTL degraded，**不做**整 scope `blocked_proof` 连坐

## 执行器抽象（Block B/H）

- 接口：`memory-service/src/integrations/executors/AgentExecutor.ts`
- 动作类型：`delegate_agent`（兼容旧 `delegate_openclaw`）
- 配置：`agentExecutors[]` + `executorDefaults.{agent_task,reflection_research}`
- **新用户默认**：memory-service `.env` 的 `OPENCLAW_BASE_URL` / `OPENCLAW_API_KEY` / `OPENCLAW_EXECUTOR_TYPE`（默认 `openclaw-gateway`）/ `OPENCLAW_EXECUTOR_LABEL`。没有自己的 `agentExecutors` 时，首次 `GET /config` 会写入 `id=openclaw` 的 Gateway 行，并把 `executorDefaults` 指过去。用户在 Options 里改过执行器之后以用户配置为准。
- Options UI：「Agent 执行器」统一承载 OpenClaw / ACP；旧 `openClaw*` 在 `GET /config` 时自动导入为 `id=openclaw` 条目，并回写 `agentExecutors`
- 执行器列表：**添加即可用**，无 per-item 启用开关
- 「允许外部委派（反思查证 / 联动操作）」总开关在执行器管理下方，映射 `openClawEnabled`，**默认开**；只门控反思/联动创建委派，**不影响** Agent Task
- Options：总开关为 toggle；开启时在其下方展示「反思查证默认执行器」，关闭时隐藏
- 委派「用谁」由 `executorDefaults.reflection_research`（反思查证默认执行器）决定；与总开关是 on/off vs 路由 的关系
- 请求级覆盖：`/agent-tasks/execute` 的 `executor` 字段 > 用途默认
- 空列表运行时仍可合成 legacy（迁移前兜底）；有配置的用户会持久化导入

支持类型：

| type | 实现 | 用途 |
|---|---|---|
| `openclaw-responses` | `OpenClawResponsesExecutor` | legacy HTTP `/v1/responses` |
| `openclaw-gateway` | `OpenClawGatewayExecutor` | WS `agent` + `agent.wait` + `sessions.*` reconcile |

Gateway 客户端优先用 `globalThis.WebSocket`（Node 22+）；缺失时回退到 `ws` 包。Docker 镜像使用 `node:22-slim`。

Handshake 对齐 OpenClaw 2026.7 `ConnectParams`：
- `client.id=gateway-client`、`client.mode=backend`（`mode` ≠ `role`；`role` 仍为 `operator`）
- 等待 `connect.challenge` 后用本地 Ed25519 设备身份签名 v3 payload（`data/openclaw-gateway-device.json`）
- 远程首次连接可能需在 OpenClaw 侧批准 pairing（`openclaw devices list` / approve）
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
- Bearer 接受 **个人 key**（绑定该用户）或服务密钥；个人 key 优先，不再依赖 `X-User-Id` 伪装身份

环境变量：`MCP_HTTP_ENABLED`、`MCP_BEARER_TOKEN`/`API_KEY`、`MCP_ALLOWED_ORIGINS`、`MCP_ALLOWED_SCOPES`、`MCP_OAUTH_SCOPES`

## ACP Codex（Block D）

- `AcpExecutor` 默认 `npx -y @agentclientprotocol/codex-acp`
- `session/new` 注入 Streamable HTTP + stdio 两份 personal-memory MCP（按需检索，不复制记忆库）
- `cwd` 来自执行器实例配置；`sessionId` 写入结果 payload 便于续聊

## A2A（Block G）

- Agent Card：`GET /.well-known/agent-card.json`（兼 `/.well-known/agent.json`）
- JSON-RPC：`POST /a2a` — `message/send` / `tasks/send` / `tasks/get` / `tasks/cancel`
- 映射：`taskId` ↔ `proposed_actions.id`（agent_run_id）；`contextId` ↔ `metadata.a2aContextId`
- TaskStore = 现有动作队列账本
- Bearer：**个人 key** 或服务密钥。个人 key 把会话钉在签发用户上；与 `X-User-Id` 冲突时拒绝

快速自检：

```bash
curl -sS http://memory.xmnup.com/.well-known/agent-card.json \
  -H "Authorization: Bearer pak.<…>"
```

## 外接凭证：两层信任 + Context Pack

| 层级 | 是什么 | 谁用 | 能力 |
|---|---|---|---|
| Tier 1 服务密钥 | 后端 `API_KEY`（Desktop / 运维 env，不进扩展 Options） | 桌面端 / 脚本 | 可带 `X-User-Id` 代任意用户 |
| Tier 2 个人 key | `pak.<base64url(userId)>.<secret>` | Dify / Cursor / MCP / A2A / curl | **只**访问签发用户；默认 `memory.read` |

- 签发：`POST /api/v1/users/me/keys`（帮助中心「生成外接 key」按需触发；服务端只存 sha256）
- 列表 / 吊销：`GET|DELETE /api/v1/users/me/keys[/:id]`
- 明文只在创建响应返回一次；帮助页与 Options 只读展示前缀
- **不要**把 Options 服务密钥贴进外部工具

### REST Context Pack

```
GET /api/v1/context-pack?scope=identity_preferences|recent_focus|today|projects
GET /api/v1/context-pack?scope=custom&q=…
Authorization: Bearer pak.…   # 或服务密钥 + X-User-Id
```

返回 `{ prompt, sources[], generatedAt, redactionReceipt }`。只读；`identity_preferences` 走 PersonaProjection，不外发 `USER_CORE` 原文。`custom` 标实验性。

```bash
curl -sS 'http://memory.xmnup.com/api/v1/context-pack?scope=identity_preferences' \
  -H "Authorization: Bearer pak.<…>"
```

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
  src/__tests__/executorRegistry.test.ts \
  src/__tests__/userApiKeys.test.ts \
  src/__tests__/api-context-pack.test.ts

npm run eval:validate
npm run eval:run -- --suite agent-executor-runtime --no-repair
```

## 相关文档

- [定时消息管理](./scheduled_messages_manager.md)（AgentTask 触发）
- [Action Readiness Contracts](./action_readiness_contracts.md)（dispatch 前门禁）
- [Personal Roadmap](./personal_roadmap.md)（Agent 创建 Jira 路径）
- [Memory System](../memory_system.md)（外接凭证与记忆外接口径）
