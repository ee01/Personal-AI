# Scheduled Messages · Dify Jumpboards

这些 YAML 是 Jira Automation 出站跳板，和 `jira-rule-template.json` 同属执行器配置，不放在 `docs/features/`。

| 文件 | 用途 | Env |
|---|---|---|
| `agent-task-jumpboard.yml` | Jira → Dify → `memory-service /agent-tasks/execute` | `AGENT_TASK_DIFY_API_*` |
| `botman-jumpboard.yml` | Jira → Dify → botman `/user/message` / `/team/message` | `BOTMAN_DIFY_API_*` |

AsMe（RingCentral sender）已有独立 Dify workflow，由 `RINGCENTRAL_SENDER_DIFY_API_*` 配置；Jira 不直连 RingCentral API。

Chrome 扩展 AR 即时刷新仍直连 `MEMORY_SERVICE_BASE_URL`，不受这些跳板影响。

导入后必须在 Dify 中 **Publish**，再在定时消息管理页升级 Jira Executor Rule（模板版本 ≥ 1.6.0）。
