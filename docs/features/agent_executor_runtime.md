# Agent Executor Runtime

*最后更新: 2026-08-28*

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
  - `notifyVia`：成功结果可为 `bot`（默认）或 `asme`；回执始终 Bot。AsMe 使用 Sheet RingCentral sender token（与 AsMe 发消息相同），失败不回退 Bot
  - `notifyTarget` / `successReceipt` / `notifyVia` / `notifyTemplate` 由插件在保存 Sheet 行时**直接注册**到 `agent_task_notify_configs`（按 `sheetMessageId`），`/agent-tasks/execute` 的请求体缺哪个字段就回落读这张表，请求体给了值则请求体优先。这样即使触发链路（Apps Script）版本落后、没转发某个字段，通知语义也不受影响
  - 发到 `notifyTarget` 的正文只有两种来源：模板格式化成功的结果，或者「标题 + 结果摘要」的纯公告文本——**不会**是私密回执体（Run id / 触发来源 / Sheet 账本边界说明）；后者只用于 `success_receipt` / `failure_receipt` 两种回执
  - 模板格式化经一次内部 OpenClaw 委派调用；调用异常、返回非 success、或摘要为空，都会记录 warn（含具体原因）后回落到纯公告文本，不会静默
  - 结果投递（`result` 类型）的成功/失败会写入 `channel_delivery_records`；`GET /agent-tasks/runtime-status` 返回 `resultNotifyDelivery: { delivered, error? }`；投递失败时会额外私发 owner 一条说明，避免"回执说成功、群里却什么都没收到"的静默
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
- 请求级覆盖：`/agent-tasks/execute` 的 `executor` 字段 > 用途默认。空值走 `executorDefaults.agent_task`。显式实例 id（包括本机那条 `openclaw`）按所选实例执行。帮我做弹窗会列出 Options 执行器并默认选中 Agent Task 默认项。
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
| `acp-codex` / `acp-claude-code` / `acp-cursor` | `AcpExecutor` | stdio 驱动官方 ACP adapter（Cursor 走仓库内 `cursor-acp` shim）；注入 Personal AI MCP |

共享契约：`agentResultContract.ts` — success 必须带可验证 artifact；`observedFields` 接受 **array 或 object**。查询/扫描类任务正确查到 0 个匹配是合法 success，不算缺证据：交一张 `kind: 'query_result'`（或 `metadata.matchCount === 0`）+ `sourceSystem` + `query`（实际查询语句）+ `verification` 的收据即可，不要求 `entityId`；系统提示词（`agentResultPrompt.ts`）已教会 agent 这个模式。

用户 Task 只写要做什么。JSON 信封和 artifact 收据由共享 system prompt（`agentResultPrompt.ts`）规定，Gateway `extraSystemPrompt`、ACP 前置说明、legacy `/v1/responses` developer 消息共用。解析器（`agentResultEnvelope.ts`）只把带已知 `status` 的对象当信封，避免把 `{"value":"Yes"}` 这类附带 JSON 误判为失败；若模型仍返回带实体 ID 和回读证据的 Markdown，会保守推导收据，而不是把业务成功记成 error。

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
- **local**：`session/new` 注入 Streamable HTTP + stdio 两份 personal-memory MCP（按需检索，不复制记忆库）
- **remote**：由 Worker 在用户机器上 spawn ACP；只注入 HTTP MCP（用户机器要能访问 Memory Service 公网/内网地址）
- `cwd` 来自执行器实例配置（local）或 Desktop/Worker 本机设置（remote）；`sessionId` 写入结果 payload 便于续聊

## ACP Cursor（cursor-agent）

- 类型：`acp-cursor`。Options 下拉里显示「Cursor（cursor-agent）」，运行位置仍是 `local` / `remote`（Worker 通道），**没有**独立的第五种执行器。
- 适配器：仓库内 `cursor-acp/` 是薄 ACP stdio shim。Memory Service / Worker 默认 `node cursor-acp/dist/index.js`（可用 `ACP_CURSOR_COMMAND` 覆盖）。一期不上 npm。
- 底层 CLI：宿主机 `cursor-agent`（别名 `agent`）。鉴权是 `cursor-agent login` 或 `CURSOR_API_KEY`，凭据不经过 Memory Service。
- Headless 旗标：`-p --output-format stream-json --trust --approve-mcps --workspace <cwd>`；只读任务加 `--mode ask`；续聊 `--resume <chatId>`。默认不加 `--force`。
- 会话：ACP `sessionId` 与 Cursor chat id 映射保存在进程内和 tmp 目录，shim 重启后仍可 resume。
- MCP：ACP `session/new` 里的 **HTTP** MCP 合并进项目 `.cursor/mcp.json`，名字加 `personal-ai-` 前缀；已有同名条目不覆盖并警告；任务结束（prompt 返回 / 进程退出）恢复原文件。stdio MCP 不写入。
- Probe：local 会 spawn shim 并 `initialize`；`cursor-agent` 未安装 → `connect`；未登录 → `auth`。remote 仍只看 Worker 心跳 / echo。
- Desktop：设置页可覆盖 Cursor ACP 命令和 `cursor-agent` 路径；Electron 拉起 Worker 时会把 `~/.local/bin` 补进 PATH，避免 GUI 找不到 CLI。
- **不做**：Cursor Cloud / Background Agents（P3）；独立 `CursorCliExecutor`。

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

## 大白话运行逻辑

用户在 Options「Agent 执行器」里登记 OpenClaw / ACP。ACP 多一个**运行位置**：

1. **local**：任务在 Memory Service 主机上 `spawn` `codex-acp` / Claude ACP / Cursor ACP shim（自托管同机用这档）。
2. **remote**：任务不在服务端跑，只写入队列态 `awaiting_claim`，等已配对的 Worker 出站领取。Worker 是通道，不是第五种执行器类型；一台 Worker 可以绑多个 ACP 实例。

三种 Worker 宿主走同一协议（pair / heartbeat / claim / report，`protocolVersion=1`）：

| 宿主 | 用户动作 |
|---|---|
| Desktop App 内嵌（主路径） | 安装 Desktop → 打开 Personal AI.app → Chrome 扩展 Options「Agent 执行器」顶部「一键配对本机 Desktop App」（Desktop 未在线时按钮仍显示，但不可点）；Electron main 用 `utilityProcess.fork` 拉起 `worker/`，崩溃指数退避重启（最多 5 次/小时），tray 显示 online/stale/error |
| headless | `curl -fsSL <install.sh> \| bash -s -- --server <url> --token <pairing>`，launchd / systemd 守护 |
| 平台调度（零安装） | 不装常驻进程：用 Cursor/Codex 的 schedule 周期性跑 `worker --once`，或直接调下面的 HTTP API |

远程任务带 lease（默认 5 分钟）和 fence token。Worker 被杀后租约过期，任务回到 `awaiting_claim`；旧 fence 的 report 返回 409。连通性「测试」只探活（WS/HTTP/ACP initialize/心跳），**不跑 LLM**；「深度测试」给 Worker 发 `echo`。

## Worker 与 probe

- 表：`agent_workers` / pairing tokens / leases / commands；`proposed_actions.target_worker_id`
- 凭据：`awk.<base64url(userId)>.<workerId>.<secret>`（与 `pak.` 同层，路由到对应用户库）；配对令牌 `wpt.<base64url(userId)>.<secret>`，15 分钟一次性
- API：`POST /api/v1/agent-workers/pairing-tokens|pair`、`POST /:id/heartbeat|claim|report`、`GET /:id/commands`、`GET /agent-workers`、`DELETE /:id`
- Worker 跑 ACP 时 `session/new` **只注入 HTTP MCP**（`/mcp` + worker Bearer），不传本机 stdio fallback。`/mcp` 接受 `pak.` 与 `awk.`。
- `POST /api/v1/agent-executors/:id/probe` → `{ ok, latencyMs, stage, detail, nextAction }`。`stage` = dns / connect / auth / ready。结果进程内缓存 5 分钟，并写入 readiness 任务级记录（status 仅 ready/degraded，**不** `blocked_proof`）。
- OpenClaw 不需要 runtime 开关；gateway 地址为 127.0.0.1 / 内网时 Options 提示「仅 Memory Service 主机可达」。
- Desktop 设置页可改本机 Worker 的 cwd 与 ACP 命令；tray「Open Worker Log」打开 `~/Library/Logs/PersonalAI/worker.log`。
- 发布：`npm run build:app` 同时编 Desktop 与 Worker；`npm run deploy:app` 发布 `desktop-v*`（内嵌 worker）和 `worker-v*`（tarball + install.sh）。协议靠握手版本，不靠同步发版。Worker 暂不上 npm。

## Sheet 触发（Block 0）

- Apps Script **claim ≠ confirm**；AgentTask at-least-once；自定义 API at-most-once + TTL
- 线上模板需在定时消息管理页**手动升级** Apps Script / Jira Rule 后才对真实 Sheet 生效

## 明确不做

- Outreach 主状态机不并入 agent 队列
- Google Sheet 不做可靠任务总线
- Worker 不上 npm 公共包；不单独做「仅 Worker 的菜单栏精简版」（引导装完整 Desktop App）

## 验证

```bash
npm --prefix memory-service test -- --run \
  src/__tests__/openClawGatewayExecutor.test.ts \
  src/__tests__/acpExecutor.test.ts \
  src/__tests__/mcpTools.test.ts \
  src/__tests__/a2aRoutes.test.ts \
  src/__tests__/executorRegistry.test.ts \
  src/__tests__/executorProbe.test.ts \
  src/__tests__/api-agent-executors-probe.test.ts \
  src/__tests__/api-agent-workers.test.ts \
  src/__tests__/userApiKeys.test.ts \
  src/__tests__/api-context-pack.test.ts

npm --prefix desktop-app test -- src/__tests__/workerSupervisor.test.ts
npx --yes tsx --test worker/src/protocol.test.ts worker/src/runner.test.ts
```

协议与队列是确定性的，不新增 LLM eval suite。


## 相关文档

- [定时消息管理](./scheduled_messages_manager.md)（AgentTask 触发）
- [Action Readiness Contracts](./action_readiness_contracts.md)（dispatch 前门禁）
- [Personal Roadmap](./personal_roadmap.md)（Agent 创建 Jira 路径）
- [Memory System](../memory_system.md)（外接凭证与记忆外接口径）
- [自托管 Memory Service](../self-hosting-memory-service.md)（ghcr 镜像 + `deploy/bootstrap.sh`）
- [Worker](../../worker/README.md)（headless 安装）
