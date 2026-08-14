# Scheduled Messages · Dify Workflows

这些 YAML 是定时消息执行链路上的 Dify 应用导出，和 `../jira-rule-template.json` 同属执行器配置，不放在 `docs/features/`。

| 文件 | 用途 | 调用方 | Env / Key |
|---|---|---|---|
| `agent-task-jumpboard.yml` | Jira → Dify → `memory-service /api/v1/agent-tasks/execute` | Executor Rule `pushMethod=AgentTask` | `AGENT_TASK_DIFY_API_*`；Dify 内还要填全权 `MEMORY_SERVICE_API_KEY` |
| `botman-jumpboard.yml` | Jira → Dify → botman `/user/message`、`/team/message` | Executor Rule Bot 私发 / 群发 | `BOTMAN_DIFY_API_*`；Dify 内还要填 `BOT_TOKEN` / `BOT_ID` |
| `ringcentral_dify_workflow_split_credentials.yml` | Jira → Dify → RingCentral Team Messaging（拆分 clientId/secret/jwt） | Executor Rule AsMe `targetType=ringcentral_sender` | `RINGCENTRAL_SENDER_DIFY_API_*` |
| `AI report.yml` | AI Report 枢纽（advanced-chat）；定时消息 AI Report 模板默认打这个 Dify app | Messages 行 `AI_Endpoint` / Jira API 分支 | 行级 Endpoint + Headers 里的 Bearer app key |

## 边界

- Chrome 扩展 AR 即时刷新仍直连 `MEMORY_SERVICE_BASE_URL`，不走 AgentTask 跳板。
- AsMe 未启用 RingCentral sender 时走 AppScript 邮件 fallback，不走 Dify。
- Bot 群组消息需要先把 “SM AI” 加进目标群；私发不需要。
- secret 环境变量导入 YAML 时通常为空，Botman / RingCentral 相关 token、以及 AgentTask 跳板的 `MEMORY_SERVICE_API_KEY` 要在 Dify 环境变量里手工补齐后再 Publish。
- AgentTask 跳板连的是 memory-service **全权 `API_KEY`**（所有用户共用，请求里带 `X-User-Id`），不是扩展本机 `pak.…`，也不是 `BOOTSTRAP_API_KEY`。缺这把钥匙时下游返回 `401 authentication_required`。Botman / RingCentral 跳板不调 memory-service，不需要这把 key。
- **网络**：AgentTask 跳板下游 URL 写在 Dify 环境变量 `MEMORY_SERVICE_AGENT_TASK_URL`（YAML 默认 `http://10.32.56.212:3210/api/v1/agent-tasks/execute`），**不进** Jira rule / 扩展 `.env`。Jira rule 只打 `AGENT_TASK_DIFY_*`；Chrome AR 仍用 `MEMORY_SERVICE_BASE_URL`。

## 发布与接线

1. 在 Dify 导入对应 YAML 并 **Publish**。
2. 把 Workflow / App 的 API Base（通常 `https://dify.int.rclabenv.com/v1`）和 API Key 写入扩展 `.env`：
   - `AGENT_TASK_DIFY_API_BASE_URL` / `AGENT_TASK_DIFY_API_KEY`
   - `BOTMAN_DIFY_API_BASE_URL` / `BOTMAN_DIFY_API_KEY`
   - `RINGCENTRAL_SENDER_DIFY_API_BASE_URL` / `RINGCENTRAL_SENDER_DIFY_API_KEY`
3. 在定时消息管理页升级 Jira Executor Rule（模板版本 ≥ **1.6.0**），密钥会在创建/升级时注入 Rule。

产品说明见 [docs/features/scheduled_messages_manager.md](../../../docs/features/scheduled_messages_manager.md)。
