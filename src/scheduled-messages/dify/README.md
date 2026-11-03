# Scheduled Messages · Dify Workflows

这些 YAML 是定时消息执行链路上的 Dify 应用导出，和 `../jira-rule-template.json` 同属执行器配置，不放在 `docs/features/`。

| 文件 | 用途 | 调用方 | Env / Key |
|---|---|---|---|
| `http-relay.yml` | 可选：Jira → 通用 GET/POST HTTP Relay → Memory 或 Multica | Executor Rule ≥ 1.10.0 配有 AgentTask Relay Key 时（1.9.0 始终中转） | `AGENT_TASK_DIFY_API_*` 指向自建并发布的 Workflow；下游地址/认证由受保护的 Apps Script 领取返回 |
| `agent-task-jumpboard.yml`（旧版兼容） | Jira → Dify → `memory-service /api/v1/agent-tasks/execute` | Executor Rule `pushMethod=AgentTask` | `AGENT_TASK_DIFY_API_*`；Dify 内还要填全权 `MEMORY_SERVICE_API_KEY` |
| `botman-jumpboard.yml` | Jira → Dify → botman `/user/message`、`/team/message` | Executor Rule Bot 私发 / 群发 | `BOTMAN_DIFY_API_*`；Dify 内还要填 `BOT_TOKEN` / `BOT_ID` |
| `ringcentral_dify_workflow_split_credentials.yml` | Jira → Dify → RingCentral Team Messaging（拆分 clientId/secret/jwt） | Executor Rule AsMe `targetType=ringcentral_sender` | `RINGCENTRAL_SENDER_DIFY_API_*` |
| `AI report.yml` | AI Report 枢纽（advanced-chat）；定时消息 AI Report 模板默认打这个 Dify app | Messages 行 `AI_Endpoint` / Jira API 分支 | 行级 Endpoint + Headers 里的 Bearer app key |

## 边界

- Chrome 扩展 AR 即时刷新仍直连 `MEMORY_SERVICE_BASE_URL`，不走 AgentTask 跳板。
- AsMe 未启用 RingCentral sender 时走 AppScript 邮件 fallback，不走 Dify。
- Bot 群组消息需要先把 “SM AI” 加进目标群；私发不需要。
- Bot 私发的 `inputs.email` 来自 Apps Script `botmanEmail`（`Glip_User_Name` 规范成 `userId@ringcentral.com`），不是 Jira 发起人邮箱；`userName` 作为旧 Apps Script 响应缺少 `botmanEmail` 时的 `personName` 兜底。跳板只原样转发目标字段，不会自动补域名，并向 Botman 使用 `emailAutoCorrect`。Executor Rule ≥ 1.7.3 才会带上兼容字段；群发仍传 `teamId`。
- secret 环境变量导入 YAML 时通常为空，Botman / RingCentral 相关 token、以及 AgentTask 跳板的 `MEMORY_SERVICE_API_KEY` 要在 Dify 环境变量里手工补齐后再 Publish。
- AgentTask 跳板连的是 memory-service **全权 `API_KEY`**（所有用户共用，请求里带 `X-User-Id`），不是扩展本机 `pak.…`，也不是 `BOOTSTRAP_API_KEY`。缺这把钥匙时下游返回 `401 authentication_required`。Botman / RingCentral 跳板不调 memory-service，不需要这把 key。
- **网络**：AgentTask 跳板下游 URL 写在 Dify 环境变量 `MEMORY_SERVICE_AGENT_TASK_URL`（YAML 默认 `http://10.32.56.212:3210/api/v1/agent-tasks/execute`），**不进** Jira rule / 扩展 `.env`。Jira rule 只打 `AGENT_TASK_DIFY_*`；Chrome AR 仍用 `MEMORY_SERVICE_BASE_URL`。

## 通用 HTTP Relay：发布与迁移

扩展 ≥ 12.1.17、Apps Script ≥ 3.4.0、Executor Rule ≥ 1.10.0 支持可选网络中转：创建/升级规则时，有效 `AGENT_TASK_DIFY_API_KEY` 非空走 `Apps Script 生成请求 → Jira → Dify HTTP Relay → Memory / Multica → Apps Script 确认`；空值（含纯空格）走 `Apps Script 生成请求 → Jira 直接 POST Memory / Multica → Apps Script 确认`。Relay 不用 LLM、不解释任务、不判断业务接受状态、不调度、不保存下游 Key。

Jira 网络直达目标时不需要为 AgentTask 部署 Dify。网络隔离需要桥接时，自部署用户须自建 Dify App，按下列步骤导入并发布。直连按 provider 和 HTTP/HTTPS 生成固定协议 URL 分支，不把 Memory Key 发给 Multica；两种模式共用 capability、冻结 provider、幂等键及接受状态校验。直连回执只回传 accepted/actionId/status/run_id/issue_id，字段有界；网络错误、5xx、缺失 ID 等仍保持未确认。Jira 若在非 2xx 时中止规则，没有确认的领取同样按 UNKNOWN 隔离。不会在失败后切换路径补发。

按顺序完成：

1. 导入 `http-relay.yml` 为 **Personal AI HTTP Relay**。核对环境变量 `ALLOWED_ROUTES_JSON` 后 Publish。每条规则指定完整 `origin`、精确 `path` 或以 `/` 结束的 `pathPrefix`、`methods`、`allowedHeaders`；不允许将 Memory 的 Authorization 携带到 Multica。默认允许 Memory NodePort 的 execute POST，以及 task.xmnup.com HTTP/HTTPS、api.multica.ai HTTPS 的 Autopilot Webhook POST。新增 GET API 只需加一条不带下游认证头的匹配规则；GET 不接受 body。
2. 在当前 Apps Script 项目设置 → **脚本属性**配置：
   - `AGENT_TASK_MEMORY_URL`：Dify 可达的完整 Memory execute URL，例如 `http://10.32.56.212:3210/api/v1/agent-tasks/execute`。
   - `AGENT_TASK_MEMORY_API_KEY`：该 Memory Service 的服务端 `API_KEY`，不要未经权限验证就换成个人 `pak.…` 或 bootstrap key。
   - `AGENT_TASK_MEMORY_USER_ID`：该调度表所属用户 ID，作为 `X-User-Id`。
   - 仅用 Multica 的表不需要这三个属性。Memory 首次经过有效 capability 的领取时，可从已有 Config 的 `agent_task_webhook_url/token/user_id` 导入；显式脚本属性始终优先，行级 AI_Endpoint/AI_Headers 不能改写认证目标。为兼容旧规则，导入不自动删除 Config 旧值；确认不再回滚后由表格所有者清理旧 Key 副本。
3. 需要中转时，把新 Workflow 的 API Base/Key 写入扩展现有的 `AGENT_TASK_DIFY_API_BASE_URL` / `AGENT_TASK_DIFY_API_KEY`，重新构建并加载扩展（12.1.18）。Key 必须属于 **新 Relay**，不能继续使用旧 AgentTask Jumpboard 的 app key；直连则保持有效 Key 为空。
4. 先升级 Apps Script 到 **3.5.0**，再升级/重建 Executor Rule 到 **1.10.0**。规则创建/升级会读取或创建 Config 的 `multica_scheduler_capability` 并注入 Jira；已有有效值沿用，不因换设备直接轮换。两种模式都使用 `agentTaskRelay=1` 领取受保护的请求。已有规则不会自动响应本机 Key 的变化，必须重新生成规则。
5. 用测试表、测试 Autopilot 和受控 Memory 任务核对成功、401/403、业务拒绝、超时及重复回执。代码测试不代表已在目标 Dify 导入或生产 Jira 完成投递。

### 新安装与自动配置

- 构建机将 Relay API Base/Key 写入 Git 忽略的 `.env`；开发环境 `.env.development` 中的非空值优先，因此切换应用时应同时更新两处。Key 随构建成为扩展默认值；从源码在其他机器构建仍需配置环境文件。不要把真实 Key 写入 `.env.example` 或提交到仓库。
- 已安装扩展的 Options 本地覆盖值优先于构建默认值，换 Key 后需更新旧覆盖值，并升级/重建 Jira Executor Rule，已有规则不会因环境文件变化自动换 Key。
- 扩展 ≥ 12.1.16 一键初始化新表时，根据当前用户身份和 Memory 配置自动写入 Config 的 `agent_task_webhook_url/token/user_id`。缺少用户身份时不猜测归属，保存首个 Memory AgentTask 时会再次尝试补齐；服务 Key 仍须有效配置。Apps Script 在首次通过 capability 校验的 Memory 领取时将这些值导入脚本属性，不需要逐个手填。仅用 Multica 的表无需配置 Memory 属性。
- 新表创建/升级 Jira Rule 时会自动建立调度 capability。Google 首次授权仍须表格所有者完成。
- Dify 只需导入 `http-relay.yml`；目录里的两个 `.py` 是已内嵌到 YAML 的 Code 节点维护源码，不需要另外上传、导入或部署。

### 请求与回执

Jira POST `/workflows/run`：`inputs.request_json` 是一个 JSON **字符串**，包含 `{version:1, requestId, url, method, headers, body}`，其中 body 也是字符串，保留引号、换行和 Unicode。`response_mode=blocking`；不再发送旧的 payload_json。Memory 是 POST execute + Authorization / X-User-Id / X-Request-ID；Multica 是 POST Webhook + Idempotency-Key，不使用 PAT。

Relay 输出 `requestId、transportOk、statusCode、responseBody、errorCode`，全部是字符串。`transportOk` 仅表示取得 HTTP 响应，HTTP 200 或 Workflow SUCCESS 不代表任务接受。responseBody 是脱敏后的 JSON，最大 2048 个 ASCII 字符（Unicode 使用 JSON 转义）；超限/非 JSON 返回未确认，不截断后伪装成功。网络错误可能使 Workflow 失败或没有 outputs，Jira 的确认因缺少 requestId 被拒绝，账本仍保持未确认。HTTP 节点不设置会覆盖真实 4xx 输出的 default-value 错误策略。

Jira 使用 GET `confirmAgentTaskRelay` 回传有界回执，避免 Apps Script ContentService POST 的 Google 302 问题；新确认端点同时支持 POST。确认需要 capability、messageId、executionKey、requestId。provider 在领取时写入执行账本，确认不信任调用方传入的 provider，也不依赖后来被编辑的 Messages 行。旧 mark/confirm 端点不能绕过这一校验确认 Relay 领取。

Apps Script 判定：Memory 要求 2xx、`accepted=true` 和 actionId；Multica 要求 2xx、`status=accepted/duplicate` 和 run_id。4xx（408 除外）、显式拒绝或转发校验失败记 Failed；网络/5xx/超时/无法解析/缺少 run_id/超大回执保持未确认，后续沿用账本 UNKNOWN 隔离，不自动重发。确认事务和重复去重沿用原账本，重复回执只记一次。

### 部署边界

- YAML 使用静态 GET/POST HTTP 节点，前置校验通过才可发请求，禁用节点自动重试，TLS 校验开启。目标服务必须按原幂等键去重，未知结果不允许重新生成幂等键补发。
- 目标白名单校验作用于首次请求。部分 Dify 版本的 HTTP 节点会自动跟随重定向；本 YAML 不假称可用一个未受支持的参数关闭它。生产环境必须用 Dify 出站代理/网络策略约束所有跳转可达的目标，认证服务不能重定向到其他源；同样需要核实 Dify SSRF 代理对内网 Memory/自托管域名的放行。没有取得目标部署的配置证明或实测时，不把此项算已验证。
- 下游 Key/Webhook 会经过 Apps Script 领取响应、Jira 和 Dify 普通输入/节点日志。它们不是 Dify secret 环境变量，不能假定自动遮罩。输出脱敏不能清除 Dify 已记录的输入；限制这些运行记录的访问及留存。公开版本/health 接口不读取脚本属性；应用自己的日志不打印请求封装。
- `http-relay/validate.py`、`http-relay/response.py` 是 Code 节点源码；改动后运行 `node tools/build-http-relay-workflow.mjs` 重建 YAML，再运行 `npm run verify:agent-task-relay`。确定性测试涵盖协议与账本，无 LLM 体验评测需求。

## 旧版发布与接线（回滚参考）

1. 在 Dify 导入对应 YAML 并 **Publish**。
2. 把 Workflow / App 的 API Base（通常 `https://dify.int.rclabenv.com/v1`）和 API Key 写入扩展 `.env`：
   - `AGENT_TASK_DIFY_API_BASE_URL` / `AGENT_TASK_DIFY_API_KEY`
   - `BOTMAN_DIFY_API_BASE_URL` / `BOTMAN_DIFY_API_KEY`
   - `RINGCENTRAL_SENDER_DIFY_API_BASE_URL` / `RINGCENTRAL_SENDER_DIFY_API_KEY`
3. 在定时消息管理页升级 Jira Executor Rule（模板版本 ≥ **1.6.0**），密钥会在创建/升级时注入 Rule。

产品说明见 [docs/features/scheduled_messages_manager.md](../../../docs/features/scheduled_messages_manager.md)。

实现依据：[Dify HTTP 节点文档](https://docs.dify.ai/en/cloud/use-dify/nodes/http-request)、[HTTP Executor 源码（1.6.0：动态 headers、跟随跳转）](https://github.com/langgenius/dify/blob/1.6.0/api/core/workflow/nodes/http_request/executor.py)、[HTTP 节点源码（1.6.0：关闭重试时保留下游非 2xx 响应）](https://github.com/langgenius/dify/blob/1.6.0/api/core/workflow/nodes/http_request/node.py)。目标部署版本仍需导入及网络验收。

### 行内 Multica 绑定迁移

扩展 12.1.18 / schema 2.15 将正在引用的旧绑定迁至 Messages 的 `Agent_Multica_Webhook_URL` / `Agent_Multica_Spreadsheet_ID`，回读一致且线上脚本 ≥ 3.5.0 后删除 `_AgentBindings`。当前任务行保存唯一有效 Webhook，不再保留替换历史。先完成表结构/绑定复制，再部署新脚本并再次同步完成删除；回读失败不会删除旧表。共享 Messages 等于共享 Webhook 触发凭据，PAT 仍只在本机。使用 `inspectMulticaAgentTask`（capability + messageId）可只读检查，不要用实际领取接口调试会写外部数据的任务。
